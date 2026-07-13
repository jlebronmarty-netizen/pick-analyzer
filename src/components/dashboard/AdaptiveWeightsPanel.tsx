'use client'

import { useDashboard } from '@/context/DashboardContext'

type WeightRecommendation = {
  factor: string
  sample: number
  roi: number
  winRate: number
  signal: number
  multiplier: number
  action:
    | 'INSUFFICIENT_DATA'
    | 'INCREASE_WEIGHT'
    | 'REDUCE_WEIGHT'
    | 'HOLD'
}

function actionClass(action: string) {
  if (action === 'INCREASE_WEIGHT') {
    return 'bg-emerald-500/15 text-emerald-300'
  }

  if (action === 'REDUCE_WEIGHT') {
    return 'bg-red-500/15 text-red-300'
  }

  if (action === 'HOLD') {
    return 'bg-blue-500/15 text-blue-300'
  }

  return 'bg-slate-700 text-slate-300'
}

function factorLabel(value: string) {
  if (value === 'confidence') return 'Confidence'
  if (value === 'ev') return 'Expected Value'
  if (value === 'edge') return 'Edge'
  if (value === 'favorites') return 'Favorites'
  if (value === 'underdogs') return 'Underdogs'

  return value
}

export default function AdaptiveWeightsPanel() {
  const { dashboard, loading, error } = useDashboard()

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        Loading adaptive weight engine...
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-red-900/60 bg-red-950/40 p-6 text-sm text-red-300">
        Adaptive weights failed: {error}
      </div>
    )
  }

  const adaptiveWeights = dashboard?.adaptiveWeights

  if (!adaptiveWeights) return null

  const recommendations =
    (adaptiveWeights.recommendations ?? []) as WeightRecommendation[]

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-purple-300">
            Adaptive Engine
          </p>

          <h2 className="mt-2 text-3xl font-black text-white">
            Weight Recommendations
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            The system reviews settled predictions and recommends whether to
            increase, reduce or hold model emphasis on key factors.
          </p>
        </div>

        <div className="rounded-full border border-slate-700 bg-slate-950 px-4 py-2 text-xs font-semibold text-slate-300">
          {adaptiveWeights.sampleSize ?? 0} settled samples
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-5">
        {recommendations.map((item) => (
          <div
            key={item.factor}
            className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-black text-white">
                  {factorLabel(item.factor)}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Signal {item.signal}
                </p>
              </div>

              <span
                className={`rounded-full px-2 py-1 text-[10px] font-bold ${actionClass(
                  item.action
                )}`}
              >
                {item.action}
              </span>
            </div>

            <div className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">ROI</span>
                <span
                  className={
                    item.roi >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }
                >
                  {item.roi.toFixed(2)}%
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-500">Win Rate</span>
                <span className="text-white">
                  {item.winRate.toFixed(2)}%
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-500">Multiplier</span>
                <span className="text-purple-300">
                  {item.multiplier.toFixed(2)}x
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-500">Sample</span>
                <span className="text-slate-300">{item.sample}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}