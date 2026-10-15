import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSupabase } from '@/lib/supabase'
import { expandEvent } from '@/lib/recurrence'
import { listAllEvents, GoogleReconnectRequired } from '@/lib/google-calendar'
import { resolveSource } from '@/lib/calendar-source'
import type { CalendarEvent } from '@/lib/types'

/** How far ahead the dashboard agenda looks. */
const WINDOW_DAYS = 14

function windowFromNow(): { from: Date; to: Date } {
  const from = new Date()
  from.setHours(0, 0, 0, 0)
  const to = new Date(from)
  to.setDate(to.getDate() + WINDOW_DAYS)
  return { from, to }
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const source = resolveSource(new URL(request.url).searchParams.get('source'))
  const { from, to } = windowFromNow()

  if (source === 'google') {
    try {
      const { events, partial } = await listAllEvents(session.user.email, from, to)
      return NextResponse.json(events, {
        headers: {
          'X-Calendar-Source': 'google',
          // Names whoever's calendars could not be read, so a half-complete
          // day is distinguishable from a quiet one.
          ...(partial.length ? { 'X-Calendar-Partial': partial.join(',') } : {}),
        },
      })
    } catch (error) {
      if (error instanceof GoogleReconnectRequired) {
        // 409, not 401: the session is fine, it's the Google grant that isn't.
        // A 401 would read as "signed out" and bounce them to the login page.
        return NextResponse.json({ error: 'reconnect_required' }, { status: 409 })
      }
      console.error('Google Calendar read failed:', error)
      return NextResponse.json({ error: 'calendar_unavailable' }, { status: 502 })
    }
  }

  const { data, error } = await getSupabase()
    .from('events')
    .select('*')
    .order('start_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const expanded: CalendarEvent[] = []
  for (const event of data as CalendarEvent[]) {
    expanded.push(...expandEvent(event, from, to))
  }

  expanded.sort((a, b) => {
    const dateA = a.instance_date ?? a.start_at
    const dateB = b.instance_date ?? b.start_at
    return new Date(dateA).getTime() - new Date(dateB).getTime()
  })

  return NextResponse.json(expanded, { headers: { 'X-Calendar-Source': 'supabase' } })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { data, error } = await getSupabase()
    .from('events')
    .insert({
      title: body.title,
      start_at: body.start_at,
      end_at: body.end_at ?? null,
      all_day: body.all_day ?? false,
      recurrence: body.recurrence ?? 'none',
      category: body.category ?? 'other',
      attendees: body.attendees ?? 'both',
      notes: body.notes ?? null,
      created_by: session.user?.email,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
