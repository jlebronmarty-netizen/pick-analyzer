'use client'

import { useEffect, useState } from 'react'

type AdaptiveAdjustment = {
  adjusted?: {
    adaptiveScore?: number
  }
  strongestAdjustment?: {
    factor: string
    multiplier: number
  } | null
}

type PortfolioPick = {
  id: string
  team: string
  opponent: string
  sport_key: string
  odds: number
  confidence: number
  ev: number
  edge: number
  risk_grade?: string
  risk_label?: string
  recommended_stake?: number
  smart_score?: number
  adaptive_score?: number
  adaptive_adjustment?: AdaptiveAdjustment
}

type Portfolio = {
  name: string
  expectedRoi: number
  averageConfidence: number
  totalStake: number
  expectedProfit: number
  riskScore: number
  diversificationScore: number
  portfolioScore: number
  correlationScore?: number
  correlationRiskLevel?: 'LOW' | 'MEDIUM' | 'HIGH'
  warnings: string[]
  picks: PortfolioPick[]
}

type PortfolioResponse = {
  success: boolean
  bankroll: number
  portfolios: {
    conservative: Portfolio
    balanced: Portfolio
    aggressive: Portfolio
  }
  error?: string
}

function formatMoney(value: number) {
  return `$${Number(value ?? 0).toFixed(2)}`
}

function formatPercent(value: number) {
  return `${Number(value ?? 0).toFixed(2)}%`
}

function formatOdds(value: number) {
  return value > 0 ? `+${value}` : `${value}`
}

function factorLabel(value?: string) {
  if (!value) return 'No adjustment'
  if (value === 'confidenceMultiplier') return 'Confidence'
  if (value === 'evMultiplier') return 'EV'
  if (value === 'edgeMultiplier') return 'Edge'
  if (value === 'oddsMultiplier') return 'Odds Style'

  return value
}

function scoreClass(value?: number) {
  const score = Number(value ?? 0)

  if (score >= 80) return 'text-emerald-400'
  if (score >= 65) return 'text-amber-300'

  return 'text-white'
}

function PortfolioPickCard({
  pick,
  portfolioName,
}: {
  pick: PortfolioPick
  portfolioName: string
}) {
  const adaptiveScore =
    pick.adaptive_score ??
    pick.adaptive_adjustment?.adjusted?.adaptiveScore ??
    pick.smart_score ??
    0

  const smartScore = pick.smart_score ?? 0
  const strongestAdjustment = pick.adaptive_adjustment?.strongestAdjustment

  return (
    <div
      key={`${portfolioName}-${pick.id}`}
      className="rounded-lg border border-slate-800 bg-slate-950/70 p-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-white">{pick.team} ML</p>

            {pick.risk_grade && (
              <span className="rounded-full bg-slate-800 px-2 py-1 text-[10px] font-semibold text-slate-300">
                {pick.risk_grade} {pick.risk_label ?? ''}
              </span>
            )}
          </div>

          <p className="mt-1 text-xs text-slate-400">vs {pick.opponent}</p>
          <p className="mt-1 text-xs text-slate-500">{pick.sport_key}</p>
        </div>

        <div className="text-right">
          <p className="text-sm font-bold text-white">
            {formatOdds(pick.odds)}
          </p>
          <p className="text-xs text-slate-500">
            {formatMoney(pick.recommended_stake ?? 0)}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-slate-900/70 p-2">
          <p className="text-slate-500">Adaptive</p>
          <p className={`font-bold ${scoreClass(adaptiveScore)}`}>
            {Number(adaptiveScore).toFixed(2)}
          </p>
        </div>

        <div className="rounded-lg bg-slate-900/70 p-2">
          <p className="text-slate-500">Smart</p>
          <p className="font-semibold text-white">
            {Number(smartScore).toFixed(2)}
          </p>
        </div>

        <div className="rounded-lg bg-slate-900/70 p-2">
          <p className="text-slate-500">Conf.</p>
          <p className="font-semibold text-white">
            {formatPercent(pick.confidence)}
          </p>
        </div>

        <div className="rounded-lg bg-slate-900/70 p-2">
          <p className="text-slate-500">EV</p>
          <p className="font-semibold text-emerald-400">
            {formatPercent(pick.ev)}
          </p>
        </div>
      </div>

      {strongestAdjustment && Number(strongestAdjustment.multiplier) !== 1 && (
        <div className="mt-3 rounded-lg border border-purple-500/20 bg-purple-950/10 p-3">
          <p className="text-xs font-semibold text-purple-300">
            Adaptive Adjustment
          </p>
          <p className="mt-1 text-xs text-slate-300">
            {factorLabel(strongestAdjustment.factor)}:{' '}
            <span className="font-bold text-white">
              {Number(strongestAdjustment.multiplier).toFixed(2)}x
            </span>
          </p>
        </div>
      )}
    </div>
  )
}

function PortfolioCard({ portfolio }: { portfolio: Portfolio }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-white">{portfolio.name}</h3>
          <p className="text-xs text-slate-400">
            Score {portfolio.portfolioScore.toFixed(2)} · Risk{' '}
            {portfolio.riskScore.toFixed(2)}
          </p>
        </div>

        <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">
          {portfolio.correlationRiskLevel ?? 'LOW'}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg bg-slate-950/70 p-3">
          <p className="text-slate-500">Total Stake</p>
          <p className="font-bold text-white">
            {formatMoney(portfolio.totalStake)}
          </p>
        </div>

        <div className="rounded-lg bg-slate-950/70 p-3">
          <p className="text-slate-500">Expected Profit</p>
          <p className="font-bold text-emerald-400">
            {formatMoney(portfolio.expectedProfit)}
          </p>
        </div>

        <div className="rounded-lg bg-slate-950/70 p-3">
          <p className="text-slate-500">Expected ROI</p>
          <p className="font-bold text-emerald-400">
            {formatPercent(portfolio.expectedRoi)}
          </p>
        </div>

        <div className="rounded-lg bg-slate-950/70 p-3">
          <p className="text-slate-500">Diversification</p>
          <p className="font-bold text-white">
            {portfolio.diversificationScore.toFixed(2)}
          </p>
        </div>
      </div>

      {portfolio.warnings.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-950/20 p-3">
          <p className="text-xs font-semibold text-amber-300">Warnings</p>
          <ul className="mt-2 space-y-1 text-xs text-amber-100">
            {portfolio.warnings.slice(0, 3).map((warning) => (
              <li key={warning}>• {warning}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {portfolio.picks.map((pick) => (
          <PortfolioPickCard
            key={`${portfolio.name}-${pick.id}`}
            pick={pick}
            portfolioName={portfolio.name}
          />
        ))}
      </div>
    </div>
  )
}

export default function PortfolioElitePanel() {
  const [bankroll, setBankroll] = useState(2500)
  const [data, setData] = useState<PortfolioResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)

        const response = await fetch(`/api/portfolio?bankroll=${bankroll}`, {
          cache: 'no-store',
        })

        const json = await response.json()

        if (!response.ok || !json.success) {
          throw new Error(json.error ?? 'Failed to load portfolios')
        }

        setData(json)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [bankroll])

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        Loading elite portfolios...
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-900/60 bg-red-950/40 p-6 text-sm text-red-300">
        {error}
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">
            Elite Portfolio Builder
          </h2>
          <p className="text-sm text-slate-400">
            Conservative, balanced and aggressive betting portfolios with
            adaptive score visibility.
          </p>
        </div>

        <select
          value={bankroll}
          onChange={(event) => setBankroll(Number(event.target.value))}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
        >
          <option value={500}>$500 bankroll</option>
          <option value={1000}>$1,000 bankroll</option>
          <option value={2500}>$2,500 bankroll</option>
          <option value={5000}>$5,000 bankroll</option>
          <option value={10000}>$10,000 bankroll</option>
        </select>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <PortfolioCard portfolio={data.portfolios.conservative} />
        <PortfolioCard portfolio={data.portfolios.balanced} />
        <PortfolioCard portfolio={data.portfolios.aggressive} />
      </div>
    </div>
  )
}