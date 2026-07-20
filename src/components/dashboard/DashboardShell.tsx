'use client'

import { ReactNode } from 'react'
import { SportProvider } from '@/context/SportContext'
import SportSelector from '@/components/dashboard/SportSelector'

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

const compactNavItems = [
  { id: 'today', label: 'User Mode', icon: '01' },
  { id: 'performance', label: 'Performance', icon: '02', href: '/performance' },
  { id: 'overview', label: 'Advanced Overview', icon: '03' },
  { id: 'model-lab', label: 'Model', icon: '04' },
  { id: 'data-operations', label: 'Data', icon: '05' },
  { id: 'advanced', label: 'Administration', icon: '06' },
]

const toolNavItems = [
  { href: '/projections', label: 'Projections', icon: 'PR' },
  { href: '/betting-workbench', label: 'Betting Workbench', icon: 'BW' },
  { href: '/most-likely', label: 'Most Likely', icon: 'ML' },
  { href: '/best-value', label: 'Best Value', icon: 'BV' },
  { href: '/arbitrage', label: 'Arbitrage', icon: 'AR' },
  { href: '/ai-bet-finder', label: 'AI Bet Finder', icon: 'AI' },
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
              {compactNavItems.map((item) => (
                <a
                  key={item.id}
                  href={'href' in item ? item.href : `#${item.id}`}
                  className="group flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-900 hover:text-white"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-emerald-300 group-hover:bg-emerald-500/15">
                    {item.icon}
                  </span>

                  {item.label}
                </a>
              ))}
              <div className="pt-4">
                <p className="px-4 text-xs font-bold uppercase tracking-[0.2em] text-slate-600">
                  Extra Utilities
                </p>
                <div className="mt-2 space-y-2">
                  {toolNavItems.map((item) => (
                    <a
                      key={item.href}
                      href={item.href}
                      className="group flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-900 hover:text-white"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-amber-300 group-hover:bg-amber-500/15">
                        {item.icon}
                      </span>
                      {item.label}
                    </a>
                  ))}
                </div>
              </div>
            </nav>

            <div className="fixed bottom-6 w-[224px] rounded-lg border border-slate-800 bg-slate-900/95 p-4">
              <p className="text-xs text-slate-500">System</p>
              <p className="mt-1 text-sm font-bold text-emerald-300">
                MLB board active
              </p>
            </div>
          </aside>

          <main className="w-full">
            <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/90 px-4 py-4 backdrop-blur md:px-8">
              <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                    Pick Analyzer
                  </p>

                  <h2 className="text-xl font-black text-white">
                    Today's Betting Briefing
                  </h2>
                </div>

                <div className="flex items-center gap-3">
                  <SportSelector />

                  <span className="hidden rounded-full border border-emerald-500/30 bg-emerald-950/20 px-4 py-2 text-xs font-bold text-emerald-200 md:inline-flex">
                    MLB ACTIVE
                  </span>

                  <span className="hidden rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-bold text-slate-200 lg:inline-flex">
                    OFFICIAL PICKS ONLY
                  </span>

                  <a
                    href="/performance"
                    className="hidden rounded-full border border-emerald-500/30 bg-emerald-950/20 px-4 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-900/30 lg:inline-flex"
                  >
                    Performance
                  </a>

                  <a
                    href="/betting-workbench"
                    className="hidden rounded-full border border-emerald-500/30 bg-emerald-950/20 px-4 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-900/30 lg:inline-flex"
                  >
                    Betting Workbench
                  </a>

                  <a
                    href="/most-likely"
                    className="hidden rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800 lg:inline-flex"
                  >
                    Most Likely
                  </a>

                  <a
                    href="/best-value"
                    className="hidden rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800 lg:inline-flex"
                  >
                    Best Value
                  </a>

                  <a
                    href="/ai-bet-finder"
                    className="hidden rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800 lg:inline-flex"
                  >
                    AI Bet Finder
                  </a>

                  <a
                    href="/arbitrage"
                    className="hidden rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800 lg:inline-flex"
                  >
                    Arbitrage
                  </a>

                  <a
                    href="/model"
                    className="hidden rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800 md:inline-flex"
                  >
                    AI Model Center
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
