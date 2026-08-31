import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const manifestPath = 'config/pick2/mlb/r1f-deployment-certification-manifest.json'
const routePath = 'src/app/api/system/pick2/r1f-manifest-authority/route.ts'
const helperPath = 'src/lib/pick2-r1f-manifest-authority.ts'
const artifactPath = 'docs/CERTIFICATION/mlb-data-01d-r1f-production-env-authority-readback-route.json'
const errors = []

const expectedDigestEnvName = 'PICK2_MLB_R1F_EXPECTED_MANIFEST_SHA256'
const expectedDigest = '1c7532aa5aaf09d2c05ffb4df752bb5eee2e4f9c719489b70a97f9d14d587352'
const expectedContractId = 'PICK2_MLB_01D_R1F_RECOVERY_MANIFEST_V1'
const expectedFeatureVersion = 'MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1'
const allowedRouteFields = [
  'manifestContractId',
  'manifestDigest',
  'expectedDigestConfigured',
  'expectedDigestMatchesManifest',
  'criticalCodeIntegrity',
  'criticalFileMismatchCount',
  'featureVersion',
  'productionAuthorityReady',
  'failureCode',
  'gitCommit',
]

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

function digestShape(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
}

function fileSha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(process.cwd(), filePath))).digest('hex')
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function readbackStatus({ manifest, envValue, fileDigestOverrides = {} }) {
  const normalizedEnv = envValue?.trim().toLowerCase() ?? ''
  const expectedDigestConfigured = normalizedEnv.length > 0
  const failures = []
  const manifestDigest = sha256Hex(canonicalize(manifest.payload))

  if (!expectedDigestConfigured) failures.push('R1F_EXPECTED_MANIFEST_SHA256_MISSING')
  else if (!digestShape(normalizedEnv)) failures.push('R1F_EXPECTED_MANIFEST_SHA256_INVALID')
  if (manifest.certification_contract_id !== expectedContractId) failures.push('R1F_MANIFEST_CONTRACT_ID_MISMATCH')
  if (!digestShape(manifest.manifest_sha256) || manifest.manifest_sha256 !== expectedDigest) failures.push('R1F_MANIFEST_DIGEST_INVALID')
  if (manifestDigest !== manifest.manifest_sha256 || manifestDigest !== expectedDigest) failures.push('R1F_MANIFEST_DIGEST_MISMATCH')
  if (manifest.payload.feature_version !== expectedFeatureVersion) failures.push('R1F_FEATURE_VERSION_MISMATCH')

  const expectedDigestMatchesManifest =
    expectedDigestConfigured && digestShape(normalizedEnv) && normalizedEnv === manifestDigest
  if (expectedDigestConfigured && digestShape(normalizedEnv) && !expectedDigestMatchesManifest) {
    failures.push('R1F_EXPECTED_MANIFEST_SHA256_MISMATCH')
  }

  let criticalFileMismatchCount = 0
  for (const entry of manifest.payload.critical_file_digests ?? []) {
    const actualDigest = Object.hasOwn(fileDigestOverrides, entry.path)
      ? fileDigestOverrides[entry.path]
      : fs.existsSync(path.join(process.cwd(), entry.path))
        ? fileSha256(entry.path)
        : null
    if (!entry.path || !digestShape(entry.sha256) || actualDigest === null || actualDigest !== entry.sha256) {
      criticalFileMismatchCount += 1
      failures.push(actualDigest === null ? 'R1F_CRITICAL_FILE_MISSING' : 'R1F_CRITICAL_FILE_DIGEST_MISMATCH')
    }
  }

  const criticalCodeIntegrity = criticalFileMismatchCount === 0 ? 'PASS' : 'FAIL'
  const failureCode = failures[0] ?? null
  return {
    manifestContractId: manifest.certification_contract_id,
    manifestDigest,
    expectedDigestConfigured,
    expectedDigestMatchesManifest,
    criticalCodeIntegrity,
    criticalFileMismatchCount,
    featureVersion: manifest.payload.feature_version,
    productionAuthorityReady:
      failureCode === null &&
      expectedDigestConfigured &&
      expectedDigestMatchesManifest &&
      criticalCodeIntegrity === 'PASS' &&
      manifest.certification_contract_id === expectedContractId &&
      manifest.payload.feature_version === expectedFeatureVersion,
    failureCode,
  }
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const routeSource = fs.readFileSync(routePath, 'utf8')
const helperSource = fs.readFileSync(helperPath, 'utf8')
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'))
const manifestDigest = sha256Hex(canonicalize(manifest.payload))
const wrongDigest = `0${expectedDigest.slice(1)}`
const codeDriftDigest = `f${expectedDigest.slice(1)}`
const manifestTampered = clone(manifest)
manifestTampered.payload.row_plan.team = 4499

const missingEnv = readbackStatus({ manifest, envValue: undefined })
const validEnv = readbackStatus({ manifest, envValue: expectedDigest.toUpperCase() })
const wrongEnv = readbackStatus({ manifest, envValue: wrongDigest })
const codeDrift = readbackStatus({
  manifest,
  envValue: expectedDigest,
  fileDigestOverrides: {
    [manifest.payload.critical_file_digests[0].path]: codeDriftDigest,
  },
})
const manifestTamper = readbackStatus({ manifest: manifestTampered, envValue: expectedDigest })

check('route exists', fs.existsSync(routePath))
check('helper exists', fs.existsSync(helperPath))
check('route path', artifact.route.path === '/api/system/pick2/r1f-manifest-authority')
check('public read only', artifact.route.exposurePolicy === 'PUBLIC_READ_ONLY_CERTIFICATION_STATUS')
check('node runtime', routeSource.includes("export const runtime = 'nodejs'"))
check('force dynamic', routeSource.includes("export const dynamic = 'force-dynamic'"))
check('uses api contract', routeSource.includes('apiOk') && routeSource.includes('requestId'))
check('manifest contract id', manifest.certification_contract_id === expectedContractId)
check('manifest digest exact', manifestDigest === expectedDigest && manifest.manifest_sha256 === expectedDigest)
check('feature version', manifest.payload.feature_version === expectedFeatureVersion)
check('env read internal', helperSource.includes(`const expectedManifestDigestEnvName = '${expectedDigestEnvName}'`))
check('does not return env value', !routeSource.includes('normalizedExpectedDigest') && !routeSource.includes('expectedDigestRaw'))
check('no broad env exposure', !routeSource.includes('process.env') || routeSource.includes('VERCEL_GIT_COMMIT_SHA'))
check('no dml authority field', !routeSource.includes('featureDmlAuthorized'))
check('no provider call paths', !/fetch\(|createClient|supabase|provider/i.test(routeSource))
check('no file mutation in helper', !/writeFile|appendFile|mkdir|rmSync|unlink|rename|chmod|chown/.test(helperSource))
check('no env mutation in helper', !/process\.env\[[^\]]+\]\s*=|process\.env\.\w+\s*=/.test(helperSource))
check('response fields bounded', allowedRouteFields.every((field) => routeSource.includes(`${field}:`)))
check('prohibited response fields absent', !/rawEnv|envValue|secret|token|credential|authorization|headers/i.test(routeSource))
check('missing env test', missingEnv.expectedDigestConfigured === false && missingEnv.expectedDigestMatchesManifest === false && missingEnv.productionAuthorityReady === false && missingEnv.failureCode === 'R1F_EXPECTED_MANIFEST_SHA256_MISSING')
check('valid env test', validEnv.expectedDigestConfigured === true && validEnv.expectedDigestMatchesManifest === true && validEnv.criticalCodeIntegrity === 'PASS' && validEnv.productionAuthorityReady === true)
check('wrong env test', wrongEnv.expectedDigestConfigured === true && wrongEnv.expectedDigestMatchesManifest === false && wrongEnv.productionAuthorityReady === false && wrongEnv.failureCode === 'R1F_EXPECTED_MANIFEST_SHA256_MISMATCH')
check('code drift test', codeDrift.criticalCodeIntegrity === 'FAIL' && codeDrift.criticalFileMismatchCount === 1 && codeDrift.productionAuthorityReady === false)
check('manifest tamper test', manifestTamper.productionAuthorityReady === false && manifestTamper.failureCode === 'R1F_MANIFEST_DIGEST_MISMATCH')
check('artifact verdict', artifact.certificationVerdict === 'MLB_DATA_01D_R1F_PRODUCTION_ENV_AUTHORITY_READBACK_ROUTE_CERTIFIED')
check('artifact response contract', allowedRouteFields.every((field) => artifact.responseContract.allowedFields.includes(field)))
check('artifact secret safe', artifact.flags.R1F_ENV_READBACK_SECRET_SAFE_CONTRACT === 'PASS')
check('artifact digest match', artifact.flags.R1F_ENV_READBACK_DIGEST_MATCH_CHECK === 'PASS')
check('artifact code check', artifact.flags.R1F_ENV_READBACK_CRITICAL_CODE_CHECK === 'PASS')
check('artifact authority logic', artifact.flags.R1F_ENV_READBACK_AUTHORITY_LOGIC === 'PASS')
check('artifact route read only', artifact.flags.R1F_ENV_READBACK_ROUTE_READ_ONLY === 'YES')
check('artifact dml separation', artifact.flags.R1F_ENV_READBACK_NOT_DML_AUTHORITY === 'PASS')
check('production state preserved', artifact.productionState.snapshots === 67433 && artifact.productionState.dailyFeatureRows === 0 && artifact.productionState.rawRows === 712528 && artifact.productionState.nativeGames === 2430 && artifact.productionState.nativePlayers === 1469 && artifact.productionState.models === 0 && artifact.productionState.champion === 'NONE' && artifact.productionState.predictions === 0)
check('zero mutations', artifact.safety.productionDmlMutations === 0 && artifact.safety.productionDdlMutations === 0 && artifact.safety.providerCalls === 0)

if (errors.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-01d-r1f-production-env-authority-readback-route-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-01d-r1f-production-env-authority-readback-route-validate',
    status: 'PASS',
    verdict: artifact.certificationVerdict,
    routePath: artifact.route.path,
    manifestDigest,
    criticalFiles: manifest.payload.critical_file_digests.length,
  }, null, 2))
}
