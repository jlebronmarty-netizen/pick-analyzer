'use client';

import { useEffect, useRef, useState } from 'react';

type Interval = { low: number; high: number };
type Metric = {
  model: string; label: string; games: number; hits: number;
  accuracy: number | null; brier: number | null; logLoss: number | null;
  meanProbability?: number | null; observedHomeWinRate?: number | null;
  accuracyInterval95?: Interval | null; thresholdTies?: number;
};
type Difference = { estimate: number | null; interval95: Interval | null };
type Exclusion = { eventId: string | null; reason: string; reasonLabel?: string; source?: string; scope?: string; market?: string | null };
type ExactScore = {
  pricedEvents: number; graded: number; pushes: number;
  modelBrier: number | null; circaNoVigBrier: number | null;
  modelLogLoss: number | null; circaNoVigLogLoss: number | null;
};
type ExactCohort = {
  status: string; validFrozen?: number; settledDistinctGames?: number;
  markets?: { spread: ExactScore; total: ExactScore };
  exclusions?: Exclusion[];
};

export type NhlResearchAuditReport = {
  version?: string;
  status: 'READ_ONLY_NHL_RESEARCH_AUDIT' | 'EMPTY_ARCHIVE' | 'READ_UNAVAILABLE' | 'SOURCE_SCAN_CAPPED';
  auditedAt: string;
  readOnly: boolean;
  providerCalls: number;
  databaseWrites: number;
  warning?: string;
  modelInputs?: { model: string; used: string[]; evidenceOnly: string[] }[];
  inventory?: {
    entries: {
      key: string; label: string; records: number; distinctGames: number | null;
      from: string | null; to: string | null; latestCapturedAt: string | null; note?: string;
    }[];
    quality?: { key: string; label: string; count: number; unit?: string; note?: string }[];
  };
  moneyline?: {
    status: string;
    comparisons: Metric[];
    cohorts: {
      fourWay: { games: number; eventIds: string[]; dateRange: { from: string; to: string } | null };
      dratingsOriginal?: { games: number };
      earlyPoisson?: { games: number };
    };
    sameInformationSet: boolean;
    calibration: {
      model: string; label: string;
      bins: {
        label: string; lower: number; upper: number; games: number;
        meanProbability: number | null; observedHomeWinRate: number | null;
        interval95: Interval | null;
      }[];
    }[];
    timing: {
      model: string; label: string; games: number; missing: number;
      minMinutes: number | null; medianMinutes: number | null; maxMinutes: number | null;
    }[];
    pairedDifferences: {
      candidate: string; baseline: string; games: number;
      brier: Difference; logLoss: Difference; accuracy: Difference;
      method?: string; iterations?: number;
      dayBlockSensitivity?: { method: string; blocks: number; brier: Difference; logLoss: Difference; accuracy: Difference };
    }[];
    subgroups?: { dimension: string; group: string; comparisons: Metric[] }[];
    exclusions: Exclusion[];
    warnings?: string[];
  };
  features?: {
    status: string;
    coverage?: {
      games: number; teamGames: number; skaterGames: number; uniqueSkaters: number;
      goalieGames: number; uniqueGoalies: number;
      byDate?: { date: string; games: number }[];
      byTeam?: { teamId: number; team: string; games: number }[];
    };
    variables: { id: string; label: string; availableGames: number; usedByOriginal: string | boolean | string[]; limitation: string }[];
    cohort?: { decisions: number; settled: number; training: number | null; selection: number | null; later: number | null; splitPolicy: string };
    ablations: {
      id: string; label: string; status: string;
      trainingGames: number; selectionGames: number; laterGames: number;
      baseline: { games?: number; totalMAE: number | null; marginMAE: number | null };
      candidate: { games?: number; totalMAE: number | null; marginMAE: number | null };
      difference: { totalMAE: number | null; marginMAE: number | null };
      reason?: string;
    }[];
    windowCoverage?: { observed5: number; observed10: number; certified5: number; certified10: number; restCertified: number };
    exclusions: Exclusion[];
    propsReadiness?: { skaterStatRows: number; goalieStatRows: number; status: string; missing: string[] };
    limitations?: string[];
  };
  exactMarkets?: { early: ExactCohort; late: ExactCohort; gates?: Record<string, boolean> };
  warnings?: string[];
  nextSteps?: string[];
};

const card = 'space-y-3 rounded-xl border border-slate-700 bg-slate-950/70 p-4';
const cell = 'px-3 py-3 align-top';
const button = 'rounded-lg border border-teal-400/40 px-3 py-2 text-sm font-semibold text-teal-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300 disabled:cursor-wait disabled:opacity-50';
const number = (value: number | null | undefined, digits = 0) => typeof value === 'number' && Number.isFinite(value)
  ? value.toLocaleString('es-PR', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '—';
const probability = (value: number | null | undefined) => typeof value === 'number' && Number.isFinite(value)
  ? `${number(value * 100, 1)}%` : '—';
const interval = (value: Interval | null | undefined, percent = false) => value
  ? `${percent ? probability(value.low) : number(value.low, 5)} a ${percent ? probability(value.high) : number(value.high, 5)}` : '—';
const stamp = (value: string | null | undefined) => value && Number.isFinite(Date.parse(value))
  ? `${new Intl.DateTimeFormat('es-PR', { timeZone: 'America/Puerto_Rico', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))} PR` : 'Sin captura verificable';
const date = (value: string | null | undefined) => {
  if (!value) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return Number.isFinite(Date.parse(value))
    ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Puerto_Rico', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value)) : '—';
};
const modelLabels: Record<string, string> = {
  dratings: 'DRatings original', circaNoVig: 'Circa sin margen', poisson: 'Poisson tardío', calibrated: 'V6',
};
const modelLabel = (value: string) => modelLabels[value] ?? value;
const usage = (value: string | boolean | string[]) => Array.isArray(value) ? value.join(' · ') || 'No utilizada'
  : typeof value === 'boolean' ? value ? 'Sí' : 'No utilizada' : value;

function MetricsTable({ rows, caption }: { rows: Metric[]; caption: string }) {
  return <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={caption}>
    <table className="min-w-full text-left text-xs">
      <caption className="sr-only">{caption}</caption>
      <thead className="border-b border-slate-700 text-slate-400"><tr>
        {['Referencia', 'Aciertos / partidos', 'Accuracy', 'IC 95% accuracy', 'Brier', 'Log loss'].map(label => <th key={label} scope="col" className={`${cell} whitespace-nowrap`}>{label}</th>)}
      </tr></thead>
      <tbody>{rows.map(row => <tr key={row.model} className="border-b border-slate-800">
        <th scope="row" className={`${cell} font-semibold text-slate-100`}>{row.label}</th>
        <td className={cell}>{row.games > 0 ? `${number(row.hits)} / ${number(row.games)}` : 'Sin partidos'}</td>
        <td className={cell}>{row.games > 0 ? probability(row.accuracy) : '—'}</td>
        <td className={`${cell} whitespace-nowrap`}>{row.games > 0 ? interval(row.accuracyInterval95, true) : '—'}</td>
        <td className={cell}>{row.games > 0 ? number(row.brier, 5) : '—'}</td>
        <td className={cell}>{row.games > 0 ? number(row.logLoss, 5) : '—'}</td>
      </tr>)}</tbody>
    </table>
  </div>;
}

function Inventory({ report }: { report: NhlResearchAuditReport }) {
  const inventory = report.inventory;
  if (!inventory) return <p className="text-sm text-amber-200">Inventario no disponible en esta lectura.</p>;
  return <section className={card} aria-label="Inventario NHL actualizado">
    <h3 className="text-lg font-semibold text-white">Cobertura del archivo</h3>
    <p className="text-xs leading-5 text-slate-400">Una captura repetida o un registro jugador-partido no equivale a un partido independiente. Las fechas describen este archivo; no acreditan temporadas completas.</p>
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tabla de cobertura NHL">
      <table className="min-w-full text-left text-xs">
        <caption className="sr-only">Registros y partidos distintos por conjunto de datos NHL</caption>
        <thead className="border-b border-slate-700 text-slate-400"><tr>{['Conjunto', 'Registros', 'Partidos distintos', 'Fechas del archivo', 'Última captura'].map(label => <th key={label} scope="col" className={`${cell} whitespace-nowrap`}>{label}</th>)}</tr></thead>
        <tbody>{inventory.entries.map(entry => <tr key={entry.key} className="border-b border-slate-800">
          <th scope="row" className={`${cell} min-w-52 font-medium text-slate-100`}>{entry.label}{entry.note ? <p className="mt-1 max-w-md text-xs font-normal leading-5 text-slate-400">{entry.note}</p> : null}</th>
          <td className={cell}>{number(entry.records)}</td><td className={cell}>{number(entry.distinctGames)}</td>
          <td className={`${cell} whitespace-nowrap`}>{entry.from || entry.to ? `${date(entry.from)} a ${date(entry.to)}` : '—'}</td>
          <td className={`${cell} min-w-40`}>{stamp(entry.latestCapturedAt)}</td>
        </tr>)}</tbody>
      </table>
    </div>
    {inventory.entries.length === 0 ? <p role="status" className="text-sm text-amber-200">No hay conjuntos verificados en esta lectura.</p> : null}
    {inventory.quality?.length ? <details className="rounded-lg border border-slate-800 p-3">
      <summary className="cursor-pointer font-semibold text-teal-300 focus-visible:outline-2 focus-visible:outline-teal-300">Calidad, identidades y cobertura faltante</summary>
      <ul className="mt-3 space-y-2 text-xs leading-5">{inventory.quality.map(item => <li key={item.key}><span className="font-semibold text-slate-200">{item.label}: {number(item.count)} {item.unit ?? ''}.</span>{item.note ? ` ${item.note}` : ''}</li>)}</ul>
    </details> : null}
    {report.features?.coverage ? <details className="rounded-lg border border-slate-800 p-3">
      <summary className="cursor-pointer font-semibold text-teal-300 focus-visible:outline-2 focus-visible:outline-teal-300">Distribución por equipo y fecha</summary>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div><h4 className="mb-2 text-xs font-semibold">Partidos por equipo</h4><ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-400">{report.features.coverage.byTeam?.map(row => <li key={row.teamId}>{row.team}: <span className="text-slate-200">{number(row.games)}</span></li>)}</ul></div>
        <div><h4 className="mb-2 text-xs font-semibold">Partidos por fecha</h4><ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-400">{report.features.coverage.byDate?.map(row => <li key={row.date}>{row.date}: <span className="text-slate-200">{number(row.games)}</span></li>)}</ul></div>
      </div>
    </details> : null}
  </section>;
}

function MoneylineResearch({ report }: { report: NonNullable<NhlResearchAuditReport['moneyline']> }) {
  const cohort = report.cohorts.fourWay;
  return <section className={card} aria-label="Comparación Moneyline NHL">
    <div><h3 className="text-lg font-semibold text-white">Moneyline · los mismos partidos</h3>
      <p className="mt-1 text-sm text-teal-300">{number(cohort.games)} partidos independientes con las cuatro referencias{cohort.dateRange ? ` · ${date(cohort.dateRange.from)} a ${date(cohort.dateRange.to)}` : ''}</p></div>
    {cohort.games > 0 ? <MetricsTable rows={report.comparisons} caption="Resultados Moneyline de la cohorte común de cuatro referencias" /> : <p role="status" className="text-sm text-amber-200">Todavía no hay partidos válidos comunes a las cuatro referencias. No se calcula accuracy, Brier ni log loss sobre muestras distintas.</p>}
    <p className="text-xs leading-5 text-slate-400">Brier y log loss miden la calidad de las probabilidades; un valor menor es mejor. El porcentaje de aciertos mide otra cosa. Los intervalos muestran la incertidumbre y no certifican una ventaja.</p>
    {report.comparisons.some(row => (row.thresholdTies ?? 0) > 0) ? <p className="text-xs leading-5 text-slate-400">Empates de probabilidad a 50%: se cuenta al local como selección para conservar la regla del evaluador existente. {report.comparisons.filter(row => (row.thresholdTies ?? 0) > 0).map(row => `${row.label}: ${number(row.thresholdTies)}`).join(' · ')}.</p> : null}
    {!report.sameInformationSet ? <p className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-xs leading-5 text-amber-200">DRatings original y V6 tardío pueden haber usado información disponible en momentos distintos. Compartir partidos no convierte esta comparación en una prueba con la misma información.</p> : null}
    {report.pairedDifferences.length ? <details className="rounded-lg border border-slate-800 p-3">
      <summary className="cursor-pointer font-semibold text-teal-300 focus-visible:outline-2 focus-visible:outline-teal-300">Diferencias pareadas e incertidumbre</summary>
      <p className="mt-3 text-xs leading-5 text-slate-400">Candidato menos referencia, calculado por partido. Una diferencia negativa en Brier o log loss favorece al candidato; si el intervalo incluye cero, la dirección es incierta.</p>
      <div className="mt-2 overflow-x-auto" tabIndex={0} role="region" aria-label="Diferencias pareadas NHL"><table className="min-w-full text-left text-xs">
        <caption className="sr-only">Diferencias de métricas e intervalos del 95% mediante remuestreo pareado</caption>
        <thead className="border-b border-slate-700 text-slate-400"><tr>{['Comparación', 'Partidos', 'Δ Brier', 'IC 95%', 'Δ Log loss', 'IC 95%'].map((label, i) => <th key={`${label}-${i}`} scope="col" className={`${cell} whitespace-nowrap`}>{label}</th>)}</tr></thead>
        <tbody>{report.pairedDifferences.map(row => <tr key={`${row.candidate}-${row.baseline}`} className="border-b border-slate-800"><th scope="row" className={`${cell} font-medium`}>{modelLabel(row.candidate)} − {modelLabel(row.baseline)}</th><td className={cell}>{number(row.games)}</td><td className={cell}>{number(row.brier.estimate, 5)}</td><td className={`${cell} whitespace-nowrap`}>{interval(row.brier.interval95)}</td><td className={cell}>{number(row.logLoss.estimate, 5)}</td><td className={`${cell} whitespace-nowrap`}>{interval(row.logLoss.interval95)}</td></tr>)}</tbody>
      </table></div>
      {report.pairedDifferences.some(row => row.dayBlockSensitivity) ? <div className="mt-3 text-xs leading-5 text-slate-400"><p className="font-semibold text-slate-200">Sensibilidad agrupando partidos por fecha</p><ul className="mt-1 space-y-1">{report.pairedDifferences.filter(row => row.dayBlockSensitivity).map(row => <li key={row.baseline}>{modelLabel(row.candidate)} − {modelLabel(row.baseline)}: {number(row.dayBlockSensitivity!.blocks)} fechas · IC 95% Δ Brier {interval(row.dayBlockSensitivity!.brier.interval95)}.</li>)}</ul><p className="mt-1">Con pocas fechas este cálculo es solo una comprobación de sensibilidad; no confirma una mejora.</p></div> : null}
    </details> : null}
    <details className="rounded-lg border border-slate-800 p-3">
      <summary className="cursor-pointer font-semibold text-teal-300 focus-visible:outline-2 focus-visible:outline-teal-300">Calibración y momento del pronóstico</summary>
      <p className="mt-3 text-xs leading-5 text-slate-400">La calibración compara la probabilidad anunciada de victoria del local con su frecuencia real. Cada bin conserva su propio denominador; un bin vacío aparece sin métricas.</p>
      <div className="mt-3 grid gap-3 xl:grid-cols-2">{report.calibration.map(model => <div key={model.model} className="rounded-lg border border-slate-800 p-3">
        <h4 className="font-semibold text-slate-100">{model.label}</h4>
        <div className="mt-2 overflow-x-auto" tabIndex={0} role="region" aria-label={`Calibración de ${model.label}`}><table className="min-w-full text-left text-xs">
          <caption className="sr-only">Calibración por probabilidad del local: {model.label}</caption>
          <thead className="border-b border-slate-700 text-slate-400"><tr>{['Rango', 'n', 'Anunciada', 'Observada', 'IC 95%'].map(label => <th key={label} scope="col" className="whitespace-nowrap px-2 py-2">{label}</th>)}</tr></thead>
          <tbody>{model.bins.map(bin => <tr key={`${bin.lower}-${bin.upper}`} className="border-b border-slate-800"><th scope="row" className="whitespace-nowrap px-2 py-2 font-normal">{bin.label}</th><td className="px-2 py-2">{number(bin.games)}</td><td className="px-2 py-2">{bin.games > 0 ? probability(bin.meanProbability) : '—'}</td><td className="px-2 py-2">{bin.games > 0 ? probability(bin.observedHomeWinRate) : '—'}</td><td className="whitespace-nowrap px-2 py-2">{bin.games > 0 ? interval(bin.interval95, true) : '—'}</td></tr>)}</tbody>
        </table></div>
      </div>)}</div>
      <h4 className="mt-4 font-semibold text-slate-100">Anticipación frente al inicio</h4>
      <ul className="mt-2 space-y-2 text-xs leading-5 text-slate-400">{report.timing.map(row => <li key={row.model}><span className="font-semibold text-slate-200">{row.label}:</span> mediana {number(row.medianMinutes, 1)} min; rango {number(row.minMinutes, 1)}–{number(row.maxMinutes, 1)} min · n = {number(row.games)} · sin hora verificable: {number(row.missing)}.</li>)}</ul>
    </details>
    {report.subgroups?.length ? <details className="rounded-lg border border-slate-800 p-3">
      <summary className="cursor-pointer font-semibold text-teal-300 focus-visible:outline-2 focus-visible:outline-teal-300">Subgrupos exploratorios</summary>
      <p className="mt-3 text-xs leading-5 text-slate-400">Los grupos reutilizan partidos y pueden ser muy pequeños. Estos desgloses generan hipótesis, sin demostrar superioridad ni añadir partidos a la muestra.</p>
      <div className="mt-3 space-y-4">{report.subgroups.map(group => <div key={`${group.dimension}-${group.group}`}><h4 className="font-semibold text-slate-100">{group.dimension} · {group.group}</h4><MetricsTable rows={group.comparisons} caption={`Subgrupo ${group.dimension}: ${group.group}`} /></div>)}</div>
    </details> : null}
  </section>;
}

function FeatureResearch({ report }: { report: NonNullable<NhlResearchAuditReport['features']> }) {
  const windows = report.windowCoverage;
  return <section className={card} aria-label="Variables y pruebas NHL">
    <h3 className="text-lg font-semibold text-white">Variables disponibles y aporte observado</h3>
    <p className="text-xs leading-5 text-slate-400">Guardar una variable no significa que el modelo la utilice. Las pruebas añaden cada grupo por separado, con la misma muestra para su referencia y candidato.</p>
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Variables utilizadas por NHL"><table className="min-w-full text-left text-xs">
      <caption className="sr-only">Disponibilidad de variables NHL y uso real en los modelos existentes</caption>
      <thead className="border-b border-slate-700 text-slate-400"><tr>{['Variable', 'Partidos disponibles', 'Uso actual', 'Límite de la evidencia'].map(label => <th key={label} scope="col" className={`${cell} whitespace-nowrap`}>{label}</th>)}</tr></thead>
      <tbody>{report.variables.map(row => <tr key={row.id} className="border-b border-slate-800"><th scope="row" className={`${cell} font-medium text-slate-100`}>{row.label}</th><td className={cell}>{number(row.availableGames)}</td><td className={cell}>{usage(row.usedByOriginal)}</td><td className={`${cell} min-w-64 leading-5 text-slate-400`}>{row.limitation}</td></tr>)}</tbody>
    </table></div>
    {windows ? <p className="rounded-lg border border-slate-800 p-3 text-xs leading-5 text-slate-400">Ventanas observadas: cinco partidos {number(windows.observed5)}, diez partidos {number(windows.observed10)}. Ventanas con calendario completo certificado: cinco {number(windows.certified5)}, diez {number(windows.certified10)}. Descanso certificado: {number(windows.restCertified)}. Los últimos registros guardados pueden omitir partidos intermedios.</p> : null}
    {report.cohort ? <div className="text-xs leading-5 text-slate-400"><p>Base de investigación: {number(report.cohort.decisions)} decisiones por partido · {number(report.cohort.settled)} con resultado final. Cada variable conserva su propia separación cronológica y sus denominadores en la tabla.</p><p>Los coeficientes se ajustan con resultados anteriores a las decisiones evaluadas. El tramo posterior no se utiliza para escoger parámetros.</p></div> : null}
    <h4 className="font-semibold text-slate-100">Pruebas separadas de variables</h4>
    {report.ablations.length ? <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Pruebas separadas de variables NHL"><table className="min-w-full text-left text-xs">
      <caption className="sr-only">Error absoluto medio de goles totales y margen para cada prueba NHL en su misma cohorte posterior</caption>
      <thead className="border-b border-slate-700 text-slate-400"><tr>{['Prueba', 'n entrenamiento / selección / posterior', 'MAE total: referencia → candidato', 'MAE margen: referencia → candidato', 'Resultado y limitación'].map(label => <th key={label} scope="col" className={`${cell} min-w-36`}>{label}</th>)}</tr></thead>
      <tbody>{report.ablations.map(row => <tr key={row.id} className="border-b border-slate-800">
        <th scope="row" className={`${cell} font-medium text-slate-100`}>{row.label}</th><td className={cell}>{number(row.trainingGames)} / {number(row.selectionGames)} / {number(row.laterGames)}</td>
        <td className={cell}>{row.baseline.totalMAE !== null && row.candidate.totalMAE !== null ? <>{number(row.baseline.totalMAE, 3)} → {number(row.candidate.totalMAE, 3)}<p className="mt-1 text-slate-400">Δ {number(row.difference.totalMAE, 3)}</p></> : 'Sin evaluación'}</td>
        <td className={cell}>{row.baseline.marginMAE !== null && row.candidate.marginMAE !== null ? <>{number(row.baseline.marginMAE, 3)} → {number(row.candidate.marginMAE, 3)}<p className="mt-1 text-slate-400">Δ {number(row.difference.marginMAE, 3)}</p></> : 'Sin evaluación'}</td>
        <td className={`${cell} min-w-64 leading-5 text-slate-400`}>{row.reason ?? row.status}</td>
      </tr>)}</tbody>
    </table></div> : <p className="text-sm text-amber-200">Aún no hay pruebas de variables con una cohorte verificable.</p>}
    <p className="text-xs leading-5 text-amber-200">El tramo posterior de esta auditoría sigue siendo exploratorio. Las fórmulas nuevas requieren partidos futuros que no se hayan usado para diseñarlas. Una diferencia favorable en esta muestra no activa recomendaciones.</p>
    {report.propsReadiness ? <div className="rounded-lg border border-slate-800 p-3">
      <h4 className="font-semibold text-slate-100">Tiros a puerta y atajadas · preparación de props</h4>
      <p className="mt-2 text-xs leading-5 text-slate-400">Estadísticas normalizadas: {number(report.propsReadiness.skaterStatRows)} registros de jugadores de cancha y {number(report.propsReadiness.goalieStatRows)} de porteros. Los probables de ESPN conservan esa condición; no son confirmaciones oficiales.</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-amber-200">{report.propsReadiness.missing.map(item => <li key={item}>{item}</li>)}</ul>
    </div> : null}
  </section>;
}

function ExactMarkets({ report }: { report: NonNullable<NhlResearchAuditReport['exactMarkets']> }) {
  return <section className={card} aria-label="Líneas exactas NHL en la auditoría">
    <h3 className="text-lg font-semibold text-white">Puck line y total · línea exacta archivada</h3>
    <p className="text-xs leading-5 text-slate-400">Cada mercado compara el mismo partido, línea y precio Circa capturado antes del pronóstico. PUSH se cuenta por separado y se excluye de Brier y log loss binarios.</p>
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Métricas de líneas exactas NHL"><table className="min-w-full text-left text-xs">
      <caption className="sr-only">Comparación de Poisson y Circa sin margen en contratos con la línea exacta del archivo</caption>
      <thead className="border-b border-slate-700 text-slate-400"><tr>{['Cohorte / mercado', 'Pares con precio', 'Evaluados', 'PUSH', 'Brier modelo / Circa', 'Log loss modelo / Circa'].map(label => <th key={label} scope="col" className={`${cell} whitespace-nowrap`}>{label}</th>)}</tr></thead>
      <tbody>{([['early', 'Poisson temprano'], ['late', 'V6 tardío']] as const).flatMap(([key, label]) => (['spread', 'total'] as const).map(market => {
        const score = report[key]?.markets?.[market];
        return <tr key={`${key}-${market}`} className="border-b border-slate-800"><th scope="row" className={`${cell} font-medium text-slate-100`}>{label} · {market === 'spread' ? 'Puck line' : 'Total'}</th><td className={cell}>{number(score?.pricedEvents)}</td><td className={cell}>{number(score?.graded)}</td><td className={cell}>{number(score?.pushes)}</td><td className={cell}>{score && score.graded > 0 ? `${number(score.modelBrier, 5)} / ${number(score.circaNoVigBrier, 5)}` : 'Sin evaluación'}</td><td className={cell}>{score && score.graded > 0 ? `${number(score.modelLogLoss, 5)} / ${number(score.circaNoVigLogLoss, 5)}` : 'Sin evaluación'}</td></tr>;
      }))}</tbody>
    </table></div>
    <p className="text-xs leading-5 text-amber-200">La comparación estadística usa el marcador final oficial. La aplicación de overtime y shootout depende del contrato específico; las reglas y la hora original del precio siguen sin certificar. Esto no acredita ROI ejecutable, CLV ni ventaja sobre FanDuel.</p>
  </section>;
}

function Exclusions({ rows }: { rows: Exclusion[] }) {
  const [page, setPage] = useState(0);
  const pageSize = 20;
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pages - 1);
  return <details className="rounded-xl border border-slate-700 bg-slate-950/70 p-4">
    <summary className="cursor-pointer font-semibold text-teal-300 focus-visible:outline-2 focus-visible:outline-teal-300">Exclusiones por partido y análisis · {number(rows.length)} motivos</summary>
    <p className="mt-3 text-xs leading-5 text-slate-400">Un partido puede aparecer en varios análisis y tener más de un motivo. Este conteo no representa partidos independientes adicionales.</p>
    {rows.length > 0 ? <>
      <div className="mt-2 overflow-x-auto" tabIndex={0} role="region" aria-label="Partidos excluidos NHL"><table className="min-w-full text-left text-xs">
        <caption className="sr-only">Partidos excluidos y motivo específico por análisis</caption>
        <thead className="border-b border-slate-700 text-slate-400"><tr>{['Partido', 'Análisis', 'Motivo registrado'].map(label => <th key={label} scope="col" className={cell}>{label}</th>)}</tr></thead>
        <tbody>{rows.slice(current * pageSize, (current + 1) * pageSize).map((row, index) => <tr key={`${row.eventId}-${row.source ?? row.scope}-${row.reason}-${index}`} className="border-b border-slate-800"><th scope="row" className={`${cell} whitespace-nowrap font-medium`}>{row.eventId ?? 'Identidad ausente'}</th><td className={cell}>{row.source ?? row.scope ?? 'Archivo'}{row.market ? ` · ${row.market === 'spread' ? 'Puck line' : 'Total'}` : ''}</td><td className={`${cell} break-words`}>{row.reasonLabel ?? row.reason}{row.reasonLabel ? <p className="mt-1 text-[11px] text-slate-500">{row.reason}</p> : null}</td></tr>)}</tbody>
      </table></div>
      <div className="mt-3 flex flex-wrap items-center gap-3"><button type="button" disabled={current === 0} className={button} onClick={() => setPage(current - 1)}>Anterior</button><p role="status" className="text-xs text-slate-400">Página {current + 1} de {pages}</p><button type="button" disabled={current + 1 >= pages} className={button} onClick={() => setPage(current + 1)}>Siguiente</button></div>
    </> : <p className="mt-3 text-sm text-slate-400">No hay exclusiones registradas en las secciones evaluadas.</p>}
  </details>;
}

export function NhlResearchAuditContent({ report }: { report: NhlResearchAuditReport }) {
  if (report.status !== 'READ_ONLY_NHL_RESEARCH_AUDIT') return <p role="status" className="rounded-lg border border-amber-400/30 p-4 text-sm leading-6 text-amber-200">{report.status === 'EMPTY_ARCHIVE'
    ? 'El archivo no contiene datos suficientes para esta auditoría. No se muestran métricas.'
    : report.status === 'SOURCE_SCAN_CAPPED'
      ? 'La lectura alcanzó su límite antes de completar el archivo. Las cifras parciales no se presentan como una auditoría completa.'
      : 'No se pudo verificar una lectura completa del archivo. Intenta consultar de nuevo.'}{report.warning ? ` ${report.warning}` : ''}</p>;
  const exclusions = [...(report.moneyline?.exclusions ?? []), ...(report.features?.exclusions ?? []),
    ...(report.exactMarkets?.early.exclusions ?? []).map(row => ({ ...row, source: 'Línea exacta · Poisson temprano' })),
    ...(report.exactMarkets?.late.exclusions ?? []).map(row => ({ ...row, source: 'Línea exacta · V6 tardío' }))];
  const warnings = [...new Set([...(report.warnings ?? []), ...(report.moneyline?.warnings ?? []), ...(report.features?.limitations ?? [])])];
  return <div className="space-y-4">
    <p className="text-xs text-slate-400">Corte verificado: <strong className="text-slate-200">{stamp(report.auditedAt)}</strong>. Investigación con datos almacenados.</p>
    <Inventory report={report} />
    {report.modelInputs?.length ? <section className={card} aria-label="Entradas reales de los modelos NHL">
      <h3 className="text-lg font-semibold text-white">Qué utiliza cada modelo</h3>
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Entradas del modelo y evidencia adicional NHL"><table className="min-w-full text-left text-xs">
        <caption className="sr-only">Variables que modifican cada modelo y evidencia adicional que no ajusta sus probabilidades</caption>
        <thead className="border-b border-slate-700 text-slate-400"><tr>{['Modelo', 'Entradas que utiliza', 'Evidencia adicional o limitación'].map(label => <th key={label} scope="col" className={cell}>{label}</th>)}</tr></thead>
        <tbody>{report.modelInputs.map(row => <tr key={row.model} className="border-b border-slate-800"><th scope="row" className={`${cell} min-w-36 font-semibold text-slate-100`}>{row.model}</th><td className={`${cell} min-w-52`}><ul className="list-disc space-y-1 pl-4 leading-5">{row.used.map(item => <li key={item}>{item}</li>)}</ul></td><td className={`${cell} min-w-52 text-slate-400`}><ul className="list-disc space-y-1 pl-4 leading-5">{row.evidenceOnly.map(item => <li key={item}>{item}</li>)}</ul></td></tr>)}</tbody>
      </table></div>
    </section> : null}
    {report.moneyline ? <MoneylineResearch report={report.moneyline} /> : <p role="status" className="text-sm text-amber-200">Comparación Moneyline no disponible en esta lectura.</p>}
    {report.features ? <FeatureResearch report={report.features} /> : <p role="status" className="text-sm text-amber-200">Análisis de variables no disponible en esta lectura.</p>}
    {report.exactMarkets ? <ExactMarkets report={report.exactMarkets} /> : null}
    <Exclusions rows={exclusions} />
    {warnings.length ? <details className="rounded-xl border border-slate-700 bg-slate-950/70 p-4"><summary className="cursor-pointer font-semibold text-teal-300 focus-visible:outline-2 focus-visible:outline-teal-300">Limitaciones de esta evaluación</summary><ul className="mt-3 list-disc space-y-2 pl-5 text-xs leading-5 text-slate-400">{warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></details> : null}
    {report.nextSteps?.length ? <section className={card} aria-label="Próximos criterios de evaluación NHL"><h3 className="font-semibold text-slate-100">Próximos criterios de evaluación</h3><ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-300">{report.nextSteps.map(step => <li key={step}>{step}</li>)}</ol></section> : null}
  </div>;
}

export default function NhlResearchAuditPanel() {
  const [report, setReport] = useState<NhlResearchAuditReport | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const activeRequest = useRef<AbortController | null>(null);
  useEffect(() => () => activeRequest.current?.abort(), []);
  const load = async () => {
    if (activeRequest.current) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    const timeout = setTimeout(() => controller.abort(), 60_000);
    setLoading(true); setError(''); setReport(null);
    try {
      const response = await fetch('/api/nhl/research-audit', { cache: 'no-store', signal: controller.signal });
      const payload = await response.json() as NhlResearchAuditReport;
      if (!payload || typeof payload !== 'object') throw new Error('No se recibió una auditoría completa y verificable. Intenta consultar de nuevo.');
      if (['EMPTY_ARCHIVE', 'READ_UNAVAILABLE', 'SOURCE_SCAN_CAPPED'].includes(payload.status)) {
        setReport(payload);
        return;
      }
      if (!response.ok || payload.status !== 'READ_ONLY_NHL_RESEARCH_AUDIT' || payload.readOnly !== true
        || payload.providerCalls !== 0 || payload.databaseWrites !== 0 || !payload.inventory || !payload.moneyline || !payload.features) {
        throw new Error('No se recibió una auditoría completa y verificable. Intenta consultar de nuevo.');
      }
      setReport(payload);
    } catch (cause) {
      setError(controller.signal.aborted ? 'La lectura excedió el tiempo de espera. No se muestran cifras parciales; puedes volver a consultar.'
        : cause instanceof Error && cause.message.startsWith('No se recibió una auditoría') ? cause.message
          : 'No se pudo consultar una auditoría verificable. Intenta de nuevo.');
    } finally {
      clearTimeout(timeout); activeRequest.current = null; setLoading(false);
    }
  };
  return <section id="nhl-research-audit" aria-label="Auditoría integral de datos NHL" className="rounded-xl border border-teal-400/25 bg-slate-900/60 p-4">
    <details>
      <summary className="cursor-pointer rounded-lg py-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-300"><span className="text-lg font-bold text-slate-100">NHL · datos, modelos y pruebas</span><span className="mt-1 block text-xs leading-5 text-slate-400">Cobertura, calibración, variables y exclusiones. Abrir investigación.</span></summary>
      <div className="mt-4 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="max-w-3xl text-xs leading-5 text-slate-400">Consulta el archivo ya guardado y compara referencias sobre partidos equivalentes. Cuotas Circa publicadas por DRatings; porteros probables de ESPN. Las pruebas permanecen en investigación y no crean jugadas oficiales.</p>
          <button type="button" disabled={loading} onClick={load} className={button}>{loading ? 'Verificando archivo…' : report ? 'Actualizar auditoría NHL' : 'Consultar auditoría NHL'}</button>
        </div>
        {loading ? <p role="status" aria-live="polite" className="text-sm text-slate-400">Leyendo y comprobando los datos almacenados…</p> : null}
        {error ? <p role="alert" className="rounded-lg border border-amber-400/30 p-3 text-sm leading-6 text-amber-200">{error}</p> : null}
        {report ? <NhlResearchAuditContent report={report} /> : null}
      </div>
    </details>
  </section>;
}
