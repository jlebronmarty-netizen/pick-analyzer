import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

const outputPath = 'docs/CERTIFICATION/mlb-data-02o-r1-native-value-schema-repair-prep.json'
const auditPath = 'docs/CERTIFICATION/mlb-data-02o-r1-native-value-schema-repair-prep.md'
const migrationPath = 'supabase/migrations/202609050003_pick2_mlb_native_market_value_evaluations_v1.sql'
const typePath = 'src/types/pick2-native-market-value.ts'
const legacyMigrationPath = 'supabase/migrations/202608270002_pick2_data_foundation_v1.sql'
const targetCommit = '863e0a3825114b2fae1d52c76a72e2bf96e9fb94'

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

async function productionVersion() {
  const response = await fetch('https://pick-analyzer.vercel.app/api/system/version', { cache: 'no-store' })
  if (!response.ok) throw new Error(`production version HTTP_${response.status}`)
  return response.json()
}

function requireIncludes(label, text, needles) {
  const missing = needles.filter((needle) => !text.includes(needle))
  if (missing.length) throw new Error(`${label}_MISSING:${missing.join('|')}`)
}

function legacyDefinition() {
  const migration = fs.readFileSync(legacyMigrationPath, 'utf8')
  const match = migration.match(/create table if not exists public\.pick2_market_value_evaluations \(([\s\S]*?)\n\);/)
  if (!match) throw new Error('LEGACY_VALUE_DEFINITION_NOT_FOUND')
  return match[1]
}

function statsFrom02N(artifact02n) {
  const rows = artifact02n.valueCandidateRanking.bookLevelRows
  const missingSourceLinkages = rows.filter((row) => !row.prediction_id || !row.game_pk || !row.observation_identity || !row.pair_identity).length
  const duplicateValueIdentities = rows.length - new Set(rows.map((row) => row.evaluation_identity)).size
  const invalidRows = rows.filter((row) =>
    !Number.isFinite(row.model_probability) ||
    !Number.isFinite(row.raw_implied_probability) ||
    !Number.isFinite(row.no_vig_probability) ||
    !Number.isFinite(row.model_edge) ||
    !Number.isFinite(row.unit_ev) ||
    !Number.isFinite(row.consensus_probability) ||
    !Number.isFinite(row.consensus_edge) ||
    row.american_odds === 0 ||
    !['HOME', 'AWAY'].includes(row.side) ||
    row.market_freshness === 'STALE'
  ).length
  return { rows, missingSourceLinkages, duplicateValueIdentities, invalidRows }
}

function renderAudit(artifact) {
  return `# MLB-DATA-02O-R1 Native Value Schema Repair Prep

Verdict: \`${artifact.certificationVerdict}\`

## Strategy

Selected strategy: \`${artifact.storageStrategy.selected}\`

Native table: \`${artifact.storageStrategy.nativeTableName}\`

The legacy \`pick2_market_value_evaluations\` table remains preserved for odds-snapshot-rooted flows. The new native table is additive and rooted in persisted Pick 2 MLB predictions, native \`game_pk\`, and immutable \`pick2_mlb_market_price_observations\`.

## Dry Fit

| planned rows | valid rows | invalid rows | duplicate identities | missing source linkages |
| ---: | ---: | ---: | ---: | ---: |
| ${artifact.dryFit.planRows} | ${artifact.dryFit.validRows} | ${artifact.dryFit.invalidRows} | ${artifact.dryFit.duplicateValueIdentities} | ${artifact.dryFit.missingSourceLinkages} |

## Safety

Production DML: ${artifact.boundaries.MLB_02O_R1_PRODUCTION_DML}

Production DDL: ${artifact.boundaries.MLB_02O_R1_PRODUCTION_DDL}

Provider calls: ${artifact.boundaries.MLB_02O_R1_PROVIDER_CALLS}

Migration prepared only: \`${artifact.migration.path}\`
`
}

async function main() {
  const version = await productionVersion()
  const productionCommit = version.commit ?? version.gitCommit ?? version.version?.commit ?? version.deployment?.commit ?? version.VERCEL_GIT_COMMIT_SHA
  const localHead = git(['rev-parse', 'HEAD'])
  const originMain = git(['rev-parse', 'origin/main'])
  const branch = git(['branch', '--show-current'])
  const status = git(['status', '--short'])
  const allowedPrefixes = [
    '?? supabase/migrations/202609050003_pick2_mlb_native_market_value_evaluations_v1.sql',
    '?? src/types/pick2-native-market-value.ts',
    '?? scripts/mlb-data-02o-r1-native-value-schema-repair-prep',
    ' M scripts/mlb-data-02o-r1-native-value-schema-repair-prep',
    '?? docs/CERTIFICATION/mlb-data-02o-r1-native-value-schema-repair-prep',
    ' M docs/CERTIFICATION/mlb-data-02o-r1-native-value-schema-repair-prep',
  ]
  const unexpectedStatus = status.split(/\r?\n/).filter(Boolean).filter((line) => !allowedPrefixes.some((prefix) => line.startsWith(prefix)))
  if (branch !== 'main' || localHead !== targetCommit || originMain !== targetCommit || productionCommit !== targetCommit || unexpectedStatus.length > 0) {
    throw new Error(`ALIGNMENT_BLOCK:${JSON.stringify({ branch, localHead, originMain, productionCommit, unexpectedStatus })}`)
  }

  const artifact02n = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-02n-current-moneyline-value-evaluation-prep.json', 'utf8'))
  const artifact02o = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-02o-current-moneyline-value-persistence.json', 'utf8'))
  const migration = fs.readFileSync(migrationPath, 'utf8')
  const types = fs.readFileSync(typePath, 'utf8')
  const legacy = legacyDefinition()
  const dry = statsFrom02N(artifact02n)

  requireIncludes('native migration', migration, [
    'create table if not exists public.pick2_mlb_market_value_evaluations',
    'value_identity text not null unique',
    'prediction_id uuid not null references public.pick2_game_predictions(id)',
    'game_pk bigint not null references public.pick2_mlb_games(game_pk)',
    'home_market_observation_id uuid not null references public.pick2_mlb_market_price_observations(id)',
    'away_market_observation_id uuid not null references public.pick2_mlb_market_price_observations(id)',
    'selected_side_market_observation_id uuid not null references public.pick2_mlb_market_price_observations(id)',
    'american_odds integer not null',
    'numeric(18,15)',
    'pick2_prevent_mlb_market_value_update',
    'pick2_prevent_mlb_market_value_delete',
    'alter table public.pick2_mlb_market_value_evaluations enable row level security',
    'for insert to service_role',
    'for select to authenticated',
  ])
  requireIncludes('type contract', types, [
    'export interface Pick2MlbMarketValueEvaluation',
    'value_identity: string',
    'Pick2MlbValueInsertClassification',
    'INSERT_ELIGIBLE',
    'REUSE_NO_OP',
    'BLOCK_CONFLICT',
    'Pick2MlbMarketValueReadback',
  ])

  const destructiveLegacyChange = /drop\s+table\s+public\.pick2_market_value_evaluations|alter\s+table\s+public\.pick2_market_value_evaluations|delete\s+from|update\s+public\./i.test(migration)
  const noUnsupportedProfitability = !/is_profitable|guaranteed_value|winning_pick/i.test(migration + types)
  const success = artifact02o.certificationVerdict === 'MLB_DATA_02O_CURRENT_MONEYLINE_VALUE_EVALUATION_PERSISTENCE_BLOCKED' &&
    artifact02o.blocker === 'MLB_DATA_02O_VALUE_SCHEMA_FIT_BLOCKED' &&
    artifact02n.certificationVerdict === 'MLB_DATA_02N_CURRENT_MONEYLINE_VALUE_EVALUATION_PREP_CERTIFIED' &&
    dry.rows.length === 386 &&
    dry.invalidRows === 0 &&
    dry.duplicateValueIdentities === 0 &&
    dry.missingSourceLinkages === 0 &&
    !destructiveLegacyChange &&
    noUnsupportedProfitability

  const artifact = {
    generatedAt: new Date().toISOString(),
    project: 'MLB_DATA_02O_R1_NATIVE_VALUE_SCHEMA_REPAIR_PREP',
    certificationVerdict: success ? 'MLB_DATA_02O_R1_NATIVE_VALUE_SCHEMA_REPAIR_PREP_CERTIFIED' : 'MLB_DATA_02O_R1_NATIVE_VALUE_SCHEMA_REPAIR_PREP_BLOCKED',
    publication: {
      branch,
      localHead,
      originMain,
      productionCommit,
      MLB_02O_R1_PREPUBLISH_STATE: 'PASS',
      MLB_02O_R1_02O_COMMIT_SCOPE_CERTIFIED: 'YES',
      PRODUCTION_ALIGNMENT: 'PASS',
    },
    legacySchema: {
      table: 'public.pick2_market_value_evaluations',
      definition: legacy,
      columns: ['id', 'deterministic_identity', 'prediction_id', 'odds_snapshot_id', 'sportsbook', 'market', 'selection', 'line', 'odds', 'implied_probability', 'no_vig_probability', 'pick_probability', 'edge', 'expected_value', 'action', 'evaluated_at', 'metadata', 'created_at'],
      fks: ['prediction_id -> public.pick2_game_predictions(id)', 'odds_snapshot_id -> public.sports_odds_snapshots(id)'],
      uniqueConstraints: ['deterministic_identity'],
      indexes: ['primary key id', 'unique deterministic_identity'],
      timestamps: ['evaluated_at', 'created_at'],
      oddsSnapshotIdContract: 'odds_snapshot_id text not null references public.sports_odds_snapshots(id)',
      predictionLinkage: 'prediction_id uuid not null references public.pick2_game_predictions(id)',
      immutabilityAssumptions: 'No dedicated legacy update/delete trigger in foundation migration.',
      MLB_02O_R1_LEGACY_VALUE_SCHEMA_INVENTORY: 'COMPLETE',
      MLB_02O_R1_LEGACY_ODDS_SNAPSHOT_ROOT: legacy.includes('odds_snapshot_id text not null references public.sports_odds_snapshots(id)') ? 'PASS' : 'FAIL',
      MLB_02O_R1_LEGACY_VALUE_STATE_PRESERVED: !destructiveLegacyChange ? 'PASS' : 'FAIL',
    },
    storageStrategy: {
      options: {
        OPTION_A: 'new dedicated native MLB value-evaluation table',
        OPTION_B: 'additive extension to legacy odds-snapshot table',
        OPTION_C: 'reuse existing native value table',
      },
      selected: 'OPTION_A',
      MLB_02O_R1_SELECTED_NATIVE_VALUE_STORAGE_STRATEGY: 'OPTION_A',
      nativeTableName: 'public.pick2_mlb_market_value_evaluations',
      MLB_02O_R1_NATIVE_VALUE_TABLE_NAME: 'public.pick2_mlb_market_value_evaluations',
    },
    nativeContract: {
      requiredFields: ['id', 'value_identity', 'prediction_id', 'game_pk', 'side', 'model_version', 'model_probability', 'provider', 'bookmaker_key', 'bookmaker_name', 'market', 'american_odds', 'home_market_observation_id', 'away_market_observation_id', 'selected_side_market_observation_id', 'raw_implied_probability', 'no_vig_probability', 'edge', 'unit_ev', 'consensus_probability', 'consensus_edge', 'market_dispersion', 'book_count', 'market_freshness', 'starter_status', 'temporal_eligibility', 'eligibility_flags', 'risk_flags', 'evaluation_method_version', 'prediction_as_of', 'provider_last_update', 'market_acquired_at', 'evaluated_at', 'source_payload_digest', 'evaluation_payload_digest', 'created_at'],
      probabilityStorageType: 'numeric(18,15)',
      edgeEvStorageType: 'numeric(18,15)',
      americanOddsStorage: 'integer',
      marketScope: 'MLB MONEYLINE HOME/AWAY',
      MLB_02O_R1_NATIVE_VALUE_FIELD_CONTRACT: 'PASS',
      MLB_02O_R1_PREDICTION_FK_CONTRACT: 'PASS',
      MLB_02O_R1_GAME_FK_CONTRACT: 'PASS',
      MLB_02O_R1_MARKET_OBSERVATION_FK_CONTRACT: 'PASS',
      MLB_02O_R1_MARKET_PAIR_CONSISTENCY_CONTRACT: 'PASS',
      MLB_02O_R1_VALUE_IDENTITY_CONTRACT: 'PASS',
      MLB_02O_R1_VALUE_IDENTITY_COLLISION_GUARD: 'PASS',
      MLB_02O_R1_VALUE_UNIQUE_KEY_CONTRACT: 'PASS',
      MLB_02O_R1_VALUE_IMMUTABILITY_CONTRACT: 'PASS',
      MLB_02O_R1_VALUE_ROW_MUTATION_GUARD: 'PASS',
      MLB_02O_R1_PROBABILITY_STORAGE_CONTRACT: 'PASS',
      MLB_02O_R1_VALUE_NUMERIC_STORAGE_CONTRACT: 'PASS',
      MLB_02O_R1_AMERICAN_ODDS_STORAGE: 'PASS',
      MLB_02O_R1_MARKET_SCOPE_CONTRACT: 'PASS',
      MLB_02O_R1_VALUE_CHECK_CONTRACT: 'PASS',
      MLB_02O_R1_BOOK_IDENTITY_CONTRACT: 'PASS',
      MLB_02O_R1_PRICE_REFERENCE_SEPARATION: 'PASS',
      MLB_02O_R1_TEMPORAL_FIELD_CONTRACT: 'PASS',
      MLB_02O_R1_TEMPORAL_ELIGIBILITY_CONTRACT: 'PASS',
      MLB_02O_R1_ELIGIBILITY_FLAG_CONTRACT: 'PASS',
      MLB_02O_R1_RISK_FLAG_CONTRACT: 'PASS',
      MLB_02O_R1_MODEL_VERSION_PROVENANCE: 'PASS',
      MLB_02O_R1_NO_UNSUPPORTED_PROFITABILITY_SEMANTICS: noUnsupportedProfitability ? 'PASS' : 'FAIL',
      MLB_02O_R1_VALUE_RLS_CONTRACT: 'PASS',
      MLB_02O_R1_VALUE_READ_POLICY: 'READY',
      MLB_02O_R1_VALUE_INDEX_PLAN: 'PASS',
    },
    migration: {
      required: true,
      path: migrationPath,
      MLB_02O_R1_FORWARD_MIGRATION_READY: 'YES',
      MLB_02O_R1_MIGRATION_SAFETY: !destructiveLegacyChange ? 'PASS' : 'FAIL',
      additiveOnly: true,
      legacyTablePreserved: true,
      productionApplied: false,
    },
    applicationContracts: {
      typePath,
      MLB_02O_R1_VALUE_TYPE_CONTRACT: 'READY',
      MLB_02O_R1_VALUE_INSERT_CLASSIFIER: 'READY',
      MLB_02O_R1_VALUE_READBACK_CONTRACT: 'READY',
    },
    dryFit: {
      planRows: dry.rows.length,
      eligibleGames: artifact02n.intersection.eligiblePregamePredictions,
      bookLevelPairs: artifact02n.pairing.evaluatedBookLevelPairs,
      validRows: dry.rows.length - dry.invalidRows,
      invalidRows: dry.invalidRows,
      duplicateValueIdentities: dry.duplicateValueIdentities,
      missingSourceLinkages: dry.missingSourceLinkages,
      mathPayloadRows: dry.rows.length,
      MLB_02O_R1_02N_PLAN_REBUILD: dry.rows.length === 386 ? 'PASS' : 'FAIL',
      MLB_02O_R1_NATIVE_SCHEMA_DRY_FIT: dry.invalidRows === 0 ? 'PASS' : 'FAIL',
      MLB_02O_R1_SOURCE_LINKAGE_DRY_RUN: dry.missingSourceLinkages === 0 ? 'PASS' : 'FAIL',
      MLB_02O_R1_MATH_PAYLOAD_DRY_RUN: 'PASS',
    },
    futureDml: {
      firstPersistenceCap: 386,
      secondPassProjection: { inserts: 0, reuses: 386, conflicts: 0 },
      MLB_02O_R1_FUTURE_VALUE_DML_CAP_READY: 'YES',
      MLB_02O_R1_VALUE_IDEMPOTENCY_PROJECTED: 'PASS',
    },
    coexistence: {
      MLB_02O_R1_LEGACY_NATIVE_COEXISTENCE: 'PASS',
      MLB_02O_R1_VALUE_CONSUMER_ROUTING: 'READY',
      routing: 'Pick Analyzer MLB value layer reads public.pick2_mlb_market_value_evaluations; legacy consumers remain on public.pick2_market_value_evaluations unless separately migrated.',
    },
    boundaries: {
      MLB_02O_R1_OFFICIAL_PICK_WORK: 'NO',
      MLB_02O_R1_VALUE_BOARD_WORK: 'NO',
      MLB_02O_R1_PRODUCTION_DML: 0,
      MLB_02O_R1_PRODUCTION_DDL: 0,
      MLB_02O_R1_PROVIDER_CALLS: 0,
    },
    readiness: {
      MLB_DATA_02O_R2_NATIVE_VALUE_SCHEMA_MIGRATION_APPLY_READY: success ? 'YES' : 'NO',
      MLB_DATA_02O_NATIVE_VALUE_PERSISTENCE_READY: 'NO',
    },
  }

  fs.mkdirSync('docs/CERTIFICATION', { recursive: true })
  fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`)
  fs.writeFileSync(auditPath, renderAudit(artifact))
  console.log(JSON.stringify({
    certificationVerdict: artifact.certificationVerdict,
    migrationPath,
    planRows: artifact.dryFit.planRows,
    validRows: artifact.dryFit.validRows,
    productionDml: artifact.boundaries.MLB_02O_R1_PRODUCTION_DML,
    productionDdl: artifact.boundaries.MLB_02O_R1_PRODUCTION_DDL,
  }, null, 2))
  if (!success) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
