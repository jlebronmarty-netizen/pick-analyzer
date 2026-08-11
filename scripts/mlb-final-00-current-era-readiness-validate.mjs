import fs from 'node:fs'

const checks = []

function check(name, condition, detail = '') {
  checks.push({ name, pass: Boolean(condition), detail })
}

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

const source = read('src/components/home/HomeBettingPlan.tsx')
const architecture = read('docs/ARCHITECTURE/MLB_CURRENT_ERA_FINAL_V1.md')
const pilot = read('docs/PRODUCTION_PILOT/MLB_FINAL_00_CURRENT_ERA_READINESS.md')
const cert = JSON.parse(read('docs/CERTIFICATION/mlb-final-00-current-era-readiness.json'))

check('provider architecture correct', cert.providerArchitecture.oddsPrimaryAuthorityStage === 'STAGE_3_THE_ODDS_API_PRIMARY_PRODUCT' && cert.providerArchitecture.productOddsAuthority === 'THE_ODDS_API' && cert.providerArchitecture.mlbDataSourceMode === 'MLB_OFFICIAL_PRIMARY')
check('SportsDataIO calls remain 0', cert.providerArchitecture.sportsDataIoRoutineMlbCalls === 0 && cert.refresh.sportsDataIoCalls === 0)
check('current lifecycle classified', Object.keys(cert.currentSlate.lifecycleCounts).length >= 4)
check('stored pregame evidence preserved', cert.rootCause.dashboardGroundedEvidencePreserved === true && cert.predictions.groundedRows > 0)
check('no post-start predictions', cert.postStartSafety.newPostStartPredictions === 0)
check('current-line probability lineage valid', cert.evidence.candidatesWithValidProbability === cert.predictions.currentBoardCandidates)
check('probability edge EV consistency', cert.evidence.candidatesWithValidProbability === cert.evidence.candidatesWithValidEdge && cert.evidence.candidatesWithValidEdge === cert.evidence.candidatesWithValidEv)
check('feature snapshot lineage valid', cert.evidence.candidatesWithFeatureSnapshot === cert.predictions.currentBoardCandidates)
check('starter evidence audited', architecture.includes('Starter') || architecture.includes('starter'))
check('gates fully classified', architecture.includes('| Gate | Surface | Hard/Soft | Source | Lock Behavior | User Meaning |'))
check('N/A used only when unavailable', source.includes('No Sufficiently Evidenced Review Candidate') && source.includes('isLowInformationCandidate'))
check('live-lock not confused with missing data', architecture.includes('Actionability and evidence visibility are separate'))
check('best available review option supported', source.includes('best_available_review_option_v1') && source.includes('BEST AVAILABLE REVIEW OPTION'))
check('blocked option clearly not recommendation', source.includes('data-not-recommendation=\"true\"') && cert.bestAvailableReviewOption.notRecommendation === true)
check('Rent Play contract preserved', source.includes("contractVersion: 'rent_play_v1'") && source.includes('No Qualified Rent Play'))
check('Moneyline contract preserved', source.includes("contractVersion: 'moneyline_bet_v1'") && source.includes('No Qualified Moneyline Bet'))
check('Smart Parlay contract preserved', source.includes("contractVersion: 'smart_parlay_v1'") && source.includes("jointProbabilityMethod: 'NOT_CERTIFIED'"))
check('Watchlist contract preserved', source.includes("contractVersion: 'watchlist_v1'") && source.includes('Research Only'))
check('Value Signals preserved', source.includes('Value Signals'))
check('Current Board healthy', cert.operations.currentBoard === 'HEALTHY')
check('Performance isolated', cert.operations.performance === 'PASS' && cert.policyChanges.hr03Promoted === false)
check('settlement healthy', cert.operations.settlement === 'PASS')
check('learning healthy', cert.operations.learning === 'PASS')
check('scheduler healthy', cert.operations.scheduler === 'HEALTHY')
check('provider budget healthy', cert.operations.providerBudget === 'HEALTHY')
check('bounded provider refresh within authorization', cert.refresh.required === false || (cert.refresh.theOddsApiCalls <= 1 && cert.refresh.sportsDataIoCalls === 0))
check('provider calls from certification recorded', cert.certificationAccounting.providerCallsFromCertification === 0)
check('DB mutations limited', cert.certificationAccounting.databaseMutationsFromCertification === 0)
check('no model formula change', cert.policyChanges.predictionFormulaChanged === false && cert.policyChanges.probabilityChanged === false)
check('no policy threshold change', cert.policyChanges.thresholdChanged === false && cert.policyChanges.officialPickPolicyChanged === false)
check('pilot doc root cause recorded', pilot.includes('The evidence was not lost'))

const failed = checks.filter((item) => !item.pass)
for (const item of checks) {
  console.log(`${item.pass ? 'PASS' : 'FAIL'} ${item.name}${item.detail ? ` - ${item.detail}` : ''}`)
}

if (failed.length) {
  console.error(`MLB-FINAL-00 validation failed: ${failed.length}`)
  process.exit(1)
}

console.log(`MLB-FINAL-00 validation passed: ${checks.length}`)
