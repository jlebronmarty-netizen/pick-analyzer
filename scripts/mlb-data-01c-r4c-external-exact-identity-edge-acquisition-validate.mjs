import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const artifactPath = path.join(root, 'docs/CERTIFICATION/mlb-data-01c-r4c-external-exact-identity-edge-acquisition.json')
const docPath = path.join(root, 'docs/CERTIFICATION/MLB_DATA_01C_R4C_EXTERNAL_EXACT_IDENTITY_EDGE_ACQUISITION.md')
const scriptPath = path.join(root, 'scripts/mlb-data-01c-r4c-external-exact-identity-edge-acquisition.mjs')
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
const gameCounts = artifact.finalGameClassification.counts
const playerCounts = artifact.finalPlayerClassification.counts
const gameSum = Object.values(gameCounts).reduce((sum, value) => sum + value, 0)
const playerSum = Object.values(playerCounts).reduce((sum, value) => sum + value, 0)

check('recognized verdict', [
  'MLB_DATA_01C_R4C_EXTERNAL_EXACT_EDGE_ACQUISITION_CERTIFIED',
  'MLB_DATA_01C_R4C_PICK2_MLBAM_NAMESPACE_REQUIRED',
  'MLB_DATA_01C_R4C_EXTERNAL_EDGE_ACQUISITION_PARTIAL',
  'MLB_DATA_01C_R4C_EXTERNAL_EDGE_ACQUISITION_BLOCKED',
].includes(artifact.certificationVerdict))
check('target commit preserved', artifact.targetCommit === '0ac505d0303c67b76cf6fd467514b3b3f5136b98')
check('baseline stable', artifact.flags.R4C_PRE_ACQUISITION_BASELINE === 'PASS' && artifact.baseline.rawRows === 712528 && artifact.baseline.uniquePitchIdentities === 712528 && artifact.baseline.duplicatePitchIdentities === 0)
check('team mapping preserved', artifact.baseline.canonicalHomeRows === 712528 && artifact.baseline.canonicalAwayRows === 712528)
check('raw canonical mappings empty', artifact.baseline.eventRowsMapped === 0 && artifact.baseline.pitcherRowsMapped === 0 && artifact.baseline.batterRowsMapped === 0)
check('feature/model/prediction empty', artifact.baseline.featureRows === 0 && artifact.baseline.modelRows === 0 && artifact.baseline.gamePredictions === 0 && artifact.baseline.predictionResults === 0 && artifact.baseline.marketValueEvaluations === 0)
check('2026 isolated', artifact.baseline.imported2026Rows === 0)
check('player endpoint contract discovered', artifact.flags.SPORTSDATAIO_PLAYER_ENDPOINT_CONTRACT_DISCOVERED === 'YES')
check('player probe single call', artifact.playerProbe.executed === true && artifact.providerAccounting.sportsDataIoPlayerCalls === 1)
check('player field inventory present', Array.isArray(artifact.playerProbe.fieldInventory) && artifact.playerProbe.fieldInventory.length > 0)
check('player MLBAM field flag consistent', ['YES', 'NO'].includes(artifact.flags.SPORTSDATAIO_EXACT_MLBAM_FIELD_PRESENT))
check('player contract flag consistent', ['YES', 'NO'].includes(artifact.flags.SPORTSDATAIO_MLBAM_FIELD_CONTRACT_CERTIFIED))
check('player dry-run sums', Object.values(artifact.playerDryRun.mlbamToSportsDataIoPlayerIdCoverage).reduce((sum, value) => sum + value, 0) === 1469)
check('1292 result sums', artifact.playerDryRun.existing1292.exactCanonicalLinksRecovered + artifact.playerDryRun.existing1292.remainingNoExactPath + artifact.playerDryRun.existing1292.multiplePaths === 1292)
check('16 ambiguous result sums', artifact.playerDryRun.ambiguous16.resolvedExactly + artifact.playerDryRun.ambiguous16.remainingAmbiguous === 16)
check('safe create bounded', artifact.playerDryRun.safeCreateSet.preservedSafeCreateCount >= 0 && artifact.playerDryRun.safeCreateSet.preservedSafeCreateCount <= 161)
check('player conflicts nonnegative', artifact.flags.PROJECTED_PLAYER_CROSSWALK_CONFLICTS >= 0)
check('event input exact', artifact.eventAcquisition.inputCount === 7 && artifact.eventAcquisition.gamePks.length === 7)
check('event calls within cap', artifact.providerAccounting.sportsDataIoEventCalls >= 0 && artifact.providerAccounting.sportsDataIoEventCalls <= 7)
check('event counts bounded', Object.values(artifact.eventAcquisition.counts).reduce((sum, value) => sum + value, 0) === 7)
check('event conflicts nonnegative', artifact.flags.PROJECTED_EVENT_CROSSWALK_CONFLICTS >= 0)
check('final game count sums to 2430', gameSum === 2430 && artifact.finalGameClassification.countSum === 2430)
check('final player count sums to 1469', playerSum === 1469 && artifact.finalPlayerClassification.countSum === 1469)
check('game repair flag consistent', artifact.flags.R4C_GAME_REPAIR_PROJECTED_COMPLETE === (gameCounts.REMAINS_UNMAPPED === 0 && gameCounts.REMAINS_AMBIGUOUS === 0 && gameCounts.CONFLICT === 0 ? 'YES' : 'NO'))
check('player repair flag consistent', artifact.flags.R4C_PLAYER_REPAIR_PROJECTED_COMPLETE === (playerCounts.REMAINS_UNMAPPED === 0 && playerCounts.REMAINS_AMBIGUOUS === 0 && playerCounts.CONFLICT === 0 ? 'YES' : 'NO'))
check('R5 readiness conservative', artifact.flags.MLB_DATA_01C_R5_PERSISTENCE_READY === artifact.readiness.MLB_DATA_01C_R5_PERSISTENCE_READY)
check('01D actual not ready', artifact.flags.MLB_DATA_01D_2025_FEATURE_BUILD_READY === 'NO' && artifact.readiness.MLB_DATA_01D_2025_FEATURE_BUILD_READY === 'NO')
check('reuse ready', artifact.flags.R4C_RECOVERY_REUSABLE_FOR_2026 === 'YES' && artifact.flags.R4C_RECOVERY_REUSABLE_FOR_DAILY_INGEST === 'YES')
check('call cap respected', artifact.providerAccounting.totalProviderCalls <= 8 && artifact.providerAccounting.totalProviderCalls === artifact.providerAccounting.sportsDataIoPlayerCalls + artifact.providerAccounting.sportsDataIoEventCalls + artifact.providerAccounting.mlbOfficialEventCalls)
check('other providers zero', artifact.providerAccounting.otherProviderCalls === 0)
check('zero production mutations', artifact.safety.productionDmlMutations === 0 && artifact.safety.productionSchemaMutations === 0)
check('zero writes', artifact.safety.crosswalkWrites === 0 && artifact.safety.canonicalEventInserts === 0 && artifact.safety.canonicalPlayerInserts === 0 && artifact.safety.rawMappingWrites === 0 && artifact.safety.featureWrites === 0 && artifact.safety.modelWrites === 0 && artifact.safety.predictionWrites === 0 && artifact.safety.imports2026 === 0)
check('automation untouched', artifact.safety.automationActivated === false && artifact.safety.activeCronAdded === false)
check('script contains provider fetch but no persistence writes', script.includes('fetch(') && !/\.(insert|upsert|delete)\s*\(/.test(script) && !/\.from\([^)]*\)[\s\S]{0,300}\.update\s*\(/.test(script))
check('doc includes verdict', doc.includes(artifact.certificationVerdict))
check('status updated', status.includes('MLB-DATA-01C-R4C') && status.includes(artifact.certificationVerdict))
check('roadmap updated', roadmap.includes('MLB-DATA-01C-R4C') && roadmap.includes(artifact.certificationVerdict))

const sensitiveNames = [
  ['SUPABASE', 'SERVICE', 'ROLE', 'KEY'].join('_'),
  ['CRON', 'SECRET'].join('_'),
  ['SPORTSDATAIO', 'MLB', 'API', 'KEY'].join('_'),
]
const sensitiveHeader = ['Ocp', 'Apim', 'Subscription', 'Key'].join('-')
const secretPattern = new RegExp(`(${sensitiveNames.join('|')})\\s*=|Bearer\\s+[A-Za-z0-9._-]+|eyJ[A-Za-z0-9._-]{20,}|${sensitiveHeader}:\\s*\\S+`)
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
  console.error(JSON.stringify({ validator: 'mlb-data-01c-r4c-external-exact-identity-edge-acquisition-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-01c-r4c-external-exact-identity-edge-acquisition-validate',
    status: 'PASS',
    certificationVerdict: artifact.certificationVerdict,
    exactMlbamFieldPresent: artifact.flags.SPORTSDATAIO_EXACT_MLBAM_FIELD_PRESENT,
    playerExactLinksRecovered: artifact.playerDryRun.existing1292.exactCanonicalLinksRecovered,
    eventExactEdgesRecovered: artifact.eventAcquisition.counts.recoveredExistingCanonicalEvents,
    r5Ready: artifact.readiness.MLB_DATA_01C_R5_PERSISTENCE_READY,
    providerCalls: artifact.providerAccounting.totalProviderCalls,
    productionDmlMutations: artifact.safety.productionDmlMutations,
  }, null, 2))
}
