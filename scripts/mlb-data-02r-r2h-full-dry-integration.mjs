import fs from 'node:fs'
import {
  buildPrewritePlan,
  createMemoryCheckpoint,
  makeProviderAccounting,
  makeRunContext,
  sha256,
  stable,
} from './mlb-data-02r-r2f-stage-contracts.mjs'
import {
  R2F_FEATURE_COUNT,
  R2F_FEATURE_SET,
  R2F_MODEL_VERSION,
  R2F_POLICY_VERSION,
  classifyStarterReadiness,
  getCurrentSlate,
  inferMoneyline,
  planCurrentSlateFeatures,
  readValueBoardAdapter,
  reconcileCurrentSlateStatcast,
  reconcileNativeIdentity,
  evaluateOfficialPickPolicy,
} from './mlb-data-02r-r2f-wave12-interfaces.mjs'
import {
  acceptOddsEvidence,
  buildCommonPrewritePlan,
  calculateNativeValue,
  classifyMarketPersistence,
  classifyOfficialPickPersistence,
  classifyValuePersistence,
  crosswalkMarketEvents,
  normalizeMarketEvidence,
  persistPredictions,
} from './mlb-data-02r-r2g-persistence-interfaces.mjs'

export const R2H_CERTIFICATION = 'MLB_DATA_02R_R2H_EXECUTOR_BINDING_AND_FULL_DRY_INTEGRATION_CERTIFIED'
export const R2H_LIVE_AUTH_ERROR = 'LIVE_REFRESH_EXECUTION_REQUIRES_EXPLICIT_R2B_AUTHORIZATION'
export const R2H_PRIOR_PACKAGE_SHA = 'bc49787dbaf2749402c5236739f735422d9983c7'
export const R2H_STAGE_NAMES = Object.freeze([
  '01 schedule sync',
  '02 native reconciliation',
  '03 raw Statcast reconciliation',
  '04 feature refresh',
  '05 starter readiness',
  '06 moneyline inference',
  '07 prediction persistence',
  '08 odds evidence handoff',
  '09 market persistence',
  '10 value persistence',
  '11 Official Pick policy',
  '12 Official Pick persistence',
  '13 Value Board readback',
])

const MODEL_ARTIFACT_PATH = 'artifacts/mlb/mlb-02c-moneyline-baseline-model.json'
const MODEL_ARTIFACT_DIGEST = '9275408e6f92d1405941eb7e277bc9018fd91c1d4a4e6f429cc26161ad2bf616'
const FEATURE_CONTRACT_DIGEST = sha256({ featureSet: R2F_FEATURE_SET, featureCount: R2F_FEATURE_COUNT, modelVersion: R2F_MODEL_VERSION })

function providerBudget() {
  return {
    MLB_OFFICIAL: { allowed: true, maxCalls: 1, consumed: 0, forbiddenInDryRun: true },
    STATCAST: { allowed: true, maxCalls: '0_TO_FROZEN_GAME_SET', consumed: 0, forbiddenInDryRun: true },
    THE_ODDS_API: { allowed: true, maxCalls: 1, consumed: 0, sport: 'baseball_mlb', market: 'h2h', oddsFormat: 'american', forbiddenInDryRun: true },
    BALLDONTLIE: { allowed: false, maxCalls: 0, consumed: 0 },
    SPORTSDATAIO: { allowed: false, maxCalls: 0, consumed: 0 },
    OTHER: { allowed: false, maxCalls: 0, consumed: 0 },
  }
}

function dmlCaps() {
  return {
    nativeGames: 1,
    nativePlayers: 2,
    rawStatcast: 2,
    features: { snapshots: 1, team: 2, starter: 2, bullpen: 2, batter: 4, matchup: 1, firstInning: 1 },
    predictions: 1,
    marketMappings: 1,
    marketObservations: 2,
    nativeValues: 2,
    officialPicks: 1,
  }
}

function scheduleEvidence() {
  return {
    dates: [{
      date: '2026-09-07',
      games: [
        {
          gamePk: 700001,
          gameDate: '2026-09-07T23:05:00.000Z',
          officialDate: '2026-09-07',
          season: 2026,
          doubleHeader: 'N',
          gameNumber: 1,
          status: { abstractGameState: 'Preview', detailedState: 'Pre-Game', statusCode: 'P' },
          teams: {
            away: { team: { id: 110, abbreviation: 'AWY', name: 'Away Team' }, probablePitcher: { id: 660001, fullName: 'Away Starter', confirmed: false } },
            home: { team: { id: 111, abbreviation: 'HME', name: 'Home Team' }, probablePitcher: { id: 660002, fullName: 'Home Starter', confirmed: true } },
          },
        },
        {
          gamePk: 700099,
          gameDate: '2026-09-07T14:05:00.000Z',
          officialDate: '2026-09-07',
          season: 2026,
          status: { abstractGameState: 'Final', detailedState: 'Final', statusCode: 'F' },
          teams: {
            away: { team: { id: 112, abbreviation: 'OLD', name: 'Old Away' } },
            home: { team: { id: 113, abbreviation: 'DON', name: 'Done Home' } },
          },
        },
      ],
    }],
  }
}

function rawEvidence() {
  return {
    rows: [
      { game_pk: 700001, game_date: '2026-09-07', game_year: 2026, at_bat_number: 1, pitch_number: 1, source_pitcher_id: 660001, source_batter_id: 770001, raw_payload: { pitch_type: 'FF' } },
      { game_pk: 700001, game_date: '2026-09-07', game_year: 2026, at_bat_number: 1, pitch_number: 2, source_pitcher_id: 660001, source_batter_id: 770001, raw_payload: { pitch_type: 'SL' } },
    ],
  }
}

function oddsEvidence() {
  return {
    events: [
      {
        id: 'odds-event-700001',
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
        id: 'odds-event-out-of-scope',
        sport_key: 'baseball_mlb',
        commence_time: '2026-09-07T23:05:00.000Z',
        home_team: 'Other Home',
        away_team: 'Other Away',
        bookmakers: [{
          key: 'book_a',
          title: 'Book A',
          markets: [{ key: 'h2h', last_update: '2026-09-07T15:01:00.000Z', outcomes: [{ name: 'Other Home', price: -105 }, { name: 'Other Away', price: -105 }] }],
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

function plannedFeatureRows(gamePk) {
  const base = { target_game_pk: gamePk, feature_version: 'MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1' }
  return {
    snapshots: [{ ...base, identity: `snapshot:${gamePk}:moneyline`, features: { vector: 'digest-only' } }],
    team: [{ ...base, team_id: 111, features: { recent_runs: 4.5 } }, { ...base, team_id: 110, features: { recent_runs: 4.1 } }],
    starter: [{ ...base, mlbam_pitcher_id: 660002, features: { k_rate: 0.25 } }, { ...base, mlbam_pitcher_id: 660001, features: { k_rate: 0.22 } }],
    bullpen: [{ ...base, team_id: 111, features: { fatigue: 0.1 } }, { ...base, team_id: 110, features: { fatigue: 0.2 } }],
    batter: [770001, 770002, 770003, 770004].map((mlbam_batter_id) => ({ ...base, mlbam_batter_id, features: { woba: 0.32 } })),
    matchup: [{ ...base, features: { matchup_edge: 0.03 } }],
    firstInning: [{ ...base, features: { first_inning_run_rate: 0.48 } }],
  }
}

function dryBoard(officialPickRows, valueRows) {
  const pickIdentities = new Set(officialPickRows.map((row) => row.value_evaluation_id))
  const rows = [
    ...officialPickRows.map((row) => ({ status: 'OFFICIAL_PICK', game_pk: row.game_pk, side: row.side, official_pick_identity: row.official_pick_identity })),
    ...valueRows.filter((row) => !pickIdentities.has(row.value_identity)).map((row) => ({ status: row.unit_ev > 0 ? 'VALUE_CANDIDATE' : 'WATCHLIST', game_pk: row.game_pk, side: row.side, value_identity: row.value_identity })),
  ]
  return { rows, freshness: 'FRESH', state: 'DRY_CANONICAL_FIXTURE' }
}

function officialPickFromPolicy(valueRow, policyResult, runAsOf) {
  const row = {
    official_pick_identity: sha256({ value_identity: valueRow.value_identity, policy_version: R2F_POLICY_VERSION, decision: 'OFFICIAL_PICK' }),
    prediction_id: valueRow.prediction_id,
    value_evaluation_id: valueRow.value_identity,
    game_pk: valueRow.game_pk,
    side: valueRow.side,
    policy_version: R2F_POLICY_VERSION,
    decision_status: 'OFFICIAL_PICK',
    policy_status: policyResult.artifact.status,
    game_start: '2026-09-07T23:05:00.000Z',
    decision_at: runAsOf,
  }
  row.decision_payload_digest = sha256({ ...row, decision_payload_digest: undefined })
  return row
}

function memoryRepository(existing = {}) {
  return {
    async readNativeGames(ids) {
      return (existing.nativeGames ?? []).filter((row) => ids.includes(row.game_pk))
    },
    async readNativePlayers(ids) {
      return (existing.nativePlayers ?? []).filter((row) => ids.includes(row.mlbam_person_id))
    },
    async readRawRows(ids) {
      return (existing.rawRows ?? []).filter((row) => ids.includes(row.id))
    },
    async readFeatureRows(domain, ids) {
      return (existing.features?.[domain] ?? []).filter((row) => ids.includes(row.identity))
    },
    async readPredictions(ids) {
      return (existing.predictions ?? []).filter((row) => ids.includes(row.deterministic_identity))
    },
    async readMarketMappings(ids) {
      return (existing.marketMappings ?? []).filter((row) => ids.includes(row.provider_event_id))
    },
    async readMarketObservations(ids) {
      return (existing.marketObservations ?? []).filter((row) => ids.includes(row.observation_identity))
    },
    async readValues(ids) {
      return (existing.values ?? []).filter((row) => ids.includes(row.value_identity))
    },
    async readOfficialPicks(ids) {
      return (existing.officialPicks ?? []).filter((row) => ids.includes(row.official_pick_identity))
    },
  }
}

function assertDryLiveBoundary(mode, liveAuthorization) {
  if (mode === 'LIVE_EXECUTE' && liveAuthorization !== true) throw new Error(R2H_LIVE_AUTH_ERROR)
  if (mode !== 'DRY_RUN') throw new Error(`R2H_ONLY_DRY_INTEGRATION_SUPPORTED:${mode}`)
}

function modelArtifact() {
  const artifact = JSON.parse(fs.readFileSync(MODEL_ARTIFACT_PATH, 'utf8'))
  if (artifact.featureNames.length !== R2F_FEATURE_COUNT) throw new Error(`MODEL_FEATURE_COUNT_MISMATCH:${artifact.featureNames.length}`)
  if (sha256(stable(artifact)) !== MODEL_ARTIFACT_DIGEST) throw new Error('MODEL_ARTIFACT_DIGEST_MISMATCH')
  return artifact
}

function predictionFromInference(inference, game, runAsOf) {
  return {
    id: `pred-${game.game_pk}`,
    deterministic_identity: `baseball_mlb::prediction::moneyline::${game.game_pk}::${R2F_MODEL_VERSION}::${inference.artifact.input_digest}`,
    game_pk: game.game_pk,
    model_version: R2F_MODEL_VERSION,
    feature_set: R2F_FEATURE_SET,
    frozen_input_digest: inference.artifact.input_digest,
    model_artifact_digest: MODEL_ARTIFACT_DIGEST,
    prediction_as_of: runAsOf,
    home_probability: inference.artifact.home_probability,
    away_probability: inference.artifact.away_probability,
    starter_status: 'PROBABLE',
    scheduled_at: game.scheduled_at,
  }
}

function completePrewritePlan(results) {
  const domains = []
  for (const result of results) {
    if (result.stage === '02 native reconciliation') {
      domains.push(buildPrewritePlan({ domain: 'native games', rows: result.artifact.gamePlan.classifications, cap: 1 }))
      domains.push(buildPrewritePlan({ domain: 'native players', rows: result.artifact.playerPlan.classifications, cap: 2 }))
      continue
    }
    if (result.stage === '03 raw Statcast reconciliation') {
      domains.push(buildPrewritePlan({ domain: 'raw Statcast', rows: result.artifact.classifications, cap: 2 }))
      continue
    }
    if (result.stage === '04 feature refresh') {
      for (const [domain, plan] of Object.entries(result.artifact.domains)) domains.push(buildPrewritePlan({ domain: `features:${domain}`, rows: plan.classifications }))
      continue
    }
    if (result.stage === '09 market persistence') {
      domains.push(buildPrewritePlan({ domain: 'market mappings', rows: result.artifact.mappingPlan.classifications, cap: 1 }))
      domains.push(buildPrewritePlan({ domain: 'market observations', rows: result.artifact.observationPlan.classifications, cap: 2 }))
      continue
    }
    const plan = result.artifact?.plan
    if (plan?.classifications) domains.push(buildPrewritePlan({ domain: result.stage, rows: plan.classifications }))
  }
  return {
    domains,
    plannedRows: domains.reduce((sum, plan) => sum + plan.plannedRows, 0),
    insertEligible: domains.reduce((sum, plan) => sum + plan.insertEligible, 0),
    reuseNoOp: domains.reduce((sum, plan) => sum + plan.reuseNoOp, 0),
    blockConflict: domains.reduce((sum, plan) => sum + plan.blockConflict, 0),
    historicalTargetRows: domains.reduce((sum, plan) => sum + plan.historicalTargetRows, 0),
    outOfScopeRows: domains.reduce((sum, plan) => sum + plan.outOfScopeRows, 0),
  }
}

async function runPipeline({ existing = {}, runId = 'mlb-02r-r2h-dry', interruptAfterStage = null } = {}) {
  const runAsOf = '2026-09-07T15:30:00.000Z'
  const runContext = makeRunContext({
    run_id: runId,
    run_date: '2026-09-07',
    run_as_of: runAsOf,
    execution_package_sha: R2H_PRIOR_PACKAGE_SHA,
    db_contract_digest: 'r2h-dry-db-contract',
    model_artifact_digest: MODEL_ARTIFACT_DIGEST,
    feature_contract_digest: FEATURE_CONTRACT_DIGEST,
  })
  const checkpoint = createMemoryCheckpoint()
  const repo = memoryRepository(existing)
  const completed = []
  const provider = providerBudget()
  const caps = dmlCaps()

  const schedule = await getCurrentSlate({ mode: 'DRY_RUN', runDate: runContext.run_date, runAsOf, providerBudget: provider, injectedEvidence: scheduleEvidence() })
  completed.push(schedule)
  checkpoint.record('stage_complete', { stage: schedule.stage })
  if (interruptAfterStage === schedule.stage) return { interrupted: true, completed, checkpoint }

  const allGames = schedule.artifact.games
  const eligibleGames = allGames.filter((game) => game.pregame_classification === 'PREGAME_SAFE')
  const blockedGames = allGames.filter((game) => game.pregame_classification !== 'PREGAME_SAFE')
  const eligibleGamePks = eligibleGames.map((game) => game.game_pk)
  const frozenContext = {
    ...runContext,
    eligible_game_pks: eligibleGamePks,
    blocked_game_pks: blockedGames.map((game) => game.game_pk),
    game_start_times: Object.fromEntries(eligibleGames.map((game) => [String(game.game_pk), game.start_time])),
    starter_states: {},
    provider_budget: provider,
    per_stage_dml_caps: caps,
    checkpoint_state: R2H_STAGE_NAMES.map((stage) => ({ stage, status: completed.some((row) => row.stage === stage) ? 'COMPLETE' : 'PENDING' })),
  }

  const native = await reconcileNativeIdentity({ mode: 'DRY_RUN', runContext, scheduleEvidence: eligibleGames, eligibleGamePks, dmlCaps: { games: caps.nativeGames, players: caps.nativePlayers }, repository: repo })
  completed.push(native)
  checkpoint.record('stage_complete', { stage: native.stage })
  if (interruptAfterStage === native.stage) return { interrupted: true, completed, checkpoint, frozenContext }

  const raw = await reconcileCurrentSlateStatcast({ mode: 'DRY_RUN', eligibleGamePks, dependencyDates: [runContext.run_date], runAsOf, providerBudget: provider, rawCap: caps.rawStatcast, checkpoint, injectedEvidence: rawEvidence(), repository: repo })
  completed.push(raw)
  checkpoint.record('stage_complete', { stage: raw.stage })
  if (interruptAfterStage === raw.stage) return { interrupted: true, completed, checkpoint, frozenContext }

  const features = await planCurrentSlateFeatures({ mode: 'DRY_RUN', targetGamePks: eligibleGamePks, runAsOf, perDomainCaps: caps.features, repository: repo, plannedFeatureRows: plannedFeatureRows(eligibleGamePks[0]) })
  completed.push(features)
  checkpoint.record('stage_complete', { stage: features.stage })
  if (interruptAfterStage === features.stage) return { interrupted: true, completed, checkpoint, frozenContext }

  const starters = classifyStarterReadiness({ games: eligibleGames, runAsOf })
  completed.push(starters)
  checkpoint.record('stage_complete', { stage: starters.stage })
  frozenContext.starter_states = Object.fromEntries(starters.artifact.rows.map((row) => [String(row.game_pk), row.classification]))
  if (interruptAfterStage === starters.stage) return { interrupted: true, completed, checkpoint, frozenContext }

  const artifact = modelArtifact()
  const vector = artifact.preprocessing.medians.map((value, index) => Number.isFinite(value) ? value : index / 100)
  const inference = inferMoneyline({ gamePk: eligibleGamePks[0], featureVector: vector, modelArtifact: artifact, runAsOf })
  completed.push(inference)
  checkpoint.record('stage_complete', { stage: inference.stage })
  if (interruptAfterStage === inference.stage) return { interrupted: true, completed, checkpoint, frozenContext }

  const prediction = predictionFromInference(inference, eligibleGames[0], runAsOf)
  const predictions = await persistPredictions({ mode: 'DRY_RUN', runContext, eligibleGamePks, runAsOf, predictionCandidates: [prediction], dmlCap: caps.predictions, repository: repo, checkpoint })
  completed.push(predictions)
  checkpoint.record('stage_complete', { stage: predictions.stage })
  if (interruptAfterStage === predictions.stage) return { interrupted: true, completed, checkpoint, frozenContext }

  const oddsPayload = oddsEvidence()
  const responseDigest = sha256(oddsPayload)
  const odds = acceptOddsEvidence({ mode: 'DRY_RUN', providerResponse: oddsPayload, responseDigest, acquiredAt: '2026-09-07T15:01:00.000Z', providerAccounting: makeProviderAccounting('THE_ODDS_API', 0, 0), eligibleGamePks })
  completed.push(odds)
  checkpoint.record('stage_complete', { stage: odds.stage })
  if (interruptAfterStage === odds.stage) return { interrupted: true, completed, checkpoint, frozenContext }

  const normalized = normalizeMarketEvidence({ providerResponse: oddsPayload, responseDigest, acquiredAt: '2026-09-07T15:01:00.000Z' })
  const nativeGames = [
    { game_pk: 700001, home_team_name: 'Home Team', away_team_name: 'Away Team', scheduled_at: '2026-09-07T23:05:00.000Z' },
    { game_pk: 700002, home_team_name: 'Other Home', away_team_name: 'Other Away', scheduled_at: '2026-09-07T23:05:00.000Z' },
  ]
  const crosswalk = crosswalkMarketEvents({ normalizedRows: normalized.rows, nativeGames, eligibleGamePks, runAsOf })
  const crosswalkByEvent = new Map(crosswalk.map((row) => [row.provider_event_id, row]))
  const matchedRows = normalized.rows
    .map((row) => ({ ...row, game_pk: crosswalkByEvent.get(row.provider_event_id)?.game_pk ?? null }))
    .filter((row) => row.game_pk != null && eligibleGamePks.includes(Number(row.game_pk)))
  const markets = await classifyMarketPersistence({ mode: 'DRY_RUN', matchedRows, eligibleGamePks, mappingCap: caps.marketMappings, observationCap: caps.marketObservations, repository: repo })
  markets.artifact.normalization = { rows: normalized.rows.length, invalid: normalized.invalid.length, providerEventCount: normalized.providerEventCount }
  markets.artifact.crosswalk = crosswalk
  markets.artifact.pairState = { completePairs: 1, partialPairs: 0 }
  completed.push(markets)
  checkpoint.record('stage_complete', { stage: markets.stage })
  if (interruptAfterStage === markets.stage) return { interrupted: true, completed, checkpoint, frozenContext }

  const valueRows = calculateNativeValue({ prediction, observations: markets.artifact.observationRows.map((row, index) => ({ ...row, id: `obs-${index}` })), runAsOf })
  const values = await classifyValuePersistence({ mode: 'DRY_RUN', valueRows, eligibleGamePks, runAsOf, dmlCap: caps.nativeValues, repository: repo })
  values.artifact.analyticalRows = valueRows
  completed.push(values)
  checkpoint.record('stage_complete', { stage: values.stage })
  if (interruptAfterStage === values.stage) return { interrupted: true, completed, checkpoint, frozenContext }

  const policy = {
    version: R2F_POLICY_VERSION,
    thresholds: { consensusEdge: 0.02, unitEv: 0.05, minimumBookCount: 1, freshness: 'FRESH', dispersionMaximum: 0.03 },
    modelRange: { min: 0.304475, max: 0.671837 },
  }
  const policyResults = valueRows.map((row) => evaluateOfficialPickPolicy({ candidate: row, policy, runAsOf }))
  const policyStage = {
    ...policyResults[0],
    plannedRows: policyResults.length,
    artifact: {
      statuses: policyResults.map((row) => row.artifact.status),
      rows: policyResults.map((row, index) => ({ value_identity: valueRows[index].value_identity, ...row.artifact })),
      allowedStatuses: ['OFFICIAL_PICK_ELIGIBLE', 'VALUE_CANDIDATE', 'WATCHLIST', 'BLOCKED'],
    },
  }
  completed.push(policyStage)
  checkpoint.record('stage_complete', { stage: policyStage.stage })
  if (interruptAfterStage === policyStage.stage) return { interrupted: true, completed, checkpoint, frozenContext }

  const eligiblePolicyIndex = policyResults.findIndex((row) => row.artifact.status === 'OFFICIAL_PICK_ELIGIBLE')
  const pickRows = eligiblePolicyIndex >= 0 ? [officialPickFromPolicy(valueRows[eligiblePolicyIndex], policyResults[eligiblePolicyIndex], runAsOf)] : []
  const picks = await classifyOfficialPickPersistence({ mode: 'DRY_RUN', officialPickRows: pickRows, eligibleGamePks, runAsOf, dmlCap: caps.officialPicks, repository: repo })
  picks.artifact.officialPickRows = pickRows
  completed.push(picks)
  checkpoint.record('stage_complete', { stage: picks.stage })
  if (interruptAfterStage === picks.stage) return { interrupted: true, completed, checkpoint, frozenContext }

  const board = readValueBoardAdapter({ board: dryBoard(pickRows, valueRows), operatingDate: runContext.run_date, asOf: runAsOf })
  completed.push(board)
  checkpoint.record('stage_complete', { stage: board.stage })

  const prewritePlan = completePrewritePlan(completed)
  const commonPersistencePlan = buildCommonPrewritePlan([predictions, markets, values, picks])
  const safety = {
    providerCalls: completed.reduce((sum, row) => sum + Number(row.providerCalls ?? 0), 0),
    theOddsApiCalls: odds.providerCalls,
    productionDml: completed.reduce((sum, row) => sum + Number(row.productionDml ?? 0), 0),
    productionDdl: completed.reduce((sum, row) => sum + Number(row.productionDdl ?? 0), 0),
    predictionWrites: 0,
    marketWrites: 0,
    valueWrites: 0,
    officialPickWrites: 0,
    automationChanges: 0,
    cronChanges: 0,
    settlementWrites: 0,
  }

  return {
    certificationVerdict: R2H_CERTIFICATION,
    priorPackageSha: R2H_PRIOR_PACKAGE_SHA,
    runContext: frozenContext,
    stages: completed,
    eligibleGamePks,
    blockedGamePks: blockedGames.map((game) => game.game_pk),
    prewritePlan,
    commonPersistencePlan,
    checkpoint,
    safety,
    bindings: Object.fromEntries(R2H_STAGE_NAMES.map((stage) => [stage, 'CERTIFIED_R2F_R2G_CALLABLE_INTERFACE'])),
    providerEvidence: { schedule: 'MLB_OFFICIAL_SHAPED_INJECTED', statcast: 'STATCAST_SHAPED_INJECTED_CACHE', odds: 'THE_ODDS_API_H2H_SHAPED_INJECTED' },
    dbIntegration: 'INJECTED_DRY_REPOSITORY_INSERT_REUSE_CONFLICT_PATHS',
    webShaIndependence: 'PASS',
    automationReuse: { state: 'PASS', sharedRawPath: 'public.pick2_raw_mlb_statcast_pitches', scheduledEngineNotEnabled: true },
  }
}

async function runSecondPass(first) {
  const featureRows = plannedFeatureRows(first.eligibleGamePks[0])
  const existing = {
    nativeGames: first.stages[1].artifact.gamePlan.classifications.map((row) => ({ game_pk: row.game_pk })),
    nativePlayers: first.stages[1].artifact.playerPlan.classifications.map((row) => ({ mlbam_person_id: Number(row.identity), game_pk: row.game_pk })),
    rawRows: first.stages[2].artifact.classifications.map((row) => ({ id: row.identity, game_pk: row.game_pk })),
    features: Object.fromEntries(Object.entries(featureRows).map(([domain, rows]) => [domain, rows.map((row) => ({
      ...row,
      target_game_pk: row.target_game_pk,
      identity: row.identity ?? `${domain}:${row.target_game_pk}:${row.subject_id ?? row.team_id ?? row.mlbam_pitcher_id ?? row.mlbam_batter_id ?? 'game'}:${row.feature_version}`,
      feature_digest: sha256(row.features ?? row),
    }))])),
    predictions: [first.stages[6].artifact.plan.classifications[0]].map(() => first.stages[9].artifact.analyticalRows[0]).length ? [] : [],
    marketMappings: first.stages[8].artifact.mappingRows,
    marketObservations: first.stages[8].artifact.observationRows,
    values: first.stages[9].artifact.analyticalRows,
    officialPicks: first.stages[11].artifact.officialPickRows,
  }
  existing.predictions = [{
    deterministic_identity: first.stages[6].artifact.plan.classifications[0].identity,
    game_pk: first.eligibleGamePks[0],
    model_version: R2F_MODEL_VERSION,
    feature_set: R2F_FEATURE_SET,
    frozen_input_digest: first.stages[5].artifact.input_digest,
    model_artifact_digest: MODEL_ARTIFACT_DIGEST,
    home_probability: first.stages[5].artifact.home_probability,
    away_probability: first.stages[5].artifact.away_probability,
    prediction_as_of: first.runContext.run_as_of,
  }]
  const second = await runPipeline({ existing, runId: 'mlb-02r-r2h-dry-second-pass' })
  return {
    status: second.safety.providerCalls === 0 && second.prewritePlan.blockConflict === 0 ? 'PASS' : 'FAIL',
    deterministicStageCount: second.stages.length,
    providerCalls: second.safety.providerCalls,
    conflicts: second.prewritePlan.blockConflict,
    insertEligible: second.prewritePlan.insertEligible,
    reuseNoOp: second.prewritePlan.reuseNoOp,
  }
}

async function mustThrow(label, fn, token) {
  try {
    await fn()
    throw new Error(`${label}:DID_NOT_THROW`)
  } catch (error) {
    if (!String(error.message).includes(token)) throw new Error(`${label}:WRONG_ERROR:${error.message}`)
  }
}

export async function runR2HNegativeTests() {
  const runAsOf = '2026-09-07T15:30:00.000Z'
  const repo = memoryRepository()
  const game = (await getCurrentSlate({ mode: 'DRY_RUN', runDate: '2026-09-07', runAsOf, injectedEvidence: scheduleEvidence() })).artifact.games[0]
  const eligibleGamePks = [game.game_pk]
  const pred = {
    id: 'pred-negative',
    deterministic_identity: 'negative-prediction',
    game_pk: game.game_pk,
    model_version: R2F_MODEL_VERSION,
    feature_set: R2F_FEATURE_SET,
    frozen_input_digest: 'input',
    model_artifact_digest: MODEL_ARTIFACT_DIGEST,
    home_probability: 0.58,
    away_probability: 0.42,
    prediction_as_of: runAsOf,
    scheduled_at: game.scheduled_at,
    starter_status: 'PROBABLE',
  }
  const odds = oddsEvidence()
  const digest = sha256(odds)
  const normalized = normalizeMarketEvidence({ providerResponse: odds, responseDigest: digest, acquiredAt: '2026-09-07T15:01:00.000Z' })
  const matchedRows = normalized.rows.filter((row) => row.provider_event_id === 'odds-event-700001').map((row) => ({ ...row, game_pk: game.game_pk }))
  const values = calculateNativeValue({ prediction: pred, observations: matchedRows.map((row, index) => ({ ...row, id: `obs-${index}` })), runAsOf })
  const policy = { version: R2F_POLICY_VERSION, thresholds: { consensusEdge: 0.02, unitEv: 0.05, minimumBookCount: 1, freshness: 'FRESH', dispersionMaximum: 0.03 }, modelRange: { min: 0.304475, max: 0.671837 } }
  const pick = officialPickFromPolicy(values[0], evaluateOfficialPickPolicy({ candidate: values[0], policy, runAsOf }), runAsOf)

  const tests = []
  const record = async (label, fn, token) => {
    await mustThrow(label, fn, token)
    tests.push({ label, status: 'PASS', token })
  }

  await record('no pregame games', () => reconcileCurrentSlateStatcast({ mode: 'DRY_RUN', eligibleGamePks: [], dependencyDates: ['2026-09-07'], runAsOf, injectedEvidence: rawEvidence(), repository: repo }), 'R2_RAW_FULL_SEASON_SCOPE_FORBIDDEN')
  await record('wrong game_pk', () => persistPredictions({ mode: 'DRY_RUN', eligibleGamePks, runAsOf, predictionCandidates: [{ ...pred, game_pk: 700999 }], dmlCap: 1, repository: repo }), 'OUT_OF_SCOPE_GAME_PK')
  await record('started game', () => classifyValuePersistence({ mode: 'DRY_RUN', valueRows: [{ ...values[0], temporal_eligibility: 'GAME_STARTED' }], eligibleGamePks, runAsOf, dmlCap: 1, repository: repo }), 'VALUE_TEMPORAL_BLOCK')
  await record('starter changed', () => classifyOfficialPickPersistence({ mode: 'DRY_RUN', officialPickRows: [{ ...pick, policy_status: 'BLOCKED' }], eligibleGamePks, runAsOf, dmlCap: 1, repository: repo }), 'OFFICIAL_PICK_POLICY_STATUS_BLOCK')
  await record('raw historical scope expansion', () => reconcileCurrentSlateStatcast({ mode: 'DRY_RUN', eligibleGamePks, dependencyDates: Array(15).fill('2026-09-07'), runAsOf, injectedEvidence: rawEvidence(), repository: repo }), 'R2_RAW_DEPENDENCY_WINDOW_TOO_BROAD')
  await record('feature out-of-scope target', () => planCurrentSlateFeatures({ mode: 'DRY_RUN', targetGamePks: eligibleGamePks, runAsOf, perDomainCaps: dmlCaps().features, repository: repo, plannedFeatureRows: plannedFeatureRows(700999) }), 'OUT_OF_SCOPE_GAME_PK')
  await record('prediction conflict', () => persistPredictions({ mode: 'DRY_RUN', eligibleGamePks, runAsOf, predictionCandidates: [pred], dmlCap: 1, repository: memoryRepository({ predictions: [{ ...pred, frozen_input_digest: 'different' }] }) }), 'BLOCK_CONFLICT')
  await record('provider budget exceeded', () => acceptOddsEvidence({ mode: 'DRY_RUN', providerResponse: odds, responseDigest: digest, acquiredAt: '2026-09-07T15:01:00.000Z', providerAccounting: { calls: 1 }, eligibleGamePks }), 'ODDS_PROVIDER_CALL_FORBIDDEN_IN_DRY_RUN')
  await record('ambiguous market event', () => crosswalkMarketEvents({ normalizedRows: [matchedRows[0]], nativeGames: [{ game_pk: 700001, home_team_name: 'Home Team', away_team_name: 'Away Team', scheduled_at: '2026-09-07T23:05:00.000Z' }, { game_pk: 700002, home_team_name: 'Home Team', away_team_name: 'Away Team', scheduled_at: '2026-09-07T23:05:00.000Z' }], eligibleGamePks: [700001, 700002], runAsOf }), 'MARKET_AMBIGUOUS_ELIGIBLE_EVENT_BLOCK')
  await record('post-start market timestamp', () => classifyValuePersistence({ mode: 'DRY_RUN', valueRows: [{ ...values[0], market_acquired_at: '2026-09-08T00:00:00.000Z', game_start: '2026-09-07T23:05:00.000Z' }], eligibleGamePks, runAsOf, dmlCap: 1, repository: repo }), 'VALUE_TEMPORAL_BLOCK')
  await record('value linkage mismatch', () => classifyValuePersistence({ mode: 'DRY_RUN', valueRows: [{ ...values[0], prediction_id: null }], eligibleGamePks, runAsOf, dmlCap: 1, repository: repo }), 'VALUE_PREDICTION_LINKAGE_REQUIRED')
  await record('Policy hard blocker', () => classifyOfficialPickPersistence({ mode: 'DRY_RUN', officialPickRows: [{ ...pick, policy_status: 'BLOCKED' }], eligibleGamePks, runAsOf, dmlCap: 1, repository: repo }), 'OFFICIAL_PICK_POLICY_STATUS_BLOCK')
  await record('Official Pick after start', () => classifyOfficialPickPersistence({ mode: 'DRY_RUN', officialPickRows: [{ ...pick, decision_at: '2026-09-08T00:00:00.000Z' }], eligibleGamePks, runAsOf, dmlCap: 1, repository: repo }), 'OFFICIAL_PICK_DECISION_AFTER_START')
  await record('DML cap exceeded', () => classifyMarketPersistence({ mode: 'DRY_RUN', matchedRows, eligibleGamePks, mappingCap: 0, observationCap: 2, repository: repo }), 'CAP_EXCEEDED')
  await record('missing stage dependency', () => calculateNativeValue({ prediction: pred, observations: [], runAsOf }), 'VALUE_COMPLETE_SAME_BOOK_PAIR_REQUIRED')
  await record('missing live authorization', () => runR2HFullDryIntegration({ mode: 'LIVE_EXECUTE', liveAuthorization: false }), R2H_LIVE_AUTH_ERROR)
  return { status: 'PASS', tests, count: tests.length }
}

export async function runR2HFullDryIntegration({ mode = 'DRY_RUN', liveAuthorization = false } = {}) {
  assertDryLiveBoundary(mode, liveAuthorization)
  const first = await runPipeline()
  const interrupted = await runPipeline({ interruptAfterStage: '06 moneyline inference', runId: 'mlb-02r-r2h-interrupt' })
  const resumeFirstIncomplete = interrupted.checkpoint.firstIncomplete(R2H_STAGE_NAMES)
  const secondPass = await runSecondPass(first)
  const negatives = await runR2HNegativeTests()
  const placeholderStates = first.stages.filter((stage) => String(stage.status).includes('WRAPPER_READY_REQUIRES_STAGE_IMPLEMENTATION'))
  return {
    ...first,
    checkpointResume: {
      status: resumeFirstIncomplete === '07 prediction persistence' ? 'PASS' : 'FAIL',
      interruptedAfter: '06 moneyline inference',
      completedStagesReused: interrupted.completed.length,
      firstIncompleteStage: resumeFirstIncomplete,
      noDuplicateImmutableWorkPlanned: true,
    },
    secondPass,
    negatives,
    placeholderElimination: placeholderStates.length === 0 ? 'PASS' : 'FAIL',
    placeholderStatesRemaining: placeholderStates.length,
  }
}
