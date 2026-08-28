import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const artifactPath = path.join(root, 'docs/CERTIFICATION/mlb-data-01c-r1-identity-repair-audit.json')
const docPath = path.join(root, 'docs/CERTIFICATION/MLB_DATA_01C_R1_IDENTITY_REPAIR_AUDIT.md')
const auditScriptPath = path.join(root, 'scripts/mlb-data-01c-r1-identity-repair-audit.mjs')
const statusPath = path.join(root, 'docs/PROJECT_STATUS.md')
const roadmapPath = path.join(root, 'docs/MASTER_ROADMAP.md')

const errors = []

function check(label, condition, details = '') {
  if (!condition) errors.push(`${label}${details ? `: ${details}` : ''}`)
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8')
}

function json(filePath) {
  return JSON.parse(read(filePath))
}

const artifact = json(artifactPath)
const doc = read(docPath)
const auditScript = read(auditScriptPath)
const executableAuditScript = auditScript.split('\n/*')[0] ?? auditScript
const status = read(statusPath)
const roadmap = read(roadmapPath)

check('verdict is external id gap', artifact.certificationVerdict === 'MLB_DATA_01C_R1_IDENTITY_REPAIR_EXTERNAL_ID_GAP')
check('certified flag is no', artifact.flags.MLB_DATA_01C_R1_CANONICAL_IDENTITY_REPAIR_CERTIFIED === 'NO')
check('migration ready flag is no', artifact.flags.MLB_DATA_01C_R1_IDENTITY_REPAIR_MIGRATION_READY === 'NO')
check('external id gap flag is yes', artifact.flags.MLB_DATA_01C_R1_IDENTITY_REPAIR_EXTERNAL_ID_GAP === 'YES')
check('01D remains blocked', artifact.flags.MLB_DATA_01D_2025_FEATURE_BUILD_READY === 'NO' && artifact.downstreamGates.MLB_DATA_01D_2025_FEATURE_BUILD_READY === false)

check('provider calls remain zero', artifact.productionSafety.providerCallsMade === 0)
check('production DML remains zero', artifact.productionSafety.productionDmlMutations === 0)
check('production schema mutations remain zero', artifact.productionSafety.productionSchemaMutations === 0)
check('automation unchanged', artifact.productionSafety.automationChanged === false && artifact.productionSafety.cronChanged === false)
check('raw identities preserved', artifact.productionSafety.rawPayloadRewritten === false && artifact.productionSafety.sourceIdsRewritten === false)
check('no fuzzy or guessed matching', artifact.productionSafety.fuzzyMatchingUsed === false && artifact.productionSafety.guessedIdentitiesUsed === false)

check('raw rows stable', artifact.statcastSourceInventory.rows === 712528 && artifact.productionReadback.rawRows === 712528)
check('source games stable', artifact.statcastSourceInventory.games === 2430 && artifact.eventIdentityAudit.sourceGamePkCount === 2430)
check('source teams stable', artifact.statcastSourceInventory.teams === 30)
check('pitch identity stable', artifact.statcastSourceInventory.duplicatePitchIdentities === 0 && artifact.statcastSourceInventory.nullPitchIdentities === 0)
check('team mapping remains complete', artifact.productionReadback.canonicalHomeRows === 712528 && artifact.productionReadback.canonicalAwayRows === 712528)
check('event/player mappings remain unwritten', artifact.productionReadback.eventRowsMapped === 0 && artifact.productionReadback.pitcherRowsMapped === 0 && artifact.productionReadback.batterRowsMapped === 0)
check('2026 import remains absent', artifact.productionReadback.imported2026Rows === 0)

check('canonical event inventory stable', artifact.eventIdentityAudit.canonicalMlb2025EventRows === 2462)
check('canonical date-home-away identity inventory stable', artifact.eventIdentityAudit.canonicalDateHomeAwayIdentities === 2175)
check('canonical duplicate/excess event rows derived', artifact.eventIdentityAudit.canonicalDuplicateOrExcessRows === 287)
check('event crosswalk partial', artifact.eventIdentityAudit.providerCrosswalkGamePkRowsFrom01C === 227)
check('exact gamePk absent on events', artifact.eventIdentityAudit.exactGamePkOnSportEventsAvailable === 0)
check('event dry-run mapped', artifact.eventIdentityAudit.dryRunCounts.MAPPED === 1816)
check('event dry-run unmapped', artifact.eventIdentityAudit.dryRunCounts.UNMAPPED === 305)
check('event dry-run ambiguous', artifact.eventIdentityAudit.dryRunCounts.AMBIGUOUS === 309)
check('event dry-run conflict free', artifact.eventIdentityAudit.dryRunCounts.CONFLICT === 0)
check('event date/team fallback only', artifact.eventIdentityAudit.dryRunMethodCounts.EXACT_DATE_HOME_AWAY === 1816 && artifact.eventIdentityAudit.dryRunMethodCounts.EXACT_GAMEPK === 0)
check('event crosswalk infrastructure ready', artifact.eventIdentityAudit.repairInfrastructure.durableCrosswalkTable === 'provider_entity_mappings')
check('event migration not required or applied', artifact.eventIdentityAudit.repairInfrastructure.migrationRequired === false && artifact.eventIdentityAudit.repairInfrastructure.migrationApplied === false)
check('event repair reusable', artifact.eventIdentityAudit.repairInfrastructure.reusableFor2026 === true && artifact.eventIdentityAudit.repairInfrastructure.reusableForDailyIngest === true)

check('player source count stable', artifact.playerIdentityAudit.sourceMlbamPlayerCount === 1469)
check('player role split stable', artifact.statcastSourceInventory.sourcePlayers.pitcherOnly === 796 && artifact.statcastSourceInventory.sourcePlayers.batterOnly === 596 && artifact.statcastSourceInventory.sourcePlayers.bothPitcherAndBatter === 77)
check('canonical player inventory stable', artifact.playerIdentityAudit.canonicalMlbPlayerRows === 7389)
check('player provider mapping inventory stable', artifact.playerIdentityAudit.providerMappingRows === 7567)
check('mlbam player crosswalk partial', artifact.playerIdentityAudit.mlbamProviderCrosswalkCount === 177)
check('mlbam not stored on player rows', artifact.playerIdentityAudit.mlbamStoredOnPlayerCount === 0)
check('player dry-run unmapped', artifact.playerIdentityAudit.dryRunCounts.MAPPED === 0 && artifact.playerIdentityAudit.dryRunCounts.UNMAPPED === 1469)
check('player dry-run safe states', artifact.playerIdentityAudit.dryRunCounts.AMBIGUOUS === 0 && artifact.playerIdentityAudit.dryRunCounts.CONFLICT === 0)
check('player row mapping absent', artifact.playerIdentityAudit.pitcherRowsMapped === 0 && artifact.playerIdentityAudit.batterRowsMapped === 0)
check('player crosswalk infrastructure ready', artifact.playerIdentityAudit.repairInfrastructure.durableCrosswalkTable === 'provider_entity_mappings')
check('player migration not required or applied', artifact.playerIdentityAudit.repairInfrastructure.migrationRequired === false && artifact.playerIdentityAudit.repairInfrastructure.migrationApplied === false)
check('player repair reusable', artifact.playerIdentityAudit.repairInfrastructure.reusableFor2026 === true && artifact.playerIdentityAudit.repairInfrastructure.reusableForDailyIngest === true)

check('feature/model/prediction rows absent', artifact.productionReadback.featureRows === 0 && artifact.productionReadback.modelRows === 0 && artifact.productionReadback.predictionRows === 0)
check('documentation names verdict', doc.includes('MLB_DATA_01C_R1_IDENTITY_REPAIR_EXTERNAL_ID_GAP'))
check('status updated', status.includes('MLB-DATA-01C-R1') && status.includes('MLB_DATA_01C_R1_IDENTITY_REPAIR_EXTERNAL_ID_GAP'))
check('roadmap updated', roadmap.includes('MLB-DATA-01C-R1') && roadmap.includes('MLB_DATA_01C_R1_IDENTITY_REPAIR_EXTERNAL_ID_GAP'))
check('audit script has no provider clients', !executableAuditScript.includes('fetch(') && !executableAuditScript.includes('axios') && !executableAuditScript.includes('sportsdataio') && !executableAuditScript.includes('the-odds-api'))
check('audit script has no writes to Supabase', !/\.(insert|upsert|delete)\s*\(/.test(executableAuditScript) && !/\.from\([^)]*\)[\s\S]{0,300}\.update\s*\(/.test(executableAuditScript))

const secretPattern = /(SUPABASE_SERVICE_ROLE_KEY\s*=\s*|CRON_SECRET\s*=\s*|Bearer\s+[A-Za-z0-9._-]+|eyJ[A-Za-z0-9._-]{20,})/
for (const [label, content] of [
  ['artifact', JSON.stringify(artifact)],
  ['doc', doc],
  ['audit script', executableAuditScript],
  ['status', status],
  ['roadmap', roadmap],
]) {
  check(`${label} contains no obvious secret material`, !secretPattern.test(content))
}

if (errors.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-01c-r1-identity-repair-audit-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-01c-r1-identity-repair-audit-validate',
    status: 'PASS',
    certificationVerdict: artifact.certificationVerdict,
    eventDryRun: artifact.eventIdentityAudit.dryRunCounts,
    playerDryRun: artifact.playerIdentityAudit.dryRunCounts,
    providerCallsMade: artifact.productionSafety.providerCallsMade,
  }, null, 2))
}
