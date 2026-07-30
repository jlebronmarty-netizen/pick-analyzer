import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8')

const artifact = JSON.parse(read('docs/UNSUPPORTED_MARKET_RECOMMENDATION_POLICY_LOCK_V1.json'))
const phases = JSON.parse(read('docs/PICK_ANALYZER_V1_PHASES.json'))
const scope = JSON.parse(read('docs/PICK_ANALYZER_V1_SCOPE.json'))
const policy = read('src/services/recommendation-eligibility-policy.service.ts')
const topPicks = read('src/services/top-picks.service.ts')
const markets = read('src/services/universal-market-intelligence.service.ts')
const probabilityPicks = read('src/components/probability-picks/ProbabilityPicksClient.tsx')
const productToday = read('src/components/dashboard/ProductTodayPanel.tsx')
const mostLikely = read('src/components/market-opportunities/MostLikelyTool.tsx')
const aiBetFinder = read('src/services/ai-bet-finder.service.ts')
const sportsCenter = read('src/services/sports-center.service.ts')

const phase4 = phases.phases.find((phase) => phase.phase === 4)
const outOfScope = new Set(scope.outOfScope)
const requiredOutOfScope = [
  'non_mlb_production_recommendations',
  'player_props',
  'pitcher_props',
  'batter_props',
  'team_totals',
  'nrfi_yrfi',
  'first_five',
  'alternate_lines',
  'live_betting',
]

function hasAll(source, values) {
  return values.every((value) => source.includes(value))
}

const checks = [
  ['artifact pass recorded', artifact.success === true && artifact.status === 'PASS'],
  ['phase 4 marked complete', phase4?.status === 'complete'],
  ['provider calls stayed zero', artifact.providerCallsMade === 0],
  ['production mutations stayed zero', artifact.productionMutationsMade === 0],
  ['business rules unchanged', artifact.businessRuleChangesMade === 0],
  ['recommendation allowlist is core markets only', policy.includes("supportedMarkets: ['moneyline', 'spread', 'run_line', 'total']")],
  ['unsupported market blocker exists', policy.includes("'UNSUPPORTED_MARKET'") && policy.includes("blockers.push('UNSUPPORTED_MARKET')")],
  ['official statuses are policy gated', policy.includes("status === 'QUALIFIED'") && policy.includes("status === 'BEST_BET_CANDIDATE'") && policy.includes("status === 'PLAY_OF_DAY_CANDIDATE'")],
  ['top picks uses central policy', topPicks.includes('evaluateRecommendationEligibility') && topPicks.includes('isOfficialRecommendationStatus')],
  ['top picks requires production eligibility', topPicks.includes(".eq('production_eligible', true)") && topPicks.includes('isProductionEligibleRow(row)')],
  ['unsupported markets are not official eligible', hasAll(markets, ['team_total', 'first_five_moneyline', 'first_inning', 'alternate_lines', 'pitcher_props', 'batter_props']) && markets.match(/officialPickEligible: false/g)?.length >= 8],
  ['unsupported activation diagnostic exists', markets.includes('unsupportedActivationBlocked')],
  ['scope excludes unsupported markets', requiredOutOfScope.every((item) => outOfScope.has(item))],
  ['probability picks copy is projection only', probabilityPicks.includes('does not attach market prices') && probabilityPicks.includes('recommendation')],
  ['dashboard official pick boundary visible', productToday.includes('Official Picks are the only recommendations')],
  ['most likely boundary visible', mostLikely.includes('not a recommendation') && mostLikely.includes('recommendationBoundary')],
  ['ai bet finder boundary visible', aiBetFinder.includes('No official picks today') && aiBetFinder.includes('not a recommendation')],
  ['non-MLB recommendations blocked in sports center', sportsCenter.includes("capability('Recommendations', 'Blocked'")],
  ['phase exit criteria all true', Object.values(artifact.phaseExitCriteria).every(Boolean)],
]

for (const [name, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`)
}

const failed = checks.filter(([, passed]) => !passed)
if (failed.length) {
  console.error(`Unsupported-market recommendation-policy lock validation failed: ${failed.map(([name]) => name).join(', ')}`)
  process.exit(1)
}

console.log(`Unsupported-market recommendation-policy lock validation passed: ${checks.length}/${checks.length}`)
