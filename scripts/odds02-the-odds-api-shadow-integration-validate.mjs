import { existsSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const requiredFiles = [
  'src/services/odds02-shadow-comparison.service.ts',
  'src/app/api/operations/odds-shadow-comparison/route.ts',
  'docs/ARCHITECTURE/THE_ODDS_API_SHADOW_PROVIDER_V1.md',
  'docs/PRODUCTION_PILOT/ODDS_02_THE_ODDS_API_SHADOW_INTEGRATION.md',
  'docs/CERTIFICATION/odds-02-the-odds-api-shadow-integration.json',
]

const allowedDirty = [
  ...requiredFiles,
  'src/app/api/operations/odds-shadow-comparison',
  'scripts/odds02-the-odds-api-shadow-integration-validate.mjs',
  'docs/ARCHITECTURE/README.md',
  'docs/PRODUCTION_PILOT/README.md',
  'docs/CERTIFICATION/README.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_STATUS.json',
  'docs/MASTER_ROADMAP.md',
  'docs/PROJECT_STATUS.md',
]

const checks = []

function check(name, pass, details = '') {
  checks.push({ name, pass: Boolean(pass), details })
}

function read(path) {
  return readFileSync(path, 'utf8')
}

for (const file of requiredFiles) {
  check(`required file exists: ${file}`, existsSync(file))
}

const service = read('src/services/odds02-shadow-comparison.service.ts')
const route = read('src/app/api/operations/odds-shadow-comparison/route.ts')
const architecture = read('docs/ARCHITECTURE/THE_ODDS_API_SHADOW_PROVIDER_V1.md')
const report = read('docs/PRODUCTION_PILOT/ODDS_02_THE_ODDS_API_SHADOW_INTEGRATION.md')
const cert = JSON.parse(read('docs/CERTIFICATION/odds-02-the-odds-api-shadow-integration.json'))

check('THE_ODDS_API_KEY is the only runtime shadow credential read', service.includes('process.env.THE_ODDS_API_KEY') && !service.includes('process.env.ODDS_API_KEY'))
check('ODDS_API_KEY remains explicitly preserved, not used as fallback', cert.credential.legacyVariableUntouched === true && cert.credential.fallbackToLegacyVariable === false)
check('route dry-run is zero provider call default', route.includes('dryRun: true') && cert.runtime.dryRunProviderCalls === 0)
check('live route requires protected authorization', route.includes('CRON_SECRET') && route.includes('UNAUTHORIZED') && cert.runtime.liveRequiresProtectedSecret === true)
check('live confirmation guard is present', service.includes('ODDS_02_SHADOW') && cert.runtime.liveConfirmation === 'ODDS_02_SHADOW')
check('provider request cap remains 3', service.includes('const MAX_CALLS = 3') && cert.runtime.maximumAuthorizedCertificationRequests === 3)
check('SportsDataIO remains production authority', cert.runtime.productionAuthority === 'sportsdataio' && architecture.includes('SportsDataIO remains the production odds authority'))
check('shadow provider storage is isolated', cert.runtime.storage === 'IN_MEMORY_CERTIFICATION_ARTIFACT_ONLY' && cert.safety.productionOddsTablesWritten === false)
check('market normalization documented', architecture.includes('h2h') && architecture.includes('spreads') && architecture.includes('totals'))
check('exact event matching documented', architecture.includes('within 15 minutes') && cert.exactEventMatches.length === 2)
check('same-team different-time game excluded', report.includes('different game time'))
check('shadow acquisition used one request', cert.shadowAcquisition.providerCallsMade === 1 && cert.runtime.requestsUsedByCertification === 1)
check('shadow acquisition used three credits', cert.shadowAcquisition.creditsUsed === 3)
check('required sportsbooks observed', ['FanDuel', 'DraftKings', 'BetMGM', 'Caesars'].every((book) => cert.shadowAcquisition.bookmakersObserved.includes(book)))
check('core markets observed', cert.shadowAcquisition.marketRows.h2h > 0 && cert.shadowAcquisition.marketRows.spreads > 0 && cert.shadowAcquisition.marketRows.totals > 0)
check('source timestamp and capture timestamp are distinct contract concepts', architecture.includes('sourceTimestamp') && architecture.includes('captureTimestamp'))
check('shadow case study includes exact price and existing model probability', cert.caseStudies.some((item) => item.matchup === 'LAD @ ARI' && item.market === 'moneyline' && item.bestShadowPrice === 183 && item.modelProbability === 70.97))
check('shadow EV/edge uses existing comparison only', report.includes('existing market-alignment functions') && cert.caseStudies.some((item) => item.shadowExpectedValuePercent !== null))
check('stale source evidence remains non-actionable', cert.safety.staleEvidenceActionable === false)
check('no production recommendation or Official Pick impact', cert.safety.officialPicksChanged === false && cert.safety.rentPlayPolicyChanged === false && cert.safety.moneylinePolicyChanged === false && cert.safety.smartParlayPolicyChanged === false)
check('no prediction or confidence formula changed', cert.safety.predictionFormulaChanged === false && cert.safety.confidenceFormulaChanged === false)
check('no settlement or learning changed', cert.safety.settlementChanged === false && cert.safety.learningChanged === false)
check('no provider budget or scheduler cadence changed', cert.safety.providerBudgetChanged === false && cert.safety.schedulerCadenceChanged === false)
check('player props not implemented', cert.safety.playerPropsRuntimeImplemented === false)
check('Historical Replay and MC-03 not started', cert.safety.historicalReplayStarted === false && cert.safety.mc03Started === false)
check('cutover remains blocked pending more evidence', cert.cutoverDecision === 'MORE_SHADOW_EVIDENCE_REQUIRED')

const sensitiveFragments = [`sk_${'live'}_`, `pk_${'live'}_`]
for (const file of requiredFiles.concat('scripts/odds02-the-odds-api-shadow-integration-validate.mjs')) {
  const text = read(file)
  check(`no obvious secret value in ${file}`, !sensitiveFragments.some((fragment) => text.includes(fragment)))
}

const statusLines = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)

const changed = statusLines.map((line) => line.slice(3).trim().replaceAll('\\', '/'))
const unexpected = changed.filter((file) => !allowedDirty.includes(file) && !allowedDirty.some((allowed) => file.startsWith(`${allowed.replace(/\/$/, '')}/`)))
check('only ODDS-02 files changed', unexpected.length === 0, unexpected.join(', '))

const failures = checks.filter((item) => !item.pass)
for (const item of checks) {
  console.log(`${item.pass ? 'PASS' : 'FAIL'} ${item.name}${item.details ? ` - ${item.details}` : ''}`)
}

if (failures.length) {
  console.error(`ODDS-02 validation failed: ${failures.length} failure(s)`)
  process.exit(1)
}

console.log('ODDS-02 validation passed')
