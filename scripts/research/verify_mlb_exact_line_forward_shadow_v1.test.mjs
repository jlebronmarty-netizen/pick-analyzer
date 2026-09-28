import fs from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'

const migration=fs.readFileSync('supabase/migrations/20260928211000_mlb_exact_line_forward_shadow_v1.sql','utf8')
const service=fs.readFileSync('src/services/mlb-exact-line-forward-shadow.service.ts','utf8')
const contract=JSON.parse(fs.readFileSync('contracts/MLB_EXACT_LINE_FORWARD_SHADOW_V1.json','utf8'))

test('exact-line contract registry is frozen',()=>{
  assert.deepEqual(
    contract.contracts.map((x)=>[x.market,x.direction,x.line,x.threshold]),
    [
      ['pitcher_strikeouts','OVER',3.5,4.25],
      ['pitcher_strikeouts','UNDER',7.5,5.5],
      ['pitcher_strikeouts','UNDER',8.5,4.75],
      ['pitcher_outs','OVER',13.5,16],
      ['pitcher_outs','OVER',14.5,15.75],
    ]
  )
})

test('selection is strict-prior exact-side and price independent',()=>{
  assert.match(service,/\.lt\('game_date', targetDate\)/)
  assert.match(service,/normalized === contract\.direction/)
  assert.match(service,/selectionIndependentOfPrice: true/)
  assert.doesNotMatch(service,/outcome.*YES.*OVER|YES.*OVER/i)
})

test('settlement uses exact gamePk and exact pitcher identity',()=>{
  assert.match(service,/\.in\('game_pk', gamePks\)/)
  assert.match(service,/\.in\('pitcher', pitcherIds\)/)
  assert.match(service,/actual > line \? 'WIN' : 'LOSS'/)
})

test('table is service-role-only research evidence',()=>{
  assert.match(migration,/enable row level security/i)
  assert.match(migration,/revoke all .* from anon, authenticated/i)
  assert.match(migration,/grant select, insert, update .* to service_role/i)
})
