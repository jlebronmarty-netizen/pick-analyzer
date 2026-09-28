import fs from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'

const migration=fs.readFileSync('supabase/migrations/20260928204500_mlb_2026_forward_master_ledger_v1.sql','utf8')
const service=fs.readFileSync('src/services/mlb-forward-master-ledger.service.ts','utf8')
const contract=JSON.parse(fs.readFileSync('contracts/MLB_2026_FORWARD_MASTER_LEDGER_V1.json','utf8'))

test('ledger schema is research-only and service-role protected',()=>{
  assert.match(migration,/enable row level security/i)
  assert.match(migration,/revoke all on table public\.mlb_2026_forward_master_ledger_v1 from anon, authenticated/i)
  assert.match(migration,/grant select, insert, update .* to service_role/i)
  assert.match(migration,/check \(research_only = true\)/i)
  assert.match(migration,/check \(production_eligible = false\)/i)
  assert.match(migration,/check \(apostar_enabled = false\)/i)
})

test('ledger preserves phase separation and nullable probability semantics',()=>{
  assert.deepEqual(contract.season_phase_values,['REGULAR_SEASON','POSTSEASON'])
  assert.match(service,/POSTSEASON_SHADOW_DOMAIN_SHIFT/)
  assert.match(service,/model_probability:/)
  assert.match(service,/NO_CALIBRATED_PER_PLAY_PROBABILITY/)
})

test('synchronizer consumes frozen sources instead of model recalculation',()=>{
  assert.match(service,/mlb_ml_opening_consensus_v2_forward_v1/)
  assert.match(service,/mlb_approved_prop_daily_v1/)
  assert.match(service,/mlb_exact_line_forward_shadow_v1/)
  assert.match(service,/runline_v2_standard_forward_freeze_v1/)
  assert.match(service,/runline_v2_home_p15_alt_forward_freeze_v1/)
  assert.doesNotMatch(service,/BALLDONTLIE_API_KEY|ODDS_API_KEY|api\.balldontlie|the-odds-api/i)
})

test('cron settles then freezes exact-line rows before master sync',()=>{
  const route=fs.readFileSync('src/app/api/cron/mlb-forward-master-ledger/route.ts','utf8')
  const settle=route.indexOf('settleMlbExactLineForwardShadows()')
  const freeze=route.indexOf('freezeMlbExactLineForwardShadows()')
  const sync=route.indexOf('syncMlb2026ForwardMasterLedger()')
  assert.ok(settle>=0 && freeze>settle && sync>freeze)
})
