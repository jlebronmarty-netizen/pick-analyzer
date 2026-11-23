'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
const reasons={SCHEDULER_DISABLED:'Generación automática del modelo desactivada.',PENDING_SHADOW_REVIEW_REQUIRED:'Hay predicciones de la cohorte GOAT pendientes de resultado.',CURRENT_SEASON_STATS_MISSING_OR_STALE:'Faltan estadísticas verificadas y actuales de la temporada para el motor.',NO_FRESH_PREGAME_GOAT_QUOTES:'No hay cuotas pregame recientes que pasen los controles en este corte.',CONTRACT_SCOPE_REQUIRES_VERIFICATION:'Falta verificar fase regular o alcance full-game con overtime.',CANARY_REVIEW_REQUIRED:'La prueba controlada del modelo necesita revisión.',CANARY_HARD_LIMIT:'Se conserva el límite de la prueba controlada.',DAILY_SHADOW_ROW_CAP:'Se alcanzó el límite de emisiones de la jornada de Puerto Rico.'};
const count=v=>Number.isInteger(v)&&v>=0?v:'No verificado';
const time=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))?new Date(v).toLocaleString('es-PR',{timeZone:'America/Puerto_Rico'}):'No verificada';
export default function NbaModelStatus(){
 const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),active=useRef(null);
 const refresh=useCallback(async()=>{
  if(active.current)return;const c=new AbortController();active.current=c;setBusy(true);const timer=setTimeout(()=>c.abort(),20000);
  try{
   const r=await fetch('/api/market-data/nba/model-status',{cache:'no-store',signal:c.signal}),b=await r.json();
   if(!r.ok||typeof b.gate?.allowed!=='boolean'||!Array.isArray(b.gate.blockers)||!Number.isFinite(Date.parse(b.checked_at)))throw Error('read');
   if(active.current===c){setData(b);setError('');}
  }catch{
   if(active.current===c){setData(null);setError('Estado no verificado; se retiró la lectura anterior. Esto no significa que no existan cuotas.');}
  }finally{clearTimeout(timer);if(active.current===c){active.current=null;setBusy(false);}}
 },[]);
 useEffect(()=>{
  refresh();const visible=()=>{if(!document.hidden)refresh();},id=setInterval(visible,300000);
  document.addEventListener('visibilitychange',visible);
  return()=>{clearInterval(id);document.removeEventListener('visibilitychange',visible);const c=active.current;active.current=null;c?.abort();};
 },[refresh]);
 const localUsageVerified=data?.rows_emitted_time_zone==='America/Puerto_Rico'&&/^\d{4}-\d{2}-\d{2}$/.test(data?.rows_emitted_date_local??'');
 return <section aria-label="Conexión GOAT y estado del modelo" className="mlb-ui sport-standard sport-standard-panel" style={{maxWidth:1200,margin:'20px auto',padding:20,border:'1px solid #334155',borderRadius:12,color:'#e2e8f0',background:'#0f172a'}}>
  <h2>NBA · estado del generador GOAT</h2>
  <p>Fuente de cuotas: BALLDONTLIE / GOAT. Las cuotas y los pronósticos SHADOW se conservan por separado.</p>
  <button onClick={refresh} disabled={busy} className="my-3 min-h-11 rounded-lg border border-slate-500 px-3 py-2 focus-visible:outline-2 focus-visible:outline-teal-300">{busy?'Comprobando…':'Verificar conexión del modelo'}</button>
  {error&&<p role="alert">{error}</p>}
  {data&&<>
   <p className="font-semibold">{data.gate.allowed?'Requisitos disponibles para la próxima ejecución SHADOW':'Generación SHADOW bloqueada'}</p>
   {data.gate.blockers.map(b=><p key={b} className="mt-2 text-amber-200">Motivo: {reasons[b]??b}</p>)}
   <dl className="my-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    <div><dt className="text-sm text-slate-400">Jornada del contador · Puerto Rico</dt><dd>{localUsageVerified?data.rows_emitted_date_local:'No verificada'}</dd></div>
    <div><dt className="text-sm text-slate-400">Emisiones de la jornada / límite</dt><dd>{localUsageVerified?`${count(data.rows_emitted_today)} / ${count(data.daily_row_cap)}`:'No verificadas'}</dd></div>
    <div><dt className="text-sm text-slate-400">Cupo restante de la jornada</dt><dd>{localUsageVerified?count(data.rows_remaining_today):'No verificado'}</dd></div>
    <div><dt className="text-sm text-slate-400">Próximo reinicio del cupo</dt><dd>{localUsageVerified?time(data.next_daily_reset_at)+' PR':'No verificado'}</dd></div>
    <div><dt className="text-sm text-slate-400">Última emisión almacenada · GOAT</dt><dd>{data.last_prediction_created_at?time(data.last_prediction_created_at)+' PR':'Sin emisión verificada'}</dd></div>
    <div><dt className="text-sm text-slate-400">Lectura del estado</dt><dd>{time(data.checked_at)} PR</dd></div>
   </dl>
   {localUsageVerified&&data.rows_emitted_today===0&&<p>No se han almacenado pronósticos GOAT en esta jornada de Puerto Rico.</p>}
   <p>Cuotas pregame recientes verificadas: <strong>{count(data.fresh_pregame_quotes)}</strong>. Contratos full-game verificados para SHADOW estadístico: <strong>{count(data.verified_contract_quotes)}</strong>.</p>
   <p>Temporada del motor: {data.season??'No verificada'}. Filas de estadísticas GOAT: {count(data.team_stats_rows)} · frescas: {typeof data.team_stats_fresh==='boolean'?(data.team_stats_fresh?'sí':'no'):'no verificado'}.</p>
   <p>Pendientes de la cohorte GOAT: <strong>{count(data.goat_shadow_pending)}</strong>. Pendientes del legado SHADOW, conservados aparte: <strong>{count(data.legacy_shadow_pending)}</strong>.</p>
   <p className="mt-3 text-sm text-slate-400">La lectura del estado no es la fecha de emisión ni de captura de una cuota. Esta consulta no ejecuta pronósticos ni llama al proveedor. Cumplir estos requisitos no habilita JUGADA.</p>
  </>}
 </section>;
}
