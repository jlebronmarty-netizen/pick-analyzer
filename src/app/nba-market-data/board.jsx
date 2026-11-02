'use client';
import {useEffect,useRef,useState} from 'react';
import {createPoller,preserveSelection} from './polling.mjs';
const types={points:'Puntos',rebounds:'Rebotes',assists:'Asistencias',threes:'Triples',blocks:'Tapones',steals:'Robos',points_rebounds_assists:'Puntos + rebotes + asistencias',points_rebounds:'Puntos + rebotes',points_assists:'Puntos + asistencias',rebounds_assists:'Rebotes + asistencias'};
const price=n=>n>0?`+${n}`:String(n);
const time=x=>x&&Number.isFinite(Date.parse(x))?new Intl.DateTimeFormat('es-PR',{timeZone:'America/Puerto_Rico',dateStyle:'short',timeStyle:'medium'}).format(new Date(x)):'No verificada';
const today=()=>{const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Puerto_Rico',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());return ['year','month','day'].map(k=>p.find(x=>x.type===k).value).join('-');};
async function get(query,signal){const r=await fetch('/api/market-data/nba?'+query,{cache:'no-store',signal});const b=await r.json();if(!r.ok)throw new Error(b.error||'SOURCE_UNAVAILABLE');return b;}
export default function Board({archiveControls=false}){
 const [date,setDate]=useState(''),[games,setGames]=useState([]),[game,setGame]=useState(''),[market,setMarket]=useState('main'),[result,setResult]=useState(null),[error,setError]=useState(''),[scheduleError,setScheduleError]=useState(''),[filter,setFilter]=useState(''),[automatic,setAutomatic]=useState(true),[clock,setClock]=useState(0),[archive,setArchive]=useState(null),[archiving,setArchiving]=useState(false);
 const auto=useRef(true),autoDate=useRef(true),quoteLoop=useRef(null),scheduleLoop=useRef(null);auto.current=automatic;
 useEffect(()=>{setDate(today());setClock(Date.now());const id=setInterval(()=>{setClock(Date.now());if(autoDate.current)setDate(today());},15000);return()=>clearInterval(id);},[]);
 useEffect(()=>{
  if(!date)return;let active=true;const subscribe=cb=>{document.addEventListener('visibilitychange',cb);return()=>document.removeEventListener('visibilitychange',cb);};
  const loop=createPoller({interval:300000,load:signal=>get(new URLSearchParams({action:'games',date}),signal),visible:()=>document.visibilityState==='visible',isAutomatic:()=>auto.current,subscribe,
   onData:b=>{if(active){setGames(b.data.games);setGame(current=>preserveSelection(b.data.games,current));setScheduleError('');}},onError:e=>{if(active)setScheduleError(`Calendario no actualizado: ${e.message}. No significa que no haya partidos.`);}});
  scheduleLoop.current=loop;loop.start();return()=>{active=false;loop.stop();};
 },[date]);
 useEffect(()=>{
  setResult(null);setError('');if(!game)return;
  const subscribe=cb=>{document.addEventListener('visibilitychange',cb);return()=>document.removeEventListener('visibilitychange',cb);};
  const loop=createPoller({load:signal=>{const p=new URLSearchParams({action:'quote',game_id:game,group:market==='main'?'main':'props'});if(market!=='main')p.set('prop_type',market);return get(p,signal);},visible:()=>document.visibilityState==='visible',isAutomatic:()=>auto.current,subscribe,
   onData:b=>{setResult(b);setError('');setClock(Date.now());},onError:e=>setError(`No se pudo actualizar: ${e.message}. Una captura anterior NO es un precio nuevo.`)});
  quoteLoop.current=loop;loop.start();return()=>loop.stop();
 },[game,market]);
 useEffect(()=>{quoteLoop.current?.configure();scheduleLoop.current?.configure();},[automatic]);
 async function archiveAction(write=false){setArchiving(true);try{const r=await fetch('/api/market-data/nba/archive',{method:write?'POST':'GET',cache:'no-store',...(write?{headers:{'Content-Type':'application/json'},body:'{}'}:{})});const b=await r.json();if(!r.ok)throw new Error(b.error||'ARCHIVE_UNAVAILABLE');setArchive(b);}catch(e){setArchive({error:e.message});}finally{setArchiving(false);}}
 const event=result?.data?.game,quotes=(result?.data?.quotes||[]).filter(q=>`${q.player_name||''} ${q.statistic}`.toLowerCase().includes(filter.toLowerCase()));
 const box={border:'1px solid #475569',borderRadius:12,padding:16,marginTop:18};const input={padding:10,margin:'5px 5px 5px 0',border:'1px solid #64748b',borderRadius:6,background:'#0f172a',color:'#f1f5f9',maxWidth:'100%'};
 return <section aria-label="NBA FanDuel" style={{maxWidth:1200,margin:'auto',padding:18,color:'#f1f5f9',background:'#0f172a',minHeight:'100vh',overflowWrap:'anywhere'}}>
 <a href="/" style={{color:'#93c5fd'}}>Volver a la aplicación</a><h1>NBA · FanDuel · Datos de mercado</h1><p>BALLDONTLIE · Acceso privado · Cuotas actuales separadas de modelos y picks congelados.</p>
 <section style={box}><label>Fecha de Puerto Rico <input aria-label="Fecha" type="date" value={date} style={input} onChange={e=>{autoDate.current=false;setGame('');setGames([]);setResult(null);setDate(e.target.value);}}/></label><button style={input} onClick={()=>{autoDate.current=true;setDate(today());scheduleLoop.current?.refresh();}}>Hoy</button><button style={input} onClick={()=>scheduleLoop.current?.refresh()}>Actualizar jornada</button><p>{games.length} partidos recibidos. La fecha corresponde a Puerto Rico.</p>
 <label>Partido <select aria-label="Partido" style={input} value={game} onChange={e=>setGame(e.target.value)}><option value="">Selecciona un partido</option>{games.map(g=><option key={g.id} value={g.id}>{g.visitor_team?.full_name} @ {g.home_team?.full_name} · {time(g.datetime)}</option>)}</select></label>
 <label>Mercado <select aria-label="Mercado" style={input} value={market} onChange={e=>setMarket(e.target.value)}><option value="main">Moneyline / spread / total</option>{Object.entries(types).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><button style={input} disabled={!game} onClick={()=>quoteLoop.current?.refresh()}>Actualizar cuotas</button>
 <p><label><input type="checkbox" checked={automatic} onChange={e=>setAutomatic(e.target.checked)}/> Actualización automática</label> · Mercado cada 60 s; calendario cada 5 min, mientras esta pantalla esté visible.</p><p>El servicio central sigue su propio horario. Un error o una fecha antigua se muestran explícitamente.</p></section>
 {scheduleError&&<p role="alert" style={box}>{scheduleError}</p>}{error&&<p role="alert" style={{...box,color:'#fbbf24'}}>{error}</p>}
 {game&&!result&&!error&&<p role="status">Cargando cotizaciones…</p>}
 {result&&<section style={box}><h2>{event?.visitor_team?.full_name} @ {event?.home_team?.full_name}</h2><p>{result.data.phase} · {result.meta.status} · {result.meta.quote_count} cotizaciones · Recibido {time(result.meta.source_received_at)}</p>
 {result.meta.persistence&&<p>Archivo permanente: {result.meta.persistence.status}. {result.meta.persistence.error||''}</p>}
 <label>Filtrar jugador <input aria-label="Filtrar jugador" value={filter} style={input} onChange={e=>setFilter(e.target.value)}/></label>
 <div style={{overflowX:'auto'}}><table style={{width:'100%',textAlign:'left',borderSpacing:10}}><thead><tr>{['Equipo / jugador','Mercado / período','Contrato exacto','Cuota','Hora del proveedor','Antigüedad'].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{quotes.map(q=>{
 const age=(clock-Date.parse(q.provider_updated_at))/1000;const status=!q.provider_updated_at||!Number.isFinite(age)?'Hora desconocida':age<0?'Hora inconsistente':age<=180?'Reciente':age<=300?'Envejeciendo':'ANTIGUA';
 return <tr key={q.quote_id}><td>{q.player_name||(q.player_id?`Jugador ${q.player_id} sin resolver`:q.side==='home'?event.home_team.full_name:q.side==='away'?event.visitor_team.full_name:'Total')}</td><td>{types[q.statistic]||q.statistic}<br/>{q.period}</td><td>{q.side} {q.line??''}<br/>{q.contract}</td><td>{price(q.american_odds)}</td><td>{time(q.provider_updated_at)}</td><td>{status} · {Number.isFinite(age)?Math.round(age):'?'} s</td></tr>;
 })}</tbody></table></div>{!quotes.length&&<p>No hay cuotas en esta respuesta o filtro. Esto no confirma una baja ni ausencia de mercados en FanDuel.</p>}<p>Captura: {result.meta.snapshot_id}</p>{result.meta.warnings?.length>0&&<p role="alert">{result.meta.warnings.join(', ')}</p>}</section>}
 {archiveControls&&<section style={box}><h2>Archivo y sincronización</h2><button style={input} disabled={archiving} onClick={()=>archiveAction(false)}>Ver estado del archivo</button><button style={input} disabled={archiving} onClick={()=>archiveAction(true)}>Archivar jornada ahora</button><p>El proceso NBA existente archiva automáticamente cada 30 min. Consultar cuotas aquí también conserva la captura. No reconstruye precios pasados ni liquida apuestas.</p>{archiving&&<p role="status">Consultando archivo…</p>}{archive&&<pre style={{whiteSpace:'pre-wrap',fontSize:12}}>{JSON.stringify(archive,null,2)}</pre>}</section>}
 <p style={{marginTop:20}}>No se certifican el menú completo, precio regional, prórroga ni SGP. Un prop publicado no confirma participación. La fase de temporada no se deduce de un precio. No hay recomendaciones nuevas en esta pantalla.</p></section>;
}
