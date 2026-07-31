'use client'

import { ReactNode, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SportProvider } from '@/context/SportContext'
import SportSelector from '@/components/dashboard/SportSelector'
import { ProductStatusBadge } from '@/components/product/ProductStatus'

const productNavGroups = [
  {
    label: 'Primary',
    items: [
      { href: '/dashboard', label: 'Today', icon: 'TD' },
      { href: '/most-likely', label: 'Opportunities', icon: 'OP' },
      { href: '/performance', label: 'Performance', icon: 'PF' },
      { href: '/sports-center', label: 'Sports', icon: 'SP' },
      {
        href: '/dashboard#advanced-details',
        label: 'More',
        icon: 'MR',
      },
    ],
  },
  {
    label: 'Opportunities',
    items: [
      {
        href: '/probability-picks',
        label: 'Probability Picks',
        icon: 'PR',
        badge: 'LIMITED',
      },
      { href: '/most-likely', label: 'Most Likely', icon: 'ML' },
      { href: '/best-value', label: 'Best Value', icon: 'BV' },
      { href: '/betting-workbench', label: 'Betting Workbench', icon: 'BW' },
      { href: '/game-intelligence', label: 'Game Intelligence', icon: 'GI' },
    ],
  },
  {
    label: 'Analysis',
    items: [
      { href: '/projections', label: 'Team Projections', icon: 'TP' },
      {
        href: '/player-projections',
        label: 'Player Projections',
        icon: 'PP',
      },
      {
        href: '/portfolio-intelligence',
        label: 'Portfolio Intelligence',
        icon: 'PI',
        badge: 'PREVIEW',
      },
      {
        href: '/market-intelligence',
        label: 'Market Intelligence',
        icon: 'MI',
        badge: 'FOUNDATION',
      },
      {
        href: '/closing-line-intelligence',
        label: 'Closing Line Intelligence',
        icon: 'CL',
        badge: 'FOUNDATION',
      },
      {
        href: '/arbitrage',
        label: 'Arbitrage',
        icon: 'AR',
        badge: 'BLOCKED',
      },
      { href: '/ai-bet-finder', label: 'AI Bet Finder', icon: 'AF' },
    ],
  },
  {
    label: 'Performance',
    items: [
      { href: '/performance', label: 'Performance', icon: 'PF' },
      { href: '/dashboard#advanced-details', label: 'Model Health', icon: 'MH' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/ai-operations', label: 'AI Operations', icon: 'AO' },
      {
        href: '/autonomous-daily-ai',
        label: 'Autonomous Daily AI',
        icon: 'AD',
        badge: 'FOUNDATION',
      },
      {
        href: '/data-coverage',
        label: 'Data Foundation',
        icon: 'DF',
        badge: 'FOUNDATION',
      },
      {
        href: '/mlb-operations',
        label: 'MLB Operations',
        icon: 'MO',
      },
      {
        href: '/dashboard#advanced-details',
        label: 'Providers',
        icon: 'PV',
      },
    ],
  },
  {
    label: 'More',
    items: [
      { href: '/ai-operations', label: 'AI Briefing', icon: 'AI' },
      { id: 'today', label: 'Current Board', icon: 'CB' },
      { href: '/dashboard#advanced-details', label: 'Market Comparison', icon: 'MC' },
      { href: '/dashboard#advanced-details', label: 'Validation', icon: 'VA' },
      {
        href: '/dashboard#advanced-details',
        label: 'Governance',
        icon: 'GV',
      },
      {
        href: '/dashboard#advanced-details',
        label: 'Diagnostics',
        icon: 'DX',
      },
    ],
  },
]

const mobileOpportunityLinks = [
  {
    href: '/dashboard',
    label: "Today's Best Opportunity",
    description: 'Return to the Today decision hero.',
  },
  {
    href: '/probability-picks',
    label: 'Official Picks / Probability Picks',
    description: 'Review projection-only pick candidates and official-pick context.',
  },
  {
    href: '/most-likely',
    label: 'Most Likely',
    description: 'Open the probability-first opportunity scanner.',
  },
  {
    href: '/best-value',
    label: 'Best Value',
    description: 'Open the value-first opportunity scanner.',
  },
  {
    href: '/best-value',
    label: 'Current Board / Watchlist',
    description: 'Review Current Board-derived watchlist and market-intelligence rows.',
  },
]

const opportunityRouteSet = new Set(
  mobileOpportunityLinks.map((item) => item.href),
)

function navBadgeTone(badge: string) {
  if (badge === 'BLOCKED') return 'red'
  if (badge === 'PENDING' || badge === 'LIMITED' || badge === 'PREVIEW') return 'yellow'
  if (badge === 'FOUNDATION') return 'blue'
  return 'gray'
}

export default function DashboardShell({
  children,
}: {
  children: ReactNode
}) {
  const pathname = usePathname()
  const [opportunitiesOpen, setOpportunitiesOpen] = useState(false)
  const firstOpportunityLinkRef = useRef<HTMLAnchorElement | null>(null)
  const opportunityButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!opportunitiesOpen) return

    firstOpportunityLinkRef.current?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpportunitiesOpen(false)
        opportunityButtonRef.current?.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [opportunitiesOpen])

  const isOpportunityRoute = opportunityRouteSet.has(pathname ?? '')

  return (
    <SportProvider>
      <div className="min-h-screen bg-slate-950 text-white">
        <div className="flex">
          <aside className="sticky top-0 hidden h-screen w-72 overflow-y-auto border-r border-slate-800 bg-slate-950/95 p-6 xl:block">
            <div className="rounded-lg border border-sky-500/20 bg-sky-950/10 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-300">
                Pick Analyzer
              </p>

              <h1 className="mt-2 text-2xl font-black">AI Briefing</h1>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                A daily decision cockpit for the best available betting signal.
              </p>
            </div>

            <nav className="mt-8 space-y-2 pb-24">
              {productNavGroups.map((group) => (
                <div key={group.label} className="pt-2">
                  <p className="px-4 text-xs font-bold uppercase tracking-[0.2em] text-slate-600">
                    {group.label}
                  </p>

                  <div className="mt-2 space-y-1">
                    {group.items.map((item) => {
                      const destination =
                        'href' in item ? item.href : `#${item.id}`

                      const itemKey = `${group.label}-${item.label}-${destination}`

                      return (
                        <a
                          key={itemKey}
                          href={destination}
                          className="group flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-900 hover:text-white"
                        >
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-emerald-300 group-hover:bg-emerald-500/15">
                            {item.icon}
                          </span>

                          <span className="min-w-0 flex-1 truncate">
                            {item.label}
                          </span>

                          {'badge' in item && item.badge ? (
                            <ProductStatusBadge
                              tone={navBadgeTone(item.badge)}
                            >
                              {item.badge}
                            </ProductStatusBadge>
                          ) : null}
                        </a>
                      )
                    })}
                  </div>
                </div>
              ))}
            </nav>

            <div className="fixed bottom-6 w-[224px] rounded-lg border border-slate-800 bg-slate-900/95 p-4">
              <p className="text-xs text-slate-500">System</p>

              <div className="mt-2 flex flex-wrap gap-2">
                <ProductStatusBadge tone="green">
                  MLB Limited
                </ProductStatusBadge>

                <ProductStatusBadge tone="blue">
                  Stored Data
                </ProductStatusBadge>
              </div>
            </div>
          </aside>

          <main className="min-w-0 flex-1 overflow-x-hidden pb-32 xl:pb-0">
            <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/90 px-4 py-4 backdrop-blur md:px-8">
              <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                    Pick Analyzer
                  </p>

                  <h2 className="text-xl font-black text-white">
                    Today&apos;s Decision
                  </h2>
                </div>

                <div className="flex min-w-0 items-center gap-3 overflow-x-auto">
                  <SportSelector />

                  <span className="hidden md:inline-flex">
                    <ProductStatusBadge tone="green">
                      MLB Limited
                    </ProductStatusBadge>
                  </span>

                  <span className="hidden lg:inline-flex">
                    <ProductStatusBadge tone="blue">
                      Official Picks Only
                    </ProductStatusBadge>
                  </span>

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
        {opportunitiesOpen ? (
          <div
            className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm xl:hidden"
            aria-hidden="true"
            onClick={() => setOpportunitiesOpen(false)}
            data-b5-1-mobile-opportunity-backdrop="true"
          />
        ) : null}

        {opportunitiesOpen ? (
          <section
            id="mobile-opportunities-sheet"
            className="fixed inset-x-3 bottom-24 z-50 mx-auto max-w-2xl rounded-lg border border-sky-400/30 bg-slate-950 p-4 shadow-2xl shadow-slate-950/60 xl:hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-opportunities-title"
            data-b5-1-mobile-opportunity-sheet="true"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-200">
                  Opportunities
                </p>
                <h2 id="mobile-opportunities-title" className="mt-1 text-xl font-black text-white">
                  Find a betting signal
                </h2>
              </div>
              <button
                type="button"
                className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-sm font-black text-slate-200 outline-none hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-sky-300"
                onClick={() => setOpportunitiesOpen(false)}
                aria-label="Close opportunity navigation"
              >
                X
              </button>
            </div>

            <div className="mt-4 grid gap-2" role="list" aria-label="Opportunity destinations">
              {mobileOpportunityLinks.map((item, index) => (
                <a
                  key={`${item.label}-${item.href}`}
                  ref={index === 0 ? firstOpportunityLinkRef : undefined}
                  href={item.href}
                  onClick={() => setOpportunitiesOpen(false)}
                  className="rounded-lg border border-slate-800 bg-slate-900/80 px-4 py-3 text-left outline-none hover:border-sky-400 hover:bg-slate-900 focus-visible:ring-2 focus-visible:ring-sky-300"
                  data-b5-1-mobile-opportunity-link={item.label}
                  role="listitem"
                >
                  <span className="block text-sm font-black text-white">{item.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-400">{item.description}</span>
                </a>
              ))}
            </div>
          </section>
        ) : null}

        <nav
          className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-800 bg-slate-950/95 px-2 pt-2 backdrop-blur xl:hidden"
          aria-label="Primary mobile navigation"
          data-b4-mobile-bottom-nav="true"
          data-b5-1-mobile-bottom-nav="true"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)' }}
        >
          <div className="mx-auto grid max-w-2xl grid-cols-5 gap-1">
            {productNavGroups[0].items.map((item) => {
              const destination =
                'href' in item && item.href
                  ? item.href
                  : `#${'id' in item ? item.id : item.label}`
              const isOpportunities = item.label === 'Opportunities'
              const active = isOpportunities
                ? isOpportunityRoute
                : pathname === destination || (destination.includes('#') && pathname === destination.split('#')[0])
              const baseClasses = 'flex min-h-14 min-w-0 flex-col items-center gap-1 rounded-lg px-2 py-2 text-center text-[11px] font-black outline-none focus-visible:ring-2 focus-visible:ring-sky-300'
              const stateClasses = active
                ? 'bg-sky-500/15 text-white'
                : 'text-slate-300 hover:bg-slate-900 hover:text-white'

              if (isOpportunities) {
                return (
                  <button
                    key={`mobile-${item.label}`}
                    ref={opportunityButtonRef}
                    type="button"
                    className={`${baseClasses} ${stateClasses}`}
                    onClick={() => setOpportunitiesOpen((open) => !open)}
                    aria-haspopup="dialog"
                    aria-expanded={opportunitiesOpen}
                    aria-controls="mobile-opportunities-sheet"
                    data-b5-1-mobile-opportunities-trigger="true"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-800 bg-slate-900 text-[10px] text-emerald-300">
                      {item.icon}
                    </span>
                    <span className="w-full truncate">{item.label}</span>
                  </button>
                )
              }

              return (
                <a
                  key={`mobile-${item.label}`}
                  href={destination}
                  className={`${baseClasses} ${stateClasses}`}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-800 bg-slate-900 text-[10px] text-emerald-300">
                    {item.icon}
                  </span>
                  <span className="w-full truncate">{item.label}</span>
                </a>
              )
            })}
          </div>
        </nav>
      </div>
    </SportProvider>
  )
}
