// Bounded manual launcher for the existing certified R2B -> R2I executor.
// No alternate refresh engine, scheduler, provider fallback or fixture input.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { assertR2TLiveReadiness } from './mlb-data-02r-r2t-real-feature-champion.mjs'
import { createPrivateRunStore } from './mlb-data-02r-r2t-private-run-store.mjs'
import { createWriteJournal } from './mlb-data-02r-r2t-write-journal.mjs'
import { createCanonicalProductionBindings } from './mlb-data-02r-r2t-production-bindings.mjs'
import { createSupabaseProductionRepository, createCurrentSlateRunFreeze, R2I_LIVE_TARGETS } from './mlb-data-02r-r2i-live-execution-interfaces.mjs'
import { runR2BExecutableEntrypoint } from './mlb-data-02r-r2a-live-refresh-executor.mjs'
import { operatingDate } from './mlb-data-02r-r2t-r1-pregame-contract.mjs'
import { collectRuntimeSourcePaths, R3_CERTIFICATE } from './mlb-data-02r-r2t-r3-readiness.mjs'
import {createDurableRunStore} from './mlb-operational-r6-run-store.mjs'
import {createDurableWriteJournal} from './mlb-operational-r6-write-journal.mjs'

const ensure = (condition, reason) => { if (!condition) throw new Error(`MLB_MANUAL_BLOCK:${reason}`) }
const git = args => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
export function manualRunAuthorization(runContext) {
  return { authorized: true, execution_package_sha: runContext.execution_package_sha, run_id: runContext.run_id,
    ddlAllowed: false, settlementAllowed: false, automationAllowed: false,
    authorizedDmlTargets: Object.values(R2I_LIVE_TARGETS),
    // This bounded manual invocation deliberately uses the stricter one-request
    // Odds limit. Its persisted response is reused on every retry.
    providerCaps: { MLB_OFFICIAL: { allowed: true, maxCalls: 50 }, STATCAST: { allowed: true, maxCalls: 100 }, THE_ODDS_API: { allowed: true, maxCalls: 1 },
      BALLDONTLIE: { allowed: false, maxCalls: 0 }, SPORTSDATAIO: { allowed: false, maxCalls: 0 } },
    // Actual per-stage caps derive from the frozen candidates and dependency
    // rows in the certified adapters. These are additional source hard ceilings.
    dmlCaps: { nativeGames: 50, nativePlayers: 100 } }
}

export function verifyManualSchemaPreflight(evidence, { at, projectRef }) {
  ensure(evidence?.status === 'PASS' && evidence.projectRef === projectRef, 'SCHEMA_PREFLIGHT_REQUIRED')
  const age = Date.parse(at) - Date.parse(evidence.checkedAt)
  ensure(Number.isFinite(age) && age >= 0 && age <= 15 * 60_000, 'SCHEMA_PREFLIGHT_EXPIRED')
  ensure(evidence.nativeSnapshotUniqueIndexes === 6 && evidence.orphanSnapshotReferences === 0 && evidence.invalidIndexes === 0 && evidence.schemaCompatible === true, 'SCHEMA_PREFLIGHT_CONTRACT')
  ensure(evidence.ddlDigest === '3f2df0f2baf8b4cd405bc10560c47eadc143198df85a80fb3577b4b03d5b1f46', 'SCHEMA_DDL_DRIFT')
}

export function verifyInitialMissionLedger(published) {
  const accounting = published?.providerAccounting
  ensure(accounting && ['MLBOfficial', 'sharedStatcast', 'OddsAPI', 'BALLDONTLIE', 'SportsDataIO', 'otherSportsProviders', 'missionOddsConsumed'].every(provider => accounting[provider] === 0)
    && accounting.missionOddsRemaining === 20 && Array.isArray(accounting.runs) && accounting.runs.length === 0, 'PRIVATE_MISSION_LEDGER_RECOVERY_REQUIRED')
}

export async function runManualRefresh({ packageSha, resumeRunId = null, durableRuntime = null, cacheRoot = null } = {}) {
  assertR2TLiveReadiness()
  if(durableRuntime) return runDurableManualRefresh({packageSha,runtime:durableRuntime,cacheRoot})
  ensure(/^[a-f0-9]{40}$/.test(packageSha ?? '') && git(['rev-parse', 'HEAD']) === packageSha, 'FROZEN_PACKAGE')
  const frozenFiles = [...collectRuntimeSourcePaths(), R3_CERTIFICATE]
  git(['ls-files', '--error-unmatch', '--', ...frozenFiles])
  ensure(git(['diff', 'HEAD', '--name-only', '--', ...frozenFiles]) === '', 'UNCOMMITTED_EXECUTION_SOURCE')
  ensure(!process.env.R2S_VALIDATION_DIR, 'CERTIFICATION_ENVIRONMENT_FORBIDDEN')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
  ensure(url && key, 'DATABASE_CREDENTIALS')
  const projectRef = new URL(url).hostname.split('.')[0]
  const store = createPrivateRunStore(path.join(os.tmpdir(), 'pick-analyzer-mlb-operational-live'))
  store.acquire()
  let runContext, canonical, journal
  try {
    verifyManualSchemaPreflight(store.load('schema-preflight'), { at: new Date().toISOString(), projectRef })
    const mission = store.load('mission-provider-budget')
    if (!mission) {
      const published = JSON.parse(fs.readFileSync('docs/CERTIFICATION/MLB_OPERATIONAL_MISSION_STATUS.json', 'utf8'))
      verifyInitialMissionLedger(published)
      ensure(!fs.readdirSync(store.root).some(name => name.startsWith('run-')), 'PRIVATE_MISSION_LEDGER_MISSING')
      store.save('mission-provider-budget', { oddsCalls: 0, initializedFromPackage: packageSha })
    }
    if (resumeRunId) {
      ensure(/^[a-zA-Z0-9_-]+$/.test(resumeRunId), 'RESUME_ID')
      runContext = store.load(`run-${resumeRunId}`)
      ensure(runContext?.execution_package_sha === packageSha && runContext.run_id === resumeRunId, 'RESUME_FREEZE')
      ensure(!store.load(`result-${resumeRunId}`), 'COMPLETED_RUN_USE_NEW_FREEZE')
    } else {
      // Frozen once from actual start; caller cannot supply a date/as-of/clock.
      runContext = createCurrentSlateRunFreeze({ mode: 'LIVE_EXECUTE', runId: `mlb-operational-${randomUUID()}`, executionPackageSha: packageSha })
      store.save(`run-${runContext.run_id}`, runContext)
    }
    ensure(runContext.run_date === operatingDate(new Date().toISOString()), 'CURRENT_OPERATING_DATE')
    ensure(git(['rev-parse', 'HEAD']) === packageSha, 'PACKAGE_CHANGED_BEFORE_START')
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    journal = createWriteJournal({ client, store, runContext })
    const repository = createSupabaseProductionRepository({ client, writeJournal: journal })
    const authorization = manualRunAuthorization(runContext)
    canonical = await createCanonicalProductionBindings({ client, repository, store, runContext, authorization, oddsApiKey: process.env.THE_ODDS_API_KEY ?? process.env.ODDS_API_KEY })
    const result = await runR2BExecutableEntrypoint({ mode: 'LIVE_EXECUTE', executionPackageSha: packageSha, runId: runContext.run_id,
      runDate: runContext.run_date, runAsOf: runContext.run_as_of, authorization, repository, providers: { canonical } })
    ensure(git(['rev-parse', 'HEAD']) === packageSha, 'PACKAGE_CHANGED_DURING_RUN')
    store.save(`result-${runContext.run_id}`, result)
    return { status: result.status, runId: runContext.run_id, runDate: runContext.run_date, runAsOf: runContext.run_as_of, packageSha,
      eligibleGames: result.eligibleGamePks?.length ?? 0, blockedGames: result.blockedGames?.length ?? 0,
      predictions: result.predictions?.rows.length ?? 0, observations: result.markets?.observations.rows.length ?? 0,
      values: result.values?.rows.length ?? 0, officialPicks: result.picks?.rows.length ?? 0,
      providers: canonical.providerAccounting(), dml: journal.summary(), productionDdl: 0, syntheticProductionPaths: 0 }
  } catch (error) {
    const safeError = String(error.message).replace(/https?:\/\/\S+/g, '[URL_REDACTED]').slice(0, 500)
    if (runContext) store.save(`failure-${runContext.run_id}`, { at: new Date().toISOString(), error: safeError, providers: canonical?.providerAccounting() ?? {}, writes: journal?.summary() ?? [] })
    throw new Error(safeError)
  } finally { store.release() }
}

// Same R2 coordinator and bindings; only runtime ownership differs on Vercel.
// The database has already frozen the actual start and owns all counters/writes.
async function runDurableManualRefresh({packageSha,runtime,cacheRoot}) {
  const reviewedExecutor=(runtime.run.checkpoint.marketRecoveries??runtime.run.checkpoint.dependencyRecoveries)?.at(-1)?.executorPackageSha
  ensure(process.env.VERCEL==='1' && process.env.VERCEL_ENV==='production' && (process.env.VERCEL_GIT_COMMIT_SHA===packageSha || /^[a-f0-9]{40}$/.test(reviewedExecutor??'') && process.env.VERCEL_GIT_COMMIT_SHA===reviewedExecutor),'VERCEL_FROZEN_PACKAGE')
  ensure(!process.env.R2S_VALIDATION_DIR && runtime.locked && runtime.run.package_sha===packageSha,'DURABLE_RUNTIME_REQUIRED')
  const row=runtime.run,runDate=String(row.run_date).slice(0,10),runAsOf=new Date(row.run_as_of).toISOString()
  ensure(runDate===operatingDate(new Date().toISOString()) && typeof cacheRoot==='string','CURRENT_DURABLE_RUN')
  const runContext=createCurrentSlateRunFreeze({mode:'LIVE_EXECUTE',runId:row.run_id,executionPackageSha:packageSha,runDate,runAsOf})
  const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
  const store=createDurableRunStore({runtime,runContext,root:cacheRoot}),journal=createDurableWriteJournal(runtime)
  const repository=createSupabaseProductionRepository({client,writeJournal:journal}),authorization=manualRunAuthorization(runContext)
  const canonical=await createCanonicalProductionBindings({client,repository,store,runContext,authorization,compactContexts:true,oddsApiKey:process.env.THE_ODDS_API_KEY??process.env.ODDS_API_KEY})
  store.setCanonical(canonical)
  const result=await runR2BExecutableEntrypoint({mode:'LIVE_EXECUTE',executionPackageSha:packageSha,runId:runContext.run_id,runDate,runAsOf,authorization,repository,providers:{canonical}})
  return {status:result.status,runId:runContext.run_id,runDate,runAsOf,packageSha,eligibleGames:result.eligibleGamePks?.length??0,blockedGames:result.blockedGames?.length??0,
    predictions:result.predictions?.rows.length??0,observations:result.markets?.observations.rows.length??0,values:result.values?.rows.length??0,officialPicks:result.picks?.rows.length??0,
    providers:canonical.providerAccounting(),dml:journal.summary(),productionDdl:0,syntheticProductionPaths:0}
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2)
  ensure(args.includes('--execute-current-slate'), 'EXPLICIT_EXECUTION_FLAG_REQUIRED')
  ensure(args.every(arg => arg === '--execute-current-slate' || arg.startsWith('--package-sha=') || arg.startsWith('--resume-run=')), 'UNEXPECTED_ARGUMENT')
  runManualRefresh({ packageSha: args.find(a => a.startsWith('--package-sha='))?.split('=')[1], resumeRunId: args.find(a => a.startsWith('--resume-run='))?.split('=')[1] ?? null })
    .then(result => console.log(JSON.stringify(result))).catch(error => { console.error(JSON.stringify({ status: 'BLOCKED', error: error.message })); process.exitCode = 1 })
}
