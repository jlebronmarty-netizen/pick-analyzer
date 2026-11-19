'use client';
import {useEffect,useState} from 'react';
const periods=['q1','q2','q3','q4','h1','h2','ft'];
const names={q1:'1Q',q2:'2Q',q3:'3Q',q4:'4Q',h1:'1.ª mitad',h2:'2.ª mitad + OT',ft:'Partido completo'};
const fmt=v=>typeof v==='number'&&Number.isFinite(v)?v.toFixed(2):'—';
export default function ResearchBoard(){
 const [data,setData]=useState(null),[state,setState]=useState('loading');
 useEffect(()=>{let cancelled=false;
  fetch('/api/nba/period-research',{cache:'no-store'}).then(async r=>{
    const body=await r.json();if(!r.ok)throw Error(body.status||'READ_UNAVAILABLE');
    if(!cancelled){setData(body);setState('ready');}
  }).catch(()=>{if(!cancelled)setState('error');});
  return ()=>{cancelled=true;};
 },[]);
 return <main className="mx-auto max-w-7xl space-y-5 px-4 py-7 text-slate-100">
  <header className="rounded-xl border border-slate-600 p-5">
   <a className="text-sky-300 underline" href="/nba-hoopsapi-preview">← HoopsAPI Preview</a>
   <h1 className="mt-3 text-2xl font-bold">NBA — investigación de proyecciones por período</h1>
   <p className="mt-2 text-sm text-slate-300">Investigación retrospectiva SHADOW, no resultados prospectivos. No se crean picks ni probabilidades. Se usan exclusivamente resultados anteriores a cada encuentro; la disponibilidad de los datos en aquellas fechas no está verificada.</p>
  </header>
  {state==='loading'&&<p role="status">Leyendo el historial archivado, sin consultas externas…</p>}
  {state==='error'&&<p role="alert">No se pudo leer el estudio. No se realizaron llamadas de cuotas.</p>}
  {data&&<>
   <section className="rounded-xl border border-slate-600 p-4 space-y-2">
    <h2 className="text-lg font-semibold">Cobertura y método</h2>
    <p>{data.source?.games} partidos finales; {data.eligible_games} partidos elegibles; {data.candidate_count} fórmulas estudiadas; {data.source?.overtime_games} prórrogas.</p>
    <p className="text-sm text-slate-300">Desarrollo: {data.splits?.development_start} hasta antes de {data.splits?.holdout_start}. Prueba posterior: {data.splits?.holdout_start} a {data.splits?.holdout_last_date}. Error MAE en puntos; menor es mejor.</p>
    <p className="text-sm text-amber-200">Sin promoción: {data.promotion?.reason}. Las probabilidades y el EV no han sido calibrados.</p>
   </section>
   <div className="overflow-x-auto rounded-xl border border-slate-600 p-3">
    <table className="w-full text-sm text-left">
     <thead><tr>{['Período','Muestra test','Modelo elegido en desarrollo','MAE anterior','MAE candidato','Variación','IC 95% diferencia','Spread MAE anterior','Spread MAE candidato'].map(h=><th key={h} className="p-2 border-b border-slate-700 whitespace-nowrap">{h}</th>)}</tr></thead>
     <tbody>{periods.map(p=>{const x=data.periods?.[p];if(!x)return null;const d=x.paired_holdout;
      return <tr key={p}>
       <td className="border-b border-slate-800 p-2 whitespace-nowrap">{names[p]}</td>
       <td className="border-b border-slate-800 p-2">{x.holdout_n}</td>
       <td className="border-b border-slate-800 p-2">{x.selected_by_development}</td>
       <td className="border-b border-slate-800 p-2">{fmt(x.baseline_holdout.total_mae)}</td>
       <td className="border-b border-slate-800 p-2">{fmt(x.candidate_holdout.total_mae)}</td>
       <td className="border-b border-slate-800 p-2">{fmt(d?.delta_total_mae)}</td>
       <td className="border-b border-slate-800 p-2 whitespace-nowrap">[{fmt(d?.lower)}, {fmt(d?.upper)}]</td>
       <td className="border-b border-slate-800 p-2">{fmt(x.baseline_holdout.spread_mae)}</td>
       <td className="border-b border-slate-800 p-2">{fmt(x.candidate_holdout.spread_mae)}</td>
      </tr>;
     })}</tbody>
    </table>
   </div>
   <p className="text-sm text-slate-300">El intervalo es un bootstrap pareado exploratorio, no validación de edge de apuesta. Los puntos del segundo tiempo incluyen prórroga; los cuartos no. Incluso una pequeña mejora retrospectiva no es autorización para modificar los modelos oficiales.</p>
  </>}
 </main>;
}
