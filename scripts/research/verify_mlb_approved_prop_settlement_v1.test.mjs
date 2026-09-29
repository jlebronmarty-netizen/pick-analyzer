import fs from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'

const settlement=fs.readFileSync('src/services/mlb-approved-prop-settlement.service.ts','utf8')
const win=fs.readFileSync('src/services/mlb-pitcher-win-forward-numeric.service.ts','utf8')
const migration=fs.readFileSync('supabase/migrations/20260928213500_mlb_approved_prop_settlement_v1.sql','utf8')
const ledger=fs.readFileSync('src/services/mlb-forward-master-ledger.service.ts','utf8')
const route=fs.readFileSync('src/app/api/cron/mlb-forward-master-ledger/route.ts','utf8')

test('approved prop settlement is exact identity and fail closed',()=>{
  assert.match(settlement,/game_pk/)
  assert.match(settlement,/player_mlbam_id/)
  assert.match(settlement,/EXACT_OUTCOME_NOT_AVAILABLE/)
  assert.match(settlement,/MLB_OFFICIAL_BOXSCORE_UNAVAILABLE/)
  assert.doesNotMatch(settlement,/fuzzy/i)
})

test('RBI HRRBI and ER use exact official game boxscore',()=>{
  assert.match(settlement,/\/api\/v1\/game\/\$\{gamePk\}\/boxscore/)
  assert.match(settlement,/MLB_OFFICIAL_GAME_BOXSCORE/)
})

test('pitcher win supports postseason target and settlement schedules',()=>{
  const matches=[...win.matchAll(/gameTypes', '([^']+)'/g)].map(m=>m[1])
  assert.ok(matches.length>=2)
  for(const value of matches) assert.equal(value,'R,F,D,L,W')
})

test('settlement table matches text source id and is service-role protected',()=>{
  assert.match(migration,/approved_prop_daily_id text not null unique/i)
  assert.match(migration,/enable row level security/i)
  assert.match(migration,/revoke all .* from anon,authenticated/i)
  assert.match(migration,/grant select,insert,update .* to service_role/i)
})

test('master ledger consumes approved settlement before sync',()=>{
  assert.match(ledger,/mlb_approved_prop_settlement_v1/)
  const approved=route.indexOf('settleMlbApprovedPropDaily()')
  const exact=route.indexOf('settleMlbExactLineForwardShadows()')
  const freeze=route.indexOf('freezeMlbExactLineForwardShadows()')
  const sync=route.indexOf('syncMlb2026ForwardMasterLedger()')
  assert.ok(approved>=0 && exact>approved && freeze>exact && sync>freeze)
})
