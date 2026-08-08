import fs from 'node:fs'

const requiredFiles = [
  'docs/ARCHITECTURE/E2E_SYSTEM_LINKAGE_AUDIT_V2.md',
  'docs/ARCHITECTURE/E2E_RUNTIME_FILE_MAP_V2.md',
  'docs/ARCHITECTURE/E2E_DATA_LINEAGE_V2.md',
  'docs/PRODUCTION_PILOT/INCIDENT_PI_03_E2E_LINKAGE_AUDIT.md',
  'docs/CERTIFICATION/production-pilot-pi-03.json',
]

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

for (const file of requiredFiles) {
  assert(fs.existsSync(file), `missing required PI-03 artifact: ${file}`)
}

const audit = read('docs/ARCHITECTURE/E2E_SYSTEM_LINKAGE_AUDIT_V2.md')
const map = read('docs/ARCHITECTURE/E2E_RUNTIME_FILE_MAP_V2.md')
const lineage = read('docs/ARCHITECTURE/E2E_DATA_LINEAGE_V2.md')
const incident = read('docs/PRODUCTION_PILOT/INCIDENT_PI_03_E2E_LINKAGE_AUDIT.md')
const cert = JSON.parse(read('docs/CERTIFICATION/production-pilot-pi-03.json'))

const requiredAuditTerms = [
  'Canonical Data Source Map',
  'Complement Price Rebinding Gap',
  'Product Freshness SLA',
  'PRICE_EXISTS_DIFFERENT_SIDE',
  'Current Era',
  'provider calls',
]

for (const term of requiredAuditTerms) {
  assert((audit + lineage + incident).includes(term), `missing PI-03 audit term: ${term}`)
}

const requiredMapTerms = [
  'current-board.service.ts',
  'canonical-acquisition.service.ts',
  'product-freshness-sla.service.ts',
  'sportsdataio-mlb-normalization.service.ts',
  'performance-scope-v2.service.ts',
  'prediction_history',
  'sports_odds_snapshots',
  'game_results',
]

for (const term of requiredMapTerms) {
  assert((map + lineage).includes(term), `missing runtime/data lineage term: ${term}`)
}

assert(cert.status === 'PASS_WITH_HIGH_LINKAGE_REPAIR_PLAN', 'PI-03 status must be PASS_WITH_HIGH_LINKAGE_REPAIR_PLAN')
assert(cert.classification === 'PI_03_PASS_WITH_HIGH_LINKAGE_REPAIR_PLAN', 'PI-03 classification mismatch')
assert(cert.startingCommit === cert.productionCommit, 'starting and production commits should align for this audit')
assert(cert.providerCallsFromAudit === 0, 'certification must record zero provider calls')
assert(cert.databaseMutationsFromAudit === 0, 'certification must record zero database mutations')
assert(cert.predictionWritesFromAudit === 0, 'certification must record zero prediction writes')
assert(cert.resultWritesFromAudit === 0, 'certification must record zero result writes')
assert(cert.settlementWritesFromAudit === 0, 'certification must record zero settlement writes')
assert(cert.learningWritesFromAudit === 0, 'certification must record zero learning writes')
assert(cert.freshnessContracts.staleEvidenceActionable === false, 'stale evidence must not be actionable')
assert(cert.exactMarketTraces.some((trace) => trace.classification === 'PRICE_EXISTS_DIFFERENT_SIDE'), 'Odds N/A trace must distinguish opposite-side price')
assert(cert.exactMarketTraces.some((trace) => trace.classification === 'IDENTITY_MATCH'), 'priced market trace must exist')
assert(cert.findings.critical.length === 0, 'no critical finding should be certified')
assert(cert.findings.high.length >= 1, 'high linkage finding must be recorded')
assert(cert.canPilotContinueSafely === true, 'pilot continuation decision must be explicit')
assert(cert.humanApprovalRequired === true, 'repair plan must require human approval')

const runtimeFiles = [
  'src/services/current-board.service.ts',
  'src/services/market-alignment.service.ts',
  'src/services/product-freshness-sla.service.ts',
  'src/services/canonical-acquisition.service.ts',
  'src/services/adaptive-refresh-orchestrator.service.ts',
]

for (const file of runtimeFiles) {
  assert(fs.existsSync(file), `required runtime evidence missing: ${file}`)
}

console.log(JSON.stringify({
  ok: true,
  validator: 'production-pilot-pi-03-validate',
  artifacts: requiredFiles.length,
  providerCallsFromAudit: cert.providerCallsFromAudit,
  databaseMutationsFromAudit: cert.databaseMutationsFromAudit,
  classification: cert.classification,
}, null, 2))

