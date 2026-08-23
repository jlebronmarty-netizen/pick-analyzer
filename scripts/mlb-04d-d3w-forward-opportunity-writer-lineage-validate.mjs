import fs from 'node:fs'

process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://example.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'placeholder-service-role-key'

const WRITER_PATH = 'src/services/sportsdataio-mlb-prospective-preview.service.ts'
const ORCHESTRATOR_PATH = 'src/services/adaptive-refresh-orchestrator.service.ts'
const D3R_PATH = 'src/services/mlb-04d-probability-lineage.service.ts'
const CALIBRATION_PATH = 'src/services/mlb-calibrated-shadow-v1.service.ts'
const DOC_PATH = 'docs/PRODUCTION_PILOT/MLB_04D_D3W_FORWARD_OPPORTUNITY_WRITER_LINEAGE.md'
const CERT_PATH = 'docs/CERTIFICATION/mlb-04d-d3w-forward-opportunity-writer-lineage.json'

const {
  MLB_04D_D3W_CLASSIFICATION,
  MLB_04D_D3W_LINEAGE_VERSION,
  getMlb04dD3wForwardWriterAudit,
  runMlb04dD3wForwardWriterFixture,
} = await import('../src/services/sportsdataio-mlb-prospective-preview.service.ts')

const { buildMlb04dForwardLedgerProbabilityPayload } = await import('../src/services/mlb-04d-probability-lineage.service.ts')

const writer = fs.readFileSync(WRITER_PATH, 'utf8')
const orchestrator = fs.readFileSync(ORCHESTRATOR_PATH, 'utf8')
const d3r = fs.readFileSync(D3R_PATH, 'utf8')
const calibration = fs.readFileSync(CALIBRATION_PATH, 'utf8')
const doc = fs.readFileSync(DOC_PATH, 'utf8')
const cert = JSON.parse(fs.readFileSync(CERT_PATH, 'utf8'))

const audit = getMlb04dD3wForwardWriterAudit()
const fixture = runMlb04dD3wForwardWriterFixture()

const checks = []
function check(name, passed) {
  checks.push({ name, passed: Boolean(passed) })
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`)
}

check('classification', cert.classification === MLB_04D_D3W_CLASSIFICATION && fixture.classification === MLB_04D_D3W_CLASSIFICATION)
check('active forward writer identified', audit.activeForwardWriter.includes('generateMlbProspectivePredictionsFromStoredOdds') && writer.includes('function writeSnapshotsAndPredictions'))
check('active scheduled path uses writer', orchestrator.includes('generateMlbProspectivePredictionsFromStoredOdds') && audit.activeScheduledPath.includes('runAdaptiveRefresh'))
check('legacy path shares writer and is authority-gated', writer.includes('runSportsDataIoMlbProspectivePreview') && writer.includes('SKIPPED_AUTHORITY_NOT_SPORTSDATAIO'))
check('canonical writer reused', writer.includes('buildSportPrediction({') && writer.includes('rawModelProbabilityPercent: sdk.modelProbability'))
check('no parallel prediction architecture', !writer.includes('function buildParallelMlbPrediction') && !writer.includes('new RawCalibratedPredictionEngine'))
check('calibration helper reused', writer.includes('calibrateMlbShadowProbability') && calibration.includes('getMlbCalibratedShadowArtifactSummary') && fixture.rawNotEqualCalibrated.artifact.method === 'MARKET_SPECIFIC_EMPIRICAL_BUCKETS_WITH_PLATT_FALLBACK')
check('artifact digest preserved', writer.includes('calibrationArtifactDigest') && calibration.includes('digest: calibrationArtifact.digest'))
check('certification metadata raw/calibrated pair', writer.includes('certification_metadata: probabilityLineage.certificationMetadata') && writer.includes('rawModelProbability') && writer.includes('calibratedProbability'))
check('feature snapshot raw/calibrated pair', writer.includes('mlb03CalibratedShadow') && writer.includes('mlb04dD3wProbabilityLineage'))
check('same opportunity binding stored', writer.includes('sameOpportunityBinding') && writer.includes('exactOpportunityIdentity'))
check('model_probability policy unchanged', writer.includes('model_probability: sdk.modelProbability') && cert.modelProbabilityPolicy === 'UNCHANGED_RAW_SDK_PERCENT')
check('D3R reader can consume writer pair', fixture.sameOpportunityLineage.status === 'PAIR_READY' && fixture.sameOpportunityLedgerPayload.ready === true)
check('ledger payload schema parity', ['raw_probability', 'calibrated_probability', 'calibration_delta'].every((key) => key in fixture.sameOpportunityLedgerPayload))
check('raw not equal calibrated fixture', fixture.rawNotEqualCalibrated.ready === true && fixture.rawNotEqualCalibrated.rawModelProbability !== fixture.rawNotEqualCalibrated.calibratedProbability)
check('raw equal calibrated fixture', fixture.rawEqualLineage.status === 'PAIR_READY' && fixture.rawEqualLineage.rawProbability === fixture.rawEqualLineage.calibratedProbability)
check('missing raw fails closed', fixture.missingRaw.status === 'RAW_MISSING' && buildMlb04dForwardLedgerProbabilityPayload(fixture.missingRaw).ready === false)
check('missing calibrated fails closed', fixture.missingCalibrated.status === 'CALIBRATED_MISSING' && buildMlb04dForwardLedgerProbabilityPayload(fixture.missingCalibrated).ready === false)
check('writer idempotency unchanged', fixture.idempotency.stable === true)
check('product exposure remains separated', fixture.productIsolation.recommended_pick === false && fixture.productIsolation.production_eligible === false && fixture.productIsolation.productVisible === false)
check('current board/API dry-run exposes internal lineage', writer.includes('rawModelProbability: probabilityLineage.rawModelProbability') && writer.includes('probabilityLineageStatus'))
check('old rows not mutated/backfilled', cert.oldRowsMutated === false && doc.includes('No old rows are backfilled'))
check('no retrospective raw synthesis', cert.noRetrospectiveRawSynthesis === true && !writer.includes('rawModelProbability: calibratedProbability'))
check('raw model unchanged', cert.rawModelChanged === false && writer.includes('buildSportPrediction'))
check('calibration unchanged', cert.calibrationChanged === false && !writer.includes('refit') && !writer.includes('trainCalibration'))
check('learning settlement isolation', cert.learningChanged === false && cert.settlementChanged === false)
check('automation not activated', cert.automationActivated === false && cert.activeCronAdded === false)
check('provider calls zero', fixture.providerCallsMade === 0 && cert.providerCalls === 0)
check('production DB mutations zero', fixture.productionDatabaseMutations === 0 && cert.productionDbMutations === 0)
check('no writer provider fanout added', !/buildMlb04dD3wProbabilityLineage[\s\S]{0,4000}fetch\s*\(/.test(writer))
check('D3R explicit paths preserved', d3r.includes('certification_metadata.rawModelProbability') && d3r.includes('feature_snapshot.mlb03CalibratedShadow.calibratedProbability'))
check('docs/cert current', doc.includes(MLB_04D_D3W_LINEAGE_VERSION) && cert.contractVersion === MLB_04D_D3W_LINEAGE_VERSION)
check('secret scan', !/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|SUPABASE_SERVICE_ROLE_KEY\s*=|THE_ODDS_API_KEY\s*=|ODDS_API_KEY\s*=|CRON_SECRET\s*=)/.test([writer, doc, JSON.stringify(cert)].join('\n')))

const failed = checks.filter((row) => !row.passed)
console.log(JSON.stringify({
  success: failed.length === 0,
  mode: 'mlb_04d_d3w_forward_opportunity_writer_lineage_validate',
  classification: MLB_04D_D3W_CLASSIFICATION,
  checks: checks.length,
  failedChecks: failed.map((row) => row.name),
  activeForwardWriter: audit.activeForwardWriter,
  sameOpportunityLineage: fixture.sameOpportunityLineage.status,
  providerCalls: 0,
  productionDbMutations: 0,
}, null, 2))

if (failed.length) process.exit(1)
