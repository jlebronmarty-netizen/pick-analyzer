'use client';
import {useMemo,useState} from 'react';

export type SportDecisionMarket='ml'|'spread'|'total'|'props'|'periods';
export type SportDecisionRow={
 id:string;market:SportDecisionMarket;matchup:string;selection:string;
 status:'SHADOW'|'MODEL_ONLY'|'EXPERIMENTAL';
 startsAt?:string|null;capturedAt?:string|null;
 line?:number|null;odds?:number|null;projection?:string|null;
 probability?:number|null;gap?:number|null;gapUnit?:string|null;
 evidence?:string|null;note?:string|null;eligible:boolean;
};
const tabs:[string,string][]=[['top','Top oportunidades'],['ml','Moneyline'],['spread','Spread'],['total','Total'],['props','Player props'],['periods','Cuartos / Mitades']];
const isNumber=(n:number|null|undefined):n is number=>typeof n==='number'&&Number.isFinite(n);
const date=(iso?:string|null)=>iso?new Intl.DateTimeFormat('es-PR',{timeZone:'America/Puerto_Rico',dateStyle:'short',timeStyle:'short'}).format(new Date(iso)):'Sin fecha';
export default function SportDecisionBoard({sport,rows,description}:{
 sport:string;rows:SportDecisionRow[];description?:string;
}){
 const [tab,setTab]=useState('top'),[sort,setSort]=useState('gap'),[query,setQuery]=useState('');
 const [expanded,setExpanded]=useState(false);
 const counts=useMemo(()=>Object.fromEntries(tabs.slice(1).map(([id])=>[id,rows.filter(x=>x.market===id).length])),[rows]);
 const visible=useMemo(()=>{
  const input=(tab==='top'?rows.filter(r=>r.eligible):rows.filter(r=>r.market===tab))
   .filter(r=>r.selection&&(!query||(r.matchup+' '+r.selection).toLowerCase().includes(query.toLowerCase())));
  return [...input].sort((a,b)=>{
   if(sort==='date')return (Date.parse(a.startsAt??'')||0)-(Date.parse(b.startsAt??'')||0)||a.id.localeCompare(b.id);
   if(sort==='probability')return (isNumber(b.probability)?b.probability:-1)-(isNumber(a.probability)?a.probability:-1)||a.id.localeCompare(b.id);
   return (isNumber(b.gap)?b.gap:-Infinity)-(isNumber(a.gap)?a.gap:-Infinity)||a.id.localeCompare(b.id);
  }).slice(0,tab==='top'?25:100);
 },[rows,tab,sort,query]);
 return <section aria-label={sport+' Decision Board'} className="space-y-4 rounded-2xl border border-slate-700 bg-slate-950/60 p-4 sm:p-5">
  <div className="flex flex-wrap justify-between gap-3">
   <div><p className="text-xs font-bold uppercase tracking-widest text-teal-300">PICK ANALYZER · {sport}</p>
    <h2 className="mt-1 text-2xl font-bold text-slate-100">Decision Board</h2>
    <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-400">{description??'Vista de investigación con datos previamente registrados. No crea recomendaciones oficiales.'}</p>
   </div>
   <p className="text-xs text-amber-200">Oportunidad ≠ probabilidad calibrada ni EV demostrado</p>
  </div>
  <div role="tablist" aria-label={'Mercados '+sport} className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
   {tabs.map(([id,label])=><button key={id} type="button" role="tab" aria-selected={tab===id}
    onClick={()=>setTab(id)}
    className={`rounded-xl border px-3 py-3 text-left text-sm font-semibold ${tab===id?'border-teal-400 bg-teal-500/10':'border-slate-700 bg-slate-900'}`}>
     {label}<span className="mt-1 block text-xs font-normal text-slate-400">{id==='top'?rows.filter(r=>r.eligible).length:(counts[id]||'Sin mercado verificado')}</span>
    </button>)}
  </div>
  <div className="flex flex-wrap items-center gap-3">
   <label className="min-w-48 flex-1 text-xs text-slate-400">Buscar equipo o selección
    <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Equipo o mercado"
     className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"/></label>
   <label className="text-xs text-slate-400">Ordenar por
    <select value={sort} onChange={e=>setSort(e.target.value)} className="mt-1 block rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100">
     <option value="gap">Brecha / edge descendente</option><option value="probability">Probabilidad de modelo descendente</option><option value="date">Hora de inicio</option>
    </select></label>
  </div>
  {visible.length?<div className="grid gap-3 lg:grid-cols-2">
   {visible.map(r=><article key={r.id} className="rounded-xl border border-slate-700 bg-slate-900 p-4">
    <div className="flex flex-wrap justify-between gap-2"><div className="min-w-0">
     <p className="text-xs text-slate-400">{r.matchup}</p><h3 className="mt-1 font-semibold text-slate-100">{r.selection}</h3>
    </div><span className="self-start rounded-full border border-slate-600 px-2 py-1 text-[10px] font-bold text-amber-200">{r.eligible?'SEÑAL FAVORABLE · ':''}{r.status}</span></div>
    <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
     <div><dt className="text-xs text-slate-400">Línea / cuota</dt><dd className="font-semibold">{isNumber(r.line)?r.line.toFixed(1):'—'} / {isNumber(r.odds)?(r.odds>0?'+':'')+r.odds:'Sin cuota'}</dd></div>
     <div><dt className="text-xs text-slate-400">Proyección</dt><dd className="font-semibold">{r.projection??'No disponible'}</dd></div>
     <div><dt className="text-xs text-slate-400">Brecha / edge</dt><dd className="font-semibold">{isNumber(r.gap)?(r.gap>0?'+':'')+r.gap.toFixed(2)+' '+(r.gapUnit??''):'No verificable'}</dd></div>
     <div><dt className="text-xs text-slate-400">Probabilidad del modelo</dt><dd className="font-semibold">{isNumber(r.probability)?(r.probability*100).toFixed(1)+'%':'Sin calibrar'}</dd></div>
    </dl>
    <p className="mt-3 text-xs text-slate-400">Inicio {date(r.startsAt)} · Captura {date(r.capturedAt)}</p>
    <p className="mt-2 text-xs text-amber-200">{r.evidence??'Evidencia de modelo sin certificación de valor.'}</p>
    {r.note&&<details className="mt-2 text-xs text-slate-300"><summary className="cursor-pointer text-teal-300">Ver contexto</summary><p className="mt-2 leading-5">{r.note}</p></details>}
   </article>)}
  </div>:<p role="status" className="rounded-xl border border-slate-700 p-5 text-sm text-slate-300">{tab==='top'?'No hay oportunidades con edge positivo y evidencia vigente en este deporte. No se fuerza una selección.':'Este mercado no tiene contratos o proyecciones verificadas para mostrar aquí.'}</p>}
  <button type="button" onClick={()=>setExpanded(!expanded)} className="text-xs font-semibold text-teal-300">{expanded?'Ocultar condiciones':'Cómo interpretar estos resultados'}</button>
  {expanded&&<p className="text-xs leading-5 text-slate-400">Top oportunidades solo incluye filas marcadas favorables por evidencia del deporte. Las otras pestañas pueden mostrar pronósticos de investigación que NO son recomendaciones. Probabilidad del modelo no implica probabilidad calibrada. Sin línea original no se declara edge ni ROI. Las métricas de precisión y liquidaciones continúan en el registro del deporte.</p>}
 </section>;
}
