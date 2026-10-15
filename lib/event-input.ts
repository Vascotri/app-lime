import { NextResponse } from 'next/server'
import { GoogleReconnectRequired } from './google-tokens'
import {
  PERSON_LABELS,
  EVENT_CATEGORY_LABELS,
  RECURRENCE_LABELS,
  type Person,
  type EventCategory,
  type Recurrence,
} from './types'
import type { EventInput } from './google-events'

/**
 * Validate and normalise an event payload from the browser.
 *
 * Values that drive a Postgres CHECK or a Google colour are narrowed to the
 * known sets rather than trusted: an unexpected category would otherwise
 * surface as a 500 from whichever system rejected it first.
 */
export function parseEventInput(body: unknown): EventInput | { error: string } {
  if (typeof body !== 'object' || body === null) return { error: 'Expected an object.' }
  const input = body as Record<string, unknown>

  const title = typeof input.title === 'string' ? input.title.trim() : ''
  if (!title) return { error: 'Title is required.' }

  const allDay = input.all_day === true

  // Wall-clock as typed. The browser sends this instead of a UTC instant so
  // "09:00" stays nine o'clock when resolved against the calendar's zone.
  const startLocal = typeof input.start_local === 'string' ? input.start_local : ''
  const pattern = allDay ? /^\d{4}-\d{2}-\d{2}/ : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/
  if (!pattern.test(startLocal)) return { error: 'A valid date is required.' }

  const attendees = (input.attendees as Person) ?? 'both'
  if (!(attendees in PERSON_LABELS)) return { error: 'Unknown attendee.' }

  const category = (input.category as EventCategory) ?? 'other'
  if (!(category in EVENT_CATEGORY_LABELS)) return { error: 'Unknown category.' }

  const recurrence = (input.recurrence as Recurrence) ?? 'none'
  if (!(recurrence in RECURRENCE_LABELS)) return { error: 'Unknown repeat rule.' }

  const notes = typeof input.notes === 'string' && input.notes.trim() ? input.notes.trim() : null

  return {
    title,
    start_local: allDay ? startLocal.slice(0, 10) : startLocal.slice(0, 19),
    all_day: allDay,
    recurrence,
    category,
    attendees,
    notes,
  }
}

/**
 * Turn a Google failure into the response the dashboard already understands.
 *
 * 409 rather than 401 for an expired grant: the session is fine, so a 401
 * would read as "signed out" and bounce the user to the login page.
 */
export function googleErrorResponse(error: unknown, action: string): NextResponse {
  if (error instanceof GoogleReconnectRequired) {
    return NextResponse.json({ error: 'reconnect_required' }, { status: 409 })
  }
  console.error(`Google Calendar ${action} failed:`, error)
  return NextResponse.json({ error: 'calendar_unavailable' }, { status: 502 })
}
