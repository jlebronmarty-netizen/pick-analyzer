'use client'

import { useMemo, useState } from 'react'

type Decision = 'APOSTAR' | 'LEAN' | 'NO BET'
type BoardSection = 'dashboard' | 'props' | 'markets'
type Book = 'FanDuel' | 'Caesars'
type DecisionKind = 'Pitcher' | 'Batter' | 'Game'

type MlbDecision = {
  id: string
  kind: DecisionKind
  market: string
  matchup: string
  selection: string
  book: Book
  odds: number
  projection: string
  modelProbability: number
  noVigProbability: number
  edge: number
  decision: Decision
  confidence: 'Alta' | 'Media' | 'Baja'
  maxPrice: string
  modelVersion: string
  capturedAt: string
  reasons: string[]
  risks: string[]
}

const decisions: MlbDecision[] = [
  {
    id: 'cavalli-outs-over',
    kind: 'Pitcher',
    market: 'Pitcher Outs',
    matchup: 'Nationals @ Dodgers',
    selection: 'Cade Cavalli · OVER 15.5 outs',
    book: 'Caesars',
    odds: 102,
    projection: '17.2 outs',
    modelProbability: 61.8,
    noVigProbability: 51.1,
    edge: 10.7,
    decision: 'APOSTAR',
    confidence: 'Alta',
    maxPrice: '-115',
    modelVersion: 'MLB_PITCHER_OUTS_V1',
    capturedAt: 'Sep 5 · 8:52 AM AST',
    reasons: ['Proyección por encima de la línea', 'Precio positivo frente al fair probability', 'Carga reciente compatible con 16+ outs'],
    risks: ['Matchup ofensivo exigente', 'Snapshot de demostración; precio no es live'],
  },
  {
    id: 'valdez-outs-over',
    kind: 'Pitcher',
    market: 'Pitcher Outs',
    matchup: 'Tigers @ Guardians',
    selection: 'Framber Valdez · OVER 16.5 outs',
    book: 'Caesars',
    odds: -129,
    projection: '18.0 outs',
    modelProbability: 64.4,
    noVigProbability: 56.4,
    edge: 8.0,
    decision: 'APOSTAR',
    confidence: 'Alta',
    maxPrice: '-145',
    modelVersion: 'MLB_PITCHER_OUTS_V1',
    capturedAt: 'Sep 5 · 8:52 AM AST',
    reasons: ['Perfil de volumen favorece trabajar profundo', 'Edge permanece sobre el umbral APOSTAR', 'Contexto de abridor estable'],
    risks: ['Bullpen temprano reduciría el techo', 'Snapshot de demostración; precio no es live'],
  },
  {
    id: 'kirby-outs-under',
    kind: 'Pitcher',
    market: 'Pitcher Outs',
    matchup: 'Athletics @ Mariners',
    selection: 'George Kirby · UNDER 18.5 outs',
    book: 'Caesars',
    odds: -157,
    projection: '17.4 outs',
    modelProbability: 68.0,
    noVigProbability: 61.2,
    edge: 6.8,
    decision: 'LEAN',
    confidence: 'Media',
    maxPrice: '-165',
    modelVersion: 'MLB_PITCHER_OUTS_V1',
    capturedAt: 'Sep 5 · 8:52 AM AST',
    reasons: ['Línea exige 19 outs para perder el under', 'Proyección central queda por debajo del número', 'Edge positivo después de normalizar el precio'],
    risks: ['Precio ya comprimido', 'Un outing eficiente puede superar 6 entradas'],
  },
  {
    id: 'athletics-mariners-total',
    kind: 'Game',
    market: 'Full Game Total',
    matchup: 'Athletics @ Mariners',
    selection: 'OVER 8.0',
    book: 'Caesars',
    odds: -110,
    projection: '10.37 runs',
    modelProbability: 59.5,
    noVigProbability: 50.0,
    edge: 9.5,
    decision: 'LEAN',
    confidence: 'Media',
    maxPrice: '-125',
    modelVersion: 'MLB_TOTAL_V1',
    capturedAt: 'Sep 5 · 8:48 AM AST',
    reasons: ['Proyección de carreras supera la línea por más de 2', 'Ofensiva combinada apoya entorno de anotación', 'Número de mercado ofrece margen suficiente'],
    risks: ['La proyección total todavía está en calibración V1', 'Weather/umpire no confirmados en este snapshot'],
  },
  {
    id: 'dodgers-ml',
    kind: 'Game',
    market: 'Moneyline',
    matchup: 'Nationals @ Dodgers',
    selection: 'Dodgers ML',
    book: 'FanDuel',
    odds: -165,
    projection: '61.4% win',
    modelProbability: 61.4,
    noVigProbability: 60.8,
    edge: 0.6,
    decision: 'NO BET',
    confidence: 'Baja',
    maxPrice: '-160',
    modelVersion: 'MLB_ML_V1',
    capturedAt: 'Sep 5 · 8:50 AM AST',
    reasons: ['Modelo favorece al equipo correcto', 'Ventaja histórica y ofensiva consistente'],
    risks: ['Precio consume casi toda la ventaja', 'Edge debajo del mínimo operativo'],
  },
  {
    id: 'batter-hits-demo',
    kind: 'Batter',
    market: 'Hits',
    matchup: 'Brewers @ Reds',
    selection: 'Batter prop · OVER 0.5 hits',
    book: 'FanDuel',
    odds: -150,
    projection: '0.82 hits',
    modelProbability: 64.0,
    noVigProbability: 60.0,
    edge: 4.0,
    decision: 'LEAN',
    confidence: 'Media',
    maxPrice: '-160',
    modelVersion: 'MLB_HITS_V1',
    capturedAt: 'Sep 5 · 8:50 AM AST',
    reasons: ['Forma reciente y matchup sostienen una probabilidad superior al mercado', 'Línea básica de un hit reduce varianza frente a props de poder'],
    risks: ['Lineup todavía debe confirmarse', 'Registro de demostración hasta conectar feed vivo'],
  },
]

const sectionOptions: Array<{ key: BoardSection; label: string; description: string }> = [
  { key: 'dashboard', label: 'Dashboard', description: 'Mejores decisiones' },
  { key: 'props', label: 'Player Props', description: 'Pitchers y bateadores' },
  { key: 'markets', label: 'Markets', description: 'ML y totales' },
]

function formatOdds(odds: number) {
  return odds > 0 ? `+${odds}` : String(odds)
}

function decisionClass(decision: Decision) {
  if (decision === 'APOSTAR') return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
  if (decision === 'LEAN') return 'border-amber-400/30 bg-amber-500/10 text-amber-200'
  return 'border-slate-700 bg-slate-900 text-slate-400'
}

function confidenceClass(confidence: MlbDecision['confidence']) {
  if (confidence === 'Alta') return 'text-emerald-300'
  if (confidence === 'Media') return 'text-amber-200'
  return 'text-slate-400'
}

function statusCard(label: string, value: string, tone: 'ok' | 'warn' | 'muted') {
  const toneClass = tone === 'ok'
    ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-200'
    : tone === 'warn'
      ? 'border-amber-500/20 bg-amber-500/5 text-amber-200'
      : 'border-slate-800 bg-slate-900/60 text-slate-300'

  return (
    <div className={`rounded-xl border px-4 py-3 ${toneClass}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.22em] opacity-70">{label}</p>
      <p className="mt-1 text-sm font-black">{value}</p>
    </div>
  )
}

export default function MlbDecisionBoard() {
  const [section, setSection] = useState<BoardSection>('dashboard')
  const [propKind, setPropKind] = useState<'Todos' | 'Pitcher' | 'Batter'>('Todos')
  const [book, setBook] = useState<'Todos' | Book>('Todos')

  const visibleDecisions = useMemo(() => {
    let rows = decisions

    if (section === 'dashboard') rows = rows.filter((row) => row.decision !== 'NO BET')
    if (section === 'props') rows = rows.filter((row) => row.kind !== 'Game')
    if (section === 'markets') rows = rows.filter((row) => row.kind === 'Game')
    if (section === 'props' && propKind !== 'Todos') rows = rows.filter((row) => row.kind === propKind)
    if (book !== 'Todos') rows = rows.filter((row) => row.book === book)

    return [...rows].sort((a, b) => b.edge - a.edge)
  }, [book, propKind, section])

  const apostar = decisions.filter((row) => row.decision === 'APOSTAR').length
  const lean = decisions.filter((row) => row.decision === 'LEAN').length
  const noBet = decisions.filter((row) => row.decision === 'NO BET').length

  return (
    <div className="space-y-6" data-mlb-decision-board-v1="true">
      <section className="overflow-hidden rounded-2xl border border-sky-500/20 bg-gradient-to-br from-slate-900 via-slate-950 to-sky-950/20 p-5 shadow-2xl shadow-sky-950/10 md:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-sky-300">
                MLB Decision Board V1
              </span>
              <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-200">
                Demo snapshot · no live odds
              </span>
            </div>

            <h1 className="mt-4 text-3xl font-black tracking-tight text-white md:text-4xl">
              Una decisión clara, no otra tabla de estadísticas.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 md:text-base">
              Compara el precio de FanDuel y Caesars contra la probabilidad del modelo y clasifica cada oportunidad como APOSTAR, LEAN o NO BET.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[620px]">
            {statusCard('Odds', 'DEMO · STALE', 'warn')}
            {statusCard('Lineups', 'PENDING', 'warn')}
            {statusCard('Weather', 'PENDING', 'muted')}
            {statusCard('Umpire', 'PENDING', 'muted')}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-400/70">APOSTAR</p>
          <p className="mt-2 text-3xl font-black text-emerald-300">{apostar}</p>
          <p className="mt-1 text-xs text-slate-500">Pasa umbral de edge V1</p>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-300/70">LEAN</p>
          <p className="mt-2 text-3xl font-black text-amber-200">{lean}</p>
          <p className="mt-1 text-xs text-slate-500">Interesante, no automático</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">NO BET</p>
          <p className="mt-2 text-3xl font-black text-slate-300">{noBet}</p>
          <p className="mt-1 text-xs text-slate-500">Guardado para learning</p>
        </div>
        <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-300/70">Last refresh</p>
          <p className="mt-2 text-lg font-black text-sky-200">Sep 5 · 8:52 AM</p>
          <p className="mt-1 text-xs text-slate-500">AST · demo snapshot</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/50 p-2">
        <div className="grid gap-2 md:grid-cols-3">
          {sectionOptions.map((option) => {
            const active = section === option.key
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setSection(option.key)}
                className={`rounded-xl border px-4 py-3 text-left transition ${active
                  ? 'border-sky-400/30 bg-sky-500/10 text-white'
                  : 'border-transparent text-slate-400 hover:border-slate-800 hover:bg-slate-900/70 hover:text-white'
                }`}
              >
                <span className="block text-sm font-black">{option.label}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{option.description}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Filtros</p>
          <p className="mt-1 text-sm text-slate-300">Mostrando {visibleDecisions.length} decisiones ordenadas por edge.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {section === 'props' && (['Todos', 'Pitcher', 'Batter'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setPropKind(value)}
              className={`rounded-full border px-3 py-2 text-xs font-bold ${propKind === value
                ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
                : 'border-slate-700 bg-slate-950 text-slate-400 hover:text-white'
              }`}
            >
              {value}
            </button>
          ))}

          {(['Todos', 'FanDuel', 'Caesars'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setBook(value)}
              className={`rounded-full border px-3 py-2 text-xs font-bold ${book === value
                ? 'border-sky-400/30 bg-sky-500/10 text-sky-200'
                : 'border-slate-700 bg-slate-950 text-slate-400 hover:text-white'
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-4 2xl:grid-cols-2">
        {visibleDecisions.map((row) => (
          <article key={row.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl shadow-black/10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.17em] text-slate-500">
                  <span>{row.market}</span>
                  <span>•</span>
                  <span>{row.matchup}</span>
                </div>
                <h2 className="mt-2 text-xl font-black text-white">{row.selection}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 font-bold text-slate-200">{row.book} {formatOdds(row.odds)}</span>
                  <span>Projection: <strong className="text-white">{row.projection}</strong></span>
                </div>
              </div>

              <span className={`shrink-0 rounded-full border px-3 py-2 text-xs font-black tracking-[0.14em] ${decisionClass(row.decision)}`}>
                {row.decision}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Model</p>
                <p className="mt-1 text-lg font-black text-white">{row.modelProbability.toFixed(1)}%</p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">No-vig</p>
                <p className="mt-1 text-lg font-black text-white">{row.noVigProbability.toFixed(1)}%</p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Edge</p>
                <p className={`mt-1 text-lg font-black ${row.edge >= 6 ? 'text-emerald-300' : row.edge >= 3 ? 'text-amber-200' : 'text-slate-400'}`}>+{row.edge.toFixed(1)} pp</p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Conf.</p>
                <p className={`mt-1 text-lg font-black ${confidenceClass(row.confidence)}`}>{row.confidence}</p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/[0.03] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400/70">Razones</p>
                <ul className="mt-3 space-y-2 text-sm leading-5 text-slate-300">
                  {row.reasons.map((reason) => <li key={reason}>+ {reason}</li>)}
                </ul>
              </div>
              <div className="rounded-xl border border-amber-500/10 bg-amber-500/[0.03] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300/70">Riesgos</p>
                <ul className="mt-3 space-y-2 text-sm leading-5 text-slate-300">
                  {row.risks.map((risk) => <li key={risk}>− {risk}</li>)}
                </ul>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 border-t border-slate-800 pt-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span>Bet up to <strong className="text-slate-200">{row.maxPrice}</strong></span>
                <span>{row.modelVersion}</span>
              </div>
              <span>{row.capturedAt}</span>
            </div>
          </article>
        ))}
      </section>

      {visibleDecisions.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-700 p-10 text-center text-sm text-slate-500">
          No hay decisiones para estos filtros.
        </div>
      )}

      <section className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm leading-6 text-amber-100/80">
        <strong className="text-amber-200">V1 scaffold:</strong> estos registros son únicamente un snapshot de demostración para validar la experiencia del producto. El siguiente bloque conecta el board a Pick2/Supabase, normaliza FanDuel + Caesars y reemplaza estos registros por decisiones pregame congelables.
      </section>
    </div>
  )
}
