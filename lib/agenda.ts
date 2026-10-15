import { format, parseISO } from 'date-fns'
import type { CalendarEvent } from './types'

/**
 * The calendar day an event belongs to, as "YYYY-MM-DD".
 *
 * All-day events are anchored at UTC midnight and carry no real time, so they
 * are read verbatim — converting them to local time could shift them a day.
 * Timed events are converted to local, matching the clock shown beside them.
 */
export function dayKey(event: CalendarEvent): string {
  const iso = event.instance_date ?? event.start_at
  return event.all_day ? iso.slice(0, 10) : format(parseISO(iso), 'yyyy-MM-dd')
}

export function todayKey(now: Date = new Date()): string {
  return format(now, 'yyyy-MM-dd')
}

/**
 * Where an event should appear in the agenda.
 *
 * Google's timeMin selects events that *end* after it, not ones that start
 * after it — so a multi-day event already under way is correctly returned
 * with a start date in the past. Filing it under that date buries it in a day
 * that has been and gone ("Friday, 9 Oct" on the 15th). An event happening now
 * belongs under today.
 */
export function agendaKey(event: CalendarEvent, today: string = todayKey()): string {
  const key = dayKey(event)
  return key < today ? today : key
}

/** True when the event began before today and is still running. */
export function isOngoing(event: CalendarEvent, today: string = todayKey()): boolean {
  return dayKey(event) < today
}

/** Group events under the day they should be read on, in date order. */
export function groupByAgendaDay(
  events: CalendarEvent[],
  today: string = todayKey(),
): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>()
  for (const event of events) {
    const key = agendaKey(event, today)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(event)
  }
  return map
}
