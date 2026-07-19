'use client'

import { useDashboard } from '@/context/DashboardContext'

type AdaptiveAdjustment = {
  adjusted?: {
    adaptiveScore?: number
  }
  strongestAdjustment?: {
    factor: string
    multiplier: number
  } | null
}

type HeroPick = {
  id?: string
  team?: string
  opponent?: string
  sport_key?: string
  sportsbook?: string
  odds?: number
  formatted_odds?: string
  formattedOdds?: string
  model_probability?: number
  implied_probability?: number
  confidence?: number
  edge?: number
  ev?: number
  recommended_pick?: boolean | null
  risk_grade?: string
  risk_label?: string
  risk_stars?: number
  kelly_percent?: number
  recommended_stake?: number
  smart_score?: number
  adaptive_score?: number
  adaptive_adjustment?: AdaptiveAdjustment
  recommendation?: string
  reason?: string
  explanation?: {
    summary?: string
    valueRead?: string
    riskRead?: string
    stakeRead?: string
    action?: string
  }
}

function formatOdds(value?: number, fallback?: string) {
  if (fallback) return fallback
  const odds = Number(value ?? 0)
  if (!Number.isFinite(odds) || odds === 0) return 'N/A'
  return odds > 0 ? `+${odds}` : `${odds}`
}

function formatPercent(value?: number) {
  return `${Number(value ?? 0).toFixed(2)}%`
}

function formatMoney(value?: number) {
  return `$${Number(value ?? 0).toFixed(2)}`
}

function getToneClass(value?: number) {
  const number = Number(value ?? 0)
  if (number >= 15) return 'text-emerald-400'
  if (number >= 5) return 'text-amber-300'
  return 'text-slate-300'
}

function getRiskTone(grade?: string) {
  if (grade === 'A+' || grade === 'A') return 'bg-emerald-500/15 text-emerald-300'
  if (grade === 'B') return 'bg-blue-500/15 text-blue-300'
  if (grade === 'C') return 'bg-amber-500/15 text-amber-300'
  return 'bg-slate-700 text-slate-300'
}

function getModelStatusTone(status?: string) {
  if (status === 'WELL_CALIBRATED') return 'text-emerald-300'
  if (status === 'NEEDS_MONITORING') return 'text-amber-300'
  if (status === 'NEEDS_RECALIBRATION') return 'text-red-300'
  return 'text-slate-300'
}

function getPickFromDashboard(dashboard: any): HeroPick | null {
  return (
    dashboard?.playOfTheDay?.play ??
    dashboard?.dailyReport?.todayCard?.playOfTheDay ??
    dashboard?.dailyReport?.todayCard?.highestConfidence ??
    dashboard?.dailyReport?.todayCard?.highestEv ??
    dashboard?.topPicks?.bestBets?.[0] ??
    dashboard?.topPicks?.topConfidence?.[0] ??
    dashboard?.topPicks?.topEv?.[0] ??
    null
  )
}

function getAiRead(dashboard: any, pick: HeroPick | null) {
  return (
    dashboard?.advisor?.outlook ??
    dashboard?.dailyReport?.aiSummary ??
    dashboard?.dailyReport?.summaryText ??
    dashboard?.dailyReport?.message ??
    dashboard?.aiCopilot?.bestAdvice?.summary ??
    dashboard?.aiCopilot?.bestAdvice?.professionalRead ??
    pick?.explanation?.summary ??
    pick?.reason ??
    'The model found a qualified betting opportunity. Confirm the line is still available before placing the bet.'
  )
}

function getActionRead(dashboard: any, pick: HeroPick | null) {
  const action =
    dashboard?.aiCopilot?.bestAdvice?.betNowOrWait ??
    pick?.explanation?.action ??
    pick?.recommendation

  if (action) return action

  const confidence = Number(pick?.confidence ?? 0)
  const ev = Number(pick?.ev ?? 0)
  const edge = Number(pick?.edge ?? 0)
  const adaptiveScore = Number(pick?.adaptive_score ?? pick?.smart_score ?? 0)

  if (adaptiveScore >= 80 && confidence >= 75 && ev >= 10 && edge >= 8) {
    return 'Playable now if the same line is still available.'
  }

  if (adaptiveScore >= 65 && confidence >= 70 && ev >= 5) {
    return 'Playable with reduced stake. Monitor line movement.'
  }

  return 'Track price movement. Do not force action if the price moves against the model.'
}

function HeroMetric({
  label,
  value,
  tone = 'neutral',
  sub,
}: {
  label: string
  value: string
  tone?: 'positive' | 'negative' | 'warning' | 'neutral'
  sub?: string
}) {
  const toneClass =
    tone === 'positive'
      ? 'text-emerald-400'
      : tone === 'negative'
        ? 'text-red-400'
        : tone === 'warning'
          ? 'text-amber-300'
          : 'text-white'

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-black ${toneClass}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

function EmptyHero() {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">
        Today&apos;s Best Bet
      </p>
      <h2 className="mt-3 text-3xl font-black text-white">
        No qualified play yet
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
        The model does not currently have a premium betting opportunity. This is
        a good thing: the system should only surface plays when the edge,
        confidence, EV and risk profile align.
      </p>
    </div>
  )
}

function LoadingHero() {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="h-4 w-52 animate-pulse rounded bg-slate-800" />
      <div className="mt-5 h-10 w-96 max-w-full animate-pulse rounded bg-slate-800" />
      <div className="mt-4 h-4 w-72 animate-pulse rounded bg-slate-800" />
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-2xl bg-slate-950/70"
          />
        ))}
      </div>
    </div>
  )
}

function getRiskStars(stars?: number) {
  const count = Math.max(0, Math.min(Number(stars ?? 0), 5))
  if (!count) return '☆☆☆☆☆'
  return `${'★'.repeat(count)}${'☆'.repeat(5 - count)}`
}

function factorLabel(value?: string) {
  if (!value) return 'No adjustment'
  if (value === 'confidenceMultiplier') return 'Confidence'
  if (value === 'evMultiplier') return 'EV'
  if (value === 'edgeMultiplier') return 'Edge'
  if (value === 'oddsMultiplier') return 'Odds Style'
  return value
}

function getPrimaryWarnings({
  dashboard,
  pick,
}: {
  dashboard: any
  pick: HeroPick
}) {
  const warnings: string[] = []

  const modelStatus =
    dashboard?.calibration?.overall?.modelStatus ??
    dashboard?.kpis?.modelStatus

  const exposure =
    dashboard?.dailyReport?.bankroll?.exposurePercent ??
    dashboard?.dailyReport?.summary?.bankrollExposurePercent ??
    0

  if (modelStatus === 'NEEDS_RECALIBRATION') {
    warnings.push('Model calibration needs more settled data before increasing stake sizes.')
  }

  if (Number(exposure) >= 6) {
    warnings.push('Daily bankroll exposure is near the limit.')
  }

  if (Number(pick.ev ?? 0) >= 50) {
    warnings.push('EV is extremely high. Verify the odds are still available.')
  }

  if (Number(pick.odds ?? 0) > 250) {
    warnings.push('Plus-money price increases variance. Keep stake disciplined.')
  }

  if (!warnings.length) {
    warnings.push('Normal betting variance remains the main risk.')
  }

  return warnings
}

export default function DashboardHeroPanel() {
  const { dashboard, loading, error } = useDashboard()

  if (loading) return <LoadingHero />

  if (error) {
    return (
      <div className="rounded-3xl border border-red-900/60 bg-red-950/40 p-6 text-sm text-red-300">
        Hero dashboard failed: {error}
      </div>
    )
  }

  const pick = getPickFromDashboard(dashboard)

  if (!pick) return <EmptyHero />

  const aiRead = getAiRead(dashboard, pick)
  const actionRead = getActionRead(dashboard, pick)
  const warnings = getPrimaryWarnings({ dashboard, pick })

  const modelStatus =
    dashboard?.calibration?.overall?.modelStatus ??
    dashboard?.kpis?.modelStatus ??
    'LEARNING'

  const confidence = Number(pick.confidence ?? 0)
  const edge = Number(pick.edge ?? 0)
  const ev = Number(pick.ev ?? 0)
  const smartScore = Number(pick.smart_score ?? 0)
  const adaptiveScore = Number(
    pick.adaptive_score ??
      pick.adaptive_adjustment?.adjusted?.adaptiveScore ??
      smartScore
  )
  const stake = Number(pick.recommended_stake ?? 0)
  const strongestAdjustment = pick.adaptive_adjustment?.strongestAdjustment

  return (
    <div className="overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950/20 shadow-2xl shadow-emerald-950/20">
      <div className="grid grid-cols-1 gap-0 xl:grid-cols-12">
        <div className="xl:col-span-8 p-6">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">
              Today&apos;s Best Bet
            </p>

            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${getRiskTone(
                pick.risk_grade
              )}`}
            >
              {pick.risk_grade ?? 'N/A'} {pick.risk_label ?? 'Risk'}
            </span>

            <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs font-semibold text-slate-300">
              {getRiskStars(pick.risk_stars)}
            </span>

            <span className="rounded-full border border-purple-500/30 bg-purple-950/30 px-3 py-1 text-xs font-semibold text-purple-300">
              Adaptive Engine
            </span>
          </div>

          <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-4xl font-black tracking-tight text-white md:text-5xl">
                {pick.team ?? 'Unknown Team'} ML
              </h2>

              <p className="mt-3 text-sm text-slate-400">
                vs {pick.opponent ?? 'Unknown Opponent'} ·{' '}
                {pick.sport_key ?? 'sport'} ·{' '}
                {pick.sportsbook ?? 'Best available book'}
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-4 text-left lg:text-right">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
                Best Line
              </p>
              <p className="mt-1 text-4xl font-black text-white">
                {formatOdds(
                  pick.odds,
                  pick.formatted_odds ?? pick.formattedOdds
                )}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Stake {formatMoney(stake)}
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <HeroMetric
              label="Adaptive Score"
              value={adaptiveScore.toFixed(2)}
              tone={
                adaptiveScore >= 80
                  ? 'positive'
                  : adaptiveScore >= 65
                    ? 'warning'
                    : 'neutral'
              }
              sub="Historical-adjusted score"
            />

            <HeroMetric
              label="Smart Score"
              value={smartScore.toFixed(2)}
              tone={
                smartScore >= 80
                  ? 'positive'
                  : smartScore >= 65
                    ? 'warning'
                    : 'neutral'
              }
              sub="Original composite grade"
            />

            <HeroMetric
              label="Edge"
              value={formatPercent(edge)}
              tone={edge >= 8 ? 'positive' : edge >= 4 ? 'warning' : 'neutral'}
              sub="Model vs market"
            />

            <HeroMetric
              label="EV"
              value={formatPercent(ev)}
              tone={ev >= 10 ? 'positive' : ev >= 5 ? 'warning' : 'neutral'}
              sub="Expected value"
            />
          </div>

          {strongestAdjustment && Number(strongestAdjustment.multiplier) !== 1 && (
            <div className="mt-6 rounded-2xl border border-purple-500/20 bg-purple-950/10 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-purple-300">
                Adaptive Adjustment
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                The strongest adjustment is{' '}
                <span className="font-bold text-white">
                  {factorLabel(strongestAdjustment.factor)}
                </span>{' '}
                with a{' '}
                <span className="font-bold text-purple-300">
                  {Number(strongestAdjustment.multiplier).toFixed(2)}x
                </span>{' '}
                multiplier based on historical model performance.
              </p>
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-300">
              AI Read
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-300">{aiRead}</p>
          </div>
        </div>

        <div className="border-t border-slate-800 bg-slate-950/50 p-6 xl:col-span-4 xl:border-l xl:border-t-0">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
            Action Plan
          </p>

          <h3 className="mt-3 text-2xl font-black text-white">{actionRead}</h3>

          <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs text-slate-500">Model Health</p>
            <p className={`mt-1 text-lg font-black ${getModelStatusTone(modelStatus)}`}>
              {modelStatus}
            </p>
          </div>

          <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-950/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">
              Risk Notes
            </p>

            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              {warnings.map((warning) => (
                <li key={warning}>⚠ {warning}</li>
              ))}
            </ul>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <p className="text-slate-500">Kelly</p>
              <p className={getToneClass(pick.kelly_percent)}>
                {formatPercent(pick.kelly_percent)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <p className="text-slate-500">Confidence</p>
              <p className="font-bold text-white">
                {formatPercent(confidence)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <p className="text-slate-500">Implied</p>
              <p className="font-bold text-white">
                {formatPercent(pick.implied_probability)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <p className="text-slate-500">Model</p>
              <p className="font-bold text-white">
                {formatPercent(pick.model_probability)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <p className="text-slate-500">Recommended</p>
              <p
                className={
                  pick.recommended_pick
                    ? 'font-bold text-emerald-400'
                    : 'font-bold text-red-400'
                }
              >
                {pick.recommended_pick ? 'YES' : 'NO'}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <p className="text-slate-500">Adaptive</p>
              <p className="font-bold text-purple-300">
                {adaptiveScore.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}