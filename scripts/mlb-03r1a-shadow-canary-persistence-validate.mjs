import fs from 'node:fs'

const script = fs.readFileSync('scripts/mlb-03r1a-first-calibrated-shadow-canary.mjs', 'utf8')

function check(name, pass) {
  if (!pass) throw new Error(`${name} failed`)
}

check('pending settlement builder exists', script.includes('buildMlb03r1aPendingSettlementDetails'))
check('settlement details never null in payload', script.includes('const settlementDetails = buildMlb03r1aPendingSettlementDetails()') && script.includes('settlement_details: settlementDetails'))
check('null settlement details rejected', script.includes('settlement_details must be a non-null pending metadata object'))
check('postgame leakage rejected', script.includes('final_score') && script.includes('settled_at') && script.includes('winner'))
check('pending manual adjustment builder exists', script.includes('buildMlb03r1bPendingManualAdjustment'))
check('manual adjustment never null in payload', script.includes('const manualAdjustment = buildMlb03r1bPendingManualAdjustment()') && script.includes('manual_adjustment: manualAdjustment'))
check('manual adjustment false contract enforced', script.includes('manual_adjustment must be explicit false for autonomous pending shadow rows'))
check('manual adjustment null removed', !script.includes('manual_adjustment: null'))
check('pending result remains null', script.includes('result: null') && script.includes('pending shadow row must not contain a result label'))
check('pending settled_at remains null', script.includes('settled_at: null') && script.includes('pending shadow row must not contain settled_at'))
check('pending result_id remains null', script.includes('result_id: null') && script.includes('pending shadow row must not contain result_id'))
check('pending profit remains null', script.includes('profit: null') && script.includes('pending shadow row must not contain profit'))
check('origin is current era shadow', script.includes("prediction_origin: ORIGIN") && script.includes("const ORIGIN = 'CURRENT_ERA_SHADOW'"))
check('role is shadow', script.includes("model_role: 'shadow'"))
check('non-current row', script.includes('is_current: false'))
check('recommended pick blocked', script.includes('recommended_pick: false'))
check('production eligibility blocked', script.includes('production_eligible: false'))
check('pending status', script.includes("status: 'pending'"))
check('valid status', script.includes("validation_status: 'valid'"))
check('deterministic identity includes origin model calibration snapshot', script.includes('artifact.shadowModelVersion') && script.includes('artifact.artifactVersion') && script.includes('SNAPSHOT_TYPE'))
check('freshness gate present', script.includes('MAX_ODDS_AGE_MINUTES') && script.includes('candidate.oddsAgeMinutes <= MAX_ODDS_AGE_MINUTES'))
check('single execute mode only inserts one payload', (script.match(/\.insert\(payload\)/g) ?? []).length === 1)
check('provider accounting zero', script.includes('theOddsApi: 0') && script.includes('sportsDataIO: 0') && script.includes('historical: 0'))

console.log(JSON.stringify({
  success: true,
  mode: 'mlb_03r1b_full_pending_shadow_contract_validator_v1',
  checks: 23,
  requiredPendingContracts: {
    settlement_details: 'non-null empty pending object',
    manual_adjustment: 'boolean false, no manual override',
    result: 'null',
    settled_at: 'null',
    result_id: 'null',
    profit: 'null',
  },
  providerCallsMade: 0,
  productionDatabaseMutations: 0,
}, null, 2))
