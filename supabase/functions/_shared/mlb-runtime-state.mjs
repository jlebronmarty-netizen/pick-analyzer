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
const keys = (x, allowed) => ensure(x && typeof x === 'object' && !Array.isArray(x) && Object.keys(x).every(k => allowed.includes(k)), 'METADATA_FIELDS')
export const serializedBytes = x => new TextEncoder().encode(JSON.stringify(x)).length
const canonical = x => JSON.stringify(x, Object.keys(x).sort())
export const MODES = ['INITIALIZE','PREGAME','STARTER_CHANGE','ODDS_FRESHNESS','INCREMENTAL','POSTGAME','OVERNIGHT','HOST_DRY']

export function validateCheckpoint(x) {
  keys(x, ['version','mode','stage','scope','dependencyScope','completed','references','blocked','result','marketGames','marketReference','failure','disposition'])
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
    keys(input, ['op','holder','fence','runId','packageSha','mode','revision','checkpoint','dml','provider','reservationId','status','write','kind','evidence','failure','expectedDigest'])
    ensure(['inspect','initialize','acquire','renew','release','checkpoint','reserve','complete','write','evidence','fail','dispose','disposeDependencyFailure'].includes(input.op), 'OPERATION')
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
          ensure(run.package_sha === input.packageSha, 'FROZEN_PACKAGE_CONFLICT')
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
      ensure(serializedBytes(input.checkpoint)<=28000,'FAILURE_RECORD_HEADROOM')
      ensure(sha256(input.checkpoint.failure??null)===sha256(run.checkpoint.failure??null) && sha256(input.checkpoint.disposition??null)===sha256(run.checkpoint.disposition??null),'REVIEW_METADATA_IMMUTABLE')
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
