"use client";
import Link from "next/link";
import { useState } from "react";
import type { QualifiedReport } from "@/lib/qualified-plays";
import type {ModelCohort} from '@/lib/sport-model-overview';
import { engineTotals, filterEngineHub, MLB_ENGINE_VIEWS, type MlbEngineView, type OfficialHubSummary } from "@/lib/mlb-engine-hub";

const labels: Record<string, string> = { GENERAL: "MLB general", PICK_ANALYZER: "Pick", PICK_EDGE: "Edge", EQUILIZER: "Equilizer", FORMULAS: "Fórmulas" };
const label = (s: string) => s.replaceAll("_", " ");
const percent = (n: number | null) => n === null ? "—" : `${(n * 100).toFixed(2)}%`;
const inputClass = "rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100";
const buttonClass = "rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-teal-300";
const time = (s: string | null) => s ? new Intl.DateTimeFormat("es-PR", { timeZone: "America/Puerto_Rico", dateStyle: "medium", timeStyle: "short" }).format(new Date(s)) + " PR" : "Sin dato";
export default function MlbEngineHub({ research, official, today,cohorts }: {
  research: QualifiedReport; official: OfficialHubSummary; today: string;cohorts?:ModelCohort[];
}) {
  const [view, setView] = useState<MlbEngineView>("GENERAL");
  const [phase, setPhase] = useState("REGULAR_SEASON");
  const [formula, setFormula] = useState("ALL");
  const [date, setDate] = useState("");
  const [outcome, setOutcome] = useState("ALL");
  const [page, setPage] = useState(0);
  const { groups, entries } = filterEngineHub(research, { view, phase, formula, date, outcome });
  const groupMap = new Map(groups.map(g => [g.key, g]));
  const pages = Math.max(1, Math.ceil(entries.length / 25));
  const currentPage = Math.min(page, pages - 1);
  const changeView = (next: MlbEngineView) => { setView(next); setFormula("ALL"); setPage(0); };
  return <section className="mlb-ui mx-auto max-w-7xl space-y-6 text-slate-200">
    <header className="rounded-2xl border border-teal-400/30 bg-slate-900 p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-teal-300">MLB · 2026</p>
      <h1 className="mt-2 text-3xl font-bold text-white">MLB general — motores y fórmulas</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">Predicciones registradas, resultados y accuracy por motor y contrato exacto. Consulta qué seleccionó cada fórmula y cómo terminó; los candidatos de investigación conservan su clasificación.</p>
      <nav aria-label="MLB tools" className="mt-4 flex flex-wrap gap-4 text-sm font-semibold text-teal-300">
        <Link href="/today">Picks oficiales de hoy</Link><Link href="/performance">Settlement oficial</Link>
        <Link href="/qualified-plays">Qualified Plays</Link><Link href="/mlb">Research Lab</Link>
      </nav>
    </header>
    <nav aria-label="MLB engines" className="flex flex-wrap gap-2">
      {MLB_ENGINE_VIEWS.map(v => <button type="button" key={v} onClick={() => changeView(v)} aria-pressed={view === v}
        className={`${buttonClass} ${view === v ? "border-teal-400 bg-teal-500/20 text-teal-200" : "text-slate-300"}`}>{labels[v]}</button>)}
    </nav>
    {view==='GENERAL'&&cohorts&&<section aria-label="MLB global model accuracy" className="rounded-xl border border-teal-400/30 bg-slate-900 p-5"><h2 className="font-bold">Accuracy global de modelos · {phase==='REGULAR_SEASON'?'temporada regular':'playoffs'}</h2><p className="mt-2 text-3xl font-bold">{percent(cohorts.find(c=>c.key===phase)?.accuracy??null)}</p><p className="mt-2 text-sm">{cohorts.find(c=>c.key===phase)?.note}</p><p className="mt-2 text-xs text-slate-400">Subtotal descriptivo de resultados de modelos en esta fase, incluido ML oficial solo en temporada regular. Las fórmulas no vuelven a sumar los mismos registros; no es accuracy de partidos únicos ni probabilidad calibrada.</p></section>}
    {(view === "GENERAL" || view === "PICK_ANALYZER") && <section aria-label="Official Pick accuracy" className="rounded-xl border border-slate-700 bg-slate-900 p-5">
      <p className="text-sm font-bold text-teal-300">Pick · ML oficial de producción</p>
      <p className="mt-2 text-3xl font-bold text-white">{percent(official.accuracy)}</p>
      <p className="mt-2 text-sm">{official.available ? `${official.wins} WIN / ${official.losses} LOSS · ${official.pending} pendientes` : "Resultados oficiales no disponibles"}</p>
      <p className="mt-2 text-xs text-slate-400">Historial oficial completo, independiente de los filtros de investigación inferiores. Las decisiones repetidas se cuentan una sola vez.</p>
      <Link href="/performance" className="mt-3 inline-block text-sm font-semibold text-teal-300">Ver picks oficiales y resultados →</Link>
    </section>}
    <section aria-label="Research scope" className="space-y-3 rounded-xl border border-violet-400/25 bg-slate-900 p-4">
      <h2 className="font-bold text-white">Evidencia forward de investigación</h2>
      <p className="text-sm leading-6">Pick, Edge y Equilizer conservan sus registros independientes. Las fórmulas son vistas de esos mismos registros, no un cuarto motor ni nuevas apuestas. Solo se incluye lo sincronizado al ledger canónico.</p>
      <div role="group" aria-label="Research season phase" className="flex flex-wrap gap-2">
        {[["REGULAR_SEASON", "Temporada regular"], ["POSTSEASON", "Playoffs"]].map(([key, name]) => <button type="button" key={key}
          className={`${buttonClass} ${phase === key ? "border-teal-400 bg-teal-500/20" : ""}`} aria-pressed={phase === key}
          onClick={() => { setPhase(key); setFormula("ALL"); setPage(0); }}>{name}</button>)}
      </div>
      <p className="text-xs text-amber-200">{phase === "POSTSEASON" ? "POSTSEASON SHADOW DOMAIN SHIFT · separado de temporada regular." : "Solo temporada regular. Equilizer conserva su cohorte original; playoffs no la completa."}</p>
      <p className="text-xs text-slate-400">Actualización del ledger: {time(research.sourceUpdatedAt)} · Lectura: {time(research.readAt)}</p>
    </section>
    {research.status === "UNAVAILABLE" ? <p role="status" className="rounded-xl border border-amber-400 p-5 text-amber-200">No se pudo verificar el registro completo. No se sustituyen resultados históricos.</p> : <>
      <div className="grid gap-4 md:grid-cols-3">
        {[...new Set(["PICK_ANALYZER", "PICK_EDGE", "EQUILIZER", ...groups.map(g => g.engine)])].filter(e => ["GENERAL", "FORMULAS"].includes(view) || e === view).map(e => {
          const scoped = groups.filter(g => g.engine === e); const t = engineTotals(scoped);
          return <section aria-label={`${labels[e] ?? label(e)} research accuracy`} key={e} className="rounded-xl border border-slate-700 bg-slate-900 p-4">
            <h2 className="font-bold text-white">{labels[e] ?? label(e)} · research</h2>
            <p className="mt-2 text-3xl font-bold">{percent(t.accuracy)}</p>
            <p className="mt-2 text-sm">{t.wins} W / {t.losses} L · {t.open} OPEN</p>
            <p className="mt-1 text-xs text-slate-400">{t.pushes} PUSH · {t.voids} VOID · n = {t.wins + t.losses}</p>
            {!scoped.length && <p className="mt-2 text-xs text-amber-200">Sin observaciones sincronizadas para esta fase.</p>}
            <p className="mt-3 text-xs leading-5 text-slate-400">Subtotal descriptivo del motor en la fase elegida. No es probabilidad por jugada ni ROI.</p>
          </section>;
        })}
      </div>
      {view === "PICK_EDGE" && <p className="rounded-xl border border-amber-400/30 p-4 text-sm text-amber-200">PE_ML_V1 registra la dirección del artefacto del modelo. No es recomendación, Official Pick ni probabilidad calibrada por jugada.</p>}
      <section aria-label="Formula accuracy" className="overflow-hidden rounded-xl border border-slate-700">
        <h2 className="bg-slate-900 p-4 text-lg font-bold text-white">Accuracy por fórmula y mercado</h2>
        <div className="overflow-x-auto"><table className="w-full min-w-[660px] text-left text-sm">
          <caption className="sr-only">Fórmulas independientes de la fase seleccionada, sin filtro de fecha o resultado</caption>
          <thead className="bg-slate-900 text-slate-400"><tr>{["Motor / fórmula / contrato exacto", "W–L–P", "VOID", "OPEN", "n W/L", "Accuracy"].map(h => <th scope="col" key={h} className="px-4 py-3">{h}</th>)}</tr></thead>
          <tbody>{groups.map(g => <tr key={g.key} className="border-t border-slate-800">
            <td className="max-w-sm px-4 py-4"><p className="font-semibold text-teal-300">{labels[g.engine] ?? label(g.engine)} · {label(g.market)} · {label(g.direction)} {g.line ?? ""}</p>
              <details className="mt-2 break-all text-xs text-slate-400"><summary className="cursor-pointer py-1">Modelo y evidencia</summary><p>{g.model}</p><p>{g.contract ?? "Contrato identificado por modelo, mercado, línea y dirección"}</p><p>{g.evidenceClass}</p></details></td>
            <td className="whitespace-nowrap px-4 py-4">{g.wins}–{g.losses}–{g.pushes}</td><td className="px-4 py-4">{g.voids}</td><td className="px-4 py-4">{g.open}</td><td className="px-4 py-4">{g.wins + g.losses}</td>
            <td className="px-4 py-4 font-bold">{percent(g.accuracy)}{g.wins + g.losses > 0 && g.wins + g.losses < 30 && <p className="mt-1 text-xs font-normal text-amber-200">Muestra pequeña</p>}</td>
          </tr>)}</tbody>
        </table></div>{!groups.length && <p className="p-5 text-sm text-slate-400">No hay fórmulas sincronizadas para este motor y fase.</p>}
      </section>
      <section aria-label="Prediction and settlement history" className="space-y-4 rounded-xl border border-slate-700 p-4">
        <h2 className="text-xl font-bold text-white">Predicciones y resultados</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-0 text-sm">Fórmula<select className={`${inputClass} mt-1 block max-w-full md:max-w-md`} value={formula} onChange={e => { setFormula(e.target.value); setPage(0); }}>
            <option value="ALL">Todas las fórmulas (filas independientes)</option>{groups.map(g => <option value={g.key} key={g.key}>{labels[g.engine] ?? g.engine} · {g.model} · {g.market} {g.direction} {g.line ?? ""}</option>)}</select></label>
          <label className="text-sm">Fecha PR<input type="date" className={`${inputClass} mt-1 block`} value={date} onChange={e => { setDate(e.target.value); setPage(0); }} /></label>
          <label className="text-sm">Resultado<select className={`${inputClass} mt-1 block`} value={outcome} onChange={e => { setOutcome(e.target.value); setPage(0); }}>{["ALL", "WIN", "LOSS", "OPEN", "PUSH", "VOID"].map(s => <option key={s} value={s}>{s === "ALL" ? "Todos" : s}</option>)}</select></label>
          <button type="button" className={buttonClass} onClick={() => { setDate(today); setPage(0); }}>Hoy</button>
          <button type="button" className={buttonClass} onClick={() => { setDate(""); setOutcome("ALL"); setFormula("ALL"); setPage(0); }}>Limpiar filtros</button>
        </div>
        <p className="text-xs text-slate-400">Estos filtros afectan solo el historial. Las tarjetas y el accuracy por fórmula muestran la fase completa. OPEN histórico no implica una oferta vigente.</p>
        <p role="status" className="text-sm">{entries.length} observaciones · página {currentPage + 1} de {pages}</p>
        <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm">
          <caption className="sr-only">Selecciones registradas y su resultado observado</caption>
          <thead className="text-xs text-slate-400"><tr>{["Fecha / juego", "Selección / fórmula", "Proyección registrada", "Resultado", "Valor observado"].map(h => <th scope="col" key={h} className="px-3 py-3">{h}</th>)}</tr></thead>
          <tbody>{entries.slice(currentPage * 25, (currentPage + 1) * 25).map(r => { const g = groupMap.get(r.groupKey)!; return <tr key={r.id} className="border-t border-slate-800">
            <td className="px-3 py-4">{r.date}<p className="mt-1 text-xs text-slate-400">MLB #{r.gamePk}</p></td>
            <td className="max-w-sm px-3 py-4"><p className="font-bold text-white">{r.selection}</p><p className="mt-1 text-xs text-teal-300">{labels[g.engine] ?? g.engine} · {label(g.market)} · {label(g.direction)} {g.line ?? ""}</p>
              <details className="mt-2 break-all text-xs text-slate-400"><summary className="cursor-pointer py-1">Ver registro</summary><p>{g.model}</p><p>Congelado: {time(r.frozenAt)}</p><p>Liquidado: {time(r.settledAt)}</p></details></td>
            <td className="px-3 py-4">{r.projection === null ? "—" : r.projection.toFixed(3)}</td>
            <td className={`max-w-xs px-3 py-4 font-bold ${r.result === "WIN" ? "text-teal-300" : r.result === "LOSS" ? "text-rose-300" : "text-amber-200"}`}>{r.result}{r.result === "OPEN" && <p className="mt-2 text-xs font-normal leading-5">{r.pendingReason ?? "Falta resultado exacto verificado para liquidar."}</p>}</td>
            <td className="max-w-xs break-words px-3 py-4">{r.actual ?? "—"}</td>
          </tr>; })}</tbody>
        </table></div>
        {!entries.length && <p className="py-4 text-sm text-slate-400">No hay observaciones sincronizadas con estos filtros.</p>}
        <div className="flex gap-3"><button type="button" className={buttonClass} disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Anterior</button><button type="button" className={buttonClass} disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>Siguiente</button></div>
      </section>
    </>}
    <p className="text-xs leading-6 text-slate-400">Accuracy = WIN ÷ (WIN + LOSS); OPEN, PUSH y VOID quedan fuera. El agregado por deporte suma resultados por modelo dentro de la fase, sin promediar porcentajes ni duplicar vistas de fórmulas. Una misma jugada puede estar registrada por distintos modelos: no representa partidos independientes. La proyección mantiene las unidades del modelo y no es probabilidad calibrada. Las fórmulas sin observaciones forward sincronizadas todavía no aparecen. Un accuracy alto no demuestra ROI positivo.</p>
  </section>;
}
