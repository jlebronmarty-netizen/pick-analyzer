'use client'

type PickExplanation = {
  verdict: string
  risk: string
  summary: string
  reasons: string[]
  warnings: string[]
  scores: {
    confidence: number
    modelProbability: number
    impliedProbability: number
    edge: number
    ev: number
    smartScore: number
    adaptiveScore: number
    kellyPercent: number
    recommendedStake: number
  }
  pick: {
    team: string
    opponent: string
    sportsbook: string
    market: string
    formattedOdds: string
  }
}

function scoreColor(value: number) {
  if (value >= 70) return 'text-emerald-400'
  if (value >= 50) return 'text-yellow-300'
  return 'text-red-400'
}

function confidenceLabel(value: number) {
  if (value >= 80) return 'Very High'
  if (value >= 70) return 'High'
  if (value >= 60) return 'Medium'
  return 'Low'
}

function betRating(value: number) {
  if (value >= 70) return 'Strong'
  if (value >= 55) return 'Watch'
  return 'Pass'
}

export default function PickExplanationCard({
  explanation,
}: {
  explanation: PickExplanation
}) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">
            Why This Pick?
          </p>

          <h3 className="mt-2 text-2xl font-black text-white">
            {explanation.pick.team} {explanation.pick.formattedOdds}
          </h3>

          <p className="mt-1 text-sm text-slate-400">
            vs {explanation.pick.opponent} · {explanation.pick.sportsbook}
          </p>
        </div>

        <div className="flex gap-2">
          <span className="rounded-full border border-emerald-500/30 bg-emerald-950/20 px-3 py-1 text-xs font-bold text-emerald-300">
            {explanation.verdict}
          </span>

          <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-bold text-slate-300">
            {explanation.risk}
          </span>
        </div>
      </div>

      <p className="mt-5 text-sm leading-7 text-slate-300">
        {explanation.summary}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Confidence" value={confidenceLabel(explanation.scores.confidence)} />
        <Stat label="Sportsbook Thinks" value={`${explanation.scores.impliedProbability.toFixed(0)}%`} />
        <Stat label="Pick Analyzer Thinks" value={`${explanation.scores.modelProbability.toFixed(0)}%`} />
        <Stat
          label="Bet Rating"
          value={betRating(explanation.scores.adaptiveScore)}
          className={scoreColor(explanation.scores.adaptiveScore)}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-5">
          <p className="text-sm font-bold text-emerald-300">Why We Like It</p>

          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            {explanation.reasons.map((reason, index) => (
              <li key={index}>✓ {reason}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-950/10 p-5">
          <p className="text-sm font-bold text-amber-300">Why We Might Pass</p>

          {explanation.warnings.length > 0 ? (
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              {explanation.warnings.map((warning, index) => (
                <li key={index}>⚠ {warning}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-400">
              No major risk warnings detected.
            </p>
          )}
        </div>
      </div>

      <details className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <summary className="cursor-pointer text-sm font-black text-white">
          Advanced Details
        </summary>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Edge" value={`${explanation.scores.edge.toFixed(2)}%`} />
          <Stat label="EV" value={`${explanation.scores.ev.toFixed(2)}%`} />
          <Stat label="Smart Score" value={explanation.scores.smartScore.toFixed(2)} />
          <Stat label="Kelly" value={`${explanation.scores.kellyPercent.toFixed(2)}%`} />
        </div>
      </details>
    </div>
  )
}

function Stat({
  label,
  value,
  className = 'text-white',
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className={`mt-2 text-xl font-black ${className}`}>{value}</p>
    </div>
  )
}
