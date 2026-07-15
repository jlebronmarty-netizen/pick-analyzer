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
  { id: 'overview', label: 'Overview', icon: '01' },
  { id: 'today', label: 'Today', icon: '02' },
  { id: 'model-lab', label: 'Model Lab', icon: '03' },
  { id: 'data-operations', label: 'Data Ops', icon: '04' },
  { id: 'advanced', label: 'Advanced', icon: '05' },
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
            <div className="rounded-3xl border border-emerald-500/20 bg-emerald-950/10 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-300">
                Pick Analyzer
              </p>

              <h1 className="mt-2 text-2xl font-black">
                AI Command
              </h1>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                Adaptive multi-sport betting intelligence system.
              </p>
            </div>

            <nav className="mt-8 space-y-2 pb-24">
              {compactNavItems.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-900 hover:text-white"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-emerald-300 group-hover:bg-emerald-500/15">
                    {item.icon}
                  </span>

                  {item.label}
                </a>
              ))}
            </nav>

            <div className="fixed bottom-6 w-[224px] rounded-2xl border border-slate-800 bg-slate-900/95 p-4">
              <p className="text-xs text-slate-500">System</p>
              <p className="mt-1 text-sm font-bold text-emerald-300">
                Multi-Sport Engine Active
              </p>
            </div>
          </aside>

          <main className="w-full">
            <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/90 px-4 py-4 backdrop-blur md:px-8">
              <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                    Dashboard V4
                  </p>

                  <h2 className="text-xl font-black text-white">
                    Betting Intelligence Center
                  </h2>
                </div>

                <div className="flex items-center gap-3">
                  <SportSelector />

                  <span className="hidden rounded-full border border-emerald-500/30 bg-emerald-950/20 px-4 py-2 text-xs font-bold text-emerald-300 md:inline-flex">
                    LIVE
                  </span>

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
