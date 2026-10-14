'use client'

import { useState } from 'react'
import { format, isPast, parseISO, isToday } from 'date-fns'
import type { Task } from '@/lib/types'
import { ASSIGNEE_LABELS } from '@/lib/types'
import { AddTaskModal } from './AddTaskModal'

interface Props {
  tasks: Task[]
  loading: boolean
  onRefresh: () => void
}

const ASSIGNEE_COLORS = {
  vasco: 'bg-blue-100 text-blue-700',
  jennifer: 'bg-purple-100 text-purple-700',
  both: 'bg-gray-100 text-gray-600',
}

export function TasksPanel({ tasks, loading, onRefresh }: Props) {
  const [showAdd, setShowAdd] = useState(false)
  const [editTask, setEditTask] = useState<Task | null>(null)

  const overdue = tasks.filter(
    (t) => t.due_date && isPast(parseISO(t.due_date)) && !isToday(parseISO(t.due_date)),
  )
  const dueToday = tasks.filter((t) => t.due_date && isToday(parseISO(t.due_date)))
  const upcoming = tasks.filter(
    (t) => !t.due_date || (!isPast(parseISO(t.due_date)) && !isToday(parseISO(t.due_date))),
  )

  async function toggleComplete(task: Task) {
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed_at: new Date().toISOString() }),
    })
    onRefresh()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this task?')) return
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    onRefresh()
  }

  function TaskRow({ task }: { task: Task }) {
    return (
      <div
        className="group flex items-start gap-2.5 rounded-xl px-3 py-2.5 hover:bg-gray-50 transition-colors"
      >
        <button
          onClick={() => toggleComplete(task)}
          className="w-5 h-5 mt-0.5 rounded-full border-2 border-gray-300 flex-shrink-0 hover:border-lime-500 transition-colors"
          aria-label="Mark complete"
        />
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => setEditTask(task)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setEditTask(task)}
        >
          <p className="text-sm font-medium text-gray-800 truncate">{task.title}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${ASSIGNEE_COLORS[task.assigned_to]}`}>
              {ASSIGNEE_LABELS[task.assigned_to]}
            </span>
            {task.due_date && (
              <span className={`text-xs ${
                overdue.includes(task) ? 'text-red-500 font-medium' :
                dueToday.includes(task) ? 'text-amber-600 font-medium' :
                'text-gray-400'
              }`}>
                {isToday(parseISO(task.due_date)) ? 'Due today' : format(parseISO(task.due_date), 'd MMM')}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => handleDelete(task.id)}
          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-xs w-6 h-6 flex items-center justify-center rounded transition-all flex-shrink-0"
          aria-label="Delete task"
        >
          ✕
        </button>
      </div>
    )
  }

  function Section({ label, items, accent }: { label: string; items: Task[]; accent?: string }) {
    if (items.length === 0) return null
    return (
      <div>
        <p className={`text-xs font-semibold uppercase tracking-wide mb-1.5 px-1 ${accent ?? 'text-gray-400'}`}>
          {label} ({items.length})
        </p>
        {items.map((t) => <TaskRow key={t.id} task={t} />)}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-lime-100 shadow-sm flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-lime-50 bg-lime-50 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <span className="text-lg">✅</span>
          <h2 className="text-sm font-semibold text-gray-800">Tasks</h2>
          {!loading && tasks.length > 0 && (
            <span className="text-xs bg-lime-100 text-lime-700 rounded-full px-2 py-0.5 font-medium">
              {tasks.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="w-7 h-7 flex items-center justify-center rounded-full bg-lime-500 text-white text-lg leading-none hover:bg-lime-600 transition-colors"
          aria-label="Add task"
        >
          +
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto panel-scroll p-3 space-y-3 max-h-[60dvh] lg:max-h-none">
        {loading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        )}

        {!loading && tasks.length === 0 && (
          <div className="text-center py-5 lg:py-8">
            <p className="text-2xl mb-2">📋</p>
            <p className="text-sm text-gray-500">No open tasks.</p>
            <button
              onClick={() => setShowAdd(true)}
              className="mt-3 text-xs text-lime-600 font-medium hover:underline"
            >
              Add a task →
            </button>
          </div>
        )}

        {!loading && (
          <div className="space-y-3">
            <Section label="Overdue" items={overdue} accent="text-red-500" />
            <Section label="Due today" items={dueToday} accent="text-amber-600" />
            <Section label="Upcoming" items={upcoming} />
          </div>
        )}
      </div>

      {(showAdd || editTask) && (
        <AddTaskModal
          task={editTask}
          onClose={() => { setShowAdd(false); setEditTask(null) }}
          onSaved={() => { setShowAdd(false); setEditTask(null); onRefresh() }}
        />
      )}
    </div>
  )
}
