import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSupabase } from '@/lib/supabase'
import { updateEvent, deleteEvent } from '@/lib/google-calendar'
import { parseEventInput, googleErrorResponse } from '@/lib/event-input'
import { resolveSource } from '@/lib/calendar-source'

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const source = resolveSource(new URL(request.url).searchParams.get('source'))

  if (source === 'google') {
    const input = parseEventInput(body)
    if ('error' in input) return NextResponse.json(input, { status: 400 })

    try {
      // Addresses the Family calendar only. An id belonging to a personal
      // calendar simply isn't found there, so a read-only event cannot be
      // edited even if one reached this endpoint.
      return NextResponse.json(await updateEvent(session.user.email, params.id, input))
    } catch (error) {
      return googleErrorResponse(error, 'update')
    }
  }

  const { data, error } = await getSupabase()
    .from('events')
    .update({
      title: body.title,
      start_at: body.start_at,
      end_at: body.end_at ?? null,
      all_day: body.all_day ?? false,
      recurrence: body.recurrence ?? 'none',
      category: body.category ?? 'other',
      attendees: body.attendees ?? 'both',
      notes: body.notes ?? null,
    })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const source = resolveSource(new URL(request.url).searchParams.get('source'))

  if (source === 'google') {
    try {
      await deleteEvent(session.user.email, params.id)
      return new NextResponse(null, { status: 204 })
    } catch (error) {
      return googleErrorResponse(error, 'delete')
    }
  }

  const { error } = await getSupabase().from('events').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
