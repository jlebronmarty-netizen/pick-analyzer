'use client'

import { useEffect, useState } from 'react'
import { useSport } from '@/context/SportContext'

type RiskPreference = 'low' | 'medium' | 'high'

type BrainPick = {
  id?: string
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
  stake?: number
  potentialPayout?: number
  potentialProfit?: number
  expectedProfit?: number
}

type BrainResponse = {
  success: boolean
  request: {
    bankroll: number
    targetProfit: number
    riskPreference: RiskPreference
    maxParlayLegs: number
    sportKey: string
  }
  analysis: {
    scannedPicks: number
    qualifiedPicks: number
    rejectedPicks: number
    status: string
    targetCoverage: number
    probabilityPositive: number
    totalExposure: number
    totalExposurePercent: number
    expectedProfit: number
    projectedMaximumProfit: number
    remainingBankroll: number
  }
  strategy: {
    singles: BrainPick[]
    parlay: {
      available: boolean
      legs: number
      picks: BrainPick[]
      americanOdds: number
      probability: number
      expectedValue: number
      stake: number
      potentialPayout: number
      potentialProfit: number
      expectedProfit: number
      ticketScore: number
      riskScore: number
      riskLevel: string
    }
  }
  warnings: string[]
  conclusion: string
  error?: string
}

function money(value?: number) {
  return `$${Number(value ?? 0).toFixed(2)}`
}

function pct(value?: number) {
  return `${Number(value ?? 0).toFixed(2)}%`
}

function odds(value?: number) {
  const number = Number(value ?? 0)
  return number > 0 ? `+${number}` : `${number}`
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

export default function AISportsBrainPanel() {
  const { sportKey, sport } = useSport()

  const [bankroll, setBankroll] = useState(1000)
  const [targetProfit, setTargetProfit] = useState(100)
  const [risk, setRisk] =
    useState<RiskPreference>('medium')
  const [maxLegs, setMaxLegs] = useState(3)

  const [data, setData] =
    useState<BrainResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] =
    useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(
          `/api/ai/sports-brain?bankroll=${bankroll}&targetProfit=${targetProfit}&risk=${risk}&maxLegs=${maxLegs}&sport=${encodeURIComponent(
            sportKey
          )}`,
          { cache: 'no-store' }
        )

        const json = await response.json()

        if (!response.ok || !json.success) {
          throw new Error(
            json.error ?? 'AI Sports Brain failed'
          )
        }

        setData(json)
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'AI Sports Brain failed'
        )
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [
    bankroll,
    targetProfit,
    risk,
    maxLegs,
    sportKey,
  ])

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-300">
            AI Sports Brain
          </p>

          <h2 className="mt-2 text-3xl font-black text-white">
            Strategy Builder
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Builds a controlled strategy for{' '}
            {sport.icon} {sport.shortLabel} using
            bankroll, target profit, risk tolerance
            and maximum parlay size.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <label className="text-xs text-slate-500">
            Bankroll
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
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            />
          </label>

          <label className="text-xs text-slate-500">
            Profit target
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
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            />
          </label>

          <label className="text-xs text-slate-500">
            Risk
            <select
              value={risk}
              onChange={(event) =>
                setRisk(
                  event.target
                    .value as RiskPreference
                )
              }
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            >
              <option value="low">Low</option>
              <option value="medium">
                Medium
              </option>
              <option value="high">High</option>
            </select>
          </label>

          <label className="text-xs text-slate-500">
            Max legs
            <select
              value={maxLegs}
              onChange={(event) =>
                setMaxLegs(
                  Number(event.target.value)
                )
              }
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            >
              <option value={2}>2 legs</option>
              <option value={3}>3 legs</option>
              <option value={4}>4 legs</option>
            </select>
          </label>
        </div>
      </div>

      {loading && (
        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-6 text-sm text-slate-400">
          Building AI strategy...
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
              label="Scanned"
              value={`${data.analysis.scannedPicks}`}
            />
            <Stat
              label="Qualified"
              value={`${data.analysis.qualifiedPicks}`}
            />
            <Stat
              label="Exposure"
              value={pct(
                data.analysis.totalExposurePercent
              )}
            />
            <Stat
              label="Total Stake"
              value={money(
                data.analysis.totalExposure
              )}
            />
            <Stat
              label="Expected Profit"
              value={money(
                data.analysis.expectedProfit
              )}
            />
            <Stat
              label="Max Profit"
              value={money(
                data.analysis.projectedMaximumProfit
              )}
            />
            <Stat
              label="Positive Chance"
              value={pct(
                data.analysis.probabilityPositive
              )}
            />
            <Stat
              label="Target Coverage"
              value={pct(
                data.analysis.targetCoverage
              )}
            />
          </div>

          <div className="mt-6 rounded-3xl border border-violet-500/20 bg-violet-950/10 p-6">
            <p
              className={`text-sm font-black ${statusClass(
                data.analysis.status
              )}`}
            >
              {data.analysis.status.replaceAll(
                '_',
                ' '
              )}
            </p>

            <p className="mt-3 text-sm leading-7 text-slate-300">
              {data.conclusion}
            </p>

            <p className="mt-2 text-xs text-slate-500">
              Remaining bankroll:{' '}
              {money(
                data.analysis.remainingBankroll
              )}
            </p>
          </div>

          {data.warnings.length > 0 && (
            <div className="mt-6 rounded-2xl border border-amber-500/25 bg-amber-950/15 p-5">
              <p className="font-bold text-amber-300">
                Strategy Warnings
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
                Recommended Singles
              </h3>

              <div className="space-y-3">
                {data.strategy.singles.length ===
                0 ? (
                  <EmptyCard text="No singles currently satisfy this strategy." />
                ) : (
                  data.strategy.singles.map(
                    (pick) => (
                      <SingleCard
                        key={`${pick.team}-${pick.opponent}-${pick.odds}`}
                        pick={pick}
                      />
                    )
                  )
                )}
              </div>
            </div>

            <div>
              <h3 className="mb-3 font-bold text-white">
                Controlled Parlay
              </h3>

              {!data.strategy.parlay
                .available ? (
                <EmptyCard text="No independent parlay is currently available." />
              ) : (
                <ParlayCard
                  parlay={data.strategy.parlay}
                />
              )}
            </div>
          </div>
        </>
      )}
    </section>
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

function SingleCard({
  pick,
}: {
  pick: BrainPick
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-white">
            {pick.team} ML {pick.formattedOdds}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            vs {pick.opponent}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {pick.sportsbook ?? 'Sportsbook'}
          </p>
        </div>

        <p className="text-xl font-black text-violet-300">
          {pick.aiScore}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Mini
          label="Stake"
          value={money(pick.stake)}
        />
        <Mini
          label="Profit"
          value={money(pick.potentialProfit)}
        />
        <Mini
          label="Confidence"
          value={pct(pick.confidence)}
        />
      </div>
    </div>
  )
}

function ParlayCard({
  parlay,
}: {
  parlay: BrainResponse['strategy']['parlay']
}) {
  return (
    <div className="rounded-2xl border border-violet-500/20 bg-violet-950/10 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-violet-300">
            {parlay.legs}-Leg Strategy
          </p>
          <p className="mt-1 text-2xl font-black text-white">
            {odds(parlay.americanOdds)}
          </p>
        </div>

        <div className="text-right">
          <p className="text-2xl font-black text-white">
            {parlay.ticketScore}
          </p>
          <p className="text-xs text-slate-500">
            Ticket score
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
          value={pct(parlay.expectedValue)}
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

      <p className="mt-4 text-xs font-bold text-slate-400">
        Risk: {parlay.riskLevel} · Score{' '}
        {parlay.riskScore}/100
      </p>
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