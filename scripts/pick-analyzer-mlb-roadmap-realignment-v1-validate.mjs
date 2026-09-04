import fs from 'node:fs'

const artifactPath = 'docs/CERTIFICATION/pick-analyzer-mlb-roadmap-realignment-v1.json'
const decisionPath = 'docs/PICK_ANALYZER_MLB_ROADMAP_REALIGNMENT_V1.md'
const projectStatusPath = 'docs/PROJECT_STATUS.md'
const roadmapPath = 'docs/MASTER_ROADMAP.md'

const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'))
const decision = fs.readFileSync(decisionPath, 'utf8')
const projectStatus = fs.readFileSync(projectStatusPath, 'utf8')
const roadmap = fs.readFileSync(roadmapPath, 'utf8')
const errors = []

function check(label, condition) {
  if (!condition) errors.push(label)
}

const requiredFlags = [
  ['PICK_ROADMAP_REALIGNMENT_BASELINE', 'PASS'],
  ['PICK_MLB_PRODUCT_GOAL_INVENTORY_COMPLETE', 'YES'],
  ['PICK_MLB_100_PARLAY_PRIMARY_OBJECTIVE_RETIRED', 'YES'],
  ['PICK_MLB_CORE_PRODUCT_OBJECTIVE_REALIGNED', 'YES'],
  ['PICK_INDIVIDUAL_PICK_FIRST_CONTRACT', 'PASS'],
  ['PICK_MLB_MARKET_ANALYSIS_SCOPE_READY', 'YES'],
  ['PICK_MLB_VALUE_CONTRACT_READY', 'YES'],
  ['PICK_MLB_OFFICIAL_PICKS_CONTRACT_READY', 'YES'],
  ['PICK_MLB_VALUE_BOARD_CONTRACT_READY', 'YES'],
  ['PICK_MLB_EXPLANATION_LAYER_READY', 'YES'],
  ['PICK_MLB_FACTOR_EDGE_TABLE_READY', 'YES'],
  ['PICK_MLB_OPTIONAL_PARLAY_LAYER_READY', 'YES'],
  ['PICK_MLB_PARLAY_CORRELATION_CONTRACT_READY', 'YES'],
  ['PICK_MLB_PROVIDER_RESPONSIBILITY_MATRIX_REALIGNED', 'YES'],
  ['PICK_MLB_SPORTSDATAIO_REMAINS_RETIRED', 'YES'],
  ['PICK_MLB_EXISTING_DATA_FOUNDATION_REUSED', 'YES'],
  ['PICK_MLB_01D_FEATURE_WORK_STILL_RELEVANT', 'YES'],
  ['PICK_MLB_MODEL_OBJECTIVE_REALIGNED', 'YES'],
  ['PICK_MLB_MARKET_SPECIFIC_MODEL_PLAN_READY', 'YES'],
  ['PICK_MLB_INDIVIDUAL_PREDICTION_CONTRACT_READY', 'YES'],
  ['PICK_MLB_SELECTIVITY_CONTRACT', 'PASS'],
  ['PICK_MLB_USER_WORKFLOW_REALIGNED', 'YES'],
  ['PICK_MLB_UI_DIRECTION_REALIGNED', 'YES'],
  ['PICK_MLB_AUTOMATION_POLICY_REALIGNED', 'YES'],
  ['PICK_MLB_AUTOMATION_STATE_PRESERVED', 'YES'],
  ['PICK_MLB_ROADMAP_UPDATED', 'YES'],
  ['PICK_MLB_NEW_PHASE_SEQUENCE_READY', 'YES'],
  ['PICK_MLB_NO_DATA_ROLLBACK_REQUIRED', 'YES'],
  ['PICK_MLB_REALIGNMENT_PRODUCTION_STATE', 'PASS'],
]

check('verdict certified', artifact.certificationVerdict === 'PICK_ANALYZER_MLB_ROADMAP_REALIGNMENT_FROM_PARLAY_AUTOMATION_TO_PICK_ANALYSIS_CERTIFIED')
for (const [flag, value] of requiredFlags) {
  check(`${flag} = ${value}`, artifact.flags[flag] === value)
}

check('decision record states active direction', decision.includes('Pick Analyzer MLB is an individual-pick/value-analysis system. 100-daily-parlay generation is not a core product requirement.'))
check('project status states active direction', projectStatus.includes('Pick Analyzer MLB is an individual-pick/value-analysis system. 100-daily-parlay generation is not a core product requirement.'))
check('master roadmap states active direction', roadmap.includes('Pick Analyzer MLB is an individual-pick/value-analysis system. 100-daily-parlay generation is not a core product requirement.'))
check('SportsDataIO not required', artifact.providerResponsibilityMatrix.SPORTSDATAIO_MLB_REQUIRED_BY_PICK2 === 'NO' && decision.includes('SPORTSDATAIO_MLB_REQUIRED_BY_PICK2 = NO'))
check('100 parlay objective retired', artifact.previousDirection.PICK_MLB_100_PARLAY_PRIMARY_OBJECTIVE_RETIRED === true && artifact.optionalParlayLayer.automatic100ParlaysAuthorized === false)
check('Official Picks selective', artifact.officialPicks.selective === true && artifact.officialPicks.fixedDailyCount === false && artifact.officialPicks.zeroOfficialPicksAllowed === true)
check('value sequence complete', artifact.valueContract.sequence.join(' -> ') === 'odds -> implied_probability -> no_vig_fair_probability -> model_probability -> edge -> expected_value -> value_score -> confidence -> recommendation_gate')
check('inventory includes retire and keep', artifact.roadmapGoalInventory.some((item) => item.classification === 'RETIRE') && artifact.roadmapGoalInventory.some((item) => item.classification === 'KEEP_USEFUL_FOR_PICK_ANALYSIS'))
check('foundation preserved', artifact.existingFoundation.rawRows === 712528 && artifact.existingFoundation.nativeGames === 2430 && artifact.existingFoundation.nativePlayers === 1469 && artifact.existingFoundation.featureSnapshots === 67433)
check('partial feature state preserved', artifact.existingFoundation.teamFeatureRows === 4498 && artifact.existingFoundation.starterFeatureRows === 4498 && artifact.existingFoundation.bullpenFeatureRows === 0 && artifact.existingFoundation.batterFeatureRows === 0)
check('model/prediction zero state', artifact.existingFoundation.modelRows === 0 && artifact.existingFoundation.champion === 'NONE' && artifact.existingFoundation.predictionRows === 0)
check('production readback pass', artifact.productionStateReadback.PICK_MLB_REALIGNMENT_PRODUCTION_STATE === 'PASS' && artifact.productionStateReadback.productionCommit === 'b9bc7e9fd0544b2cc5681af86bb5d3f6fd2862ba')
check('safety zero', artifact.safety.repositoryOnly === true && artifact.safety.providerCalls === 0 && artifact.safety.productionDmlMutations === 0 && artifact.safety.productionDdlMutations === 0 && artifact.safety.featureDml === 0 && artifact.safety.predictionWrites === 0 && artifact.safety.import2026 === 'NO' && artifact.safety.automation === 'NO' && artifact.safety.cronChanges === 0)
check('model objective not parlay volume', artifact.modelObjective.notObjective === 'daily parlay count')
check('new phase sequence defers parlay', artifact.newPhaseSequence.at(-1) === 'MLB_PRODUCT_04_OPTIONAL_USER_SELECTED_PARLAY_ANALYSIS')

if (errors.length) {
  console.error(JSON.stringify({ validator: 'pick-analyzer-mlb-roadmap-realignment-v1-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'pick-analyzer-mlb-roadmap-realignment-v1-validate',
    status: 'PASS',
    classification: artifact.certificationVerdict,
    decisionPath,
  }, null, 2))
}
