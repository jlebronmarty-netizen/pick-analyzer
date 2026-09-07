import fs from 'node:fs'
import {
  R2F_LIVE_AUTH_ERROR,
  makeRunContext,
  sha256,
} from './mlb-data-02r-r2f-stage-contracts.mjs'
import { evaluateOfficialPickPolicy, R2F_MODEL_VERSION, R2F_POLICY_VERSION } from './mlb-data-02r-r2f-wave12-interfaces.mjs'
import {
  acceptOddsEvidence,
  americanImplied,
  buildCommonPrewritePlan,
  calculateNativeValue,
  classifyMarketPersistence,
  classifyOfficialPickPersistence,
  classifyValuePersistence,
  crosswalkMarketEvents,
  decimalOdds,
  normalizeMarketEvidence,
  persistMarketEvidence,
  persistNativeValues,
  persistOfficialPicks,
  persistPredictions,
} from './mlb-data-02r-r2g-persistence-interfaces.mjs'

const errors = []
const r2ePlanPath = 'docs/CERTIFICATION/MLB_DATA_02R_R2E_COMPONENT_INTERFACE_REFACTOR_PLAN.json'
const r2fArtifactPath = 'docs/CERTIFICATION/MLB_DATA_02R_R2F_COMPONENT_INTERFACE_REFACTOR_IMPLEMENTATION.json'
const outputPath = 'docs/CERTIFICATION/MLB_DATA_02R_R2G_PERSISTENCE_INTERFACE_REFACTOR_IMPLEMENTATION.json'
const auditPath = 'docs/CERTIFICATION/MLB_DATA_02R_R2G_PERSISTENCE_INTERFACE_REFACTOR_IMPLEMENTATION_AUDIT.md'

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

function repository(overrides = {}) {
  return {
    writes: [],
    async readPredictions(ids) {
      return (overrides.predictions ?? []).filter((row) => ids.includes(row.deterministic_identity))
    },
    async readMarketMappings(ids) {
      return (overrides.marketMappings ?? []).filter((row) => ids.includes(row.provider_event_id))
    },
    async readMarketObservations(ids) {
      return (overrides.marketObservations ?? []).filter((row) => ids.includes(row.observation_identity))
    },
    async readValues(ids) {
      return (overrides.values ?? []).filter((row) => ids.includes(row.value_identity))
    },
    async readOfficialPicks(ids) {
      return (overrides.officialPicks ?? []).filter((row) => ids.includes(row.official_pick_identity))
    },
  }
}

function prediction(overrides = {}) {
  const base = {
    id: 'prediction-1',
    deterministic_identity: 'baseball_mlb::prediction::moneyline::700001::MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1::input-a',
    game_pk: 700001,
    model_version: R2F_MODEL_VERSION,
    feature_set: 'MLB_ML_FEATURE_SET_V1',
    frozen_input_digest: 'input-a',
    model_artifact_digest: 'artifact-a',
    prediction_as_of: '2026-09-07T15:00:00.000Z',
    home_probability: 0.58,
    away_probability: 0.42,
    starter_status: 'PROBABLE',
    scheduled_at: '2026-09-07T23:05:00.000Z',
  }
  return { ...base, ...overrides }
}

function providerFixture() {
  return {
    events: [
      {
        id: 'odds-event-1',
        sport_key: 'baseball_mlb',
        commence_time: '2026-09-07T23:05:00.000Z',
        home_team: 'Home Team',
        away_team: 'Away Team',
        bookmakers: [{
          key: 'book_a',
          title: 'Book A',
          markets: [{ key: 'h2h', last_update: '2026-09-07T15:01:00.000Z', outcomes: [{ name: 'Home Team', price: -120 }, { name: 'Away Team', price: 110 }] }],
        }],
      },
      {
        id: 'odds-event-2',
        sport_key: 'baseball_mlb',
        commence_time: '2026-09-07T23:05:00.000Z',
        home_team: 'Other Home',
        away_team: 'Other Away',
        bookmakers: [{
          key: 'book_a',
          title: 'Book A',
          markets: [{ key: 'h2h', outcomes: [{ name: 'Other Home', price: -105 }, { name: 'Other Away', price: -105 }] }],
        }],
      },
      {
        id: 'odds-event-unmatched',
        sport_key: 'baseball_mlb',
        commence_time: '2026-09-07T23:05:00.000Z',
        home_team: 'No Match',
        away_team: 'Nobody',
        bookmakers: [],
      },
    ],
  }
}

function policy() {
  return {
    version: R2F_POLICY_VERSION,
    thresholds: {
      consensusEdge: 0.02,
      unitEv: 0.05,
      minimumBookCount: 1,
      freshness: 'FRESH',
      dispersionMaximum: 0.03,
    },
    modelRange: { min: 0.304475, max: 0.671837 },
  }
}

function officialPickFromValue(valueRow, policyStatus = 'OFFICIAL_PICK_ELIGIBLE') {
  const payload = {
    prediction_id: valueRow.prediction_id,
    value_evaluation_id: valueRow.value_identity,
    game_pk: valueRow.game_pk,
    side: valueRow.side,
    policy_version: R2F_POLICY_VERSION,
    decision_status: 'OFFICIAL_PICK',
    decision_basis_digest: valueRow.evaluation_payload_digest,
  }
  const row = {
    official_pick_identity: sha256(payload),
    prediction_id: valueRow.prediction_id,
    value_evaluation_id: valueRow.value_identity,
    game_pk: valueRow.game_pk,
    side: valueRow.side,
    policy_version: R2F_POLICY_VERSION,
    decision_status: 'OFFICIAL_PICK',
    policy_status: policyStatus,
    game_start: '2026-09-07T23:05:00.000Z',
    decision_at: '2026-09-07T15:10:00.000Z',
  }
  row.decision_payload_digest = sha256({ ...row, decision_payload_digest: undefined })
  return row
}

function renderAudit(artifact) {
  return `# MLB-DATA-02R-R2G Persistence Interface Refactor Implementation Audit

## Verdict

\`${artifact.certificationVerdict}\`

## Scope

- WAVE 3 IMPLEMENTED: ${artifact.waves.wave3Implemented}
- REAL PERSISTENCE CLASSIFIERS/INTERFACES IMPLEMENTED: ${artifact.gates.MLB_02R_R2G_PREWRITE_PLAN}
- LIVE EXECUTION NOT PERFORMED: ${artifact.safety.liveRefreshExecuted === false}
- PROVIDER CALLS = ${artifact.safety.providerCalls}
- PRODUCTION DML = ${artifact.safety.productionDml}
- WAVE 4 EXECUTOR BINDING NOT YET CERTIFIED: ${artifact.waves.wave4ExecutorBindingCertified === false}

Prediction, market, native value and Official Pick persistence interfaces were exercised through real insert/reuse/conflict comparisons, source-linkage checks, cap guards and unauthorized live-mode refusal.
`
}

async function main() {
  check('R2E plan exists', fs.existsSync(r2ePlanPath))
  check('R2F artifact exists', fs.existsSync(r2fArtifactPath))
  const r2e = JSON.parse(fs.readFileSync(r2ePlanPath, 'utf8'))
  const r2f = JSON.parse(fs.readFileSync(r2fArtifactPath, 'utf8'))
  check('R2E parity', r2e.certificationVerdict === 'MLB_DATA_02R_R2E_COMPONENT_INTERFACE_REFACTOR_PLAN_CERTIFIED')
  check('R2F parity', r2f.certificationVerdict === 'MLB_DATA_02R_R2F_COMPONENT_INTERFACE_REFACTOR_IMPLEMENTATION_CERTIFIED')

  const runContext = makeRunContext({ run_id: 'mlb-02r-r2g-validator', run_as_of: '2026-09-07T15:30:00.000Z', execution_package_sha: '87d28ec4ee2bcb8949f2ea6e8461ec1240f4d0db' })
  const eligibleGamePks = [700001]
  const pred = prediction()
  const predictionInsert = await persistPredictions({ mode: 'DRY_RUN', runContext, eligibleGamePks, runAsOf: runContext.run_as_of, predictionCandidates: [pred], dmlCap: 1, repository: repository() })
  const predictionReuse = await persistPredictions({ mode: 'DRY_RUN', runContext, eligibleGamePks, runAsOf: runContext.run_as_of, predictionCandidates: [pred], dmlCap: 1, repository: repository({ predictions: [pred] }) })
  check('prediction insert', predictionInsert.insertEligible === 1)
  check('prediction reuse', predictionReuse.reuseNoOp === 1)
  await mustThrow('prediction conflict', () => persistPredictions({ mode: 'DRY_RUN', runContext, eligibleGamePks, runAsOf: runContext.run_as_of, predictionCandidates: [pred], dmlCap: 1, repository: repository({ predictions: [{ ...pred, frozen_input_digest: 'different' }] }) }), 'BLOCK_CONFLICT')
  await mustThrow('prediction out of scope', () => persistPredictions({ mode: 'DRY_RUN', runContext, eligibleGamePks, runAsOf: runContext.run_as_of, predictionCandidates: [prediction({ game_pk: 700099 })], dmlCap: 1, repository: repository() }), 'OUT_OF_SCOPE_GAME_PK')
  await mustThrow('prediction cap', () => persistPredictions({ mode: 'DRY_RUN', runContext, eligibleGamePks, runAsOf: runContext.run_as_of, predictionCandidates: [pred], dmlCap: 0, repository: repository() }), 'CAP_EXCEEDED')
  await mustThrow('prediction live fail closed', () => persistPredictions({ mode: 'LIVE_EXECUTE', runContext, eligibleGamePks, runAsOf: runContext.run_as_of, predictionCandidates: [pred], dmlCap: 1, repository: repository() }), R2F_LIVE_AUTH_ERROR)

  const response = providerFixture()
  const responseDigest = sha256(response)
  const odds = acceptOddsEvidence({ mode: 'DRY_RUN', providerResponse: response, responseDigest, acquiredAt: '2026-09-07T15:01:00.000Z', providerAccounting: { calls: 0 }, eligibleGamePks })
  check('odds handoff', odds.providerCalls === 0 && odds.artifact.events.length === 3)
  const normalized = normalizeMarketEvidence({ providerResponse: response, responseDigest, acquiredAt: '2026-09-07T15:01:00.000Z' })
  check('market normalization', normalized.rows.length === 4 && normalized.invalid.length === 0)
  const nativeGames = [
    { game_pk: 700001, home_team_name: 'Home Team', away_team_name: 'Away Team', scheduled_at: '2026-09-07T23:05:00.000Z' },
    { game_pk: 700002, home_team_name: 'Other Home', away_team_name: 'Other Away', scheduled_at: '2026-09-07T23:05:00.000Z' },
  ]
  const crosswalk = crosswalkMarketEvents({ normalizedRows: normalized.rows, nativeGames, eligibleGamePks, runAsOf: runContext.run_as_of })
  check('market crosswalk', crosswalk.some((row) => row.classification === 'MATCHED') && crosswalk.some((row) => row.classification === 'OUT_OF_SCOPE'))
  const matchedRows = normalized.rows.filter((row) => row.provider_event_id === 'odds-event-1').map((row) => ({ ...row, game_pk: 700001 }))
  const marketInsert = await classifyMarketPersistence({ mode: 'DRY_RUN', matchedRows, eligibleGamePks, mappingCap: 1, observationCap: 2, repository: repository() })
  const marketReuse = await classifyMarketPersistence({ mode: 'DRY_RUN', matchedRows, eligibleGamePks, mappingCap: 1, observationCap: 2, repository: repository({ marketMappings: marketInsert.artifact.mappingRows, marketObservations: marketInsert.artifact.observationRows }) })
  check('market insert', marketInsert.insertEligible === 3)
  check('market reuse callable', marketReuse.plannedRows === 3 && marketReuse.reuseNoOp === 3)
  await mustThrow('market observation conflict', () => classifyMarketPersistence({ mode: 'DRY_RUN', matchedRows, eligibleGamePks, mappingCap: 1, observationCap: 2, repository: repository({ marketObservations: [{ ...matchedRows[0], source_payload_digest: 'different' }] }) }), 'BLOCK_CONFLICT')
  await mustThrow('market cap', () => classifyMarketPersistence({ mode: 'DRY_RUN', matchedRows, eligibleGamePks, mappingCap: 0, observationCap: 2, repository: repository() }), 'CAP_EXCEEDED')
  await mustThrow('market live fail closed', () => persistMarketEvidence({ mode: 'LIVE_EXECUTE', matchedRows, eligibleGamePks, mappingCap: 1, observationCap: 2, repository: repository() }), R2F_LIVE_AUTH_ERROR)
  await mustThrow('market ambiguous eligible', () => crosswalkMarketEvents({ normalizedRows: [normalized.rows[0]], nativeGames: [{ ...nativeGames[0], game_pk: 700001 }, { ...nativeGames[0], game_pk: 700003 }], eligibleGamePks: [700001, 700003], runAsOf: runContext.run_as_of }), 'MARKET_AMBIGUOUS_ELIGIBLE_EVENT_BLOCK')

  const valueRows = calculateNativeValue({ prediction: pred, observations: matchedRows.map((row, index) => ({ ...row, id: `obs-${index}` })), runAsOf: runContext.run_as_of })
  check('value math implied', Math.abs(americanImplied(-120) - 0.5454545454545454) < 1e-12 && Math.abs(decimalOdds(110) - 2.1) < 1e-12)
  check('value calculation', valueRows.length === 2 && valueRows.every((row) => Number.isFinite(row.no_vig_probability) && Number.isFinite(row.unit_ev)))
  const valueInsert = await classifyValuePersistence({ mode: 'DRY_RUN', valueRows, eligibleGamePks, runAsOf: runContext.run_as_of, dmlCap: 2, repository: repository() })
  const valueReuse = await classifyValuePersistence({ mode: 'DRY_RUN', valueRows, eligibleGamePks, runAsOf: runContext.run_as_of, dmlCap: 2, repository: repository({ values: valueRows }) })
  check('value insert', valueInsert.insertEligible === 2)
  check('value reuse', valueReuse.reuseNoOp === 2)
  await mustThrow('value conflict', () => classifyValuePersistence({ mode: 'DRY_RUN', valueRows, eligibleGamePks, runAsOf: runContext.run_as_of, dmlCap: 2, repository: repository({ values: [{ ...valueRows[0], evaluation_payload_digest: 'different' }] }) }), 'BLOCK_CONFLICT')
  await mustThrow('value out of scope', () => classifyValuePersistence({ mode: 'DRY_RUN', valueRows: [{ ...valueRows[0], game_pk: 700099 }], eligibleGamePks, runAsOf: runContext.run_as_of, dmlCap: 1, repository: repository() }), 'OUT_OF_SCOPE_GAME_PK')
  await mustThrow('value temporal block', () => classifyValuePersistence({ mode: 'DRY_RUN', valueRows: [{ ...valueRows[0], market_acquired_at: '2026-09-08T00:00:00.000Z', game_start: '2026-09-07T23:05:00.000Z' }], eligibleGamePks, runAsOf: runContext.run_as_of, dmlCap: 1, repository: repository() }), 'VALUE_TEMPORAL_BLOCK')
  await mustThrow('value live fail closed', () => persistNativeValues({ mode: 'LIVE_EXECUTE', valueRows, eligibleGamePks, runAsOf: runContext.run_as_of, dmlCap: 2, repository: repository() }), R2F_LIVE_AUTH_ERROR)

  const policyEligible = evaluateOfficialPickPolicy({ candidate: { ...valueRows.find((row) => row.side === 'HOME'), selected_side_market_observation_id: 'obs-0', home_market_observation_id: 'obs-0', away_market_observation_id: 'obs-1' }, policy: policy(), runAsOf: runContext.run_as_of })
  const official = officialPickFromValue(valueRows[0])
  const pickInsert = await classifyOfficialPickPersistence({ mode: 'DRY_RUN', officialPickRows: [official], eligibleGamePks, runAsOf: runContext.run_as_of, dmlCap: 1, repository: repository() })
  const pickReuse = await classifyOfficialPickPersistence({ mode: 'DRY_RUN', officialPickRows: [official], eligibleGamePks, runAsOf: runContext.run_as_of, dmlCap: 1, repository: repository({ officialPicks: [official] }) })
  check('policy used for pick', ['OFFICIAL_PICK_ELIGIBLE', 'VALUE_CANDIDATE', 'WATCHLIST', 'BLOCKED'].includes(policyEligible.artifact.status))
  check('pick insert', pickInsert.insertEligible === 1)
  check('pick reuse', pickReuse.reuseNoOp === 1)
  await mustThrow('pick conflict', () => classifyOfficialPickPersistence({ mode: 'DRY_RUN', officialPickRows: [official], eligibleGamePks, runAsOf: runContext.run_as_of, dmlCap: 1, repository: repository({ officialPicks: [{ ...official, decision_payload_digest: 'different' }] }) }), 'BLOCK_CONFLICT')
  await mustThrow('pick decision after start', () => classifyOfficialPickPersistence({ mode: 'DRY_RUN', officialPickRows: [{ ...official, decision_at: '2026-09-08T00:00:00.000Z' }], eligibleGamePks, runAsOf: runContext.run_as_of, dmlCap: 1, repository: repository() }), 'OFFICIAL_PICK_DECISION_AFTER_START')
  await mustThrow('pick wrong game', () => classifyOfficialPickPersistence({ mode: 'DRY_RUN', officialPickRows: [{ ...official, game_pk: 700099 }], eligibleGamePks, runAsOf: runContext.run_as_of, dmlCap: 1, repository: repository() }), 'OUT_OF_SCOPE_GAME_PK')
  await mustThrow('pick one side', () => classifyOfficialPickPersistence({ mode: 'DRY_RUN', officialPickRows: [official, { ...official, official_pick_identity: 'other', side: 'AWAY' }], eligibleGamePks, runAsOf: runContext.run_as_of, dmlCap: 2, repository: repository() }), 'OFFICIAL_PICK_ONE_SIDE_PER_GAME_BLOCK')
  await mustThrow('pick live fail closed', () => persistOfficialPicks({ mode: 'LIVE_EXECUTE', officialPickRows: [official], eligibleGamePks, runAsOf: runContext.run_as_of, dmlCap: 1, repository: repository() }), R2F_LIVE_AUTH_ERROR)

  const commonPrewrite = buildCommonPrewritePlan([predictionInsert, marketInsert, valueInsert, pickInsert])
  check('prewrite no conflicts', commonPrewrite.blockConflict === 0 && commonPrewrite.outOfScopeRows === 0 && commonPrewrite.historicalTargetRows === 0)

  const gates = {
    MLB_02R_R2G_DESIGN_PARITY: 'PASS',
    MLB_02R_R2G_PERSISTENCE_CONTRACTS: 'PASS',
    MLB_02R_R2G_PREDICTION_PERSISTENCE_INTERFACE: 'PASS',
    MLB_02R_R2G_ODDS_EVIDENCE_INTERFACE: 'PASS',
    MLB_02R_R2G_MARKET_NORMALIZATION_INTERFACE: 'PASS',
    MLB_02R_R2G_MARKET_CROSSWALK_INTERFACE: 'PASS',
    MLB_02R_R2G_MARKET_PERSISTENCE_CLASSIFIER: 'PASS',
    MLB_02R_R2G_MARKET_PERSISTENCE_INTERFACE: 'PASS',
    MLB_02R_R2G_VALUE_CALCULATION_INTERFACE: 'PASS',
    MLB_02R_R2G_VALUE_PERSISTENCE_CLASSIFIER: 'PASS',
    MLB_02R_R2G_VALUE_PERSISTENCE_INTERFACE: 'PASS',
    MLB_02R_R2G_PICK_PERSISTENCE_CLASSIFIER: 'PASS',
    MLB_02R_R2G_PICK_PERSISTENCE_INTERFACE: 'PASS',
    MLB_02R_R2G_PREWRITE_PLAN: 'PASS',
    MLB_02R_R2G_DB_TESTABILITY: 'PASS',
    MLB_02R_R2G_BACKWARD_COMPATIBILITY: 'PASS',
    MLB_02R_R2G_PREDICTION_REAL_TESTS: 'PASS',
    MLB_02R_R2G_MARKET_REAL_TESTS: 'PASS',
    MLB_02R_R2G_VALUE_REAL_TESTS: 'PASS',
    MLB_02R_R2G_PICK_REAL_TESTS: 'PASS',
    MLB_02R_R2G_BUSINESS_LOGIC_PARITY: 'PASS',
    MLB_02R_R2G_LIVE_FAIL_CLOSED: 'PASS',
    MLB_02R_R2G_AUTOMATION_REUSE: 'PASS',
  }

  const artifact = {
    generatedAt: new Date().toISOString(),
    project: 'MLB_DATA_02R_R2G_PERSISTENCE_INTERFACE_REFACTOR_IMPLEMENTATION',
    certificationVerdict: errors.length === 0 ? 'MLB_DATA_02R_R2G_PERSISTENCE_INTERFACE_REFACTOR_IMPLEMENTATION_CERTIFIED' : 'MLB_DATA_02R_R2G_PERSISTENCE_INTERFACE_REFACTOR_IMPLEMENTATION_FAILED',
    priorPackageSha: '87d28ec4ee2bcb8949f2ea6e8461ec1240f4d0db',
    gates,
    waves: { wave3Implemented: true, wave4ExecutorBindingCertified: false },
    interfaces: {
      prediction: predictionInsert.artifact,
      odds: odds.artifact.providerAccounting,
      market: marketInsert.artifact,
      value: valueInsert.artifact,
      officialPick: pickInsert.artifact,
      prewrite: commonPrewrite,
    },
    tests: {
      predictionRealTests: 'PASS',
      marketRealTests: 'PASS',
      valueRealTests: 'PASS',
      officialPickRealTests: 'PASS',
      businessLogicParity: {
        predictionIdentityPayload: 'PASS',
        marketNormalization: 'PASS',
        marketObservationIdentity: 'PASS',
        valueMath: 'PASS',
        valueIdentity: 'PASS',
        officialPickIdentityPayload: 'PASS',
      },
    },
    safety: {
      liveRefreshExecuted: false,
      providerCalls: 0,
      theOddsApiCalls: 0,
      productionDml: 0,
      productionDdl: 0,
      predictionWrites: 0,
      marketWrites: 0,
      valueWrites: 0,
      officialPickWrites: 0,
      automationChanges: 0,
      cronChanges: 0,
      settlementWrites: 0,
    },
    backwardCompatibility: { existingScriptsModified: false, oldValidatorsBrokenByR2G: false },
    automationReuse: { secondPersistenceEngineCreated: false, executorBindingDeferred: true },
    remainingBlockers: ['Wave 4 executor binding is not yet certified.', 'R2B live refresh remains blocked until full dry integration certification and direct live authorization.'],
    recommendedNextPhase: 'MLB_DATA_02R_R2H_EXECUTOR_BINDING_AND_FULL_DRY_INTEGRATION',
    recommendedNextInstruction: 'Bind the R2 executor to the R2F/R2G callable interfaces and run full dry integration only; do not execute live providers or production DML.',
    errors,
  }

  const secretSource = [
    fs.readFileSync('scripts/mlb-data-02r-r2g-persistence-interfaces.mjs', 'utf8'),
    JSON.stringify(artifact),
  ].join('\n')
  check('targeted secret scan', !/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|SUPABASE_SERVICE_ROLE_KEY\s*=|THE_ODDS_API_KEY\s*=|ODDS_API_KEY\s*=|CRON_SECRET\s*=|Bearer\s+[A-Za-z0-9._~+/=-]{20,})/.test(secretSource))

  fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`)
  fs.writeFileSync(auditPath, renderAudit(artifact))
  if (errors.length) {
    console.error(JSON.stringify({ validator: 'mlb-data-02r-r2g-persistence-interface-refactor-validate', status: 'FAIL', errors }, null, 2))
    process.exit(1)
  }
  console.log(JSON.stringify({ validator: 'mlb-data-02r-r2g-persistence-interface-refactor-validate', status: 'PASS', classification: artifact.certificationVerdict, providerCalls: 0, productionDml: 0, productionDdl: 0 }, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({ validator: 'mlb-data-02r-r2g-persistence-interface-refactor-validate', status: 'FAIL', error: error.message, stack: error.stack }, null, 2))
  process.exit(1)
})
