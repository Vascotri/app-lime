import { describe, it, expect } from 'vitest'
import { expandEvent } from './recurrence'
import type { CalendarEvent, Recurrence } from './types'

/**
 * Dates use 12:00Z so that a machine's local offset can't shift the calendar
 * day — `advance()` reasons in local time, and midday keeps local and UTC on
 * the same date for every real-world offset.
 *
 * Reference: 2026-01-01 is a Thursday, so 2026-01-05 is a Monday.
 */
function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'evt-1',
    title: 'Test event',
    start_at: '2026-01-05T12:00:00.000Z',
    end_at: null,
    all_day: false,
    recurrence: 'none',
    notes: null,
    created_by: 'test@example.com',
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

const at = (iso: string) => new Date(iso)
const days = (result: CalendarEvent[]) =>
  result.map((e) => (e.instance_date ?? e.start_at).slice(0, 10))

describe('expandEvent — one-off events', () => {
  it('returns the event when it falls inside the window', () => {
    const event = makeEvent({ recurrence: 'none' })
    const result = expandEvent(event, at('2026-01-01T00:00:00Z'), at('2026-01-31T23:59:59Z'))
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('evt-1')
  })

  it('omits an event that ended before the window', () => {
    const event = makeEvent({ recurrence: 'none', start_at: '2025-12-01T12:00:00.000Z' })
    const result = expandEvent(event, at('2026-01-01T00:00:00Z'), at('2026-01-31T23:59:59Z'))
    expect(result).toEqual([])
  })

  it('omits an event that starts after the window', () => {
    const event = makeEvent({ recurrence: 'none', start_at: '2026-06-01T12:00:00.000Z' })
    const result = expandEvent(event, at('2026-01-01T00:00:00Z'), at('2026-01-31T23:59:59Z'))
    expect(result).toEqual([])
  })
})

describe('expandEvent — recurring events', () => {
  it('expands a daily event once per day across the window', () => {
    const event = makeEvent({ recurrence: 'daily' })
    const result = expandEvent(event, at('2026-01-05T00:00:00Z'), at('2026-01-11T23:59:59Z'))
    expect(days(result)).toEqual([
      '2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08',
      '2026-01-09', '2026-01-10', '2026-01-11',
    ])
  })

  it('expands a weekly event once per week', () => {
    const event = makeEvent({ recurrence: 'weekly' })
    const result = expandEvent(event, at('2026-01-05T00:00:00Z'), at('2026-02-01T23:59:59Z'))
    expect(days(result)).toEqual(['2026-01-05', '2026-01-12', '2026-01-19', '2026-01-26'])
  })

  it('expands a monthly event once per month', () => {
    const event = makeEvent({ recurrence: 'monthly' })
    const result = expandEvent(event, at('2026-01-05T00:00:00Z'), at('2026-04-30T23:59:59Z'))
    expect(days(result)).toEqual(['2026-01-05', '2026-02-05', '2026-03-05', '2026-04-05'])
  })

  it('expands a yearly event once per year', () => {
    const event = makeEvent({ recurrence: 'yearly' })
    const result = expandEvent(event, at('2026-01-05T00:00:00Z'), at('2028-01-31T23:59:59Z'))
    expect(days(result)).toEqual(['2026-01-05', '2027-01-05', '2028-01-05'])
  })

  it('skips weekends for a weekdays event (the school-run case)', () => {
    const event = makeEvent({ recurrence: 'weekdays' })
    const result = expandEvent(event, at('2026-01-05T00:00:00Z'), at('2026-01-11T23:59:59Z'))
    // Mon–Fri only; Sat 10th and Sun 11th excluded.
    expect(days(result)).toEqual([
      '2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09',
    ])
    for (const instance of result) {
      const weekday = new Date(instance.instance_date!).getDay()
      expect(weekday).not.toBe(0)
      expect(weekday).not.toBe(6)
    }
  })

  it('omits a recurring event whose first occurrence is after the window', () => {
    const event = makeEvent({ recurrence: 'daily', start_at: '2026-06-01T12:00:00.000Z' })
    const result = expandEvent(event, at('2026-01-01T00:00:00Z'), at('2026-01-31T23:59:59Z'))
    expect(result).toEqual([])
  })
})

describe('expandEvent — windows far from the start date', () => {
  it('fast-forwards a long-running daily event into a distant window', () => {
    // The cleaning lady was added in January; we are looking at February.
    const event = makeEvent({ recurrence: 'daily', start_at: '2026-01-01T12:00:00.000Z' })
    const result = expandEvent(event, at('2026-02-01T00:00:00Z'), at('2026-02-07T23:59:59Z'))
    expect(days(result)).toEqual([
      '2026-02-01', '2026-02-02', '2026-02-03', '2026-02-04',
      '2026-02-05', '2026-02-06', '2026-02-07',
    ])
  })

  it('fast-forwards a weekdays event without landing on a weekend', () => {
    // 2026-03-02 is exactly 8 weeks after 2026-01-05, so also a Monday.
    const event = makeEvent({ recurrence: 'weekdays', start_at: '2026-01-05T12:00:00.000Z' })
    const result = expandEvent(event, at('2026-03-02T00:00:00Z'), at('2026-03-08T23:59:59Z'))
    expect(days(result)).toEqual([
      '2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06',
    ])
  })

  it('fast-forwards a weekly event onto the correct weekday', () => {
    const event = makeEvent({ recurrence: 'weekly', start_at: '2026-01-05T12:00:00.000Z' })
    const result = expandEvent(event, at('2026-03-01T00:00:00Z'), at('2026-03-31T23:59:59Z'))
    // Every instance must stay on a Monday.
    for (const instance of result) {
      expect(new Date(instance.instance_date!).getDay()).toBe(1)
    }
    expect(result.length).toBeGreaterThan(0)
  })
})

describe('expandEvent — contract', () => {
  it('returns instances in ascending order', () => {
    const event = makeEvent({ recurrence: 'daily' })
    const result = expandEvent(event, at('2026-01-05T00:00:00Z'), at('2026-01-20T23:59:59Z'))
    const times = result.map((e) => new Date(e.instance_date!).getTime())
    expect(times).toEqual([...times].sort((a, b) => a - b))
  })

  it('tags every recurring instance with its own instance_date', () => {
    const event = makeEvent({ recurrence: 'daily' })
    const result = expandEvent(event, at('2026-01-05T00:00:00Z'), at('2026-01-08T23:59:59Z'))
    expect(result.every((e) => typeof e.instance_date === 'string')).toBe(true)
    // The shared fields survive the expansion.
    expect(result.every((e) => e.title === 'Test event' && e.id === 'evt-1')).toBe(true)
  })

  it('does not mutate the event it was given', () => {
    const event = makeEvent({ recurrence: 'daily' })
    const snapshot = structuredClone(event)
    expandEvent(event, at('2026-01-05T00:00:00Z'), at('2026-01-20T23:59:59Z'))
    expect(event).toEqual(snapshot)
  })

  it('terminates and stays bounded on a wide window', () => {
    const event = makeEvent({ recurrence: 'daily', start_at: '2020-01-01T12:00:00.000Z' })
    const result = expandEvent(event, at('2020-01-01T00:00:00Z'), at('2030-01-01T00:00:00Z'))
    expect(result.length).toBeLessThanOrEqual(500)
  })

  it('treats every supported recurrence rule as expandable', () => {
    const rules: Recurrence[] = ['daily', 'weekdays', 'weekly', 'monthly', 'yearly']
    for (const recurrence of rules) {
      const event = makeEvent({ recurrence })
      const result = expandEvent(event, at('2026-01-05T00:00:00Z'), at('2029-01-05T23:59:59Z'))
      expect(result.length, `${recurrence} produced no instances`).toBeGreaterThan(0)
    }
  })
})
