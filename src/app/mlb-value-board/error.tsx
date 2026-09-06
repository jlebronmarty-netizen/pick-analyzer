'use client'

import DashboardShell from '@/components/dashboard/DashboardShell'

export default function MlbValueBoardError({ error }: { error: Error }) {
  return (
    <DashboardShell>
      <section className="rounded-lg border border-rose-400/30 bg-rose-400/10 p-5 md:p-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-rose-200">MLB Value Board</p>
        <h1 className="mt-3 text-2xl font-black text-white">Board unavailable</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-rose-100">
          {error.message || 'The read-only board query failed. No fallback picks are generated.'}
        </p>
      </section>
    </DashboardShell>
  )
}
