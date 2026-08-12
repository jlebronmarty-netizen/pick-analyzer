import fs from 'node:fs'

const checks = []

function check(name, condition, detail = '') {
  checks.push({ name, pass: Boolean(condition), detail })
}

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

const source = read('src/components/home/HomeBettingPlan.tsx')
const cert = JSON.parse(read('docs/CERTIFICATION/mlb-moneyline-blocker-text-consistency.json'))
const doc = read('docs/PRODUCTION_PILOT/MLB_MONEYLINE_BLOCKER_TEXT_CONSISTENCY.md')

const helperStart = source.indexOf('function reviewOnlyDisplayBlockers')
const helperEnd = source.indexOf('function compareMoneylineEvidence')
const helper = helperStart >= 0 && helperEnd > helperStart ? source.slice(helperStart, helperEnd) : ''
const moneylineStart = source.indexOf('function MoneylineBetCard')
const moneylineEnd = source.indexOf('function MiniText')
const moneylineCard = moneylineStart >= 0 && moneylineEnd > moneylineStart ? source.slice(moneylineStart, moneylineEnd) : ''

check('display blocker helper exists', helper.includes('reviewOnlyDisplayBlockers'))
check('helper derives edge blocker from displayed candidate edge', helper.includes('candidate.edge === null') && helper.includes('Number(candidate.edge) <= 0') && helper.includes('Edge is not positive.'))
check('helper derives EV blocker from displayed candidate EV', helper.includes('candidate.ev === null') && helper.includes('Number(candidate.ev) <= 0') && helper.includes('EV is not positive.'))
check('stale non-positive edge code filtered when current edge positive', source.includes("code === 'NON_POSITIVE_EDGE' && edge !== null && edge > 0"))
check('stale non-positive EV code filtered when current EV positive', source.includes("code === 'NON_POSITIVE_EV' && ev !== null && ev > 0"))
check('threshold blockers remain distinct', source.includes('Edge is below the existing Official Pick threshold.') && source.includes('EV is below the existing Official Pick threshold.'))
check('moneyline card blockers use displayed review pick', moneylineCard.includes('const reviewBlockers = reviewPick ? reviewOnlyDisplayBlockers(reviewPick) : bestReview.blockers') && moneylineCard.includes('Blocked Because: {reviewBlockers.slice(0, 3).join'))
check('best available contract uses same helper', source.includes('? reviewOnlyDisplayBlockers(candidate)') && source.includes("contractVersion: 'best_available_review_option_v1'"))
check('review-only status preserved', source.includes('NOT A RECOMMENDATION') && source.includes('No Qualified Moneyline Bet') && source.includes('Not Official'))
check('Official Pick policy not changed', !source.includes('minimumOfficialConfidence =') && !source.includes('minimumOfficialEdge =') && cert.policyChanges.officialPickPolicyChanged === false)
check('probability unchanged', cert.policyChanges.probabilityChanged === false)
check('EV math unchanged', cert.policyChanges.evMathChanged === false)
check('ranking unchanged', cert.policyChanges.rankingChanged === false)
check('SportsDataIO zero-call preserved', cert.providerSafety.sportsDataIoRoutineMlbCalls === 0)
check('provider calls from certification zero', cert.certificationAccounting.providerCallsFromCertification === 0)
check('production DB mutations from certification zero', cert.certificationAccounting.databaseMutationsFromCertification === 0)
check('root cause documented', cert.rootCause.classification === 'WRONG_CANDIDATE_BINDING' && doc.includes('WRONG_CANDIDATE_BINDING'))
check('positive edge fixture documented', doc.includes('positive edge / positive EV but blocked elsewhere'))
check('negative edge fixture documented', doc.includes('negative edge / negative EV'))
check('supersession stale blocker fixture documented', doc.includes('stale previous version replaced by new current version'))

const failed = checks.filter((item) => !item.pass)
for (const item of checks) {
  console.log(`${item.pass ? 'PASS' : 'FAIL'} ${item.name}${item.detail ? ` - ${item.detail}` : ''}`)
}

if (failed.length) {
  console.error(`MLB Moneyline blocker text consistency validation failed: ${failed.length}`)
  process.exit(1)
}

console.log(`MLB Moneyline blocker text consistency validation passed: ${checks.length}`)
