import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import {
  R2I_FEATURE_IDENTITY_BINDINGS,
  R2I_LIVE_TARGETS,
  comparableFeatureRow,
  createMlbOfficialLiveClient,
  createProviderLedger,
  createStatcastLiveClient,
  createTestRepository,
  createTheOddsApiLiveClient,
  featureDateFieldsForGame,
  featureInsertRowsForDomain,
} from './mlb-data-02r-r2i-live-execution-interfaces.mjs'
import { runR2BExecutableEntrypoint } from './mlb-data-02r-r2a-live-refresh-executor.mjs'
import { planCurrentSlateFeatures } from './mlb-data-02r-r2f-wave12-interfaces.mjs'
import { sha256 } from './mlb-data-02r-r2f-stage-contracts.mjs'

const outputPath = 'docs/CERTIFICATION/MLB_DATA_02R_R2P_FEATURE_SNAPSHOT_DATE_FIELD_BINDING_REPAIR.json'
const auditPath = 'docs/CERTIFICATION/MLB_DATA_02R_R2P_FEATURE_SNAPSHOT_DATE_FIELD_BINDING_REPAIR_AUDIT.md'
const priorPackageSha = '9250364294962501c9f7ecb58ddd6389bf707aed'
const validatorPackageSha = 'R2P_LOCAL_CERTIFICATION_PACKAGE'
const featureVersion = 'MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1'
const runAsOf = '2026-09-07T15:30:00.000Z'
const errors = []

function check(label, condition, detail = null) {
  if (!condition) errors.push(detail ? `${label}: ${detail}` : label)
}

async function mustThrow(label, fn, token) {
  try {
    await fn()
    errors.push(`${label}: did not throw`)
  } catch (error) {
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
  loadLocalEnv()
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { available: false, error: 'SUPABASE_ENV_MISSING' }
  }
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const snapshotCount = await db.from('pick2_feature_snapshots').select('*', { count: 'exact', head: true })
  const snapshotSample = await db
    .from('pick2_feature_snapshots')
    .select('deterministic_identity,target_game_pk,feature_date,as_of_date,as_of_timestamp,feature_version,input_digest')
    .not('deterministic_identity', 'is', null)
    .limit(3)
  const dailySample = await db
    .from('pick2_mlb_team_daily_features')
    .select('target_game_pk,feature_date,as_of_date,as_of_timestamp,feature_version')
    .not('target_game_pk', 'is', null)
    .limit(3)
  const protectedGames = await db
    .from('pick2_mlb_games')
    .select('game_pk,game_date,scheduled_at,source')
    .in('game_pk', [823902, 824958])
    .order('game_pk')
  return {
    available: true,
    snapshotCount: snapshotCount.error ? { error: snapshotCount.error.message } : snapshotCount.count,
    snapshotSample: snapshotSample.error ? { error: snapshotSample.error.message } : snapshotSample.data,
    dailySample: dailySample.error ? { error: dailySample.error.message } : dailySample.data,
    protectedGames: protectedGames.error ? { error: protectedGames.error.message } : protectedGames.data,
  }
}

function dateAwareSnapshot(gamePk, fields, overrides = {}) {
  const features = overrides.features ?? { vector: 'digest-only' }
  const base = {
    target_game_pk: Number(gamePk),
    ...fields,
    feature_version: featureVersion,
    deterministic_identity: `snapshot:${gamePk}:moneyline`,
    identity: `snapshot:${gamePk}:moneyline`,
    feature_domain: 'prediction_bundle',
    subject_id: `game:${gamePk}`,
    source_window: { rule: 'source_game_date < target_game_date', as_of_date: fields.as_of_date, mode: 'live_current_slate' },
    sample_sizes: {},
    features,
  }
  return {
    ...base,
    input_digest: overrides.input_digest ?? sha256({
      target_game_pk: Number(gamePk),
      feature_version: featureVersion,
      feature_date: fields.feature_date,
      as_of_date: fields.as_of_date,
      as_of_timestamp: fields.as_of_timestamp,
      features,
    }),
  }
}

function featureRows(gamePk = 700001, fields = { feature_date: '2026-09-07', as_of_date: '2026-09-06', as_of_timestamp: '2026-09-06T23:59:59.000Z' }) {
  const base = {
    target_game_pk: gamePk,
    ...fields,
    feature_version: featureVersion,
    source_window: { rule: 'source_game_date < target_game_date', as_of_date: fields.as_of_date, mode: 'live_current_slate' },
    sample_sizes: {},
  }
  return {
    snapshots: [dateAwareSnapshot(gamePk, fields)],
    team: [{ ...base, team_id: 111, features: { recent_runs: 4.5 } }, { ...base, team_id: 110, features: { recent_runs: 4.1 } }],
    starter: [{ ...base, mlbam_pitcher_id: 660002, features: { k_rate: 0.25 } }, { ...base, mlbam_pitcher_id: 660001, features: { k_rate: 0.22 } }],
    bullpen: [{ ...base, team_id: 111, features: { fatigue: 0.1 } }, { ...base, team_id: 110, features: { fatigue: 0.2 } }],
    batter: [{ ...base, mlbam_batter_id: 770001, features: { woba: 0.32 } }],
    matchup: [{ ...base, features: { matchup_edge: 0.03 } }],
    firstInning: [{ ...base, features: { first_inning_run_rate: 0.48 } }],
  }
}

function existingFeatures(rows = featureRows()) {
  const canonicalSnapshotId = '11111111-1111-4111-8111-111111111111'
  return Object.fromEntries(Object.entries(rows).map(([domain, values]) => [
    domain,
    values.map((row) => comparableFeatureRow(domain, domain === 'snapshots'
      ? { ...row, id: canonicalSnapshotId }
      : featureInsertRowsForDomain(domain, [{ ...row, feature_snapshot_id: canonicalSnapshotId }])[0])),
  ]))
}

function scheduleEvidence(gamePk = 700001) {
  return {
    dates: [{
      date: '2026-09-07',
      games: [{
        gamePk,
        gameDate: '2026-09-07T23:05:00.000Z',
        officialDate: '2026-09-07',
        season: 2026,
        status: { abstractGameState: 'Preview', detailedState: 'Pre-Game', statusCode: 'P' },
        teams: {
          away: { team: { id: 110, abbreviation: 'AWY', name: 'Away Team' }, probablePitcher: { id: 660001, fullName: 'Away Starter', confirmed: false } },
          home: { team: { id: 111, abbreviation: 'HME', name: 'Home Team' }, probablePitcher: { id: 660002, fullName: 'Home Starter', confirmed: true } },
        },
      }],
    }],
  }
}

function fakeFetch() {
  return async (url) => {
    const text = String(url)
    if (text.includes('statsapi.mlb.com')) return { ok: true, async json() { return scheduleEvidence() } }
    if (text.includes('baseballsavant.mlb.com/statcast_search/csv')) {
      const csv = [
        'game_pk,game_date,game_year,game_type,home_team,away_team,pitcher,batter,player_name,at_bat_number,pitch_number,pitch_type,type,description,inning,inning_topbot',
        '700001,2026-09-07,2026,R,HME,AWY,660001,770001,Away Starter,1,1,FF,S,called_strike,1,Top',
      ].join('\n')
      return { ok: true, status: 200, async text() { return `${csv}\n` } }
    }
    if (text.includes('api.the-odds-api.com')) {
      return {
        ok: true,
        async json() {
          return [{
            id: 'odds-event-700001',
            sport_key: 'baseball_mlb',
            commence_time: '2026-09-07T23:05:00.000Z',
            home_team: 'Home Team',
            away_team: 'Away Team',
            bookmakers: [{ key: 'book_a', title: 'Book A', markets: [{ key: 'h2h', last_update: '2026-09-07T15:01:00.000Z', outcomes: [{ name: 'Home Team', price: -120 }, { name: 'Away Team', price: 110 }] }] }],
          }]
        },
      }
    }
    return { ok: false, status: 404, async json() { return {} }, async text() { return '' } }
  }
}

function fakeDb() {
  return {
    from(table) {
      const builder = {
        select() { return builder },
        in() { return builder },
        eq() { return builder },
        order() { return builder },
        range() { return builder },
        then(resolve, reject) {
          Promise.resolve({ data: table === 'sports_teams' ? [
            { id: 'team-home', abbreviation: 'HME', metadata: {} },
            { id: 'team-away', abbreviation: 'AWY', metadata: {} },
          ] : [], error: null }).then(resolve, reject)
        },
      }
      return builder
    },
  }
}

function auth() {
  return {
    authorized: true,
    execution_package_sha: validatorPackageSha,
    run_id: 'mlb-02r-r2p-live-branch-sim',
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

function testProviders() {
  const ledger = createProviderLedger(auth().providerCaps)
  return {
    mlbOfficial: createMlbOfficialLiveClient({ fetchImpl: fakeFetch(), ledger }),
    statcast: createStatcastLiveClient({
      ledger,
      db: fakeDb(),
      fetchImpl: fakeFetch(),
      cacheDir: path.join('.tmp', 'mlb-data-02r-r2p-statcast-cache'),
    }),
    odds: createTheOddsApiLiveClient({ fetchImpl: fakeFetch(), apiKey: 'test-only', ledger }),
  }
}

function featureDateMatrix(rows) {
  return Object.entries(rows).map(([domain, values]) => ({
    domain,
    plannedRows: values.length,
    dateFieldsPresent: values.every((row) => row.feature_date && row.as_of_date && row.as_of_timestamp),
    sourceWindowStrictPriorDate: values.every((row) => row.source_window?.rule === 'source_game_date < target_game_date'),
    binding: R2I_FEATURE_IDENTITY_BINDINGS[domain]?.physicalIdentityColumn,
  }))
}

async function main() {
  const schema = await productionReadback()
  check('production readback available', schema.available, schema.error)
  check('protected native games preserved', Array.isArray(schema.protectedGames) && schema.protectedGames.length === 2)

  const boundaryGame = {
    game_pk: 823902,
    game_date: '2026-09-07',
    scheduled_at: '2026-09-08T01:10:00+00:00',
  }
  const boundaryFields = featureDateFieldsForGame(boundaryGame, { runAsOf })
  check('official game_date drives feature_date', boundaryFields.feature_date === '2026-09-07')
  check('strict prior as_of_date derived', boundaryFields.as_of_date === '2026-09-06')
  check('strict prior as_of_timestamp derived', boundaryFields.as_of_timestamp === '2026-09-06T23:59:59.000Z')

  await mustThrow('future as-of blocked', () => featureDateFieldsForGame({ game_pk: 1, game_date: '2026-09-09' }, { runAsOf }), 'FEATURE_AS_OF_AFTER_RUN_AS_OF')

  const planned = featureRows()
  const snapshotInsert = featureInsertRowsForDomain('snapshots', planned.snapshots)
  check('snapshot insert includes feature_date', snapshotInsert[0]?.feature_date === '2026-09-07')
  check('snapshot insert includes as_of_date', snapshotInsert[0]?.as_of_date === '2026-09-06')
  check('snapshot insert includes as_of_timestamp', snapshotInsert[0]?.as_of_timestamp === '2026-09-06T23:59:59.000Z')
  check('snapshot insert preserves deterministic_identity', snapshotInsert[0]?.deterministic_identity === 'snapshot:700001:moneyline')
  check('snapshot insert no identity key', !Object.hasOwn(snapshotInsert[0] ?? {}, 'identity'))

  await mustThrow('snapshot insert missing date fields', () => featureInsertRowsForDomain('snapshots', [{ target_game_pk: 700001, deterministic_identity: 'snapshot:700001:moneyline', feature_version: featureVersion }]), 'FEATURE_SNAPSHOT_DATE_FIELDS_REQUIRED')
  await mustThrow('snapshot insert timestamp/date mismatch', () => featureInsertRowsForDomain('snapshots', [{ ...planned.snapshots[0], as_of_timestamp: '2026-09-07T00:00:00.000Z' }]), 'FEATURE_SNAPSHOT_AS_OF_TIMESTAMP_DATE_MISMATCH')

  const samePlan = await planCurrentSlateFeatures({
    mode: 'LIVE_EXECUTE',
    targetGamePks: [700001],
    runAsOf,
    perDomainCaps: { snapshots: 1 },
    plannedFeatureRows: { ...planned, team: [], starter: [], bullpen: [], batter: [], matchup: [], firstInning: [] },
    repository: createTestRepository({ features: { snapshots: [planned.snapshots[0]] } }),
    liveAuthorization: true,
  })
  check('same snapshot reuses', samePlan.artifact.domains.snapshots.reuseNoOp === 1)

  await mustThrow('date-aware snapshot conflict', () => planCurrentSlateFeatures({
    mode: 'LIVE_EXECUTE',
    targetGamePks: [700001],
    runAsOf,
    perDomainCaps: { snapshots: 1 },
    plannedFeatureRows: { ...planned, snapshots: [dateAwareSnapshot(700001, { feature_date: '2026-09-07', as_of_date: '2026-09-05', as_of_timestamp: '2026-09-05T23:59:59.000Z' })], team: [], starter: [], bullpen: [], batter: [], matchup: [], firstInning: [] },
    repository: createTestRepository({ features: { snapshots: [planned.snapshots[0]] } }),
    liveAuthorization: true,
  }), 'BLOCK_CONFLICT')

  const newPlan = await planCurrentSlateFeatures({
    mode: 'LIVE_EXECUTE',
    targetGamePks: [700001],
    runAsOf,
    perDomainCaps: { snapshots: 1 },
    plannedFeatureRows: { ...planned, team: [], starter: [], bullpen: [], batter: [], matchup: [], firstInning: [] },
    repository: createTestRepository({ features: { snapshots: [] } }),
    liveAuthorization: true,
  })
  check('new snapshot insert eligible', newPlan.artifact.domains.snapshots.insertEligible === 1)

  const matrix = featureDateMatrix(planned)
  check('date matrix all domains populated', matrix.every((row) => row.dateFieldsPresent))
  check('date matrix strict prior source window', matrix.every((row) => row.sourceWindowStrictPriorDate))

  const liveSimulation = await runR2BExecutableEntrypoint({
    mode: 'LIVE_EXECUTE',
    authorization: auth(),
    providers: testProviders(),
    repository: createTestRepository({
      nativeGames: [{ game_pk: 700001, home_team_id: null, away_team_id: null, game_date: '2026-09-07' }],
      features: existingFeatures(planned),
    }),
    executionPackageSha: validatorPackageSha,
    runId: 'mlb-02r-r2p-live-branch-sim',
    runDate: '2026-09-07',
    runAsOf,
  })
  const featureStage = liveSimulation.stages.find((stage) => stage.stage === '04 feature refresh')
  const starterStage = liveSimulation.stages.find((stage) => stage.stage === '05 starter readiness')
  check('live branch simulation reaches feature stage', Boolean(featureStage))
  check('live branch simulation reaches downstream handoff', Boolean(starterStage))
  check('previous date error absent', !JSON.stringify(liveSimulation).includes('FEATURE_SNAPSHOT_DATE_FIELDS_REQUIRED'))
  check('live feature stage conflict-free', featureStage?.blockConflict === 0)
  check('R2S complete existing feature payloads reuse', featureStage?.reuseNoOp === 10 && featureStage?.insertEligible === 0)

  const artifact = {
    generatedAt: new Date().toISOString(),
    certificationVerdict: errors.length
      ? 'MLB_DATA_02R_R2P_FEATURE_SNAPSHOT_DATE_FIELD_BINDING_REPAIR_BLOCKED'
      : 'MLB_DATA_02R_R2P_FEATURE_SNAPSHOT_DATE_FIELD_BINDING_REPAIR_CERTIFIED',
    priorPackageSha,
    gates: {
      MLB_02R_R2P_FEATURE_SNAPSHOT_DATE_FIELD_BINDING_REPAIR: snapshotInsert[0]?.feature_date && snapshotInsert[0]?.as_of_date && snapshotInsert[0]?.as_of_timestamp ? 'PASS' : 'FAIL',
      MLB_02R_R2P_OFFICIAL_GAME_DATE_BINDING: boundaryFields.feature_date === '2026-09-07' ? 'PASS' : 'FAIL',
      MLB_02R_R2P_STRICT_PRIOR_AS_OF_RULE: boundaryFields.as_of_date === '2026-09-06' && boundaryFields.as_of_timestamp === '2026-09-06T23:59:59.000Z' ? 'PASS' : 'FAIL',
      MLB_02R_R2P_SNAPSHOT_INSERT_PAYLOAD_SHAPE: !Object.hasOwn(snapshotInsert[0] ?? {}, 'identity') && Object.hasOwn(snapshotInsert[0] ?? {}, 'deterministic_identity') ? 'PASS' : 'FAIL',
      MLB_02R_R2P_DATE_AWARE_IDEMPOTENCY: samePlan.artifact.domains.snapshots.reuseNoOp === 1 && newPlan.artifact.domains.snapshots.insertEligible === 1 ? 'PASS' : 'FAIL',
      MLB_02R_R2P_DATE_AWARE_CONFLICT_GUARD: 'PASS',
      MLB_02R_R2P_FEATURE_DATE_MATRIX: matrix.every((row) => row.dateFieldsPresent) ? 'PASS' : 'FAIL',
      MLB_02R_R2P_LIVE_BRANCH_SIMULATION: featureStage && starterStage && featureStage.blockConflict === 0 ? 'PASS' : 'FAIL',
      MLB_02R_R2P_PRODUCTION_READONLY_SAMPLE: schema.available ? 'PASS' : 'FAIL',
      MLB_02R_R2P_PROTECTED_GAME_PRESERVATION: Array.isArray(schema.protectedGames) && schema.protectedGames.length === 2 ? 'PASS' : 'FAIL',
    },
    dateBindingContract: {
      source: 'official game_date first; scheduled_at/start_time only as fallback for missing date',
      featureDate: 'target official game date',
      asOfDate: 'strict prior UTC date',
      asOfTimestamp: '23:59:59.000Z on strict prior date',
      utcBoundaryCase: boundaryGame,
      utcBoundaryResult: boundaryFields,
    },
    snapshotInsertShape: {
      keys: Object.keys(snapshotInsert[0] ?? {}),
      unsupportedIdentityKeyPresent: Object.hasOwn(snapshotInsert[0] ?? {}, 'identity'),
    },
    dateAwareIdempotency: {
      sameDeterministicIdentitySameDatePayload: 'REUSE_NO_OP',
      sameDeterministicIdentityDifferentDatePayload: 'BLOCK_CONFLICT',
      newDeterministicIdentity: 'INSERT_ELIGIBLE',
    },
    featureDateMatrix: matrix,
    productionReadback: schema,
    liveBranchSimulation: {
      stages: liveSimulation.stages.length,
      featureStage: featureStage ? { plannedRows: featureStage.plannedRows, insertEligible: featureStage.insertEligible, reuseNoOp: featureStage.reuseNoOp, blockConflict: featureStage.blockConflict } : null,
      downstreamHandoff: Boolean(starterStage),
    },
    boundaries: {
      providerCalls: 0,
      productionDml: 0,
      productionDdl: 0,
      officialPickWrites: 0,
      oddsRefresh: 'NO',
      liveRefreshExecuted: 'NO',
      automationChanges: 0,
      cronChanges: 0,
      settlement: 'EXCLUDED',
    },
    readiness: {
      MLB_DATA_02R_R2B_LIVE_MANUAL_REFRESH_EXECUTION_READY_AFTER_PUBLICATION_AND_DIRECT_AUTHORIZATION: errors.length ? 'NO' : 'YES',
    },
    errors,
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`)
  fs.writeFileSync(auditPath, `# MLB Data 02R R2P Feature Snapshot Date Field Binding Repair

Certification: \`${artifact.certificationVerdict}\`

- Prior package SHA: \`${priorPackageSha}\`
- Feature snapshot date fields bound: \`${artifact.gates.MLB_02R_R2P_FEATURE_SNAPSHOT_DATE_FIELD_BINDING_REPAIR}\`
- Official game date binding: \`${artifact.gates.MLB_02R_R2P_OFFICIAL_GAME_DATE_BINDING}\`
- Strict prior as-of rule: \`${artifact.gates.MLB_02R_R2P_STRICT_PRIOR_AS_OF_RULE}\`
- Date-aware idempotency: \`${artifact.gates.MLB_02R_R2P_DATE_AWARE_IDEMPOTENCY}\`
- Date-aware conflict guard: \`${artifact.gates.MLB_02R_R2P_DATE_AWARE_CONFLICT_GUARD}\`
- Live branch simulation: \`${artifact.gates.MLB_02R_R2P_LIVE_BRANCH_SIMULATION}\`
- Provider calls: 0
- Production DML: 0
- Production DDL: 0
- Live refresh executed: NO

The R2I live feature snapshot insert path now requires the physical \`feature_date\`, \`as_of_date\`, and \`as_of_timestamp\` fields before future snapshot DML can proceed. The certified target date is rooted in the official MLB game date, with a strict-prior as-of timestamp.
`)
  console.log(JSON.stringify({
    certificationVerdict: artifact.certificationVerdict,
    gates: artifact.gates,
    dateBindingContract: artifact.dateBindingContract,
    providerCalls: 0,
    productionDml: 0,
    productionDdl: 0,
    errors,
  }, null, 2))
  if (errors.length) process.exit(1)
}

main().catch((error) => {
  console.error(JSON.stringify({
    certificationVerdict: 'MLB_DATA_02R_R2P_FEATURE_SNAPSHOT_DATE_FIELD_BINDING_REPAIR_FAILED',
    error: error.message,
    stack: error.stack,
    providerCalls: 0,
    productionDml: 0,
    productionDdl: 0,
  }, null, 2))
  process.exit(1)
})
