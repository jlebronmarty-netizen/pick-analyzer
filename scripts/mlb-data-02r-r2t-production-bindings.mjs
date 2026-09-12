// Code-only implementation authorized by the later autonomous mission's
// "Codex may modify production-capable repository code" instruction, reaffirmed
// by the latest DDL/publication request to resume that mission. This module has
// no entrypoint. Construction remains blocked by assertR2TLiveReadiness until R3.
import path from 'node:path'
import { sha256, classifyInsertReuseConflict } from './mlb-data-02r-r2f-stage-contracts.mjs'
import { getCurrentSlate } from './mlb-data-02r-r2f-wave12-interfaces.mjs'
import { createMlbOfficialLiveClient, createTheOddsApiLiveClient, createStatcastLiveClient, mapScheduleGameToNativeInsertRow, createProviderLedger } from './mlb-data-02r-r2i-live-execution-interfaces.mjs'
import { assertR2TLiveReadiness, createCertifiedFeatureReadRepository, verifyChampionRegistry } from './mlb-data-02r-r2t-real-feature-champion.mjs'
import { createPregameReadRepository } from './mlb-data-02r-r2t-r1-read-repository.mjs'
import { resolveStoredOfficialTeamAliases, bindStoredNativeContext } from './mlb-data-02r-r2t-r2-native-binding.mjs'
import { resolvePregameTarget, resolveStarterContext, buildPregameFeatureRows, operatingDate } from './mlb-data-02r-r2t-r1-pregame-contract.mjs'
import { prepareCompactFeatureContext, buildCompactFeaturePlan, restorePinnedFeaturePlan } from './mlb-operational-r6-compact-features.mjs'
import { classifyCurrentGame } from './mlb-operational-game-veto.mjs'

const ensure = (condition, reason) => { if (!condition) throw new Error(`R2T_PRODUCTION_BLOCK:${reason}`) }
const read = async (query, label) => { const { data, error } = await query; ensure(!error && Array.isArray(data), `READ:${label}:${error?.code ?? 'UNKNOWN'}`); return data }
const businessNative = row => ({
  game_pk: row.game_pk, game_date: row.game_date, scheduled_at: new Date(row.scheduled_at).toISOString(), home_team_id: row.home_team_id, away_team_id: row.away_team_id,
  game_type: row.game_type, official_status: row.official_status, doubleheader: row.doubleheader, game_number: row.game_number,
  officialDate: row.metadata?.officialDate, abstractGameState: row.metadata?.abstractGameState,
  homeStarter: row.metadata?.homeProbablePitcher?.id ?? row.metadata?.starter_evidence?.homeProbablePitcher?.id ?? null,
  awayStarter: row.metadata?.awayProbablePitcher?.id ?? row.metadata?.starter_evidence?.awayProbablePitcher?.id ?? null,
})

export function createCanonicalProductionBindings({ client, repository, store, runContext, authorization, oddsApiKey, compactContexts = false }) {
  assertR2TLiveReadiness()
  ensure(repository.executionEnvironment === 'PRODUCTION_SUPABASE', 'REPOSITORY')
  const fetchImpl = (url, options = {}) => {
    const parsed = new URL(url)
    ensure(parsed.protocol === 'https:' && ['statsapi.mlb.com', 'baseballsavant.mlb.com', 'api.the-odds-api.com'].includes(parsed.hostname) && !parsed.username && !parsed.password, 'PROVIDER_HOST')
    ensure(!options.method || options.method === 'GET', 'PROVIDER_METHOD')
    return fetch(url, { ...options, signal: options.signal ?? AbortSignal.timeout(60000), redirect: 'error' })
  }
  return createBindings({ client, repository, store, runContext, authorization, oddsApiKey, fetchImpl, compactContexts, now: () => new Date() }).then(bindings => ({ ...bindings, executionEnvironment: 'PRODUCTION' }))
}

export function createCanonicalCertificationBindings(input) {
  ensure(process.env.R2S_VALIDATION_DIR && input.client?.executionEnvironment === 'DISPOSABLE_PGLITE' && input.repository?.executionEnvironment === 'DISPOSABLE_PGLITE', 'ISOLATED_POSTGRES_REQUIRED')
  return createBindings(input).then(bindings => ({ ...bindings, executionEnvironment: 'DISPOSABLE_PGLITE' }))
}

async function createBindings({ client, repository, store, runContext, authorization, oddsApiKey, fetchImpl, now, compactContexts = false }) {
  ensure(store.locked && typeof now === 'function' && repository.writeJournal, 'EXCLUSIVE_RUN_LOCK_AND_JOURNAL_REQUIRED')
  ensure(authorization?.authorized && authorization.execution_package_sha === runContext.execution_package_sha, 'AUTHORIZATION')
  const runKey = `accounting-${runContext.run_id}`
  const prior = await store.load(runKey) ?? { frozen: sha256(runContext), providers: {}, dml: [] }
  let mission = await store.load('mission-provider-budget') ?? { oddsCalls: 0 }
  ensure(prior.frozen === sha256(runContext), 'ACCOUNTING_FREEZE')
  const caps = authorization.providerCaps
  const limits = { MLB_OFFICIAL: 50, STATCAST: 100, THE_ODDS_API: 5 }
  for (const [provider, cap] of Object.entries(caps)) ensure(Number.isInteger(cap.maxCalls) && cap.maxCalls >= 0 && cap.maxCalls <= (limits[provider] ?? 0), 'PROVIDER_AUTH_CAP')
  const ledger = store.providerLedger ?? createProviderLedger(caps, { initial: prior.providers, onConsume: event => {
    mission = store.load('mission-provider-budget') ?? { oddsCalls: 0 }
    if (event.provider === 'THE_ODDS_API') { ensure(mission.oddsCalls + event.count <= 20, 'MISSION_ODDS_CAP'); mission.oddsCalls += event.count }
    store.save('mission-provider-budget', mission)
    prior.providers[event.provider] = event.consumed
    store.save(runKey, prior)
  } })
  const mlb = createMlbOfficialLiveClient({ fetchImpl, ledger })
  const odds = createTheOddsApiLiveClient({ fetchImpl, ledger, apiKey: oddsApiKey })
  const statcast = createStatcastLiveClient({ fetchImpl, ledger, db: client, cacheDir: store.referenceOnly?null:path.join(store.root, 'statcast-cache') })
  const pregame = createPregameReadRepository(client)
  const registryRepository = createCertifiedFeatureReadRepository(client)
  const recordDml = async record => { prior.dml.push(record); await store.save(runKey, prior) }
  const confirmedMutations = table => repository.writeJournal.summary().filter(r => r.table === table).reduce((sum, r) => sum + (r.actualRows ?? 0), 0)
  const allowed = new Set(authorization.authorizedDmlTargets)
  const requireTarget = table => ensure(allowed.has(table), `UNAUTHORIZED_WRITE_TARGET:${table}`)
  let aliasCache = null
  const preparedPlans = compactContexts ? new Map() : null
  async function acquireSchedule() {
    ensure(operatingDate(now().toISOString()) === runContext.run_date, 'CURRENT_OPERATING_DATE')
    const key = `schedule-${runContext.run_id}`
    const saved = await store.load(key)
    if (saved) { ensure(saved.digest === sha256(saved.payload), 'SCHEDULE_CACHE_DIGEST'); return saved }
    const payload = await mlb.getSchedule({ runDate: runContext.run_date })
    const evidence = { payload, acquiredAt: now().toISOString(), digest: sha256(payload) }
    await store.save(key, evidence)
    return evidence
  }
  async function canonicalAliases() {
    if (aliasCache) return aliasCache
    const teams = await read(client.from('sports_teams').select('id').eq('sport_key', 'baseball_mlb').limit(101), 'teams')
    ensure(teams.length >= 30 && teams.length <= 100, 'TEAM_INVENTORY')
    const rows = []
    for (let from = 0; from < 4000; from += 1000) {
      const page = await read(client.from('pick2_mlb_games').select('game_pk,home_team_id,away_team_id,source,metadata').eq('season', 2026).order('game_pk').range(from, from + 999), 'aliases')
      rows.push(...page)
      if (page.length < 1000) break
      ensure(from < 3000, 'ALIAS_READ_CAP')
    }
    aliasCache = resolveStoredOfficialTeamAliases(rows, teams)
    return aliasCache
  }
  async function reconcileGame(game, previous, aliases) {
    const planned = mapScheduleGameToNativeInsertRow(game, { phase: 'MLB_OPERATIONAL_MANUAL_REFRESH' })
    ensure(planned.home_team_id && planned.away_team_id, 'CANONICAL_TEAMS_REQUIRED')
    ensure(!previous || previous.game_pk === planned.game_pk, 'NATIVE_ROW_IDENTITY_CONFLICT')
    for (const side of ['home', 'away']) ensure(!previous?.[`${side}_team_id`] || previous[`${side}_team_id`] === planned[`${side}_team_id`], 'NATIVE_TEAM_IDENTITY_CONFLICT')
    ensure(!previous || !/Final|Game Over|Completed/i.test(previous.official_status ?? ''), 'NATIVE_FINAL_STATE_CONFLICT')
    if (previous && sha256(businessNative(bindStoredNativeContext(previous, aliases))) === sha256(businessNative(planned))) {
      await recordDml({ table: 'pick2_mlb_games', planned: 1, cap: 1, inserted: 0, updated: 0, reused: 1, conflicts: 0 })
      return previous
    }
    requireTarget('pick2_mlb_games')
    ensure(Date.parse(planned.scheduled_at) > now().getTime(), 'STARTED_NATIVE_WRITE')
    const nativeMutations = confirmedMutations('pick2_mlb_games')
    ensure(nativeMutations + 1 <= (authorization.dmlCaps?.nativeGames ?? 50), 'NATIVE_DML_CAP')
    if (!previous) {
      const plan = classifyInsertReuseConflict({ plannedRows: [planned], existingRows: [], identityFields: ['game_pk'], digestField: 'source_payload_digest', eligibleGamePks: [planned.game_pk], cap: 1 })
      ensure(plan.insertEligible === 1 && plan.blockConflict === 0, 'NATIVE_INSERT_PLAN')
      const result = await repository.insertNativeGames([planned], 1)
      ensure(result.inserted === 1, 'NATIVE_INSERT_COUNT')
      await recordDml({ table: 'pick2_mlb_games', planned: 1, cap: 1, inserted: 1, updated: 0, reused: 0, conflicts: 0 })
    } else {
      ensure(previous.source_payload_digest && previous.updated_at, 'NATIVE_OLD_PROVENANCE')
      const patch = { ...planned, legacy_sport_event_id: previous.legacy_sport_event_id ?? planned.legacy_sport_event_id, metadata: { ...previous.metadata, ...planned.metadata }, updated_at: now().toISOString() }
      const { data, error } = await repository.writeJournal.perform({ table: 'pick2_mlb_games', operation: 'UPDATE', rows: [patch], cap: 1, expectedOld: previous }, () => {
        let query = client.from('pick2_mlb_games').update(patch)
        for (const [column, value] of Object.entries(previous)) query = value === null ? query.is(column, null) : query.eq(column, typeof value === 'object' ? JSON.stringify(value) : value)
        return query.select('game_pk')
      })
      ensure(!error && data?.length === 1, 'NATIVE_EXPECTED_OLD_CONFLICT')
      await recordDml({ table: 'pick2_mlb_games', planned: 1, cap: 1, inserted: 0, updated: 1, reused: 0, conflicts: 0 })
    }
    const rows = await repository.readNativeGames([planned.game_pk])
    ensure(rows.length === 1 && sha256(businessNative(rows[0])) === sha256(businessNative(planned)) && rows[0].source_payload_digest === planned.source_payload_digest, 'NATIVE_READBACK')
    return rows[0]
  }
  async function reconcileStarters(target, starters) {
    const ids = [starters.home.mlbam_pitcher_id, starters.away.mlbam_pitcher_id]
    const existing = await repository.readNativePlayers(ids)
    ensure(new Set(existing.map(r => r.mlbam_person_id)).size === existing.length && existing.every(r => ids.includes(r.mlbam_person_id)), 'PLAYER_IDENTITY_CONFLICT')
    // Player identity is the native MLBAM primary key; existing canonical
    // details are retained. Only absent identities can be INSERT_ELIGIBLE.
    const planned = ids.map(id => ({ mlbam_person_id: id, game_pk: target.gamePk }))
    const projected = existing.map(r => ({ mlbam_person_id: r.mlbam_person_id, game_pk: target.gamePk }))
    const inserted = confirmedMutations('pick2_mlb_players')
    const cap = Math.min(ids.length, (authorization.dmlCaps?.nativePlayers ?? 100) - inserted)
    ensure(cap >= 0, 'PLAYER_DML_CAP')
    const classify = (rows, limit) => classifyInsertReuseConflict({ plannedRows: planned, existingRows: rows, identityFields: ['mlbam_person_id'], eligibleGamePks: [target.gamePk], cap: limit })
    const plan = classify(projected, cap)
    const eligibleIds = new Set(plan.classifications.filter(r => r.classification === 'INSERT_ELIGIBLE').map(r => Number(r.identity)))
    const rows = ['home', 'away'].filter(side => eligibleIds.has(starters[side].mlbam_pitcher_id)).map(side => {
      const evidence = target.native.metadata[`${side}ProbablePitcher`]
      return { mlbam_person_id: starters[side].mlbam_pitcher_id, full_name: evidence.fullName ?? null, source: 'mlb_official', source_payload_digest: sha256(evidence),
        metadata: { source: 'MLB_OFFICIAL_SCHEDULE', source_game_pk: target.gamePk, observed_at: target.observationTimestamp } }
    })
    ensure(rows.length === plan.insertEligible && plan.blockConflict === 0, 'PLAYER_PREWRITE_PLAN')
    if (rows.length) {
      requireTarget('pick2_mlb_players')
      ensure(Date.parse(target.scheduledAt) > now().getTime(), 'STARTED_PLAYER_WRITE')
      const result = await repository.insertNativePlayers(rows, cap)
      ensure(result.inserted === rows.length, 'PLAYER_INSERT_COUNT')
    }
    const readback = await repository.readNativePlayers(ids)
    ensure(readback.length === ids.length && readback.every(r => ids.includes(r.mlbam_person_id)), 'PLAYER_READBACK')
    for (const row of rows) ensure(readback.some(r => r.mlbam_person_id === row.mlbam_person_id && r.source_payload_digest === row.source_payload_digest && r.full_name === row.full_name), 'PLAYER_INSERT_DIGEST_READBACK')
    const repeated = classify(readback.map(r => ({ mlbam_person_id: r.mlbam_person_id, game_pk: target.gamePk })), 0)
    ensure(repeated.insertEligible === 0 && repeated.reuseNoOp === ids.length, 'PLAYER_IDEMPOTENCY')
    await recordDml({ table: 'pick2_mlb_players', game_pk: target.gamePk, candidates: plan.plannedRows, planned: plan.insertEligible, cap, inserted: rows.length, updated: 0, reused: plan.reuseNoOp, conflicts: plan.blockConflict })
  }
  return {
    checkpoint: store,
    registryRepository,
    providerAccounting: () => ({ ...ledger.snapshot(), missionOddsConsumed: ledger.missionOddsConsumed?.() ?? mission.oddsCalls }),
    dmlAccounting: () => ({ writes: repository.writeJournal.summary(), sourcePlans: prior.dml }),
    async readContexts() {
      await repository.writeJournal.recover()
      await verifyChampionRegistry(registryRepository)
      const scheduleEvidence = await acquireSchedule()
      const aliases = await canonicalAliases()
      const slate = await getCurrentSlate({ mode: 'LIVE_EXECUTE', runDate: runContext.run_date, runAsOf: runContext.run_as_of, injectedEvidence: scheduleEvidence.payload, teamMap: aliases, liveAuthorization: true })
      ensure(slate.artifact.games.length <= 50, 'SLATE_CAP')
      const frozenScope=store.frozenScope
      const eligible = slate.artifact.games.filter(g => (!frozenScope || frozenScope.includes(g.game_pk)) && g.pregame_classification === 'PREGAME_SAFE' && g.metadata.abstractGameState === 'Preview' && ['Scheduled', 'Pre-Game', 'Warmup'].includes(g.status) && g.game_type === 'R' && Date.parse(g.scheduled_at) > now().getTime())
      const blockedGames = slate.artifact.games.filter(g => !eligible.includes(g)).map(g => ({ gamePk: g.game_pk, reason: 'NOT_PREGAME' }))
      const scope = frozenScope ?? eligible.map(g => g.game_pk)
      await store.freezeScope?.(scope)
      const existing = await repository.readNativeGames(scope)
      if(store.freezeDependencyScope) {
        const missing=new Set()
        for(const native of existing) {
          let target,starters
          try {target=resolvePregameTarget({native:bindStoredNativeContext(native,aliases),runAsOf:runContext.run_as_of,eligibleGamePks:scope});starters=resolveStarterContext(target)}
          catch {continue} // The main reconciliation loop classifies the reason.
          const inventory=await pregame.readDependencies(target,starters,{inventoryMissing:true,inventoryOnly:true})
          inventory.missingGamePks.forEach(id=>missing.add(id))
        }
        await store.freezeDependencyScope([...missing].sort((a,b)=>a-b))
      }
      const contexts = [], nativeGames = []
      for (const game of eligible) {
        const native = await reconcileGame(game, existing.find(r => r.game_pk === game.game_pk), aliases)
        const bound = bindStoredNativeContext(native, aliases)
        // Newly acquired context is current evidence, not historical evidence
        // at the earlier run-start freeze. A subsequent run can use this row.
        if (Date.parse(bound.updated_at) > Date.parse(runContext.run_as_of) || Date.parse(bound.created_at) > Date.parse(runContext.run_as_of)) {
          blockedGames.push({ gamePk: game.game_pk, reason: 'NEW_CANONICAL_EVIDENCE_AFTER_RUN_FREEZE' }); continue
        }
        let target, starters
        try { target = resolvePregameTarget({ native: bound, runAsOf: runContext.run_as_of, eligibleGamePks: scope }); starters = resolveStarterContext(target) }
        catch (error) {
          if (/STARTER_MISSING|STARTER_CHANGED|STARTER_CONFLICT|PREGAME_STATUS/.test(error.message)) { blockedGames.push({ gamePk: game.game_pk, reason: error.message }); continue }
          throw error
        }
        await reconcileStarters(target, starters)
        const dependencies = await pregame.readDependencies(target, starters, { inventoryMissing: true })
        if (dependencies.missingGamePks.length) {
          await store.freezeDependencyScope?.(dependencies.missingGamePks)
          requireTarget('pick2_raw_mlb_statcast_pitches')
          const seenRawIds=new Set()
          for await (const rows of statcast.streamRowsForGames({ eligibleGamePks: dependencies.missingGamePks, dependencyDates: [...new Set(dependencies.missingGameDates.map(g => g.gameDate))], runAsOf: runContext.run_as_of, providerBudget: caps })) {
          ensure(rows.every(r => dependencies.missingGamePks.includes(r.game_pk) && r.game_date < target.performanceCutoff && r.game_year === Number(target.gameDate.slice(0, 4)) && dependencies.missingGameDates.some(d => d.gamePk === r.game_pk && d.gameDate === r.game_date)), 'RAW_SCOPE_ESCAPE')
          ensure(rows.length<=100 && rows.every(r=>!seenRawIds.has(r.id)) && new Set(rows.map(r=>r.id)).size===rows.length,'RAW_CAP_OR_DUPLICATE')
          rows.forEach(r=>seenRawIds.add(r.id))
          ensure(seenRawIds.size<=dependencies.missingGamePks.length*1000,'RAW_CAP_OR_DUPLICATE')
          const priorRows = await repository.readRawRows(rows.map(r => r.id))
          ensure(priorRows.every(r => rows.some(p => p.id === r.id && p.raw_payload_digest === r.raw_payload_digest)), 'RAW_IMMUTABLE_CONFLICT')
          const rawInserted = confirmedMutations('pick2_raw_mlb_statcast_pitches')
          const rawCap = Math.min(rows.length, (authorization.dmlCaps?.rawStatcast ?? rawInserted + rows.length) - rawInserted)
          ensure(rawCap >= 0 && rows.every(r => r.raw_payload_digest), 'RAW_DML_CAP_OR_DIGEST')
          const plan = classifyInsertReuseConflict({ plannedRows: rows, existingRows: priorRows, identityFields: ['id'], digestField: 'raw_payload_digest', eligibleGamePks: dependencies.missingGamePks, cap: rawCap })
          const eligibleIds = new Set(plan.classifications.filter(r => r.classification === 'INSERT_ELIGIBLE').map(r => r.identity))
          const inserts = rows.filter(r => eligibleIds.has(r.id))
          ensure(inserts.length === plan.insertEligible && plan.blockConflict === 0, 'RAW_PREWRITE_PLAN')
          for (let start = 0; start < inserts.length; start += 100) {
            const batch = inserts.slice(start, start + 100)
            await repository.insertRawRows(batch, batch.length)
            const readback = await repository.readRawRows(batch.map(r => r.id))
            ensure(readback.length === batch.length && readback.every(r => batch.some(p => p.id === r.id && p.raw_payload_digest === r.raw_payload_digest)), 'RAW_READBACK')
            await recordDml({ table: 'pick2_raw_mlb_statcast_pitches', planned: batch.length, cap: batch.length, inserted: batch.length, updated: 0, reused: 0, conflicts: 0 })
          }
          const readback = await repository.readRawRows(rows.map(r => r.id))
          const repeated = classifyInsertReuseConflict({ plannedRows: rows, existingRows: readback, identityFields: ['id'], digestField: 'raw_payload_digest', eligibleGamePks: dependencies.missingGamePks, cap: 0 })
          ensure(repeated.reuseNoOp === rows.length && repeated.insertEligible === 0, 'RAW_IDEMPOTENCY')
          }
          blockedGames.push({ gamePk: game.game_pk, reason: 'NEW_RAW_EVIDENCE_AFTER_RUN_FREEZE' }); continue
        }
        if (dependencies.rows.some(r => Date.parse(r.ingested_at) > Date.parse(runContext.run_as_of) || Date.parse(r.created_at) > Date.parse(runContext.run_as_of))) {
          blockedGames.push({ gamePk: game.game_pk, reason: 'NEW_RAW_EVIDENCE_AFTER_RUN_FREEZE' }); continue
        }
        if (compactContexts) {
          const prepared=prepareCompactFeatureContext({context:{target,starters,dependencies},runDate:runContext.run_date,runAsOf:runContext.run_as_of})
          contexts.push(prepared.context);preparedPlans.set(target.gamePk,prepared.generated)
        }
        else {
          buildPregameFeatureRows({ target, starters, rawRows: dependencies.rows, dependencyGamePks: dependencies.dependencyGamePks })
          contexts.push({ target, starters, dependencies })
        }
        const rawGame = scheduleEvidence.payload.dates.flatMap(d => d.games).find(g => g.gamePk === game.game_pk)
        nativeGames.push({ game_pk: game.game_pk, scheduled_at: target.scheduledAt, home_team_name: rawGame.teams.home.team.name, away_team_name: rawGame.teams.away.team.name })
      }
      return { contexts, nativeGames, blockedGames }
    },
    async getOddsEvidence() {
      const key = `odds-${runContext.run_id}`
      const saved = await store.load(key)
      if (saved) { ensure(saved.responseDigest === sha256(saved.payload), 'ODDS_CACHE_DIGEST'); return saved }
      const payload = await odds.getMoneylineOdds()
      const evidence = { payload, acquiredAt: now().toISOString(), responseDigest: sha256(payload) }
      await store.save(key, evidence)
      return evidence
    },
    ...(compactContexts ? { buildFeaturePlan: args => buildCompactFeaturePlan({ ...args, preparedPlans, readDependencies: (target,starters) => pregame.readDependencies(target,starters) }) } : {}),
    ...(compactContexts ? {restoreFeaturePlan:args=>restorePinnedFeaturePlan({...args,repository})}:{}),
    async restoreContexts({references,scope}) {
      ensure(compactContexts,'COMPACT_CONTEXTS_REQUIRED')
      const aliases=await canonicalAliases(),rows=await repository.readNativeGames(scope),contexts=[]
      for(const reference of references.filter(r=>r.kind==='pregame_target')) {
        const native=rows.find(r=>String(r.game_pk)===reference.identity)
        ensure(native,'CANONICAL_CONTEXT_MISSING')
        const target=resolvePregameTarget({native:bindStoredNativeContext(native,aliases),runAsOf:runContext.run_as_of,eligibleGamePks:scope})
        const starters=resolveStarterContext(target)
        ensure(sha256({target,starters})===reference.digest && reference.asOf===target.runAsOf,'CANONICAL_CONTEXT_DRIFT')
        const raw=references.find(r=>r.kind==='raw_dependencies' && r.identity===reference.identity),dependency=references.find(r=>r.kind==='dependency_scope' && r.identity===reference.identity)
        ensure(raw && dependency && dependency.asOf===target.runAsOf,'CANONICAL_DEPENDENCY_REFERENCE')
        ensure(dependency.count>0 && dependency.count<=500 && raw.count>0 && raw.count<=dependency.count*1000 && Date.parse(raw.asOf)<=Date.parse(target.runAsOf),'CANONICAL_DEPENDENCY_PROVENANCE')
        contexts.push({target,starters,dependencies:{scopeDigest:dependency.digest,dependencyCount:dependency.count,actualRows:raw.count,dependencyDigest:raw.digest,latestAvailableAt:raw.asOf}})
      }
      return contexts
    },
    async classifyCurrentGames({ contexts, at, domain }) {
      const rows = await repository.readNativeGames(contexts.map(c => c.target.gamePk))
      ensure(new Set(rows.map(r=>r.game_pk)).size===rows.length && rows.every(r=>contexts.some(c=>c.target.gamePk===r.game_pk)), 'NATIVE_REVALIDATION_COUNT')
      const requireCurrent = ['predictions','values','officialPicks'].includes(domain)
      let games = [], evidenceDigest = sha256(rows)
      if (requireCurrent && contexts.length) {
        const fresh = await mlb.getSchedule({ runDate: runContext.run_date })
        evidenceDigest = sha256(fresh)
        const slate = await getCurrentSlate({ mode: 'LIVE_EXECUTE', runDate: runContext.run_date, runAsOf: at, injectedEvidence: fresh, teamMap: await canonicalAliases(), liveAuthorization: true })
        games = slate.artifact.games
      }
      const observedAt=now().toISOString()
      return { at: observedAt, evidenceDigest, results: contexts.map(context=>classifyCurrentGame({ context, native: rows.find(r=>r.game_pk===context.target.gamePk), currentGame: games.find(g=>g.game_pk===context.target.gamePk), at: observedAt, requireCurrent })) }
    },
    async assertCurrentStarters({ contexts, at, domain }) {
      const rows = await repository.readNativeGames(contexts.map(c => c.target.gamePk))
      ensure(rows.length === contexts.length, 'NATIVE_REVALIDATION_COUNT')
      for (const context of contexts) {
        const native = rows.find(r => r.game_pk === context.target.gamePk)
        ensure(Date.parse(native.scheduled_at) > Date.parse(at) && sha256(businessNative(native)) === sha256(businessNative(context.target.native)), 'STARTER_OR_STATUS_CHANGED')
      }
      if (['predictions', 'values', 'officialPicks'].includes(domain)) {
        // Current provider evidence is veto-only: it can block a changed starter
        // or started game, but cannot replace the earlier frozen model inputs.
        const fresh = await mlb.getSchedule({ runDate: runContext.run_date })
        const slate = await getCurrentSlate({ mode: 'LIVE_EXECUTE', runDate: runContext.run_date, runAsOf: at, injectedEvidence: fresh, teamMap: await canonicalAliases(), liveAuthorization: true })
        for (const context of contexts) {
          const game = slate.artifact.games.find(g => g.game_pk === context.target.gamePk)
          ensure(game && game.pregame_classification === 'PREGAME_SAFE' && game.metadata.abstractGameState === 'Preview' && Date.parse(game.scheduled_at) > now().getTime(), 'CURRENT_STARTED_GAME_VETO')
          ensure(game.home_team_id === context.target.homeTeamId && game.away_team_id === context.target.awayTeamId && Date.parse(game.scheduled_at) === Date.parse(context.target.scheduledAt), 'CURRENT_GAME_IDENTITY_VETO')
          ensure(game.metadata.homeProbablePitcher?.id === context.starters.home.mlbam_pitcher_id && game.metadata.awayProbablePitcher?.id === context.starters.away.mlbam_pitcher_id, 'CURRENT_STARTER_CHANGE_VETO')
        }
      }
    },
  }
}
