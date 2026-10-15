'use client'

import { useState } from 'react'
import { format, isToday, isTomorrow, parseISO } from 'date-fns'
import type { CalendarEvent } from '@/lib/types'
import {
  RECURRENCE_LABELS,
  EVENT_CATEGORY_LABELS,
  EVENT_CATEGORY_BARS,
  PERSON_LABELS,
  PERSON_TONES,
  categoryTone,
} from '@/lib/types'
import { Chip } from './Chip'
import { AddEventModal } from './AddEventModal'

interface Props {
  events: CalendarEvent[]
  loading: boolean
  onRefresh: () => void
}

function dayLabel(dateStr: string): string {
  const d = parseISO(dateStr)
  if (isToday(d)) return 'Today'
  if (isTomorrow(d)) return 'Tomorrow'
  return format(d, 'EEEE, d MMM')
}

function groupByDay(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>()
  for (const ev of events) {
    const key = (ev.instance_date ?? ev.start_at).slice(0, 10)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(ev)
  }
  return map
}

export function CalendarPanel({ events, loading, onRefresh }: Props) {
  const [showAdd, setShowAdd] = useState(false)
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null)

  async function handleDelete(id: string) {
    if (!confirm('Delete this event?')) return
    await fetch(`/api/events/${id}`, { method: 'DELETE' })
    onRefresh()
  }

  const grouped = groupByDay(events)
  const days = [...grouped.keys()].sort()

  return (
    <div className="bg-white rounded-2xl border border-lime-100 shadow-sm flex flex-col min-h-0">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-lime-50 bg-lime-50 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <span className="text-lg">📅</span>
          <h2 className="text-sm font-semibold text-gray-800">Upcoming</h2>
          {!loading && events.length > 0 && (
            <span className="text-xs bg-lime-100 text-lime-700 rounded-full px-2 py-0.5 font-medium">
              {events.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="w-7 h-7 flex items-center justify-center rounded-full bg-lime-500 text-white text-lg leading-none hover:bg-lime-600 transition-colors"
          aria-label="Add event"
        >
          +
        </button>
      </div>

      {/* Panel body */}
      <div className="flex-1 overflow-y-auto panel-scroll p-3 space-y-3 max-h-[60dvh] lg:max-h-none">
        {loading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        )}

        {!loading && days.length === 0 && (
          <div className="text-center py-5 lg:py-8">
            <p className="text-2xl mb-2">🗓️</p>
            <p className="text-sm text-gray-500">No events in the next 14 days.</p>
            <button
              onClick={() => setShowAdd(true)}
              className="mt-3 text-xs text-lime-600 font-medium hover:underline"
            >
              Add your first event →
            </button>
          </div>
        )}

        {!loading && days.map((day) => (
          <div key={day}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 px-1">
              {dayLabel(day)}
            </p>
            <div className="space-y-1">
              {grouped.get(day)!.map((ev) => (
                <div
                  key={`${ev.id}-${ev.instance_date ?? ev.start_at}`}
                  className="group flex items-start gap-2.5 rounded-xl px-3 py-2.5 hover:bg-lime-50 transition-colors cursor-pointer"
                  onClick={() => setEditEvent(ev)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setEditEvent(ev)}
                >
                  <div
                    className={`w-1 h-full min-h-[2rem] rounded-full flex-shrink-0 mt-0.5 ${
                      EVENT_CATEGORY_BARS[ev.category] ?? EVENT_CATEGORY_BARS.other
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{ev.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-xs text-gray-400">
                        {ev.all_day
                          ? 'All day'
                          : format(parseISO(ev.instance_date ?? ev.start_at), 'h:mm a')}
                      </span>
                      {ev.category && ev.category !== 'other' && (
                        <Chip
                          label={EVENT_CATEGORY_LABELS[ev.category]}
                          tone={categoryTone(ev.category)}
                        />
                      )}
                      <Chip
                        label={PERSON_LABELS[ev.attendees ?? 'both']}
                        tone={PERSON_TONES[ev.attendees ?? 'both']}
                      />
                      {ev.recurrence !== 'none' && (
                        <span className="text-xs text-lime-600 whitespace-nowrap">
                          ↻ {RECURRENCE_LABELS[ev.recurrence].toLowerCase()}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(ev.id) }}
                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-xs w-6 h-6 flex items-center justify-center rounded transition-all flex-shrink-0"
                    aria-label="Delete event"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {(showAdd || editEvent) && (
        <AddEventModal
          event={editEvent}
          onClose={() => { setShowAdd(false); setEditEvent(null) }}
          onSaved={() => { setShowAdd(false); setEditEvent(null); onRefresh() }}
        />
      )}
    </div>
  )
}
