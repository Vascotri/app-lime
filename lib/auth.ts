import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { ALLOWED_EMAILS, EMAIL_TO_NAME } from './types'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      return ALLOWED_EMAILS.includes(user.email ?? '')
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
