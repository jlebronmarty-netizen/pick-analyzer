import Link from 'next/link'
import DashboardShell from '@/components/dashboard/DashboardShell'
import MlbValueBoardClient from './MlbValueBoardClient'
import { getMlbOperationalView } from '@/services/pick2-operational-read.service'

const probability = (value: number | null) => value === null ? 'Unavailable' : `${(value * 100).toFixed(1)}%`
export default async function MlbToday() {
  const view = await getMlbOperationalView()
  return <DashboardShell><div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
    <header><p className="text-sm text-emerald-300">MLB · {view.date} · Puerto Rico</p><h1 className="text-3xl font-bold text-white">Today</h1><p className="mt-2 text-slate-300">Stored game evidence, model probabilities and market value. Prices are snapshots, not live sportsbook quotes.</p><nav className="mt-3 flex flex-wrap gap-4 text-sm text-emerald-300"><Link href="/mlb-value-board">Value Board</Link><Link href="/data-health">Data Health</Link><Link href="/performance">Performance</Link></nav></header>
    {view.warnings.map(w => <p key={w} role="status" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-100">{w}</p>)}
    <section aria-label="Today's MLB games" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{view.games.map(g => <article key={g.gamePk} className="rounded-xl border border-slate-700 bg-slate-900 p-5">
      <div className="flex justify-between gap-3 text-xs text-slate-400"><time dateTime={g.scheduledAt}>{new Date(g.scheduledAt).toLocaleTimeString('en-US', { timeZone: 'America/Puerto_Rico', hour: 'numeric', minute: '2-digit' })} PR</time><span>{g.status}</span></div>
      <h2 className="mt-3 text-lg font-bold text-white">{g.away} @ {g.home}</h2><p className="mt-2 text-sm text-slate-300">Starters: {g.awayStarter} / {g.homeStarter}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-slate-400">Away model probability</dt><dd className="text-white">{probability(g.awayProbability)}</dd></div><div><dt className="text-slate-400">Home model probability</dt><dd className="text-white">{probability(g.homeProbability)}</dd></div></dl>
      <div className="mt-3 space-y-1 text-sm text-slate-300">{[['Away', g.awayMarket], ['Home', g.homeMarket]].map(([side, market]) => typeof market === 'object' && market ? <p key={String(side)}>{String(side)} price: {market.americanOdds > 0 ? '+' : ''}{market.americanOdds} · {market.book} · {market.freshness}<span className="block text-xs text-slate-400">Acquired {market.acquiredAt}</span></p> : <p key={String(side)}>{String(side)} price unavailable</p>)}</div>
      {g.reason && <p className="mt-3 text-sm text-amber-200">Blocked: {g.reason.replaceAll('_', ' ').toLowerCase()}</p>}
      <p className="mt-3 break-words text-xs text-slate-400">Game evidence: {g.evidenceAt}. Prediction: {g.predictionAt ?? 'not available'}.</p>
    </article>)}</section>
    <MlbValueBoardClient board={view.board} />
  </div></DashboardShell>
}
