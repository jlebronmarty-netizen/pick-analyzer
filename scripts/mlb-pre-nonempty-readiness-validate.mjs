// Isolated behavioral tests. All input games and pitches below are test-only.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createPrivateRunStore } from './mlb-data-02r-r2t-private-run-store.mjs'
import { runAutomationJob, automationIdentity, assertAutomationActivation, reconcileAutomatedPitches, executeDailyJob } from './mlb-operational-automation.mjs'
import { createPgliteClient } from './mlb-data-02r-r2t-pglite-client.mjs'
import { persistMlbSettlementPlan } from '../src/services/pick2-mlb-settlement-persistence.service.ts'
import { buildPick2MlbValueBoardRows } from '../src/services/pick2-mlb-value-board.service.ts'
import { persistOperationalTelemetry } from '../src/services/pick2-operational-telemetry.ts'
import { normalizedFileDigest } from './mlb-data-02r-r2t-r3-readiness.mjs'
import { planMlbSettlement, persistMlbSettlements, summarizeMlbPerformance, digestSettlementEvidence } from '../src/services/pick2-mlb-settlement.ts'
import { projectMlbOperations, MLB_CHAMPION, MLB_POLICY } from '../src/services/pick2-operational-projection.ts'
const root = process.env.R2S_VALIDATION_DIR
assert.ok(root && path.isAbsolute(root))
globalThis.fetch = () => { throw new Error('NETWORK_FORBIDDEN_IN_CERTIFICATION') }
const checks = []
const testedSourceHashes = Object.fromEntries(['scripts/mlb-operational-automation.mjs', 'scripts/mlb-data-02h-2026-current-foundation.mjs', 'src/services/pick2-mlb-settlement.ts', 'src/services/pick2-mlb-settlement-persistence.service.ts', 'src/services/pick2-operational-projection.ts', 'src/services/pick2-operational-telemetry.ts', 'src/services/pick2-mlb-value-board.service.ts'].map(file => [file, normalizedFileDigest(file)]))
async function check(name, fn) { await fn(); checks.push({ name, status: 'PASS' }) }
const at = '2026-09-09T16:00:00.000Z'
const job = { date: '2026-09-09', at, mode: 'PREGAME', packageSha: 'a'.repeat(40) }
await check('automation activation rejects empty slate, missing repeatability and disabled state', () => {
  assert.throws(() => assertAutomationActivation({ activation: 'DISABLED' }), /NONEMPTY/)
  assert.throws(() => assertAutomationActivation({ activation: 'ENABLED', firstNonemptyRun: { status: 'CANONICAL_STAGES_READBACK_COMPLETE', eligibleGames: 1, runId: 'first' } }), /REPEATABILITY/)
})
await check('job identity is stable within slot, distinct across modes and slots', () => {
  assert.equal(automationIdentity(job), automationIdentity({ ...job, at: '2026-09-09T16:01:00Z' }))
  assert.notEqual(automationIdentity(job), automationIdentity({ ...job, mode: 'INCREMENTAL' }))
  assert.notEqual(automationIdentity(job), automationIdentity({ ...job, at: '2026-09-09T16:15:00Z' }))
})
const jobRoot = path.join(root, `automation-${Date.now()}`)
let executions = 0
await check('failed stage checkpoints survive retry; completed slot never executes twice', async () => {
  const args = { root: jobRoot, job, certification: true, execute: async ({ state, checkpoint }) => { executions++; if (!state.checkpoints.length) { checkpoint('DONE_STAGE_ONE', { rows: 1 }); throw new Error('injected interruption') } return { resumed: true } } }
  await assert.rejects(runAutomationJob(args), /interruption/)
  assert.equal((await runAutomationJob(args)).result.resumed, true)
  assert.equal((await runAutomationJob(args)).disposition, 'REUSE_NO_OP')
  assert.equal(executions, 2)
})
await check('cross-mode overlap blocked by exclusive coordinator lock', async () => {
  const store = createPrivateRunStore(jobRoot); store.acquire()
  try { await assert.rejects(runAutomationJob({ root: jobRoot, job: { ...job, mode: 'INCREMENTAL' }, certification: true, execute: () => { throw Error('must not run') } }), /EEXIST/) } finally { store.release() }
})
await check('checkpoint package change blocks before stage execution', async () => { await assert.rejects(runAutomationJob({ root: jobRoot, job: { ...job, packageSha: 'b'.repeat(40) }, certification: true, execute: () => { throw Error('must not run') } }), /PACKAGE_DRIFT/) })

const raw = new Map()
const client = { from(table) { assert.equal(table, 'pick2_raw_mlb_statcast_pitches'); const q = { select() { return q }, eq() { return q }, limit() { return q }, in() { return q }, order() { return q }, range() { return q }, then(resolve, reject) { return Promise.resolve({ data: [...raw.values()], count:raw.size,error: null }).then(resolve, reject) } }; return q } }
const repository = { writeJournal: {}, readRawRows: async ids => ids.map(id => raw.get(id)).filter(Boolean), insertRawRows: async rows => { rows.forEach(r => { assert.ok(!raw.has(r.id)); raw.set(r.id, r) }); return { inserted: rows.length } } }
const csv = n => 'game_pk,game_date,game_year,game_type,home_team,away_team,pitcher,batter,at_bat_number,pitch_number\n' + Array.from({ length: n }, (_, i) => `900000001,2026-09-09,2026,R,HME,AWY,660001,770001,1,${i + 1}`).join('\n')
let requests = 0
await check('shared engine incremental ingest expands partial canonical game; checkpoint retry has zero calls/writes', async () => {
  for (const [index, mode] of ['INCREMENTAL', 'POSTGAME', 'OVERNIGHT'].entries()) {
    const rawJob = { ...job, mode, gamePks: [900000001], targetGamePks: [], dates: ['2026-09-09'] }
    const store = createPrivateRunStore(path.join(root, `raw-${mode}-${Date.now()}`)); store.acquire()
    try {
      const state = { checkpoints: [], providerAccounting: {} }
      const args = { job: rawJob, state, store, checkpoint: (stage, data) => state.checkpoints.push({ stage, data }), repository, client, teamMap: new Map([['HME', 'home'], ['AWY', 'away']]), fetchImpl: async () => { requests++; return { ok: true, text: async () => csv(index + 1) } } }
      const result = await reconcileAutomatedPitches(args)
      assert.equal(result.inserted, 1); assert.equal(result.rows, index + 1)
      const retry = await reconcileAutomatedPitches(args); assert.equal(retry.inserted, 0); assert.equal(retry.reused, index + 1)
    } finally { store.release() }
  }
  assert.equal(requests, 3)
})
await check('pregame target evidence never ingested as dependency', async () => {
  const store = createPrivateRunStore(path.join(root, `raw-block-${Date.now()}`)); store.acquire()
  try { await assert.rejects(reconcileAutomatedPitches({ job: { ...job, gamePks: [1], targetGamePks: [1], dates: ['2026-09-09'] }, state: {}, store, repository }), /PREGAME_TARGET_LEAKAGE/) } finally { store.release() }
})
await check('durable pitch adapter streams at most 100 rows and checkpoints only verified references',async()=>{
  let reservations=0,maximumBatch=0,completed=null
  const ledger={consume:async()=>{assert.equal(reservations,0);reservations++},snapshot:()=>({STATCAST:reservations})}
  const durableRepository={...repository,insertRawRows:async rows=>{maximumBatch=Math.max(maximumBatch,rows.length);return repository.insertRawRows(rows)}}
  const result=await reconcileAutomatedPitches({job:{...job,mode:'INCREMENTAL',gamePks:[900000001],targetGamePks:[],dates:[job.date]},state:{checkpoints:[]},store:{locked:true,referenceOnly:true,providerLedger:ledger},repository:durableRepository,client,teamMap:new Map([['HME','home'],['AWY','away']]),checkpoint:async(stage,data)=>{assert.equal(stage,'RAW_READBACK');assert.deepEqual(Object.keys(data).sort(),['count','digest']);completed=data},fetchImpl:async()=>({ok:true,text:async()=>csv(250)})})
  assert.equal(maximumBatch,100);assert.equal(result.rows,250);assert.equal(result.inserted,247);assert.equal(completed.count,250);assert.equal(reservations,1)
})

const payload = { gamePk: 900000001, gameData: { status: { detailedState: 'Final' } }, liveData: { linescore: { teams: { home: { runs: 5 }, away: { runs: 3 } } } } }
const evidence = { gamePk: payload.gamePk, source: 'MLB_OFFICIAL', acquiredAt: at, status: 'Final', homeScore: 5, awayScore: 3, sourcePayload: payload, sourceDigest: digestSettlementEvidence(payload) }
const pick = { game_pk: payload.gamePk, prediction_id: '10000000-0000-4000-8000-000000000001', official_pick_identity: 'test-pick', market: 'MONEYLINE', side: 'HOME', decision_status: 'OFFICIAL_PICK', decision_at: '2026-09-09T10:00:00Z', model_version: MLB_CHAMPION, policy_version: MLB_POLICY, american_odds: 150, decision_payload_digest: 'c'.repeat(64) }
let plan
await check('settlement reuses core math, preserves pick, supports win/loss/push/void', () => {
  const original = structuredClone(pick)
  plan = planMlbSettlement([pick], evidence, at)
  assert.equal(plan[0].actual_result.settlements[0].outcome, 'win'); assert.equal(plan[0].actual_result.settlements[0].units, 1.5)
  assert.equal(planMlbSettlement([{ ...pick, side: 'AWAY' }], evidence, at)[0].actual_result.settlements[0].outcome, 'loss')
  const tie = structuredClone(payload); tie.liveData.linescore.teams.away.runs = 5
  assert.equal(planMlbSettlement([pick], { ...evidence, awayScore: 5, sourcePayload: tie, sourceDigest: digestSettlementEvidence(tie) }, at)[0].actual_result.settlements[0].outcome, 'push')
  const cancelled = { gamePk: payload.gamePk, gameData: { status: { detailedState: 'Cancelled' } } }
  assert.equal(planMlbSettlement([pick], { ...evidence, status: 'Cancelled', homeScore: null, awayScore: null, sourcePayload: cancelled, sourceDigest: digestSettlementEvidence(cancelled) }, at)[0].actual_result.settlements[0].outcome, 'void')
  assert.deepEqual(pick, original)
})
await check('settlement rejects null scores, digest drift, wrong identity, future evidence and nonterminal status', () => {
  for (const change of [{ homeScore: null }, { sourceDigest: 'x' }, { gamePk: 1 }, { acquiredAt: '2026-09-10T00:00:00Z' }, { status: 'Live' }]) assert.throws(() => planMlbSettlement([pick], { ...evidence, ...change }, at), /SETTLEMENT_BLOCK/)
})
const { PGlite } = await import(pathToFileURL(path.join(root, 'validation-tools/node_modules/@electric-sql/pglite/dist/index.js')).href)
const db = new PGlite()
await db.exec('create table results (prediction_id uuid primary key, body jsonb not null)')
const repo = { read: async ids => (await db.query('select body from results where prediction_id = any($1::uuid[])', [ids])).rows.map(r => r.body), insert: async rows => { for (const row of rows) await db.query('insert into results values ($1,$2)', [row.prediction_id, row]) } }
await check('SQL settlement persistence independently reads back; retry reuses; immutable conflict and caps reject', async () => {
  assert.equal((await persistMlbSettlements(plan, repo, 1)).inserted, 1)
  assert.equal((await persistMlbSettlements(planMlbSettlement([pick], evidence, '2026-09-09T16:01:00Z'), repo, 1)).status, 'REUSE_NO_OP')
  await assert.rejects(persistMlbSettlements(plan, repo, 0), /CAP/)
  await assert.rejects(persistMlbSettlements(planMlbSettlement([{ ...pick, side: 'AWAY' }], evidence, at), repo, 1), /BLOCK_CONFLICT/)
})
await check('actual Supabase-shaped settlement adapter respects physical schema, FK and SQL readback', async () => {
  await db.exec('create table pick2_game_predictions(id uuid primary key); create table game_results(id uuid primary key)')
  const migration = fs.readFileSync('supabase/migrations/202608270002_pick2_data_foundation_v1.sql', 'utf8')
  const start = migration.indexOf('create table if not exists public.pick2_prediction_results')
  await db.exec(migration.slice(start, migration.indexOf(';', start) + 1))
  await db.exec('alter table pick2_prediction_results add column game_pk bigint check(game_pk > 0), add column result_source text, add column source_payload_digest text')
  await db.query('insert into pick2_game_predictions values($1)', [pick.prediction_id])
  const client = createPgliteClient(db)
  assert.equal((await persistMlbSettlementPlan(client, plan, 1)).inserted, 1)
  assert.equal((await persistMlbSettlementPlan(client, plan, 1)).reused, 1)
  const changed = [{ ...plan[0], prediction_id: '10000000-0000-4000-8000-000000000002' }]
  await assert.rejects(persistMlbSettlementPlan(client, changed, 1), /WRITE_REQUIRES_READBACK/)
})
await check('operational telemetry uses one deterministic SQL row, bounded status update, reuse and conflict guard', async () => {
  const migration = fs.readFileSync('supabase/migrations/202607110001_nba_data_sync_v1.sql', 'utf8')
  const start = migration.indexOf('create table if not exists sports_sync_jobs')
  await db.exec(migration.slice(start, migration.indexOf(';', start) + 1))
  const client = createPgliteClient(db), input = { identity: 'a'.repeat(64), startedAt: at, status: 'running', metadata: { providers: 0 } }
  const first = await persistOperationalTelemetry(client, input); assert.equal(first.inserted, 1)
  assert.equal((await persistOperationalTelemetry(client, input)).disposition, 'REUSE_NO_OP')
  assert.equal((await persistOperationalTelemetry(client, { ...input, status: 'completed' })).updated, 1)
  await db.query('update sports_sync_jobs set job_type=$1 where id=$2', ['OTHER_JOB', first.id])
  await assert.rejects(persistOperationalTelemetry(client, input), /BLOCK_CONFLICT/)
})
await db.close()
await check('performance reports supported units and denominators; no fabricated ROI/CLV for empty sample', () => {
  assert.equal(summarizeMlbPerformance([]).roi, null)
  const summary = summarizeMlbPerformance(plan[0].actual_result.settlements)
  assert.equal(summary.wins, 1); assert.equal(summary.roi, 1.5); assert.equal(summary.clv, null)
  assert.throws(() => summarizeMlbPerformance([...plan[0].actual_result.settlements, ...plan[0].actual_result.settlements]), /DUPLICATE/)
})
await check('Today projection has truthful empty, no-prediction, stale, and started-game states', () => {
  const input = { games: [], predictions: [], values: [], picks: [], teams: [], at }
  assert.equal(projectMlbOperations(input).games.length, 0)
  const game = { game_pk: 1, game_date: job.date, scheduled_at: '2026-09-09T18:00:00Z', official_status: 'Scheduled', updated_at: at, metadata: { homeProbablePitcher: { id: 1 }, awayProbablePitcher: { id: 2 } } }
  const observed = { game_pk: 1, scheduled_at: game.scheduled_at, official_status: 'Scheduled', observed_at: at, homeStarter: { id: 1 }, awayStarter: { id: 2 } }
  assert.equal(projectMlbOperations({ ...input, games: [game], schedules: [observed] }).games[0].reason, 'NO_CURRENT_PREDICTION')
  assert.equal(projectMlbOperations({ ...input, games: [game], schedules: [{ ...observed, observed_at: '2026-09-08T00:00:00Z' }] }).games[0].reason, 'STALE_GAME_EVIDENCE')
  assert.equal(projectMlbOperations({ ...input, games: [{ ...game, scheduled_at: '2026-09-09T15:00:00Z' }] }).games[0].reason, 'STARTED_GAME_BLOCKED')
})
await check('Today and Value Board preserve canonical values, require stored pick linkage and block starter changes', () => {
  const game = { game_pk: 1, game_date: job.date, scheduled_at: '2026-09-09T18:00:00Z', official_status: 'Scheduled', updated_at: at, metadata: { homeProbablePitcher: { id: 1 }, awayProbablePitcher: { id: 2 } } }
  const prediction = { id: 'pred', game_pk: 1, predicted_at: '2026-09-09T15:50:00Z', home_probability: .57, away_probability: .43, metadata: { model_version: MLB_CHAMPION, scheduled_at: game.scheduled_at, evidence_digest: 'a'.repeat(64), starters: { home: { mlbam_pitcher_id: 1 }, away: { mlbam_pitcher_id: 2 } } } }
  const value = { id: 'value', game_pk: 1, prediction_id: 'pred', model_version: MLB_CHAMPION, side: 'HOME', model_probability: .57, consensus_edge: .07, unit_ev: .14, book_count: 8, market_dispersion: .01, american_odds: 100, market_freshness: 'FRESH', starter_status: 'CONFIRMED', provider_last_update: at, evaluated_at: at, market_acquired_at: at, prediction_as_of: prediction.predicted_at, temporal_eligibility: 'PREGAME_VALID', bookmaker_key: 'test-only' }
  Object.assign(value, { home_market_observation_id: 'home-observation', away_market_observation_id: 'away-observation', selected_side_market_observation_id: 'home-observation', source_payload_digest: 'a'.repeat(64), evaluation_payload_digest: 'b'.repeat(64) })
  value.provider_event_id = 'event'
  const mappings = [{ id: 'mapping', game_pk: 1, market_provider: 'the-odds-api', provider_event_id: 'event', matched_at: at }]
  const observations = ['HOME', 'AWAY'].map(side => ({ id: side.toLowerCase() + '-observation', observation_identity: side, game_pk: 1, side, provider: 'the-odds-api', provider_event_id: 'event', market_event_mapping_id: 'mapping', bookmaker_key: 'test-only', market: 'MONEYLINE', american_odds: 100, provider_last_update: at, acquired_at: at, commence_time: game.scheduled_at }))
  const input = { games: [game], predictions: [prediction], values: [value], picks: [], teams: [], mappings, observations, at }
  const projected = projectMlbOperations(input)
  assert.equal(projected.sources[0].status, 'VALUE_CANDIDATE')
  const board = buildPick2MlbValueBoardRows(projected.sources)
  assert.equal(board[0].model_probability, value.model_probability); assert.equal(board[0].unit_ev, value.unit_ev)
  const official = { game_pk: 1, prediction_id: 'pred', value_evaluation_id: 'value', policy_version: MLB_POLICY, decision_status: 'OFFICIAL_PICK', decision_at: at, official_pick_identity: 'pick' }
  assert.equal(projectMlbOperations({ ...input, picks: [official] }).sources[0].status, 'OFFICIAL_PICK')
  assert.equal(projectMlbOperations({ ...input, picks: [{ ...official, value_evaluation_id: 'wrong' }] }).sources[0].status, 'VALUE_CANDIDATE')
  const changed = { ...game, metadata: { ...game.metadata, homeProbablePitcher: { id: 3 } } }
  assert.equal(projectMlbOperations({ ...input, games: [changed], picks: [official] }).sources[0].status, 'BLOCKED')
})
await check('daily binding resumes the exact R2 run after interruption; saved terminal result prevents reexecution', async () => {
  const liveRoot = fs.mkdtempSync(path.join(root, 'daily-recovery-'))
  const state = { checkpoints: [] }, checkpoint = (stage, data) => state.checkpoints.push({ stage, data })
  let calls = 0
  const manual = async args => {
    calls++
    if (!args.resumeRunId) { fs.writeFileSync(path.join(liveRoot, 'run-test-run.json'), JSON.stringify({ run_id: 'test-run', run_date: job.date, execution_package_sha: job.packageSha })); throw Error('injected R2 interruption') }
    assert.equal(args.resumeRunId, 'test-run')
    const result = { runId: 'test-run', status: 'NO_VALID_PREGAME_SLATE' }
    fs.writeFileSync(path.join(liveRoot, 'result-test-run.json'), JSON.stringify(result)); return result
  }
  const args = { job, state, checkpoint, liveRoot, manual }
  await assert.rejects(executeDailyJob(args), /interruption/)
  assert.equal((await executeDailyJob(args)).status, 'NO_VALID_PREGAME_SLATE')
  assert.equal((await executeDailyJob(args)).status, 'NO_VALID_PREGAME_SLATE')
  assert.equal(calls, 2)
})
for (const [file, hash] of Object.entries(testedSourceHashes)) assert.equal(normalizedFileDigest(file), hash, 'source changed during validation')
const result = { status: 'PASS', checks, testedSourceHashes, providerCalls: 0, productionDml: 0, productionDdl: 0, injectedStatcastRequests: requests, activation: 'DISABLED' }
fs.writeFileSync(path.join(root, 'pre-nonempty-readiness-tests.json'), JSON.stringify(result, null, 2))
console.log(JSON.stringify(result))
