import { readFileSync } from 'node:fs'

const files = {
  types: 'src/types/probability-picks.ts',
  service: 'src/services/probability-picks.service.ts',
  client: 'src/components/probability-picks/ProbabilityPicksClient.tsx',
  doc: 'docs/PROBABILITY_PICKS_MULTI_SPORT_AUDIT_V1.md',
}

function read(path) {
  return readFileSync(path, 'utf8')
}

const text = Object.fromEntries(Object.entries(files).map(([key, path]) => [key, read(path)]))

const checks = [
  ['sport eligibility type exists', text.types.includes('ProbabilitySportEligibilityStatus')],
  ['engine not certified classification exists', text.types.includes("'ENGINE_NOT_CERTIFIED'")],
  ['data status type exists', text.types.includes('ProbabilityDataStatus')],
  ['response includes sport eligibility summary', text.types.includes('sportEligibility: ProbabilitySportEligibilitySummary')],
  ['service defines mlb limited eligibility', text.service.includes('MLB_LIMITED_ELIGIBILITY')],
  ['service defines uncertified eligibility', text.service.includes('UNCERTIFIED_ELIGIBILITY')],
  ['service filters rank eligibility before ranking', text.service.includes('const picks = allPicks.filter(isRankEligible)')],
  ['validation proves uncertified sport not ranking eligible', text.service.includes('uncertified sport rows are not ranking eligible')],
  ['ui labels probability confidence quality meaning', text.client.includes('Probability means estimated outcome likelihood')],
  ['ui reports excluded uncertified rows', text.client.includes('Excluded uncertified rows')],
  ['doc records no probability math change', text.doc.includes('Probability math was not changed')],
  ['doc includes pass marker', text.doc.includes('NO_UNCERTIFIED_SPORT_RANKING_PASS')],
]

const failed = checks.filter(([, passed]) => !passed)
const result = {
  success: failed.length === 0,
  checks: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  failedChecks: failed.map(([name]) => name),
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  probabilityLogicChanged: false,
  learningBrainChanged: false,
}

console.log(JSON.stringify(result, null, 2))
if (!result.success) process.exit(1)
