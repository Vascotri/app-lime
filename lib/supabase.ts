import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

/**
 * Reduce whatever was pasted into SUPABASE_URL to a bare origin.
 *
 * The Supabase dashboard shows several URLs on the same screen — the Project
 * URL (`https://ref.supabase.co`) and the RESTful endpoint
 * (`https://ref.supabase.co/rest/v1`). supabase-js appends `/rest/v1` itself,
 * so pasting the latter yields `.../rest/v1/rest/v1` and every query fails with
 * "Invalid path specified in request URL". Strip any path, query or fragment so
 * all the variants on that screen work.
 */
export function normaliseSupabaseUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) throw new Error('SUPABASE_URL is empty')

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`

  let parsed: URL
  try {
    parsed = new URL(withScheme)
  } catch {
    throw new Error(`SUPABASE_URL is not a valid URL: ${raw}`)
  }

  return `${parsed.protocol}//${parsed.host}`
}

/**
 * Server-only Supabase client using the service-role key.
 *
 * Built lazily on first request, not at module load: `next build` imports every
 * route module to collect page data, and the build environment has no reason to
 * hold runtime secrets. Never import this from a client component.
 */
export function getSupabase(): SupabaseClient {
  if (client) return client

  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) throw new Error('Missing SUPABASE_URL')
  if (!serviceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')

  client = createClient(normaliseSupabaseUrl(url), serviceRoleKey, {
    auth: { persistSession: false },
  })
  return client
}
