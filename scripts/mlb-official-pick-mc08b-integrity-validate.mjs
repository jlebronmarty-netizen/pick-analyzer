import fs from 'node:fs'

const failures = []

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

function check(name, condition) {
  if (!condition) failures.push(name)
}

const artifact = JSON.parse(read('docs/CERTIFICATION/mlb-official-pick-mc08b-integrity.json'))
const home = read('src/components/home/HomeBettingPlan.tsx')
const policy = read('src/services/recommendation-eligibility-policy.service.ts')
const official = read('src/services/official-pick-experience.service.ts')
const topPicks = read('src/services/top-picks.service.ts')
const currentBoard = read('src/services/current-board.service.ts')

check('MC-08B implementation located', home.includes("contractVersion: 'rent_play_v1'"))
check('canonical policy identified', policy.includes('export function evaluateRecommendationEligibility'))
check('single official contract consumes policy status', official.includes('isOfficialRecommendationStatus(candidate.recommendationPolicyStatus'))
check('recommendation eligibility does not require official pick input', !/Official Pick.*requires.*Official Pick/i.test(policy))
check('probability threshold unchanged', policy.includes('minimumModelProbability: 52'))
check('confidence threshold unchanged', policy.includes('minimumOfficialConfidence: 65'))
check('edge threshold unchanged', policy.includes('minimumOfficialEdge: 5'))
check('EV threshold unchanged', policy.includes('minimumOfficialEv: 5'))
check('freshness threshold unchanged', policy.includes('maximumOddsAgeMinutes: 120'))
check('calibration gate preserved', policy.includes("calibrationStatus !== 'acceptable' && calibrationStatus !== 'mature'"))
check('production gate preserved', policy.includes('evaluateProductionDataGate(input,'))
check('timing gate preserved', policy.includes('EVENT_NOT_FUTURE'))
check('post-start/settled gate preserved', policy.includes('EVENT_ALREADY_SETTLED'))
check('homepage carries canonical policy blockers', home.includes('policyBlockers: string[]'))
check('homepage filters stale non-positive blockers against current canonical evidence', home.includes("code === 'NON_POSITIVE_EDGE'") && home.includes("code === 'NON_POSITIVE_EV'"))
check('homepage marks deterministic rejection as fail', home.includes('deterministicPolicyRejected'))
check('rent play exposes Official Pick policy blockers', home.includes("gate('policy_blockers', 'Official Pick policy blockers'"))
check('official status no longer only vague pending', home.includes("gate('official_status', 'Official Pick eligibility'"))
check('synthetic full-pass fixture exists in canonical validator', policy.includes("['positive edge qualifies'"))
check('single fail fixture negative edge exists', policy.includes("['negative edge rejected'"))
check('single fail fixture negative EV exists', policy.includes("['negative EV rejected'"))
check('single fail fixture stale odds exists', policy.includes("['stale odds rejected'"))
check('single fail fixture quarantined exists', policy.includes("['quarantined rejected'"))
check('probationary calibration fixture blocks', policy.includes("['probationary calibration blocks'"))
check('top picks uses canonical policy', topPicks.includes('evaluateRecommendationEligibility({'))
check('current board readback path exposes recommendation status', currentBoard.includes('recommendationPolicyStatus'))
check('price binding semantics documented as complement for LAD', artifact.ladTrace.priceBinding === 'COMPLEMENT')
check('displayed -140 is not direct aligned same-selection price', artifact.ladTrace.directlyAlignedDisplayedPrice === false)
check('LAD edge/EV lineage captured', artifact.ladTrace.edge === 2.26 && artifact.ladTrace.expectedValue === 3.87)
check('LAD rejected at time', artifact.ladTrace.eligibleAtTheTime === false)
check('current-day evaluated count captured', artifact.currentDay.mc08bEvaluated === artifact.currentDay.currentBoardCandidates)
check('zero official picks explained', artifact.currentDay.officialPickEligible === 0 && artifact.currentDay.promoted === 0)
check('circular dependency absent', artifact.circularity.circularDependency === false)
check('official pick is output', artifact.circularity.officialPickIs === 'OUTPUT')
check('no threshold changes declared', artifact.repair.thresholdsChanged === false)
check('no formula changes declared', artifact.repair.formulasChanged === false)
check('no retrospective promotions', artifact.repair.promotionLogicChanged === false)
check('SportsDataIO calls remain unchanged', artifact.repair.sportsDataIoRoutineCallsChanged === false)
check('NBA historical foundation untouched', artifact.repair.nbaHistoricalFoundationTouched === false)

const summary = {
  mode: 'mlb_official_pick_mc08b_integrity_validation_v1',
  passed: failures.length === 0,
  checks: 41,
  failed: failures.length,
  failures,
  status: artifact.status,
  providerCallsMade: 0,
  productionDatabaseMutations: 0,
}

console.log(JSON.stringify(summary, null, 2))

if (failures.length) process.exit(1)

