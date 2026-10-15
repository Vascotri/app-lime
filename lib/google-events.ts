import type { CalendarEvent, Person, EventCategory, Recurrence } from './types'
import { PERSON_LABELS, EVENT_CATEGORY_LABELS, PERSON_GOOGLE_COLOR_IDS } from './types'

/** The slice of Google's event resource we actually consume. */
export interface GoogleEvent {
  id?: string
  status?: string
  summary?: string
  description?: string
  colorId?: string
  recurringEventId?: string
  /** 'default' | 'public' | 'private' | 'confidential' */
  visibility?: string
  transparency?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
  extendedProperties?: { private?: Record<string, string> }
}

/** Visibility values that mean "others should see only that I'm busy". */
const WITHHELD_VISIBILITY = new Set(['private', 'confidential'])

export function isWithheld(event: GoogleEvent): boolean {
  return WITHHELD_VISIBILITY.has(event.visibility ?? 'default')
}

/** Keys we own inside extendedProperties.private. */
export const ASSIGNEE_KEY = 'lime_assignee'
export const CATEGORY_KEY = 'lime_category'

function isPerson(value: unknown): value is Person {
  return typeof value === 'string' && value in PERSON_LABELS
}

function isEventCategory(value: unknown): value is EventCategory {
  return typeof value === 'string' && value in EVENT_CATEGORY_LABELS
}

/** colorId -> person, derived from the forward mapping so they cannot diverge. */
const COLOR_ID_TO_PERSON: Record<string, Person> = Object.fromEntries(
  (Object.entries(PERSON_GOOGLE_COLOR_IDS) as [Person, string][]).map(([person, id]) => [
    id,
    person,
  ]),
)

/**
 * Who an event belongs to.
 *
 * Our own metadata wins. Falling back to the event's colour means an event
 * created directly in Google Calendar — which carries no metadata of ours —
 * still lands on the right person if it was coloured, so the two surfaces
 * agree without anyone touching the app. Default is 'both': shared is the
 * safer assumption than silently assigning work to one person.
 */
export function resolveAssignee(event: GoogleEvent): Person {
  const tagged = event.extendedProperties?.private?.[ASSIGNEE_KEY]
  if (isPerson(tagged)) return tagged

  if (event.colorId && COLOR_ID_TO_PERSON[event.colorId]) {
    return COLOR_ID_TO_PERSON[event.colorId]
  }

  return 'both'
}

export function resolveCategory(event: GoogleEvent): EventCategory {
  const tagged = event.extendedProperties?.private?.[CATEGORY_KEY]
  return isEventCategory(tagged) ? tagged : 'other'
}

/**
 * Normalise Google's two date shapes.
 *
 * Timed events carry `dateTime` (an RFC3339 instant); all-day events carry
 * `date` ("2026-10-20") with no time or zone at all. Anchoring the latter at
 * UTC midnight keeps the calendar-day arithmetic the panel does intact.
 */
function toIso(slot: { dateTime?: string; date?: string } | undefined): string | null {
  if (slot?.dateTime) return new Date(slot.dateTime).toISOString()
  if (slot?.date) return `${slot.date}T00:00:00.000Z`
  return null
}

export function isAllDay(event: GoogleEvent): boolean {
  return !event.start?.dateTime && !!event.start?.date
}

/**
 * Map a Google event to the shape the panel renders.
 *
 * Returns null for anything unrenderable — cancelled events (which Google
 * still returns), and events with no id or start.
 */
export interface MapOptions {
  /** Which calendar this came from. */
  origin?: 'family' | 'personal'
  /** Whose personal calendar it is — forces the assignee for personal events. */
  owner?: Person
  /** The signed-in person the result is being rendered for. */
  viewer?: Person
}

export function toCalendarEvent(
  event: GoogleEvent,
  options: MapOptions = {},
): CalendarEvent | null {
  if (event.status === 'cancelled') return null
  if (!event.id) return null

  const startAt = toIso(event.start)
  if (!startAt) return null

  const { origin = 'family', owner, viewer } = options

  /*
   * Redaction. A personal event marked private or confidential belongs to its
   * owner alone: the other person gets the time slot and nothing else.
   *
   * Decided here, server-side, rather than by hiding it in the component —
   * a withheld title must never be serialised into the page at all, or
   * "private" is only private until someone opens devtools.
   */
  const withheld = origin === 'personal' && !!owner && owner !== viewer && isWithheld(event)

  return {
    id: event.id,
    title: withheld ? 'Busy' : event.summary?.trim() || '(No title)',
    start_at: startAt,
    end_at: toIso(event.end),
    all_day: isAllDay(event),
    // With singleEvents=true Google returns expanded instances and the rule
    // itself lives on the parent. Slice 4 reads RRULE properly; for now record
    // only that this instance belongs to a series.
    recurrence: 'none',
    recurring: !!event.recurringEventId,
    category: withheld ? 'other' : resolveCategory(event),
    // A personal event needs no tagging: whose calendar it sits on already
    // says who it belongs to.
    attendees: origin === 'personal' && owner ? owner : resolveAssignee(event),
    notes: withheld ? null : event.description?.trim() || null,
    origin,
    busy: withheld || undefined,
  }
}

/** Map a page of Google events, dropping unrenderable ones, sorted by start. */
export function toCalendarEvents(
  events: GoogleEvent[],
  options: MapOptions = {},
): CalendarEvent[] {
  return events
    .map((event) => toCalendarEvent(event, options))
    .filter((event): event is CalendarEvent => event !== null)
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
}

/**
 * Merge events from several calendars, keeping one copy of each.
 *
 * The Family calendar appears in both people's calendar lists once shared, so
 * without this its events would arrive two or more times. Family wins over a
 * personal copy of the same id, since that is the editable one.
 */
export function mergeEvents(groups: CalendarEvent[][]): CalendarEvent[] {
  const byId = new Map<string, CalendarEvent>()

  for (const group of groups) {
    for (const event of group) {
      const existing = byId.get(event.id)
      if (!existing || (existing.origin === 'personal' && event.origin === 'family')) {
        byId.set(event.id, event)
      }
    }
  }

  return [...byId.values()].sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
  )
}

/** Our metadata, written alongside every event we create. */
export function toExtendedProperties(
  attendees: Person,
  category: EventCategory,
): { private: Record<string, string> } {
  return { private: { [ASSIGNEE_KEY]: attendees, [CATEGORY_KEY]: category } }
}

/* ---------------------------------------------------------------- writing */

const RRULES: Record<Recurrence, string | null> = {
  none: null,
  daily: 'RRULE:FREQ=DAILY',
  weekdays: 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
  weekly: 'RRULE:FREQ=WEEKLY',
  monthly: 'RRULE:FREQ=MONTHLY',
  yearly: 'RRULE:FREQ=YEARLY',
}

/** Our repeat options as the RFC 5545 rules Google expects. */
export function toRRule(recurrence: Recurrence): string[] {
  const rule = RRULES[recurrence]
  return rule ? [rule] : []
}

/**
 * Read one of our own rules back.
 *
 * Only recognises rules this app writes; anything authored in Google Calendar
 * ("every 3rd Tuesday until June") has no equivalent here and comes back as
 * 'none' rather than being flattened into a near-miss. Google still expands
 * such a series correctly — we just can't offer to edit the rule.
 */
export function fromRRule(rules: string[] | undefined): Recurrence {
  if (!rules?.length) return 'none'
  const normalised = rules.map((rule) => rule.trim().toUpperCase())
  for (const [recurrence, rule] of Object.entries(RRULES) as [Recurrence, string | null][]) {
    if (rule && normalised.includes(rule)) return recurrence
  }
  return 'none'
}

/** A naive local datetime, "YYYY-MM-DDTHH:mm:ss", with no zone attached. */
function addHours(local: string, hours: number): string {
  const date = new Date(`${local}Z`)
  date.setUTCHours(date.getUTCHours() + hours)
  return date.toISOString().slice(0, 19)
}

function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00Z`)
  parsed.setUTCDate(parsed.getUTCDate() + days)
  return parsed.toISOString().slice(0, 10)
}

export interface EventInput {
  title: string
  /** Wall-clock time as typed: "YYYY-MM-DD" when all-day, else with a time. */
  start_local: string
  all_day: boolean
  recurrence: Recurrence
  category: EventCategory
  attendees: Person
  notes: string | null
}

/**
 * Build the Google event body for a create or update.
 *
 * Times are sent as wall-clock plus an explicit timeZone rather than as a UTC
 * instant. "09:00" means nine o'clock here, and letting Google resolve that
 * against the calendar's zone keeps it nine o'clock across a DST boundary
 * instead of drifting by an hour.
 *
 * Google requires an end; the form only asks for a start, so a timed event
 * gets an hour and an all-day event one day. All-day end dates are exclusive,
 * hence the +1.
 *
 * The assignee is written twice on purpose: to extendedProperties, which is
 * authoritative and survives, and to colorId, which is the only part Google
 * Calendar actually shows.
 */
export function toGoogleEventBody(
  input: EventInput,
  timeZone: string,
): Record<string, unknown> {
  const base = {
    summary: input.title,
    description: input.notes ?? '',
    colorId: PERSON_GOOGLE_COLOR_IDS[input.attendees],
    extendedProperties: toExtendedProperties(input.attendees, input.category),
    recurrence: toRRule(input.recurrence),
  }

  if (input.all_day) {
    const start = input.start_local.slice(0, 10)
    return { ...base, start: { date: start }, end: { date: addDays(start, 1) } }
  }

  return {
    ...base,
    start: { dateTime: input.start_local, timeZone },
    end: { dateTime: addHours(input.start_local, 1), timeZone },
  }
}
