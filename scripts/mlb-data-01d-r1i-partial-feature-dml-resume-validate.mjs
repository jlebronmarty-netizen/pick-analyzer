import fs from 'node:fs'

const artifactPath = 'docs/CERTIFICATION/mlb-data-01d-r1i-partial-feature-dml-resume.json'
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'))
const errors = []

function check(label, condition) {
  if (!condition) errors.push(label)
}

const flags = artifact.flags ?? {}

check('final verdict', artifact.certificationVerdict === 'MLB_DATA_01D_R1I_PARTIAL_FEATURE_DML_RESUME_CERTIFIED')
check('R1H final verdict', artifact.r1hManualCatalogEvidence?.r1hFinalCertificationVerdict === 'MLB_DATA_01D_R1H_BULLPEN_UNIQUENESS_MIGRATION_PRODUCTION_CERTIFIED')
check('R1H migration user-confirmed', artifact.r1hManualCatalogEvidence?.R1H_BULLPEN_UNIQUENESS_MIGRATION_APPLIED === 'YES_USER_CONFIRMED')
check('legacy removed', artifact.r1hManualCatalogEvidence?.R1H_LEGACY_BULLPEN_UNIQUENESS_REMOVED === 'PASS')
check('native readback', artifact.r1hManualCatalogEvidence?.R1H_BULLPEN_NATIVE_UNIQUENESS_READBACK === 'PASS')
check('wider index preserved', artifact.r1hManualCatalogEvidence?.R1H_EXISTING_WIDER_NATIVE_INDEX_POLICY === 'PRESERVE')
check('production aligned', artifact.repositoryBaseline?.localHead === artifact.repositoryBaseline?.originMain && artifact.repositoryBaseline?.production === artifact.repositoryBaseline?.localHead)
check('manifest authority', flags.R1I_LIVE_MANIFEST_AUTHORITY === 'PASS' && artifact.liveManifestAuthority?.productionAuthorityReady === true)
check('critical code unchanged', flags.R1I_MANIFEST_CRITICAL_CODE_UNCHANGED === 'YES' && artifact.manifestCriticalCodeState?.criticalFileMismatchCount === 0)
check('prewrite feature state', flags.R1I_PREWRITE_FEATURE_STATE === 'PASS')
check('team reuse', artifact.prewrite?.teamReuse?.reuses === 4498 && artifact.execution?.team?.inserts === 0 && artifact.execution?.team?.finalRows === 4498)
check('starter reuse', artifact.prewrite?.starterReuse?.reuses === 4498 && artifact.execution?.starter?.inserts === 0 && artifact.execution?.starter?.finalRows === 4498)
check('snapshot reuse', artifact.execution?.snapshots?.inserts === 0 && artifact.execution?.snapshots?.reuses === 67433 && artifact.execution?.snapshots?.updates === 0 && artifact.execution?.snapshots?.deletes === 0 && artifact.execution?.snapshots?.finalRows === 67433)
check('bullpen recovery', artifact.execution?.bullpen?.inserts === 4498 && artifact.execution?.bullpen?.conflicts === 0 && artifact.execution?.bullpen?.finalRows === 4498)
check('batter recovery', artifact.execution?.batter?.inserts === 44943 && artifact.execution?.batter?.conflicts === 0 && artifact.execution?.batter?.finalRows === 44943)
check('matchup recovery', artifact.execution?.matchup?.inserts === 2249 && artifact.execution?.matchup?.conflicts === 0 && artifact.execution?.matchup?.finalRows === 2249)
check('first inning recovery', artifact.execution?.firstInning?.inserts === 2249 && artifact.execution?.firstInning?.conflicts === 0 && artifact.execution?.firstInning?.finalRows === 2249)
check('feature parity', flags.R1I_FEATURE_ROW_PARITY === 'PASS')
check('target coverage', artifact.postwrite?.targetGameCoverage?.targetGames === 2430 && artifact.postwrite?.targetGameCoverage?.eligible === 2249 && artifact.postwrite?.targetGameCoverage?.insufficientHistory === 181)
check('native uniqueness', Object.values(artifact.postwrite?.nativeDuplicateKeys ?? {}).every((count) => count === 0))
check('asof leakage null sanity', artifact.postwrite?.asOfViolations === 0 && artifact.postwrite?.leakageViolations === 0 && artifact.postwrite?.sameDayViolations === 0 && artifact.postwrite?.nullPolicyViolations === 0 && artifact.postwrite?.malformedPayloads === 0)
check('raw immutable', artifact.postwrite?.raw?.rawRows === 712528 && artifact.postwrite?.raw?.uniquePitchIdentities === 712528 && artifact.postwrite?.raw?.duplicatePitchIdentities === 0 && artifact.postwrite?.raw?.rawPayloadDigestUnchanged === true && artifact.postwrite?.raw?.rawIdentityDigestUnchanged === true)
check('native preserved', artifact.postwrite?.nativeCounts?.games === 2430 && artifact.postwrite?.nativeCounts?.players === 1469 && artifact.postwrite?.nativeCounts?.results === 0 && artifact.postwrite?.nativeCounts?.marketMappings === 0)
check('idempotency', Object.values(artifact.postwrite?.secondPass ?? {}).every((item) => item.inserts === 0 && item.conflicts === 0))
check('models untouched', Object.values(artifact.postwrite?.modelCounts ?? {}).every((count) => count === 0))
check('predictions untouched', Object.values(artifact.postwrite?.predictionCounts ?? {}).every((count) => count === 0))
check('safety', artifact.safety?.providerCalls === 0 && artifact.safety?.productionDdlMutations === 0 && artifact.safety?.snapshotWrites === 0 && artifact.safety?.rawStatcastWrites === 0 && artifact.safety?.nativeIdentityWrites === 0 && artifact.safety?.modelTraining === 'NO' && artifact.safety?.predictionGeneration === 'NO' && artifact.safety?.import2026 === 'NO' && artifact.safety?.automation === 'NO' && artifact.safety?.cronChanges === 0)
check('foundation ready', flags.MLB_DATA_01D_2025_FEATURE_FOUNDATION_READY === 'YES' && flags.MLB_DATA_02A_INDIVIDUAL_PICK_MODEL_DATASET_PREPARATION_READY === 'YES')
check('product realigned', flags.R1I_INDIVIDUAL_PICK_PRODUCT_ALIGNMENT === 'PASS' && artifact.roadmapRealignment?.activeProductDirection === 'INDIVIDUAL_PICK_FIRST' && artifact.roadmapRealignment?.mandatory100DailyParlays === 'RETIRED_AS_CORE_OBJECTIVE')

if (errors.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-01d-r1i-partial-feature-dml-resume-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-01d-r1i-partial-feature-dml-resume-validate',
    status: 'PASS',
    classification: artifact.certificationVerdict,
    productionDmlMutations: artifact.safety.productionDmlMutations,
  }, null, 2))
}
