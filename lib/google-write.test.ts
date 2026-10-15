import { describe, it, expect } from 'vitest'
import {
  toRRule,
  fromRRule,
  toGoogleEventBody,
  resolveAssignee,
  resolveCategory,
  toCalendarEvent,
  type EventInput,
  type GoogleEvent,
} from './google-events'
import { parseEventInput } from './event-input'
import { PERSON_GOOGLE_COLOR_IDS, RECURRENCE_LABELS, type Recurrence } from './types'

const TZ = 'Europe/Lisbon'

function input(overrides: Partial<EventInput> = {}): EventInput {
  return {
    title: 'School run',
    start_local: '2026-10-20T08:30:00',
    all_day: false,
    recurrence: 'none',
    category: 'kids',
    attendees: 'vasco',
    notes: null,
    ...overrides,
  }
}

describe('recurrence rules', () => {
  it('round-trips every rule the app can author', () => {
    for (const recurrence of Object.keys(RECURRENCE_LABELS) as Recurrence[]) {
      expect(fromRRule(toRRule(recurrence)), `${recurrence} did not survive`).toBe(recurrence)
    }
  })

  it('emits no rule for a one-off', () => {
    expect(toRRule('none')).toEqual([])
  })

  it('restricts weekdays to Monday through Friday', () => {
    expect(toRRule('weekdays')).toEqual(['RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'])
  })

  it('reports a rule it cannot express as none rather than guessing', () => {
    // Authored in Google Calendar: every third Tuesday until June. Google still
    // expands it correctly; we simply cannot offer to edit the rule, and
    // flattening it to "weekly" would be a lie that a later save would apply.
    expect(fromRRule(['RRULE:FREQ=MONTHLY;INTERVAL=3;BYDAY=2TU;UNTIL=20270601'])).toBe('none')
    expect(fromRRule([])).toBe('none')
    expect(fromRRule(undefined)).toBe('none')
  })
})

describe('toGoogleEventBody — timed events', () => {
  it('sends wall-clock plus a zone, never a UTC instant', () => {
    /*
     * The whole point: "08:30" must be sent as 08:30 with a timeZone, so
     * Google resolves it in the calendar's zone. Converting to UTC here would
     * make the event drift by an hour the moment DST changed.
     */
    const body = toGoogleEventBody(input(), TZ) as Record<string, { dateTime: string; timeZone: string }>
    expect(body.start).toEqual({ dateTime: '2026-10-20T08:30:00', timeZone: TZ })
    expect(body.start.dateTime).not.toContain('Z')
  })

  it('gives an event with no stated end one hour', () => {
    const body = toGoogleEventBody(input(), TZ) as Record<string, { dateTime: string }>
    expect(body.end.dateTime).toBe('2026-10-20T09:30:00')
  })

  it('rolls an end past midnight into the next day', () => {
    const body = toGoogleEventBody(
      input({ start_local: '2026-10-20T23:30:00' }),
      TZ,
    ) as Record<string, { dateTime: string }>
    expect(body.end.dateTime).toBe('2026-10-21T00:30:00')
  })
})

describe('toGoogleEventBody — all-day events', () => {
  it('uses bare dates with an exclusive end, as Google requires', () => {
    const body = toGoogleEventBody(
      input({ all_day: true, start_local: '2026-10-20' }),
      TZ,
    ) as Record<string, { date: string }>
    // An end of the 20th would make Google render a zero-length event.
    expect(body.start).toEqual({ date: '2026-10-20' })
    expect(body.end).toEqual({ date: '2026-10-21' })
  })

  it('rolls over a month boundary', () => {
    const body = toGoogleEventBody(
      input({ all_day: true, start_local: '2026-10-31' }),
      TZ,
    ) as Record<string, { date: string }>
    expect(body.end).toEqual({ date: '2026-11-01' })
  })
})

describe('toGoogleEventBody — assignee', () => {
  it('writes the assignee twice: as metadata and as the colour', () => {
    // extendedProperties is authoritative; colorId is the only part Google
    // Calendar actually shows. Both must agree or the two surfaces disagree.
    const body = toGoogleEventBody(input({ attendees: 'jennifer' }), TZ) as Record<string, unknown>
    expect(body.colorId).toBe(PERSON_GOOGLE_COLOR_IDS.jennifer)
    expect(resolveAssignee(body as GoogleEvent)).toBe('jennifer')
  })

  it('survives a write-then-read round trip intact', () => {
    const body = toGoogleEventBody(
      input({ attendees: 'jennifer', category: 'work' }),
      TZ,
    ) as GoogleEvent
    const readBack = toCalendarEvent({ ...body, id: 'g1' }, { origin: 'family' })!

    expect(readBack.attendees).toBe('jennifer')
    expect(readBack.category).toBe('work')
    expect(readBack.title).toBe('School run')
    expect(resolveCategory(body)).toBe('work')
  })
})

describe('parseEventInput', () => {
  const valid = {
    title: 'School run',
    start_local: '2026-10-20T08:30:00',
    all_day: false,
    recurrence: 'weekdays',
    category: 'kids',
    attendees: 'vasco',
    notes: '  ',
  }

  it('accepts a well-formed payload and trims empty notes to null', () => {
    const parsed = parseEventInput(valid)
    expect(parsed).not.toHaveProperty('error')
    expect((parsed as EventInput).notes).toBeNull()
    expect((parsed as EventInput).recurrence).toBe('weekdays')
  })

  it('requires a title', () => {
    expect(parseEventInput({ ...valid, title: '   ' })).toHaveProperty('error')
  })

  it('rejects values outside the known sets rather than passing them through', () => {
    // These drive a Postgres CHECK and a Google colour; unchecked they would
    // surface as a 500 from whichever system refused them first.
    expect(parseEventInput({ ...valid, attendees: 'dave' })).toHaveProperty('error')
    expect(parseEventInput({ ...valid, category: 'spaceship' })).toHaveProperty('error')
    expect(parseEventInput({ ...valid, recurrence: 'fortnightly' })).toHaveProperty('error')
  })

  it('rejects a malformed date', () => {
    expect(parseEventInput({ ...valid, start_local: 'tomorrow' })).toHaveProperty('error')
    expect(parseEventInput({ ...valid, start_local: '2026-10-20' })).toHaveProperty('error')
  })

  it('accepts a bare date when the event is all-day', () => {
    const parsed = parseEventInput({ ...valid, all_day: true, start_local: '2026-10-20' })
    expect(parsed).not.toHaveProperty('error')
    expect((parsed as EventInput).start_local).toBe('2026-10-20')
  })

  it('rejects a non-object body', () => {
    expect(parseEventInput(null)).toHaveProperty('error')
    expect(parseEventInput('nope')).toHaveProperty('error')
  })
})
