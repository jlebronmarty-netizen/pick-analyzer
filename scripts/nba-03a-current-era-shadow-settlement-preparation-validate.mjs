import fs from 'node:fs'

if (fs.existsSync('.env.local')) {
  for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2]
  }
}

const {
  NBA_CURRENT_ERA_SHADOW_SETTLEMENT_LOCK_KEY,
  NBA_CURRENT_ERA_SHADOW_SETTLEMENT_ORIGIN,
  NBA_CURRENT_ERA_SHADOW_SETTLEMENT_SUPPORTED_MARKETS,
  NBA_CURRENT_ERA_SHADOW_SETTLEMENT_VERSION,
  runNbaCurrentEraShadowSettlementFixtures,
} = await import('../src/services/nba-current-era-shadow-settlement.service.ts')

const service = fs.readFileSync('src/services/nba-current-era-shadow-settlement.service.ts', 'utf8')
const cert = JSON.parse(fs.readFileSync('docs/CERTIFICATION/nba-03a-current-era-shadow-settlement-preparation.json', 'utf8'))
const doc = fs.readFileSync('docs/PRODUCTION_PILOT/NBA_03A_CURRENT_ERA_SHADOW_SETTLEMENT_PREPARATION.md', 'utf8')
const fixtures = runNbaCurrentEraShadowSettlementFixtures()

const checks = []
function check(name, pass) {
  checks.push({ name, pass: Boolean(pass) })
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`)
}

check('certification status ready for activation review', cert.status === 'NBA_03A_CURRENT_ERA_SHADOW_SETTLEMENT_PREPARATION_CERTIFIED_READY_FOR_ACTIVATION_REVIEW')
check('current era origin constant explicit', NBA_CURRENT_ERA_SHADOW_SETTLEMENT_ORIGIN === 'CURRENT_ERA_SHADOW')
check('settlement version explicit', NBA_CURRENT_ERA_SHADOW_SETTLEMENT_VERSION === 'nba_current_era_shadow_settlement_preparation_v1')
check('supported markets are full-game only', JSON.stringify([...NBA_CURRENT_ERA_SHADOW_SETTLEMENT_SUPPORTED_MARKETS].sort()) === JSON.stringify(['moneyline', 'spread', 'total'].sort()))
check('service scopes production read to CURRENT_ERA_SHADOW', service.includes(".eq('prediction_origin', NBA_CURRENT_ERA_SHADOW_SETTLEMENT_ORIGIN)"))
check('historical replay origin is not queried', !service.includes(".eq('prediction_origin', 'HISTORICAL_REPLAY_SHADOW')"))
check('authoritative game_results required', service.includes(".from('game_results')") && service.includes("result.game_id !== event.id"))
check('final event status required', service.includes('isFinalStatus(event.status)') && service.includes('EVENT_NOT_FINAL'))
check('missing final score no-ops', fixtures.cases.missingFinalScore.skipReason === 'MISSING_FINAL_SCORE')
check('future game no-ops', fixtures.cases.futureGame.skipReason === 'EVENT_NOT_STARTED')
check('started non-final no-ops', fixtures.cases.startedNotFinal.skipReason === 'EVENT_NOT_FINAL')
check('moneyline win/loss fixtures', fixtures.cases.moneylineWin.decision?.outcome === 'win' && fixtures.cases.moneylineLoss.decision?.outcome === 'loss')
check('spread win/loss/push fixtures', fixtures.cases.spreadWin.decision?.outcome === 'win' && fixtures.cases.spreadLoss.decision?.outcome === 'loss' && fixtures.cases.spreadPush.decision?.outcome === 'push')
check('total over/under/push fixtures', fixtures.cases.totalOver.decision?.outcome === 'win' && fixtures.cases.totalUnder.decision?.outcome === 'win' && fixtures.cases.totalPush.decision?.outcome === 'push')
check('stored line is used', service.includes('line: prediction.line') && cert.settlement.storedLineImmutable === true)
check('already settled idempotent no-op', fixtures.cases.alreadySettled.skipReason === 'ALREADY_SETTLED' && fixtures.cases.repeatedSettlementRun.skipReason === 'ALREADY_SETTLED')
check('mutation requires activation authorization', service.includes('activationAuthorized') && service.includes('ACTIVATION_NOT_AUTHORIZED'))
check('future mutation keeps origin guard', service.includes(".eq('prediction_origin', NBA_CURRENT_ERA_SHADOW_SETTLEMENT_ORIGIN)") && service.includes(".is('settled_at', null)"))
check('learning calibration isolation documented', cert.settlement.learningActivated === false && cert.settlement.calibrationActivated === false)
check('official/product isolation documented', cert.settlement.officialPickActivated === false && cert.settlement.productVisibilityActivated === false)
check('historical replay and MLB isolation', cert.fixtures.historicalReplayTouched === false && cert.fixtures.mlbWrites === 0)
check('lock key defined for future activation', NBA_CURRENT_ERA_SHADOW_SETTLEMENT_LOCK_KEY === 'nba_current_era_shadow_settlement' && cert.schedulerRecommendation.lockKey === NBA_CURRENT_ERA_SHADOW_SETTLEMENT_LOCK_KEY)
check('current production dry-run rows preserved', cert.productionDryRun.currentEraShadowRows === 43 && cert.productionDryRun.settlementEligible === 0)
check('production certification made zero provider calls', cert.accounting.providerCallsFromCertification === 0)
check('production certification made zero db mutations', cert.accounting.databaseMutationsFromCertification === 0)
check('docs state preparation not activation', doc.includes('Preparation') && doc.includes('without activating production settlement'))

const failed = checks.filter((item) => !item.pass)
if (failed.length) {
  console.error(`\nnba_03a_current_era_shadow_settlement_preparation_validate_v1 FAIL ${checks.length - failed.length}/${checks.length}`)
  process.exit(1)
}

console.log(`\nnba_03a_current_era_shadow_settlement_preparation_validate_v1 PASS ${checks.length}/${checks.length}`)
