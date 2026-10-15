export type CalendarSource = 'supabase' | 'google'

/**
 * Which backing store to read events from.
 *
 * Defaults to Supabase, so deploying the Google read path changes nothing
 * until the flag is thrown deliberately. A `?source=` query override lets both
 * be opened side by side in two tabs, which is how we confirm the Google data
 * matches before committing to the one-way migration.
 *
 * Lives here rather than in the route module because Next.js only permits an
 * allow-listed set of exports from a route file.
 */
export function resolveSource(requested: string | null): CalendarSource {
  if (requested === 'google' || requested === 'supabase') return requested
  return process.env.CALENDAR_SOURCE === 'google' ? 'google' : 'supabase'
}
