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
  if (value === '—') return null
  return <div className="min-w-0"><dt className="text-xs text-slate-400">{label}</dt><dd className={`mt-1 tabular-nums tracking-tight text-slate-100 ${prominent ? 'text-3xl font-semibold' : 'text-base font-semibold'}`}>{value}</dd></div>
}

export function EvidenceNote({ game }: { game: MlbGame }) {
  return <p className="text-xs leading-5 text-slate-400">Game data {game.evidenceAt ? `checked ${prTime(game.evidenceAt, true)}` : 'pending'} · Analysis {game.predictionAt ? prTime(game.predictionAt, true) : 'pending'}</p>
}

function DecisionContext({ row }: { row: Pick2MlbValueBoardRow }) {
  const status = presentationStatus(row)
  if (status !== 'OFFICIAL_PICK' && status !== 'VALUE_CANDIDATE') return null
  const title = status === 'OFFICIAL_PICK' ? `Why ${row.side === 'HOME' ? row.home_team : row.away_team} was an Official Pick` : `Why ${row.side === 'HOME' ? row.home_team : row.away_team} is a Value Candidate`
  const risks = [...new Set([...row.risk_explanation, ...row.blocker_explanation])]
  return (
    <section className={`rounded-xl border p-4 ${status === 'OFFICIAL_PICK' ? 'border-teal-400/30 bg-teal-400/5' : 'border-sky-400/20 bg-sky-400/5'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-white">{title}</p>
        {status === 'OFFICIAL_PICK' && row.decision_at ? <span className="text-xs font-semibold text-teal-200">Certified {prTime(row.decision_at, true)}</span> : null}
      </div>
      <ul className="mt-3 space-y-1 text-xs leading-5 text-slate-300">
        {row.why.slice(0, 4).map((item) => <li key={item}>• {item}</li>)}
      </ul>
      {risks.length > 0 ? (
        <div className="mt-3 border-t border-slate-800 pt-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-300">{status === 'OFFICIAL_PICK' ? 'Current conditions / decision-time risk' : 'Why it is not official'}</p>
          <ul className="mt-2 space-y-1 text-xs leading-5 text-amber-100/90">
            {risks.slice(0, 4).map((item) => <li key={item}>• {item}</li>)}
          </ul>
        </div>
      ) : null}
      <p className="mt-3 text-[11px] leading-5 text-slate-500">
        {status === 'OFFICIAL_PICK'
          ? 'The certified decision is immutable. Later market movement or stale quotes can make the original price unavailable without erasing the pick.'
          : 'Value Candidate is research/display status only and is not an Official Pick.'}
      </p>
    </section>
  )
}

export function GameCard({ game, rows }: { game: MlbGame; rows: Pick2MlbValueBoardRow[] }) {
  const primaryRows = (['AWAY', 'HOME'] as const)
    .map((side) => rows.find((row) => row.side === side))
    .filter((row): row is Pick2MlbValueBoardRow => Boolean(row))

  return <article data-game-card={game.gamePk} className="min-w-0 rounded-2xl border border-slate-700/70 bg-slate-900/75 shadow-lg shadow-black/10">
    <header className="border-b border-slate-800 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300"><time dateTime={game.scheduledAt}>{prTime(game.scheduledAt)}</time><span>{gameMessage(game)}</span></div>
      <h2 className="mt-2 text-lg font-semibold tracking-tight text-white">{game.away} <span className="font-normal text-slate-400">at</span> {game.home}</h2>
    </header>

    <div className="grid grid-cols-2 divide-x divide-slate-800">{(['AWAY', 'HOME'] as const).map(side => {
      const row = rows.find(r => r.side === side), status = row ? presentationStatus(row) : null
      const market = side === 'AWAY' ? game.awayMarket : game.homeMarket
      const name = side === 'AWAY' ? game.away : game.home
      const highlight = status === 'OFFICIAL_PICK' || (!game.reason && status === 'VALUE_CANDIDATE')
      const selectedBook = row?.bookmaker_name ?? row?.best_book ?? market?.book
      return <section aria-label={`${name} analysis`} key={side} className={`min-w-0 p-4 sm:p-5 ${highlight ? 'bg-teal-400/5' : ''}`}>
        <p className="text-xs text-slate-400">{side === 'AWAY' ? 'Away' : 'Home'}</p>
        <h3 className="mt-1 text-sm font-semibold text-white">{name}</h3>

        <dl className="mt-3 grid gap-3">
          <Metric prominent label="Model probability" value={percent(side === 'AWAY' ? game.awayProbability : game.homeProbability)} />
          <Metric label={row ? (status === 'OFFICIAL_PICK' ? 'Certified ML price' : 'ML price · selected book') : 'Best available ML'} value={price(row?.american_odds ?? market?.americanOdds)} />
          <Metric label="Consensus probability · at evaluation" value={percent(row?.consensus_probability)} />
          <Metric label="Consensus edge · at evaluation" value={percent(row?.consensus_edge, true)} />
          <Metric label="EV per unit · at evaluation" value={percent(row?.unit_ev, true)} />
        </dl>

        {selectedBook && <p className="mt-2 break-words text-xs text-slate-400">{selectedBook}</p>}

        <div className="mt-3">{status ? <Classification status={status} /> : game.analysisAvailable ? (
          <span className="text-xs font-medium text-slate-200">
            {game.forwardPickStatus === 'PICK' && game.forwardRecommendedSide === side
              ? `Forward model signal${game.forwardRouteId ? ` · Route ${game.forwardRouteId}` : ''} · not an Official Pick`
              : 'Model evaluated · no certified market classification'}
          </span>
        ) : <span className="text-xs text-slate-300">Analysis pending</span>}</div>

        {status === 'OFFICIAL_PICK' && row?.decision_at ? (
          <p className="mt-2 text-xs font-semibold leading-5 text-teal-200">Certified {prTime(row.decision_at, true)} at {selectedBook ?? 'selected book'} {price(row.american_odds)}</p>
        ) : null}

        <p className="mt-2 text-xs leading-5 text-slate-300">Starter: {side === 'AWAY' ? game.awayStarter : game.homeStarter}</p>
        <p className="mt-2 text-xs text-slate-400">Current market: {freshness(row?.market_freshness ?? market?.freshness)}{(row?.market_acquired_at ?? market?.acquiredAt) ? ` · last stored ${prTime(row?.market_acquired_at ?? market?.acquiredAt)}` : ''}</p>
        {row ? <p className="mt-2 text-xs leading-5 text-slate-400">{rowExplanation(row)}</p> : null}
      </section>
    })}</div>

    {primaryRows.some((row) => ['OFFICIAL_PICK', 'VALUE_CANDIDATE'].includes(presentationStatus(row))) ? (
      <div className="grid gap-3 border-t border-slate-800 p-4">
        {primaryRows.map((row) => <DecisionContext key={`${row.game_pk}:${row.side}`} row={row} />)}
      </div>
    ) : null}

    <footer className="border-t border-slate-800 px-4 py-3">
      <EvidenceNote game={game} />
      {rows.some(r => r.blocker_codes.length > 0) && !primaryRows.some((row) => presentationStatus(row) === 'OFFICIAL_PICK') ? (
        <p className="mt-1 text-xs text-slate-300">{[...new Set(rows.filter(r => r.blocker_codes.length > 0).map(rowExplanation))].join(' · ')}</p>
      ) : null}
    </footer>
  </article>
}

export function OpportunityCard({ row, game }: { row: Pick2MlbValueBoardRow; game?: MlbGame }) {
  const status = presentationStatus(row)
  return <article data-opportunity={`${row.game_pk}:${row.side}`} data-classification={status} className={`min-w-0 rounded-2xl border bg-slate-900/75 p-5 ${status === 'OFFICIAL_PICK' ? 'border-teal-400/50' : 'border-slate-700/70'}`}>
    <div className="flex flex-wrap items-center justify-between gap-3"><Classification status={status} /><time className="text-xs text-slate-300" dateTime={row.start_time ?? undefined}>{prTime(row.start_time)}</time></div>
    <h3 className="mt-4 text-lg font-semibold text-white">{row.away_team} <span className="text-slate-400">at</span> {row.home_team}</h3>
    <p className="mt-1 text-sm text-slate-300">{row.side === 'HOME' ? row.home_team : row.away_team} · {row.side === 'HOME' ? 'Home' : 'Away'} moneyline</p>
    {status === 'OFFICIAL_PICK' && row.decision_at ? <p className="mt-2 text-sm font-semibold text-teal-200">Certified {prTime(row.decision_at, true)} · {row.bookmaker_name ?? row.best_book} {price(row.american_odds)}</p> : null}
    <p className="mt-2 text-xs leading-5 text-slate-400">{game ? `${game.awayStarter} vs ${game.homeStarter}` : 'Starter details unavailable'}</p>
    <dl className="mt-5 grid grid-cols-2 gap-5 sm:grid-cols-4"><Metric prominent label="Model" value={percent(row.model_probability)} /><Metric prominent label={status === 'OFFICIAL_PICK' ? 'Certified ML price' : 'ML price'} value={price(row.american_odds)} /><Metric label="Consensus edge · at evaluation" value={percent(row.consensus_edge, true)} /><Metric label="EV per unit · at evaluation" value={percent(row.unit_ev, true)} /></dl>
    <div className="mt-4 flex flex-wrap justify-between gap-2 text-xs text-slate-300"><span>{row.bookmaker_name ?? row.best_book}</span><span>Consensus {percent(row.consensus_probability)}</span></div>
    <p className="mt-4 border-t border-slate-800 pt-4 text-sm leading-6 text-slate-300">{rowExplanation(row)}</p>
    <DecisionContext row={row} />
    <p className="mt-3 text-xs text-slate-400">Current market: {freshness(row.market_freshness)} · stored {prTime(row.market_acquired_at, true)}</p>
    <details className="mt-3 text-xs text-slate-400"><summary className="cursor-pointer py-2 focus-visible:outline-2 focus-visible:outline-teal-300">Analysis context</summary><p>Analysis {prTime(row.prediction_as_of, true)} · Evaluation {prTime(row.evaluated_at, true)}</p><p className="mt-2">Single-book no-vig probability is unavailable in this view. Consensus and edge are the recorded analysis values at evaluation time.</p><Link href="/data-health" className="mt-2 inline-block underline">View data and risk diagnostics</Link></details>
  </article>
}
