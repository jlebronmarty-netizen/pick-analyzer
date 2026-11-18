'use client';
import {useEffect,useState} from 'react';
const markets={points:'Puntos',rebounds:'Rebotes',assists:'Asistencias',threes:'Triples'};
const fmt=n=>typeof n==='number'?n.toFixed(2):'—';
const price=n=>typeof n==='number'?(n>0?'+'+n:String(n)):'—';
const time=x=>x&&Number.isFinite(Date.parse(x))?new Date(x).toLocaleString('es-PR',{timeZone:'America/Puerto_Rico'}):'No verificada';
export default function PropsShadowPanel({gameId,market,quotes=[]}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 useEffect(()=>{
  if(!gameId||!Object.hasOwn(markets,market)){setData(null);setError('');return;}
  let active=true,controller=null;
  async function load(){
   if(document.hidden||controller)return;
   controller=new AbortController();if(active)setLoading(true);
   const timeout=setTimeout(()=>controller?.abort(),20000);
   try{
    const r=await fetch('/api/market-data/nba/props-shadow?game_id='+encodeURIComponent(gameId),
      {cache:'no-store',credentials:'same-origin',signal:controller.signal});
    const body=await r.json();
    if(!r.ok)throw Error(body.status||'ARCHIVE_UNAVAILABLE');
    if(active){setData(body);setError('');}
   }catch(e){if(active)setError('No se pudo confirmar el historial o la cuota archivada. '+String(e.message||e));}
   finally{clearTimeout(timeout);controller=null;if(active)setLoading(false);}
  }
  load();const id=setInterval(load,120000);
  return()=>{active=false;clearInterval(id);controller?.abort()};
 },[gameId,market]);
 if(!gameId||!Object.hasOwn(markets,market))return null;
 const names=new Map(quotes.filter(q=>q.player_id&&q.player_name).map(q=>[String(q.player_id),q.player_name]));
 const rows=(data?.rows??[]).filter(r=>r.statistic===market);
 return <section aria-label="Proyecciones descriptivas Player Props SHADOW" className="rounded-xl border border-slate-700 bg-slate-950 p-4 mt-5">
  <h2 className="text-lg font-bold">Proyecciones descriptivas · {markets[market]} · SHADOW</h2>
  <p className="mt-2 text-sm text-slate-300">Comparación informativa con cuotas <strong>archivadas</strong> recientes, no apuestas ni recomendaciones. L5 y L10 solo usan partidos anteriores con captura verificada antes de la cuota. La diferencia es proyección menos línea, no una probabilidad ni una ventaja calibrada.</p>
  {loading&&<p role="status">Verificando datos históricos…</p>}
  {error&&<p role="alert" className="text-amber-300">{error}</p>}
  {data&&<p className="text-xs text-slate-400">Estado: {data.status} · Revisado: {time(data.checkedAt)} · Cuotas verificadas: {data.archivedQuoteCount??'—'} · Sin llamadas adicionales a GOAT</p>}
  <div className="overflow-x-auto mt-3"><table className="w-full text-left text-sm border-separate border-spacing-2">
   <thead><tr>{['Jugador','Línea archivada','Cuota','L5','L10','Proyección','Diferencia','Juegos previos','Última cuota'].map(h=><th key={h}>{h}</th>)}</tr></thead>
   <tbody>{rows.map((r,i)=><tr key={r.quoteId??String(r.playerId)+'-'+r.side+'-'+r.line+'-'+i}>
    <td>{names.get(String(r.playerId))||r.playerName||'Jugador '+r.playerId}</td>
    <td>{r.side==='over'?'Más de':'Menos de'} {r.line}</td>
    <td>{price(r.americanOdds)}</td>
    <td>{fmt(r.l5)}</td><td>{fmt(r.l10)}</td>
    <td>{fmt(r.projection)}</td><td>{fmt(r.delta)}</td>
    <td>{r.availablePriorGames} · {r.formula}</td>
    <td>{time(r.sourceReceivedAt)}</td>
   </tr>)}</tbody>
  </table></div>
  {data&&!rows.length&&<p role="status">No hay proyecciones descriptivas verificables para este mercado y partido. Puede deberse a falta de cinco juegos capturados antes de la cuota, ausencia de precios recientes o a que el partido comenzó. No significa que FanDuel no tenga ese mercado.</p>}
  <p className="text-xs text-slate-400 mt-3">SIN PROBABILIDADES · SIN EV · SIN PICKS. No ajusta lesiones, minutos previstos ni defensa rival. Las reglas de prórroga y DNP siguen sin certificarse.</p>
 </section>;
}
