import { getAccessToken, GoogleReconnectRequired } from './google-tokens'
import { getSetting, setSetting, FAMILY_CALENDAR_ID } from './settings'
import { toCalendarEvents, type GoogleEvent } from './google-events'
import { ALLOWED_EMAILS } from './types'
import type { CalendarEvent } from './types'

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

  const query = new URLSearchParams({
    timeMin: from.toISOString(),
    timeMax: to.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  })

  const payload = (await googleFetch(
    email,
    `/calendars/${encodeURIComponent(calendarId)}/events?${query}`,
  )) as { items?: GoogleEvent[] }

  return toCalendarEvents(payload?.items ?? [])
}

export { GoogleReconnectRequired }
