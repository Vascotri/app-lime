import type { CalendarEvent, Recurrence } from './types'

/**
 * Given a base event with a recurrence rule, returns all instances
 * whose start falls within [from, to] (inclusive).
 */
export function expandEvent(
  event: CalendarEvent,
  from: Date,
  to: Date,
): CalendarEvent[] {
  const recurrence = event.recurrence as Recurrence

  // One-off event
  if (!recurrence || recurrence === 'none') {
    const d = new Date(event.start_at)
    return d >= from && d <= to ? [event] : []
  }

  // Jump cursor to first occurrence on/after `from`
  const cursor = fastForward(new Date(event.start_at), recurrence, from)
  const results: CalendarEvent[] = []

  let safety = 0
  while (cursor <= to && safety++ < 500) {
    results.push({
      ...event,
      instance_date: cursor.toISOString(),
    })
    advance(cursor, recurrence)
  }

  return results
}

/** Advance a date by one recurrence step (mutates in place). */
function advance(d: Date, recurrence: Recurrence): void {
  switch (recurrence) {
    case 'daily':
      d.setDate(d.getDate() + 1)
      break
    case 'weekdays':
      d.setDate(d.getDate() + 1)
      while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)
      break
    case 'weekly':
      d.setDate(d.getDate() + 7)
      break
    case 'monthly':
      d.setMonth(d.getMonth() + 1)
      break
    case 'yearly':
      d.setFullYear(d.getFullYear() + 1)
      break
  }
}

/** Jump cursor to the first occurrence on or after `from`. */
function fastForward(cursor: Date, recurrence: Recurrence, from: Date): Date {
  if (cursor >= from) return cursor

  const diff = from.getTime() - cursor.getTime()
  const oneDay = 86_400_000

  switch (recurrence) {
    case 'daily':
    case 'weekdays': {
      const days = Math.floor(diff / oneDay)
      cursor.setDate(cursor.getDate() + days)
      // weekdays: make sure we land on a weekday
      if (recurrence === 'weekdays') {
        while (cursor.getDay() === 0 || cursor.getDay() === 6) cursor.setDate(cursor.getDate() + 1)
      }
      break
    }
    case 'weekly': {
      const weeks = Math.floor(diff / (7 * oneDay))
      cursor.setDate(cursor.getDate() + weeks * 7)
      break
    }
    case 'monthly': {
      const months = Math.floor(diff / (30 * oneDay))
      cursor.setMonth(cursor.getMonth() + months)
      break
    }
    case 'yearly': {
      const years = Math.floor(diff / (365 * oneDay))
      cursor.setFullYear(cursor.getFullYear() + years)
      break
    }
  }

  // Fine-advance until on/after `from`
  while (cursor < from) advance(cursor, recurrence)

  return cursor
}
