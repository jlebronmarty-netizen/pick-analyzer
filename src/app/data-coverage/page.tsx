import DashboardSection from '@/components/dashboard/DashboardSection'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { ProductStatusBadge } from '@/components/product/ProductStatus'

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
  const [
    { getDataCoverageInventoryV1 },
    { getMultiSportProviderEntitlementAuditV1 },
    { getMultiSportDataExpansionCheckpoint2V1 },
    { getMultiSportDataExpansionCheckpoint3V1 },
    { getMultiSportDataExpansionFinalCertificationV1 },
    { getTheOddsApiCoverage },
  ] = await Promise.all([
    import('@/services/data-coverage-inventory.service'),
    import('@/services/multi-sport-provider-entitlement-audit.service'),
    import('@/services/multi-sport-data-expansion-checkpoint2.service'),
    import('@/services/multi-sport-data-expansion-checkpoint3.service'),
    import('@/services/multi-sport-data-expansion-final.service'),
    import('@/services/the-odds-api-maximum-utilization.service'),
  ])
  const [inventory, providerAudit, checkpoint2, checkpoint3, finalCertification, oddsApiCoverage] = await Promise.all([
    getDataCoverageInventoryV1(),
    getMultiSportProviderEntitlementAuditV1(),
    getMultiSportDataExpansionCheckpoint2V1(),
    getMultiSportDataExpansionCheckpoint3V1(),
    getMultiSportDataExpansionFinalCertificationV1(),
    getTheOddsApiCoverage({ dryRun: true }),
  ])

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

      <DashboardSection
        title="Provider Capability Audit"
        description="Capability, entitlement, credential availability and live-ingestion readiness are separated. This default audit uses static, prior and dry-run evidence only."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <Metric label="Providers" value={providerAudit.providers.length} />
          <Metric label="Matrix Rows" value={providerAudit.rows.length.toLocaleString()} />
          <Metric label="Live Provider Calls" value={providerAudit.providerCallsMade} />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {Object.entries(providerAudit.matrixSummary).map(([status, count]) => (
            <div key={status} className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{status}</p>
              <p className="mt-2 text-3xl font-black text-white">{count}</p>
            </div>
          ))}
        </div>
        <a href="/api/data-coverage/provider-audit" className="mt-4 inline-flex rounded-full border border-emerald-500/30 px-4 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-950/30">
          Open Provider Audit API
        </a>
      </DashboardSection>

      <DashboardSection
        title="The Odds API Advanced Coverage"
        description="Catalog, quota, capability and coverage endpoints are exposed for bounded provider certification. The page uses dry-run evidence and makes no live provider calls."
      >
        <div className="grid gap-4 md:grid-cols-4">
          <Metric label="Mapped Sports" value={oddsApiCoverage.catalogSummary.mappedSports} />
          <Metric label="Catalog Sports" value={oddsApiCoverage.catalogSummary.providerSportsFound} />
          <Metric label="Provider Calls" value={oddsApiCoverage.providerCallsMade} />
          <Metric label="Remote Mutations" value={oddsApiCoverage.remoteMutationsMade} />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          {[
            ['/api/providers/the-odds-api/catalog', 'Catalog'],
            ['/api/providers/the-odds-api/quota', 'Quota'],
            ['/api/providers/the-odds-api/capability', 'Capability'],
            ['/api/providers/the-odds-api/coverage', 'Coverage'],
            ['/api/providers/the-odds-api/current-odds', 'Current Odds'],
          ].map(([href, label]) => (
            <a key={href} href={href} className="inline-flex justify-center rounded-full border border-emerald-500/30 px-4 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-950/30">
              {label}
            </a>
          ))}
        </div>
      </DashboardSection>

      <DashboardSection
        title="Expansion Checkpoint 2"
        description="MLB, NBA and NFL expansion manifests are planned with entitlement gates. No imports or production mutations execute from this surface."
      >
        <div className="grid gap-4 md:grid-cols-4">
          <Metric label="Sports" value={checkpoint2.summary.sportsAudited} />
          <Metric label="Dry-run Ready" value={checkpoint2.summary.dryRunReadySports} />
          <Metric label="Partial Entitlement" value={checkpoint2.summary.partialEntitlementSports} />
          <Metric label="Imports Executed" value={checkpoint2.summary.importsExecuted} />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {checkpoint2.sports.map((sport) => (
            <div key={sport.key} className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h3 className="text-xl font-black text-white">{sport.label}</h3>
                <ProductStatusBadge tone={sport.executionReadiness === 'DRY_RUN_READY' ? 'green' : sport.executionReadiness === 'PARTIAL_ENTITLEMENT' ? 'yellow' : 'gray'}>
                  {sport.executionReadiness}
                </ProductStatusBadge>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-400">{sport.importPlan.checkpoints} dry-run checkpoints; {sport.importPlan.estimatedProviderCalls} estimated provider calls if a future execution gate is approved.</p>
            </div>
          ))}
        </div>
        <a href="/api/data-coverage/expansion-checkpoint2" className="mt-4 inline-flex rounded-full border border-emerald-500/30 px-4 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-950/30">
          Open Checkpoint 2 API
        </a>
      </DashboardSection>

      <DashboardSection
        title="Expansion Checkpoint 3"
        description="NHL, Soccer, BSN, Tennis and UFC remain scoped by their source model: cross-year season, competition-specific, custom league, tournament or event/bout."
      >
        <div className="grid gap-4 md:grid-cols-4">
          <Metric label="Sports" value={checkpoint3.summary.sportsAudited} />
          <Metric label="Event-driven" value={checkpoint3.summary.eventDrivenSports} />
          <Metric label="Competition-scoped" value={checkpoint3.summary.competitionScopedSports} />
          <Metric label="Imports Executed" value={checkpoint3.importsExecuted} />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-5">
          {checkpoint3.sports.map((sport) => (
            <div key={sport.key} className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
              <h3 className="text-lg font-black text-white">{sport.label}</h3>
              <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{sport.scopePolicy}</p>
              <p className="mt-3 text-sm leading-6 text-slate-400">{sport.historicalImportReadiness}</p>
            </div>
          ))}
        </div>
        <a href="/api/data-coverage/expansion-checkpoint3" className="mt-4 inline-flex rounded-full border border-emerald-500/30 px-4 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-950/30">
          Open Checkpoint 3 API
        </a>
      </DashboardSection>

      <DashboardSection
        title="Final Program Certification"
        description="The program records truthful partial completion where provider entitlement, source provenance or readiness gates block execution."
      >
        <div className="grid gap-4 md:grid-cols-4">
          <Metric label="Status" value={finalCertification.programStatus} />
          <Metric label="Active Prediction Sports" value={finalCertification.activePredictionSports.length} />
          <Metric label="Active Recommendation Sports" value={finalCertification.activeRecommendationSports.length} />
          <Metric label="Mutations" value={finalCertification.productionMutationsMade} />
        </div>
        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/70 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Postgame Explanation</p>
          <p className="mt-2 text-lg font-black text-white">{finalCertification.postgameExplanationEngine.status}</p>
          <p className="mt-3 text-sm leading-6 text-slate-400">Causal certainty is not claimed; no explanation rows were fabricated or persisted.</p>
        </div>
        <a href="/api/data-coverage/final-certification" className="mt-4 inline-flex rounded-full border border-emerald-500/30 px-4 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-950/30">
          Open Final Certification API
        </a>
      </DashboardSection>
    </DashboardShell>
  )
}
