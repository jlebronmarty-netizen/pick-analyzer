// Read-only projection of the immutable Edge Lab ledger. No providers or writers.
const configs=[
 {sport:'SOCCER',key:'soccer',label:'Soccer · LaLiga',cohort:'EDGE_LAB_RESTART_20261104',primary:'1X2',versions:{'1X2':'SOCCER_V0_PICK_PORT_1',TOTAL_2_5:'SOCCER_V0_PICK_PORT_1'},labels:{'1X2':'Ganador / empate (1X2)',TOTAL_2_5:'Over / Under 2.5'},note:'Nueva cohorte prospectiva de LaLiga. No incluye el checkpoint antiguo. Los mercados se evalúan por separado.'},
 {sport:'TT',key:'table-tennis',label:'Tenis de mesa',cohort:'EDGE_LAB_LIVE_20261104',primary:'MONEYLINE',versions:{MONEYLINE:'TT_ML_V1_PICK_PORT_1',SETS_ODD_EVEN:'TT_SETS_OE_V1_PICK_PORT_1',TOTAL_POINTS:'TT_TOTAL_V1_PICK_PORT_1'},labels:{MONEYLINE:'Ganador',SETS_ODD_EVEN:'Sets par / impar',TOTAL_POINTS:'Total de puntos'},note:'Seguimiento nuevo en Pick; cobertura parcial del proveedor. Los resultados no localizados siguen pendientes.'},
 {sport:'NCAAF',key:'ncaaf',label:'NCAAF · PPG',cohort:'NCAAF_PPG_PICK_20261105',primary:'MONEYLINE',versions:{MONEYLINE:'NCAAF_PPG_V1_PICK_PORT_1',POINT_MARGIN:'NCAAF_PPG_V1_PICK_PORT_1',TOTAL_POINTS:'NCAAF_PPG_V1_PICK_PORT_1'},labels:{MONEYLINE:'Ganador',POINT_MARGIN:'Margen de puntos',TOTAL_POINTS:'Total de puntos'},note:'PPG experimental; Ridge no está activo. Margen y total son proyecciones numéricas, no apuestas spread/O-U.'},
];
const datePR=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Puerto_Rico',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
const validTime=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
const percent=x=>x===null?'N/A':(x*100).toFixed(2)+'%';
function empty(c,reason,checkedAt){return {key:c.key,label:c.label,href:'/edge-lab?sport='+c.sport,classification:'SHADOW / MODEL_ONLY',metricLabel:c.labels[c.primary],linkLabel:'Ver selecciones, accuracy y resultados →',checkedAt,detailLines:[reason],cohorts:[{key:c.cohort,label:c.cohort,available:false,wins:null,losses:null,pending:null,pushes:null,voids:null,models:null,accuracy:null,note:'Lectura no verificada. No se sustituye por cero ni por un checkpoint antiguo.'}]};}
function summarize(c,rows,market){
 const items=rows.filter(r=>r.market===market),active=items.filter(r=>r.status!=='ABSTAIN');
 const count=s=>active.filter(r=>r.outcome?.status===s).length;
 const wins=count('W'),losses=count('L'),numeric=active.filter(r=>r.outcome?.status==='NUMERIC'&&Number.isFinite(r.outcome.absolute_error)&&r.outcome.absolute_error>=0);
 return {market,label:c.labels[market],wins,losses,evaluable:wins+losses,accuracy:wins+losses?wins/(wins+losses):null,pushes:count('PUSH'),pending:active.filter(r=>!r.outcome).length,abstentions:items.length-active.length,disputes:count('DISPUTE'),notVerifiable:count('NOT_VERIFIABLE'),numericN:numeric.length,mae:numeric.length?numeric.reduce((n,r)=>n+r.outcome.absolute_error,0)/numeric.length:null};
}
export function buildEdgeLabOverviewCard(sport,report,checkedAt=new Date().toISOString()){
 const c=configs.find(x=>x.sport===sport);if(!c)throw Error('UNSUPPORTED_OVERVIEW_SPORT');
 if(!validTime(checkedAt)||!report||!Array.isArray(report.rows))return empty(c,'Fuente actual no disponible.',checkedAt);
 try{
  const relevant=report.rows.filter(r=>r.sport===sport&&r.cohort===c.cohort&&c.versions[r.market]===r.model_version),ids=new Set(),contracts=new Set();
  for(const r of relevant){
   if(typeof r.id!=='string'||typeof r.event_id!=='string'||ids.has(r.id))throw Error('DUPLICATE_OR_MISSING_ID');ids.add(r.id);
   const key=[r.cohort,r.event_id,r.market,r.model_version].join('|');if(contracts.has(key))throw Error('DUPLICATE_CONTRACT');contracts.add(key);
   if(!['FORECAST','PROJECTION','ABSTAIN'].includes(r.status)||!validTime(r.emitted_at)||!validTime(r.scheduled_at)||Date.parse(r.emitted_at)>=Date.parse(r.scheduled_at))throw Error('PREGAME_EVIDENCE_INVALID');
   if(r.outcome&&r.outcome.forecast_id!==r.id)throw Error('OUTCOME_LINK_INVALID');
   if(r.status==='ABSTAIN'&&r.outcome)throw Error('ABSTENTION_EVALUATED');
   if(r.outcome&&!['W','L','PUSH','NUMERIC','DISPUTE','NOT_VERIFIABLE'].includes(r.outcome.status))throw Error('UNKNOWN_OUTCOME');
   if(r.status==='PROJECTION'&&['W','L','PUSH'].includes(r.outcome?.status))throw Error('NUMERIC_RESULT_AS_ACCURACY');
   if(r.outcome?.status==='NUMERIC'&&(r.status!=='PROJECTION'||!Number.isFinite(r.outcome.absolute_error)||r.outcome.absolute_error<0))throw Error('NUMERIC_RESULT_INVALID');
  }
  const metrics=Object.keys(c.versions).map(m=>summarize(c,relevant,m)),primary=metrics.find(m=>m.market===c.primary);
  const primaryRows=relevant.filter(r=>r.market===c.primary&&r.status==='FORECAST');
  const today=datePR(checkedAt),todayN=primaryRows.filter(r=>datePR(r.scheduled_at)===today).length;
  const futureN=primaryRows.filter(r=>!r.outcome&&Date.parse(r.scheduled_at)>Date.parse(checkedAt)).length;
  const detailLines=metrics.filter(m=>m.market!==c.primary).map(m=>m.numericN?`${m.label}: MAE ${m.mae.toFixed(2)} puntos · n=${m.numericN} · ${m.pending} pendientes`:m.market==='TOTAL_POINTS'||m.market==='POINT_MARGIN'?`${m.label}: MAE N/A · ${m.pending} pendientes`:`${m.label}: ${percent(m.accuracy)} · ${m.wins} W / ${m.losses} L · ${m.pending} pendientes`);
  detailLines.unshift(`Ganadores: ${todayN} selecciones con fecha de hoy · ${futureN} futuras sin resultado.`);
  detailLines.push(`PASAR: ${primary.abstentions} · Disputas: ${primary.disputes} · No verificables: ${primary.notVerifiable} · PUSH: ${primary.pushes}.`);
  const omitted=report.rows.filter(r=>r.sport===sport&&!relevant.includes(r)).length;
  if(omitted)detailLines.push(`${omitted} registros de otra cohorte/versión no se mezclan aquí.`);
  return {key:c.key,label:c.label,href:'/edge-lab?sport='+c.sport,classification:'SHADOW / MODEL_ONLY',metricLabel:c.labels[c.primary],linkLabel:'Ver selecciones, accuracy y resultados →',checkedAt,detailLines,marketMetrics:metrics,cohorts:[{key:c.cohort,label:c.versions[c.primary],available:true,wins:primary.wins,losses:primary.losses,pending:primary.pending,pushes:primary.pushes,voids:0,models:1,accuracy:primary.accuracy,note:c.note}]};
 }catch{return empty(c,'Registros requieren revisión de identidad, emisión o duplicados.',checkedAt);}
}
