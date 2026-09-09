import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { createPrivateRunStore } from './mlb-data-02r-r2t-private-run-store.mjs'
import { runManualRefresh } from './mlb-operational-manual-refresh.mjs'
import { createStatcastLiveClient, createProviderLedger } from './mlb-data-02r-r2i-live-execution-interfaces.mjs'
import { classifyInsertReuseConflict } from './mlb-data-02r-r2f-stage-contracts.mjs'

export const AUTOMATION_MODES = ['INITIALIZE', 'PREGAME', 'STARTER_CHANGE', 'ODDS_FRESHNESS', 'INCREMENTAL', 'POSTGAME', 'OVERNIGHT']
const ensure = (ok, why) => { if (!ok) throw new Error(`AUTOMATION_BLOCK:${why}`) }
const hash = x => createHash('sha256').update(JSON.stringify(x)).digest('hex')
export function automationIdentity({ date, mode, at }) {
  ensure(AUTOMATION_MODES.includes(mode) && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(at)), 'IDENTITY')
  return hash({ date, mode, slot: Math.floor(Date.parse(at) / (15 * 60_000)) })
}
export function assertAutomationActivation(certificate) {
  ensure(certificate?.activation === 'ENABLED' && certificate.firstNonemptyRun?.status === 'CANONICAL_STAGES_READBACK_COMPLETE' && certificate.firstNonemptyRun.eligibleGames > 0, 'NONEMPTY_LIVE_REQUIRED')
  ensure(certificate.repeatability?.verdict === 'MLB_DATA_02R_REPEATABILITY_CERTIFIED' && certificate.repeatability.firstRunId === certificate.firstNonemptyRun.runId && certificate.repeatability.secondRunId !== certificate.firstNonemptyRun.runId && certificate.repeatability.secondRunId && certificate.repeatability.conflicts === 0, 'REAL_REPEATABILITY_REQUIRED')
  ensure(certificate.hostCount === 1 && certificate.dryCertification === 'PASS', 'SINGLE_COORDINATOR_AND_DRY_CERTIFICATION')
}
export async function runAutomationJob({ root, job, execute, certification = false, onState = null }) {
  ensure(!certification || process.env.R2S_VALIDATION_DIR, 'ISOLATED_CERTIFICATION')
  if (!certification) assertAutomationActivation(JSON.parse(fs.readFileSync('docs/CERTIFICATION/MLB_OPERATIONAL_AUTOMATION_ACTIVATION.json', 'utf8')))
  const key = `job-${automationIdentity(job)}`
  const store = createPrivateRunStore(root)
  store.acquire()
  try {
    const unfinished = fs.readdirSync(store.root).filter(n => /^job-[a-f0-9]{64}\.json$/.test(n)).map(n => ({ key: n.slice(0, -5), state: store.load(n.slice(0, -5)) })).filter(r => r.state.status !== 'COMPLETE')
    ensure(unfinished.every(r => r.key === key), 'UNFINISHED_JOB_MUST_RESUME')
    let state = store.load(key)
    ensure(!state || state.packageSha === job.packageSha, 'CHECKPOINT_PACKAGE_DRIFT')
    if (state?.status === 'COMPLETE') return { ...state, disposition: 'REUSE_NO_OP' }
    state ??= { job, packageSha: job.packageSha, status: 'PENDING', attempts: 0, checkpoints: [], providerAccounting: {}, dmlAccounting: [] }
    ensure(state.attempts < 3, 'BOUNDED_RETRIES_EXHAUSTED')
    state.attempts++; state.status = 'RUNNING'; store.save(key, state)
    const publish = async () => { const observed = await onState?.(state); if (observed) { state.dmlAccounting.push({ table: 'sports_sync_jobs', ...observed }); store.save(key, state) } }
    await publish()
    const checkpoint = (stage, data) => { state.checkpoints.push({ stage, data }); store.save(key, state) }
    try { const result = await execute({ job: state.job, state, checkpoint, store }); state = { ...state, status: 'COMPLETE', result }; store.save(key, state); await publish(); return state }
    catch (error) { state.status = 'FAILED'; state.error = String(error.message).replace(/https?:\/\/\S+/g, '[URL]').slice(0, 300); store.save(key, state); await publish(); throw error }
  } finally { store.release() }
}

// The existing launcher owns the actual run freeze and all R2 stages. Persist
// its run identity even after failure, allowing the next tick to resume it.
export async function executeDailyJob({ job, state, checkpoint, liveRoot, manual = runManualRefresh }) {
  ensure(manual === runManualRefresh || process.env.R2S_VALIDATION_DIR, 'INJECTED_DAILY_EXECUTOR_FORBIDDEN')
  ensure(['INITIALIZE', 'PREGAME', 'STARTER_CHANGE', 'ODDS_FRESHNESS'].includes(job.mode), 'DAILY_MODE')
  const names = () => fs.readdirSync(liveRoot).filter(n => n.startsWith('run-'))
  let intent = state.checkpoints.find(c => c.stage === 'R2_INTENT')?.data
  if (!intent) { intent = { existingRuns: names() }; checkpoint('R2_INTENT', intent) }
  const candidates = names().filter(n => !intent.existingRuns.includes(n)).map(n => JSON.parse(fs.readFileSync(path.join(liveRoot, n), 'utf8')))
  ensure(candidates.length <= 1 && candidates.every(r => r.execution_package_sha === job.packageSha && r.run_date === job.date), 'AMBIGUOUS_RUN_RECOVERY')
  const prior = candidates[0]
  if (prior && fs.existsSync(path.join(liveRoot, `result-${prior.run_id}.json`))) return JSON.parse(fs.readFileSync(path.join(liveRoot, `result-${prior.run_id}.json`), 'utf8'))
  const result = await manual({ packageSha: job.packageSha, resumeRunId: prior?.run_id ?? null })
  checkpoint('R2_RUN', { runId: result.runId, status: result.status }); return result
}

export async function reconcileAutomatedPitches({ job, state, checkpoint, store, repository, client, teamMap, fetchImpl }) {
  ensure(['PREGAME', 'INCREMENTAL', 'POSTGAME', 'OVERNIGHT'].includes(job.mode), 'PITCH_MODE')
  ensure(store.locked && repository.writeJournal && job.gamePks.length > 0 && job.gamePks.length <= 50 && job.dates.length > 0 && job.dates.length <= 14, 'FROZEN_SCOPE')
  ensure(new Set(job.gamePks).size === job.gamePks.length && job.gamePks.every(n => Number.isInteger(n) && n > 0), 'GAME_IDENTITY')
  ensure(job.dates.every(d => /^2026-\d{2}-\d{2}$/.test(d) && d <= job.date), 'DATE_SCOPE')
  ensure(job.mode !== 'PREGAME' || job.gamePks.every(pk => !job.targetGamePks.includes(pk)), 'PREGAME_TARGET_LEAKAGE')
  ensure(!fetchImpl || process.env.R2S_VALIDATION_DIR, 'INJECTED_TRANSPORT_FORBIDDEN')
  const ledger = createProviderLedger({ MLB_OFFICIAL: { allowed: true, maxCalls: 50 }, STATCAST: { allowed: true, maxCalls: Math.min(100, job.dates.length) } }, { initial: state.providerAccounting, onConsume: e => { state.providerAccounting[e.provider] = e.consumed; checkpoint('PROVIDER', { ...state.providerAccounting }) } })
  const statcast = createStatcastLiveClient({ ledger, db: client, cacheDir: path.join(store.root, `csv-${automationIdentity(job)}`), ...(fetchImpl ? { fetchImpl } : {}) })
  let rows = state.checkpoints.find(c => c.stage === 'RAW_PLAN')?.data?.rows
  if (!rows) {
    rows = await statcast.fetchRowsForGames({ eligibleGamePks: job.gamePks, dependencyDates: job.dates, runAsOf: job.at, teamMap, providerBudget: { STATCAST: { maxCalls: job.dates.length } }, cachePolicy: job.mode === 'PREGAME' ? { strategy: 'CANONICAL_PERSISTED_THEN_LOCAL_CSV' } : { strategy: 'RECONCILE_FROZEN_SCOPE', reconciliationMode: job.mode } })
    checkpoint('RAW_PLAN', { rows })
  }
  ensure(rows.length <= job.gamePks.length * 1000 && rows.every(r => job.gamePks.includes(r.game_pk) && job.dates.includes(r.game_date)), 'RAW_CAP_SCOPE')
  const ids = rows.map(r => r.id), cap = rows.length
  const old = await repository.readRawRows(ids)
  const plan = classifyInsertReuseConflict({ plannedRows: rows, existingRows: old, identityFields: ['id'], digestField: 'raw_payload_digest', eligibleGamePks: job.gamePks, cap })
  ensure(plan.blockConflict === 0, 'BLOCK_CONFLICT')
  const insertIds = new Set(plan.classifications.filter(c => c.classification === 'INSERT_ELIGIBLE').map(c => c.identity))
  const inserts = rows.filter(r => insertIds.has(r.id))
  for (let i = 0; i < inserts.length; i += 100) { const batch = inserts.slice(i, i + 100); await repository.insertRawRows(batch, batch.length); checkpoint('RAW_BATCH', { count: batch.length }) }
  const readback = await repository.readRawRows(ids)
  const repeat = classifyInsertReuseConflict({ plannedRows: rows, existingRows: readback, identityFields: ['id'], digestField: 'raw_payload_digest', eligibleGamePks: job.gamePks, cap: 0 })
  ensure(repeat.reuseNoOp === rows.length && repeat.blockConflict === 0, 'RAW_READBACK_IDEMPOTENCY')
  return { rows: rows.length, cap, inserted: inserts.length, reused: rows.length - inserts.length, conflicts: 0, providers: ledger.snapshot(), idempotency: 'PASS', target: 'public.pick2_raw_mlb_statcast_pitches' }
}
