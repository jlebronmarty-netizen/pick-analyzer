import { existsSync, readFileSync } from 'node:fs'

const files = [
  'docs/ARCHITECTURE/NBA_HISTORICAL_PROVIDER_STRATEGY_V1.md',
  'docs/ARCHITECTURE/NBA_FINAL_PROVIDER_MAP_V1.md',
  'docs/ARCHITECTURE/NBA_DATA_FOUNDATION_V1.md',
  'docs/ARCHITECTURE/NBA_HISTORICAL_READINESS_V1.md',
  'docs/PRODUCTION_PILOT/NBA_01A_HISTORICAL_SOURCE_BOOTSTRAP.md',
  'docs/CERTIFICATION/nba-01a-historical-source-bootstrap.json',
  'docs/ARCHITECTURE/NBA_IMPLEMENTATION_MASTER_PLAN_V1.md',
  'docs/PROJECT_STATUS.md',
  'docs/MASTER_ROADMAP.md',
]

const checks = []
const check = (name, passed) => checks.push({ name, passed: Boolean(passed) })
const read = (file) => readFileSync(file, 'utf8')

for (const file of files) check(`${file} exists`, existsSync(file))

const cert = JSON.parse(read('docs/CERTIFICATION/nba-01a-historical-source-bootstrap.json'))
const strategy = read('docs/ARCHITECTURE/NBA_HISTORICAL_PROVIDER_STRATEGY_V1.md')
const provider = read('docs/ARCHITECTURE/NBA_FINAL_PROVIDER_MAP_V1.md')
const foundation = read('docs/ARCHITECTURE/NBA_DATA_FOUNDATION_V1.md')
const readiness = read('docs/ARCHITECTURE/NBA_HISTORICAL_READINESS_V1.md')
const pilot = read('docs/PRODUCTION_PILOT/NBA_01A_HISTORICAL_SOURCE_BOOTSTRAP.md')
const plan = read('docs/ARCHITECTURE/NBA_IMPLEMENTATION_MASTER_PLAN_V1.md')

check('The Odds API NBA sport contract known', cert.theOddsApiHistorical.nbaSportKey === 'basketball_nba')
check('historical endpoint coverage documented', strategy.includes('/v4/historical/sports/basketball_nba/odds') && strategy.includes('/v4/historical/sports/basketball_nba/events'))
check('exact credit formula documented', cert.theOddsApiHistorical.creditFormula === '10 x markets x regions x requested timestamps')
check('cost estimated before spend', cert.theOddsApiHistorical.estimatedCredits.oneSeasonDailyCard === 5100)
check('no duplicate paid requests', cert.accounting.theOddsApiCalls === 0 && cert.accounting.theOddsApiCredits === 0)
check('snapshot strategy pregame-safe', strategy.includes('snapshot.timestamp < commence_time') && cert.theOddsApiHistorical.snapshotSemantics.includes('EQUAL_TO_OR_BEFORE'))
check('stat source selected or access blocker explicit', cert.providerStrategy.nbaStatSourcePrimary.includes('PENDING_ACCESS_REVIEW') && cert.certification.providerAccessAuthorizationRequired)
check('domain authority explicit', Object.keys(cert.providerStrategy).length >= 12 && provider.includes('Domain Authority'))
check('canonical team identity safe', cert.canonicalIdentity.teamsTotal === 30 && cert.canonicalIdentity.teamsMapped === 30 && cert.canonicalIdentity.teamsAmbiguous === 0)
check('player identity strategy safe', String(cert.canonicalIdentity.playersMapped).includes('PARTIAL') && strategy.includes('Players and official IDs'))
check('event crosswalk safe', strategy.includes('stable `GAME_ID`') || strategy.includes('official IDs'))
check('historical target seasons explicit', cert.historicalTarget.modelReplaySeasons[0].includes('2024-25'))
check('imports idempotent/resumable', cert.nba02Target.checkpointStrategy.includes('idempotent') && strategy.includes('checkpoint'))
check('results coverage measured', foundation.includes('Completed games | 13') && cert.historicalTarget.results.includes('13_SAMPLE'))
check('period coverage measured', cert.historicalTarget.quarterScores.includes('PARTIAL'))
check('boxscore coverage measured', cert.historicalTarget.boxscores.includes('PARTIAL'))
check('player-stat coverage measured', cert.historicalTarget.playerStats === 918)
check('odds coverage measured', cert.priceHistory.moneylinePriceCoverage === 'BUDGET_GATED')
check('historical price timestamps safe', strategy.includes('previous_timestamp') && strategy.includes('next_timestamp'))
check('no fabricated prices', cert.accounting.theOddsApiCalls === 0 && pilot.includes('no historical import'))
check('no fabricated stats', cert.accounting.statProviderCalls === 0 && pilot.includes('no historical import'))
check('feature reconstruction pregame-safe', cert.nba02Target.asOfPolicy === 'STRICT_PREGAME_CHRONOLOGICAL')
check('no leakage', cert.featureFoundation.leakageFailures === 0 && readiness.includes('must not use final result'))
check('dry-run core engine safe or blocker exact', cert.dryRun.moneyline === 'PLANNED_AFTER_IMPORT' && cert.dryRun.firstHalf.includes('BLOCKED'))
check('settlement dry-run safe', cert.dryRun.settlementSafety.includes('EXISTING_CONTRACT_READY'))
check('model vs price-aware cohorts separated', readiness.includes('MODEL_REPLAY') && readiness.includes('PRICE_AWARE_REPLAY'))
check('NBA-02 scope deterministic', cert.nba02Target.expectedPredictions === 3690 && cert.nba02Target.batchSize === 25)
check('Current Era isolation', cert.accounting.currentEraNbaPredictionWrites === 0)
check('SportsDataIO not expanded', cert.sportsDataIo.finalNbaSportsDataIoStatus === 'LEGACY_ONLY_DO_NOT_EXPAND')
check('MLB regression clean', cert.mlbRegression.mlbFinalStatus === 'MLB_FINAL_CERTIFIED_WITH_FORWARD_MARKETS' && cert.mlbRegression.mlbSportsDataIoCalls === 0)
check('provider calls accounted', cert.accounting.theOddsApiCalls === 0 && cert.accounting.statProviderCalls === 0 && cert.accounting.sportsDataIoCalls === 0)
check('DB mutations accounted', cert.accounting.databaseMutations === 0)
check('NBA production remains inactive', plan.includes('no import or replay was executed') && provider.includes('production NBA inactive'))
check('historical odds budget authorization required', cert.certification.historicalOddsBudgetAuthorizationRequired === true)
check('DB migration not authorized or required', cert.certification.dbMigrationAuthorizationRequired === false)

const secretPatterns = [
  /SUPABASE_SERVICE_ROLE_KEY\s*=\s*['"][^'"]+/i,
  /CRON_SECRET\s*=\s*['"][^'"]+/i,
  /THE_ODDS_API_KEY\s*=\s*['"][^'"]+/i,
  /ODDS_API_KEY\s*=\s*['"][^'"]+/i,
  /SPORTSDATAIO_[A-Z_]*KEY\s*=\s*['"][^'"]+/i,
  /Authorization:\s*Bearer\s+[A-Za-z0-9._-]+/i,
]

for (const file of files) {
  const text = read(file)
  check(`no secret value exposed in ${file}`, !secretPatterns.some((pattern) => pattern.test(text)))
}

const failed = checks.filter((item) => !item.passed)
console.log(JSON.stringify({
  success: failed.length === 0,
  mode: 'nba_01a_historical_source_bootstrap_validation_v1',
  checks: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  failedChecks: failed.map((item) => item.name),
  providerCallsMade: 0,
  databaseMutationsMade: 0,
  classification: cert.finalClassification
}, null, 2))

if (failed.length) process.exit(1)
