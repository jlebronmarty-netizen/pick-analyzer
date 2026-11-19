'use client';
import {useState} from 'react';

type MarketScore={
 pricedEvents:number;graded:number;pushes:number;invalid:number;
 modelBrier:number|null;circaNoVigBrier:number|null;
 modelLogLoss:number|null;circaNoVigLogLoss:number|null;
 modelHits:number;circaHits:number;observedLines:{line:number;n:number}[];
};
type Cohort={
 status:string;frozenRows:number;validFrozen:number;skippedFrozen:number;
 settledDistinctGames:number;invalidResults:number;
 markets:{spread:MarketScore;total:MarketScore};
};
type Report={
 status:string;asOf?:string;readOnly?:boolean;archive?:{
 nhlRunsScanned:number;spreadAndTotalReceipts:number;earlyFrozen:number;lateFrozen:number};
 earlyPoissonV1Retrospective?:Cohort;lateV6Prospective?:Cohort;
 gates?:Record<string,boolean>;warning?:string;providerCalls?:number;databaseWrites?:number;
};
const n=(x:number|null|undefined,d=3)=>typeof x==='number'&&Number.isFinite(x)?x.toFixed(d):'—';
function CohortCard({title,cohort,prospective}:{title:string;cohort:Cohort;prospective:boolean}){
 return <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-950 p-4">
  <h3 className="font-semibold text-slate-100">{title}</h3>
  <p className="text-xs text-slate-400">{cohort.validFrozen} congelaciones válidas · {cohort.settledDistinctGames} partidos con resultado · {cohort.invalidResults} resultados no válidos</p>
  <div className="overflow-x-auto">
   <table className="min-w-full text-left text-xs">
    <thead><tr className="border-b border-slate-700">{['Mercado','Pares','Evaluados','PUSH','Brier modelo','Brier Circa','Log loss modelo','Log loss Circa'].map(x=><th key={x} className="whitespace-nowrap px-2 py-2">{x}</th>)}</tr></thead>
    <tbody>{(['spread','total'] as const).map(m=>{
     const a=cohort.markets[m];
     return <tr key={m} className="border-b border-slate-800">
      <td className="px-2 py-2 font-semibold">{m==='spread'?'Puck line':'Total goles'}</td>
      <td className="px-2 py-2">{a.pricedEvents}</td>
      <td className="px-2 py-2">{a.graded}</td>
      <td className="px-2 py-2">{a.pushes}</td>
      <td className="px-2 py-2">{n(a.modelBrier)}</td>
      <td className="px-2 py-2">{n(a.circaNoVigBrier)}</td>
      <td className="px-2 py-2">{n(a.modelLogLoss)}</td>
      <td className="px-2 py-2">{n(a.circaNoVigLogLoss)}</td>
     </tr>;
    })}</tbody>
   </table>
  </div>
  <p className="text-xs leading-5 text-slate-400">
   {prospective?'V6 es prospectivo: sin partidos liquidados comparables no podemos concluir si mejoró.':'La cohorte temprana permite una comparación exploratoria en partidos pareados; no es validación prospectiva independiente.'}
   {' '}Brier y log loss: menor es mejor, comparando exactamente los mismos partidos.
  </p>
 </div>;
}
export default function NhlExactMarketValidation(){
 const [report,setReport]=useState<Report|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const refresh=async()=>{
  if(loading)return;setLoading(true);setError('');
  try{
   const r=await fetch('/api/nhl/exact-circa-market-research',{cache:'no-store'});
   if(!r.ok)throw Error('El reporte de líneas exactas no está disponible.');
   const data=await r.json() as Report;
   if(data.status!=='READ_ONLY_EXACT_MARKET_RESEARCH')throw Error(data.status??'RESEARCH_UNAVAILABLE');
   setReport(data);
  }catch(e){setError(e instanceof Error?e.message:'RESEARCH_UNAVAILABLE');setReport(null);}finally{setLoading(false);}
 };
 return <section aria-label="Validación NHL exact line" className="space-y-4 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div><h2 className="text-lg font-bold text-slate-100">Comparación histórica · línea Circa exacta</h2>
    <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">Evalúa el mismo contrato, línea y partido contra el proxy Poisson congelado, con controles de identidad, tiempo y PUSH. Solo investigación; no crea jugadas ni cambia el modelo.</p></div>
   <button type="button" onClick={refresh} disabled={loading} className="rounded-lg border border-teal-400/40 px-3 py-2 text-sm font-semibold text-teal-300 disabled:opacity-50">{loading?'Validando archivo…':report?'Actualizar auditoría':'Comparar datos almacenados'}</button>
  </div>
  {error&&<p role="alert" className="text-sm text-amber-200">{error}</p>}
  {report&&<>
   <p className="text-xs text-slate-400">Capturas de spread/total: {report.archive?.spreadAndTotalReceipts??0} · ciclos leídos: {report.archive?.nhlRunsScanned??0}. Cero consultas al proveedor y cero escrituras reportadas.</p>
   {report.earlyPoissonV1Retrospective&&<CohortCard title="Poisson V1 · cohorte temprana" cohort={report.earlyPoissonV1Retrospective} prospective={false}/>}
   {report.lateV6Prospective&&<CohortCard title="V6 tardío · cohorte prospectiva" cohort={report.lateV6Prospective} prospective={true}/>}
   <p className="text-xs leading-5 text-amber-200">Bloqueado para recomendaciones: falta validar reglas de apuesta con OT/SO, hora original del precio Circa, precios FanDuel y muestra prospectiva independiente. Los modelos aproximados pueden fallar incluso con una brecha favorable.</p>
   <p className="text-xs leading-5 text-slate-400">{report.warning}</p>
  </>}
 </section>;
}
