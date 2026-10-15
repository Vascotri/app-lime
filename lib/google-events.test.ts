import { describe, it, expect } from 'vitest'
import {
  toCalendarEvent,
  toCalendarEvents,
  resolveAssignee,
  resolveCategory,
  toExtendedProperties,
  isAllDay,
  ASSIGNEE_KEY,
  CATEGORY_KEY,
  type GoogleEvent,
} from './google-events'
import { PERSON_GOOGLE_COLOR_IDS } from './types'

function googleEvent(overrides: Partial<GoogleEvent> = {}): GoogleEvent {
  return {
    id: 'g-1',
    summary: 'School run',
    start: { dateTime: '2026-10-20T08:30:00Z' },
    end: { dateTime: '2026-10-20T09:00:00Z' },
    ...overrides,
  }
}

describe('resolveAssignee', () => {
  it('prefers our own metadata', () => {
    const event = googleEvent({
      extendedProperties: { private: { [ASSIGNEE_KEY]: 'jennifer' } },
      colorId: PERSON_GOOGLE_COLOR_IDS.vasco,
    })
    expect(resolveAssignee(event)).toBe('jennifer')
  })

  it('falls back to the event colour', () => {
    // An event created directly in Google Calendar carries none of our
    // metadata, but a colour still tells us who it belongs to.
    expect(resolveAssignee(googleEvent({ colorId: PERSON_GOOGLE_COLOR_IDS.vasco }))).toBe('vasco')
    expect(resolveAssignee(googleEvent({ colorId: PERSON_GOOGLE_COLOR_IDS.jennifer }))).toBe(
      'jennifer',
    )
  })

  it('defaults to both when there is nothing to go on', () => {
    // Shared is the safe guess; silently assigning a chore to one person is not.
    expect(resolveAssignee(googleEvent())).toBe('both')
  })

  it('defaults to both for a colour we do not use', () => {
    expect(resolveAssignee(googleEvent({ colorId: '3' }))).toBe('both')
  })

  it('ignores a metadata value that is not a person', () => {
    const event = googleEvent({
      extendedProperties: { private: { [ASSIGNEE_KEY]: 'dave' } },
    })
    expect(resolveAssignee(event)).toBe('both')
  })
})

describe('resolveCategory', () => {
  it('reads our metadata', () => {
    const event = googleEvent({
      extendedProperties: { private: { [CATEGORY_KEY]: 'kids' } },
    })
    expect(resolveCategory(event)).toBe('kids')
  })

  it('defaults to other, including for an unknown value', () => {
    expect(resolveCategory(googleEvent())).toBe('other')
    expect(
      resolveCategory(googleEvent({ extendedProperties: { private: { [CATEGORY_KEY]: 'nope' } } })),
    ).toBe('other')
  })
})

describe('toCalendarEvent', () => {
  it('maps a timed event', () => {
    const mapped = toCalendarEvent(googleEvent())
    expect(mapped).toMatchObject({
      id: 'g-1',
      title: 'School run',
      all_day: false,
      attendees: 'both',
      category: 'other',
    })
    expect(mapped!.start_at).toBe('2026-10-20T08:30:00.000Z')
  })

  it('maps an all-day event, which carries a date and no zone', () => {
    const event = googleEvent({ start: { date: '2026-10-20' }, end: { date: '2026-10-21' } })
    const mapped = toCalendarEvent(event)
    expect(mapped!.all_day).toBe(true)
    expect(mapped!.start_at).toBe('2026-10-20T00:00:00.000Z')
    // The panel groups by the first ten characters, so this must stay the day
    // the user picked rather than drifting across midnight.
    expect(mapped!.start_at.slice(0, 10)).toBe('2026-10-20')
  })

  it('marks an instance of a series as recurring', () => {
    const mapped = toCalendarEvent(googleEvent({ recurringEventId: 'series-1' }))
    expect(mapped!.recurring).toBe(true)
    // The rule lives on the parent; we must not invent one.
    expect(mapped!.recurrence).toBe('none')
  })

  it('leaves a one-off event unmarked', () => {
    expect(toCalendarEvent(googleEvent())!.recurring).toBe(false)
  })

  it('drops cancelled events, which Google still returns', () => {
    expect(toCalendarEvent(googleEvent({ status: 'cancelled' }))).toBeNull()
  })

  it('drops events with no id or no start', () => {
    expect(toCalendarEvent(googleEvent({ id: undefined }))).toBeNull()
    expect(toCalendarEvent(googleEvent({ start: undefined }))).toBeNull()
  })

  it('gives an untitled event a readable placeholder', () => {
    // Google allows a blank summary; a blank row is unclickable in the panel.
    expect(toCalendarEvent(googleEvent({ summary: '   ' }))!.title).toBe('(No title)')
    expect(toCalendarEvent(googleEvent({ summary: undefined }))!.title).toBe('(No title)')
  })

  it('normalises a blank description to null', () => {
    expect(toCalendarEvent(googleEvent({ description: '  ' }))!.notes).toBeNull()
  })

  it('tolerates an event with no end', () => {
    expect(toCalendarEvent(googleEvent({ end: undefined }))!.end_at).toBeNull()
  })
})

describe('toCalendarEvents', () => {
  it('drops unrenderable entries and sorts by start', () => {
    const mapped = toCalendarEvents([
      googleEvent({ id: 'late', start: { dateTime: '2026-10-21T10:00:00Z' } }),
      googleEvent({ id: 'cancelled', status: 'cancelled' }),
      googleEvent({ id: 'early', start: { dateTime: '2026-10-19T10:00:00Z' } }),
      googleEvent({ id: 'broken', start: undefined }),
    ])
    expect(mapped.map((event) => event.id)).toEqual(['early', 'late'])
  })

  it('handles an empty page', () => {
    expect(toCalendarEvents([])).toEqual([])
  })
})

describe('round trip', () => {
  it('reads back what it writes', () => {
    // Guards the write path in slice 3 against drifting from the read path.
    const properties = toExtendedProperties('jennifer', 'kids')
    const event = googleEvent({ extendedProperties: properties })
    expect(resolveAssignee(event)).toBe('jennifer')
    expect(resolveCategory(event)).toBe('kids')
  })
})

describe('isAllDay', () => {
  it('distinguishes the two date shapes', () => {
    expect(isAllDay(googleEvent({ start: { date: '2026-10-20' } }))).toBe(true)
    expect(isAllDay(googleEvent())).toBe(false)
    expect(isAllDay(googleEvent({ start: undefined }))).toBe(false)
  })
})
