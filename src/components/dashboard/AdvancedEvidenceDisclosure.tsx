'use client'

import { ReactNode, useState } from 'react'

export default function AdvancedEvidenceDisclosure({
  children,
}: {
  children: ReactNode
}) {
  const [opened, setOpened] = useState(false)

  return (
    <section id="advanced-details" className="scroll-mt-24 pb-6 md:pb-0" data-b6-mobile-advanced-evidence="true">
      <details
        className="rounded-lg border border-slate-800 bg-slate-950/70 p-4 md:p-5"
        onToggle={(event) => setOpened((event.currentTarget as HTMLDetailsElement).open)}
      >
        <summary className="cursor-pointer list-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-sky-300">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-sky-300">
                Advanced Evidence
              </p>
              <h2 className="mt-2 text-xl font-black text-white md:text-2xl">
                Model, data, provider and operations detail
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                Technical evidence stays available for deeper review without crowding the daily decision.
              </p>
            </div>
            <span className="inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-black text-slate-100">
              {opened ? 'Hide Evidence' : 'Show Evidence'}
            </span>
          </div>
        </summary>

        {opened ? <div className="mt-6 space-y-6">{children}</div> : null}
      </details>
    </section>
  )
}
