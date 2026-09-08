import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { buildHistory, buildCurrentVector, inputPayload } from './mlb-data-02i-current-moneyline-dry-inference-prep.mjs'
import { sha256 } from './mlb-data-02r-r2f-stage-contracts.mjs'
import { getCurrentSlate } from './mlb-data-02r-r2f-wave12-interfaces.mjs'
import { mapScheduleGameToNativeInsertRow } from './mlb-data-02r-r2i-live-execution-interfaces.mjs'
import { runR2BExecutableEntrypoint } from './mlb-data-02r-r2a-live-refresh-executor.mjs'
import { runPregameModelDryPath, resolvePregameTarget, operatingDate } from './mlb-data-02r-r2t-r1-pregame-contract.mjs'
import { loadChampionModel, verifyChampionRegistry, createCertifiedFeatureReadRepository, MODEL_VERSION, FEATURE_VERSION } from './mlb-data-02r-r2t-real-feature-champion.mjs'
import { resolveStoredOfficialTeamAliases, bindStoredNativeContext, inventoryNativeGaps } from './mlb-data-02r-r2t-r2-native-binding.mjs'

if (!process.env.R2S_VALIDATION_DIR || !process.env.R1_READ_CACHE) throw new Error('GUARDED_READ_ONLY_CACHE_REPLAY_REQUIRED')
const checks = []
function check(name, condition) {
  checks.push({ name, status: condition ? 'PASS' : 'FAIL' })
  assert.ok(condition, name)
}
function assertStoredParity(actual, stored) {
  assert.ok(Math.abs(actual.homeProbability - stored.home_probability) <= 1e-12, 'STORED_OUTPUT_PARITY')
  assert.ok(Math.abs(actual.awayProbability - stored.away_probability) <= 1e-12, 'STORED_OUTPUT_PARITY')
  assert.equal(actual.inputDigest, stored.frozen_input_digest, 'STORED_INPUT_DIGEST')
}

async function main() {
  const readAt = new Date().toISOString()
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const r1 = JSON.parse(fs.readFileSync('docs/CERTIFICATION/MLB_DATA_02R_R2T_R1_PREGAME_EVIDENCE_PROVENANCE_AND_TARGET_BINDING.json', 'utf8'))
  const cache = JSON.parse(fs.readFileSync(process.env.R1_READ_CACHE, 'utf8'))
  check('immutable R1 production read cache digest', sha256(cache.dependencies) === cache.digest && cache.digest === r1.dependencyEvidence.digest)
  const { target, starters } = r1.selected
  check('exact R1 target/asof', target.gamePk === cache.target.gamePk && target.runAsOf === cache.target.runAsOf)
  const model = loadChampionModel()
  const registry = await verifyChampionRegistry(createCertifiedFeatureReadRepository(db), model)
  const queries = [
    ['stored', db.from('pick2_game_predictions').select('*').eq('id', r1.parityPlan.representativeSourceState.predictionId).limit(2)],
    ['current', db.from('pick2_mlb_games').select('*').eq('game_date', operatingDate(readAt)).limit(101)],
    ['aliases', db.from('pick2_mlb_games').select('*').gte('game_date', '2026-09-04').lte('game_date', '2026-09-06').limit(101)],
    ['teams', db.from('sports_teams').select('id').eq('sport_key', 'baseball_mlb').limit(101)],
    ['dbOrder', db.from('pick2_raw_mlb_statcast_pitches').select('id').eq('game_pk', cache.dependencies.dependencyGamePks[0]).order('id').limit(1000)],
  ]
  const settled = await Promise.allSettled(queries.map(async ([name, query]) => {
    const { data, error } = await query
    if (error) throw new Error(`READ_ONLY_QUERY:${name}:${error.code ?? 'NETWORK'}`)
    return data
  }))
  const failures = settled.flatMap((result, i) => result.status === 'rejected' ? [`${queries[i][0]}:${result.reason.message}`] : [])
  assert.equal(failures.length, 0, failures.join('|'))
  const read = Object.fromEntries(settled.map((result, i) => [queries[i][0], result.value]))
  check('bounded complete native inventories', read.current.length < 101 && read.aliases.length < 101 && read.teams.length < 101)
  check('one matching stored prediction', read.stored.length === 1)
  const stored = read.stored[0]
  check('stored game/asof', stored.game_pk === target.gamePk && stored.metadata.as_of === target.runAsOf)
  check('stored Champion/version/feature set', stored.model_version_id === registry.model.id && stored.metadata.model_version === MODEL_VERSION && stored.metadata.feature_set === 'MLB_ML_FEATURE_SET_V1')
  check('stored artifact/feature version', stored.model_artifact_digest === model.artifactDigest && stored.metadata.feature_version === FEATURE_VERSION)
  const sorted = [...cache.dependencies.rows].sort((a, b) => a.id.localeCompare(b.id, 'en-US', { numeric: false }))
  const databaseGame = sorted.filter((row) => row.game_pk === cache.dependencies.dependencyGamePks[0]).map((row) => row.id)
  check('database ordering equals reconstruction ordering for complete sampled game', read.dbOrder.length < 1000 && sha256(read.dbOrder.map((row) => row.id)) === sha256(databaseGame))
  const dry = runPregameModelDryPath({ target, starters, rawRows: cache.dependencies.rows, dependencyGamePks: cache.dependencies.dependencyGamePks })
  const reference = buildCurrentVector(dry.built.game, buildHistory(sorted).history).vector
  check('76 real source values and unchanged feature ordering', dry.vector.values.length === 76 && sha256(dry.vector.featureNames) === model.featureOrderingDigest)
  const encoded = (values) => values.map((v) => v === null ? null : Number(v.toFixed(12)))
  check('all 76 values equal certified current vector at stored input precision', sha256(encoded(reference)) === sha256(encoded(dry.vector.values)))
  const payload = inputPayload({ game_pk: target.gamePk, as_of: target.runAsOf,
    home_team_id: target.homeTeamId, away_team_id: target.awayTeamId,
    starter_status: stored.metadata.starter_status, data_completeness: stored.metadata.data_completeness,
    vector: dry.vector.values })
  const actual = { homeProbability: dry.inference.artifact.home_probability, awayProbability: dry.inference.artifact.away_probability, inputDigest: sha256(payload) }
  assertStoredParity(actual, stored)
  check('stored output and exact input digest parity', true)
  assert.throws(() => assertStoredParity({ ...actual, homeProbability: actual.homeProbability + 0.001 }, stored), /STORED_OUTPUT_PARITY/)
  check('stored probability mismatch fails closed', true)
  assert.throws(() => assertStoredParity({ ...actual, inputDigest: 'wrong' }, stored), /STORED_INPUT_DIGEST/)
  check('stored input digest mismatch fails closed', true)
  const aliases = resolveStoredOfficialTeamAliases(read.aliases, read.teams)
  const nativeBefore = sha256(read.current)
  const inventory = inventoryNativeGaps(read.current, aliases)
  check('native inventory covers inspected games and required fields', inventory.length === 18 && inventory.every((row) => row.inspectedRows === read.current.length))
  check('both canonical team aliases resolved', inventory.filter((row) => ['home_team_id', 'away_team_id'].includes(row.field)).every((row) => row.unresolvedGamePks.length === 0))
  const conflicts = structuredClone(read.aliases)
  const aliasRow = conflicts.find((row) => row.metadata?.homeMlbTeamId && row.home_team_id)
  conflicts.push({ ...aliasRow, home_team_id: aliasRow.away_team_id })
  assert.throws(() => resolveStoredOfficialTeamAliases(conflicts, read.teams), /AMBIGUOUS_TEAM_ALIAS/)
  check('conflicting canonical alias fails closed', true)
  // Re-inject only observed historical schedule fields; no provider call, fake
  // teams, missing game-type default, or invented probable pitchers.
  const native = target.native
  const evidence = { gamePk: native.game_pk, gameDate: native.scheduled_at, officialDate: native.metadata.officialDate,
    gameType: native.game_type, doubleHeader: native.doubleheader, gameNumber: native.game_number,
    status: { detailedState: native.official_status, abstractGameState: native.metadata.abstractGameState, statusCode: native.metadata.statusCode },
    teams: Object.fromEntries(['home', 'away'].map((side) => [side, { team: { id: native.metadata[`${side}MlbTeamId`] }, probablePitcher: native.metadata[`${side}ProbablePitcher`] }])) }
  const schedule = await getCurrentSlate({ runDate: operatingDate(target.runAsOf), runAsOf: target.runAsOf, injectedEvidence: { games: [evidence] }, teamMap: aliases })
  const mapped = mapScheduleGameToNativeInsertRow(schedule.artifact.games[0])
  const projectedTarget = resolvePregameTarget({ native: { ...mapped, created_at: native.created_at, updated_at: native.updated_at }, runAsOf: target.runAsOf, eligibleGamePks: [target.gamePk] })
  check('actual schedule-to-native mapping preserves R1 required evidence', projectedTarget.gamePk === target.gamePk && projectedTarget.homeTeamId === target.homeTeamId && mapped.metadata.homeProbablePitcher.id === starters.home.mlbam_pitcher_id)
  const currentBlocks = read.current.map((row) => {
    const projected = bindStoredNativeContext(row, aliases)
    try { resolvePregameTarget({ native: projected, runAsOf: readAt, eligibleGamePks: [row.game_pk] }); return { gamePk: row.game_pk, reason: null } }
    catch (error) { return { gamePk: row.game_pk, reason: error.message } }
  })
  check('read projections do not mutate stored evidence', sha256(read.current) === nativeBefore)
  const unresolved = inventory.filter((row) => row.unresolvedGamePks.length > 0)
  const mustStop = unresolved.length > 0
  check('missing native evidence remains explicitly blocked', !mustStop || currentBlocks.some((row) => row.reason))
  let sideEffects = 0
  const trap = new Proxy({}, { get: () => async () => { sideEffects++; throw new Error('SIDE_EFFECT') } })
  await assert.rejects(() => runR2BExecutableEntrypoint({ mode: 'LIVE_EXECUTE', executionPackageSha: 'R2TR2_TEST_ONLY', authorization: { authorized: true, execution_package_sha: 'R2TR2_TEST_ONLY' }, providers: trap, repository: trap }), /R2T_LIVE_BLOCKED/)
  check('actual live entrypoint stops before providers and writes', sideEffects === 0)
  const artifact = {
    project: 'MLB_DATA_02R_R2T_R2_STORED_OUTPUT_PARITY_AND_REAL_PERSISTENCE_INTEGRATION',
    certificationVerdict: 'BLOCKED', generatedAt: new Date().toISOString(), readAt, checks,
    storedOutputParity: { status: 'PASS', tolerance: 1e-12, actual, stored,
      absoluteHomeError: Math.abs(actual.homeProbability - stored.home_probability),
      absoluteAwayError: Math.abs(actual.awayProbability - stored.away_probability),
      inputPayload: payload, vector: dry.vector, referenceVector: reference,
      preprocessingDigest: model.preprocessingDigest, artifactDigest: model.artifactDigest, orderingDigest: model.featureOrderingDigest,
      sourceCache: { originalReadAt: cache.readAt, digest: cache.digest, rows: sorted.length, games: cache.dependencies.dependencyGamePks.length },
      provenance: dry.built.provenance,
      correction: 'R1 code-point raw-ID sort differed from certified database text order; en-US text comparison restores the stored input contract without formula changes',
      executorInputDigestBinding: 'NOT_INTEGRATED: parity uses the existing 02I stored-input serializer; R2F executor digest remains unchanged pending Gate 4 resolution' },
    nativeFieldGapInventory: { status: 'COMPLETE', currentRows: read.current, fields: inventory, aliases: [...aliases.entries()], currentBlocks },
    nativeFieldBinding: { status: mustStop ? 'BLOCKED' : 'PASS', futureMapping: 'PASS', unresolved,
      stopRule: 'Gate 4: If production data migration would be required, STOP and classify separately.',
      reason: 'Existing native rows omit same-game evidence. A read-only projection can recover aliases and nested starter evidence, but cannot recover missing official game type/date/state or unknown starters. Existing rows require separately authorized evidence recovery/data repair; no migration executed.' },
    persistenceAndExecutorIntegration: 'NOT_RUN_GATE_4_STOP', liveContainment: 'PASS',
    boundaries: { providerCalls: 0, productionDml: 0, productionDdl: 0, liveRefresh: false, training: 0, championChanges: 0, automationChanges: 0, cronChanges: 0, settlement: 0 },
  }
  fs.writeFileSync(path.join(process.env.R2S_VALIDATION_DIR, 'r2t-r2-evidence.json'), JSON.stringify(artifact, null, 2) + '\n')
  console.log(JSON.stringify({ verdict: artifact.certificationVerdict, checks: checks.length, parity: actual, nativeBinding: artifact.nativeFieldBinding.status, reason: artifact.nativeFieldBinding.reason }))
  // A successful partial investigation is not full phase certification.
  process.exitCode = 2
}

main().catch((error) => {
  console.error(JSON.stringify({ status: 'FAIL', error: error.message, checks }))
  process.exitCode = 1
})
