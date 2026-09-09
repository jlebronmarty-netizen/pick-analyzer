// Called only by the disposable PGlite validator. No network or production client.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { DOWNSTREAM_BINDINGS, buildPersistedPredictions, persistDownstreamRows, quantizePostgresNumber } from './mlb-data-02r-r2t-downstream-persistence.mjs'
import { loadCertifiedPolicy, evaluateCertifiedPolicy } from './mlb-data-02r-r2t-policy-binding.mjs'
import { persistCanonicalMarkets, buildCanonicalValues, buildCanonicalOfficialPicks } from './mlb-data-02r-r2t-market-binding.mjs'
import { sha256 } from './mlb-data-02r-r2f-stage-contracts.mjs'
import { runR2BExecutableEntrypoint } from './mlb-data-02r-r2a-live-refresh-executor.mjs'
import { operatingDate } from './mlb-data-02r-r2t-r1-pregame-contract.mjs'
import { validateProductionBindingsLocally } from './mlb-data-02r-r2t-production-bindings-validate.mjs'
import { inputPayload } from './mlb-data-02i-current-moneyline-dry-inference-prep.mjs'

export async function validateLocalDownstream({ db, root, games, storedFeatures, runAsOf, check, contexts, featureRepository }) {
  const registry = JSON.parse(fs.readFileSync(path.join(root, 'private-registry.json'), 'utf8'))
  const manifest = JSON.parse(fs.readFileSync('docs/CERTIFICATION/MLB_OPERATIONAL_DOWNSTREAM_SCHEMA_REVIEW.json', 'utf8'))
  // FK parents in ephemeral in-memory PostgreSQL only.
  await db.exec('create table pick2_model_versions(id uuid primary key); create table pick2_mlb_games(game_pk bigint primary key)')
  await db.query('insert into pick2_model_versions(id) values ($1)', [registry.model.id])
  for (const g of games) await db.query('insert into pick2_mlb_games(game_pk) values ($1)', [g.target.gamePk])
  for (const table of manifest.schema) {
    const fields = table.columns.map(c => `${c.column} ${c.physical_type ?? c.type}${c.default ? ` default ${c.default}` : ''}${c.nullable === 'NO' ? ' not null' : ''}`)
    await db.exec(`create table ${table.table_name} (${fields.join(',')})`)
  }
  for (const c of manifest.constraints.filter(c => c.contype === 'p')) await db.exec(`alter table ${c.table_name} add constraint ${c.conname} ${c.definition}`)
  for (const c of manifest.constraints.filter(c => c.contype !== 'p')) await db.exec(`alter table ${c.table_name} add constraint ${c.conname} ${c.definition}`)
  for (const index of manifest.indexes.filter(i => !manifest.constraints.some(c => c.conname === i.indexname))) await db.exec(index.indexdef)
  for (const value of [0.1234567890123455, -0.1234567890123455, 1.234567891234567e-9, 0.1 + 0.2]) {
    const actual = Number((await db.query('select $1::numeric(18,15) as n', [String(value)])).rows[0].n)
    assert.equal(quantizePostgresNumber(value, 15), actual)
  }
  check('value and pick physical numeric(18,15) rounding matches PostgreSQL including decimal ties', true)
  const repository = {}
  for (const binding of Object.values(DOWNSTREAM_BINDINGS)) {
    repository[binding.read] = async ids => (await db.query(`select to_jsonb(t) as row from ${binding.table} t where ${binding.identity} = any($1::text[])`, [ids])).rows.map(r => r.row)
    repository[binding.insert] = async (rows, cap) => {
      assert.ok(rows.length <= cap)
      const stored = []
      for (const row of rows) {
        const keys = Object.keys(row).join(',')
        const result = await db.query(`with inserted as (insert into ${binding.table} (${keys}) select ${keys} from jsonb_populate_record(null::${binding.table}, $1::jsonb) returning *) select to_jsonb(inserted) as row from inserted`, [JSON.stringify(row)])
        stored.push(result.rows[0].row)
      }
      return { rows: stored, inserted: stored.length }
    }
  }
  const scope = games.map(g => g.target.gamePk)
  repository.readMarketMappingsByGames = async ids => (await db.query('select to_jsonb(t) as row from pick2_mlb_market_event_mappings t where game_pk = any($1::bigint[])', [ids])).rows.map(r => r.row)
  repository.readValueBoard = async ({ valueIdentities, pickIdentities }) => ({ values: await repository.readValues(valueIdentities), picks: await repository.readOfficialPicks(pickIdentities) })
  const rows = await buildPersistedPredictions({ games, persistedFeatures: storedFeatures, registryRepository: { readChampion: async () => registry }, runAsOf })
  const beforeWrite = async ({ rows }) => { for (const row of rows) assert.ok(Date.parse(games.find(g => g.target.gamePk === row.game_pk).target.scheduledAt) > Date.parse(runAsOf)) }
  const args = { domain: 'predictions', rows, repository, eligibleGamePks: scope, beforeWrite }
  const persisted = await persistDownstreamRows(args)
  check('all real predictions persist with canonical Champion and snapshot foreign keys', persisted.inserted === games.length && persisted.rows.every(r => r.model_version_id === registry.model.id && r.feature_snapshot_id && r.metadata.feature_snapshot_ids.length === 10))
  for (const row of persisted.rows) {
    const inference = games.find(g => g.target.gamePk === row.game_pk).inference.artifact
    assert.equal(Number(row.home_probability), inference.home_probability)
    const game = games.find(g => g.target.gamePk === row.game_pk)
    assert.equal(row.frozen_input_digest, sha256(inputPayload({ game_pk: row.game_pk, as_of: runAsOf,
      home_team_id: game.target.homeTeamId, away_team_id: game.target.awayTeamId,
      starter_status: row.metadata.input_starter_status, data_completeness: row.metadata.data_completeness, vector: game.vector.values })))
    assert.equal(row.metadata.inference_summary_digest, inference.input_digest)
  }
  check('persisted prediction probabilities preserve real Champion inference', true)
  const repeat = await persistDownstreamRows({ ...args, cap: 0 })
  check('prediction retry reuses every immutable row with zero DML cap', repeat.inserted === 0 && repeat.plan.reuseNoOp === games.length)
  await assert.rejects(() => persistDownstreamRows({ ...args, rows: [{ ...rows[0], home_probability: rows[0].home_probability + 0.01 }] }), /BLOCK_CONFLICT/)
  await assert.rejects(() => persistDownstreamRows({ ...args, rows: [{ ...rows[0], synthetic_feature: 1 }] }), /UNEXPECTED_COLUMN/)
  await assert.rejects(() => persistDownstreamRows({ ...args, eligibleGamePks: [] }), /SCOPE/)
  check('prediction payload drift, immutable conflicts and scope escape fail closed', true)
  const policy = loadCertifiedPolicy()
  assert.equal(policy.thresholds.minimumBookCount, 8)
  const policyArtifact = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-02p-official-pick-policy-prep.json', 'utf8'))
  policyArtifact.policy.config.thresholds.consensusEdge = 0.02
  assert.throws(() => loadCertifiedPolicy(policyArtifact), /CONFIG_DIGEST/)
  assert.deepEqual(evaluateCertifiedPolicy({ values: [], runAsOf }), [])
  check('certified Policy V1 loads exact config, rejects threshold drift and accepts zero candidates', true)
  // These invented market prices are isolated structural fixtures. Real model
  // vectors and probabilities above are unchanged; no real market is claimed.
  const nativeGames = games.map(g => ({ game_pk: g.target.gamePk, scheduled_at: g.target.scheduledAt, home_team_name: `structural-home-${g.target.gamePk}`, away_team_name: `structural-away-${g.target.gamePk}` }))
  const payload = nativeGames.map(g => ({ id: `isolated-market-${g.game_pk}`, sport_key: 'baseball_mlb', home_team: g.home_team_name, away_team: g.away_team_name, commence_time: g.scheduled_at,
    bookmakers: Array.from({ length: 8 }, (_, i) => ({ key: `structural-book-${i}`, title: `Structural Book ${i}`, markets: [{ key: 'h2h', last_update: runAsOf, outcomes: [{ name: g.home_team_name, price: 200 }, { name: g.away_team_name, price: -220 }] }] })) }))
  const evidence = { payload, responseDigest: sha256(payload), acquiredAt: runAsOf }
  const marketArgs = { evidence, nativeGames, eligibleGamePks: scope, repository, beforeWrite }
  const empty = await persistCanonicalMarkets({ ...marketArgs, evidence: { payload: [], responseDigest: sha256([]), acquiredAt: runAsOf } })
  assert.equal(empty.observations.rows.length, 0)
  assert.deepEqual(buildCanonicalValues({ predictions: persisted.rows, observations: [], evaluatedAt: runAsOf }), [])
  check('real prediction slate with no market evidence produces zero values and picks', true)
  const markets = await persistCanonicalMarkets(marketArgs)
  check('isolated market fixture persists mappings and both book sides with canonical UUIDs', markets.mappings.inserted === games.length && markets.observations.inserted === games.length * 16)
  const marketRetry = await persistCanonicalMarkets({ ...marketArgs, limits: { marketMappings: 0, marketObservations: 0 } })
  check('market retry reuses mappings and observations with zero caps', marketRetry.mappings.inserted === 0 && marketRetry.observations.inserted === 0)
  const values = buildCanonicalValues({ predictions: persisted.rows, observations: markets.observations.rows, evaluatedAt: runAsOf })
  const valueArgs = { domain: 'values', rows: values, repository, eligibleGamePks: scope, beforeWrite }
  const valueWrite = await persistDownstreamRows(valueArgs)
  check('real model plus isolated odds fixture persists value math and all three observation FKs', valueWrite.inserted === games.length * 16)
  assert.equal((await persistDownstreamRows({ ...valueArgs, cap: 0 })).inserted, 0)
  const scheduledByGame = new Map(nativeGames.map(g => [g.game_pk, g.scheduled_at]))
  const decisions = buildCanonicalOfficialPicks({ values: valueWrite.rows, decisionAt: runAsOf, scheduledByGame })
  assert.ok(decisions.rows.length > 0, 'isolated schema fixture must exercise official-pick FK writes')
  const pickArgs = { domain: 'officialPicks', rows: decisions.rows, repository, eligibleGamePks: scope, beforeWrite }
  const pickWrite = await persistDownstreamRows(pickArgs)
  check('isolated policy fixture persists Official Pick prediction/value UUID handoff', pickWrite.inserted > 0 && pickWrite.rows.every(r => r.decision_status === 'OFFICIAL_PICK'))
  assert.equal((await persistDownstreamRows({ ...pickArgs, cap: 0 })).inserted, 0)
  check('value and Official Pick retries preserve immutable decisions with zero writes', true)
  assert.throws(() => buildCanonicalValues({ predictions: persisted.rows, observations: [...markets.observations.rows, markets.observations.rows[0]], evaluatedAt: runAsOf }), /DUPLICATE_BOOK_SIDE/)
  assert.throws(() => buildCanonicalValues({ predictions: persisted.rows, observations: markets.observations.rows, evaluatedAt: nativeGames[0].scheduled_at }), /POST_START_VALUE/)
  assert.throws(() => buildCanonicalOfficialPicks({ values: valueWrite.rows, decisionAt: nativeGames[0].scheduled_at, scheduledByGame }), /POST_START_PICK/)
  const unknown = evaluateCertifiedPolicy({ values: valueWrite.rows.map(r => ({ ...r, starter_status: 'UNKNOWN' })), runAsOf })
  assert.ok(unknown.every(r => r.status === 'BLOCKED'))
  check('duplicate book sides, post-start values/picks and UNKNOWN starters fail closed', true)
  const checkpoints = new Map()
  let contextReads = 0, oddsReads = 0, interrupt = true
  const integrationAsOf = new Date(Date.parse(runAsOf) + 1000).toISOString()
  const integrationContexts = contexts.map(c => ({ ...c, target: { ...c.target, runAsOf: integrationAsOf } }))
  const canonical = {
    checkpoint: { load: async id => structuredClone(checkpoints.get(id) ?? null), save: async (id, value) => { checkpoints.set(id, structuredClone(value)) } },
    readContexts: async () => { contextReads++; return { contexts: integrationContexts, nativeGames } },
    registryRepository: { readChampion: async () => registry },
    getOddsEvidence: async () => { oddsReads++; return { ...evidence, acquiredAt: integrationAsOf } },
    providerAccounting: () => ({ MLB_OFFICIAL: 0, STATCAST: 0, THE_ODDS_API: 0 }),
    assertCurrentStarters: async ({ contexts: frozen }) => { assert.deepEqual(frozen.map(c => c.starters), contexts.map(c => c.starters)) },
  }
  const integratedRepository = { ...featureRepository, ...repository, executionEnvironment: 'DISPOSABLE_PGLITE',
    verifySchemaFingerprint: async table => { const result = await db.query('select column_name from information_schema.columns where table_schema = $1 and table_name = $2', ['public', table]); assert.ok(result.rows.length > 0); return result.rows }, readValues: async ids => {
    if (interrupt) { interrupt = false; throw new Error('INJECTED_AFTER_MARKET_READBACK') }
    return repository.readValues(ids)
  } }
  const integrationArgs = { mode: 'CERTIFICATION_SIMULATION', providers: { canonical }, repository: integratedRepository,
    runId: 'r2t-local-real-integration', runDate: operatingDate(integrationAsOf), runAsOf: integrationAsOf, clock: integrationAsOf }
  await assert.rejects(() => runR2BExecutableEntrypoint(integrationArgs), /INJECTED_AFTER_MARKET_READBACK/)
  const integrated = await runR2BExecutableEntrypoint(integrationArgs)
  assert.equal(integrated.status, 'CANONICAL_STAGES_READBACK_COMPLETE')
  assert.equal(integrated.predictions.rows.length, games.length)
  assert.equal(contextReads, 1); assert.equal(oddsReads, 1)
  assert.equal(integrated.board.artifact.OfficialPicks, integrated.picks.rows.length)
  check('R2B to R2I real-model integration resumes after market handoff without reacquisition', true)
  const retry = await runR2BExecutableEntrypoint({ ...integrationArgs, authorization: { dmlCaps: { predictions: 0, marketMappings: 0, marketObservations: 0, nativeValues: 0, officialPicks: 0, features: Object.fromEntries(Object.keys(storedFeatures).map(d => [d, 0])) } } })
  assert.equal(retry.insertedRows, 0)
  check('R2B to R2I full real-model persistence retry performs zero writes', true)
  await validateProductionBindingsLocally({ db, root, contexts, oddsPayload: payload, registry, check })
  return { repository, predictions: persisted.rows, beforeWrite }
}
