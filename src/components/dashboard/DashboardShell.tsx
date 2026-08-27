'use client'

import { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SportProvider } from '@/context/SportContext'
import { ProductStatusBadge } from '@/components/product/ProductStatus'

const productNavItems = [
  { href: '/today', label: 'Today', icon: 'T' },
  { href: '/performance', label: 'Performance', icon: 'P' },
  { href: '/model-lab', label: 'Model Lab', icon: 'M' },
  { href: '/data-health', label: 'Data Health', icon: 'D' },
]

const titleByPath: Record<string, string> = {
  '/': 'Today',
  '/today': 'Today',
  '/performance': 'Performance',
  '/model-lab': 'Model Lab',
  '/data-health': 'Data Health',
}

export default function DashboardShell({
  children,
}: {
  children: ReactNode
}) {
  const pathname = usePathname()
  const activeTitle = titleByPath[pathname ?? ''] ?? 'Pick Analyzer 2.0'

  return (
    <SportProvider>
      <div className="min-h-screen bg-slate-950 text-white">
        <div className="flex">
          <aside className="sticky top-0 hidden h-screen w-72 overflow-y-auto border-r border-slate-800 bg-slate-950/95 p-6 xl:block">
            <div className="rounded-lg border border-sky-500/20 bg-sky-950/10 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-300">
                Pick Analyzer 2.0
              </p>

              <h1 className="mt-2 text-2xl font-black">Product Reset</h1>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                Four clean product areas while the new prediction engine is rebuilt.
              </p>
            </div>

            <nav className="mt-8 space-y-2 pb-24">
              <div className="pt-2">
                <p className="px-4 text-xs font-bold uppercase tracking-[0.2em] text-slate-600">
                  Primary
                </p>

                <div className="mt-2 space-y-1">
                  {productNavItems.map((item) => {
                    const active = pathname === item.href || (pathname === '/' && item.href === '/today')
                    return (
                      <a
                        key={item.href}
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={`group flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition ${
                          active
                            ? 'bg-emerald-500/15 text-white'
                            : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                        }`}
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-emerald-300 group-hover:bg-emerald-500/15">
                          {item.icon}
                        </span>

                        <span className="min-w-0 flex-1 truncate">
                          {item.label}
                        </span>
                      </a>
                    )
                  })}
                </div>
              </div>
            </nav>

            <div className="fixed bottom-6 w-[224px] rounded-lg border border-slate-800 bg-slate-900/95 p-4">
              <p className="text-xs text-slate-500">Pick 2 reset</p>

              <div className="mt-2 flex flex-wrap gap-2">
                <ProductStatusBadge tone="blue">
                  Setup Pending
                </ProductStatusBadge>
              </div>
            </div>
          </aside>

          <main className="min-w-0 flex-1 overflow-x-hidden pb-32 xl:pb-0">
            <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/90 px-4 py-4 backdrop-blur md:px-8">
              <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                    Pick Analyzer 2.0
                  </p>

                  <h2 className="text-xl font-black text-white">
                    {activeTitle}
                  </h2>
                </div>

                <div className="flex min-w-0 items-center gap-3 overflow-x-auto">
                  <span className="hidden lg:inline-flex">
                    <ProductStatusBadge tone="blue">
                      Clean Start
                    </ProductStatusBadge>
                  </span>

                  <Link
                    href="/settings"
                    className="hidden rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800 lg:inline-flex"
                  >
                    Settings
                  </Link>
                </div>
              </div>
            </header>

            <div className="mx-auto max-w-[1800px] space-y-10 p-4 md:p-8">
              {children}
            </div>
          </main>
        </div>

        <nav
          className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-800 bg-slate-950/95 px-2 pt-2 backdrop-blur xl:hidden"
          aria-label="Primary mobile navigation"
          data-b4-mobile-bottom-nav="true"
          data-b5-1-mobile-bottom-nav="true"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)' }}
        >
          <div className="mx-auto grid max-w-2xl grid-cols-4 gap-1">
            {productNavItems.map((item) => {
              const active = pathname === item.href || (pathname === '/' && item.href === '/today')
              const baseClasses = 'flex min-h-14 min-w-0 flex-col items-center gap-1 rounded-lg px-2 py-2 text-center text-[11px] font-black outline-none focus-visible:ring-2 focus-visible:ring-sky-300'
              const stateClasses = active
                ? 'bg-sky-500/15 text-white'
                : 'text-slate-300 hover:bg-slate-900 hover:text-white'

              return (
                <a
                  key={`mobile-${item.label}`}
                  href={item.href}
                  className={`${baseClasses} ${stateClasses}`}
                  aria-current={active ? 'page' : undefined}
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
