import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { updateEvent, deleteEvent } from '@/lib/google-calendar'
import { parseEventInput, googleErrorResponse } from '@/lib/event-input'

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const input = parseEventInput(await request.json())
  if ('error' in input) return NextResponse.json(input, { status: 400 })

  try {
    // Addresses the Family calendar only. An id belonging to a personal
    // calendar isn't found there, so a read-only event cannot be edited even
    // if one reached this endpoint.
    return NextResponse.json(await updateEvent(session.user.email, params.id, input))
  } catch (error) {
    return googleErrorResponse(error, 'update')
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await deleteEvent(session.user.email, params.id)
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return googleErrorResponse(error, 'delete')
  }
}
