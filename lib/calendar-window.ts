/** How far ahead the agenda looks. */
export const WINDOW_DAYS = 90

/**
 * The agenda window: local midnight today, to WINDOW_DAYS ahead.
 *
 * Anchored at local midnight rather than "now" so an event earlier today
 * doesn't vanish halfway through the morning.
 */
export function agendaWindow(now: Date = new Date()): { from: Date; to: Date } {
  const from = new Date(now)
  from.setHours(0, 0, 0, 0)
  const to = new Date(from)
  to.setDate(to.getDate() + WINDOW_DAYS)
  return { from, to }
}
