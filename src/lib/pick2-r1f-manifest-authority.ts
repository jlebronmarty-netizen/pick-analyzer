import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

import r1fManifest from '../../config/pick2/mlb/r1f-deployment-certification-manifest.json'

const expectedManifestDigestEnvName = 'PICK2_MLB_R1F_EXPECTED_MANIFEST_SHA256'
const expectedManifestContractId = 'PICK2_MLB_01D_R1F_RECOVERY_MANIFEST_V1'
const expectedManifestDigest =
  '1c7532aa5aaf09d2c05ffb4df752bb5eee2e4f9c719489b70a97f9d14d587352'
const expectedFeatureVersion =
  'MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1'

type CriticalFileDigest = {
  path: string
  sha256: string
}

type R1fManifest = {
  manifest_schema_version: number
  certification_contract_id: string
  manifest_sha256: string
  payload: {
    feature_version: string
    critical_file_digests: CriticalFileDigest[]
  }
}

export type R1fManifestAuthorityFailureCode =
  | null
  | 'R1F_EXPECTED_MANIFEST_SHA256_MISSING'
  | 'R1F_EXPECTED_MANIFEST_SHA256_INVALID'
  | 'R1F_EXPECTED_MANIFEST_SHA256_MISMATCH'
  | 'R1F_MANIFEST_CONTRACT_ID_MISMATCH'
  | 'R1F_MANIFEST_DIGEST_INVALID'
  | 'R1F_MANIFEST_DIGEST_MISMATCH'
  | 'R1F_FEATURE_VERSION_MISMATCH'
  | 'R1F_CRITICAL_FILE_INVENTORY_EMPTY'
  | 'R1F_CRITICAL_FILE_MISSING'
  | 'R1F_CRITICAL_FILE_DIGEST_INVALID'
  | 'R1F_CRITICAL_FILE_DIGEST_MISMATCH'

export type R1fManifestAuthorityStatus = {
  manifestContractId: string
  manifestDigest: string
  expectedDigestConfigured: boolean
  expectedDigestMatchesManifest: boolean
  criticalCodeIntegrity: 'PASS' | 'FAIL'
  criticalFileMismatchCount: number
  featureVersion: string
  productionAuthorityReady: boolean
  failureCode: R1fManifestAuthorityFailureCode
}

type AuthorityStatusOptions = {
  env?: Record<string, string | undefined>
  rootDir?: string
  manifestOverride?: R1fManifest
  fileDigestOverrides?: Record<string, string | null>
}

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalize(item)).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize((value as Record<string, unknown>)[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function sha256Hex(value: string | Buffer) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function isDigest(value: string) {
  return /^[a-f0-9]{64}$/.test(value)
}

function fileSha256(rootDir: string, filePath: string, overrides?: Record<string, string | null>) {
  if (overrides && Object.hasOwn(overrides, filePath)) return overrides[filePath]
  const absolutePath = path.join(rootDir, filePath)
  if (!fs.existsSync(absolutePath)) return null
  return sha256Hex(fs.readFileSync(absolutePath))
}

function firstFailure(codes: R1fManifestAuthorityFailureCode[]) {
  return codes.find((code): code is Exclude<R1fManifestAuthorityFailureCode, null> => Boolean(code)) ?? null
}

export function getPick2R1fManifestAuthorityStatus(
  options: AuthorityStatusOptions = {}
): R1fManifestAuthorityStatus {
  const manifest = options.manifestOverride ?? (r1fManifest as R1fManifest)
  const env = options.env ?? process.env
  const rootDir = options.rootDir ?? process.cwd()
  const expectedDigestRaw = env[expectedManifestDigestEnvName]
  const normalizedExpectedDigest = expectedDigestRaw?.trim().toLowerCase() ?? ''
  const expectedDigestConfigured = normalizedExpectedDigest.length > 0
  const failures: R1fManifestAuthorityFailureCode[] = []

  if (!expectedDigestConfigured) failures.push('R1F_EXPECTED_MANIFEST_SHA256_MISSING')
  else if (!isDigest(normalizedExpectedDigest)) failures.push('R1F_EXPECTED_MANIFEST_SHA256_INVALID')

  const manifestDigest = sha256Hex(canonicalize(manifest.payload))
  if (manifest.certification_contract_id !== expectedManifestContractId) {
    failures.push('R1F_MANIFEST_CONTRACT_ID_MISMATCH')
  }
  if (!isDigest(manifest.manifest_sha256) || manifest.manifest_sha256 !== expectedManifestDigest) {
    failures.push('R1F_MANIFEST_DIGEST_INVALID')
  }
  if (manifestDigest !== manifest.manifest_sha256 || manifestDigest !== expectedManifestDigest) {
    failures.push('R1F_MANIFEST_DIGEST_MISMATCH')
  }
  if (manifest.payload.feature_version !== expectedFeatureVersion) {
    failures.push('R1F_FEATURE_VERSION_MISMATCH')
  }

  const expectedDigestMatchesManifest =
    expectedDigestConfigured &&
    isDigest(normalizedExpectedDigest) &&
    normalizedExpectedDigest === manifestDigest

  if (expectedDigestConfigured && isDigest(normalizedExpectedDigest) && !expectedDigestMatchesManifest) {
    failures.push('R1F_EXPECTED_MANIFEST_SHA256_MISMATCH')
  }

  const criticalFiles = manifest.payload.critical_file_digests ?? []
  if (criticalFiles.length === 0) failures.push('R1F_CRITICAL_FILE_INVENTORY_EMPTY')

  let criticalFileMismatchCount = 0
  for (const entry of criticalFiles) {
    if (!entry.path || !isDigest(entry.sha256)) {
      criticalFileMismatchCount += 1
      failures.push('R1F_CRITICAL_FILE_DIGEST_INVALID')
      continue
    }
    const actualDigest = fileSha256(rootDir, entry.path, options.fileDigestOverrides)
    if (actualDigest === null) {
      criticalFileMismatchCount += 1
      failures.push('R1F_CRITICAL_FILE_MISSING')
    } else if (actualDigest !== entry.sha256) {
      criticalFileMismatchCount += 1
      failures.push('R1F_CRITICAL_FILE_DIGEST_MISMATCH')
    }
  }

  const criticalCodeIntegrity = criticalFileMismatchCount === 0 ? 'PASS' : 'FAIL'
  const failureCode = firstFailure(failures)
  const productionAuthorityReady =
    failureCode === null &&
    expectedDigestConfigured &&
    expectedDigestMatchesManifest &&
    criticalCodeIntegrity === 'PASS' &&
    manifest.certification_contract_id === expectedManifestContractId &&
    manifest.payload.feature_version === expectedFeatureVersion

  return {
    manifestContractId: manifest.certification_contract_id,
    manifestDigest,
    expectedDigestConfigured,
    expectedDigestMatchesManifest,
    criticalCodeIntegrity,
    criticalFileMismatchCount,
    featureVersion: manifest.payload.feature_version,
    productionAuthorityReady,
    failureCode,
  }
}

export const pick2R1fManifestAuthorityContract = {
  expectedManifestDigestEnvName,
  expectedManifestContractId,
  expectedManifestDigest,
  expectedFeatureVersion,
}
