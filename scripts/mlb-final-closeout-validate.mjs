import { readFileSync, existsSync } from 'node:fs'

const requiredFiles = [
  'docs/ARCHITECTURE/MLB_FINAL_PROVIDER_MAP_V1.md',
  'docs/ARCHITECTURE/MLB_MARKET_MATRIX_V1.md',
  'docs/ARCHITECTURE/MLB_PLAYER_PROPS_V1.md',
  'docs/ARCHITECTURE/SPORT_ONBOARDING_TEMPLATE_V1.md',
  'docs/PRODUCTION_PILOT/MLB_FINAL_CLOSEOUT.md',
  'docs/CERTIFICATION/mlb-final-closeout.json',
]

const checks = []
function check(name, passed) {
  checks.push({ name, passed: Boolean(passed) })
}

for (const file of requiredFiles) check(`${file} exists`, existsSync(file))

const cert = JSON.parse(readFileSync('docs/CERTIFICATION/mlb-final-closeout.json', 'utf8'))
const closeout = readFileSync('docs/PRODUCTION_PILOT/MLB_FINAL_CLOSEOUT.md', 'utf8')
const provider = readFileSync('docs/ARCHITECTURE/MLB_FINAL_PROVIDER_MAP_V1.md', 'utf8')
const market = readFileSync('docs/ARCHITECTURE/MLB_MARKET_MATRIX_V1.md', 'utf8')
const props = readFileSync('docs/ARCHITECTURE/MLB_PLAYER_PROPS_V1.md', 'utf8')
const template = readFileSync('docs/ARCHITECTURE/SPORT_ONBOARDING_TEMPLATE_V1.md', 'utf8')

check('final classification is pass with future markets', cert.finalClassification === 'MLB_FINAL_CLOSEOUT_PASS_WITH_FUTURE_MARKETS')
check('The Odds API is product authority', cert.providerAuthority.productOddsAuthority === 'THE_ODDS_API')
check('MLB official primary is recorded', cert.providerAuthority.mlbDataSourceMode === 'MLB_OFFICIAL_PRIMARY')
check('SportsDataIO retained but not cancelled', cert.providerAuthority.sportsDataIoStatus.includes('ROLLBACK') && cert.safety.sportsDataIoCancelled === false)
check('zero certification provider calls', cert.safety.providerCallsFromCertificationReads === 0 && cert.safety.manualProviderCallsMade === 0)
check('zero certification mutations', cert.safety.databaseMutationsFromCertificationReads === 0)
check('no production DB migration', cert.safety.productionDbMigrationMade === false)
check('core markets only production supported', cert.marketMatrix.productionSupported.join(',') === 'moneyline,run_line,game_total')
check('no new markets activated', cert.marketMatrix.newMarketsActivated === 0)
check('unsupported markets not actionable', cert.marketMatrix.unsupportedMarketsActionable === false)
check('historical replay denominator preserved', cert.historicalReplay.predictions === 7290 && cert.historicalReplay.settled === 7290)
check('calibration shadow only', cert.calibration.shadowOnly === true && cert.calibration.promotionAuthorized === false)
check('player props blocked by odds', cert.playerProps.productionReadyProps === 0 && cert.playerProps.currentPropOddsRows === 0)
check('Official Pick policy unchanged', cert.safety.officialPickPolicyChanged === false)
check('prediction formula unchanged', cert.safety.predictionFormulaChanged === false)
check('settlement unchanged', cert.safety.settlementChanged === false)
check('learning unchanged', cert.safety.learningChanged === false)
check('MC-03 not started', cert.safety.mc03Started === false)
check('provider map documents rollback-only SportsDataIO', provider.includes('ROLLBACK_ONLY') && provider.includes('Routine MLB SportsDataIO calls must remain `0`'))
check('market matrix distinguishes Total Under replay gap', market.includes('Total Under') && market.includes('Over-only'))
check('player props document no current prop odds', props.includes('Current prop odds rows | 0'))
check('sport onboarding does not start new sport', template.includes('No new sport is started'))
check('closeout records operationsProductionReady nuance', closeout.includes('operationsProductionReady=false'))

const failed = checks.filter((item) => !item.passed)
console.log(JSON.stringify({
  mode: 'mlb_final_closeout_validation_v1',
  checks: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  failedChecks: failed.map((item) => item.name),
  providerCallsMade: 0,
  databaseMutationsMade: 0,
}, null, 2))

if (failed.length) process.exit(1)
