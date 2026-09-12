import Link from 'next/link'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { getMlbOperationalView } from '@/services/pick2-operational-read.service'
import { GameCard } from './MlbCards'
import { presentationStatus, type MlbView } from './mlb-presentation'
export function TodayContent({ view }: { view: MlbView }) {
 const official = view.board.rows.filter(r => presentationStatus(r) === 'OFFICIAL_PICK').length
 return <div className="mlb-ui mx-auto max-w-7xl space-y-6">
 <header className="rounded-2xl border border-slate-700/70 bg-gradient-to-br from-slate-900 to-slate-950 p-6 sm:p-8"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-300">MLB | {new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', timeZone: 'America/Puerto_Rico' }).format(new Date(view.date + 'T12:00:00Z'))}</p><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Your day in baseball.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">The matchup. The probability. The price. A clearer view of where the analysis stands.</p><div className="mt-6 flex flex-wrap items-center gap-3 text-sm"><span data-slate-count={view.games.length} className="rounded-full border border-slate-700 px-3 py-2">{view.games.length} games</span><span className="rounded-full border border-teal-400/30 px-3 py-2 text-teal-200">{official} Official Picks</span><Link href="/mlb-value-board" className="rounded-full bg-teal-300 px-4 py-2 font-semibold text-slate-950 hover:bg-teal-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-300">Explore Value Board</Link></div></header>
 {view.warnings.length > 0 && <div role="status" className="rounded-xl border border-amber-300/30 p-4 text-sm text-amber-100">Some game data is unavailable. Analysis may be incomplete. <Link href="/data-health" className="underline">Check Data Health</Link></div>}
 {!view.games.length ? <section className="rounded-2xl border border-slate-700 p-8"><h2 className="text-xl font-semibold">Today&apos;s games are not available yet</h2><p className="mt-2 text-sm text-slate-300">Waiting for the latest schedule and game data. This does not mean there are no games today.</p></section> : <section aria-label="Today's MLB games" className="grid items-start gap-5 lg:grid-cols-2 2xl:grid-cols-3">{view.games.map(game => <GameCard key={game.gamePk} game={game} rows={view.board.rows.filter(r => r.game_pk === game.gamePk)} />)}</section>}
 <p className="text-xs leading-5 text-slate-400">All times Puerto Rico. Prices are snapshots, not live sportsbook quotes. Official Picks meet the recommendation criteria; no outcome is guaranteed.</p>
 </div>
}
export default async function MlbToday() { return <DashboardShell><TodayContent view={await getMlbOperationalView()} /></DashboardShell> }
