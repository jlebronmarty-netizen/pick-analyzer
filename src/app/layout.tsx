import type {Metadata,Viewport} from 'next'
import './globals.css'
import CanonicalDashboardBoundary from '@/components/pick2/CanonicalDashboardBoundary'
import {PersonalizationProvider} from '@/context/PersonalizationContext'
export const metadata:Metadata={title:'Pick Analyzer',description:'Professional Sports Betting Analytics Platform'}
export const viewport:Viewport={width:'device-width',initialScale:1}
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){
 return <html lang="en" suppressHydrationWarning className="h-full antialiased"><body className="min-h-full flex flex-col"><PersonalizationProvider>
 {process.env.NBA_SHARED_FEED_ENABLED==='true'&&<nav aria-label="NBA market data" style={{padding:'8px 16px',background:'#0f172a',textAlign:'center'}}><a href="/nba-market-data" style={{color:'#67e8f9'}}>NBA · FanDuel · Cuotas actuales y archivo</a></nav>}
 <CanonicalDashboardBoundary>{children}</CanonicalDashboardBoundary></PersonalizationProvider></body></html>
}
