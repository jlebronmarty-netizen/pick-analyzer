'use client'

import { useEffect, useState } from 'react'

type Requirement = {
  key: string
  label: string
  completed: boolean
  current: number
  target: number
  message: string
}

type TeamProfile = {
  teamName: string
  season: number
  gamesPlayed: number
  wins: number
  losses: number
  winPercentage: number
  recentWinPercentage: number
  offensiveRating: number
  defensiveRating: number
  netRating: number
  pace: number
  pointsPerGame: number
  opponentPointsPerGame: number
  rating: number
  dataCompleteness: number
}

type NbaResponse = {
  success: boolean
  readiness: {
    status: string
    score: number
    completedRequirements: number
    totalRequirements: number
  }
  summary: {
    teamsLoaded: number
    averageDataCompleteness: number
    pendingPredictions: number
    recommendedPending: number
    settledPredictions: number
    averageTeamRating: number
    topRatedTeam: TeamProfile | null
  }
  requirements: Requirement[]
  teamRankings: TeamProfile[]
  error?: string
}

function pct(value?: number) {
  return `${Number(value ?? 0).toFixed(2)}%`
}

function readinessClass(status: string) {
  if (status === 'PRODUCTION_READY') {
    return 'text-emerald-300'
  }

  if (
    status === 'PARTIALLY_READY' ||
    status === 'DATA_INCOMPLETE'
  ) {
    return 'text-amber-300'
  }

  return 'text-red-300'
}

export default function NbaAdapterPanel() {
  const [data, setData] = useState<NbaResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(
          '/api/nba/adapter/status',
          { cache: 'no-store' }
        )

        const json = await response.json()

        if (!response.ok || !json.success) {
          throw new Error(
            json.error ?? 'Unable to load NBA Adapter'
          )
        }

        setData(json)
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load NBA Adapter'
        )
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  if (loading) {
    return (
      <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        Inspecting NBA data readiness...
      </section>
    )
  }

  if (error || !data) {
    return (
      <section className="rounded-3xl border border-red-900/60 bg-red-950/30 p-6 text-sm text-red-300">
        {error ?? 'NBA Adapter data unavailable.'}
      </section>
    )
  }

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-orange-300">
            NBA Adapter V1
          </p>

          <h2 className="mt-2 text-3xl font-black text-white">
            🏀 NBA Intelligence Readiness
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Measures NBA team-stat coverage, prediction history and
            learning readiness before enabling production recommendations.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-5 py-4 text-right">
          <p
            className={`text-2xl font-black ${readinessClass(
              data.readiness.status
            )}`}
          >
            {data.readiness.status.replaceAll('_', ' ')}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Readiness {data.readiness.score}/100
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <Stat
          label="Teams"
          value={`${data.summary.teamsLoaded}`}
        />
        <Stat
          label="Completeness"
          value={pct(data.summary.averageDataCompleteness)}
        />
        <Stat
          label="Pending"
          value={`${data.summary.pendingPredictions}`}
        />
        <Stat
          label="Recommended"
          value={`${data.summary.recommendedPending}`}
        />
        <Stat
          label="Settled"
          value={`${data.summary.settledPredictions}`}
        />
        <Stat
          label="Avg Rating"
          value={`${data.summary.averageTeamRating}`}
        />
        <Stat
          label="Requirements"
          value={`${data.readiness.completedRequirements}/${data.readiness.totalRequirements}`}
        />
        <Stat
          label="Top Team"
          value={
            data.summary.topRatedTeam?.teamName ?? 'N/A'
          }
        />
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {data.requirements.map((requirement) => (
          <RequirementCard
            key={requirement.key}
            requirement={requirement}
          />
        ))}
      </div>

      <div className="mt-6">
        <h3 className="mb-3 font-bold text-white">
          NBA Team Intelligence Rankings
        </h3>

        {data.teamRankings.length === 0 ? (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-950/10 p-5">
            <p className="font-bold text-amber-300">
              No NBA team statistics loaded
            </p>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              The adapter is installed, but NBA team statistics still
              need to be synchronized before real ratings and picks can
              be produced.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-800">
            <div className="grid grid-cols-[1fr_70px_80px_80px_80px] bg-slate-900 px-4 py-3 text-xs font-bold text-slate-500">
              <span>Team</span>
              <span className="text-right">Rating</span>
              <span className="text-right">Net</span>
              <span className="text-right">Recent</span>
              <span className="text-right">Data</span>
            </div>

            {data.teamRankings.slice(0, 15).map((team) => (
              <div
                key={team.teamName}
                className="grid grid-cols-[1fr_70px_80px_80px_80px] border-t border-slate-800 bg-slate-950/70 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-semibold text-white">
                    {team.teamName}
                  </p>
                  <p className="text-xs text-slate-500">
                    {team.wins}-{team.losses}
                  </p>
                </div>

                <span className="text-right font-black text-orange-300">
                  {team.rating}
                </span>

                <span
                  className={
                    team.netRating >= 0
                      ? 'text-right text-emerald-300'
                      : 'text-right text-red-300'
                  }
                >
                  {team.netRating > 0 ? '+' : ''}
                  {team.netRating.toFixed(1)}
                </span>

                <span className="text-right text-slate-300">
                  {pct(team.recentWinPercentage * 100)}
                </span>

                <span className="text-right text-slate-400">
                  {pct(team.dataCompleteness)}
                </span>
              </div>
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
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 break-words text-lg font-black text-white">
        {value}
      </p>
    </div>
  )
}

function RequirementCard({
  requirement,
}: {
  requirement: Requirement
}) {
  const progress = Math.min(
    Math.max(
      (requirement.current /
        Math.max(requirement.target, 1)) *
        100,
      0
    ),
    100
  )

  return (
    <div
      className={
        requirement.completed
          ? 'rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-5'
          : 'rounded-2xl border border-amber-500/20 bg-amber-950/10 p-5'
      }
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-bold text-white">
          {requirement.label}
        </p>

        <span
          className={
            requirement.completed
              ? 'text-sm font-black text-emerald-300'
              : 'text-sm font-black text-amber-300'
          }
        >
          {requirement.completed ? 'READY' : 'PENDING'}
        </span>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-orange-400"
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="mt-2 text-xs text-slate-500">
        {requirement.current} / {requirement.target}
      </p>

      <p className="mt-3 text-sm leading-6 text-slate-400">
        {requirement.message}
      </p>
    </div>
  )
}