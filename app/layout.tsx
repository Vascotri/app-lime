import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'Lime — Family Dashboard',
  description: 'Calendar, tasks, and shopping list for the family.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-lime-50 min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
