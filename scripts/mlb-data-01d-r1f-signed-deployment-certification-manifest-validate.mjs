import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const manifestPath = 'config/pick2/mlb/r1f-deployment-certification-manifest.json'
const artifactPath = 'docs/CERTIFICATION/mlb-data-01d-r1f-signed-deployment-certification-manifest.json'
const persistencePath = 'scripts/mlb-data-01d-2025-feature-persistence.mjs'
const errors = []

function check(label, condition) {
  if (!condition) errors.push(label)
}

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalize(item)).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function fileSha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(process.cwd(), filePath))).digest('hex')
}

function digestShape(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function verifyManifest(manifest, expectedDigest) {
  if (!expectedDigest || !digestShape(expectedDigest)) return false
  if (!manifest || manifest.manifest_schema_version !== 1) return false
  if (manifest.certification_contract_id !== 'PICK2_MLB_01D_R1F_RECOVERY_MANIFEST_V1') return false
  if (!digestShape(manifest.manifest_sha256)) return false
  const computedDigest = sha256Hex(canonicalize(manifest.payload))
  if (computedDigest !== manifest.manifest_sha256 || computedDigest !== expectedDigest) return false
  for (const entry of manifest.payload.critical_file_digests ?? []) {
    if (!entry.path || !digestShape(entry.sha256)) return false
    if (!fs.existsSync(path.join(process.cwd(), entry.path))) return false
    if (fileSha256(entry.path) !== entry.sha256) return false
  }
  return true
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'))
const persistenceScript = fs.readFileSync(persistencePath, 'utf8')
const computedManifestDigest = sha256Hex(canonicalize(manifest.payload))
const wrongDigest = `0${computedManifestDigest.slice(1)}`
const manifestTampered = clone(manifest)
manifestTampered.payload.row_plan.team = 4499
const rowPlanDrift = clone(manifest)
rowPlanDrift.payload.row_plan.team = 4499
rowPlanDrift.manifest_sha256 = sha256Hex(canonicalize(rowPlanDrift.payload))
const snapshotDrift = clone(manifest)
snapshotDrift.payload.snapshot_contract.existing = 67432
snapshotDrift.manifest_sha256 = sha256Hex(canonicalize(snapshotDrift.payload))
const leakageDrift = clone(manifest)
leakageDrift.payload.as_of_contract.leakage_violations = 1
leakageDrift.manifest_sha256 = sha256Hex(canonicalize(leakageDrift.payload))
const blockConflictDrift = clone(manifest)
blockConflictDrift.payload.row_plan.BLOCK_CONFLICT = 1
blockConflictDrift.manifest_sha256 = sha256Hex(canonicalize(blockConflictDrift.payload))
const criticalFileDrift = clone(manifest)
criticalFileDrift.payload.critical_file_digests[0].sha256 = wrongDigest
criticalFileDrift.manifest_sha256 = sha256Hex(canonicalize(criticalFileDrift.payload))

const criticalPaths = (manifest.payload.critical_file_digests ?? []).map((entry) => entry.path)
const rowPlan = manifest.payload.row_plan
const snapshot = manifest.payload.snapshot_contract
const nativeKeys = manifest.payload.native_key_contract

check('verdict', artifact.certificationVerdict === 'MLB_DATA_01D_R1F_SIGNED_DEPLOYMENT_CERTIFICATION_MANIFEST_CERTIFIED')
check('authority required', artifact.flags.R1F_CODE_INTEGRITY_AUTHORITY_REQUIRED === 'YES')
check('selected authority', manifest.payload.authority_design === 'DIGEST_BOUND_DEPLOYMENT_CERTIFICATION_MANIFEST')
check('contract id', manifest.certification_contract_id === 'PICK2_MLB_01D_R1F_RECOVERY_MANIFEST_V1')
check('schema version', manifest.manifest_schema_version === 1)
check('manifest digest shape', digestShape(manifest.manifest_sha256))
check('manifest digest exact', manifest.manifest_sha256 === computedManifestDigest)
check('artifact digest exact', artifact.manifest.sha256 === computedManifestDigest)
check('self reference eliminated', !JSON.stringify(manifest.payload).includes(manifest.manifest_sha256))
check('deployed commit sha not in payload', !/(ae738c0e5e0fc6890d0dc5b5c7c88d30b0735699|2560a3c9c6c147f3aaf7b83c8811648663c9cc1b|7d5cc1798e799b5048d5cccfd35db1822ea6ebc6)/.test(JSON.stringify(manifest.payload)))
check('critical inventory', criticalPaths.includes(persistencePath) && criticalPaths.includes('docs/CERTIFICATION/mlb-data-01d-2025-feature-build-dry-run.json') && criticalPaths.includes('docs/CERTIFICATION/mlb-data-01c-r5b-2025-native-identity-backfill.json'))
check('critical digests exact', manifest.payload.critical_file_digests.every((entry) => fileSha256(entry.path) === entry.sha256))
check('runtime expected digest env', persistenceScript.includes("const expectedManifestDigestEnvName = 'PICK2_MLB_R1F_EXPECTED_MANIFEST_SHA256'"))
check('runtime digest compare', persistenceScript.includes('R1F_EXPECTED_MANIFEST_SHA256_MISMATCH'))
check('runtime code integrity compare', persistenceScript.includes('R1F_CRITICAL_FILE_DIGEST_MISMATCH'))
check('execute dml auth separate', persistenceScript.includes("ensure(explicitDmlAuthorization, 'EXPLICIT_DML_AUTHORIZATION_REQUIRED')"))
check('no sha equality authority', !/return commit === r1fCertifiedProductionCommit/.test(persistenceScript))
check('feature version', manifest.payload.feature_version === 'MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1')
check('row plan', rowPlan.team === 4498 && rowPlan.starter === 4498 && rowPlan.bullpen === 4498 && rowPlan.batter === 44943 && rowPlan.matchup === 2249 && rowPlan.first_inning === 2249 && rowPlan.offense_logical === 4498 && rowPlan.snapshots === 67433 && rowPlan.snapshot_inserts === 0 && rowPlan.BLOCK_CONFLICT === 0)
check('native keys', nativeKeys.team === 'target_game_pk + team_id + feature_version' && nativeKeys.bullpen === 'target_game_pk + team_id + feature_version' && nativeKeys.starter === 'target_game_pk + mlbam_pitcher_id + feature_version' && nativeKeys.batter === 'target_game_pk + mlbam_batter_id + feature_version' && nativeKeys.matchup === 'target_game_pk + feature_version' && nativeKeys.first_inning === 'target_game_pk + feature_version')
check('snapshot contract', snapshot.existing === 67433 && snapshot.planned === 67433 && snapshot.exact_digest_matches === 67433 && snapshot.mismatches === 0 && snapshot.missing === 0 && snapshot.unexpected === 0 && snapshot.reuse_no_op === 67433 && snapshot.new_inserts === 0)
check('as-of leakage', manifest.payload.as_of_contract.rule === 'source_game_date < target_game_date' && manifest.payload.as_of_contract.leakage_violations === 0 && manifest.payload.as_of_contract.same_day_leakage === 0)
check('raw native', manifest.payload.raw_native_invariants.raw_rows === 712528 && manifest.payload.raw_native_invariants.unique_pitch_identities === 712528 && manifest.payload.raw_native_invariants.duplicate_pitch_identities === 0 && manifest.payload.raw_native_invariants.native_games === 2430 && manifest.payload.raw_native_invariants.native_players === 1469)
check('valid digest test', verifyManifest(manifest, computedManifestDigest))
check('missing digest rejects', !verifyManifest(manifest, undefined))
check('wrong digest rejects', !verifyManifest(manifest, wrongDigest))
check('manifest tamper rejects', !verifyManifest(manifestTampered, computedManifestDigest))
check('critical file drift rejects', !verifyManifest(criticalFileDrift, criticalFileDrift.manifest_sha256))
check('row plan drift rejects', !verifyManifest(rowPlanDrift, computedManifestDigest))
check('snapshot drift rejects', !verifyManifest(snapshotDrift, computedManifestDigest))
check('leakage drift rejects', !verifyManifest(leakageDrift, computedManifestDigest))
check('block conflict drift rejects', !verifyManifest(blockConflictDrift, computedManifestDigest))
check('future deployment fail closed', artifact.flags.R1F_FUTURE_DEPLOYMENT_FAIL_CLOSED === 'PASS')
check('preflight execute parity', artifact.flags.R1F_MANIFEST_PREFLIGHT_EXECUTE_PARITY === 'PASS')
check('dml not authorized', artifact.flags.MLB_DATA_01D_R1F_MANIFEST_DML_AUTHORIZED === 'NO')
check('zero mutation', artifact.safety.productionDmlMutations === 0 && artifact.safety.productionDdlMutations === 0 && artifact.safety.providerCalls === 0)

if (errors.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-01d-r1f-signed-deployment-certification-manifest-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-01d-r1f-signed-deployment-certification-manifest-validate',
    status: 'PASS',
    verdict: artifact.certificationVerdict,
    manifestSha256: computedManifestDigest,
    authority: manifest.payload.authority_design,
    criticalFiles: criticalPaths.length,
  }, null, 2))
}
