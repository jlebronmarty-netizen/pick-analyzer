import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const sql=fs.readFileSync('scripts/research/mlb_batter_walks_feature_dryrun_v1.sql','utf8')
const doc=fs.readFileSync('docs/research/MLB_BATTER_WALKS_FEATURE_DRYRUN_V1.md','utf8')

test('dryrun is read-only',()=>{
  assert.doesNotMatch(sql,/\b(insert|update|delete|merge|create|alter|drop|truncate)\b/i)
})
test('dryrun is exact U0.5 walks scoped',()=>{
  assert.match(sql,/market='batter_walks'/)
  assert.match(sql,/line::numeric=0\.5/)
  assert.match(sql,/lower\(s\.outcome\)='under'/)
})
test('strict feature contract is enforced',()=>{
  assert.match(sql,/pick2_mlb_batter_daily_features/)
  assert.match(sql,/MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1/)
  assert.match(sql,/source_game_date < target_game_date/)
})
test('safety boundaries documented',()=>{
  assert.match(doc,/no DML/)
  assert.match(doc,/Official Picks/)
  assert.match(doc,/APOSTAR disabled/)
})
