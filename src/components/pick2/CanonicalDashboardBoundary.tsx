'use client'
import {usePathname} from 'next/navigation'
import type {ReactNode} from 'react'
import {DashboardProvider} from '@/context/DashboardContext'
import {isReadOnlySportRoute} from '@/lib/read-only-sport-route.mjs'
// The legacy provider initializes unrelated dashboard/model state on mount.
// Read-only sports modules own their data and must never mount that provider.
export default function CanonicalDashboardBoundary({children}:{children:ReactNode}){
 return isReadOnlySportRoute(usePathname())?children:<DashboardProvider>{children}</DashboardProvider>
}
