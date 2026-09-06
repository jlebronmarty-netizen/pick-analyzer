import DashboardShell from '@/components/dashboard/DashboardShell'

export default function MlbValueBoardLoading() {
  return (
    <DashboardShell>
      <main className="space-y-5">
        <section className="rounded-lg border border-slate-800 bg-slate-950/90 p-5 md:p-6">
          <div className="h-3 w-20 rounded bg-slate-800" />
          <div className="mt-4 h-9 w-64 rounded bg-slate-800" />
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-20 rounded-lg border border-slate-800 bg-slate-900" />
            ))}
          </div>
        </section>
        <div className="grid gap-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-44 rounded-lg border border-slate-800 bg-slate-900/80" />
          ))}
        </div>
      </main>
    </DashboardShell>
  )
}
