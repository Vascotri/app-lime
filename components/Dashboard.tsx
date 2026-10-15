'use client'

import { useCallback, useEffect, useState } from 'react'
import { signOut } from 'next-auth/react'
import type { CalendarEvent, Task, ShoppingItem } from '@/lib/types'

/** Why a panel has no data — distinct from "there is genuinely none". */
export type PanelError = 'reconnect' | 'unavailable' | null
import { CalendarPanel } from './CalendarPanel'
import { TasksPanel } from './TasksPanel'
import { ShoppingPanel } from './ShoppingPanel'
import { ConnectGoogle } from './ConnectGoogle'

interface Props {
  userName: string
  userEmail: string
}

export function Dashboard({ userName }: Props) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [items, setItems] = useState<ShoppingItem[]>([])
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [eventsError, setEventsError] = useState<PanelError>(null)
  const [loadingTasks, setLoadingTasks] = useState(true)
  const [loadingItems, setLoadingItems] = useState(true)

  const fetchEvents = useCallback(async () => {
    setLoadingEvents(true)
    setEventsError(null)
    try {
      const res = await fetch('/api/events')
      if (res.ok) {
        setEvents(await res.json())
      } else if (res.status === 409) {
        setEventsError('reconnect')
      } else {
        setEventsError('unavailable')
      }
    } catch {
      // A rejected fetch (offline, DNS) must still clear the skeleton, or the
      // panel spins forever.
      setEventsError('unavailable')
    } finally {
      setLoadingEvents(false)
    }
  }, [])

  const fetchTasks = useCallback(async () => {
    setLoadingTasks(true)
    const res = await fetch('/api/tasks')
    if (res.ok) setTasks(await res.json())
    setLoadingTasks(false)
  }, [])

  const fetchItems = useCallback(async () => {
    setLoadingItems(true)
    const res = await fetch('/api/shopping')
    if (res.ok) setItems(await res.json())
    setLoadingItems(false)
  }, [])

  useEffect(() => {
    fetchEvents()
    fetchTasks()
    fetchItems()
  }, [fetchEvents, fetchTasks, fetchItems])

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-10 bg-white border-b border-lime-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🍋</span>
            <span className="font-semibold text-gray-900 text-sm">Lime</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 truncate">Hey, {userName} 👋</span>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-3 sm:px-6 py-3 sm:py-6">
        <ConnectGoogle />

        {/*
         * Panels hug their content on phones — a fixed min-height reserved
         * ~60dvh per panel, so three stacked panels left most of the screen
         * blank. The min-height only earns its keep from `lg` up, where the
         * three columns sit side by side and want a common height.
         */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div className="flex flex-col lg:min-h-[32rem]">
            <CalendarPanel
              events={events}
              loading={loadingEvents}
              error={eventsError}
              onRefresh={fetchEvents}
            />
          </div>
          <div className="flex flex-col lg:min-h-[32rem]">
            <TasksPanel tasks={tasks} loading={loadingTasks} onRefresh={fetchTasks} />
          </div>
          <div className="flex flex-col sm:col-span-2 lg:col-span-1 lg:min-h-[32rem]">
            <ShoppingPanel items={items} loading={loadingItems} onRefresh={fetchItems} />
          </div>
        </div>
      </main>
    </div>
  )
}
