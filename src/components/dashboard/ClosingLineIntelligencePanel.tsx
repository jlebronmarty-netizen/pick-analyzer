'use client'

import {
  useEffect,
  useState,
} from 'react'
import { useSport } from '@/context/SportContext'

type SportsbookStat = {
  sportsbook: string
  samples: number
  positiveClvRate: number
  averageClv: number
  averageMoveCents: number
  staleLines: number
  favorableLines: number
  opportunityScore: number
}

type TimingStat = {
  label: string
  samples: number
  positiveClvRate: number
  averageClv: number
  averageMoveCents: number
}

type ClosingOpportunity = {
  id: string
  sportKey: string
  gameId: string
  team: string
  opponent: string
  sportsbook: string
  market: string
  commenceTime: string
  currentOdds: number
  openingOdds: number
  closingOdds: number | null
  projectedClosingOdds: number
  edge: number
  ev: number
  clvPercent: number
  movementCents: number
  valueVsModel: number
  staleLine: boolean
  favorableLine: boolean
  urgencyScore: number
  recommendation:
    | 'BET_NOW'
    | 'PLAYABLE'
    | 'WAIT'
    | 'PASS'
}

type ClosingLineResponse = {
  success: boolean
  dataQuality: {
    level:
      | 'STRONG'
      | 'MODERATE'
      | 'ESTIMATED'
      | 'INSUFFICIENT'
    totalRecords: number
    settledRecords: number
    recordsWithClosingLine: number
    usesEstimatedClose: boolean
    message: string
  }
  summary: {
    samples: number
    averageClv: number
    positiveClvRate: number
    averageMovementCents: number
    sportsbooksTracked: number
    currentOpportunities: number
    betNowOpportunities: number
    bestSportsbook: SportsbookStat | null
    bestTimingWindow: TimingStat | null
  }
  sportsbookStats: SportsbookStat[]
  timingStats: TimingStat[]
  opportunities: ClosingOpportunity[]
  error?: string
}

function pct(value?: number) {
  return `${Number(value ?? 0).toFixed(
    2
  )}%`
}

function odds(value?: number) {
  const number = Number(value ?? 0)
  return number > 0
    ? `+${number}`
    : `${number}`
}

function signedCents(value?: number) {
  const number = Number(value ?? 0)

  return `${number > 0 ? '+' : ''}${number.toFixed(
    1
  )}¢`
}

function qualityClass(value: string) {
  if (value === 'STRONG') {
    return 'text-emerald-300'
  }

  if (
    value === 'MODERATE' ||
    value === 'ESTIMATED'
  ) {
    return 'text-amber-300'
  }

  return 'text-red-300'
}

function recommendationClass(
  value: ClosingOpportunity['recommendation']
) {
  if (value === 'BET_NOW') {
    return 'text-emerald-300'
  }

  if (value === 'PLAYABLE') {
    return 'text-blue-300'
  }

  if (value === 'WAIT') {
    return 'text-amber-300'
  }

  return 'text-red-300'
}

export default function ClosingLineIntelligencePanel() {
  const { sportKey, sport } = useSport()

  const [data, setData] =
    useState<ClosingLineResponse | null>(null)

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
          `/api/closing-line/intelligence?sport=${encodeURIComponent(
            sportKey
          )}`,
          { cache: 'no-store' }
        )

        const json = await response.json()

        if (!response.ok || !json.success) {
          throw new Error(
            json.error ??
              'Unable to load closing-line intelligence'
          )
        }

        setData(json)
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load closing-line intelligence'
        )
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [sportKey])

  if (loading) {
    return (
      <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        Analyzing closing lines for{' '}
        {sport.shortLabel}...
      </section>
    )
  }

  if (error || !data) {
    return (
      <section className="rounded-3xl border border-red-900/60 bg-red-950/30 p-6 text-sm text-red-300">
        {error ??
          'No closing-line data available.'}
      </section>
    )
  }

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-300">
            Closing Line Intelligence
          </p>

          <h2 className="mt-2 text-3xl font-black text-white">
            Entry Timing &amp; CLV Lab
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Measures closing-line value,
            sportsbook opportunity, expected
            movement and the best time to enter
            the market for {sport.icon}{' '}
            {sport.shortLabel}.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-5 py-4 text-right">
          <p className="text-xs text-slate-500">
            Data Quality
          </p>

          <p
            className={`mt-1 text-xl font-black ${qualityClass(
              data.dataQuality.level
            )}`}
          >
            {data.dataQuality.level}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {
              data.dataQuality
                .recordsWithClosingLine
            }{' '}
            closing lines
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
        <p className="text-sm leading-6 text-slate-400">
          {data.dataQuality.message}
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <Stat
          label="Samples"
          value={`${data.summary.samples}`}
        />

        <Stat
          label="Average CLV"
          value={pct(
            data.summary.averageClv
          )}
        />

        <Stat
          label="Positive CLV"
          value={pct(
            data.summary.positiveClvRate
          )}
        />

        <Stat
          label="Avg Move"
          value={signedCents(
            data.summary
              .averageMovementCents
          )}
        />

        <Stat
          label="Sportsbooks"
          value={`${data.summary.sportsbooksTracked}`}
        />

        <Stat
          label="Opportunities"
          value={`${data.summary.currentOpportunities}`}
        />

        <Stat
          label="Bet Now"
          value={`${data.summary.betNowOpportunities}`}
        />

        <Stat
          label="Best Window"
          value={
            data.summary.bestTimingWindow
              ?.label ?? 'N/A'
          }
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <HighlightCard
          title="Best Sportsbook"
          value={
            data.summary.bestSportsbook
              ?.sportsbook ??
            'Insufficient data'
          }
          details={
            data.summary.bestSportsbook
              ? [
                  `Opportunity score: ${data.summary.bestSportsbook.opportunityScore}/100`,
                  `Average CLV: ${pct(
                    data.summary
                      .bestSportsbook
                      .averageClv
                  )}`,
                  `Positive CLV: ${pct(
                    data.summary
                      .bestSportsbook
                      .positiveClvRate
                  )}`,
                ]
              : []
          }
        />

        <HighlightCard
          title="Best Entry Window"
          value={
            data.summary.bestTimingWindow
              ?.label ??
            'Insufficient data'
          }
          details={
            data.summary.bestTimingWindow
              ? [
                  `Average CLV: ${pct(
                    data.summary
                      .bestTimingWindow
                      .averageClv
                  )}`,
                  `Positive CLV: ${pct(
                    data.summary
                      .bestTimingWindow
                      .positiveClvRate
                  )}`,
                  `Samples: ${data.summary.bestTimingWindow.samples}`,
                ]
              : []
          }
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <div>
          <h3 className="mb-3 font-bold text-white">
            Sportsbook Rankings
          </h3>

          <div className="space-y-3">
            {data.sportsbookStats.length ===
            0 ? (
              <EmptyCard text="No sportsbook comparison is available yet." />
            ) : (
              data.sportsbookStats
                .slice(0, 8)
                .map((book) => (
                  <SportsbookCard
                    key={book.sportsbook}
                    book={book}
                  />
                ))
            )}
          </div>
        </div>

        <div>
          <h3 className="mb-3 font-bold text-white">
            Entry Timing Analysis
          </h3>

          <div className="space-y-3">
            {data.timingStats.length ===
            0 ? (
              <EmptyCard text="No timing analysis is available yet." />
            ) : (
              data.timingStats.map(
                (timing) => (
                  <TimingCard
                    key={timing.label}
                    timing={timing}
                  />
                )
              )
            )}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="mb-3 font-bold text-white">
          Current Line Opportunities
        </h3>

        {data.opportunities.length === 0 ? (
          <EmptyCard text="No pending line opportunities were found for the selected sport." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.opportunities
              .slice(0, 9)
              .map((opportunity) => (
                <OpportunityCard
                  key={`${opportunity.id}-${opportunity.sportsbook}-${opportunity.team}`}
                  opportunity={
                    opportunity
                  }
                />
              ))}
          </div>
        )}
      </div>
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

function HighlightCard({
  title,
  value,
  details,
}: {
  title: string
  value: string
  details: string[]
}) {
  return (
    <div className="rounded-3xl border border-teal-500/20 bg-teal-950/10 p-5">
      <p className="text-sm font-bold text-teal-300">
        {title}
      </p>

      <p className="mt-2 text-3xl font-black text-white">
        {value}
      </p>

      <ul className="mt-3 space-y-1 text-sm text-slate-400">
        {details.map((detail) => (
          <li key={detail}>• {detail}</li>
        ))}
      </ul>
    </div>
  )
}

function SportsbookCard({
  book,
}: {
  book: SportsbookStat
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-white">
            {book.sportsbook}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {book.samples} samples ·{' '}
            {book.staleLines} stale-line
            candidates
          </p>
        </div>

        <div className="text-right">
          <p className="text-2xl font-black text-teal-300">
            {book.opportunityScore}
          </p>

          <p className="text-xs text-slate-500">
            Opportunity
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Mini
          label="Avg CLV"
          value={pct(book.averageClv)}
        />

        <Mini
          label="Positive"
          value={pct(
            book.positiveClvRate
          )}
        />

        <Mini
          label="Avg Move"
          value={signedCents(
            book.averageMoveCents
          )}
        />
      </div>
    </div>
  )
}

function TimingCard({
  timing,
}: {
  timing: TimingStat
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-bold text-white">
            {timing.label} before game
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {timing.samples} samples
          </p>
        </div>

        <p className="text-xl font-black text-teal-300">
          {pct(timing.averageClv)}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Mini
          label="Positive CLV"
          value={pct(
            timing.positiveClvRate
          )}
        />

        <Mini
          label="Avg Move"
          value={signedCents(
            timing.averageMoveCents
          )}
        />
      </div>
    </div>
  )
}

function OpportunityCard({
  opportunity,
}: {
  opportunity: ClosingOpportunity
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-white">
            {opportunity.team} ML
          </p>

          <p className="mt-1 text-xs text-slate-400">
            vs {opportunity.opponent}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {opportunity.sportsbook}
          </p>
        </div>

        <div className="text-right">
          <p className="font-black text-white">
            {odds(
              opportunity.currentOdds
            )}
          </p>

          <p
            className={`mt-1 text-xs font-black ${recommendationClass(
              opportunity.recommendation
            )}`}
          >
            {opportunity.recommendation.replaceAll(
              '_',
              ' '
            )}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Mini
          label="Projected Close"
          value={odds(
            opportunity.projectedClosingOdds
          )}
        />

        <Mini
          label="EV"
          value={pct(opportunity.ev)}
        />

        <Mini
          label="Urgency"
          value={`${opportunity.urgencyScore}`}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {opportunity.staleLine && (
          <span className="rounded-full bg-teal-500/15 px-3 py-1 text-xs font-bold text-teal-300">
            Stale Line
          </span>
        )}

        {opportunity.favorableLine && (
          <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-300">
            Favorable
          </span>
        )}

        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-bold text-slate-300">
          Edge {pct(opportunity.edge)}
        </span>
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