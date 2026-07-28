import DashboardSection from '@/components/dashboard/DashboardSection'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { ProductStatusBadge } from '@/components/product/ProductStatus'
import { getDataCoverageInventoryV1 } from '@/services/data-coverage-inventory.service'

export const dynamic = 'force-dynamic'

function tone(status: string) {
  if (status === 'Certified' || status === 'Production') return 'green'
  if (status === 'Foundation' || status === 'Preview') return 'blue'
  if (status === 'Planning' || status === 'Pending') return 'yellow'
  return 'gray'
}

function Metric({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
      {detail ? <p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p> : null}
    </div>
  )
}

export default async function DataCoveragePage() {
  const inventory = await getDataCoverageInventoryV1()

  return (
    <DashboardShell>
      <DashboardSection
        eyebrow="Data Health"
        title="Data Coverage"
        description="Stored-data inventory and sport health across canonical schedules, results, statistics, markets, predictions, settlement and learning evidence. Missing counts stay explicit instead of estimated."
      >
        <div className="grid gap-4 md:grid-cols-4">
          <Metric label="Sports" value={inventory.summary.sportsAudited} />
          <Metric label="Domains" value={inventory.summary.domainsAudited} />
          <Metric label="Stored Rows" value={inventory.summary.totalRowsObserved.toLocaleString()} />
          <Metric label="Provider Calls" value={inventory.providerCallsMade} detail="This page is read-only." />
        </div>
      </DashboardSection>

      <DashboardSection
        title="Sport Health"
        description="Statuses use the platform vocabulary and do not turn foundation data into production readiness."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {inventory.sports.map((sport) => (
            <a key={sport.key} href={`/data-coverage/${sport.key}`} className="block rounded-lg border border-slate-800 bg-slate-900/70 p-5 transition hover:border-emerald-500/40">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{sport.sportKey}</p>
                  <h3 className="mt-1 text-2xl font-black text-white">{sport.label}</h3>
                </div>
                <ProductStatusBadge tone={tone(sport.status)}>{sport.status}</ProductStatusBadge>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <Metric label="Rows" value={sport.domains.reduce((sum, domain) => sum + (domain.rowCount ?? 0), 0).toLocaleString()} />
                <Metric label="Exact Domains" value={`${sport.health.domainsWithExactCounts}/${sport.health.totalDomains}`} />
                <Metric label="Prediction" value={sport.predictionReadiness.state} />
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-400">{sport.freshness}</p>
            </a>
          ))}
        </div>
      </DashboardSection>

      <DashboardSection
        title="Safety Contract"
        description="The inventory does not import data, call providers, apply SQL, rebuild features, generate predictions, settle rows or change recommendation policy."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <Metric label="Remote Mutations" value={inventory.remoteMutationsMade} />
          <Metric label="Production Mutations" value={inventory.productionMutationsMade} />
          <Metric label="Prediction Ready Sports" value={inventory.summary.predictionReadySports} />
        </div>
      </DashboardSection>
    </DashboardShell>
  )
}
