'use client'

import { useEffect, useMemo, useState } from 'react'

type Game = {
  eventId: string
  matchup: string
  scheduledTime: string | null
  homeTeam: string | null
  awayTeam: string | null
  coverage: {
    confirmedStarters: number
    probableStarters: number
    expectedStarters: number
    unavailableStarters: number
    confirmedLineups: number
    expectedLineups: number
    eligiblePitchers: number
    eligibleBatters: number
  }
  playerProjections: number
  playerIntelligenceAvailable: boolean
}

type ApiData = {
  selectedDate: string
  summary: {
    games: number
    confirmedStarters: number
    probableStarters: number
    expectedStarters: number
    confirmedLineups: number
    expectedLineups: number
    eligiblePitchers: number
    eligibleBatters: number
    playerProjectionsGenerated: number
    pitcherProjections: number
    batterProjections: number
    blockedProjections: number
  }
  games: Game[]
  blockers: string[]
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  )
}

export default function MlbGameIntelligencePageClient() {
  const [data, setData] = useState<ApiData | null>(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetch('/api/mlb/game-intelligence', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`Game Intelligence failed (${response.status})`)
        return response.json()
      })
      .then((json) => active && setData(json))
      .catch((loadError) => active && setError(loadError instanceof Error ? loadError.message : 'Unable to load Game Intelligence'))
    return () => {
      active = false
    }
  }, [])

  const games = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return needle ? (data?.games ?? []).filter((game) => `${game.matchup} ${game.homeTeam} ${game.awayTeam}`.toLowerCase().includes(needle)) : data?.games ?? []
  }, [data, query])

  if (error) return <main className="min-h-screen bg-slate-950 p-6 text-red-100">{error}</main>
  if (!data) return <main className="min-h-screen bg-slate-950 p-6 text-slate-300">Loading MLB Game Intelligence...</main>

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="border-b border-slate-800 pb-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">MLB Game Intelligence</p>
          <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <h1 className="text-3xl font-black md:text-5xl">Today&apos;s Games</h1>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter matchup" className="w-full rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 text-sm font-bold text-white outline-none focus:border-emerald-400 md:w-80" />
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4 xl:grid-cols-6">
          <Metric label="Games" value={data.summary.games} />
          <Metric label="Eligible Batters" value={data.summary.eligibleBatters} />
          <Metric label="Expected Lineups" value={data.summary.expectedLineups} />
          <Metric label="Confirmed Starters" value={data.summary.confirmedStarters} />
          <Metric label="Player Projections" value={data.summary.playerProjectionsGenerated} />
          <Metric label="Blocked" value={data.summary.blockedProjections} />
        </div>

        <section className="mt-5 grid gap-4 lg:grid-cols-2">
          {games.map((game) => (
            <article key={game.eventId} className="rounded-lg border border-slate-800 bg-slate-900/75 p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{game.scheduledTime ? new Date(game.scheduledTime).toLocaleString() : 'Time TBD'}</p>
                  <h2 className="mt-2 text-xl font-black text-white">{game.matchup}</h2>
                </div>
                <a href={`/game-intelligence/${encodeURIComponent(game.eventId)}`} className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-black text-emerald-100 hover:bg-emerald-500/20">Open</a>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Metric label="Eligible Batters" value={game.coverage.eligibleBatters} />
                <Metric label="Expected Lineups" value={game.coverage.expectedLineups} />
                <Metric label="Projections" value={game.playerProjections} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-black uppercase">
                <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-sky-100">{game.playerIntelligenceAvailable ? 'Player Intelligence Available' : 'Player Intelligence Blocked'}</span>
                <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-slate-200">{game.coverage.confirmedLineups} Confirmed Lineups</span>
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-amber-100">{game.coverage.unavailableStarters} Starter Blocks</span>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  )
}
