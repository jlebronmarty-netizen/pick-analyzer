import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { sha256 } from './mlb-data-02r-r2f-stage-contracts.mjs'
import { loadChampionModel, inferChampion, verifyChampionRegistry, createCertifiedFeatureReadRepository } from './mlb-data-02r-r2t-real-feature-champion.mjs'
import { runR2BExecutableEntrypoint } from './mlb-data-02r-r2a-live-refresh-executor.mjs'
import { resolvePregameTarget, resolveStarterContext, resolveLineupContext, resolveFeatureEntities,
  pregameFeatureSourceMatrix, expandAllGameTargets, runPregameModelDryPath, assemblePregameVector,
  buildPregameFeatureRows, MISSING_EVIDENCE_POLICY, operatingDate } from './mlb-data-02r-r2t-r1-pregame-contract.mjs'
import { createPregameReadRepository } from './mlb-data-02r-r2t-r1-read-repository.mjs'

if (!process.env.R2S_VALIDATION_DIR) throw new Error('ISOLATED_READ_ONLY_PRELOAD_REQUIRED')
const checks = []
const check = (name, condition) => { checks.push({ name, status: condition ? 'PASS' : 'FAIL' }); if (!condition) throw new Error(name) }
async function rejects(name, operation, token) {
  try { await operation() } catch (error) { check(name, error.message.includes(token)); return error.message }
  check(name, false)
}
const clone = (value) => structuredClone(value)

async function main() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const repo = createPregameReadRepository(db)
  const readAt = new Date().toISOString()
  const model = loadChampionModel()
  const registry = await verifyChampionRegistry(createCertifiedFeatureReadRepository(db), model)
  const archived = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-02i-current-moneyline-dry-inference-prep.json', 'utf8'))
  check('archived inference certificate', archived.certificationVerdict === 'MLB_DATA_02I_CURRENT_MONEYLINE_DRY_INFERENCE_CERTIFIED')
  const replayAsOf = archived.inference.asOf
  const candidates = await repo.readCandidates(operatingDate(readAt))
  const blockedCandidates = []
  const qualified = []
  for (const [kind, natives, runAsOf] of [['CURRENT', candidates.current, readAt], ['HISTORICAL_PREGAME_RECONSTRUCTION', candidates.historical, replayAsOf]]) {
    for (const native of natives) {
      try {
        const target = resolvePregameTarget({ native, runAsOf, eligibleGamePks: [native.game_pk] })
        const starters = resolveStarterContext(target)
        const lineup = resolveLineupContext(target)
        qualified.push({ kind, target, starters, lineup, entities: resolveFeatureEntities(target, starters, lineup) })
      } catch (error) { blockedCandidates.push({ gamePk: native.game_pk, kind, reason: error.message }) }
    }
    if (qualified.length) break
  }
  check('real pregame candidate available', qualified.length > 0)
  let selected, dependencies, dry, dependencyEvidence
  for (const candidate of qualified) {
    try {
      // Optional replay of this validator's own immutable production read cache.
      // Never a fixture fallback and never used by the live entrypoint.
      const cache = process.env.R1_READ_CACHE ? JSON.parse(fs.readFileSync(process.env.R1_READ_CACHE, 'utf8')) : null
      if (cache) {
        check('cache target and asof exact match', cache.target.gamePk === candidate.target.gamePk && cache.target.runAsOf === candidate.target.runAsOf)
        check('cache source digest', cache.digest === sha256(cache.dependencies))
        dependencies = cache.dependencies
        dependencyEvidence = { mode: 'REPLAY_OF_CAPTURED_PRODUCTION_READ', originalReadAt: cache.readAt, digest: cache.digest }
      } else {
        dependencies = await repo.readDependencies(candidate.target, candidate.starters)
        dependencyEvidence = { mode: 'FRESH_PRODUCTION_READ', originalReadAt: readAt, digest: sha256(dependencies) }
        const cachePath = path.join(process.env.R2S_VALIDATION_DIR, 'pregame-production-read-cache.json')
        fs.writeFileSync(cachePath, JSON.stringify({ target: candidate.target, dependencies, digest: sha256(dependencies), readAt }))
        console.log(JSON.stringify({ dependencyRows: dependencies.rows.length, dependencyGames: dependencies.dependencyGamePks.length, cachePath }))
      }
      dry = runPregameModelDryPath({ target: candidate.target, starters: candidate.starters, rawRows: dependencies.rows, dependencyGamePks: dependencies.dependencyGamePks })
      selected = candidate
      break
    } catch (error) {
      blockedCandidates.push({ gamePk: candidate.target.gamePk, kind: candidate.kind, reason: error.message })
      console.log(JSON.stringify({ blockedCandidate: candidate.target.gamePk, reason: error.message }))
      if (process.env.R1_READ_CACHE) throw error
    }
  }
  check('real pregame reconstruction succeeded', Boolean(dry))
  const { target, starters } = selected
  check('76 ordered values', dry.vector.values.length === 76 && dry.vector.featureNames.length === 76)
  check('76 lineage rows', dry.vector.lineage.length === 76)
  check('no lineup dependency', pregameFeatureSourceMatrix().every((row) => row.lineupDependency === false))
  check('no fabricated batter rows', dry.built.rows.batter.length === 0 && dry.built.rows.firstInning[0].expected_lineup_mlbam_batter_ids.length === 0)
  check('latest raw availability precedes asof and pitch', Date.parse(dry.built.provenance.latestAvailableAt) <= Date.parse(target.runAsOf) && Date.parse(target.runAsOf) < Date.parse(target.scheduledAt))
  check('probability sanity', dry.inference.artifact.range_audit === 'PASS')
  const persistence = await repo.verifyPersistenceColumns(dry.built.rows)
  check('all seven persistence schemas read-only verified', persistence.length === 7)
  const expansion = expandAllGameTargets(qualified.slice(0, 3))
  check('all games expanded', new Set(expansion.targets.team.map((row) => row.gamePk)).size === qualified.slice(0, 3).length)
  check('caps derived from actual targets', Object.entries(expansion.targets).every(([domain, rows]) => expansion.maximumCandidateCaps[domain] === rows.length))
  const single = expandAllGameTargets([selected])
  check('actual builder counts equal target caps', Object.entries(single.maximumCandidateCaps).every(([domain, count]) => dry.built.rows[domain].length === count))

  const targetArgs = { native: target.native, runAsOf: target.runAsOf, eligibleGamePks: target.eligibleGamePks }
  await rejects('wrong game scope', () => resolvePregameTarget({ ...targetArgs, eligibleGamePks: [] }), 'GAME_SCOPE')
  await rejects('started game', () => resolvePregameTarget({ ...targetArgs, runAsOf: target.scheduledAt }), 'STARTED_GAME')
  await rejects('source observed after asof', () => resolvePregameTarget({ ...targetArgs, native: { ...target.native, updated_at: target.scheduledAt } }), 'TARGET_OBSERVATION_ASOF')
  const starterRows = [starters.home, starters.away]
  await rejects('starter changed', () => resolveStarterContext(target, [{ ...starters.home, status: 'CHANGED' }, starters.away]), 'STARTER_CHANGED')
  await rejects('implicit starter replacement', () => resolveStarterContext(target, [{ ...starters.home, mlbam_pitcher_id: starters.away.mlbam_pitcher_id }, starters.away]), 'STARTER_CHANGED')
  await rejects('starter missing', () => resolveStarterContext(target, [{ ...starters.home, status: 'UNKNOWN', mlbam_pitcher_id: null }, starters.away]), 'STARTER_MISSING')
  await rejects('wrong starter team', () => resolveStarterContext(target, [{ ...starters.home, team_id: 'INVALID_TEAM' }, starters.away]), 'STARTER_GAME_TEAM_LINKAGE')
  await rejects('fixture source in production', () => resolveStarterContext(target, starterRows.map((row) => ({ ...row, source: 'INJECTED_TEST' }))), 'STARTER_SOURCE')
  await rejects('lineup unavailable where required', () => resolveLineupContext(target, null, { required: true }), 'LINEUP_REQUIRED')
  await rejects('required batter missing', () => resolveLineupContext(target, { game_pk: target.gamePk, source: 'MLB_OFFICIAL', status: 'CONFIRMED_LINEUP', source_timestamp: target.runAsOf, observed_at: target.runAsOf, batters: [] }, { required: true }), 'BATTER_MISSING')
  const rawArgs = { target, starters, dependencyGamePks: dependencies.dependencyGamePks }
  await rejects('post-start source row', () => buildPregameFeatureRows({ ...rawArgs, rawRows: [{ ...dependencies.rows[0], ingested_at: target.scheduledAt }] }), 'RAW_AVAILABILITY_ASOF')
  await rejects('same-day raw performance', () => buildPregameFeatureRows({ ...rawArgs, rawRows: [{ ...dependencies.rows[0], game_date: target.performanceCutoff }] }), 'RAW_SOURCE_DATE')
  await rejects('nonfinite raw performance', () => buildPregameFeatureRows({ ...rawArgs, rawRows: [{ ...dependencies.rows[0], release_speed: Infinity }] }), 'RAW_NONFINITE_VALUE')
  const changedRows = (fn) => { const built = clone(dry.built); fn(built.rows); return () => assemblePregameVector({ target, starters, built }) }
  await rejects('missing feature row', changedRows((rows) => { rows.team.pop() }), 'FEATURE_ROW_MISSING')
  await rejects('wrong entity linkage', changedRows((rows) => { rows.team[0].team_id = 'WRONG_ENTITY' }), 'SNAPSHOT_ENTITY_LINKAGE')
  await rejects('cross-team snapshot FK', changedRows((rows) => { rows.team[0].feature_snapshot_id = rows.team[1].feature_snapshot_id }), 'SNAPSHOT_ENTITY_LINKAGE')
  await rejects('wrong feature version', changedRows((rows) => { rows.team[0].feature_version = 'WRONG_VERSION' }), 'FEATURE_VERSION_OR_SCOPE')
  await rejects('stale feature row', changedRows((rows) => { rows.team[0].as_of_date = '2000-01-01' }), 'STALE_FEATURE_ROW')
  await rejects('missing numeric feature', changedRows((rows) => { delete rows.team[0].recent_k_rate }), 'MISSING_OR_NONFINITE_FEATURE')
  await rejects('nonfinite feature', changedRows((rows) => { rows.team[0].recent_k_rate = NaN }), 'MISSING_OR_NONFINITE_FEATURE')
  await rejects('feature count mismatch', () => inferChampion({ vector: { ...dry.vector, values: dry.vector.values.slice(1) } }), 'FEATURE_COUNT')
  await rejects('feature order mismatch', () => inferChampion({ vector: { ...dry.vector, featureNames: [...dry.vector.featureNames].reverse() } }), 'FEATURE_ORDER')
  let unexpectedCalls = 0
  const trap = new Proxy({}, { get: () => async () => { unexpectedCalls++; throw new Error('UNEXPECTED_SIDE_EFFECT') } })
  await rejects('actual R2B live containment', () => runR2BExecutableEntrypoint({ mode: 'LIVE_EXECUTE', executionPackageSha: 'R1_TEST_ONLY', authorization: { authorized: true, execution_package_sha: 'R1_TEST_ONLY' }, providers: trap, repository: trap }), 'R2T_LIVE_BLOCKED')
  check('no provider or write calls', unexpectedCalls === 0)

  const predictions = (await repo.readPredictions()).filter((row) => row.model_artifact_digest === model.artifactDigest && row.metadata?.feature_set === 'MLB_ML_FEATURE_SET_V1')
  check('stored Champion parity candidates found', predictions.length > 0)
  const representative = predictions.find((row) => row.game_pk === target.gamePk && row.metadata?.as_of === target.runAsOf && row.model_version_id === registry.model.id)
  check('representative prediction has reconstructed source state', Boolean(representative))
  const parityPlan = { status: 'READY', proofStatus: 'NOT_CLAIMED', candidates: predictions.map((row) => ({ id: row.id, gamePk: row.game_pk,
    modelVersionId: row.model_version_id, modelVersion: row.metadata.model_version, artifactDigest: row.model_artifact_digest,
    asOf: row.metadata.as_of, scheduledAt: row.metadata.scheduled_at, createdAt: row.created_at, inputDigest: row.frozen_input_digest,
    homeProbability: row.home_probability, awayProbability: row.away_probability })),
    representativeSourceState: { predictionId: representative.id, gamePk: target.gamePk, asOf: target.runAsOf,
      dependencyDigest: dry.built.provenance.dependencyDigest, availableBeforeAsOf: true, modelVersionId: registry.model.id },
    referenceCode: '02I buildCurrentVector + inputPayload; input digest includes market, feature version, team identities, starter/data state and missingness',
    steps: ['Read matching native target observation and complete scoped raw dependency state at stored metadata.as_of',
      'Verify all source timestamps and reconstruct rows with certified builder; preserve coefficients/preprocessing',
      'Compare 76 raw values against 02I frozen input contract; investigate six-decimal pair-difference rounding before claiming vector equivalence',
      'Use exact 02I inputPayload serialization for stored digest comparison; do not substitute R2F shorter input payload',
      'Require exact stored frozen_input_digest equality and probability error <= 1e-12, allowing stored 12-decimal probability precision',
      'Late persistence created_at is not prediction-time source availability; metadata.as_of needs independent source proof'],
    nextPhaseRequired: true }
  const artifact = { generatedAt: new Date().toISOString(), certificationVerdict: 'MLB_DATA_02R_R2T_R1_PREGAME_EVIDENCE_PROVENANCE_AND_TARGET_BINDING_CERTIFIED',
    checks, selected, blockedCandidates, dependencyEvidence, search: { readAt, currentCandidates: candidates.current.length, historicalCandidates: candidates.historical.length, historicalLimit: candidates.historicalSearchLimit, replayAsOfSource: 'certified 02I inference.asOf' },
    lineupInventory: { dependentFeatureCount: 0, contextOnlyDomains: ['batter', 'matchup', 'firstInning'], certifiedSource: '02H addDailyRows persistBatter=false future-schedule branch' },
    sourceMatrix: pregameFeatureSourceMatrix(), missingEvidencePolicy: MISSING_EVIDENCE_POLICY, persistence, expansion,
    model: { artifactDigest: model.artifactDigest, orderingDigest: model.featureOrderingDigest, preprocessingDigest: model.preprocessingDigest, registry },
    dry, parityPlan, boundaries: { providerCalls: 0, productionDml: 0, productionDdl: 0, modelTraining: 0, championChanges: 0, automationChanges: 0, cronChanges: 0, settlement: 0, liveExecutionEnabled: false } }
  fs.writeFileSync('docs/CERTIFICATION/r2t-r1-validation-evidence.json', JSON.stringify(artifact, null, 2) + '\n')
  console.log(JSON.stringify({ verdict: artifact.certificationVerdict, checks: checks.length, case: target.gamePk, kind: selected.kind, vectorCount: dry.vector.values.length, probabilities: dry.inference.artifact, boundaries: artifact.boundaries }, null, 2))
}
main().catch((error) => { console.error(JSON.stringify({ status: 'BLOCKED', error: error.message, checks })); process.exitCode = 1 })
