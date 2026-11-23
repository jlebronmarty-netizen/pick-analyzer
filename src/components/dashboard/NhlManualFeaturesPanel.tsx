'use client';

import {useEffect,useRef,useState} from 'react';
import type {NhlManualFeaturesReport,NhlManualFeatureTeam} from '@/types/nhl-manual-features';

const number=(v:number|null,decimals=2)=>v===null?'Sin dato':v.toLocaleString('es-PR',{maximumFractionDigits:decimals});
const percent=(v:number|null)=>v===null?'Sin dato':`${number(v)}%`;
const goalieLabels:Record<string,string>={NO_CONFIRMADO:'Sin confirmar',PROBABLE:'Probable',CONFIRMADO:'Confirmado'};
const goalieStatus=(status:string)=>goalieLabels[status]??'Estado sin verificar';
const stamp=(v:string|null)=>v&&Number.isFinite(Date.parse(v))?new Intl.DateTimeFormat('es-PR',{timeZone:'America/Puerto_Rico',dateStyle:'short',timeStyle:'short'}).format(new Date(v))+' PR':'Sin hora verificada';

function TeamInputs({team}:{team:NhlManualFeatureTeam}) {
  const recent=team.last10;
  return <div className="min-w-0 space-y-2 rounded-lg border border-slate-700 p-3 text-sm">
    <h4 className="font-bold text-teal-300">{team.abbrev}</h4>
    <p>Temporada: <strong>{team.season.record??'Sin récord'}</strong> · {number(team.season.points,0)} puntos</p>
    <p>Goles a favor / en contra por partido: {number(team.season.goalsForPerGame)} / {number(team.season.goalsAgainstPerGame)}</p>
    <p>Recientes: <strong>{recent.record??'Sin récord'}</strong> · {number(recent.games,0)} partidos · {recent.complete?'Últimos diez completos':'Cobertura parcial'}</p>
    <p>Goles recientes por partido: {number(recent.goalsForPerGame)} / {number(recent.goalsAgainstPerGame)}</p>
    <p>Tiros recientes por partido: {number(recent.shotsForPerGame)} / {number(recent.shotsAgainstPerGame)}</p>
    <p>Portero: <strong>{team.goalie.name??'Sin identificar'}</strong> · {goalieStatus(team.goalie.status)}</p>
    <p className="text-xs text-slate-400">Reporte: {stamp(team.goalie.checkedAt)}</p>
    <p>Descanso: {team.rest.verified&&team.rest.daysOff!==null?`${number(team.rest.daysOff,0)} días sin partido`:'Secuencia sin verificar'}{team.rest.backToBack===true?' · juega en días consecutivos':''}</p>
    <details className="pt-1 text-xs">
      <summary className="cursor-pointer py-1 font-semibold text-teal-300 focus-visible:outline-2 focus-visible:outline-teal-300">Períodos y equipos especiales</summary>
      <p className="mt-2">PP: {percent(team.specialTeams.powerPlayPct)} · PK: {percent(team.specialTeams.penaltyKillPct)}</p>
      <p className="mt-1 text-slate-400">{team.specialTeams.currentGamesMatch?'Partidos jugados coinciden con clasificación':'PP/PK tiene otro corte o no está verificado'} · {stamp(team.specialTeams.capturedAt)}</p>
      {recent.periods.length?<ul className="mt-2 space-y-2">{recent.periods.map(p=><li key={p.period}>P{p.period} · {number(p.games,0)} partidos · goles {number(p.goalsForPerGame)} / {number(p.goalsAgainstPerGame)} · tiros {number(p.shotsForPerGame)} / {number(p.shotsAgainstPerGame)}. Cobertura: goles {number(p.goalsCoverage,0)}; tiros {number(p.shotsCoverage,0)}.</li>)}</ul>:<p className="mt-2">Sin desglose por período.</p>}
      <p className="mt-2 text-slate-400">Promedios del historial reciente; los huecos no se cuentan como cero.</p>
    </details>
  </div>;
}

export function NhlManualFeaturesContent({report}:{report:NhlManualFeaturesReport}) {
  return <div className="mt-4 space-y-4">
    <p role="status" className="text-sm text-amber-200">{report.warnings[0]}</p>
    <p className="text-xs text-slate-400">Fecha: {report.date} · Lectura: {stamp(report.readAt)}</p>
    {report.summary?<p className="text-sm text-teal-300">{report.summary.games} partidos guardados · {report.summary.pregameGames} por comenzar · últimos diez completos en ambos: {report.summary.bothLast10Complete} · ambos porteros confirmados: {report.summary.bothGoaliesConfirmed}</p>:null}
    <div className="space-y-4">{report.fixtures.map(f=><article key={f.eventId} className="space-y-3 rounded-xl border border-slate-700 bg-slate-950/70 p-3 sm:p-4">
      <h3 className="text-lg font-semibold text-white">{f.teams.away.abbrev} en {f.teams.home.abbrev}</h3>
      <p className="text-xs text-slate-400">Inicio: {stamp(f.scheduledAt)} · {f.phase==='PREGAME'?'Prepartido':'Partido iniciado · corte histórico'}</p>
      <p className="text-xs text-slate-400">Disponible en Pick: {stamp(f.availableAsOf)} · Generado por la fuente: {stamp(f.sourceGeneratedAt)}</p>
      <p className="text-xs text-slate-400">Clasificación al {f.coverage.standingsThrough??'corte no verificado'} · {f.coverage.standingsCurrent?'corte actualizado':'corte anterior o sin verificar'}</p>
      <div className="grid gap-3 md:grid-cols-2"><TeamInputs team={f.teams.away}/><TeamInputs team={f.teams.home}/></div>
    </article>)}</div>
    <p className="text-xs leading-5 text-slate-400">Los datos compartidos aún no ajustan las probabilidades de Pick. La hora de guardado acredita su disponibilidad en Pick; la generación de la fuente conserva su propio corte. Un portero probable mantiene su estado hasta recibir una confirmación verificable.</p>
  </div>;
}

export default function NhlManualFeaturesPanel() {
  const [report,setReport]=useState<NhlManualFeaturesReport|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const request=useRef<AbortController|null>(null);
  useEffect(()=>()=>request.current?.abort(),[]);
  async function load() {
    request.current?.abort();
    const controller=new AbortController();request.current=controller;
    setLoading(true);setError(null);
    try {
      const response=await fetch('/api/nhl/manual-features',{cache:'no-store',signal:controller.signal});
      const data=await response.json() as NhlManualFeaturesReport;
      if(!['READY','EMPTY','NOT_INSTALLED','READ_UNAVAILABLE','SOURCE_SCAN_CAPPED'].includes(data.status)||!Array.isArray(data.fixtures)||!Array.isArray(data.warnings))throw new Error('INVALID_RESPONSE');
      if(!controller.signal.aborted)setReport(data);
    } catch {
      if(!controller.signal.aborted){setReport(null);setError('No se pudo consultar la información compartida. Puedes volver a intentarlo.');}
    } finally {if(!controller.signal.aborted)setLoading(false);}
  }
  return <section aria-label="Datos NHL compartidos" className="rounded-xl border border-slate-700 bg-slate-900 p-4 sm:p-5">
    <h2 className="text-xl font-bold text-white">Datos compartidos para el análisis</h2>
    <p className="mt-2 text-sm leading-6 text-slate-300">Récords, últimos diez, goles, tiros, períodos, descanso y porteros del panel manual. Consulta los cortes guardados para el día de hoy.</p>
    <p className="mt-2 text-xs text-amber-200">Disponibles para investigación. Todavía no ajustan las probabilidades ni las selecciones de Pick.</p>
    <button type="button" onClick={load} disabled={loading} className="mt-3 rounded-lg border border-teal-400/40 px-4 py-2 text-sm font-semibold text-teal-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300 disabled:opacity-50">{loading?'Consultando…':report?'Actualizar datos compartidos':'Consultar datos compartidos'}</button>
    {error?<p role="alert" className="mt-3 text-sm text-amber-200">{error}</p>:null}
    {report?<NhlManualFeaturesContent report={report}/>:null}
  </section>;
}
