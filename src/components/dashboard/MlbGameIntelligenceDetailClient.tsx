'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

type DetailProps = {
  eventId: string
}

type ApiData = {
  event: { homeTeam: string | null; awayTeam: string | null; startTime: string | null; status: string | null; venue: string | null }
  gameExperience: {
    tabs: string[]
    overview: { matchup: string; playerIntelligenceAvailable: boolean; bettingActivation: boolean }
    teamProjections: Record<string, unknown>
    startingPitchers: Record<string, { playerName: string | null; status: string; confidence: number; blockerReasons: string[] }> | null
    expectedLineups: Record<string, Array<{ playerName: string; status: string; confidence: number; battingOrder: number | null; position: string | null }>> | null
    playerProjections: { total: number; pitchers: Projection[]; batters: Projection[]; noBettingActivation: boolean }
    markets: Array<{ marketLabel: string; selection: string; line: number | null; sportsbook: string; semanticLabel: string; officialEligibility: string }>
    aiExplanation: { positiveFactors: string[]; negativeFactors: string[]; unavailableInputs: string[]; dataQuality: Record<string, number> }
    performance: { projectionHistoryRows: number; settledProjectionRows: number }
  }
}

type Projection = {
  projectionId: string
  playerName: string
  projectionLabel?: string
  expectedValue: number | null
  lowRange: number | null
  highRange: number | null
  confidence: number
  lineupStatus?: string | null
}

const tabs = ['Overview', 'Team Projections', 'Starting Pitchers', 'Expected Lineups', 'Player Projections', 'Markets', 'AI Explanation', 'Performance'] as const

function Panel({ children }: { children: ReactNode }) {
  return <section className="rounded-lg border border-slate-800 bg-slate-900/75 p-5">{children}</section>
}

function ProjectionTable({ rows }: { rows: Projection[] }) {
  if (!rows.length) return <p className="text-sm text-slate-400">No projections available for this group.</p>
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-[0.14em] text-slate-500">
          <tr><th className="py-2">Player</th><th>Projection</th><th>Expected</th><th>Range</th><th>Confidence</th><th>Lineup</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-800 text-slate-200">
          {rows.map((row) => (
            <tr key={row.projectionId}>
              <td className="py-3 font-bold text-white">
                <a href={`/player-projections/${encodeURIComponent(row.projectionId)}`} className="text-white underline decoration-slate-600 underline-offset-4 hover:text-emerald-100 hover:decoration-emerald-300">{row.playerName}</a>
              </td>
              <td>{row.projectionLabel}</td>
              <td>{row.expectedValue ?? 'N/A'}</td>
              <td>{row.lowRange ?? 'N/A'}-{row.highRange ?? 'N/A'}</td>
              <td>{Math.round(row.confidence)}%</td>
              <td>{row.lineupStatus ?? 'N/A'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function MlbGameIntelligenceDetailClient({ eventId }: DetailProps) {
  const [data, setData] = useState<ApiData | null>(null)
  const [active, setActive] = useState<(typeof tabs)[number]>('Overview')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch(`/api/games/${encodeURIComponent(eventId)}/intelligence`, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`Game detail failed (${response.status})`)
        return response.json()
      })
      .then((json) => alive && setData(json))
      .catch((loadError) => alive && setError(loadError instanceof Error ? loadError.message : 'Unable to load game intelligence'))
    return () => {
      alive = false
    }
  }, [eventId])

  const allPlayerRows = useMemo(() => [...(data?.gameExperience.playerProjections.pitchers ?? []), ...(data?.gameExperience.playerProjections.batters ?? [])], [data])

  if (error) return <main className="min-h-screen bg-slate-950 p-6 text-red-100">{error}</main>
  if (!data) return <main className="min-h-screen bg-slate-950 p-6 text-slate-300">Loading game intelligence...</main>

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white md:px-8">
      <div className="mx-auto max-w-7xl">
        <nav className="flex flex-wrap gap-2 text-sm font-bold text-slate-400" aria-label="Breadcrumb">
          <a href="/dashboard" className="text-emerald-200 hover:text-emerald-100">Dashboard</a>
          <span>/</span>
          <a href="/game-intelligence" className="text-emerald-200 hover:text-emerald-100">Games</a>
          <span>/</span>
          <span className="text-slate-300">Game Intelligence</span>
        </nav>
        <div className="mt-4 border-b border-slate-800 pb-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">Game Intelligence</p>
          <h1 className="mt-2 text-3xl font-black md:text-5xl">{data.gameExperience.overview.matchup}</h1>
          <p className="mt-2 text-sm text-slate-400">{data.event.startTime ? new Date(data.event.startTime).toLocaleString() : 'Time TBD'} - {data.event.venue ?? 'Venue TBD'} - {data.event.status ?? 'Status TBD'}</p>
        </div>
        <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button key={tab} onClick={() => setActive(tab)} className={`whitespace-nowrap rounded-lg border px-4 py-2 text-sm font-black ${active === tab ? 'border-emerald-400 bg-emerald-500/15 text-emerald-100' : 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'}`}>{tab}</button>
          ))}
        </div>

        <div className="mt-5">
          {active === 'Overview' && (
            <Panel>
              <div className="grid gap-4 md:grid-cols-3">
                <p className="rounded-lg bg-slate-950 p-4 text-sm text-slate-300">Player Intelligence<span className="block text-2xl font-black text-white">{data.gameExperience.overview.playerIntelligenceAvailable ? 'Available' : 'Blocked'}</span></p>
                <p className="rounded-lg bg-slate-950 p-4 text-sm text-slate-300">Player Projections<span className="block text-2xl font-black text-white">{data.gameExperience.playerProjections.total}</span></p>
                <p className="rounded-lg bg-slate-950 p-4 text-sm text-slate-300">Betting Activation<span className="block text-2xl font-black text-white">{data.gameExperience.overview.bettingActivation ? 'On' : 'Off'}</span></p>
              </div>
            </Panel>
          )}
          {active === 'Team Projections' && <Panel><pre className="overflow-auto text-xs text-slate-300">{JSON.stringify(data.gameExperience.teamProjections, null, 2)}</pre></Panel>}
          {active === 'Starting Pitchers' && <Panel><pre className="overflow-auto text-xs text-slate-300">{JSON.stringify(data.gameExperience.startingPitchers, null, 2)}</pre></Panel>}
          {active === 'Expected Lineups' && (
            <Panel>
              <div className="grid gap-4 lg:grid-cols-2">
                {Object.entries(data.gameExperience.expectedLineups ?? {}).map(([side, lineup]) => (
                  <div key={side}>
                    <h2 className="text-lg font-black capitalize">{side}</h2>
                    <div className="mt-3 space-y-2">
                      {lineup.map((player) => <p key={`${side}-${player.playerName}-${player.battingOrder}`} className="rounded-lg bg-slate-950 p-3 text-sm text-slate-300">{player.battingOrder ?? '-'} - <a href={`/player-projections?search=${encodeURIComponent(player.playerName)}`} className="font-bold text-white underline decoration-slate-600 underline-offset-4 hover:text-emerald-100 hover:decoration-emerald-300">{player.playerName}</a> - {player.position ?? 'POS'} - {player.status} - {player.confidence}%</p>)}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}
          {active === 'Player Projections' && <Panel><ProjectionTable rows={allPlayerRows} /></Panel>}
          {active === 'Markets' && <Panel><pre className="overflow-auto text-xs text-slate-300">{JSON.stringify(data.gameExperience.markets, null, 2)}</pre></Panel>}
          {active === 'AI Explanation' && <Panel><pre className="overflow-auto text-xs text-slate-300">{JSON.stringify(data.gameExperience.aiExplanation, null, 2)}</pre></Panel>}
          {active === 'Performance' && <Panel><pre className="overflow-auto text-xs text-slate-300">{JSON.stringify(data.gameExperience.performance, null, 2)}</pre></Panel>}
        </div>
      </div>
    </main>
  )
}
