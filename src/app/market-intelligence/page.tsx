import DashboardShell from '@/components/dashboard/DashboardShell'
import { ProductStatusBadge, ProductStatusBanner, productDateTime } from '@/components/product/ProductStatus'
import { getMarketMovementIntelligence } from '@/services/market-movement-intelligence.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function labelize(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function fmt(value: number | null) {
  return value === null ? 'N/A' : String(value)
}

function Metric({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <article className="rounded-lg border border-slate-800 bg-slate-900/80 p-4">
      <p className="text-xs font-black uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p>
    </article>
  )
}

export default async function MarketIntelligencePage() {
  const data = await getMarketMovementIntelligence({ limit: 24 })
  return (
    <DashboardShell>
      <section className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-300">Market Intelligence</p>
            <h1 className="mt-2 text-3xl font-black text-white">Stored Market Movement</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Read-only movement evidence from stored sportsbook snapshots. Earliest stored price is shown separately from true opening line provenance.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ProductStatusBadge tone="blue">Foundation</ProductStatusBadge>
            <ProductStatusBadge tone="green">Stored Data</ProductStatusBadge>
            <ProductStatusBadge tone="yellow">No Sharp-Money Claim</ProductStatusBadge>
          </div>
        </div>

        <ProductStatusBanner
          tone="blue"
          title="Grounded movement only"
          detail="The page reports earliest stored versus current stored prices. It does not fabricate opening lines, sharp-money claims, cross-event attachments or cross-side attachments."
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Snapshots" value={data.capabilityAudit.snapshotCount} detail="Stored rows read from sports_odds_snapshots." />
          <Metric label="Market Groups" value={data.coverage.totalGroups} detail={`${data.coverage.singleSnapshotGroups} single-snapshot groups.`} />
          <Metric label="Bookmakers" value={data.capabilityAudit.bookmakerCoverage.length} detail={data.capabilityAudit.bookmakerCoverage.slice(0, 4).join(', ') || 'No books.'} />
          <Metric label="Latest Snapshot" value={data.capabilityAudit.latestAvailableSnapshot ? productDateTime(data.capabilityAudit.latestAvailableSnapshot) : 'N/A'} detail={data.capabilityAudit.timestampQuality} />
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-4">
          <p className="text-xs font-black uppercase text-slate-500">Coverage</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.capabilityAudit.marketCoverage.map((market) => <ProductStatusBadge key={market} tone="blue">{labelize(market)}</ProductStatusBadge>)}
          </div>
        </div>

        <section className="space-y-3">
          <h2 className="text-xl font-black text-white">Movement Summaries</h2>
          {data.movementSummaries.length ? data.movementSummaries.map((row) => (
            <article key={row.id} className="rounded-lg border border-slate-800 bg-slate-900/80 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-black uppercase text-slate-500">{labelize(row.sport)} | {labelize(row.market)} | {row.outcome}</p>
                  <h3 className="mt-2 text-lg font-black text-white">{row.eventLabel}</h3>
                  <p className="mt-1 text-sm text-slate-400">{row.provenance.openingLabel}: {fmt(row.earliestStoredPrice)} | Current stored: {fmt(row.currentStoredPrice)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <ProductStatusBadge tone={row.status === 'MOVEMENT_AVAILABLE' ? 'green' : 'yellow'}>{labelize(row.status)}</ProductStatusBadge>
                  <ProductStatusBadge tone="blue">{labelize(row.movementConfidence)} Evidence</ProductStatusBadge>
                  <ProductStatusBadge tone={row.freshness === 'STALE' ? 'yellow' : 'green'}>{labelize(row.freshness)}</ProductStatusBadge>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <Metric label="Price Move" value={fmt(row.priceMovement)} detail="American-odds movement." />
                <Metric label="Line Move" value={fmt(row.lineMovement)} detail="Stored line movement." />
                <Metric label="Books" value={row.bookmakerCount} detail={row.bookmakers.join(', ')} />
                <Metric label="Dispersion" value={fmt(row.dispersion)} detail="Current stored price range." />
                <Metric label="Snapshots" value={row.snapshotCount} detail={`${productDateTime(row.earliestTimestamp)} to ${productDateTime(row.latestTimestamp)}`} />
              </div>
              <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-300">
                <p className="font-black text-white">{labelize(row.steamEvidence.classification)}</p>
                <p className="mt-1">{row.steamEvidence.label}</p>
                {row.blockers.length ? <p className="mt-2 text-amber-200">{row.blockers.join(' ')}</p> : null}
              </div>
            </article>
          )) : (
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-6 text-sm text-slate-300">
              No stored market movement evidence is available for the selected filters.
            </div>
          )}
        </section>
      </section>
    </DashboardShell>
  )
}
