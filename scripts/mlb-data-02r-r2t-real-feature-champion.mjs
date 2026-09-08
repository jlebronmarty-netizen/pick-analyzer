// Read-only certified inference. No providers, persistence, training or promotion.
import fs from 'node:fs'
import { buildVector } from './mlb-data-02f-moneyline-prediction-generation-prep.mjs'
import { inferMoneyline } from './mlb-data-02r-r2f-wave12-interfaces.mjs'
import { sha256 } from './mlb-data-02r-r2f-stage-contracts.mjs'

export const MODEL_VERSION = 'MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1'
export const FEATURE_SET = 'MLB_ML_FEATURE_SET_V1'
export const FEATURE_VERSION = 'MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1'
export const ARTIFACT_DIGEST = '9275408e6f92d1405941eb7e277bc9018fd91c1d4a4e6f429cc26161ad2bf616'
export const ORDER_DIGEST = '3c2d35edcbeb5fd9cdbd7c2598af91f6ae9dbd19286d6a7381a03781a1c97ce4'
export const ARTIFACT_PATH = 'artifacts/mlb/mlb-02c-moneyline-baseline-model.json'
export const FEATURE_TABLES = Object.freeze({
  snapshots: 'pick2_feature_snapshots', team: 'pick2_mlb_team_daily_features',
  starter: 'pick2_mlb_pitcher_daily_features', bullpen: 'pick2_mlb_bullpen_daily_features',
  batter: 'pick2_mlb_batter_daily_features', matchup: 'pick2_mlb_matchup_daily_features',
  firstInning: 'pick2_mlb_first_inning_daily_features',
})
const block = (condition, reason) => { if (!condition) throw new Error(`R2T_BLOCK:${reason}`) }
const uuid = (value) => typeof value === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value)
const timestamp = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value))

export function validateChampionArtifact(artifact) {
  block(artifact && typeof artifact === 'object', 'CHAMPION_ARTIFACT_MISSING')
  block(artifact.featureNames?.length === 76, 'FEATURE_COUNT')
  block(sha256(artifact.featureNames) === ORDER_DIGEST, 'FEATURE_ORDER')
  block(artifact.preprocessing, 'PREPROCESSING_MISSING')
  for (const key of ['medians', 'means', 'stds']) {
    const values = artifact.preprocessing[key]
    block(values?.length === 76 && values.every(Number.isFinite), `PREPROCESSING_${key}`)
  }
  block(artifact.preprocessing.stds.every((value) => value > 0), 'PREPROCESSING_ZERO_SCALE')
  block(artifact.weights?.length === 77 && artifact.weights.every(Number.isFinite), 'MODEL_WEIGHTS')
  block(artifact.metadata?.featureSetVersion === FEATURE_SET, 'FEATURE_SET')
  block(artifact.metadata?.featureVersion === FEATURE_VERSION, 'FEATURE_VERSION')
  block(sha256(artifact) === ARTIFACT_DIGEST, 'ARTIFACT_DIGEST')
  return artifact
}

export function loadChampionModel(modelVersion = MODEL_VERSION) {
  block(modelVersion === MODEL_VERSION, 'CHAMPION_VERSION')
  block(fs.existsSync(ARTIFACT_PATH), 'CHAMPION_ARTIFACT_MISSING')
  const artifact = validateChampionArtifact(JSON.parse(fs.readFileSync(ARTIFACT_PATH, 'utf8')))
  return { modelVersion, featureSetVersion: FEATURE_SET, artifactDigest: ARTIFACT_DIGEST,
    featureOrderingDigest: ORDER_DIGEST, preprocessingDigest: sha256(artifact.preprocessing), artifact }
}

export function featureManifest(model = loadChampionModel()) {
  validateChampionArtifact(model.artifact)
  return model.artifact.featureNames.map((name, index) => {
    const difference = name.startsWith('diff.')
    const parts = name.split('.')
    return { index, name, domain: name === 'home_field_constant' ? 'certified_definition' : difference ? parts[1] : parts[0].split('_')[1],
      field: name === 'home_field_constant' ? null : parts.at(-1),
      side: name === 'home_field_constant' ? null : difference ? 'home_minus_away' : parts[0].split('_')[0],
      transform: name === 'home_field_constant' ? 'certified constant 1; median impute then standardize' : `${difference ? 'home minus away; ' : ''}certified train median impute then standardize`,
      median: model.artifact.preprocessing.medians[index], mean: model.artifact.preprocessing.means[index], std: model.artifact.preprocessing.stds[index] }
  })
}

// Each query is bounded to one target game and the certified feature version.
// The repository exposes no writes and never fetches provider data.
export function createCertifiedFeatureReadRepository(db) {
  block(db?.from, 'READ_REPOSITORY_MISSING')
  const read = async (query, label) => {
    const { data, error } = await query
    block(!error, `READ_FAILED:${label}:${error?.code ?? 'UNKNOWN'}`)
    return data ?? []
  }
  return {
    async readChampion() {
      const models = await read(db.from('pick2_model_versions').select('id,model_version,role,status,artifact_digest,feature_set_id').eq('role', 'champion').eq('status', 'promoted').limit(2), 'champion')
      block(models.length === 1, 'CHAMPION_CARDINALITY')
      const sets = await read(db.from('pick2_model_feature_sets').select('id,feature_set_version,input_contract').eq('id', models[0].feature_set_id).limit(2), 'feature_set')
      block(sets.length === 1, 'FEATURE_SET_CARDINALITY')
      return { model: models[0], featureSet: sets[0] }
    },
    async readGameEvidence(gamePk) {
      const native = await read(db.from('pick2_mlb_games').select('*').eq('game_pk', gamePk).limit(2), 'native_game')
      const domains = {}
      for (const [domain, table] of Object.entries(FEATURE_TABLES)) {
        domains[domain] = await read(db.from(table).select('*').eq('target_game_pk', gamePk).eq('feature_version', FEATURE_VERSION).order('id').limit(501), domain)
        block(domains[domain].length < 501, `READ_CAP:${domain}`)
      }
      return { native, domains }
    },
  }
}

export async function verifyChampionRegistry(repositories, model = loadChampionModel()) {
  block(typeof repositories?.readChampion === 'function', 'CHAMPION_REPOSITORY_MISSING')
  const registry = await repositories.readChampion()
  const stored = registry.model
  const contract = registry.featureSet?.input_contract
  block(stored?.model_version === MODEL_VERSION && stored.role === 'champion' && stored.status === 'promoted', 'CHAMPION_REGISTRY')
  block(stored.artifact_digest === ARTIFACT_DIGEST, 'REGISTRY_ARTIFACT_DIGEST')
  block(registry.featureSet?.feature_set_version === FEATURE_SET, 'REGISTRY_FEATURE_SET')
  block(contract?.feature_ordering_digest === ORDER_DIGEST && sha256(contract.ordered_features) === ORDER_DIGEST, 'REGISTRY_FEATURE_ORDER')
  block(contract?.feature_version === FEATURE_VERSION, 'REGISTRY_FEATURE_VERSION')
  for (const key of ['medians', 'means', 'stds']) block(sha256(contract.preprocessing?.[key] ?? null) === sha256(model.artifact.preprocessing[key]), `REGISTRY_PREPROCESSING:${key}`)
  return registry
}

export async function buildMoneylineFeatureVector({ gamePk, runAsOf, featureSetVersion = FEATURE_SET, repositories,
  eligibleGamePks, mode = 'PREGAME', scheduledAt } = {}) {
  block(['PREGAME', 'HISTORICAL_REPLAY'].includes(mode), 'EVIDENCE_MODE')
  block(Number.isSafeInteger(gamePk) && eligibleGamePks?.includes(gamePk), 'GAME_SCOPE')
  block(timestamp(runAsOf), 'RUN_AS_OF')
  block(featureSetVersion === FEATURE_SET, 'FEATURE_SET')
  if (mode === 'PREGAME') block(timestamp(scheduledAt) && Date.parse(scheduledAt) > Date.parse(runAsOf), 'POST_START')
  block(typeof repositories?.readGameEvidence === 'function', 'FEATURE_REPOSITORY_MISSING')
  const evidence = await repositories.readGameEvidence(gamePk)
  block(evidence.native?.length === 1 && Number(evidence.native[0].game_pk) === gamePk, 'NATIVE_GAME_CARDINALITY')
  const domains = evidence.domains
  const snapshots = new Map()
  for (const row of domains?.snapshots ?? []) {
    block(uuid(row.id) && !snapshots.has(row.id), 'SNAPSHOT_ID')
    block(row.deterministic_identity && row.input_digest, 'SNAPSHOT_IDENTITY')
    block(sha256({ native: row.native_identity_metadata, sample: row.sample_sizes, features: row.features }) === row.input_digest, 'SNAPSHOT_DIGEST')
    snapshots.set(row.id, row)
  }
  const linkage = []
  const provenanceWarnings = []
  for (const domain of Object.keys(FEATURE_TABLES).filter((key) => key !== 'snapshots')) {
    const rows = domains?.[domain]
    block(rows?.length > 0, `MISSING_DOMAIN:${domain}`)
    for (const row of rows) {
      const snapshot = snapshots.get(row.feature_snapshot_id)
      block(uuid(row.id) && snapshot, `FEATURE_SNAPSHOT_FK:${domain}`)
      for (const item of [row, snapshot]) {
        block(Number(item.target_game_pk) === gamePk, `ROW_SCOPE:${domain}`)
        block(item.feature_version === FEATURE_VERSION, `ROW_VERSION:${domain}`)
        block(/^\d{4}-\d{2}-\d{2}$/.test(item.feature_date) && item.as_of_date < item.feature_date, `SOURCE_DATE:${domain}`)
        block(timestamp(item.as_of_timestamp) && Date.parse(item.as_of_timestamp) <= Date.parse(runAsOf), `AS_OF_LEAKAGE:${domain}`)
        block(item.source_window?.rule === 'source_game_date < target_game_date' && item.source_window.as_of_date === item.as_of_date, `SOURCE_WINDOW:${domain}`)
        block(item.sample_sizes?.sample_size > 0, `MISSING_SAMPLE:${domain}`)
        if (mode === 'PREGAME') block(timestamp(item.created_at) && Date.parse(item.created_at) <= Date.parse(runAsOf), `EVIDENCE_NOT_AVAILABLE_AS_OF:${domain}`)
      }
      block(row.feature_date === snapshot.feature_date && row.as_of_date === snapshot.as_of_date && Date.parse(row.as_of_timestamp) === Date.parse(snapshot.as_of_timestamp), `SNAPSHOT_DATE_LINKAGE:${domain}`)
      const observed = row.lineup_proxy?.target_lineup_source === 'certified_2025_statcast_observed_batters' || row.lineup_context?.expected_lineup_source === 'certified_2025_statcast_observed_batters'
      if (observed) provenanceWarnings.push({ domain, rowId: row.id, reason: 'TARGET_GAME_OBSERVED_BATTERS_HISTORICAL_ONLY' })
      if (mode === 'PREGAME') block(!observed, `TARGET_GAME_OBSERVED_BATTERS:${domain}`)
      linkage.push({ domain, table: FEATURE_TABLES[domain], rowId: row.id, snapshotId: snapshot.id,
        deterministicIdentity: snapshot.deterministic_identity, snapshotDigest: snapshot.input_digest, rowDigest: sha256(row), status: 'PASS' })
    }
  }
  block(domains.team.length === 2 && domains.starter.length === 2 && domains.bullpen.length === 2 && domains.firstInning.length === 1 && domains.matchup.length === 1, 'DOMAIN_CARDINALITY')
  const first = domains.firstInning[0]
  const game = { gamePk, gameDate: first.feature_date, homeTeamId: first.home_team_id, awayTeamId: first.away_team_id }
  block(game.homeTeamId && game.awayTeamId && game.homeTeamId !== game.awayTeamId, 'TEAM_IDENTITY')
  const native = evidence.native[0]
  for (const [field, value] of [['home_team_id', game.homeTeamId], ['away_team_id', game.awayTeamId]]) {
    if (native[field] != null) block(native[field] === value, 'NATIVE_TEAM_CONFLICT')
  }
  if (mode === 'PREGAME') block(native.home_team_id && native.away_team_id && timestamp(native.scheduled_at) && Date.parse(native.scheduled_at) === Date.parse(scheduledAt), 'NATIVE_PREGAME_IDENTITY')
  const maps = { first: new Map([[gamePk, first]]) }
  for (const [domain, field] of [['team', 'team_id'], ['starter', 'mlbam_pitcher_id'], ['bullpen', 'team_id']]) {
    maps[domain] = new Map(domains[domain].map((row) => [`${gamePk}|${row[field]}`, row]))
    block(maps[domain].size === 2, `DUPLICATE_IDENTITY:${domain}`)
  }
  const manifest = featureManifest()
  const selected = {}
  for (const domain of ['team', 'starter', 'bullpen']) {
    selected[domain] = ['home', 'away'].map((side) => maps[domain].get(`${gamePk}|${domain === 'starter' ? first[`${side}_starter_mlbam_pitcher_id`] : game[`${side}TeamId`]}`))
    block(selected[domain].every(Boolean), `FEATURE_IDENTITY:${domain}`)
  }
  const lineage = manifest.map((entry) => {
    const rows = entry.side === null ? [] : entry.side === 'home_minus_away' ? selected[entry.domain] : [selected[entry.domain][entry.side === 'home' ? 0 : 1]]
    for (const row of rows) {
      block(Object.hasOwn(row, entry.field) && row[entry.field] !== undefined && row[entry.field] !== '', `MISSING_REQUIRED_FEATURE:${entry.name}`)
      block(row[entry.field] === null || (typeof row[entry.field] === 'number' && Number.isFinite(row[entry.field])), `NONFINITE_FEATURE:${entry.name}`)
    }
    return { ...entry, game_pk: gamePk, table: FEATURE_TABLES[entry.domain] ?? 'certified_model_definition',
      sources: rows.map((row) => ({ rowId: row.id, snapshotId: row.feature_snapshot_id, rowDigest: sha256(row),
        asOf: row.as_of_timestamp, createdAt: row.created_at, sourceWindow: row.source_window, sampleSizes: row.sample_sizes,
        rawPitchIds: null, dependencyDetail: 'aggregate prior-date evidence; individual raw pitch IDs are not persisted on certified daily rows' })) }
  })
  const values = buildVector(game, maps)
  block(values.length === 76, 'FEATURE_COUNT')
  values.forEach((value, index) => {
    block(value === null || Number.isFinite(value), 'NONFINITE_VECTOR')
    Object.assign(lineage[index], { rawValue: value, imputed: value === null,
      finalNumericValue: value ?? manifest[index].median,
      standardizedValue: ((value ?? manifest[index].median) - manifest[index].mean) / manifest[index].std })
  })
  return { gamePk, runAsOf, mode, game, values, featureNames: manifest.map((entry) => entry.name), featureSetVersion,
    sourceDigest: sha256(linkage), lineage, linkage, provenanceWarnings,
    completeness: { status: 'PASS', count: values.length, missingStructuralFields: 0, imputedValues: values.filter((value) => value === null).length },
    liveEvidenceCertified: mode === 'PREGAME', evidence }
}

export function inferChampion({ vector, model = loadChampionModel() }) {
  validateChampionArtifact(model.artifact)
  block(vector?.values?.length === 76, 'FEATURE_COUNT')
  block(sha256(vector.featureNames) === ORDER_DIGEST, 'FEATURE_ORDER')
  block(vector.values.every((value) => value === null || (typeof value === 'number' && Number.isFinite(value))), 'NONFINITE_VECTOR')
  block(vector.featureSetVersion === FEATURE_SET && timestamp(vector.runAsOf), 'VECTOR_CONTRACT')
  const result = inferMoneyline({ gamePk: vector.gamePk, featureVector: vector.values, modelArtifact: model.artifact, runAsOf: vector.runAsOf, modelVersion: MODEL_VERSION })
  const p = result.artifact.home_probability
  block(Number.isFinite(p) && p > 0 && p < 1 && Math.abs(p + result.artifact.away_probability - 1) <= 1e-12, 'PROBABILITY_RANGE')
  return { ...result, artifact: { ...result.artifact, model_version: MODEL_VERSION, feature_set_version: FEATURE_SET,
    model_artifact_digest: ARTIFACT_DIGEST, preprocessing_digest: model.preprocessingDigest, source_digest: vector.sourceDigest,
    evidence_mode: vector.mode, live_evidence_certified: vector.liveEvidenceCertified } }
}

// No authorization flag can turn historical provenance into pregame evidence.
// Deliberate hard stop until the missing current-target contract is certified.
export function assertR2TLiveReadiness() {
  loadChampionModel()
  throw new Error('R2T_LIVE_BLOCKED:CURRENT_TARGET_FEATURE_PROVENANCE_AND_SIX_DOMAIN_PERSISTENCE_NOT_CERTIFIED')
}
