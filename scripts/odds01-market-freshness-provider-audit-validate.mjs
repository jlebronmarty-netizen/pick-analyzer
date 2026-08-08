import { existsSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const requiredFiles = [
  'docs/ARCHITECTURE/ODDS_PROVIDER_ARCHITECTURE_V1.md',
  'docs/PRODUCTION_PILOT/ODDS_01_MARKET_FRESHNESS_PROVIDER_AUDIT.md',
  'docs/CERTIFICATION/odds-01-market-freshness-provider-audit.json',
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

const architecture = read('docs/ARCHITECTURE/ODDS_PROVIDER_ARCHITECTURE_V1.md')
const audit = read('docs/PRODUCTION_PILOT/ODDS_01_MARKET_FRESHNESS_PROVIDER_AUDIT.md')
const cert = JSON.parse(read('docs/CERTIFICATION/odds-01-market-freshness-provider-audit.json'))

check('current SportsDataIO endpoint identified', architecture.includes('/api/mlb/odds/json/GameOddsByDate/{date}') && cert.currentEndpoint === '/api/mlb/odds/json/GameOddsByDate/{date}')
check('timestamp semantics documented', architecture.includes('provider_market_timestamp_not_page_generated_time') && architecture.includes('Snapshot capture timestamp'))
check('bookmaker handling traced', architecture.includes('provider_sportsbook_id') && audit.includes('Consensus'))
check('normalization path traced', architecture.includes('normalizeSportsDataIoMlbGameOdds') && cert.findings.normalizationFinding === 'NO_NORMALIZATION_LOSS')
check('source lag measured', cert.productionEvidence.sourceLagMinutes === 240 && cert.productionEvidence.maximumSourceLagMinutes === 240)
check('polling economics calculated', architecture.includes('10-game slate') && cert.adaptivePollingEconomics.tenGameSlateRequestsPerDay.includes('37-43'))
check('provider architectures compared', architecture.includes('Option A') && architecture.includes('Option B') && architecture.includes('Option C'))
check('player props capability evaluated', architecture.includes('Player Props') || audit.includes('props'))
check('no provider migration performed', cert.guardrailsUnchanged.providerMigrationPerformed === false)
check('no scheduler cadence changed', cert.guardrailsUnchanged.schedulerCadenceChanged === false)
check('no provider budget changed', cert.guardrailsUnchanged.providerBudgetChanged === false)
check('no prediction logic changed', cert.guardrailsUnchanged.predictionLogicChanged === false)
check('no recommendation gates changed', cert.guardrailsUnchanged.recommendationGatesChanged === false)
check('stale actionability remains blocked', cert.findings.staleEvidenceActionable === false && cert.productionEvidence.allVisibleStaleCandidatesBlocked === true)
check('certification reads use zero provider calls', cert.productionEvidence.providerCallsFromCertificationReads === 0)
check('certification reads use zero mutations', cert.productionEvidence.databaseMutationsFromCertificationReads === 0)
check('recommended provider architecture recorded', cert.recommendedProviderArchitecture === 'OPTION_B_SPORTSDATAIO_STATS_RESULTS_PLUS_SPECIALIZED_ODDS_PROVIDER')

const allowedPrefixes = [
  'docs/ARCHITECTURE/ODDS_PROVIDER_ARCHITECTURE_V1.md',
  'docs/PRODUCTION_PILOT/ODDS_01_MARKET_FRESHNESS_PROVIDER_AUDIT.md',
  'docs/CERTIFICATION/odds-01-market-freshness-provider-audit.json',
  'scripts/odds01-market-freshness-provider-audit-validate.mjs',
]

const statusLines = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)

const changed = statusLines.map((line) => line.slice(3).trim().replaceAll('\\', '/'))
const unexpected = changed.filter((file) => !allowedPrefixes.includes(file))
check('only ODDS-01 audit files changed', unexpected.length === 0, unexpected.join(', '))

const failures = checks.filter((item) => !item.pass)
for (const item of checks) {
  console.log(`${item.pass ? 'PASS' : 'FAIL'} ${item.name}${item.details ? ` - ${item.details}` : ''}`)
}

if (failures.length) {
  console.error(`ODDS-01 validation failed: ${failures.length} failure(s)`)
  process.exit(1)
}

console.log('ODDS-01 validation passed')
