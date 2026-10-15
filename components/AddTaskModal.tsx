'use client'

import { useState } from 'react'
import { Modal } from './Modal'
import { Picker } from './Chip'
import type { Task, Assignee, TaskCategory } from '@/lib/types'
import { PERSON_LABELS, TASK_CATEGORY_LABELS } from '@/lib/types'

interface Props {
  task?: Task | null
  onClose: () => void
  onSaved: () => void
}

export function AddTaskModal({ task, onClose, onSaved }: Props) {
  const isEdit = !!task
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [assignedTo, setAssignedTo] = useState<Assignee>(task?.assigned_to ?? 'both')
  const [category, setCategory] = useState<TaskCategory>(task?.category ?? 'other')
  const [dueDate, setDueDate] = useState(task?.due_date ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('Title is required.'); return }
    setSaving(true)
    setError('')

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      assigned_to: assignedTo,
      category,
      due_date: dueDate || null,
    }
    const url = isEdit ? `/api/tasks/${task!.id}` : '/api/tasks'
    const method = isEdit ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Failed to save task.')
      setSaving(false)
      return
    }
    onSaved()
  }

  return (
    <Modal title={isEdit ? 'Edit task' : 'New task'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
          <input
            autoFocus
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Book dentist appointment"
            className="w-full rounded-lg border-gray-200 text-sm py-2.5"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Optional details…"
            className="w-full rounded-lg border-gray-200 text-sm py-2.5 resize-none"
          />
        </div>

        <Picker
          label="Assign to"
          options={PERSON_LABELS}
          value={assignedTo}
          onChange={setAssignedTo}
          columns={3}
        />

        <Picker
          label="Category"
          options={TASK_CATEGORY_LABELS}
          value={category}
          onChange={setCategory}
          columns={4}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Due date</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded-lg border-gray-200 text-sm py-2.5"
          />
        </div>

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-xl bg-lime-500 py-2.5 text-sm font-semibold text-white hover:bg-lime-600 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add task'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
