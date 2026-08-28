import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const artifactPath = path.join(root, 'docs/CERTIFICATION/mlb-data-01c-r2a-person-endpoint-contract.json')
const r2Path = path.join(root, 'docs/CERTIFICATION/mlb-data-01c-r2-identity-acquisition-plan.json')
const docPath = path.join(root, 'docs/CERTIFICATION/MLB_DATA_01C_R2A_PERSON_ENDPOINT_CONTRACT.md')
const generatorPath = path.join(root, 'scripts/mlb-data-01c-r2a-person-endpoint-contract.mjs')
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
const r2 = JSON.parse(read(r2Path))
const doc = read(docPath)
const generator = read(generatorPath)
const status = read(statusPath)
const roadmap = read(roadmapPath)

check('certified verdict', artifact.certificationVerdict === 'MLB_DATA_01C_R2A_MLB_OFFICIAL_PERSON_ENDPOINT_CERTIFIED')
check('probe set certified', artifact.flags.PERSON_PROBE_SET_CERTIFIED === 'YES' && artifact.probeSet.selectedPlayers.length === 3)
check('role coverage complete', new Set(artifact.probeSet.selectedPlayers.map((player) => player.sourceRole)).size === 3)
check('single contract pass', artifact.flags.MLB_OFFICIAL_SINGLE_PERSON_ENDPOINT_CONTRACT === 'PASS')
check('minimum fields ready', artifact.flags.MLB_OFFICIAL_PERSON_MINIMUM_IDENTITY_FIELDS_READY === 'YES')
check('single probes all pass', artifact.singlePersonEndpoint.probes.length === 3 && artifact.singlePersonEndpoint.probes.every((probe) => probe.ok && probe.topLevelPeopleArray && probe.peopleLength === 1 && probe.contract.identityParity))
check('minimum id present', artifact.minimumIdentityFields.availability.id === true)
check('bulk supported', artifact.flags.MLB_OFFICIAL_BULK_PERSON_ENDPOINT_STATE === 'SUPPORTED' && artifact.bulkPersonEndpoint.state === 'SUPPORTED')
check('bulk identity coverage', artifact.bulkPersonEndpoint.probe.peopleLength === 3 && artifact.bulkPersonEndpoint.probe.allRequestedRepresented && artifact.bulkPersonEndpoint.probe.noUnexpectedIdentities && artifact.bulkPersonEndpoint.probe.returnedIdsUnique)
check('bulk order independent', artifact.flags.BULK_PERSON_RESPONSE_ORDER_DEPENDENCY === 'NO')
check('verified batch size exactly three', artifact.flags.MAX_VERIFIED_PERSON_IDS_PER_REQUEST === '3' && artifact.bulkPersonEndpoint.maxVerifiedPersonIdsPerRequest === 3)
check('batch not maximized', artifact.flags.PRODUCTION_ACQUISITION_BATCH_SIZE_NOT_YET_MAXIMIZED === 'YES')
check('future call plan ready', artifact.flags.PLAYER_IDENTITY_ACQUISITION_PLAN_READY === 'YES' && artifact.futurePlayerCallPlan.plannedCalls === 490)
check('failure contract ready', artifact.flags.PERSON_ACQUISITION_FAILURE_CONTRACT_READY === 'YES' && artifact.failureContract.nameFallbackAllowed === false)
check('cache contract ready', artifact.flags.MLBAM_PERSON_CACHE_CONTRACT_READY === 'YES')
check('dedup plan ready', artifact.flags.PLAYER_PROVIDER_CALL_DEDUP_PLAN_READY === 'YES')
check('player reconciliation ready', artifact.flags.PLAYER_RECONCILIATION_CONTRACT_READY === 'YES')
check('game plan preserved', artifact.flags.GAME_IDENTITY_ACQUISITION_PLAN_READY === 'YES' && artifact.gameAcquisitionPlanPreserved.eventWrites === 0)
check('external execution ready', artifact.flags.EXTERNAL_IDENTITY_ACQUISITION_EXECUTION_READY === 'YES')
check('persistence closed', artifact.flags.CROSSWALK_PERSISTENCE_AUTHORIZED_NOW === 'NO' && artifact.flags.CROSSWALK_WRITE_PERFORMED === 'NO')
check('call ceiling respected', artifact.providerAccounting.mlbOfficialCalls <= 4 && artifact.providerAccounting.mlbOfficialCalls === 4)
check('call accounting', artifact.providerAccounting.successfulProviderCalls === 4 && artifact.providerAccounting.failedProviderCalls === 0 && artifact.providerAccounting.retryCalls === 0 && artifact.providerAccounting.otherProviderCalls === 0)
check('production mutations zero', artifact.productionSafety.productionDmlMutations === 0 && artifact.productionSafety.productionSchemaMutations === 0 && artifact.productionSafety.providerEntityMappingsWrites === 0 && artifact.productionSafety.rawMappingWrites === 0)
check('automation untouched', artifact.productionSafety.automationActivated === false && artifact.productionSafety.activeCronAdded === false)
check('raw safety preserved', artifact.rawProductSafety.rawRows === 712528 && artifact.rawProductSafety.uniquePitchIdentities === 712528 && artifact.rawProductSafety.duplicateIdentities === 0)
check('canonical writes absent', artifact.rawProductSafety.eventRowsMapped === 0 && artifact.rawProductSafety.pitcherRowsMapped === 0 && artifact.rawProductSafety.batterRowsMapped === 0)
check('feature/model/prediction zero', artifact.rawProductSafety.featureTables === 0 && artifact.rawProductSafety.modelRegistry === 0 && artifact.rawProductSafety.modelVersions === 0 && artifact.rawProductSafety.gamePredictions === 0)
check('2026 isolated', artifact.rawProductSafety.imported2026Rows === 0)
check('01D blocked', artifact.flags.MLB_DATA_01D_2025_FEATURE_BUILD_READY === 'NO')

check('R2 supersession recorded', r2.r2aSupersession?.supersededBy === 'MLB_DATA_01C_R2A_MLB_OFFICIAL_PERSON_ENDPOINT_CERTIFIED')
check('R2 player plan now ready', r2.flags.PLAYER_IDENTITY_ACQUISITION_PLAN_READY === 'YES' && r2.flags.EXTERNAL_IDENTITY_ACQUISITION_EXECUTION_READY === 'YES')
check('R2 persistence still closed', r2.flags.CROSSWALK_PERSISTENCE_AUTHORIZED_NOW === 'NO')
check('doc includes verdict', doc.includes('MLB_DATA_01C_R2A_MLB_OFFICIAL_PERSON_ENDPOINT_CERTIFIED'))
check('status updated', status.includes('MLB-DATA-01C-R2A') && status.includes('MLB_OFFICIAL_BULK_PERSON_ENDPOINT_STATE = SUPPORTED'))
check('roadmap updated', roadmap.includes('MLB-DATA-01C-R2A') && roadmap.includes('MLB-DATA-01C-R3_READ_ONLY_IDENTITY_ACQUISITION'))
check('generator does not write production', !/\.(insert|upsert|delete)\s*\(/.test(generator) && !/\.from\([^)]*\)[\s\S]{0,300}\.update\s*\(/.test(generator))
check('generator does not call provider', !generator.includes('fetch('))

const secretPattern = /(SUPABASE_SERVICE_ROLE_KEY\s*=|CRON_SECRET\s*=|Bearer\s+[A-Za-z0-9._-]+|eyJ[A-Za-z0-9._-]{20,})/
for (const [label, content] of [
  ['artifact', JSON.stringify(artifact)],
  ['r2 artifact', JSON.stringify(r2)],
  ['doc', doc],
  ['generator', generator],
  ['status', status],
  ['roadmap', roadmap],
]) {
  check(`${label} contains no obvious secret material`, !secretPattern.test(content))
}

if (errors.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-01c-r2a-person-endpoint-contract-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-01c-r2a-person-endpoint-contract-validate',
    status: 'PASS',
    certificationVerdict: artifact.certificationVerdict,
    singlePersonContract: artifact.flags.MLB_OFFICIAL_SINGLE_PERSON_ENDPOINT_CONTRACT,
    bulkEndpointState: artifact.flags.MLB_OFFICIAL_BULK_PERSON_ENDPOINT_STATE,
    playerCallsPlanned: artifact.flags.PLAYER_CALLS_PLANNED,
    mlbOfficialCalls: artifact.providerAccounting.mlbOfficialCalls,
  }, null, 2))
}
