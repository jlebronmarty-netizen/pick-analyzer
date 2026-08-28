import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const artifactPath = path.join(root, 'docs/CERTIFICATION/mlb-data-01c-r4a-deterministic-disambiguation-proof.json')
const docPath = path.join(root, 'docs/CERTIFICATION/MLB_DATA_01C_R4A_DETERMINISTIC_DISAMBIGUATION_PROOF.md')
const scriptPath = path.join(root, 'scripts/mlb-data-01c-r4a-deterministic-disambiguation-proof.mjs')
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
const status = fs.existsSync(statusPath) ? read(statusPath) : ''
const roadmap = fs.existsSync(roadmapPath) ? read(roadmapPath) : ''
const finalCounts = artifact.finalPlayerClassification.counts
const finalSum = Object.values(finalCounts).reduce((sum, value) => sum + value, 0)

check('recognized R4A verdict', [
  'MLB_DATA_01C_R4A_DETERMINISTIC_DISAMBIGUATION_CERTIFIED',
  'MLB_DATA_01C_R4A_DETERMINISTIC_DISAMBIGUATION_PARTIAL',
  'MLB_DATA_01C_R4A_DETERMINISTIC_DISAMBIGUATION_BLOCKED',
].includes(artifact.certificationVerdict))
check('target commit preserved', artifact.targetCommit === '5a4247cba4c9ff167bbbff3d07b887d88677479b')
check('alignment recorded', artifact.alignment.branch === 'main' && artifact.alignment.localHead === artifact.targetCommit && artifact.alignment.originHead === artifact.targetCommit && artifact.alignment.worktreeCleanAtPhaseStart === true)
check('official evidence reused', artifact.evidence.officialGamePkCoverage === 2430 && artifact.evidence.officialMlbamPersonIdCoverage === 1469 && artifact.evidence.noProviderReacquisition === true)
check('raw baseline stable', artifact.flags.R4A_RAW_BASELINE_STABLE === 'YES' && artifact.baseline.rawRows === 712528 && artifact.baseline.uniquePitchIdentities === 712528 && artifact.baseline.duplicatePitchIdentities === 0)
check('team mapping preserved', artifact.flags.R4A_TEAM_MAPPING_PRESERVED === 'YES' && artifact.teamMapping.canonicalHomeRows === 712528 && artifact.teamMapping.canonicalAwayRows === 712528 && artifact.teamMapping.teamWrites === 0)
check('seven event inventory exact', artifact.flags.R4A_EVENT_7_INVENTORY_READY === 'YES' && artifact.eventProof.inventory.length === 7)
check('event proof ready', artifact.flags.R4A_EVENT_IDENTITY_PROOF_READY === 'YES' && artifact.eventProof.proofReady === true)
check('event counts match', artifact.flags.R4A_EVENT_EXISTING_RESOLVED_COUNT === artifact.eventProof.existingResolvedCount && artifact.flags.R4A_EVENT_TRUE_MISSING_COUNT === artifact.eventProof.trueMissingCount && artifact.flags.R4A_EVENT_DISAMBIGUATION_REMAINING_COUNT === artifact.eventProof.remainingAmbiguousCount && artifact.flags.R4A_EVENT_CONFLICT_COUNT === artifact.eventProof.conflictCount)
check('game projection internally consistent', artifact.gameProjection.projectedMapped + artifact.gameProjection.remainingUnmapped === 2430)
check('no forbidden event proof methods certified', artifact.eventProof.inventory.every((entry) => entry.classification !== 'DETERMINISTIC_EXISTING_EVENT' || entry.deterministicEvidencePath.length >= 2))
check('player inventory complete', artifact.flags.R4A_PLAYER_IDENTITY_EDGE_INVENTORY_COMPLETE === 'YES' && artifact.playerProof.existingGapCount === 1292)
check('player graph ready', artifact.flags.R4A_EXACT_PLAYER_IDENTITY_GRAPH_READY === 'YES' && artifact.playerIdentityGraph.graphReady === true)
check('no forbidden player graph edges', artifact.playerIdentityGraph.forbiddenEdges.includes('name equality alone') && !artifact.playerIdentityGraph.exactEdges.some((edge) => String(edge.source?.field ?? '').toLowerCase().includes('name')))
check('existing player proof count matches', artifact.flags.R4A_EXISTING_PLAYER_LINK_PROOF_COUNT === artifact.playerProof.existingPlayerLinkProofCount)
check('canonical existence quality sums', Object.values(artifact.playerProof.canonicalExistenceProofQualityCounts).reduce((sum, value) => sum + value, 0) === 1292)
check('ambiguous inventory exact', artifact.ambiguousPlayerProof.inventoryReady === true && artifact.ambiguousPlayerProof.players.length === 16)
check('ambiguous proof ready', artifact.flags.R4A_AMBIGUOUS_PLAYER_PROOF_READY === 'YES')
check('ambiguous counts match', artifact.flags.R4A_AMBIGUOUS_PLAYER_RESOLVED_COUNT === artifact.ambiguousPlayerProof.resolvedExactCount && artifact.flags.R4A_AMBIGUOUS_PLAYER_REMAINING_COUNT === artifact.ambiguousPlayerProof.remainingCount && artifact.flags.R4A_AMBIGUOUS_PLAYER_CONFLICT_COUNT === artifact.ambiguousPlayerProof.conflictCount)
check('missing set revalidated', artifact.missingPlayerProof.previouslyMissingCount === 161 && artifact.flags.R4A_TRUE_CANONICAL_PLAYER_MISSING_COUNT === artifact.missingPlayerProof.trueMissingCount)
check('player creation inputs ready', artifact.flags.R4A_PLAYER_CREATION_INPUTS_READY === artifact.missingPlayerProof.playerCreationInputsReady)
check('final player classification sums to 1469', finalSum === 1469 && artifact.finalPlayerClassification.countSum === 1469)
check('projected player coverage consistent', artifact.playerProjection.mappedCount === (finalCounts.EXISTING_CANONICAL_EXACT_LINK ?? 0) + (finalCounts.SAFE_CANONICAL_CREATE ?? 0))
check('player repair flag consistent', artifact.flags.R4A_PLAYER_REPAIR_PROJECTED_COMPLETE === artifact.playerProjection.R4A_PLAYER_REPAIR_PROJECTED_COMPLETE)
check('mutation caps exact and consistent', artifact.mutationEnvelope.capsExact === true && artifact.flags.EVENT_INSERT_CAP === artifact.mutationEnvelope.EVENT_INSERT_CAP && artifact.flags.PLAYER_INSERT_CAP === artifact.mutationEnvelope.PLAYER_INSERT_CAP)
check('crosswalk conflicts match flags', artifact.flags.PROJECTED_EVENT_CROSSWALK_CONFLICTS === artifact.mutationEnvelope.PROJECTED_EVENT_CROSSWALK_CONFLICTS && artifact.flags.PROJECTED_PLAYER_CROSSWALK_CONFLICTS === artifact.mutationEnvelope.PROJECTED_PLAYER_CROSSWALK_CONFLICTS)
check('R5 readiness conservative', artifact.readiness.MLB_DATA_01C_R5_PERSISTENCE_READY === artifact.flags.MLB_DATA_01C_R5_PERSISTENCE_READY)
check('01D remains blocked', artifact.readiness.MLB_DATA_01D_2025_FEATURE_BUILD_READY === 'NO' && artifact.flags.MLB_DATA_01D_2025_FEATURE_BUILD_READY === 'NO')
check('reuse ready', artifact.flags.R4A_REUSABLE_FOR_2026 === 'YES' && artifact.flags.R4A_REUSABLE_FOR_DAILY_INGEST === 'YES')
check('zero provider calls', artifact.safety.providerCalls === 0 && artifact.evidence.providerCalls === 0)
check('zero production mutations', artifact.safety.productionDmlMutations === 0 && artifact.safety.productionSchemaMutations === 0)
check('zero writes', artifact.safety.canonicalEventInserts === 0 && artifact.safety.canonicalPlayerInserts === 0 && artifact.safety.crosswalkWrites === 0 && artifact.safety.rawMappingWrites === 0 && artifact.safety.featureWrites === 0 && artifact.safety.modelWrites === 0 && artifact.safety.predictionWrites === 0 && artifact.safety.imports2026 === 0)
check('automation untouched', artifact.safety.automationActivated === false && artifact.safety.activeCronAdded === false)
check('product isolated', artifact.productIsolation.featureTables === 0 && artifact.productIsolation.modelTables === 0 && artifact.productIsolation.champion === 'NONE' && artifact.productIsolation.predictions === 0 && artifact.productIsolation.predictionResults === 0 && artifact.productIsolation.marketValueEvaluations === 0)
check('script has no provider fetch', !script.includes('fetch(') && !script.includes('statsapi.mlb.com'))
check('script avoids production mutations', !/\.(insert|upsert|delete)\s*\(/.test(script) && !/\.from\([^)]*\)[\s\S]{0,300}\.update\s*\(/.test(script))
check('doc includes verdict', doc.includes(artifact.certificationVerdict))
check('status updated', status.includes('MLB-DATA-01C-R4A') && status.includes(artifact.certificationVerdict))
check('roadmap updated', roadmap.includes('MLB-DATA-01C-R4A') && roadmap.includes(artifact.certificationVerdict))

const successEligible = artifact.flags.R4A_GAME_REPAIR_PROJECTED_COMPLETE === 'YES' &&
  artifact.flags.R4A_PLAYER_REPAIR_PROJECTED_COMPLETE === 'YES' &&
  artifact.flags.PROJECTED_EVENT_CROSSWALK_CONFLICTS === 0 &&
  artifact.flags.PROJECTED_PLAYER_CROSSWALK_CONFLICTS === 0 &&
  artifact.flags.MLB_DATA_01C_R5_PERSISTENCE_READY === 'YES' &&
  artifact.flags.MLB_DATA_01D_PROJECTED_READY_AFTER_R5 === 'YES'
check('verdict matches success gates', successEligible
  ? artifact.certificationVerdict === 'MLB_DATA_01C_R4A_DETERMINISTIC_DISAMBIGUATION_CERTIFIED'
  : artifact.certificationVerdict === 'MLB_DATA_01C_R4A_DETERMINISTIC_DISAMBIGUATION_PARTIAL')

const secretPattern = /(SUPABASE_SERVICE_ROLE_KEY\s*=|CRON_SECRET\s*=|Bearer\s+[A-Za-z0-9._-]+|eyJ[A-Za-z0-9._-]{20,})/
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
  console.error(JSON.stringify({ validator: 'mlb-data-01c-r4a-deterministic-disambiguation-proof-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-01c-r4a-deterministic-disambiguation-proof-validate',
    status: 'PASS',
    certificationVerdict: artifact.certificationVerdict,
    eventExistingResolved: artifact.eventProof.existingResolvedCount,
    eventRemainingAmbiguous: artifact.eventProof.remainingAmbiguousCount,
    exactTransitivePlayerLinks: artifact.playerProof.exactTransitiveLinkCount,
    playerRemainingUnmapped: artifact.playerProjection.unmappedCount,
    playerRemainingAmbiguous: artifact.playerProjection.ambiguousCount,
    r5Ready: artifact.readiness.MLB_DATA_01C_R5_PERSISTENCE_READY,
    providerCalls: artifact.safety.providerCalls,
    productionDmlMutations: artifact.safety.productionDmlMutations,
  }, null, 2))
}
