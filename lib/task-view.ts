import { isPast, isToday, parseISO } from 'date-fns'
import type { Task, Person, TaskCategory } from './types'
import { PERSON_LABELS, TASK_CATEGORY_LABELS } from './types'

export type TaskGrouping = 'due' | 'category' | 'owner'

export interface TaskFilters {
  owner: Person | 'all'
  category: TaskCategory | 'all'
}

export const NO_FILTERS: TaskFilters = { owner: 'all', category: 'all' }

export function hasActiveFilters(filters: TaskFilters): boolean {
  return filters.owner !== 'all' || filters.category !== 'all'
}

/**
 * Filter the list down.
 *
 * Filtering by a person includes tasks assigned to 'both'. The question being
 * asked is "what is on my plate", and a shared chore is on both plates —
 * hiding it would make the filter actively misleading.
 */
export function filterTasks(tasks: Task[], filters: TaskFilters): Task[] {
  return tasks.filter((task) => {
    if (filters.owner !== 'all') {
      const mine = task.assigned_to === filters.owner || task.assigned_to === 'both'
      if (!mine) return false
    }
    if (filters.category !== 'all' && task.category !== filters.category) return false
    return true
  })
}

/**
 * Split the list into what's still to do and what's been finished.
 *
 * Done tasks come back most-recently-completed first, which is the order the
 * question "did we do that?" is usually asked in.
 */
export function splitByCompletion(tasks: Task[]): { open: Task[]; done: Task[] } {
  const open = tasks.filter((task) => !task.completed_at)
  const done = tasks
    .filter((task) => !!task.completed_at)
    .sort((a, b) => parseISO(b.completed_at!).getTime() - parseISO(a.completed_at!).getTime())
  return { open, done }
}

export interface TaskGroup {
  key: string
  label: string
  /** Rendered in red/amber for overdue and due-today. */
  tone?: 'overdue' | 'today'
  tasks: Task[]
}

function dueRank(task: Task): number {
  // Undated tasks sort last within a group rather than jumping to the front,
  // which is what an empty string would do in a naive comparison.
  if (!task.due_date) return Number.POSITIVE_INFINITY
  return parseISO(task.due_date).getTime()
}

function byDueDate(a: Task, b: Task): number {
  return dueRank(a) - dueRank(b)
}

export function isOverdue(task: Task): boolean {
  if (!task.due_date) return false
  const due = parseISO(task.due_date)
  return isPast(due) && !isToday(due)
}

export function isDueToday(task: Task): boolean {
  return !!task.due_date && isToday(parseISO(task.due_date))
}

/**
 * Arrange tasks into the sections the panel renders.
 *
 * Grouping rather than a flat sort: the panel already reads as sections, and
 * a long list is easier to scan when the chosen dimension forms the headings.
 * Empty groups are dropped so a filtered list doesn't show hollow headers.
 */
export function groupTasks(tasks: Task[], grouping: TaskGrouping): TaskGroup[] {
  if (grouping === 'owner') {
    return (Object.keys(PERSON_LABELS) as Person[])
      .map((person) => ({
        key: person,
        label: PERSON_LABELS[person],
        tasks: tasks.filter((task) => task.assigned_to === person).sort(byDueDate),
      }))
      .filter((group) => group.tasks.length > 0)
  }

  if (grouping === 'category') {
    return (Object.keys(TASK_CATEGORY_LABELS) as TaskCategory[])
      .map((category) => ({
        key: category,
        label: TASK_CATEGORY_LABELS[category],
        tasks: tasks.filter((task) => task.category === category).sort(byDueDate),
      }))
      .filter((group) => group.tasks.length > 0)
  }

  // Due date: urgency first, then everything still to come, then the undated.
  const overdue = tasks.filter(isOverdue).sort(byDueDate)
  const today = tasks.filter(isDueToday).sort(byDueDate)
  const upcoming = tasks
    .filter((task) => task.due_date && !isOverdue(task) && !isDueToday(task))
    .sort(byDueDate)
  // Split out rather than lumped into "upcoming": on a long list, something
  // with no date isn't upcoming, it's unscheduled.
  const undated = tasks.filter((task) => !task.due_date)

  return [
    { key: 'overdue', label: 'Overdue', tone: 'overdue' as const, tasks: overdue },
    { key: 'today', label: 'Due today', tone: 'today' as const, tasks: today },
    { key: 'upcoming', label: 'Upcoming', tasks: upcoming },
    { key: 'undated', label: 'No due date', tasks: undated },
  ].filter((group) => group.tasks.length > 0)
}
