import Link from 'next/link'
import type { Pick2MlbValueBoardRow } from '@/types/pick2-value-board'
import { type DisplayStatus, type MlbGame, labels, percent, price, prTime, presentationStatus, rowExplanation, freshness, gameMessage } from './mlb-presentation'

const tones: Record<DisplayStatus, string> = {
  OFFICIAL_PICK: 'border-teal-400/50 bg-teal-400/10 text-teal-200',
  VALUE_CANDIDATE: 'border-sky-400/40 bg-sky-400/10 text-sky-200',
  WATCHLIST: 'border-amber-300/30 bg-amber-300/5 text-amber-200',
  NO_EDGE: 'border-slate-600 bg-slate-800/50 text-slate-300',
  BLOCKED: 'border-slate-700 bg-slate-900 text-slate-300',
}
export function Classification({ status }: { status: DisplayStatus }) {
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${tones[status]}`}>{labels[status]}</span>
}
export function Metric({ label, value, prominent = false }: { label: string; value: string; prominent?: boolean }) {
  return <div className="min-w-0"><dt className="text-xs text-slate-400">{label}</dt><dd className={`mt-1 tabular-nums tracking-tight text-slate-100 ${prominent ? 'text-3xl font-semibold' : 'text-base font-semibold'}`}>{value}</dd></div>
}
export function EvidenceNote({ game }: { game: MlbGame }) {
  return <p className="text-xs leading-5 text-slate-400">Game data {game.evidenceAt ? `checked ${prTime(game.evidenceAt, true)}` : 'pending'} · Analysis {game.predictionAt ? prTime(game.predictionAt, true) : 'pending'}</p>
}
export function GameCard({ game, rows }: { game: MlbGame; rows: Pick2MlbValueBoardRow[] }) {
  return <article data-game-card={game.gamePk} className="min-w-0 rounded-2xl border border-slate-700/70 bg-slate-900/75 shadow-lg shadow-black/10">
    <header className="border-b border-slate-800 p-5"><div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300"><time dateTime={game.scheduledAt}>{prTime(game.scheduledAt)}</time><span>{gameMessage(game)}</span></div><h2 className="mt-3 text-xl font-semibold tracking-tight text-white">{game.away} <span className="font-normal text-slate-400">at</span> {game.home}</h2></header>
    <div className="grid grid-cols-2 divide-x divide-slate-800">{(['AWAY', 'HOME'] as const).map(side => {
      const row = rows.find(r => r.side === side), status = row ? presentationStatus(row) : null
      const market = side === 'AWAY' ? game.awayMarket : game.homeMarket
      const name = side === 'AWAY' ? game.away : game.home
      const highlight = !game.reason && (status === 'OFFICIAL_PICK' || status === 'VALUE_CANDIDATE')
      return <section aria-label={`${name} analysis`} key={side} className={`min-w-0 p-4 sm:p-5 ${highlight ? 'bg-teal-400/5' : ''}`}>
        <p className="text-xs text-slate-400">{side === 'AWAY' ? 'Away' : 'Home'}</p><h3 className="mt-1 min-h-12 text-sm font-semibold text-white">{name}</h3>
        <dl className="mt-3 space-y-4"><Metric prominent label="Model probability" value={percent(side === 'AWAY' ? game.awayProbability : game.homeProbability)} /><Metric label={row ? 'ML price · selected book' : 'Best available ML'} value={price(row?.american_odds ?? market?.americanOdds)} /><Metric label="Consensus probability" value={percent(row?.consensus_probability)} /><Metric label="Consensus edge" value={percent(row?.consensus_edge, true)} /><Metric label="EV per unit" value={percent(row?.unit_ev, true)} /></dl>
        <p className="mt-2 break-words text-xs text-slate-400">{row?.bookmaker_name ?? row?.best_book ?? market?.book ?? 'Price unavailable'}</p>
        <div className="mt-4">{status ? <Classification status={status} /> : <span className="text-xs text-slate-300">Analysis pending</span>}</div>
        <p className="mt-3 text-xs leading-5 text-slate-300">Starter: {side === 'AWAY' ? game.awayStarter : game.homeStarter}</p>
        <p className="mt-2 text-xs text-slate-400">{freshness(row?.market_freshness ?? market?.freshness)}{(row?.market_acquired_at ?? market?.acquiredAt) ? ` · ${prTime(row?.market_acquired_at ?? market?.acquiredAt)}` : ''}</p>
      </section>
    })}</div>
    <footer className="space-y-2 border-t border-slate-800 p-4"><EvidenceNote game={game} /><details className="text-xs text-slate-400"><summary className="cursor-pointer py-1 focus-visible:outline-2 focus-visible:outline-teal-300">How to read this game</summary><p className="mt-2 leading-5">A higher probability does not always mean better value. Consensus probability is not a single-book no-vig quote; that quote is unavailable in this view. Prices are recorded snapshots.</p>{rows.map(r => <p key={r.side} className="mt-2">{r.side === 'AWAY' ? game.away : game.home}: {rowExplanation(r)}</p>)}<Link className="mt-2 inline-block underline" href="/data-health">Data Health details</Link></details></footer>
  </article>
}
export function OpportunityCard({ row, game }: { row: Pick2MlbValueBoardRow; game?: MlbGame }) {
  const status = presentationStatus(row)
  return <article data-opportunity={`${row.game_pk}:${row.side}`} data-classification={status} className={`min-w-0 rounded-2xl border bg-slate-900/75 p-5 ${status === 'OFFICIAL_PICK' ? 'border-teal-400/50' : 'border-slate-700/70'}`}>
    <div className="flex flex-wrap items-center justify-between gap-3"><Classification status={status} /><time className="text-xs text-slate-300" dateTime={row.start_time ?? undefined}>{prTime(row.start_time)}</time></div>
    <h3 className="mt-4 text-lg font-semibold text-white">{row.away_team} <span className="text-slate-400">at</span> {row.home_team}</h3>
    <p className="mt-1 text-sm text-slate-300">{row.side === 'HOME' ? row.home_team : row.away_team} · {row.side === 'HOME' ? 'Home' : 'Away'} moneyline</p>
    <p className="mt-2 text-xs leading-5 text-slate-400">{game ? `${game.awayStarter} vs ${game.homeStarter}` : 'Starter details unavailable'}</p>
    <dl className="mt-5 grid grid-cols-2 gap-5 sm:grid-cols-4"><Metric prominent label="Model" value={percent(row.model_probability)} /><Metric prominent label="ML price" value={price(row.american_odds)} /><Metric label="Consensus edge" value={percent(row.consensus_edge, true)} /><Metric label="EV per unit" value={percent(row.unit_ev, true)} /></dl>
    <div className="mt-4 flex flex-wrap justify-between gap-2 text-xs text-slate-300"><span>{row.bookmaker_name ?? row.best_book}</span><span>Consensus {percent(row.consensus_probability)}</span></div>
    <p className="mt-4 border-t border-slate-800 pt-4 text-sm leading-6 text-slate-300">{rowExplanation(row)}</p>
    <p className="mt-2 text-xs text-slate-400">{freshness(row.market_freshness)} · Recorded {prTime(row.market_acquired_at, true)}</p>
    <details className="mt-3 text-xs text-slate-400"><summary className="cursor-pointer py-2 focus-visible:outline-2 focus-visible:outline-teal-300">Analysis context</summary><p>Analysis {prTime(row.prediction_as_of, true)} · Evaluation {prTime(row.evaluated_at, true)}</p><p className="mt-2">Single-book no-vig probability is unavailable in this view. Consensus and edge are the recorded analysis values.</p><Link href="/data-health" className="mt-2 inline-block underline">View data and risk diagnostics</Link></details>
  </article>
}
