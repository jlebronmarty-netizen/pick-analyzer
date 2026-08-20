import fs from 'node:fs'

const files = {
  service: 'src/services/mlb-context-lineage.service.ts',
  route: 'src/app/api/mlb/context-lineage/route.ts',
  script: 'scripts/mlb-context-lineage.mjs',
  migration: 'supabase/migrations/202608200001_mlb_context_snapshots_v1.sql',
  architecture: 'docs/ARCHITECTURE/MLB_CONTEXT_LINEAGE_V1.md',
  certification: 'docs/CERTIFICATION/mlb-01-context-lineage.json',
  status: 'docs/PROJECT_STATUS.md',
  roadmap: 'docs/MASTER_ROADMAP.md',
}

function read(path) {
  return fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : ''
}

const service = read(files.service)
const route = read(files.route)
const migration = read(files.migration)
const architecture = read(files.architecture)
const certificationRaw = read(files.certification)

const checks = [
  ['service exists', service.length > 0],
  ['route exists', route.length > 0],
  ['script exists', read(files.script).length > 0],
  ['migration creates mlb_context_snapshots', migration.includes('create table if not exists public.mlb_context_snapshots')],
  ['snapshot table is shadow only', migration.includes('production_eligible boolean not null default false') && migration.includes('shadow_only boolean not null default true')],
  ['SportsDataIO excluded in authority contract', service.includes('ROLLBACK_ONLY_EXCLUDED_FROM_MLB_01')],
  ['The Odds API not called by service', !service.includes('the-odds') && !service.includes('THE_ODDS_API_KEY')],
  ['MLB Official schedule is bounded source', service.includes('fetchMlbOfficialSchedule')],
  ['no prediction_history writes', !service.includes(".from('prediction_history')") && !service.includes('.from("prediction_history")')],
  ['no official pick writes', !service.includes('recommended_pick')],
  ['eligible subset persistence exists', service.includes('PERSIST_ELIGIBLE') && service.includes('SKIP_POST_START') && service.includes('SKIP_CANCELLED')],
  ['snapshot insert only preserves earlier evidence', service.includes('.insert(inserts)') && !service.includes('.upsert(snapshots')],
  ['lineup live feed bounded', service.includes('fetchMlbOfficialLiveFeedLineups') && service.includes('Math.min(5')],
  ['missing weather is explicit', service.includes('WEATHER_CONTEXT_REQUIRES_APPROVED_PROVIDER')],
  ['injury source limited to stored injuries', service.includes('sport_injuries')],
  ['lineup source limited to stored lineage', service.includes('sport_lineups') && service.includes('stored_season_player_stats_projected_lineup')],
  ['bullpen source limited to stored stats', service.includes('sport_game_stats_and_sport_player_stats')],
  ['temporal status enforced', service.includes('temporalStatus(') && service.includes('POST_START')],
  ['feature lineage records missing-data policy', service.includes('missing_context_is_unknown_never_fabricated')],
  ['api route does not persist', route.includes('persist: false')],
  ['documentation exists', architecture.includes('MLB Context Lineage V1')],
  ['certification json parses', (() => { try { JSON.parse(certificationRaw); return true } catch { return false } })()],
]

const failed = checks.filter(([, passed]) => !passed).map(([name]) => name)
const result = {
  success: failed.length === 0,
  mode: 'mlb_01_context_lineage_validator_v1',
  checks: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  failedChecks: failed,
  providerCallsMade: 0,
  productionDatabaseMutations: 0,
}

console.log(JSON.stringify(result, null, 2))
if (!result.success) process.exit(1)
