import { notFound } from 'next/navigation'
import DashboardSection from '@/components/dashboard/DashboardSection'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { ProductStatusBadge } from '@/components/product/ProductStatus'
import { getDataCoverageSportInventoryV1, getDataCoverageSportKeys } from '@/services/data-coverage-inventory.service'

export const dynamic = 'force-dynamic'

export function generateStaticParams() {
  return getDataCoverageSportKeys().map((sport) => ({ sport }))
}

function tone(status: string) {
  if (status === 'Certified' || status === 'Production') return 'green'
  if (status === 'Foundation' || status === 'Preview') return 'blue'
  if (status === 'Planning' || status === 'Pending') return 'yellow'
  if (status === 'Blocked') return 'red'
  return 'gray'
}

function value(value: string | number | null) {
  if (value === null) return 'Not measured'
  return typeof value === 'number' ? value.toLocaleString() : value
}

export default async function DataCoverageSportPage({
  params,
}: {
  params: Promise<{ sport: string }>
}) {
  const { sport: sportParam } = await params
  const sport = await getDataCoverageSportInventoryV1(sportParam)
  if (!sport) notFound()

  return (
    <DashboardShell>
      <DashboardSection
        eyebrow="Data Coverage"
        title={sport.label}
        description={`Current season ${sport.currentSeason}; previous season ${sport.previousSeason}. Counts are exact only where the current canonical source exposes a grounded count.`}
        action={<ProductStatusBadge tone={tone(sport.status)}>{sport.status}</ProductStatusBadge>}
      >
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Rows</p>
            <p className="mt-2 text-3xl font-black text-white">{sport.domains.reduce((sum, domain) => sum + (domain.rowCount ?? 0), 0).toLocaleString()}</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Exact Domains</p>
            <p className="mt-2 text-3xl font-black text-white">{sport.health.domainsWithExactCounts}/{sport.health.totalDomains}</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Prediction</p>
            <p className="mt-2 text-lg font-black text-white">{sport.predictionReadiness.state}</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Recommendation</p>
            <p className="mt-2 text-lg font-black text-white">{sport.predictionReadiness.recommendationState}</p>
          </div>
        </div>
      </DashboardSection>

      <DashboardSection
        title="Domain Inventory"
        description="Each row names the canonical source, exact count availability, measurement window and blocker when data is absent."
      >
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="min-w-full divide-y divide-slate-800 text-sm">
            <thead className="bg-slate-950">
              <tr>
                {['Domain', 'Status', 'Rows', 'Coverage', 'Source', 'Freshness', 'Blocker'].map((heading) => (
                  <th key={heading} className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.16em] text-slate-500">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-900/60">
              {sport.domains.map((domain) => (
                <tr key={domain.key}>
                  <td className="px-4 py-4 font-bold text-white">{domain.label}</td>
                  <td className="px-4 py-4"><ProductStatusBadge tone={tone(domain.status)}>{domain.status}</ProductStatusBadge></td>
                  <td className="px-4 py-4 text-slate-200">{value(domain.rowCount)}</td>
                  <td className="px-4 py-4 text-slate-300">{domain.coveragePercent === null ? 'N/A' : `${domain.coveragePercent}%`}</td>
                  <td className="px-4 py-4 text-slate-300">{domain.source}</td>
                  <td className="px-4 py-4 text-slate-400">{domain.measurementWindow.latestDate ?? 'No stored timestamp'}</td>
                  <td className="px-4 py-4 text-slate-400">{domain.blocker ?? 'None recorded'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DashboardSection>

      <DashboardSection
        title="Next Acquisition"
        description="This is the highest-value stored-data blocker identified by the current read-only inventory."
      >
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
          <p className="text-lg font-black text-white">{sport.health.highestValueNextAcquisition}</p>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Provider capability and entitlement remain unknown until the next bounded audit phase. No recommendation is surfaced from this page.
          </p>
        </div>
      </DashboardSection>
    </DashboardShell>
  )
}
