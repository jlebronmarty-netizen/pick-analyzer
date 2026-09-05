import fs from 'node:fs'

const artifact = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-02h-2026-current-foundation.json', 'utf8'))
const errors = []

function check(label, condition) {
  if (!condition) errors.push(label)
}

const r2 = artifact.ingestPlans?.r2
const dryRun = artifact.featureDryRun
const persistence = artifact.featurePersistence
const postIngest = artifact.postIngest
const safety = artifact.safety

check('r2 verdict', artifact.certificationVerdict === 'MLB_DATA_02H_R2_2026_RAW_INSERT_TIMEOUT_RESUME_AND_FEATURE_DML_COMPLETION_CERTIFIED')
check('production alignment', artifact.publication?.PRODUCTION_ALIGNMENT === 'PASS' && artifact.publication?.productionCommit === 'cc85c0d777511fcad9f9ecc8c2dec32a175ca268')
check('source plan', artifact.statcastAcquisitionPlan?.rawRowsAcquired === 622364 && artifact.statcastAcquisitionPlan?.gamesRepresented === 2108)
check('source digest', artifact.statcastAcquisitionPlan?.sourceIdentityDigest === '6ebfea5753706781db16f486bd8ad386d67f4e5ab214f3bde77ab7ac18c0f767')
check('raw resume guard', r2?.MLB_02H_R2_RAW_CONFLICT_GUARD === 'PASS' && r2?.safeRawBatchSize === 100)
check('raw final parity', postIngest?.raw2026Rows === 622364 && r2?.postResume?.existingCertified === 622364 && r2?.postResume?.missing === 0)
check('raw clean identities', postIngest?.duplicatePitchIdentities === 0 && r2?.postResume?.unexpected === 0 && r2?.postResume?.duplicateExisting === 0 && r2?.postResume?.conflicts === 0)
check('native id coverage', postIngest?.pitcherMlbamNullRows === 0 && postIngest?.batterMlbamNullRows === 0)
check('2025 preservation', postIngest?.raw2025Rows === 712528 && postIngest?.MLB_02H_2025_RAW_PRESERVED === 'PASS')
check('feature target inventory', dryRun?.targetInventory?.completed === 2108 && dryRun?.targetInventory?.eligible === 1951 && dryRun?.targetInventory?.blockedIdentity === 0)
check('feature caps clean', dryRun?.audit?.duplicateIdentities === 0 && dryRun?.audit?.asOfViolations === 0 && dryRun?.audit?.leakageViolations === 0 && dryRun?.audit?.nullPolicyViolations === 0)
check('feature writes parity', persistence?.after?.snapshots2026 === 59031 && persistence?.after?.team2026 === 3902 && persistence?.after?.starter2026 === 3902 && persistence?.after?.bullpen2026 === 3902 && persistence?.after?.batter2026 === 39521 && persistence?.after?.matchup2026 === 1951 && persistence?.after?.firstInning2026 === 1951)
check('feature postwrite audits', persistence?.MLB_02H_R2_FEATURE_ROW_PARITY === 'PASS' && persistence?.MLB_02H_R2_FEATURE_NATIVE_KEY_UNIQUENESS === 'PASS' && persistence?.MLB_02H_R2_POSTWRITE_ASOF === 'PASS' && persistence?.MLB_02H_R2_POSTWRITE_LEAKAGE === 'PASS' && persistence?.MLB_02H_R2_FEATURE_IDEMPOTENCY === 'PASS')
check('current dry inference ready', artifact.currentInferenceReadiness?.MLB_DATA_02I_CURRENT_MONEYLINE_DRY_INFERENCE_READY === 'YES' && artifact.currentInferenceReadiness?.readyForDryInference === 37)
check('forbidden writes zero', safety?.predictionWrites === 0 && safety?.predictionResultWrites === 0 && safety?.marketValueWrites === 0 && safety?.modelWrites === 0 && safety?.championChanges === 0 && safety?.productionDdl === 0 && safety?.automation === 'OFF' && safety?.cronChanges === 0)

if (errors.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-02h-r2-2026-raw-resume-feature-completion-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-02h-r2-2026-raw-resume-feature-completion-validate',
    status: 'PASS',
    classification: artifact.certificationVerdict,
    raw2026Rows: postIngest.raw2026Rows,
    featureRows2026: persistence.after,
    readyForDryInference: artifact.currentInferenceReadiness.readyForDryInference,
  }, null, 2))
}
