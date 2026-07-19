'use client'

import { useEffect, useMemo, useState } from 'react'

type TeamProfile = {
  teamId: string
  teamName: string
  currentRecord: { wins: number | null; losses: number | null } | null
  leaguePosition: number | null
  winPercentage: number | null
  recentForm: string[] | null
  currentMomentum: string
  momentumScore: number | null
  consistencyScore: number | null
  strengthScore: number | null
  powerRank: number | null
}

type BsnIntelligenceResponse = {
  success: boolean
  generatedAt: string
  status: string
  providerCallsMade: number
  remoteMutationsMade: number
  teamProfiles: TeamProfile[]
  playerProfiles: Array<Record<string, unknown>>
  knowledge: {
    powerRankings: Array<{ rank: number | null; teamId: string; teamName: string; strengthScore: number | null; winPercentage: number | null }>
    hotTeams: TeamProfile[]
    coldTeams: TeamProfile[]
    leagueMomentum: { averageMomentum: number; teamsWithMomentum: number } | null
    unavailable: string[]
  }
  features: {
    generated: number
    unavailable: number
    populatedThisRun: number
    durableFeatureStorePopulation: string
  }
  coverage: {
    teams: number
    standings: number
    completedGames: number
    players: number
    featureRecords: number
    generatedFeatureRecords: number
    dataQuality: Record<string, number>
  }
  validation: {
    success: boolean
    noFabricatedValues: boolean
    featureStoreCompatible: boolean
    predictionSdkCompatible: boolean
    basketballPlatformCompatible: boolean
    historicalBuilderCompatible: boolean
  }
  confidence: {
    score: number
    reducingFactors: string[]
  }
  warnings: string[]
}

function formatPct(value: number | null) {
  return value === null ? 'n/a' : `${Number(value).toFixed(1)}%`
}

function metric(value: number | null | undefined) {
  return value === null || value === undefined ? 'n/a' : String(value)
}

function Badge({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'green' | 'blue' | 'yellow' | 'red' | 'slate' }) {
  const classes = {
    green: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
    blue: 'border-sky-500/30 bg-sky-500/10 text-sky-100',
    yellow: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
    red: 'border-red-500/30 bg-red-500/10 text-red-100',
    slate: 'border-slate-700 bg-slate-900 text-slate-100',
  }[tone]
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${classes}`}>{children}</span>
}

function momentumTone(value: string): 'green' | 'blue' | 'yellow' | 'red' | 'slate' {
  if (value === 'HOT') return 'green'
  if (value === 'POSITIVE') return 'blue'
  if (value === 'NEUTRAL') return 'yellow'
  if (value === 'COLD') return 'red'
  return 'slate'
}

export default function BsnIntelligencePanel() {
  const [data, setData] = useState<BsnIntelligenceResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch('/api/bsn/intelligence?includeValidation=true', { cache: 'no-store' })
        const json = await response.json()
        if (!response.ok || !json.success) throw new Error(json.error ?? 'Unable to load BSN intelligence.')
        setData(json)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load BSN intelligence.')
      }
    }
    load()
  }, [])

  const leagueTable = useMemo(() => {
    return [...(data?.teamProfiles ?? [])].sort((left, right) => (left.leaguePosition ?? 999) - (right.leaguePosition ?? 999) || (right.winPercentage ?? -1) - (left.winPercentage ?? -1))
  }, [data])

  if (error) return <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-4 text-sm text-red-100">{error}</div>
  if (!data) return <div className="h-64 animate-pulse rounded-lg bg-slate-900" />

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">BSN Intelligence</p>
          <h3 className="mt-2 text-2xl font-black text-white">{data.coverage.teams} team profiles</h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Generated from stored BSN teams, standings, completed games and player rows. Provider calls: {data.providerCallsMade}. Mutations: {data.remoteMutationsMade}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={data.validation.success ? 'green' : 'red'}>{data.validation.success ? 'Validated' : 'Issue'}</Badge>
          <Badge tone="blue">Confidence {data.confidence.score}</Badge>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Coverage</p>
          <p className="mt-2 text-2xl font-black text-white">{data.coverage.completedGames}</p>
          <p className="mt-1 text-xs text-slate-400">completed games</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Players</p>
          <p className="mt-2 text-2xl font-black text-white">{data.coverage.players}</p>
          <p className="mt-1 text-xs text-slate-400">profiles</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Features</p>
          <p className="mt-2 text-2xl font-black text-white">{data.features.generated}</p>
          <p className="mt-1 text-xs text-slate-400">generated, {data.features.populatedThisRun} writes</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Momentum</p>
          <p className="mt-2 text-2xl font-black text-white">{data.knowledge.leagueMomentum ? data.knowledge.leagueMomentum.averageMomentum : 'n/a'}</p>
          <p className="mt-1 text-xs text-slate-400">league average</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-sm font-black text-white">Power Rankings</p>
          <div className="mt-3 space-y-2">
            {data.knowledge.powerRankings.slice(0, 8).map((team) => (
              <div key={team.teamId} className="flex items-center justify-between gap-3 rounded-lg bg-slate-950/70 px-3 py-2 text-sm">
                <span className="font-bold text-white">#{team.rank ?? '-'} {team.teamName}</span>
                <span className="text-slate-300">Strength {metric(team.strengthScore)}</span>
              </div>
            ))}
            {!data.knowledge.powerRankings.length ? <p className="text-sm text-slate-400">Power rankings are not available yet.</p> : null}
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-sm font-black text-white">Momentum</p>
          <div className="mt-3 space-y-2">
            {data.teamProfiles.slice(0, 8).map((team) => (
              <div key={team.teamId} className="flex items-center justify-between gap-3 rounded-lg bg-slate-950/70 px-3 py-2 text-sm">
                <span className="font-bold text-white">{team.teamName}</span>
                <Badge tone={momentumTone(team.currentMomentum)}>{team.currentMomentum}</Badge>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-slate-800 bg-slate-900/70 p-4">
        <p className="text-sm font-black text-white">League Table</p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th className="py-2 pr-4">Team</th>
                <th className="py-2 pr-4">Record</th>
                <th className="py-2 pr-4">Win %</th>
                <th className="py-2 pr-4">Form</th>
                <th className="py-2 pr-4">Rank</th>
              </tr>
            </thead>
            <tbody className="text-slate-300">
              {leagueTable.map((team) => (
                <tr key={team.teamId} className="border-t border-slate-800">
                  <td className="py-2 pr-4 font-bold text-white">{team.teamName}</td>
                  <td className="py-2 pr-4">{team.currentRecord ? `${team.currentRecord.wins ?? '-'}-${team.currentRecord.losses ?? '-'}` : 'n/a'}</td>
                  <td className="py-2 pr-4">{formatPct(team.winPercentage)}</td>
                  <td className="py-2 pr-4">{team.recentForm?.join(' ') ?? 'n/a'}</td>
                  <td className="py-2 pr-4">{metric(team.powerRank)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-slate-800 bg-slate-950 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Limitations</p>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-400">
          {[...data.knowledge.unavailable, ...data.confidence.reducingFactors, ...data.warnings].slice(0, 6).map((warning) => <li key={warning}>{warning}</li>)}
        </ul>
      </div>
    </section>
  )
}