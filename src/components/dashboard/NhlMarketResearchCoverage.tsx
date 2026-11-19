'use client';
import {useState} from 'react';

type Summary={observations:number;distinctGames:number;latestCapturedAt:string|null;exactMarketContractCertified:boolean;verifiedFanDuelPrices:number};
type Coverage={status:string;marketSummary?:{spread?:Summary;total?:Summary};warning?:string;certification?:{bettingRecommendations?:boolean;liveBookRulesCertified?:boolean};budgets?:{additionalProviderCalls?:number}};
const stamp=(s:string|null|undefined)=>s&&Number.isFinite(Date.parse(s))?new Intl.DateTimeFormat('es-PR',{timeZone:'America/Puerto_Rico',dateStyle:'medium',timeStyle:'short'}).format(new Date(s)):'Sin captura verificable';
export default function NhlMarketResearchCoverage(){
 const [data,setData]=useState<Coverage|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const load=async()=>{
  if(loading)return;
  setLoading(true);setError('');
  try{
   const r=await fetch('/api/nhl/free-main-market-coverage',{cache:'no-store'});
   if(!r.ok)throw Error('La cobertura almacenada no está disponible.');
   const body=await r.json() as Coverage;setData(body);
  }catch(e){setError(e instanceof Error?e.message:'No disponible');}finally{setLoading(false);}
 };
 return <section aria-label="Cobertura NHL de puck line y totales" className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div><h2 className="font-semibold text-slate-100">NHL · investigación de Spread y Total</h2>
    <p className="mt-1 text-xs leading-5 text-slate-400">Archivo Circa recopilado en los ciclos gratuitos existentes. No alimenta apuestas ni altera el modelo Moneyline.</p></div>
   <button type="button" onClick={load} disabled={loading} className="rounded-lg border border-slate-600 px-3 py-2 text-sm font-semibold text-teal-300 disabled:opacity-50">{loading?'Leyendo archivo…':data?'Revisar cobertura':'Consultar cobertura almacenada'}</button>
  </div>
  {error&&<p role="alert" className="mt-3 text-sm text-amber-200">{error}</p>}
  {data&&<div className="mt-4 space-y-3">
   <div className="grid gap-3 sm:grid-cols-2">
    {([['spread','Puck line / Spread'],['total','Total de goles']] as const).map(([market,label])=>{
     const x=data.marketSummary?.[market];
     return <div key={market} className="rounded-lg border border-slate-700 bg-slate-950 p-3">
      <h3 className="font-semibold">{label}</h3>
      <p className="mt-2 text-sm">Observaciones de investigación: <strong>{x?.observations??0}</strong></p>
      <p className="mt-1 text-sm">Partidos distintos: <strong>{x?.distinctGames??0}</strong></p>
      <p className="mt-1 text-xs text-slate-400">Última captura: {stamp(x?.latestCapturedAt)}</p>
      <p className="mt-2 text-xs text-amber-200">{x?.exactMarketContractCertified?'Contrato certificado':'Contrato y reglas sin certificar'} · {x?.verifiedFanDuelPrices??0} cuotas FanDuel verificadas</p>
     </div>;
    })}
   </div>
   <p className="text-xs leading-5 text-slate-400">{data.warning??'Registro exclusivo de investigación.'} No se declara probabilidad calibrada, EV ni disponibilidad de mercado.</p>
  </div>}
 </section>;
}
