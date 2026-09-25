'use client'

import { useState } from 'react'
import { GameCard } from './MlbCards'
import { hasMetric, matchesSlateFilter, presentationStatus, slateFilters, type MlbView, type SlateFilter } from './mlb-presentation'

export default function MlbSlate({ view }: { view: MlbView }) {
  const [filter, setFilter] = useState<SlateFilter>('All')
  const rows = view.board.rows
  const games = view.games.filter(game => matchesSlateFilter(game, rows, filter))
  const summary = [
    ['Games', view.games.length],
    ['Analyzed', view.games.filter(game => game.analysisAvailable || (hasMetric(game.homeProbability) && hasMetric(game.awayProbability))).length],
    ['Official Picks', rows.filter(row => presentationStatus(row) === 'OFFICIAL_PICK').length],
    ['Value Candidates', rows.filter(row => presentationStatus(row) === 'VALUE_CANDIDATE').length],
    ['Waiting', view.games.filter(game => matchesSlateFilter(game, rows, 'Waiting')).length],
  ] as const
  return <section aria-label="Current MLB slate" className="space-y-4">
    <dl aria-label="Current slate summary" className="grid grid-cols-5 gap-1.5 sm:gap-3">{summary.map(([label, count]) => <div key={label} className="min-w-0 rounded-xl border border-slate-700 bg-slate-900 px-2 py-2.5 sm:p-3"><dt className="min-h-8 text-[11px] leading-4 text-slate-300 sm:text-xs">{label}</dt><dd data-slate-summary={label} className="mt-1 text-xl font-semibold tabular-nums">{count}</dd></div>)}</dl>
    <p className="text-xs text-slate-400">Analyzed = model available. Picks and value count team sides. Waiting excludes started games.</p>
    <div role="group" aria-label="Filter today's games" className="flex flex-wrap gap-2">{slateFilters.map(item => <button key={item} type="button" aria-pressed={filter === item} onClick={() => setFilter(item)} className={`min-h-11 rounded-full border px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300 ${filter === item ? 'border-teal-300 bg-teal-400/10 text-teal-200' : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-400'}`}>{item}</button>)}</div>
    <p role="status" className="text-xs text-slate-400">{games.length} of {view.games.length} games · {filter}</p>
    {games.length ? <div aria-label="Today's MLB games" className="grid items-start gap-4 lg:grid-cols-2 2xl:grid-cols-3">{games.map(game => <GameCard key={game.gamePk} game={game} rows={rows.filter(row => row.game_pk === game.gamePk)} />)}</div> : <p className="rounded-xl border border-slate-700 p-4 text-sm text-slate-300">No games match this filter. <button type="button" onClick={() => setFilter('All')} className="underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-teal-300">Show all games</button></p>}
  </section>
}
