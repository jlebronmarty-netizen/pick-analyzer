import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { infer as historicalInfer } from './mlb-data-02f-moneyline-prediction-generation-prep.mjs'
import { runR2BExecutableEntrypoint } from './mlb-data-02r-r2a-live-refresh-executor.mjs'
import { buildMoneylineFeatureVector, createCertifiedFeatureReadRepository, featureManifest,
  inferChampion, loadChampionModel, validateChampionArtifact, verifyChampionRegistry, FEATURE_SET,
  FEATURE_TABLES, FEATURE_VERSION } from './mlb-data-02r-r2t-real-feature-champion.mjs'

// The isolation preload prevents every provider request, database mutation and
// inherited artifact write. This validator deliberately exits nonzero while R2T
// live readiness is blocked, even when its read-only and safety assertions pass.
if (!process.env.R2S_VALIDATION_DIR) throw new Error('ISOLATED_CERTIFICATION_PRELOAD_REQUIRED')
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const repositories = createCertifiedFeatureReadRepository(db)
const checks = []
const check = (label, condition) => { checks.push({ label, status: condition ? 'PASS' : 'FAIL' }); if (!condition) throw new Error(label) }
async function rejects(label, operation, token) {
  try { await operation() } catch (error) {
    check(label, error.message.includes(token))
    return error.message
  }
  check(label, false)
}
const clone = (value) => structuredClone(value)

async function main() {
  const model = loadChampionModel()
  const registry = await verifyChampionRegistry(repositories, model)
  check('real artifact and registry match', registry.model.artifact_digest === model.artifactDigest)
  const manifest = featureManifest(model)
  check('ordered manifest 76', manifest.length === 76)
  await rejects('missing artifact', () => validateChampionArtifact(null), 'CHAMPION_ARTIFACT_MISSING')
  let changed = clone(model.artifact); changed.weights[1] += 0.01
  await rejects('artifact digest mismatch', () => validateChampionArtifact(changed), 'ARTIFACT_DIGEST')
  changed = clone(model.artifact); changed.featureNames.pop()
  await rejects('feature count mismatch', () => validateChampionArtifact(changed), 'FEATURE_COUNT')
  changed = clone(model.artifact); changed.featureNames.reverse()
  await rejects('feature order mismatch', () => validateChampionArtifact(changed), 'FEATURE_ORDER')
  changed = clone(model.artifact); delete changed.preprocessing
  await rejects('missing preprocessing', () => validateChampionArtifact(changed), 'PREPROCESSING_MISSING')

  const currentDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Puerto_Rico', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const current = await db.from(FEATURE_TABLES.firstInning).select('target_game_pk,feature_date,as_of_timestamp').eq('feature_date', currentDate).eq('feature_version', FEATURE_VERSION).limit(3)
  check('current feature read succeeded', !current.error)
  const certifiedCases = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-02f-moneyline-prediction-generation-prep.json', 'utf8')).replay.sample.gamePks.slice(0, 3)
  const gamePks = current.data.length ? current.data.map((row) => row.target_game_pk) : certifiedCases
  const cases = []
  for (const gamePk of gamePks) {
    const evidence = await repositories.readGameEvidence(gamePk)
    check('historical first inning evidence exists', evidence.domains.firstInning.length === 1)
    // Replay clock belongs to the historical game, never to a live invocation.
    const runAsOf = `${evidence.domains.firstInning[0].feature_date}T00:00:00.000Z`
    const vector = await buildMoneylineFeatureVector({ gamePk, runAsOf, featureSetVersion: FEATURE_SET,
      eligibleGamePks: gamePks, repositories: { readGameEvidence: async () => evidence }, mode: 'HISTORICAL_REPLAY' })
    const inference = inferChampion({ vector, model })
    const reference = historicalInfer(model.artifact, [{ ...vector.game, x: vector.values }])[0]
    const delta = Math.abs(inference.artifact.home_probability - reference.homeProbability)
    check(`historical algorithm parity ${gamePk}`, delta <= 1e-12)
    check(`all six domain FKs ${gamePk}`, new Set(vector.linkage.map((row) => row.domain)).size === 6)
    cases.push({ gamePk, vector, inference, historicalAlgorithmReference: reference, maximumAbsoluteDifference: delta, tolerance: 1e-12 })
  }
  const sample = cases[0].vector
  const args = { gamePk: sample.gamePk, runAsOf: sample.runAsOf, eligibleGamePks: gamePks,
    mode: 'HISTORICAL_REPLAY', repositories: { readGameEvidence: async () => clone(sample.evidence) } }
  await rejects('out of scope game', () => buildMoneylineFeatureVector({ ...args, eligibleGamePks: [] }), 'GAME_SCOPE')
  await rejects('post-start', () => buildMoneylineFeatureVector({ ...args, mode: 'PREGAME', scheduledAt: sample.runAsOf }), 'POST_START')
  await rejects('feature as-of leakage', () => buildMoneylineFeatureVector({ ...args, runAsOf: '2000-01-01T00:00:00.000Z' }), 'AS_OF_LEAKAGE')
  const mutate = (change) => ({ readGameEvidence: async () => { const evidence = clone(sample.evidence); change(evidence); return evidence } })
  await rejects('missing required feature', () => buildMoneylineFeatureVector({ ...args, repositories: mutate((evidence) => { delete evidence.domains.team[0].recent_k_rate }) }), 'MISSING_REQUIRED_FEATURE')
  for (const value of [NaN, Infinity, -Infinity]) {
    await rejects(`nonfinite feature ${String(value)}`, () => buildMoneylineFeatureVector({ ...args, repositories: mutate((evidence) => { evidence.domains.team[0].recent_k_rate = value }) }), 'NONFINITE_FEATURE')
  }
  await rejects('missing structural domain', () => buildMoneylineFeatureVector({ ...args, repositories: mutate((evidence) => { evidence.domains.bullpen = [] }) }), 'MISSING_DOMAIN')
  await rejects('invalid snapshot FK', () => buildMoneylineFeatureVector({ ...args, repositories: mutate((evidence) => { evidence.domains.team[0].feature_snapshot_id = 'fixture' }) }), 'FEATURE_SNAPSHOT_FK')
  const provenanceBlock = await rejects('historical rows cannot become live evidence', () => buildMoneylineFeatureVector({ ...args, mode: 'PREGAME', scheduledAt: `${sample.game.gameDate}T23:00:00.000Z` }), 'EVIDENCE_NOT_AVAILABLE_AS_OF')
  let providerCalls = 0
  let productionWrites = 0
  const trap = new Proxy({}, { get: () => async () => { providerCalls += 1; throw new Error('UNEXPECTED_PROVIDER') } })
  const writeTrap = new Proxy({}, { get: () => async () => { productionWrites += 1; throw new Error('UNEXPECTED_REPOSITORY') } })
  const liveBlock = await rejects('actual R2B live entrypoint stops before fixture/provider/write', () => runR2BExecutableEntrypoint({
    mode: 'LIVE_EXECUTE', executionPackageSha: 'R2T_TEST_AUTHORIZATION_ONLY',
    authorization: { authorized: true, execution_package_sha: 'R2T_TEST_AUTHORIZATION_ONLY' },
    providers: { mlbOfficial: trap, statcast: trap, odds: trap }, repository: writeTrap,
  }), 'R2T_LIVE_BLOCKED')
  check('zero attempted provider calls and writes', providerCalls === 0 && productionWrites === 0)
  const result = { generatedAt: new Date().toISOString(), status: 'BLOCKED', certificationVerdict: 'MLB_DATA_02R_R2T_REAL_FEATURE_AND_CHAMPION_LIVE_BINDING_REPAIR_BLOCKED',
    checks, currentRead: { operatingDate: currentDate, rows: current.data, fallback: current.data.length ? null : 'CERTIFIED_HISTORICAL_CASES_SAME_PRODUCTION_REPOSITORY' },
    model: { ...model, artifact: undefined, metadata: model.artifact.metadata, intercept: model.artifact.weights[0], parameterCount: model.artifact.weights.length },
    manifest, registry, cases, provenanceBlock, liveBlock,
    historicalParityScope: 'Existing certified 02F algorithm replay; certified stored prediction rows were absent in the initial production probe. Not a stored-output parity certification.',
    fullRealModelDryIntegration: 'NOT_COMPLETED', liveBranchSimulation: 'BLOCKED_BEFORE_PROVIDER_OR_DML', liveReady: false,
    boundaries: { providerCalls: 0, productionDml: 0, productionDdl: 0, modelTraining: 0, championChanges: 0, liveRefreshExecuted: false } }
  fs.writeFileSync('docs/CERTIFICATION/r2t-read-only-validation-evidence.json', `${JSON.stringify(result, null, 2)}\n`)
  console.log(JSON.stringify({ status: result.status, checks: checks.length, historicalCases: cases.length, liveBlock, provenanceBlock, boundaries: result.boundaries }, null, 2))
  process.exitCode = 1
}
main().catch((error) => { console.error(JSON.stringify({ status: 'FAIL', error: error.message, checks })); process.exitCode = 1 })
