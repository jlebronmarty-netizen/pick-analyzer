import fs from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'

const service=fs.readFileSync('src/services/mlb-external-engine-ledger-import.service.ts','utf8')
const migration=fs.readFileSync('supabase/migrations/20261001133000_mlb_external_engine_import_audit_v1.sql','utf8')
const route=fs.readFileSync('src/app/api/cron/mlb-forward-master-ledger/route.ts','utf8')
const contract=JSON.parse(fs.readFileSync('contracts/MLB_EXTERNAL_ENGINE_ARTIFACT_IMPORT_V1.json','utf8'))

test('external importer requires SHA verification',()=>{
  assert.match(service,/PE_CSV_SHA_MISMATCH/)
  assert.match(service,/EQUILIZER_CSV_SHA_MISMATCH/)
  assert.match(service,/hash\(csvText\)!==String\(manifest\.csv_sha256\)/)
})

test('Pick Edge settlement must bind to the same freeze',()=>{
  assert.match(service,/PE_SETTLEMENT_FREEZE_MISMATCH/)
  assert.equal(contract.engines.PICK_EDGE.settlement_must_reference_same_freeze,true)
})

test('Equilizer cohort excludes reconstructed Sep27',()=>{
  assert.ok(contract.engines.EQUILIZER.excluded_dates.includes('2026-09-27'))
  assert.ok(!contract.engines.EQUILIZER.original_regular_season_cohort_dates.includes('2026-09-27'))
  assert.match(service,/EQUILIZER_ORIGINAL_COHORT_NON_REGULAR_GAME/)
})

test('external probability observations are not recommendations',()=>{
  assert.match(service,/recommendation:false/)
  assert.equal(contract.engines.PICK_EDGE.recommendation,false)
  assert.equal(contract.engines.EQUILIZER.recommendation,false)
})

test('external import failure is non-blocking to internal ledger sync',()=>{
  assert.match(route,/MLB_EXTERNAL_ENGINE_IMPORT_FAILED_NON_BLOCKING/)
  const external=route.indexOf('importMlbExternalEngineArtifacts()')
  const internal=route.indexOf('syncMlb2026ForwardMasterLedger()')
  assert.ok(external>=0 && internal>external)
})

test('audit table is service-role-only',()=>{
  assert.match(migration,/enable row level security/i)
  assert.match(migration,/revoke all .* from anon,authenticated/i)
  assert.match(migration,/grant select,insert,update .* to service_role/i)
})
