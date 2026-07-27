import { notFound } from 'next/navigation'
import DashboardSection from '@/components/dashboard/DashboardSection'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { ProductStatusPill } from '@/components/product/ProductStatus'
import { getSportsCenterReport, getSportsCenterSport, getSportsCenterSportKeys } from '@/services/sports-center.service'

export const dynamic = 'force-dynamic'

export function generateStaticParams() {
  return getSportsCenterSportKeys().map((sport) => ({ sport }))
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-200">{value}</p>
    </div>
  )
}

export default async function SportsCenterSportPage({
  params,
}: {
  params: Promise<{ sport: string }>
}) {
  const { sport: sportParam } = await params
  const sport = getSportsCenterSport(sportParam)
  if (!sport) notFound()
  const report = getSportsCenterReport()

  return (
    <DashboardShell>
      <DashboardSection
        eyebrow="Sports Center"
        title={sport.label}
        description={sport.productReadiness}
        action={<ProductStatusPill status={sport.status} />}
      >
        <div className="grid gap-4 md:grid-cols-3">
          <DetailRow label="Current Health" value={sport.currentHealth} />
          <DetailRow label="Data Freshness" value={sport.dataFreshness} />
          <DetailRow label="Today's Games" value={sport.todaysGames} />
        </div>
      </DashboardSection>

      <DashboardSection
        title="Canonical Surfaces"
        description="These links expose existing product and readiness surfaces without replacing their source-of-truth logic."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {[...sport.capabilities, ...sport.hiddenSurfaces].map((item) => (
            <div key={`${item.label}-${item.route ?? item.status}`} className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h3 className="text-lg font-black text-white">{item.label}</h3>
                <ProductStatusPill status={item.status} />
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-300">{item.summary}</p>
              {item.route ? (
                <a className="mt-4 inline-flex rounded-full border border-emerald-500/30 px-4 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-950/30" href={item.route}>
                  Open
                </a>
              ) : null}
            </div>
          ))}
        </div>
      </DashboardSection>

      <DashboardSection
        title="Readiness Detail"
        description="Sports Center keeps production, foundation and blocked states separate so unsupported sports do not look active."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <DetailRow label="Provider Health" value={sport.providerHealth} />
          <DetailRow label="Settlement Pipeline" value={sport.settlementPipeline} />
          <DetailRow label="Next Action" value={sport.nextAction} />
          <DetailRow label="Sports Center Safety" value={report.settlementAudit.finding} />
        </div>
        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/70 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Blockers</p>
          <ul className="mt-3 space-y-2">
            {sport.blockers.map((blocker) => (
              <li key={blocker} className="text-sm leading-6 text-slate-300">{blocker}</li>
            ))}
          </ul>
        </div>
      </DashboardSection>
    </DashboardShell>
  )
}
