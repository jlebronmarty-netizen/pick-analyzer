import fs from 'node:fs'

import {
  fingerprintMlbShadowImmutableEvidence,
  MLB_SHADOW_IMMUTABLE_FINGERPRINT_VERSION,
} from './lib/mlb-shadow-immutable-fingerprint.mjs'

if (fs.existsSync('.env.local')) {
  for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue
    const index = line.indexOf('=')
    if (index < 1) continue
    const key = line.slice(0, index).trim()
    let value = line.slice(index + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (key && !process.env[key]) process.env[key] = value
  }
}

const {
  MLB_CURRENT_ERA_SHADOW_SETTLEMENT_AUTH_ENV,
  MLB_CURRENT_ERA_SHADOW_SETTLEMENT_LOCK_KEY,
  MLB_CURRENT_ERA_SHADOW_SETTLEMENT_ORIGIN,
  MLB_CURRENT_ERA_SHADOW_SETTLEMENT_SPORT_KEY,
  MLB_CURRENT_ERA_SHADOW_SETTLEMENT_SUPPORTED_MARKETS,
  MLB_CURRENT_ERA_SHADOW_SETTLEMENT_VERSION,
  runMlbCurrentEraShadowSettlementFixtures,
} = await import('../src/services/mlb-current-era-shadow-settlement.service.ts')

const service = fs.readFileSync('src/services/mlb-current-era-shadow-settlement.service.ts', 'utf8')
const cert = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-03r5-shadow-settlement-runtime.json', 'utf8'))
const doc = fs.readFileSync('docs/PRODUCTION_PILOT/MLB_03R5_SHADOW_SETTLEMENT_RUNTIME.md', 'utf8')
const fixtures = runMlbCurrentEraShadowSettlementFixtures()

const checks = []
function check(name, pass) {
  checks.push({ name, pass: Boolean(pass) })
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`)
}

const baseFingerprintPayload = {
  sport_key: 'baseball_mlb',
  game_id: 'baseball_mlb:mlb:sportsdataio:event:79208',
  market: 'run_line',
  selection: 'WSH',
  line: 1.5,
  sportsbook: 'fanduel',
  odds: -144,
  odds_timestamp: '2026-08-20T23:37:31.436Z',
  implied_probability: 0.5901639344262295,
  raw_model_probability: 0.4538,
  calibrated_probability: 0.605,
  model_version: 'MLB_CALIBRATED_SHADOW_V1',
  calibration_version: 'mlb_market_empirical_calibration_v1_2026_08_20',
  candidate_key:
    'baseball_mlb|baseball_mlb:mlb:sportsdataio:event:79208|run_line|wsh|1.5|fanduel|CURRENT_ERA_SHADOW|MLB_CALIBRATED_SHADOW_V1|mlb_market_empirical_calibration_v1_2026_08_20|MORNING',
  idempotency_key:
    'baseball_mlb|baseball_mlb:mlb:sportsdataio:event:79208|run_line|wsh|1.5|fanduel|CURRENT_ERA_SHADOW|MLB_CALIBRATED_SHADOW_V1|mlb_market_empirical_calibration_v1_2026_08_20|MORNING',
  source_prediction_id: 'f780e786-31a3-5caf-b007-35bb557a3795',
  snapshot_type: 'MORNING',
}
const beforeSettlementFingerprint = fingerprintMlbShadowImmutableEvidence(baseFingerprintPayload)
const afterSettlementFingerprint = fingerprintMlbShadowImmutableEvidence({
  ...baseFingerprintPayload,
  status: 'settled',
  result: 'win',
  result_id: 'result-1',
  settled_at: '2026-08-21T03:30:00.000Z',
  settlement_details: { resultId: 'result-1', outcome: 'win' },
  profit: 69.44,
})

check('certification status ready for publication', cert.status === 'MLB_03_SHADOW_SETTLEMENT_RUNTIME_CERTIFIED_READY_FOR_PUBLICATION')
check('origin scoped to current era shadow', MLB_CURRENT_ERA_SHADOW_SETTLEMENT_ORIGIN === 'CURRENT_ERA_SHADOW')
check('sport scoped to baseball_mlb', MLB_CURRENT_ERA_SHADOW_SETTLEMENT_SPORT_KEY === 'baseball_mlb')
check('settlement version explicit', MLB_CURRENT_ERA_SHADOW_SETTLEMENT_VERSION === 'mlb_current_era_shadow_settlement_preparation_v1')
check('supported markets include moneyline run_line total', JSON.stringify([...MLB_CURRENT_ERA_SHADOW_SETTLEMENT_SUPPORTED_MARKETS].sort()) === JSON.stringify(['moneyline', 'run_line', 'total'].sort()))
check('service excludes quarantined rows in production query', service.includes(".neq('certification_status', 'QUARANTINED')"))
check('service scopes query by sport origin model role', service.includes(".eq('sport_key', MLB_CURRENT_ERA_SHADOW_SETTLEMENT_SPORT_KEY)") && service.includes(".eq('prediction_origin', MLB_CURRENT_ERA_SHADOW_SETTLEMENT_ORIGIN)") && service.includes(".eq('model_role', 'shadow')"))
check('authoritative game_results required', service.includes(".from('game_results')") && service.includes("result.game_id !== event.id"))
check('event final status required', service.includes('isFinalStatus(event.status)') && service.includes('NOT_READY_EVENT_LIVE'))
check('moneyline win/loss fixtures', fixtures.cases.moneylineWin.decision?.outcome === 'win' && fixtures.cases.moneylineLoss.decision?.outcome === 'loss')
check('run line win/loss/push fixtures', fixtures.cases.runLineWin.decision?.outcome === 'win' && fixtures.cases.runLineLoss.decision?.outcome === 'loss' && fixtures.cases.runLinePush.decision?.outcome === 'push')
check('total over/under/push fixtures', fixtures.cases.totalOver.decision?.outcome === 'win' && fixtures.cases.totalUnder.decision?.outcome === 'win' && fixtures.cases.totalPush.decision?.outcome === 'push')
check('cancelled postponed blocked', fixtures.cases.cancelled.skipReason === 'BLOCKED_CANCELLED')
check('missing result blocked', fixtures.cases.missingResult.skipReason === 'BLOCKED_RESULT_MISSING')
check('already settled idempotent no-op', fixtures.cases.alreadySettledSameResult.skipReason === 'ALREADY_SETTLED')
check('conflicting prior settlement blocks', fixtures.cases.conflictingPriorSettlement.skipReason === 'CONFLICTING_PRIOR_SETTLEMENT')
check('quarantined excluded', fixtures.cases.quarantinedExclusion.skipReason === 'QUARANTINED_EXCLUDED')
check('mutation requires env authorization', service.includes('MLB_CURRENT_ERA_SHADOW_SETTLEMENT_AUTH_ENV') && MLB_CURRENT_ERA_SHADOW_SETTLEMENT_AUTH_ENV === 'MLB_CURRENT_ERA_SHADOW_SETTLEMENT_AUTHORIZED')
check('future mutation keeps strict row guards', service.includes(".eq('prediction_origin', MLB_CURRENT_ERA_SHADOW_SETTLEMENT_ORIGIN)") && service.includes(".is('settled_at', null)"))
check('lock key defined', MLB_CURRENT_ERA_SHADOW_SETTLEMENT_LOCK_KEY === 'mlb_current_era_shadow_settlement')
check('product isolation encoded', service.includes('productionVisible: false') && service.includes('officialPickEligible: false'))
check('learning calibration isolation encoded', service.includes('productionLearningEligible: false') && service.includes('productionCalibrationEligible: false'))
check('bankroll notification isolation encoded', service.includes('bankrollEligible: false') && service.includes('notificationEligible: false'))
check('performance scope remains shadow-only', service.includes("performanceScope: 'shadow_cohort_only'"))
check('fingerprint version unchanged', MLB_SHADOW_IMMUTABLE_FINGERPRINT_VERSION === 'mlb_current_era_shadow_canary_immutable_fingerprint_v1')
check('settlement fields do not affect immutable fingerprint', beforeSettlementFingerprint === afterSettlementFingerprint)
check('docs state no execution in this phase', doc.includes('No production settlement execution') && doc.includes('No fourth canary'))
check('cert records zero provider calls', cert.accounting.providerCalls === 0)
check('cert records zero production mutations', cert.accounting.productionDatabaseMutations === 0)

const failed = checks.filter((item) => !item.pass)
if (failed.length) {
  console.error(`\nmlb_03r5_shadow_settlement_runtime_validate FAIL ${checks.length - failed.length}/${checks.length}`)
  console.error(failed.map((item) => item.name).join('\n'))
  process.exit(1)
}

console.log(`\nmlb_03r5_shadow_settlement_runtime_validate PASS ${checks.length}/${checks.length}`)
console.log(JSON.stringify({
  success: true,
  mode: 'mlb_03r5_shadow_settlement_runtime_validate',
  fingerprintVersion: MLB_SHADOW_IMMUTABLE_FINGERPRINT_VERSION,
  thirdCanaryFixtureFingerprint: beforeSettlementFingerprint,
  checks: checks.length,
  providerCallsMade: 0,
  productionDatabaseMutations: 0,
}, null, 2))
