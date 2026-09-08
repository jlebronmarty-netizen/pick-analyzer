// Disposable PostgreSQL validation only. Never connects to production.
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
import { sha256 } from './mlb-data-02r-r2f-stage-contracts.mjs'
import { buildPregameFeatureRows, assemblePregameVector } from './mlb-data-02r-r2t-r1-pregame-contract.mjs'
import { inferChampion } from './mlb-data-02r-r2t-real-feature-champion.mjs'
import { featureInsertRowsForDomain, comparableFeatureRow, resolveCanonicalFeatureSnapshotIds, bindFeatureRowsToSnapshotIds, classifyBoundDailyFeatures, R2I_LIVE_TARGETS } from './mlb-data-02r-r2i-live-execution-interfaces.mjs'

const root = process.env.R2S_VALIDATION_DIR
if (!root || !process.env.R1_READ_CACHE) throw new Error('ISOLATED_VALIDATION_REQUIRED')
const { PGlite } = await import(pathToFileURL(path.join(root, 'validation-tools/node_modules/@electric-sql/pglite/dist/index.js')))
const db = new PGlite()
const manifest = JSON.parse(fs.readFileSync('docs/CERTIFICATION/MLB_OPERATIONAL_FEATURE_SCHEMA_REVIEW.json', 'utf8'))
const migration = fs.readFileSync('docs/CERTIFICATION/MLB_OPERATIONAL_FEATURE_SNAPSHOT_UNIQUENESS_PROPOSED.sql', 'utf8')
const r1 = JSON.parse(fs.readFileSync('docs/CERTIFICATION/MLB_DATA_02R_R2T_R1_PREGAME_EVIDENCE_PROVENANCE_AND_TARGET_BINDING.json', 'utf8'))
const cache = JSON.parse(fs.readFileSync(process.env.R1_READ_CACHE, 'utf8'))
assert.equal(sha256(cache.dependencies), r1.dependencyEvidence.digest)
const { target, starters } = r1.selected
const built = buildPregameFeatureRows({ target, starters, rawRows: cache.dependencies.rows, dependencyGamePks: cache.dependencies.dependencyGamePks })
const checks = []
const check = (name, condition) => { assert.ok(condition, name); checks.push({ name, status: 'PASS' }) }
for (const name of ['sports_teams', 'sport_players', 'sport_events']) await db.exec(`create table public.${name} (id text primary key)`)
await db.query('insert into sports_teams(id) values ($1),($2)', [target.homeTeamId, target.awayTeamId])
for (const table of manifest.schema) {
  const columns = table.columns.map((c) => {
    const type = c.type === 'ARRAY' ? 'bigint[]' : c.type
    const defaultValue = c.column === 'id' ? ' default gen_random_uuid()' : c.column === 'created_at' ? ' default now()' : type === 'jsonb' ? " default '{}'::jsonb" : type === 'bigint[]' ? " default '{}'::bigint[]" : ''
    return `${c.column} ${type}${defaultValue}${c.nullable === 'NO' ? ' not null' : ''}`
  })
  await db.exec(`create table public.${table.table_name} (${columns.join(', ')})`)
}
await db.exec('alter table pick2_feature_snapshots add primary key(id); create unique index snapshots_identity on pick2_feature_snapshots(deterministic_identity)')
for (const index of manifest.indexes.filter((i) => !manifest.constraints.some((c) => c.contype === 'u' && c.conname === i.indexname))) await db.exec(index.indexdef)
for (const c of manifest.constraints.filter((c) => c.contype !== 'p')) await db.exec(`alter table public.${c.table_name} add constraint ${c.conname} ${c.definition}`)
const domains = ['team', 'starter', 'bullpen', 'batter', 'matchup', 'firstInning']
const tableFor = (domain) => domain === 'snapshots' ? R2I_LIVE_TARGETS.featureSnapshots : R2I_LIVE_TARGETS[domain]
const selectAll = async (table) => (await db.query(`select to_jsonb(t) as row from public.${table} t order by id`)).rows.map((x) => x.row)
const repository = {
  async readFeatureRows(domain, ids) { return (await selectAll(tableFor(domain))).map((r) => comparableFeatureRow(domain, r)).filter((r) => ids.includes(r.identity)) },
  async insertFeatureRows(domain, rows, cap) {
    assert.ok(rows.length <= cap)
    const stored = []
    for (const payload of featureInsertRowsForDomain(domain, rows)) {
      const table = tableFor(domain), fields = Object.keys(payload).join(',')
      const result = await db.query(`with inserted as (insert into public.${table} (${fields}) select ${fields} from jsonb_populate_record(null::public.${table}, $1::jsonb) returning *) select to_jsonb(inserted) as row from inserted`, [JSON.stringify(payload)])
      stored.push(result.rows[0].row)
    }
    return { rows: stored, inserted: stored.length }
  },
}
await repository.insertFeatureRows('snapshots', built.rows.snapshots, 10)
const ids = await resolveCanonicalFeatureSnapshotIds({ repository, plannedSnapshotRows: built.rows.snapshots })
const bound = bindFeatureRowsToSnapshotIds(built.rows, ids)
const caps = Object.fromEntries(domains.map((d) => [d, bound[d].length]))
await classifyBoundDailyFeatures(repository, bound, [target.gamePk], caps)
for (const domain of domains) await repository.insertFeatureRows(domain, bound[domain], caps[domain])
const actualRows = { snapshots: await selectAll('pick2_feature_snapshots'), offense: 2 }
for (const domain of domains) actualRows[domain] = await selectAll(tableFor(domain))
const vector = assemblePregameVector({ target, starters, built })
const actualVector = assemblePregameVector({ target, starters, built: { ...built, rows: actualRows } })
check('PostgreSQL typed persistence preserves all 76 real values', sha256(vector.values) === sha256(actualVector.values))
check('PostgreSQL persisted Champion inference parity', inferChampion({ vector }).artifact.home_probability === inferChampion({ vector: actualVector }).artifact.home_probability)
const second = await classifyBoundDailyFeatures(repository, bound, [target.gamePk], caps)
check('PostgreSQL defaults and timestamp readback reuse all eight rows', Object.values(second.plans).reduce((sum, p) => sum + p.reuseNoOp, 0) === 8)
// A separate real stored batter row exercises the physical batter table; it
// is never added to the selected moneyline case or its legitimately empty plan.
const batterCache = process.env.BATTER_READ_CACHE
if (!batterCache || !path.isAbsolute(batterCache) || !path.relative(process.cwd(), batterCache).startsWith('..')) throw new Error('PRIVATE_EXTERNAL_BATTER_CACHE_REQUIRED')
const batterSample = JSON.parse(fs.readFileSync(batterCache, 'utf8'))
const batterSnapshot = await repository.insertFeatureRows('snapshots', [batterSample.snapshot], 1)
const { id: oldBatterId, created_at: oldBatterCreated, ...batterPayload } = batterSample.daily
void oldBatterId
void oldBatterCreated
batterPayload.feature_snapshot_id = batterSnapshot.rows[0].id
await repository.insertFeatureRows('batter', [batterPayload], 1)
actualRows.snapshots.push(batterSnapshot.rows[0])
check('separate real historical batter sample inserted for schema testing', batterSample.daily.target_game_pk !== target.gamePk)
// Constraint-only probe: a different as-of snapshot reference. These modified
// rows are never represented as newly acquired pregame evidence or inference.
const probes = []
for (const domain of domains) {
  const prior = domain === 'batter' ? batterPayload : bound[domain][0]
  const source = actualRows.snapshots.find((s) => s.id === prior.feature_snapshot_id)
  const nextDate = new Date(Date.parse(`${source.as_of_date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10)
  const probeDate = nextDate < source.feature_date ? nextDate : new Date(Date.parse(`${source.as_of_date}T00:00:00Z`) - 86400000).toISOString().slice(0, 10)
  const snapshot = { ...source, deterministic_identity: `${source.deterministic_identity}:constraint-probe`, as_of_date: probeDate, as_of_timestamp: `${probeDate}T00:00:00Z` }
  const result = await repository.insertFeatureRows('snapshots', [snapshot], 1)
  const row = { ...prior, feature_snapshot_id: result.rows[0].id, as_of_date: snapshot.as_of_date, as_of_timestamp: snapshot.as_of_timestamp }
  await assert.rejects(() => repository.insertFeatureRows(domain, [row], 1), (e) => e.code === '23505')
  probes.push({ domain, row })
  check(`${domain} old physical uniqueness blocks distinct as-of snapshot`, true)
}
const before = {}
for (const domain of domains) before[domain] = await selectAll(tableFor(domain))
await db.exec(migration)
const rollback = fs.readFileSync('docs/CERTIFICATION/MLB_OPERATIONAL_FEATURE_SNAPSHOT_UNIQUENESS_ROLLBACK.sql', 'utf8')
await db.exec(rollback)
const restoredIndexes = (await db.query("select indexname,indexdef from pg_indexes where schemaname='public' and tablename = any($1::text[]) order by indexname", [manifest.counts.map((r) => r.table_name)])).rows
const expectedIndexes = manifest.indexes.map(({ indexname, indexdef }) => ({ indexname, indexdef })).sort((a,b) => a.indexname.localeCompare(b.indexname))
assert.deepEqual(restoredIndexes, expectedIndexes)
check('exact rollback restores all original indexes and constraints before revisions', true)
await db.exec(migration)
for (const domain of domains) check(`${domain} migration preserves exact existing rows`, sha256(before[domain]) === sha256(await selectAll(tableFor(domain))))
const fkCount = (await db.query("select count(*)::int as n from pg_constraint where contype='f'")).rows[0].n
check('all feature foreign keys preserved by migration', fkCount === manifest.constraints.filter((c) => c.contype === 'f').length)
for (const { domain, row } of probes) {
  await repository.insertFeatureRows(domain, [row], 1)
  await assert.rejects(() => repository.insertFeatureRows(domain, [row], 1), (e) => e.code === '23505')
  check(`${domain} distinct snapshot allowed and same snapshot duplicate rejected`, true)
  await assert.rejects(() => repository.insertFeatureRows(domain, [{ ...row, feature_snapshot_id: '00000000-0000-4000-8000-000000000000' }], 1), (e) => e.code === '23503')
  check(`${domain} orphan snapshot FK rejected after migration`, true)
}
await assert.rejects(() => db.exec(migration), /SCHEMA_DRIFT/)
await db.exec('rollback')
check('migration repeat or schema drift fails closed', true)
const revisedRows = Object.fromEntries(await Promise.all(domains.map(async (d) => [d, await selectAll(tableFor(d))])))
await assert.rejects(() => db.exec(rollback), (e) => e.code === '23505')
await db.exec('rollback')
for (const domain of domains) assert.deepEqual(await selectAll(tableFor(domain)), revisedRows[domain])
check('rollback with revision conflicts aborts and preserves every row', true)
const report = { generatedAt: new Date().toISOString(), status: 'DISPOSABLE_SCHEMA_AND_ROLLBACK_VALIDATED',
  engine: '@electric-sql/pglite@0.3.14', checks, migrationDigest: sha256(migration),
  realCase: target.gamePk, rowsBefore: Object.fromEntries(domains.map((d) => [d, before[d].length])),
  limitation: 'Disposable PostgreSQL validates typed real-case persistence and structural revision probes; production migration and full live path are NOT certified. Separate real historical batter sample is schema evidence only.',
  providerCalls: 0, productionDml: 0, productionDdl: 0, liveExecutionEnabled: false }
fs.writeFileSync(path.join(root, 'schema-validation.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report))
await db.close()
