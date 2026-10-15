import { describe, it, expect, afterEach } from 'vitest'
import { resolveSource } from './calendar-source'

const original = process.env.CALENDAR_SOURCE

afterEach(() => {
  if (original === undefined) delete process.env.CALENDAR_SOURCE
  else process.env.CALENDAR_SOURCE = original
})

describe('resolveSource', () => {
  it('defaults to supabase when nothing is configured', () => {
    // The flag is off by default: deploying this slice must not change
    // behaviour for anyone until the switch is thrown deliberately.
    delete process.env.CALENDAR_SOURCE
    expect(resolveSource(null)).toBe('supabase')
  })

  it('honours the environment flag', () => {
    process.env.CALENDAR_SOURCE = 'google'
    expect(resolveSource(null)).toBe('google')
  })

  it('lets a request override the environment in either direction', () => {
    // This is what makes a side-by-side comparison possible in two tabs.
    process.env.CALENDAR_SOURCE = 'supabase'
    expect(resolveSource('google')).toBe('google')

    process.env.CALENDAR_SOURCE = 'google'
    expect(resolveSource('supabase')).toBe('supabase')
  })

  it('ignores an unrecognised override rather than failing the request', () => {
    delete process.env.CALENDAR_SOURCE
    expect(resolveSource('cheese')).toBe('supabase')
    expect(resolveSource('')).toBe('supabase')
  })

  it('treats any unrecognised env value as supabase', () => {
    process.env.CALENDAR_SOURCE = 'GOOGLE '
    expect(resolveSource(null)).toBe('supabase')
  })
})
