import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getTokens, hasRequiredScopes } from '@/lib/google-tokens'

/**
 * Whether this user's Google Calendar connection is usable.
 *
 * Distinguishes "never connected" from "connected without the calendar
 * scopes" — the latter happens to anyone who signed in before those scopes
 * existed, and needs the same fix (re-consent) for a different reason.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tokens = await getTokens(session.user.email)

  if (!tokens) {
    return NextResponse.json({ connected: false, reason: 'not_connected' })
  }

  if (!hasRequiredScopes(tokens.scope)) {
    return NextResponse.json({ connected: false, reason: 'missing_scopes' })
  }

  return NextResponse.json({ connected: true, calendarId: tokens.calendar_id })
}
