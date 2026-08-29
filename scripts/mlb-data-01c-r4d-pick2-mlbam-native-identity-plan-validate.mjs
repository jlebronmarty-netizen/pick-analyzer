import fs from 'node:fs'

const artifactPath = 'docs/CERTIFICATION/mlb-data-01c-r4d-pick2-mlbam-native-identity-plan.json'
const docPath = 'docs/CERTIFICATION/MLB_DATA_01C_R4D_PICK2_MLBAM_NATIVE_IDENTITY_PLAN.md'
const scriptPath = 'scripts/mlb-data-01c-r4d-pick2-mlbam-native-identity-plan.mjs'
const migrationPath = 'supabase/migrations/202608270002_pick2_data_foundation_v1.sql'
const statusPath = 'docs/PROJECT_STATUS.md'
const roadmapPath = 'docs/MASTER_ROADMAP.md'
const errors = []

function read(file) {
  return fs.readFileSync(file, 'utf8')
}

function json(file) {
  return JSON.parse(read(file))
}

function check(label, condition) {
  if (!condition) errors.push(label)
}

const artifact = json(artifactPath)
const doc = read(docPath)
const script = read(scriptPath)
const migration = read(migrationPath)
const status = read(statusPath)
const roadmap = read(roadmapPath)

check('R4D verdict certified', artifact.certificationVerdict === 'MLB_DATA_01C_R4D_PICK2_MLBAM_NATIVE_IDENTITY_PLAN_CERTIFIED')
check('baseline ready', artifact.baseline.R4D_BASELINE_READY === true && artifact.baseline.preEditWorktreeClean === 'VERIFIED_BY_GATE_1_BEFORE_R4D_FILE_EDITS')
check('SportsDataIO removed from Pick 2 identity', artifact.sportsDataIoDecision.SPORTSDATAIO_MLB_REQUIRED_BY_PICK2 === 'NO' && artifact.sportsDataIoDecision.SPORTSDATAIO_MLB_AUTH_REPAIR_REQUIRED === 'NO' && artifact.sportsDataIoDecision.SPORTSDATAIO_MLB_IDENTITY_DEPENDENCY_DEPRECATED_FOR_PICK2 === 'YES')
check('dependency audit complete', artifact.currentIdentityDependencyAudit.PICK2_MLB_IDENTITY_DEPENDENCY_AUDIT_COMPLETE === 'YES' && artifact.currentIdentityDependencyAudit.matrix.length >= 10)
check('current schema dependency evidence preserved', migration.includes('event_id text not null references public.sport_events(id)') && migration.includes('player_id text not null references public.sport_players(id)'))
check('native game identity ready', artifact.nativeGameIdentity.PICK2_MLB_GAMEPK_CANONICAL_IDENTITY_READY === 'YES' && artifact.nativeGameIdentity.coverage.PICK2_NATIVE_GAME_IDENTITY_COVERAGE === '2430 / 2430')
check('legacy event optional', artifact.nativeGameIdentity.LEGACY_EVENT_LINK_OPTIONAL_FOR_PICK2 === 'YES' && artifact.nativeGameIdentity.SEVEN_LEGACY_EVENT_GAPS_BLOCK_PICK2 === 'NO')
check('native player identity ready', artifact.nativePlayerIdentity.PICK2_MLBAM_PLAYER_CANONICAL_IDENTITY_READY === 'YES' && artifact.nativePlayerIdentity.PICK2_MLBAM_PLAYER_CARDINALITY_CONTRACT === 'PASS')
check('legacy player gaps nonblocking', artifact.nativePlayerIdentity.LEGACY_PLAYER_LINK_OPTIONAL_FOR_PICK2 === 'YES' && artifact.nativePlayerIdentity.NAME_AUDIT_ONLY_PLAYER_GAPS_BLOCK_PICK2 === 'NO' && artifact.nativePlayerIdentity.AMBIGUOUS_LEGACY_PLAYER_GAPS_BLOCK_PICK2 === 'NO' && artifact.nativePlayerIdentity.TRUE_MISSING_LEGACY_PLAYER_GAPS_BLOCK_PICK2 === 'NO')
check('native player coverage full', artifact.nativePlayerIdentity.coverage.PICK2_NATIVE_PLAYER_IDENTITY_COVERAGE === '1469 / 1469')
check('raw semantics ready', artifact.rawIdentitySemantics.PICK2_RAW_NATIVE_IDENTITY_SEMANTICS_READY === 'YES' && artifact.rawIdentitySemantics.RAW_LEGACY_MAPPING_FIELDS_REQUIRED_FOR_PICK2 === 'NO')
check('feature native identity ready', artifact.featureIdentityContract.PICK2_FEATURE_NATIVE_IDENTITY_CONTRACT_READY === 'YES' && artifact.featureIdentityContract.STARTER_NATIVE_IDENTITY_READY === 'YES' && artifact.featureIdentityContract.BULLPEN_NATIVE_IDENTITY_READY === 'YES' && artifact.featureIdentityContract.BATTER_OFFENSE_NATIVE_IDENTITY_READY === 'YES' && artifact.featureIdentityContract.MATCHUP_NATIVE_IDENTITY_READY === 'YES' && artifact.featureIdentityContract.FIRST_INNING_NATIVE_IDENTITY_READY === 'YES')
check('label/prediction/market contracts ready', artifact.labelPredictionMarketContracts.PICK2_GAME_LABEL_GAMEPK_CONTRACT_READY === 'YES' && artifact.labelPredictionMarketContracts.PICK2_NATIVE_IDENTITY_ASOF_LEAKAGE_CONTRACT === 'PASS' && artifact.labelPredictionMarketContracts.PICK2_PREDICTION_NATIVE_GAME_IDENTITY_READY === 'YES' && artifact.labelPredictionMarketContracts.PICK2_RESULT_GAMEPK_EVALUATION_READY === 'YES' && artifact.labelPredictionMarketContracts.THE_ODDS_API_MARKET_LAYER_SEPARATED === 'YES' && artifact.labelPredictionMarketContracts.ODDS_MARKET_CROSSWALK_CONTRACT_READY === 'YES')
check('provider matrix ready', artifact.providerStrategy.PICK2_MLB_PROVIDER_RESPONSIBILITY_MATRIX_READY === 'YES' && artifact.providerStrategy.PICK2_MLB_CORE_REQUIRES_PAID_SPORTS_DATA_PROVIDER === 'NO')
check('2025/2026/daily contracts ready', artifact.ingestTransition['2025_NATIVE_IDENTITY_TRANSITION_WITHOUT_REIMPORT'] === 'YES' && artifact.ingestTransition['2026_NATIVE_IDENTITY_IMPORT_CONTRACT_READY'] === 'YES' && artifact.ingestTransition.DAILY_NATIVE_IDENTITY_INGEST_READY === 'YES' && artifact.ingestTransition.MLB_OFFICIAL_NATIVE_IDENTITY_CACHE_READY === 'YES')
check('legacy isolation ready', artifact.legacyIsolation.MLB_SPORT_EVENTS_LEGACY_ISOLATION_READY === 'YES' && artifact.legacyIsolation.MLB_SPORT_PLAYERS_LEGACY_ISOLATION_READY === 'YES' && artifact.legacyIsolation.OPTIONAL_LEGACY_CROSSWALK_FUTURE_SAFE === 'YES')
check('additive migration contract ready', artifact.migrationDesign.R4D_ADDITIVE_MIGRATION_CONTRACT === 'PASS' && artifact.migrationDesign.TABLES_NEW.includes('pick2_mlb_games') && artifact.migrationDesign.TABLES_NEW.includes('pick2_mlb_players'))
check('backfill/idempotency ready', artifact.backfillAndReadiness.R4D_NATIVE_IDENTITY_BACKFILL_PLAN_READY === 'YES' && artifact.backfillAndReadiness.R4D_NATIVE_IDENTITY_IDEMPOTENCY_READY === 'YES')
check('01D projected ready but actual no', artifact.backfillAndReadiness.LEGACY_IDENTITY_NO_LONGER_BLOCKS_01D_BY_DESIGN === 'YES' && artifact.backfillAndReadiness.MLB_DATA_01D_2025_FEATURE_BUILD_READY === 'NO' && artifact.backfillAndReadiness.MLB_DATA_01D_PROJECTED_READY_AFTER_NATIVE_IDENTITY_MIGRATION === 'YES')
check('old R5 retired and new R5 ready', artifact.backfillAndReadiness.LEGACY_R5_PERSISTENCE_PLAN_RETIRED === 'YES' && artifact.backfillAndReadiness.R5_NATIVE_IDENTITY_PHASE_PLAN_READY === 'YES')
check('UI clean start preserved', artifact.uiImpact.PICK2_UI_CLEAN_START_PRESERVED_BY_NATIVE_IDENTITY_PLAN === 'YES' && artifact.uiImpact.champion === 'NONE' && artifact.uiImpact.predictionsDisplayed === 0)
check('zero provider calls', artifact.safety.providerCalls === 0 && artifact.safety.sportsDataIoCalls === 0 && artifact.safety.mlbOfficialCalls === 0 && artifact.safety.theOddsApiCalls === 0 && artifact.safety.ballDontLieCalls === 0)
check('zero production mutations and writes', artifact.safety.productionDmlMutations === 0 && artifact.safety.productionSchemaMutations === 0 && artifact.safety.canonicalInserts === 0 && artifact.safety.crosswalkWrites === 0 && artifact.safety.rawMappingWrites === 0 && artifact.safety.featureWrites === 0 && artifact.safety.modelWrites === 0 && artifact.safety.predictionWrites === 0 && artifact.safety.imports2026 === 0)
check('raw stability preserved', artifact.rawStability.rawRows === 712528 && artifact.rawStability.uniquePitchIdentities === 712528 && artifact.rawStability.duplicatePitchIdentities === 0 && artifact.rawStability.rawPayloadUnchanged === true && artifact.rawStability.rawPayloadDigestUnchanged === true)
check('feature/model/prediction boundary preserved', artifact.featureModelPredictionBoundary.features === 0 && artifact.featureModelPredictionBoundary.models === 0 && artifact.featureModelPredictionBoundary.champion === 'NONE' && artifact.featureModelPredictionBoundary.predictions === 0)
check('generator has no provider fetch', !script.includes('fetch(') && !script.includes('api.sportsdata.io') && !script.includes('statsapi.mlb.com'))
check('generator has no production mutation API', !/\.(insert|upsert|delete|update)\s*\(/.test(script))
check('doc includes verdict', doc.includes(artifact.certificationVerdict))
check('status updated', status.includes('MLB-DATA-01C-R4D') && status.includes(artifact.certificationVerdict))
check('roadmap updated', roadmap.includes('MLB-DATA-01C-R4D') && roadmap.includes(artifact.certificationVerdict))

const secretPattern = /(SUPABASE_SERVICE_ROLE_KEY\s*=|CRON_SECRET\s*=|Bearer\s+[A-Za-z0-9._-]+|eyJ[A-Za-z0-9._-]{20,}|SPORTSDATAIO_MLB_API_KEY\s*=\s*\S+)/
for (const [label, content] of [
  ['artifact', JSON.stringify(artifact)],
  ['doc', doc],
  ['script', script],
  ['status', status],
  ['roadmap', roadmap],
]) {
  check(`${label} contains no obvious secret material`, !secretPattern.test(content))
}

if (errors.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-01c-r4d-pick2-mlbam-native-identity-plan-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-01c-r4d-pick2-mlbam-native-identity-plan-validate',
    status: 'PASS',
    certificationVerdict: artifact.certificationVerdict,
    nativeGameCoverage: artifact.nativeGameIdentity.coverage.PICK2_NATIVE_GAME_IDENTITY_COVERAGE,
    nativePlayerCoverage: artifact.nativePlayerIdentity.coverage.PICK2_NATIVE_PLAYER_IDENTITY_COVERAGE,
    projected01dReadyAfterMigration: artifact.backfillAndReadiness.MLB_DATA_01D_PROJECTED_READY_AFTER_NATIVE_IDENTITY_MIGRATION,
    providerCalls: artifact.safety.providerCalls,
    productionDmlMutations: artifact.safety.productionDmlMutations,
  }, null, 2))
}
