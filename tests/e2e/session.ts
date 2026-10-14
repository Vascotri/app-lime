import { encode } from 'next-auth/jwt'
import type { Cookie } from '@playwright/test'

/**
 * Secret shared by the Playwright web server and the tests, so a token minted
 * here validates in middleware and getServerSession. Test-only value: the real
 * secret lives in Vercel's environment and never appears in the repo.
 */
export const E2E_SECRET =
  process.env.NEXTAUTH_SECRET ?? 'e2e-only-secret-not-a-real-credential'

/**
 * Build a signed next-auth session cookie so e2e can exercise authenticated
 * pages. Google OAuth can't be driven headlessly, which previously left the
 * whole dashboard — every panel, every state — untested at phone width.
 *
 * Only the signature matters to next-auth here: the allowlist runs in the
 * signIn callback at login time, not when an existing session is validated.
 */
export async function sessionCookie(
  email = 'vascomoreira93@gmail.com',
  name = 'Vasco',
): Promise<Cookie> {
  const token = await encode({
    token: { name, email, sub: 'e2e-user' },
    secret: E2E_SECRET,
  })

  return {
    name: 'next-auth.session-token',
    value: token,
    domain: '127.0.0.1',
    path: '/',
    expires: Math.floor(Date.now() / 1000) + 60 * 60,
    httpOnly: true,
    secure: false,
    sameSite: 'Lax',
  }
}
