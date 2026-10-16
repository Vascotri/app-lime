import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSupabase } from '@/lib/supabase'

/**
 * How far back completed tasks are kept in view.
 *
 * Done tasks accumulate forever, so returning all of them would grow the
 * dashboard payload without bound for a section that is collapsed by default.
 * A month is enough to answer "did we do that?" — anything older is history,
 * and the rows stay in the database either way.
 */
const DONE_WINDOW_DAYS = 30

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabase()

  const open = await supabase
    .from('tasks')
    .select('*')
    .is('completed_at', null)
    .order('due_date', { ascending: true, nullsFirst: false })

  if (open.error) return NextResponse.json({ error: open.error.message }, { status: 500 })

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - DONE_WINDOW_DAYS)

  const done = await supabase
    .from('tasks')
    .select('*')
    .not('completed_at', 'is', null)
    .gte('completed_at', cutoff.toISOString())
    .order('completed_at', { ascending: false })

  if (done.error) return NextResponse.json({ error: done.error.message }, { status: 500 })

  return NextResponse.json([...(open.data ?? []), ...(done.data ?? [])])
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { data, error } = await getSupabase()
    .from('tasks')
    .insert({
      title: body.title,
      description: body.description ?? null,
      assigned_to: body.assigned_to ?? 'both',
      category: body.category ?? 'other',
      due_date: body.due_date ?? null,
      created_by: session.user?.email,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
