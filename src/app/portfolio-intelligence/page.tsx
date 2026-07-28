import DashboardShell from '@/components/dashboard/DashboardShell'
import { ProductStatusBadge, ProductStatusBanner, productDateTime } from '@/components/product/ProductStatus'
import { getPortfolioIntelligence } from '@/services/portfolio-intelligence.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function pct(value: number) {
  return `${value.toFixed(value >= 10 ? 1 : 2)}%`
}

function labelize(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase())
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

export default async function PortfolioIntelligencePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const data = await getPortfolioIntelligence({
    sport: typeof params?.sport === 'string' ? params.sport : null,
    market: typeof params?.market === 'string' ? params.market : null,
    size: typeof params?.size === 'string' ? Number(params.size) : 2,
    dependency: typeof params?.dependency === 'string' ? params.dependency as never : 'all',
    limit: 20,
  })

  return (
    <DashboardShell>
      <section className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-300">Portfolio Intelligence</p>
            <h1 className="mt-2 text-3xl font-black text-white">Combination Intelligence</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Analytical only. This view groups existing projection opportunities and reports shared exposure, dependency warnings and naive joint probability without bankroll sizing, sportsbook execution or Official Pick promotion.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ProductStatusBadge tone="blue">Preview</ProductStatusBadge>
            <ProductStatusBadge tone="green">Read Only</ProductStatusBadge>
            <ProductStatusBadge tone="yellow">No Recommendation</ProductStatusBadge>
          </div>
        </div>

        <ProductStatusBanner
          tone="blue"
          title="Projection combinations only"
          detail="Naive joint probability assumes independence and may overstate or understate the true combined probability. Dependency labels are deterministic shared-exposure checks, not correlation coefficients."
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Source Opportunities" value={data.sourceOpportunityCount} detail="Existing Probability Picks rows considered." />
          <Metric label="Eligible Opportunities" value={data.eligibleOpportunityCount} detail="Rows with certified ranking and acceptable freshness." />
          <Metric label="Sports" value={data.availableSports.length || 'N/A'} detail={data.availableSports.map(labelize).join(', ') || 'No eligible sports available.'} />
          <Metric label="Freshness" value={labelize(data.freshness.status)} detail={`Generated ${productDateTime(data.generatedAt)}.`} />
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-4">
          <p className="text-xs font-black uppercase text-slate-500">Controls</p>
          <div className="mt-3 flex flex-wrap gap-2 text-sm font-bold">
            {[2, 3].map((size) => (
              <a key={size} href={`/portfolio-intelligence?size=${size}`} className={`rounded-lg border px-4 py-2 ${data.filters.size === size ? 'border-emerald-500 bg-emerald-500/10 text-emerald-100' : 'border-slate-700 bg-slate-950 text-slate-300'}`}>
                {size} legs
              </a>
            ))}
            {['all', 'lower_shared_exposure', 'cross_sport_only'].map((dependency) => (
              <a key={dependency} href={`/portfolio-intelligence?size=${data.filters.size}&dependency=${dependency}`} className={`rounded-lg border px-4 py-2 ${data.filters.dependency === dependency ? 'border-sky-500 bg-sky-500/10 text-sky-100' : 'border-slate-700 bg-slate-950 text-slate-300'}`}>
                {labelize(dependency)}
              </a>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Metric label="Strongest Evidence" value={data.strongestEvidenceCombination ? data.strongestEvidenceCombination.combinedEvidenceQuality : 'N/A'} detail={data.strongestEvidenceCombination?.diversification ?? 'No combination available.'} />
          <Metric label="Highest Naive Joint" value={data.highestNaiveJointProbability ? pct(data.highestNaiveJointProbability.naiveJointProbability) : 'N/A'} detail="Independence-based only." />
          <Metric label="Lowest Shared Exposure" value={data.lowestSharedExposure ? data.lowestSharedExposure.concentrationScore : 'N/A'} detail={data.lowestSharedExposure?.diversification ?? 'No low-exposure combination available.'} />
        </div>

        <section className="space-y-3">
          <h2 className="text-xl font-black text-white">Combinations</h2>
          {data.combinations.length ? data.combinations.map((combo) => (
            <article key={combo.id} className="rounded-lg border border-slate-800 bg-slate-900/80 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-black uppercase text-slate-500">{combo.legCount} Legs | {combo.diversification}</p>
                  <h3 className="mt-2 text-2xl font-black text-white">{pct(combo.naiveJointProbability)}</h3>
                  <p className="mt-1 text-sm text-slate-400">{combo.naiveJointProbabilityLabel}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {combo.relationshipClasses.map((relation) => <ProductStatusBadge key={relation} tone={relation.includes('SAME') || relation.includes('OPPOSING') ? 'yellow' : 'blue'}>{labelize(relation)}</ProductStatusBadge>)}
                </div>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                {combo.legs.map((leg) => (
                  <div key={leg.id} className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                    <p className="text-xs font-black uppercase text-slate-500">{labelize(leg.sport)} | {labelize(leg.market)}</p>
                    <p className="mt-1 font-black text-white">{leg.selection}</p>
                    <p className="mt-2 text-sm text-slate-300">Probability {pct(leg.modelProbability)} | Confidence {Math.round(leg.confidence)} | Quality {Math.round(leg.quality)}</p>
                    <p className="mt-1 text-xs font-bold uppercase text-sky-200">Projection Only / No Recommendation</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <div>
                  <p className="text-xs font-black uppercase text-slate-500">Dependency Warnings</p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-300">
                    {[...combo.dependencyWarnings, ...combo.uncertaintyFlags].slice(0, 5).map((warning) => <li key={warning}>{warning}</li>)}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-black uppercase text-slate-500">Weakest Leg</p>
                  <p className="mt-2 text-sm text-slate-300">{combo.weakestLeg.selection} by combined probability, confidence and quality.</p>
                </div>
              </div>
            </article>
          )) : (
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-6 text-sm text-slate-300">
              No eligible combinations are available for these filters. The system will not fabricate correlations or market evidence.
            </div>
          )}
        </section>
      </section>
    </DashboardShell>
  )
}
