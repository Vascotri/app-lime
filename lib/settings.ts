import { getSupabase } from './supabase'

export const FAMILY_CALENDAR_ID = 'family_calendar_id'

export async function getSetting(key: string): Promise<string | null> {
  const { data } = await getSupabase()
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle()

  return (data as { value: string } | null)?.value ?? null
}

export async function setSetting(key: string, value: string): Promise<void> {
  await getSupabase()
    .from('app_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
}
