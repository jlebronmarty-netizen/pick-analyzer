import fs from 'node:fs'

process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://example.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'placeholder-service-role-key'

const SERVICE_PATH = 'src/services/mlb-04d-forward-opportunity-evidence.service.ts'
const WRITER_PATH = 'src/services/sportsdataio-mlb-prospective-preview.service.ts'
const MIGRATION_PATH = 'supabase/migrations/202608240001_mlb_forward_opportunity_evidence_v1.sql'
const LEDGER_MIGRATION_PATH = 'supabase/migrations/202608230001_mlb_forward_research_ledger_v1.sql'
const DOC_PATH = 'docs/PRODUCTION_PILOT/MLB_04D_D3S_R1_IMMUTABLE_OPPORTUNITY_EVIDENCE.md'
const CERT_PATH = 'docs/CERTIFICATION/mlb-04d-d3s-r1-immutable-opportunity-evidence.json'

const {
  MLB_04D_D3S_R1_CLASSIFICATION,
  MLB_FORWARD_OPPORTUNITY_EVIDENCE_CANARY_AUTHORIZATION_ENV,
  MLB_FORWARD_OPPORTUNITY_EVIDENCE_CONTINUOUS_AUTHORIZATION_ENV,
  getMlbForwardOpportunityEvidenceRepairAudit,
  runMlbForwardOpportunityEvidenceFixture,
} = await import('../src/services/mlb-04d-forward-opportunity-evidence.service.ts')

const service = fs.readFileSync(SERVICE_PATH, 'utf8')
const writer = fs.readFileSync(WRITER_PATH, 'utf8')
const migration = fs.readFileSync(MIGRATION_PATH, 'utf8')
const ledgerMigration = fs.readFileSync(LEDGER_MIGRATION_PATH, 'utf8')
const doc = fs.readFileSync(DOC_PATH, 'utf8')
const cert = JSON.parse(fs.readFileSync(CERT_PATH, 'utf8'))
const audit = getMlbForwardOpportunityEvidenceRepairAudit()
const fixture = runMlbForwardOpportunityEvidenceFixture()

const checks = []
function check(name, passed) {
  checks.push({ name, passed: Boolean(passed) })
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`)
}

check('classification', cert.classification === MLB_04D_D3S_R1_CLASSIFICATION && fixture.classification === MLB_04D_D3S_R1_CLASSIFICATION)
check('mutable current row separation', audit.currentBoardSeparated === true && writer.includes('prediction_history') && doc.includes('current-state row'))
check('immutable opportunity schema', migration.includes('create table if not exists public.mlb_forward_opportunity_evidence') && migration.includes('deterministic_identity text not null unique'))
check('deterministic identity', audit.deterministicIdentityFields.includes('odds_timestamp') && audit.deterministicIdentityFields.includes('sportsbook') && audit.deterministicIdentityFields.includes('calibrated_probability'))
check('price/version append semantics', fixture.priceRefresh.distinctRows === 3)
check('same-book price changes', fixture.sameBookPriceChange.separateVersion === true)
check('identical replay idempotency', fixture.identicalReplay.result === 'REUSE_NO_OP')
check('raw calibrated lineage', fixture.rawCalibrated.rawNotEqualCalibrated === true && fixture.rawCalibrated.rawEqualsCalibrated === true)
check('missing probability fail closed', fixture.rawCalibrated.rawMissingFailsClosed === true && fixture.rawCalibrated.calibratedMissingFailsClosed === true)
check('temporal cutoff', fixture.snapshotPairing.opportunityABeforeMorning === 'ELIGIBLE' && fixture.snapshotPairing.opportunityBAfterMorning === 'OPPORTUNITY_AFTER_SNAPSHOT' && fixture.snapshotPairing.opportunityBBeforeFinal === 'ELIGIBLE')
check('snapshot pairing', audit.snapshotRelationship.includes('mlb_context_snapshots.id') && audit.snapshotRelationship.includes('mlb_forward_opportunity_evidence.id'))
check('no snapshot fixture', fixture.noSnapshotFixture === 'BLOCK_NO_FROZEN_SNAPSHOT')
check('current-row drift isolation', fixture.mutableRowDriftFixture.frozenOpportunityUnchangedAfterCurrentRowMutation === true && fixture.mutableRowDriftFixture.ledgerPayloadUnchanged === true)
check('ledger linkage', migration.includes('opportunity_evidence_id uuid') && migration.includes('references public.mlb_forward_opportunity_evidence(id)') && !ledgerMigration.includes('opportunity_evidence_id'))
check('product isolation', Object.values(fixture.productIsolation).every((value) => value === false))
check('learning calibration isolation', fixture.learningCalibrationIsolation.learningLabels === 0 && fixture.learningCalibrationIsolation.calibrationRefit === false && fixture.learningCalibrationIsolation.settlementSideEffects === false)
check('old-row preservation', cert.oldRowsMutated === false && cert.noRetrospectiveOpportunityFreeze === true)
check('authorization guard', service.includes(MLB_FORWARD_OPPORTUNITY_EVIDENCE_CANARY_AUTHORIZATION_ENV) && service.includes(MLB_FORWARD_OPPORTUNITY_EVIDENCE_CONTINUOUS_AUTHORIZATION_ENV) && fixture.writeGuard.canaryDefaultAuthorized === false && fixture.writeGuard.continuousDefaultAuthorized === false && fixture.writeGuard.executeRequired === true)
check('automation off', cert.automationActivated === false && cert.activeCronAdded === false && fixture.automationActivated === false && fixture.activeCronAdded === false)
check('append-only enforcement', migration.includes('prevent_mlb_forward_opportunity_evidence_update') && migration.includes('grant select, insert') && !migration.includes('grant select, insert, update'))
check('D3W integration default off', writer.includes('persistMlbForwardOpportunityEvidence') && writer.includes('continuousOpportunityEvidenceAuthorized()'))
check('SportsDataIO exclusion', cert.sportsDataIoCalls === 0)
check('NFL isolation', cert.nflIsolation === true)
check('NBA isolation', cert.nbaIsolation === true)
check('provider calls zero', cert.providerCalls === 0 && fixture.providerCallsMade === 0)
check('production db mutations zero', cert.productionDbMutations === 0 && fixture.productionDatabaseMutations === 0)
check('no provider fetch in service', !/fetch\s*\(/.test(service) && !/axios\./.test(service))
check('no product side-effect objects in migration', !/official_pick|recommended_pick|bankroll|notification|create\s+trigger[\s\S]{0,300}(learning|calibration)/i.test(migration))
check('docs current', doc.includes(MLB_04D_D3S_R1_CLASSIFICATION) && doc.includes('MLB_FORWARD_OPPORTUNITY_EVIDENCE_CONTINUOUS_AUTHORIZED=true') && doc.includes('MLB_FORWARD_OPPORTUNITY_EVIDENCE_CANARY_AUTHORIZED=true'))
check('secret scan', !/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|SUPABASE_SERVICE_ROLE_KEY\s*=|THE_ODDS_API_KEY\s*=|ODDS_API_KEY\s*=|CRON_SECRET\s*=)/.test([service, writer, migration, doc, JSON.stringify(cert)].join('\n')))

const failed = checks.filter((row) => !row.passed)
console.log(JSON.stringify({
  success: failed.length === 0,
  mode: 'mlb_04d_d3s_r1_immutable_opportunity_evidence_validate',
  classification: MLB_04D_D3S_R1_CLASSIFICATION,
  checks: checks.length,
  failedChecks: failed.map((row) => row.name),
  storageDecision: audit.storageDecision,
  immutableOpportunityAppendOnlyCertified: audit.appendOnly,
  currentBoardAndFrozenEvidenceSeparated: audit.currentBoardSeparated,
  d3PlannerImmutableEvidenceCompatible: audit.d3PlannerCompatible,
  providerCallsMade: 0,
  productionDatabaseMutations: 0
}, null, 2))

if (failed.length) process.exit(1)
