import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { ALLOWED_EMAILS, EMAIL_TO_NAME } from './types'
import { GOOGLE_SCOPES, saveTokens } from './google-tokens'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: GOOGLE_SCOPES.join(' '),
          // offline is what makes Google issue a refresh token at all.
          access_type: 'offline',
          // Google only returns a refresh token on a *fresh* consent. Without
          // this, a second sign-in yields none and the server loses its ability
          // to touch the calendar. Costs one extra consent screen per login.
          prompt: 'consent',
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      return ALLOWED_EMAILS.includes(user.email ?? '')
    },

    async jwt({ token, account }) {
      // `account` is only populated on the sign-in request itself.
      if (account?.refresh_token && token.email) {
        await saveTokens({
          email: token.email,
          refreshToken: account.refresh_token,
          accessToken: account.access_token ?? null,
          expiresAt: account.expires_at ? new Date(account.expires_at * 1000) : null,
          scope: account.scope ?? null,
        })
      }
      return token
    },

    async session({ session }) {
      if (session.user?.email) {
        session.user.name = EMAIL_TO_NAME[session.user.email] ?? session.user.name
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
}
