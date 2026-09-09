// Independent read-only certification of a completed private live run.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseProductionRepository } from './mlb-data-02r-r2i-live-execution-interfaces.mjs'
import { persistDownstreamRows, DOWNSTREAM_BINDINGS } from './mlb-data-02r-r2t-downstream-persistence.mjs'
import { buildPregameFeatureRows, assemblePregameVector } from './mlb-data-02r-r2t-r1-pregame-contract.mjs'
import { inferChampion } from './mlb-data-02r-r2t-real-feature-champion.mjs'
import { sha256 } from './mlb-data-02r-r2f-stage-contracts.mjs'
const id = process.argv[2]
assert.match(id ?? '', /^mlb-operational-[a-f0-9-]+$/)
const root = path.join(os.tmpdir(), 'pick-analyzer-mlb-operational-live')
const read = name => JSON.parse(fs.readFileSync(path.join(root, name + '.json'), 'utf8'))
const result = read('result-' + id), manifest = read(id)
assert.equal(result.status, 'CANONICAL_STAGES_READBACK_COMPLETE')
assert.ok(result.eligibleGamePks.length > 0)
let requests = 0
const origin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
const client = createClient(origin, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false }, global: { fetch: async (url, options = {}) => {
  assert.equal(new URL(url).origin, origin)
  assert.ok(['GET', 'HEAD'].includes(options.method ?? 'GET'))
  assert.ok(!new URL(url).pathname.includes('/rpc/'))
  requests++
  return fetch(url, options)
} } })
const repository = createSupabaseProductionRepository({ client })
const features = {}, linkage = []
for (const [domain, planned] of Object.entries(result.features.rows)) {
  if (domain === 'offense') continue
  const rows = await repository.readFeatureRows(domain, planned.map(r => r.identity), planned)
  assert.equal(rows.length, planned.length)
  const expected = new Map(planned.map(r => [r.identity, sha256(r)]))
  rows.forEach(r => assert.equal(sha256(r), expected.get(r.identity)))
  features[domain] = rows
  linkage.push({ domain, rows: rows.length, exactReadback: 'PASS', applicability: rows.length ? 'PRESENT' : 'NO_CERTIFIED_CURRENT_INPUT' })
}
const snapshots = new Map(features.snapshots.map(r => [r.id, r]))
for (const domain of ['team', 'starter', 'bullpen', 'batter', 'matchup', 'firstInning']) {
  for (const row of features[domain]) { const s = snapshots.get(row.feature_snapshot_id); assert.ok(s); assert.equal(s.target_game_pk, row.target_game_pk) }
}
const groups = { predictions: result.predictions, marketMappings: result.markets.mappings, marketObservations: result.markets.observations, values: result.values, officialPicks: result.picks }
const idempotency = []
for (const [domain, group] of Object.entries(groups)) {
  const rows = group.rows.map(row => Object.fromEntries(Object.entries(row).filter(([k]) => !['id', 'created_at', 'updated_at'].includes(k))))
  const check = await persistDownstreamRows({ domain, rows, repository, eligibleGamePks: result.eligibleGamePks, cap: 0, beforeWrite: () => { throw Error('READBACK_MUTATION_FORBIDDEN') } })
  assert.equal(check.inserted, 0); assert.equal(check.readback.blockConflict, 0)
  idempotency.push({ domain, target: DOWNSTREAM_BINDINGS[domain].table, reused: check.readback.reuseNoOp, inserts: 0, conflicts: 0 })
}
let vectors = 0
const scheduled = new Map()
for (const part of manifest.privateContextShards.parts) {
  const context = read(part.key); assert.equal(sha256(context), part.digest)
  const { target, starters, dependencies } = context
  scheduled.set(target.gamePk, target.scheduledAt)
  const built = buildPregameFeatureRows({ target, starters, rawRows: dependencies.rows, dependencyGamePks: dependencies.dependencyGamePks })
  const rows = Object.fromEntries(Object.entries(features).map(([d, list]) => [d, list.filter(r => r.target_game_pk === target.gamePk)]))
  const vector = assemblePregameVector({ target, starters, built: { ...built, rows } })
  const prediction = result.predictions.rows.find(p => p.game_pk === target.gamePk)
  assert.equal(vector.values.length, 76); assert.equal(sha256(vector.values), prediction.metadata.vector_digest)
  const inference = inferChampion({ vector }).artifact
  assert.ok(Math.abs(inference.home_probability - prediction.home_probability) < 1e-12)
  assert.ok(Math.abs(inference.away_probability - prediction.away_probability) < 1e-12)
  vectors++
}
for (const [group, field] of [[result.predictions, 'predicted_at'], [result.values, 'evaluated_at'], [result.picks, 'decision_at']]) {
  group.rows.forEach(row => assert.ok(Date.parse(row[field]) < Date.parse(scheduled.get(row.game_pk))))
}
const journal = read('writes-' + id)
assert.ok(journal.entries.every(e => e.state === 'APPLIED' && e.rows.length <= e.cap))
const report = { status: 'NONEMPTY_LIVE_READBACK_CERTIFIED', runId: id, packageSha: result.runContext.execution_package_sha, runAsOf: result.runContext.run_as_of,
  eligibleGames: result.eligibleGamePks, blockedGames: result.blockedGames, linkage, vectors, featureCount: 76, championParity: 'PASS', idempotency,
  predictions: result.predictions.rows.length, observations: result.markets.observations.rows.length, values: result.values.rows.length, officialPicks: result.picks.rows.length,
  providers: result.providerAccounting, inserted: journal.entries.filter(e => e.operation === 'INSERT').reduce((n, e) => n + e.rows.length, 0),
  updated: journal.entries.filter(e => e.operation === 'UPDATE').reduce((n, e) => n + e.rows.length, 0), startedGameLeakage: 0, conflicts: 0,
  readOnlyDatabaseRequests: requests, verificationProviderCalls: 0, verificationDml: 0, productionDdl: 0 }
fs.writeFileSync(path.join(os.tmpdir(), 'pick-analyzer-operational-mission', id + '-certification.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report))
