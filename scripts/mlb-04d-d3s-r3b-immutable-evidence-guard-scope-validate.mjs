import fs from 'node:fs'

process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://example.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'placeholder-service-role-key'

const SERVICE_PATH = 'src/services/mlb-04d-forward-opportunity-evidence.service.ts'
const WRITER_PATH = 'src/services/sportsdataio-mlb-prospective-preview.service.ts'
const DOC_PATH = 'docs/PRODUCTION_PILOT/MLB_04D_D3S_R3B_IMMUTABLE_EVIDENCE_GUARD_SCOPE_REPAIR.md'
const CERT_PATH = 'docs/CERTIFICATION/mlb-04d-d3s-r3b-immutable-evidence-guard-scope.json'

const {
  MLB_FORWARD_OPPORTUNITY_EVIDENCE_AUTHORIZATION_ENV,
  MLB_FORWARD_OPPORTUNITY_EVIDENCE_CANARY_AUTHORIZATION_ENV,
  MLB_FORWARD_OPPORTUNITY_EVIDENCE_CONTINUOUS_AUTHORIZATION_ENV,
  MLB_FORWARD_OPPORTUNITY_EVIDENCE_CANARY_MAX_NEW_ROWS,
  buildMlbForwardOpportunityEvidenceRow,
  evaluateMlbForwardOpportunityEvidencePersistencePolicy,
  runMlbForwardOpportunityEvidenceFixture,
} = await import('../src/services/mlb-04d-forward-opportunity-evidence.service.ts')

const service = fs.readFileSync(SERVICE_PATH, 'utf8')
const writer = fs.readFileSync(WRITER_PATH, 'utf8')
const doc = fs.readFileSync(DOC_PATH, 'utf8')
const cert = JSON.parse(fs.readFileSync(CERT_PATH, 'utf8'))
const fixture = runMlbForwardOpportunityEvidenceFixture()

const rows = [
  buildMlbForwardOpportunityEvidenceRow({
    sportKey: 'baseball_mlb',
    eventId: 'baseball_mlb:fixture:event:r3b',
    predictionHistoryId: '11111111-1111-5111-8111-111111111111',
    market: 'moneyline',
    selection: 'SF',
    line: null,
    sportsbook: 'FanDuel',
    odds: -120,
    oddsTimestamp: '2026-08-24T20:00:00.000Z',
    oddsSnapshotId: 'r3b-a',
    generatedAt: '2026-08-24T20:01:00.000Z',
    rawModelProbability: 0.49,
    calibratedProbability: 0.53,
    rawModelVersion: 'baseball_mlb_prospective_preview_v1',
    calibrationVersion: 'mlb_market_empirical_calibration_v1_2026_08_20',
    methodologyVersion: 'MLB_FORWARD_OPPORTUNITY_EVIDENCE_V1',
    evidenceCutoffAt: '2026-08-24T23:50:00.000Z',
  }),
  buildMlbForwardOpportunityEvidenceRow({
    sportKey: 'baseball_mlb',
    eventId: 'baseball_mlb:fixture:event:r3b',
    predictionHistoryId: '22222222-2222-5222-8222-222222222222',
    market: 'total',
    selection: 'Under',
    line: 7.5,
    sportsbook: 'FanDuel',
    odds: -124,
    oddsTimestamp: '2026-08-24T20:00:00.000Z',
    oddsSnapshotId: 'r3b-b',
    generatedAt: '2026-08-24T20:01:00.000Z',
    rawModelProbability: 0.3851,
    calibratedProbability: 0.524,
    rawModelVersion: 'baseball_mlb_prospective_preview_v1',
    calibrationVersion: 'mlb_market_empirical_calibration_v1_2026_08_20',
    methodologyVersion: 'MLB_FORWARD_OPPORTUNITY_EVIDENCE_V1',
    evidenceCutoffAt: '2026-08-24T23:50:00.000Z',
  }),
]

const legacyBroad = evaluateMlbForwardOpportunityEvidencePersistencePolicy(rows, {
  execute: true,
  mode: 'continuous',
  env: { [MLB_FORWARD_OPPORTUNITY_EVIDENCE_AUTHORIZATION_ENV]: 'true' },
})
const canaryBroad = evaluateMlbForwardOpportunityEvidencePersistencePolicy(rows, {
  execute: true,
  mode: 'continuous',
  env: { [MLB_FORWARD_OPPORTUNITY_EVIDENCE_CANARY_AUTHORIZATION_ENV]: 'true' },
})
const continuousBroad = evaluateMlbForwardOpportunityEvidencePersistencePolicy(rows, {
  execute: true,
  mode: 'continuous',
  env: { [MLB_FORWARD_OPPORTUNITY_EVIDENCE_CONTINUOUS_AUTHORIZATION_ENV]: 'true' },
})
const canaryOne = evaluateMlbForwardOpportunityEvidencePersistencePolicy([rows[0]], {
  execute: true,
  mode: 'canary',
  selectedDeterministicIdentity: rows[0].deterministic_identity,
  env: { [MLB_FORWARD_OPPORTUNITY_EVIDENCE_CANARY_AUTHORIZATION_ENV]: 'true' },
})
const canaryArray = evaluateMlbForwardOpportunityEvidencePersistencePolicy(rows, {
  execute: true,
  mode: 'canary',
  selectedDeterministicIdentity: rows[0].deterministic_identity,
  env: { [MLB_FORWARD_OPPORTUNITY_EVIDENCE_CANARY_AUTHORIZATION_ENV]: 'true' },
})
const mismatch = evaluateMlbForwardOpportunityEvidencePersistencePolicy([rows[0]], {
  execute: true,
  mode: 'canary',
  selectedDeterministicIdentity: rows[1].deterministic_identity,
  env: { [MLB_FORWARD_OPPORTUNITY_EVIDENCE_CANARY_AUTHORIZATION_ENV]: 'true' },
})

const checks = []
function check(name, passed) {
  checks.push({ name, passed: Boolean(passed) })
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`)
}

check('classification', cert.classification === 'MLB_04D_D3S_R3B_IMMUTABLE_EVIDENCE_GUARD_SCOPE_REPAIR_CERTIFIED')
check('legacy global flag blocked for broad natural writer', legacyBroad.status === 'BLOCKED_BY_CONTINUOUS_AUTHORIZATION' && legacyBroad.maxNewRows === 0)
check('canary flag blocked for broad natural writer', canaryBroad.status === 'BLOCKED_BY_CONTINUOUS_AUTHORIZATION' && canaryBroad.maxNewRows === 0)
check('continuous flag required for broad natural writer', continuousBroad.status === 'AUTHORIZED_CONTINUOUS' && continuousBroad.maxNewRows === rows.length)
check('one-row canary selected identity required', canaryOne.status === 'AUTHORIZED_CANARY_ONE_ROW' && canaryOne.maxNewRows === MLB_FORWARD_OPPORTUNITY_EVIDENCE_CANARY_MAX_NEW_ROWS)
check('canary array blocked', canaryArray.status === 'BLOCKED_CANARY_ROW_SCOPE')
check('canary identity mismatch blocked', mismatch.status === 'BLOCKED_CANARY_IDENTITY_MISMATCH')
check('fixture captures incident regression', fixture.writeGuard.legacyFlagDoesNotAuthorizeContinuous === true && fixture.writeGuard.canaryFlagDoesNotAuthorizeContinuous === true && fixture.canaryScope.broadAttemptStatus === 'BLOCKED_CANARY_ROW_SCOPE')
check('D3W path uses continuous guard', writer.includes('continuousOpportunityEvidenceAuthorized()') && writer.includes("mode: 'continuous'") && !writer.includes('opportunityEvidenceAuthorized()'))
check('dedicated canary helper exists', service.includes('persistSingleMlbForwardOpportunityEvidenceCanary') && service.includes('selectedDeterministicIdentity'))
check('docs describe split guards', doc.includes('MLB_FORWARD_OPPORTUNITY_EVIDENCE_CONTINUOUS_AUTHORIZED=true') && doc.includes('MLB_FORWARD_OPPORTUNITY_EVIDENCE_CANARY_AUTHORIZED=true'))
check('certification zero writes', cert.providerCalls === 0 && cert.productionDbMutations === 0 && cert.evidenceWrites === 0 && cert.ledgerWrites === 0)
check('incident rows preserved', cert.incidentRowsPreserved === true && cert.incidentRowsDeleted === 0)
check('secret scan', !/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|SUPABASE_SERVICE_ROLE_KEY\s*=|THE_ODDS_API_KEY\s*=|ODDS_API_KEY\s*=|CRON_SECRET\s*=)/.test([service, writer, doc, JSON.stringify(cert)].join('\n')))

const failed = checks.filter((row) => !row.passed)
console.log(JSON.stringify({
  success: failed.length === 0,
  mode: 'mlb_04d_d3s_r3b_immutable_evidence_guard_scope_validate',
  classification: cert.classification,
  checks: checks.length,
  failedChecks: failed.map((row) => row.name),
  providerCallsMade: 0,
  productionDatabaseMutations: 0,
}, null, 2))

if (failed.length) process.exit(1)
