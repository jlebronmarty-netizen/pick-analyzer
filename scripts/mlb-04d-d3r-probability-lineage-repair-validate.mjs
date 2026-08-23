import fs from 'node:fs'

process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://example.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'placeholder-service-role-key'

const SERVICE_PATH = 'src/services/mlb-04d-probability-lineage.service.ts'
const D1_SERVICE_PATH = 'src/services/mlb-04d-d1-forward-automation-planner.service.ts'
const CALIBRATED_SERVICE_PATH = 'src/services/mlb-calibrated-shadow-v1.service.ts'
const CANARY_WRITER_PATH = 'scripts/mlb-03r1a-first-calibrated-shadow-canary.mjs'
const DOC_PATH = 'docs/PRODUCTION_PILOT/MLB_04D_D3R_RAW_CALIBRATED_PROBABILITY_LINEAGE_REPAIR.md'
const CERT_PATH = 'docs/CERTIFICATION/mlb-04d-d3r-raw-calibrated-probability-lineage-repair.json'

const {
  MLB_04D_D3R_CLASSIFICATION,
  buildMlb04dForwardLedgerProbabilityPayload,
  extractMlb04dProbabilityLineage,
  getMlb04dProbabilityLineageContract,
  runMlb04dD3rProbabilityLineageFixture,
} = await import('../src/services/mlb-04d-probability-lineage.service.ts')

const {
  auditMlb04dD1ForwardAutomationImplementation,
} = await import('../src/services/mlb-04d-d1-forward-automation-planner.service.ts')

const service = fs.readFileSync(SERVICE_PATH, 'utf8')
const d1Service = fs.readFileSync(D1_SERVICE_PATH, 'utf8')
const calibratedService = fs.readFileSync(CALIBRATED_SERVICE_PATH, 'utf8')
const canaryWriter = fs.readFileSync(CANARY_WRITER_PATH, 'utf8')
const doc = fs.readFileSync(DOC_PATH, 'utf8')
const cert = JSON.parse(fs.readFileSync(CERT_PATH, 'utf8'))

const contract = getMlb04dProbabilityLineageContract()
const fixture = runMlb04dD3rProbabilityLineageFixture()
const d1Audit = auditMlb04dD1ForwardAutomationImplementation()

const checks = []
function check(name, passed) {
  checks.push({ name, passed: Boolean(passed) })
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`)
}

const opportunity = {
  eventId: 'baseball_mlb:fixture:event:2',
  market: 'moneyline',
  selection: 'Home',
  line: null,
  sportsbook: 'Caesars',
  oddsTimestamp: '2026-08-22T15:00:00.000Z',
  snapshotTimestamp: '2026-08-22T16:00:00.000Z',
  cutoffAt: '2026-08-22T23:00:00.000Z',
}
const modelProbabilityFallback = extractMlb04dProbabilityLineage({
  game_id: opportunity.eventId,
  market: opportunity.market,
  selection: opportunity.selection,
  line: null,
  sportsbook: opportunity.sportsbook,
  odds_timestamp: opportunity.oddsTimestamp,
  model_probability: 51.11,
  model_version: 'MLB_CALIBRATED_SHADOW_V1',
  prediction_origin: 'CURRENT_ERA_SHADOW',
  model_role: 'shadow',
  certification_metadata: { rawModelProbability: 0.4711 },
  feature_snapshot: {},
}, opportunity)

check('classification', cert.classification === MLB_04D_D3R_CLASSIFICATION && fixture.classification === MLB_04D_D3R_CLASSIFICATION)
check('source model contract unchanged', calibratedService.includes('rawModelProbability') && calibratedService.includes('calibratedProbability') && calibratedService.includes('calibrationStatus'))
check('canonical writer lineage reused', canaryWriter.includes('rawModelProbability: chosen.rawProbability') && canaryWriter.includes('calibratedProbability: chosen.calibratedProbability'))
check('probability inventory has explicit paths', service.includes('certification_metadata.rawModelProbability') && service.includes('feature_snapshot.mlb03CalibratedShadow.calibratedProbability'))
check('exact pair ready', fixture.explicitPair.status === 'PAIR_READY' && fixture.payload.ready === true)
check('raw and calibrated are distinct fields', fixture.explicitPair.rawProbability === 0.3851 && fixture.explicitPair.calibratedProbability === 0.524)
check('calibration delta computed', fixture.explicitPair.calibrationDelta === 0.1389)
check('raw missing fails closed', fixture.rawMissing.status === 'RAW_MISSING' && fixture.rawMissing.rawProbability === null)
check('calibrated missing fails closed', fixture.calibratedMissing.status === 'CALIBRATED_MISSING' && fixture.calibratedMissing.calibratedProbability === null)
check('old stored single-value rows fail closed', fixture.oldProspectiveFailClosed.status === 'RAW_MISSING' && fixture.oldProspectiveFailClosed.modelProbabilitySemantics === 'AMBIGUOUS_SINGLE_VALUE')
check('line identity enforced', fixture.lineMismatch.status === 'LINE_MISMATCH')
check('sportsbook identity enforced', fixture.sportsbookMismatch.status === 'SPORTSBOOK_MISMATCH')
check('pregame timestamp cutoff enforced', fixture.timestampViolation.status === 'TIMESTAMP_CUTOFF_VIOLATION')
check('model probability fallback only calibrated with raw lineage', modelProbabilityFallback.status === 'PAIR_READY' && modelProbabilityFallback.calibratedProbability === 0.5111 && modelProbabilityFallback.rawProbability === 0.4711)
check('ledger payload blocks unsafe rows', buildMlb04dForwardLedgerProbabilityPayload(fixture.oldProspectiveFailClosed).ready === false)
check('storage location decision documented', contract.storageLocationDecision.includes('certification_metadata') && cert.forwardLineageContract.rawSource.length >= 4)
check('model probability semantics documented', contract.modelProbabilitySemantics.prospectivePreviewV1.toLowerCase().includes('ambiguous') && doc.includes('model_probability` is not enough by itself'))
check('D1 planner exposes lineage readiness', d1Audit.readiness.FORWARD_LEDGER_PROBABILITY_LINEAGE_READY === 'YES' && d1Audit.probabilityLineage.forwardLedgerBlocksWithoutExplicitPair === true)
check('D3 example preserved blocked', cert.d3Example.rawProbability === 'MISSING' && cert.d3Example.classification === 'FAIL_CLOSED_RAW_MISSING')
check('no retrospective repair', cert.forwardLineageContract.retrospectiveBackfill === false && doc.includes('does not backfill'))
check('no copy calibrated to raw', cert.forwardLineageContract.copyCalibratedIntoRaw === false && !service.includes('rawProbability: calibrated'))
check('no reverse engineering', cert.forwardLineageContract.reverseEngineerCalibration === false && !service.includes('inverse'))
check('same opportunity binding', ['event', 'market', 'selection', 'line', 'sportsbook'].every((key) => contract.exactBinding.includes(key)))
check('raw/calibration/product isolation', cert.isolation.modelFormulaChanged === false && cert.isolation.calibrationArtifactChanged === false && cert.isolation.productChanged === false)
check('learning settlement isolation', cert.isolation.learningChanged === false && cert.isolation.settlementChanged === false)
check('automation remains off', cert.isolation.automationActivated === false && cert.isolation.activeCronChanged === false)
check('provider calls zero', cert.safetyCounters.providerCallsMade === 0 && fixture.providerCallsMade === 0)
check('db mutations zero', cert.safetyCounters.productionDatabaseMutations === 0 && fixture.productionDatabaseMutations === 0)
check('write counters zero', ['predictionWrites', 'snapshotWrites', 'ledgerWrites', 'settlementWrites', 'learningWrites', 'calibrationWrites', 'officialPickWrites', 'productWrites'].every((key) => cert.safetyCounters[key] === 0))
check('no provider fetch in lineage service', !/fetch\s*\(/.test(service) && !/axios\./.test(service))
check('no write query in lineage service', !/\.insert\s*\(|\.upsert\s*\(|\.update\s*\(|\.delete\s*\(/.test(service))
check('no production route added', !service.includes('export async function GET') && !service.includes('export async function POST'))
check('D1 imports repair', d1Service.includes('mlb-04d-probability-lineage.service') && d1Service.includes('FORWARD_LEDGER_PROBABILITY_LINEAGE_READY'))
check('secret scan', !/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|SUPABASE_SERVICE_ROLE_KEY\s*=|THE_ODDS_API_KEY\s*=|ODDS_API_KEY\s*=|CRON_SECRET\s*=)/.test([service, d1Service, doc, JSON.stringify(cert)].join('\n')))

const failed = checks.filter((row) => !row.passed)
console.log(JSON.stringify({
  success: failed.length === 0,
  mode: 'mlb_04d_d3r_probability_lineage_repair_validate',
  classification: MLB_04D_D3R_CLASSIFICATION,
  checks: checks.length,
  failedChecks: failed.map((row) => row.name),
  explicitPair: fixture.explicitPair.status,
  oldProspectiveRow: fixture.oldProspectiveFailClosed.status,
  providerCallsMade: 0,
  productionDatabaseMutations: 0,
}, null, 2))

if (failed.length) process.exit(1)
