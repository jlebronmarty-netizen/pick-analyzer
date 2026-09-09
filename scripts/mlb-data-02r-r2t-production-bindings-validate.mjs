// Actual adapter call graph against disposable PGlite and injected providers.
// Archived native/raw evidence is private. Market prices are structural fixtures.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createPgliteClient } from './mlb-data-02r-r2t-pglite-client.mjs'
import { createCanonicalCertificationBindings, createCanonicalProductionBindings } from './mlb-data-02r-r2t-production-bindings.mjs'
import { createSupabaseProductionRepository, createCurrentSlateRunFreeze, R2I_LIVE_TARGETS, createProviderLedger, createStatcastLiveClient } from './mlb-data-02r-r2i-live-execution-interfaces.mjs'
import { assertCanonicalRawInsert } from './mlb-data-02r-r2t-raw-binding.mjs'
import { createWriteJournal } from './mlb-data-02r-r2t-write-journal.mjs'
import { runR2BExecutableEntrypoint } from './mlb-data-02r-r2a-live-refresh-executor.mjs'
import { operatingDate } from './mlb-data-02r-r2t-r1-pregame-contract.mjs'
import { sha256 } from './mlb-data-02r-r2f-stage-contracts.mjs'
import {pinnedFeatureReferences} from './mlb-operational-r6-compact-features.mjs'
import {validateDurableR2Resume} from './mlb-operational-r6-r2-resume-validate.mjs'

export async function validateProductionBindingsLocally({ db, root, contexts, oddsPayload, registry, check }) {
  const client = createPgliteClient(db)
  const nativeSchema = JSON.parse(fs.readFileSync('docs/CERTIFICATION/MLB_OPERATIONAL_NATIVE_SCHEMA_REVIEW.json', 'utf8')).columns
  // Extend only the ephemeral FK-parent fixtures already in the PGlite process.
  for (const table of ['sports_teams', 'pick2_mlb_games', 'pick2_mlb_players']) {
    if (table === 'pick2_mlb_players') await db.exec('create table pick2_mlb_players(mlbam_person_id bigint primary key)')
    for (const c of nativeSchema.filter(c => c.table_name === table)) await db.exec(`alter table ${table} add column if not exists ${c.column_name} ${c.data_type}${c.column_default ? ` default ${c.column_default}` : ''}`)
  }
  await db.exec('alter table pick2_model_versions add column model_version text, add column role text, add column status text, add column artifact_digest text, add column feature_set_id uuid; create table pick2_model_feature_sets(id uuid primary key, feature_set_version text, input_contract jsonb)')
  const storedModel = await client.from('pick2_model_versions').update(registry.model).eq('id', registry.model.id).select('*')
  assert.equal(storedModel.error, null)
  assert.equal((await client.from('pick2_model_feature_sets').insert(registry.featureSet).select('*')).error, null)
  const rawById = new Map(contexts.flatMap(c => c.dependencies.rows).map(r => [r.id, r]))
  const rawRows = [...rawById.values()]
  const numeric = new Set(['game_pk', 'game_year', 'mlbam_pitcher_id', 'mlbam_batter_id', 'at_bat_number', 'pitch_number', 'inning', 'release_speed', 'launch_speed', 'estimated_woba_using_speedangle', 'post_home_score', 'post_away_score'])
  await db.exec(`create table pick2_raw_mlb_statcast_pitches (${Object.keys(rawRows[0]).map(key => `${key} ${numeric.has(key) ? 'double precision' : 'text'}`).join(',')}, primary key(id))`)
  for (let start = 0; start < rawRows.length; start += 4000) await db.query('insert into pick2_raw_mlb_statcast_pitches select * from jsonb_populate_recordset(null::pick2_raw_mlb_statcast_pitches, $1::jsonb)', [JSON.stringify(rawRows.slice(start, start + 4000))])
  await db.exec('create index local_raw_game on pick2_raw_mlb_statcast_pitches(game_pk); create index local_raw_pitcher on pick2_raw_mlb_statcast_pitches(mlbam_pitcher_id)')
  const teams = [...new Set(rawRows.flatMap(r => [r.canonical_home_team_id, r.canonical_away_team_id]))]
  for (const id of teams) await db.query("insert into sports_teams(id,sport_key) values ($1,'baseball_mlb') on conflict(id) do update set sport_key='baseball_mlb'", [id])
  const historical = new Map(rawRows.map(r => [r.game_pk, r]))
  for (const row of historical.values()) await db.query("insert into pick2_mlb_games(game_pk,game_date,home_team_id,away_team_id,season,source,metadata) values ($1,$2,$3,$4,2026,'LOCAL_RAW_IDENTITY_PROJECTION','{}'::jsonb) on conflict(game_pk) do nothing", [row.game_pk, row.game_date, row.canonical_home_team_id, row.canonical_away_team_id])
  for (const c of contexts) {
    const result = await client.from('pick2_mlb_games').update(c.target.native).eq('game_pk', c.target.gamePk).select('*')
    assert.equal(result.error, null)
  }
  const runAsOf = new Date(Date.parse(contexts[0].target.runAsOf) + 2000).toISOString()
  const runContext = createCurrentSlateRunFreeze({ mode: 'DRY_RUN', executionPackageSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), runId: 'r2t-adapter-injected', runDate: operatingDate(runAsOf), runAsOf })
  const authorization = { authorized: true, execution_package_sha: runContext.execution_package_sha, authorizedDmlTargets: Object.values(R2I_LIVE_TARGETS), providerCaps: {
    MLB_OFFICIAL: { allowed: true, maxCalls: 50 }, STATCAST: { allowed: true, maxCalls: 100 }, THE_ODDS_API: { allowed: true, maxCalls: 5 },
  }, dmlCaps: { nativeGames: contexts.length, nativePlayers: contexts.length * 2 } }
  const payload = { dates: [{ date: runContext.run_date, games: contexts.map(c => ({ gamePk: c.target.gamePk, gameDate: c.target.scheduledAt, officialDate: c.target.gameDate,
    season: '2026', gameType: c.target.native.game_type, doubleHeader: c.target.native.doubleheader, gameNumber: c.target.native.game_number,
    status: { abstractGameState: c.target.native.metadata.abstractGameState, detailedState: c.target.native.official_status },
    teams: { home: { team: { id: c.target.native.metadata.homeMlbTeamId, name: `structural-home-${c.target.gamePk}` }, probablePitcher: c.target.native.metadata.homeProbablePitcher },
      away: { team: { id: c.target.native.metadata.awayMlbTeamId, name: `structural-away-${c.target.gamePk}` }, probablePitcher: c.target.native.metadata.awayProbablePitcher } },
  })) }] }
  const documents = new Map()
  const store = { root: path.join(root, 'isolated-adapter-cache'), locked: true, load: key => documents.get(key) ?? null, save: (key, value) => { documents.set(key, value) } }
  const calls = []
  const fetchImpl = async url => {
    const parsed = new URL(url)
    calls.push(parsed.hostname)
    if (parsed.hostname === 'statsapi.mlb.com') return { ok: true, json: async () => payload }
    if (parsed.hostname === 'api.the-odds-api.com') return { ok: true, json: async () => oddsPayload }
    throw new Error('UNEXPECTED_INJECTED_PROVIDER')
  }
  const writeJournal = createWriteJournal({ client, store, runContext })
  const repository = { ...createSupabaseProductionRepository({ client, writeJournal }), executionEnvironment: 'DISPOSABLE_PGLITE' }
  assert.throws(() => createCanonicalProductionBindings({ client, repository, store, runContext, authorization }), /R2T_LIVE_BLOCKED|R2T_PRODUCTION_BLOCK:REPOSITORY/)
  const canonical = await createCanonicalCertificationBindings({ client, repository, store, runContext, authorization, compactContexts: true, oddsApiKey: 'ISOLATED_TEST_VALUE', fetchImpl, now: () => new Date(runAsOf) })
  console.log(JSON.stringify({ stage: 'ISOLATED_PRODUCTION_BINDINGS', operation: 'read canonical contexts', realProviderCalls: 0 }))
  const evidence = await canonical.readContexts()
  assert.equal(evidence.contexts.length, contexts.length)
  assert.ok(evidence.contexts.every(c => !Object.hasOwn(c.dependencies,'rows') && /^[a-f0-9]{64}$/.test(c.dependencies.dependencyDigest)))
  check('compact production contexts retain canonical digest references without raw rows', true)
  check('production source adapter reconstructs every real archived game from local SQL readback', true)
  assert.equal(canonical.providerAccounting().MLB_OFFICIAL, 1)
  assert.equal(canonical.providerAccounting().STATCAST ?? 0, 0)
  check('production source adapter reuses canonical raw evidence without a Statcast request', true)
  const result = await runR2BExecutableEntrypoint({ mode: 'CERTIFICATION_SIMULATION', providers: { canonical }, repository, authorization, runId: runContext.run_id,
    executionPackageSha: runContext.execution_package_sha, runDate: runContext.run_date, runAsOf, clock: runAsOf })
  assert.equal(result.status, 'CANONICAL_STAGES_READBACK_COMPLETE')
  assert.equal(result.predictions.rows.length, contexts.length)
  const generated=await canonical.buildFeaturePlan({contexts:evidence.contexts,runDate:runContext.run_date,runAsOf})
  const pins=pinnedFeatureReferences({generated,persistedRows:result.features.rows})
  const recovered=await canonical.restoreFeaturePlan({contexts:evidence.contexts,references:pins})
  assert.deepEqual(recovered.games.map(g=>g.vector.values),generated.games.map(g=>g.vector.values))
  assert.equal(recovered.memory.maximumDependencyRows,0)
  check('canonical snapshot-pinned recovery preserves all vectors without raw reads',true)
  assert.equal(calls.filter(host => host === 'api.the-odds-api.com').length, 1)
  assert.equal(result.markets.crosswalk.filter(row => row.classification === 'MATCHED').length, contexts.length, JSON.stringify({ crosswalk: result.markets.crosswalk, nativeGames: evidence.nativeGames, marketGames: oddsPayload.map(event => ({ home: event.home_team, away: event.away_team, time: event.commence_time })) }))
  assert.ok(calls.filter(host => host === 'statsapi.mlb.com').length >= 3, JSON.stringify({ calls, predictionInserts: result.predictions.inserted, valueInserts: result.values.inserted, pickInserts: result.picks.inserted }))
  const countBeforeRetry = calls.length
  await runR2BExecutableEntrypoint({ mode: 'CERTIFICATION_SIMULATION', providers: { canonical }, repository, authorization, runId: runContext.run_id,
    executionPackageSha: runContext.execution_package_sha, runDate: runContext.run_date, runAsOf, clock: runAsOf })
  assert.equal(calls.length, countBeforeRetry)
  check('actual production adapter R2B/R2I SQL pipeline completes and retries without provider reacquisition', true)
  const durableResult=await validateDurableR2Resume({db,client,root,runContext,authorization,fetchImpl,check})
  fs.writeFileSync(path.join(root,'r6-r2-resume-validation.json'),JSON.stringify(durableResult,null,2))
  const savedStatus = payload.dates[0].games[0].status.abstractGameState
  payload.dates[0].games[0].status.abstractGameState = 'Live'
  await assert.rejects(() => canonical.assertCurrentStarters({ contexts: evidence.contexts, at: runAsOf, domain: 'predictions' }), /CURRENT_STARTED_GAME_VETO/)
  payload.dates[0].games[0].status.abstractGameState = savedStatus
  const savedStarter = payload.dates[0].games[0].teams.home.probablePitcher
  payload.dates[0].games[0].teams.home.probablePitcher = { ...savedStarter, id: 900000009 }
  await assert.rejects(() => canonical.assertCurrentStarters({ contexts: evidence.contexts, at: runAsOf, domain: 'values' }), /CURRENT_STARTER_CHANGE_VETO/)
  payload.dates[0].games[0].teams.home.probablePitcher = savedStarter
  check('fresh Official evidence vetoes started games and changed starters without replacing frozen inputs', true)
  // Cold-fetch structural fixture through the existing shared R2N engine, with
  // no HTTP transport. It is never supplied to the real-model archived cases.
  const rawSchema = JSON.parse(fs.readFileSync('docs/CERTIFICATION/MLB_OPERATIONAL_RAW_SCHEMA_REVIEW.json', 'utf8'))
  for (const c of rawSchema.columns) await db.exec(`alter table pick2_raw_mlb_statcast_pitches add column if not exists ${c.column} ${c.type}${c.default ? ` default ${c.default}` : ''}`)
  const coldPk = 900000001
  const csv = 'game_pk,game_date,game_year,game_type,home_team,away_team,pitcher,batter,at_bat_number,pitch_number,inning\n900000001,2026-09-03,2026,R,HME,AWY,900000002,900000003,1,1,1\n'
  const coldLedger = createProviderLedger({ STATCAST: { allowed: true, maxCalls: 1 } })
  let coldCalls = 0
  const statcast = createStatcastLiveClient({ db: client, ledger: coldLedger, cacheDir: path.join(root, `isolated-cold-${process.pid}`), fetchImpl: async () => { coldCalls++; return { ok: true, text: async () => csv } } })
  const coldArgs = { eligibleGamePks: [coldPk], dependencyDates: ['2026-09-03'], runAsOf, providerBudget: { STATCAST: { maxCalls: 1 } }, teamMap: new Map([['HME', contexts[0].target.homeTeamId], ['AWY', contexts[0].target.awayTeamId]]) }
  const coldRows = await statcast.fetchRowsForGames(coldArgs)
  assert.equal(coldRows.length, 1)
  coldRows.forEach(assertCanonicalRawInsert)
  assert.equal(coldCalls, 1); assert.equal(coldLedger.read('STATCAST'), 1)
  await repository.insertRawRows(coldRows, 1)
  assert.equal((await repository.readRawRows(coldRows.map(r => r.id))).length, 1)
  await statcast.fetchRowsForGames(coldArgs)
  assert.equal(coldCalls, 1)
  assert.throws(() => coldLedger.consume('STATCAST'), /PROVIDER_CAP_EXCEEDED/)
  assert.throws(() => coldLedger.consume('STATCAST', -1), /INVALID_CALL_COUNT/)
  assert.throws(() => assertCanonicalRawInsert({ ...coldRows[0], ingested_at: runAsOf }), /BACKDATED_COLUMN/)
  assert.throws(() => assertCanonicalRawInsert({ ...coldRows[0], raw_payload_digest: 'changed' }), /PAYLOAD_DIGEST/)
  check('shared Statcast cold fixture validates physical insert, canonical cache reuse and actual-request cap', true)
  check('raw backdating, corrupt digest and negative provider accounting fail closed', true)
  const secondPitch = { ...coldRows[0], pitch_number: 2, id: `statcast:mlb:2026:${coldPk}:1:2`, raw_payload: { ...coldRows[0].raw_payload, pitch_number: '2' } }
  secondPitch.raw_payload_digest = sha256(JSON.stringify(secondPitch.raw_payload))
  await assert.rejects(() => writeJournal.perform({ table: 'pick2_raw_mlb_statcast_pitches', rows: [secondPitch], cap: 1 }, async () => {
    const response = await client.from('pick2_raw_mlb_statcast_pitches').insert(secondPitch).select('*')
    assert.equal(response.error, null)
    throw new Error('INJECTED_CONNECTION_LOSS_AFTER_COMMIT')
  }), /INJECTED_CONNECTION_LOSS/)
  await writeJournal.recover()
  assert.ok(writeJournal.summary().some(e => e.recoveredByIndependentReadback && e.state === 'APPLIED' && e.actualRows === 1))
  check('uncertain committed INSERT is recovered by exact independent readback and counted once', true)
  const thirdPitch = { ...secondPitch, pitch_number: 3, id: `statcast:mlb:2026:${coldPk}:1:3`, raw_payload: { ...secondPitch.raw_payload, pitch_number: '3' } }
  thirdPitch.raw_payload_digest = sha256(JSON.stringify(thirdPitch.raw_payload))
  const request = { table: 'pick2_raw_mlb_statcast_pitches', rows: [thirdPitch], cap: 1 }
  await assert.rejects(() => writeJournal.perform(request, async () => { throw new Error('INJECTED_BEFORE_REQUEST') }), /INJECTED_BEFORE_REQUEST/)
  await writeJournal.recover()
  assert.equal(writeJournal.summary().at(-1).actualRows, 0)
  await writeJournal.perform(request, () => client.from('pick2_raw_mlb_statcast_pitches').insert(thirdPitch).select('*'))
  assert.equal(writeJournal.summary().at(-1).actualRows, 1)
  check('unapplied pending INSERT retries safely without double counting its cap', true)
  const probePayload = structuredClone(payload)
  probePayload.dates[0].games = [probePayload.dates[0].games[0]]
  probePayload.dates[0].games[0].status.detailedState = 'Warmup'
  const probeContext = { ...runContext, run_id: 'r2t-native-update-probe' }
  const probeDocuments = new Map()
  const probeStore = { ...store, load: key => probeDocuments.get(key) ?? null, save: (key, value) => { probeDocuments.set(key, value) } }
  const probeJournal = createWriteJournal({ client, store: probeStore, runContext: probeContext })
  const probeRepository = { ...createSupabaseProductionRepository({ client, writeJournal: probeJournal }), executionEnvironment: 'DISPOSABLE_PGLITE' }
  const probe = await createCanonicalCertificationBindings({ client, repository: probeRepository, store: probeStore, runContext: probeContext, authorization,
    oddsApiKey: 'ISOLATED_TEST_VALUE', fetchImpl: async () => ({ ok: true, json: async () => probePayload }), now: () => new Date(Date.parse(runAsOf) + 1000) })
  const updated = await probe.readContexts()
  assert.equal(updated.contexts.length, 0)
  assert.equal(updated.blockedGames[0].reason, 'NEW_CANONICAL_EVIDENCE_AFTER_RUN_FREEZE')
  assert.equal(probeJournal.summary().filter(e => e.operation === 'UPDATE').reduce((n, e) => n + e.actualRows, 0), 1)
  await probe.readContexts()
  assert.equal(probeJournal.summary().filter(e => e.operation === 'UPDATE').length, 1)
  check('native enrichment UPDATE uses old predicates, reads back and never backdates new evidence', true)
  const concurrentPayload = structuredClone(payload)
  concurrentPayload.dates[0].games = [concurrentPayload.dates[0].games[1]]
  concurrentPayload.dates[0].games[0].status.detailedState = 'Warmup'
  const concurrentPk = concurrentPayload.dates[0].games[0].gamePk
  const beforeConcurrent = (await client.from('pick2_mlb_games').select('*').eq('game_pk', concurrentPk)).data[0]
  let intercepted = false
  const concurrentClient = { ...client, from(table) {
    const query = client.from(table), execute = query.execute.bind(query)
    query.execute = async () => {
      if (!intercepted && table === 'pick2_mlb_games' && query.mutation === 'update') {
        intercepted = true
        await db.query("update pick2_mlb_games set metadata = metadata || '{\"concurrent_local_probe\":true}'::jsonb where game_pk=$1", [concurrentPk])
      }
      return execute()
    }
    return query
  } }
  const concurrentContext = { ...runContext, run_id: 'r3-concurrent-native-probe' }
  const concurrentDocuments = new Map()
  const concurrentStore = { ...store, load: key => concurrentDocuments.get(key) ?? null, save: (key, value) => concurrentDocuments.set(key, value) }
  const concurrentJournal = createWriteJournal({ client: concurrentClient, store: concurrentStore, runContext: concurrentContext })
  const concurrentRepository = { ...createSupabaseProductionRepository({ client: concurrentClient, writeJournal: concurrentJournal }), executionEnvironment: 'DISPOSABLE_PGLITE' }
  const concurrentCanonical = await createCanonicalCertificationBindings({ client: concurrentClient, repository: concurrentRepository, store: concurrentStore,
    runContext: concurrentContext, authorization, oddsApiKey: 'ISOLATED_TEST_VALUE', fetchImpl: async () => ({ ok: true, json: async () => concurrentPayload }), now: () => new Date(Date.parse(runAsOf) + 1000) })
  await assert.rejects(() => concurrentCanonical.readContexts(), /PARTIAL_OR_CONFLICTING_STATE/)
  const afterConcurrent = (await client.from('pick2_mlb_games').select('*').eq('game_pk', concurrentPk)).data[0]
  assert.equal(afterConcurrent.official_status, beforeConcurrent.official_status)
  assert.equal(afterConcurrent.updated_at, beforeConcurrent.updated_at)
  assert.equal(afterConcurrent.metadata.concurrent_local_probe, true)
  check('concurrent native metadata change without timestamp advance prevents the planned UPDATE', true)
  const emptyContext = { ...runContext, run_id: 'r2t-empty-slate-probe' }
  const emptyDocuments = new Map()
  const emptyStore = { ...store, load: key => emptyDocuments.get(key) ?? null, save: (key, value) => { emptyDocuments.set(key, value) } }
  const emptyJournal = createWriteJournal({ client, store: emptyStore, runContext: emptyContext })
  const emptyRepository = { ...createSupabaseProductionRepository({ client, writeJournal: emptyJournal }), executionEnvironment: 'DISPOSABLE_PGLITE' }
  let emptyCalls = 0
  const emptyCanonical = await createCanonicalCertificationBindings({ client, repository: emptyRepository, store: emptyStore, runContext: emptyContext, authorization,
    oddsApiKey: 'ISOLATED_TEST_VALUE', fetchImpl: async () => { emptyCalls++; return { ok: true, json: async () => ({ dates: [] }) } }, now: () => new Date(runAsOf) })
  const emptyResult = await runR2BExecutableEntrypoint({ mode: 'CERTIFICATION_SIMULATION', providers: { canonical: emptyCanonical }, repository: emptyRepository, authorization,
    runId: emptyContext.run_id, executionPackageSha: emptyContext.execution_package_sha, runDate: emptyContext.run_date, runAsOf, clock: runAsOf })
  assert.equal(emptyResult.status, 'NO_VALID_PREGAME_SLATE')
  assert.equal(emptyCalls, 1)
  assert.equal(emptyJournal.summary().length, 0)
  check('production adapter empty slate terminates after one injected schedule read with no downstream calls or writes', true)
}
