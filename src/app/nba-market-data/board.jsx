'use client';
import { useState } from 'react';
const types={points:'Puntos',rebounds:'Rebotes',assists:'Asistencias',threes:'Triples',blocks:'Tapones',steals:'Robos',points_rebounds_assists:'Puntos + rebotes + asistencias',points_rebounds:'Puntos + rebotes',points_assists:'Puntos + asistencias',rebounds_assists:'Rebotes + asistencias'};
const price=n=>n>0?`+${n}`:String(n);
const time=s=>s&&Number.isFinite(Date.parse(s))?new Intl.DateTimeFormat('es-PR',{timeZone:'America/Puerto_Rico',dateStyle:'short',timeStyle:'medium'}).format(new Date(s)):'No verificada';
export default function Board(){
 const [date,setDate]=useState(''),[games,setGames]=useState([]),[game,setGame]=useState(''),[market,setMarket]=useState('main'),[result,setResult]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[filter,setFilter]=useState('');
 async function load(action){
  setError('');setResult(null);setBusy(true);
  if(action==='games'){setGames([]);setGame('');}
  try{
   const q=new URLSearchParams({action});
   if(action==='games')q.set('date',date);
   else {q.set('game_id',game);q.set('group',market==='main'?'main':'props');if(market!=='main')q.set('prop_type',market);}
   const r=await fetch('/api/market-data/nba?'+q.toString(),{cache:'no-store'});const b=await r.json();
   if(!r.ok)throw new Error(b.error||'SOURCE_UNAVAILABLE');
   setResult(b);if(action==='games'){setGames(b.data.games);setGame(String(b.data.games[0]?.id||''));}
  }catch(e){setError(e.message==='FEED_ACCESS_DENIED'?'Permiso entre proyectos pendiente. La fuente privada no autorizó esta aplicación.':`Fuente no disponible: ${e.message}. No equivale a una jornada sin partidos.`);}finally{setBusy(false);}
 }
 const quotes=(result?.data?.quotes||[]).filter(q=>`${q.player_name||''} ${q.statistic}`.toLowerCase().includes(filter.toLowerCase()));
 const event=result?.data?.game;
 const section={border:'1px solid #475569',borderRadius:12,padding:18,marginTop:20};
 const control={padding:10,margin:5,border:'1px solid #64748b',borderRadius:6,background:'#0f172a',color:'#f1f5f9'};
 return <main style={{maxWidth:1200,margin:'auto',padding:24,color:'#f1f5f9',background:'#0f172a',minHeight:'100vh'}}>
  <a href="/" style={{color:'#93c5fd'}}>Volver a la aplicación</a><h1>NBA · FanDuel · Datos de mercado</h1>
  <p>Preview privado · BALLDONTLIE · Solo lectura. Cotizaciones, no recomendaciones. Sin apuestas, liquidaciones ni cambios al histórico.</p>
  <section style={section}><h2>1. Calendario</h2><label>Fecha de Puerto Rico <input aria-label="Fecha" style={control} type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
   <button style={control} disabled={busy||!date} onClick={()=>load('games')}>Consultar partidos</button>
   {result?.data?.games && <p>{result.data.games.length} partidos recibidos. Estado: {result.meta.status}. Calendario del proveedor, sujeto a contraste NBA/ESPN.</p>}
   <h2>2. Cotizaciones</h2><label>Partido <select aria-label="Partido" style={control} value={game} onChange={e=>{setGame(e.target.value);setResult(null);}}><option value="">Selecciona un partido</option>{games.map(g=><option key={g.id} value={g.id}>{g.visitor_team?.full_name} @ {g.home_team?.full_name} · {time(g.datetime)}</option>)}</select></label>
   <label>Mercado <select aria-label="Mercado" style={control} value={market} onChange={e=>{setMarket(e.target.value);setResult(null);}}><option value="main">Moneyline / spread / total</option>{Object.entries(types).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></label>
   <button style={control} disabled={busy||!game} onClick={()=>load('quote')}>Actualizar cuotas</button>
   <p>No hay actualización automática. Cada consulta puede consumir solicitudes del plan.</p>
  </section>
  {busy&&<p role="status">Consultando la fuente privada…</p>}{error&&<p role="alert" style={{...section,color:'#fbbf24'}}>{error}</p>}
  {result?.data?.quotes&&<section style={section}><h2>{event?.visitor_team?.full_name} @ {event?.home_team?.full_name}</h2>
   <p>Fase: {result.data.phase} · Estado: {result.meta.status} · {result.meta.quote_count} cotizaciones. Recibido: {time(result.meta.source_received_at)}.</p>
   <p>Revisa la hora de cada precio: una respuesta recién recibida puede contener datos antiguos. Actualiza de nuevo antes de utilizar una cotización.</p>
   <label>Filtrar jugador <input style={control} value={filter} onChange={e=>setFilter(e.target.value)}/></label>
   <div style={{overflowX:'auto'}}><table style={{width:'100%',textAlign:'left',borderSpacing:10}}><thead><tr>{['Equipo / jugador','Mercado / período','Contrato','Cuota','Hora del proveedor','Antigüedad al consultar'].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{quotes.map(q=><tr key={q.quote_id}>
    <td>{q.player_name||(q.player_id?`Jugador sin resolver (${q.player_id})`:q.side==='home'?event.home_team?.full_name:q.side==='away'?event.visitor_team?.full_name:'Total del partido')}</td>
    <td>{types[q.statistic]||q.statistic}<br/>{q.period}</td><td>{q.side} {q.line??''}<br/>{q.contract}</td><td>{price(q.american_odds)}</td><td>{time(q.provider_updated_at)}</td><td>{q.freshness} · {q.age_seconds??'?'} s</td>
   </tr>)}</tbody></table></div>
   {!quotes.length&&<p>No se recibieron cotizaciones para esta consulta o filtro. No significa que el jugador esté fuera.</p>}
   {!!result.meta.warnings?.length&&<p>Advertencias: {result.meta.warnings.join(', ')}</p>}
   <p>Identificador de captura: {result.meta.snapshot_id}</p>
  </section>}
  <p style={{marginTop:24}}>No se certifica el menú completo, el precio regional ni las reglas de prórroga. Un prop publicado no confirma participación. Nombres del directorio, no alineaciones. Las probabilidades implícitas no son probabilidades del modelo.</p>
 </main>;
}
