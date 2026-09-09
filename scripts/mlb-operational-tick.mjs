// Prepared single-host entrypoint. No timer, cron or background process starts
// on import. Invoke via the repository local-ts-loader after activation only.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { AUTOMATION_MODES, assertAutomationActivation, automationIdentity, runAutomationJob, executeDailyJob, reconcileAutomatedPitches } from './mlb-operational-automation.mjs'
import { createPrivateRunStore } from './mlb-data-02r-r2t-private-run-store.mjs'
import { createWriteJournal } from './mlb-data-02r-r2t-write-journal.mjs'
import { createSupabaseProductionRepository, createMlbOfficialLiveClient, createProviderLedger, createCurrentSlateRunFreeze } from './mlb-data-02r-r2i-live-execution-interfaces.mjs'
import { verifyManualSchemaPreflight } from './mlb-operational-manual-refresh.mjs'
import { requireCanonicalR3Readiness, normalizedFileDigest } from './mlb-data-02r-r2t-r3-readiness.mjs'
import { operatingDate } from './mlb-data-02r-r2t-r1-pregame-contract.mjs'
import { planMlbSettlement, digestSettlementEvidence } from '../src/services/pick2-mlb-settlement.ts'
import { persistMlbSettlementPlan } from '../src/services/pick2-mlb-settlement-persistence.service.ts'
import { persistOperationalTelemetry } from '../src/services/pick2-operational-telemetry.ts'
import { runMlbOperationalSchemaPreflight } from './mlb-operational-unattended-preflight.mjs'
import {executeVercelProductionTick} from './mlb-operational-r6-vercel-runtime.mjs'
const ensure = (ok, reason) => { if (!ok) throw new Error(`TICK_BLOCK:${reason}`) }
const read = async query => { const { data, error } = await query; ensure(!error && Array.isArray(data), 'DATABASE_READ'); return data }

export async function executeProductionTick({ mode=null, packageSha, hostDry=false }) {
  if(process.env.VERCEL==='1')return executeVercelProductionTick({packageSha,hostDry})
  const activation = JSON.parse(fs.readFileSync('docs/CERTIFICATION/MLB_OPERATIONAL_AUTOMATION_ACTIVATION.json', 'utf8'))
  assertAutomationActivation(activation)
  ensure(activation.runtimeHost?.verified === true && !process.env.VERCEL, 'PERSISTENT_HOST_REQUIRED')
  requireCanonicalR3Readiness()
  const readiness = JSON.parse(fs.readFileSync('docs/CERTIFICATION/MLB_PRE_NONEMPTY_LIVE_READINESS.json', 'utf8'))
  ensure(readiness.automation?.status === 'DRY_CERTIFIED' && Object.keys(readiness.sourceHashes ?? {}).includes('scripts/mlb-operational-tick.mjs'), 'AUTOMATION_SOURCE_CERTIFICATION')
  for (const [file, digest] of Object.entries(readiness.sourceHashes)) ensure(normalizedFileDigest(file) === digest, 'AUTOMATION_SOURCE_DRIFT')
  ensure(AUTOMATION_MODES.includes(mode) && /^[a-f0-9]{40}$/.test(packageSha), 'ARGUMENTS')
  ensure(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() === packageSha, 'PACKAGE')
  ensure(!process.env.R2S_VALIDATION_DIR, 'CERTIFICATION_ENVIRONMENT')
  await runMlbOperationalSchemaPreflight()
  const root = path.join(os.tmpdir(), 'pick-analyzer-mlb-operational-coordinator')
  const liveRoot = path.join(os.tmpdir(), 'pick-analyzer-mlb-operational-live')
  const at = new Date().toISOString(), date = operatingDate(at)
  const recovery = fs.existsSync(root) ? fs.readdirSync(root).filter(n => /^job-[a-f0-9]{64}\.json$/.test(n)).map(n => JSON.parse(fs.readFileSync(path.join(root, n), 'utf8'))).filter(s => s.status !== 'COMPLETE') : []
  ensure(recovery.length <= 1, 'AMBIGUOUS_PENDING_JOBS')
  const job = recovery[0]?.job ?? { date, mode, at, packageSha }
  ensure(job.date === date && job.packageSha === packageSha, 'PENDING_JOB_FREEZE_REQUIRES_REVIEW')
  const telemetryClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  return runAutomationJob({ root, job, onState: async state => {
    const result = state.result ?? {}
    const count = value => typeof value === 'number' ? value : value?.rows?.length ?? 0
    return persistOperationalTelemetry(telemetryClient, { identity: automationIdentity(job), startedAt: job.at, status: state.status === 'COMPLETE' ? 'completed' : state.status === 'FAILED' ? 'failed' : 'running', metadata: {
      runId: `automation-${automationIdentity(job)}`, operatingDate: job.date, packageSha, mode: job.mode, attempts: state.attempts, stage: state.status === 'RUNNING' ? 'EXECUTING_CERTIFIED_PATH' : state.checkpoints.at(-1)?.stage ?? state.status,
      checkpointStages: state.checkpoints.map(c => c.stage), providerAccounting: result.providers ?? result.providerAccounting ?? state.providerAccounting, dmlAccounting: result.dml ?? [], settlementAccounting: result.settlements ?? [], status: result.status ?? state.status,
      predictionCount: count(result.predictions), valueCount: count(result.values), officialPickCount: count(result.officialPicks ?? result.picks), eligibleGameCount: result.eligibleGames ?? result.eligibleGamePks?.length ?? 0, blockedGameCount: result.blockedGames?.length ?? result.blockedGames ?? 0,
      champion: 'MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1', policy: 'MLB_MONEYLINE_OFFICIAL_PICK_POLICY_V1', telemetryRowCapPerTransition: 1, priorTelemetryDml: state.dmlAccounting, telemetryReadbackAuthority: 'PRIVATE_COORDINATOR_JOB_JOURNAL',
    } })
  }, execute: async args => {
    if (['INITIALIZE', 'PREGAME', 'STARTER_CHANGE', 'ODDS_FRESHNESS'].includes(args.job.mode)) return executeDailyJob({ ...args, liveRoot })
    const store = createPrivateRunStore(liveRoot); store.acquire()
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
      ensure(url && key, 'DATABASE_CREDENTIALS')
      verifyManualSchemaPreflight(store.load('schema-preflight'), { at: new Date().toISOString(), projectRef: new URL(url).hostname.split('.')[0] })
      const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
      const ledger = createProviderLedger({ MLB_OFFICIAL: { allowed: true, maxCalls: 50 }, STATCAST: { allowed: true, maxCalls: 100 } }, { initial: args.state.providerAccounting, onConsume: event => { args.state.providerAccounting[event.provider] = event.consumed; args.checkpoint('PROVIDER', { ...args.state.providerAccounting }) } })
      const checkedFetch = (url, options) => { const parsed = new URL(url); ensure(parsed.protocol === 'https:' && parsed.hostname === 'statsapi.mlb.com', 'MLB_HOST'); return fetch(url, { ...options, redirect: 'error' }) }
      const official = createMlbOfficialLiveClient({ ledger, fetchImpl: checkedFetch })
      let scope = args.state.checkpoints.find(c => c.stage === 'PITCH_SCOPE')?.data
      if (!scope) {
        const scopeDate = args.job.mode === 'OVERNIGHT' ? new Date(Date.parse(`${job.date}T12:00:00Z`) - 86400000).toISOString().slice(0, 10) : job.date
        const schedule = await official.getSchedule({ runDate: scopeDate })
        const all = schedule.dates.flatMap(d => d.games)
        ensure(all.length <= 50, 'SCHEDULE_CAP')
        const games = all.filter(g => args.job.mode === 'INCREMENTAL' ? g.status.abstractGameState === 'Live' : g.status.abstractGameState === 'Final')
        scope = { gamePks: games.map(g => g.gamePk), dates: [scopeDate], targetGamePks: [], scheduleAcquiredAt: new Date().toISOString() }
        args.checkpoint('PITCH_SCOPE', scope)
      }
      if (!scope.gamePks.length) return { status: 'NO_SCOPED_GAMES', providers: args.state.providerAccounting, dml: [] }
      const native = await read(client.from('pick2_mlb_games').select('game_pk').in('game_pk', scope.gamePks).limit(51))
      ensure(native.length === scope.gamePks.length, 'NATIVE_IDENTITY_REQUIRED')
      let freeze = args.state.checkpoints.find(c => c.stage === 'RAW_FREEZE')?.data
      if (!freeze) { freeze = createCurrentSlateRunFreeze({ mode: 'LIVE_EXECUTE', runId: `automation-${automationIdentity(job)}`, executionPackageSha: packageSha }); args.checkpoint('RAW_FREEZE', freeze) }
      const journal = createWriteJournal({ client, store, runContext: freeze })
      const repository = createSupabaseProductionRepository({ client, writeJournal: journal })
      const pitches = await reconcileAutomatedPitches({ ...args, job: { ...job, ...scope }, store, repository, client })
      args.checkpoint('PITCH_READBACK', { ...pitches, writes: journal.summary() })
      const settlements = []
      if (activation.settlementAutomation === 'ENABLED' && ['POSTGAME', 'OVERNIGHT'].includes(job.mode)) {
        const certification = JSON.parse(fs.readFileSync('docs/CERTIFICATION/MLB_PRE_NONEMPTY_LIVE_READINESS.json', 'utf8'))
        ensure(certification.settlement?.status === 'CERTIFIED', 'SETTLEMENT_CERTIFICATION_REQUIRED')
        for (const gamePk of scope.gamePks) {
          const picks = await read(client.from('pick2_mlb_official_picks').select('*').eq('game_pk', gamePk).limit(101))
          ensure(picks.length <= 100, 'SETTLEMENT_PICK_CAP')
          if (!picks.length) continue
          const saved = args.state.checkpoints.find(c => c.stage === `SETTLEMENT_PLAN_${gamePk}`)?.data
          let plan = saved?.plan
          if (!plan) {
            ledger.consume('MLB_OFFICIAL')
            const response = await checkedFetch(`https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`)
            ensure(response.ok, 'FINAL_FEED_HTTP')
            const payload = await response.json(), acquiredAt = new Date().toISOString()
            plan = planMlbSettlement(picks, { gamePk, source: 'MLB_OFFICIAL', acquiredAt, status: payload.gameData?.status?.detailedState, homeScore: payload.liveData?.linescore?.teams?.home?.runs ?? null, awayScore: payload.liveData?.linescore?.teams?.away?.runs ?? null, sourcePayload: payload, sourceDigest: digestSettlementEvidence(payload) }, acquiredAt)
            args.checkpoint(`SETTLEMENT_PLAN_${gamePk}`, { plan })
          }
          const result = await persistMlbSettlementPlan(client, plan, new Set(picks.map(p => p.prediction_id)).size)
          settlements.push({ gamePk, inserted: result.inserted, reused: result.reused, cap: result.cap, readback: result.readback })
          args.checkpoint(`SETTLEMENT_READBACK_${gamePk}`, settlements.at(-1))
        }
      }
      return { status: 'COMPLETE', pitches, settlements, providers: args.state.providerAccounting, dml: journal.summary() }
    } finally { store.release() }
  } })
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2)
  ensure(args.length === 3 && args.includes('--execute-tick') && args.some(a => a.startsWith('--mode=')) && args.some(a => a.startsWith('--package-sha=')), 'EXPLICIT_TICK_ARGUMENTS')
  executeProductionTick({ mode: args.find(a => a.startsWith('--mode=')).slice(7), packageSha: args.find(a => a.startsWith('--package-sha=')).slice(14) })
    .then(r => console.log(JSON.stringify({ status: r.status, job: r.job, attempts: r.attempts })))
    .catch(e => { console.error(JSON.stringify({ status: 'BLOCKED', reason: e.message })); process.exitCode = 1 })
}
