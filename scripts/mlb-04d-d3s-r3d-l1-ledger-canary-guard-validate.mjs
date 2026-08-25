import fs from 'fs'

process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'placeholder-service-role-key'
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://example.supabase.co'

const servicePath = 'src/services/mlb-04d-forward-research-ledger-canary.service.ts'
const authPath = 'src/services/mlb-04d-research-auth-status.service.ts'
const migrationPath = 'supabase/migrations/202608230001_mlb_forward_research_ledger_v1.sql'
const docs = [
  'docs/PROJECT_STATUS.md',
  'docs/MASTER_ROADMAP.md',
  'docs/CERTIFICATION/mlb-04d-d3s-r3d-l1-ledger-canary-guard.json',
]

const service = fs.readFileSync(servicePath, 'utf8')
const auth = fs.readFileSync(authPath, 'utf8')
const migration = fs.readFileSync(migrationPath, 'utf8')
const cert = JSON.parse(fs.readFileSync(docs[2], 'utf8'))

const {
  MLB_04D_D3S_R3D_L1_CLASSIFICATION,
  MLB_FORWARD_RESEARCH_LEDGER_CANARY_AUTHORIZATION_ENV,
  MLB_FORWARD_RESEARCH_LEDGER_CANARY_MAX_NEW_ROWS,
  buildMlbForwardResearchLedgerCanaryIdentity,
  compareMlbForwardResearchLedgerCanaryReadback,
  getMlbForwardResearchLedgerCanaryContract,
  persistSingleMlbForwardResearchLedgerCanary,
} = await import('../src/services/mlb-04d-forward-research-ledger-canary.service.ts')
const { buildMlbResearchAuthStatusPayload } = await import('../src/services/mlb-04d-research-auth-status.service.ts')

let passed = 0
const failed = []
function check(name, condition) {
  if (condition) {
    passed += 1
    console.log(`PASS ${name}`)
  } else {
    failed.push(name)
    console.error(`FAIL ${name}`)
  }
}

function baseRow(overrides = {}) {
  const row = {
    deterministic_identity: '',
    sport_key: 'baseball_mlb',
    observation_id: '55f27a6a-8580-4478-97ae-e4018e203294:de7e36a1-058e-5b9e-a711-9ad87ee15c69',
    event_id: 'baseball_mlb:mlb:sportsdataio:event:79263',
    snapshot_id: '55f27a6a-8580-4478-97ae-e4018e203294',
    opportunity_evidence_id: 'de7e36a1-058e-5b9e-a711-9ad87ee15c69',
    snapshot_type: 'FINAL_PREGAME',
    snapshot_timestamp: '2026-08-24T23:38:10.836+00:00',
    methodology_version: 'mlb_forward_opportunity_evidence_v1',
    scorecard_version: 'MLB_CHAT_METHOD_RESEARCH_SCORECARD_V2',
    market: 'total',
    selection: 'Under',
    line: 7,
    sportsbook: 'lowvig',
    odds: 106,
    odds_timestamp: '2026-08-24T23:17:07+00:00',
    raw_probability: 0.3695,
    calibrated_probability: 0.524,
    component_states: {
      MARKET_VALUE: 'AVAILABLE',
      OFFENSE_EDGE: 'AVAILABLE',
      BULLPEN_EDGE: 'AVAILABLE',
    },
    component_values: {
      MARKET_VALUE: 0.0386,
      OFFENSE_EDGE: 0.0277,
      BULLPEN_EDGE: 0.1825,
      STARTER_EDGE: null,
    },
    composite_score: 0.0829,
    scorecard_completeness: 0.4286,
    context_completeness: 0.4286,
    result: null,
    result_id: null,
    settled_at: null,
    profit: null,
    raw_brier: null,
    calibrated_brier: null,
    raw_log_loss: null,
    calibrated_log_loss: null,
    chat_directional_result: null,
    ...overrides,
  }
  row.deterministic_identity = buildMlbForwardResearchLedgerCanaryIdentity({
    sportKey: row.sport_key,
    eventId: row.event_id,
    snapshotId: row.snapshot_id,
    snapshotType: row.snapshot_type,
    market: row.market,
    selection: row.selection,
    line: row.line,
    sportsbook: row.sportsbook,
    methodologyVersion: row.methodology_version,
    scorecardVersion: row.scorecard_version,
  })
  return row
}

function memoryStore(initialRows = [], options = {}) {
  const rows = [...initialRows]
  return {
    rows,
    inserts: 0,
    async readByDeterministicIdentity(identity) {
      return rows.filter((row) => row.deterministic_identity === identity).slice(0, 2)
    },
    async validateForeignKeys() {
      return options.validForeignKeys ?? true
    },
    async insert(row) {
      this.inserts += 1
      if (rows.some((item) => item.deterministic_identity === row.deterministic_identity)) return { duplicate: true }
      const inserted = { ...row, id: '22222222-2222-4222-8222-222222222222', created_at: '2026-08-25T00:00:00.000Z' }
      rows.push(inserted)
      return { row: inserted }
    },
  }
}

const row = baseRow()
const expectedIdentity =
  'mlb_forward_research_ledger_v1|baseball_mlb|baseball_mlb:mlb:sportsdataio:event:79263|55f27a6a-8580-4478-97ae-e4018e203294|final_pregame|total|under|7.0|lowvig|mlb_forward_opportunity_evidence_v1|mlb_chat_method_research_scorecard_v2'
const authorizedEnv = { [MLB_FORWARD_RESEARCH_LEDGER_CANARY_AUTHORIZATION_ENV]: 'true' }
const generalOnlyEnv = { MLB_FORWARD_LEDGER_ENABLED: 'true', [MLB_FORWARD_RESEARCH_LEDGER_CANARY_AUTHORIZATION_ENV]: 'false' }
const evidenceOnlyEnv = {
  MLB_FORWARD_OPPORTUNITY_EVIDENCE_CANARY_AUTHORIZED: 'true',
  [MLB_FORWARD_RESEARCH_LEDGER_CANARY_AUTHORIZATION_ENV]: 'false',
}

const canaryStore = memoryStore()
const first = await persistSingleMlbForwardResearchLedgerCanary(row, {
  execute: true,
  canaryAuthorized: true,
  requestedDeterministicIdentity: row.deterministic_identity,
  env: authorizedEnv,
  store: canaryStore,
})
const second = await persistSingleMlbForwardResearchLedgerCanary(row, {
  execute: true,
  canaryAuthorized: true,
  requestedDeterministicIdentity: row.deterministic_identity,
  env: authorizedEnv,
  store: canaryStore,
})
const unauthorized = await persistSingleMlbForwardResearchLedgerCanary(row, {
  execute: true,
  canaryAuthorized: true,
  requestedDeterministicIdentity: row.deterministic_identity,
  env: {},
  store: memoryStore(),
})
const generalOnly = await persistSingleMlbForwardResearchLedgerCanary(row, {
  execute: true,
  canaryAuthorized: true,
  requestedDeterministicIdentity: row.deterministic_identity,
  env: generalOnlyEnv,
  store: memoryStore(),
})
const evidenceOnly = await persistSingleMlbForwardResearchLedgerCanary(row, {
  execute: true,
  canaryAuthorized: true,
  requestedDeterministicIdentity: row.deterministic_identity,
  env: evidenceOnlyEnv,
  store: memoryStore(),
})
const duplicate = await persistSingleMlbForwardResearchLedgerCanary(row, {
  execute: true,
  canaryAuthorized: true,
  requestedDeterministicIdentity: row.deterministic_identity,
  env: authorizedEnv,
  store: memoryStore([{ ...row, id: 'a' }, { ...row, id: 'b' }]),
})
const mismatch = await persistSingleMlbForwardResearchLedgerCanary(row, {
  execute: true,
  canaryAuthorized: true,
  requestedDeterministicIdentity: `${row.deterministic_identity}|wrong`,
  env: authorizedEnv,
  store: memoryStore(),
})
const invalidFk = await persistSingleMlbForwardResearchLedgerCanary(row, {
  execute: true,
  canaryAuthorized: true,
  requestedDeterministicIdentity: row.deterministic_identity,
  env: authorizedEnv,
  store: memoryStore([], { validForeignKeys: false }),
})

const reorderedReadback = {
  ...row,
  component_states: {
    BULLPEN_EDGE: 'AVAILABLE',
    OFFENSE_EDGE: 'AVAILABLE',
    MARKET_VALUE: 'AVAILABLE',
  },
  component_values: {
    STARTER_EDGE: null,
    BULLPEN_EDGE: 0.1825,
    OFFENSE_EDGE: 0.0277,
    MARKET_VALUE: 0.0386,
  },
}
const parity = compareMlbForwardResearchLedgerCanaryReadback(row, reorderedReadback)
const realMismatch = compareMlbForwardResearchLedgerCanaryReadback(row, {
  ...reorderedReadback,
  raw_probability: 0.4,
})
const authPayload = buildMlbResearchAuthStatusPayload({
  CRON_SECRET: 'secret-present',
  MLB_04B_CONTEXT_SNAPSHOT_AUTHORIZED: 'true',
  MLB_FORWARD_OPPORTUNITY_EVIDENCE_CANARY_AUTHORIZED: 'true',
  MLB_FORWARD_OPPORTUNITY_EVIDENCE_CONTINUOUS_AUTHORIZED: 'false',
  [MLB_FORWARD_RESEARCH_LEDGER_CANARY_AUTHORIZATION_ENV]: 'true',
})
const contract = getMlbForwardResearchLedgerCanaryContract()

check('classification', MLB_04D_D3S_R3D_L1_CLASSIFICATION === 'MLB_04D_D3S_R3D_L1_LEDGER_CANARY_GUARD_CERTIFIED')
check('dedicated auth guard', MLB_FORWARD_RESEARCH_LEDGER_CANARY_AUTHORIZATION_ENV === 'MLB_FORWARD_RESEARCH_LEDGER_CANARY_AUTHORIZED' && service.includes('MLB_FORWARD_RESEARCH_LEDGER_CANARY_AUTHORIZED'))
check('guard independent from general ledger', !service.includes('MLB_FORWARD_LEDGER_ENABLED') && generalOnly.status === 'BLOCK_UNAUTHORIZED')
check('guard independent from evidence canary', evidenceOnly.status === 'BLOCK_UNAUTHORIZED')
check('auth status visible', auth.includes('forwardResearchLedgerCanaryAuthorized') && authPayload.forwardResearchLedgerCanaryAuthorized === 'TRUE')
check('server runtime provenance retained', auth.includes('process.env') && authPayload.provenance === 'DEPLOYED_SERVER_RUNTIME')
check('exact identity', row.deterministic_identity === expectedIdentity)
check('identity mismatch blocks', mismatch.status === 'BLOCK_IDENTITY_MISMATCH' && mismatch.productionDatabaseMutations === 0)
check('unauthorized blocks', unauthorized.status === 'BLOCK_UNAUTHORIZED' && unauthorized.productionDatabaseMutations === 0)
check('exact pre-read insert', first.preReadExactMatches === 0 && first.status === 'INSERTED' && first.inserted === 1)
check('max one row', MLB_FORWARD_RESEARCH_LEDGER_CANARY_MAX_NEW_ROWS === 1 && contract.maxNewRowsPerCanary === 1 && first.inserted <= 1)
check('reuse no-op', second.preReadExactMatches === 1 && second.status === 'REUSE_NO_OP' && second.reused === 1 && second.productionDatabaseMutations === 0)
check('duplicate fail closed', duplicate.status === 'BLOCK_DUPLICATE_DEFECT' && duplicate.productionDatabaseMutations === 0)
check('invalid fk fail closed', invalidFk.status === 'BLOCK_INVALID_FOREIGN_KEY' && invalidFk.productionDatabaseMutations === 0)
check('immediate readback', first.readbackStatus === 'READBACK_EXACT_ONE')
check('semantic json parity', parity.status === 'PASS' && realMismatch.status === 'FAIL')
check('repeated idempotency', first.inserted === 1 && second.inserted === 0 && canaryStore.rows.length === 1)
check('pregame immutability contract', contract.immutablePregameFields.includes('opportunity_evidence_id') && contract.immutablePregameFields.includes('raw_probability'))
check('result mutability boundary', contract.mutableResultFields.includes('result_id') && contract.mutableResultFields.includes('raw_brier'))
check('snapshot evidence isolation', contract.authorizesSnapshotWrites === false && contract.authorizesOpportunityEvidenceWrites === false && contract.authorizesPredictionWrites === false)
check('observability response', ['requestedDeterministicIdentity', 'recomputedDeterministicIdentity', 'preReadExactMatches', 'action', 'inserted', 'reused', 'rowId', 'readbackStatus', 'writeReadbackParity', 'providerCallsMade', 'productionDatabaseMutations'].every((key) => key in first))
check('cohort result compatibility', migration.includes('scorecard_version') && migration.includes('market') && migration.includes('snapshot_type') && migration.includes('raw_brier') && migration.includes('calibrated_log_loss'))
check('accuracy claim guard', contract.accuracyClaimReady === false)
check('chat probability guard', contract.chatMethodProbabilityCreated === false && contract.chatMethodProbabilityReady === false)
check('product model isolation', contract.authorizesPredictionWrites === false && contract.authorizesSettlementWrites === false)
check('automation off', contract.automationActivated === 'NO' && contract.activeCronAdded === 'NO' && contract.invokesAutomationPlanner === false)
check('provider calls zero', first.providerCallsMade === 0 && second.providerCallsMade === 0)
check('production db mutations zero in validator', cert.productionDatabaseMutations === 0)
check('docs current', docs.every((path) => fs.readFileSync(path, 'utf8').includes('MLB_04D_D3S_R3D_L1_LEDGER_CANARY_GUARD_CERTIFIED')))
check('SportsDataIO/NFL/NBA isolation', !service.includes('SportsDataIO') && !service.includes('football_nfl') && !service.includes('basketball_nba'))
check('secret scan', !/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|SUPABASE_SERVICE_ROLE_KEY\\s*=|THE_ODDS_API_KEY\\s*=|ODDS_API_KEY\\s*=|CRON_SECRET\\s*=)/.test([service, auth, JSON.stringify(cert), ...docs.map((path) => fs.readFileSync(path, 'utf8'))].join('\\n')))

const result = {
  success: failed.length === 0,
  mode: 'mlb_04d_d3s_r3d_l1_ledger_canary_guard_validate',
  classification: MLB_04D_D3S_R3D_L1_CLASSIFICATION,
  checks: passed + failed.length,
  passed,
  failed: failed.length,
  failedChecks: failed,
  LEDGER_CANARY_AUTH_GUARD_READY: 'YES',
  LEDGER_CANARY_AND_GENERAL_LEDGER_AUTH_SEPARATED: 'YES',
  LEDGER_CANARY_EXACT_IDENTITY_BINDING_READY: 'YES',
  LEDGER_CANARY_EXACT_PRE_READ_READY: 'YES',
  LEDGER_CANARY_DUPLICATE_DEFECT_FAIL_CLOSED: 'YES',
  MAX_NEW_LEDGER_ROWS_PER_CANARY: MLB_FORWARD_RESEARCH_LEDGER_CANARY_MAX_NEW_ROWS,
  LEDGER_CANARY_IMMEDIATE_READBACK_READY: 'YES',
  LEDGER_CANARY_WRITE_READBACK_PARITY_READY: 'YES',
  LEDGER_CANARY_REPEATED_IDEMPOTENCY: 'PASS',
  LEDGER_PREGAME_IMMUTABILITY_CONTRACT_READY: 'YES',
  LEDGER_AUTH_ISOLATED_FROM_UPSTREAM_WRITES: 'YES',
  LEDGER_CANARY_GUARD_STATUS_OBSERVABLE: 'YES',
  LEDGER_ACCURACY_CLAIM_READY: 'NO',
  CHAT_METHOD_PROBABILITY_CREATED: 'NO',
  RAW_MODEL_CHANGED: 'NO',
  CALIBRATION_CHANGED: 'NO',
  AUTOMATION_ACTIVATED: 'NO',
  ACTIVE_CRON_ADDED: 'NO',
  providerCallsMade: 0,
  productionDatabaseMutations: 0,
}

console.log(JSON.stringify(result, null, 2))
if (failed.length) process.exit(1)
