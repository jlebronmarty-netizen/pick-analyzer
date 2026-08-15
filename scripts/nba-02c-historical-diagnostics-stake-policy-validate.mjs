import fs from 'node:fs'

const diagnosticsPath = 'docs/CERTIFICATION/nba-02c-historical-model-diagnostics.json'
const stakePath = 'docs/CERTIFICATION/nba-02c-stake-policy-research.json'
const docPath = 'docs/PRODUCTION_PILOT/NBA_02C_HISTORICAL_MODEL_DIAGNOSTICS_STAKE_POLICY.md'
const runnerPath = 'scripts/nba-02c-historical-diagnostics-stake-policy.mjs'

const diagnostics = JSON.parse(fs.readFileSync(diagnosticsPath, 'utf8'))
const stake = JSON.parse(fs.readFileSync(stakePath, 'utf8'))
const doc = fs.readFileSync(docPath, 'utf8')
const runner = fs.readFileSync(runnerPath, 'utf8')
const checks = []

function check(name, passed) {
  checks.push({ name, passed: Boolean(passed) })
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`)
}

const acceptedStatuses = [
  'NBA_02C_DIAGNOSTICS_PASS_CURRENT_ERA_SHADOW_RECOMMENDED',
  'NBA_02C_DIAGNOSTICS_PASS_MODEL_IMPROVEMENT_RESEARCH_RECOMMENDED',
  'NBA_02C_DIAGNOSTICS_PASS_STAKE_POLICY_PROMISING_SHADOW_REQUIRED',
  'NBA_02C_DIAGNOSTICS_PASS_CURRENT_ERA_SHADOW_READY_STAKE_POLICY_READY',
  'NBA_02C_DIAGNOSTICS_PASS_CURRENT_ERA_SHADOW_READY_STAKE_POLICY_RESEARCH_ONLY',
  'NBA_02C_DIAGNOSTICS_PASS_MODEL_IMPROVEMENT_CHALLENGER_RECOMMENDED',
  'NBA_02C_DIAGNOSTICS_PASS_CURRENT_ERA_NOT_READY',
  'NBA_02C_MODEL_BEHAVIOR_REVIEW_REQUIRED',
  'NBA_02C_BLOCKED',
]

const policyNames = new Set(stake.policies.map((policy) => policy.policy))
const requiredPolicies = [
  'FLAT_1U',
  'CONFIDENCE_TIER',
  'CONFIDENCE_TIER_C2',
  'PROBABILITY_TIER',
  'EDGE_TIER',
  'EV_TIER',
  'COMBINED_EVIDENCE',
  'FRACTIONAL_KELLY_10',
  'FRACTIONAL_KELLY_25',
  'FRACTIONAL_KELLY_50',
]

check('final status accepted', acceptedStatuses.includes(diagnostics.status) && diagnostics.status === stake.status)
check('flat baseline preserved', diagnostics.baseline.allPriceAware.sample === 3336 && diagnostics.baseline.allPriceAware.roi === -6.57)
check('price-aware universe preserved', diagnostics.universe.priceAwareEvents === 1112 && diagnostics.universe.priceAwarePredictions === 3336)
check('market counts preserved', diagnostics.universe.moneyline === 1112 && diagnostics.universe.spread === 1112 && diagnostics.universe.total === 1112)
check('first-half price-aware remains zero', diagnostics.universe.firstHalfPriceAware === 0)
check('chronological simulation declared', String(stake.methodology.methodology).includes('chronological') && stake.methodology.discoveryRows > 0 && stake.methodology.validationRows > 0)
check('validation untouched during discovery', stake.methodology.validationUntouchedDuringDiscovery === true && stake.methodology.resultLeakage === 0)
check('same-day exposure cap enforced', stake.policies.every((policy) => Number(policy.maxSimultaneousExposure) <= 10))
check('per-bet bankroll cap declared', stake.methodology.maxPerBetBankrollCapPct === 2)
check('confidence/probability/edge/EV/combined policies tested', requiredPolicies.slice(0, 7).every((name) => policyNames.has(name)))
check('fractional Kelly policies tested', requiredPolicies.slice(7).every((name) => policyNames.has(name)))
check('negative EV high-confidence not oversized', stake.noNegativeEvOversizing.highConfidenceNegativeEvRows > 0 && stake.noNegativeEvOversizing.oversizedByRecommendedPolicy === 0)
check('out-of-sample metrics present', stake.policies.every((policy) => Number.isInteger(policy.validationBets) && policy.validationROI !== undefined && policy.validationMaxDrawdown !== undefined))
check('drawdown metrics present', stake.policies.every((policy) => policy.validation.maxDrawdown !== undefined && policy.validation.longestLosingStreak !== undefined))
check('market results present', ['moneyline', 'spread', 'total'].every((market) => diagnostics.baseline.byMarket?.[market]?.sample === 1112))
check('season results present', diagnostics.baseline.bySeason?.['2024-25']?.sample === 3336)
check('price-band results present', Object.keys(diagnostics.moneylineQuestion.priceBands ?? {}).length === 6)
check('Official-like separated', diagnostics.validity.officialLikeCohort.sample === 908 && diagnostics.validity.officialLikeCohort.flat.roi === -5.62)
check('all-price-aware separated', diagnostics.baseline.allPriceAware.sample === 3336 && diagnostics.validity.officialLikeCohort.sample < diagnostics.baseline.allPriceAware.sample)
check('NBA Current Era activation zero', diagnostics.safety.nbaCurrentEraWrites === 0)
check('Official Picks zero', diagnostics.safety.officialPicks === 0)
check('production learning/calibration zero', diagnostics.safety.productionLearningWrites === 0 && diagnostics.safety.productionCalibrationWrites === 0)
check('historical provider calls zero', diagnostics.safety.historicalProviderCalls === 0 && stake.providerCalls === 0)
check('MLB regression pass', ['HEALTHY', 'READ_ONLY_FINAL_CHECK_REQUIRED', null].includes(diagnostics.mlbParallel?.mlbHealth))
check('certification reads zero provider calls', Number(diagnostics.mlbParallel?.providerCallsFromCertificationReads ?? 0) === 0)
check('certification reads zero database mutations', Number(diagnostics.mlbParallel?.databaseMutationsFromCertificationReads ?? 0) === 0)
check('Current Era shadow recommended but production not ready', diagnostics.readiness.currentEraShadowDecision === 'NBA_CURRENT_ERA_SHADOW_READY_WITH_LIMITATIONS' && diagnostics.readiness.productionRecommendationDecision === 'NBA_PRODUCTION_RECOMMENDATIONS_NOT_READY')
check('stake policy research-only', stake.recommendedPolicyEvidence.classification === 'RESEARCH_ONLY_NOT_PRODUCTION_READY')
check('bankroll engine design present', diagnostics.bankrollEngineDesign?.recommended === 'YES' && diagnostics.bankrollEngineDesign.automaticBetting === 'NO' && diagnostics.bankrollEngineDesign.maxSingleBetPct === 2)
check('notification design present and gated', diagnostics.notificationDesign?.recommended === 'YES_LATER' && diagnostics.notificationDesign.officialPickRequired === 'YES' && diagnostics.notificationDesign.automaticBetPlacement === 'NO')
check('provider recommendation present', diagnostics.providerRecommendations?.theOddsApiRole?.includes('NBA odds target') && diagnostics.providerRecommendations.goatRequiredForRuntime === 'NO')
check('stake input contract present', stake.recommendedPolicyEvidence.stakeInputsRequired?.edge === 'REQUIRED' && stake.recommendedPolicyEvidence.stakeInputsRequired?.officialPickStatus === 'GATE_ONLY_FOR_USER_FACING')
check('future phase decision present', diagnostics.nextPhaseDecision?.primaryNextPhase === 'NBA-03A_CURRENT_ERA_SHADOW_FOUNDATION')
check('no provider SDK endpoints in runner', !runner.includes('api.the-odds-api.com') && !runner.includes('balldontlie') && !runner.includes('SportsDataIO'))
check('runner reads stored replay evidence', runner.includes('prediction_history') && runner.includes('sport_events'))
check('docs record research-only conclusion', doc.includes('research-only') && doc.includes('not production stake advice'))
check('docs record bankroll and notification design', doc.includes('Bankroll Engine Design') && doc.includes('Notification Design'))

const failed = checks.filter((item) => !item.passed)
console.log(`\nnba_02c_historical_diagnostics_stake_policy_validate_v1 ${failed.length ? 'FAIL' : 'PASS'} ${checks.length - failed.length}/${checks.length}`)
if (failed.length) {
  console.error(JSON.stringify({ failed }, null, 2))
  process.exit(1)
}
