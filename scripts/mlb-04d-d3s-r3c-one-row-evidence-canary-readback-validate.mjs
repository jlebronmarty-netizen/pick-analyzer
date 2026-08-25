import fs from 'node:fs'

process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://example.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'placeholder-service-role-key'

const SERVICE_PATH = 'src/services/mlb-04d-forward-opportunity-evidence.service.ts'
const WRITER_PATH = 'src/services/sportsdataio-mlb-prospective-preview.service.ts'
const SNAPSHOT_SERVICE_PATH = 'src/services/mlb-04b-research-snapshot-runtime.service.ts'
const LEDGER_SERVICE_PATH = 'src/services/mlb-04d-forward-automation-prep.service.ts'
const DOC_PATH = 'docs/PRODUCTION_PILOT/MLB_04D_D3S_R3C_ONE_ROW_EVIDENCE_CANARY_READBACK_CONTRACT.md'
const CERT_PATH = 'docs/CERTIFICATION/mlb-04d-d3s-r3c-one-row-evidence-canary-readback.json'

const {
  MLB_04D_D3S_R3C_CLASSIFICATION,
  MLB_FORWARD_OPPORTUNITY_EVIDENCE_CANARY_MAX_NEW_ROWS,
  runMlbForwardOpportunityEvidenceCanaryContractFixture,
  runMlbForwardOpportunityEvidenceFixture,
} = await import('../src/services/mlb-04d-forward-opportunity-evidence.service.ts')

const service = fs.readFileSync(SERVICE_PATH, 'utf8')
const writer = fs.readFileSync(WRITER_PATH, 'utf8')
const snapshotService = fs.readFileSync(SNAPSHOT_SERVICE_PATH, 'utf8')
const ledgerService = fs.readFileSync(LEDGER_SERVICE_PATH, 'utf8')
const doc = fs.readFileSync(DOC_PATH, 'utf8')
const cert = JSON.parse(fs.readFileSync(CERT_PATH, 'utf8'))
const fixture = await runMlbForwardOpportunityEvidenceCanaryContractFixture()
const r3bFixture = runMlbForwardOpportunityEvidenceFixture()

const checks = []
function check(name, passed) {
  checks.push({ name, passed: Boolean(passed) })
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`)
}

check('classification', cert.classification === MLB_04D_D3S_R3C_CLASSIFICATION && fixture.classification === MLB_04D_D3S_R3C_CLASSIFICATION)
check('explicit pre-read', service.includes('readByDeterministicIdentity') && service.includes('preReadExactMatches') && fixture.zeroMatchInsert.preReadExactMatches === 0 && fixture.oneMatchReuse.preReadExactMatches === 1 && fixture.duplicateDefect.preReadExactMatches === 2)
check('zero-match insert contract', fixture.zeroMatchInsert.status === 'INSERTED' && fixture.zeroMatchInsert.inserted === 1 && fixture.zeroMatchInsert.reused === 0 && fixture.zeroMatchInsert.rowId)
check('one-match reuse contract', fixture.oneMatchReuse.status === 'REUSE_NO_OP' && fixture.oneMatchReuse.inserted === 0 && fixture.oneMatchReuse.reused === 1 && fixture.oneMatchReuse.rowId)
check('duplicate defect fail closed', fixture.duplicateDefect.status === 'BLOCK_DUPLICATE_DEFECT' && fixture.duplicateDefect.inserted === 0 && fixture.duplicateDefect.reused === 0)
check('immediate readback', service.includes('READBACK_EXACT_ONE') && fixture.zeroMatchInsert.readbackStatus === 'READBACK_EXACT_ONE' && fixture.oneMatchReuse.readbackStatus === 'READBACK_EXACT_ONE')
check('write/readback parity', fixture.zeroMatchInsert.writeReadbackParity === 'PASS' && fixture.oneMatchReuse.writeReadbackParity === 'PASS')
check('repeated idempotency', fixture.repeatedExecution.first === 'INSERTED' && fixture.repeatedExecution.second === 'REUSE_NO_OP' && fixture.repeatedExecution.totalInserted === 1 && fixture.repeatedExecution.totalRows === 1)
check('identity mismatch fail closed', fixture.identityMismatch.status === 'BLOCKED_CANARY_IDENTITY_MISMATCH' && fixture.identityMismatch.inserted === 0)
check('temporal fail closed', fixture.postStart.status === 'BLOCK_TEMPORAL_SAFETY' && fixture.postStart.inserted === 0)
check('max cardinality', fixture.maxNewRowsPerCanary === 1 && MLB_FORWARD_OPPORTUNITY_EVIDENCE_CANARY_MAX_NEW_ROWS === 1 && service.includes('persistSingleMlbForwardOpportunityEvidenceCanary(row'))
check('authorization separation preserved', r3bFixture.writeGuard.legacyFlagDoesNotAuthorizeContinuous === true && r3bFixture.writeGuard.canaryFlagDoesNotAuthorizeContinuous === true && fixture.broadWriterFixtures.canaryFlagWrites === 0 && fixture.broadWriterFixtures.legacyFlagWrites === 0)
check('background writer default off', writer.includes('continuousOpportunityEvidenceAuthorized()') && writer.includes("mode: 'continuous'") && !writer.includes('canaryOpportunityEvidenceAuthorized()'))
check('snapshot auth separated', snapshotService.includes('MLB_04B_CONTEXT_SNAPSHOT_AUTHORIZED') && !snapshotService.includes('MLB_FORWARD_OPPORTUNITY_EVIDENCE_CANARY_AUTHORIZED'))
check('ledger auth separated', !ledgerService.includes('MLB_FORWARD_OPPORTUNITY_EVIDENCE_CANARY_AUTHORIZED'))
check('observability contract', fixture.observabilityFields.every((field) => service.includes(field)))
check('docs current', doc.includes(MLB_04D_D3S_R3C_CLASSIFICATION) && doc.includes('pre-read by deterministic identity') && doc.includes('BLOCK_DUPLICATE_DEFECT'))
check('certification zero writes', cert.providerCalls === 0 && cert.productionDbMutations === 0 && cert.evidenceWrites === 0 && cert.ledgerWrites === 0)
check('incident preservation encoded', cert.incidentRowsPreserved === true)
check('current board/model isolation', cert.currentBoardPreserved === true && cert.rawModelChanged === false && cert.calibrationChanged === false)
check('product/learning/settlement isolation', cert.productWrites === 0 && cert.learningWrites === 0 && cert.settlementWrites === 0)
check('automation off', cert.automationActivated === false && cert.activeCronAdded === false)
check('SportsDataIO/NFL/NBA exclusion', cert.sportsDataIoCalls === 0 && cert.nflIsolation === true && cert.nbaIsolation === true)
check('secret scan', !/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|SUPABASE_SERVICE_ROLE_KEY\s*=|THE_ODDS_API_KEY\s*=|ODDS_API_KEY\s*=|CRON_SECRET\s*=)/.test([service, writer, snapshotService, ledgerService, doc, JSON.stringify(cert)].join('\n')))

const failed = checks.filter((row) => !row.passed)
console.log(JSON.stringify({
  success: failed.length === 0,
  mode: 'mlb_04d_d3s_r3c_one_row_evidence_canary_readback_validate',
  classification: MLB_04D_D3S_R3C_CLASSIFICATION,
  checks: checks.length,
  failedChecks: failed.map((row) => row.name),
  zeroMatchStatus: fixture.zeroMatchInsert.status,
  oneMatchStatus: fixture.oneMatchReuse.status,
  duplicateDefectStatus: fixture.duplicateDefect.status,
  repeatedExecution: fixture.repeatedExecution,
  providerCallsMade: 0,
  productionDatabaseMutations: 0,
}, null, 2))

if (failed.length) process.exit(1)
