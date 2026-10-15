import { describe, it, expect } from 'vitest'
import { dayKey, agendaKey, isOngoing, groupByAgendaDay } from './agenda'
import { agendaWindow, WINDOW_DAYS } from './calendar-window'
import type { CalendarEvent } from './types'

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'e1',
    title: 'Event',
    start_at: '2026-10-15T09:00:00.000Z',
    end_at: null,
    all_day: false,
    recurrence: 'none',
    category: 'other',
    attendees: 'both',
    notes: null,
    ...overrides,
  }
}

const TODAY = '2026-10-15'

describe('dayKey', () => {
  it('reads an all-day date verbatim', () => {
    // Anchored at UTC midnight with no real time; converting to local could
    // shift it a day for anyone west of UTC.
    expect(dayKey(event({ all_day: true, start_at: '2026-10-20T00:00:00.000Z' }))).toBe('2026-10-20')
  })

  it('prefers the expanded instance date over the series start', () => {
    expect(
      dayKey(event({ start_at: '2026-01-01T09:00:00.000Z', instance_date: '2026-10-22T09:00:00.000Z' })),
    ).toBe('2026-10-22')
  })
})

describe('agendaKey — the ongoing multi-day case', () => {
  it('files an event that began before today under today', () => {
    /*
     * The reported bug. Google's timeMin selects events that END after it, so
     * a wedding that started on the 9th and runs past the 15th is correctly
     * returned with a start date in the past — and was being filed under
     * "Friday, 9 Oct", a day already gone.
     */
    const stillRunning = event({ all_day: true, start_at: '2026-10-09T00:00:00.000Z' })
    expect(dayKey(stillRunning)).toBe('2026-10-09')
    expect(agendaKey(stillRunning, TODAY)).toBe(TODAY)
  })

  it('leaves a future event on its own day', () => {
    const future = event({ all_day: true, start_at: '2026-10-20T00:00:00.000Z' })
    expect(agendaKey(future, TODAY)).toBe('2026-10-20')
  })

  it('leaves an event starting today alone', () => {
    expect(agendaKey(event({ start_at: '2026-10-15T18:00:00.000Z' }), TODAY)).toBe(TODAY)
  })
})

describe('isOngoing', () => {
  it('flags an event that started earlier', () => {
    expect(isOngoing(event({ all_day: true, start_at: '2026-10-09T00:00:00.000Z' }), TODAY)).toBe(
      true,
    )
  })

  it('does not flag today or later', () => {
    expect(isOngoing(event({ start_at: '2026-10-15T09:00:00.000Z' }), TODAY)).toBe(false)
    expect(isOngoing(event({ all_day: true, start_at: '2026-10-20T00:00:00.000Z' }), TODAY)).toBe(
      false,
    )
  })
})

describe('groupByAgendaDay', () => {
  it('never produces a day before today', () => {
    const grouped = groupByAgendaDay(
      [
        event({ id: 'a', all_day: true, start_at: '2026-10-09T00:00:00.000Z' }),
        event({ id: 'b', all_day: true, start_at: '2026-10-11T00:00:00.000Z' }),
        event({ id: 'c', all_day: true, start_at: '2026-10-20T00:00:00.000Z' }),
      ],
      TODAY,
    )

    for (const day of grouped.keys()) {
      expect(day >= TODAY, `agenda showed a past day: ${day}`).toBe(true)
    }
    // Both stragglers collapse onto today.
    expect(grouped.get(TODAY)).toHaveLength(2)
    expect(grouped.get('2026-10-20')).toHaveLength(1)
  })

  it('keeps several events on the same day together', () => {
    const grouped = groupByAgendaDay(
      [
        event({ id: 'a', start_at: '2026-10-20T09:00:00.000Z', all_day: true }),
        event({ id: 'b', start_at: '2026-10-20T18:00:00.000Z', all_day: true }),
      ],
      TODAY,
    )
    expect(grouped.size).toBe(1)
    expect(grouped.get('2026-10-20')).toHaveLength(2)
  })
})

describe('agendaWindow', () => {
  it('looks three months ahead', () => {
    expect(WINDOW_DAYS).toBe(90)
  })

  it('starts at local midnight so this morning does not disappear', () => {
    const now = new Date('2026-10-15T14:30:00')
    const { from, to } = agendaWindow(now)
    expect(from.getHours()).toBe(0)
    expect(from.getMinutes()).toBe(0)
    expect(from.getDate()).toBe(15)
    expect(Math.round((to.getTime() - from.getTime()) / 86_400_000)).toBe(WINDOW_DAYS)
  })
})
