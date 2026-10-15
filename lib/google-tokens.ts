import { getSupabase } from './supabase'

export interface StoredTokens {
  email: string
  refresh_token: string
  access_token: string | null
  expires_at: string | null
  scope: string | null
  calendar_id: string | null
}

/** Scopes the app needs. Kept here so auth and the connection check agree. */
export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  // Create a secondary calendar, and full access to calendars THIS app created.
  // Deliberately not the blanket `calendar` scope: the app must never be able
  // to read the family's work or personal calendars.
  'https://www.googleapis.com/auth/calendar.app.created',
  // Needed to share the Family calendar with the other person; ACL writes are
  // not covered by calendar.app.created.
  'https://www.googleapis.com/auth/calendar.acls',
] as const

/** The calendar scopes that must be present for sync to work. */
export const REQUIRED_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.app.created',
  'https://www.googleapis.com/auth/calendar.acls',
] as const

export function hasRequiredScopes(scope: string | null | undefined): boolean {
  if (!scope) return false
  const granted = new Set(scope.split(/\s+/).filter(Boolean))
  return REQUIRED_CALENDAR_SCOPES.every((required) => granted.has(required))
}

export async function saveTokens(params: {
  email: string
  refreshToken: string
  accessToken?: string | null
  expiresAt?: Date | null
  scope?: string | null
}): Promise<void> {
  await getSupabase()
    .from('google_tokens')
    .upsert(
      {
        email: params.email,
        refresh_token: params.refreshToken,
        access_token: params.accessToken ?? null,
        expires_at: params.expiresAt?.toISOString() ?? null,
        scope: params.scope ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'email' },
    )
}

export async function getTokens(email: string): Promise<StoredTokens | null> {
  const { data } = await getSupabase()
    .from('google_tokens')
    .select('*')
    .eq('email', email)
    .maybeSingle()

  return (data as StoredTokens | null) ?? null
}

export async function deleteTokens(email: string): Promise<void> {
  await getSupabase().from('google_tokens').delete().eq('email', email)
}

/** Thrown when the stored grant is gone and the user must reconnect. */
export class GoogleReconnectRequired extends Error {
  constructor(message = 'Google Calendar needs to be reconnected.') {
    super(message)
    this.name = 'GoogleReconnectRequired'
  }
}

/** Treat a token as stale slightly early, so it can't expire mid-request. */
const EXPIRY_SKEW_MS = 60_000

export function isAccessTokenFresh(
  tokens: Pick<StoredTokens, 'access_token' | 'expires_at'>,
  now: Date = new Date(),
): boolean {
  if (!tokens.access_token || !tokens.expires_at) return false
  return new Date(tokens.expires_at).getTime() - EXPIRY_SKEW_MS > now.getTime()
}

/**
 * A usable access token for this user, refreshing via the stored refresh token
 * when needed.
 *
 * Throws GoogleReconnectRequired when the grant itself is dead (revoked, or
 * the token was issued while the OAuth app was still in Testing, where Google
 * expires refresh tokens after 7 days). The stored row is removed in that case
 * so the UI falls back to the connect prompt rather than retrying forever.
 */
export async function getAccessToken(email: string): Promise<string> {
  const tokens = await getTokens(email)
  if (!tokens) throw new GoogleReconnectRequired('Google Calendar is not connected.')

  if (isAccessTokenFresh(tokens)) return tokens.access_token!

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      refresh_token: tokens.refresh_token,
      grant_type: 'refresh_token',
    }),
  })

  const payload = (await response.json()) as {
    access_token?: string
    expires_in?: number
    scope?: string
    error?: string
  }

  if (!response.ok || !payload.access_token) {
    // invalid_grant means the refresh token is permanently dead — revoked,
    // expired, or superseded. Anything else may be transient, so leave the row.
    if (payload.error === 'invalid_grant') {
      await deleteTokens(email)
      throw new GoogleReconnectRequired()
    }
    throw new Error(`Google token refresh failed: ${payload.error ?? response.status}`)
  }

  await getSupabase()
    .from('google_tokens')
    .update({
      access_token: payload.access_token,
      expires_at: new Date(Date.now() + (payload.expires_in ?? 3600) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('email', email)

  return payload.access_token
}
