import { FEATURE_TABLES, FEATURE_VERSION } from './mlb-data-02r-r2t-real-feature-champion.mjs'

const RAW = 'pick2_raw_mlb_statcast_pitches'
const columns = ['id', 'game_pk', 'game_date', 'game_year', 'canonical_home_team_id', 'canonical_away_team_id',
  'mlbam_pitcher_id', 'mlbam_batter_id', 'at_bat_number', 'pitch_number', 'inning', 'inning_topbot', 'events',
  'description', 'type', 'release_speed', 'launch_speed', 'estimated_woba_using_speedangle', 'post_home_score',
  'post_away_score', 'raw_payload_digest', 'ingested_at', 'created_at'].join(',')
const requireRead = (condition, code) => { if (!condition) throw new Error(`R2TR1_READ_BLOCK:${code}`) }

export function createPregameReadRepository(db) {
  const read = async (query, label) => {
    const result = await query
    requireRead(!result.error, `${label}:${result.error?.code ?? 'UNKNOWN'}`)
    return result
  }
  return {
    async readCandidates(currentDate) {
      const current = await read(db.from('pick2_mlb_games').select('*').eq('game_date', currentDate).order('scheduled_at').limit(101), 'current_games')
      requireRead(current.data.length < 101, 'CURRENT_GAME_CAP')
      const historical = await read(db.from('pick2_mlb_games').select('*').lt('game_date', currentDate).not('scheduled_at', 'is', null).order('scheduled_at', { ascending: false }).limit(100), 'historical_candidates')
      return { current: current.data, historical: historical.data, historicalSearchLimit: 100 }
    },
    async readPredictions() {
      const rows = await read(db.from('pick2_game_predictions').select('*').order('predicted_at', { ascending: false }).limit(100), 'prediction_candidates')
      return rows.data
    },
    async readDependencies(target, starters, { inventoryMissing = false, inventoryOnly = false } = {}) {
      const seasonStart = `${target.gameDate.slice(0, 4)}-01-01`
      const teamIds = [target.homeTeamId, target.awayTeamId]
      const pitcherIds = [starters.home.mlbam_pitcher_id, starters.away.mlbam_pitcher_id]
      const games = await read(db.from('pick2_mlb_games').select('game_pk,home_team_id,away_team_id,game_date')
        .gte('game_date', seasonStart).lt('game_date', target.performanceCutoff)
        .or(teamIds.flatMap((team) => [`home_team_id.eq.${team}`, `away_team_id.eq.${team}`]).join(',')).limit(501), 'team_dependency_games')
      requireRead(games.data.length < 501, 'DEPENDENCY_GAME_CAP')
      const gamePks = new Set(games.data.map((row) => row.game_pk))
      // Discover appearances outside current franchises, then read complete games
      // so the unchanged builder can identify historical starter/bullpen context.
      for (const pitcherId of pitcherIds) {
        const query = () => db.from(RAW).select('id,game_pk', { count: 'exact' }).eq('mlbam_pitcher_id', pitcherId)
          .gte('game_date', seasonStart).lt('game_date', target.performanceCutoff)
        let count = null
        for (let from = 0; count === null || from < count; from += 1000) {
          const page = await read(query().order('id').range(from, from + 999), 'pitcher_dependency_games')
          count ??= page.count
          requireRead(Number.isInteger(count) && count <= 15000, 'PITCHER_READ_CAP')
          page.data.forEach((row) => gamePks.add(row.game_pk))
          requireRead(page.data.length === Math.min(1000, count - from), 'PITCHER_READ_TRUNCATED')
        }
      }
      const ids = [...gamePks].sort((a, b) => a - b)
      requireRead(ids.length > 0 && ids.length <= 500 && !ids.includes(target.gamePk), 'DEPENDENCY_SCOPE')
      const rows = []
      const counts = []
      const missingGamePks = []
      for (let start = 0; start < ids.length; start += 8) {
        const scope = ids.slice(start, start + 8)
        const results = await Promise.allSettled(scope.map((gamePk) => read(db.from(RAW)
          .select(inventoryOnly ? 'id' : columns, { count: 'exact', ...(inventoryOnly ? {head:true} : {}) }).eq('game_pk', gamePk).limit(1000), 'scoped_raw_history')))
        // Inspect every settled result, including errors, before continuing.
        const errors = results.filter((result) => result.status === 'rejected')
        requireRead(errors.length === 0, `RAW_GAME_READ:${errors.map((result) => result.reason.message).join('|')}`)
        for (const [index, result] of results.entries()) {
          const page = result.value
          if (inventoryMissing && page.count === 0 && (inventoryOnly || page.data.length === 0)) {
            missingGamePks.push(scope[index])
            continue
          }
          requireRead(Number.isInteger(page.count) && page.count > 0 && page.count <= 1000, 'RAW_READ_CAP_OR_MISSING_GAME')
          requireRead(inventoryOnly || page.data.length === page.count, 'RAW_READ_TRUNCATED')
          if(!inventoryOnly)rows.push(...page.data)
          counts.push({ gamePks: [scope[index]], count: page.count })
        }
      }
      requireRead(rows.length <= ids.length * 1000, 'TOTAL_RAW_CAP')
      // Do not hide late ingestion with a timestamp WHERE filter: the pure
      // provenance gate must reject it instead of building incomplete history.
      const result = { rows, dependencyGamePks: ids, exactCounts: counts, actualRows: rows.length }
      if (inventoryMissing) {
        result.missingGamePks = missingGamePks
        result.missingGameDates = games.data.filter(g => missingGamePks.includes(g.game_pk)).map(g => ({ gamePk: g.game_pk, gameDate: g.game_date }))
        requireRead(result.missingGameDates.length === missingGamePks.length, 'MISSING_DEPENDENCY_DATE')
      }
      return result
    },
    async verifyPersistenceColumns(rows) {
      const result = []
      for (const [domain, table] of Object.entries(FEATURE_TABLES)) {
        // The future-schedule contract deliberately has no batter output.
        const sample = rows[domain]?.[0]
        const fields = sample ? Object.keys(sample) : [
          'feature_snapshot_id', 'player_id', 'target_game_pk', 'mlbam_batter_id', 'feature_date', 'as_of_date',
          'as_of_timestamp', 'feature_version', 'recent_k_rate', 'recent_bb_rate', 'recent_scoring_contribution',
          'iso_value', 'handedness_splits', 'pitch_type_matchups', 'sample_sizes', 'source_window',
        ]
        await read(db.from(table).select(fields.join(',')).limit(1), `physical_schema:${domain}`)
        result.push({ domain, table: `public.${table}`, fields, featureVersion: FEATURE_VERSION,
          entityKey: domain === 'snapshots' ? 'deterministic_identity' : domain === 'starter' ? 'target_game_pk,mlbam_pitcher_id,feature_version' : domain === 'batter' ? 'target_game_pk,mlbam_batter_id,feature_version' : ['team', 'bullpen'].includes(domain) ? 'target_game_pk,team_id,feature_version' : 'target_game_pk,feature_version',
          snapshotLinkage: domain === 'snapshots' ? 'canonical UUID primary key; deterministic_identity unique' : 'NOT NULL UUID FK to exact entity snapshot; resolve INSERT/REUSE snapshot by deterministic_identity before classification',
          dateFields: ['feature_date', 'as_of_date', 'as_of_timestamp'],
          classifier: 'existing classifyInsertReuseConflict; project physical payload; bind canonical snapshot UUID before daily INSERT_ELIGIBLE/REUSE_NO_OP/BLOCK_CONFLICT classification',
          state: 'READ_ONLY_COLUMNS_VERIFIED', writes: 0 })
      }
      return result
    },
  }
}
