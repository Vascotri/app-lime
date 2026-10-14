'use client'

import { useState } from 'react'
import type { ShoppingItem, Category } from '@/lib/types'
import { CATEGORY_LABELS } from '@/lib/types'
import { AddItemModal } from './AddItemModal'

interface Props {
  items: ShoppingItem[]
  loading: boolean
  onRefresh: () => void
}

const CATEGORY_ICONS: Record<Category, string> = {
  groceries: '🛒',
  home: '🏠',
  kids: '🧒',
  other: '📦',
}

export function ShoppingPanel({ items, loading, onRefresh }: Props) {
  const [showAdd, setShowAdd] = useState(false)
  const [showChecked, setShowChecked] = useState(false)

  const unchecked = items.filter((i) => !i.checked_at)
  const checked = items.filter((i) => i.checked_at)

  async function toggleCheck(item: ShoppingItem) {
    await fetch(`/api/shopping/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checked_at: item.checked_at ? null : new Date().toISOString() }),
    })
    onRefresh()
  }

  async function handleDelete(id: string) {
    await fetch(`/api/shopping/${id}`, { method: 'DELETE' })
    onRefresh()
  }

  function groupByCategory(list: ShoppingItem[]): Map<Category, ShoppingItem[]> {
    const map = new Map<Category, ShoppingItem[]>()
    for (const item of list) {
      const cat = item.category as Category
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(item)
    }
    return map
  }

  const grouped = groupByCategory(unchecked)
  const categories = (Object.keys(CATEGORY_LABELS) as Category[]).filter((c) => grouped.has(c))

  return (
    <div className="bg-white rounded-2xl border border-lime-100 shadow-sm flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-lime-50 bg-lime-50 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <span className="text-lg">🛒</span>
          <h2 className="text-sm font-semibold text-gray-800">Shopping</h2>
          {!loading && unchecked.length > 0 && (
            <span className="text-xs bg-lime-100 text-lime-700 rounded-full px-2 py-0.5 font-medium">
              {unchecked.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="w-7 h-7 flex items-center justify-center rounded-full bg-lime-500 text-white text-lg leading-none hover:bg-lime-600 transition-colors"
          aria-label="Add item"
        >
          +
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto panel-scroll p-3 space-y-3">
        {loading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        )}

        {!loading && unchecked.length === 0 && checked.length === 0 && (
          <div className="text-center py-8">
            <p className="text-2xl mb-2">🛍️</p>
            <p className="text-sm text-gray-500">Shopping list is empty.</p>
            <button
              onClick={() => setShowAdd(true)}
              className="mt-3 text-xs text-lime-600 font-medium hover:underline"
            >
              Add an item →
            </button>
          </div>
        )}

        {!loading && categories.map((cat) => (
          <div key={cat}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 px-1 flex items-center gap-1">
              <span>{CATEGORY_ICONS[cat]}</span>
              {CATEGORY_LABELS[cat]}
              <span className="text-gray-300">({grouped.get(cat)!.length})</span>
            </p>
            <div className="space-y-0.5">
              {grouped.get(cat)!.map((item) => (
                <div
                  key={item.id}
                  className="group flex items-center gap-2.5 rounded-xl px-3 py-2 hover:bg-gray-50 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={false}
                    onChange={() => toggleCheck(item)}
                    className="w-4 h-4 rounded border-gray-300 text-lime-600 focus:ring-lime-500 flex-shrink-0"
                    aria-label={`Mark ${item.name} as bought`}
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-gray-800">{item.name}</span>
                    {item.quantity && (
                      <span className="text-xs text-gray-400 ml-1.5">{item.quantity}</span>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-xs w-6 h-6 flex items-center justify-center rounded transition-all flex-shrink-0"
                    aria-label={`Delete ${item.name}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Checked items collapsed section */}
        {!loading && checked.length > 0 && (
          <div>
            <button
              onClick={() => setShowChecked(!showChecked)}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 px-1 py-1"
            >
              <span>{showChecked ? '▾' : '▸'}</span>
              {checked.length} bought
            </button>
            {showChecked && (
              <div className="space-y-0.5 mt-1">
                {checked.map((item) => (
                  <div
                    key={item.id}
                    className="group flex items-center gap-2.5 rounded-xl px-3 py-2 opacity-50 hover:opacity-70 transition-opacity"
                  >
                    <input
                      type="checkbox"
                      checked={true}
                      onChange={() => toggleCheck(item)}
                      className="w-4 h-4 rounded border-gray-300 text-lime-600 focus:ring-lime-500 flex-shrink-0"
                      aria-label={`Unmark ${item.name}`}
                    />
                    <span className="text-sm text-gray-500 line-through flex-1 min-w-0 truncate">
                      {item.name}
                    </span>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-xs w-6 h-6 flex items-center justify-center rounded transition-all flex-shrink-0"
                      aria-label={`Delete ${item.name}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showAdd && (
        <AddItemModal
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); onRefresh() }}
        />
      )}
    </div>
  )
}
