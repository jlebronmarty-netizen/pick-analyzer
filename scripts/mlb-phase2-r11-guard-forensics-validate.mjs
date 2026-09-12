// Disposable, offline forensic replay. Private production evidence is supplied
// explicitly from outside the repository and is never copied to the report.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'
import { createPgliteClient } from './mlb-data-02r-r2t-pglite-client.mjs'
import { createCanonicalCertificationBindings } from './mlb-data-02r-r2t-production-bindings.mjs'
import { sanitizedStageException } from './mlb-operational-r7-errors.mjs'
import { assemblePregameVector, resolveStarterContext, resolvePregameTarget } from './mlb-data-02r-r2t-r1-pregame-contract.mjs'
import { inferChampion, validateChampionArtifact, ARTIFACT_PATH } from './mlb-data-02r-r2t-real-feature-champion.mjs'
import { restorePinnedFeaturePlan } from './mlb-operational-r6-compact-features.mjs'
import { sha256 } from './mlb-data-02r-r2f-stage-contracts.mjs'
import { persistDownstreamRows } from './mlb-data-02r-r2t-downstream-persistence.mjs'

globalThis.fetch = async () => { throw Error('NETWORK_FORBIDDEN') }
const root = process.env.R2S_VALIDATION_DIR
assert.ok(root)
const inventory = JSON.parse(fs.readFileSync(path.join(root, 'r11-inventory-private.json')))
const replay = JSON.parse(fs.readFileSync(path.join(root, 'r11-replay-private.json')))
assert.equal(replay.featureError, null)
assert.equal(replay.contexts.length, 13)
const { PGlite } = await import(pathToFileURL(path.join(root, 'validation-tools/node_modules/@electric-sql/pglite/dist/index.js')))
const db = new PGlite()
const checks = []
const check = (name, fn) => { fn(); checks.push({ name, status: 'PASS' }) }
const client = createPgliteClient(db)
await db.exec('create table sports_teams(id text, sport_key text); create table pick2_mlb_games(game_pk bigint,home_team_id text,away_team_id text,source text,metadata jsonb,season int)')
const teams = [...new Set(inventory.games.flatMap(g => [g.home_team_id, g.away_team_id]))]
assert.equal(teams.length, 30)
for (const id of teams) await db.query('insert into sports_teams values($1,$2)', [id, 'baseball_mlb'])
for (const g of inventory.games) await db.query('insert into pick2_mlb_games values($1,$2,$3,$4,$5,$6)', [g.game_pk,g.home_team_id,g.away_team_id,g.source,JSON.stringify(g.metadata),g.season])
let payload = structuredClone(inventory.schedule.evidence.payload), requests = 0
const runContext = { run_id: inventory.run.run_id, run_date: inventory.run.run_date,
  run_as_of: new Date(inventory.run.run_as_of).toISOString(), execution_package_sha: inventory.run.package_sha }
const documents = new Map()
const store = { root, locked: true, referenceOnly: true, load: key => documents.get(key) ?? null, save: (key,value) => documents.set(key,value) }
const bindings = await createCanonicalCertificationBindings({ client,
  repository: { executionEnvironment: 'DISPOSABLE_PGLITE', writeJournal: { summary: () => [] }, readNativeGames: async ids => inventory.games.filter(g => ids.includes(g.game_pk)) },
  store, runContext, authorization: { authorized: true, execution_package_sha: runContext.execution_package_sha,
    providerCaps: { MLB_OFFICIAL: { allowed: true, maxCalls: 50 }, STATCAST: { allowed: false, maxCalls: 0 }, THE_ODDS_API: { allowed: false, maxCalls: 0 } }, authorizedDmlTargets: [] },
  now: () => new Date(inventory.run.checkpoint.failure.timestamp),
  fetchImpl: async url => { assert.equal(new URL(url).hostname, 'statsapi.mlb.com'); requests++; return { ok: true, json: async () => payload } }, compactContexts: true,
})
const veto = contexts => bindings.assertCurrentStarters({ contexts, at: inventory.run.checkpoint.failure.timestamp, domain: 'predictions' })
await veto(replay.contexts)
checks.push({ name: 'All 13 preserved contexts pass original stored schedule veto', status: 'PASS' })
const originalSource = execFileSync('git', ['show', `${inventory.run.package_sha}:scripts/mlb-operational-r7-errors.mjs`], { encoding: 'utf8' })
const historical = await import(`data:text/javascript;base64,${Buffer.from(originalSource).toString('base64')}`)
for (const [code, mutate] of [
  ['CURRENT_STARTED_GAME_VETO', g => { g.status.abstractGameState = 'Live' }],
  ['CURRENT_GAME_IDENTITY_VETO', g => { g.gameDate = new Date(Date.parse(g.gameDate) + 60000).toISOString() }],
  ['CURRENT_STARTER_CHANGE_VETO', g => { g.teams.home.probablePitcher.id = 900000001 }],
]) {
  payload = structuredClone(inventory.schedule.evidence.payload)
  mutate(payload.dates.flatMap(d => d.games).find(g => g.gamePk === replay.contexts[0].target.gamePk))
  await assert.rejects(() => veto(replay.contexts), error => {
    assert.equal(error.message, `R2T_PRODUCTION_BLOCK:${code}`)
    assert.equal(historical.sanitizedStageException(error).code, 'CANONICAL_GUARD_FAILURE')
    assert.equal(sanitizedStageException(error).code, code)
    assert.deepEqual(sanitizedStageException(Error(`R6_STATE:${code}`)), sanitizedStageException(error))
    return true
  })
  await veto(replay.contexts.slice(1))
  checks.push({ name: `${code}: exact adapter rejection; old classification collision; unaffected subset passes`, status: 'PASS' })
}
for (const code of ['NATIVE_REVALIDATION_COUNT','STARTER_OR_STATUS_CHANGED']) check(`${code} retained safely`, () => assert.equal(sanitizedStageException(Error(`R2T_PRODUCTION_BLOCK:${code}`)).code, code))
for (const text of ['CURRENT_STARTER_CHANGE_VETO:private-marker','private-marker','CURRENT_STARTER_CHANGE_VETO\nprivate-marker']) check('Untrusted suffix withheld', () => assert.ok(!JSON.stringify(sanitizedStageException(Error(`R2T_PRODUCTION_BLOCK:${text}`))).includes('private-marker')))
const generated = await restorePinnedFeaturePlan({ contexts: replay.contexts, references: inventory.run.checkpoint.references.filter(r => r.kind === 'persisted_features'),
  repository: { readPinnedFeatureRows: async ids => structuredClone(replay.pinned[ids.join(',')]) } })
check('130 pinned snapshots / 13 exact 76-input vectors / digest parity', () => {
  assert.equal(generated.rows.snapshots.length, 130)
  for (const game of generated.games) {
    assert.equal(game.vector.values.length, 76)
    assert.equal(game.built.rows.snapshots.length, 10)
    assert.equal(sha256(game.vector.values), replay.predictions.find(p => p.game_pk === game.target.gamePk).metadata.vector_digest)
    assert.equal(game.vector.sourceDigest, replay.predictions.find(p => p.game_pk === game.target.gamePk).metadata.source_lineage_digest)
  }
})
const base = generated.games[0]
for (const [name, mutate, pattern] of [
  ['missing snapshot', g => g.built.rows.snapshots.shift(), /FEATURE_SNAPSHOT_LINKAGE/],
  ['wrong target', g => { g.built.rows.team[0].target_game_pk++ }, /FEATURE_VERSION_OR_SCOPE/],
  ['wrong feature version', g => { g.built.rows.team[0].feature_version = 'wrong' }, /FEATURE_VERSION_OR_SCOPE/],
  ['stale feature evidence', g => { g.built.rows.team[0].feature_date = '2026-09-10' }, /STALE_FEATURE_ROW/],
  ['post-freeze snapshot', g => { g.built.rows.snapshots[0].as_of_timestamp = '2026-09-12T00:00:00Z' }, /SNAPSHOT_SCOPE_OR_ASOF/],
  ['snapshot input digest mismatch', g => { g.built.rows.snapshots[0].input_digest = 'wrong' }, /SNAPSHOT_DIGEST/],
]) check(name, () => { const g = structuredClone(base); mutate(g); assert.throws(() => assemblePregameVector(g), pattern) })
check('missing starter', () => { const target = structuredClone(base.target); target.native.metadata.homeProbablePitcher = null; assert.throws(() => resolveStarterContext(target), /STARTER_MISSING/) })
check('starter observed after freeze', () => { const evidence = [structuredClone(base.starters.home), structuredClone(base.starters.away)]; evidence[0].observed_at = '2026-09-12T00:00:00Z'; assert.throws(() => resolveStarterContext(base.target,evidence), /STARTER_ASOF/) })
check('started target', () => assert.throws(() => resolvePregameTarget({ native: base.target.native, runAsOf: base.target.scheduledAt, eligibleGamePks: inventory.run.checkpoint.scope }), /STARTED_GAME/))
for (const length of [75,77]) check(`${length} input vector rejected`, () => { const vector = structuredClone(base.vector); vector.values = Array.from({ length }, (_,i) => base.vector.values[i % 76]); assert.throws(() => inferChampion({vector})) })
check('wrong feature ordering rejected', () => { const vector = structuredClone(base.vector); vector.featureNames.reverse(); assert.throws(() => inferChampion({vector})) })
check('model artifact mismatch rejected', () => { const artifact = JSON.parse(fs.readFileSync(ARTIFACT_PATH)); artifact.weights[0] += 0.01; assert.throws(() => validateChampionArtifact(artifact), /ARTIFACT_DIGEST/) })
const planned = replay.predictions[0]
await assert.rejects(() => persistDownstreamRows({ domain: 'predictions', rows: [planned], eligibleGamePks: inventory.run.checkpoint.scope,
  repository: { readPredictions: async () => [{ ...planned, id: '00000000-0000-4000-8000-000000000001', frozen_input_digest: 'mismatch' }],
    insertPredictions: async () => { throw Error('UNEXPECTED_WRITE') } }, beforeWrite: async () => { throw Error('UNEXPECTED_WRITE') } }), /BLOCK_CONFLICT/)
checks.push({ name: 'Prediction input digest conflict blocks before write', status: 'PASS' })
await db.close()
const result = { status: 'PASS', checks, injectedScheduleRequests: requests, providerCalls: 0, productionDml: 0, productionDdl: 0,
  historicalExactVeto: 'NOT_UNIQUELY_IDENTIFIABLE', historicalFailureReproduced: false,
  diagnosticCollisionReproduced: true, productionRecovery: 'NOT_PERFORMED', partialSlatePersistence: 'NOT_CERTIFIED' }
fs.writeFileSync(path.join(root, 'r11-local-validation.json'), JSON.stringify(result,null,2))
console.log(JSON.stringify(result))
