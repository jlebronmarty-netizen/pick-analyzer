'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { DashboardProvider } from '@/context/DashboardContext'

const canonicalPages = new Set(['/', '/today', '/mlb-value-board', '/data-health', '/performance'])

// These surfaces load their own canonical read-only server projection. Mounting
// the legacy provider would launch an unrelated /api/dashboard request whose
// old model-learning path initializes weights on read.
export default function CanonicalDashboardBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  return canonicalPages.has(pathname ?? '') ? children : <DashboardProvider>{children}</DashboardProvider>
}
