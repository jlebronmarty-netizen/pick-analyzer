import fs from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'

const sql=fs.readFileSync('supabase/migrations/20261004235500_mlb_postseason_history_materialization_v1.sql','utf8')

test('postseason history migration supports all MLB model game types',()=>{
  assert.ok(sql.includes("('R','F','D','L','W')"))
  assert.ok((sql.match(/game_type in \('R','F','D','L','W'\)/g) ?? []).length >= 14)
  assert.doesNotMatch(sql,/game_type\s*=\s*'R'/)
})

test('xyear refresh remains target-date postgame materialization',()=>{
  assert.match(sql,/mlb_ml_xyear_refresh_base_v2\(p_target_date date\)/)
  assert.match(sql,/game_date=p_target_date/)
  assert.match(sql,/Target-date rows are future-history only/)
})

test('batter S D T materialization includes postseason',()=>{
  assert.match(sql,/create materialized view public\.mlb_statcast_batter_sdt_game_mv/i)
  assert.match(sql,/events='single'/)
  assert.match(sql,/events='double'/)
  assert.match(sql,/events='triple'/)
})

test('Pitcher Win history sync includes postseason',()=>{
  assert.match(sql,/sync_mlb_pitcher_win_forward_team_history_v1/)
  assert.match(sql,/sync_mlb_pitcher_win_forward_starter_history_v1/)
  assert.match(sql,/mlb_pitcher_win_forward_recent_starter_v1/)
})

test('materialized view stays service-role read only',()=>{
  assert.match(sql,/revoke all on table public\.mlb_statcast_batter_sdt_game_mv from public,anon,authenticated/i)
  assert.match(sql,/grant select on table public\.mlb_statcast_batter_sdt_game_mv to service_role/i)
})
