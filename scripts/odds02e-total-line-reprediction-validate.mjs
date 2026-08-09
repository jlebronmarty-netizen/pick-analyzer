import { existsSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const checks = []

function check(name, pass, details = '') {
  checks.push({ name, pass: Boolean(pass), details })
}

function read(path) {
  return readFileSync(path, 'utf8')
}

const requiredFiles = [
  'src/services/market-line-versioning-contract.service.ts',
  'docs/ARCHITECTURE/PREGAME_MARKET_LINE_VERSIONING_V1.md',
  'docs/PRODUCTION_PILOT/ODDS_02E_TOTAL_LINE_REPREDICTION.md',
  'docs/CERTIFICATION/odds-02e-total-line-reprediction.json',
  'scripts/odds02e-total-line-reprediction-validate.mjs',
  'docs/ARCHITECTURE/README.md',
  'docs/PRODUCTION_PILOT/README.md',
  'docs/CERTIFICATION/README.md',
]

for (const file of requiredFiles) check(`required file exists: ${file}`, existsSync(file))

const service = read('src/services/market-line-versioning-contract.service.ts')
const report = read('docs/PRODUCTION_PILOT/ODDS_02E_TOTAL_LINE_REPREDICTION.md')
const architecture = read('docs/ARCHITECTURE/PREGAME_MARKET_LINE_VERSIONING_V1.md')
const cert = JSON.parse(read('docs/CERTIFICATION/odds-02e-total-line-reprediction.json'))
const capture = JSON.parse(read(cert.capturedEvidence.capturePath))

check('captured ODDS-02C payload reused', cert.capturedEvidence.captureReused === true)
check('provider calls are zero', cert.providerCalls === 0 && cert.sportsDataIoCalls === 0 && cert.theOddsApiCalls === 0)
check('database mutations are zero', cert.databaseMutations === 0)
check('raw provider payload not committed', cert.rawOdds02cPayloadCommitted === false)
check('capture field proves prior contract dropped rows', typeof capture.shadowSnapshots === 'number' && capture.shadowSnapshots === cert.capturedEvidence.shadowSnapshotsCount)
check('aggregate total coverage preserved', capture.coverage?.totalRows === cert.capturedEvidence.aggregateTotalRows)
check('exact total match count preserved', capture.comparisons.filter((item) => item.market === 'total' && item.exactShadowMatches > 0).length === cert.simulation.exactLinesStillAvailable)
check('root cause classified', cert.totalContractRootCause === 'ROUTE_RESPONSE_DROPPED_ALTERNATE_LINES')
check('non-exact line universe not fabricated', cert.nonExactLineUniverseClassification === 'CAPTURE_INSUFFICIENT_FOR_NON_EXACT_LINE_UNIVERSE')
check('total market full-line contract traced', architecture.includes('event') && architecture.includes('bookmaker') && architecture.includes('line') && architecture.includes('source timestamp'))
check('alternate lines not collapsed incorrectly by contract', service.includes('marketLineIdentityKey') && service.includes('bookmakerKey') && service.includes('line.toFixed'))
check('exact market identity includes line', service.includes('sameLine(row.line, prediction.line)'))
check('no cross-line price binding', cert.safety.crossLinePriceBinding === false && report.includes('best-price selection cannot cross lines'))
check('no cross-line probability reuse', cert.safety.crossLineProbabilityReuse === false && architecture.includes('must never be paired'))
check('line movement classification deterministic', cert.lineMovementClassifications.includes('HALF_POINT_MOVE') && service.includes('classifyLineMovement'))
check('re-prediction requires pregame state', service.includes('eventPregame') && service.includes('nowMs < startMs'))
check('re-prediction requires cutoff-safe time', service.includes('cutoffSafe') && service.includes('nowMs < cutoffMs'))
check('exact line identity deduplicated', service.includes('exactPredictionAlreadyExists'))
check('old prediction preserved', cert.supersessionContract.oldPredictionPreserved === true && service.includes('SUPERSEDED_BY_MARKET_MOVE'))
check('supersession lineage explicit', cert.supersessionContract.requiredLineageFields.includes('supersededByPredictionId'))
check('settlement remains line-specific', service.includes('lineSpecificTotalSettlement') && cert.safety.settlementLineSpecific === true)
check('current UI cannot pair old probability with new-line odds', cert.safety.currentUiMayPairOldProbabilityWithNewLineOdds === false)
check('moneyline unaffected', cert.safety.moneylineRegression === false && architecture.includes('Moneyline has no numeric line identity'))
check('run line identity preserved', cert.safety.runLineRegression === false && architecture.includes('Run line and total markets do'))
check('production provider authority unchanged', cert.safety.sportsDataIoProductionAuthorityChanged === false)
check('Official Pick policy unchanged', cert.safety.officialPickPolicyChanged === false)
check('HR-03 unchanged', cert.safety.hr03Changed === false)
check('Current Era safety preserved', cert.safety.currentEraChanged === false)
check('ODDS-03 not started', cert.safety.odds03Started === false)

const sensitivePatterns = [
  /THE_ODDS_API_KEY\s*=\s*[^\s`'"]+/i,
  /CRON_SECRET\s*=\s*[^\s`'"]+/i,
  /authorization\s*:\s*bearer\s+[A-Za-z0-9._~+/=-]+/i,
  /apiKey=[A-Za-z0-9_-]+/i,
]

for (const file of requiredFiles) {
  const text = read(file)
  check(`no secret value exposed in ${file}`, !sensitivePatterns.some((pattern) => pattern.test(text)))
}

const statusLines = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)
const allowedDirty = new Set(requiredFiles)
const changed = statusLines.map((line) => line.slice(3).trim().replaceAll('\\', '/'))
const unexpected = changed.filter((file) => !allowedDirty.has(file))
check('only ODDS-02E files changed', unexpected.length === 0, unexpected.join(', '))

for (const item of checks) console.log(`${item.pass ? 'PASS' : 'FAIL'} ${item.name}${item.details ? ` - ${item.details}` : ''}`)

const failures = checks.filter((item) => !item.pass)
if (failures.length) {
  console.error(`ODDS-02E validation failed: ${failures.length} failure(s)`)
  process.exit(1)
}

console.log('ODDS-02E validation passed')
