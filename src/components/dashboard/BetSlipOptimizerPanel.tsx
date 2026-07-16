'use client'

import { useEffect, useState } from 'react'

type OptimizerPick = {
  team: string
  opponent: string
  sportsbook?: string
  odds: number
  confidence: number
  edge: number
  ev: number
  smart_score?: number
  adaptive_score?: number
  recommended_stake?: number
  score?: number
}

type OptimizedTicket = {
  label: string
  legs: number
  qualityScore: number | null
  riskLevel: string
  riskScore: number | null
  correlation: {
    level: string
    score: number | null
    notes: string[]
  }
  americanOdds: number | null
  decimalOdds: number | null
  probability: number | null
  expectedValue: number | null
  averageConfidence: number | null
  averageEv: number | null
  averageEdge: number | null
  recommendedStake: number
  estimatedPayout: number
  expectedProfit: number
  kelly: {
    full: number
    half: number
    quarter: number
  }
  distribution: {
    winProbability: number
    lossProbability: number
    estimatedWinProfit: number
    estimatedLoss: number
  }
  explanation: {
    summary: string
    reasons: string[]
  }
  picks: OptimizerPick[]
}

type OptimizerResponse = {
  success: boolean
  mode?: string
  emptyState?: {
    message: string
    reason: string
  } | null
  optimizer: {
    mode?: string
    emptyState?: {
      message: string
      reason: string
    } | null
    ticketQualityScore: number | null
    riskLevel: string
    riskScore: number | null
    correlation: {
      level: string
      score: number | null
      notes: string[]
    }
    recommendedStake: number
    estimatedPayout: number
    expectedProfit: number
    kelly: {
      full: number
      half: number
      quarter: number
    }
    distribution: {
      winProbability: number
      lossProbability: number
      estimatedWinProfit: number
      estimatedLoss: number
    }
    explanation: {
      summary: string
      reasons: string[]
    }
    parlay: OptimizedTicket
    alternatives: OptimizedTicket[]
    singles: OptimizerPick[]
  }
}

function formatMoney(value?: number) {
  return `$${Number(value ?? 0).toFixed(2)}`
}

function formatOdds(value?: number | null) {
  if (value === null || value === undefined) return '-'
  const odds = Number(value)
  return odds > 0 ? `+${odds}` : `${odds}`
}

function formatPercent(value?: number | null) {
  if (value === null || value === undefined) return 'N/A'
  return `${Number(value ?? 0).toFixed(2)}%`
}

function scoreValue(pick: OptimizerPick) {
  return Number(pick.adaptive_score ?? pick.smart_score ?? pick.score ?? 0)
}

function riskClass(level?: string) {
  if (level === 'LOW') return 'text-emerald-300'
  if (level === 'MEDIUM') return 'text-amber-300'
  if (level === 'NO_TICKET' || level === 'NOT_APPLICABLE') return 'text-slate-300'
  return 'text-red-300'
}

function barWidth(value?: number | null) {
  return `${Math.min(Math.max(Number(value ?? 0), 0), 100)}%`
}

export default function BetSlipOptimizerPanel() {
  const [bankroll, setBankroll] = useState(1000)
  const [legs, setLegs] = useState(3)
  const [data, setData] = useState<OptimizerResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)

        const response = await fetch(
          `/api/parlays?bankroll=${bankroll}&legs=${legs}`,
          { cache: 'no-store' }
        )

        const json = await response.json()

        if (json.success) {
          setData(json)
        }
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [bankroll, legs])

  async function copySlip(ticket?: OptimizedTicket) {
    const selectedTicket = ticket ?? data?.optimizer?.parlay
    if (!selectedTicket) return

    const text = selectedTicket.picks
      .map((pick) => `${pick.team} ML ${formatOdds(pick.odds)}`)
      .join('\n')

    await navigator.clipboard.writeText(text)

    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  if (loading) {
    return (
      <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        Loading Bet Slip Optimizer...
      </section>
    )
  }

  if (!data?.optimizer) {
    return (
      <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        No optimized bet slip available yet.
      </section>
    )
  }

  const { optimizer } = data
  const ticket = optimizer.parlay
  const noTicket =
    data.mode === 'no_ticket' ||
    optimizer.mode === 'no_ticket' ||
    ticket.legs === 0

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-300">
            Should I Build a Ticket?
          </p>

          <h2 className="mt-2 text-3xl font-black text-white">
            Bet Slip
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Shows a ticket only when official picks are strong enough. If the
            model sees no good bets, it tells you to pass.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            value={bankroll}
            onChange={(event) => setBankroll(Number(event.target.value))}
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          >
            <option value={500}>$500 bankroll</option>
            <option value={1000}>$1,000 bankroll</option>
            <option value={2500}>$2,500 bankroll</option>
            <option value={5000}>$5,000 bankroll</option>
          </select>

          <select
            value={legs}
            onChange={(event) => setLegs(Number(event.target.value))}
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          >
            <option value={2}>2 legs</option>
            <option value={3}>3 legs</option>
            <option value={4}>4 legs</option>
          </select>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-emerald-500/20 bg-emerald-950/10 p-6">
          <p className="text-sm font-bold text-emerald-300">
            Ticket Answer
          </p>
          <p className="mt-2 text-5xl font-black text-white">
            {optimizer.ticketQualityScore === null ? 'N/A' : optimizer.ticketQualityScore}
            {optimizer.ticketQualityScore === null ? null : (
              <span className="text-xl text-slate-500">/100</span>
            )}
          </p>
          <p className="mt-3 text-sm text-slate-300">
            {optimizer.explanation.summary}
          </p>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6">
          <p className="text-sm font-bold text-white">Risk</p>
          <p className={`mt-2 text-3xl font-black ${riskClass(optimizer.riskLevel)}`}>
            {optimizer.riskLevel}
          </p>

          <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-current text-emerald-400"
              style={{ width: barWidth(optimizer.riskScore) }}
            />
          </div>

          <p className="mt-2 text-xs text-slate-500">
            Risk score: {optimizer.riskScore === null ? 'N/A' : `${optimizer.riskScore}/100`}
          </p>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6">
          <p className="text-sm font-bold text-white">Same-Game Risk</p>
          <p className={`mt-2 text-3xl font-black ${riskClass(optimizer.correlation.level)}`}>
            {optimizer.correlation.level}
          </p>

          <p className="mt-3 text-sm text-slate-400">
            {optimizer.correlation.notes?.[0] ?? 'No correlation notes.'}
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Legs" value={`${ticket.legs}`} />
        <Stat label="Parlay Odds" value={noTicket ? '-' : formatOdds(ticket.americanOdds)} />
        <Stat label="Chance To Hit" value={formatPercent(ticket.probability)} />
        <Stat label="Value" value={formatPercent(ticket.expectedValue)} />
        <Stat label="Stake" value={noTicket ? '$0.00' : formatMoney(ticket.recommendedStake)} />
      </div>

      {noTicket ? (
        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <p className="text-sm font-bold text-white">
            No ticket today.
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            There are no official bets strong enough to combine. Passing is the
            recommended action until the model finds qualified value.
          </p>
          <details className="mt-4 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
            <summary className="cursor-pointer text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
              Advanced Details
            </summary>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              {data.emptyState?.reason ??
                optimizer.emptyState?.reason ??
                'The optimizer activates only after official qualified picks pass production, calibration, quality and value gates.'}
            </p>
          </details>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-5">
          <p className="text-sm font-bold text-emerald-300">
            Estimated Payout
          </p>
          <p className="mt-1 text-3xl font-black text-white">
            {formatMoney(ticket.estimatedPayout)}
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Expected profit: {formatMoney(ticket.expectedProfit)}
          </p>
        </div>

        <div className="rounded-2xl border border-blue-500/20 bg-blue-950/10 p-5">
          <p className="text-sm font-bold text-blue-300">Kelly Allocation</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <MiniStat label="Full" value={formatMoney(ticket.kelly.full)} />
            <MiniStat label="Half" value={formatMoney(ticket.kelly.half)} />
            <MiniStat label="Quarter" value={formatMoney(ticket.kelly.quarter)} />
          </div>
        </div>

        <div className="rounded-2xl border border-purple-500/20 bg-purple-950/10 p-5">
          <p className="text-sm font-bold text-purple-300">
            Expected Distribution
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <MiniStat label="Win" value={formatPercent(ticket.distribution.winProbability)} />
            <MiniStat label="Lose" value={formatPercent(ticket.distribution.lossProbability)} />
            <MiniStat label="Win Profit" value={formatMoney(ticket.distribution.estimatedWinProfit)} />
            <MiniStat label="Loss" value={formatMoney(ticket.distribution.estimatedLoss)} />
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-bold text-white">Why this ticket?</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              {ticket.explanation.reasons.map((reason) => (
                <li key={reason}>✓ {reason}</li>
              ))}
            </ul>
          </div>

          <button
            onClick={() => copySlip(ticket)}
            className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-700"
          >
            {copied ? 'Copied!' : 'Copy Bet Slip'}
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-3 font-bold text-white">Optimized Parlay</h3>

          <div className="space-y-3">
            {ticket.picks.map((pick) => (
              <PickRow
                key={`${pick.team}-${pick.opponent}-${pick.odds}`}
                pick={pick}
              />
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-3 font-bold text-white">Best Singles</h3>

          <div className="space-y-3">
            {optimizer.singles.slice(0, 4).map((pick) => (
              <PickRow
                key={`${pick.team}-${pick.opponent}-${pick.odds}-single`}
                pick={pick}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="mb-3 font-bold text-white">Alternative Parlays</h3>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {optimizer.alternatives.filter((alternative) => alternative.legs > 0).map((alternative) => (
            <AlternativeTicket
              key={alternative.label}
              ticket={alternative}
              onCopy={() => copySlip(alternative)}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-black text-white">{value}</p>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-1 font-bold text-white">{value}</p>
    </div>
  )
}

function PickRow({ pick }: { pick: OptimizerPick }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-white">{pick.team} ML</p>
          <p className="mt-1 text-xs text-slate-400">vs {pick.opponent}</p>
          <p className="mt-1 text-xs text-slate-500">
            {pick.sportsbook ?? 'Sportsbook'}
          </p>
        </div>

        <p className="font-black text-white">{formatOdds(pick.odds)}</p>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-slate-500">Score</p>
          <p className="font-bold text-purple-300">
            {scoreValue(pick).toFixed(2)}
          </p>
        </div>

        <div>
          <p className="text-slate-500">EV</p>
          <p className="font-bold text-emerald-400">{formatPercent(pick.ev)}</p>
        </div>

        <div>
          <p className="text-slate-500">Conf.</p>
          <p className="font-bold text-white">{formatPercent(pick.confidence)}</p>
        </div>
      </div>
    </div>
  )
}

function AlternativeTicket({
  ticket,
  onCopy,
}: {
  ticket: OptimizedTicket
  onCopy: () => void
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-white">{ticket.label}</p>
          <p className="mt-1 text-xs text-slate-500">
            {ticket.legs} legs · {formatOdds(ticket.americanOdds)}
          </p>
        </div>

        <p className="text-lg font-black text-purple-300">
          {ticket.qualityScore ?? 'N/A'}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <MiniStat label="Risk" value={ticket.riskLevel} />
        <MiniStat label="EV" value={formatPercent(ticket.expectedValue)} />
        <MiniStat label="Prob." value={formatPercent(ticket.probability)} />
        <MiniStat label="Stake" value={formatMoney(ticket.recommendedStake)} />
      </div>

      <button
        onClick={onCopy}
        className="mt-4 w-full rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-4 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-950/40"
      >
        Copy Ticket
      </button>
    </div>
  )
}
