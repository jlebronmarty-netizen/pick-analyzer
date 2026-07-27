import DashboardSection from '@/components/dashboard/DashboardSection'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { ProductStatusBadge, ProductStatusPill } from '@/components/product/ProductStatus'
import { getSportsCenterReport } from '@/services/sports-center.service'
import type { SportsCenterSport } from '@/types/sports-center'

export const dynamic = 'force-dynamic'

function statusSummary(sports: SportsCenterSport[]) {
  return sports.reduce<Record<string, number>>((counts, sport) => {
    counts[sport.status] = (counts[sport.status] ?? 0) + 1
    return counts
  }, {})
}

function Card({ sport }: { sport: SportsCenterSport }) {
  return (
    <a
      href={`/sports-center/${sport.key}`}
      className="block rounded-lg border border-slate-800 bg-slate-900/70 p-5 transition hover:border-emerald-500/40 hover:bg-slate-900"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{sport.sportKey}</p>
          <h3 className="mt-1 text-2xl font-black text-white">{sport.label}</h3>
        </div>
        <ProductStatusPill status={sport.status} />
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-300">{sport.summary}</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Data</p>
          <p className="mt-2 text-sm font-bold text-slate-100">{sport.dataState}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Model</p>
          <p className="mt-2 text-sm font-bold text-slate-100">{sport.modelState}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Today</p>
          <p className="mt-2 text-sm font-bold text-slate-100">{sport.todayState}</p>
        </div>
      </div>
    </a>
  )
}

export default function SportsCenterPage() {
  const report = getSportsCenterReport()
  const counts = statusSummary(report.sports)

  return (
    <DashboardShell>
      <DashboardSection
        eyebrow="Product Hub"
        title="Sports Center"
        description="Sport-by-sport readiness, certified routes, hidden operational surfaces and blockers for the current Pick Analyzer product."
      >
        <div className="grid gap-4 md:grid-cols-4">
          {Object.entries(counts).map(([status, count]) => (
            <div key={status} className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{status}</p>
              <p className="mt-2 text-3xl font-black text-white">{count}</p>
            </div>
          ))}
        </div>
      </DashboardSection>

      <DashboardSection
        title="Sport Readiness"
        description="Only MLB is presented as production-ready. Foundation, preview, planning and blocked sports stay visibly gated until their own data and model certifications pass."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {report.sports.map((sport) => (
            <Card key={sport.key} sport={sport} />
          ))}
        </div>
      </DashboardSection>

      <DashboardSection
        title="Safety Contract"
        description="This hub is a navigation and readiness layer. It does not call providers, mutate remote data, apply SQL, run imports, rebuild features, change settlement or adjust prediction logic."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-sm text-slate-400">Provider calls</p>
            <p className="mt-2 text-3xl font-black text-white">{report.providerCallsMade}</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-sm text-slate-400">Remote mutations</p>
            <p className="mt-2 text-3xl font-black text-white">{report.remoteMutationsMade}</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-sm text-slate-400">Production mutations</p>
            <p className="mt-2 text-3xl font-black text-white">{report.productionMutationsMade}</p>
          </div>
        </div>
        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex flex-wrap gap-2">
            {report.navigation.canonicalStatusSystem.map((status) => (
              <ProductStatusBadge key={status}>{status}</ProductStatusBadge>
            ))}
          </div>
        </div>
      </DashboardSection>
    </DashboardShell>
  )
}
