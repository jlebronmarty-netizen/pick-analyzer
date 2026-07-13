'use client'

import {
  useEffect,
  useState,
} from 'react'
import { useSport } from '@/context/SportContext'

type PerformanceRow = {
  key: string
  label: string
  bets: number
  wins: number
  losses: number
  pushes: number
  winRate: number
  roi: number
  profit: number
  averageOdds: number
  averageConfidence: number
  averageEv: number
  averageEdge: number
}

type CoachInsight = {
  id: string
  title: string
  message: string
  severity:
    | 'positive'
    | 'warning'
    | 'critical'
    | 'info'
  metric?: string
  sampleSize: number
}

type CoachResponse = {
  success: boolean
  dataQuality: {
    level: string
    settledPredictions: number
    message: string
  }
  overall: PerformanceRow
  calibration: {
    score: number
    averageConfidence: number
    actualWinRate: number
    difference: number
    status: string
  }
  best: {
    sport: PerformanceRow | null
    market: PerformanceRow | null
    oddsRange: PerformanceRow | null
    confidenceRange: PerformanceRow | null
    evRange: PerformanceRow | null
    day: PerformanceRow | null
    timeWindow: PerformanceRow | null
  }
  breakdowns: {
    bySport: PerformanceRow[]
    byMarket: PerformanceRow[]
    byOddsRange: PerformanceRow[]
    byConfidence: PerformanceRow[]
    byEvRange: PerformanceRow[]
    byDay: PerformanceRow[]
    byHour: PerformanceRow[]
    favoritesVsUnderdogs: PerformanceRow[]
  }
  insights: CoachInsight[]
  rules: {
    do: string[]
    avoid: string[]
  }
  error?: string
}

function pct(value?: number) {
  return `${Number(value ?? 0).toFixed(
    2
  )}%`
}

function units(value?: number) {
  const number = Number(value ?? 0)

  return `${number > 0 ? '+' : ''}${number.toFixed(
    2
  )}u`
}

function qualityClass(value: string) {
  if (value === 'STRONG') {
    return 'text-emerald-300'
  }

  if (
    value === 'MODERATE' ||
    value === 'LIMITED'
  ) {
    return 'text-amber-300'
  }

  return 'text-red-300'
}

function insightClass(
  severity: CoachInsight['severity']
) {
  if (severity === 'positive') {
    return 'border-emerald-500/20 bg-emerald-950/10 text-emerald-200'
  }

  if (severity === 'warning') {
    return 'border-amber-500/20 bg-amber-950/10 text-amber-200'
  }

  if (severity === 'critical') {
    return 'border-red-500/20 bg-red-950/10 text-red-200'
  }

  return 'border-blue-500/20 bg-blue-950/10 text-blue-200'
}

export default function AICoachPanel() {
  const { sportKey, sport } = useSport()

  const [
    recommendedOnly,
    setRecommendedOnly,
  ] = useState(false)

  const [
    minimumSample,
    setMinimumSample,
  ] = useState(10)

  const [data, setData] =
    useState<CoachResponse | null>(null)

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
          `/api/ai/coach?sport=${encodeURIComponent(
            sportKey
          )}&recommendedOnly=${recommendedOnly}&minimumSample=${minimumSample}`,
          {
            cache: 'no-store',
          }
        )

        const json = await response.json()

        if (!response.ok || !json.success) {
          throw new Error(
            json.error ??
              'Unable to load AI Coach'
          )
        }

        setData(json)
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load AI Coach'
        )
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [
    sportKey,
    recommendedOnly,
    minimumSample,
  ])

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-300">
            AI Coach
          </p>

          <h2 className="mt-2 text-3xl font-black text-white">
            Performance Coach
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Studies settled model predictions,
            identifies profitable and weak
            patterns, and creates rules for{' '}
            {sport.icon} {sport.shortLabel}.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={recommendedOnly}
              onChange={(event) =>
                setRecommendedOnly(
                  event.target.checked
                )
              }
            />
            Recommended only
          </label>

          <select
            value={minimumSample}
            onChange={(event) =>
              setMinimumSample(
                Number(event.target.value)
              )
            }
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
          >
            <option value={5}>
              Minimum 5 samples
            </option>
            <option value={10}>
              Minimum 10 samples
            </option>
            <option value={20}>
              Minimum 20 samples
            </option>
            <option value={50}>
              Minimum 50 samples
            </option>
          </select>
        </div>
      </div>

      {loading && (
        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-6 text-sm text-slate-400">
          Studying settled performance...
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-2xl border border-red-900/60 bg-red-950/30 p-6 text-sm text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-bold text-white">
                  Data Quality
                </p>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {data.dataQuality.message}
                </p>
              </div>

              <div className="text-right">
                <p
                  className={`text-2xl font-black ${qualityClass(
                    data.dataQuality.level
                  )}`}
                >
                  {data.dataQuality.level}
                </p>

                <p className="text-xs text-slate-500">
                  {
                    data.dataQuality
                      .settledPredictions
                  }{' '}
                  settled predictions
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
            <Stat
              label="Settled"
              value={`${data.overall.bets}`}
            />
            <Stat
              label="Win Rate"
              value={pct(
                data.overall.winRate
              )}
            />
            <Stat
              label="ROI"
              value={pct(data.overall.roi)}
            />
            <Stat
              label="Profit"
              value={units(
                data.overall.profit
              )}
            />
            <Stat
              label="Avg Confidence"
              value={pct(
                data.overall
                  .averageConfidence
              )}
            />
            <Stat
              label="Avg EV"
              value={pct(
                data.overall.averageEv
              )}
            />
            <Stat
              label="Calibration"
              value={`${data.calibration.score}`}
            />
            <Stat
              label="Model Status"
              value={data.calibration.status.replaceAll(
                '_',
                ' '
              )}
            />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <BestCard
              title="Best Sport"
              row={data.best.sport}
            />

            <BestCard
              title="Best Market"
              row={data.best.market}
            />

            <BestCard
              title="Best Odds Range"
              row={data.best.oddsRange}
            />

            <BestCard
              title="Best Confidence"
              row={
                data.best.confidenceRange
              }
            />
          </div>

          <div className="mt-6">
            <h3 className="mb-3 font-bold text-white">
              Coach Insights
            </h3>

            {data.insights.length === 0 ? (
              <EmptyCard text="No reliable insights are available yet." />
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {data.insights.map(
                  (insight) => (
                    <InsightCard
                      key={insight.id}
                      insight={insight}
                    />
                  )
                )}
              </div>
            )}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <RuleCard
              title="Do More"
              items={data.rules.do}
              tone="positive"
            />

            <RuleCard
              title="Reduce or Avoid"
              items={data.rules.avoid}
              tone="negative"
            />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <BreakdownTable
              title="Sports Performance"
              rows={
                data.breakdowns.bySport
              }
            />

            <BreakdownTable
              title="Odds Range Performance"
              rows={
                data.breakdowns.byOddsRange
              }
            />

            <BreakdownTable
              title="Confidence Performance"
              rows={
                data.breakdowns.byConfidence
              }
            />

            <BreakdownTable
              title="Favorites vs Underdogs"
              rows={
                data.breakdowns
                  .favoritesVsUnderdogs
              }
            />
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

      <p className="mt-1 break-words text-lg font-black text-white">
        {value}
      </p>
    </div>
  )
}

function BestCard({
  title,
  row,
}: {
  title: string
  row: PerformanceRow | null
}) {
  return (
    <div className="rounded-2xl border border-rose-500/20 bg-rose-950/10 p-5">
      <p className="text-sm font-bold text-rose-300">
        {title}
      </p>

      {row ? (
        <>
          <p className="mt-2 text-xl font-black text-white">
            {row.label}
          </p>

          <p className="mt-2 text-sm text-slate-400">
            {pct(row.roi)} ROI ·{' '}
            {pct(row.winRate)} win rate
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {row.bets} samples
          </p>
        </>
      ) : (
        <p className="mt-3 text-sm text-slate-400">
          Insufficient sample.
        </p>
      )}
    </div>
  )
}

function InsightCard({
  insight,
}: {
  insight: CoachInsight
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${insightClass(
        insight.severity
      )}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-bold">
          {insight.title}
        </p>

        {insight.metric && (
          <span className="text-xs font-black">
            {insight.metric}
          </span>
        )}
      </div>

      <p className="mt-3 text-sm leading-6 opacity-90">
        {insight.message}
      </p>

      <p className="mt-2 text-xs opacity-60">
        Sample: {insight.sampleSize}
      </p>
    </div>
  )
}

function RuleCard({
  title,
  items,
  tone,
}: {
  title: string
  items: string[]
  tone: 'positive' | 'negative'
}) {
  return (
    <div
      className={
        tone === 'positive'
          ? 'rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-5'
          : 'rounded-2xl border border-red-500/20 bg-red-950/10 p-5'
      }
    >
      <p
        className={
          tone === 'positive'
            ? 'font-bold text-emerald-300'
            : 'font-bold text-red-300'
        }
      >
        {title}
      </p>

      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </div>
  )
}

function BreakdownTable({
  title,
  rows,
}: {
  title: string
  rows: PerformanceRow[]
}) {
  return (
    <div>
      <h3 className="mb-3 font-bold text-white">
        {title}
      </h3>

      {rows.length === 0 ? (
        <EmptyCard text="No settled data for this breakdown." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-800">
          <div className="grid grid-cols-[1fr_70px_80px_80px] bg-slate-900 px-4 py-3 text-xs font-bold text-slate-500">
            <span>Category</span>
            <span className="text-right">
              Bets
            </span>
            <span className="text-right">
              Win %
            </span>
            <span className="text-right">
              ROI
            </span>
          </div>

          {rows.slice(0, 8).map((row) => (
            <div
              key={row.key}
              className="grid grid-cols-[1fr_70px_80px_80px] border-t border-slate-800 bg-slate-950/70 px-4 py-3 text-sm"
            >
              <span className="truncate font-semibold text-white">
                {row.label}
              </span>

              <span className="text-right text-slate-400">
                {row.bets}
              </span>

              <span className="text-right text-slate-300">
                {pct(row.winRate)}
              </span>

              <span
                className={
                  row.roi > 0
                    ? 'text-right font-bold text-emerald-300'
                    : row.roi < 0
                      ? 'text-right font-bold text-red-300'
                      : 'text-right font-bold text-slate-300'
                }
              >
                {pct(row.roi)}
              </span>
            </div>
          ))}
        </div>
      )}
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