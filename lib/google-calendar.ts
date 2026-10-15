import { getAccessToken, GoogleReconnectRequired } from './google-tokens'
import { getSetting, setSetting, FAMILY_CALENDAR_ID } from './settings'
import {
  toCalendarEvents,
  toCalendarEvent,
  mergeEvents,
  toGoogleEventBody,
  type GoogleEvent,
  type EventInput,
} from './google-events'
import { ALLOWED_EMAILS, EMAIL_TO_NAME } from './types'
import type { CalendarEvent, Person } from './types'
import { getTokens } from './google-tokens'

const API = 'https://www.googleapis.com/calendar/v3'

export const CALENDAR_NAME = 'Family (Lime)'

/** Calendars are created with a fixed zone so both phones agree on "all day". */
export const CALENDAR_TIMEZONE = process.env.CALENDAR_TIMEZONE ?? 'Europe/Lisbon'

export class GoogleCalendarError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'GoogleCalendarError'
  }
}

async function googleFetch(
  email: string,
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  const accessToken = await getAccessToken(email)

  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  })

  if (response.status === 401 || response.status === 403) {
    // The grant is present but no longer sufficient — revoked mid-session, or
    // the scopes were changed. Same remedy as a missing token: re-consent.
    throw new GoogleReconnectRequired()
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new GoogleCalendarError(
      `Google Calendar ${response.status}: ${body.slice(0, 200)}`,
      response.status,
    )
  }

  if (response.status === 204) return null
  return response.json()
}

/**
 * The shared family calendar's id, creating and sharing it on first use.
 *
 * Provisioning is lazy and idempotent via app_settings: whoever reads first
 * creates it, and the other person finds the stored id rather than making a
 * second calendar. The ACL grant is what puts it in the other person's Google
 * Calendar, which is the entire point of the feature.
 */
export async function ensureFamilyCalendar(email: string): Promise<string> {
  const existing = await getSetting(FAMILY_CALENDAR_ID)
  if (existing) return existing

  const created = (await googleFetch(email, '/calendars', {
    method: 'POST',
    body: JSON.stringify({
      summary: CALENDAR_NAME,
      description: 'Shared family calendar, managed by Lime.',
      timeZone: CALENDAR_TIMEZONE,
    }),
  })) as { id?: string }

  if (!created?.id) throw new Error('Google did not return a calendar id.')

  // Share with everyone in the family except the creator, who already owns it.
  for (const member of ALLOWED_EMAILS.filter((candidate) => candidate !== email)) {
    try {
      await googleFetch(email, `/calendars/${encodeURIComponent(created.id)}/acl`, {
        method: 'POST',
        body: JSON.stringify({
          role: 'writer',
          scope: { type: 'user', value: member },
        }),
      })
    } catch (error) {
      // A calendar nobody else can see is still better than no calendar, and
      // sharing can be retried. Don't lose the calendar we just made.
      console.error(`Failed to share calendar with ${member}:`, error)
    }
  }

  await setSetting(FAMILY_CALENDAR_ID, created.id)
  return created.id
}

/**
 * Events in [from, to], with recurring series already expanded by Google.
 *
 * singleEvents=true is what hands recurrence — including per-occurrence
 * exceptions and DST — to Google rather than to us.
 */
export async function listEvents(
  email: string,
  from: Date,
  to: Date,
): Promise<CalendarEvent[]> {
  const calendarId = await ensureFamilyCalendar(email)
  return toCalendarEvents(await fetchEvents(email, calendarId, from, to), { origin: 'family' })
}

interface CalendarListEntry {
  id?: string
  summary?: string
  accessRole?: string
  primary?: boolean
}

/**
 * The user's own calendars, excluding the shared Family one.
 *
 * Filtered to calendars they own or can write to. Subscribed feeds — national
 * holidays, birthdays, sports fixtures — come through as `reader` and are pure
 * noise on a family dashboard, so they never make it in.
 */
export async function listPersonalCalendarIds(
  email: string,
  familyCalendarId: string,
): Promise<string[]> {
  const payload = (await googleFetch(
    email,
    '/users/me/calendarList?minAccessRole=writer&maxResults=250',
  )) as { items?: CalendarListEntry[] }

  return (payload?.items ?? [])
    .filter((entry): entry is CalendarListEntry & { id: string } => !!entry.id)
    .filter((entry) => entry.id !== familyCalendarId)
    .filter((entry) => entry.accessRole === 'owner' || entry.accessRole === 'writer')
    .map((entry) => entry.id)
}

/**
 * Cap on pages fetched per calendar: 5 x 250 = 1250 events.
 *
 * Bounds worst-case latency. Over a 90-day window a single daily recurrence
 * already contributes 90 expanded instances, so one page is nowhere near
 * enough and silently truncating would quietly lose days off the end.
 */
const MAX_PAGES = 5

async function fetchEvents(
  email: string,
  calendarId: string,
  from: Date,
  to: Date,
): Promise<GoogleEvent[]> {
  const items: GoogleEvent[] = []
  let pageToken: string | undefined
  let pages = 0

  do {
    const query = new URLSearchParams({
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
    })
    if (pageToken) query.set('pageToken', pageToken)

    const payload = (await googleFetch(
      email,
      `/calendars/${encodeURIComponent(calendarId)}/events?${query}`,
    )) as { items?: GoogleEvent[]; nextPageToken?: string }

    items.push(...(payload?.items ?? []))
    pageToken = payload?.nextPageToken
    pages += 1
  } while (pageToken && pages < MAX_PAGES)

  return items
}

function personFor(email: string): Person | undefined {
  const name = EMAIL_TO_NAME[email]?.toLowerCase()
  return name === 'vasco' || name === 'jennifer' ? name : undefined
}

/**
 * Everything the family has on, from every calendar either of them owns.
 *
 * Reads with each person's own stored credentials — the app holds both, so one
 * person opening the dashboard still produces the combined view rather than
 * half of it. Personal events are marked read-only (the app has read scope
 * only) and anything the other person marked private is reduced to "Busy"
 * before it leaves the server.
 *
 * One person's connection failing degrades their half rather than the whole
 * dashboard: a broken grant for Jennifer should not blank Vasco's day.
 */
export async function listAllEvents(
  viewerEmail: string,
  from: Date,
  to: Date,
): Promise<{ events: CalendarEvent[]; partial: string[] }> {
  const familyCalendarId = await ensureFamilyCalendar(viewerEmail)
  const viewer = personFor(viewerEmail)

  const groups: CalendarEvent[][] = []
  const partial: string[] = []

  // The shared calendar, read once rather than once per member.
  groups.push(
    toCalendarEvents(await fetchEvents(viewerEmail, familyCalendarId, from, to), {
      origin: 'family',
      viewer,
    }),
  )

  for (const email of ALLOWED_EMAILS) {
    const owner = personFor(email)
    if (!owner) continue

    try {
      // Only members who have actually connected can be read.
      if (!(await getTokens(email))) {
        partial.push(email)
        continue
      }

      const calendarIds = await listPersonalCalendarIds(email, familyCalendarId)
      for (const calendarId of calendarIds) {
        groups.push(
          toCalendarEvents(await fetchEvents(email, calendarId, from, to), {
            origin: 'personal',
            owner,
            viewer,
          }),
        )
      }
    } catch (error) {
      console.error(`Could not read calendars for ${email}:`, error)
      partial.push(email)
    }
  }

  return { events: mergeEvents(groups), partial }
}

/* ---------------------------------------------------------------- writing */

/*
 * Every write addresses the Family calendar explicitly and never takes a
 * calendar id from the caller. That is the structural reason a bug here
 * cannot touch a real work meeting: we hold no write scope on personal
 * calendars, and the code has no way to name one.
 */

export async function createEvent(email: string, input: EventInput): Promise<CalendarEvent> {
  const calendarId = await ensureFamilyCalendar(email)

  const created = (await googleFetch(
    email,
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    { method: 'POST', body: JSON.stringify(toGoogleEventBody(input, CALENDAR_TIMEZONE)) },
  )) as GoogleEvent

  const mapped = toCalendarEvent(created, { origin: 'family' })
  if (!mapped) throw new Error('Google returned an event we could not read back.')
  return mapped
}

export async function updateEvent(
  email: string,
  eventId: string,
  input: EventInput,
): Promise<CalendarEvent> {
  const calendarId = await ensureFamilyCalendar(email)

  const updated = (await googleFetch(
    email,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: 'PATCH', body: JSON.stringify(toGoogleEventBody(input, CALENDAR_TIMEZONE)) },
  )) as GoogleEvent

  const mapped = toCalendarEvent(updated, { origin: 'family' })
  if (!mapped) throw new Error('Google returned an event we could not read back.')
  return mapped
}

export async function deleteEvent(email: string, eventId: string): Promise<void> {
  const calendarId = await ensureFamilyCalendar(email)

  await googleFetch(
    email,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: 'DELETE' },
  )
}

export { GoogleReconnectRequired }
