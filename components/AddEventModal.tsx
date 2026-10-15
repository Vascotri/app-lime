'use client'

import { useState } from 'react'
import { Modal } from './Modal'
import { Picker } from './Chip'
import type { CalendarEvent, Recurrence, EventCategory, Attendee } from '@/lib/types'
import { RECURRENCE_LABELS, EVENT_CATEGORY_LABELS, PERSON_LABELS } from '@/lib/types'

interface Props {
  event?: CalendarEvent | null
  onClose: () => void
  onSaved: () => void
}

export function AddEventModal({ event, onClose, onSaved }: Props) {
  const isEdit = !!event
  const [title, setTitle] = useState(event?.title ?? '')
  const [date, setDate] = useState(
    event?.start_at ? event.start_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
  )
  const [time, setTime] = useState(event?.start_at ? event.start_at.slice(11, 16) : '09:00')
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

    const start_at = allDay ? `${date}T00:00:00.000Z` : `${date}T${time}:00.000Z`

    const payload = {
      title: title.trim(),
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
          <input
            autoFocus
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border-gray-200 text-sm py-2.5"
            />
          </div>
          {!allDay && (
            <div className="w-28">
              <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
              <input
                type="time"
                value={time}
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Repeat</label>
          <select
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value as Recurrence)}
            className="w-full rounded-lg border-gray-200 text-sm py-2.5"
          >
            {(Object.entries(RECURRENCE_LABELS) as [Recurrence, string][]).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
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
