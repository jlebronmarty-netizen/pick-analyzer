import fs from 'node:fs'

const artifact = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-02l-market-persistence-schema-prep.json', 'utf8'))
const migration = fs.readFileSync('supabase/migrations/202609050002_pick2_mlb_market_price_observations_v1.sql', 'utf8')
const types = fs.readFileSync('src/types/pick2-market-observations.ts', 'utf8')
const errors = []

function check(label, condition) {
  if (!condition) errors.push(label)
}

check('verdict', artifact.certificationVerdict === 'MLB_DATA_02L_CURRENT_MONEYLINE_MARKET_PERSISTENCE_SCHEMA_PREP_CERTIFIED')
check('publication', artifact.publication?.MLB_02L_PREPUBLISH_STATE === 'PASS' && artifact.publication?.PRODUCTION_ALIGNMENT === 'PASS')
check('02k scope', artifact.publication?.MLB_02L_02K_COMMIT_SCOPE_CERTIFIED === 'YES')
check('schema inventory', artifact.existingSchemaInventory?.MLB_02L_EXISTING_MARKET_SCHEMA_INVENTORY === 'COMPLETE')
check('crosswalk role', artifact.existingSchemaInventory?.tables?.pick2_mlb_market_event_mappings?.MLB_02L_CROSSWALK_TABLE_ROLE === 'PASS')
check('market value separated', artifact.existingSchemaInventory?.tables?.pick2_market_value_evaluations?.MLB_02L_MARKET_VALUE_SEPARATION === 'PASS')
check('strategy', artifact.storageDesign?.MLB_02L_SELECTED_PRICE_STORAGE_STRATEGY === 'OPTION_A')
check('migration table', migration.includes('create table if not exists public.pick2_mlb_market_price_observations'))
check('required fields', artifact.storageDesign?.MLB_02L_REQUIRED_FIELD_CONTRACT === 'PASS')
check('native game fk', artifact.storageDesign?.MLB_02L_NATIVE_GAME_FK_CONTRACT === 'PASS')
check('identity', artifact.identityContract?.MLB_02L_MARKET_OBSERVATION_IDENTITY === 'PASS')
check('timestamp collision', artifact.identityContract?.MLB_02L_TIMESTAMP_COLLISION_GUARD === 'PASS')
check('idempotency', artifact.identityContract?.MLB_02L_MARKET_IDEMPOTENCY_CONTRACT === 'PASS')
check('immutability', artifact.identityContract?.MLB_02L_MARKET_IMMUTABILITY_CONTRACT === 'PASS')
check('semantics', artifact.semantics?.MLB_02L_MARKET_SEMANTICS === 'PASS' && artifact.semantics?.MLB_02L_SIDE_SEMANTICS === 'PASS')
check('pairing', artifact.semantics?.MLB_02L_TWO_SIDED_PAIR_CONTRACT === 'PASS')
check('bookmaker', artifact.semantics?.MLB_02L_BOOKMAKER_KEY_CONTRACT === 'PASS' && artifact.semantics?.MLB_02L_MULTI_BOOK_PRESERVATION === 'PASS')
check('odds type', artifact.validationAndTime?.MLB_02L_AMERICAN_ODDS_DOMAIN === 'PASS' && artifact.validationAndTime?.americanOddsType === 'integer')
check('timestamps', artifact.validationAndTime?.MLB_02L_PROVIDER_TIMESTAMP_CONTRACT === 'PASS' && artifact.validationAndTime?.MLB_02L_ACQUIRED_AT_CONTRACT === 'PASS')
check('provenance', artifact.provenanceAndLinkage?.MLB_02L_SOURCE_PROVENANCE === 'PASS' && artifact.provenanceAndLinkage?.MLB_02L_RAW_PROVIDER_PAYLOAD_POLICY === 'READY')
check('crosswalk linkage', artifact.provenanceAndLinkage?.MLB_02L_CROSSWALK_LINKAGE_CONTRACT === 'PASS')
check('unmatched block', artifact.provenanceAndLinkage?.MLB_02L_UNMATCHED_EVENT_WRITE_POLICY === 'BLOCK')
check('unique/index', artifact.indexesAndSecurity?.MLB_02L_UNIQUE_KEY_CONTRACT === 'PASS' && artifact.indexesAndSecurity?.MLB_02L_INDEX_PLAN === 'PASS')
check('rls', artifact.indexesAndSecurity?.MLB_02L_RLS_CONTRACT === 'PASS')
check('migration safety', artifact.indexesAndSecurity?.MLB_02L_MIGRATION_SAFETY === 'PASS' && !/drop table|drop column|truncate|delete from|update public\./i.test(migration))
check('types', artifact.applicationContract?.MLB_02L_MARKET_OBSERVATION_TYPE_READY === 'YES' && types.includes('Pick2MlbMarketPriceObservation'))
check('classifier', artifact.applicationContract?.MLB_02L_MARKET_INSERT_CLASSIFIER_READY === 'YES')
check('readback', artifact.applicationContract?.MLB_02L_MARKET_READBACK_CONTRACT === 'READY')
check('02k sample reused', artifact.sampleDryRun?.MLB_02L_02K_SAMPLE_REUSED === 'YES' && artifact.sampleDryRun?.providerCalls === 0)
check('dry run', artifact.sampleDryRun?.MLB_02L_PRICE_SCHEMA_DRY_RUN === 'PASS' && artifact.sampleDryRun?.validRows === 286)
check('two sided dry run', artifact.sampleDryRun?.MLB_02L_TWO_SIDED_PAIR_DRY_RUN === 'PASS' && artifact.sampleDryRun?.twoSidedPairCount === 143)
check('multi book dry run', artifact.sampleDryRun?.MLB_02L_MULTI_BOOK_DRY_RUN === 'PASS' && artifact.sampleDryRun?.bookCount === 11)
check('game pk dry run', artifact.sampleDryRun?.MLB_02L_GAMEPK_PRICE_DRY_RUN === 'PASS' && artifact.sampleDryRun?.gamePkCount === 13)
check('future cap', artifact.futureDmlAndReadiness?.MLB_02L_FUTURE_MARKET_DML_CAP_READY === 'YES')
check('projected idempotency', artifact.futureDmlAndReadiness?.MLB_02L_MARKET_IDEMPOTENCY_PROJECTED === 'PASS')
check('prediction join', artifact.futureDmlAndReadiness?.MLB_02L_PREDICTION_MARKET_JOIN_SCHEMA === 'PASS')
check('novig support', artifact.futureDmlAndReadiness?.MLB_02L_NOVIG_STORAGE_SUPPORT === 'PASS')
check('historical limitation', artifact.futureDmlAndReadiness?.MLB_02L_HISTORICAL_LIMITATION_PRESERVED === 'PASS')
check('zero mutation', artifact.zeroMutationAndPreservation?.MLB_02L_MARKET_DML === 0 && artifact.zeroMutationAndPreservation?.MLB_02L_OTHER_DML === 0 && artifact.zeroMutationAndPreservation?.MLB_02L_PRODUCTION_DDL === 0)
check('no value work', artifact.zeroMutationAndPreservation?.MLB_02L_EDGE_WORK === 'NO' && artifact.zeroMutationAndPreservation?.MLB_02L_EV_WORK === 'NO')
check('provider calls', artifact.zeroMutationAndPreservation?.MLB_02L_PROVIDER_CALLS === 0)
check('preservation', artifact.zeroMutationAndPreservation?.MLB_02L_CHAMPION_PRESERVED === 'PASS' && artifact.zeroMutationAndPreservation?.MLB_02L_PREDICTIONS_PRESERVED === 'PASS')

if (errors.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-02l-market-persistence-schema-prep-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-02l-market-persistence-schema-prep-validate',
    status: 'PASS',
    classification: artifact.certificationVerdict,
    migrationPath: artifact.storageDesign.migrationPath,
    validDryRunRows: artifact.sampleDryRun.validRows,
    marketPersistenceReady: artifact.futureDmlAndReadiness.MLB_DATA_02M_CURRENT_MONEYLINE_MARKET_PERSISTENCE_READY,
  }, null, 2))
}
