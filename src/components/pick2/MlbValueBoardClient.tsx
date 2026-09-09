'use client'

import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  Pick2MlbValueBoardContract,
  Pick2MlbValueBoardRow,
  Pick2MlbValueBoardSide,
  Pick2MlbValueBoardSortOption,
  Pick2MlbValueBoardStatus,
} from '@/types/pick2-value-board'

type FilterState = {
  status: 'ALL' | Pick2MlbValueBoardStatus
  team: string
  side: 'ALL' | Pick2MlbValueBoardSide
  bookmaker: string
  starter: string
  freshness: string
  minEdge: string
  minEv: string
  risk: string
}

const initialFilters: FilterState = {
  status: 'ALL',
  team: '',
  side: 'ALL',
  bookmaker: '',
  starter: 'ALL',
  freshness: 'ALL',
  minEdge: '',
  minEv: '',
  risk: '',
}

const statusLabels: Record<Pick2MlbValueBoardStatus, string> = {
  OFFICIAL_PICK: 'Official Picks',
  VALUE_CANDIDATE: 'Value Candidates',
  WATCHLIST: 'Watchlist',
  BLOCKED: 'Blocked',
}

const statusStyles: Record<Pick2MlbValueBoardStatus, string> = {
  OFFICIAL_PICK: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100',
  VALUE_CANDIDATE: 'border-sky-400/40 bg-sky-400/10 text-sky-100',
  WATCHLIST: 'border-amber-400/40 bg-amber-400/10 text-amber-100',
  BLOCKED: 'border-rose-400/40 bg-rose-400/10 text-rose-100',
}

const sortOptions: Array<{ label: string; value: Pick2MlbValueBoardSortOption['key'] }> = [
  { label: 'Board Priority', value: 'board_priority' },
  { label: 'Edge', value: 'consensus_edge' },
  { label: 'EV', value: 'unit_ev' },
  { label: 'Model Probability', value: 'model_probability' },
  { label: 'Start Time', value: 'start_time' },
  { label: 'Best Odds', value: 'american_odds' },
]

const controlClass = 'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-bold normal-case text-slate-100 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/40'

function percent(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'N/A'
  return `${(Number(value) * 100).toFixed(1)}%`
}

function signedPercent(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'N/A'
  const numeric = Number(value) * 100
  return `${numeric >= 0 ? '+' : ''}${numeric.toFixed(1)}%`
}

function american(value: number) {
  return value > 0 ? `+${value}` : `${value}`
}

function shortTime(value: string | null) {
  if (!value) return 'TBD'
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Puerto_Rico',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function matchesFilters(row: Pick2MlbValueBoardRow, filters: FilterState) {
  const teamNeedle = filters.team.trim().toLowerCase()
  const minEdge = filters.minEdge === '' ? null : Number(filters.minEdge) / 100
  const minEv = filters.minEv === '' ? null : Number(filters.minEv) / 100
  const riskNeedle = filters.risk.trim().toLowerCase()

  return (filters.status === 'ALL' || row.status === filters.status) &&
    (!teamNeedle || `${row.home_team} ${row.away_team}`.toLowerCase().includes(teamNeedle)) &&
    (filters.side === 'ALL' || row.side === filters.side) &&
    (!filters.bookmaker || row.best_book === filters.bookmaker) &&
    (filters.starter === 'ALL' || row.starter_status === filters.starter) &&
    (filters.freshness === 'ALL' || row.market_freshness === filters.freshness) &&
    (minEdge === null || row.consensus_edge >= minEdge) &&
    (minEv === null || row.unit_ev >= minEv) &&
    (!riskNeedle || row.risk_flags.some((flag) => flag.toLowerCase().includes(riskNeedle)))
}

function sortRows(rows: Pick2MlbValueBoardRow[], sortKey: Pick2MlbValueBoardSortOption['key']) {
  return [...rows].sort((a, b) => {
    if (sortKey === 'board_priority') return a.board_rank - b.board_rank
    if (sortKey === 'start_time') return String(a.start_time ?? '').localeCompare(String(b.start_time ?? ''))
    return Number(b[sortKey]) - Number(a[sortKey])
  })
}

function EmptyState({ status }: { status: Pick2MlbValueBoardStatus }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-400">
      No {statusLabels[status].toLowerCase()} in the current stored evidence.
    </div>
  )
}

function BoardCard({ row }: { row: Pick2MlbValueBoardRow }) {
  return (
    <article className="rounded-lg border border-slate-800 bg-slate-900/80 p-4 shadow-sm shadow-black/20">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-md border px-2 py-1 text-xs font-black uppercase ${statusStyles[row.status]}`}>{row.status.replaceAll('_', ' ')}</span>
            <span className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-slate-300">{row.market_freshness}</span>
          </div>
          <h2 className="mt-3 text-lg font-black text-white">{row.away_team} @ {row.home_team}</h2>
          <p className="mt-1 text-sm text-slate-400">{shortTime(row.start_time)} · {row.side} · {row.best_book} {american(row.american_odds)}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-right sm:min-w-72">
          <Metric label="Edge" value={signedPercent(row.consensus_edge)} />
          <Metric label="EV" value={signedPercent(row.unit_ev)} />
          <Metric label="Model" value={percent(row.model_probability)} />
          <Metric label="Value Score" value={row.value_score.toFixed(1)} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div>
          <p className="text-xs font-black uppercase text-slate-500">Why</p>
          <ul className="mt-2 space-y-1 text-sm leading-5 text-slate-300">
            {row.why.slice(0, 3).map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
        <div>
          <p className="text-xs font-black uppercase text-slate-500">Risk</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(row.risk_flags.length ? row.risk_flags : ['NONE']).map((flag) => (
              <span key={flag} className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-slate-300">{flag.replaceAll('_', ' ')}</span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-black uppercase text-slate-500">Market</p>
          <p className="mt-2 text-sm leading-5 text-slate-300">
            Consensus {percent(row.consensus_probability)} · {row.book_count} books · dispersion {percent(row.market_dispersion)}
          </p>
        </div>
      </div>

      <details className="mt-4 rounded-lg border border-slate-800 bg-slate-950/70 p-3">
        <summary className="cursor-pointer text-sm font-black text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-300">Pick Detail</summary>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Detail label="Policy" value={row.policy_version} />
          <Detail label="Starter" value={row.starter_status} />
          <Detail label="Prediction As Of" value={row.prediction_as_of || 'N/A'} />
          <Detail label="Market Acquired" value={row.market_acquired_at || 'N/A'} />
          <Detail label="Evaluation" value={row.evaluated_at || 'N/A'} />
          <Detail label="Decision" value={row.decision_at ?? 'N/A'} />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {row.factor_edge.map((factor) => (
            <div key={factor.family} className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
              <p className="text-xs font-black uppercase text-slate-500">{factor.direction.replaceAll('_', ' ')}</p>
              <p className="mt-1 text-sm font-black text-white">{factor.label}</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">{factor.detail}</p>
            </div>
          ))}
        </div>
        {row.blocker_explanation.length ? (
          <div className="mt-4 rounded-lg border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-100">
            {row.blocker_explanation.join(' · ')}
          </div>
        ) : null}
      </details>
    </article>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-base font-black text-white">{value}</p>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-black uppercase text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm text-slate-300">{value}</p>
    </div>
  )
}

export default function MlbValueBoardClient({ board }: { board: Pick2MlbValueBoardContract }) {
  const [filters, setFilters] = useState<FilterState>(initialFilters)
  const [sortKey, setSortKey] = useState<Pick2MlbValueBoardSortOption['key']>('board_priority')

  const books = useMemo(() => [...new Set(board.rows.map((row) => row.best_book))].sort(), [board.rows])
  const starters = useMemo(() => [...new Set(board.rows.map((row) => row.starter_status))].sort(), [board.rows])
  const freshness = useMemo(() => [...new Set(board.rows.map((row) => row.market_freshness))].sort(), [board.rows])
  const rows = useMemo(() => sortRows(board.rows.filter((row) => matchesFilters(row, filters)), sortKey), [board.rows, filters, sortKey])
  const counts = useMemo(() => board.statuses.reduce<Record<Pick2MlbValueBoardStatus, number>>((next, status) => {
    next[status] = board.rows.filter((row) => row.status === status).length
    return next
  }, { OFFICIAL_PICK: 0, VALUE_CANDIDATE: 0, WATCHLIST: 0, BLOCKED: 0 }), [board.rows, board.statuses])

  return (
    <section aria-label="MLB Value Board" className="space-y-5">
      <section className="rounded-lg border border-slate-800 bg-slate-950/90 p-5 md:p-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">MLB</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-black text-white md:text-4xl">MLB Value Board</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{board.model_limitation_note}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {board.statuses.map((status) => <Metric key={status} label={status.replaceAll('_', ' ')} value={String(counts[status])} />)}
          </div>
        </div>
      </section>

      <details className="rounded-lg border border-slate-800 bg-slate-900/80 p-4" open>
        <summary className="cursor-pointer text-sm font-black text-white focus:outline-none focus:ring-2 focus:ring-emerald-300">Filters & Sorting</summary>
        <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          <Control label="Status">
            <select className={controlClass} value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value as FilterState['status'] })}>
              <option value="ALL">All</option>
              {board.statuses.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
            </select>
          </Control>
          <Control label="Team">
            <input className={controlClass} value={filters.team} onChange={(event) => setFilters({ ...filters, team: event.target.value })} />
          </Control>
          <Control label="Side">
            <select className={controlClass} value={filters.side} onChange={(event) => setFilters({ ...filters, side: event.target.value as FilterState['side'] })}>
              <option value="ALL">All</option>
              <option value="HOME">Home</option>
              <option value="AWAY">Away</option>
            </select>
          </Control>
          <Control label="Book">
            <select className={controlClass} value={filters.bookmaker} onChange={(event) => setFilters({ ...filters, bookmaker: event.target.value })}>
              <option value="">All</option>
              {books.map((book) => <option key={book} value={book}>{book}</option>)}
            </select>
          </Control>
          <Control label="Sort">
            <select className={controlClass} value={sortKey} onChange={(event) => setSortKey(event.target.value as Pick2MlbValueBoardSortOption['key'])}>
              {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Control>
          <Control label="Starter">
            <select className={controlClass} value={filters.starter} onChange={(event) => setFilters({ ...filters, starter: event.target.value })}>
              <option value="ALL">All</option>
              {starters.map((starter) => <option key={starter} value={starter}>{starter}</option>)}
            </select>
          </Control>
          <Control label="Freshness">
            <select className={controlClass} value={filters.freshness} onChange={(event) => setFilters({ ...filters, freshness: event.target.value })}>
              <option value="ALL">All</option>
              {freshness.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </Control>
          <Control label="Min Edge %">
            <input className={controlClass} inputMode="decimal" value={filters.minEdge} onChange={(event) => setFilters({ ...filters, minEdge: event.target.value })} />
          </Control>
          <Control label="Min EV %">
            <input className={controlClass} inputMode="decimal" value={filters.minEv} onChange={(event) => setFilters({ ...filters, minEv: event.target.value })} />
          </Control>
          <Control label="Risk Flag">
            <input className={controlClass} value={filters.risk} onChange={(event) => setFilters({ ...filters, risk: event.target.value })} />
          </Control>
        </div>
      </details>

      {board.statuses.map((status) => {
        const sectionRows = rows.filter((row) => row.status === status)
        return (
          <section key={status} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-white">{statusLabels[status]}</h2>
              <span className="text-sm font-bold text-slate-400">{sectionRows.length}</span>
            </div>
            {sectionRows.length ? <div className="grid gap-3">{sectionRows.map((row) => <BoardCard key={`${row.game_pk}:${row.side}`} row={row} />)}</div> : <EmptyState status={status} />}
          </section>
        )
      })}

      <section className="rounded-lg border border-slate-800 bg-slate-950/80 p-4 text-sm leading-6 text-slate-400">
        <p>Official Pick means the row passed Policy V1. It is not a guaranteed outcome, and this board makes no historical profitability, ROI, or CLV claim.</p>
      </section>
    </section>
  )
}

function Control({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-xs font-black uppercase text-slate-500">
      {label}
      {children}
    </label>
  )
}
