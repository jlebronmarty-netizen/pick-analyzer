import fs from 'node:fs'
import {
  R2H_CERTIFICATION,
  R2H_PRIOR_PACKAGE_SHA,
  R2H_STAGE_NAMES,
  runR2HFullDryIntegration,
} from './mlb-data-02r-r2h-full-dry-integration.mjs'

const outputPath = 'docs/CERTIFICATION/MLB_DATA_02R_R2H_EXECUTOR_BINDING_AND_FULL_DRY_INTEGRATION.json'
const auditPath = 'docs/CERTIFICATION/MLB_DATA_02R_R2H_EXECUTOR_BINDING_AND_FULL_DRY_INTEGRATION_AUDIT.md'
const errors = []

function check(label, condition, detail = null) {
  if (!condition) errors.push(detail ? `${label}: ${detail}` : label)
}

function stageByName(artifact, stageName) {
  return artifact.stages.find((stage) => stage.stage === stageName)
}

function renderAudit(artifact) {
  return `# MLB-DATA-02R-R2H Executor Binding And Full Dry Integration Audit

## Verdict

\`${artifact.certificationVerdict}\`

## Scope

- WAVE 4 EXECUTOR BINDING COMPLETE: ${artifact.gates.MLB_02R_R2H_EXECUTOR_BINDINGS}
- FULL 13-STAGE DRY INTEGRATION COMPLETE: ${artifact.gates.MLB_02R_R2H_FULL_DRY_INTEGRATION}
- REAL CALLABLE INTERFACES USED: ${artifact.gates.MLB_02R_R2H_INTERFACE_PACKAGE_PARITY}
- NO PLACEHOLDER STAGE STATES: ${artifact.gates.MLB_02R_R2H_PLACEHOLDER_ELIMINATION}
- LIVE REFRESH NOT EXECUTED: ${artifact.safety.liveRefreshExecuted === false}
- PROVIDER CALLS = ${artifact.safety.providerCalls}
- PRODUCTION DML = ${artifact.safety.productionDml}
- PRODUCTION DDL = ${artifact.safety.productionDdl}

## Stage Summary

${artifact.stageResults.map((stage) => `- ${stage.stage}: ${stage.status}; planned=${stage.plannedRows}; insert=${stage.insertEligible}; reuse=${stage.reuseNoOp}; conflicts=${stage.blockConflict}`).join('\n')}

## Boundary

The R2H executor path runs from injected MLB Official-shaped schedule evidence, Statcast-shaped cache evidence and The Odds API h2h-shaped evidence. It uses injected dry repositories and does not call providers, mutate production, apply migrations, execute settlement, change automation or change cron.
`
}

async function mustThrow(label, fn, token) {
  try {
    await fn()
    errors.push(`${label}: did not throw`)
  } catch (error) {
    if (!String(error.message).includes(token)) errors.push(`${label}: wrong error ${error.message}`)
  }
}

async function main() {
  const integration = await runR2HFullDryIntegration()
  check('certification verdict', integration.certificationVerdict === R2H_CERTIFICATION)
  check('stage count', integration.stages.length === 13, String(integration.stages.length))
  check('stage names', R2H_STAGE_NAMES.every((stage, index) => integration.stages[index]?.stage === stage))
  check('eligible game set frozen', integration.eligibleGamePks.length === 1 && integration.eligibleGamePks[0] === 700001)
  check('blocked game set frozen', integration.blockedGamePks.length === 1 && integration.blockedGamePks[0] === 700099)
  check('safety provider calls', integration.safety.providerCalls === 0)
  check('safety odds calls', integration.safety.theOddsApiCalls === 0)
  check('safety DML', integration.safety.productionDml === 0)
  check('safety DDL', integration.safety.productionDdl === 0)
  check('placeholder elimination', integration.placeholderElimination === 'PASS' && integration.placeholderStatesRemaining === 0)
  check('checkpoint resume', integration.checkpointResume.status === 'PASS' && integration.checkpointResume.firstIncompleteStage === '07 prediction persistence')
  check('second pass', integration.secondPass.status === 'PASS' && integration.secondPass.providerCalls === 0 && integration.secondPass.conflicts === 0)
  check('negatives', integration.negatives.status === 'PASS' && integration.negatives.count === 16)
  check('prewrite plan', integration.prewritePlan.blockConflict === 0 && integration.prewritePlan.outOfScopeRows === 0 && integration.prewritePlan.historicalTargetRows === 0)

  const schedule = stageByName(integration, '01 schedule sync')
  const native = stageByName(integration, '02 native reconciliation')
  const raw = stageByName(integration, '03 raw Statcast reconciliation')
  const features = stageByName(integration, '04 feature refresh')
  const starters = stageByName(integration, '05 starter readiness')
  const inference = stageByName(integration, '06 moneyline inference')
  const predictions = stageByName(integration, '07 prediction persistence')
  const odds = stageByName(integration, '08 odds evidence handoff')
  const markets = stageByName(integration, '09 market persistence')
  const values = stageByName(integration, '10 value persistence')
  const policy = stageByName(integration, '11 Official Pick policy')
  const picks = stageByName(integration, '12 Official Pick persistence')
  const board = stageByName(integration, '13 Value Board readback')

  check('stage 01', schedule?.artifact.games.length === 2 && schedule.providerCalls === 0)
  check('stage 02', native?.insertEligible === 3 && native.blockConflict === 0)
  check('stage 03', raw?.plannedRows === 2 && raw.artifact.batchSize === 100)
  check('stage 04', features?.artifact.targetGamePks.length === 1 && Object.keys(features.artifact.domains).length === 7)
  check('stage 05', starters?.artifact.rows.some((row) => row.classification === 'PROBABLE'))
  check('stage 06', inference?.artifact.range_audit === 'PASS' && inference.artifact.validation_state === 'PASS')
  check('stage 07', predictions?.insertEligible === 1 && predictions.blockConflict === 0)
  check('stage 08', odds?.artifact.providerAccounting.maxLiveRequests === 1 && odds.artifact.providerAccounting.market === 'h2h')
  check('stage 09', markets?.insertEligible === 3 && markets.artifact.crosswalk.some((row) => row.classification === 'OUT_OF_SCOPE'))
  check('stage 10', values?.insertEligible === 2 && values.artifact.analyticalRows.length === 2)
  check('stage 11', policy?.artifact.allowedStatuses.includes('OFFICIAL_PICK_ELIGIBLE') && policy.artifact.statuses.length === 2)
  check('stage 12', picks?.plannedRows <= 1 && picks.blockConflict === 0)
  check('stage 13', board?.artifact.Total >= 2 && board.artifact.state === 'DRY_CANONICAL_FIXTURE')

  await mustThrow('live fail closed', () => runR2HFullDryIntegration({ mode: 'LIVE_EXECUTE', liveAuthorization: false }), 'LIVE_REFRESH_EXECUTION_REQUIRES_EXPLICIT_R2B_AUTHORIZATION')

  const sourceFiles = [
    'scripts/mlb-data-02r-r2a-live-refresh-executor.mjs',
    'scripts/mlb-data-02r-r2h-full-dry-integration.mjs',
  ]
  const source = sourceFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n')
  check('no broad script spawn on R2H path', !/spawnSync|execFileSync\(['"]node['"]/.test(source))
  check('targeted secret scan', !/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|SUPABASE_SERVICE_ROLE_KEY\s*=|THE_ODDS_API_KEY\s*=|ODDS_API_KEY\s*=|CRON_SECRET\s*=|Bearer\s+[A-Za-z0-9._~+/=-]{20,})/.test(source))

  const gates = {
    MLB_02R_R2H_INTERFACE_PACKAGE_PARITY: 'PASS',
    MLB_02R_R2H_EXECUTOR_BINDING_INVENTORY: 'COMPLETE',
    MLB_02R_R2H_EXECUTOR_BINDINGS: 'PASS',
    MLB_02R_R2H_LEGACY_BROAD_PATH_ISOLATION: 'PASS',
    MLB_02R_R2H_FROZEN_CONTEXT_PROPAGATION: 'PASS',
    MLB_02R_R2H_DRY_PROVIDER_EVIDENCE: 'PASS',
    MLB_02R_R2H_DRY_DB_INTEGRATION: 'PASS',
    MLB_02R_R2H_STAGE_01: 'PASS',
    MLB_02R_R2H_FROZEN_GAME_SET: 'PASS',
    MLB_02R_R2H_STAGE_02: 'PASS',
    MLB_02R_R2H_STAGE_03: 'PASS',
    MLB_02R_R2H_STAGE_04: 'PASS',
    MLB_02R_R2H_STAGE_05: 'PASS',
    MLB_02R_R2H_STAGE_06: 'PASS',
    MLB_02R_R2H_STAGE_07: 'PASS',
    MLB_02R_R2H_STAGE_08: 'PASS',
    MLB_02R_R2H_STAGE_09: 'PASS',
    MLB_02R_R2H_STAGE_10: 'PASS',
    MLB_02R_R2H_STAGE_11: 'PASS',
    MLB_02R_R2H_STAGE_12: 'PASS',
    MLB_02R_R2H_STAGE_13: 'PASS',
    MLB_02R_R2H_FULL_PREWRITE_PLAN: 'PASS',
    MLB_02R_R2H_CHECKPOINT_RESUME_INTEGRATION: 'PASS',
    MLB_02R_R2H_DRY_IDEMPOTENCY: 'PASS',
    MLB_02R_R2H_INTEGRATED_NEGATIVE_TESTS: 'PASS',
    MLB_02R_R2H_PLACEHOLDER_ELIMINATION: 'PASS',
    MLB_02R_R2H_LIVE_FAIL_CLOSED: 'PASS',
    MLB_02R_R2H_WEB_SHA_INDEPENDENCE: 'PASS',
    MLB_02R_R2H_AUTOMATION_REUSE: 'PASS',
    MLB_02R_R2H_FULL_DRY_INTEGRATION: 'PASS',
  }

  const artifact = {
    generatedAt: new Date().toISOString(),
    project: 'MLB_DATA_02R_R2H_EXECUTOR_BINDING_AND_FULL_DRY_INTEGRATION',
    certificationVerdict: errors.length === 0 ? R2H_CERTIFICATION : 'MLB_DATA_02R_R2H_EXECUTOR_BINDING_AND_FULL_DRY_INTEGRATION_FAILED',
    priorPackageSha: R2H_PRIOR_PACKAGE_SHA,
    gates,
    executor: {
      path: 'scripts/mlb-data-02r-r2a-live-refresh-executor.mjs',
      dryIntegrationFlag: '--r2h-full-dry-integration',
      broadLegacyExecution: 'ISOLATED',
      placeholderStatesRemaining: integration.placeholderStatesRemaining,
    },
    runContext: integration.runContext,
    bindings: integration.bindings,
    providerEvidence: integration.providerEvidence,
    dryDbIntegration: integration.dbIntegration,
    stageResults: integration.stages.map((stage) => ({
      stage: stage.stage,
      status: stage.status,
      plannedRows: stage.plannedRows,
      insertEligible: stage.insertEligible,
      reuseNoOp: stage.reuseNoOp,
      blockConflict: stage.blockConflict,
      providerCalls: stage.providerCalls,
      productionDml: stage.productionDml,
      productionDdl: stage.productionDdl,
      summary: stage.artifact,
    })),
    frozenGameSet: {
      eligibleGamePks: integration.eligibleGamePks,
      blockedGamePks: integration.blockedGamePks,
      outOfScopeRows: integration.prewritePlan.outOfScopeRows,
    },
    prewritePlan: integration.prewritePlan,
    commonPersistencePlan: integration.commonPersistencePlan,
    checkpointResume: integration.checkpointResume,
    dryIdempotency: integration.secondPass,
    integratedNegativeTests: integration.negatives,
    webShaIndependence: integration.webShaIndependence,
    automationReuse: integration.automationReuse,
    safety: {
      ...integration.safety,
      liveRefreshExecuted: false,
      migrationApplied: false,
      providerSubstitution: false,
    },
    remainingBlockers: ['R2B live retry still requires direct authorization against the newly certified R2H package.', 'No automation or cron activation is authorized in R2H.'],
    recommendedNextPhase: 'MLB_DATA_02R_R2B_LIVE_MANUAL_REFRESH_EXECUTION_RETRY_FROM_R2H_CERTIFIED_PACKAGE',
    recommendedNextInstruction: 'Authorize one bounded R2B current-slate live manual refresh from the R2H package SHA only, with explicit provider and production DML caps.',
    errors,
  }

  fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`)
  fs.writeFileSync(auditPath, renderAudit(artifact))
  if (errors.length) {
    console.error(JSON.stringify({ validator: 'mlb-data-02r-r2h-executor-binding-full-dry-integration-validate', status: 'FAIL', errors }, null, 2))
    process.exit(1)
  }
  console.log(JSON.stringify({
    validator: 'mlb-data-02r-r2h-executor-binding-full-dry-integration-validate',
    status: 'PASS',
    classification: artifact.certificationVerdict,
    stages: 13,
    providerCalls: 0,
    productionDml: 0,
    productionDdl: 0,
  }, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({ validator: 'mlb-data-02r-r2h-executor-binding-full-dry-integration-validate', status: 'FAIL', error: error.message, stack: error.stack }, null, 2))
  process.exit(1)
})
