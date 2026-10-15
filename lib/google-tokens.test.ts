import { describe, it, expect } from 'vitest'
import {
  GOOGLE_SCOPES,
  REQUIRED_CALENDAR_SCOPES,
  hasRequiredScopes,
  isAccessTokenFresh,
} from './google-tokens'

describe('requested scopes', () => {
  it('asks for every scope it later requires', () => {
    // A required scope missing from the consent request would surface only as a
    // 403 from Google long after sign-in appeared to succeed.
    for (const scope of REQUIRED_CALENDAR_SCOPES) {
      expect(GOOGLE_SCOPES).toContain(scope)
    }
  })

  it('never requests write access to calendars it did not create', () => {
    /*
     * The boundary, deliberately: the app may READ every calendar — that is
     * what lets personal commitments appear without anyone filing them under
     * Family — but may only WRITE to the calendar it made itself.
     *
     * The plain `calendar` scope is read-write over everything. Granting it
     * would let a bug in the write path modify or delete a real work meeting,
     * so it stays out even though it would subsume the three we do ask for.
     */
    expect(GOOGLE_SCOPES).not.toContain('https://www.googleapis.com/auth/calendar')
    expect(GOOGLE_SCOPES).not.toContain('https://www.googleapis.com/auth/calendar.events')

    // Read of everything is in scope; write is confined to app.created.
    expect(GOOGLE_SCOPES).toContain('https://www.googleapis.com/auth/calendar.readonly')
    expect(GOOGLE_SCOPES).toContain('https://www.googleapis.com/auth/calendar.app.created')
  })
})

describe('hasRequiredScopes', () => {
  const granted = REQUIRED_CALENDAR_SCOPES.join(' ')

  it('accepts a grant containing every required scope', () => {
    expect(hasRequiredScopes(`openid email ${granted}`)).toBe(true)
  })

  it('rejects a grant missing the ACL scope', () => {
    // The shape of a session created before calendar sharing existed.
    expect(
      hasRequiredScopes('openid email https://www.googleapis.com/auth/calendar.app.created'),
    ).toBe(false)
  })

  it('rejects an empty or absent scope string', () => {
    expect(hasRequiredScopes('')).toBe(false)
    expect(hasRequiredScopes(null)).toBe(false)
    expect(hasRequiredScopes(undefined)).toBe(false)
  })

  it('is not fooled by a scope that merely contains a required one as a prefix', () => {
    expect(hasRequiredScopes('https://www.googleapis.com/auth/calendar.app.created.readonly')).toBe(
      false,
    )
  })
})

describe('isAccessTokenFresh', () => {
  const now = new Date('2026-10-15T12:00:00.000Z')
  const at = (minutes: number) =>
    new Date(now.getTime() + minutes * 60_000).toISOString()

  it('accepts a token with comfortable life left', () => {
    expect(isAccessTokenFresh({ access_token: 'tok', expires_at: at(30) }, now)).toBe(true)
  })

  it('rejects an expired token', () => {
    expect(isAccessTokenFresh({ access_token: 'tok', expires_at: at(-1) }, now)).toBe(false)
  })

  it('rejects a token expiring within the skew window', () => {
    // 30s of life is not enough to finish a request — refresh early rather
    // than let it die mid-flight.
    expect(isAccessTokenFresh({ access_token: 'tok', expires_at: at(0.5) }, now)).toBe(false)
  })

  it('rejects when either field is missing', () => {
    expect(isAccessTokenFresh({ access_token: null, expires_at: at(30) }, now)).toBe(false)
    expect(isAccessTokenFresh({ access_token: 'tok', expires_at: null }, now)).toBe(false)
  })
})
