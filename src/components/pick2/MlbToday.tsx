import Link from 'next/link'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { getMlbOperationalView } from '@/services/pick2-operational-read.service'
import MlbSlate from './MlbSlate'
import { type MlbView } from './mlb-presentation'
export function TodayContent({ view }: { view: MlbView }) {
 // Summaries and filters derive only from the supplied canonical snapshot.
 return <div className="mlb-ui mx-auto max-w-7xl space-y-6">
 <header className="rounded-2xl border border-slate-700/70 bg-gradient-to-br from-slate-900 to-slate-950 p-4 sm:p-5"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-300">MLB | {new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', timeZone: 'America/Puerto_Rico' }).format(new Date(view.date + 'T12:00:00Z'))}</p><h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Your day in baseball.</h1></header>
 {view.warnings.length > 0 && <div role="status" className="rounded-xl border border-amber-300/30 p-4 text-sm text-amber-100">Some game data is unavailable. Analysis may be incomplete. <Link href="/data-health" className="underline">Check Data Health</Link></div>}
 <details className="text-xs leading-5 text-slate-300"><summary className="w-fit cursor-pointer rounded py-2 focus-visible:outline-2 focus-visible:outline-teal-300">About probabilities and prices</summary><p className="mt-1 max-w-2xl">Higher probability does not always mean better value. Consensus probability is not a single-book no-vig quote; that quote is unavailable in this view. Edge and EV appear only when supplied by the canonical analysis. Prices are recorded snapshots.</p></details>
 {!view.games.length ? <section className="rounded-xl border border-slate-700 p-5"><h2 className="font-semibold">Today&apos;s games are not available yet</h2><p className="mt-2 text-sm text-slate-300">Waiting for the latest schedule and game data. This does not mean there are no games today.</p></section> : <MlbSlate view={view} />}
 <p className="text-xs leading-5 text-slate-400">All times Puerto Rico. Prices are snapshots, not live sportsbook quotes. Official Picks meet the recommendation criteria; no outcome is guaranteed.</p>
 </div>
}
export default async function MlbToday() { return <DashboardShell><TodayContent view={await getMlbOperationalView()} /></DashboardShell> }
