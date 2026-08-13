import fs from 'node:fs'

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const homePath = 'src/components/home/HomeBettingPlan.tsx'
const boardPath = 'src/services/current-board.service.ts'
const semanticsPath = 'src/services/market-semantics.service.ts'
const aiFinderPath = 'src/services/ai-bet-finder.service.ts'
const autonomousPath = 'src/services/autonomous-daily-operations.service.ts'
const bestBetsPath = 'src/services/best-bets-today.service.ts'
const day1Path = 'src/services/day1-recommendation-readiness.service.ts'
const marketCategoryPath = 'src/services/market-intelligence-category.service.ts'
const marketEnginePath = 'src/services/market-intelligence-engine.service.ts'
const aiCoachPath = 'src/services/mlb-ai-coach.service.ts'
const readinessAuditPath = 'src/services/production-readiness-audit.service.ts'
const prospectiveGatePath = 'src/services/prospective-official-eligibility-gate.service.ts'
const docPath = 'docs/ARCHITECTURE/MLB_PRODUCT_EVIDENCE_BINDING_V1.md'
const certPath = 'docs/CERTIFICATION/mlb-product-candidate-selection-integrity.json'

for (const file of [
  homePath,
  boardPath,
  semanticsPath,
  aiFinderPath,
  autonomousPath,
  bestBetsPath,
  day1Path,
  marketCategoryPath,
  marketEnginePath,
  aiCoachPath,
  readinessAuditPath,
  prospectiveGatePath,
  docPath,
  certPath,
]) {
  assert(fs.existsSync(file), `missing artifact: ${file}`)
}

const home = read(homePath)
const board = read(boardPath)
const semantics = read(semanticsPath)
const aiFinder = read(aiFinderPath)
const autonomous = read(autonomousPath)
const bestBets = read(bestBetsPath)
const day1 = read(day1Path)
const marketCategory = read(marketCategoryPath)
const marketEngine = read(marketEnginePath)
const aiCoach = read(aiCoachPath)
const readinessAudit = read(readinessAuditPath)
const prospectiveGate = read(prospectiveGatePath)
const doc = read(docPath)
const cert = JSON.parse(read(certPath))

assert(board.includes('const expectedValue = marketAlignment.expectedValuePercent'), 'Current Board must preserve null EV from market alignment')
assert(!board.includes('const expectedValue = marketAlignment.expectedValuePercent ?? 0'), 'Current Board must not coerce null EV to zero')
assert(board.includes('expectedValue !== null && expectedValue > 0'), 'modeled value status must require available positive EV')
assert(home.includes('row.analysisSnapshotTimestamp ?? row.predictionGeneratedAt ?? row.generated_at'), 'homepage rows must read prediction analysis timestamp')
assert(home.includes('selector.analysisSnapshotTimestamp ?? selector.snapshotCapturedAt'), 'homepage selectors must read analysis timestamp before recency timestamp')
assert(home.includes('sourceMarketIdentity.line'), 'homepage must read nested source market line identity')
assert(home.includes('sourceMarketIdentity.oddsSnapshotId'), 'homepage must read nested odds snapshot identity')
assert(home.includes('item.line ?? item.priceSourceLine'), 'homepage dedupe must preserve exact line identity')
assert(home.includes("label: 'MOST EVIDENCE-COMPLETE REVIEW OPTION'"), 'review option label must describe evidence-completeness comparator')
assert(home.includes('Most Evidence-Complete Moneyline Review Candidate - Not A Recommendation'), 'Moneyline review UI must not imply highest probability')
assert(home.includes('Most Evidence-Complete Review Candidate - Not Rent Play / Not A Recommendation'), 'Rent Play review UI must not imply highest probability')
assert(home.includes('<MiniText label="Analysis Snapshot" value={compactDate(reviewPick.snapshotCapturedAt ?? null)} />'), 'review tiles must render analysis snapshot')
assert(home.includes('candidate.ev === null ? \'EV unavailable.\''), 'review blockers must distinguish null EV from non-positive EV')
assert(home.includes('item.ev === null ? \'NOT_AVAILABLE\''), 'watchlist value gates must distinguish unavailable EV')
assert(semantics.includes('pushCapable') && semantics.includes('unknown_push_probability'), 'market semantics must preserve push-capable classification')
assert(semantics.includes("['moneyline binary'") && semantics.includes("['total 8 push capable'"), 'market semantics fixtures must cover binary and integer-total push cases')
assert(board.includes('oppositeProbability = marketSemantics.pushCapable ? null : round(100 - boundedProbability)'), 'Current Board must not auto-complement push-capable markets')
assert(board.includes('canonicalMarketAlignment: complementAlignment'), 'canonical complement evidence must remain separate')
assert(aiFinder.includes('candidateEv(candidate) <= 0'), 'AI finder positive EV filters must fail closed for null EV')
assert(autonomous.includes('candidate.expectedValue === null || candidate.expectedValue <= 0'), 'autonomous daily operations must treat null EV as not positive')
assert(bestBets.includes('expectedValue: number | null'), 'Best Bets output contract must allow unavailable EV')
assert(bestBets.includes('candidate.expectedValue === null || candidate.expectedValue <= 0'), 'Best Bets blockers must treat null EV as not positive')
assert(day1.includes('candidate.expectedValue === null || candidate.expectedValue <= 0'), 'Day 1 readiness must treat null EV as not positive')
assert(marketCategory.includes('Expected value is unavailable at the current stored price.'), 'Market Intelligence must label null EV as unavailable')
assert(marketCategory.includes('function valueQuality(candidate: CurrentBoardCandidate)'), 'Market Intelligence value quality must remain centralized')
assert(marketEngine.includes('candidate.expectedValue === null || candidate.expectedValue <= 0'), 'Market Intelligence engine must treat null EV as no value')
assert(aiCoach.includes('candidate.expectedValue !== null && candidate.expectedValue > 0'), 'AI coach positive-value selection must require available EV')
assert(readinessAudit.includes('candidate.expectedValue === null || candidate.expectedValue <= 0'), 'Production readiness audit must treat null EV as not positive')
assert(prospectiveGate.includes('candidate.expectedValue !== null && candidate.expectedValue >= RECOMMENDATION_THRESHOLDS_V1.minimumOfficialEv'), 'prospective official gate must require available EV')
assert(doc.includes('Current Board starts from 27 current-day MLB prediction-backed candidates'), 'architecture doc must explain current board universe')
assert(doc.includes('most evidence-complete review candidate'), 'architecture doc must explain review fallback comparator')
assert(doc.includes('Integer Run Lines and Totals are push-capable'), 'architecture doc must explain push semantics')
assert(doc.includes('Null EV means EV is unavailable'), 'architecture doc must explain EV null semantics')
assert(doc.includes('Analysis Snapshot') && doc.includes('Market Evidence Time'), 'architecture doc must separate timestamp semantics')
assert(cert.status === 'MLB_PRODUCT_CANDIDATE_SELECTION_INTEGRITY_REPAIR_READY_FOR_DEPLOYMENT', 'certification status mismatch')
assert(cert.marketSemantics.unsafeAutoFlipAllowed === false, 'unsafe auto-flip must remain blocked')
assert(cert.repair.nullEvPreserved === true, 'null EV repair must be certified')
assert(cert.repair.analysisSnapshotMappedToHomepage === true, 'analysis snapshot repair must be certified')
assert(cert.protectedInvariants.predictionFormulaChanged === false, 'prediction formula must remain unchanged')
assert(cert.protectedInvariants.evFormulaChanged === false, 'EV formula must remain unchanged')
assert(cert.protectedInvariants.officialPickPolicyChanged === false, 'Official Pick policy must remain unchanged')
assert(cert.protectedInvariants.providerAuthorityChanged === false, 'provider authority must remain unchanged')
assert(cert.protectedInvariants.nbaHistoricalFoundationChanged === false, 'NBA historical foundation must remain unchanged')
assert(cert.certificationAccounting.providerCallsFromCertification === 0, 'certification provider calls must be zero')
assert(cert.certificationAccounting.databaseMutationsFromCertification === 0, 'certification DB mutations must be zero')
assert(cert.certificationAccounting.sportsDataIoMlbCalls === 0, 'SportsDataIO MLB calls must remain zero')

console.log(JSON.stringify({
  success: true,
  mode: 'mlb_product_candidate_selection_integrity_validate_v1',
  checks: 47,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  classification: cert.status,
}, null, 2))
