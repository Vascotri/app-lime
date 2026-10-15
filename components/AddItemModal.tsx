'use client'

import { useState } from 'react'
import { Modal } from './Modal'
import { Picker } from './Chip'
import type { ShoppingCategory } from '@/lib/types'
import { SHOPPING_CATEGORY_LABELS } from '@/lib/types'

interface Props {
  onClose: () => void
  onSaved: () => void
}

export function AddItemModal({ onClose, onSaved }: Props) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<ShoppingCategory>('groceries')
  const [quantity, setQuantity] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Item name is required.'); return }
    setSaving(true)
    setError('')

    const res = await fetch('/api/shopping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), category, quantity: quantity.trim() || null }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Failed to add item.')
      setSaving(false)
      return
    }
    onSaved()
  }

  return (
    <Modal title="Add item" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Item *</label>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Milk"
            className="w-full rounded-lg border-gray-200 text-sm py-2.5"
          />
        </div>

        <Picker
          label="Category"
          options={SHOPPING_CATEGORY_LABELS}
          value={category}
          onChange={setCategory}
          columns={3}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
          <input
            type="text"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="e.g. 2 packs, 1 litre…"
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
            {saving ? 'Adding…' : 'Add item'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
