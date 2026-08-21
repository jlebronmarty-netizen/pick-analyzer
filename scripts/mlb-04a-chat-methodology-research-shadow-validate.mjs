import fs from 'node:fs'

const CERT_PATH = 'docs/CERTIFICATION/mlb-04a-chat-methodology-research-shadow.json'
const DOC_PATH = 'docs/PRODUCTION_PILOT/MLB_04A_CHAT_METHODOLOGY_RESEARCH_SHADOW.md'

function check(name, condition) {
  if (!condition) throw new Error(`${name} failed`)
  console.log(`PASS ${name}`)
}

const cert = JSON.parse(fs.readFileSync(CERT_PATH, 'utf8'))
const doc = fs.readFileSync(DOC_PATH, 'utf8')
const matrix = cert.featureGapMatrix ?? []
const byComponent = new Map(matrix.map((entry) => [entry.component, entry]))

check('classification is design only', cert.classification === 'MLB_04A_CHAT_METHODOLOGY_RESEARCH_FOUNDATION_CERTIFIED_DESIGN_ONLY')
check('provider calls zero', cert.providerCallsMade === 0)
check('database mutations zero', cert.productionDatabaseMutations === 0)
check('prediction mutations zero', cert.productionPredictionMutations === 0 && cert.currentEraShadowMutations === 0)
check('mlb03 settlement runtime untouched', cert.mlb03SettlementRuntimeModified === false)
check('fourth canary not created', cert.fourthCleanCanaryCreated === false)
check('continuous scheduler not authorized', cert.continuousSchedulerAuthorized === false)
check('calibrated baseline only preserved', cert.existingModelContract.selectedMlb03Contract === 'CALIBRATED_BASELINE_ONLY')
check('core market contract preserved', cert.existingModelContract.coreMarkets.join(',') === 'moneyline,run_line,total')
check('feature matrix covers methodology components', matrix.length >= 20)
check('market price available and used', byComponent.get('market_price')?.status === 'AVAILABLE_AND_USED')
check('injuries missing', byComponent.get('injuries')?.status === 'MISSING')
check('lineup forward only', byComponent.get('lineup_availability')?.status === 'FORWARD_ONLY')
check('nrfi missing', byComponent.get('nrfi')?.status === 'MISSING')
check('pitcher props partial', byComponent.get('pitcher_props')?.status === 'PARTIAL')
check('scorecard does not emit probability', cert.scorecardDesign.probabilityOutputPolicy.includes('Do not emit calibrated probability'))
check('research shadow isolated', cert.researchShadowDesign.isCurrent === false && cert.researchShadowDesign.officialPick === false && cert.researchShadowDesign.productVisible === false)
check('morning snapshot immutable', cert.temporalContracts.morningSnapshot.immutable === true)
check('final pregame snapshot immutable', cert.temporalContracts.finalPregameSnapshot.immutable === true)
check('leakage blocked', Object.values(cert.temporalContracts.leakageAudit).every((value) => value === 'BLOCKED'))
check('comparison exact identity required', cert.comparisonContract.compareOnlyWhenSameIdentity.includes('line'))
check('accuracy ledger required', cert.evaluationContract.ledgerRequiredForAccuracyClaims === true)
check('pitcher props not ready', cert.pitcherPropFoundation.overall === 'PARTIAL_NOT_READY_FOR_PREDICTIONS')
check('nrfi not ready', cert.nrfiYrfiFoundation.nrfi === 'NOT_READY' && cert.nrfiYrfiFoundation.yrfi === 'NOT_READY')
check('recommended next snapshot automation', cert.priorityRecommendation[0].phase === 'E_MORNING_FINAL_PREGAME_SNAPSHOT_AUTOMATION')
check('doc states no copied probabilities', /not as ground truth|reported probabilities are not copied/i.test(doc))
check('doc states no runtime writes', /Runtime prediction writes: 0/.test(doc))

console.log(JSON.stringify({
  success: true,
  mode: 'mlb_04a_chat_methodology_research_shadow_validate',
  classification: cert.classification,
  featureGapComponents: matrix.length,
  providerCallsMade: cert.providerCallsMade,
  productionDatabaseMutations: cert.productionDatabaseMutations,
}, null, 2))
