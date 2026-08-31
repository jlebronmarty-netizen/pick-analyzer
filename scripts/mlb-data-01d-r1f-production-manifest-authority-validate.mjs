import fs from 'node:fs'

const artifact = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-01d-r1f-production-manifest-authority.json', 'utf8'))
const errors = []
const expectedCommit = 'e39bb7631ab642c992576cc8a3b2e6ef99654f8c'
const expectedDigest = '1c7532aa5aaf09d2c05ffb4df752bb5eee2e4f9c719489b70a97f9d14d587352'
const expectedContract = 'PICK2_MLB_01D_R1F_RECOVERY_MANIFEST_V1'
const expectedFeatureVersion = 'MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1'

function check(label, condition) {
  if (!condition) errors.push(label)
}

check('verdict', artifact.certificationVerdict === 'MLB_DATA_01D_R1F_PRODUCTION_MANIFEST_AUTHORITY_CERTIFIED')
check('published commit', artifact.publication.publishedCommit === expectedCommit)
check('repo alignment', artifact.publication.localHeadAfterPush === expectedCommit && artifact.publication.originMainAfterPush === expectedCommit)
check('production alignment', artifact.productionAlignment.productionCommit === expectedCommit && artifact.productionAlignment.status === 'PASS')
check('provider calls version', artifact.productionAlignment.providerCallsMade === 0)
check('route deployed', artifact.routeReadback.R1F_PRODUCTION_ENV_READBACK_ROUTE_DEPLOYED === 'YES' && artifact.routeReadback.httpStatus === 200)
check('secret safe', artifact.routeReadback.R1F_PRODUCTION_ENV_READBACK_SECRET_SAFE === 'PASS')
check('runtime digest present', artifact.routeReadback.expectedDigestConfigured === true)
check('runtime digest match', artifact.routeReadback.expectedDigestMatchesManifest === true)
check('manifest contract', artifact.routeReadback.manifestContractId === expectedContract)
check('manifest digest', artifact.routeReadback.manifestDigest === expectedDigest)
check('critical integrity', artifact.routeReadback.criticalCodeIntegrity === 'PASS' && artifact.routeReadback.criticalFileMismatchCount === 0)
check('feature version', artifact.routeReadback.featureVersion === expectedFeatureVersion)
check('authority ready', artifact.routeReadback.productionAuthorityReady === true && artifact.routeReadback.failureCode === null)
check('route commit', artifact.routeReadback.gitCommit === expectedCommit)
check('preflight status', artifact.fullProductionPreflight.status === 'PASS')
check('preflight authority', artifact.fullProductionPreflight.manifestAuthority === 'PASS' && artifact.fullProductionPreflight.criticalCodeIntegrity === 'PASS')
check('snapshot state', artifact.fullProductionPreflight.snapshotsExisting === 67433 && artifact.fullProductionPreflight.snapshotsPlanned === 67433 && artifact.fullProductionPreflight.snapshotExactDigestMatches === 67433 && artifact.fullProductionPreflight.snapshotConflicts === 0 && artifact.fullProductionPreflight.snapshotReuseNoOp === 67433)
check('row plan', artifact.fullProductionPreflight.teamInsertEligible === 4498 && artifact.fullProductionPreflight.starterInsertEligible === 4498 && artifact.fullProductionPreflight.bullpenInsertEligible === 4498 && artifact.fullProductionPreflight.batterInsertEligible === 44943 && artifact.fullProductionPreflight.matchupInsertEligible === 2249 && artifact.fullProductionPreflight.firstInningInsertEligible === 2249 && artifact.fullProductionPreflight.offenseLogical === 4498 && artifact.fullProductionPreflight.BLOCK_CONFLICT === 0)
check('native keys', artifact.fullProductionPreflight.duplicateNativeLogicalKeys === 0)
check('raw native', artifact.fullProductionPreflight.rawRows === 712528 && artifact.fullProductionPreflight.uniquePitchIdentities === 712528 && artifact.fullProductionPreflight.duplicatePitchIdentities === 0 && artifact.fullProductionPreflight.nativeGames === 2430 && artifact.fullProductionPreflight.nativePlayers === 1469)
check('as of leakage', artifact.fullProductionPreflight.asOfRule === 'source_game_date < target_game_date' && artifact.fullProductionPreflight.sameDayLeakage === 0 && artifact.fullProductionPreflight.leakageViolations === 0)
check('execute dry', artifact.executeDryValidation.status === 'PASS' && artifact.executeDryValidation.executeBoundary === 'EXPLICIT_DML_AUTHORIZATION_REQUIRED' && artifact.executeDryValidation.writes === 0)
check('fail closed', artifact.failClosedMatrix.status === 'PASS' && Object.entries(artifact.failClosedMatrix).filter(([key]) => key !== 'status').every(([, value]) => value === 'REJECT'))
check('data state', artifact.productionDataState.snapshots === 67433 && artifact.productionDataState.dailyFeatureRows === 0 && artifact.productionDataState.rawRows === 712528 && artifact.productionDataState.nativeGames === 2430 && artifact.productionDataState.nativePlayers === 1469 && artifact.productionDataState.models === 0 && artifact.productionDataState.champion === 'NONE' && artifact.productionDataState.predictions === 0)
check('safety', artifact.safety.featureDmlAuthorized === 'NO' && artifact.safety.productionDmlMutations === 0 && artifact.safety.productionDdlMutations === 0 && artifact.safety.providerCalls === 0 && artifact.safety.environmentModifications === 0 && artifact.safety.migrationApply === 'NO' && artifact.safety.automation === 'NO' && artifact.safety.cronChanges === 0)
check('flags', artifact.flags.R1F_PRODUCTION_MANIFEST_AUTHORITY_READY === 'YES' && artifact.flags.R1F_PRODUCTION_AUTHORITY_PREFLIGHT === 'PASS' && artifact.flags.R1F_PRODUCTION_AUTHORITY_EXECUTE_DRY === 'PASS' && artifact.flags.MLB_DATA_01D_R1F_PRODUCTION_AUTHORITY_DML_AUTHORIZED === 'NO')

if (errors.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-01d-r1f-production-manifest-authority-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-01d-r1f-production-manifest-authority-validate',
    status: 'PASS',
    verdict: artifact.certificationVerdict,
    productionCommit: artifact.productionAlignment.productionCommit,
    productionAuthorityReady: artifact.routeReadback.productionAuthorityReady,
  }, null, 2))
}
