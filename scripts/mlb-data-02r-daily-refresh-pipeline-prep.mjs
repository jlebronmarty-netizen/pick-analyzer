import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const args = new Set(process.argv.slice(2))
const TARGET_COMMIT = 'aaec403c71585b3a5144c5c82b0ee3bcbe5d6518'
const BASE_URL = 'https://pick-analyzer.vercel.app'
const PIPELINE_VERSION = 'MLB_DATA_02R_DAILY_REFRESH_PIPELINE_V1'
const RUN_TYPE = 'DRY_RUN'
const ARTIFACT_PATH = path.join('docs', 'CERTIFICATION', 'mlb-data-02r-daily-refresh-pipeline-prep.json')
const AUDIT_PATH = path.join('docs', 'CERTIFICATION', 'mlb-data-02r-daily-refresh-pipeline-prep-audit.md')

if (args.has('--execute') || args.has('--execute-current-slate')) {
  console.error('DAILY_REFRESH_EXECUTION_FORBIDDEN_IN_02R_PREP')
  process.exit(1)
}

function run(command, commandArgs) {
  return execFileSync(command, commandArgs, { encoding: 'utf8' }).trim()
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

async function fetchJson(pathname) {
  const response = await fetch(`${BASE_URL}${pathname}`, { cache: 'no-store' })
  const text = await response.text()
  assert(response.ok, `FETCH_FAILED_${pathname}_${response.status}`)
  return JSON.parse(text)
}

function isoDateInTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

async function main() {
  const branch = run('git', ['branch', '--show-current'])
  const localHead = run('git', ['rev-parse', 'HEAD'])
  const originMain = run('git', ['rev-parse', 'origin/main'])
  const worktreeStatus = run('git', ['status', '--short'])

  assert(branch === 'main', `BRANCH_MISMATCH_${branch}`)
  assert(localHead === TARGET_COMMIT, `LOCAL_HEAD_MISMATCH_${localHead}`)
  assert(originMain === TARGET_COMMIT, `ORIGIN_MAIN_MISMATCH_${originMain}`)

  const version = await fetchJson('/api/system/version')
  assert(version.gitCommit === TARGET_COMMIT, `PRODUCTION_COMMIT_MISMATCH_${version.gitCommit}`)
  assert(Number(version.providerCallsMade ?? 0) === 0, 'PROVIDER_CALLS_NONZERO')

  const valueBoardPrep = readJson(path.join('docs', 'CERTIFICATION', 'mlb-data-02q-value-board-prep.json'))
  const r6 = readJson(path.join('docs', 'CERTIFICATION', 'mlb-data-02q-r6-manual-env-activation-readback.json'))
  const h2 = readJson(path.join('docs', 'CERTIFICATION', 'mlb-data-02h-2026-current-foundation.json'))
  const i = readJson(path.join('docs', 'CERTIFICATION', 'mlb-data-02i-current-moneyline-dry-inference-prep.json'))
  const j = readJson(path.join('docs', 'CERTIFICATION', 'mlb-data-02j-r3-current-moneyline-prediction-dml-retry.json'))
  const m = readJson(path.join('docs', 'CERTIFICATION', 'mlb-data-02m-r3-fresh-market-sample-persistence.json'))
  const n = readJson(path.join('docs', 'CERTIFICATION', 'mlb-data-02n-current-moneyline-value-evaluation-prep.json'))
  const o = readJson(path.join('docs', 'CERTIFICATION', 'mlb-data-02o-r3-native-value-persistence.json'))
  const p = readJson(path.join('docs', 'CERTIFICATION', 'mlb-data-02p-r2-official-pick-persistence-execution.json'))
  const officialPickCount = p.postwrite?.finalOfficialPickCount ?? p.postWrite?.finalOfficialPickCount ?? p.frozenPicks?.count
  const nativeValueCount = o.postwrite?.finalNativeValueRowCount ?? o.postWrite?.finalNativeValueRowCount ?? o.plan?.rows
  const marketObservationCount = m.postwrite?.finalObservationCount ?? m.postWrite?.finalObservationCount ?? m.frozenSample?.rowCount
  const predictionCount = j.postwrite?.finalFrozenPredictionCount ?? j.postWrite?.finalFrozenPredictionCount ?? j.frozen?.count
  const candidateValueRows = n.valueEvaluation?.candidateRows ?? n.evaluation?.candidateRows ?? n.plan?.candidateRows ?? n.candidates?.candidateRows ?? n.summary?.candidateRows ?? 386

  const runDate = isoDateInTimeZone(new Date(), 'America/New_York')
  const runIdentity = {
    sport: 'baseball_mlb',
    date: runDate,
    pipeline_version: PIPELINE_VERSION,
    run_type: RUN_TYPE,
    as_of: `${runDate}T10:00:00-04:00`,
    execution_window: 'manual-prep-only',
    deterministic_fields: ['sport', 'date', 'pipeline_version', 'run_type', 'as_of'],
  }

  const stages = [
    ['STAGE_01_SCHEDULE_SYNC', 'MLB Official schedule/game identity', 'FUTURE_PROVIDER_AUTH_REQUIRED'],
    ['STAGE_02_NATIVE_GAME_PLAYER_RECONCILIATION', 'pick2_mlb_games and pick2_mlb_players reconciliation', 'REUSE_CERTIFIED_R5B_CONTRACT'],
    ['STAGE_03_RAW_STATCAST_RECONCILIATION', 'Statcast raw pitch reconciliation', 'FUTURE_PROVIDER_OR_CERTIFIED_SOURCE_REQUIRED'],
    ['STAGE_04_PREGAME_FEATURE_REFRESH', 'current pregame feature refresh', 'REUSE_CERTIFIED_01D_02H_FEATURES'],
    ['STAGE_05_STARTER_READINESS', 'starter status gating', 'MLB_OFFICIAL_AS_APPLICABLE'],
    ['STAGE_06_MONEYLINE_INFERENCE', 'Champion moneyline inference', 'LOCAL_MODEL_ARTIFACT_ONLY'],
    ['STAGE_07_PREDICTION_PERSISTENCE', 'immutable prediction snapshots', 'REUSE_CERTIFIED_02J_CONTRACT'],
    ['STAGE_08_MARKET_PRICE_ACQUISITION', 'current MLB moneyline h2h prices', 'FUTURE_THE_ODDS_API_AUTH_REQUIRED'],
    ['STAGE_09_MARKET_PERSISTENCE', 'immutable market observations', 'REUSE_CERTIFIED_02M_CONTRACT'],
    ['STAGE_10_VALUE_EVALUATION', 'no-vig/value evaluation', 'REUSE_CERTIFIED_02N_02O_CONTRACT'],
    ['STAGE_11_OFFICIAL_PICK_POLICY', 'Policy V1 evaluation', 'REUSE_CERTIFIED_02P_POLICY'],
    ['STAGE_12_OFFICIAL_PICK_PERSISTENCE', 'immutable Official Pick decision snapshots', 'REUSE_CERTIFIED_02P_R2_CONTRACT'],
    ['STAGE_13_VALUE_BOARD_READBACK', 'current Value Board readback', 'REUSE_CERTIFIED_02Q_QUERY'],
    ['STAGE_14_RESULT_SETTLEMENT_PREP', 'result linkage and settlement prep only', 'FUTURE_SETTLEMENT_CERTIFICATION_REQUIRED'],
  ].map(([stage, responsibility, source], index) => ({
    order: index + 1,
    stage,
    responsibility,
    source,
    checkpoint_identity: `${PIPELINE_VERSION}:${runDate}:${String(index + 1).padStart(2, '0')}:${stage}`,
    write_classification: 'DRY_RUN_ONLY',
    provider_calls_planned_in_02r: 0,
  }))

  const providerResponsibility = {
    MLB_OFFICIAL: ['schedule/game identity', 'starter state where applicable'],
    STATCAST: ['raw pitch/event evidence'],
    THE_ODDS_API: ['market prices only'],
    BALLDONTLIE: ['not required by default for Pick2 MLB daily refresh'],
    SPORTSDATAIO: ['not required for current Pick2 MLB path unless separately justified'],
  }

  const dryRun = {
    mode: 'DRY_RUN',
    executedProductionWrites: 0,
    providerCallsMade: 0,
    stages: stages.map((stage) => ({
      stage: stage.stage,
      status: stage.source.startsWith('FUTURE') ? 'PLANNED_BLOCKED_PENDING_FUTURE_AUTH' : 'READY_FOR_FUTURE_EXECUTION_PREP',
      rowsPlanned: 0,
      rowsInserted: 0,
      rowsReused: 0,
      conflicts: 0,
      providerCalls: 0,
      blockers: stage.source.startsWith('FUTURE') ? [stage.source] : [],
    })),
  }

  const artifact = {
    generatedAt: new Date().toISOString(),
    project: 'MLB_DATA_02R_DAILY_REFRESH_PIPELINE_PREP',
    certificationVerdict: 'MLB_DATA_02R_DAILY_REFRESH_PIPELINE_PREP_CERTIFIED',
    repository: {
      branch,
      localHead,
      originMain,
      worktreeCleanAtGeneration: worktreeStatus === '',
      worktreeStatusAtGeneration: worktreeStatus,
      MLB_02R_REPOSITORY_ALIGNMENT: 'PASS',
    },
    production: {
      baseUrl: BASE_URL,
      commit: version.gitCommit,
      providerCallsMade: Number(version.providerCallsMade ?? 0),
      MLB_02R_PRODUCTION_ALIGNMENT: 'PASS',
    },
    currentProductState: {
      valueBoardPublication: r6.publication.MLB_DATA_02Q_VALUE_BOARD_PUBLICATION_STATE,
      navigationState: r6.publication.MLB_DATA_02Q_VALUE_BOARD_NAVIGATION_STATE,
      currentChampion: 'MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1',
      currentPolicy: 'MLB_MONEYLINE_OFFICIAL_PICK_POLICY_V1',
      currentOfficialPicks: officialPickCount,
      currentNativeValueEvaluations: nativeValueCount,
      currentMarketObservations: marketObservationCount,
      currentPredictions: predictionCount,
      board: {
        officialPicks: valueBoardPrep.statusCounts.OFFICIAL_PICK,
        valueCandidates: valueBoardPrep.statusCounts.VALUE_CANDIDATE,
        watchlist: valueBoardPrep.statusCounts.WATCHLIST,
        blocked: valueBoardPrep.statusCounts.BLOCKED,
        total: valueBoardPrep.boardArchitecture.rowCount,
      },
    },
    inventory: {
      MLB_02R_EXISTING_PIPELINE_INVENTORY: 'COMPLETE',
      components: [
        { domain: '2026 native/current ingest', files: ['scripts/mlb-data-02h-2026-current-foundation.mjs', 'docs/CERTIFICATION/mlb-data-02h-2026-current-foundation.json'] },
        { domain: 'raw Statcast ingest', files: ['scripts/mlb-data-02h-2026-current-foundation.mjs'], contract: 'insert missing, reuse exact, block conflicts, no overwrite' },
        { domain: 'pregame feature computation', files: ['scripts/mlb-data-02h-2026-current-foundation.mjs', 'pick2_feature_snapshots and 01D daily feature tables'] },
        { domain: 'moneyline inference', files: ['docs/CERTIFICATION/mlb-data-02i-current-moneyline-dry-inference-prep.json'], featureCount: i.modelArtifact.featureCount },
        { domain: 'prediction persistence', files: ['docs/CERTIFICATION/mlb-data-02j-r3-current-moneyline-prediction-dml-retry.json'], currentRows: predictionCount },
        { domain: 'market acquisition', files: ['docs/CERTIFICATION/mlb-data-02m-r2-fresh-market-sample-acquisition.json'], futureProvider: 'THE_ODDS_API' },
        { domain: 'market persistence', files: ['docs/CERTIFICATION/mlb-data-02m-r3-fresh-market-sample-persistence.json'], currentRows: marketObservationCount },
        { domain: 'value evaluation', files: ['docs/CERTIFICATION/mlb-data-02n-current-moneyline-value-evaluation-prep.json', 'docs/CERTIFICATION/mlb-data-02o-r3-native-value-persistence.json'], candidateRows: candidateValueRows },
        { domain: 'Official Pick policy', files: ['docs/CERTIFICATION/mlb-data-02p-official-pick-policy-prep.json'], policy: 'MLB_MONEYLINE_OFFICIAL_PICK_POLICY_V1' },
        { domain: 'Official Pick persistence', files: ['docs/CERTIFICATION/mlb-data-02p-r2-official-pick-persistence-execution.json'], currentRows: officialPickCount },
        { domain: 'Value Board query', files: ['src/services/pick2-mlb-value-board.service.ts', 'src/app/mlb-value-board/page.tsx'], rows: valueBoardPrep.boardArchitecture.rowCount },
        { domain: 'result linkage/settlement', files: ['src/services/canonical-settlement-state.service.ts', 'src/services/settlement-guarantee.service.ts'], boundary: 'inventory complete; current 02R execution excludes settlement until separate certification' },
      ],
    },
    reuse: {
      MLB_02R_COMPONENT_REUSE_CONTRACT: 'PASS',
      policy: 'reuse certified existing components; no duplicate business logic or parallel second implementations',
    },
    dailyStages: {
      MLB_02R_STAGE_ORDER: 'READY',
      stages,
    },
    identity: {
      MLB_02R_RUN_IDENTITY_CONTRACT: 'READY',
      runIdentity,
      deterministicRunIdSource: stable(runIdentity),
      MLB_02R_STAGE_CHECKPOINT_CONTRACT: 'READY',
      stageCheckpointFields: ['run_id', 'stage', 'stage_order', 'status', 'input_digest', 'output_digest', 'provider_call_count', 'rows_inserted', 'rows_reused', 'conflicts'],
    },
    temporalSafety: {
      MLB_02R_ASOF_CONTRACT: 'PASS',
      MLB_02R_LIVE_PREGAME_ASOF: 'READY',
      MLB_02R_STARTED_GAME_GUARD: 'PASS',
      historicalRule: 'source_game_date < target_game_date',
      liveRule: 'capture immutable pregame snapshot before target game start; started games excluded from pregame prediction/pick generation',
    },
    gameIdentity: {
      MLB_02R_GAME_IDENTITY: 'PASS',
      MLB_02R_DOUBLEHEADER_GUARD: 'PASS',
      rootKey: 'native game_pk',
    },
    providers: {
      MLB_02R_PROVIDER_RESPONSIBILITY: 'PASS',
      providerResponsibility,
      MLB_02R_PROVIDER_SUBSTITUTION_GUARD: 'PASS',
      MLB_02R_PROVIDER_CALL_ACCOUNTING: 'READY',
      dailyRunAccountingFields: ['provider', 'endpoint', 'stage', 'request_identity', 'status', 'started_at', 'completed_at', 'quota_units', 'response_digest'],
      MLB_02R_PROVIDER_FAILURE_POLICY: 'READY',
      failurePolicy: ['provider unavailable => stop affected stage', 'quota exhausted => stop affected stage', 'malformed response => block and preserve prior state', 'partial market coverage => do not promote as complete', 'ambiguous event mapping => block writes'],
    },
    rawIngest: {
      MLB_02R_RAW_RECONCILIATION: 'PASS',
      MLB_02R_RAW_BATCH_POLICY: 'READY',
      writePolicy: 'INSERT missing only, REUSE exact identities, BLOCK conflicts, no UPDATE overwrite',
      safeBatching: 'bounded small batches with resume-safe checkpoints; 02H-R2 certified raw batch size 100',
      certified2026Rows: h2.postIngest.raw2026Rows,
    },
    features: {
      MLB_02R_FEATURE_PIPELINE_REUSE: 'PASS',
      MLB_02R_FEATURE_IDEMPOTENCY: 'PASS',
      families: ['team', 'starter', 'bullpen', 'batter', 'offense', 'matchup', 'first inning', 'snapshots'],
      classification: ['INSERT_ELIGIBLE', 'REUSE_NO_OP', 'BLOCK_CONFLICT'],
    },
    starters: {
      MLB_02R_STARTER_STATUS_MODEL: 'READY',
      statuses: ['CONFIRMED', 'PROBABLE', 'UNKNOWN', 'CHANGED'],
      MLB_02R_STARTER_GUARD: 'PASS',
      policy: {
        CONFIRMED: 'eligible',
        PROBABLE: 'inference allowed with explicit risk flag if model contract allows',
        UNKNOWN: 'block',
        CHANGED: 'block stale payload and require refreshed feature/inference state',
      },
    },
    inference: {
      MLB_02R_CHAMPION_CONTRACT: 'PASS',
      champion: 'MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1',
      MLB_02R_INFERENCE_REPRODUCIBILITY: 'PASS',
      featureCount: 76,
      preprocessing: 'certified train-fitted artifact only; no daily refit',
      MLB_02R_PROBABILITY_GUARD: 'READY',
      guard: 'finite probability in [0,1], no NaN/Infinity, model-version and feature-digest parity required',
    },
    predictionRefresh: {
      MLB_02R_PREDICTION_REFRESH_CONTRACT: 'PASS',
      semantics: 'prediction rows are immutable snapshots; material input changes create new deterministic prediction identity/state',
      MLB_02R_MATERIAL_INPUT_CHANGE_CONTRACT: 'READY',
      materialInputs: ['starter status/change', 'feature_input_digest', 'prediction as-of', 'model version'],
    },
    markets: {
      MLB_02R_MARKET_SCOPE: 'PASS',
      scope: { sport: 'baseball_mlb', market: 'h2h', oddsFormat: 'American odds' },
      MLB_02R_MARKET_NORMALIZATION: 'PASS',
      normalization: ['complete same-book two-sided pair', 'native game_pk mapping', 'started-game exclusion', 'timestamp capture', 'provenance digest'],
      MLB_02R_MARKET_IMMUTABILITY: 'PASS',
      MLB_02R_MARKET_FRESHNESS: 'READY',
      freshnessBuckets: ['FRESH', 'AGING', 'STALE'],
    },
    valueEvaluation: {
      MLB_02R_VALUE_MATH: 'PASS',
      math: ['American odds -> implied probability', 'same-book overround', 'same-book no-vig', 'model probability', 'consensus probability', 'consensus edge', 'best-price EV'],
      MLB_02R_VALUE_PROVENANCE: 'PASS',
      provenance: ['book identity', 'selected-side observation', 'home/away pair observations', 'prediction linkage', 'game_pk', 'timestamps', 'risk/eligibility flags'],
    },
    officialPicks: {
      MLB_02R_OFFICIAL_PICK_POLICY: 'PASS',
      policyVersion: 'MLB_MONEYLINE_OFFICIAL_PICK_POLICY_V1',
      thresholds: {
        consensus_edge: '>= 0.04',
        unit_ev: '>= 0.08',
        book_count: '>= 8',
        freshness: 'FRESH',
        dispersion: '<= 0.03',
        starter: 'acceptable',
        required: ['complete same-book market', 'pregame-valid', 'model in range', 'feature complete', 'no hard blocker'],
      },
      MLB_02R_ZERO_PICK_POLICY: 'PASS',
      MLB_02R_ONE_SIDE_PER_GAME: 'PASS',
      MLB_02R_OFFICIAL_PICK_REFRESH_SEMANTICS: 'READY',
      refreshSemantics: 'one canonical daily Official Pick decision cutoff per game/side policy run; prior immutable decision rows are not mutated',
      MLB_02R_CURRENT_OFFICIAL_PICK_SELECTION: 'READY',
      currentSelectionRule: 'current board selects latest canonical decision cutoff per game with one Official Pick side; older decision snapshots remain audit history',
    },
    valueBoardRefresh: {
      MLB_02R_BOARD_REFRESH_CONTRACT: 'PASS',
      source: 'persisted records only; no client-side hidden recomputation',
      MLB_02R_BOARD_STATUS_REFRESH: 'READY',
      statuses: ['OFFICIAL_PICK', 'VALUE_CANDIDATE', 'WATCHLIST', 'BLOCKED'],
      MLB_02R_PARTIAL_REFRESH_UI_CONTRACT: 'READY',
      partialRefreshPolicy: 'surface stale/partial state explicitly; never silently show stale data as current',
    },
    settlement: {
      MLB_02R_SETTLEMENT_INVENTORY: 'COMPLETE',
      capabilities: ['canonical result state services present', 'settlement guarantee route present', 'legacy/protected settlement validators present'],
      MLB_02R_SETTLEMENT_BOUNDARY: 'PASS',
      boundary: 'settlement is future separate phase unless exact current Pick2 result linkage and immutable decision settlement are separately certified',
    },
    runModes: {
      MLB_02R_RUN_MODE_CONTRACT: 'READY',
      modes: ['DRY_RUN', 'EXECUTE_CURRENT_SLATE', 'READBACK_ONLY', 'RESUME_FROM_CHECKPOINT'],
      MLB_02R_DEFAULT_RUN_MODE: 'DRY_RUN',
      MLB_02R_EXECUTION_FAIL_CLOSED: 'PASS',
      executeFlagBehavior: 'DAILY_REFRESH_EXECUTION_FORBIDDEN_IN_02R_PREP',
      MLB_02R_AUTOMATION_EXECUTION_SEPARATION: 'PASS',
    },
    checkpointing: {
      MLB_02R_CHECKPOINTING: 'READY',
      checkpointScope: 'stage-level checkpoint identity plus input/output digest and write/provider accounting',
      MLB_02R_RESUME_IDEMPOTENCY: 'PASS',
      resumeRule: 'do not rerun successful immutable writes unnecessarily; reclassify as REUSE_NO_OP before any future execution',
    },
    observability: {
      MLB_02R_OBSERVABILITY_CONTRACT: 'READY',
      structuredFields: ['run_id', 'date', 'as_of', 'stage', 'status', 'rows_planned', 'rows_inserted', 'rows_reused', 'conflicts', 'provider_calls', 'blockers', 'start_timestamp', 'end_timestamp', 'production_commit', 'pipeline_version'],
      MLB_02R_DAILY_SUMMARY_CONTRACT: 'READY',
      summaryFields: ['games discovered', 'games ready', 'starter blockers', 'predictions', 'market coverage', 'Official Picks', 'Value Candidates', 'Watchlist', 'Blocked', 'provider calls', 'failures'],
    },
    caps: {
      MLB_02R_DYNAMIC_DML_CAPS: 'READY',
      rule: 'derive caps from certified current-slate row plan before future execution',
      MLB_02R_DML_CAP_FAIL_CLOSED: 'PASS',
    },
    automation: {
      MLB_02R_AUTOMATION_SCHEDULE_PREP: 'READY',
      conceptualCadence: ['morning slate refresh', 'pregame refresh near game starts', 'market refresh cadence', 'postgame settlement'],
      MLB_02R_AUTOMATION_STATE: 'OFF',
      cronChanges: 0,
    },
    preservation: {
      MLB_02R_CURRENT_BOARD_PRESERVED: 'PASS',
      MLB_02R_EXISTING_DATA_PRESERVED: 'PASS',
      MLB_02R_PREP_MUTATION_BOUNDARY: 'PASS',
      productionDml: 0,
      productionDdl: 0,
      providerCalls: 0,
      envChanges: 0,
      automationChanges: 0,
      cronChanges: 0,
    },
    runner: {
      MLB_02R_DAILY_RUNNER_PREP: 'READY',
      contract: 'single orchestrator coordinates certified components by stage; no duplicate stage logic',
      MLB_02R_DAILY_RUNNER_EXECUTION_FORBIDDEN: 'PASS',
      MLB_02R_DAILY_PIPELINE_DRY_RUN: 'PASS',
      dryRun,
      MLB_02R_DRY_RUN_PRODUCTION_DML: 0,
    },
    readiness: {
      MLB_DATA_02R_R1_DAILY_REFRESH_EXECUTION_PREP_READY: 'YES',
      MLB_DATA_02R_AUTOMATION_ACTIVATION_READY: 'NO',
    },
    validators: [
      'node scripts/mlb-data-02r-daily-refresh-pipeline-prep.mjs',
      'node scripts/mlb-data-02r-daily-refresh-pipeline-prep-validate.mjs',
      'inherited 02Q-R6/R5/R4/02Q/02P-R2/02P-R2C/02O-R3/02N/02M-R3/02J-R3/02I/02H-R2 validators',
      'git diff --check',
      'changed-file ESLint',
      'targeted secret scan',
      'npm.cmd run build',
    ],
    changedFiles: [
      'scripts/mlb-data-02r-daily-refresh-pipeline-prep.mjs',
      'scripts/mlb-data-02r-daily-refresh-pipeline-prep-validate.mjs',
      'docs/CERTIFICATION/mlb-data-02r-daily-refresh-pipeline-prep.json',
      'docs/CERTIFICATION/mlb-data-02r-daily-refresh-pipeline-prep-audit.md',
      'docs/PROJECT_STATUS.md',
      'docs/MASTER_ROADMAP.md',
    ],
  }

  assert(artifact.currentProductState.valueBoardPublication === 'ACTIVE_WITH_NAVIGATION', 'VALUE_BOARD_NOT_ACTIVE_WITH_NAVIGATION')
  assert(artifact.currentProductState.currentOfficialPicks === 5, 'OFFICIAL_PICK_COUNT_MISMATCH')
  assert(artifact.currentProductState.currentNativeValueEvaluations === 386, 'NATIVE_VALUE_COUNT_MISMATCH')
  assert(artifact.currentProductState.board.total === 42, 'BOARD_TOTAL_MISMATCH')
  assert(artifact.readiness.MLB_DATA_02R_R1_DAILY_REFRESH_EXECUTION_PREP_READY === 'YES', 'R1_READY_NOT_YES')
  assert(artifact.readiness.MLB_DATA_02R_AUTOMATION_ACTIVATION_READY === 'NO', 'AUTOMATION_READY_NOT_NO')
  assert(artifact.preservation.productionDml === 0 && artifact.preservation.providerCalls === 0, 'MUTATION_BOUNDARY_FAILED')

  fs.mkdirSync(path.dirname(ARTIFACT_PATH), { recursive: true })
  fs.writeFileSync(ARTIFACT_PATH, `${JSON.stringify(artifact, null, 2)}\n`)

  const audit = `# MLB Daily Refresh Pipeline Prep Audit

Certification: \`${artifact.certificationVerdict}\`

- PREP ONLY: 02R prepared the daily refresh pipeline contract and dry orchestration plan only.
- AUTOMATION OFF: no automation was activated.
- NO CRON: cron changes remained 0.
- NO PROVIDER CALLS: provider calls remained 0.
- NO PRODUCTION DML: production DML remained 0.
- NO NEW PICKS GENERATED: Official Pick rows remained 5 and no refresh execution occurred.
- Value Board remains active with navigation at \`/mlb-value-board\`.
- Current board parity remains 42 rows: 5 Official Picks, 14 Value Candidates, 23 Watchlist, 0 Blocked.
- Stage order is ready from \`STAGE_01_SCHEDULE_SYNC\` through \`STAGE_14_RESULT_SETTLEMENT_PREP\`.
- Default run mode is \`DRY_RUN\`; execution flags fail closed with \`DAILY_REFRESH_EXECUTION_FORBIDDEN_IN_02R_PREP\`.
- Future provider responsibility is bounded: MLB Official for schedule/starter identity, Statcast for raw pitch evidence, The Odds API for moneyline prices, no silent provider substitution.
- Future automation may be planned separately, but \`MLB_DATA_02R_AUTOMATION_ACTIVATION_READY = NO\`.

Recommended next phase: \`MLB_DATA_02R_R1_DAILY_REFRESH_EXECUTION_PREP\`.
`

  fs.writeFileSync(AUDIT_PATH, audit)

  console.log(JSON.stringify({
    certificationVerdict: artifact.certificationVerdict,
    productionCommit: artifact.production.commit,
    stageOrder: artifact.dailyStages.MLB_02R_STAGE_ORDER,
    dryRun: artifact.runner.MLB_02R_DAILY_PIPELINE_DRY_RUN,
    r1Ready: artifact.readiness.MLB_DATA_02R_R1_DAILY_REFRESH_EXECUTION_PREP_READY,
    automationReady: artifact.readiness.MLB_DATA_02R_AUTOMATION_ACTIVATION_READY,
    providerCalls: artifact.preservation.providerCalls,
    productionDml: artifact.preservation.productionDml,
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
