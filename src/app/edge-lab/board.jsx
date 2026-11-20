'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import NcaafPanel from './ncaaf-panel';
import {useLedgerView} from './ledger-filters';
import SportRecommendationCard from '@/components/dashboard/SportRecommendationCard';
import SportDecisionNavigation from '@/components/dashboard/SportDecisionNavigation';
import SportDecisionBoard from '@/components/dashboard/SportDecisionBoard';
import {ttOddEvenBaseline} from '@/lib/edge-lab/tt-odd-even-baseline.mjs';
import {ttOddEvenTemporalAudit} from '@/lib/edge-lab/tt-odd-even-temporal-audit.mjs';
const box={border:'1px solid #334155',borderRadius:12,padding:18,marginTop:16};const pct=v=>typeof v==='number'?(v*100).toFixed(1)+'%':'N/A';const num=v=>typeof v==='number'?v.toFixed(2):'N/A';const date=v=>v?new Date(v).toLocaleString('es-PR',{timeZone:'America/Puerto_Rico'}):'Sin ejecución';
const names={SOCCER:'Soccer · LaLiga',TT:'Tenis de mesa · TT Elite',MLB:'MLB · motores Edge',NCAAF:'NCAAF'};
const marketName={MONEYLINE:'Ganador',TOTAL_POINTS:'Total de puntos',SETS_ODD_EVEN:'Sets par/impar',HOME_TEAM_RUNS:'Carreras local',AWAY_TEAM_RUNS:'Carreras visitante','1X2':'Local / empate / visitante',TOTAL_2_5:'Total de goles 2.5'};
function selection(r){const a=r.participant_a??r.home_name,b=r.participant_b??r.away_name;return r.selection==='A'||r.selection==='HOME'?a:r.selection==='B'||r.selection==='AWAY'?b:r.selection==='DRAW'?'Empate':r.selection==='OVER'?'Over '+r.line:r.selection==='UNDER'?'Under '+r.line:r.selection==='ODD'?'Impar':r.selection==='EVEN'?'Par':r.status==='PROJECTION'?'Proyección numérica':'PASAR';}
export default function Board({initialSport='SOCCER'}){
 const [sport,setSport]=useState(initialSport),[soccer,setSoccer]=useState(null),[multi,setMulti]=useState(null),[errors,setErrors]=useState([]),[busy,setBusy]=useState(false),request=useRef(null);
 const refresh=useCallback(async()=>{if(request.current)return;const controller=new AbortController();request.current=controller;setBusy(true);const timeout=setTimeout(()=>controller.abort(),25000);try{
 const results=await Promise.allSettled(['/api/edge-lab','/api/edge-lab/multi'].map(async url=>{const r=await fetch(url,{cache:'no-store',signal:controller.signal});const b=await r.json();if(!r.ok)throw Error(b.status??'Error de conexión');return b;}));if(request.current!==controller)return;const next=[];results.forEach((r,i)=>{if(r.status==='fulfilled'){if(i===0)setSoccer(r.value);else setMulti(r.value);}else next.push((i===0?'Soccer: ':'Otros módulos: ')+(r.reason?.name==='AbortError'?'Consulta cancelada o excedida':r.reason?.message??'No disponible'));});setErrors(next);
 }finally{clearTimeout(timeout);if(request.current===controller){request.current=null;setBusy(false);}}},[]);
 useEffect(()=>{refresh();const timer=setInterval(()=>{if(!document.hidden)refresh();},300000);return()=>{clearInterval(timer);const previous=request.current;request.current=null;previous?.abort();};},[refresh]);
 const isSoccer=sport==='SOCCER',data=isSoccer?soccer:multi,rows=isSoccer?soccer?.rows??[]:(multi?.rows??[]).filter(r=>r.sport===sport),metrics=isSoccer?soccer?.metrics??[]:(multi?.metrics??[]).filter(m=>m.sport===sport),runs=isSoccer?soccer?.runs??[]:(multi?.runs??[]).filter(r=>r.sport===sport),last=runs[0];
 const ledgerView=useLedgerView(rows);
 const parityBenchmark=sport==='TT'?ttOddEvenBaseline(rows):null;
 const temporalAudit=sport==='TT'?ttOddEvenTemporalAudit(rows):null;
 const decisionRows=ledgerView.rows.filter(r=>r.status==='FORECAST'||r.status==='PROJECTION').flatMap(r=>{
  const market=r.market==='1X2'?'oneXTwo':r.market==='MONEYLINE'?'ml':
   r.market==='SETS_ODD_EVEN'?'special':
   ['TOTAL_POINTS','TOTAL_2_5','HOME_TEAM_RUNS','AWAY_TEAM_RUNS'].includes(r.market)?'total':null;
  if(!market)return [];
  const isNumeric=r.market==='TOTAL_POINTS'&&r.status==='PROJECTION'&&typeof r.projection==='number'&&Number.isFinite(r.projection);
  const label=isNumeric?'Total proyectado (no apuesta Over/Under)':selection(r);
  if(!label||label==='PASAR'||(label==='Proyección numérica'&&!isNumeric))return [];
  const special=r.market==='SETS_ODD_EVEN';
  const oneXTwo=r.market==='1X2';
  return [{id:String(r.id),market,matchup:(r.participant_a??r.home_name)+' vs '+(r.participant_b??r.away_name),
   selection:label,status:'SHADOW',startsAt:r.scheduled_at,capturedAt:r.emitted_at??r.created_at??null,
   probability:typeof r.probability==='number'&&Number.isFinite(r.probability)?r.probability:null,
   projection:isNumeric?r.projection.toFixed(2)+' pts':typeof r.projection==='number'?r.projection.toFixed(2):null,
   odds:null,line:typeof r.line==='number'?r.line:null,gap:null,eligible:false,
   evidence:isNumeric?'Proyección numérica de puntos: sin línea ni cuota registrada. Se evalúa por MAE, no por Over/Under.':
    oneXTwo?'1X2 de fútbol (local, empate o visitante) · 90 minutos más descuento; no equivale a ML de dos resultados.':
    special?'Paridad de sets de tenis de mesa · pronóstico experimental sin oferta o precio verificado.':
    'Selección experimental sin ventaja positiva frente a precio exacto validada.',
   note:'La captura del modelo, su settlement y los contratos de origen siguen en el historial técnico. No es una recomendación oficial.'
  }];
 });
 const daily=(isSoccer?soccer?.daily??[]:multi?.daily??[]).filter(r=>isSoccer||r.sport===sport),cohort=isSoccer?soccer?.cohort:multi?.cohort;
 const operation=multi?.states?.find(s=>s.sport===sport),paused=operation?.state==='OFFSEASON_PAUSED';
 const stale=!paused&&last&&Date.now()-Date.parse(last.started_at)>(isSoccer?90:sport==='TT'?16*60:24*60)*60000;
 return <main className="mlb-ui sport-standard mx-auto max-w-7xl space-y-6 text-slate-200">
 <header className="sport-standard-hero"><a href="/sports">← Todos los deportes</a><p className="sport-standard-eyebrow">PICK ANALYZER · EDGE LAB</p><h1>Proyecciones, resultados y operación</h1><p>Investigación independiente. No son apuestas ni liquidaciones del sportsbook. Los modelos e históricos existentes de Pick permanecen separados.</p></header>
 <SportDecisionNavigation current={sport==='SOCCER'?'SOCCER':sport==='TT'?'TABLE_TENNIS':sport} compact/>
 {sport!=='NCAAF'&&<SportDecisionBoard key={sport} sport={names[sport]??sport} rows={decisionRows} marketNotes={{ml:sport==='SOCCER'?"No equivale a 1X2 (incluye empate). Consulta la pestaña 1X2 para fútbol.":"Ganador del modelo registrado; no está certificado como oferta de sportsbook.",oneXTwo:"Fútbol: tres resultados (local/empate/visitante), dentro del tiempo reglamentario más añadido; sin cotización verificable no se calcula edge.",special:"Tenis de mesa: par/impar de sets como contrato experimental independiente, sin cuota y reglas verificadas.",total:sport==='SOCCER'?"Los totales de goles se muestran únicamente si existen contratos Over/Under registrados. Sin línea y precio exacto no se declara edge.":"Solo totales de puntos registrados con contrato de mercado verificable; no se infieren cuotas.",props:"No hay player props confiables en la fuente conectada.",periods:"No hay contratos por mitades/períodos certificados para este deporte."}} description="Vistas uniformes para modelos Edge Lab: solo se muestran selecciones emitidas con mercado comparable. Sin cuotas pareadas y validadas no se promocionan al Top ni se declara edge."/>}
 {sport==='TT'&&parityBenchmark&&<section aria-label="Comparación de Par/Impar vs referencia sencilla" className="rounded-xl border border-slate-700 bg-slate-900 p-4">
  <h2 className="font-semibold text-slate-100">Par/Impar · comparador obligatorio</h2>
  <p className="mt-2 text-xs text-slate-400">Se comparan los pronósticos originales contra seleccionar siempre Impar sobre exactamente los mismos partidos liquidados. No son apuestas reales.</p>
  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
   <div className="rounded-lg bg-slate-950 p-3"><p className="text-xs text-slate-400">Modelo actual</p><p className="mt-1 text-xl font-semibold">{parityBenchmark.games?(100*parityBenchmark.modelAccuracy).toFixed(1)+'%':'—'}</p><p className="text-xs text-slate-400">{parityBenchmark.modelWins}/{parityBenchmark.games} juegos</p></div>
   <div className="rounded-lg bg-slate-950 p-3"><p className="text-xs text-slate-400">Siempre Impar</p><p className="mt-1 text-xl font-semibold">{parityBenchmark.games?(100*parityBenchmark.alwaysOddAccuracy).toFixed(1)+'%':'—'}</p><p className="text-xs text-slate-400">{parityBenchmark.alwaysOddWins}/{parityBenchmark.games} juegos</p></div>
   <div className="col-span-2 rounded-lg bg-slate-950 p-3 sm:col-span-1"><p className="text-xs text-slate-400">Mejora frente a Impar</p><p className="mt-1 text-xl font-semibold">{parityBenchmark.games?(100*parityBenchmark.edgeOverBaseline).toFixed(1)+' pp':'—'}</p><p className="text-xs text-slate-400">Solo accuracy, no EV ni ROI</p></div>
  </div>
  <p className="mt-3 text-xs text-amber-200">{parityBenchmark.games&&parityBenchmark.edgeOverBaseline<=0?'El modelo NO supera la referencia siempre Impar en esta cohorte. No promocionar apuestas.':'La muestra todavía no demuestra una ventaja validada contra el baseline.'} Se eligió Impar {parityBenchmark.oddSelected} veces y Par {parityBenchmark.evenSelected} veces.</p>
 </section>}
 {sport==='TT'&&temporalAudit&&<section aria-label="Auditoría temporal de Par/Impar" className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
  <h2 className="font-semibold">Auditoría temporal de Par/Impar</h2>
  <p className="mt-2 text-xs text-slate-400">Solo pronósticos congelados antes del partido y finales W/L. El corte del 12 de noviembre de 2026 es retrospectivo y NO constituye holdout independiente.</p>
  <div className="mt-3 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b border-slate-700"><th className="p-2">Muestra</th><th className="p-2">Modelo</th><th className="p-2">Siempre Impar</th><th className="p-2">Diferencia</th></tr></thead>
   <tbody>{[['Anterior',temporalAudit.early],['Posterior',temporalAudit.later],['Total',temporalAudit.all]].map(([label,r])=><tr key={label} className="border-b border-slate-800">
    <td className="p-2">{label} ({r.games})</td><td className="p-2">{r.games?(100*r.modelAccuracy).toFixed(1)+'%':'—'}</td><td className="p-2">{r.games?(100*r.alwaysOddAccuracy).toFixed(1)+'%':'—'}</td><td className="p-2">{r.games?r.modelMinusOddPp.toFixed(1)+' pp':'—'}</td>
   </tr>)}</tbody></table></div>
  <p className="mt-2 text-xs text-amber-200">Solo investigación; no se calcula EV ni se promociona al Top. Ignorados: {temporalAudit.ignored}; duplicados idénticos: {temporalAudit.duplicates}; conflictos descartados: {temporalAudit.conflicts}.</p>
 </section>}
 <div role="tablist" aria-label="Deporte de Edge Lab" style={{display:'flex',gap:8,flexWrap:'wrap'}}>{Object.entries(names).map(([id,label])=><button key={id} role="tab" aria-selected={sport===id} onClick={()=>{setSport(id);window.history.replaceState(null,'','/edge-lab?sport='+id);}} style={{padding:12,border:'1px solid '+(sport===id?'#67e8f9':'#475569'),borderRadius:8,background:sport===id?'#164e63':'transparent'}}>{label}</button>)}</div>
 <p><button onClick={refresh} disabled={busy} style={{padding:10,border:'1px solid #64748b',borderRadius:8}}>{busy?'Consultando…':'Actualizar estado'}</button> La actualización de pantalla consulta el archivo; no consume consultas del proveedor de tenis de mesa.</p>
 {errors.map(e=><p role="alert" key={e} style={{color:'#fda4af'}}>{e}. Los datos previos visibles no se certifican como actuales.</p>)}
 {sport==='NCAAF'?<NcaafPanel/>:<>
 <section style={box}><h2>{names[sport]}</h2><p>Estado operativo: <strong>{operation?.state??last?.status??(data?'NOT_RUN':'Comprobando…')}</strong>{stale?' · ACTUALIZACIÓN ATRASADA':''}.</p><p>Último ciclo registrado: {last?.status??'N/A'} · Inicio: {date(last?.started_at)} · Finalización: {date(last?.finished_at)}.</p>
 {paused?<p>MLB está pausado por receso de temporada. Esta pantalla conserva el histórico, no reactiva procesos ni consume consultas MLB.</p>:<p>Cohorte: {cohort??'Pendiente de lectura'} · {sport==='TT'?'Recolección cada 8 horas con presupuesto máximo de dos páginas de resultados y una consulta prematch. El proveedor determina el tamaño real de cada página; no se promete cobertura completa.':sport==='MLB'?'Revisión cada 12 horas. Motor de investigación limitado a temporada regular; no altera Official Picks.':'LaLiga, cada 30 minutos. Sin cuota exacta no se calcula ROI.'}</p>}
 {operation?.state==='WARMUP'&&<p>Se están reuniendo resultados para los ratings. Todavía no hay historial suficiente para estos participantes; PASAR no es una apuesta perdida ni un error del modelo.</p>}
 {sport==='TT'&&<><p>Finales válidos disponibles en el último ciclo: {operation?.history_finals??'N/A'}. Próxima recolección prevista: {date(operation?.next_due)}; el horario no certifica una ejecución.</p>{last?.summary?.result_coverage&&<p>Resultados recibidos: {last.summary.result_coverage.received} en {last.summary.result_coverage.pages} páginas. Cobertura del archivo del proveedor: {last.summary.result_coverage.complete?'paginación completada':'PARCIAL / límite de consultas'}. Total informado por la fuente: {last.summary.result_coverage.provider_total??'no disponible'}.</p>}</>}
 {last?.summary?.operational_state==='NO_SCHEDULED_GAMES_IN_WINDOW'&&<p>Última consulta de calendario MLB: no había juegos en {last.summary.coverage?.join(' a ')}. Es un dato de esa consulta, no una comprobación nueva.</p>}
 {last?.summary?.errors?.length>0&&<p role="alert" style={{color:'#fda4af'}}>Incidencia: {last.summary.errors.map(e=>typeof e==='string'?e:JSON.stringify(e)).join(' · ')}</p>}
 {sport==='TT'&&<p>La clave permanece en el servidor del proveedor compartido; los resultados y pronósticos se guardan en Pick. No se necesita la base averiada del Hub.</p>}
 </section>
 <section style={box}><h2>Accuracy y error numérico</h2><p>Accuracy = W/(W+L). Abstenciones, disputas y proyecciones sin línea se separan. MAE es error medio absoluto, no porcentaje de aciertos.</p><div style={{overflowX:'auto'}}><table style={{width:'100%',textAlign:'left',borderSpacing:9}}><thead><tr>{['Mercado','W','L','Push','Evaluados','Accuracy','Pendientes','PASAR','Disputas','No verificables','MAE'].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{metrics.map(m=><tr key={m.market+(m.model_version??'')}><td>{marketName[m.market]??m.market}</td><td>{m.wins}</td><td>{m.losses}</td><td>{m.push??0}</td><td>{m.evaluable}</td><td>{pct(m.accuracy)}</td><td>{m.pending}</td><td>{m.abstentions}</td><td>{m.disputes}</td><td>{m.not_verifiable??0}</td><td>{num(m.mae)}</td></tr>)}</tbody></table></div>{!metrics.length&&data&&<p>N/A: todavía no hay registros de este módulo. Revisa el estado del proceso para conocer el motivo.</p>}</section>
 <section id="selecciones" style={box}><h2>Selecciones del modelo y registro de emisiones</h2>{ledgerView.controls}<p>Se conserva el primer registro. Una abstención no se promociona después por el resultado del partido.</p><div className="mt-4 grid gap-4 md:grid-cols-2">{ledgerView.rows.filter(r=>r.status!=="ABSTAIN").map(r=><SportRecommendationCard key={'card-'+r.id}
 eyebrow={'Selección del modelo · '+r.status}
 title={selection(r)}
 matchup={(r.participant_a??r.home_name)+' vs '+(r.participant_b??r.away_name)}
 lines={[marketName[r.market]??r.market,typeof r.probability==='number'?'Probabilidad: '+pct(r.probability):typeof r.projection==='number'?'Proyección: '+num(r.projection):'Sin probabilidad registrada']}
 timeLine={'Inicio: '+date(r.scheduled_at)+' PR'}
 warning={r.outcome?'Resultado registrado: '+r.outcome.status:'Snapshot prepartido · verificar oferta actual'}
 result={r.outcome?.status??'PENDIENTE'}
 />)}</div><details className="mt-5"><summary>Ver historial técnico</summary><div style={{overflowX:'auto'}}><table style={{width:'100%',textAlign:'left',borderSpacing:10}}><thead><tr>{['Inicio PR','Partido','Mercado','Estado','Selección','Probabilidad','Proyección','Resultado'].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{ledgerView.rows.map(r=><tr key={r.id}><td>{date(r.scheduled_at)}</td><td>{r.participant_a??r.home_name} vs {r.participant_b??r.away_name}</td><td>{marketName[r.market]??r.market}</td><td>{r.status}</td><td>{selection(r)}</td><td>{pct(r.probability)}</td><td>{num(r.projection)}</td><td>{r.outcome?.status??(r.status==='ABSTAIN'?'FUERA DE ACCURACY':'PENDIENTE')}</td></tr>)}</tbody></table></div></details></section>
 <section style={box}><h2>Diario y cobertura</h2>{daily.map(d=><p key={d.date+d.market}>{d.date} · {marketName[d.market]??d.market}: {d.wins} W / {d.losses} L · {pct(d.accuracy)} · {d.pending} pendientes.</p>)}{runs.map(r=><details key={r.id}><summary>{date(r.started_at)} · {r.status}</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(r.summary,null,2)}</pre></details>)}</section>
 {sport==='TT'&&<section style={box}><h2>Límite de consultas</h2><p>Este proceso está limitado a 9 intentos diarios y 240 mensuales. El consumo previo de la cuenta PulseScore no está verificado; no se interpreta este contador como saldo total del proveedor. Ante límites o falta de permisos se detiene, sin contratar otro plan.</p><pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(multi?.budget??[],null,2)}</pre></section>}
 </>}
 <p><a href="/nba-market-data">NBA · módulo de cuotas</a> · <a href="/ncaab">NCAAB · proceso existente</a> · <a href="/today">MLB original</a></p>
 </main>;
}
