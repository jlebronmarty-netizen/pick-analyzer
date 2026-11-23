// Read the canonical NHL_MANUAL_FEATURES_V1 contract; never recalculate predictions.
export const NHL_MANUAL_FEATURE_TABLE='nhl_manual_feature_snapshots_v1';
export const NHL_MANUAL_FEATURE_SCHEMA='NHL_MANUAL_FEATURES_V1';
export const NHL_MANUAL_FEATURE_TIMEZONE='America/Puerto_Rico';
const SELECT='event_id,available_as_of,scheduled_at,source_snapshot_sha256,source_run_id,feature_payload,schema_version,inserted_at';
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const instant=x=>typeof x==='string'&&/T.*(?:Z|[+-]\d{2}:?\d{2})$/.test(x)&&Number.isFinite(Date.parse(x));
const finite=x=>typeof x==='number'&&Number.isFinite(x)?x:null;
const nonnegative=x=>finite(x)!==null&&x>=0?x:null;
const text=x=>typeof x==='string'&&x.length<=240?x:null;
const flag=x=>typeof x==='boolean'?x:null;
const eventId=x=>typeof x==='string'&&/^nhl:\d{10}$/.test(x);

export class NhlManualFeaturesReadError extends Error {
  constructor(code){super(code);this.code=code;}
}

export function nhlManualFeatureDate(cutoff=new Date().toISOString()) {
  if(!instant(cutoff))throw new NhlManualFeaturesReadError('INVALID_READ_REQUEST');
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:NHL_MANUAL_FEATURE_TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(cutoff)).map(v=>[v.type,v.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

export function nhlManualFeatureDayBounds(date) {
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(`${date}T00:00:00Z`))||new Date(`${date}T00:00:00Z`).toISOString().slice(0,10)!==date)
    throw new NhlManualFeaturesReadError('INVALID_DATE');
  // Puerto Rico is UTC-04 throughout the year, matching the panel's day boundary.
  const from=new Date(`${date}T00:00:00-04:00`).toISOString();
  return {from,to:new Date(Date.parse(from)+86400000).toISOString()};
}

export function validNhlManualFeatureRow(row,{date,cutoff}) {
  const f=row?.feature_payload;
  if(!object(f)||row.schema_version!==NHL_MANUAL_FEATURE_SCHEMA||f.schema_version!==row.schema_version||!eventId(row.event_id)||f.event_id!==row.event_id||
    !instant(row.available_as_of)||!instant(row.inserted_at)||!instant(row.scheduled_at)||!instant(f.available_as_of)||!instant(f.scheduled_at)||
    Date.parse(row.available_as_of)!==Date.parse(row.inserted_at)||Date.parse(row.available_as_of)>Date.parse(cutoff)||
    Date.parse(f.available_as_of)>Date.parse(row.available_as_of)||Date.parse(row.scheduled_at)<=Date.parse(row.available_as_of)||
    Date.parse(f.scheduled_at)!==Date.parse(row.scheduled_at)||f.local_date!==date||nhlManualFeatureDate(row.scheduled_at)!==date||
    !/^[a-f0-9]{64}$/.test(row.source_snapshot_sha256??'')||!/^[A-Za-z0-9][A-Za-z0-9:_.-]{0,159}$/.test(row.source_run_id??'')||
    f.scope!=='PROSPECTIVE_RESEARCH_INPUTS'||f.forecast_probability!==null||f.official_pick!==false||f.model_promoted!==false||
    !object(f.teams)||!object(f.coverage)||!object(f.provenance))return false;
  for(const side of ['away','home']) {
    const t=f.teams[side];
    if(!object(t)||!/^[A-Z]{2,3}$/.test(t.abbrev??'')||!['season','last10','special_teams','rest','reported_goalie'].every(k=>object(t[k]))||
      !Array.isArray(t.recent_event_ids)||t.recent_event_ids.length>10||!t.recent_event_ids.every(eventId)||new Set(t.recent_event_ids).size!==t.recent_event_ids.length)return false;
  }
  return f.teams.away.abbrev!==f.teams.home.abbrev;
}

/** @param {any} db @param {{date?:string,cutoff?:string,signal?:AbortSignal,pageSize?:number,cap?:number}} options */
export async function readNhlManualFeaturePages(db,{date,cutoff=new Date().toISOString(),signal,pageSize=100,cap=512}={}) {
  if(!instant(cutoff)||!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>250||!Number.isSafeInteger(cap)||cap<1||cap>4096)
    throw new NhlManualFeaturesReadError('INVALID_READ_REQUEST');
  date=date??nhlManualFeatureDate(cutoff);
  const {from,to}=nhlManualFeatureDayBounds(date),rows=[],keys=new Set();
  let expected=null,pages=0;
  while(true) {
    if(signal?.aborted)throw new NhlManualFeaturesReadError('READ_TIMEOUT');
    let q=db.from(NHL_MANUAL_FEATURE_TABLE).select(SELECT,{count:'exact'})
      .gte('scheduled_at',from).lt('scheduled_at',to).lte('available_as_of',cutoff).lte('inserted_at',cutoff)
      .order('scheduled_at',{ascending:true}).order('event_id',{ascending:true}).order('available_as_of',{ascending:true})
      .range(rows.length,rows.length+pageSize-1);
    if(signal)q=q.abortSignal(signal);
    const result=await q;pages++;
    if(result.error)throw new NhlManualFeaturesReadError(['42P01','PGRST205'].includes(result.error.code)?'NOT_INSTALLED':signal?.aborted?'READ_TIMEOUT':'READ_UNAVAILABLE');
    if(!Array.isArray(result.data)||!Number.isSafeInteger(result.count)||result.count<0)throw new NhlManualFeaturesReadError('COUNT_UNVERIFIED');
    if(expected===null)expected=result.count;
    if(result.count!==expected)throw new NhlManualFeaturesReadError('SNAPSHOT_CHANGED_DURING_READ');
    if(expected>cap)throw new NhlManualFeaturesReadError('SOURCE_SCAN_CAPPED');
    if(!result.data.length&&rows.length<expected)throw new NhlManualFeaturesReadError('INCOMPLETE_ARCHIVE_PAGE');
    for(const row of result.data) {
      const key=JSON.stringify([row?.event_id,row?.available_as_of]);
      if(keys.has(key)||!validNhlManualFeatureRow(row,{date,cutoff}))throw new NhlManualFeaturesReadError('INVALID_OR_DUPLICATE_SNAPSHOT');
      keys.add(key);rows.push(row);
    }
    if(rows.length>expected)throw new NhlManualFeaturesReadError('ARCHIVE_COUNT_MISMATCH');
    if(rows.length===expected)return {rows,date,cutoff,evidence:{table:NHL_MANUAL_FEATURE_TABLE,rows:rows.length,pages,expected,complete:true}};
  }
}

function teamView(t) {
  const season=t.season,l10=t.last10,g=t.reported_goalie,st=t.special_teams,r=t.rest;
  return {
    abbrev:t.abbrev,
    season:{record:text(season.record),games:nonnegative(season.gp),points:nonnegative(season.points),goalsForPerGame:nonnegative(season.gf_pg),goalsAgainstPerGame:nonnegative(season.ga_pg),throughDate:text(season.through_date)},
    last10:{record:text(l10.record),games:nonnegative(l10.gp),complete:l10.complete===true,sequenceVerified:l10.sequence_verified===true,
      goalsForPerGame:nonnegative(l10.gf_pg),goalsAgainstPerGame:nonnegative(l10.ga_pg),shotsForPerGame:nonnegative(l10.shots_for_pg),shotsAgainstPerGame:nonnegative(l10.shots_against_pg),
      recentEventIds:[...t.recent_event_ids],periods:(Array.isArray(l10.periods)?l10.periods:[]).filter(p=>[1,2,3].includes(p?.period)).slice(0,3).map(p=>({period:p.period,games:nonnegative(p.gp),goalsForPerGame:nonnegative(p.gf_pg),goalsAgainstPerGame:nonnegative(p.ga_pg),shotsForPerGame:nonnegative(p.shots_for_pg),shotsAgainstPerGame:nonnegative(p.shots_against_pg),goalsCoverage:nonnegative(p.goals_coverage),shotsCoverage:nonnegative(p.shots_coverage)}))},
    specialTeams:{powerPlayPct:finite(st.pp_pct),penaltyKillPct:finite(st.pk_pct),currentGamesMatch:st.is_current_gp_match===true,capturedAt:instant(st.captured_at)?st.captured_at:null},
    rest:{daysOff:nonnegative(r.days_off),backToBack:flag(r.back_to_back),verified:r.verified===true},
    goalie:{name:text(g.name),status:text(g.status)??'NO_CONFIRMADO',checkedAt:instant(g.checked_at)?g.checked_at:null},
  };
}

export function buildNhlManualFeaturesReport({rows,date,cutoff,evidence}) {
  const latest=new Map();
  for(const row of rows)if(!latest.has(row.event_id)||Date.parse(row.available_as_of)>Date.parse(latest.get(row.event_id).available_as_of))latest.set(row.event_id,row);
  const fixtures=[...latest.values()].sort((a,b)=>a.scheduled_at.localeCompare(b.scheduled_at)||a.event_id.localeCompare(b.event_id)).map(r=>({
    eventId:r.event_id,scheduledAt:r.scheduled_at,availableAsOf:r.available_as_of,sourceGeneratedAt:r.feature_payload.available_as_of,
    sourceRunId:r.source_run_id,sourceSnapshotSha256:r.source_snapshot_sha256,
    phase:Date.parse(r.scheduled_at)>Date.parse(cutoff)?'PREGAME':'HISTORICAL_SNAPSHOT',
    teams:{away:teamView(r.feature_payload.teams.away),home:teamView(r.feature_payload.teams.home)},
    coverage:{bothLast10Complete:r.feature_payload.coverage.both_last10_complete===true,bothGoaliesConfirmed:r.feature_payload.coverage.both_goalies_confirmed===true,
      standingsCurrent:r.feature_payload.coverage.standings_current===true,standingsThrough:text(r.feature_payload.coverage.standings_through)},
  }));
  return {
    status:fixtures.length?'READY':'EMPTY',schemaVersion:NHL_MANUAL_FEATURE_SCHEMA,date,timezone:NHL_MANUAL_FEATURE_TIMEZONE,readAt:cutoff,
    readOnly:true,providerCalls:0,databaseWrites:0,predictionAdjustment:false,modelPromoted:false,
    summary:{snapshots:rows.length,games:fixtures.length,pregameGames:fixtures.filter(f=>f.phase==='PREGAME').length,
      bothLast10Complete:fixtures.filter(f=>f.coverage.bothLast10Complete).length,bothGoaliesConfirmed:fixtures.filter(f=>f.coverage.bothGoaliesConfirmed).length,
      latestAvailableAsOf:rows.map(r=>r.available_as_of).sort((a,b)=>Date.parse(a)-Date.parse(b)).at(-1)??null},
    fixtures,readEvidence:evidence,
    warnings:[fixtures.length?'Datos compartidos con el panel manual; disponibles para investigación, todavía sin ajustar probabilidades de Pick.':'No hay cortes prepartido guardados para esta fecha.',
      'La hora de disponibilidad en Pick es la de persistencia. La hora de generación de la fuente se conserva por separado; no acredita disponibilidad anterior.',
      'Un dato faltante sigue vacío. Los cortes de clasificación, últimos diez, PP/PK y porteros pueden ser diferentes.'],
  };
}

export function unavailableNhlManualFeaturesReport(code,{date,cutoff}) {
  const status=code==='NOT_INSTALLED'?'NOT_INSTALLED':code==='SOURCE_SCAN_CAPPED'?'SOURCE_SCAN_CAPPED':'READ_UNAVAILABLE';
  return {status,schemaVersion:NHL_MANUAL_FEATURE_SCHEMA,date,timezone:NHL_MANUAL_FEATURE_TIMEZONE,readAt:cutoff,readOnly:true,providerCalls:0,databaseWrites:0,predictionAdjustment:false,modelPromoted:false,summary:null,fixtures:[],
    warnings:[status==='NOT_INSTALLED'?'El almacenamiento de datos compartidos aún no está instalado en este entorno.':status==='SOURCE_SCAN_CAPPED'?'La lectura supera el límite verificado; no se muestran datos parciales.':'No se pudo verificar la lectura completa de los datos compartidos.',
      'Este módulo no modifica las probabilidades ni las selecciones de Pick.']};
}
