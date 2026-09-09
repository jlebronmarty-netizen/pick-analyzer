import { sha256 } from './mlb-data-02r-r2f-stage-contracts.mjs'

const identityColumns = Object.freeze({
  pick2_mlb_games: 'game_pk', pick2_mlb_players: 'mlbam_person_id', pick2_raw_mlb_statcast_pitches: 'id',
  pick2_feature_snapshots: 'deterministic_identity', pick2_mlb_team_daily_features: 'feature_snapshot_id',
  pick2_mlb_pitcher_daily_features: 'feature_snapshot_id', pick2_mlb_bullpen_daily_features: 'feature_snapshot_id',
  pick2_mlb_batter_daily_features: 'feature_snapshot_id', pick2_mlb_matchup_daily_features: 'feature_snapshot_id',
  pick2_mlb_first_inning_daily_features: 'feature_snapshot_id', pick2_game_predictions: 'deterministic_identity',
  pick2_mlb_market_event_mappings: 'provider_event_id', pick2_mlb_market_price_observations: 'observation_identity',
  pick2_mlb_market_value_evaluations: 'value_identity', pick2_mlb_official_picks: 'official_pick_identity',
})
const ensure = (condition, reason) => { if (!condition) throw new Error(`WRITE_JOURNAL_BLOCK:${reason}`) }
function matches(stored, planned, allowUpdatedAtAdvance = false) {
  return Object.entries(planned).every(([key, expected]) => {
    const actual = stored[key]
    if (key === 'updated_at' && allowUpdatedAtAdvance) return Date.parse(actual) >= Date.parse(expected)
    if (expected === null) return actual === null
    if (typeof expected === 'number') return Number(actual) === expected
    if (typeof expected === 'string' && (/(?:_at|_time|_timestamp|_as_of)$/.test(key) || key === 'provider_last_update') && Number.isFinite(Date.parse(expected))) return Date.parse(actual) === Date.parse(expected)
    return sha256(actual) === sha256(expected)
  })
}

// Persisted before each request. On uncertain transport outcomes, independent
// exact-identity readback distinguishes a completed write from a safe retry.
// Payloads and expected-old predicates stay in the private run store only.
export function createWriteJournal({ client, store, runContext }) {
  ensure(store.locked, 'EXCLUSIVE_LOCK_REQUIRED')
  const key = `writes-${runContext.run_id}`
  const state = store.load(key) ?? { frozenDigest: sha256(runContext), entries: [] }
  ensure(state.frozenDigest === sha256(runContext), 'FREEZE')
  const save = () => store.save(key, state)
  async function inspect(entry) {
    const column = identityColumns[entry.table]
    const ids = entry.rows.map(r => r[column])
    const { data, error } = await client.from(entry.table).select('*').in(column, ids).limit(ids.length + 1)
    ensure(!error && Array.isArray(data) && data.length <= ids.length, 'READBACK_FAILED')
    if (data.length === entry.rows.length && entry.rows.every(p => data.some(r => String(r[column]) === String(p[column]) && matches(r, p, entry.operation === 'UPDATE')))) return 'APPLIED'
    if (entry.operation === 'INSERT' && data.length === 0) return 'NOT_APPLIED'
    if (entry.operation === 'UPDATE' && data.length === 1 && matches(data[0], entry.expectedOld)) return 'NOT_APPLIED'
    const driftColumns = [...new Set(entry.rows.flatMap(planned => {
      const stored = data.find(row => String(row[column]) === String(planned[column]))
      return stored ? Object.keys(planned).filter(key => !matches(stored, { [key]: planned[key] }, entry.operation === 'UPDATE')) : ['MISSING_ROW']
    }))]
    throw new Error(`WRITE_JOURNAL_BLOCK:PARTIAL_OR_CONFLICTING_STATE:${entry.table}:${driftColumns.join(',')}`)
  }
  return {
    async recover() {
      for (const entry of state.entries.filter(e => e.state === 'PENDING')) {
        entry.state = await inspect(entry)
        entry.recoveredByIndependentReadback = true
        save()
      }
    },
    async perform({ table, rows, cap, operation = 'INSERT', expectedOld = null }, execute) {
      ensure(identityColumns[table] && ['INSERT', 'UPDATE'].includes(operation), 'WRITE_TARGET')
      ensure(rows.length > 0 && Number.isInteger(cap) && rows.length <= cap, 'CAP')
      ensure(operation !== 'UPDATE' || (rows.length === 1 && expectedOld?.game_pk === rows[0].game_pk), 'UPDATE_PREDICATES')
      const operationId = sha256({ table, operation, rows, expectedOld })
      const previous = state.entries.find(e => e.operationId === operationId)
      ensure(!previous || previous.state === 'NOT_APPLIED', 'UNCLASSIFIED_REPEATED_MUTATION')
      const entry = previous ?? { operationId, table, operation, rows, cap, expectedOld }
      entry.state = 'PENDING'
      if (!previous) state.entries.push(entry)
      save()
      const result = await execute()
      entry.state = await inspect(entry)
      ensure(entry.state === 'APPLIED', 'WRITE_NOT_READ_BACK')
      save()
      return result
    },
    summary() {
      return state.entries.map(e => ({ table: e.table, operation: e.operation, plannedRows: e.rows.length, cap: e.cap,
        state: e.state, actualRows: e.state === 'APPLIED' ? e.rows.length : e.state === 'NOT_APPLIED' ? 0 : null,
        recoveredByIndependentReadback: e.recoveredByIndependentReadback ?? false }))
    },
  }
}
