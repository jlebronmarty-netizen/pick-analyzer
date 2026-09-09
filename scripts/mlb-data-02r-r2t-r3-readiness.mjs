import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'

export const R3_CERTIFICATE = 'docs/CERTIFICATION/MLB_DATA_02R_R2T_R3_LIVE_REENABLEMENT_CERTIFICATION.json'
export const R3_GATE_IDS = Object.freeze(['R2T_PREREQUISITE', 'REAL_CALL_GRAPH', 'MODEL_76', 'PROVENANCE_STARTER', 'PHYSICAL_FK', 'PROVIDER_CAPS', 'DML_SCOPE_CAPS', 'RUN_FREEZE_CHECKPOINT', 'NO_FIXTURE_FALLBACK', 'MANUAL_ENTRYPOINT', 'READBACK_IDEMPOTENCY', 'NO_CERTIFICATION_SIDE_EFFECTS'])
const block = (condition, reason) => { if (!condition) throw new Error(`R2T_LIVE_BLOCKED:R3_${reason}`) }
export const normalizedFileDigest = file => createHash('sha256').update(fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n')).digest('hex')

export function collectRuntimeSourcePaths() {
  const seen = new Set()
  const visit = file => {
    file = file.replaceAll('\\', '/')
    if (seen.has(file)) return
    block(!path.isAbsolute(file) && !file.split('/').includes('..'), 'IMPORT_PATH')
    seen.add(file)
    const source = fs.readFileSync(file, 'utf8')
    for (const match of source.matchAll(/(?:from\s*|import\s*\()\s*['"](\.[^'"]+)['"]/g)) {
      const target = path.join(path.dirname(file), match[1])
      block(/\.mjs$/.test(target), 'UNSUPPORTED_LOCAL_IMPORT')
      visit(target)
    }
  }
  visit('scripts/mlb-operational-manual-refresh.mjs')
  for (const file of ['package.json', 'package-lock.json', 'artifacts/mlb/mlb-02c-moneyline-baseline-model.json',
    'docs/CERTIFICATION/MLB_OPERATIONAL_FEATURE_SCHEMA_REVIEW.json', 'docs/CERTIFICATION/MLB_OPERATIONAL_DOWNSTREAM_SCHEMA_REVIEW.json',
    'docs/CERTIFICATION/MLB_OPERATIONAL_NATIVE_SCHEMA_REVIEW.json', 'docs/CERTIFICATION/MLB_OPERATIONAL_RAW_SCHEMA_REVIEW.json',
    'docs/CERTIFICATION/mlb-data-02p-official-pick-policy-prep.json',
    'docs/CERTIFICATION/MLB_DATA_02R_R2T_R2_STORED_OUTPUT_PARITY_AND_REAL_PERSISTENCE_INTEGRATION.json']) seen.add(file)
  return [...seen].sort()
}

// Pure checker is independently testable; production loads only the canonical
// repository certificate and actual files, never caller-supplied evidence.
export function verifyR3Certificate(certificate, readDigest = normalizedFileDigest) {
  block(certificate?.certificationVerdict === 'MLB_DATA_02R_R2T_R3_LIVE_REENABLEMENT_CERTIFIED', 'CERTIFICATION_REQUIRED')
  block(certificate.r2tR2Verdict === 'MLB_DATA_02R_R2T_R2_STORED_OUTPUT_PARITY_AND_REAL_PERSISTENCE_INTEGRATION_CERTIFIED', 'PREREQUISITE')
  block(certificate.syntheticProductionPaths === 0 && certificate.featureCount === 76, 'MODEL_CONTRACT')
  block(certificate.champion === 'MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1' && certificate.policy === 'MLB_MONEYLINE_OFFICIAL_PICK_POLICY_V1', 'MODEL_POLICY')
  block(Array.isArray(certificate.gates) && certificate.gates.length === R3_GATE_IDS.length && new Set(certificate.gates.map(g => g.id)).size === R3_GATE_IDS.length
    && R3_GATE_IDS.every(id => certificate.gates.some(g => g.id === id && g.status === 'PASS')), 'GATES')
  const hashes = certificate.sourceHashes
  block(hashes && Object.keys(hashes).length >= 20, 'SOURCE_INVENTORY')
  for (const file of ['scripts/mlb-data-02r-r2a-live-refresh-executor.mjs', 'scripts/mlb-data-02r-r2i-live-execution-interfaces.mjs', 'scripts/mlb-data-02r-r2t-production-bindings.mjs', 'scripts/mlb-data-02r-r2t-r3-readiness.mjs', 'scripts/mlb-operational-manual-refresh.mjs', 'artifacts/mlb/mlb-02c-moneyline-baseline-model.json', 'package-lock.json']) block(Object.hasOwn(hashes, file), 'MISSING_CRITICAL_SOURCE')
  for (const [file, expected] of Object.entries(hashes)) {
    block(!path.isAbsolute(file) && !file.split(/[\\/]/).includes('..') && /^(scripts|artifacts|docs)\/|^package(?:-lock)?\.json$/.test(file), 'SOURCE_PATH')
    block(/^[a-f0-9]{64}$/.test(expected) && readDigest(file) === expected, `SOURCE_DRIFT:${file}`)
  }
  return { status: 'R3_CERTIFIED', sourceFiles: Object.keys(hashes).length }
}

export function requireCanonicalR3Readiness() {
  block(fs.existsSync(R3_CERTIFICATE), 'CERTIFICATE_MISSING')
  const certificate = JSON.parse(fs.readFileSync(R3_CERTIFICATE, 'utf8'))
  block(JSON.stringify(Object.keys(certificate.sourceHashes ?? {}).sort()) === JSON.stringify(collectRuntimeSourcePaths()), 'TRANSITIVE_SOURCE_INVENTORY')
  return verifyR3Certificate(certificate)
}
