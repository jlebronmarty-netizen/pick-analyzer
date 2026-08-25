import fs from 'node:fs'

process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://example.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'placeholder-service-role-key'

const SERVICE_PATH = 'src/services/mlb-04d-forward-opportunity-evidence.service.ts'
const WRITER_PATH = 'src/services/sportsdataio-mlb-prospective-preview.service.ts'
const SNAPSHOT_SERVICE_PATH = 'src/services/mlb-04b-research-snapshot-runtime.service.ts'
const LEDGER_SERVICE_PATH = 'src/services/mlb-04d-forward-automation-prep.service.ts'
const PROJECT_STATUS_PATH = 'docs/PROJECT_STATUS.md'
const ROADMAP_PATH = 'docs/MASTER_ROADMAP.md'
const CERT_PATH = 'docs/CERTIFICATION/mlb-04d-d3s-r3d-r1-jsonb-semantic-readback-parity.json'

const {
  semanticJsonReadbackEqual,
  runMlbForwardOpportunityEvidenceCanaryContractFixture,
  runMlbForwardOpportunityEvidenceFixture,
} = await import('../src/services/mlb-04d-forward-opportunity-evidence.service.ts')

const service = fs.readFileSync(SERVICE_PATH, 'utf8')
const writer = fs.readFileSync(WRITER_PATH, 'utf8')
const snapshotService = fs.readFileSync(SNAPSHOT_SERVICE_PATH, 'utf8')
const ledgerService = fs.readFileSync(LEDGER_SERVICE_PATH, 'utf8')
const projectStatus = fs.readFileSync(PROJECT_STATUS_PATH, 'utf8')
const roadmap = fs.readFileSync(ROADMAP_PATH, 'utf8')
const cert = JSON.parse(fs.readFileSync(CERT_PATH, 'utf8'))
const canaryFixture = await runMlbForwardOpportunityEvidenceCanaryContractFixture()
const guardFixture = runMlbForwardOpportunityEvidenceFixture()

const checks = []
function check(name, passed) {
  checks.push({ name, passed: Boolean(passed) })
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`)
}

const keyOrderPayload = { a: 1, b: { x: 2, y: 3 } }
const keyOrderReadback = { b: { y: 3, x: 2 }, a: 1 }
const realValueChange = { a: 1, b: { x: 2, y: 4 } }
const missingValue = { a: 1, b: { x: 2 } }
const nullValue = { a: 1, b: { x: 2, y: null } }
const sourceLineagePayload = {
  predictionHistoryId: '4f5aef64-e24b-504e-9f96-5d5f39669b44',
  oddsSnapshotId: 'oddsapi_shadow_42af31179608cb4dac3b741fc7cf',
  featureSnapshotId: '9ce0b207-7250-4e25-8ccc-844b10efa360',
  mutablePredictionHistoryReference: true,
  predictionHistoryIsEvidenceAuthority: false,
}
const sourceLineageReadback = {
  oddsSnapshotId: 'oddsapi_shadow_42af31179608cb4dac3b741fc7cf',
  featureSnapshotId: '9ce0b207-7250-4e25-8ccc-844b10efa360',
  predictionHistoryId: '4f5aef64-e24b-504e-9f96-5d5f39669b44',
  predictionHistoryIsEvidenceAuthority: false,
  mutablePredictionHistoryReference: true,
}

check('classification', cert.classification === 'MLB_04D_D3S_R3D_R1_JSONB_SEMANTIC_READBACK_PARITY_REPAIR_CERTIFIED')
check('root cause documented', cert.rootCause === 'JSON_OBJECT_KEY_ORDER_SENSITIVE_COMPARISON')
check('semantic comparator exported', typeof semanticJsonReadbackEqual === 'function' && service.includes('export function semanticJsonReadbackEqual'))
check('recursive key order ignored', semanticJsonReadbackEqual(keyOrderPayload, keyOrderReadback))
check('source lineage semantic parity', semanticJsonReadbackEqual(sourceLineagePayload, sourceLineageReadback))
check('real value mismatch detected', !semanticJsonReadbackEqual(keyOrderPayload, realValueChange))
check('missing vs null distinction preserved', !semanticJsonReadbackEqual(missingValue, nullValue))
check('array ordering preserved', !semanticJsonReadbackEqual([1, 2, 3], [3, 2, 1]))
check('primitive type strict', !semanticJsonReadbackEqual({ a: 1, b: true }, { a: '1', b: 'true' }))
check('non-json fields remain in parity list', [
  'id',
  'deterministic_identity',
  'event_id',
  'market',
  'selection',
  'line',
  'sportsbook',
  'odds',
  'odds_timestamp',
  'raw_model_probability',
  'calibrated_probability',
  'calibration_delta',
  'raw_model_version',
  'calibration_version',
  'methodology_version',
].every((field) => service.includes(`'${field}'`)))
check('json fields included', service.includes("'source_lineage'") && service.includes("'opportunity_evidence'"))
check('numeric parity preserved', service.includes('Number(value.toFixed(6))'))
check('write/readback parity fixture preserved', canaryFixture.zeroMatchInsert.writeReadbackParity === 'PASS' && canaryFixture.oneMatchReuse.writeReadbackParity === 'PASS')
check('pre-read preservation', service.includes('readByDeterministicIdentity') && canaryFixture.zeroMatchInsert.preReadExactMatches === 0 && canaryFixture.oneMatchReuse.preReadExactMatches === 1)
check('reuse preservation', canaryFixture.oneMatchReuse.status === 'REUSE_NO_OP' && canaryFixture.oneMatchReuse.inserted === 0)
check('duplicate defect preservation', canaryFixture.duplicateDefect.status === 'BLOCK_DUPLICATE_DEFECT' && canaryFixture.duplicateDefect.preReadExactMatches === 2)
check('max-one cardinality preserved', service.includes('MLB_FORWARD_OPPORTUNITY_EVIDENCE_CANARY_MAX_NEW_ROWS = 1'))
check('append-only insert path preserved', service.includes(".from('mlb_forward_opportunity_evidence')") && service.includes('.insert(row)') && !service.includes(".from('mlb_forward_opportunity_evidence').update(") && !service.includes(".from('mlb_forward_opportunity_evidence').delete("))
check('authorization scope preserved', guardFixture.writeGuard.legacyFlagDoesNotAuthorizeContinuous === true && guardFixture.writeGuard.canaryFlagDoesNotAuthorizeContinuous === true && writer.includes('continuousOpportunityEvidenceAuthorized()') && !writer.includes('canaryOpportunityEvidenceAuthorized()'))
check('snapshot auth separated', snapshotService.includes('MLB_04B_CONTEXT_SNAPSHOT_AUTHORIZED') && !snapshotService.includes('MLB_FORWARD_OPPORTUNITY_EVIDENCE_CANARY_AUTHORIZED'))
check('ledger separation preserved', !ledgerService.includes('MLB_FORWARD_OPPORTUNITY_EVIDENCE_CANARY_AUTHORIZED') && cert.ledgerWrites === 0)
check('incident and selected row preserved', cert.incidentRowsPreserved === true && cert.selectedEvidenceRowPreserved === 'de7e36a1-058e-5b9e-a711-9ad87ee15c69')
check('raw calibration isolation', cert.rawModelChanged === false && cert.calibrationChanged === false)
check('product learning settlement isolation', cert.productWrites === 0 && cert.learningWrites === 0 && cert.settlementWrites === 0)
check('automation off', cert.automationActivated === false && cert.activeCronAdded === false)
check('provider/db zero in repair certification', cert.providerCalls === 0 && cert.productionDbMutations === 0)
check('SportsDataIO/NFL/NBA isolation', cert.sportsDataIoCalls === 0 && cert.nflIsolation === true && cert.nbaIsolation === true)
check('docs current', projectStatus.includes(cert.classification) && roadmap.includes(cert.classification))
check('secret scan', !/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|SUPABASE_SERVICE_ROLE_KEY\\s*=|THE_ODDS_API_KEY\\s*=|ODDS_API_KEY\\s*=|CRON_SECRET\\s*=)/.test([service, writer, snapshotService, ledgerService, projectStatus, roadmap, JSON.stringify(cert)].join('\n')))

const failed = checks.filter((row) => !row.passed)
console.log(JSON.stringify({
  success: failed.length === 0,
  mode: 'mlb_04d_d3s_r3d_r1_jsonb_semantic_readback_parity_validate',
  classification: cert.classification,
  checks: checks.length,
  failedChecks: failed.map((row) => row.name),
  JSONB_SEMANTIC_PARITY_COMPARATOR_READY: semanticJsonReadbackEqual(keyOrderPayload, keyOrderReadback) ? 'YES' : 'NO',
  SOURCE_LINEAGE_SEMANTIC_PARITY_READY: semanticJsonReadbackEqual(sourceLineagePayload, sourceLineageReadback) ? 'YES' : 'NO',
  REAL_VALUE_MISMATCH_DETECTED: !semanticJsonReadbackEqual(keyOrderPayload, realValueChange) ? 'YES' : 'NO',
  ARRAY_ORDER_PRESERVED: !semanticJsonReadbackEqual([1, 2, 3], [3, 2, 1]) ? 'YES' : 'NO',
  MISSING_NULL_DISTINCTION_PRESERVED: !semanticJsonReadbackEqual(missingValue, nullValue) ? 'YES' : 'NO',
  providerCallsMade: 0,
  productionDatabaseMutations: 0,
}, null, 2))

if (failed.length) process.exit(1)
