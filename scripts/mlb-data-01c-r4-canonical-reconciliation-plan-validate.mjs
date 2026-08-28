import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const artifactPath = path.join(root, 'docs/CERTIFICATION/mlb-data-01c-r4-canonical-reconciliation-plan.json')
const docPath = path.join(root, 'docs/CERTIFICATION/MLB_DATA_01C_R4_CANONICAL_RECONCILIATION_PLAN.md')
const scriptPath = path.join(root, 'scripts/mlb-data-01c-r4-canonical-reconciliation-plan.mjs')
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

check('recognized R4 verdict', [
  'MLB_DATA_01C_R4_CANONICAL_RECONCILIATION_PLAN_CERTIFIED',
  'MLB_DATA_01C_R4_CANONICAL_RECONCILIATION_PLAN_PARTIAL',
  'MLB_DATA_01C_R4_CANONICAL_RECONCILIATION_BLOCKED',
].includes(artifact.certificationVerdict))
check('baseline target preserved', artifact.targetBaselineCommit === '040a57c9bde7daa0ebcdd6771d6ab97b1e6c5b65')
check('R3 official evidence loaded', artifact.r3Evidence.officialExactGamePkCoverage === 2430 && artifact.r3Evidence.officialPlayerIdsFound === 1469)
check('R3 cache coverage loaded', artifact.r3Evidence.cacheGameIdentities === 2430 && artifact.r3Evidence.cachePlayerIdentities === 1469)
check('raw stable', artifact.baseline.rawRows === 712528 && artifact.baseline.uniquePitchIdentities === 712528 && artifact.baseline.duplicatePitchIdentities === 0)
check('game/team counts stable', artifact.baseline.games === 2430 && artifact.baseline.teams === 30)
check('team mapping complete', artifact.baseline.canonicalHomeRows === 712528 && artifact.baseline.canonicalAwayRows === 712528)
check('raw mapping still empty', artifact.baseline.eventRowsMapped === 0 && artifact.baseline.pitcherRowsMapped === 0 && artifact.baseline.batterRowsMapped === 0)
check('feature/model/prediction still empty', artifact.baseline.featureRows === 0 && artifact.baseline.modelRows === 0 && artifact.baseline.gamePredictions === 0 && artifact.baseline.predictionResults === 0 && artifact.baseline.marketValueEvaluations === 0)
check('2026 isolated', artifact.baseline.imported2026Rows === 0)
check('event inventory exact', artifact.eventGap.inventoryReady === true && artifact.eventGap.count === 614 && artifact.eventGap.inventory.length === 614)
check('event root cause accounted', artifact.eventGap.rootCauseAccountedFor === true && Object.values(artifact.eventGap.rootCauseCounts).reduce((a, b) => a + b, 0) === 614)
check('event salvage counted', artifact.eventGap.salvage.existingCanonicalEventSalvageCount >= 0)
check('event creation count bounded', artifact.eventGap.canonicalEventCreationRequiredCount >= 0 && artifact.eventGap.canonicalEventCreationRequiredCount <= 614)
check('event creation policy ready', artifact.eventGap.creationPolicy.ready === true)
check('event projection complete only if no gaps', artifact.eventProjection.GAME_CANONICAL_REPAIR_PROJECTED_COMPLETE === (artifact.eventProjection.projectedMapped === 2430 && artifact.eventProjection.projectedUnmapped === 0 && artifact.eventProjection.projectedAmbiguous === 0 && artifact.eventProjection.projectedConflict === 0 ? 'YES' : 'NO'))
check('existing player inventory ready', artifact.playerGap.existingPlayerGapInventoryReady === true && artifact.playerGap.existingPlayerGapCount === 1292)
check('ambiguous player audit ready', artifact.playerGap.ambiguousPlayerRepairPlanReady === true && artifact.playerGap.ambiguousPlayerCount === 16 && artifact.playerGap.ambiguousPlayers.length === 16)
check('missing player audit bounded', artifact.playerGap.missingPlayerCount === 161 && artifact.playerGap.missingPlayers.length === 161)
check('player creation count recomputed', artifact.playerGap.canonicalPlayerCreationRequiredCountR4 === artifact.playerGap.missingPlayerCount)
check('player creation contract ready', artifact.playerGap.creationContract.ready === true)
check('existing player link contract ready', artifact.playerGap.existingPlayerLinkContract.ready === true)
check('player projection complete only if no gaps', artifact.playerProjection.PLAYER_CANONICAL_REPAIR_PROJECTED_COMPLETE === (artifact.playerProjection.projectedUniquePlayersMapped === 1469 && artifact.playerProjection.remainingUnmapped === 0 && artifact.playerProjection.remainingAmbiguous === 0 && artifact.playerProjection.remainingConflict === 0 ? 'YES' : 'NO'))
check('crosswalk contract ready', artifact.contracts.providerEntityMappings.ready === true)
check('crosswalk conflict plan ready', artifact.contracts.crosswalkGlobalConflictPlan.ready === true)
check('raw mapping contract ready', artifact.contracts.rawMapping.ready === true)
check('raw immutability contract ready', artifact.contracts.rawImmutability.ready === true)
check('idempotency contract ready', artifact.contracts.idempotency.ready === true)
check('repair order certified', artifact.contracts.repairOrder.ready === true && artifact.contracts.repairOrder.steps.length === 14)
check('write caps ready', artifact.writeCaps.EVENT_REPAIR_WRITE_CAP_READY === true && artifact.writeCaps.PLAYER_REPAIR_WRITE_CAP_READY === true)
check('feature dependency matrix ready', artifact.featureDependencyMatrix.ready === true)
check('01D remains not ready', artifact.readiness.MLB_DATA_01D_2025_FEATURE_BUILD_READY === 'NO')
check('reuse ready', artifact.reuse.R4_REPAIR_REUSABLE_FOR_2026 === 'YES' && artifact.reuse.R4_REPAIR_REUSABLE_FOR_DAILY_INGEST === 'YES')
check('provider calls zero', artifact.safety.providerCalls === 0 && artifact.flags.PROVIDER_CALLS === '0')
check('production mutations zero', artifact.safety.productionDmlMutations === 0 && artifact.safety.productionSchemaMutations === 0)
check('all writes zero', artifact.safety.canonicalEventInserts === 0 && artifact.safety.canonicalPlayerInserts === 0 && artifact.safety.crosswalkWrites === 0 && artifact.safety.rawMappingWrites === 0 && artifact.safety.featureWrites === 0 && artifact.safety.modelWrites === 0 && artifact.safety.predictionWrites === 0)
check('automation untouched', artifact.safety.automationActivated === false && artifact.safety.activeCronAdded === false)
check('script has no provider fetch', !script.includes('fetch(') && !script.includes('statsapi.mlb.com'))
check('script avoids production mutations', !/\.(insert|upsert|delete)\s*\(/.test(script) && !/\.from\([^)]*\)[\s\S]{0,300}\.update\s*\(/.test(script))
check('doc includes verdict', doc.includes(artifact.certificationVerdict))
check('status updated', status.includes('MLB-DATA-01C-R4') && status.includes(artifact.certificationVerdict))
check('roadmap updated', roadmap.includes('MLB-DATA-01C-R4') && roadmap.includes(artifact.certificationVerdict))

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
  console.error(JSON.stringify({ validator: 'mlb-data-01c-r4-canonical-reconciliation-plan-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-01c-r4-canonical-reconciliation-plan-validate',
    status: 'PASS',
    certificationVerdict: artifact.certificationVerdict,
    eventGapCount: artifact.eventGap.count,
    existingEventSalvageCount: artifact.eventGap.salvage.existingCanonicalEventSalvageCount,
    canonicalEventCreationRequiredCount: artifact.eventGap.canonicalEventCreationRequiredCount,
    canonicalPlayerCreationRequiredCountR4: artifact.playerGap.canonicalPlayerCreationRequiredCountR4,
    providerCalls: artifact.safety.providerCalls,
    productionDmlMutations: artifact.safety.productionDmlMutations,
  }, null, 2))
}
