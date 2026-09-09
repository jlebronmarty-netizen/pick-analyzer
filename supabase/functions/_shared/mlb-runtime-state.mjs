// Fixed transactional operations for the exact authorized R6 table. No SQL,
// target, clock, cap, or counter reset can be supplied by the caller.
const TABLE = 'public.pick2_mlb_runtime_state'
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
  keys(x, ['version','mode','stage','scope','completed','references','blocked','result'])
  ensure(x.version === 1 && MODES.includes(x.mode) && id(x.stage), 'CHECKPOINT_HEADER')
  ensure(Array.isArray(x.scope) && x.scope.length <= 50 && x.scope.every(n => integer(n) && n > 0) && new Set(x.scope).size === x.scope.length, 'SCOPE')
  ensure(Array.isArray(x.completed) && x.completed.length <= 500 && x.completed.every(id) && new Set(x.completed).size === x.completed.length, 'COMPLETED')
  ensure(Array.isArray(x.references) && x.references.length <= 500, 'REFERENCES')
  for (const r of x.references) {
    keys(r, ['kind','identity','digest','count','asOf'])
    ensure(id(r.kind) && id(r.identity) && digest(r.digest) && integer(r.count) && typeof r.asOf === 'string' && Number.isFinite(Date.parse(r.asOf)), 'REFERENCE_SHAPE')
  }
  ensure(Array.isArray(x.blocked) && x.blocked.length <= 50, 'BLOCKED')
  for (const r of x.blocked) { keys(r, ['gamePk','reason']); ensure(integer(r.gamePk) && r.gamePk > 0 && id(r.reason), 'BLOCKED_SHAPE') }
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
export function createRuntimeStateAuthority({ transaction }) {
  ensure(typeof transaction === 'function', 'TRANSACTION_ADAPTER')
  return async input => {
    keys(input, ['op','holder','fence','runId','packageSha','mode','revision','checkpoint','dml','provider','reservationId','status'])
    ensure(['inspect','initialize','acquire','renew','release','checkpoint','reserve','complete'].includes(input.op), 'OPERATION')
    if (!['inspect','initialize'].includes(input.op)) ensure(typeof input.holder === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(input.holder), 'HOLDER')
    return transaction(async query => {
      const one = async (sql,p=[]) => (await query(sql,p))[0]
      if (input.op === 'inspect') return { rows: await query(`SELECT * FROM ${TABLE} WHERE scope_key IN ($1,$2) OR (state_kind='RUN' AND status <> 'COMPLETE') ORDER BY scope_key LIMIT 102`, [MISSION,LEASE]) }
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
      const clock = await one("SELECT clock_timestamp() AS at, (clock_timestamp() AT TIME ZONE 'America/Puerto_Rico')::date::text AS date")
      const active = lease.lease_holder && Date.parse(lease.lease_expires_at) > Date.parse(clock.at)
      if (input.op === 'acquire') {
        ensure(id(input.runId) && /^[a-f0-9]{40}$/.test(input.packageSha) && MODES.includes(input.mode), 'RUN_PACKAGE_MODE')
        if (active) return { status:'DEFER_ACTIVE_LEASE', expiresAt:lease.lease_expires_at }
        const pending = await query(`SELECT * FROM ${TABLE} WHERE state_kind='RUN' AND status <> 'COMPLETE' ORDER BY created_at LIMIT 2`)
        ensure(pending.length <= 1, 'AMBIGUOUS_PENDING_RUN')
        let run = pending[0] ?? await one(`SELECT * FROM ${TABLE} WHERE scope_key=$1`, [`RUN:${input.runId}`])
        if (run) {
          ensure(run.package_sha === input.packageSha, 'FROZEN_PACKAGE_CONFLICT')
          if (run.status === 'COMPLETE') return { status:'REUSE_NO_OP', run }
          const date = run.run_date instanceof Date ? run.run_date.toISOString().slice(0,10) : String(run.run_date).slice(0,10)
          ensure(date === clock.date, 'STALE_PENDING_RUN_REQUIRES_REVIEW')
          ensure(run.status === 'RUNNING', 'BLOCKED_RUN_REQUIRES_REVIEW')
          ensure(run.checkpoint.mode === input.mode, 'PENDING_MODE_CONFLICT')
        } else {
          const checkpoint = validateCheckpoint({version:1,mode:input.mode,stage:'PENDING',scope:[],completed:[],references:[],blocked:[]})
          run = await one(`INSERT INTO ${TABLE}(scope_key,state_kind,run_id,package_sha,run_date,run_as_of,status,checkpoint,dml_accounting) VALUES ($1,'RUN',$2,$3,$4,$5,'RUNNING',$6::jsonb,'{"stages":[]}') RETURNING *`, [`RUN:${input.runId}`,input.runId,input.packageSha,clock.date,clock.at,JSON.stringify(checkpoint)])
        }
        const next = await one(`UPDATE ${TABLE} SET lease_holder=$2,lease_acquired_at=$3,lease_expires_at=$3::timestamptz+interval '5 minutes',fence=fence+1,revision=revision+1,run_id=$4,package_sha=$5,updated_at=$3 WHERE scope_key=$1 RETURNING *`, [LEASE,input.holder,clock.at,run.run_id,run.package_sha])
        return {status:'ACQUIRED',lease:next,run}
      }
      ensure(active && lease.lease_holder === input.holder && Number(lease.fence) === input.fence && lease.run_id === input.runId, 'STALE_FENCE_OR_LEASE')
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
      if (input.op === 'reserve') {
        ensure(Object.hasOwn(PROVIDERS,input.provider) && digest(input.reservationId),'PROVIDER_NOT_AUTHORIZED')
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
        const updated = await one(`UPDATE ${TABLE} SET ${column}=${column}+1,dml_accounting=$2::jsonb,revision=revision+1,updated_at=$3 WHERE scope_key=$1 RETURNING *`,[run.scope_key,JSON.stringify(dml),clock.at])
        return {status:'RESERVED',run:updated,missionOddsCalls:mission.mission_odds_calls+(input.provider === 'THE_ODDS_API'?1:0)}
      }
      ensure(integer(input.revision) && Number(run.revision) === input.revision,'REVISION_CONFLICT')
      validateCheckpoint(input.checkpoint); validateDml(input.dml)
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
      const dml = {...input.dml,providerReservations:run.dml_accounting.providerReservations ?? []}
      ensure(serializedBytes(dml) <= 15000,'ACCOUNTING_SIZE')
      const status = input.op === 'complete' ? input.status : 'RUNNING'
      ensure(['RUNNING','COMPLETE','BLOCKED','FAILED'].includes(status),'STATUS')
      if (status === 'COMPLETE') ensure(input.checkpoint.result?.readback === 'PASS' && input.dml.stages.every(s => s.readback === 'PASS'),'READBACK_REQUIRED')
      return {status,run:await one(`UPDATE ${TABLE} SET checkpoint=$2::jsonb,dml_accounting=$3::jsonb,status=$4,revision=revision+1,updated_at=$5 WHERE scope_key=$1 RETURNING *`,[run.scope_key,JSON.stringify(input.checkpoint),JSON.stringify(dml),status,clock.at])}
    })
  }
}
