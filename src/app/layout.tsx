import type { Metadata, Viewport } from 'next'
import './globals.css'

import { DashboardProvider } from '@/context/DashboardContext'

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
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">
        <DashboardProvider>
          {children}
        </DashboardProvider>
      </body>
    </html>
  )
}
