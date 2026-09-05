import fs from 'node:fs'

const artifact = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-02o-r1-native-value-schema-repair-prep.json', 'utf8'))
const migration = fs.readFileSync('supabase/migrations/202609050003_pick2_mlb_native_market_value_evaluations_v1.sql', 'utf8')
const types = fs.readFileSync('src/types/pick2-native-market-value.ts', 'utf8')
const audit = fs.readFileSync('docs/CERTIFICATION/mlb-data-02o-r1-native-value-schema-repair-prep.md', 'utf8')
const errors = []

function check(label, condition) {
  if (!condition) errors.push(label)
}

check('verdict', artifact.certificationVerdict === 'MLB_DATA_02O_R1_NATIVE_VALUE_SCHEMA_REPAIR_PREP_CERTIFIED')
check('publication', artifact.publication?.PRODUCTION_ALIGNMENT === 'PASS' && artifact.publication?.productionCommit === '863e0a3825114b2fae1d52c76a72e2bf96e9fb94')
check('legacy inventory', artifact.legacySchema?.MLB_02O_R1_LEGACY_VALUE_SCHEMA_INVENTORY === 'COMPLETE')
check('legacy root', artifact.legacySchema?.MLB_02O_R1_LEGACY_ODDS_SNAPSHOT_ROOT === 'PASS')
check('legacy preserved', artifact.legacySchema?.MLB_02O_R1_LEGACY_VALUE_STATE_PRESERVED === 'PASS' && !/drop\s+table\s+public\.pick2_market_value_evaluations/i.test(migration))
check('strategy', artifact.storageStrategy?.MLB_02O_R1_SELECTED_NATIVE_VALUE_STORAGE_STRATEGY === 'OPTION_A' && artifact.storageStrategy?.nativeTableName === 'public.pick2_mlb_market_value_evaluations')
check('field contract', artifact.nativeContract?.MLB_02O_R1_NATIVE_VALUE_FIELD_CONTRACT === 'PASS' && migration.includes('create table if not exists public.pick2_mlb_market_value_evaluations'))
check('prediction fk', artifact.nativeContract?.MLB_02O_R1_PREDICTION_FK_CONTRACT === 'PASS' && migration.includes('prediction_id uuid not null references public.pick2_game_predictions(id)'))
check('game fk', artifact.nativeContract?.MLB_02O_R1_GAME_FK_CONTRACT === 'PASS' && migration.includes('game_pk bigint not null references public.pick2_mlb_games(game_pk)'))
check('market observation fks', artifact.nativeContract?.MLB_02O_R1_MARKET_OBSERVATION_FK_CONTRACT === 'PASS' && ['home_market_observation_id', 'away_market_observation_id', 'selected_side_market_observation_id'].every((column) => migration.includes(`${column} uuid not null references public.pick2_mlb_market_price_observations(id)`)))
check('pair consistency', artifact.nativeContract?.MLB_02O_R1_MARKET_PAIR_CONSISTENCY_CONTRACT === 'PASS' && migration.includes('home_market_observation_id <> away_market_observation_id'))
check('identity', artifact.nativeContract?.MLB_02O_R1_VALUE_IDENTITY_CONTRACT === 'PASS' && artifact.nativeContract?.MLB_02O_R1_VALUE_IDENTITY_COLLISION_GUARD === 'PASS')
check('unique key', artifact.nativeContract?.MLB_02O_R1_VALUE_UNIQUE_KEY_CONTRACT === 'PASS' && migration.includes('value_identity text not null unique'))
check('immutability', artifact.nativeContract?.MLB_02O_R1_VALUE_IMMUTABILITY_CONTRACT === 'PASS' && artifact.nativeContract?.MLB_02O_R1_VALUE_ROW_MUTATION_GUARD === 'PASS' && migration.includes('before update') && migration.includes('before delete'))
check('numeric', artifact.nativeContract?.MLB_02O_R1_PROBABILITY_STORAGE_CONTRACT === 'PASS' && artifact.nativeContract?.MLB_02O_R1_VALUE_NUMERIC_STORAGE_CONTRACT === 'PASS' && migration.includes('numeric(18,15)'))
check('odds', artifact.nativeContract?.MLB_02O_R1_AMERICAN_ODDS_STORAGE === 'PASS' && migration.includes('american_odds integer not null'))
check('checks', artifact.nativeContract?.MLB_02O_R1_VALUE_CHECK_CONTRACT === 'PASS' && migration.includes('model_probability > 0') && migration.includes('american_odds <> 0'))
check('book price temporal flags', artifact.nativeContract?.MLB_02O_R1_BOOK_IDENTITY_CONTRACT === 'PASS' && artifact.nativeContract?.MLB_02O_R1_PRICE_REFERENCE_SEPARATION === 'PASS' && artifact.nativeContract?.MLB_02O_R1_TEMPORAL_FIELD_CONTRACT === 'PASS' && artifact.nativeContract?.MLB_02O_R1_ELIGIBILITY_FLAG_CONTRACT === 'PASS' && artifact.nativeContract?.MLB_02O_R1_RISK_FLAG_CONTRACT === 'PASS')
check('no unsupported profitability', artifact.nativeContract?.MLB_02O_R1_NO_UNSUPPORTED_PROFITABILITY_SEMANTICS === 'PASS')
check('rls/read/index', artifact.nativeContract?.MLB_02O_R1_VALUE_RLS_CONTRACT === 'PASS' && artifact.nativeContract?.MLB_02O_R1_VALUE_READ_POLICY === 'READY' && artifact.nativeContract?.MLB_02O_R1_VALUE_INDEX_PLAN === 'PASS')
check('migration ready', artifact.migration?.MLB_02O_R1_FORWARD_MIGRATION_READY === 'YES' && artifact.migration?.MLB_02O_R1_MIGRATION_SAFETY === 'PASS' && artifact.migration?.productionApplied === false)
check('type contract', artifact.applicationContracts?.MLB_02O_R1_VALUE_TYPE_CONTRACT === 'READY' && types.includes('Pick2MlbMarketValueEvaluation'))
check('classifier', artifact.applicationContracts?.MLB_02O_R1_VALUE_INSERT_CLASSIFIER === 'READY' && types.includes('BLOCK_CONFLICT'))
check('readback contract', artifact.applicationContracts?.MLB_02O_R1_VALUE_READBACK_CONTRACT === 'READY')
check('02n dry fit', artifact.dryFit?.MLB_02O_R1_02N_PLAN_REBUILD === 'PASS' && artifact.dryFit?.planRows === 386 && artifact.dryFit?.eligibleGames === 21 && artifact.dryFit?.bookLevelPairs === 193)
check('schema dry fit', artifact.dryFit?.MLB_02O_R1_NATIVE_SCHEMA_DRY_FIT === 'PASS' && artifact.dryFit?.validRows === 386 && artifact.dryFit?.invalidRows === 0)
check('source linkage', artifact.dryFit?.MLB_02O_R1_SOURCE_LINKAGE_DRY_RUN === 'PASS' && artifact.dryFit?.missingSourceLinkages === 0)
check('math payload', artifact.dryFit?.MLB_02O_R1_MATH_PAYLOAD_DRY_RUN === 'PASS')
check('future cap', artifact.futureDml?.MLB_02O_R1_FUTURE_VALUE_DML_CAP_READY === 'YES' && artifact.futureDml?.firstPersistenceCap === 386)
check('idempotency', artifact.futureDml?.MLB_02O_R1_VALUE_IDEMPOTENCY_PROJECTED === 'PASS' && artifact.futureDml?.secondPassProjection?.reuses === 386)
check('coexistence', artifact.coexistence?.MLB_02O_R1_LEGACY_NATIVE_COEXISTENCE === 'PASS' && artifact.coexistence?.MLB_02O_R1_VALUE_CONSUMER_ROUTING === 'READY')
check('boundaries', artifact.boundaries?.MLB_02O_R1_OFFICIAL_PICK_WORK === 'NO' && artifact.boundaries?.MLB_02O_R1_VALUE_BOARD_WORK === 'NO' && artifact.boundaries?.MLB_02O_R1_PRODUCTION_DML === 0 && artifact.boundaries?.MLB_02O_R1_PRODUCTION_DDL === 0 && artifact.boundaries?.MLB_02O_R1_PROVIDER_CALLS === 0)
check('readiness', artifact.readiness?.MLB_DATA_02O_R2_NATIVE_VALUE_SCHEMA_MIGRATION_APPLY_READY === 'YES' && artifact.readiness?.MLB_DATA_02O_NATIVE_VALUE_PERSISTENCE_READY === 'NO')
check('audit', audit.includes('MLB-DATA-02O-R1 Native Value Schema Repair Prep') && audit.includes('public.pick2_mlb_market_value_evaluations'))

if (errors.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-02o-r1-native-value-schema-repair-prep-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-02o-r1-native-value-schema-repair-prep-validate',
    status: 'PASS',
    classification: artifact.certificationVerdict,
    migrationPath: artifact.migration.path,
    planRows: artifact.dryFit.planRows,
    validRows: artifact.dryFit.validRows,
    migrationApplyReady: artifact.readiness.MLB_DATA_02O_R2_NATIVE_VALUE_SCHEMA_MIGRATION_APPLY_READY,
  }, null, 2))
}
