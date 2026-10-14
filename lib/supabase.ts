import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

/**
 * Server-only Supabase client using the service-role key.
 *
 * Created lazily on first request rather than at module load: `next build`
 * imports every route module to collect page data, and the build environment
 * has no reason to hold runtime secrets. Validating at import time made the
 * build fail with "Missing SUPABASE_URL".
 *
 * All DB access goes through /api routes, so neither value needs a
 * NEXT_PUBLIC_ prefix. Never import this from a client component.
 */
export function getSupabase(): SupabaseClient {
  if (client) return client

  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) throw new Error('Missing SUPABASE_URL')
  if (!serviceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')

  client = createClient(url, serviceRoleKey, { auth: { persistSession: false } })
  return client
}
