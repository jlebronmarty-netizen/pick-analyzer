import type { Metadata, Viewport } from 'next'
import './globals.css'

import CanonicalDashboardBoundary from '@/components/pick2/CanonicalDashboardBoundary'
import { PersonalizationProvider } from '@/context/PersonalizationContext'

export const metadata: Metadata = {
  title: 'Pick Analyzer',
  description: 'Professional Sports Betting Analytics Platform',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">
        <PersonalizationProvider>
          <CanonicalDashboardBoundary>
            {children}
          </CanonicalDashboardBoundary>
        </PersonalizationProvider>
      </body>
    </html>
  )
}
