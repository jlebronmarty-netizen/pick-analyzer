'use client';
import {useState,useEffect,useRef} from 'react';
const types={points:'Puntos',rebounds:'Rebotes',assists:'Asistencias',threes:'Triples',blocks:'Tapones',steals:'Robos',points_rebounds_assists:'Puntos + rebotes + asistencias',points_rebounds:'Puntos + rebotes',points_assists:'Puntos + asistencias',rebounds_assists:'Rebotes + asistencias'};
const price=n=>n>0?`+${n}`:String(n);
const time=s=>s&&Number.isFinite(Date.parse(s))?new Intl.DateTimeFormat('es-PR',{timeZone:'America/Puerto_Rico',dateStyle:'short',timeStyle:'medium'}).format(new Date(s)):'No verificada';
function today(){const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Puerto_Rico',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());return ['year','month','day'].map(k=>p.find(x=>x.type===k).value).join('-');}
async function get(q,signal){const r=await fetch('/api/market-data/nba?'+q,{cache:'no-store',signal});const b=await r.json();if(!r.ok)throw new Error(b.error||'SOURCE_UNAVAILABLE');return b;}
export default function Board(){
 const [date,setDate]=useState(''),[games,setGames]=useState([]),[game,setGame]=useState(''),[market,setMarket]=useState('main'),[result,setResult]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[filter,setFilter]=useState(''),[automatic,setAutomatic]=useState(true),[reload,setReload]=useState(0),[clock,setClock]=useState(0);
 const manualAt=useRef(0);
 useEffect(()=>{setDate(today());setClock(Date.now());const id=setInterval(()=>setClock(Date.now()),15000);return()=>clearInterval(id);},[]);
 useEffect(()=>{
  if(!date)return;let alive=true;const controller=new AbortController();setBusy(true);setResult(null);setGame('');setGames([]);setError('');
  const timeout=setTimeout(()=>controller.abort(),60000);
  get(new URLSearchParams({action:'games',date}),controller.signal).then(b=>{if(alive){setGames(b.data.games);setGame(String(b.data.games[0]?.id||''));}}).catch(e=>{if(alive)setError(`Calendario no disponible: ${e.message}. No equivale a una jornada sin partidos.`);}).finally(()=>{clearTimeout(timeout);if(alive)setBusy(false);});
  return()=>{alive=false;controller.abort();clearTimeout(timeout);};
 },[date,reload]);
 useEffect(()=>{
  if(!game)return;let alive=true,timer,controller,inflight=false,failures=0,finished=false,lastAttempt=0;setResult(null);setError('');
  const schedule=()=>{clearTimeout(timer);if(automatic&&!finished&&alive)timer=setTimeout(load,Math.min(300000,60000*2**failures));};
  async function load(){
   if(!alive||inflight||finished)return;if(document.visibilityState!=='visible'){schedule();return;}if(Date.now()-lastAttempt<10000){schedule();return;}lastAttempt=Date.now();inflight=true;setBusy(true);controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),60000);
   try{const p=new URLSearchParams({action:'quote',game_id:game,group:market==='main'?'main':'props'});if(market!=='main')p.set('prop_type',market);
    const b=await get(p,controller.signal);if(!alive)return;setResult(b);setError('');setClock(Date.now());failures=0;finished=b.data.phase==='NOT_OPEN_FOR_PREGAME';
   }catch(e){if(alive){failures=Math.min(failures+1,3);setError(`Actualización fallida: ${e.message}. La captura anterior, si aparece, NO es una actualización nueva.`);}}
   finally{clearTimeout(timeout);inflight=false;if(alive){setBusy(false);schedule();}}
  }
  const focus=()=>{if(automatic&&document.visibilityState==='visible'){clearTimeout(timer);load();}};document.addEventListener('visibilitychange',focus);load();
  return()=>{alive=false;clearTimeout(timer);controller?.abort();document.removeEventListener('visibilitychange',focus);};
 },[game,market,automatic,reload]);
 const quotes=(result?.data?.quotes||[]).filter(q=>`${q.player_name||''} ${q.statistic}`.toLowerCase().includes(filter.toLowerCase()));const event=result?.data?.game;
 const section={border:'1px solid #475569',borderRadius:12,padding:18,marginTop:20};const control={padding:10,margin:5,border:'1px solid #64748b',borderRadius:6,background:'#0f172a',color:'#f1f5f9'};
 const refreshNow=()=>{if(Date.now()-manualAt.current<10000)return;manualAt.current=Date.now();setReload(x=>x+1);};
 return <main style={{maxWidth:1200,margin:'auto',padding:24,color:'#f1f5f9',background:'#0f172a',minHeight:'100vh'}}>
 <a href="/" style={{color:'#93c5fd'}}>Volver a la aplicación</a><h1>NBA · FanDuel · Datos de mercado</h1><p>Acceso privado · BALLDONTLIE · Cotizaciones, no recomendaciones. No modifica apuestas ni el histórico.</p>
 <section style={section}><h2>Calendario y mercados</h2><label>Fecha de Puerto Rico <input aria-label="Fecha" style={control} type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><button style={control} disabled={busy} onClick={refreshNow}>Actualizar ahora</button><p>{games.length} partidos recibidos del proveedor. Su calendario requiere contraste NBA/ESPN para análisis pregame.</p>
 <label>Partido <select style={control} value={game} onChange={e=>setGame(e.target.value)}><option value="">Selecciona un partido</option>{games.map(g=><option key={g.id} value={g.id}>{g.visitor_team?.full_name} @ {g.home_team?.full_name} · {time(g.datetime)}</option>)}</select></label>
 <label>Mercado <select style={control} value={market} onChange={e=>setMarket(e.target.value)}><option value="main">Moneyline / spread / total</option>{Object.entries(types).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></label><label><input type="checkbox" checked={automatic} onChange={e=>setAutomatic(e.target.checked)}/> Actualizar selección cada 60 segundos mientras esta pantalla esté visible</label><p>Sin consultas de pantalla al ocultarla. Los errores espacian los reintentos. La actualización central programada es independiente de esta pantalla; su estado no se certifica por este interruptor.</p></section>
 {busy&&<p role="status">Consultando…</p>}{error&&<p role="alert" style={{...section,color:'#fbbf24'}}>{error}</p>}
 {result?.data?.quotes&&<section style={section}><h2>{event?.visitor_team?.full_name} @ {event?.home_team?.full_name}</h2><p>{result.data.phase} · {result.meta.status} · {result.meta.quote_count} cotizaciones · Recibido {time(result.meta.source_received_at)}</p><label>Filtrar jugador <input style={control} value={filter} onChange={e=>setFilter(e.target.value)}/></label><div style={{overflowX:'auto'}}><table style={{width:'100%',textAlign:'left',borderSpacing:10}}><thead><tr>{['Equipo / jugador','Mercado / período','Contrato','Cuota','Hora del proveedor','Antigüedad actual'].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{quotes.map(q=>{
 const valid=typeof q.provider_updated_at==='string'&&/(?:Z|[+-]\d\d:\d\d)$/.test(q.provider_updated_at);const age=valid?(clock-Date.parse(q.provider_updated_at))/1000:NaN;const label=!Number.isFinite(age)?'Hora desconocida':age<0?'Hora inconsistente':age<=180?'Reciente':age<=300?'Envejeciendo':'ANTIGUA';
 return <tr key={q.quote_id}><td>{q.player_name||(q.player_id?`ID sin resolver ${q.player_id}`:q.side==='home'?event.home_team?.full_name:q.side==='away'?event.visitor_team?.full_name:'Total')}</td><td>{types[q.statistic]||q.statistic}<br/>{q.period}</td><td>{q.side} {q.line??''}<br/>{q.contract}</td><td>{price(q.american_odds)}</td><td>{time(q.provider_updated_at)}</td><td>{label} · {Number.isFinite(age)?Math.round(age):'?'} s</td></tr>;
 })}</tbody></table></div>{!quotes.length&&<p>No se recibieron cotizaciones para esta consulta/filtro. No prueba que un jugador esté fuera.</p>}{!!result.meta.warnings?.length&&<p>Advertencias: {result.meta.warnings.join(', ')}</p>}<p>Captura: {result.meta.snapshot_id}</p></section>}
 <p style={{marginTop:24}}>No se garantiza el menú completo, disponibilidad regional, reglas de prórroga ni precios SGP. Las probabilidades implícitas no son probabilidades del modelo.</p></main>;
}
