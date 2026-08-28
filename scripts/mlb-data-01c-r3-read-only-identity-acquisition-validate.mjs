import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const artifactPath = path.join(root, 'docs/CERTIFICATION/mlb-data-01c-r3-read-only-identity-acquisition.json')
const cachePath = path.join(root, 'docs/CERTIFICATION/mlb-data-01c-r3-acquisition-cache.json')
const docPath = path.join(root, 'docs/CERTIFICATION/MLB_DATA_01C_R3_READ_ONLY_IDENTITY_ACQUISITION.md')
const scriptPath = path.join(root, 'scripts/mlb-data-01c-r3-read-only-identity-acquisition.mjs')
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
const cache = json(cachePath)
const doc = read(docPath)
const script = read(scriptPath)
const status = read(statusPath)
const roadmap = read(roadmapPath)

check('recognized R3 verdict', [
  'MLB_DATA_01C_R3_READ_ONLY_IDENTITY_ACQUISITION_CERTIFIED',
  'MLB_DATA_01C_R3_CANONICAL_PLAYER_CREATION_REQUIRED',
  'MLB_DATA_01C_R3_IDENTITY_ACQUISITION_PARTIAL',
  'MLB_DATA_01C_R3_IDENTITY_ACQUISITION_BLOCKED',
].includes(artifact.certificationVerdict))
check('target commit preserved', artifact.targetCommit === '7cf33b3750c75476a35bd40402f35229965cb2e8')
check('R2/R2A contracts preserved', artifact.contracts.GAME_IDENTITY_ACQUISITION_PLAN_READY === 'YES' && artifact.contracts.PLAYER_IDENTITY_ACQUISITION_PLAN_READY === 'YES')
check('endpoint contracts preserved', artifact.contracts.MLB_OFFICIAL_SINGLE_PERSON_ENDPOINT_CONTRACT === 'PASS' && artifact.contracts.MLB_OFFICIAL_BULK_PERSON_ENDPOINT_STATE === 'SUPPORTED')
check('pre raw stability', artifact.rawStability.PRE_R3_RAW_STABILITY === 'PASS' && artifact.rawStability.rawRows === 712528)
check('raw uniqueness preserved', artifact.rawStability.uniquePitchIdentities === 712528 && artifact.rawStability.duplicateIdentities === 0)
check('game/team counts preserved', artifact.rawStability.games === 2430 && artifact.rawStability.teams === 30)
check('team mappings complete', artifact.teamMapping.preserved === true && artifact.teamMapping.canonicalHomeRows === 712528 && artifact.teamMapping.canonicalAwayRows === 712528)
check('game source count complete', artifact.gameAcquisition.statcastGamePkCount === 2430)
check('official game accounting complete', artifact.gameAcquisition.officialExactGamePkCoverage + artifact.gameAcquisition.missingOfficialGameCount + artifact.gameAcquisition.duplicateOfficialGameIdentityCount === 2430)
check('event reconciliation accounting complete', Object.values(artifact.eventReconciliation.counts).reduce((a, b) => a + b, 0) === 2430)
check('source player count complete', artifact.playerAcquisition.sourceMlbamPlayerCount === 1469)
check('source player roles preserved', artifact.playerAcquisition.roleCounts.pitcherOnly === 796 && artifact.playerAcquisition.roleCounts.batterOnly === 596 && artifact.playerAcquisition.roleCounts.both === 77)
check('official player accounting complete', artifact.playerAcquisition.officialPlayerIdsFound + artifact.playerAcquisition.officialPlayerIdsMissing + artifact.playerAcquisition.playerCallFailures <= 1469)
check('player reconciliation accounting complete', Object.values(artifact.playerReconciliation.counts).reduce((a, b) => a + b, 0) === 1469)
check('crosswalk conflicts non-negative', artifact.crosswalkDryRuns.game.conflicts.totalConflicts >= 0 && artifact.crosswalkDryRuns.player.conflicts.totalConflicts >= 0)
check('projected event coverage bounded', artifact.rawCoverageProjection.eventIdMappableRows >= 0 && artifact.rawCoverageProjection.eventIdMappableRows <= 712528)
check('projected pitcher coverage bounded', artifact.rawCoverageProjection.canonicalPitcherMappableRows >= 0 && artifact.rawCoverageProjection.canonicalPitcherMappableRows <= 712528)
check('projected batter coverage bounded', artifact.rawCoverageProjection.canonicalBatterMappableRows >= 0 && artifact.rawCoverageProjection.canonicalBatterMappableRows <= 712528)
check('01D remains blocked', artifact.readiness.MLB_DATA_01D_2025_FEATURE_BUILD_READY === 'NO')
check('2026 path reusable', artifact.reuse.gamePathReusableFor2026 === 'YES')
check('daily ingest reusable', artifact.reuse.dailyIngestReusable === 'YES')
check('resume ready', artifact.resume.R3_ACQUISITION_RESUME_READY === 'YES' && fs.existsSync(cachePath))
check('cache has game/player identities', Object.keys(cache.gameIdentities ?? {}).length >= artifact.gameAcquisition.officialExactGamePkCoverage && Object.keys(cache.playerIdentities ?? {}).length >= artifact.playerAcquisition.officialPlayerIdsFound)
check('provider calls bounded', artifact.providerAccounting.gameProviderCalls <= 5 && artifact.providerAccounting.playerProviderCalls <= 490)
check('total provider calls exact sum', artifact.providerAccounting.totalMlbOfficialCalls === artifact.providerAccounting.gameProviderCalls + artifact.providerAccounting.playerProviderCalls)
check('other providers zero', artifact.providerAccounting.otherProviderCalls === 0)
check('production writes zero', artifact.safety.productionDmlMutations === 0 && artifact.safety.productionSchemaMutations === 0)
check('crosswalk writes zero', artifact.safety.crosswalkWritePerformed === false && artifact.flags.CROSSWALK_WRITE_PERFORMED === 'NO')
check('raw mapping writes zero', artifact.safety.rawCanonicalMappingWritePerformed === false && artifact.flags.RAW_CANONICAL_MAPPING_WRITE_PERFORMED === 'NO')
check('canonical player creation zero', artifact.safety.canonicalPlayerCreationPerformed === false && artifact.flags.CANONICAL_PLAYER_CREATION_PERFORMED === 'NO')
check('feature/model/prediction zero', artifact.safety.featureRows === 0 && artifact.safety.modelRows === 0 && artifact.safety.gamePredictions === 0 && artifact.safety.predictionResults === 0 && artifact.safety.marketValueEvaluations === 0)
check('2026 raw remains zero', artifact.safety.imported2026Rows === 0)
check('automation untouched', artifact.safety.automationActivated === false && artifact.safety.activeCronAdded === false)
check('script avoids production mutations', !/\.(insert|upsert|delete)\s*\(/.test(script) && !/\.from\([^)]*\)[\s\S]{0,300}\.update\s*\(/.test(script))
check('doc includes verdict', doc.includes(artifact.certificationVerdict))
check('status updated for R3', status.includes('MLB-DATA-01C-R3') && status.includes(artifact.certificationVerdict))
check('roadmap updated for R3', roadmap.includes('MLB-DATA-01C-R3') && roadmap.includes(artifact.certificationVerdict))

const secretPattern = /(SUPABASE_SERVICE_ROLE_KEY\s*=|CRON_SECRET\s*=|Bearer\s+[A-Za-z0-9._-]+|eyJ[A-Za-z0-9._-]{20,})/
for (const [label, content] of [
  ['artifact', JSON.stringify(artifact)],
  ['cache', JSON.stringify(cache)],
  ['doc', doc],
  ['script', script],
  ['status', status],
  ['roadmap', roadmap],
]) {
  check(`${label} contains no obvious secret material`, !secretPattern.test(content))
}

if (errors.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-01c-r3-read-only-identity-acquisition-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-01c-r3-read-only-identity-acquisition-validate',
    status: 'PASS',
    certificationVerdict: artifact.certificationVerdict,
    officialExactGamePkCoverage: artifact.gameAcquisition.officialExactGamePkCoverage,
    officialPlayerIdsFound: artifact.playerAcquisition.officialPlayerIdsFound,
    gameCrosswalkDryRunReady: artifact.flags.GAME_CROSSWALK_DRY_RUN_READY,
    playerCrosswalkDryRunReady: artifact.flags.PLAYER_CROSSWALK_DRY_RUN_READY,
    totalMlbOfficialCalls: artifact.providerAccounting.totalMlbOfficialCalls,
    productionDmlMutations: artifact.safety.productionDmlMutations,
  }, null, 2))
}
