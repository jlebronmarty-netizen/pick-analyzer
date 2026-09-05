import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const targetProductionCommit = '46f5c70666e8f05c89203c6da417bd88aea7d05b'
const targetLocalHead = 'c417d6b5519ff371ac79a78c88c59605e26fcffe'
const migrationPath = 'supabase/migrations/202609050003_pick2_mlb_native_market_value_evaluations_v1.sql'
const artifactPath = 'docs/CERTIFICATION/mlb-data-02o-r2a-manual-native-value-schema-readback.json'
const auditPath = 'docs/CERTIFICATION/mlb-data-02o-r2a-manual-native-value-schema-readback.md'

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

function loadDotEnv(path) {
  if (!fs.existsSync(path)) return
  for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match || process.env[match[1]]) continue
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  }
}

async function productionVersion() {
  const response = await fetch('https://pick-analyzer.vercel.app/api/system/version', { cache: 'no-store' })
  if (!response.ok) throw new Error(`PRODUCTION_VERSION_HTTP_${response.status}`)
  const json = await response.json()
  return {
    commit: json.commit ?? json.gitCommit ?? json.version?.commit ?? json.deployment?.commit ?? json.VERCEL_GIT_COMMIT_SHA ?? json.git?.commit,
    providerCallsMade: json.providerCallsMade ?? 0,
  }
}

async function tableCount(client, table) {
  const { count, error } = await client.from(table).select('id', { count: 'exact', head: true })
  if (error) return { exists: false, count: null, error: { code: error.code, message: error.message } }
  return { exists: true, count, error: null }
}

async function readByValues(client, table, column, values, select = '*', chunkSize = 100) {
  const rows = []
  const errors = []
  for (let i = 0; i < values.length; i += chunkSize) {
    const chunk = values.slice(i, i + chunkSize)
    const { data, error } = await client.from(table).select(select).in(column, chunk)
    if (error) errors.push({ table, column, code: error.code, message: error.message })
    else rows.push(...(data ?? []))
  }
  return { rows, errors }
}

function unique(values) {
  return [...new Set(values)]
}

function validatePlannedRow(row) {
  return Number.isFinite(row.model_probability) &&
    Number.isFinite(row.raw_implied_probability) &&
    Number.isFinite(row.no_vig_probability) &&
    Number.isFinite(row.model_edge) &&
    Number.isFinite(row.unit_ev) &&
    Number.isFinite(row.consensus_probability) &&
    Number.isFinite(row.consensus_edge) &&
    Number.isFinite(row.market_dispersion) &&
    Number.isInteger(row.american_odds) &&
    row.american_odds !== 0 &&
    row.book_count >= 1 &&
    ['HOME', 'AWAY'].includes(row.side) &&
    row.freshness !== 'STALE' &&
    typeof row.evaluation_identity === 'string' &&
    row.evaluation_identity.length > 0
}

function renderAudit(artifact) {
  return `# MLB-DATA-02O-R2A Manual Native Value Schema Readback

Verdict: \`${artifact.certificationVerdict}\`

## Alignment

- Local HEAD: \`${artifact.repository.localHead}\`
- origin/main: \`${artifact.repository.originMain}\`
- Production: \`${artifact.production.commit}\`

## Manual Migration

Manual migration state: \`${artifact.manualMigration.MLB_02O_R2A_NATIVE_VALUE_MIGRATION_APPLIED}\`

Migration: \`${artifact.manualMigration.path}\`

## Schema

- Table readback: \`${artifact.schema.MLB_02O_R2A_NATIVE_VALUE_TABLE_READBACK}\`
- Column contract: \`${artifact.schema.MLB_02O_R2A_NATIVE_VALUE_COLUMN_CONTRACT}\`
- FK contract: \`${artifact.schema.fks.overall}\`
- Immutability: \`${artifact.schema.MLB_02O_R2A_IMMUTABILITY}\`
- RLS: \`${artifact.schema.MLB_02O_R2A_RLS}\`
- Index contract: \`${artifact.schema.MLB_02O_R2A_INDEX_CONTRACT}\`

## Dry Run

| plan rows | valid | invalid | missing source links | duplicate identities | inserts | reuses | conflicts |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ${artifact.dryFit.planRows} | ${artifact.dryFit.validRows} | ${artifact.dryFit.invalidRows} | ${artifact.dryFit.missingSourceLinkages} | ${artifact.dryFit.duplicateValueIdentities} | ${artifact.prewriteClassification.INSERT_ELIGIBLE} | ${artifact.prewriteClassification.REUSE_NO_OP} | ${artifact.prewriteClassification.BLOCK_CONFLICT} |

## Safety

- Native value DML: ${artifact.mutations.nativeValueDml}
- Other production DML: ${artifact.mutations.otherProductionDml}
- Codex production DDL: ${artifact.mutations.codexProductionDdl}
- Provider calls: ${artifact.mutations.providerCalls}
`
}

async function main() {
  loadDotEnv('.env.local')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_REST_READONLY_CREDENTIALS_MISSING')

  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const branch = git(['branch', '--show-current'])
  const localHead = git(['rev-parse', 'HEAD'])
  const originMain = git(['rev-parse', 'origin/main'])
  const worktreeBefore = git(['status', '--short'])
  const production = await productionVersion()
  const artifact02n = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-02n-current-moneyline-value-evaluation-prep.json', 'utf8'))
  const rows = artifact02n.valueCandidateRanking.bookLevelRows

  const legacyTable = await tableCount(client, 'pick2_market_value_evaluations')
  const nativeTable = await tableCount(client, 'pick2_mlb_market_value_evaluations')
  const plannedValueIdentities = unique(rows.map((row) => row.evaluation_identity))
  const plannedPredictionIds = unique(rows.map((row) => row.prediction_id))
  const plannedGamePks = unique(rows.map((row) => row.game_pk))
  const selectedObservationIdentities = unique(rows.map((row) => row.observation_identity))

  const predictions = await readByValues(client, 'pick2_game_predictions', 'id', plannedPredictionIds, 'id,game_pk')
  const games = await readByValues(client, 'pick2_mlb_games', 'game_pk', plannedGamePks, 'game_pk')
  const observations = await readByValues(
    client,
    'pick2_mlb_market_price_observations',
    'observation_identity',
    selectedObservationIdentities,
    'id,observation_identity,game_pk,side,bookmaker_key,market,provider_market_key,american_odds,provider_last_update,acquired_at'
  )
  const existingValues = nativeTable.exists
    ? await readByValues(client, 'pick2_mlb_market_value_evaluations', 'value_identity', plannedValueIdentities, 'id,value_identity,game_pk,side,model_probability,american_odds,edge,unit_ev')
    : { rows: [], errors: [{ table: 'pick2_mlb_market_value_evaluations', code: nativeTable.error?.code ?? 'TABLE_NOT_VISIBLE', message: nativeTable.error?.message ?? 'native table not visible' }] }

  const predictionIds = new Set(predictions.rows.map((row) => row.id))
  const gamePks = new Set(games.rows.map((row) => Number(row.game_pk)))
  const observationByIdentity = new Map(observations.rows.map((row) => [row.observation_identity, row]))
  const existingByIdentity = new Map(existingValues.rows.map((row) => [row.value_identity, row]))

  const duplicateValueIdentities = rows.length - plannedValueIdentities.length
  const invalidRows = rows.filter((row) => !validatePlannedRow(row)).length
  const missingSourceLinkages = rows.filter((row) => {
    const observation = observationByIdentity.get(row.observation_identity)
    return !predictionIds.has(row.prediction_id) ||
      !gamePks.has(Number(row.game_pk)) ||
      !observation ||
      Number(observation.game_pk) !== Number(row.game_pk) ||
      observation.side !== row.side ||
      observation.bookmaker_key !== row.bookmaker_key
  }).length

  let insertEligible = 0
  let reuseNoOp = 0
  let blockConflict = 0
  for (const row of rows) {
    const existing = existingByIdentity.get(row.evaluation_identity)
    if (!existing) {
      insertEligible += 1
      continue
    }
    const equivalent = Number(existing.game_pk) === Number(row.game_pk) &&
      existing.side === row.side &&
      Number(existing.american_odds) === Number(row.american_odds) &&
      Math.abs(Number(existing.model_probability) - row.model_probability) < 1e-12 &&
      Math.abs(Number(existing.edge) - row.model_edge) < 1e-12 &&
      Math.abs(Number(existing.unit_ev) - row.unit_ev) < 1e-12
    if (equivalent) reuseNoOp += 1
    else blockConflict += 1
  }

  const sourceLinkagePass = predictions.errors.length === 0 &&
    games.errors.length === 0 &&
    observations.errors.length === 0 &&
    missingSourceLinkages === 0
  const liveSchemaPass = nativeTable.exists &&
    existingValues.errors.length === 0 &&
    rows.length === 386 &&
    invalidRows === 0 &&
    duplicateValueIdentities === 0
  const classificationPass = liveSchemaPass &&
    sourceLinkagePass &&
    insertEligible + reuseNoOp === 386 &&
    blockConflict === 0

  const artifact = {
    generatedAt: new Date().toISOString(),
    project: 'MLB_DATA_02O_R2A_MANUAL_NATIVE_VALUE_SCHEMA_MIGRATION_APPLY_READBACK',
    certificationVerdict: classificationPass ? 'MLB_DATA_02O_R2A_NATIVE_VALUE_SCHEMA_PRODUCTION_CERTIFIED' : 'MLB_DATA_02O_R2A_NATIVE_VALUE_SCHEMA_PRODUCTION_BLOCKED',
    repository: {
      branch,
      localHead,
      originMain,
      worktreeCleanBeforeR2A: worktreeBefore === '',
      expectedLocalHead: targetLocalHead,
      expectedProductionCommit: targetProductionCommit,
      MLB_02O_R2A_ALIGNMENT: branch === 'main' && localHead === targetLocalHead && originMain === targetProductionCommit && production.commit === targetProductionCommit ? 'PASS' : 'FAIL',
    },
    production: {
      commit: production.commit,
      providerCallsMade: production.providerCallsMade,
      PRODUCTION_ALIGNMENT: production.commit === targetProductionCommit ? 'PASS' : 'FAIL',
    },
    manualMigration: {
      path: migrationPath,
      MLB_02O_R2A_NATIVE_VALUE_MIGRATION_APPLIED: 'YES_USER_CONFIRMED',
      MLB_02O_R2A_MANUAL_MIGRATION_STATE: 'PASS',
      codexReappliedMigration: false,
    },
    schema: {
      source: 'USER_SUPPLIED_SQL_CATALOG_READBACK_PLUS_READONLY_REST_TABLE_PROBES',
      MLB_02O_R2A_NATIVE_VALUE_TABLE_READBACK: nativeTable.exists ? 'PASS' : 'FAIL',
      MLB_02O_R2A_NATIVE_VALUE_COLUMN_CONTRACT: 'PASS_USER_SQL_EVIDENCE',
      fks: {
        prediction: 'PASS_USER_SQL_EVIDENCE',
        game: 'PASS_USER_SQL_EVIDENCE',
        homeMarket: 'PASS_USER_SQL_EVIDENCE',
        awayMarket: 'PASS_USER_SQL_EVIDENCE',
        selectedMarket: 'PASS_USER_SQL_EVIDENCE',
        modelVersion: 'PASS_USER_SQL_EVIDENCE',
        overall: 'PASS_USER_SQL_EVIDENCE',
      },
      MLB_02O_R2A_VALUE_IDENTITY_UNIQUENESS: 'PASS_USER_SQL_EVIDENCE',
      MLB_02O_R2A_UPDATE_GUARD: 'PASS_USER_SQL_EVIDENCE',
      MLB_02O_R2A_DELETE_GUARD: 'PASS_USER_SQL_EVIDENCE',
      MLB_02O_R2A_IMMUTABILITY: 'PASS_USER_SQL_EVIDENCE',
      MLB_02O_R2A_PROBABILITY_STORAGE: 'PASS_USER_SQL_EVIDENCE',
      MLB_02O_R2A_VALUE_NUMERIC_STORAGE: 'PASS_USER_SQL_EVIDENCE',
      MLB_02O_R2A_AMERICAN_ODDS_STORAGE: 'PASS_USER_SQL_EVIDENCE',
      MLB_02O_R2A_CHECK_CONTRACT: 'PASS_USER_SQL_EVIDENCE',
      MLB_02O_R2A_ELIGIBILITY_FLAGS: 'PASS_USER_SQL_EVIDENCE',
      MLB_02O_R2A_RISK_FLAGS: 'PASS_USER_SQL_EVIDENCE',
      MLB_02O_R2A_TEMPORAL_FIELDS: 'PASS_USER_SQL_EVIDENCE',
      MLB_02O_R2A_RLS: 'PASS_USER_SQL_EVIDENCE',
      MLB_02O_R2A_WRITE_SECURITY: 'PASS_USER_SQL_EVIDENCE',
      MLB_02O_R2A_INDEX_CONTRACT: 'PASS_USER_SQL_EVIDENCE',
    },
    legacy: {
      table: 'public.pick2_market_value_evaluations',
      exists: legacyTable.exists,
      count: legacyTable.count,
      MLB_02O_R2A_LEGACY_TABLE_PRESERVED: legacyTable.exists ? 'PASS' : 'FAIL',
      MLB_02O_R2A_LEGACY_NATIVE_COEXISTENCE: legacyTable.exists && nativeTable.exists ? 'PASS' : 'FAIL',
    },
    native: {
      table: 'public.pick2_mlb_market_value_evaluations',
      exists: nativeTable.exists,
      count: nativeTable.count,
      restError: nativeTable.error,
    },
    dryFit: {
      MLB_02O_R2A_02N_PLAN_REBUILD: rows.length === 386 && artifact02n.intersection.eligiblePregamePredictions === 21 && artifact02n.pairing.evaluatedBookLevelPairs === 193 ? 'PASS' : 'FAIL',
      MLB_02O_R2A_SOURCE_LINKAGE_DRY_RUN: sourceLinkagePass ? 'PASS' : 'FAIL',
      MLB_02O_R2A_LIVE_SCHEMA_DRY_FIT: liveSchemaPass ? 'PASS' : 'FAIL',
      MLB_02O_R2A_MATH_PAYLOAD_DRY_FIT: liveSchemaPass ? 'PASS' : 'FAIL',
      planRows: rows.length,
      eligibleGames: artifact02n.intersection.eligiblePregamePredictions,
      bookLevelPairs: artifact02n.pairing.evaluatedBookLevelPairs,
      validRows: rows.length - invalidRows,
      invalidRows,
      missingSourceLinkages,
      duplicateValueIdentities,
      sourceQueryErrors: [...predictions.errors, ...games.errors, ...observations.errors],
      nativeValueQueryErrors: existingValues.errors,
    },
    prewriteClassification: {
      MLB_02O_R2A_VALUE_PREWRITE_CLASSIFICATION: classificationPass ? 'PASS' : 'FAIL',
      INSERT_ELIGIBLE: insertEligible,
      REUSE_NO_OP: reuseNoOp,
      BLOCK_CONFLICT: blockConflict,
      MLB_02O_R2A_FUTURE_VALUE_DML_CAP_READY: classificationPass && insertEligible <= 386 ? 'YES' : 'NO',
      VALUE_INSERT_CAP: classificationPass ? insertEligible : 'NOT_READY',
      MLB_02O_R2A_VALUE_IDEMPOTENCY_PROJECTED: classificationPass ? 'PASS' : 'NO',
      secondPassProjection: classificationPass ? { INSERT_ELIGIBLE: 0, REUSE_NO_OP: 386, BLOCK_CONFLICT: 0 } : null,
    },
    mutations: {
      MLB_02O_R2A_PRODUCTION_DML: 0,
      nativeValueDml: 0,
      otherProductionDml: 0,
      userManualProductionDdl: 'YES_USER_CONFIRMED',
      codexProductionDdl: 0,
      providerCalls: 0,
      officialPicks: 0,
      valueBoard: 'NO',
    },
    readiness: {
      MLB_DATA_02O_R3_NATIVE_VALUE_PERSISTENCE_READY: classificationPass ? 'YES' : 'NO',
      MLB_DATA_02P_OFFICIAL_PICK_POLICY_PREP_READY: 'NO',
      MLB_DATA_02Q_VALUE_BOARD_PREP_READY: 'NO',
    },
  }

  fs.mkdirSync('docs/CERTIFICATION', { recursive: true })
  fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`)
  fs.writeFileSync(auditPath, renderAudit(artifact))
  console.log(JSON.stringify({
    certificationVerdict: artifact.certificationVerdict,
    productionCommit: artifact.production.commit,
    nativeTable: artifact.native,
    sourceLinkage: artifact.dryFit.MLB_02O_R2A_SOURCE_LINKAGE_DRY_RUN,
    liveSchemaDryFit: artifact.dryFit.MLB_02O_R2A_LIVE_SCHEMA_DRY_FIT,
    classification: artifact.prewriteClassification,
    readiness: artifact.readiness,
  }, null, 2))
  if (!classificationPass) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
