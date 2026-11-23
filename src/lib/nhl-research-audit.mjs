import {buildNhlMoneylineResearch} from './nhl-research-evaluation.mjs';
import {buildNhlFeatureResearch} from './nhl-research-features.mjs';
import {gradeNhlExactCircaCohort} from './nhl-exact-circa-market-research.mjs';

export const NHL_RESEARCH_AUDIT_VERSION='NHL_ARCHIVE_RESEARCH_AUDIT_V1';
export const NHL_RESEARCH_REGISTRATION_CUTOFF='2026-11-23T15:52:27.459Z';
const array=x=>Array.isArray(x)?x:[];
const unique=(rows,key)=>new Set(rows.map(key).filter(x=>x!==null&&x!==undefined&&x!=='')).size;
const stamp=x=>Number.isFinite(Date.parse(x??''))?new Date(x).toISOString():null;
const dates=(rows,key)=>rows.map(key).map(value=>/^\d{4}-\d{2}-\d{2}$/.test(value??'')?value:stamp(value)).filter(Boolean).sort();
const duplicates=(rows,key)=>rows.length-unique(rows,key);

function entry(key,label,rows,{event=x=>x.event_id,date=x=>x.scheduled_at,captured=x=>x.captured_at,note=''}={}) {
  const times=dates(rows,date),captures=dates(rows,captured);
  return {key,label,records:rows.length,distinctGames:unique(rows,event),from:times[0]??null,to:times.at(-1)??null,
    latestCapturedAt:captures.at(-1)??null,note};
}

export function buildNhlResearchAudit(input={}, {cutoff=input.cutoff??new Date().toISOString(),includeNormalized=false}={}) {
  if(!Number.isFinite(Date.parse(cutoff)))throw Error('INVALID_AUDIT_CUTOFF');
  const required=['contexts','predictions','outcomes','early','late','goalies','specialTeams','quotes','runs','matchups','sources','sourceMetadata','diagnostics'];
  if(required.some(key=>!Array.isArray(input[key]))||input.readEvidence?.complete!==true||Date.parse(input.readEvidence?.cutoff)!==Date.parse(cutoff))
    return {version:NHL_RESEARCH_AUDIT_VERSION,status:'READ_UNAVAILABLE',auditedAt:cutoff,readOnly:true,providerCalls:0,databaseWrites:0,
      readEvidence:{complete:false},warnings:['Faltan fuentes verificadas o el corte del archivo no coincide. No se calculan métricas parciales.']};
  const times={contexts:['updated_at','boxscore_captured_at','pbp_captured_at'],predictions:['created_at'],outcomes:['observed_at'],
    early:['created_at','frozen_at','source_completed_at'],late:['created_at','frozen_at','source_completed_at'],goalies:['created_at','captured_at'],specialTeams:['created_at','captured_at'],
    quotes:['created_at','captured_at'],runs:['started_at','completed_at'],matchups:['captured_at'],sources:['captured_at'],sourceMetadata:['captured_at'],diagnostics:['analyzed_at']};
  const cutoffExclusions=[];
  const data=Object.fromEntries(required.map(key=>[key,input[key].filter(row=>{
    const invalid=times[key].some(field=>stamp(row[field])&&Date.parse(row[field])>Date.parse(cutoff));
    if(invalid)cutoffExclusions.push({source:key,eventId:row.event_id??null,reason:'CAPTURE_AFTER_AUDIT_CUTOFF',reasonLabel:'Registro posterior al corte de la auditoría'});
    return !invalid;
  })]));
  const moneyline=buildNhlMoneylineResearch({...data,cutoff});
  const features=buildNhlFeatureResearch({...data,cutoff});
  const observations=data.runs.flatMap(r=>array(r.detail?.marketQuoteObservations??r.marketQuotes)).filter(row=>{
    if(stamp(row.capturedAt)&&Date.parse(row.capturedAt)>Date.parse(cutoff)){
      cutoffExclusions.push({source:'marketQuotes',eventId:row.eventId??null,reason:'CAPTURE_AFTER_AUDIT_CUTOFF',reasonLabel:'Cuota posterior al corte de la auditoría'});return false;
    }return true;
  });
  const marketRows=market=>observations.filter(row=>row.market===market);
  const goalieGames=data.goalies.flatMap(r=>array(r.games).map(g=>({...g,captured_at:r.captured_at})));
  const pairedGoalies=goalieGames.filter(g=>g.homeProbable&&g.awayProbable);
  const playerRows=[],goalieRows=[];
  for(const context of data.contexts)for(const side of ['homeTeam','awayTeam']) {
    const players=context.boxscore?.playerByGameStats?.[side];
    const team=context.boxscore?.[side];
    for(const kind of ['forwards','defense'])for(const p of array(players?.[kind]))
      playerRows.push({...p,event_id:context.event_id,teamId:team?.id,gameDate:context.boxscore?.gameDate,capturedAt:context.boxscore_captured_at});
    for(const p of array(players?.goalies))goalieRows.push({...p,event_id:context.event_id,capturedAt:context.boxscore_captured_at});
  }
  const contextsWithBox=data.contexts.filter(r=>r.boxscore&&r.boxscore_captured_at);
  const contextsWithPbp=data.contexts.filter(r=>r.pbp_captured_at&&(r.pbp_state||r.play_by_play));
  const specialTeamRecords=data.specialTeams.flatMap(r=>array(r.teams).map(t=>({...t,captured_at:r.captured_at,snapshot_day:r.snapshot_day})));
  const scheduledByEvent=new Map(data.predictions.map(r=>[r.event_id,r.scheduled_at]));
  const entries=[
    entry('boxscores','Partidos con boxscore',contextsWithBox,{date:r=>r.boxscore?.gameDate,captured:r=>r.boxscore_captured_at,note:'Un registro por partido; estadísticas originales NHL conservadas.'}),
    entry('playByPlay','Partidos con jugada por jugada',contextsWithPbp,{date:r=>r.boxscore?.gameDate,captured:r=>r.pbp_captured_at,note:'Se comprueba presencia; esta auditoría no descarga de nuevo las jugadas.'}),
    entry('skaters','Registros de jugadores de cancha',playerRows,{date:r=>r.gameDate,captured:r=>r.capturedAt,note:`${unique(playerRows,r=>r.playerId)} jugadores únicos; las filas jugador-partido no son partidos independientes.`}),
    entry('goalieBoxscores','Registros de porteros en boxscore',goalieRows,{date:r=>scheduledByEvent.get(r.event_id),captured:r=>r.capturedAt,note:'Incluye suplentes sin minutos; el análisis distingue apariciones jugadas y estadísticas inconsistentes.'}),
    entry('predictions','Pronósticos originales DRatings',data.predictions,{captured:r=>r.created_at,note:'Probabilidad externa original e inmutable; no revela las variables internas de DRatings.'}),
    entry('outcomes','Resultados asociados',data.outcomes,{date:r=>r.body?.scheduledAt,captured:r=>r.observed_at,note:'Su disponibilidad como etiqueta no demuestra que era una entrada disponible antes del pronóstico.'}),
    entry('moneyline','Capturas Moneyline Circa',data.quotes,{note:'Circa publicada en DRatings; capturas repetidas del mismo partido.'}),
    ...['spread','total'].map(m=>entry(m,m==='spread'?'Capturas de puck line Circa':'Capturas de total Circa',marketRows(m),{event:r=>r.eventId,date:r=>r.scheduledAt,captured:r=>r.capturedAt,note:'Líneas y precios de dos lados guardados en el detalle de ejecuciones NHL; contrato y hora publicada sin certificar.'})),
    entry('probableGoalies','Partidos con ambos porteros probables',pairedGoalies,{event:r=>r.eventId,date:r=>r.scheduledAt,note:'ESPN probable; no equivale a titular confirmado ni a una identidad NHL certificada.'}),
    entry('specialTeams','Capturas PP/PK',data.specialTeams,{event:()=>null,date:r=>r.snapshot_day,note:`${specialTeamRecords.length} registros equipo-captura; no son partidos.`}),
    entry('matchups','Registros tirador–portero',data.matchups,{date:r=>r.game_date,note:'Observaciones descriptivas de jugadas; no demuestran causalidad.'}),
    entry('early','Pronósticos Poisson tempranos',data.early,{captured:r=>r.frozen_at,note:'Goles recientes y promedio previo según localía; probabilidad aproximada sin ajuste validado de portero.'}),
    entry('late','Decisiones V6 tardías',data.late,{captured:r=>r.frozen_at,note:'Circa sin margen más ajuste exploratorio de sesgo de localía; Poisson tardío se conserva como comparación.'}),
    entry('diagnostics','Diagnósticos posteriores al juego',data.diagnostics,{date:r=>scheduledByEvent.get(r.event_id),captured:r=>r.analyzed_at,note:'Descripción de errores e hipótesis; no causalidad ni aprendizaje validado.'}),
  ];
  const confirmed=goalieGames.filter(g=>g.confirmedHome===true&&g.confirmedAway===true);
  const quality=[
    {key:'teams',label:'Equipos con boxscore',count:unique(data.contexts.flatMap(r=>[r.boxscore?.homeTeam,r.boxscore?.awayTeam]),r=>r?.id),unit:'equipos',note:'Cobertura disponible, no historial completo de varias temporadas.'},
    {key:'uniqueSkaters',label:'Jugadores de cancha únicos',count:unique(playerRows,r=>r.playerId),unit:'jugadores',note:'IDs NHL de los boxscores.'},
    {key:'confirmedGoalies',label:'Partidos con ambos titulares confirmados',count:unique(confirmed,r=>r.eventId),unit:'partidos',note:'No se convierte un probable en confirmado por haber jugado después.'},
    {key:'contextDuplicates',label:'Filas duplicadas por partido en contextos',count:duplicates(data.contexts,r=>r.event_id),unit:'filas',note:'Los conflictos se excluyen de la normalización.'},
    {key:'predictionDuplicates',label:'Pronósticos originales repetidos por partido',count:duplicates(data.predictions,r=>r.event_id),unit:'filas',note:'Nunca aumentan el denominador de evaluación.'},
    {key:'earlyDuplicates',label:'Congelaciones tempranas repetidas por partido',count:duplicates(data.early,r=>r.event_id),unit:'filas',note:'Las duplicadas se rechazan para evaluar.'},
    {key:'lateDuplicates',label:'Congelaciones V6 repetidas por partido',count:duplicates(data.late,r=>r.event_id),unit:'filas',note:'Las duplicadas se rechazan para evaluar.'},
    {key:'marketRulesVerified',label:'Capturas Spread/Total con contrato certificado',count:observations.filter(r=>r.marketRulesCertified===true&&r.quote?.fullGameContractCertified===true).length,unit:'capturas',note:'Las reglas generales de Circa no certifican cada contrato capturado.'},
    {key:'quotePublishedAt',label:'Capturas Spread/Total con hora publicada de origen',count:observations.filter(r=>stamp(r.sourceUpdatedAt)).length,unit:'capturas',note:'capturedAt registra cuándo Pick observó el precio; no cuándo Circa lo publicó.'},
    {key:'goalieAccounting',label:'Porteros con conteos incompatibles',count:features.coverage?.missingFields?.find(r=>r.field==='goalie.shotAccounting')?.count??0,unit:'registros',note:'Las estadísticas afectadas se excluyen de la forma previa; se conservan los datos originales.'},
    {key:'teamShots',label:'Discrepancias entre tiros del equipo y jugadores',count:features.coverage?.missingFields?.find(r=>r.field==='team.skaterShotReconciliation')?.count??0,unit:'registros de equipo',note:'El volumen de tiros afectado no entra como ataque ni como tiros concedidos del rival.'},
  ];
  const exactMarkets={
    early:gradeNhlExactCircaCohort({frozenRows:data.early,observations,finalRows:data.outcomes}),
    late:gradeNhlExactCircaCohort({frozenRows:data.late.map(r=>({...r,home_team:r.market_proxies?.frozenTeams?.home??null,away_team:r.market_proxies?.frozenTeams?.away??null})),observations,finalRows:data.outcomes}),
    gates:{fullGameOTSOContractCertified:false,CircaQuotePublishedAtVerified:false,FanDuelMarketsVerified:false,roiValidated:false,modelPromotionApproved:false},
  };
  const publicFeatures=includeNormalized?features:Object.fromEntries(Object.entries(features).filter(([key])=>!['normalized','decisionFeatures'].includes(key)));
  return {
    version:NHL_RESEARCH_AUDIT_VERSION,status:data.contexts.length||data.predictions.length?'READ_ONLY_NHL_RESEARCH_AUDIT':'EMPTY_ARCHIVE',
    auditedAt:cutoff,readOnly:true,providerCalls:0,databaseWrites:0,
    inventory:{entries,quality},moneyline,features:publicFeatures,exactMarkets,
    readEvidence:input.readEvidence,cutoffExclusions,
    modelInputs:[
      {model:'DRatings original',used:['Probabilidad publicada de DRatings'],evidenceOnly:['La arquitectura interna del proveedor no está demostrada por estos archivos.']},
      {model:'Poisson propio',used:['Goles anotados/permitidos en cinco partidos previos observados','Promedio previo de liga según localía','Mezcla fija 75% forma / 25% promedio'],evidenceOnly:['Porteros probables','PP/PK','Estadísticas de jugadores']},
      {model:'V6 calibrador',used:['Cuota Circa de ambos lados sin margen','Residuo previo de victoria local con contracción n/(n+50)'],evidenceOnly:['Poisson tardío como referencia separada','Porteros probables y forma histórica V7','PP/PK']},
    ],
    props:{status:'RESEARCH_PREPARATION_ONLY',available:['Boxscores individuales y IDs NHL','Tiros a puerta de jugadores','Atajadas y carga de trabajo de porteros'],missing:['Líneas y precios por jugador antes del inicio','Contrato por periodo, overtime, DNP y portero titular','Ventanas completas del jugador y correspondencia del mercado','Liquidación y evaluación prospectiva con las mismas condiciones'],ready:false},
    researchPlan:{dataCutoff:NHL_RESEARCH_REGISTRATION_CUTOFF,protocolPreparedDuringAudit:true,prospectiveCandidateForecastsIssued:0,officialModelPromotion:false,futureHoldoutPassed:false,minimumInitialReviewGames:30,minimumGamesNotProof:true},
    warnings:[
      'Investigación sobre el archivo disponible; no representa apuestas recomendadas, ROI ejecutable ni ventaja frente a FanDuel.',
      'DRatings temprano y V6 tardío tienen tiempos de información distintos; la tabla común no aísla el efecto del algoritmo.',
      'Los intervalos con pocos partidos y pocas fechas son exploratorios. Ninguna mejora se promueve automáticamente.',
      'Boxscores recibidos tarde sirven para etiquetas o decisiones futuras, nunca como entradas retrospectivas de pronósticos anteriores.',
    ],
    nextSteps:[
      'Revisar V6 al alcanzar 30 partidos independientes como diagnóstico inicial y seguir acumulando fechas; 100 partidos tampoco prueban por sí solos una mejora.',
      'Mantener bloqueados los resultados futuros de las nuevas variantes para selección de fórmulas y registrar sus probabilidades antes de cada partido si se autoriza una fase SHADOW.',
      'Resolver las inconsistencias de estadísticas señaladas en el libro de exclusiones conservando el original y su procedencia.',
      'Verificar identidad y estado previo de los porteros y las condiciones exactas de mercado antes de incorporar sus ajustes a recomendaciones.',
      'Completar líneas, precios, reglas y liquidación de props de tiros y atajadas antes de presentarlos como mercados disponibles.',
    ],
  };
}
