'use client'

import { useId } from 'react'
import type { Person, TaskCategory } from '@/lib/types'
import { PERSON_LABELS, TASK_CATEGORY_LABELS } from '@/lib/types'
import {
  NO_FILTERS,
  hasActiveFilters,
  type TaskFilters,
  type TaskGrouping,
} from '@/lib/task-view'

interface Props {
  filters: TaskFilters
  grouping: TaskGrouping
  onFiltersChange: (filters: TaskFilters) => void
  onGroupingChange: (grouping: TaskGrouping) => void
  /** How many tasks survive the current filters, for honest feedback. */
  matchCount: number
  totalCount: number
}

const GROUPING_LABELS: Record<TaskGrouping, string> = {
  due: 'Due date',
  category: 'Category',
  owner: 'Who',
}

export function TaskFilterBar({
  filters,
  grouping,
  onFiltersChange,
  onGroupingChange,
  matchCount,
  totalCount,
}: Props) {
  const uid = useId()
  const active = hasActiveFilters(filters)

  return (
    <div className="border-b border-lime-50 bg-white px-3 py-2.5 space-y-2">
      {/*
        * Person filter as a segmented control: three options, always worth
        * seeing at a glance. Category has eight and would not fit, so it is a
        * select.
        */}
      <fieldset>
        <legend className="sr-only">Filter by who it is for</legend>
        <div className="flex gap-1">
          {([['all', 'Everyone'], ...Object.entries(PERSON_LABELS)] as [
            Person | 'all',
            string,
          ][]).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filters.owner === value}
              onClick={() => onFiltersChange({ ...filters, owner: value })}
              className={`flex-1 rounded-lg border px-1 py-1.5 text-xs font-medium transition-colors min-h-[36px] ${
                filters.owner === value
                  ? 'border-lime-500 bg-lime-50 text-lime-700'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex gap-2">
        <div className="flex-1 min-w-0">
          <label htmlFor={`${uid}-category`} className="sr-only">
            Filter by category
          </label>
          <select
            id={`${uid}-category`}
            value={filters.category}
            onChange={(e) =>
              onFiltersChange({ ...filters, category: e.target.value as TaskCategory | 'all' })
            }
            className="w-full rounded-lg border-gray-200 text-xs py-1.5 min-h-[36px]"
          >
            <option value="all">All categories</option>
            {(Object.entries(TASK_CATEGORY_LABELS) as [TaskCategory, string][]).map(
              ([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ),
            )}
          </select>
        </div>

        <div className="flex-1 min-w-0">
          <label htmlFor={`${uid}-grouping`} className="sr-only">
            Sort by
          </label>
          <select
            id={`${uid}-grouping`}
            value={grouping}
            onChange={(e) => onGroupingChange(e.target.value as TaskGrouping)}
            className="w-full rounded-lg border-gray-200 text-xs py-1.5 min-h-[36px]"
          >
            {(Object.entries(GROUPING_LABELS) as [TaskGrouping, string][]).map(
              ([value, label]) => (
                <option key={value} value={value}>
                  Sort: {label}
                </option>
              ),
            )}
          </select>
        </div>
      </div>

      {active && (
        <div className="flex items-center justify-between">
          {/*
            * Says what the filter is doing. Without it, a filter that hides
            * everything is indistinguishable from having no tasks at all.
            */}
          <span className="text-xs text-gray-400">
            {matchCount} of {totalCount}
          </span>
          <button
            type="button"
            onClick={() => onFiltersChange(NO_FILTERS)}
            className="text-xs text-lime-600 font-medium hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  )
}
