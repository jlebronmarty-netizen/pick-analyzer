import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const artifactPath = path.join(root, 'docs/CERTIFICATION/mlb-data-01c-r4b-exact-identity-edge-recovery-plan.json')
const docPath = path.join(root, 'docs/CERTIFICATION/MLB_DATA_01C_R4B_EXACT_IDENTITY_EDGE_RECOVERY_PLAN.md')
const scriptPath = path.join(root, 'scripts/mlb-data-01c-r4b-exact-identity-edge-recovery-plan.mjs')
const statusPath = path.join(root, 'docs/PROJECT_STATUS.md')
const roadmapPath = path.join(root, 'docs/MASTER_ROADMAP.md')
const errors = []

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8')
}

function json(filePath) {
  return JSON.parse(read(filePath))
}

function check(label, condition, details = '') {
  if (!condition) errors.push(`${label}${details ? `: ${details}` : ''}`)
}

const artifact = json(artifactPath)
const doc = read(docPath)
const script = read(scriptPath)
const status = read(statusPath)
const roadmap = read(roadmapPath)

check('R4B verdict certified', artifact.certificationVerdict === 'MLB_DATA_01C_R4B_EXACT_IDENTITY_EDGE_RECOVERY_PLAN_CERTIFIED')
check('target commit preserved', artifact.targetCommit === 'b0bbe27fa28e6b685db46745a96422f47ff0dc34')
check('baseline stable', artifact.flags.R4B_BASELINE_STABLE === 'YES' && artifact.baseline.rawRows === 712528 && artifact.baseline.uniquePitchIdentities === 712528 && artifact.baseline.duplicatePitchIdentities === 0)
check('team mapping complete', artifact.baseline.teamMappingComplete === true && artifact.baseline.canonicalHomeRows === 712528 && artifact.baseline.canonicalAwayRows === 712528)
check('raw canonical mappings still empty', artifact.baseline.eventRowsMapped === 0 && artifact.baseline.pitcherRowsMapped === 0 && artifact.baseline.batterRowsMapped === 0)
check('feature/model/prediction still empty', artifact.baseline.featureRows === 0 && artifact.baseline.modelRows === 0 && artifact.baseline.gamePredictions === 0 && artifact.baseline.predictionResults === 0 && artifact.baseline.marketValueEvaluations === 0)
check('2026 isolated', artifact.baseline.imported2026Rows === 0)
check('seven event gaps preserved', artifact.flags.R4B_EVENT_7_BASELINE_PRESERVED === 'YES' && artifact.eventGaps.count === 7 && artifact.eventGaps.missingEdgeTypes.length === 7)
check('event missing edge types explicit', artifact.eventGaps.missingEdgeTypes.every((gap) => gap.missingEdgeType === 'DOUBLEHEADER_GAME_NUMBER_EDGE_MISSING' && gap.minimumExactEdgeRequired.includes('MLB game_pk')))
check('event source matrix complete enough', artifact.eventGaps.sourceMatrix.length >= 6 && artifact.eventGaps.sourceMatrix.some((source) => source.sourceName.includes('SportsDataIO')))
check('seven-event recovery plan ready', artifact.flags.R4B_EVENT_EDGE_RECOVERY_PLAN_READY === 'YES' && artifact.eventGaps.recoveryPlan.length === 7)
check('event provider requirement explicit', artifact.flags.EVENT_EDGE_PROVIDER_CALLS_REQUIRED === 'YES' && artifact.eventGaps.eventProviderCallRequirement.executedNow === false)
check('player negative proof accepted', artifact.flags.R4B_R4A_PLAYER_NEGATIVE_PROOF_ACCEPTED === 'YES' && artifact.playerGaps.existingPlayerGapCount === 1292 && artifact.playerGaps.exactProviderPaths === 0 && artifact.playerGaps.nameAuditOnlyCount === 1292)
check('acceptable player edge contract ready', artifact.flags.R4B_ACCEPTABLE_PLAYER_EDGE_CONTRACT_READY === 'YES' && artifact.playerGaps.acceptableExactPlayerEdgeContract.forbidden.includes('fuzzy score'))
check('player source matrix complete enough', artifact.playerGaps.sourceMatrix.length >= 6 && artifact.playerGaps.sourceMatrix.some((source) => source.sourceName.includes('SportsDataIO')))
check('MLB official no direct current canonical edge', artifact.flags.MLB_OFFICIAL_DIRECT_TO_CURRENT_CANONICAL_EDGE_AVAILABLE === 'NO')
check('SportsDataIO classified as bounded probe', artifact.flags.SPORTSDATAIO_MLBAM_CROSSWALK_CAPABILITY === 'REQUIRES_BOUNDED_PROBE')
check('local exact crosswalk unavailable', artifact.flags.LOCAL_EXACT_PLAYER_CROSSWALK_SOURCE_AVAILABLE === 'NO')
check('player recovery projection sums to 1292', Object.values(artifact.playerGaps.recoveryProjection).filter((value) => typeof value === 'number').reduce((sum, value) => sum + value, 0) === 1292)
check('player provider calls required but not executed', artifact.flags.PLAYER_EDGE_PROVIDER_CALLS_REQUIRED === 'YES' && artifact.playerGaps.playerProviderCallRequirement.executedNow === false)
check('ambiguous player plan ready', artifact.flags.R4B_AMBIGUOUS_PLAYER_EDGE_RECOVERY_PLAN_READY === 'YES' && artifact.playerGaps.ambiguousPlayerEvidenceRequirements.length === 16)
check('safe create set preserved', artifact.flags.R4B_SAFE_PLAYER_CREATE_SET === 'PRESERVED' && artifact.playerGaps.safePlayerCreateSet.trueCanonicalMissing === 161 && artifact.playerGaps.safePlayerCreateSet.noNameMatchingPerformed === true)
check('minimum external acquisition plan ready', artifact.flags.R4B_MINIMUM_EXTERNAL_EDGE_ACQUISITION_PLAN_READY === 'YES')
check('call budget explicit', artifact.flags.R4B_PLANNED_EVENT_CALLS === '0_TO_7' && artifact.flags.R4B_PLANNED_PLAYER_CALLS === 1 && artifact.flags.R4B_PLANNED_TOTAL_CALLS === '1_TO_8')
check('architecture path explicit', artifact.flags.R4B_RECOMMENDED_IDENTITY_RECOVERY_PATH === 'PATH_A_EXTERNAL_EXACT_EDGE_ACQUISITION' && artifact.architectureDecision.recommendedR4CPhase === 'MLB_DATA_01C_R4C_EXTERNAL_EXACT_EDGE_ACQUISITION')
check('namespace fallback feasible', artifact.flags.PICK2_MLBAM_ROOTED_PLAYER_NAMESPACE_FEASIBLE === 'YES' && artifact.flags.PICK2_GAMEPK_ROOTED_EVENT_FALLBACK_FEASIBLE === 'YES')
check('R5 remains blocked', artifact.flags.MLB_DATA_01C_R5_PERSISTENCE_READY === 'NO' && artifact.readiness.MLB_DATA_01C_R5_PERSISTENCE_READY === 'NO')
check('01D remains blocked', artifact.flags.MLB_DATA_01D_2025_FEATURE_BUILD_READY === 'NO' && artifact.readiness.MLB_DATA_01D_2025_FEATURE_BUILD_READY === 'NO' && artifact.readiness.MLB_DATA_01D_PROJECTED_READY_AFTER_R5 === 'NO')
check('reuse ready', artifact.flags.R4B_RECOVERY_REUSABLE_FOR_2026 === 'YES' && artifact.flags.R4B_RECOVERY_REUSABLE_FOR_DAILY_INGEST === 'YES')
check('zero provider calls', artifact.safety.providerCalls === 0 && artifact.evidence.providerCalls === 0)
check('zero production mutations', artifact.safety.productionDmlMutations === 0 && artifact.safety.productionSchemaMutations === 0)
check('zero writes', artifact.safety.crosswalkWrites === 0 && artifact.safety.canonicalInserts === 0 && artifact.safety.rawMappingWrites === 0 && artifact.safety.featureWrites === 0 && artifact.safety.modelWrites === 0 && artifact.safety.predictionWrites === 0 && artifact.safety.imports2026 === 0)
check('automation untouched', artifact.safety.automationActivated === false && artifact.safety.cronChanges === 0)
check('script has no provider fetch', !script.includes('fetch(') && !script.includes('statsapi.mlb.com') && !script.includes('api.sportsdata.io'))
check('script avoids production mutation APIs', !/\.(insert|upsert|delete)\s*\(/.test(script) && !/\.from\([^)]*\)[\s\S]{0,300}\.update\s*\(/.test(script))
check('doc includes verdict', doc.includes(artifact.certificationVerdict))
check('status updated', status.includes('MLB-DATA-01C-R4B') && status.includes(artifact.certificationVerdict))
check('roadmap updated', roadmap.includes('MLB-DATA-01C-R4B') && roadmap.includes(artifact.certificationVerdict))

const secretPattern = /(SUPABASE_SERVICE_ROLE_KEY\s*=|CRON_SECRET\s*=|Bearer\s+[A-Za-z0-9._-]+|eyJ[A-Za-z0-9._-]{20,}|SPORTSDATAIO_MLB_API_KEY\s*=\s*\S+)/
for (const [label, content] of [
  ['artifact', JSON.stringify(artifact)],
  ['doc', doc],
  ['script', script],
  ['status', status],
  ['roadmap', roadmap],
]) {
  check(`${label} contains no obvious secret material`, !secretPattern.test(content))
}

if (errors.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-01c-r4b-exact-identity-edge-recovery-plan-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-01c-r4b-exact-identity-edge-recovery-plan-validate',
    status: 'PASS',
    certificationVerdict: artifact.certificationVerdict,
    eventGaps: artifact.eventGaps.count,
    playerGaps: artifact.playerGaps.existingPlayerGapCount,
    sportsDataIoMlbamCrosswalkCapability: artifact.flags.SPORTSDATAIO_MLBAM_CROSSWALK_CAPABILITY,
    recommendedR4CPhase: artifact.architectureDecision.recommendedR4CPhase,
    r5Ready: artifact.readiness.MLB_DATA_01C_R5_PERSISTENCE_READY,
    providerCalls: artifact.safety.providerCalls,
    productionDmlMutations: artifact.safety.productionDmlMutations,
  }, null, 2))
}
