import { describe, it, expect } from 'vitest'
import { normaliseSupabaseUrl } from './supabase'

describe('normaliseSupabaseUrl', () => {
  const ORIGIN = 'https://abcdefgh.supabase.co'

  it('passes a bare project URL through unchanged', () => {
    expect(normaliseSupabaseUrl(ORIGIN)).toBe(ORIGIN)
  })

  it('strips a trailing slash', () => {
    expect(normaliseSupabaseUrl(`${ORIGIN}/`)).toBe(ORIGIN)
  })

  it('strips the /rest/v1 path shown as the RESTful endpoint in the dashboard', () => {
    // Regression: pasting this produced .../rest/v1/rest/v1 and every query
    // failed with "Invalid path specified in request URL".
    expect(normaliseSupabaseUrl(`${ORIGIN}/rest/v1`)).toBe(ORIGIN)
  })

  it('strips any other path, query or fragment', () => {
    expect(normaliseSupabaseUrl(`${ORIGIN}/auth/v1?foo=bar#frag`)).toBe(ORIGIN)
  })

  it('tolerates surrounding whitespace from a sloppy copy-paste', () => {
    expect(normaliseSupabaseUrl(`  ${ORIGIN}  `)).toBe(ORIGIN)
  })

  it('assumes https when the scheme is missing', () => {
    expect(normaliseSupabaseUrl('abcdefgh.supabase.co')).toBe(ORIGIN)
  })

  it('preserves a non-default port (local Supabase)', () => {
    expect(normaliseSupabaseUrl('http://localhost:54321/rest/v1')).toBe('http://localhost:54321')
  })

  it('rejects an empty value', () => {
    expect(() => normaliseSupabaseUrl('   ')).toThrow(/empty/i)
  })
})
