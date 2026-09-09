import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import ts from 'typescript'
import { timingSafeEqual } from 'node:crypto'
import { reviewSchemaCatalog } from '../supabase/functions/mlb-operational-preflight/review.mjs'
import { assertAutomationActivation } from './mlb-operational-automation.mjs'
const root = 'supabase/functions/mlb-operational-preflight/'
const contract = JSON.parse(fs.readFileSync(`${root}contract.json`, 'utf8'))
// Structural test inputs only; no production sample file is needed to reproduce.
const catalog = {
  checkedAt: new Date().toISOString(),
  columns: contract.expected.map(c => ({ table_name: c.table, column_name: c.column, data_type: c.type, is_nullable: c.nullable, physical_type: c.physical })),
  constraints: contract.constraints.map(c => ({ ...c, convalidated: !c.definition.endsWith('NOT VALID') })), indexes: contract.indexes,
  integrity: contract.indexes.filter(i => i.index_name.endsWith('_snapshot_uidx')).map(i => ({ table_name: i.table_name, rows: 0, orphans: 0 })),
  historicalChecks: [...new Set(contract.constraints.map(c => c.table_name))].map(table_name => ({ table_name, violating_rows: 0 })),
}
const checks = []
const test = async (name, run) => { await run(); checks.push({ name, status: 'PASS' }) }
const review = c => reviewSchemaCatalog(c, c.historicalChecks, contract.expected, contract.constraints, contract.indexes)
await test('Certified structural catalog passes', () => assert.equal(review(catalog).status, 'PASS'))
for (const [name, mutate] of [
  ['missing table', c => { c.columns = c.columns.filter(x => x.table_name !== 'pick2_mlb_games') }],
  ['missing column', c => { c.columns = c.columns.slice(1) }],
  ['missing index', c => { c.indexes = c.indexes.slice(1) }],
  ['invalid index', c => { c.indexes[0].indisvalid = false }],
  ['snapshot orphan', c => { c.integrity[0].orphans = 1 }],
  ['foreign key drift', c => { c.constraints = c.constraints.filter(x => x.contype !== 'f') }],
]) await test(name, () => { const c = structuredClone(catalog); mutate(c); assert.equal(review(c).status, 'FAIL') })
await test('All certified schema manifests match generated contract', () => {
  const expected = [], constraints = []
  const load = name => JSON.parse(fs.readFileSync(`docs/CERTIFICATION/${name}`, 'utf8'))
  for (const name of ['MLB_OPERATIONAL_FEATURE_SCHEMA_REVIEW.json', 'MLB_OPERATIONAL_DOWNSTREAM_SCHEMA_REVIEW.json']) {
    const manifest = load(name)
    for (const table of manifest.schema) for (const col of table.columns) expected.push({ table: table.table_name, column: col.column, type: col.type, nullable: col.nullable, physical: col.physical_type })
    constraints.push(...manifest.constraints.filter(c => c.contype !== 'u'))
  }
  for (const col of load('MLB_OPERATIONAL_NATIVE_SCHEMA_REVIEW.json').columns) expected.push({ table: col.table_name, column: col.column_name, type: col.data_type, nullable: col.is_nullable })
  for (const col of load('MLB_OPERATIONAL_RAW_SCHEMA_REVIEW.json').columns) expected.push({ table: 'pick2_raw_mlb_statcast_pitches', column: col.column, type: col.type, nullable: col.nullable })
  assert.deepEqual(contract.expected, JSON.parse(JSON.stringify(expected)))
  assert.deepEqual(contract.constraints, constraints)
})
const generated = fs.readFileSync(`${root}query.ts`, 'utf8')
const query = JSON.parse(generated.slice(generated.indexOf('export const query = ') + 21).trim())
await test('Fixed SQL is exact canonical SELECT; no caller SQL', () => {
  assert.equal(query, fs.readFileSync('scripts/mlb-operational-schema-preflight.sql', 'utf8').replaceAll('\r\n', '\n'))
  assert.match(query, /^select /)
  assert.doesNotMatch(query, /\b(insert|update|delete|create|alter|drop|truncate)\b/i)
})
let handler, calls = 0, mode, failure = false, sawQuery = false
const env = { SUPABASE_SERVICE_ROLE_KEY: 'TEST_ONLY_FAKE_CREDENTIAL', SUPABASE_DB_URL: 'TEST_ONLY_FAKE_CONNECTION' }
const transaction = async () => []
transaction.unsafe = async q => { assert.equal(q, query); sawQuery = true; if (failure) throw Error('PRIVATE_DRIVER_ERROR'); return [{ evidence: catalog }] }
const source = fs.readFileSync(`${root}index.ts`, 'utf8').replace(/^import .*\n/gm, '')
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
vm.runInNewContext(code, { Deno: { env: { get: k => env[k] }, serve: h => { handler = h } }, TextEncoder, Response, URL, timingSafeEqual, query, contract, reviewSchemaCatalog,
  postgres: () => { calls++; return { begin: async (m, fn) => { mode = m; return fn(transaction) }, end: async () => {} } } })
const request = (method = 'GET', auth = 'Bearer TEST_ONLY_FAKE_CREDENTIAL', suffix = '') => new Request(`https://example.test/preflight${suffix}`, { method, headers: { authorization: auth } })
await test('Anonymous/wrong role blocked before DB access', async () => { assert.equal((await handler(request('GET', ''))).status, 401); assert.equal((await handler(request('GET', 'Bearer OTHER_TEST_ROLE'))).status, 401); assert.equal(calls, 0) })
await test('Request SQL/POST forbidden before DB access', async () => { assert.equal((await handler(request('POST'))).status, 400); assert.equal((await handler(request('GET', 'Bearer TEST_ONLY_FAKE_CREDENTIAL', '?sql=select'))).status, 400); assert.equal(calls, 0) })
await test('Missing DB connection fails closed', async () => { delete env.SUPABASE_DB_URL; assert.equal((await handler(request())).status, 503); assert.equal(calls, 0); env.SUPABASE_DB_URL = 'TEST_ONLY_FAKE_CONNECTION' })
await test('Authenticated fixed query uses read-only transaction', async () => { const r = await handler(request()); assert.equal(r.status, 200); assert.equal((await r.json()).status, 'PASS'); assert.equal(mode, 'read only'); assert.ok(sawQuery) })
await test('Modern Supabase server secret accepted; unknown and anon keys still rejected', async () => {
  env.SUPABASE_SECRET_KEYS = JSON.stringify({ default: 'TEST_ONLY_FAKE_MODERN_SECRET' })
  assert.equal((await handler(request('GET', 'Bearer TEST_ONLY_FAKE_MODERN_SECRET'))).status, 200)
  assert.equal((await handler(request('GET', 'Bearer TEST_ONLY_FAKE_ANON_KEY'))).status, 401)
  delete env.SUPABASE_SECRET_KEYS
})
await test('Driver error redacted and fail closed', async () => { failure = true; const r = await handler(request()); assert.equal(r.status, 503); assert.doesNotMatch(await r.text(), /PRIVATE_DRIVER_ERROR|TEST_ONLY_FAKE/) })
const serviceSource = fs.readFileSync('src/services/pick2-mlb-unattended-preflight.ts', 'utf8').replace(/^import .*\n/gm, '').replace('export async function', 'async function')
const serviceCode = ts.transpileModule(serviceSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const cert = JSON.parse(fs.readFileSync('docs/CERTIFICATION/MLB_DATA_02R_R2T_R3_LIVE_REENABLEMENT_CERTIFICATION.json', 'utf8'))
const good = { ...review(catalog), checkedAt: new Date().toISOString(), projectRef: 'ynuocvexviorgdjrfthw', connection: { transaction: 'READ_ONLY', serverOnly: true } }
async function serviceTest({ certificate = cert, result = good, http = 200, credentials = true } = {}) {
  const context = vm.createContext({ certificate, process: { env: credentials ? { NEXT_PUBLIC_SUPABASE_URL: 'https://ynuocvexviorgdjrfthw.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'TEST_ONLY_FAKE_CREDENTIAL' } : {} }, Date, AbortSignal, setTimeout,
    fetch: async () => new Response(JSON.stringify(result), { status: http }) })
  vm.runInContext(serviceCode, context)
  return vm.runInContext('runMlbOperationalSchemaPreflight()', context)
}
await test('Shared server client accepts fresh complete preflight', async () => assert.equal((await serviceTest()).status, 'PASS'))
for (const [name, change] of [['Champion', { champion: 'WRONG' }], ['76-feature', { featureCount: 75 }], ['Feature version', { featureSet: 'WRONG' }], ['Policy', { policy: 'WRONG' }]]) await test(`${name} drift fails closed`, async () => assert.rejects(serviceTest({ certificate: { ...cert, ...change } })))
await test('Runtime credential failure blocks', async () => assert.rejects(serviceTest({ credentials: false })))
await test('HTTP failure blocks', async () => assert.rejects(serviceTest({ http: 503 })))
await test('Expired preflight blocks', async () => assert.rejects(serviceTest({ result: { ...good, checkedAt: '2020-01-01T00:00:00Z' } })))
await test('Clock lead beyond bounded wait blocks', async () => assert.rejects(serviceTest({ result: { ...good, checkedAt: new Date(Date.now() + 60000).toISOString() } })))
await test('Server caller rejects orphan contract', async () => assert.rejects(serviceTest({ result: { ...good, orphanSnapshotReferences: 1 } })))
const tickSource = fs.readFileSync('scripts/mlb-operational-tick.mjs', 'utf8')
const tickCode = tickSource.slice(0, tickSource.indexOf('if (process.argv[1]')).replace(/^import .*\n/gm, '').replace('export async function', 'async function')
for (const vercel of [false, true]) await test(vercel ? 'Ephemeral Vercel host blocks before runtime work' : 'Unverified persistent host blocks before runtime work', async () => {
  const activation = JSON.parse(fs.readFileSync('docs/CERTIFICATION/MLB_OPERATIONAL_AUTOMATION_ACTIVATION.json', 'utf8'))
  activation.activation = 'ENABLED'; activation.runtimeHost = { verified: vercel }
  const context = vm.createContext({ fs: { readFileSync: () => JSON.stringify(activation) }, assertAutomationActivation, process: { env: vercel ? { VERCEL: '1' } : {} } })
  vm.runInContext(tickCode, context)
  await assert.rejects(vm.runInContext('executeProductionTick({mode:"PREGAME",packageSha:"a".repeat(40)})', context), /PERSISTENT_HOST_REQUIRED/)
})
const report = { status: 'PASS', checks, providerCalls: 0, productionDml: 0, productionDdl: 0 }
const output = path.join(os.tmpdir(), 'pick-analyzer-operational-mission/r4-validation.json')
fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(output, JSON.stringify(report, null, 2))
console.log(JSON.stringify(report))
