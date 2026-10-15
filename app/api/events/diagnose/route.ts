import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSupabase } from '@/lib/supabase'
import { expandEvent } from '@/lib/recurrence'
import { listEvents, CALENDAR_NAME } from '@/lib/google-calendar'
import { getTokens, hasRequiredScopes } from '@/lib/google-tokens'
import { getSetting, FAMILY_CALENDAR_ID } from '@/lib/settings'
import { resolveSource } from '@/lib/calendar-source'
import type { CalendarEvent } from '@/lib/types'

const WINDOW_DAYS = 14

/**
 * Side-by-side comparison of both event sources.
 *
 * Reading `/api/events?source=…` twice and getting `[]` both times is
 * ambiguous in the worst way: it cannot distinguish "Google works and the
 * calendar is empty" from "Google was never reached", nor "Supabase is empty"
 * from "everything in it fell outside the 14-day window". This reports the
 * totals either side of that window, plus the connection state, so the answer
 * is visible rather than inferred.
 *
 * Temporary: remove together with the Supabase events table in slice 5.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const email = session.user.email

  const from = new Date()
  from.setHours(0, 0, 0, 0)
  const to = new Date(from)
  to.setDate(to.getDate() + WINDOW_DAYS)

  // --- Supabase -----------------------------------------------------------
  let supabaseReport: Record<string, unknown>
  try {
    const { data, error } = await getSupabase()
      .from('events')
      .select('*')
      .order('start_at', { ascending: true })

    if (error) throw new Error(error.message)

    const rows = (data ?? []) as CalendarEvent[]
    const inWindow = rows.flatMap((row) => expandEvent(row, from, to))

    supabaseReport = {
      totalRows: rows.length,
      inWindow: inWindow.length,
      // The usual explanation for rows > 0 but inWindow === 0.
      earliest: rows[0]?.start_at ?? null,
      latest: rows[rows.length - 1]?.start_at ?? null,
      titles: rows.slice(0, 10).map((row) => ({ title: row.title, start_at: row.start_at })),
    }
  } catch (error) {
    supabaseReport = { error: error instanceof Error ? error.message : String(error) }
  }

  // --- Google -------------------------------------------------------------
  let googleReport: Record<string, unknown>
  try {
    const tokens = await getTokens(email)
    const calendarId = await getSetting(FAMILY_CALENDAR_ID)

    if (!tokens) {
      googleReport = { connected: false, reason: 'not_connected', calendarId }
    } else if (!hasRequiredScopes(tokens.scope)) {
      googleReport = {
        connected: false,
        reason: 'missing_scopes',
        grantedScope: tokens.scope,
        calendarId,
      }
    } else {
      // Calling through listEvents provisions the calendar if absent, so this
      // doubles as the check that provisioning works.
      const events = await listEvents(email, from, to)
      googleReport = {
        connected: true,
        calendarName: CALENDAR_NAME,
        calendarId: await getSetting(FAMILY_CALENDAR_ID),
        calendarWasJustCreated: !calendarId,
        inWindow: events.length,
        titles: events.slice(0, 10).map((e) => ({ title: e.title, start_at: e.start_at })),
      }
    }
  } catch (error) {
    googleReport = {
      connected: false,
      reason: 'error',
      error: error instanceof Error ? error.message : String(error),
    }
  }

  return NextResponse.json({
    activeSource: resolveSource(null),
    window: { from: from.toISOString(), to: to.toISOString(), days: WINDOW_DAYS },
    supabase: supabaseReport,
    google: googleReport,
  })
}
