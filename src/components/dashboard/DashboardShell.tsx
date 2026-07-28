'use client'

import { ReactNode } from 'react'
import Link from 'next/link'
import { SportProvider } from '@/context/SportContext'
import SportSelector from '@/components/dashboard/SportSelector'
import { ProductStatusBadge } from '@/components/product/ProductStatus'

const navItems = [
  { id: 'overview', label: 'Overview', icon: '⌁' },
  { id: 'multi-sport', label: 'Sport Engine', icon: '◎' },
  { id: 'nba-adapter', label: 'NBA Adapter', icon: '🏀' },
  { id: 'daily-report', label: 'Daily Report', icon: '◈' },
  { id: 'prediction-v4', label: 'AI Rating', icon: '◆' },
  { id: 'top-picks', label: 'Top Picks', icon: '★' },
  { id: 'bet-slip', label: 'Bet Slip', icon: '◇' },
  { id: 'risk-lab', label: 'Risk Lab', icon: '△' },
  { id: 'sharp-money', label: 'Market', icon: '↯' },
  { id: 'closing-line', label: 'Closing Line', icon: '⌛' },
  { id: 'live-betting', label: 'Live AI', icon: '●' },
  { id: 'portfolio', label: 'Portfolio', icon: '▣' },
  { id: 'ai-coach', label: 'AI Coach', icon: '♟'  },
  { id: 'learning', label: 'Learning', icon: '↗' },
  { id: 'model-center', label: 'AI Model', icon: '◉' },
  { id: 'sports-brain', label: 'Sports Brain', icon: '✦' },
]

const productNavGroups = [
  {
    label: 'Home',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: 'DB' },
      { href: '/sports-center', label: 'Sports Center', icon: 'SC' },
      { href: '/ai-operations', label: 'AI Briefing', icon: 'AI' },
      { href: '/data-coverage', label: 'Data Coverage', icon: 'DC', badge: 'FOUNDATION' },
    ],
  },
  {
    label: 'Picks',
    items: [
      { href: '/probability-picks', label: 'Probability Picks', icon: 'PR', badge: 'LIMITED' },
      { id: 'today', label: 'Current Board', icon: 'CB' },
      { href: '/most-likely', label: 'Most Likely', icon: 'ML' },
      { href: '/best-value', label: 'Best Value', icon: 'BV' },
    ],
  },
  {
    label: 'Projections',
    items: [
      { href: '/projections', label: 'Team Projections', icon: 'TP' },
      { href: '/player-projections', label: 'Player Projections', icon: 'PP' },
      { href: '/game-intelligence', label: 'Game Intelligence', icon: 'GI' },
    ],
  },
  {
    label: 'Markets',
    items: [
      { href: '/betting-workbench', label: 'Betting Workbench', icon: 'BW' },
      { href: '/portfolio-intelligence', label: 'Portfolio Intelligence', icon: 'PI', badge: 'PREVIEW' },
      { href: '/market-intelligence', label: 'Market Intelligence', icon: 'MI', badge: 'FOUNDATION' },
      { href: '/closing-line-intelligence', label: 'Closing Line Intelligence', icon: 'CL', badge: 'FOUNDATION' },
      { href: '/dashboard#advanced-details', label: 'Market Comparison', icon: 'MC' },
      { href: '/arbitrage', label: 'Arbitrage', icon: 'AR', badge: 'BLOCKED' },
      { href: '/ai-bet-finder', label: 'AI Bet Finder', icon: 'AF' },
    ],
  },
  {
    label: 'Performance',
    items: [
      { href: '/performance', label: 'Performance', icon: 'PF' },
      { id: 'model-center', label: 'Model Health', icon: 'MH' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/ai-operations', label: 'AI Operations', icon: 'AO' },
      { href: '/autonomous-daily-ai', label: 'Autonomous Daily AI', icon: 'AD', badge: 'FOUNDATION' },
      { href: '/data-coverage', label: 'Data Foundation', icon: 'DF', badge: 'FOUNDATION' },
      { href: '/mlb-operations', label: 'MLB Operations', icon: 'MO' },
      { href: '/dashboard#advanced-details', label: 'Providers', icon: 'PV' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { id: 'advanced', label: 'Validation', icon: 'VA' },
      { href: '/dashboard#advanced-details', label: 'Governance', icon: 'GV' },
      { href: '/dashboard#advanced-details', label: 'Diagnostics', icon: 'DX' },
    ],
  },
]

export default function DashboardShell({
  children,
}: {
  children: ReactNode
}) {
  return (
    <SportProvider>
      <div className="min-h-screen bg-slate-950 text-white">
        <div className="flex">
          <aside className="sticky top-0 hidden h-screen w-72 overflow-y-auto border-r border-slate-800 bg-slate-950/95 p-6 xl:block">
            <div className="rounded-lg border border-sky-500/20 bg-sky-950/10 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-300">
                Pick Analyzer
              </p>

              <h1 className="mt-2 text-2xl font-black">
                AI Briefing
              </h1>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                A clear daily answer to whether there is a bet worth making.
              </p>
            </div>

            <nav className="mt-8 space-y-2 pb-24">
              {productNavGroups.map((group) => (
                <div key={group.label} className="pt-2">
                  <p className="px-4 text-xs font-bold uppercase tracking-[0.2em] text-slate-600">
                    {group.label}
                  </p>
                  <div className="mt-2 space-y-1">
                    {group.items.map((item) => (
                      <a
                        key={'href' in item ? item.href : item.id}
                        href={'href' in item ? item.href : `#${item.id}`}
                        className="group flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-900 hover:text-white"
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-emerald-300 group-hover:bg-emerald-500/15">
                          {item.icon}
                        </span>

                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        {'badge' in item && item.badge ? (
                          <ProductStatusBadge tone={item.badge === 'BLOCKED' || item.badge === 'PENDING' ? 'yellow' : 'green'}>
                            {item.badge}
                          </ProductStatusBadge>
                        ) : null}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </nav>

            <div className="fixed bottom-6 w-[224px] rounded-lg border border-slate-800 bg-slate-900/95 p-4">
              <p className="text-xs text-slate-500">System</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <ProductStatusBadge tone="green">MLB Limited</ProductStatusBadge>
                <ProductStatusBadge tone="blue">Stored Data</ProductStatusBadge>
              </div>
            </div>
          </aside>

          <main className="min-w-0 flex-1 overflow-x-hidden">
            <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/90 px-4 py-4 backdrop-blur md:px-8">
              <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                    Pick Analyzer
                  </p>

                  <h2 className="text-xl font-black text-white">
                    Today&apos;s Betting Briefing
                  </h2>
                </div>

                <div className="flex min-w-0 items-center gap-3 overflow-x-auto">
                  <SportSelector />

                  <span className="hidden md:inline-flex"><ProductStatusBadge tone="green">MLB Limited</ProductStatusBadge></span>

                  <span className="hidden lg:inline-flex"><ProductStatusBadge tone="blue">Official Picks Only</ProductStatusBadge></span>

                  <a
                    href="/probability-picks"
                    className="hidden rounded-full border border-emerald-500/30 bg-emerald-950/20 px-4 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-900/30 lg:inline-flex"
                  >
                    Probability Picks
                  </a>

                  <a
                    href="/performance"
                    className="hidden rounded-full border border-emerald-500/30 bg-emerald-950/20 px-4 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-900/30 lg:inline-flex"
                  >
                    Performance
                  </a>

                  <Link
                    href="/sports-center"
                    className="hidden rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800 lg:inline-flex"
                  >
                    Sports Center
                  </Link>

                  <Link
                    href="/player-projections"
                    className="hidden rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800 lg:inline-flex"
                  >
                    Player Projections
                  </Link>

                  <a
                    href="/ai-operations"
                    className="hidden rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800 lg:inline-flex"
                  >
                    AI Operations
                  </a>
                </div>
              </div>
            </header>

            <div className="mx-auto max-w-[1800px] space-y-10 p-4 md:p-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SportProvider>
  )
}
