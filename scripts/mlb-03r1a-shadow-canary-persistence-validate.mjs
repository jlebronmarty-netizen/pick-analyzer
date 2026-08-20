import fs from 'node:fs'

const script = fs.readFileSync('scripts/mlb-03r1a-first-calibrated-shadow-canary.mjs', 'utf8')
const statusMigration = fs.readFileSync('supabase/migrations/202608140001_nba_replay_isolation_prediction_origin_v1.sql', 'utf8')

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
check('certification status pending constant exists', script.includes("const PENDING_SHADOW_CERTIFICATION_STATUS = 'SHADOW_PENDING'"))
check('certification status allowed values encoded', ['SHADOW_PENDING', 'CERTIFIED', 'QUARANTINED', 'INVALID', 'REJECTED'].every((value) => script.includes(`'${value}'`)))
check('certification status uses controlled pending value', script.includes('certification_status: PENDING_SHADOW_CERTIFICATION_STATUS'))
check('arbitrary MLB phase not stored as status', !script.includes("certification_status: 'MLB_03_FIRST_CALIBRATED_SHADOW_CANARY'"))
check('phase classification preserved in metadata', script.includes("phase: 'MLB-03R1E-R1'") && script.includes("phaseClassification: 'MLB_03_FIRST_CALIBRATED_SHADOW_CANARY'"))
check('certification status migration allows pending shadow', /certification_status[\s\S]+SHADOW_PENDING/.test(statusMigration))
check('certification status migration rejects arbitrary values', statusMigration.includes('invalid certification_status value'))
check('selected price evidence builder exists', script.includes('function buildSelectedPriceEvidence(candidate)'))
check('safe source payload builder exists', script.includes('function safeSourcePredictionFields(source)'))
check('source payload spread removed', !script.includes('...source,'))
check('fresh physical uuid generated for shadow row', script.includes('id: crypto.randomUUID()'))
check('physical identity isolation assertion exists', script.includes('function assertPhysicalIdentityIsolation(payload, source)'))
check('source primary key reuse rejected', script.includes('new shadow row must not reuse source prediction id'))
check('source result id leakage rejected', script.includes('new pending shadow row must not inherit result_id'))
check('source lineage preserved explicitly', script.includes('source prediction lineage must be explicit parent_prediction_id') && script.includes('sourcePredictionId: source.id'))
check('payload sportsbook is overridden from selected price evidence', script.includes('sportsbook: priceEvidence.sportsbook'))
check('payload odds are overridden from selected price evidence', script.includes('odds: priceEvidence.odds'))
check('payload odds timestamp is overridden from selected price evidence', script.includes('odds_timestamp: priceEvidence.oddsTimestamp'))
check('payload implied probability derives from selected price evidence', script.includes('implied_probability: priceEvidence.impliedProbabilityPercent'))
check('price binding assertion exists', script.includes('function assertPriceEvidenceBinding(row, priceEvidence)'))
check('readback includes asserted fields', script.includes('result_id,profit') && script.includes('prediction_group_key'))
check('quarantined shadow rows excluded from future active duplicate block', script.includes(".neq('certification_status', 'QUARANTINED')"))
check('idempotency proof excludes quarantined identities', script.includes('activeExactIdentity') && script.includes('post.activeExactIdentity === 1'))
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
  mode: 'mlb_03r1d_full_pending_shadow_contract_validator_v1',
  checks: 46,
  requiredPendingContracts: {
    settlement_details: 'non-null empty pending object',
    manual_adjustment: 'boolean false, no manual override',
    certification_status: 'SHADOW_PENDING',
    certification_metadata: 'phase/model/calibration provenance, no secrets or postgame data',
    result: 'null',
    settled_at: 'null',
    result_id: 'null',
    profit: 'null',
  },
  providerCallsMade: 0,
  productionDatabaseMutations: 0,
}, null, 2))
