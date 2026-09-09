// Offline-only validation of the proposed R6 migration, not runtime certification.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'

const dependency = process.env.R6_PGLITE_MODULE
if (!dependency || !path.isAbsolute(dependency)) throw Error('EXTERNAL_PGLITE_MODULE_REQUIRED')
const { PGlite } = await import(pathToFileURL(dependency).href)
const db = new PGlite()
const file = 'supabase/migrations/20260909210219_mlb_r6_durable_runtime_state.sql'
const sql = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
const checks = []
const check = async (name, fn) => { await fn(); checks.push({ name, status: 'PASS' }) }
const rejected = async (query, code = '23514') => assert.rejects(db.exec(query), e => e.code === code)
try {
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role; CREATE TABLE public.existing_sentinel (id integer primary key, value text); INSERT INTO public.existing_sentinel VALUES (1,\'preserve\'); ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;')
  await check('Exact proposed migration applies in disposable PostgreSQL', () => db.exec(sql))
  await check('Existing table and row preserved', async () => assert.deepEqual((await db.query('SELECT * FROM existing_sentinel')).rows, [{ id: 1, value: 'preserve' }]))
  await check('Migration seeds no runtime rows or budget', async () => assert.equal((await db.query('SELECT count(*)::int AS n FROM pick2_mlb_runtime_state')).rows[0].n, 0))
  await check('RLS enabled', async () => assert.equal((await db.query("SELECT relrowsecurity FROM pg_class WHERE oid='public.pick2_mlb_runtime_state'::regclass")).rows[0].relrowsecurity, true))
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`SET ROLE ${role}`)
    for (const [operation, query] of Object.entries({ read: 'SELECT * FROM pick2_mlb_runtime_state', insert: "INSERT INTO pick2_mlb_runtime_state(scope_key,state_kind) VALUES ('MLB_OPERATIONAL_GLOBAL','LEASE')", update: "UPDATE pick2_mlb_runtime_state SET revision=1", delete: 'DELETE FROM pick2_mlb_runtime_state', truncate: 'TRUNCATE pick2_mlb_runtime_state' })) {
      await check(`${role} ${operation} denied`, () => rejected(query, '42501'))
    }
    await db.exec('RESET ROLE')
  }
  await db.exec('SET ROLE service_role')
  await check('Service role seeds known mission usage at two', () => db.exec("INSERT INTO pick2_mlb_runtime_state(scope_key,state_kind,mission_odds_calls) VALUES ('MLB_OPERATIONAL_MISSION','MISSION',2)"))
  await check('Mission counter cannot reset to zero', () => rejected("UPDATE pick2_mlb_runtime_state SET mission_odds_calls=0 WHERE state_kind='MISSION'"))
  await check('Mission counter accepts twenty', () => db.exec("UPDATE pick2_mlb_runtime_state SET mission_odds_calls=20 WHERE state_kind='MISSION'"))
  await check('Mission counter rejects twenty-one', () => rejected("UPDATE pick2_mlb_runtime_state SET mission_odds_calls=21 WHERE state_kind='MISSION'"))
  await check('Single mission identity enforced', () => rejected("INSERT INTO pick2_mlb_runtime_state(scope_key,state_kind,mission_odds_calls) VALUES ('ANOTHER_MISSION','MISSION',2)"))
  await check('Service role can create compact run metadata', () => db.exec("INSERT INTO pick2_mlb_runtime_state(scope_key,state_kind,run_id,package_sha,run_date,run_as_of,checkpoint) VALUES ('RUN:test-run','RUN','test-run',repeat('a',40),'2026-09-09','2026-09-09T12:00:00Z','{\"stage\":\"NATIVE\",\"sourceDigests\":[],\"references\":[]}')"))
  await check('Duplicate run identity rejected', () => rejected("INSERT INTO pick2_mlb_runtime_state SELECT * FROM pick2_mlb_runtime_state WHERE state_kind='RUN'", '23505'))
  for (const [column, value] of [['mlb_official_calls', 51], ['statcast_calls', 101], ['odds_calls', 2]]) await check(`${column} hard ceiling`, () => rejected(`UPDATE pick2_mlb_runtime_state SET ${column}=${value} WHERE state_kind='RUN'`))
  await check('Oversized checkpoint rejected', () => rejected("UPDATE pick2_mlb_runtime_state SET checkpoint=jsonb_build_object('raw',repeat('x',65536)) WHERE state_kind='RUN'"))
  await check('Nonobject checkpoint rejected', () => rejected("UPDATE pick2_mlb_runtime_state SET checkpoint='[]' WHERE state_kind='RUN'"))
  await check('Oversized DML metadata rejected', () => rejected("UPDATE pick2_mlb_runtime_state SET dml_accounting=jsonb_build_object('raw',repeat('x',16384)) WHERE state_kind='RUN'"))
  await check('Partial lease rejected', () => rejected("INSERT INTO pick2_mlb_runtime_state(scope_key,state_kind,lease_holder) VALUES ('MLB_OPERATIONAL_GLOBAL','LEASE','00000000-0000-4000-8000-000000000001')"))
  await check('Bounded lease schema accepted', () => db.exec("INSERT INTO pick2_mlb_runtime_state(scope_key,state_kind,lease_holder,lease_acquired_at,lease_expires_at) VALUES ('MLB_OPERATIONAL_GLOBAL','LEASE','00000000-0000-4000-8000-000000000001',now(),now()+interval '5 minutes')"))
  await check('Excessive lease interval rejected', () => rejected("UPDATE pick2_mlb_runtime_state SET lease_expires_at=lease_acquired_at+interval '16 minutes' WHERE state_kind='LEASE'"))
  await check('Service role delete denied', () => rejected('DELETE FROM pick2_mlb_runtime_state', '42501'))
  await check('Service role truncate denied', () => rejected('TRUNCATE pick2_mlb_runtime_state', '42501'))
  const result = { status: 'PASS', certificationScope: 'PROPOSED_SCHEMA_ONLY', migration: file, normalizedSha256: createHash('sha256').update(sql).digest('hex'), checks, productionDdl: 0, productionDml: 0, providerCalls: 0, runtimeGatesCertified: false }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pick-analyzer-r6-schema-'))
  fs.writeFileSync(path.join(dir, 'validation.json'), JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result))
} finally { await db.close() }
