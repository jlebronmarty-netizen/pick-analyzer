import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const json = (relativePath) => JSON.parse(read(relativePath))

const failures = []
const check = (name, condition) => {
  if (!condition) failures.push(name)
}

const artifact = json('docs/CERTIFICATION/mlb-data-01c-2025-canonical-mapping.json')
const doc = read('docs/CERTIFICATION/MLB_DATA_01C_2025_CANONICAL_MAPPING.md')
const script = read('scripts/mlb-data-01c-2025-canonical-mapping.mjs')
const roadmap = read('docs/MASTER_ROADMAP.md')
const status = read('docs/PROJECT_STATUS.md')
const migration = read('supabase/migrations/202608270002_pick2_data_foundation_v1.sql')
const prior01b = json('docs/CERTIFICATION/mlb-data-01b-2025-raw-statcast-import.json')

check('01C verdict recorded', artifact.certificationVerdict === 'MLB_DATA_01C_2025_CANONICAL_MAPPING_BLOCKED')
check('execute mode recorded', artifact.mode === 'EXECUTE')
check('raw stability preserved', artifact.rawStability.rawRows === 712528 && artifact.rawStability.uniquePitchIdentities === 712528 && artifact.rawStability.duplicatePitchIdentities === 0)
check('game coverage preserved', artifact.rawStability.games === 2430 && artifact.rawStability.minDate === '2025-03-18' && artifact.rawStability.maxDate === '2025-09-28')
check('mapping allowlist certified', artifact.flags.MAPPING_MUTABLE_FIELD_ALLOWLIST_CERTIFIED === 'YES' && artifact.mappingMutableFieldAllowlist.includes('canonical_home_team_id') && artifact.mappingMutableFieldAllowlist.includes('mapped_at'))
check('raw denylist certified', artifact.flags.RAW_SOURCE_FIELDS_IMMUTABLE_DURING_MAPPING === 'YES' && artifact.rawSourceImmutabilityDenylist.includes('raw_payload') && artifact.rawSourceImmutabilityDenylist.includes('source_pitcher_id'))
check('team dry run complete', artifact.teamMappingDryRun.status === 'PASS' && artifact.teamMappingDryRun.counts.MAPPED === 30)
check('team write/readback complete', artifact.flags['2025_TEAM_CANONICAL_MAPPING_CERTIFIED'] === 'YES' && artifact.postMappingReadback.teamHomeRowsMapped === 712528 && artifact.postMappingReadback.teamAwayRowsMapped === 712528)
check('event inventory ready', artifact.flags['2025_CANONICAL_EVENT_INVENTORY_READY'] === 'YES' && artifact.eventInventory.canonical2025Events === 2462)
check('game dry run fail closed', artifact.gameMappingDryRun.counts.MAPPED === 1816 && artifact.gameMappingDryRun.counts.UNMAPPED === 305 && artifact.gameMappingDryRun.counts.AMBIGUOUS === 309)
check('game writes blocked', artifact.flags.GAME_MAPPING_WRITE_READY === 'NO' && artifact.postMappingReadback.eventRowsMapped === 0)
check('player inventory ready', artifact.flags.MLBAM_PLAYER_IDENTITY_SOURCE_INVENTORY_READY === 'YES' && artifact.sourcePlayerInventory.uniqueSourcePlayers === 1469)
check('player writes blocked', artifact.playerMappingDryRun.counts.UNMAPPED === 1469 && artifact.postMappingReadback.pitcherRowsMapped === 0 && artifact.postMappingReadback.batterRowsMapped === 0)
check('player creation not performed', artifact.flags.CANONICAL_PLAYER_CREATION_PERFORMED === 'NO' && artifact.canonicalPlayerCreationPerformed === false)
check('raw immutability pass', artifact.flags['2025_RAW_IMMUTABILITY_AFTER_MAPPING'] === 'PASS' && artifact.rawImmutability.status === 'PASS')
check('no feature/model/prediction work', artifact.flags.FEATURE_BUILD_PERFORMED === 'NO' && artifact.flags.MODEL_WORK_PERFORMED === 'NO' && artifact.predictionWrites === 0)
check('feature tables empty', artifact.postMappingReadback.featureTablesRemainEmpty === true)
check('model/prediction tables empty', artifact.postMappingReadback.modelTablesRemainEmpty === true && artifact.postMappingReadback.predictionTablesRemainEmpty === true)
check('2026 isolation', artifact.flags['2026_IMPORT_PERFORMED'] === 'NO' && artifact.postMappingReadback.imported2026Rows === 0)
check('provider calls zero', artifact.providerCalls === 0)
check('schema mutations zero', artifact.updateAccounting.productionSchemaMutations === 0)
check('team-only DML accounting', artifact.updateAccounting.productionDmlMutations === 712528 && artifact.updateAccounting.team.physicalRowsTouched === 712528 && artifact.updateAccounting.game.physicalRowsTouched === 0 && artifact.updateAccounting.player.fieldAssignments === 0)
check('automation off', artifact.flags.AUTOMATION_ACTIVATED === 'NO' && artifact.flags.ACTIVE_CRON_ADDED === 'NO')
check('01D remains blocked', artifact.flags.MLB_DATA_01D_2025_FEATURE_BUILD_READY === 'NO' && artifact.remainingBlockers.length === 2)
check('prior 01B preserved', prior01b.certificationVerdict === 'MLB_DATA_01B_2025_RAW_STATCAST_IMPORT_CERTIFIED' && prior01b.postImport.totalRows === 712528)
check('script does not insert/delete raw', !script.includes(".insert(") && !script.includes(".delete("))
check('script writes only raw mapping table', script.includes(".from('pick2_raw_mlb_statcast_pitches')") && !script.includes(".from('sport_events').update(") && !script.includes(".from('sport_players').update("))
check('migration has allowlisted fields', ['canonical_home_team_id', 'canonical_away_team_id', 'event_id', 'canonical_pitcher_id', 'canonical_batter_id', 'mapping_metadata', 'mapped_at'].every((field) => migration.includes(field)))
check('documentation updated', doc.includes('MLB_DATA_01C_2025_CANONICAL_MAPPING_BLOCKED') && roadmap.includes('MLB-DATA-01C') && status.includes('MLB-DATA-01C'))

const combined = [doc, JSON.stringify(artifact), roadmap, status, script].join('\n')
check('targeted secret scan', !/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|SUPABASE_SERVICE_ROLE_KEY\s*=|THE_ODDS_API_KEY\s*=|ODDS_API_KEY\s*=|CRON_SECRET\s*=|Bearer\s+[A-Za-z0-9._-]{20,})/.test(combined))

if (failures.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-01c-2025-canonical-mapping-validate', status: 'FAIL', failed: failures }, null, 2))
  process.exit(1)
}

console.log(JSON.stringify({
  validator: 'mlb-data-01c-2025-canonical-mapping-validate',
  status: 'PASS',
  certificationVerdict: artifact.certificationVerdict,
  teamRowsMapped: artifact.postMappingReadback.teamHomeRowsMapped,
  gameRowsMapped: artifact.postMappingReadback.eventRowsMapped,
  uniquePlayersMapped: artifact.playerMappingDryRun.uniquePlayersMapped,
  rawImmutability: artifact.rawImmutability.status,
  providerCalls: 0,
}, null, 2))
