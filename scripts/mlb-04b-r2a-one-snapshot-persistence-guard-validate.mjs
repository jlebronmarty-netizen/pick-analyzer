import fs from 'node:fs'
import {
  buildMlb04bDeterministicSnapshotKey,
  executeMlb04bOneSnapshotPersistence,
  toMlb04bSnapshotRow,
} from '../src/services/mlb-04b-research-snapshot-runtime.service.ts'

const SERVICE_PATH = 'src/services/mlb-04b-research-snapshot-runtime.service.ts'
const ROUTE_PATH = 'src/app/api/mlb/research-snapshot/route.ts'
const OLD_ROUTE_PATH = 'src/app/api/mlb/context-lineage/route.ts'
const DOC_PATH = 'docs/PRODUCTION_PILOT/MLB_04B_R2A_ONE_SNAPSHOT_PERSISTENCE_GUARD.md'
const CERT_PATH = 'docs/CERTIFICATION/mlb-04b-r2a-one-snapshot-persistence-guard.json'

function check(name, condition) {
  if (!condition) throw new Error(`${name} failed`)
  console.log(`PASS ${name}`)
}

function read(path) {
  return fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : ''
}

function baseSnapshot(overrides = {}) {
  return toMlb04bSnapshotRow({
    sport_key: 'baseball_mlb',
    league_key: 'mlb',
    event_id: 'baseball_mlb:fixture:event:mlb04b_r2a',
    snapshot_type: 'MORNING',
    captureWindow: 'MORNING_2026_08_22',
    snapshot_timestamp: '2026-08-22T13:00:00.000Z',
    target_event_start_time: '2026-08-22T23:00:00.000Z',
    temporal_status: 'PREGAME',
    provider_authority: {
      sportsDataIO: 'ROLLBACK_ONLY_EXCLUDED_FROM_MLB_01',
    },
    source_lineage: {
      officialSchedule: 'stored',
      sportsDataIO: 'excluded',
    },
    components: {
      event: {
        id: 'baseball_mlb:fixture:event:mlb04b_r2a',
        status: 'scheduled',
        matchup: 'Away @ Home',
        sourceTimestamp: '2026-08-22T12:00:00.000Z',
      },
      starters: {
        home: { status: 'PROBABLE', sourceTimestamp: '2026-08-22T12:00:00.000Z', blockers: [] },
        away: { status: 'PROBABLE', sourceTimestamp: '2026-08-22T12:00:00.000Z', blockers: [] },
      },
      lineups: {
        home: { status: 'PROJECTED', sourceTimestamp: null, blockers: ['LINEUP_PROJECTED_NOT_CONFIRMED'] },
        away: { status: 'PROJECTED', sourceTimestamp: null, blockers: ['LINEUP_PROJECTED_NOT_CONFIRMED'] },
      },
      weatherPark: {
        weather: { status: 'UNAVAILABLE_APPROVED_SOURCE_REQUIRED', sourceTimestamp: null, blockers: ['WEATHER_CONTEXT_REQUIRES_APPROVED_PROVIDER'] },
      },
    },
    feature_values: {
      starter_home_status: 'PROBABLE',
      starter_away_status: 'PROBABLE',
      weather_available: false,
    },
    feature_lineage: {
      missingDataPolicy: 'missing_context_is_unknown_never_fabricated',
    },
    completeness: {
      missingIsUnknownNotFabricated: true,
    },
    missing_components: ['lineups.home', 'lineups.away', 'weather'],
    blockers: ['LINEUP_PROJECTED_NOT_CONFIRMED', 'WEATHER_CONTEXT_REQUIRES_APPROVED_PROVIDER'],
    provider_calls: {
      mlbOfficial: 0,
      theOddsApi: 0,
      sportsDataIO: 0,
    },
    production_eligible: false,
    shadow_only: true,
    ...overrides,
  })
}

function mockAdapter(existingRows = []) {
  const rows = [...existingRows]
  return {
    inserted: [],
    async findByDeterministicKey(key) {
      return rows.filter((row) => row.deterministic_key === key)
    },
    async insert(snapshot) {
      const readback = {
        ...snapshot,
        id: `mock-${rows.length + 1}`,
        created_at: '2026-08-22T13:00:01.000Z',
      }
      rows.push(readback)
      this.inserted.push(readback)
      return readback
    },
  }
}

async function runWithEnv(value, fn) {
  const previous = process.env.MLB_04B_CONTEXT_SNAPSHOT_AUTHORIZED
  if (value === null) delete process.env.MLB_04B_CONTEXT_SNAPSHOT_AUTHORIZED
  else process.env.MLB_04B_CONTEXT_SNAPSHOT_AUTHORIZED = value
  try {
    return await fn()
  } finally {
    if (previous === undefined) delete process.env.MLB_04B_CONTEXT_SNAPSHOT_AUTHORIZED
    else process.env.MLB_04B_CONTEXT_SNAPSHOT_AUTHORIZED = previous
  }
}

const service = read(SERVICE_PATH)
const route = read(ROUTE_PATH)
const oldRoute = read(OLD_ROUTE_PATH)
const doc = read(DOC_PATH)
const certRaw = read(CERT_PATH)
const cert = JSON.parse(certRaw)

const valid = baseSnapshot()
const dryRunAdapter = mockAdapter()
const dryRun = await runWithEnv(null, () => executeMlb04bOneSnapshotPersistence({
  snapshots: [valid],
  adapter: dryRunAdapter,
}))
const executeNoEnv = await runWithEnv(null, () => executeMlb04bOneSnapshotPersistence({
  snapshots: [valid],
  execute: true,
  activationAuthorized: true,
  adapter: mockAdapter(),
}))
const envNoExecute = await runWithEnv('true', () => executeMlb04bOneSnapshotPersistence({
  snapshots: [valid],
  execute: false,
  activationAuthorized: true,
  adapter: mockAdapter(),
}))
const morningInsertAdapter = mockAdapter()
const morningInsert = await runWithEnv('true', () => executeMlb04bOneSnapshotPersistence({
  snapshots: [valid],
  execute: true,
  activationAuthorized: true,
  adapter: morningInsertAdapter,
}))
const finalPregame = baseSnapshot({
  snapshot_type: 'FINAL_PREGAME',
  captureWindow: 'FINAL_PREGAME_2026_08_22',
  snapshot_timestamp: '2026-08-22T22:30:00.000Z',
})
const finalInsert = await runWithEnv('true', () => executeMlb04bOneSnapshotPersistence({
  snapshots: [finalPregame],
  execute: true,
  activationAuthorized: true,
  adapter: mockAdapter(),
}))
const currentProbe = baseSnapshot({ snapshot_type: 'CURRENT_PROBE' })
const currentProbeResult = await executeMlb04bOneSnapshotPersistence({
  snapshots: [currentProbe],
  adapter: mockAdapter(),
})
const postStart = baseSnapshot({ snapshot_timestamp: '2026-08-23T00:00:00.000Z' })
const postStartResult = await executeMlb04bOneSnapshotPersistence({
  snapshots: [postStart],
  adapter: mockAdapter(),
})
const finalEvent = baseSnapshot({ components: { ...valid.components, event: { status: 'completed' } } })
const finalEventResult = await executeMlb04bOneSnapshotPersistence({
  snapshots: [finalEvent],
  adapter: mockAdapter(),
})
const cancelledEvent = baseSnapshot({ components: { ...valid.components, event: { status: 'cancelled' } } })
const cancelledResult = await executeMlb04bOneSnapshotPersistence({
  snapshots: [cancelledEvent],
  adapter: mockAdapter(),
})
const duplicateAdapter = mockAdapter([{ ...valid, id: 'existing-1', created_at: '2026-08-22T13:00:01.000Z' }])
const duplicateNoop = await executeMlb04bOneSnapshotPersistence({
  snapshots: [valid],
  adapter: duplicateAdapter,
})
const duplicateDefect = await executeMlb04bOneSnapshotPersistence({
  snapshots: [valid],
  adapter: mockAdapter([
    { ...valid, id: 'existing-1', created_at: '2026-08-22T13:00:01.000Z' },
    { ...valid, id: 'existing-2', created_at: '2026-08-22T13:00:02.000Z' },
  ]),
})
const multiRow = await executeMlb04bOneSnapshotPersistence({
  snapshots: [valid, finalPregame],
  adapter: mockAdapter(),
})
const morningKey = buildMlb04bDeterministicSnapshotKey({
  eventId: valid.event_id,
  snapshotType: 'MORNING',
  captureWindow: 'MORNING_2026_08_22',
})
const finalKey = buildMlb04bDeterministicSnapshotKey({
  eventId: valid.event_id,
  snapshotType: 'FINAL_PREGAME',
  captureWindow: 'FINAL_PREGAME_2026_08_22',
})

check('classification', cert.classification === 'MLB_04B_R2A_ONE_SNAPSHOT_PERSISTENCE_GUARD_REPAIR_CERTIFIED')
check('root cause captured', cert.rootCause.includes('ROUTE_FORCES_DRY_RUN') && cert.rootCause.includes('MISSING_AUTH_GUARD'))
check('service exposes one snapshot executor', service.includes('executeMlb04bOneSnapshotPersistence'))
check('route exists', route.includes('/api/mlb/research-snapshot') || route.includes('mlb_04b_one_snapshot_route_v1'))
check('old context route remains read only', oldRoute.includes('persist: false'))
check('dry run zero writes', dryRun.status === 'WOULD_INSERT' && dryRun.wouldInsert === 1 && dryRun.writes === 0 && dryRunAdapter.inserted.length === 0)
check('execute without env blocked', executeNoEnv.status === 'BLOCKED_EXECUTE_REQUIRES_ENV_AUTH' && executeNoEnv.writes === 0)
check('env without execute blocked', envNoExecute.status === 'BLOCKED_ENV_AUTH_REQUIRES_EXECUTE' && envNoExecute.writes === 0)
check('valid morning insert simulation exactly one', morningInsert.status === 'INSERTED' && morningInsert.writes === 1 && morningInsertAdapter.inserted.length === 1)
check('valid final pregame insert simulation exactly one', finalInsert.status === 'INSERTED' && finalInsert.writes === 1)
check('current probe blocked', currentProbeResult.status === 'BLOCKED_SNAPSHOT_TYPE')
check('post start blocked', postStartResult.status === 'BLOCKED_TEMPORAL_SAFETY')
check('final event blocked', finalEventResult.status === 'BLOCKED_EVENT_STATE')
check('cancelled event blocked', cancelledResult.status === 'BLOCKED_EVENT_STATE')
check('duplicate identity reuse no-op', duplicateNoop.status === 'ALREADY_EXISTS_REUSE_NO_OP' && duplicateNoop.writes === 0)
check('duplicate defect blocked', duplicateDefect.status === 'STOP_DUPLICATE_DEFECT')
check('more than one selected row blocked', multiRow.status === 'BLOCKED_ROW_SCOPE')
check('morning final identities distinct', morningKey !== finalKey)
check('readback contract present', cert.readbackContract.includes('id') && cert.readbackContract.includes('provider_authority') && morningInsert.readback?.id)
check('missing components preserved', Array.isArray(valid.missing_components) && valid.missing_components.includes('weather'))
check('no broad upsert', !service.includes('.upsert(') && service.includes('.insert('))
check('no update delete semantics', !service.includes('.update(') && !service.includes('.delete('))
check('route disables provider calls', route.includes('allowProviderCalls: false'))
check('route disables source persistence', route.includes('persist: false'))
check('max one row', cert.contract.maxNewSnapshotRowsPerExecution === 1)
check('sportsdataio excluded', cert.isolation.sportsDataIoCalls === 0 && service.includes('SPORTSDATAIO_NOT_EXCLUDED'))
check('mlb04c unchanged', cert.isolation.mlb04cScorecardRulesChanged === false)
check('provider calls zero', cert.safetyCounters.providerCallsMade === 0)
check('database mutations zero', cert.safetyCounters.productionDatabaseMutations === 0)
check('readiness yes', Object.values(cert.readiness).every((value) => value === 'YES'))
check('docs state no production write', /Do not perform the first real snapshot write|Production database mutations: 0/i.test(doc))
check('no secret values', !/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|Bearer\s+[A-Za-z0-9._~+/=-]{20,}|SUPABASE_SERVICE_ROLE_KEY\s*=|THE_ODDS_API_KEY\s*=|ODDS_API_KEY\s*=|CRON_SECRET\s*=)/.test([service, route, doc, certRaw].join('\n')))

console.log(JSON.stringify({
  success: true,
  mode: 'mlb_04b_r2a_one_snapshot_persistence_guard_validate',
  classification: cert.classification,
  checks: 32,
  dryRunStatus: dryRun.status,
  morningInsertSimulation: morningInsert.status,
  finalPregameInsertSimulation: finalInsert.status,
  duplicateNoop: duplicateNoop.status,
  providerCallsMade: 0,
  productionDatabaseMutations: 0,
}, null, 2))
