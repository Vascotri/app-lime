'use client'

import { useId, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Modal } from './Modal'
import { Picker } from './Chip'
import type { CalendarEvent, Recurrence, EventCategory, Attendee } from '@/lib/types'
import { RECURRENCE_LABELS, EVENT_CATEGORY_LABELS, PERSON_LABELS } from '@/lib/types'

interface Props {
  event?: CalendarEvent | null
  onClose: () => void
  onSaved: () => void
}

/**
 * Initial date and time for the form, in the user's own clock.
 *
 * An all-day event is anchored at UTC midnight and carries no real time, so
 * its date is read verbatim; converting it could shift it a day. A timed event
 * is converted to local, so editing shows the time the user actually sees in
 * the agenda rather than its UTC equivalent.
 */
function initialDateTime(event?: CalendarEvent | null): { date: string; time: string } {
  if (!event) return { date: format(new Date(), 'yyyy-MM-dd'), time: '09:00' }

  const iso = event.instance_date ?? event.start_at
  if (event.all_day) return { date: iso.slice(0, 10), time: '09:00' }

  const local = parseISO(iso)
  return { date: format(local, 'yyyy-MM-dd'), time: format(local, 'HH:mm') }
}

export function AddEventModal({ event, onClose, onSaved }: Props) {
  const isEdit = !!event
  // Unique per mounted modal, so ids stay distinct if two ever coexist.
  const uid = useId()
  // Google expands a series and keeps the rule on the parent, so this row is
  // a single occurrence rather than the series itself.
  const isSeriesInstance = !!event?.recurring
  const initial = initialDateTime(event)
  const [title, setTitle] = useState(event?.title ?? '')
  const [date, setDate] = useState(initial.date)
  const [time, setTime] = useState(initial.time)
  const [allDay, setAllDay] = useState(event?.all_day ?? false)
  const [recurrence, setRecurrence] = useState<Recurrence>(event?.recurrence ?? 'none')
  const [category, setCategory] = useState<EventCategory>(event?.category ?? 'other')
  const [attendees, setAttendees] = useState<Attendee>(event?.attendees ?? 'both')
  const [notes, setNotes] = useState(event?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('Title is required.'); return }
    setSaving(true)
    setError('')

    /*
     * Send the wall-clock time as typed. The server pairs it with the
     * calendar's zone so "09:00" stays nine o'clock, including across a DST
     * change. start_at is the same moment as a real instant, kept only for the
     * Supabase path — previously it was built by stamping a "Z" onto local
     * time, which silently shifted every event by the UTC offset.
     */
    const start_local = allDay ? date : `${date}T${time}:00`
    const [year, month, day] = date.split('-').map(Number)
    const [hour, minute] = time.split(':').map(Number)
    const start_at = allDay
      ? `${date}T00:00:00.000Z`
      : new Date(year, month - 1, day, hour, minute).toISOString()

    const payload = {
      title: title.trim(),
      start_local,
      start_at,
      all_day: allDay,
      recurrence,
      category,
      attendees,
      notes: notes.trim() || null,
    }
    const url = isEdit ? `/api/events/${event!.id}` : '/api/events'
    const method = isEdit ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Failed to save event.')
      setSaving(false)
      return
    }
    onSaved()
  }

  return (
    <Modal title={isEdit ? 'Edit event' : 'New event'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <div>
          <label htmlFor={`${uid}-title`} className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
          <input
            autoFocus
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            id={`${uid}-title`}
            placeholder="e.g. Dinner with family"
            className="w-full rounded-lg border-gray-200 text-sm py-2.5"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            id="allDay"
            type="checkbox"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
            className="rounded border-gray-300 text-lime-600 focus:ring-lime-500 w-4 h-4"
          />
          <label htmlFor="allDay" className="text-sm text-gray-700">All day</label>
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label htmlFor={`${uid}-date`} className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
            <input
              type="date"
              value={date}
              id={`${uid}-date`}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border-gray-200 text-sm py-2.5"
            />
          </div>
          {!allDay && (
            <div className="w-28">
              <label htmlFor={`${uid}-time`} className="block text-sm font-medium text-gray-700 mb-1">Time</label>
              <input
                type="time"
                value={time}
                id={`${uid}-time`}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-lg border-gray-200 text-sm py-2.5"
              />
            </div>
          )}
        </div>

        <Picker
          label="Who's going?"
          options={PERSON_LABELS}
          value={attendees}
          onChange={setAttendees}
          columns={3}
        />

        <Picker
          label="Category"
          options={EVENT_CATEGORY_LABELS}
          value={category}
          onChange={setCategory}
          columns={3}
        />

        <div>
          <label htmlFor={`${uid}-repeat`} className="block text-sm font-medium text-gray-700 mb-1">Repeat</label>
          <select
            id={`${uid}-repeat`}
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value as Recurrence)}
            disabled={isSeriesInstance}
            className="w-full rounded-lg border-gray-200 text-sm py-2.5 disabled:bg-gray-50 disabled:text-gray-400"
          >
            {(Object.entries(RECURRENCE_LABELS) as [Recurrence, string][]).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          {/*
            * The repeat rule belongs to the series, which lives on a parent
            * event we are not editing. Offering the control here would imply a
            * change this save cannot make.
            */}
          {isSeriesInstance && (
            <p className="mt-1.5 text-xs text-gray-500">
              One occurrence of a repeating event — changes apply to this date only. Edit the
              series in Google Calendar to change how often it repeats.
            </p>
          )}
        </div>

        <div>
          <label htmlFor={`${uid}-notes`} className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            id={`${uid}-notes`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Optional notes…"
            className="w-full rounded-lg border-gray-200 text-sm py-2.5 resize-none"
          />
        </div>

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-xl bg-lime-500 py-2.5 text-sm font-semibold text-white hover:bg-lime-600 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add event'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
