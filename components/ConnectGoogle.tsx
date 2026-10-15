'use client'

import { useEffect, useState } from 'react'
import { signIn } from 'next-auth/react'

type Status =
  | { state: 'checking' }
  | { state: 'connected' }
  | { state: 'disconnected'; reason: 'not_connected' | 'missing_scopes' }
  | { state: 'error' }

/**
 * Prompt to grant calendar access. Renders nothing once connected, so it
 * disappears for good after the one-time consent.
 */
export function ConnectGoogle() {
  const [status, setStatus] = useState<Status>({ state: 'checking' })

  useEffect(() => {
    let cancelled = false

    async function check() {
      try {
        const res = await fetch('/api/google/status')
        if (!res.ok) throw new Error(String(res.status))
        const data = (await res.json()) as {
          connected: boolean
          reason?: 'not_connected' | 'missing_scopes'
        }
        if (cancelled) return
        setStatus(
          data.connected
            ? { state: 'connected' }
            : { state: 'disconnected', reason: data.reason ?? 'not_connected' },
        )
      } catch {
        if (!cancelled) setStatus({ state: 'error' })
      }
    }

    check()
    return () => {
      cancelled = true
    }
  }, [])

  // Stay out of the way while checking, once connected, or if the check itself
  // failed — a broken status endpoint shouldn't push a scary banner at someone
  // whose calendar may be working fine.
  if (status.state !== 'disconnected') return null

  const isReconnect = status.reason === 'missing_scopes'

  return (
    <div className="mb-3 sm:mb-4 rounded-2xl border border-lime-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="text-xl leading-none mt-0.5" aria-hidden="true">
          📆
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">
            {isReconnect ? 'Reconnect Google Calendar' : 'Connect Google Calendar'}
          </p>
          <p className="mt-0.5 text-sm text-gray-500">
            {isReconnect
              ? 'Your sign-in predates calendar access. Grant it to keep events in sync.'
              : 'Keep your events in one shared family calendar you can both see on your phones.'}
          </p>
          <button
            onClick={() => signIn('google', { callbackUrl: '/' })}
            className="mt-3 rounded-xl bg-lime-500 px-4 py-2 text-sm font-semibold text-white hover:bg-lime-600 transition-colors min-h-[44px]"
          >
            {isReconnect ? 'Reconnect' : 'Connect'}
          </button>
          <p className="mt-2 text-xs text-gray-400">
            app-lime can only see the family calendar it creates — not your other calendars.
          </p>
        </div>
      </div>
    </div>
  )
}
