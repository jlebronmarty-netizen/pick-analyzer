'use client'

import {
  useEffect,
  useState,
} from 'react'
import { useSport } from '@/context/SportContext'
import type {
  PortfolioMode,
  PortfolioRisk,
} from '@/services/portfolio-ai-v2.service'

type PortfolioPick = {
  id?: string
  sport_key: string
  team: string
  opponent: string
  sportsbook?: string
  odds: number
  formattedOdds: string
  confidence: number
  edge: number
  ev: number
  aiScore: number
  riskScore: number
  suggestedStake: number
  expectedProfit: number
  potentialProfit: number
  potentialPayout: number
}

type MiniParlay = {
  available: boolean
  legs: number
  picks: PortfolioPick[]
  americanOdds: number
  probability: number
  expectedValue: number
  stake: number
  potentialPayout: number
  potentialProfit: number
  expectedProfit: number
  riskScore: number
  riskLevel: string
}

type PortfolioResponse = {
  success: boolean
  request: {
    bankroll: number
    targetProfit: number
    sportKey: string
    portfolioMode: PortfolioMode
    portfolioModeLabel: string
    risk: PortfolioRisk
    maxExposurePercent: number
    maxSelections: number
  }
  summary: {
    scannedPicks: number
    qualifiedPicks: number
    selectedPicks: number
    sportsRepresented: string[]
    totalStake: number
    exposurePercent: number
    expectedProfit: number
    projectedMaximumProfit: number
    remainingBankroll: number
    averageConfidence: number
    averageEv: number
    probabilityPositive: number
    targetCoverage: number
    portfolioScore: number
    portfolioRisk: number
    portfolioRiskLevel: string
    diversificationScore: number
    correlation: {
      score: number
      level: string
      sameSportPairs: number
      conflictPairs: number
      totalPairs: number
    }
    status: string
  }
  allocations: {
    singles: PortfolioPick[]
    miniParlay: MiniParlay
  }
  warnings: string[]
  conclusion: string
  error?: string
}

const modes: Array<{
  value: PortfolioMode
  label: string
}> = [
  {
    value: 'low_variance',
    label: 'Low Variance',
  },
  {
    value: 'income',
    label: 'Income',
  },
  {
    value: 'balanced',
    label: 'Balanced',
  },
  {
    value: 'growth',
    label: 'Growth',
  },
  {
    value: 'high_ev',
    label: 'High EV',
  },
  {
    value: 'singles_only',
    label: 'Singles Only',
  },
  {
    value: 'cross_sport',
    label: 'Cross-Sport',
  },
]

function money(value?: number) {
  return `$${Number(value ?? 0).toFixed(
    2
  )}`
}

function pct(value?: number) {
  return `${Number(value ?? 0).toFixed(
    2
  )}%`
}

function formatOdds(value?: number) {
  const odds = Number(value ?? 0)
  return odds > 0 ? `+${odds}` : `${odds}`
}

function statusClass(value: string) {
  if (value === 'TARGET_SUPPORTED') {
    return 'text-emerald-300'
  }

  if (value === 'TARGET_AGGRESSIVE') {
    return 'text-amber-300'
  }

  return 'text-red-300'
}

function riskClass(value: string) {
  if (value === 'LOW') {
    return 'text-emerald-300'
  }

  if (value === 'MEDIUM') {
    return 'text-amber-300'
  }

  return 'text-red-300'
}

export default function PortfolioAIV2Panel() {
  const { sportKey, sport } = useSport()

  const [bankroll, setBankroll] =
    useState(1000)

  const [targetProfit, setTargetProfit] =
    useState(100)

  const [mode, setMode] =
    useState<PortfolioMode>('balanced')

  const [risk, setRisk] =
    useState<PortfolioRisk>('medium')

  const [
    maxExposurePercent,
    setMaxExposurePercent,
  ] = useState(7)

  const [
    maxSelections,
    setMaxSelections,
  ] = useState(6)

  const [data, setData] =
    useState<PortfolioResponse | null>(null)

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(
          `/api/portfolio/ai-v2?bankroll=${bankroll}&targetProfit=${targetProfit}&sport=${encodeURIComponent(
            sportKey
          )}&mode=${mode}&risk=${risk}&maxExposure=${maxExposurePercent}&maxSelections=${maxSelections}`,
          {
            cache: 'no-store',
          }
        )

        const json = await response.json()

        if (!response.ok || !json.success) {
          throw new Error(
            json.error ??
              'Unable to build AI portfolio'
          )
        }

        setData(json)
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to build AI portfolio'
        )
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [
    bankroll,
    targetProfit,
    sportKey,
    mode,
    risk,
    maxExposurePercent,
    maxSelections,
  ])

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-lime-300">
            Portfolio AI V2
          </p>

          <h2 className="mt-2 text-3xl font-black text-white">
            Intelligent Allocation Engine
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Builds diversified allocations using
            Kelly sizing, exposure limits,
            correlation control and your target
            profit for {sport.icon}{' '}
            {sport.shortLabel}.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          <Field label="Bankroll">
            <input
              type="number"
              min={50}
              value={bankroll}
              onChange={(event) =>
                setBankroll(
                  Math.max(
                    50,
                    Number(event.target.value)
                  )
                )
              }
              className="input"
            />
          </Field>

          <Field label="Target profit">
            <input
              type="number"
              min={0}
              value={targetProfit}
              onChange={(event) =>
                setTargetProfit(
                  Math.max(
                    0,
                    Number(event.target.value)
                  )
                )
              }
              className="input"
            />
          </Field>

          <Field label="Portfolio">
            <select
              value={mode}
              onChange={(event) =>
                setMode(
                  event.target
                    .value as PortfolioMode
                )
              }
              className="input"
            >
              {modes.map((item) => (
                <option
                  key={item.value}
                  value={item.value}
                >
                  {item.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Risk">
            <select
              value={risk}
              onChange={(event) =>
                setRisk(
                  event.target
                    .value as PortfolioRisk
                )
              }
              className="input"
            >
              <option value="low">Low</option>
              <option value="medium">
                Medium
              </option>
              <option value="high">High</option>
            </select>
          </Field>

          <Field label="Max exposure">
            <select
              value={maxExposurePercent}
              onChange={(event) =>
                setMaxExposurePercent(
                  Number(event.target.value)
                )
              }
              className="input"
            >
              <option value={3}>3%</option>
              <option value={5}>5%</option>
              <option value={7}>7%</option>
              <option value={10}>10%</option>
              <option value={12}>12%</option>
              <option value={15}>15%</option>
            </select>
          </Field>

          <Field label="Selections">
            <select
              value={maxSelections}
              onChange={(event) =>
                setMaxSelections(
                  Number(event.target.value)
                )
              }
              className="input"
            >
              <option value={3}>3</option>
              <option value={4}>4</option>
              <option value={6}>6</option>
              <option value={8}>8</option>
              <option value={10}>10</option>
            </select>
          </Field>
        </div>
      </div>

      {loading && (
        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-6 text-sm text-slate-400">
          Building AI portfolio...
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-2xl border border-red-900/60 bg-red-950/30 p-6 text-sm text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
            <Stat
              label="Score"
              value={`${data.summary.portfolioScore}`}
            />
            <Stat
              label="Risk"
              value={data.summary.portfolioRiskLevel}
            />
            <Stat
              label="Selections"
              value={`${data.summary.selectedPicks}`}
            />
            <Stat
              label="Exposure"
              value={pct(
                data.summary.exposurePercent
              )}
            />
            <Stat
              label="Total Stake"
              value={money(
                data.summary.totalStake
              )}
            />
            <Stat
              label="Expected Profit"
              value={money(
                data.summary.expectedProfit
              )}
            />
            <Stat
              label="Positive Chance"
              value={pct(
                data.summary.probabilityPositive
              )}
            />
            <Stat
              label="Diversification"
              value={`${data.summary.diversificationScore}`}
            />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <Highlight
              title="Portfolio Status"
              value={data.summary.status.replaceAll(
                '_',
                ' '
              )}
              className={statusClass(
                data.summary.status
              )}
              details={[
                `Target coverage: ${pct(
                  data.summary.targetCoverage
                )}`,
                `Maximum profit: ${money(
                  data.summary
                    .projectedMaximumProfit
                )}`,
              ]}
            />

            <Highlight
              title="Correlation"
              value={data.summary.correlation.level}
              className={riskClass(
                data.summary.correlation.level
              )}
              details={[
                `Score: ${data.summary.correlation.score}/100`,
                `Same-sport pairs: ${data.summary.correlation.sameSportPairs}`,
              ]}
            />

            <Highlight
              title="Capital Protection"
              value={money(
                data.summary.remainingBankroll
              )}
              className="text-lime-300"
              details={[
                `Average confidence: ${pct(
                  data.summary
                    .averageConfidence
                )}`,
                `Average EV: ${pct(
                  data.summary.averageEv
                )}`,
              ]}
            />
          </div>

          <div className="mt-6 rounded-3xl border border-lime-500/20 bg-lime-950/10 p-5">
            <p className="font-bold text-lime-300">
              AI Conclusion
            </p>

            <p className="mt-3 text-sm leading-7 text-slate-300">
              {data.conclusion}
            </p>
          </div>

          {data.warnings.length > 0 && (
            <div className="mt-6 rounded-2xl border border-amber-500/25 bg-amber-950/15 p-5">
              <p className="font-bold text-amber-300">
                Portfolio Warnings
              </p>

              <ul className="mt-3 space-y-2 text-sm text-amber-100">
                {data.warnings.map((warning) => (
                  <li key={warning}>
                    • {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <div>
              <h3 className="mb-3 font-bold text-white">
                Single Allocations
              </h3>

              <div className="space-y-3">
                {data.allocations.singles
                  .length === 0 ? (
                  <EmptyCard text="No qualified singles are available for this portfolio." />
                ) : (
                  data.allocations.singles.map(
                    (pick) => (
                      <AllocationCard
                        key={`${pick.id}-${pick.team}-${pick.odds}`}
                        pick={pick}
                      />
                    )
                  )
                )}
              </div>
            </div>

            <div>
              <h3 className="mb-3 font-bold text-white">
                Mini Parlay Allocation
              </h3>

              {!data.allocations.miniParlay
                .available ? (
                <EmptyCard text="This portfolio does not include a mini parlay." />
              ) : (
                <ParlayCard
                  parlay={
                    data.allocations.miniParlay
                  }
                />
              )}
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        .input {
          margin-top: 0.25rem;
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid rgb(51 65 85);
          background: rgb(2 6 23);
          padding: 0.5rem 0.75rem;
          color: white;
          font-size: 0.875rem;
          outline: none;
        }
      `}</style>
    </section>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="text-xs text-slate-500">
      {label}
      {children}
    </label>
  )
}

function Stat({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-xs text-slate-500">
        {label}
      </p>

      <p className="mt-1 text-xl font-black text-white">
        {value}
      </p>
    </div>
  )
}

function Mini({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
      <p className="text-[11px] text-slate-500">
        {label}
      </p>

      <p className="mt-1 font-bold text-white">
        {value}
      </p>
    </div>
  )
}

function Highlight({
  title,
  value,
  details,
  className,
}: {
  title: string
  value: string
  details: string[]
  className: string
}) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
      <p className="text-sm font-bold text-slate-400">
        {title}
      </p>

      <p
        className={`mt-2 text-2xl font-black ${className}`}
      >
        {value}
      </p>

      <ul className="mt-3 space-y-1 text-xs text-slate-500">
        {details.map((detail) => (
          <li key={detail}>• {detail}</li>
        ))}
      </ul>
    </div>
  )
}

function AllocationCard({
  pick,
}: {
  pick: PortfolioPick
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-white">
            {pick.team} ML{' '}
            {pick.formattedOdds}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            vs {pick.opponent}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {pick.sportsbook ??
              'Sportsbook'}{' '}
            · {pick.sport_key}
          </p>
        </div>

        <div className="text-right">
          <p className="text-xl font-black text-lime-300">
            {money(pick.suggestedStake)}
          </p>

          <p className="text-xs text-slate-500">
            Stake
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Mini
          label="AI Score"
          value={`${pick.aiScore}`}
        />

        <Mini
          label="Expected"
          value={money(
            pick.expectedProfit
          )}
        />

        <Mini
          label="Max Profit"
          value={money(
            pick.potentialProfit
          )}
        />
      </div>
    </div>
  )
}

function ParlayCard({
  parlay,
}: {
  parlay: MiniParlay
}) {
  return (
    <div className="rounded-2xl border border-lime-500/20 bg-lime-950/10 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-lime-300">
            {parlay.legs}-Leg Mini Parlay
          </p>

          <p className="mt-1 text-2xl font-black text-white">
            {formatOdds(
              parlay.americanOdds
            )}
          </p>
        </div>

        <div className="text-right">
          <p
            className={`text-sm font-black ${riskClass(
              parlay.riskLevel
            )}`}
          >
            {parlay.riskLevel}
          </p>

          <p className="text-xs text-slate-500">
            Risk {parlay.riskScore}/100
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {parlay.picks.map((pick) => (
          <div
            key={`${pick.team}-${pick.opponent}-${pick.odds}`}
            className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3"
          >
            <div>
              <p className="text-sm font-bold text-white">
                {pick.team} ML
              </p>

              <p className="text-xs text-slate-500">
                vs {pick.opponent}
              </p>
            </div>

            <p className="font-bold text-white">
              {pick.formattedOdds}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Mini
          label="Probability"
          value={pct(parlay.probability)}
        />

        <Mini
          label="EV"
          value={pct(
            parlay.expectedValue
          )}
        />

        <Mini
          label="Stake"
          value={money(parlay.stake)}
        />

        <Mini
          label="Profit"
          value={money(
            parlay.potentialProfit
          )}
        />
      </div>
    </div>
  )
}

function EmptyCard({
  text,
}: {
  text: string
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 text-sm text-slate-400">
      {text}
    </div>
  )
}