'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import SportRecommendationCard from '@/components/dashboard/SportRecommendationCard';
const pct=v=>typeof v==='number'?(v*100).toFixed(2)+'%':'N/A';
const num=v=>typeof v==='number'?v.toFixed(2):'N/A';
const price=v=>typeof v==='number'?(v>0?'+'+v:String(v)):'N/A';
const date=v=>v&&Number.isFinite(Date.parse(v))?new Date(v).toLocaleString('es-PR',{timeZone:'America/Puerto_Rico'}):'No verificada';
const market={moneyline:'Moneyline',spread:'Spread',total:'Total'};
const versionName=v=>({nba_prediction_engine_v1:'Histórico · v1',nba_prediction_engine_v1_1_inputs_shadow:'Entradas corregidas · v1.1'}[v]??v);
const validVersion=v=>typeof v?.modelVersion==='string'&&Array.isArray(v.rows)&&Array.isArray(v.metrics)&&['rows','uniqueGames','pending'].every(key=>Number.isInteger(v.total?.[key])&&v.total[key]>=0);
export default function NbaModelReport(){
 const [data,setData]=useState(null),[error,setError]=useState(''),[selectedVersion,setSelectedVersion]=useState(''),[busy,setBusy]=useState(false),active=useRef(null);
 const refresh=useCallback(async()=>{
  if(active.current)return;const c=new AbortController();active.current=c;setBusy(true);const t=setTimeout(()=>c.abort(),20000);
  try{
   const r=await fetch('/api/market-data/nba/model-report',{cache:'no-store',signal:c.signal}),b=await r.json();
   if(!r.ok||!Array.isArray(b.versions)||!b.versions.every(validVersion)||!Number.isFinite(Date.parse(b.checked_at)))throw Error('read');
   if(active.current===c){setData(b);setError('');}
  }catch{if(active.current===c){setData(null);setError('Reporte SHADOW no verificado; esto no equivale a cero selecciones.');}}
  finally{clearTimeout(t);if(active.current===c){active.current=null;setBusy(false);}}
 },[]);
 useEffect(()=>{
  refresh();const visible=()=>{if(!document.hidden)refresh();},id=setInterval(visible,300000);
  document.addEventListener('visibilitychange',visible);
  return()=>{clearInterval(id);document.removeEventListener('visibilitychange',visible);const c=active.current;active.current=null;c?.abort();};
 },[refresh]);
 const box={maxWidth:1200,margin:'20px auto',padding:20,border:'1px solid #334155',borderRadius:12,color:'#e2e8f0',background:'#0f172a'};
 const version=data?.versions.find(v=>v.modelVersion===selectedVersion)??data?.versions.find(v=>v.modelVersion===data.selectedModelVersion);
 const rows=version?.rows??[],metrics=version?.metrics??[];
 return <section aria-label="Selecciones NBA GOAT SHADOW" className="mlb-ui sport-standard sport-standard-panel" style={box}>
  <h2>NBA · selecciones GOAT SHADOW</h2>
  <p>Estas selecciones se guardan antes del partido para medir accuracy. No son Official Picks ni APOSTAR. El historial legacy se conserva aparte y no se incluye en estos resultados.</p>
  <button onClick={refresh} disabled={busy} className="my-3 min-h-11 rounded-lg border border-slate-500 px-3 py-2 focus-visible:outline-2 focus-visible:outline-teal-300">{busy?'Actualizando historial…':'Actualizar historial'}</button>
  {error&&<p role="alert">{error}</p>}
  {data&&<>
   <section aria-label="Historial disponible por versión" className="my-4">
    <h3 className="font-semibold">Historial disponible por versión</h3>
    <p className="mt-1 text-sm text-slate-400">Cada versión conserva sus contratos y resultados. La versión más reciente se abre inicialmente; puedes consultar las anteriores.</p>
    <div className="mt-3 grid gap-3 md:grid-cols-2">{data.versions.map(v=><button key={v.modelVersion} type="button" onClick={()=>setSelectedVersion(v.modelVersion)} aria-pressed={version?.modelVersion===v.modelVersion}
     className={`min-w-0 rounded-lg border p-4 text-left focus-visible:outline-2 focus-visible:outline-teal-300 ${version?.modelVersion===v.modelVersion?'border-teal-400 bg-teal-500/10':'border-slate-600 bg-slate-950'}`}>
     <span className="block break-words font-semibold">{versionName(v.modelVersion)}{version?.modelVersion===v.modelVersion?' · seleccionada':''}</span>
     <span className="mt-1 block">{v.total.uniqueGames} juegos únicos · {v.total.rows} contratos · {v.total.pending} pendientes</span>
     <span className="mt-2 block text-sm text-slate-400">Última emisión: {date(v.lastCreatedAt)} PR</span>
    </button>)}</div>
   </section>
   <label className="my-4 block">Versión del modelo <select aria-label="Versión NBA SHADOW" value={version?.modelVersion??''} onChange={event=>setSelectedVersion(event.target.value)} className="mt-2 block w-full max-w-full rounded border border-slate-600 bg-slate-900 p-2 sm:w-auto">{data.versions.map(v=><option key={v.modelVersion} value={v.modelVersion}>{versionName(v.modelVersion)}</option>)}</select></label>
   <p className="break-all text-sm text-slate-400">Identificador seleccionado: {version?.modelVersion??'ninguno'}</p>
   <p className="mt-2">Última emisión de la versión: {date(version?.lastCreatedAt)} PR. Lectura del historial: {date(data.checked_at)} PR.</p>
   <p className="my-3">Probabilidades, edge y EV son estimaciones exploratorias con el precio archivado; no acreditan una ventaja validada ni una oferta actual. Los juegos compartidos entre versiones o mercados no son muestras independientes adicionales.</p>
   <div style={{display:'flex',gap:18,flexWrap:'wrap'}}>{metrics.map(m=><div key={m.market}><strong>{market[m.market]??m.market}</strong><br/>{m.wins} W / {m.losses} L · {m.pending} pendientes · {pct(m.accuracy)}<br/>{m.settledUniqueGames} juegos únicos liquidados · {m.rows} contratos</div>)}</div>
   <div className="mt-5 grid gap-4 md:grid-cols-2">{rows.filter(r=>!r.result||r.result==='pending').map(r=><SportRecommendationCard key={'card-'+r.id}
    eyebrow={'Selección del modelo · SHADOW · '+(market[r.market]??r.market)}
    title={r.market==='moneyline'?(r.team+' a ganar'):r.market==='spread'?(r.team+' '+(r.line>0?'+':'')+r.line):((r.team??r.selection)+' '+r.line)}
    matchup={r.away_team+' @ '+r.home_team}
    lines={['Probabilidad exploratoria: '+num(r.model_probability)+'% · Implícita: '+num(r.implied_probability)+'%','Edge exploratorio: '+num(r.edge)+' pp · EV exploratorio: '+num(r.ev)+'% · Confianza: '+num(r.confidence)+'%']}
    priceLine={(r.sportsbook??'Operador no registrado')+': '+price(r.odds)}
    timeLine={'Inicio: '+date(r.commence_time)+' PR · Emitido: '+date(r.created_at)+' PR'}
    warning="Snapshot prepartido · verificar oferta actual"
    result="PENDIENTE"
   />)}</div>
   <details className="mt-5"><summary>Ver historial técnico</summary><div style={{overflowX:'auto',marginTop:16}}><table style={{width:'100%',textAlign:'left',borderSpacing:10}}><thead><tr>{['Inicio PR','Partido','Mercado','Selección','Línea','Cuota','Prob. exploratoria','Prob. implícita','Edge exploratorio','EV exploratorio','Confianza','Resultado'].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{date(r.commence_time)}</td><td>{r.away_team} @ {r.home_team}</td><td>{market[r.market]??r.market}</td><td>{r.team??r.selection}</td><td>{r.line??'—'}</td><td>{price(r.odds)}</td><td>{num(r.model_probability)}%</td><td>{num(r.implied_probability)}%</td><td>{num(r.edge)} pp</td><td>{num(r.ev)}%</td><td>{num(r.confidence)}%</td><td>{r.result??'pending'}</td></tr>)}</tbody></table></div></details>
   {!rows.length&&<p>Aún no hay selecciones en esta versión GOAT.</p>}
   <p className="mt-3">Accuracy = W/(W+L); pushes y pendientes quedan fuera. Es accuracy por contrato, no evidencia de juegos independientes ni una probabilidad validada. Este historial no habilita APOSTAR.</p>
  </>}
 </section>;
}
