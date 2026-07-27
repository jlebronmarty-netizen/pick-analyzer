import DashboardSection from '@/components/dashboard/DashboardSection'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { ProductStatusBadge, ProductStatusBanner, productDateTime, sportReadinessLabel } from '@/components/product/ProductStatus'
import { getAiLearningLifecycle } from '@/services/ai-learning-lifecycle.service'
import { getCurrentBoard } from '@/services/current-board.service'
import { getPerformanceProductContract } from '@/services/performance-product-contract.service'
import { getProbabilityParlays, getProbabilityPicks } from '@/services/probability-picks.service'
import type { ProbabilityPick } from '@/types/probability-picks'

function statusTone(status: string) {
  if (status === 'Healthy' || status === 'Completed') return 'border-emerald-500/30 bg-emerald-950/20 text-emerald-200'
  if (status === 'Running') return 'border-sky-500/30 bg-sky-950/20 text-sky-200'
  if (status === 'Blocked' || status === 'Error') return 'border-rose-500/30 bg-rose-950/20 text-rose-200'
  return 'border-amber-500/30 bg-amber-950/20 text-amber-200'
}

function Metric({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-800 bg-slate-950 p-4">
      <p className="break-words text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 sm:tracking-[0.18em]">{label}</p>
      <p className="mt-2 break-words text-2xl font-black text-white">{value === null || value === undefined || value === '' ? 'N/A' : String(value)}</p>
    </div>
  )
}

function pct(value: number | null | undefined) {
  return value === null || value === undefined || !Number.isFinite(Number(value)) ? 'N/A' : `${Number(value).toFixed(Number(value) >= 10 ? 1 : 2)}%`
}

function plainSport(value: string) {
  const key = String(value ?? '').toLowerCase()
  if (key === 'baseball_mlb') return 'MLB'
  if (key === 'basketball_bsn') return 'BSN'
  if (key.includes('nfl')) return 'NFL'
  if (key.includes('nba')) return 'NBA'
  if (key.includes('nhl')) return 'NHL'
  if (key.includes('soccer')) return 'Soccer'
  if (key.includes('tennis')) return 'Tennis'
  if (key.includes('ufc')) return 'UFC'
  return value.replaceAll('_', ' ')
}

function friendlyStatus(value: string | null | undefined) {
  return String(value ?? 'Not available').replaceAll('_', ' ').replaceAll('-', ' ')
}

function previewReadiness(value: string | null | undefined) {
  const text = String(value ?? '').toLowerCase()
  if (text.includes('ready')) return 'Ready for preview review'
  if (text.includes('blocked') || text.includes('insufficient')) return 'Insufficient evidence'
  return friendlyStatus(value)
}

function topPick(picks: ProbabilityPick[], by: 'probability' | 'confidence' | 'quality' | 'stable' | 'score') {
  const sorted = [...picks].sort((left, right) => {
    if (by === 'probability') return right.modelProbability - left.modelProbability
    if (by === 'confidence') return right.confidence - left.confidence
    if (by === 'quality') return right.quality - left.quality
    if (by === 'stable') return (right.confidence + right.quality + right.freshness) - (left.confidence + left.quality + left.freshness)
    return right.score - left.score
  })
  return sorted[0] ?? null
}

function decisionStatus({
  qualifiedPicks,
  warnings,
  dataFreshness,
}: {
  qualifiedPicks: number
  warnings: string[]
  dataFreshness: string | null | undefined
}) {
  const freshness = String(dataFreshness ?? '').toLowerCase()
  if (!qualifiedPicks) return { label: 'Skip Today', tone: 'gray' as const, summary: 'There are no qualified projection-only opportunities today.' }
  if (freshness === 'stale') return { label: 'Wait', tone: 'yellow' as const, summary: 'Qualified projections exist, but current market freshness is stale.' }
  if (warnings.length) return { label: 'Review Manually', tone: 'yellow' as const, summary: 'Qualified projections exist with warnings that should be reviewed first.' }
  return { label: 'Review Manually', tone: 'blue' as const, summary: 'Qualified projection-only opportunities are available for review.' }
}

function SummaryCard({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <article className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
      {detail ? <p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p> : null}
    </article>
  )
}

function PickSummaryCard({ title, pick }: { title: string; pick: ProbabilityPick | null }) {
  return (
    <article className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-xs font-bold uppercase text-slate-500">{title}</p>
      {pick ? (
        <>
          <h3 className="mt-2 text-base font-black text-white">{pick.selection}</h3>
          <p className="mt-2 text-sm text-slate-300">{plainSport(pick.sport)} / {friendlyStatus(pick.marketType)}</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <span className="rounded-md border border-slate-800 bg-slate-900 p-2 text-slate-300">Probability <strong className="block text-white">{pct(pick.modelProbability)}</strong></span>
            <span className="rounded-md border border-slate-800 bg-slate-900 p-2 text-slate-300">Confidence <strong className="block text-white">{Math.round(pick.confidence)}</strong></span>
            <span className="rounded-md border border-slate-800 bg-slate-900 p-2 text-slate-300">Quality <strong className="block text-white">{Math.round(pick.quality)}</strong></span>
          </div>
          <p className="mt-3 text-xs font-bold uppercase text-sky-200">Projection Only / No Recommendation</p>
        </>
      ) : (
        <p className="mt-2 text-sm leading-6 text-slate-400">No qualified projection-only row is available for this category today.</p>
      )}
    </article>
  )
}

function LinkCard({ href, title, detail }: { href: string; title: string; detail: string }) {
  return (
    <a href={href} className="rounded-lg border border-slate-800 bg-slate-950/70 p-4 outline-none transition hover:border-sky-400/40 hover:bg-slate-900 focus-visible:ring-2 focus-visible:ring-sky-300">
      <p className="font-black text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p>
    </a>
  )
}

function PanelCard({ panel }: { panel: any }) {
  return (
    <article className="min-w-0 rounded-lg border border-slate-800 bg-slate-900/70 p-4 sm:p-5">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-base font-black text-white">{panel.label}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">{panel.summary}</p>
        </div>
        <span className={`max-w-full break-words rounded-full border px-3 py-1 text-xs font-bold sm:shrink-0 ${statusTone(panel.status)}`}>
          {panel.status}
        </span>
      </div>
      <dl className="mt-5 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        {Object.entries(panel.metrics ?? {}).slice(0, 6).map(([key, value]) => (
          <div key={key} className="min-w-0 rounded-lg bg-slate-950/70 p-3">
            <dt className="break-words text-xs uppercase tracking-[0.16em] text-slate-500">{key.replace(/([A-Z])/g, ' $1')}</dt>
            <dd className="mt-1 font-bold text-slate-100">{value === null || value === undefined || value === '' ? 'N/A' : String(value)}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 space-y-1 text-xs text-slate-500">
        <p>Last Updated: {productDateTime(panel.lastUpdated, 'No stored update time')}</p>
        <p>Next Scheduled: {panel.nextRun || 'Waiting for next scheduler execution'}</p>
        {panel.blocker ? <p className="text-amber-300">Reason: {panel.blocker}</p> : null}
      </div>
    </article>
  )
}

export const dynamic = 'force-dynamic'

function timeoutAfter(ms: number) {
  return new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('AI Operations evidence load timed out')), ms)
  })
}

function optionalWithin<T>(promise: Promise<T>, ms: number) {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]).catch(() => null)
}

export default async function AiOperationsPage() {
  let data: Awaited<ReturnType<typeof getAiLearningLifecycle>>
  let probabilityData: Awaited<ReturnType<typeof getProbabilityPicks>> | null = null
  let parlayData: Awaited<ReturnType<typeof getProbabilityParlays>> | null = null
  let performanceData: Awaited<ReturnType<typeof getPerformanceProductContract>> | null = null
  let boardData: Awaited<ReturnType<typeof getCurrentBoard>> | null = null
  try {
    const lifecyclePromise = getAiLearningLifecycle()
    const [lifecycle, probability, parlays, performance, board] = await Promise.all([
      Promise.race([lifecyclePromise, timeoutAfter(18_000)]),
      optionalWithin(getProbabilityPicks({ limit: 120 }), 8_000),
      optionalWithin(getProbabilityParlays({ mode: 'BALANCED', scope: 'MLB_ONLY', limit: 20 }), 8_000),
      optionalWithin(getPerformanceProductContract(), 8_000),
      optionalWithin(getCurrentBoard({ limit: 80, includeMlbContext: false }), 8_000),
    ])
    data = lifecycle
    probabilityData = probability
    parlayData = parlays
    performanceData = performance
    boardData = board
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI Operations evidence is temporarily unavailable.'
    return (
      <DashboardShell>
        <DashboardSection
          id="ai-operations"
          eyebrow="AI Operations"
          title="Autonomous Daily Lifecycle"
          description="Persisted evidence for schedule, odds, predictions, settlement, replay, learning, calibration and scheduler health."
        >
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-5 text-amber-100">
            <p className="text-xs font-black uppercase tracking-[0.18em]">Evidence Loading</p>
            <h2 className="mt-2 text-2xl font-black text-white">AI Operations is temporarily unavailable.</h2>
            <p className="mt-2 text-sm leading-6">Why: {message}. Missing: a timely stored lifecycle evidence response. What could change: the next bounded load can show scheduler, settlement, learning and replay evidence without changing model behavior.</p>
            <a href="/dashboard" className="mt-4 inline-flex rounded-lg border border-amber-300/40 px-4 py-2 text-sm font-black text-amber-50 outline-none hover:bg-amber-500/10 focus-visible:ring-2 focus-visible:ring-amber-200">Back to Dashboard</a>
          </div>
        </DashboardSection>
      </DashboardShell>
    )
  }
  const pregameSchedulerCoverage = data.pregameSchedulerCoverage as { schedulerTiming?: any[] } | undefined
  const probabilityPicks = probabilityData?.picks ?? []
  const warnings = [
    ...(data.warnings ?? []),
    ...(probabilityData?.warnings ?? []),
    ...(parlayData?.warnings ?? []),
    ...(boardData?.boardHealth.warnings ?? []),
  ].filter(Boolean).slice(0, 6)
  const certifiedSports = probabilityData?.summary.sportEligibility.eligibleSports ?? []
  const notReadySports = Object.entries(probabilityData?.summary.sportEligibility.details ?? {})
    .filter(([, detail]) => !detail.eligibleForRanking)
    .map(([sport, detail]) => ({ sport, detail }))
  const strongestSport = certifiedSports
    .map((sport) => ({ sport, count: probabilityPicks.filter((pick) => pick.sport === sport).length }))
    .sort((left, right) => right.count - left.count)[0] ?? null
  const decision = decisionStatus({
    qualifiedPicks: probabilityData?.summary.picksGenerated ?? 0,
    warnings,
    dataFreshness: boardData?.dataFreshness.status,
  })
  const summaryText = probabilityData?.summary.picksGenerated
    ? `${probabilityData.summary.picksGenerated} qualified ${certifiedSports.map(plainSport).join(', ') || 'certified sport'} projection-only opportunities are available today. ${decision.summary}`
    : 'There are no qualified opportunities today. The available games do not satisfy today\'s quality requirements or certified sport readiness.'
  const modelTrust = performanceData?.trustScore.trustLabel ?? 'INSUFFICIENT DATA'
  const readiness = performanceData?.maturityPipeline?.DATA?.status ?? performanceData?.apiStatus ?? 'Not available'
  const dataFreshness = boardData?.dataFreshness.status ?? (data.lifecycle.today.oddsSnapshots ? 'stored' : 'waiting')
  const topProbability = topPick(probabilityPicks, 'probability')
  const topConfidence = topPick(probabilityPicks, 'confidence')
  const topQuality = topPick(probabilityPicks, 'quality')
  const mostStable = topPick(probabilityPicks, 'stable')
  const projectionOnly = topPick(probabilityPicks, 'score')

  return (
    <DashboardShell>
      <DashboardSection
        id="ai-briefing-v2"
        eyebrow="AI Briefing"
        title="Today's Decision Briefing"
        description="One plain-language summary of today's certified sports, projection-only opportunities, data health and model trust."
      >
        <div className="grid gap-5 xl:grid-cols-[1.4fr_0.6fr]">
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <ProductStatusBadge tone={decision.tone}>{decision.label}</ProductStatusBadge>
              <ProductStatusBadge tone="blue">Projection Only</ProductStatusBadge>
              <ProductStatusBadge tone="gray">No Recommendation</ProductStatusBadge>
            </div>
            <h2 className="mt-4 text-3xl font-black text-white">Is today worth betting?</h2>
            <p className="mt-3 max-w-4xl text-base leading-7 text-slate-300">{summaryText}</p>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              This briefing summarizes existing product evidence only. Probability, confidence and quality are model signals; they are not betting instructions.
            </p>
          </div>
          <div className="grid gap-3">
            <SummaryCard label="Certified Sports" value={certifiedSports.length ? certifiedSports.map(plainSport).join(', ') : 'None'} detail="Only certified sports appear in ranked projection summaries." />
            <SummaryCard label="Strongest Sport" value={strongestSport ? plainSport(strongestSport.sport) : 'N/A'} detail={strongestSport ? `${strongestSport.count} qualified projection-only rows.` : 'No certified sport has qualified rows today.'} />
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Qualified Picks" value={probabilityData?.summary.picksGenerated ?? 0} detail="Projection-only rows passing today's filters." />
          <SummaryCard label="Parlays" value={parlayData?.summary.parlaysGenerated ?? 0} detail="Informational combinations only." />
          <SummaryCard label="Current Predictions" value={data.lifecycle.today.predictionsGenerated} detail={`${boardData?.candidates.length ?? 0} current-board rows available.`} />
          <SummaryCard label="Settled Yesterday" value={data.lifecycle.yesterday.productionSettled} detail={`${data.lifecycle.yesterday.wins} wins / ${data.lifecycle.yesterday.losses} losses / ${data.lifecycle.yesterday.pushes} pushes.`} />
          <SummaryCard label="Data Freshness" value={friendlyStatus(dataFreshness)} detail={`Last market update: ${productDateTime(boardData?.latestOddsTimestamp ?? data.refreshTimeline.odds.lastSuccessfulRefresh, 'No stored market update')}`} />
          <SummaryCard label="Model Trust" value={friendlyStatus(modelTrust)} detail={`${performanceData?.trustScore.trustConfidence ?? 0} settled evidence rows in current trust scope.`} />
          <SummaryCard label="Readiness" value={friendlyStatus(readiness)} detail="Readiness is based on stored product evidence, not a new model run." />
          <SummaryCard label="Last Updated" value={productDateTime(probabilityData?.generatedAt ?? data.generatedAt)} detail="Displayed in your local timezone." />
        </div>
      </DashboardSection>

      <DashboardSection
        id="top-projection-picks"
        eyebrow="Top Picks"
        title="Highest Projection Signals"
        description="These are projection-only highlights. They do not create recommendations or change any policy gate."
      >
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-5">
          <PickSummaryCard title="Highest Probability" pick={topProbability} />
          <PickSummaryCard title="Highest Confidence" pick={topConfidence} />
          <PickSummaryCard title="Highest Quality" pick={topQuality} />
          <PickSummaryCard title="Most Stable" pick={mostStable} />
          <PickSummaryCard title="Projection Only" pick={projectionOnly} />
        </div>
      </DashboardSection>

      <DashboardSection
        id="briefing-warnings"
        eyebrow="Warnings"
        title="What Needs Attention"
        description="Warnings are shown when stored evidence is stale, incomplete, blocked or waiting for the next safe update."
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <ProductStatusBanner
            title={warnings.length ? 'Review Before Acting' : 'No Major Warnings'}
            detail={warnings.length ? warnings.map(friendlyStatus).join(' / ') : 'No major product warning is present in the current read-only briefing evidence.'}
            tone={warnings.length ? 'yellow' : 'green'}
          />
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-sm font-black text-white">Not Ready Today</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {notReadySports.length ? notReadySports.map(({ sport, detail }) => {
                const readiness = sportReadinessLabel(sport)
                return <ProductStatusBadge key={sport} tone={readiness.tone}>{plainSport(sport)} {friendlyStatus(detail.status)}</ProductStatusBadge>
              }) : <ProductStatusBadge tone="green">No uncertified rows in today&apos;s ranking set</ProductStatusBadge>}
            </div>
          </div>
        </div>
      </DashboardSection>

      <DashboardSection
        id="briefing-health"
        eyebrow="Data And Model Health"
        title="Can Today&apos;s Evidence Be Trusted?"
        description="A short health summary using existing product contracts."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <SummaryCard label="Data Health" value={friendlyStatus(dataFreshness)} detail={`${data.lifecycle.today.oddsSnapshots} stored market snapshots and ${data.lifecycle.today.gamesScheduled} scheduled MLB games today.`} />
          <SummaryCard label="Synchronization" value={friendlyStatus(data.schedulerHealth.schedulerOperational ? 'Healthy' : 'Waiting')} detail={`Last successful sync: ${productDateTime(data.schedulerHealth.lastSuccessfulAt, 'No stored successful sync')}`} />
          <SummaryCard label="Feature Readiness" value={previewReadiness(data.historicalFeatureBackfill.shadowReadiness)} detail={`${data.historicalFeatureBackfill.snapshotsPersisted} stored feature snapshots.`} />
          <SummaryCard label="Trust" value={friendlyStatus(modelTrust)} detail="Trust reflects settled production history, calibration and sample size." />
          <SummaryCard label="Calibration" value={performanceData?.trustScore.components.find((item) => item.key === 'calibration_quality')?.normalizedScore ?? 'N/A'} detail="Higher quality means model confidence is closer to settled outcomes." />
          <SummaryCard label="Prediction Generation" value="Current generation active" detail="New generation states remain inactive unless separately approved." />
        </div>
      </DashboardSection>

      <DashboardSection
        id="briefing-sports"
        eyebrow="Sport Summary"
        title="Certified And Not Ready Sports"
        description="Certified sports are separated from sports that need more data, certification or source readiness."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {certifiedSports.length ? certifiedSports.map((sport) => {
            const readiness = sportReadinessLabel(sport)
            return (
              <article key={sport} className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-black text-white">{plainSport(sport)}</h3>
                  <ProductStatusBadge tone={readiness.tone}>{readiness.label}</ProductStatusBadge>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <SummaryCard label="Qualified Picks" value={probabilityPicks.filter((pick) => pick.sport === sport).length} />
                  <SummaryCard label="Current Data" value={friendlyStatus(dataFreshness)} />
                  <SummaryCard label="Freshness" value={boardData?.dataFreshness.latestOddsAgeMinutes === null || boardData?.dataFreshness.latestOddsAgeMinutes === undefined ? 'N/A' : `${Math.round(boardData.dataFreshness.latestOddsAgeMinutes)} min`} />
                  <SummaryCard label="Confidence" value={Math.round(probabilityPicks.filter((pick) => pick.sport === sport).reduce((sum, pick) => sum + pick.confidence, 0) / Math.max(1, probabilityPicks.filter((pick) => pick.sport === sport).length))} />
                </div>
              </article>
            )
          }) : <p className="rounded-lg border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-400">No certified sport has qualified projection rows today.</p>}
          <article className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
            <h3 className="text-lg font-black text-white">Not Ready Today</h3>
            <div className="mt-4 space-y-3">
              {notReadySports.length ? notReadySports.map(({ sport, detail }) => (
                <p key={sport} className="text-sm leading-6 text-slate-300">
                  <strong className="text-white">{plainSport(sport)}:</strong> {friendlyStatus(detail.status)}. {detail.reason}
                </p>
              )) : <p className="text-sm text-slate-400">No uncertified sport rows were present in today&apos;s probability ranking input.</p>}
            </div>
          </article>
        </div>
      </DashboardSection>

      <DashboardSection
        id="briefing-links"
        eyebrow="Next Views"
        title="Where To Go Next"
        description="Open the detailed module only when the summary points you there."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <LinkCard href="/probability-picks" title="Probability Picks" detail="Review all projection-only ranked outcomes and parlays." />
          <LinkCard href="/dashboard#today" title="Current Board" detail="Inspect today&apos;s board context and product pipeline state." />
          <LinkCard href="/player-projections" title="Player Projections" detail="Review player stat projection ranges without market recommendations." />
          <LinkCard href="/performance" title="Performance" detail="Check trust, calibration, readiness and settled history." />
        </div>
      </DashboardSection>

      <DashboardSection
        id="ai-operations"
        eyebrow="AI Operations"
        title="Autonomous Daily Lifecycle"
        description="Persisted evidence for schedule, odds, predictions, settlement, replay, learning, calibration and scheduler health."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Provider Calls" value={data.providerCallsMade} />
          <Metric label="Today Predictions" value={data.lifecycle.today.predictionsGenerated} />
          <Metric label="Today Settled" value={data.lifecycle.today.productionSettled} />
          <Metric label="Learning Queued" value={data.learningQueue.queued} />
        </div>
      </DashboardSection>

      <DashboardSection
        id="daily-story"
        eyebrow="Daily AI Story"
        title="What The System Did"
        description="No learning is claimed unless persisted deterministic evidence exists."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {(['today', 'yesterday', 'last7Days'] as const).map((key) => (
            <article key={key} className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
              <h3 className="text-sm font-black uppercase tracking-[0.18em] text-emerald-200">{key}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-300">{data.dailyAiStory[key]}</p>
            </article>
          ))}
        </div>
      </DashboardSection>

      <DashboardSection
        id="operations-v2"
        eyebrow="AI Operations V2"
        title="Daily Evidence Stages"
        description="Daily settlement, label, preview learning and weight evidence with explicit zero reasons."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {Object.entries(data.aiOperationsCenterV2).map(([period, stage]: [string, any]) => (
            <article key={period} className="min-w-0 rounded-lg border border-slate-800 bg-slate-900/70 p-4 sm:p-5">
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-sm font-black uppercase tracking-[0.18em] text-emerald-200">{period}</h3>
                <span className={`max-w-full break-words rounded-full border px-3 py-1 text-xs font-bold ${statusTone(stage.acceptedLearningSamples > 0 ? 'Completed' : 'Waiting')}`}>
                  {previewReadiness(stage.shadowLearning)}
                </span>
              </div>
              <dl className="mt-5 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                {[
                  ['Games', stage.games],
                  ['Odds', stage.odds ?? 'N/A'],
                  ['Predictions', stage.predictions],
                  ['Settlements', stage.settlements],
                  ['Labels', stage.labels],
                  ['Accepted', stage.acceptedLearningSamples],
                  ['Rejected', stage.rejectedSamples],
                  ['Weights', stage.weightUpdates],
                ].map(([label, value]) => (
                  <div key={label} className="min-w-0 rounded-lg bg-slate-950/70 p-3">
                    <dt className="break-words text-xs uppercase tracking-[0.16em] text-slate-500">{label}</dt>
                    <dd className="mt-1 font-bold text-slate-100">{String(value)}</dd>
                  </div>
                ))}
              </dl>
              {stage.zeroReasons ? (
                <div className="mt-4 space-y-1 text-xs text-amber-200">
                  {Object.entries(stage.zeroReasons).filter(([, value]) => Boolean(value)).map(([key, value]) => (
                    <p key={key}>{key}: {String(value)}</p>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </DashboardSection>

      <DashboardSection
        id="pregame-scheduler"
        eyebrow="Scheduler Coverage"
        title="Pregame Timing"
        description="Stored evidence for scheduler cadence, lead time, missed windows and retry safety."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Coverage Today" value={`${data.schedulerHealth.coverageTodayPct ?? 'N/A'}%`} />
          <Metric label="Average Lead" value={data.schedulerHealth.averageLeadTimeBeforeCutoffMinutes === null || data.schedulerHealth.averageLeadTimeBeforeCutoffMinutes === undefined ? 'N/A' : `${data.schedulerHealth.averageLeadTimeBeforeCutoffMinutes} min`} />
          <Metric label="Missed Windows" value={data.schedulerHealth.missedWindowsToday ?? 'N/A'} />
          <Metric label="Retry Count" value={data.schedulerHealth.retryCount ?? 'N/A'} />
        </div>
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full min-w-[760px] border-collapse bg-slate-900/70 text-left text-sm">
            <thead className="bg-slate-950 text-xs uppercase tracking-[0.16em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Scheduler</th>
                <th className="px-4 py-3">Frequency</th>
                <th className="px-4 py-3">Timezone</th>
                <th className="px-4 py-3">Next</th>
              </tr>
            </thead>
            <tbody>
              {(pregameSchedulerCoverage?.schedulerTiming ?? []).map((scheduler: any) => (
                <tr key={scheduler.scheduler} className="border-t border-slate-800">
                  <td className="px-4 py-3 text-slate-200">{scheduler.scheduler}</td>
                  <td className="px-4 py-3 text-slate-300">{scheduler.frequency}</td>
                  <td className="px-4 py-3 text-slate-400">{scheduler.timezone}</td>
                  <td className="px-4 py-3 font-bold text-emerald-200">{scheduler.nextExecution || 'Manual only'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DashboardSection>

      <DashboardSection
        id="local-backfill"
        eyebrow="Historical Features"
        title="Local Backfill Status"
        description="Read-only status for the operator-controlled Retrosheet feature backfill worker."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Snapshots Persisted" value={data.historicalFeatureBackfill.snapshotsPersisted} />
          <Metric label="Games Covered" value={data.historicalFeatureBackfill.gamesCovered} />
          <Metric label="Coverage" value={`${data.historicalFeatureBackfill.coveragePct}%`} />
          <Metric label="Feature Label Coverage" value={`${data.historicalFeatureBackfill.featureLabelCoveragePct ?? 0}%`} />
          <Metric label="Checkpoints" value={data.historicalFeatureBackfill.checkpointsRead} />
          <Metric label="Missing Feature Labels" value={data.historicalFeatureBackfill.missingFeatureRejections} />
          <Metric label="Idempotency" value={data.historicalFeatureBackfill.idempotencyStatus ?? 'N/A'} />
          <Metric label="Preview Readiness" value={previewReadiness(data.historicalFeatureBackfill.shadowReadiness)} />
        </div>
      </DashboardSection>

      <DashboardSection
        id="replay-pilot"
        eyebrow="Historical Replay"
        title="Replay Pilot"
        description="Controlled replay pilot evidence only."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Status" value={data.replayPilot?.status ?? 'not_started'} />
          <Metric label="Games Completed" value={data.replayPilot?.gamesCompleted ?? 0} />
          <Metric label="Replay Predictions" value={data.replayPilot?.replayPredictions ?? 0} />
          <Metric label="Replay Settlements" value={data.replayPilot?.replaySettlements ?? 0} />
          <Metric label="Replay Labels" value={data.replayPilot?.replayLabels ?? 0} />
          <Metric label="Replay Duration" value={data.replayPilot?.replayDurationMs === null || data.replayPilot?.replayDurationMs === undefined ? 'N/A' : `${data.replayPilot.replayDurationMs} ms`} />
          <Metric label="Snapshot Lookups" value={data.replayPilot?.snapshotLookups ?? 'N/A'} />
          <Metric label="Idempotency" value={data.replayPilot?.idempotencyStatus ?? 'N/A'} />
        </div>
      </DashboardSection>

      <DashboardSection
        id="full-historical-replay"
        eyebrow="Historical Replay Phase 2B"
        title="Full Replay"
        description="Replay-only Phase 2B progress from stored historical snapshots."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Status" value={data.replayFull?.status ?? 'not_started'} />
          <Metric label="Games Total" value={data.replayFull?.gamesTotal ?? 'N/A'} />
          <Metric label="Games Completed" value={data.replayFull?.gamesCompleted ?? 0} />
          <Metric label="Replay Predictions" value={data.replayFull?.replayPredictions ?? 0} />
          <Metric label="Replay Settlements" value={data.replayFull?.replaySettlements ?? 0} />
          <Metric label="Replay Labels" value={data.replayFull?.replayLabels ?? 0} />
          <Metric label="Checkpoint" value={data.replayFull?.checkpointStatus ?? 'N/A'} />
          <Metric label="Current Batch" value={data.replayFull?.currentBatch ?? 'N/A'} />
          <Metric label="Snapshot Lookups" value={data.replayFull?.snapshotLookups ?? 'N/A'} />
          <Metric label="Inserted" value={data.replayFull?.inserted ?? 0} />
          <Metric label="Reused" value={data.replayFull?.reused ?? 0} />
          <Metric label="Duplicate IDs" value={data.replayFull?.duplicateIds ?? 0} />
          <Metric label="Leakage Failures" value={data.replayFull?.leakageFailures ?? 0} />
          <Metric label="Provider Calls" value={data.replayFull?.providerCallsMade ?? 0} />
          <Metric label="Database Writes" value={data.replayFull?.databaseWrites ?? 0} />
          <Metric label="Avg Duration" value={data.replayFull?.averageReplayDurationMsPerGame === null || data.replayFull?.averageReplayDurationMsPerGame === undefined ? 'N/A' : `${data.replayFull.averageReplayDurationMsPerGame} ms/game`} />
        </div>
      </DashboardSection>

      <DashboardSection
        id="panels"
        eyebrow="Operations Center"
        title="Pipeline Health"
        description="Each panel is backed by stored database evidence and uses only read-only diagnostics."
      >
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {data.panels.map((panel: any) => (
            <PanelCard key={panel.key} panel={panel} />
          ))}
        </div>
      </DashboardSection>

      <DashboardSection
        id="transitions"
        eyebrow="Lifecycle Trace"
        title="Stage Transitions"
        description="The AI learning chain is shown as evidence, blocker and current state for every transition."
      >
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full min-w-[760px] border-collapse bg-slate-900/70 text-left text-sm">
            <thead className="bg-slate-950 text-xs uppercase tracking-[0.16em] text-slate-500">
              <tr>
                <th className="px-4 py-3">From</th>
                <th className="px-4 py-3">To</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Evidence</th>
                <th className="px-4 py-3">Reason</th>
              </tr>
            </thead>
            <tbody>
              {data.pipelineTransitions.map((transition: any) => (
                <tr key={`${transition.from}-${transition.to}`} className="border-t border-slate-800">
                  <td className="px-4 py-3 text-slate-200">{transition.from}</td>
                  <td className="px-4 py-3 text-slate-200">{transition.to}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusTone(transition.status)}`}>
                      {transition.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-bold text-white">{transition.evidence}</td>
                  <td className="px-4 py-3 text-slate-400">{transition.blocker || 'OK'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DashboardSection>

      <DashboardSection
        id="queues"
        eyebrow="Learning Evidence"
        title="Labels, Replay And Weights"
        description="The queue is derived from settled rows and is not a Learning Brain write."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <Metric label="Deterministic Labels" value={data.trainingLabels.totalDeterministicProductionLabels} />
          <Metric label="Replay Rows" value={data.historicalReplayValidation.projectionRows} />
          <Metric label="Weight Updates" value={data.weightUpdates.count} />
          <Metric label="Queued" value={data.learningQueue.queued} />
          <Metric label="Accepted" value={data.learningQueue.accepted} />
          <Metric label="Rejected" value={data.learningQueue.rejected} />
        </div>
      </DashboardSection>

      <DashboardSection
        id="refresh"
        eyebrow="Refresh Timeline"
        title="Last And Next Runs"
        description="Missing next-run evidence is explicitly labeled instead of invented."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Object.entries(data.refreshTimeline).map(([key, value]: [string, any]) => (
            <article key={key} className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
              <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-300">{key}</h3>
              <p className="mt-3 text-sm text-slate-500">Last successful refresh</p>
              <p className="mt-1 font-bold text-white">{value.lastSuccessfulRefresh || 'N/A'}</p>
              <p className="mt-4 text-sm text-slate-500">Next scheduled refresh</p>
              <p className="mt-1 font-bold text-emerald-200">{value.nextScheduledRefresh || 'Waiting for next scheduler execution'}</p>
            </article>
          ))}
        </div>
      </DashboardSection>
    </DashboardShell>
  )
}
