import fs from 'node:fs'

const artifact = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-02h-2026-current-foundation.json', 'utf8'))
const errors = []

function check(label, condition) {
  if (!condition) errors.push(label)
}

const certified = artifact.certificationVerdict === 'MLB_DATA_02H_2026_CURRENT_MLB_NATIVE_INGEST_AND_PREGAME_FEATURE_PREP_CERTIFIED'
const r2Certified = artifact.certificationVerdict === 'MLB_DATA_02H_R2_2026_RAW_INSERT_TIMEOUT_RESUME_AND_FEATURE_DML_COMPLETION_CERTIFIED'
const partial = artifact.certificationVerdict === 'MLB_DATA_02H_2026_CURRENT_MLB_NATIVE_INGEST_AND_PREGAME_FEATURE_PREP_PARTIAL'

check('verdict shape', certified || r2Certified || partial)
check('publication alignment', artifact.publication?.PRODUCTION_ALIGNMENT === 'PASS' && artifact.publication?.productionCommit === 'cc85c0d777511fcad9f9ecc8c2dec32a175ca268')
check('2025 baseline', artifact.baselines?.MLB_02H_2025_FOUNDATION_BASELINE === 'PASS' && artifact.baselines.before.raw2025 === 712528)
check('champion', artifact.baselines?.MLB_02H_CHAMPION_BASELINE === 'PASS' && artifact.baselines.champion.model_version === 'MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1')
check('prediction zero', artifact.baselines?.MLB_02H_PREDICTION_ZERO_BASELINE === 'PASS' && artifact.baselines.before.predictions === 0 && artifact.baselines.before.predictionResults === 0 && artifact.baselines.before.marketValues === 0)
check('date/cutoff', artifact.currentDateContract?.MLB_02H_CURRENT_DATE_CONTRACT === 'PASS' && artifact.currentDateContract?.MLB_02H_PERFORMANCE_CUTOFF_CONTRACT === 'PASS')
check('provider separation', artifact.sources?.MLB_02H_PROVIDER_SEPARATION === 'PASS' && artifact.sources.theOddsApiCalls === 0 && artifact.sources.ballDontLieCalls === 0 && artifact.sources.sportsDataIoCalls === 0)
check('schedule', artifact.scheduleInventory?.duplicateGamePk === 0 && artifact.statcastAcquisitionPlan?.MLB_02H_2026_STATCAST_ACQUISITION_PLAN === 'READY')
check('identity plans', artifact.playerIdentityPlan?.MLB_02H_2026_PLAYER_IDENTITY_PLAN === 'PASS' && artifact.ingestPlans?.nativeGame?.conflicts === 0 && artifact.ingestPlans?.nativePlayer?.conflicts === 0 && artifact.ingestPlans?.raw?.conflicts === 0)
check('raw quality', artifact.postIngest?.MLB_02H_2025_RAW_PRESERVED === 'PASS' && artifact.postIngest?.MLB_02H_2026_RAW_QUALITY === 'PASS')
check('feature contract', artifact.featureContract?.MLB_02H_FEATURE_VERSION_COMPATIBILITY === 'PASS' && artifact.featureContract?.MLB_02H_2026_FEATURE_SEMANTIC_PARITY === 'PASS' && artifact.featureContract?.MLB_02H_MONEYLINE_REQUIRED_DOMAIN_CONTRACT === 'PASS')
check('feature dry run', artifact.featureDryRun?.MLB_02H_2026_TEAM_FEATURE_DRY_RUN === 'PASS' && artifact.featureDryRun?.MLB_02H_2026_BULLPEN_FEATURE_DRY_RUN === 'PASS' && artifact.featureDryRun?.audit?.duplicateIdentities === 0)
check('feature safety', artifact.featureDryRun?.audit?.asOfViolations === 0 && artifact.featureDryRun?.audit?.leakageViolations === 0 && artifact.featureDryRun?.audit?.nullPolicyViolations === 0)
check('current readiness', artifact.currentInferenceReadiness?.MLB_02H_CURRENT_GAME_FEATURE_READINESS === 'READY' && artifact.currentInferenceReadiness?.MLB_02H_PREDICTION_EXECUTION === 'NO' && artifact.currentInferenceReadiness?.MLB_02H_LIVE_PROBABILITY_GENERATION === 'NO')
check('preservation', artifact.preservation?.MLB_02H_CHAMPION_PRESERVED === 'PASS' && artifact.preservation?.MLB_02H_MODEL_WORK_PERFORMED === 'NO' && artifact.preservation?.MLB_02H_VALUE_WORK_PERFORMED === 'NO')
check('reusability', artifact.reusability?.MLB_02H_INCREMENTAL_INGEST_CONTRACT === 'PASS' && artifact.reusability?.MLB_02H_DAILY_FEATURE_CONTRACT === 'PASS')
check('zero forbidden work', artifact.safety?.predictionWrites === 0 && artifact.safety?.predictionResultWrites === 0 && artifact.safety?.marketValueWrites === 0 && artifact.safety?.productionDdl === 0 && artifact.safety?.automation === 'OFF' && artifact.safety?.cronChanges === 0)

if (certified || r2Certified) {
  check('certified ingest executed', artifact.ingestPlans?.MLB_02H_2026_RAW_INGEST === 'PASS')
  check('certified feature parity', artifact.featurePersistence?.MLB_02H_2026_FEATURE_ROW_PARITY === 'PASS')
}

if (r2Certified) {
  const r2 = artifact.ingestPlans?.r2
  const digest = artifact.statcastAcquisitionPlan?.sourceIdentityDigest
  check('r2 production commit', artifact.publication?.publishedCommit === 'cc85c0d777511fcad9f9ecc8c2dec32a175ca268')
  check('r2 source rows', artifact.statcastAcquisitionPlan?.rawRowsAcquired === 622364 && artifact.statcastAcquisitionPlan?.gamesRepresented === 2108)
  check('r2 source digest', digest === '6ebfea5753706781db16f486bd8ad386d67f4e5ab214f3bde77ab7ac18c0f767')
  check('r2 raw resume strategy', r2?.MLB_02H_R2_TIMEOUT_SAFE_READBACK_STRATEGY === 'PASS' && r2?.safeRawBatchSize === 100)
  check('r2 raw final parity', artifact.postIngest?.raw2026Rows === 622364 && r2?.postResume?.existingCertified === 622364 && r2?.postResume?.missing === 0)
  check('r2 raw conflict guard', r2?.postResume?.conflicts === 0 && r2?.postResume?.unexpected === 0 && r2?.postResume?.duplicateExisting === 0)
  check('r2 native coverage', artifact.postIngest?.pitcherMlbamNullRows === 0 && artifact.postIngest?.batterMlbamNullRows === 0)
  check('r2 feature rebuilt', artifact.featureDryRun?.MLB_02H_R2_FEATURE_PLAN_REBUILT === 'PASS' && artifact.featureDryRun?.MLB_02H_R2_FEATURE_DML_CAPS_READY === 'YES')
  check('r2 feature postwrite', artifact.featurePersistence?.MLB_02H_R2_FEATURE_ROW_PARITY === 'PASS' && artifact.featurePersistence?.MLB_02H_R2_FEATURE_IDEMPOTENCY === 'PASS')
  check('r2 inference readiness', artifact.currentInferenceReadiness?.MLB_DATA_02I_CURRENT_MONEYLINE_DRY_INFERENCE_READY === 'YES')
}

if (errors.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-02h-2026-current-foundation-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-02h-2026-current-foundation-validate',
    status: 'PASS',
    classification: artifact.certificationVerdict,
    raw2026Rows: artifact.postIngest.raw2026Rows,
    completedGames: artifact.scheduleInventory.completedGamesBeforeCutoff,
    readyForDryInference: artifact.currentInferenceReadiness.readyForDryInference,
    predictionWrites: artifact.safety.predictionWrites,
  }, null, 2))
}
