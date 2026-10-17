import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const sql=fs.readFileSync('scripts/research/mlb_er_o1p5_starter_feature_dryrun_v1.sql','utf8')
const doc=fs.readFileSync('docs/research/MLB_ER_O1P5_STARTER_FEATURE_DRYRUN_V1.md','utf8')

test('dryrun is read-only',()=>{
  assert.match(sql,/^-- MLB ER O1\.5 starter-feature dry-run/m)
  assert.doesNotMatch(sql,/\b(insert|update|delete|merge|create|alter|drop|truncate)\b/i)
})

test('dryrun uses exact canonical feature contract',()=>{
  assert.match(sql,/pick2_mlb_pitcher_daily_features/)
  assert.match(sql,/MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1/)
  assert.match(sql,/source_game_date < target_game_date/)
  assert.match(sql,/target_game_pk/)
  assert.match(sql,/mlbam_pitcher_id/)
})

test('dryrun fails closed on missing pitcher identity',()=>{
  assert.match(sql,/BLOCK_PROBABLE_PITCHER_MISSING/)
  assert.match(doc,/fail-closed/)
})

test('dryrun authorizes no downstream betting actions',()=>{
  assert.match(doc,/Official Picks/)
  assert.match(doc,/APOSTAR/)
  assert.match(doc,/No bullpen, batter, matchup/)
})
