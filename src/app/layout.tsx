import type {Metadata,Viewport} from 'next'
import './globals.css'
import CanonicalDashboardBoundary from '@/components/pick2/CanonicalDashboardBoundary'
import {PersonalizationProvider} from '@/context/PersonalizationContext'
import SportNavigation from '@/components/dashboard/SportNavigation'
export const metadata:Metadata={title:'Pick Analyzer',description:'Plataforma multideporte de análisis, probabilidades, cuotas y resultados'}
export const viewport:Viewport={width:'device-width',initialScale:1}
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){
 return <html lang="es" suppressHydrationWarning className="h-full antialiased"><body className="min-h-full flex flex-col"><PersonalizationProvider><SportNavigation/><CanonicalDashboardBoundary>{children}</CanonicalDashboardBoundary></PersonalizationProvider></body></html>
}
