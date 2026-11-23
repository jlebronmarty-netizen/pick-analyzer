'use client';
import Link from 'next/link';
import {useState} from 'react';
import type {ModelCohort,SportModelCard} from '@/lib/sport-model-overview';
const pct=(v:number|null|undefined)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1?(100*v).toFixed(2)+'%':'—';
const sportLabel=(label:string)=>label.replace('Soccer · LaLiga','Fútbol').replace('NCAAF · PPG','NCAAF').replace('Tennis','Tenis');
const classificationLabel=(value:string)=>value.replace('Producción + forward research','PRODUCCIÓN / RESEARCH').replace('Experimental · proceso diario FREE','EXPERIMENTAL · FREE').replaceAll(' / ',' · ').replaceAll(' + ',' · ');
const metricLabel=(card:SportModelCard)=>card.metricLabel==='Ganador / empate (1X2)'?'1X2':card.metricLabel??({mlb:'Selecciones registradas',nhl:'Moneyline',ncaab:'Ganador'}[card.key as 'mlb'|'nhl'|'ncaab']??'Mercado no identificado');
const checkedAtLabel=(value:string)=>Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat('es-PR',{timeZone:'America/Puerto_Rico',day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(value)):'No verificada';
const scopeLabel=(cohort:ModelCohort)=>cohort.modelVersion==='nba_prediction_engine_v1_1_inputs_shadow'?'NBA GOAT · v1.1 · SHADOW':cohort.modelVersion==='nba_prediction_engine_v1'?'NBA GOAT · v1 · SHADOW':cohort.label;
const settledContracts=(c:ModelCohort|undefined)=>c?.available&&typeof c.wins==='number'&&typeof c.losses==='number'?c.wins+c.losses:null;
const order=['nba','nhl','ncaab','ncaaf','nfl','soccer','table-tennis','tennis','ufc','bsn','mlb'];
function position(key:string){const index=order.indexOf(key);return index<0?order.length:index;}
export default function SportModelOverview({cards}:{cards:SportModelCard[]}){
 const [phase,setPhase]=useState('REGULAR_SEASON');
 const ordered=[...cards].sort((a,b)=>position(a.key)-position(b.key));
 return <section aria-label="Accuracy de modelos por deporte" className="space-y-4">
  <header><h2 className="text-xl font-semibold">Elige un deporte</h2><p className="mt-2 text-sm text-slate-400">Accuracy registrada por mercado y cohorte. Cada tarjeta abre el análisis de ese deporte; los detalles del historial se consultan aparte.</p></header>
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{ordered.map(card=>{
   const c=card.cohorts.find(cohort=>cohort.key===phase)??card.cohorts[0],settled=settledContracts(c);
   return <article key={card.key} data-sport-card={card.key} className="min-w-0 rounded-xl border border-slate-700 bg-slate-900">
    <Link prefetch={false} href={card.href} aria-label={`Abrir ${sportLabel(card.label)}: análisis y mercados`} className="block rounded-xl p-5 transition hover:bg-slate-800/60 focus-visible:outline-2 focus-visible:outline-teal-300">
     <div className="flex flex-wrap items-start justify-between gap-3"><h3 className="text-xl font-bold">{sportLabel(card.label)}</h3><span className="max-w-full rounded-full border border-slate-600 bg-slate-950/60 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-300">{classificationLabel(card.classification)}</span></div>
     <p className="mt-4 text-xs text-slate-300">Accuracy · {metricLabel(card)}</p>
     <p className="mt-1 text-3xl font-bold tabular-nums">{c?.available?pct(c.accuracy):'—'}</p>
     <p className="mt-2 text-sm">{c?.available?`${c.wins??'—'} W / ${c.losses??'—'} L · ${c.pending??'—'} pendientes`:'Resultados no conectados o no disponibles'}</p>
     {settled!==null&&<p className="mt-1 text-xs text-slate-400">{settled} contratos evaluados · W + L</p>}
     {c?.available&&Number.isInteger(c.settledUniqueGames)&&<p className="mt-1 text-xs text-slate-400">{c.settledUniqueGames} juegos únicos liquidados</p>}
     {c&&<p className="mt-3 break-words text-xs leading-5 text-teal-300">{scopeLabel(c)}</p>}
     {card.models!==undefined&&card.models>1&&<p className="mt-1 text-xs text-slate-400">{card.models} versiones · resultados separados en el historial</p>}
     {!c?.modelVersion&&c?.models!=null&&c.models>1&&<p className="mt-1 text-xs text-slate-400">Cohorte descriptiva de {c.models} modelos</p>}
     <p className="mt-4 text-sm font-semibold text-teal-300">{card.linkLabel??'Abrir análisis y mercados →'}</p>
    </Link>
    <details className="border-t border-slate-700 px-5 py-3">
     <summary className="cursor-pointer rounded py-1 text-sm text-slate-300 focus-visible:outline-2 focus-visible:outline-teal-300">Historial y métricas de {sportLabel(card.label)}</summary>
     <div className="mt-3 space-y-3 text-xs leading-5 text-slate-400">
      {card.key==='mlb'&&<div role="group" aria-label="Fase MLB de las tarjetas" className="flex flex-wrap gap-2">{[['REGULAR_SEASON','Temporada regular'],['POSTSEASON','Playoffs']].map(([key,name])=><button type="button" key={key} onClick={()=>setPhase(key)} aria-pressed={phase===key} className={`min-h-11 rounded-lg border px-3 py-2 focus-visible:outline-2 focus-visible:outline-teal-300 ${phase===key?'border-teal-400 bg-teal-500/10':'border-slate-600'}`}>{name}</button>)}</div>}
      {c&&<><p>{c.note}</p>{c.modelVersion&&<p className="break-all">Versión mostrada: {c.modelVersion}</p>}</>}
      {card.cohorts.filter(other=>other.modelVersion&&other.key!==c?.key).map(other=><div key={other.key} className="border-t border-slate-700 pt-3"><p className="break-words text-teal-300">{scopeLabel(other)}</p><p>{other.available?`${pct(other.accuracy)} · ${other.wins??'—'} W / ${other.losses??'—'} L · ${other.pending??'—'} pendientes`:'Resultados no disponibles'}</p>{other.available&&Number.isInteger(other.settledUniqueGames)&&<p>{other.settledUniqueGames} juegos únicos liquidados · historial separado</p>}<p className="break-all">{other.modelVersion}</p></div>)}
      {card.detailLines?.map(line=><p className="break-words" key={line}>{line}</p>)}
      {card.checkedAt&&<p>Lectura del informe: {checkedAtLabel(card.checkedAt)} PR</p>}
     </div>
    </details>
   </article>;
  })}</div>
  <p className="text-xs leading-5 text-slate-400">Accuracy = W/(W+L). Pendientes, pushes y voids quedan fuera. Los contratos pueden compartir partido; solo se muestran juegos únicos cuando ese dato está disponible. Cada deporte conserva su mercado, cohorte y versiones. Estas métricas descriptivas no son probabilidades de una apuesta ni validación de una ventaja.</p>
 </section>;
}
