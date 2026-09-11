// Fixed transactional operations for the exact authorized R6 table. No SQL,
// target, clock, cap, or counter reset can be supplied by the caller.
import {sha256} from '../../../scripts/mlb-data-02r-r2f-stage-contracts.mjs'
import {persistOrRecoverEvidence} from './mlb-provider-evidence.mjs'
import {sanitizedStageException} from '../../../scripts/mlb-operational-r7-errors.mjs'
const TABLE = 'public.pick2_mlb_runtime_state'
const PENDING = "state_kind='RUN' AND status <> 'COMPLETE' AND (status <> 'FAILED' OR checkpoint #>> '{disposition,status}' IS DISTINCT FROM 'TERMINAL_PARTIAL_PRESERVED')"
export const reviewDigest=run=>sha256({runId:run.run_id,packageSha:run.package_sha,runAsOf:new Date(run.run_as_of).toISOString(),revision:Number(run.revision),status:run.status,checkpoint:run.checkpoint,dml:run.dml_accounting,providers:[run.mlb_official_calls,run.statcast_calls,run.odds_calls]})
const LEASE = 'MLB_OPERATIONAL_GLOBAL', MISSION = 'MLB_OPERATIONAL_MISSION'
const PROVIDERS = Object.freeze({ MLB_OFFICIAL: ['mlb_official_calls',50], STATCAST: ['statcast_calls',100], THE_ODDS_API: ['odds_calls',1] })
const ensure = (ok, reason) => { if (!ok) throw Error(`R6_STATE:${reason}`) }
const id = x => typeof x === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(x)
const digest = x => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x)
const integer = x => Number.isSafeInteger(x) && x >= 0
const dateText=x=>x instanceof Date?x.toISOString().slice(0,10):String(x).slice(0,10)
export function marketReadbackDigest({predictions,mappings,observations,oddsReference}) {
  const normalize=x=>{
    if(Array.isArray(x))return x.map(normalize)
    if(x && typeof x==='object')return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,normalize(v)]))
    if(typeof x==='string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(x) && Number.isFinite(Date.parse(x))) {
      // Normalize UTC spelling without truncating PostgreSQL microseconds.
      const fraction=(x.match(/\.(\d+)(?:Z|[+-]\d{2}:?\d{2})$/)?.[1]??'').replace(/0+$/,'')
      return new Date(x).toISOString().slice(0,19)+(fraction?'.'+fraction:'')+'Z'
    }
    return x
  }
  const ordered=(rows,key)=>rows.map(normalize).sort((a,b)=>String(a[key]).localeCompare(String(b[key])))
  return sha256({predictions:ordered(predictions,'id'),mappings:ordered(mappings,'id'),observations:ordered(observations,'observation_identity'),oddsReference:normalize(oddsReference)})
}
// Original provider column order from the existing 01A schema certificate.
// JSONB reorders keys, so source-byte digests cannot use JSONB iteration order.
const STATCAST_COLUMNS = 'pitch_type,game_date,release_speed,release_pos_x,release_pos_z,player_name,batter,pitcher,events,description,spin_dir,spin_rate_deprecated,break_angle_deprecated,break_length_deprecated,zone,des,game_type,stand,p_throws,home_team,away_team,type,hit_location,bb_type,balls,strikes,game_year,pfx_x,pfx_z,plate_x,plate_z,on_3b,on_2b,on_1b,outs_when_up,inning,inning_topbot,hc_x,hc_y,tfs_deprecated,tfs_zulu_deprecated,umpire,sv_id,vx0,vy0,vz0,ax,ay,az,sz_top,sz_bot,hit_distance_sc,launch_speed,launch_angle,effective_speed,release_spin_rate,release_extension,game_pk,fielder_2,fielder_3,fielder_4,fielder_5,fielder_6,fielder_7,fielder_8,fielder_9,release_pos_y,estimated_ba_using_speedangle,estimated_woba_using_speedangle,woba_value,woba_denom,babip_value,iso_value,launch_speed_angle,at_bat_number,pitch_number,pitch_name,home_score,away_score,bat_score,fld_score,post_away_score,post_home_score,post_bat_score,post_fld_score,if_fielding_alignment,of_fielding_alignment,spin_axis,delta_home_win_exp,delta_run_exp,bat_speed,swing_length,miss_distance,estimated_slg_using_speedangle,delta_pitcher_run_exp,hyper_speed,home_score_diff,bat_score_diff,home_win_exp,bat_win_exp,age_pit_legacy,age_bat_legacy,age_pit,age_bat,n_thruorder_pitcher,n_priorpa_thisgame_player_at_bat,pitcher_days_since_prev_game,batter_days_since_prev_game,pitcher_days_until_next_game,batter_days_until_next_game,api_break_z_with_gravity,api_break_x_arm,api_break_x_batter_in,arm_angle,attack_angle,attack_direction,swing_path_tilt,intercept_ball_minus_batter_pos_x_inches,intercept_ball_minus_batter_pos_y_inches'.split(',')
export function dependencyRawReadback(rows, run) {
  const scope=run.checkpoint.dependencyScope, receipt=run.dml_accounting.stages[0]
  ensure(scope?.length && rows.length<=scope.length*1000,'DEPENDENCY_RAW_CAP')
  ensure(new Set(rows.map(r=>r.id)).size===rows.length,'DEPENDENCY_RAW_DUPLICATE')
  const counts=new Map(scope.map(g=>[g,0]))
  for(const r of rows) {
    ensure(scope.includes(Number(r.game_pk)) && r.id===`statcast:mlb:2026:${r.game_pk}:${r.at_bat_number}:${r.pitch_number}`,'DEPENDENCY_RAW_IDENTITY')
    ensure(dateText(r.game_date)<dateText(run.run_date),'DEPENDENCY_RAW_DATE')
    const p=r.raw_payload
    ensure(p && Object.keys(p).length===STATCAST_COLUMNS.length && STATCAST_COLUMNS.every(k=>Object.hasOwn(p,k)),'DEPENDENCY_RAW_PAYLOAD')
    ensure(sha256(JSON.stringify(Object.fromEntries(STATCAST_COLUMNS.map(k=>[k,p[k]]))))===r.raw_payload_digest,'DEPENDENCY_RAW_SOURCE_DIGEST')
    ensure(Number(p.game_pk)===Number(r.game_pk) && Number(p.at_bat_number)===Number(r.at_bat_number) && Number(p.pitch_number)===Number(r.pitch_number) && p.game_date===String(r.game_date).slice(0,10),'DEPENDENCY_RAW_SOURCE_IDENTITY')
    counts.set(Number(r.game_pk),counts.get(Number(r.game_pk))+1)
  }
  ensure([...counts.values()].every(n=>n<=1000),'DEPENDENCY_RAW_GAME_CAP')
  const committed=rows.filter(r=>Date.parse(r.created_at)>=Date.parse(run.run_as_of) && Date.parse(r.created_at)<=Date.parse(run.checkpoint.failure.timestamp))
  ensure(committed.length===receipt.inserted,'DEPENDENCY_RAW_RECEIPT_COUNT')
  return {count:rows.length,committed:committed.length,digest:sha256(rows.map(r=>({id:r.id,sourceDigest:r.raw_payload_digest})).sort((a,b)=>a.id.localeCompare(b.id))),coverage:scope.map(gamePk=>({gamePk,count:counts.get(gamePk),classification:counts.get(gamePk)?'SATISFIED_REUSE':'MISSING_FETCH_REQUIRED'}))}
}
const keys = (x, allowed) => ensure(x && typeof x === 'object' && !Array.isArray(x) && Object.keys(x).every(k => allowed.includes(k)), 'METADATA_FIELDS')
export const serializedBytes = x => new TextEncoder().encode(JSON.stringify(x)).length
const canonical = x => JSON.stringify(x, Object.keys(x).sort())
export const MODES = ['INITIALIZE','PREGAME','STARTER_CHANGE','ODDS_FRESHNESS','INCREMENTAL','POSTGAME','OVERNIGHT','HOST_DRY']

export function validateCheckpoint(x) {
  keys(x, ['version','mode','stage','scope','dependencyScope','completed','references','blocked','result','marketGames','marketReference','failure','disposition','dependencyRecoveries','marketRecoveries'])
  if(x.marketRecoveries!==undefined) {
    ensure(Array.isArray(x.marketRecoveries) && x.marketRecoveries.length>=1 && x.marketRecoveries.length<=3,'MARKET_RECOVERY_CAP')
    for(const r of x.marketRecoveries) {
      keys(r,['reviewDigest','reviewedAt','fromRevision','readbackDigest','priorFailure','executorPackageSha'])
      ensure(digest(r.reviewDigest) && digest(r.readbackDigest) && integer(r.fromRevision) && Number.isFinite(Date.parse(r.reviewedAt)) && /^[a-f0-9]{40}$/.test(r.executorPackageSha) && r.priorFailure?.stage==='MARKET_PERSISTENCE','MARKET_RECOVERY_SHAPE')
    }
  }
  if(x.dependencyRecoveries!==undefined) {
    ensure(Array.isArray(x.dependencyRecoveries) && x.dependencyRecoveries.length>0 && x.dependencyRecoveries.length<=3,'DEPENDENCY_RECOVERY_CAP')
    for(const r of x.dependencyRecoveries) {
      keys(r,['reviewDigest','reviewedAt','fromRevision','rawReadbackDigest','rawCount','priorFailure','executorPackageSha'])
      ensure(digest(r.reviewDigest) && digest(r.rawReadbackDigest) && integer(r.fromRevision) && integer(r.rawCount) && r.rawCount>0 && Number.isFinite(Date.parse(r.reviewedAt)) && /^[a-f0-9]{40}$/.test(r.executorPackageSha) && r.priorFailure?.stage==='DEPENDENCY_SCOPE','DEPENDENCY_RECOVERY_SHAPE')
    }
  }
  ensure(x.version === 1 && MODES.includes(x.mode) && id(x.stage), 'CHECKPOINT_HEADER')
  ensure(Array.isArray(x.scope) && x.scope.length <= 50 && x.scope.every(n => integer(n) && n > 0) && new Set(x.scope).size === x.scope.length, 'SCOPE')
  if(x.dependencyScope !== undefined)ensure(Array.isArray(x.dependencyScope) && x.dependencyScope.length<=500 && x.dependencyScope.every(n=>integer(n)&&n>0) && new Set(x.dependencyScope).size===x.dependencyScope.length,'DEPENDENCY_SCOPE')
  ensure(Array.isArray(x.completed) && x.completed.length <= 500 && x.completed.every(id) && new Set(x.completed).size === x.completed.length, 'COMPLETED')
  ensure(Array.isArray(x.references) && x.references.length <= 500, 'REFERENCES')
  for (const r of x.references) {
    keys(r, ['kind','identity','digest','count','asOf','identities','vectorDigest'])
    ensure(id(r.kind) && id(r.identity) && digest(r.digest) && integer(r.count) && typeof r.asOf === 'string' && Number.isFinite(Date.parse(r.asOf)), 'REFERENCE_SHAPE')
    if(r.kind==='persisted_features')ensure(Array.isArray(r.identities) && r.identities.length===10 && new Set(r.identities).size===10 && r.identities.every(v=>typeof v==='string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v)) && digest(r.vectorDigest) && x.scope.includes(Number(r.identity)), 'FEATURE_REFERENCE')
    else ensure(r.identities===undefined && r.vectorDigest===undefined,'UNEXPECTED_FEATURE_REFERENCE')
  }
  ensure(Array.isArray(x.blocked) && x.blocked.length <= 50, 'BLOCKED')
  for (const r of x.blocked) { keys(r, ['gamePk','reason']); ensure(integer(r.gamePk) && r.gamePk > 0 && typeof r.reason==='string' && /^[A-Za-z0-9_:.-]{1,160}$/.test(r.reason), 'BLOCKED_SHAPE') }
  if(x.marketGames !== undefined) {
    ensure(Array.isArray(x.marketGames) && x.marketGames.length<=50,'MARKET_GAME_CAP')
    for(const g of x.marketGames) {
      keys(g,['game_pk','scheduled_at','home_team_name','away_team_name'])
      ensure(x.scope.includes(g.game_pk) && typeof g.scheduled_at==='string' && Number.isFinite(Date.parse(g.scheduled_at)),'MARKET_GAME_SCOPE')
      ensure(['home_team_name','away_team_name'].every(k=>typeof g[k]==='string' && g[k].length>0 && g[k].length<=100),'MARKET_TEAM_NAME')
    }
  }
  if(x.marketReference !== undefined) {
    const r=x.marketReference
    keys(r,['acquiredAt','evaluatedAt','responseDigest','oddsDigest','mappingsDigest','observationsDigest','mappingCount','observationCount','crosswalk'])
    ensure(['responseDigest','oddsDigest','mappingsDigest','observationsDigest'].every(k=>digest(r[k])) && ['acquiredAt','evaluatedAt'].every(k=>typeof r[k]==='string' && Number.isFinite(Date.parse(r[k]))),'MARKET_REFERENCE')
    ensure(integer(r.mappingCount) && r.mappingCount<=50 && integer(r.observationCount) && r.observationCount<=5000 && Array.isArray(r.crosswalk) && r.crosswalk.length<=50,'MARKET_REFERENCE_CAP')
    for(const c of r.crosswalk) {
      keys(c,['provider_event_id','classification','game_pk','candidate_game_pks'])
      ensure(id(c.provider_event_id) && ['MATCHED','UNMATCHED','AMBIGUOUS','OUT_OF_SCOPE'].includes(c.classification) && (c.game_pk===null || integer(c.game_pk)),'MARKET_CROSSWALK')
      if(c.candidate_game_pks!==undefined)ensure(Array.isArray(c.candidate_game_pks) && c.candidate_game_pks.length<=50 && c.candidate_game_pks.every(integer),'MARKET_CROSSWALK')
    }
  }
  if (x.result !== undefined) {
    keys(x.result, ['status','predictions','values','picks','inserted','reused','conflicts','readback'])
    ensure(id(x.result.status) && ['PASS','PENDING'].includes(x.result.readback), 'RESULT')
    for (const k of ['predictions','values','picks','inserted','reused','conflicts']) ensure(integer(x.result[k]), 'RESULT_COUNT')
    ensure(x.result.conflicts === 0, 'BLOCK_CONFLICT')
  }
  ensure(serializedBytes(x) <= 48000, 'CHECKPOINT_SIZE')
  return x
}

export function validateDml(x) {
  keys(x, ['stages']); ensure(Array.isArray(x.stages) && x.stages.length <= 100, 'DML_STAGES')
  const seen = new Set()
  for (const r of x.stages) {
    keys(r, ['stage','target','planned','cap','inserted','updated','reused','conflicts','readback','digest'])
    ensure(id(r.stage) && /^pick2_[a-z_]+$/.test(r.target) && digest(r.digest), 'DML_IDENTITY')
    const identity = `${r.stage}:${r.target}`; ensure(!seen.has(identity), 'DUPLICATE_DML'); seen.add(identity)
    for (const k of ['planned','cap','inserted','updated','reused','conflicts']) ensure(integer(r[k]), 'DML_COUNT')
    ensure(r.conflicts === 0 && r.planned <= r.cap && r.inserted + r.updated <= r.planned && r.reused <= r.planned && ['PENDING','PASS'].includes(r.readback), 'DML_CAP')
  }
  ensure(serializedBytes(x) <= 10000, 'DML_SIZE'); return x
}

// query(sql, parameters) returns rows. transaction(callback) must hold one real
// DB transaction/connection for its entire callback, including rollback on error.
export function createRuntimeStateAuthority({ transaction, writeRows = null, preflight = null, evidenceStorage = null }) {
  ensure(typeof transaction === 'function', 'TRANSACTION_ADAPTER')
  return async input => {
    keys(input, ['op','holder','fence','runId','packageSha','mode','revision','checkpoint','dml','provider','reservationId','status','write','kind','evidence','failure','expectedDigest','executorPackageSha','rawReadbackDigest','marketReadbackDigest'])
    ensure(['inspect','initialize','acquire','renew','release','checkpoint','reserve','complete','write','evidence','fail','dispose','disposeDependencyFailure','resumeDependency','resumeMarket','rebindMarketExecutor','resumeMarketCheckpoint'].includes(input.op), 'OPERATION')
    if (!['inspect','initialize'].includes(input.op)) ensure(typeof input.holder === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(input.holder), 'HOLDER')
    return transaction(async query => {
      if(preflight)await preflight(query)
      const one = async (sql,p=[]) => (await query(sql,p))[0]
      if (input.op === 'inspect') return { rows: await query(`SELECT * FROM ${TABLE} WHERE scope_key IN ($1,$2) OR (${PENDING}) ORDER BY scope_key LIMIT 102`, [MISSION,LEASE]) }
      if (input.op === 'initialize') {
        // Separate bounded initialization, never migration seed or reset.
        await query(`INSERT INTO ${TABLE}(scope_key,state_kind) VALUES ($1,'LEASE') ON CONFLICT(scope_key) DO NOTHING`, [LEASE])
        await one(`SELECT scope_key FROM ${TABLE} WHERE scope_key=$1 FOR UPDATE`, [LEASE])
        const previous = await one(`SELECT * FROM ${TABLE} WHERE scope_key=$1`, [MISSION])
        if (!previous) ensure((await query(`SELECT scope_key FROM ${TABLE} WHERE state_kind='RUN' LIMIT 1`)).length === 0, 'MISSING_MISSION_WITH_EXISTING_RUNS')
        await query(`INSERT INTO ${TABLE}(scope_key,state_kind,mission_odds_calls) VALUES ($1,'MISSION',2) ON CONFLICT(scope_key) DO NOTHING`, [MISSION])
        const m = await one(`SELECT * FROM ${TABLE} WHERE scope_key=$1 FOR UPDATE`, [MISSION])
        ensure(m.mission_odds_calls >= 2 && m.mission_odds_calls <= 20, 'MISSION_LEDGER')
        return { status:'INITIALIZED_OR_REUSED', missionOddsCalls:m.mission_odds_calls }
      }
      const lease = await one(`SELECT * FROM ${TABLE} WHERE scope_key=$1 FOR UPDATE`, [LEASE])
      ensure(lease, 'NOT_INITIALIZED')
      const clock = await one("WITH frozen AS MATERIALIZED (SELECT clock_timestamp() AS at) SELECT at, (at AT TIME ZONE 'America/Puerto_Rico')::date::text AS date FROM frozen")
      const active = lease.lease_holder && Date.parse(lease.lease_expires_at) > Date.parse(clock.at)
      if(['resumeMarket','rebindMarketExecutor','resumeMarketCheckpoint'].includes(input.op)) {
        ensure(!active && id(input.runId) && digest(input.expectedDigest) && digest(input.marketReadbackDigest) && /^[a-f0-9]{40}$/.test(input.executorPackageSha),'MARKET_RESUME_REVIEW_REQUIRED')
        const pending=await query(`SELECT * FROM ${TABLE} WHERE ${PENDING} ORDER BY created_at LIMIT 2`),run=pending[0]
        ensure(pending.length===1 && run.run_id===input.runId && run.package_sha===input.packageSha && reviewDigest(run)===input.expectedDigest,'MARKET_RESUME_STATE_CONFLICT')
        const cp=run.checkpoint,stages=run.dml_accounting.stages
        const rebind=input.op==='rebindMarketExecutor',partial=input.op==='resumeMarketCheckpoint'
        if(rebind) {
          // A readiness-certificate repair may require a new published SHA
          // before the resumed run executes even one operation. No active or
          // partially executed recovery can change its selected executor.
          const prior=cp.marketRecoveries?.[0]
          ensure(run.status==='RUNNING' && cp.marketRecoveries?.length===1 && Number(run.revision)===prior.fromRevision+1 && input.executorPackageSha!==prior.executorPackageSha && sha256(run.dml_accounting)===sha256(cp.failure?.dml) && run.mlb_official_calls===cp.failure?.providers.MLB_OFFICIAL && run.statcast_calls===cp.failure?.providers.STATCAST && run.odds_calls===cp.failure?.providers.THE_ODDS_API,'MARKET_REBIND_ALREADY_EXECUTED')
        } else if(partial)ensure(run.status==='FAILED' && cp.marketRecoveries?.length===2 && ['UNCLASSIFIED_STAGE_EXCEPTION','FAILURE_RECORD_HEADROOM'].includes(cp.failure?.code) && cp.marketRecoveries.every(r=>r.priorFailure?.code==='RUNTIME_SQLSTATE_42501_HTTP_409'),'MARKET_RESUME_STAGE')
        else ensure(run.status==='FAILED' && !cp.marketRecoveries,'MARKET_RESUME_STAGE')
        ensure(cp.stage==='MARKET_PERSISTENCE' && cp.failure?.stage==='MARKET_PERSISTENCE' && (partial || cp.failure.code==='RUNTIME_SQLSTATE_42501_HTTP_409') && cp.completed.includes('FEATURES') && !cp.completed.includes('MARKETS') && !cp.marketReference && !cp.disposition,'MARKET_RESUME_STAGE')
        validateDml({stages})
        ensure(stages.every(s=>s.readback==='PASS' && s.conflicts===0) && dateText(run.run_date)===clock.date,'MARKET_RESUME_RECEIPTS_DATE')
        ensure(run.odds_calls===1 && run.mlb_official_calls>=1 && run.mlb_official_calls<=50 && run.statcast_calls>=0 && run.statcast_calls<=100,'MARKET_RESUME_PROVIDER')
        const expected=Object.entries(PROVIDERS).flatMap(([provider,[column]])=>Array.from({length:run[column]},(_,i)=>sha256(`${run.run_id}:${provider}:${i+1}`))),reservations=run.dml_accounting.providerReservations??[]
        ensure(reservations.length===expected.length && new Set(reservations).size===reservations.length && expected.every(r=>reservations.includes(r)),'MARKET_RESUME_RESERVATIONS')
        const mission=await one(`SELECT mission_odds_calls FROM ${TABLE} WHERE scope_key=$1`,[MISSION])
        ensure(mission && mission.mission_odds_calls>=2 && mission.mission_odds_calls<=20,'MISSION_LEDGER')
        const recovered=await persistOrRecoverEvidence({run,kind:'odds',storage:evidenceStorage})
        ensure(recovered && sha256(recovered.reference)===sha256(cp.references.find(r=>r.kind==='odds_evidence')),'MARKET_RESUME_ODDS_DRIFT')
        const scope=cp.marketGames?.map(g=>g.game_pk)
        ensure(scope?.length>0 && new Set(scope).size===scope.length && scope.every(g=>cp.scope.includes(g)),'MARKET_RESUME_SCOPE')
        const games=await query('SELECT game_pk,scheduled_at,official_status FROM public.pick2_mlb_games WHERE game_pk=ANY($1::bigint[]) FOR SHARE',[scope])
        // This reviewed operation resumes only a wholly still-pregame market
        // plan. A partially started plan requires a separate bounded review.
        ensure(games.length===scope.length && games.every(g=>Date.parse(g.scheduled_at)>Date.parse(clock.at) && ['Scheduled','Pre-Game','Warmup'].includes(g.official_status) && Date.parse(g.scheduled_at)===Date.parse(cp.marketGames.find(m=>m.game_pk===Number(g.game_pk)).scheduled_at)),'MARKET_RESUME_STARTED_TARGET')
        const predictions=(await query('SELECT to_jsonb(t) AS row FROM public.pick2_game_predictions t WHERE game_pk=ANY($1::bigint[]) AND predicted_at=$2::timestamptz ORDER BY id',[scope,run.run_as_of])).map(r=>r.row)
        const mappings=(await query('SELECT to_jsonb(t) AS row FROM public.pick2_mlb_market_event_mappings t WHERE game_pk=ANY($1::bigint[]) ORDER BY id',[scope])).map(r=>r.row)
        const observations=(await query('SELECT to_jsonb(t) AS row FROM public.pick2_mlb_market_price_observations t WHERE game_pk=ANY($1::bigint[]) AND source_response_digest=$2 ORDER BY observation_identity',[scope,recovered.evidence.responseDigest])).map(r=>r.row)
        for(const [table,rows] of [['pick2_game_predictions',predictions],['pick2_mlb_market_event_mappings',mappings]]) {
          const receipt=stages.find(s=>s.target===table)
          ensure(rows.length===scope.length && new Set(rows.map(r=>Number(r.game_pk))).size===scope.length && receipt && receipt.inserted+receipt.reused===rows.length && receipt.updated===0,'MARKET_RESUME_UPSTREAM_READBACK')
        }
        ensure(predictions.every(p=>cp.references.some(r=>r.kind==='persisted_features' && Number(r.identity)===Number(p.game_pk) && r.identities.includes(p.feature_snapshot_id)) && Date.parse(p.created_at)<Date.parse(games.find(g=>Number(g.game_pk)===Number(p.game_pk)).scheduled_at)),'MARKET_RESUME_PREDICTION_LINKAGE')
        // The initial 42501 fails before any observation INSERT. Reject any
        // unexpected partial downstream state rather than approving it implicitly.
        const observationReceipt=stages.find(s=>s.target==='pick2_mlb_market_price_observations')
        if(partial)ensure(observations.length>0 && observations.length<=5000 && new Set(observations.map(r=>r.observation_identity)).size===observations.length && observationReceipt?.inserted===observations.length && observationReceipt.updated===0 && observationReceipt.cap===observations.length && observations.every(r=>scope.includes(Number(r.game_pk)) && r.source_response_digest===recovered.evidence.responseDigest && Date.parse(r.acquired_at)===Date.parse(recovered.evidence.acquiredAt) && mappings.some(m=>m.id===r.market_event_mapping_id && Number(m.game_pk)===Number(r.game_pk))),'MARKET_RESUME_OBSERVATION_READBACK')
        else ensure(observations.length===0 && !observationReceipt,'MARKET_RESUME_DOWNSTREAM_STATE')
        ensure(!stages.some(s=>['pick2_mlb_market_value_evaluations','pick2_mlb_official_picks'].includes(s.target)),'MARKET_RESUME_DOWNSTREAM_STATE')
        for(const table of ['pick2_mlb_market_value_evaluations','pick2_mlb_official_picks'])ensure((await query(`SELECT 1 FROM public.${table} WHERE prediction_id=ANY($1::uuid[]) LIMIT 1`,[predictions.map(p=>p.id)])).length===0,'MARKET_RESUME_DOWNSTREAM_STATE')
        const readback=marketReadbackDigest({predictions,mappings,observations,oddsReference:recovered.reference})
        ensure(readback===input.marketReadbackDigest,'MARKET_RESUME_READBACK_DRIFT')
        const recovery={reviewDigest:input.expectedDigest,reviewedAt:new Date(clock.at).toISOString(),fromRevision:Number(run.revision),readbackDigest:readback,priorFailure:cp.failure,executorPackageSha:input.executorPackageSha}
        const checkpoint={...cp,marketRecoveries:[...(cp.marketRecoveries??[]),recovery]};validateCheckpoint(checkpoint)
        const updated=await one(`UPDATE ${TABLE} SET status='RUNNING',checkpoint=$2::text::jsonb,revision=revision+1,updated_at=$3 WHERE scope_key=$1 RETURNING *`,[run.scope_key,JSON.stringify(checkpoint),clock.at])
        const next=await one(`UPDATE ${TABLE} SET lease_holder=$2,lease_acquired_at=$3,lease_expires_at=$3::timestamptz+interval '5 minutes',fence=fence+1,revision=revision+1,run_id=$4,package_sha=$5,updated_at=$3 WHERE scope_key=$1 RETURNING *`,[LEASE,input.holder,clock.at,run.run_id,run.package_sha])
        return {status:'ACQUIRED',run:updated,lease:next,missionOddsCalls:mission.mission_odds_calls,readback:{predictions:predictions.length,mappings:mappings.length,observations:observations.length,digest:readback}}
      }
      if(input.op==='resumeDependency') {
        ensure(!active && id(input.runId) && digest(input.expectedDigest) && digest(input.rawReadbackDigest) && /^[a-f0-9]{40}$/.test(input.executorPackageSha),'DEPENDENCY_RESUME_REVIEW_REQUIRED')
        const pending=await query(`SELECT * FROM ${TABLE} WHERE ${PENDING} ORDER BY created_at LIMIT 2`)
        const run=pending[0]
        ensure(pending.length===1 && run.run_id===input.runId && run.package_sha===input.packageSha && reviewDigest(run)===input.expectedDigest,'DEPENDENCY_RESUME_STATE_CONFLICT')
        const cp=run.checkpoint,stages=run.dml_accounting.stages
        ensure(run.status==='FAILED' && cp.stage==='DEPENDENCY_SCOPE' && cp.failure?.stage==='DEPENDENCY_SCOPE' && ['R2N_STATCAST_NETWORK_FAILURE','R2N_STATCAST_TIMEOUT'].includes(cp.failure.code) && cp.completed.includes('DEPENDENCY_SCOPE') && !cp.completed.includes('CONTEXTS') && !cp.disposition,'DEPENDENCY_RESUME_STAGE')
        ensure(stages.length===1 && stages[0].target==='pick2_raw_mlb_statcast_pitches' && stages[0].inserted>0 && stages[0].updated===0 && stages[0].readback==='PASS' && stages[0].conflicts===0 && stages[0].cap===cp.dependencyScope?.length*1000,'DEPENDENCY_RESUME_RECEIPT')
        validateDml({stages})
        ensure(dateText(run.run_date)===clock.date && cp.scope.length>0,'DEPENDENCY_RESUME_DATE')
        ensure(run.odds_calls===0 && run.mlb_official_calls===1 && run.statcast_calls>0 && run.statcast_calls<100,'DEPENDENCY_RESUME_PROVIDER')
        const reservations=run.dml_accounting.providerReservations??[],expected=[sha256(`${run.run_id}:MLB_OFFICIAL:1`),...Array.from({length:run.statcast_calls},(_,i)=>sha256(`${run.run_id}:STATCAST:${i+1}`))]
        ensure(reservations.length===expected.length && new Set(reservations).size===reservations.length && expected.every(r=>reservations.includes(r)),'DEPENDENCY_RESUME_RESERVATIONS')
        const mission=await one(`SELECT mission_odds_calls FROM ${TABLE} WHERE scope_key=$1`,[MISSION])
        ensure(mission && mission.mission_odds_calls>=2 && mission.mission_odds_calls<=20,'MISSION_LEDGER')
        ensure(cp.references.some(r=>r.kind==='schedule_evidence' && digest(r.digest)) && !cp.references.some(r=>r.kind==='odds_evidence'||r.kind==='persisted_features'),'DEPENDENCY_RESUME_EVIDENCE')
        // Fixed table allowlist. No caller SQL, table name, or time predicate.
        for(const table of ['pick2_feature_snapshots','pick2_mlb_team_daily_features','pick2_mlb_pitcher_daily_features','pick2_mlb_bullpen_daily_features','pick2_mlb_batter_daily_features','pick2_mlb_matchup_daily_features','pick2_mlb_first_inning_daily_features','pick2_game_predictions','pick2_mlb_market_event_mappings','pick2_mlb_market_price_observations','pick2_mlb_market_value_evaluations','pick2_mlb_official_picks']) {
          const found=await query(`SELECT 1 FROM public.${table} t WHERE COALESCE(to_jsonb(t)->>'target_game_pk',to_jsonb(t)->>'game_pk',to_jsonb(t)#>>'{metadata,source_game_pk}')=ANY($1::text[]) LIMIT 1`,[cp.scope.map(String)])
          ensure(found.length===0,'DEPENDENCY_RESUME_DOWNSTREAM_ROWS')
        }
        const games=await query('SELECT game_pk,scheduled_at,official_status FROM public.pick2_mlb_games WHERE game_pk=ANY($1::bigint[]) FOR SHARE',[cp.scope])
        ensure(games.length===cp.scope.length,'DEPENDENCY_RESUME_TARGETS')
        const rows=await query('SELECT id,game_pk,game_date::text,at_bat_number,pitch_number,raw_payload,raw_payload_digest,created_at FROM public.pick2_raw_mlb_statcast_pitches WHERE game_pk=ANY($1::bigint[]) ORDER BY id LIMIT $2 FOR SHARE',[cp.dependencyScope,cp.dependencyScope.length*1000+1])
        const readback=dependencyRawReadback(rows,run)
        ensure(readback.digest===input.rawReadbackDigest,'DEPENDENCY_RESUME_READBACK_DRIFT')
        const recovery={reviewDigest:input.expectedDigest,reviewedAt:new Date(clock.at).toISOString(),fromRevision:Number(run.revision),rawReadbackDigest:readback.digest,rawCount:readback.count,priorFailure:cp.failure,executorPackageSha:input.executorPackageSha}
        const checkpoint={...cp,dependencyRecoveries:[...(cp.dependencyRecoveries??[]),recovery]}
        validateCheckpoint(checkpoint)
        const updated=await one(`UPDATE ${TABLE} SET status='RUNNING',checkpoint=$2::text::jsonb,revision=revision+1,updated_at=$3 WHERE scope_key=$1 RETURNING *`,[run.scope_key,JSON.stringify(checkpoint),clock.at])
        const next=await one(`UPDATE ${TABLE} SET lease_holder=$2,lease_acquired_at=$3,lease_expires_at=$3::timestamptz+interval '5 minutes',fence=fence+1,revision=revision+1,run_id=$4,package_sha=$5,updated_at=$3 WHERE scope_key=$1 RETURNING *`,[LEASE,input.holder,clock.at,run.run_id,run.package_sha])
        return {status:'ACQUIRED',run:updated,lease:next,missionOddsCalls:mission.mission_odds_calls,readback}
      }
      if(input.op==='dispose'||input.op==='disposeDependencyFailure') {
        ensure(!active && id(input.runId) && digest(input.expectedDigest),'DISPOSITION_REVIEW_REQUIRED')
        const run=await one(`SELECT * FROM ${TABLE} WHERE scope_key=$1 FOR UPDATE`,[`RUN:${input.runId}`])
        ensure(run && ['RUNNING','FAILED'].includes(run.status) && reviewDigest(run)===input.expectedDigest,'DISPOSITION_STATE_CONFLICT')
        ensure(run.checkpoint.scope.length>0 && run.dml_accounting.stages.every(s=>s.readback==='PASS' && s.conflicts===0),'DISPOSITION_READBACK')
        const games=await query('SELECT game_pk,scheduled_at FROM public.pick2_mlb_games WHERE game_pk=ANY($1::bigint[]) FOR SHARE',[run.checkpoint.scope])
        const dependencyFailure=input.op==='disposeDependencyFailure'
        if(dependencyFailure) {
          ensure(run.status==='FAILED' && run.checkpoint.stage==='DEPENDENCY_SCOPE' && run.checkpoint.failure?.stage==='DEPENDENCY_SCOPE' && run.checkpoint.completed.includes('DEPENDENCY_SCOPE') && run.odds_calls===0 && run.dml_accounting.stages.length===0,'DEPENDENCY_DISPOSITION_NOT_SAFE')
          ensure(run.checkpoint.references.some(r=>r.kind==='schedule_evidence' && digest(r.digest)) && games.length===run.checkpoint.scope.length,'DEPENDENCY_DISPOSITION_EVIDENCE')
        } else ensure(games.length===run.checkpoint.scope.length && games.every(g=>Date.parse(g.scheduled_at)<=Date.parse(clock.at)),'DISPOSITION_NOT_EXPIRED')
        const predictions=await query('SELECT id FROM public.pick2_game_predictions WHERE game_pk=ANY($1::bigint[]) AND predicted_at=$2::timestamptz FOR SHARE',[run.checkpoint.scope,run.run_as_of])
        ensure(predictions.length===run.dml_accounting.stages.filter(s=>s.target==='pick2_game_predictions').reduce((n,s)=>n+s.inserted,0),'DISPOSITION_PREDICTION_READBACK')
        const checkpoint={...run.checkpoint,stage:'TERMINAL_PARTIAL_PRESERVED',disposition:{status:'TERMINAL_PARTIAL_PRESERVED',reviewedAt:new Date(clock.at).toISOString(),reviewDigest:input.expectedDigest,reason:dependencyFailure?'DEPENDENCY_FAILURE_NO_BUSINESS_WRITES':'EXPIRED_FREEZE_NO_RETROACTIVE_MARKETS',predictionCount:predictions.length,readback:'PASS'}}
        validateCheckpoint(checkpoint)
        return {status:'TERMINAL_PARTIAL_PRESERVED',run:await one(`UPDATE ${TABLE} SET checkpoint=$2::text::jsonb,status='FAILED',revision=revision+1,updated_at=$3 WHERE scope_key=$1 RETURNING *`,[run.scope_key,JSON.stringify(checkpoint),clock.at])}
      }
      if (input.op === 'acquire') {
        ensure(id(input.runId) && /^[a-f0-9]{40}$/.test(input.packageSha) && MODES.includes(input.mode), 'RUN_PACKAGE_MODE')
        if (active) return { status:'DEFER_ACTIVE_LEASE', expiresAt:lease.lease_expires_at }
        const mission = await one(`SELECT mission_odds_calls FROM ${TABLE} WHERE scope_key=$1`, [MISSION])
        ensure(mission && mission.mission_odds_calls >= 2 && mission.mission_odds_calls <= 20, 'MISSION_LEDGER')
        const pending = await query(`SELECT * FROM ${TABLE} WHERE ${PENDING} ORDER BY created_at LIMIT 2`)
        ensure(pending.length <= 1, 'AMBIGUOUS_PENDING_RUN')
        let run = pending[0] ?? await one(`SELECT * FROM ${TABLE} WHERE scope_key=$1`, [`RUN:${input.runId}`])
        if (run) {
          if(run.status==='FAILED' && run.checkpoint.disposition?.status==='TERMINAL_PARTIAL_PRESERVED')return {status:'TERMINAL_PARTIAL_PRESERVED',run,missionOddsCalls:mission.mission_odds_calls}
          ensure(run.package_sha === input.packageSha || (run.checkpoint.marketRecoveries??run.checkpoint.dependencyRecoveries)?.at(-1)?.executorPackageSha===input.packageSha, 'FROZEN_PACKAGE_CONFLICT')
          if (run.status === 'COMPLETE') return { status:'REUSE_NO_OP', run, missionOddsCalls:mission.mission_odds_calls }
          const date = run.run_date instanceof Date ? run.run_date.toISOString().slice(0,10) : String(run.run_date).slice(0,10)
          ensure(date === clock.date, 'STALE_PENDING_RUN_REQUIRES_REVIEW')
          ensure(run.status === 'RUNNING', 'BLOCKED_RUN_REQUIRES_REVIEW')
          ensure(run.checkpoint.mode === input.mode, 'PENDING_MODE_CONFLICT')
        } else {
          const checkpoint = validateCheckpoint({version:1,mode:input.mode,stage:'PENDING',scope:[],completed:[],references:[],blocked:[]})
          // Bind serialized JSON as text first: postgres.js otherwise applies its
          // JSONB serializer again, turning the object into a JSON string.
          run = await one(`INSERT INTO ${TABLE}(scope_key,state_kind,run_id,package_sha,run_date,run_as_of,status,checkpoint,dml_accounting) VALUES ($1,'RUN',$2,$3,$4,$5,'RUNNING',$6::text::jsonb,'{"stages":[]}') RETURNING *`, [`RUN:${input.runId}`,input.runId,input.packageSha,clock.date,clock.at,JSON.stringify(checkpoint)])
        }
        const next = await one(`UPDATE ${TABLE} SET lease_holder=$2,lease_acquired_at=$3,lease_expires_at=$3::timestamptz+interval '5 minutes',fence=fence+1,revision=revision+1,run_id=$4,package_sha=$5,updated_at=$3 WHERE scope_key=$1 RETURNING *`, [LEASE,input.holder,clock.at,run.run_id,run.package_sha])
        return {status:'ACQUIRED',lease:next,run,missionOddsCalls:mission.mission_odds_calls}
      }
      ensure((active || input.op==='fail') && lease.lease_holder === input.holder && Number(lease.fence) === input.fence && lease.run_id === input.runId, 'STALE_FENCE_OR_LEASE')
      const run = await one(`SELECT * FROM ${TABLE} WHERE scope_key=$1 FOR UPDATE`, [`RUN:${input.runId}`])
      ensure(run && run.package_sha === lease.package_sha, 'RUN_IDENTITY')
      if (input.op === 'renew') {
        ensure(run.status === 'RUNNING','TERMINAL_RUN')
        return {lease:await one(`UPDATE ${TABLE} SET lease_acquired_at=$2,lease_expires_at=$2::timestamptz+interval '5 minutes',revision=revision+1,updated_at=$2 WHERE scope_key=$1 RETURNING *`, [LEASE,clock.at])}
      }
      if (input.op === 'release') {
        await query(`UPDATE ${TABLE} SET lease_holder=NULL,lease_acquired_at=NULL,lease_expires_at=NULL,revision=revision+1,updated_at=$2 WHERE scope_key=$1`, [LEASE,clock.at])
        return {status:'RELEASED'}
      }
      ensure(run.status === 'RUNNING','TERMINAL_RUN')
      if(input.op==='fail') {
        keys(input.failure,['code','exceptionClass','message'])
        ensure(id(input.failure.code) && ['Error','TypeError','RangeError','SyntaxError','AbortError','TimeoutError'].includes(input.failure.exceptionClass),'FAILURE_SHAPE')
        ensure(input.failure.message===`Stage stopped: ${input.failure.code}.` || (input.failure.code==='UNCLASSIFIED_STAGE_EXCEPTION' && input.failure.message==='Stage failed; untrusted exception text withheld.'),'FAILURE_MESSAGE')
        ensure(sha256(sanitizedStageException({name:input.failure.exceptionClass,message:`R6_STATE:${input.failure.code}`}))===sha256(input.failure),'FAILURE_SANITIZATION')
        const failure={...input.failure,runId:run.run_id,stage:run.checkpoint.stage,timestamp:new Date(clock.at).toISOString(),checkpointRevision:Number(run.revision),leaseHolder:lease.lease_holder,providers:{MLB_OFFICIAL:run.mlb_official_calls,STATCAST:run.statcast_calls,THE_ODDS_API:run.odds_calls},dml:run.dml_accounting}
        const checkpoint={...run.checkpoint,failure}
        validateCheckpoint(checkpoint)
        return {status:'FAILED',run:await one(`UPDATE ${TABLE} SET checkpoint=$2::text::jsonb,status='FAILED',revision=revision+1,updated_at=$3 WHERE scope_key=$1 RETURNING *`,[run.scope_key,JSON.stringify(checkpoint),clock.at])}
      }
      if(input.op==='evidence') {
        const recovered=await persistOrRecoverEvidence({run,kind:input.kind,evidence:input.evidence,storage:evidenceStorage})
        if(!recovered)return {run,evidence:null}
        const prior=run.checkpoint.references.find(r=>r.kind===recovered.reference.kind)
        if(prior){ensure(sha256(prior)===sha256(recovered.reference),'EVIDENCE_REFERENCE_CONFLICT');return {run,evidence:recovered.evidence}}
        const checkpoint={...run.checkpoint,references:[...run.checkpoint.references,recovered.reference]}
        validateCheckpoint(checkpoint)
        return {run:await one(`UPDATE ${TABLE} SET checkpoint=$2::text::jsonb,revision=revision+1,updated_at=$3 WHERE scope_key=$1 RETURNING *`,[run.scope_key,JSON.stringify(checkpoint),clock.at]),evidence:recovered.evidence}
      }
      if(input.op==='write') {
        ensure(typeof writeRows==='function','FENCED_WRITE_NOT_CONFIGURED')
        ensure(integer(input.revision) && Number(run.revision)===input.revision,'REVISION_CONFLICT')
        const outcome=await writeRows({query,run,write:input.write,clock})
        validateDml({stages:outcome.dml.stages})
        ensure(serializedBytes(outcome.dml)<=15000,'ACCOUNTING_SIZE')
        const updated=await one(`UPDATE ${TABLE} SET dml_accounting=$2::text::jsonb,revision=revision+1,updated_at=$3 WHERE scope_key=$1 RETURNING *`,[run.scope_key,JSON.stringify(outcome.dml),clock.at])
        return {status:'WRITE_READBACK_COMPLETE',result:outcome.result,run:updated}
      }
      if (input.op === 'reserve') {
        ensure(Object.hasOwn(PROVIDERS,input.provider) && digest(input.reservationId),'PROVIDER_NOT_AUTHORIZED')
        if(evidenceStorage && ['THE_ODDS_API','MLB_OFFICIAL'].includes(input.provider))await evidenceStorage.preflight()
        const [column,cap] = PROVIDERS[input.provider], receipts = run.dml_accounting.providerReservations ?? []
        ensure(!receipts.includes(input.reservationId),'RESERVATION_ALREADY_CONSUMED')
        ensure(Number(run[column]) < cap,'PROVIDER_CAP')
        const mission = await one(`SELECT * FROM ${TABLE} WHERE scope_key=$1 FOR UPDATE`,[MISSION])
        ensure(mission && mission.mission_odds_calls >= 2,'MISSION_LEDGER')
        if (input.provider === 'THE_ODDS_API') {
          ensure(mission.mission_odds_calls < 20,'MISSION_ODDS_CAP')
          await query(`UPDATE ${TABLE} SET mission_odds_calls=mission_odds_calls+1,revision=revision+1,updated_at=$2 WHERE scope_key=$1`,[MISSION,clock.at])
        }
        const dml = {...run.dml_accounting,providerReservations:[...receipts,input.reservationId]}
        ensure(serializedBytes(dml) <= 15000,'ACCOUNTING_SIZE')
        const updated = await one(`UPDATE ${TABLE} SET ${column}=${column}+1,dml_accounting=$2::text::jsonb,revision=revision+1,updated_at=$3 WHERE scope_key=$1 RETURNING *`,[run.scope_key,JSON.stringify(dml),clock.at])
        return {status:'RESERVED',run:updated,missionOddsCalls:mission.mission_odds_calls+(input.provider === 'THE_ODDS_API'?1:0)}
      }
      ensure(integer(input.revision) && Number(run.revision) === input.revision,'REVISION_CONFLICT')
      validateCheckpoint(input.checkpoint); validateDml(input.dml)
      // Failure replaces the current failure member; it does not append it.
      // Reserve the full 15000-byte accounting ceiling plus bounded exception
      // metadata, retaining the existing 48000-byte checkpoint ceiling.
      ensure(serializedBytes({...input.checkpoint,failure:null})+16500<=48000,'FAILURE_RECORD_HEADROOM')
      ensure(sha256(input.checkpoint.failure??null)===sha256(run.checkpoint.failure??null) && sha256(input.checkpoint.disposition??null)===sha256(run.checkpoint.disposition??null),'REVIEW_METADATA_IMMUTABLE')
      ensure(sha256(input.checkpoint.dependencyRecoveries??null)===sha256(run.checkpoint.dependencyRecoveries??null),'REVIEW_METADATA_IMMUTABLE')
      ensure(sha256(input.checkpoint.marketRecoveries??null)===sha256(run.checkpoint.marketRecoveries??null),'REVIEW_METADATA_IMMUTABLE')
      ensure(input.checkpoint.mode === run.checkpoint.mode,'MODE_DRIFT')
      ensure(run.checkpoint.completed.every(s => input.checkpoint.completed.includes(s)),'CHECKPOINT_REGRESSION')
      for (const reference of run.checkpoint.references) ensure(input.checkpoint.references.some(r => canonical(r) === canonical(reference)), 'REFERENCE_DRIFT')
      for (const prior of run.dml_accounting.stages ?? []) {
        const next = input.dml.stages.find(r => r.stage === prior.stage && r.target === prior.target)
        ensure(next && next.digest === prior.digest && next.cap === prior.cap && next.planned === prior.planned, 'DML_PLAN_DRIFT')
        for (const k of ['inserted','updated','reused']) ensure(next[k] >= prior[k], 'DML_REGRESSION')
        if (prior.readback === 'PASS') ensure(canonical(next) === canonical(prior), 'DML_READBACK_DRIFT')
      }
      if (run.checkpoint.scope.length) ensure(JSON.stringify(run.checkpoint.scope) === JSON.stringify(input.checkpoint.scope),'SCOPE_DRIFT')
      if (run.checkpoint.dependencyScope?.length) ensure(JSON.stringify(run.checkpoint.dependencyScope) === JSON.stringify(input.checkpoint.dependencyScope),'DEPENDENCY_SCOPE_DRIFT')
      const dml = {...input.dml,providerReservations:run.dml_accounting.providerReservations ?? []}
      ensure(serializedBytes(dml) <= 15000,'ACCOUNTING_SIZE')
      const status = input.op === 'complete' ? input.status : 'RUNNING'
      ensure(['RUNNING','COMPLETE','BLOCKED','FAILED'].includes(status),'STATUS')
      if (status === 'COMPLETE') ensure(input.checkpoint.result?.readback === 'PASS' && input.dml.stages.every(s => s.readback === 'PASS'),'READBACK_REQUIRED')
      return {status,run:await one(`UPDATE ${TABLE} SET checkpoint=$2::text::jsonb,dml_accounting=$3::text::jsonb,status=$4,revision=revision+1,updated_at=$5 WHERE scope_key=$1 RETURNING *`,[run.scope_key,JSON.stringify(input.checkpoint),JSON.stringify(dml),status,clock.at])}
    })
  }
}
