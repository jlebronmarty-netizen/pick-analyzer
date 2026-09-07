'use client'

import { useEffect, useMemo, useState } from 'react'
import type { MlbDecisionBoardData, MlbDecisionItem } from '@/types/mlb-decision-board'

type BoardSection = 'dashboard' | 'props' | 'markets'
type PropFilter = 'all' | 'pitcher' | 'batter'
type BookFilter = 'all' | 'FanDuel' | 'Caesars'
type DecisionFilter = 'recommendations' | 'all'

const sectionTabs: Array<{ id: BoardSection; label: string }> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'props', label: 'Player Props' },
  { id: 'markets', label: 'Markets' },
]

function percent(value: number | null, digits = 1) {
  return value === null ? 'N/D' : `${(value * 100).toFixed(digits)}%`
}

function edgeText(value: number | null) {
  if (value === null) return 'N/D'
  const points = value * 100
  return `${points >= 0 ? '+' : ''}${points.toFixed(1)} pp`
}

function american(value: number | null) {
  if (value === null) return 'N/D'
  return value > 0 ? `+${Math.round(value)}` : `${Math.round(value)}`
}

function compactTime(value: string | null) {
  if (!value) return 'N/D'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'N/D'
  return new Intl.DateTimeFormat('es-PR', {
    timeZone: 'America/Puerto_Rico',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function freshness(value: string | null) {
  if (!value) return 'sin odds actuales'
  const ageSeconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000))
  if (ageSeconds < 60) return `${ageSeconds}s`
  const minutes = Math.floor(ageSeconds / 60)
  if (minutes < 60) return `${minutes}m`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

function decisionStyles(decision: MlbDecisionItem['decision']) {
  if (decision === 'APOSTAR') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
  if (decision === 'LEAN') return 'border-amber-400/40 bg-amber-400/10 text-amber-200'
  if (decision === 'BLOCKED') return 'border-rose-500/30 bg-rose-500/10 text-rose-200'
  return 'border-slate-700 bg-slate-900 text-slate-300'
}

function confidenceLabel(value: MlbDecisionItem['confidence']) {
  if (value === 'HIGH') return 'Alta'
  if (value === 'MEDIUM') return 'Media'
  if (value === 'LOW') return 'Baja'
  return 'Bloqueada'
}

function Metric({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-black text-white">{value}</p>
      {detail ? <p className="mt-1 text-xs text-slate-500">{detail}</p> : null}
    </div>
  )
}

function QuotePills({ item }: { item: MlbDecisionItem }) {
  if (!item.quotes.length) return <span className="text-xs text-slate-500">Sin precio</span>
  return (
    <div className="flex flex-wrap gap-2">
      {item.quotes.map((quote) => (
        <span
          key={`${quote.book}-${quote.line}-${quote.odds}`}
          className={`rounded-full border px-3 py-1 text-xs font-bold ${quote.book === item.bestBook ? 'border-sky-400/40 bg-sky-400/10 text-sky-200' : 'border-slate-700 bg-slate-900 text-slate-300'}`}
        >
          {quote.book} {quote.line !== null ? `${quote.line} ` : ''}{american(quote.odds)}
        </span>
      ))}
    </div>
  )
}

function DecisionCard({ item }: { item: MlbDecisionItem }) {
  const projectionValue = item.projectedValue === null
    ? 'N/D'
    : item.kind === 'market' && item.marketKey === 'moneyline'
      ? percent(item.projectedValue)
      : item.projectedValue.toFixed(2)

  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900/55 p-4 shadow-sm md:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] ${decisionStyles(item.decision)}`}>
              {item.decision === 'NO_BET' ? 'NO BET' : item.decision}
            </span>
            <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-[11px] font-bold text-slate-400">
              {item.category}
            </span>
            <span className="text-xs text-slate-500">{compactTime(item.scheduledTime)} PR</span>
          </div>
          <h3 className="mt-3 text-lg font-black text-white md:text-xl">{item.label}</h3>
          <p className="mt-1 text-sm text-slate-400">{item.matchup}</p>
        </div>
        <QuotePills item={item} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <Metric label="Proyección" value={projectionValue} />
        <Metric label="Modelo" value={percent(item.modelProbability)} />
        <Metric label="No-vig" value={percent(item.noVigProbability)} detail={item.bestBook ? `precio ${item.bestBook}` : undefined} />
        <Metric label="Edge" value={edgeText(item.edge)} detail={item.bestBook ? `vs ${item.bestBook}` : undefined} />
        <Metric label="Confianza" value={confidenceLabel(item.confidence)} />
        <Metric label="Hasta" value={american(item.maxPrice)} detail="precio aprox." />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-4">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300">Por qué</p>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
            {item.reasons.slice(0, 4).map((reason) => <li key={reason}>• {reason}</li>)}
          </ul>
        </div>
        <div className="rounded-xl border border-rose-500/15 bg-rose-500/5 p-4">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-rose-300">Riesgos / bloqueos</p>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
            {[...item.risks, ...item.blockers.map((blocker) => `Blocker: ${blocker}`)].slice(0, 5).map((risk) => <li key={risk}>• {risk}</li>)}
          </ul>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-800 pt-4 text-xs text-slate-500">
        <span>Modelo: {item.modelVersion}</span>
        <span>Odds: {compactTime(item.capturedAt)} PR</span>
        {item.lineupStatus ? <span>Lineup: {item.lineupStatus}</span> : null}
        {item.starterStatus ? <span>Starter: {item.starterStatus}</span> : null}
        {item.dataSufficiency !== null ? <span>Data: {item.dataSufficiency}%</span> : null}
      </div>
    </article>
  )
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/30 p-8 text-center">
      <p className="text-lg font-black text-white">{title}</p>
      <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-400">{body}</p>
    </div>
  )
}

export default function MlbDecisionBoard({ initialData }: { initialData: MlbDecisionBoardData }) {
  const [data, setData] = useState(initialData)
  const [section, setSection] = useState<BoardSection>('dashboard')
  const [propFilter, setPropFilter] = useState<PropFilter>('all')
  const [propMarket, setPropMarket] = useState('all')
  const [marketFilter, setMarketFilter] = useState('all')
  const [bookFilter, setBookFilter] = useState<BookFilter>('all')
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>('recommendations')
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)

  async function refresh() {
    setRefreshing(true)
    try {
      const response = await fetch(`/api/mlb/decision-board?date=${encodeURIComponent(data.selectedDate)}`, { cache: 'no-store' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const next = await response.json() as MlbDecisionBoardData
      setData(next)
      setRefreshError(null)
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : 'Refresh failed')
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    const interval = window.setInterval(() => void refresh(), Math.max(60, data.refreshSeconds) * 1000)
    return () => window.clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.refreshSeconds, data.selectedDate])

  const propMarkets = useMemo(() => Array.from(new Set(data.props.map((item) => item.category))).sort(), [data.props])
  const gameMarkets = useMemo(() => Array.from(new Set(data.markets.map((item) => item.category))).sort(), [data.markets])

  const visibleProps = useMemo(() => data.props.filter((item) => {
    if (propFilter !== 'all' && item.propGroup !== propFilter) return false
    if (propMarket !== 'all' && item.category !== propMarket) return false
    if (bookFilter !== 'all' && item.bestBook !== bookFilter) return false
    if (decisionFilter === 'recommendations' && !['APOSTAR', 'LEAN'].includes(item.decision)) return false
    return true
  }), [data.props, propFilter, propMarket, bookFilter, decisionFilter])

  const visibleMarkets = useMemo(() => data.markets.filter((item) => {
    if (marketFilter !== 'all' && item.category !== marketFilter) return false
    if (bookFilter !== 'all' && item.bestBook !== bookFilter) return false
    if (decisionFilter === 'recommendations' && !['APOSTAR', 'LEAN'].includes(item.decision)) return false
    return true
  }), [data.markets, marketFilter, bookFilter, decisionFilter])

  const topOpportunities = useMemo(() => [...data.props, ...data.markets]
    .filter((item) => ['APOSTAR', 'LEAN'].includes(item.decision))
    .sort((a, b) => (b.edge ?? -99) - (a.edge ?? -99))
    .slice(0, 8), [data])

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-sky-500/20 bg-gradient-to-br from-slate-900 via-slate-950 to-sky-950/30 p-5 md:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-sky-300">MLB Decision Board V1</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white md:text-4xl">Decisiones MLB, no otro stat dashboard.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
              Pick data + proyecciones + FanDuel/Caesars actuales. V1 es read-only y shadow: no guarda Official Picks y no eleva una señal a APOSTAR hasta completar la certificación.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs font-black text-amber-200">SHADOW V1</span>
            <button onClick={() => void refresh()} disabled={refreshing} className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-black text-slate-200 hover:bg-slate-800 disabled:opacity-50">
              {refreshing ? 'Actualizando…' : 'Actualizar ahora'}
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Metric label="Juegos" value={data.summary.games} detail={`${data.summary.pregameGames} pregame`} />
          <Metric label="APOSTAR" value={data.summary.betCount} detail="bloqueado en V1" />
          <Metric label="LEAN" value={data.summary.leanCount} />
          <Metric label="Props" value={data.summary.props} />
          <Metric label="Mercados" value={data.summary.markets} />
          <Metric label="Odds age" value={freshness(data.summary.latestOddsAt)} detail={data.summary.sportsbooks.join(' + ') || 'sin book'} />
        </div>

        <div className="mt-5 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1.5 text-slate-300">Lineups: {data.summary.confirmedLineups} confirmados · {data.summary.expectedLineups} esperados</span>
          <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1.5 text-slate-300">Starters confirmados: {data.summary.confirmedStarters}</span>
          <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1.5 text-slate-300">Fecha PR: {data.selectedDate}</span>
          <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1.5 text-slate-300">Auto-refresh: {Math.round(data.refreshSeconds / 60)}m</span>
        </div>
        {refreshError ? <p className="mt-4 text-sm font-bold text-rose-300">Refresh: {refreshError}</p> : null}
      </section>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {sectionTabs.map((tab) => (
          <button key={tab.id} onClick={() => setSection(tab.id)} className={`whitespace-nowrap rounded-full px-5 py-2.5 text-sm font-black transition ${section === tab.id ? 'bg-sky-400 text-slate-950' : 'border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {section === 'dashboard' ? (
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Today</p>
              <h2 className="mt-1 text-2xl font-black text-white">Mejores oportunidades disponibles</h2>
            </div>
            <p className="text-xs text-slate-500">Generado {compactTime(data.generatedAt)} PR</p>
          </div>
          {topOpportunities.length ? topOpportunities.map((item) => <DecisionCard key={item.id} item={item} />) : (
            <EmptyState title="No hay LEAN/APOSTAR verificables ahora" body="Eso es una salida válida. El board no inventa precios ni fuerza picks cuando faltan pares de odds, proyecciones o calidad mínima de datos." />
          )}
          {data.blockers.length ? (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm text-rose-100">
              <span className="font-black">Blockers globales:</span> {data.blockers.join(' · ')}
            </div>
          ) : null}
        </section>
      ) : null}

      {section === 'props' ? (
        <section className="space-y-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Player Props</p>
            <h2 className="mt-1 text-2xl font-black text-white">Pitchers y bateadores</h2>
          </div>
          <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
            {(['all', 'pitcher', 'batter'] as PropFilter[]).map((value) => (
              <button key={value} onClick={() => setPropFilter(value)} className={`rounded-full px-4 py-2 text-xs font-black ${propFilter === value ? 'bg-emerald-400 text-slate-950' : 'bg-slate-950 text-slate-300'}`}>
                {value === 'all' ? 'Todos' : value === 'pitcher' ? 'Pitchers' : 'Bateadores'}
              </button>
            ))}
            <select value={propMarket} onChange={(event) => setPropMarket(event.target.value)} className="rounded-full border border-slate-700 bg-slate-950 px-4 py-2 text-xs font-bold text-slate-200">
              <option value="all">Todos los props</option>
              {propMarkets.map((market) => <option key={market} value={market}>{market}</option>)}
            </select>
            <BookControls value={bookFilter} onChange={setBookFilter} />
            <DecisionControls value={decisionFilter} onChange={setDecisionFilter} />
          </div>
          {visibleProps.length ? visibleProps.map((item) => <DecisionCard key={item.id} item={item} />) : (
            <EmptyState title="No hay props en este filtro" body={`Raw prop odds detectadas: ${data.diagnostics.rawPropOddsRows}. Pares Over/Under mapeados: ${data.diagnostics.mappedPropPairs}. Cambia a “Todos” para ver NO BET/BLOCKED o espera un nuevo snapshot.`} />
          )}
        </section>
      ) : null}

      {section === 'markets' ? (
        <section className="space-y-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">All Markets</p>
            <h2 className="mt-1 text-2xl font-black text-white">Mercados de juego</h2>
          </div>
          <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
            <select value={marketFilter} onChange={(event) => setMarketFilter(event.target.value)} className="rounded-full border border-slate-700 bg-slate-950 px-4 py-2 text-xs font-bold text-slate-200">
              <option value="all">Todos los mercados</option>
              {gameMarkets.map((market) => <option key={market} value={market}>{market}</option>)}
            </select>
            <BookControls value={bookFilter} onChange={setBookFilter} />
            <DecisionControls value={decisionFilter} onChange={setDecisionFilter} />
          </div>
          {visibleMarkets.length ? visibleMarkets.map((item) => <DecisionCard key={item.id} item={item} />) : (
            <EmptyState title="No hay mercados en este filtro" body="V1 solo calcula decisiones cuando existe una línea real del día y ambos precios necesarios para quitar el vig. Moneyline y full-game totals son las primeras familias activadas." />
          )}
        </section>
      ) : null}

      <details className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400">
        <summary className="cursor-pointer font-black text-slate-200">Diagnóstico de datos</summary>
        <div className="mt-4 grid gap-2 text-xs md:grid-cols-2">
          <p>Player engine: {data.diagnostics.playerProjectionMode ?? 'N/D'}</p>
          <p>Projection engine: {data.diagnostics.projectionMode ?? 'N/D'}</p>
          <p>Market inventory: {data.diagnostics.marketInventoryMode ?? 'N/D'}</p>
          <p>Odds rows actuales: {data.diagnostics.currentMarketRows}</p>
          <p>Prop rows crudas: {data.diagnostics.rawPropOddsRows}</p>
          <p>Prop pairs mapeados: {data.diagnostics.mappedPropPairs}</p>
        </div>
        <ul className="mt-4 space-y-1 text-xs text-slate-500">
          {data.diagnostics.notes.map((note) => <li key={note}>• {note}</li>)}
        </ul>
      </details>
    </div>
  )
}

function BookControls({ value, onChange }: { value: BookFilter; onChange: (value: BookFilter) => void }) {
  return (
    <div className="flex gap-1 rounded-full border border-slate-700 bg-slate-950 p-1" aria-label="Filtrar por mejor precio">
      {(['all', 'FanDuel', 'Caesars'] as BookFilter[]).map((book) => (
        <button key={book} onClick={() => onChange(book)} className={`rounded-full px-3 py-1.5 text-xs font-black ${value === book ? 'bg-sky-400 text-slate-950' : 'text-slate-400'}`}>
          {book === 'all' ? 'Mejor: todas' : `Mejor ${book}`}
        </button>
      ))}
    </div>
  )
}

function DecisionControls({ value, onChange }: { value: DecisionFilter; onChange: (value: DecisionFilter) => void }) {
  return (
    <div className="flex gap-1 rounded-full border border-slate-700 bg-slate-950 p-1">
      <button onClick={() => onChange('recommendations')} className={`rounded-full px-3 py-1.5 text-xs font-black ${value === 'recommendations' ? 'bg-amber-300 text-slate-950' : 'text-slate-400'}`}>Recomendaciones</button>
      <button onClick={() => onChange('all')} className={`rounded-full px-3 py-1.5 text-xs font-black ${value === 'all' ? 'bg-slate-200 text-slate-950' : 'text-slate-400'}`}>Todo</button>
    </div>
  )
}
