import { existsSync, readFileSync } from 'node:fs'

const requiredFiles = [
  'docs/ARCHITECTURE/MLB_FINAL_V1.md',
  'docs/ARCHITECTURE/MLB_FINAL_PROVIDER_MAP_V1.md',
  'docs/ARCHITECTURE/MLB_MARKET_MATRIX_V1.md',
  'docs/ARCHITECTURE/MLB_PLAYER_PROPS_V1.md',
  'docs/ARCHITECTURE/SPORT_ONBOARDING_TEMPLATE_V1.md',
  'docs/ARCHITECTURE/MULTI_SPORT_HANDOFF_V1.md',
  'docs/PRODUCTION_PILOT/MLB_FINAL_CERTIFICATION.md',
  'docs/CERTIFICATION/mlb-final-01-complete-historical-market-expansion.json',
]

const checks = []
const check = (name, passed) => checks.push({ name, passed: Boolean(passed) })
const read = (file) => readFileSync(file, 'utf8')

for (const file of requiredFiles) check(`${file} exists`, existsSync(file))

const cert = JSON.parse(read('docs/CERTIFICATION/mlb-final-01-complete-historical-market-expansion.json'))
const finalDoc = read('docs/ARCHITECTURE/MLB_FINAL_V1.md')
const pilotDoc = read('docs/PRODUCTION_PILOT/MLB_FINAL_CERTIFICATION.md')
const providerDoc = read('docs/ARCHITECTURE/MLB_FINAL_PROVIDER_MAP_V1.md')
const marketDoc = read('docs/ARCHITECTURE/MLB_MARKET_MATRIX_V1.md')
const propsDoc = read('docs/ARCHITECTURE/MLB_PLAYER_PROPS_V1.md')
const templateDoc = read('docs/ARCHITECTURE/SPORT_ONBOARDING_TEMPLATE_V1.md')
const handoffDoc = read('docs/ARCHITECTURE/MULTI_SPORT_HANDOFF_V1.md')

check('classification is MLB final with forward markets', cert.finalClassification === 'MLB_FINAL_CERTIFIED_WITH_FORWARD_MARKETS')
check('starting and production commits match', cert.startingCommit === '71380918b2b9e5db7e538be2b2077e7f4a5df540' && cert.productionCommitObserved === cert.startingCommit)
check('current era authority remains The Odds API primary', cert.currentEra.productOddsAuthority === 'THE_ODDS_API' && cert.currentEra.oddsPrimaryAuthorityStage === 'STAGE_3_THE_ODDS_API_PRIMARY_PRODUCT')
check('MLB official remains primary non-odds source', cert.currentEra.mlbDataSourceMode === 'MLB_OFFICIAL_PRIMARY')
check('SportsDataIO routine MLB calls expected zero', cert.currentEra.sportsDataIoRoutineMlbCallsExpected === 0 && cert.currentEra.sportsDataIoMode === 'ROLLBACK_ONLY')
check('operations health is healthy', cert.currentEra.operationsHealth === 'HEALTHY')
check('historical replay denominator preserved', cert.historicalDataset.replayRowsBefore === 7290 && cert.historicalDataset.replayRowsAfter === 7290)
check('no new replay rows fabricated', cert.historicalDataset.replayRowsAdded === 0)
check('historical replay settled complete', cert.historicalDataset.settledReplayRows === 7290 && cert.historicalDataset.pendingReplayRows === 0)
check('leakage and duplicates zero', cert.historicalDataset.leakageFailures === 0 && cert.historicalDataset.duplicateReplayRows === 0)
check('replay is model replay not price-aware replay', cert.historicalReplay.type === 'MODEL_REPLAY' && cert.historicalReplay.priceAwareReplay === false)
check('certification made zero provider calls', cert.safety.providerCallsFromCertificationReads === 0 && cert.historicalReplay.providerCalls === 0)
check('certification made zero database mutations', cert.safety.databaseMutationsFromCertificationReads === 0)
check('production scopes untouched', cert.historicalReplay.currentEraWrites === 0 && cert.historicalReplay.currentBoardWrites === 0 && cert.historicalReplay.productionLearningWrites === 0)
check('moneyline home replay certified', cert.marketReplayCoverage.moneylineHome.modelReplay === 'CERTIFIED' && cert.marketReplayCoverage.moneylineHome.rows === 2430)
check('moneyline opposite blocked not fabricated', cert.marketReplayCoverage.moneylineOpposite.modelReplay === 'BLOCKED' && cert.marketReplayCoverage.moneylineOpposite.rowsAdded === 0)
check('run line plus side blocked', cert.marketReplayCoverage.runLinePlusOnePointFiveOrAwaySpread.modelReplay === 'BLOCKED')
check('total under blocked by over-only replay', cert.marketReplayCoverage.totalUnder.modelReplay === 'BLOCKED')
check('future market families not activated', cert.forwardDataFoundation.newMarketFamiliesActivated === 0 && cert.forwardDataFoundation.unsupportedMarketsActionable === false)
check('player props remain foundation only', cert.marketReplayCoverage.playerProps.productionReadyProps === 0 && cert.marketReplayCoverage.playerProps.currentPropOddsRows === 0)
check('calibration remains shadow only', cert.calibration.shadowOnly === true && cert.calibration.promotionAuthorized === false)
check('no policy or model changes', cert.safety.predictionFormulaChanged === false && cert.safety.officialPickPolicyChanged === false && cert.safety.modelWeightsChanged === false)
check('settlement and learning unchanged', cert.safety.settlementChanged === false && cert.safety.learningChanged === false)
check('SportsDataIO not cancelled or reactivated', cert.safety.sportsDataIoCancelled === false && cert.safety.sportsDataIoReactivated === false)
check('new sport not started', cert.safety.newSportStarted === false && cert.safety.nbaStarted === false && cert.safety.mc03Started === false)
check('MLB final doc distinguishes model and price-aware replay', finalDoc.includes('MODEL_REPLAY') && finalDoc.includes('PRICE_AWARE_REPLAY'))
check('pilot certification records no new market activation', pilotDoc.includes('No new historical market was added'))
check('provider map updated to current commit', providerDoc.includes('71380918b2b9e5db7e538be2b2077e7f4a5df540'))
check('market matrix names opposite side and total under blockers', marketDoc.includes('Moneyline opposite side') && marketDoc.includes('Total Under'))
check('props doc remains provider odds blocked', propsDoc.includes('PROVIDER_ODDS_BLOCKED') && propsDoc.includes('Current prop odds rows | 0'))
check('sport onboarding includes model-vs-price-aware lesson', templateDoc.includes('model replay') && templateDoc.includes('price-aware replay'))
check('handoff doc keeps NBA preparation only', handoffDoc.includes('NBA') && handoffDoc.includes('No new sport is started'))

const secretPatterns = [
  /SUPABASE_SERVICE_ROLE_KEY\s*=\s*[^\s`'"]+/i,
  /CRON_SECRET\s*=\s*[^\s`'"]+/i,
  /THE_ODDS_API_KEY\s*=\s*[^\s`'"]+/i,
  /SPORTSDATAIO_MLB_API_KEY\s*=\s*[^\s`'"]+/i,
]

for (const file of requiredFiles) {
  const text = read(file)
  check(`no secret value exposed in ${file}`, !secretPatterns.some((pattern) => pattern.test(text)))
}

const failed = checks.filter((item) => !item.passed)
console.log(JSON.stringify({
  mode: 'mlb_final_01_complete_historical_market_expansion_validation_v1',
  checks: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  failedChecks: failed.map((item) => item.name),
  providerCallsMade: 0,
  databaseMutationsMade: 0
}, null, 2))

if (failed.length) process.exit(1)
