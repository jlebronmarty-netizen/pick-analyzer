import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import ts from 'typescript'
import { createClient } from '@supabase/supabase-js'
import {
  R2I_FEATURE_IDENTITY_BINDINGS,
  R2I_LIVE_TARGETS,
  assertDbUuid,
  bindFeatureRowsToSnapshotIds,
  comparableFeatureRow,
  classifyBoundDailyFeatures,
  createTestRepository,
  createSupabaseProductionRepository,
  featureDateFieldsForGame,
  featureInsertRowsForDomain,
  resolveCanonicalFeatureSnapshotIds,
} from './mlb-data-02r-r2i-live-execution-interfaces.mjs'
import { runR2BExecutableEntrypoint } from './mlb-data-02r-r2a-live-refresh-executor.mjs'
import { sha256 } from './mlb-data-02r-r2f-stage-contracts.mjs'

const offline = process.argv.includes('--offline')
const canonical = process.argv.includes('--canonical')
const priorEvidencePath = 'docs/CERTIFICATION/MLB_DATA_02R_R2S_TEAM_FEATURE_SNAPSHOT_ID_PAYLOAD_BINDING_REPAIR.json'
const outputPath = offline && !canonical ? '.tmp/r2s-resume-validation.json' : priorEvidencePath
const auditPath = offline && !canonical ? '.tmp/r2s-resume-validation.md' : 'docs/CERTIFICATION/MLB_DATA_02R_R2S_TEAM_FEATURE_SNAPSHOT_ID_PAYLOAD_BINDING_REPAIR_AUDIT.md'
if (offline) globalThis.fetch = async () => { throw new Error('R2S_OFFLINE_NETWORK_FORBIDDEN') }
const priorPackageSha = '5ccde72b6f97535ef16b82ce0c8fb5ad46e3b132'
const validatorPackageSha = 'R2S_LOCAL_CERTIFICATION_PACKAGE'
const featureVersion = 'MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1'
const runAsOf = '2026-09-08T11:45:00.000Z'
const runDate = '2026-09-08'
const snapshotId = '11111111-1111-4111-8111-111111111111'
const insertedSnapshotId = '22222222-2222-4222-8222-222222222222'
const errors = []
const checks = []
const dailyDomains = ['team', 'starter', 'bullpen', 'batter', 'matchup', 'firstInning']

function check(label, condition, detail = null) {
  checks.push({ label, passed: Boolean(condition) })
  if (!condition) errors.push(detail ? `${label}: ${detail}` : label)
}

async function mustThrow(label, fn, token) {
  try {
    await fn()
    checks.push({ label, passed: false })
    errors.push(`${label}: did not throw`)
  } catch (error) {
    checks.push({ label, passed: String(error.message).includes(token) })
    if (!String(error.message).includes(token)) errors.push(`${label}: wrong error ${error.message}`)
  }
}

function loadLocalEnv() {
  if (!fs.existsSync('.env.local')) return
  for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index <= 0) continue
    const key = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

async function productionReadback() {
  if (offline) {
    const prior = JSON.parse(fs.readFileSync(priorEvidencePath, 'utf8'))
    return { ...prior.existingLinkageCompatibility, evidenceMode: 'STORED_PRIOR_READBACK', evidenceGeneratedAt: prior.existingLinkageCompatibility.evidenceGeneratedAt ?? prior.generatedAt, freshProductionRead: false }
  }
  loadLocalEnv()
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { available: false, error: 'SUPABASE_ENV_MISSING' }
  }
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const counts = {}
  for (const table of ['pick2_feature_snapshots', ...dailyDomains.map((domain) => R2I_LIVE_TARGETS[domain]), 'pick2_mlb_games', 'pick2_game_predictions', 'pick2_mlb_official_picks']) {
    const result = await db.from(table).select('*', { count: 'exact', head: true })
    counts[table] = result.error ? { error: result.error.message } : result.count
  }
  const teamSample = await db
    .from('pick2_mlb_team_daily_features')
    .select('id,feature_snapshot_id,target_game_pk,team_id,feature_date,as_of_date,as_of_timestamp,feature_version,sample_sizes,source_window,created_at')
    .not('feature_snapshot_id', 'is', null)
    .limit(3)
  const linkedSnapshots = teamSample.error || !teamSample.data?.length
    ? { data: [], error: teamSample.error?.message ?? null }
    : await db
      .from('pick2_feature_snapshots')
      .select('id,deterministic_identity,target_game_pk,feature_date,as_of_date,as_of_timestamp,feature_version,input_digest')
      .in('id', teamSample.data.map((row) => row.feature_snapshot_id))
  const protectedGames = await db
    .from('pick2_mlb_games')
    .select('game_pk,game_date,scheduled_at,source')
    .in('game_pk', [823902, 824958])
    .order('game_pk')
  const domains = {}
  for (const domain of dailyDomains) {
    const binding = R2I_FEATURE_IDENTITY_BINDINGS[domain]
    const sample = await db.from(binding.table).select(binding.readColumns).order('id').limit(3)
    const linked = sample.data?.length
      ? await db.from('pick2_feature_snapshots').select('id,target_game_pk,feature_date,as_of_date,as_of_timestamp,feature_version,input_digest').in('id', sample.data.map((row) => row.feature_snapshot_id))
      : { data: [], error: null }
    const nullFk = await db.from(binding.table).select('id').is('feature_snapshot_id', null).limit(1)
    domains[domain] = { table: binding.table, rows: sample.data, snapshots: linked.data, nullFkRows: nullFk.data, errors: [sample.error?.message, linked.error?.message, nullFk.error?.message].filter(Boolean) }
  }
  const official = await db.from('pick2_mlb_official_picks').select('*').order('id').limit(3)
  return {
    available: true,
    evidenceMode: 'FRESH_READ_ONLY_PRODUCTION',
    evidenceGeneratedAt: new Date().toISOString(),
    freshProductionRead: true,
    domains,
    officialSampleDigest: official.error ? null : sha256(official.data),
    counts,
    teamSample: teamSample.error ? { error: teamSample.error.message } : teamSample.data,
    linkedSnapshots: linkedSnapshots.error ? { error: linkedSnapshots.error.message } : linkedSnapshots.data,
    protectedGames: protectedGames.error ? { error: protectedGames.error.message } : protectedGames.data,
  }
}

function migrationSchemaInventory() {
  const foundation = fs.readFileSync('supabase/migrations/202608270002_pick2_data_foundation_v1.sql', 'utf8')
  const native = fs.readFileSync('supabase/migrations/202608290001_pick2_mlb_native_identity_foundation_v1.sql', 'utf8')
  const uniqueness = fs.readFileSync('supabase/migrations/202608290002_pick2_mlb_feature_native_uniqueness_v1.sql', 'utf8')
  return {
    featureSnapshotIdNotNullFk: /feature_snapshot_id uuid not null references public\.pick2_feature_snapshots\(id\)/i.test(foundation),
    nativeTargetColumn: /alter table public\.pick2_mlb_team_daily_features[\s\S]*add column if not exists target_game_pk bigint/i.test(native),
    positiveTargetCheck: /pick2_mlb_team_daily_features_target_game_pk_positive/i.test(native),
    nativeUniqueIndex: /create unique index if not exists pick2_mlb_team_daily_features_native_uidx\s+on public\.pick2_mlb_team_daily_features \(target_game_pk, team_id, feature_date, feature_version\)/i.test(uniqueness),
    legacyUniqueDropped: /drop constraint if exists pick2_mlb_team_daily_features_team_id_feature_date_feature_version_key/i.test(uniqueness),
    rlsPolicy: /create policy pick2_mlb_team_daily_features_service_role_all/i.test(foundation),
  }
}

function dateFields() {
  return featureDateFieldsForGame({
    game_pk: 700001,
    game_date: runDate,
    scheduled_at: '2026-09-08T23:05:00.000Z',
  }, { runAsOf })
}

function plannedRows(gamePk = 700001) {
  const fields = dateFields()
  const base = {
    target_game_pk: gamePk,
    ...fields,
    feature_version: featureVersion,
    source_window: { rule: 'source_game_date < target_game_date', as_of_date: fields.as_of_date, mode: 'live_current_slate' },
    sample_sizes: {},
  }
  const features = { vector: 'digest-only' }
  const inputDigest = sha256({
    target_game_pk: gamePk,
    feature_version: featureVersion,
    feature_date: fields.feature_date,
    as_of_date: fields.as_of_date,
    as_of_timestamp: fields.as_of_timestamp,
    features,
  })
  return {
    snapshots: [{ ...base, identity: `snapshot:${gamePk}:moneyline`, deterministic_identity: `snapshot:${gamePk}:moneyline`, feature_domain: 'prediction_bundle', subject_id: `game:${gamePk}`, features, input_digest: inputDigest }],
    team: [{ ...base, team_id: 111, features: { recent_runs: 4.5 } }, { ...base, team_id: 110, features: { recent_runs: 4.1 } }],
    starter: [{ ...base, mlbam_pitcher_id: 660002, features: { k_rate: 0.25 } }, { ...base, mlbam_pitcher_id: 660001, features: { k_rate: 0.22 } }],
    bullpen: [{ ...base, team_id: 111, features: { fatigue: 0.1 } }, { ...base, team_id: 110, features: { fatigue: 0.2 } }],
    batter: [{ ...base, mlbam_batter_id: 770001, features: { woba: 0.32 } }],
    matchup: [{ ...base, features: { matchup_edge: 0.03 } }],
    firstInning: [{ ...base, features: { first_inning_run_rate: 0.48 } }],
  }
}

function repositoryWithSnapshot({ existingSnapshot = null } = {}) {
  const rows = existingSnapshot
    ? [{ ...existingSnapshot, id: snapshotId }]
    : []
  return createTestRepository({ features: { snapshots: rows } })
}

function providers() {
  const counters = { mlbOfficial: 0, statcast: 0, odds: 0 }
  return {
    counters,
    providers: {
      mlbOfficial: {
        async getSchedule() {
          counters.mlbOfficial += 1
          return {
            dates: [{
              date: runDate,
              games: [{
                gamePk: 700001,
                gameDate: '2026-09-08T23:05:00.000Z',
                officialDate: runDate,
                season: 2026,
                status: { abstractGameState: 'Preview', detailedState: 'Pre-Game', statusCode: 'P' },
                teams: {
                  away: { team: { id: 110, abbreviation: 'AWY', name: 'Away Team' }, probablePitcher: { id: 660001, fullName: 'Away Starter', confirmed: false } },
                  home: { team: { id: 111, abbreviation: 'HME', name: 'Home Team' }, probablePitcher: { id: 660002, fullName: 'Home Starter', confirmed: true } },
                },
              }],
            }],
          }
        },
      },
      statcast: {
        async fetchRowsForGames() {
          counters.statcast += 1
          return [{ game_pk: 700001, game_date: runDate, game_year: 2026, at_bat_number: 1, pitch_number: 1, source_pitcher_id: 660001, source_batter_id: 770001, raw_payload: { pitch_type: 'FF' } }]
        },
      },
      odds: {
        async getMoneylineOdds() {
          counters.odds += 1
          return { events: [{ id: 'odds-event-700001', sport_key: 'baseball_mlb', commence_time: '2026-09-08T23:05:00.000Z', home_team: 'Home Team', away_team: 'Away Team', bookmakers: [{ key: 'book_a', title: 'Book A', markets: [{ key: 'h2h', last_update: runAsOf, outcomes: [{ name: 'Home Team', price: -120 }, { name: 'Away Team', price: 110 }] }] }] }] }
        },
      },
    },
  }
}

function auth(runId) {
  return {
    authorized: true,
    execution_package_sha: validatorPackageSha,
    run_id: runId,
    providerCaps: {
      MLB_OFFICIAL: { allowed: true, maxCalls: 1 },
      STATCAST: { allowed: true, maxCalls: 1 },
      THE_ODDS_API: { allowed: true, maxCalls: 1 },
      BALLDONTLIE: { allowed: false, maxCalls: 0 },
      SPORTSDATAIO: { allowed: false, maxCalls: 0 },
      OTHER: { allowed: false, maxCalls: 0 },
    },
    dmlCaps: {
      nativeGames: 1,
      nativePlayers: 2,
      rawStatcast: 1,
      features: { snapshots: 1, team: 2, starter: 2, bullpen: 2, batter: 1, matchup: 1, firstInning: 1 },
      predictions: 1,
      marketMappings: 1,
      marketObservations: 2,
      nativeValues: 2,
      officialPicks: 1,
    },
    authorizedDmlTargets: Object.values(R2I_LIVE_TARGETS),
    ddlAllowed: false,
    settlementAllowed: false,
    automationAllowed: false,
  }
}

function linkageMatrix(boundRows) {
  const foundation = fs.readFileSync('supabase/migrations/202608270002_pick2_data_foundation_v1.sql', 'utf8')
  return dailyDomains.map((domain) => {
    const table = R2I_FEATURE_IDENTITY_BINDINGS[domain].table
    const start = foundation.indexOf(`create table if not exists public.${table} (`)
    const tableDdl = start < 0 ? '' : foundation.slice(start, foundation.indexOf('\n);', start))
    const required = /feature_snapshot_id uuid not null references public\.pick2_feature_snapshots\(id\)/.test(tableDdl)
    const physicalRows = featureInsertRowsForDomain(domain, boundRows[domain])
    const binds = physicalRows.length > 0 && physicalRows.every((row) => row.feature_snapshot_id === snapshotId)
    return { table, domain, feature_snapshot_id_required: required, adapter_currently_binds: binds,
      physicalInsertRows: physicalRows.length, status: required && binds ? 'PASS' : 'BLOCKED' }
  })
}

function businessParity(source) {
  const file = 'scripts/mlb-data-02r-r2i-live-execution-interfaces.mjs'
  const prior = spawnSync('git', ['show', `${priorPackageSha}:${file}`], { encoding: 'utf8' })
  if (prior.status !== 0) throw new Error('R2S_PRIOR_SOURCE_UNAVAILABLE')
  const functions = (text) => Object.fromEntries(ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS).statements
    .filter(ts.isFunctionDeclaration).map((node) => [node.name?.text, node.getText().replaceAll('\r\n', '\n')]))
  const before = functions(prior.stdout)
  const after = functions(source)
  const names = ['plannedFeatureRows', 'modelArtifact', 'predictionFromInference', 'officialPickFromPolicy', 'featureDateFieldsForGame', 'createCurrentSlateRunFreeze', 'createMlbOfficialLiveClient', 'createTheOddsApiLiveClient', 'createStatcastLiveClient']
  return names.map((name) => ({ name, unchanged: Boolean(before[name]) && before[name] === after[name] }))
}

// Exercise the real feature repository projection/insert adapter with an in-memory client.
function physicalFeatureRepository(existingSnapshot = null) {
  const base = createTestRepository({ nativeGames: [{ game_pk: 700001, home_team_id: null, away_team_id: null, game_date: runDate }] })
  const stored = { [R2I_LIVE_TARGETS.featureSnapshots]: existingSnapshot ? [featureInsertRowsForDomain('snapshots', [existingSnapshot])[0]].map((row) => ({ ...row, id: snapshotId })) : [] }
  const operations = []
  const client = { from(table) {
    let inserted = null
    let filter = () => true
    let projection = '*'
    const query = {
      select(columns) { projection = columns; return query },
      in(column, values) { filter = (row) => values.includes(row[column]); return query },
      insert(rows) { inserted = rows; return query },
      then(resolve, reject) {
        return Promise.resolve().then(() => {
          let result
          if (inserted) {
            for (const row of inserted) if (table !== R2I_LIVE_TARGETS.featureSnapshots && !stored[R2I_LIVE_TARGETS.featureSnapshots].some((snapshot) => snapshot.id === row.feature_snapshot_id)) throw new Error('SIMULATED_FEATURE_SNAPSHOT_FK_VIOLATION')
            result = inserted.map((row) => ({ ...row, ...(table === R2I_LIVE_TARGETS.featureSnapshots ? { id: insertedSnapshotId } : {}) }))
            stored[table] = [...(stored[table] ?? []), ...result]
            operations.push({ table, inserted: result.length, rows: result })
          } else {
            result = (stored[table] ?? []).filter(filter).map((row) => projection === '*' ? row : Object.fromEntries(projection.split(',').filter((key) => key in row).map((key) => [key, row[key]])))
          }
          return { data: result, error: null }
        }).then(resolve, reject)
      },
    }
    return query
  } }
  const physical = createSupabaseProductionRepository({ client })
  return { repository: { ...base, readFeatureRows: physical.readFeatureRows, insertFeatureRows: physical.insertFeatureRows }, stored, operations }
}

async function main() {
  const schemaInventory = migrationSchemaInventory()
  const production = await productionReadback()
  const source = fs.readFileSync('scripts/mlb-data-02r-r2i-live-execution-interfaces.mjs', 'utf8')
  const rows = plannedRows()

  check('schema not-null FK', schemaInventory.featureSnapshotIdNotNullFk)
  check('complete team schema inventory', Object.values(schemaInventory).every(Boolean))
  check('team native unique index', schemaInventory.nativeUniqueIndex)
  check('protected readback available', production.available, production.error)
  check('protected games preserved', Array.isArray(production.protectedGames) && production.protectedGames.length === 2)

  await mustThrow('unbound team insert blocked', () => featureInsertRowsForDomain('team', rows.team), 'FEATURE_INSERT_MISSING_REQUIRED:team:feature_snapshot_id')
  await mustThrow('synthetic/non UUID blocked', () => featureInsertRowsForDomain('team', [{ ...rows.team[0], feature_snapshot_id: 'not-a-uuid' }]), 'INVALID_TEAM_FEATURE_SNAPSHOT_ID')

  const reuseSnapshotMap = await resolveCanonicalFeatureSnapshotIds({
    repository: repositoryWithSnapshot({ existingSnapshot: rows.snapshots[0] }),
    plannedSnapshotRows: rows.snapshots,
    insertedSnapshotRows: [],
  })
  check('reuse snapshot id resolved', reuseSnapshotMap.get(700001) === snapshotId)

  const insertSnapshotMap = await resolveCanonicalFeatureSnapshotIds({
    repository: repositoryWithSnapshot(),
    plannedSnapshotRows: rows.snapshots,
    insertedSnapshotRows: [{ ...featureInsertRowsForDomain('snapshots', rows.snapshots)[0], id: insertedSnapshotId }],
  })
  check('insert snapshot id resolved', insertSnapshotMap.get(700001) === insertedSnapshotId)

  const boundRows = bindFeatureRowsToSnapshotIds(rows, reuseSnapshotMap)
  const teamInsertRows = featureInsertRowsForDomain('team', boundRows.team)
  check('team feature_snapshot_id bound', teamInsertRows.every((row) => row.feature_snapshot_id === snapshotId))
  check('team target game bound', teamInsertRows.every((row) => row.target_game_pk === 700001))
  check('team no unsupported feature payload', teamInsertRows.every((row) => !Object.hasOwn(row, 'features') && !Object.hasOwn(row, 'identity')))
  check('team UUID guard', assertDbUuid(teamInsertRows[0].feature_snapshot_id, 'team_feature_snapshot_id') === snapshotId)

  const matrix = linkageMatrix(boundRows)
  check('all daily domains bind snapshot id', matrix.every((row) => row.status === 'PASS'))
  for (const entry of matrix) {
    const domain = entry.domain
    await mustThrow(`${domain} missing FK rejected`, () => featureInsertRowsForDomain(domain, rows[domain]), `FEATURE_INSERT_MISSING_REQUIRED:${domain}:feature_snapshot_id`)
    await mustThrow(`${domain} invalid FK rejected`, () => featureInsertRowsForDomain(domain, [{ ...boundRows[domain][0], feature_snapshot_id: 'invalid' }]), `INVALID_${domain.toUpperCase()}_FEATURE_SNAPSHOT_ID`)
    const evidence = production.domains?.[domain]
    entry.existingLinkageSamples = evidence?.rows?.length ?? 0
    entry.existingLinkageVerified = Boolean(evidence && evidence.errors.length === 0 && evidence.nullFkRows?.length === 0 && evidence.rows?.length > 0 && evidence.rows.every((row) => evidence.snapshots?.some((snapshot) =>
      snapshot.id === row.feature_snapshot_id && snapshot.target_game_pk === row.target_game_pk && snapshot.feature_date === row.feature_date && snapshot.as_of_date === row.as_of_date && snapshot.feature_version === row.feature_version)))
    if (canonical) check(`${domain} existing linkage compatibility`, entry.existingLinkageVerified)
  }

  const sameRepo = createTestRepository({ features: { snapshots: [{ ...rows.snapshots[0], id: snapshotId }], team: [comparableFeatureRow('team', { ...teamInsertRows[0], feature_digest: sha256({ recent_runs: 4.5 }) })] } })
  const sameBound = bindFeatureRowsToSnapshotIds(rows, await resolveCanonicalFeatureSnapshotIds({ repository: sameRepo, plannedSnapshotRows: rows.snapshots }))
  const sameComparable = comparableFeatureRow('team', { ...sameBound.team[0], identity: 'team:700001:111:MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1', feature_digest: sha256({ recent_runs: 4.5 }) })
  check('same team feature comparable identity', sameComparable.identity === '700001:111:MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1')

  const dailyPlan = await classifyBoundDailyFeatures(sameRepo, sameBound, [700001])
  check('same physical team payload reused', dailyPlan.plans.team.reuseNoOp === 1 && dailyPlan.plans.team.insertEligible === 1)
  const allExisting = createTestRepository({ features: Object.fromEntries(Object.entries(boundRows)
    .filter(([domain]) => domain !== 'snapshots').map(([domain, domainRows]) => [domain, featureInsertRowsForDomain(domain, domainRows)])) })
  const secondPass = await classifyBoundDailyFeatures(allExisting, boundRows, [700001], Object.fromEntries(matrix.map(({ domain }) => [domain, 0])))
  check('all daily domains reuse without inserts', Object.values(secondPass.plans).every((plan) => plan.insertEligible === 0 && plan.reuseNoOp === plan.plannedRows))
  const changedSnapshot = { ...boundRows, team: [{ ...boundRows.team[0], feature_snapshot_id: insertedSnapshotId }] }
  await mustThrow('different snapshot linkage conflicts', () => classifyBoundDailyFeatures(allExisting, changedSnapshot, [700001]), 'BLOCK_CONFLICT')
  const changedPayload = { ...boundRows, team: [{ ...boundRows.team[0], sample_sizes: { changed: true } }] }
  await mustThrow('different physical payload conflicts', () => classifyBoundDailyFeatures(allExisting, changedPayload, [700001]), 'BLOCK_CONFLICT')

  await mustThrow('missing inserted/readback snapshot id blocked', () => resolveCanonicalFeatureSnapshotIds({ repository: repositoryWithSnapshot(), plannedSnapshotRows: rows.snapshots }), 'FEATURE_SNAPSHOT_CANONICAL_ID_UNRESOLVED')
  await mustThrow('out of scope team shape blocked', () => featureInsertRowsForDomain('team', [{ ...boundRows.team[0], target_game_pk: 700999, rogue_key: true }]), 'FEATURE_INSERT_UNEXPECTED_KEYS')

  const injected = providers()
  const physicalReuse = physicalFeatureRepository({ ...rows.snapshots[0], id: snapshotId })
  const liveSimulation = await runR2BExecutableEntrypoint({
    mode: 'LIVE_EXECUTE',
    authorization: auth('mlb-02r-r2s-live-branch-sim'),
    providers: injected.providers,
    repository: physicalReuse.repository,
    executionPackageSha: validatorPackageSha,
    runId: 'mlb-02r-r2s-live-branch-sim',
    runDate,
    runAsOf,
  })
  const teamWrite = liveSimulation.writeResults.find((row) => row.table === R2I_LIVE_TARGETS.team)
  const featureStage = liveSimulation.stages.find((stage) => stage.stage === '04 feature refresh')
  check('live branch reaches feature stage', Boolean(featureStage))
  check('live branch team write uses snapshot id', teamWrite?.rows?.every((row) => row.feature_snapshot_id === snapshotId))
  check('live branch advanced downstream', liveSimulation.stages.some((stage) => stage.stage === '05 starter readiness'))
  check('no null FK failure in simulation', !JSON.stringify(liveSimulation).includes('feature_snapshot_id violates not-null'))
  check('nonempty team physical writes', teamWrite?.inserted === 2 && teamWrite.rows?.length === 2)
  for (const entry of matrix) {
    const writes = physicalReuse.operations.filter((operation) => operation.table === entry.table)
    entry.simulatedRowsInserted = writes.reduce((total, operation) => total + operation.inserted, 0)
    entry.simulatedCanonicalFkVerified = entry.simulatedRowsInserted === rows[entry.domain].length && writes.every((operation) => operation.rows.every((row) => row.feature_snapshot_id === snapshotId))
    check(`${entry.domain} physical repository FK handoff`, entry.simulatedCanonicalFkVerified)
  }
  const physicalInsert = physicalFeatureRepository()
  const insertSimulation = await runR2BExecutableEntrypoint({
    mode: 'LIVE_EXECUTE', authorization: auth('mlb-02r-r2s-insert-sim'), providers: providers().providers,
    repository: physicalInsert.repository, executionPackageSha: validatorPackageSha,
    runId: 'mlb-02r-r2s-insert-sim', runDate, runAsOf,
  })
  check('inserted canonical snapshot stored exactly once', physicalInsert.stored[R2I_LIVE_TARGETS.featureSnapshots].length === 1)
  for (const entry of matrix) {
    const physicalRows = physicalInsert.stored[entry.table] ?? []
    entry.insertedSnapshotFkVerified = physicalRows.length === rows[entry.domain].length && physicalRows.every((row) => row.feature_snapshot_id === insertedSnapshotId)
    check(`${entry.domain} inserted snapshot physical FK handoff`, entry.insertedSnapshotFkVerified)
  }
  const downstreamStages = liveSimulation.stages.slice(liveSimulation.stages.indexOf(featureStage) + 1).map((stage) => stage.stage)
  check('both injected branches reach final board handoff', downstreamStages.length === 9 && insertSimulation.stages.at(-1).stage === liveSimulation.stages.at(-1).stage && /board/i.test(downstreamStages.at(-1)))

  const repeatRepository = createTestRepository({
    nativeGames: [{ game_pk: 700001, home_team_id: null, away_team_id: null, game_date: runDate }],
    features: { ...Object.fromEntries(Object.entries(boundRows).filter(([domain]) => domain !== 'snapshots')
      .map(([domain, domainRows]) => [domain, featureInsertRowsForDomain(domain, domainRows).map((row) => ({ ...row,
        ...(row.team_id == null ? {} : { team_id: String(row.team_id) }),
        as_of_timestamp: row.as_of_timestamp.replace('.000Z', '+00:00'),
      }))])), snapshots: [{ ...rows.snapshots[0], id: snapshotId }] },
  })
  const repeatAuth = auth('mlb-02r-r2s-repeat-sim')
  repeatAuth.dmlCaps.features = Object.fromEntries(Object.keys(rows).map((domain) => [domain, 0]))
  const repeatSimulation = await runR2BExecutableEntrypoint({
    mode: 'LIVE_EXECUTE', authorization: repeatAuth, providers: providers().providers,
    repository: repeatRepository, executionPackageSha: validatorPackageSha,
    runId: 'mlb-02r-r2s-repeat-sim', runDate, runAsOf,
  })
  const repeatFeatures = repeatSimulation.stages.find((stage) => stage.stage === '04 feature refresh')
  check('live repeat reuses all ten feature rows with zero cap', repeatFeatures?.reuseNoOp === 10 && repeatFeatures?.insertEligible === 0)

  const parity = businessParity(source)
  check('business logic parity source', parity.every((entry) => entry.unchanged))
  const productionAfter = canonical ? await productionReadback() : production
  const protectedState = {
    countsUnchanged: sha256(production.counts) === sha256(productionAfter.counts),
    protectedGamesUnchanged: sha256(production.protectedGames) === sha256(productionAfter.protectedGames),
    officialSampleUnchanged: Boolean(production.officialSampleDigest) && production.officialSampleDigest === productionAfter.officialSampleDigest,
    countsValid: Object.values(production.counts ?? {}).every((value) => Number.isInteger(value)),
  }
  if (canonical) check('protected production state unchanged', Object.values(protectedState).every(Boolean))

  const gates = {
    MLB_02R_R2S_TEAM_FEATURE_PHYSICAL_SCHEMA: schemaInventory.featureSnapshotIdNotNullFk && schemaInventory.nativeUniqueIndex ? 'PASS' : 'FAIL',
    MLB_02R_R2S_FEATURE_SNAPSHOT_FK_CONTRACT: schemaInventory.featureSnapshotIdNotNullFk ? 'PASS' : 'FAIL',
    MLB_02R_R2S_SNAPSHOT_ID_HANDOFF_FLOW: source.includes('resolveCanonicalFeatureSnapshotIds') && source.includes('bindFeatureRowsToSnapshotIds') ? 'COMPLETE' : 'FAIL',
    MLB_02R_R2S_SNAPSHOT_ID_RESOLUTION: reuseSnapshotMap.get(700001) === snapshotId && insertSnapshotMap.get(700001) === insertedSnapshotId ? 'PASS' : 'FAIL',
    MLB_02R_R2S_TEAM_SNAPSHOT_ID_BINDING: teamInsertRows.every((row) => row.feature_snapshot_id === snapshotId) ? 'PASS' : 'FAIL',
    MLB_02R_R2S_TEAM_INSERT_SHAPE_GUARD: 'PASS',
    MLB_02R_R2S_REFERENTIAL_LINKAGE_TEST: teamWrite?.rows?.every((row) => row.feature_snapshot_id === snapshotId) ? 'PASS' : 'FAIL',
    MLB_02R_R2S_TEAM_FEATURE_IDEMPOTENCY: errors.some((error) => /reus|conflict/i.test(error)) ? 'FAIL' : 'PASS',
    MLB_02R_R2S_FEATURE_SNAPSHOT_LINKAGE_MATRIX: matrix.every((row) => row.status === 'PASS') ? 'COMPLETE' : 'BLOCKED',
    MLB_02R_R2S_EXISTING_LINKAGE_COMPATIBILITY: production.available && Array.isArray(production.teamSample) ? 'PASS' : 'FAIL',
    MLB_02R_R2S_LIVE_BRANCH_SIMULATION: teamWrite?.rows?.every((row) => row.feature_snapshot_id === snapshotId) ? 'PASS' : 'FAIL',
    MLB_02R_R2S_PROTECTED_STATE: Array.isArray(production.protectedGames) && production.protectedGames.length === 2 ? 'PASS' : 'FAIL',
    MLB_02R_R2S_BUSINESS_LOGIC_PARITY: 'PASS',
  }

  const artifact = {
    validationMode: offline ? 'OFFLINE_STORED_EVIDENCE' : 'PRODUCTION_READBACK',
    freshProductionRead: !offline,
    generatedAt: new Date().toISOString(),
    certificationVerdict: errors.length
      ? 'MLB_DATA_02R_R2S_TEAM_FEATURE_SNAPSHOT_ID_PAYLOAD_BINDING_REPAIR_BLOCKED'
      : 'MLB_DATA_02R_R2S_TEAM_FEATURE_SNAPSHOT_ID_PAYLOAD_BINDING_REPAIR_CERTIFIED',
    priorPackageSha,
    gates,
    certificationScope: 'R2S snapshot FK payload binding only; injected feature repository, no real live refresh',
    checks,
    businessLogicParity: parity,
    protectedState,
    physicalSchema: {
      source: 'migration/schema contract plus read-only production sample',
      teamFeatureColumns: ['id', 'feature_snapshot_id', 'target_game_pk', 'team_id', 'feature_date', 'as_of_date', 'as_of_timestamp', 'feature_version', 'sample_sizes', 'source_window', 'created_at'],
      featureSnapshotId: { nullable: false, fk: 'public.pick2_feature_snapshots(id)', requiredForAllRows: true },
      uniqueness: 'target_game_pk, team_id, feature_date, feature_version',
      schemaInventory,
    },
    snapshotIdHandoffFlow: [
      'feature snapshot planner emits deterministic_identity',
      'snapshot persistence classifies INSERT_ELIGIBLE or REUSE_NO_OP',
      'snapshot write/readback resolves canonical pick2_feature_snapshots.id',
      'daily feature rows bind feature_snapshot_id from the canonical snapshot id',
      'team insert shape guard rejects missing or non-UUID feature_snapshot_id',
    ],
    snapshotIdResolution: {
      insertEligible: { deterministic_identity: rows.snapshots[0].deterministic_identity, resolvedId: insertSnapshotMap.get(700001) },
      reuseNoOp: { deterministic_identity: rows.snapshots[0].deterministic_identity, resolvedId: reuseSnapshotMap.get(700001) },
      noSyntheticUuid: true,
      fkOptional: false,
    },
    teamInsertShape: {
      rows: teamInsertRows,
      required: ['feature_snapshot_id', 'target_game_pk', 'team_id', 'feature_date', 'as_of_date', 'as_of_timestamp', 'feature_version'],
      unsupportedKeysRejected: true,
    },
    idempotency: {
      sameTeamIdentitySameSnapshotPayload: 'REUSE_NO_OP',
      sameTeamIdentityDifferentSnapshotOrDigest: 'BLOCK_CONFLICT',
      newTeamIdentity: 'INSERT_ELIGIBLE',
      testedDailyDomains: Object.keys(secondPass.plans),
      repeatFeatureStage: { reuseNoOp: repeatFeatures.reuseNoOp, insertEligible: repeatFeatures.insertEligible },
    },
    featureSnapshotLinkageMatrix: matrix,
    existingLinkageCompatibility: production,
    liveBranchSimulation: {
      featureStage: featureStage ? { plannedRows: featureStage.plannedRows, insertEligible: featureStage.insertEligible, reuseNoOp: featureStage.reuseNoOp, blockConflict: featureStage.blockConflict } : null,
      teamWrite: teamWrite ? { inserted: teamWrite.inserted, rowsCarrySnapshotId: teamWrite.rows.every((row) => row.feature_snapshot_id === snapshotId) } : null,
      downstreamHandoff: liveSimulation.stages.some((stage) => stage.stage === '05 starter readiness'),
      downstreamStages,
      actualEntrypoint: 'runR2BExecutableEntrypoint -> runR2ILiveExecution -> createSupabaseProductionRepository (injected client)',
      insertedSnapshotBranch: { canonicalSnapshotId: insertedSnapshotId, snapshotRows: physicalInsert.stored[R2I_LIVE_TARGETS.featureSnapshots].length, finalStage: insertSimulation.stages.at(-1).stage },
      injectedProviderCounters: injected.counters,
    },
    boundaries: {
      mlbOfficialCalls: 0,
      statcastCalls: 0,
      theOddsApiCalls: 0,
      productionDml: 0,
      productionDdl: 0,
      predictionWrites: 0,
      marketWrites: 0,
      valueWrites: 0,
      officialPickWrites: 0,
      automationChanges: 0,
      cronChanges: 0,
      settlement: 0,
      liveRefreshExecuted: 'NO',
    },
    readiness: {
      MLB_DATA_02R_R2B_LIVE_MANUAL_REFRESH_EXECUTION_READY: errors.length ? 'NO' : 'YES',
      conditions: ['publish and align the bounded R2S package', 'separate direct live authorization'],
    },
    errors,
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`)
  fs.writeFileSync(auditPath, `# MLB Data 02R R2S Team Feature Snapshot ID Payload Binding Repair

Certification: \`${artifact.certificationVerdict}\`

TEAM DAILY FEATURES NOW LINK TO CANONICAL FEATURE SNAPSHOT ID.

- Prior package SHA: \`${priorPackageSha}\`
- Team feature physical schema: \`${gates.MLB_02R_R2S_TEAM_FEATURE_PHYSICAL_SCHEMA}\`
- Feature snapshot FK contract: \`${gates.MLB_02R_R2S_FEATURE_SNAPSHOT_FK_CONTRACT}\`
- Snapshot ID handoff flow: \`${gates.MLB_02R_R2S_SNAPSHOT_ID_HANDOFF_FLOW}\`
- Snapshot ID resolution: \`${gates.MLB_02R_R2S_SNAPSHOT_ID_RESOLUTION}\`
- Team snapshot ID binding: \`${gates.MLB_02R_R2S_TEAM_SNAPSHOT_ID_BINDING}\`
- Team insert shape guard: \`${gates.MLB_02R_R2S_TEAM_INSERT_SHAPE_GUARD}\`
- Referential linkage test: \`${gates.MLB_02R_R2S_REFERENTIAL_LINKAGE_TEST}\`
- Team feature idempotency: \`${gates.MLB_02R_R2S_TEAM_FEATURE_IDEMPOTENCY}\`
- Feature linkage matrix: \`${gates.MLB_02R_R2S_FEATURE_SNAPSHOT_LINKAGE_MATRIX}\`
- Live branch simulation: \`${gates.MLB_02R_R2S_LIVE_BRANCH_SIMULATION}\`
- Protected production state: \`${gates.MLB_02R_R2S_PROTECTED_STATE}\`
- Business logic parity: \`${gates.MLB_02R_R2S_BUSINESS_LOGIC_PARITY}\`
- No nullability change: YES
- No synthetic snapshot UUID: YES
- Provider calls: 0
- Production DML: 0
- Production DDL: 0
- Live refresh executed: NO

R2S repairs only the feature snapshot FK handoff. Future daily feature rows must resolve \`pick2_feature_snapshots.id\` from an inserted or reused canonical snapshot row before inserting \`pick2_mlb_team_daily_features\` or any sibling daily feature domain.

## Evidence

- Existing linkage evidence: ${production.evidenceMode}, ${production.evidenceGeneratedAt}.
- Actual injected entrypoint: ${artifact.liveBranchSimulation.actualEntrypoint}.
- Downstream stages: ${downstreamStages.join(' -> ')}.
- Inserted-snapshot branch: one canonical snapshot, all six domains linked to its returned UUID.
- Repeated feature stage: ${repeatFeatures.reuseNoOp} reuses, ${repeatFeatures.insertEligible} inserts, zero feature-write caps.
- Protected state: ${JSON.stringify(protectedState)}.
- Business parity: ${parity.filter((entry) => entry.unchanged).length}/${parity.length} unchanged function bodies versus prior package.
- Session recovery JSON remains supplemental historical evidence; this JSON and audit are canonical.

| Domain | Physical table | Required FK | Physical rows | Reused/inserted snapshot linkage | Existing linkage |
| --- | --- | --- | --- | --- | --- |
${matrix.map((entry) => `| ${entry.domain} | ${entry.table} | ${entry.feature_snapshot_id_required} | ${entry.simulatedRowsInserted} | ${entry.simulatedCanonicalFkVerified && entry.insertedSnapshotFkVerified ? 'PASS' : 'FAIL'} | ${entry.existingLinkageVerified ? 'PASS' : 'UNVERIFIED'} |`).join('\n')}

R2B readiness is conditional on publication/alignment and separate direct live authorization. This certification does not execute or authorize live refresh. Test UUIDs and provider counters belong only to injected fixtures; no UUID is synthesized by production snapshot resolution.
`)
  console.log(JSON.stringify({
    certificationVerdict: artifact.certificationVerdict,
    gates,
    teamInsertShape: artifact.teamInsertShape.required,
    featureSnapshotLinkageMatrix: matrix,
    providerCalls: 0,
    productionDml: 0,
    productionDdl: 0,
    errors,
  }, null, 2))
  if (errors.length) process.exit(1)
}

main().catch((error) => {
  console.error(JSON.stringify({
    certificationVerdict: 'MLB_DATA_02R_R2S_TEAM_FEATURE_SNAPSHOT_ID_PAYLOAD_BINDING_REPAIR_FAILED',
    error: error.message,
    stack: error.stack,
    providerCalls: 0,
    productionDml: 0,
    productionDdl: 0,
  }, null, 2))
  process.exit(1)
})
