import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { listAllEvents, createEvent } from '@/lib/google-calendar'
import { parseEventInput, googleErrorResponse } from '@/lib/event-input'
import { agendaWindow } from '@/lib/calendar-window'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { from, to } = agendaWindow()

  try {
    const { events, partial } = await listAllEvents(session.user.email, from, to)
    return NextResponse.json(events, {
      headers: {
        // Names whoever's calendars could not be read, so a half-complete day
        // is distinguishable from a quiet one.
        ...(partial.length ? { 'X-Calendar-Partial': partial.join(',') } : {}),
      },
    })
  } catch (error) {
    return googleErrorResponse(error, 'read')
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const input = parseEventInput(await request.json())
  if ('error' in input) return NextResponse.json(input, { status: 400 })

  try {
    return NextResponse.json(await createEvent(session.user.email, input), { status: 201 })
  } catch (error) {
    return googleErrorResponse(error, 'create')
  }
}
