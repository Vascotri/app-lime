import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  filterTasks,
  groupTasks,
  hasActiveFilters,
  isOverdue,
  isDueToday,
  NO_FILTERS,
} from './task-view'
import type { Task } from './types'

const TODAY = new Date('2026-10-15T12:00:00Z')

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: Math.random().toString(36).slice(2),
    title: 'Task',
    description: null,
    assigned_to: 'both',
    category: 'other',
    due_date: null,
    completed_at: null,
    created_by: 'vasco@example.com',
    created_at: '2026-10-01T00:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(TODAY)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('filterTasks', () => {
  const vascoTask = task({ assigned_to: 'vasco', category: 'car' })
  const jenniferTask = task({ assigned_to: 'jennifer', category: 'kids' })
  const sharedTask = task({ assigned_to: 'both', category: 'home' })
  const all = [vascoTask, jenniferTask, sharedTask]

  it('returns everything by default', () => {
    expect(filterTasks(all, NO_FILTERS)).toHaveLength(3)
  })

  it('includes shared tasks when filtering by a person', () => {
    /*
     * The question is "what is on my plate", and a chore assigned to both is
     * on both plates. Hiding it would make the filter actively misleading —
     * you would think you had nothing to do.
     */
    const mine = filterTasks(all, { owner: 'vasco', category: 'all' })
    expect(mine).toContain(vascoTask)
    expect(mine).toContain(sharedTask)
    expect(mine).not.toContain(jenniferTask)
  })

  it('filters by category exactly', () => {
    expect(filterTasks(all, { owner: 'all', category: 'kids' })).toEqual([jenniferTask])
  })

  it('applies both filters together', () => {
    expect(filterTasks(all, { owner: 'jennifer', category: 'home' })).toEqual([sharedTask])
    expect(filterTasks(all, { owner: 'vasco', category: 'kids' })).toEqual([])
  })
})

describe('hasActiveFilters', () => {
  it('distinguishes a default from a narrowed view', () => {
    expect(hasActiveFilters(NO_FILTERS)).toBe(false)
    expect(hasActiveFilters({ owner: 'vasco', category: 'all' })).toBe(true)
    expect(hasActiveFilters({ owner: 'all', category: 'car' })).toBe(true)
  })
})

describe('due-date classification', () => {
  it('separates overdue from due today', () => {
    expect(isOverdue(task({ due_date: '2026-10-14' }))).toBe(true)
    expect(isOverdue(task({ due_date: '2026-10-15' }))).toBe(false)
    expect(isDueToday(task({ due_date: '2026-10-15' }))).toBe(true)
  })

  it('treats an undated task as neither', () => {
    expect(isOverdue(task())).toBe(false)
    expect(isDueToday(task())).toBe(false)
  })
})

describe('groupTasks — by due date', () => {
  const overdue = task({ due_date: '2026-10-10', title: 'Overdue' })
  const today = task({ due_date: '2026-10-15', title: 'Today' })
  const soon = task({ due_date: '2026-10-20', title: 'Soon' })
  const later = task({ due_date: '2026-11-20', title: 'Later' })
  const undated = task({ title: 'Someday' })

  it('orders sections by urgency', () => {
    const groups = groupTasks([later, undated, overdue, today, soon], 'due')
    expect(groups.map((group) => group.key)).toEqual([
      'overdue',
      'today',
      'upcoming',
      'undated',
    ])
  })

  it('gives undated tasks their own section', () => {
    // On a long list, something with no date is not "upcoming", it is
    // unscheduled — lumping them together buries the things that are due.
    const groups = groupTasks([soon, undated], 'due')
    expect(groups.find((group) => group.key === 'undated')!.tasks).toEqual([undated])
    expect(groups.find((group) => group.key === 'upcoming')!.tasks).toEqual([soon])
  })

  it('sorts soonest first within a section', () => {
    const groups = groupTasks([later, soon], 'due')
    expect(groups[0].tasks.map((t) => t.title)).toEqual(['Soon', 'Later'])
  })

  it('drops empty sections so a filtered list has no hollow headers', () => {
    expect(groupTasks([soon], 'due').map((group) => group.key)).toEqual(['upcoming'])
    expect(groupTasks([], 'due')).toEqual([])
  })

  it('marks the sections that need colour', () => {
    const groups = groupTasks([overdue, today, soon], 'due')
    expect(groups[0].tone).toBe('overdue')
    expect(groups[1].tone).toBe('today')
    expect(groups[2].tone).toBeUndefined()
  })
})

describe('groupTasks — by category and owner', () => {
  it('groups by category in picker order, not alphabetically', () => {
    const groups = groupTasks(
      [task({ category: 'dog' }), task({ category: 'home' }), task({ category: 'car' })],
      'category',
    )
    // Matches TASK_CATEGORY_LABELS, so the headings read in the same order as
    // the buttons in the form.
    expect(groups.map((group) => group.label)).toEqual(['Home', 'Car', 'Dog'])
  })

  it('groups by owner and keeps shared tasks separate', () => {
    const groups = groupTasks(
      [task({ assigned_to: 'jennifer' }), task({ assigned_to: 'both' }), task({ assigned_to: 'vasco' })],
      'owner',
    )
    // Grouping is literal, unlike filtering: a "Both" heading is informative,
    // whereas listing it under each person would double-count the list.
    expect(groups.map((group) => group.label)).toEqual(['Vasco', 'Jennifer', 'Both'])
    expect(groups.every((group) => group.tasks.length === 1)).toBe(true)
  })

  it('still sorts by due date inside each group', () => {
    const groups = groupTasks(
      [
        task({ category: 'car', due_date: '2026-11-01', title: 'Later' }),
        task({ category: 'car', due_date: '2026-10-18', title: 'Sooner' }),
        task({ category: 'car', title: 'Undated' }),
      ],
      'category',
    )
    // Undated last rather than first, which a naive string compare would do.
    expect(groups[0].tasks.map((t) => t.title)).toEqual(['Sooner', 'Later', 'Undated'])
  })

  it('loses no tasks regardless of grouping', () => {
    const tasks = [
      task({ assigned_to: 'vasco', category: 'car', due_date: '2026-10-10' }),
      task({ assigned_to: 'both', category: 'home' }),
      task({ assigned_to: 'jennifer', category: 'kids', due_date: '2026-10-15' }),
    ]
    for (const grouping of ['due', 'category', 'owner'] as const) {
      const total = groupTasks(tasks, grouping).reduce((n, group) => n + group.tasks.length, 0)
      expect(total, `${grouping} grouping dropped a task`).toBe(tasks.length)
    }
  })
})
