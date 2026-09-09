import fs from 'node:fs'
import { sha256 } from './mlb-data-02r-r2f-stage-contracts.mjs'

const schema = JSON.parse(fs.readFileSync('docs/CERTIFICATION/MLB_OPERATIONAL_RAW_SCHEMA_REVIEW.json', 'utf8'))
const columns = new Map(schema.columns.map(c => [c.column, c]))
const ensure = (condition, reason) => { if (!condition) throw new Error(`R2T_RAW_BLOCK:${reason}`) }

export function assertCanonicalRawInsert(row) {
  for (const [key, value] of Object.entries(row)) {
    const c = columns.get(key)
    ensure(c && !['ingested_at', 'created_at'].includes(key), `UNEXPECTED_OR_BACKDATED_COLUMN:${key}`)
    ensure(value !== undefined, `UNDEFINED:${key}`)
    if (value === null) { ensure(c.nullable === 'YES', `NULL:${key}`); continue }
    if (['integer', 'bigint', 'numeric', 'double precision', 'real'].includes(c.type)) ensure(typeof value === 'number' && Number.isFinite(value), `NUMBER:${key}`)
    if (c.type === 'text') ensure(typeof value === 'string', `TEXT:${key}`)
  }
  for (const c of schema.columns.filter(c => c.nullable === 'NO' && c.default === null)) ensure(row[c.column] !== null && row[c.column] !== undefined, `REQUIRED:${c.column}`)
  for (const key of ['game_pk', 'game_year', 'at_bat_number', 'pitch_number', 'mlbam_pitcher_id', 'mlbam_batter_id']) ensure(Number.isSafeInteger(row[key]) && row[key] > 0, `IDENTITY:${key}`)
  ensure(row.id === `statcast:mlb:${row.game_year}:${row.game_pk}:${row.at_bat_number}:${row.pitch_number}`, 'PITCH_IDENTITY')
  ensure(row.source === 'statcast' && row.pick2_era === 'PICK_2_ERA_V1', 'SOURCE')
  ensure(row.raw_payload && typeof row.raw_payload === 'object' && !Array.isArray(row.raw_payload) && row.raw_payload_digest === sha256(JSON.stringify(row.raw_payload)), 'PAYLOAD_DIGEST')
  ensure(row.canonical_home_team_id && row.canonical_away_team_id && row.canonical_home_team_id !== row.canonical_away_team_id, 'CANONICAL_TEAMS')
  ensure(row.mlbam_pitcher_id === row.source_pitcher_id && row.mlbam_batter_id === row.source_batter_id, 'PLAYER_LINKAGE')
  return row
}
