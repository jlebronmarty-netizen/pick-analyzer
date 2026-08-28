import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const artifactPath = path.join(root, 'docs/CERTIFICATION/mlb-data-01c-r2-identity-acquisition-plan.json')
const docPath = path.join(root, 'docs/CERTIFICATION/MLB_DATA_01C_R2_IDENTITY_ACQUISITION_PLAN.md')
const plannerPath = path.join(root, 'scripts/mlb-data-01c-r2-identity-acquisition-plan.mjs')
const statusPath = path.join(root, 'docs/PROJECT_STATUS.md')
const roadmapPath = path.join(root, 'docs/MASTER_ROADMAP.md')
const errors = []

function check(label, condition, details = '') {
  if (!condition) errors.push(`${label}${details ? `: ${details}` : ''}`)
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8')
}

const artifact = JSON.parse(read(artifactPath))
const doc = read(docPath)
const planner = read(plannerPath)
const status = read(statusPath)
const roadmap = read(roadmapPath)
const supersededByR2a = artifact.r2aSupersession?.supersededBy === 'MLB_DATA_01C_R2A_MLB_OFFICIAL_PERSON_ENDPOINT_CERTIFIED'

check('R2 verdict/history is explicit', artifact.certificationVerdict === 'MLB_DATA_01C_R2_IDENTITY_ACQUISITION_PLAN_BLOCKED')
check('baseline commit target preserved', artifact.baselineCommit === 'b1b53d38fc4eb00bbb0a69ae862e0223108cd034')
check('plan only scope', artifact.scope.planOnly === true)
check('provider calls zero', artifact.scope.providerCallsMade === 0 && artifact.scope.mlbOfficialCallsMade === 0 && artifact.flags.PROVIDER_CALLS === '0')
check('production mutations zero', artifact.scope.productionDmlMutations === 0 && artifact.scope.productionSchemaMutations === 0)
check('mapping writes zero', artifact.scope.canonicalMappingWrites === 0)
check('automation untouched', artifact.scope.automationActivated === false && artifact.scope.activeCronAdded === false)

check('raw rows stable', artifact.baselineReadback.rawRows === 712528)
check('unique identities stable', artifact.baselineReadback.uniquePitchIdentities === 712528)
check('duplicates stable', artifact.baselineReadback.duplicateIdentities === 0)
check('game/team/date coverage stable', artifact.baselineReadback.games === 2430 && artifact.baselineReadback.teams === 30 && artifact.baselineReadback.minDate === '2025-03-18' && artifact.baselineReadback.maxDate === '2025-09-28')
check('team mapping preserved', artifact.baselineReadback.canonicalHomeRows === 712528 && artifact.baselineReadback.canonicalAwayRows === 712528)
check('event/player canonical writes absent', artifact.baselineReadback.eventRowsMapped === 0 && artifact.baselineReadback.pitcherRowsMapped === 0 && artifact.baselineReadback.batterRowsMapped === 0)
check('feature/model/prediction zero', artifact.baselineReadback.featureTables === 0 && artifact.baselineReadback.modelRegistry === 0 && artifact.baselineReadback.modelVersions === 0 && artifact.baselineReadback.gamePredictions === 0 && artifact.baselineReadback.predictionResults === 0 && artifact.baselineReadback.marketValueEvaluations === 0)
check('2026 isolated', artifact.baselineReadback.imported2026Rows === 0)

check('internal identity paths complete', artifact.flags.EXISTING_INTERNAL_IDENTITY_PATHS_COMPLETE === 'YES')
check('provider_entity_mappings contract reused', artifact.existingInternalIdentitySources.schema.providerEntityMappings.sufficientForCrosswalkInfrastructure === true)
check('event input inventory complete', artifact.flags.EVENT_IDENTITY_ACQUISITION_INPUT_READY === 'YES' && artifact.eventAcquisitionInput.entries.length === 2430)
check('event dry-run counts preserved', artifact.eventAcquisitionInput.counts.MAPPED === 1816 && artifact.eventAcquisitionInput.counts.UNMAPPED === 305 && artifact.eventAcquisitionInput.counts.AMBIGUOUS === 309 && artifact.eventAcquisitionInput.counts.CONFLICT === 0)
check('event canonical inventory preserved', artifact.eventAcquisitionInput.canonicalMlb2025EventRows === 2462 && artifact.eventAcquisitionInput.canonicalDateHomeAwayIdentities === 2175 && artifact.eventAcquisitionInput.canonicalDuplicateOrExcessDateHomeAwayRows === 287)
check('player input inventory complete', artifact.flags.PLAYER_IDENTITY_ACQUISITION_INPUT_READY === 'YES' && artifact.playerAcquisitionInput.entries.length === 1469)
check('player roles preserved', artifact.playerAcquisitionInput.roleCounts.pitcherOnly === 796 && artifact.playerAcquisitionInput.roleCounts.batterOnly === 596 && artifact.playerAcquisitionInput.roleCounts.both === 77)
check('player dry-run counts preserved', artifact.playerAcquisitionInput.counts.MAPPED === 0 && artifact.playerAcquisitionInput.counts.UNMAPPED === 1469 && artifact.playerAcquisitionInput.counts.AMBIGUOUS === 0 && artifact.playerAcquisitionInput.counts.CONFLICT === 0)
check('player canonical inventory preserved', artifact.playerAcquisitionInput.canonicalMlbPlayerRows === 7389 && artifact.playerAcquisitionInput.providerPlayerMappingRows === 7567 && artifact.playerAcquisitionInput.mlbamStoredOnPlayerRows === 0 && artifact.playerAcquisitionInput.mlbamProviderCrosswalkRows === 177)

check('authoritative source selected', artifact.flags.AUTHORITATIVE_IDENTITY_SOURCE_SELECTED === 'MLB Official / MLB Stats API')
check('endpoint contract gap explicit or superseded', supersededByR2a || (artifact.flags.NEEDS_ENDPOINT_CONTRACT_VERIFICATION === 'YES' && artifact.endpointRequestPlan.players.contractStatus === 'NEEDS_ENDPOINT_CONTRACT_VERIFICATION'))
check('game plan ready', artifact.flags.GAME_IDENTITY_ACQUISITION_PLAN_READY === 'YES')
check('player plan blocked safely or superseded ready', supersededByR2a ? artifact.flags.PLAYER_IDENTITY_ACQUISITION_PLAN_READY === 'YES' && artifact.authorizationGates.externalIdentityAcquisitionExecutionReady === true : artifact.flags.PLAYER_IDENTITY_ACQUISITION_PLAN_READY === 'NO' && artifact.authorizationGates.externalIdentityAcquisitionExecutionReady === false)
check('cache contract ready', artifact.flags.IDENTITY_ACQUISITION_CACHE_CONTRACT_READY === 'YES')
check('reconciliation contracts ready', artifact.flags.GAME_RECONCILIATION_CONTRACT_READY === 'YES' && artifact.flags.PLAYER_RECONCILIATION_CONTRACT_READY === 'YES')
check('player creation policy ready', artifact.flags.CANONICAL_PLAYER_CREATION_POLICY_READY === 'YES')
check('provider mapping write contract ready', artifact.flags.PROVIDER_ENTITY_MAPPINGS_WRITE_CONTRACT_READY === 'YES')
check('cardinality contracts ready', artifact.flags.GAME_CROSSWALK_CARDINALITY_CONTRACT_READY === 'YES' && artifact.flags.PLAYER_CROSSWALK_CARDINALITY_CONTRACT_READY === 'YES')
check('raw mapping plan ready', artifact.flags.RAW_CANONICAL_MAPPING_WRITE_PLAN_READY === 'YES')
check('completeness targets ready', artifact.flags.GAME_MAPPING_COMPLETENESS_TARGET_READY === 'YES' && artifact.flags.PLAYER_MAPPING_COMPLETENESS_TARGET_READY === 'YES')
check('reuse plans ready', artifact.flags.IDENTITY_ACQUISITION_PLAN_REUSABLE_FOR_2026 === 'YES' && artifact.flags.IDENTITY_ACQUISITION_PLAN_REUSABLE_FOR_DAILY_INGEST === 'YES')
check('crosswalk persistence not authorized', artifact.flags.CROSSWALK_PERSISTENCE_AUTHORIZED_NOW === 'NO')
check('01D blocked', artifact.flags.MLB_DATA_01D_2025_FEATURE_BUILD_READY === 'NO')

check('planner has no provider fetch', !planner.includes('fetch('))
check('planner has no supabase writes', !/\.(insert|upsert|delete)\s*\(/.test(planner) && !/\.from\([^)]*\)[\s\S]{0,300}\.update\s*\(/.test(planner))
check('doc includes verdict', doc.includes('MLB_DATA_01C_R2_IDENTITY_ACQUISITION_PLAN_BLOCKED'))
check('status updated', status.includes('MLB-DATA-01C-R2') && status.includes('NEEDS_ENDPOINT_CONTRACT_VERIFICATION'))
check('roadmap updated', roadmap.includes('MLB-DATA-01C-R2') && roadmap.includes('NEEDS_ENDPOINT_CONTRACT_VERIFICATION'))

const secretPattern = /(SUPABASE_SERVICE_ROLE_KEY\s*=|CRON_SECRET\s*=|Bearer\s+[A-Za-z0-9._-]+|eyJ[A-Za-z0-9._-]{20,})/
for (const [label, content] of [
  ['artifact', JSON.stringify(artifact)],
  ['doc', doc],
  ['planner', planner],
  ['status', status],
  ['roadmap', roadmap],
]) {
  check(`${label} contains no obvious secret material`, !secretPattern.test(content))
}

if (errors.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-01c-r2-identity-acquisition-plan-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-01c-r2-identity-acquisition-plan-validate',
    status: 'PASS',
    certificationVerdict: artifact.certificationVerdict,
    sourceGamePkCount: artifact.eventAcquisitionInput.sourceGamePkCount,
    sourceMlbamPersonCount: artifact.playerAcquisitionInput.sourceMlbamPersonCount,
    needsEndpointContractVerification: artifact.flags.NEEDS_ENDPOINT_CONTRACT_VERIFICATION,
    providerCallsMade: 0,
  }, null, 2))
}
