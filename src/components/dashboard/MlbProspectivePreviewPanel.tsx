'use client'

import { useEffect, useState } from 'react'

type PreviewCandidate = {
  id: string
  category: string
  matchup: string
  startTime: string
  market: string
  selection: string
  line: number | null
  odds: number
  modelProbability: number
  impliedProbability: number
  edge: number
  ev: number
  confidence: number
  confidenceLabel: string | null
  reliability: string | null
  reliabilityScore: number | null
  aiRating: number | null
  aiGrade: string | null
  rankingScore: number | null
  featureQuality: number | null
  dataSufficiency: number | null
  positiveFactors: string[]
  negativeFactors: string[]
  missingData: string[]
  marketStability: {
    initialOdds?: number
    latestOdds?: number
    initialLine?: number | null
    latestLine?: number | null
    direction?: string
  } | null
  comparison: {
    probabilityDelta?: number | null
    confidenceDelta?: number | null
    aiRatingDelta?: number | null
    recommendationChanged?: boolean
  } | null
  recommendationStatus: string
  blockers: string[]
  oddsTimestamp: string
  cutoff: string
}

type PreviewResponse = {
  success: boolean
  summary: {
    nextGameTime: string | null
    latestOddsCapture: string | null
    gamesWithOdds: number
    previewCandidates: number
    qualifiedPreviews: number
    watch: number
    analyzedNotRecommended: number
    blocked: number
    officialPicks: number
    nextRequiredCaptureAction: string
  }
  categories: {
    qualifiedPreview: PreviewCandidate[]
    watch: PreviewCandidate[]
    analyzedNotRecommended: PreviewCandidate[]
    blocked: PreviewCandidate[]
  }
}

function formatOdds(value: number) {
  return value > 0 ? `+${value}` : String(value)
}

function formatNumber(value: number | null | undefined, suffix = '') {
  return value === null || value === undefined || Number.isNaN(Number(value))
    ? 'n/a'
    : `${Number(value).toFixed(2).replace(/\.00$/, '')}${suffix}`
}

function shortTime(value: string | null) {
  if (!value) return 'None'
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function CandidateRow({ candidate }: { candidate: PreviewCandidate }) {
  return (
    <div className="grid gap-4 border-t border-slate-800 py-4 text-sm xl:grid-cols-[1.1fr_0.8fr_1fr_1.2fr]">
      <div>
        <p className="font-bold text-white">{candidate.matchup}</p>
        <p className="mt-1 text-xs text-slate-500">{shortTime(candidate.startTime)}</p>
        <p className="mt-2 text-xs font-semibold text-slate-300">
          Rank {formatNumber(candidate.rankingScore)} / AI {candidate.aiGrade ?? 'n/a'} {formatNumber(candidate.aiRating)}
        </p>
      </div>
      <div>
        <p className="font-semibold text-slate-200">{candidate.market}</p>
        <p className="mt-1 text-xs text-slate-500">
          {candidate.selection} {candidate.line === null ? '' : candidate.line}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {formatOdds(candidate.odds)} via {candidate.marketStability?.direction ?? 'stable'}
        </p>
      </div>
      <div>
        <p className="font-semibold text-slate-200">
          Book {formatNumber(candidate.impliedProbability, '%')} / Model {formatNumber(candidate.modelProbability, '%')}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Edge {formatNumber(candidate.edge, '%')} / EV {formatNumber(candidate.ev, '%')}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Confidence {candidate.confidenceLabel ?? 'Low'} ({formatNumber(candidate.confidence)}) / Reliability {candidate.reliability ?? 'n/a'} ({formatNumber(candidate.reliabilityScore)})
        </p>
        {candidate.comparison && (
          <p className="mt-1 text-xs text-slate-500">
            OLD to NEW: P {formatNumber(candidate.comparison.probabilityDelta, ' pts')}, C {formatNumber(candidate.comparison.confidenceDelta, ' pts')}, AI {formatNumber(candidate.comparison.aiRatingDelta, ' pts')}
          </p>
        )}
      </div>
      <div>
        <p className="font-semibold text-amber-200">{candidate.recommendationStatus}</p>
        <p className="mt-1 text-xs text-slate-500">
          Q {candidate.featureQuality ?? 'n/a'} / S {candidate.dataSufficiency ?? 'n/a'}
        </p>
        {candidate.positiveFactors.length > 0 && (
          <p className="mt-1 text-xs text-emerald-200">
            + {candidate.positiveFactors.slice(0, 2).join(' | ')}
          </p>
        )}
        {candidate.negativeFactors.length > 0 && (
          <p className="mt-1 text-xs text-rose-200">
            - {candidate.negativeFactors.slice(0, 2).join(' | ')}
          </p>
        )}
        {candidate.missingData.length > 0 && (
          <p className="mt-1 text-xs text-slate-500">
            Missing {candidate.missingData.slice(0, 4).join(', ')}
          </p>
        )}
        {candidate.blockers.length > 0 && (
          <p className="mt-1 text-xs text-slate-500">
            {candidate.blockers.slice(0, 3).join(', ')}
          </p>
        )}
      </div>
    </div>
  )
}

export default function MlbProspectivePreviewPanel() {
  const [data, setData] = useState<PreviewResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(
          '/api/predictions/by-sport?sport=baseball_mlb&prospectivePreview=true',
          { cache: 'no-store' }
        )
        const json = await response.json()
        if (!response.ok || !json.success) {
          throw new Error(json.error ?? 'Unable to load MLB model preview')
        }
        setData(json)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load MLB model preview')
      }
    }

    load()
  }, [])

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-300">
            MLB MODEL PREVIEW
          </p>
          <h2 className="mt-2 text-2xl font-black text-white">
            Prospective Slate
          </h2>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-black uppercase tracking-[0.18em]">
            <span className="rounded-full border border-amber-500/30 px-3 py-1 text-amber-200">
              Quarantined Model Preview
            </span>
            <span className="rounded-full border border-red-500/30 px-3 py-1 text-red-200">
              Not An Official Pick
            </span>
            <span className="rounded-full border border-slate-700 px-3 py-1 text-slate-300">
              Not A Wagering Recommendation
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <p className="text-slate-500">Next Game</p>
            <p className="font-bold text-white">{shortTime(data?.summary.nextGameTime ?? null)}</p>
          </div>
          <div>
            <p className="text-slate-500">Odds Capture</p>
            <p className="font-bold text-white">{shortTime(data?.summary.latestOddsCapture ?? null)}</p>
          </div>
          <div>
            <p className="text-slate-500">Candidates</p>
            <p className="font-bold text-white">{data?.summary.previewCandidates ?? 0}</p>
          </div>
          <div>
            <p className="text-slate-500">Official Picks</p>
            <p className="font-bold text-white">{data?.summary.officialPicks ?? 0}</p>
          </div>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-300">{error}</p>}

      {data && (
        <div className="mt-6 grid gap-4 lg:grid-cols-4">
          {[
            ['Qualified Preview', data.categories.qualifiedPreview],
            ['Watch', data.categories.watch],
            ['Analyzed / Not Recommended', data.categories.analyzedNotRecommended],
            ['Blocked', data.categories.blocked],
          ].map(([label, rows]) => (
            <div key={String(label)} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-sm font-black text-white">{String(label)}</p>
              <p className="mt-1 text-2xl font-black text-emerald-300">
                {(rows as PreviewCandidate[]).length}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5">
        {(data?.categories.qualifiedPreview ?? []).map((candidate) => (
          <CandidateRow key={candidate.id} candidate={candidate} />
        ))}
        {(data?.categories.watch ?? []).map((candidate) => (
          <CandidateRow key={candidate.id} candidate={candidate} />
        ))}
        {(data?.categories.analyzedNotRecommended ?? []).map((candidate) => (
          <CandidateRow key={candidate.id} candidate={candidate} />
        ))}
        {(data?.categories.blocked ?? []).map((candidate) => (
          <CandidateRow key={candidate.id} candidate={candidate} />
        ))}
      </div>

      {data && (
        <p className="mt-4 text-sm text-slate-400">
          {data.summary.nextRequiredCaptureAction}
        </p>
      )}
    </section>
  )
}
