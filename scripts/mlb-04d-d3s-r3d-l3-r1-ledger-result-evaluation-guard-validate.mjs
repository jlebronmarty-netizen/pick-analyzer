import fs from 'node:fs'

function loadEnvFile(path) {
  if (!fs.existsSync(path)) return
  for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index <= 0) continue
    const key = trimmed.slice(0, index).trim()
    let value = trimmed.slice(index + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

loadEnvFile('.env.local')

const servicePath = 'src/services/mlb-04d-forward-research-ledger-result-evaluation.service.ts'
const authStatusPath = 'src/services/mlb-04d-research-auth-status.service.ts'
const migrationPath = 'supabase/migrations/202608230001_mlb_forward_research_ledger_v1.sql'
const certPath = 'docs/CERTIFICATION/mlb-04d-d3s-r3d-l3-r1-ledger-result-evaluation-guard.json'

const service = fs.readFileSync(servicePath, 'utf8')
const authStatus = fs.readFileSync(authStatusPath, 'utf8')
const migration = fs.readFileSync(migrationPath, 'utf8')
const cert = JSON.parse(fs.readFileSync(certPath, 'utf8'))

const {
  LEDGER_RESULT_MUTABLE_FIELDS,
  LEDGER_RESULT_PREGAME_DENYLIST_FIELDS,
  MLB_04D_D3S_R3D_L3_R1_CLASSIFICATION,
  MLB_FORWARD_RESEARCH_LEDGER_RESULT_EVALUATION_AUTHORIZATION_ENV,
  MLB_FORWARD_RESEARCH_LEDGER_RESULT_EVALUATION_MAX_UPDATED_ROWS,
  evaluateMlbForwardResearchLedgerResultEvaluationAuthorization,
  getMlbForwardResearchLedgerResultEvaluationContract,
  gradeMlbForwardResearchLedgerMarketResult,
  persistSingleMlbForwardResearchLedgerResultEvaluation,
  runMlbForwardResearchLedgerResultEvaluationFixture,
} = await import('../src/services/mlb-04d-forward-research-ledger-result-evaluation.service.ts')
const { buildMlbResearchAuthStatusPayload } = await import('../src/services/mlb-04d-research-auth-status.service.ts')

const checks = []
function check(name, condition, detail = null) {
  checks.push({ name, passed: Boolean(condition), detail })
  console.log(`${condition ? 'PASS' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`)
}

function near(actual, expected, epsilon = 1e-10) {
  return Math.abs(Number(actual) - expected) <= epsilon
}

function memoryStore(initialRows = []) {
  const rows = initialRows.map((row) => ({ ...row }))
  return {
    rows,
    updates: 0,
    async readByIdAndIdentity(id, identity) {
      return rows.filter((row) => row.id === id && row.deterministic_identity === identity).slice(0, 2)
    },
    async updateResultFields(id, identity, evaluation) {
      const matches = rows.filter((row) => row.id === id && row.deterministic_identity === identity)
      if (matches.length !== 1) return { updatedRows: matches.length, row: matches[0] ?? null }
      this.updates += 1
      Object.assign(matches[0], evaluation)
      return { updatedRows: 1, row: matches[0] }
    },
  }
}

const fixture = runMlbForwardResearchLedgerResultEvaluationFixture()
const contract = getMlbForwardResearchLedgerResultEvaluationContract()
const baseRow = fixture.fixture.baseRow
const evaluation = fixture.fixture.evaluation
const authorizedEnv = { [MLB_FORWARD_RESEARCH_LEDGER_RESULT_EVALUATION_AUTHORIZATION_ENV]: 'true' }
const insertOnlyEnv = {
  MLB_FORWARD_RESEARCH_LEDGER_CANARY_AUTHORIZED: 'true',
  [MLB_FORWARD_RESEARCH_LEDGER_RESULT_EVALUATION_AUTHORIZATION_ENV]: 'false',
}
const authPayload = buildMlbResearchAuthStatusPayload({
  CRON_SECRET: 'placeholder',
  MLB_FORWARD_RESEARCH_LEDGER_RESULT_EVALUATION_AUTHORIZED: 'true',
})

const firstStore = memoryStore([baseRow])
const first = await persistSingleMlbForwardResearchLedgerResultEvaluation({
  ledgerRowId: String(baseRow.id),
  deterministicIdentity: baseRow.deterministic_identity,
  evaluation,
}, {
  execute: true,
  resultEvaluationAuthorized: true,
  env: authorizedEnv,
  store: firstStore,
})
const second = await persistSingleMlbForwardResearchLedgerResultEvaluation({
  ledgerRowId: String(baseRow.id),
  deterministicIdentity: baseRow.deterministic_identity,
  evaluation,
}, {
  execute: true,
  resultEvaluationAuthorized: true,
  env: authorizedEnv,
  store: firstStore,
})
const unauthorized = await persistSingleMlbForwardResearchLedgerResultEvaluation({
  ledgerRowId: String(baseRow.id),
  deterministicIdentity: baseRow.deterministic_identity,
  evaluation,
}, {
  execute: true,
  resultEvaluationAuthorized: true,
  env: insertOnlyEnv,
  store: memoryStore([baseRow]),
})
const conflict = await persistSingleMlbForwardResearchLedgerResultEvaluation({
  ledgerRowId: String(baseRow.id),
  deterministicIdentity: baseRow.deterministic_identity,
  evaluation,
}, {
  execute: true,
  resultEvaluationAuthorized: true,
  env: authorizedEnv,
  store: memoryStore([{ ...baseRow, result: 'LOSS', result_id: evaluation.result_id, profit: -100 }]),
})
const duplicate = await persistSingleMlbForwardResearchLedgerResultEvaluation({
  ledgerRowId: String(baseRow.id),
  deterministicIdentity: baseRow.deterministic_identity,
  evaluation,
}, {
  execute: true,
  resultEvaluationAuthorized: true,
  env: authorizedEnv,
  store: memoryStore([baseRow, { ...baseRow }]),
})
const missing = await persistSingleMlbForwardResearchLedgerResultEvaluation({
  ledgerRowId: String(baseRow.id),
  deterministicIdentity: baseRow.deterministic_identity,
  evaluation,
}, {
  execute: true,
  resultEvaluationAuthorized: true,
  env: authorizedEnv,
  store: memoryStore([]),
})
const pushEvaluation = fixture.fixture.pushEvaluation

check('classification', MLB_04D_D3S_R3D_L3_R1_CLASSIFICATION === 'MLB_04D_D3S_R3D_L3_R1_RESULT_EVALUATION_GUARD_CERTIFIED')
check('dedicated result-eval guard', MLB_FORWARD_RESEARCH_LEDGER_RESULT_EVALUATION_AUTHORIZATION_ENV === 'MLB_FORWARD_RESEARCH_LEDGER_RESULT_EVALUATION_AUTHORIZED')
check('default authorization false', !evaluateMlbForwardResearchLedgerResultEvaluationAuthorization({}) && contract.defaultAuthorized === false)
check('auth separation from insert canary', unauthorized.status === 'BLOCK_UNAUTHORIZED' && !service.includes('MLB_FORWARD_RESEARCH_LEDGER_CANARY_AUTHORIZED'))
check('auth status observable', authStatus.includes('forwardResearchLedgerResultEvaluationAuthorized') && authPayload.forwardResearchLedgerResultEvaluationAuthorized === 'TRUE')
check('max one update', MLB_FORWARD_RESEARCH_LEDGER_RESULT_EVALUATION_MAX_UPDATED_ROWS === 1 && contract.maxUpdatedRowsPerEvaluation === 1)
check('no array or batch semantics', contract.acceptsArrayPayloads === false && !/batch|array payload/i.test(service.slice(service.indexOf('persistSingleMlbForwardResearchLedgerResultEvaluation'))))
check('exact row binding', service.includes('ledgerRowId') && service.includes('deterministicIdentity') && service.includes(".eq('id', id)") && service.includes(".eq('deterministic_identity', deterministicIdentity)"))
check('pre-read contract', fixture.fixture.preReadEligible === 'EVALUATION_ELIGIBLE' && fixture.fixture.preReadReuse === 'REUSE_NO_OP' && fixture.fixture.preReadConflict === 'BLOCK_RESULT_CONFLICT')
check('missing and duplicate blocks', missing.status === 'BLOCK_NOT_FOUND' && duplicate.status === 'BLOCK_DUPLICATE_DEFECT')
check('canonical result binding fixture', fixture.fixture.canonicalResult.eventId === baseRow.event_id && fixture.fixture.canonicalResult.id === evaluation.result_id)
check('market settlement fixture', gradeMlbForwardResearchLedgerMarketResult({ market: 'total', selection: 'Under', line: 7, homeTeam: 'SF', awayTeam: 'CIN', homeScore: 5, awayScore: 0 }) === 'WIN')
check('profit fixture', evaluation.result === 'WIN' && evaluation.profit === 106)
check('brier fixture', near(evaluation.raw_brier, 0.39753025) && near(evaluation.calibrated_brier, 0.226576))
check('log-loss fixture', near(evaluation.raw_log_loss, 0.9956045385938805) && near(evaluation.calibrated_log_loss, 0.6462635946610948))
check('chat directional fixture', evaluation.chat_directional_result === 'CORRECT')
check('mutable allowlist', ['result', 'result_id', 'settled_at', 'profit', 'raw_brier', 'calibrated_brier', 'raw_log_loss', 'calibrated_log_loss', 'chat_directional_result'].every((field) => LEDGER_RESULT_MUTABLE_FIELDS.includes(field)))
check('pregame denylist', ['deterministic_identity', 'event_id', 'snapshot_id', 'opportunity_evidence_id', 'snapshot_type', 'market', 'selection', 'line', 'sportsbook', 'odds', 'odds_timestamp', 'raw_probability', 'calibrated_probability', 'component_states', 'component_values', 'composite_score', 'scorecard_completeness', 'context_completeness', 'methodology_version', 'scorecard_version', 'created_at'].every((field) => LEDGER_RESULT_PREGAME_DENYLIST_FIELDS.includes(field)))
check('exactly-one update service', first.status === 'UPDATED' && first.updatedRows === 1 && firstStore.updates === 1)
check('immediate readback readiness', first.readbackStatus === 'READBACK_EXACT_ONE')
check('result write readback parity', first.writeReadbackParity === 'PASS')
check('pregame immutability', first.pregameImmutability === 'PASS' && fixture.fixture.pregameImmutability.status === 'PASS')
check('result idempotency', second.status === 'REUSE_NO_OP' && second.updatedRows === 0 && firstStore.updates === 1)
check('result conflict blocks overwrite', conflict.status === 'BLOCK_RESULT_CONFLICT' && conflict.updatedRows === 0)
check('push semantics', pushEvaluation.result === 'PUSH' && pushEvaluation.profit === 0 && pushEvaluation.raw_brier === null && pushEvaluation.calibrated_log_loss === null)
check('cohort compatibility', migration.includes('scorecard_version') && migration.includes('market') && migration.includes('snapshot_type') && migration.includes('raw_brier') && migration.includes('calibrated_log_loss'))
check('accuracy claim guard', contract.accuracyClaimReady === false)
check('calibration observation only', contract.calibrationObservationOnly === true && fixture.fixture.calibrationImprovedBrier === true && fixture.fixture.calibrationImprovedLogLoss === true)
check('learning isolation', contract.authorizesLearningWrites === false && fixture.fixture.learningWrites === 0)
check('product isolation', contract.authorizesProductWrites === false && contract.authorizesOfficialPickWrites === false && fixture.fixture.productWrites === 0)
check('general settlement isolation', contract.authorizesSettlementWrites === false)
check('automation off', contract.activatesAutomation === false && contract.activeCronAdded === false && fixture.fixture.automationActivated === 'NO')
check('provider calls zero', contract.providerCallsMade === 0 && fixture.fixture.providerCalls === 0 && !/fetch\s*\(|GameOddsByDate|Stats API|theOddsApi/i.test(service))
check('production DB mutations zero during certification', cert.safety.productionDatabaseMutations === 0 && fixture.fixture.productionDatabaseMutations === 0)
check('SportsDataIO exclusion', !/GameOddsByDate|SportsDataIO API|sportsdataio client/i.test(service))
check('NFL isolation', !/football_nfl|nfl_/i.test(service))
check('NBA isolation', !/basketball_nba|nba_/i.test(service))
check('no secret leakage', !/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|SUPABASE_SERVICE_ROLE_KEY\s*=|THE_ODDS_API_KEY\s*=|ODDS_API_KEY\s*=|CRON_SECRET\s*=)/.test([service, authStatus, JSON.stringify(cert)].join('\n')))

const failed = checks.filter((row) => !row.passed)
console.log(JSON.stringify({
  success: failed.length === 0,
  mode: 'mlb_04d_d3s_r3d_l3_r1_ledger_result_evaluation_guard_validate',
  classification: MLB_04D_D3S_R3D_L3_R1_CLASSIFICATION,
  checks: checks.length,
  failedChecks: failed.map((row) => row.name),
  resultEvaluationGuard: MLB_FORWARD_RESEARCH_LEDGER_RESULT_EVALUATION_AUTHORIZATION_ENV,
  maxUpdatedRows: MLB_FORWARD_RESEARCH_LEDGER_RESULT_EVALUATION_MAX_UPDATED_ROWS,
  first,
  second,
  unauthorized,
  conflict,
  pushEvaluation,
  providerCallsMade: 0,
  productionDatabaseMutations: 0,
}, null, 2))

if (failed.length) process.exit(1)
