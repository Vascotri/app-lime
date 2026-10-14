import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { expandEvent } from '@/lib/recurrence'
import type { CalendarEvent } from '@/lib/types'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('start_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Expand recurring events for next 60 days (dashboard shows 14, but give some buffer)
  const from = new Date()
  from.setHours(0, 0, 0, 0)
  const to = new Date(from)
  to.setDate(to.getDate() + 14)

  const expanded: CalendarEvent[] = []
  for (const event of (data as CalendarEvent[])) {
    expanded.push(...expandEvent(event, from, to))
  }

  expanded.sort((a, b) => {
    const dateA = a.instance_date ?? a.start_at
    const dateB = b.instance_date ?? b.start_at
    return new Date(dateA).getTime() - new Date(dateB).getTime()
  })

  return NextResponse.json(expanded)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { data, error } = await supabase
    .from('events')
    .insert({
      title: body.title,
      start_at: body.start_at,
      end_at: body.end_at ?? null,
      all_day: body.all_day ?? false,
      recurrence: body.recurrence ?? 'none',
      notes: body.notes ?? null,
      created_by: session.user?.email,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
