import {
  assertGameScope,
  assertIsoTimestamp,
  assertNoLiveExecute,
  buildPrewritePlan,
  classifyInsertReuseConflict,
  normalizeGamePk,
  sha256,
  stageResult,
  uniqueGamePks,
} from './mlb-data-02r-r2f-stage-contracts.mjs'
import { R2F_MODEL_VERSION, R2F_FEATURE_SET, R2F_POLICY_VERSION } from './mlb-data-02r-r2f-wave12-interfaces.mjs'

export const R2G_TARGETS = Object.freeze({
  predictions: 'public.pick2_game_predictions',
  marketMappings: 'public.pick2_mlb_market_event_mappings',
  marketObservations: 'public.pick2_mlb_market_price_observations',
  values: 'public.pick2_mlb_market_value_evaluations',
  officialPicks: 'public.pick2_mlb_official_picks',
})

function requireValue(value, label) {
  if (value === undefined || value === null || value === '') throw new Error(`${label}_REQUIRED`)
  return value
}

function comparablePrediction(row) {
  return {
    deterministic_identity: row.deterministic_identity,
    game_pk: Number(row.game_pk),
    model_version: row.model_version,
    feature_set: row.feature_set,
    frozen_input_digest: row.frozen_input_digest ?? row.input_digest,
    model_artifact_digest: row.model_artifact_digest ?? row.artifact_digest,
    home_probability: Number(row.home_probability),
    away_probability: Number(row.away_probability),
    prediction_as_of: row.prediction_as_of ?? row.predicted_at ?? row.as_of,
  }
}

export async function persistPredictions({
  mode = 'DRY_RUN',
  runContext,
  eligibleGamePks = [],
  runAsOf,
  predictionCandidates = [],
  dmlCap = null,
  repository,
  checkpoint = null,
  liveAuthorization = false,
} = {}) {
  void runContext
  assertNoLiveExecute(mode, liveAuthorization)
  assertIsoTimestamp(runAsOf, 'run_as_of')
  const eligible = uniqueGamePks(eligibleGamePks)
  const planned = predictionCandidates.map((row) => {
    const normalized = comparablePrediction(row)
    if (normalized.model_version !== R2F_MODEL_VERSION) throw new Error(`PREDICTION_MODEL_VERSION_MISMATCH:${normalized.model_version}`)
    if (row.feature_set && row.feature_set !== R2F_FEATURE_SET) throw new Error(`PREDICTION_FEATURE_SET_MISMATCH:${row.feature_set}`)
    requireValue(normalized.frozen_input_digest, 'PREDICTION_INPUT_DIGEST')
    requireValue(normalized.deterministic_identity, 'PREDICTION_DETERMINISTIC_IDENTITY')
    if (Date.parse(normalized.prediction_as_of) > Date.parse(runAsOf)) throw new Error(`PREDICTION_AS_OF_AFTER_RUN:${normalized.game_pk}`)
    return normalized
  })
  assertGameScope(planned, eligible)
  const existing = await repository.readPredictions(planned.map((row) => row.deterministic_identity))
  const existingComparable = existing.map(comparablePrediction)
  const plan = classifyInsertReuseConflict({
    plannedRows: planned,
    existingRows: existingComparable,
    identityFields: ['deterministic_identity'],
    digestField: 'frozen_input_digest',
    eligibleGamePks: eligible,
    cap: dmlCap,
  })
  checkpoint?.record?.('prediction_prewrite_plan', { rows: plan.plannedRows })
  return stageResult({ stage: '07 prediction persistence', mode, plannedRows: plan.plannedRows, insertEligible: plan.insertEligible, reuseNoOp: plan.reuseNoOp, blockConflict: plan.blockConflict, artifact: { target: R2G_TARGETS.predictions, plan } })
}

export function acceptOddsEvidence({ mode = 'DRY_RUN', providerResponse, responseDigest, acquiredAt, providerAccounting = {}, eligibleGamePks = [], liveAuthorization = false } = {}) {
  assertNoLiveExecute(mode, liveAuthorization)
  assertIsoTimestamp(acquiredAt, 'acquired_at')
  requireValue(responseDigest, 'ODDS_RESPONSE_DIGEST')
  const events = Array.isArray(providerResponse) ? providerResponse : providerResponse?.events
  if (!Array.isArray(events)) throw new Error('ODDS_PROVIDER_RESPONSE_EVENTS_REQUIRED')
  const accounting = {
    provider: 'THE_ODDS_API',
    sport: 'baseball_mlb',
    market: 'h2h',
    oddsFormat: 'american',
    maxLiveRequests: 1,
    calls: Number(providerAccounting.calls ?? 0),
  }
  if (mode !== 'LIVE_EXECUTE' && accounting.calls !== 0) throw new Error('ODDS_PROVIDER_CALL_FORBIDDEN_IN_DRY_RUN')
  return stageResult({ stage: '08 odds evidence handoff', mode, plannedRows: events.length, providerCalls: accounting.calls, artifact: { events, responseDigest, acquiredAt, providerAccounting: accounting, eligibleGamePks: uniqueGamePks(eligibleGamePks) } })
}

function normalizeTeamToken(value) {
  return String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function normalizeMarketEvidence({ providerResponse, responseDigest, acquiredAt } = {}) {
  requireValue(responseDigest, 'MARKET_RESPONSE_DIGEST')
  assertIsoTimestamp(acquiredAt, 'acquired_at')
  const events = Array.isArray(providerResponse) ? providerResponse : providerResponse?.events
  if (!Array.isArray(events)) throw new Error('MARKET_PROVIDER_EVENTS_REQUIRED')
  const rows = []
  const invalid = []
  for (const event of events) {
    for (const bookmaker of event.bookmakers ?? []) {
      for (const market of bookmaker.markets ?? []) {
        if (market.key !== 'h2h') continue
        for (const outcome of market.outcomes ?? []) {
          const sideToken = normalizeTeamToken(outcome.name)
          const homeToken = normalizeTeamToken(event.home_team)
          const awayToken = normalizeTeamToken(event.away_team)
          const side = sideToken === homeToken ? 'HOME' : sideToken === awayToken ? 'AWAY' : null
          if (!side || !Number.isInteger(Number(outcome.price))) {
            invalid.push({ provider_event_id: event.id, bookmaker_key: bookmaker.key, outcome_name: outcome.name })
            continue
          }
          const base = {
            provider: 'the-odds-api',
            provider_event_id: event.id,
            sport_key: event.sport_key ?? 'baseball_mlb',
            commence_time: event.commence_time,
            home_team: event.home_team,
            away_team: event.away_team,
            bookmaker_key: bookmaker.key,
            bookmaker_name: bookmaker.title ?? bookmaker.key,
            market: 'MONEYLINE',
            provider_market_key: market.key,
            side,
            outcome_name: outcome.name,
            american_odds: Number(outcome.price),
            provider_last_update: market.last_update ?? bookmaker.last_update ?? acquiredAt,
            acquired_at: acquiredAt,
            source_response_digest: responseDigest,
          }
          const sourcePayload = { ...base, event_home_team: event.home_team, event_away_team: event.away_team }
          const row = {
            ...base,
            source_payload_digest: sha256(sourcePayload),
            source_event: { home_team: event.home_team, away_team: event.away_team },
          }
          row.observation_identity = sha256([
            row.provider,
            row.provider_event_id,
            row.bookmaker_key,
            row.provider_market_key,
            row.side,
            row.provider_last_update,
            row.acquired_at,
            row.source_payload_digest,
          ].join('::'))
          rows.push(row)
        }
      }
    }
  }
  return { rows, invalid, providerEventCount: events.length }
}

export function crosswalkMarketEvents({ normalizedRows = [], nativeGames = [], eligibleGamePks = [], runAsOf } = {}) {
  assertIsoTimestamp(runAsOf, 'run_as_of')
  const eligible = new Set(uniqueGamePks(eligibleGamePks))
  const nativeByTeamsTime = new Map()
  for (const game of nativeGames) {
    const gamePk = normalizeGamePk(game.game_pk)
    const key = `${normalizeTeamToken(game.away_team_name ?? game.away)}:${normalizeTeamToken(game.home_team_name ?? game.home)}:${String(game.scheduled_at ?? game.commence_time).slice(0, 13)}`
    const list = nativeByTeamsTime.get(key) ?? []
    list.push({ ...game, game_pk: gamePk })
    nativeByTeamsTime.set(key, list)
  }
  const byEvent = new Map()
  for (const row of normalizedRows) {
    if (!byEvent.has(row.provider_event_id)) byEvent.set(row.provider_event_id, row)
  }
  const rows = []
  for (const row of byEvent.values()) {
    const sourceEvent = row.source_event ?? {}
    const key = `${normalizeTeamToken(sourceEvent.away_team ?? row.away_team)}:${normalizeTeamToken(sourceEvent.home_team ?? row.home_team)}:${String(row.commence_time).slice(0, 13)}`
    const matches = nativeByTeamsTime.get(key) ?? []
    if (matches.length === 0) rows.push({ provider_event_id: row.provider_event_id, classification: 'UNMATCHED', game_pk: null })
    else if (matches.length > 1) rows.push({ provider_event_id: row.provider_event_id, classification: 'AMBIGUOUS', game_pk: null, candidate_game_pks: matches.map((game) => game.game_pk) })
    else if (!eligible.has(matches[0].game_pk)) rows.push({ provider_event_id: row.provider_event_id, classification: 'OUT_OF_SCOPE', game_pk: matches[0].game_pk })
    else rows.push({ provider_event_id: row.provider_event_id, classification: 'MATCHED', game_pk: matches[0].game_pk })
  }
  if (rows.some((row) => row.classification === 'AMBIGUOUS' && row.candidate_game_pks?.some((gamePk) => eligible.has(gamePk)))) throw new Error('MARKET_AMBIGUOUS_ELIGIBLE_EVENT_BLOCK')
  return rows
}

function comparableMarketObservation(row) {
  return {
    observation_identity: row.observation_identity,
    game_pk: Number(row.game_pk),
    provider: row.provider,
    provider_event_id: row.provider_event_id,
    bookmaker_key: row.bookmaker_key,
    market: row.market,
    provider_market_key: row.provider_market_key,
    side: row.side,
    american_odds: Number(row.american_odds),
    provider_last_update: row.provider_last_update,
    acquired_at: row.acquired_at,
    source_payload_digest: row.source_payload_digest,
    source_response_digest: row.source_response_digest,
  }
}

export async function classifyMarketPersistence({ mode = 'DRY_RUN', matchedRows = [], eligibleGamePks = [], mappingCap = null, observationCap = null, repository, liveAuthorization = false } = {}) {
  assertNoLiveExecute(mode, liveAuthorization)
  const eligible = uniqueGamePks(eligibleGamePks)
  const inScope = matchedRows.filter((row) => row.game_pk != null)
  assertGameScope(inScope, eligible)
  const mappingRows = [...new Map(inScope.map((row) => [row.provider_event_id, {
    game_pk: Number(row.game_pk),
    provider_event_id: row.provider_event_id,
    market_provider: 'the-odds-api',
    market_sport_key: 'baseball_mlb',
    identity: row.provider_event_id,
    source_payload_digest: sha256({ provider: 'the-odds-api', provider_event_id: row.provider_event_id, game_pk: Number(row.game_pk), source_response_digest: row.source_response_digest }),
  }])).values()]
  const observationRows = inScope.map(comparableMarketObservation)
  const existingMappings = await repository.readMarketMappings(mappingRows.map((row) => row.provider_event_id))
  const existingObservations = await repository.readMarketObservations(observationRows.map((row) => row.observation_identity))
  const mappingPlan = classifyInsertReuseConflict({ plannedRows: mappingRows, existingRows: existingMappings.map((row) => ({ ...row, identity: row.provider_event_id })), identityFields: ['identity'], digestField: 'source_payload_digest', eligibleGamePks: eligible, cap: mappingCap })
  const observationPlan = classifyInsertReuseConflict({ plannedRows: observationRows, existingRows: existingObservations.map(comparableMarketObservation), identityFields: ['observation_identity'], digestField: 'source_payload_digest', eligibleGamePks: eligible, cap: observationCap })
  return stageResult({
    stage: '09 market persistence',
    mode,
    plannedRows: mappingPlan.plannedRows + observationPlan.plannedRows,
    insertEligible: mappingPlan.insertEligible + observationPlan.insertEligible,
    reuseNoOp: mappingPlan.reuseNoOp + observationPlan.reuseNoOp,
    blockConflict: mappingPlan.blockConflict + observationPlan.blockConflict,
    artifact: {
      targetMappings: R2G_TARGETS.marketMappings,
      targetObservations: R2G_TARGETS.marketObservations,
      mappingRows,
      observationRows,
      mappingPlan,
      observationPlan,
    },
  })
}

export async function persistMarketEvidence(input = {}) {
  assertNoLiveExecute(input.mode ?? 'DRY_RUN', input.liveAuthorization === true)
  if ((input.mode ?? 'DRY_RUN') === 'LIVE_EXECUTE') throw new Error('R2G_MARKET_LIVE_PERSISTENCE_DEFERRED_TO_FUTURE_R2B')
  return classifyMarketPersistence(input)
}

export function americanImplied(odds) {
  const value = Number(odds)
  return value > 0 ? 100 / (value + 100) : Math.abs(value) / (Math.abs(value) + 100)
}

export function decimalOdds(odds) {
  const value = Number(odds)
  return value > 0 ? 1 + value / 100 : 1 + 100 / Math.abs(value)
}

function median(values) {
  const sorted = values.map(Number).sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export function calculateNativeValue({ prediction, observations, runAsOf } = {}) {
  assertIsoTimestamp(runAsOf, 'run_as_of')
  const gamePk = normalizeGamePk(prediction.game_pk)
  const homeRows = observations.filter((row) => Number(row.game_pk) === gamePk && row.side === 'HOME')
  const awayRows = observations.filter((row) => Number(row.game_pk) === gamePk && row.side === 'AWAY')
  const byBook = []
  for (const home of homeRows) {
    const away = awayRows.find((row) => row.bookmaker_key === home.bookmaker_key && row.provider_event_id === home.provider_event_id)
    if (!away) continue
    const homeRaw = americanImplied(home.american_odds)
    const awayRaw = americanImplied(away.american_odds)
    const overround = homeRaw + awayRaw
    byBook.push({ home, away, home_no_vig: homeRaw / overround, away_no_vig: awayRaw / overround })
  }
  if (byBook.length === 0) throw new Error('VALUE_COMPLETE_SAME_BOOK_PAIR_REQUIRED')
  const rows = []
  for (const pair of byBook) {
    for (const side of ['HOME', 'AWAY']) {
      const selected = side === 'HOME' ? pair.home : pair.away
      const modelProbability = side === 'HOME' ? Number(prediction.home_probability) : Number(prediction.away_probability)
      const noVig = side === 'HOME' ? pair.home_no_vig : pair.away_no_vig
      const unitEv = modelProbability * decimalOdds(selected.american_odds) - 1
      const consensusRows = byBook.map((book) => side === 'HOME' ? book.home_no_vig : book.away_no_vig)
      const consensusProbability = median(consensusRows)
      const payload = {
        prediction_id: prediction.id,
        game_pk: gamePk,
        side,
        bookmaker_key: selected.bookmaker_key,
        american_odds: selected.american_odds,
        model_probability: modelProbability,
        no_vig_probability: noVig,
        source_observation_identity: selected.observation_identity,
        run_as_of: runAsOf,
      }
      rows.push({
        value_identity: sha256(payload),
        prediction_id: prediction.id,
        game_pk: gamePk,
        side,
        model_version: prediction.model_version ?? R2F_MODEL_VERSION,
        model_probability: modelProbability,
        bookmaker_key: selected.bookmaker_key,
        bookmaker_name: selected.bookmaker_name,
        american_odds: Number(selected.american_odds),
        home_market_observation_id: pair.home.id ?? pair.home.observation_identity,
        away_market_observation_id: pair.away.id ?? pair.away.observation_identity,
        selected_side_market_observation_id: selected.id ?? selected.observation_identity,
        raw_implied_probability: americanImplied(selected.american_odds),
        no_vig_probability: noVig,
        edge: modelProbability - noVig,
        unit_ev: unitEv,
        consensus_probability: consensusProbability,
        consensus_edge: modelProbability - consensusProbability,
        market_dispersion: Math.max(...consensusRows) - Math.min(...consensusRows),
        book_count: byBook.length,
        market_freshness: 'FRESH',
        starter_status: prediction.starter_status ?? 'PROBABLE',
        temporal_eligibility: Date.parse(selected.commence_time ?? prediction.scheduled_at ?? runAsOf) > Date.parse(runAsOf) ? 'PREGAME_VALID' : 'GAME_STARTED',
        source_payload_digest: sha256({ prediction, selected, home: pair.home, away: pair.away }),
        evaluation_payload_digest: sha256(payload),
      })
    }
  }
  return rows
}

function comparableValue(row) {
  return {
    value_identity: row.value_identity,
    game_pk: Number(row.game_pk),
    prediction_id: row.prediction_id,
    side: row.side,
    bookmaker_key: row.bookmaker_key,
    american_odds: Number(row.american_odds),
    model_probability: Number(row.model_probability),
    no_vig_probability: Number(row.no_vig_probability),
    edge: Number(row.edge),
    unit_ev: Number(row.unit_ev),
    evaluation_payload_digest: row.evaluation_payload_digest,
  }
}

export async function classifyValuePersistence({ mode = 'DRY_RUN', valueRows = [], eligibleGamePks = [], runAsOf, dmlCap = null, repository, liveAuthorization = false } = {}) {
  assertNoLiveExecute(mode, liveAuthorization)
  assertIsoTimestamp(runAsOf, 'run_as_of')
  const eligible = uniqueGamePks(eligibleGamePks)
  for (const row of valueRows) {
    if (row.temporal_eligibility === 'GAME_STARTED' || Date.parse(row.market_acquired_at ?? row.provider_last_update ?? runAsOf) > Date.parse(row.game_start ?? '9999-01-01T00:00:00.000Z')) throw new Error(`VALUE_TEMPORAL_BLOCK:${row.game_pk}`)
    requireValue(row.prediction_id, 'VALUE_PREDICTION_LINKAGE')
    requireValue(row.value_identity, 'VALUE_IDENTITY')
  }
  assertGameScope(valueRows, eligible)
  const existing = await repository.readValues(valueRows.map((row) => row.value_identity))
  const plan = classifyInsertReuseConflict({ plannedRows: valueRows.map(comparableValue), existingRows: existing.map(comparableValue), identityFields: ['value_identity'], digestField: 'evaluation_payload_digest', eligibleGamePks: eligible, cap: dmlCap })
  return stageResult({ stage: '10 value persistence', mode, plannedRows: plan.plannedRows, insertEligible: plan.insertEligible, reuseNoOp: plan.reuseNoOp, blockConflict: plan.blockConflict, artifact: { target: R2G_TARGETS.values, plan } })
}

export async function persistNativeValues(input = {}) {
  assertNoLiveExecute(input.mode ?? 'DRY_RUN', input.liveAuthorization === true)
  if ((input.mode ?? 'DRY_RUN') === 'LIVE_EXECUTE') throw new Error('R2G_VALUE_LIVE_PERSISTENCE_DEFERRED_TO_FUTURE_R2B')
  return classifyValuePersistence(input)
}

function comparableOfficialPick(row) {
  return {
    official_pick_identity: row.official_pick_identity,
    game_pk: Number(row.game_pk),
    prediction_id: row.prediction_id,
    value_evaluation_id: row.value_evaluation_id,
    side: row.side,
    policy_version: row.policy_version,
    decision_status: row.decision_status,
    decision_payload_digest: row.decision_payload_digest,
  }
}

export async function classifyOfficialPickPersistence({ mode = 'DRY_RUN', officialPickRows = [], eligibleGamePks = [], runAsOf, dmlCap = null, repository, liveAuthorization = false } = {}) {
  assertNoLiveExecute(mode, liveAuthorization)
  assertIsoTimestamp(runAsOf, 'run_as_of')
  const eligible = uniqueGamePks(eligibleGamePks)
  const sideByGame = new Map()
  for (const row of officialPickRows) {
    requireValue(row.official_pick_identity, 'OFFICIAL_PICK_IDENTITY')
    requireValue(row.prediction_id, 'OFFICIAL_PICK_PREDICTION_LINKAGE')
    requireValue(row.value_evaluation_id, 'OFFICIAL_PICK_VALUE_LINKAGE')
    if (row.policy_version !== R2F_POLICY_VERSION) throw new Error(`OFFICIAL_PICK_POLICY_VERSION_MISMATCH:${row.policy_version}`)
    if (row.policy_status && row.policy_status !== 'OFFICIAL_PICK_ELIGIBLE') throw new Error(`OFFICIAL_PICK_POLICY_STATUS_BLOCK:${row.policy_status}`)
    if (row.decision_at && row.game_start && Date.parse(row.decision_at) >= Date.parse(row.game_start)) throw new Error(`OFFICIAL_PICK_DECISION_AFTER_START:${row.game_pk}`)
    const gamePk = normalizeGamePk(row.game_pk)
    const prior = sideByGame.get(gamePk)
    if (prior && prior !== row.side) throw new Error(`OFFICIAL_PICK_ONE_SIDE_PER_GAME_BLOCK:${gamePk}`)
    sideByGame.set(gamePk, row.side)
  }
  assertGameScope(officialPickRows, eligible)
  const existing = await repository.readOfficialPicks(officialPickRows.map((row) => row.official_pick_identity))
  const plan = classifyInsertReuseConflict({ plannedRows: officialPickRows.map(comparableOfficialPick), existingRows: existing.map(comparableOfficialPick), identityFields: ['official_pick_identity'], digestField: 'decision_payload_digest', eligibleGamePks: eligible, cap: dmlCap })
  return stageResult({ stage: '12 Official Pick persistence', mode, plannedRows: plan.plannedRows, insertEligible: plan.insertEligible, reuseNoOp: plan.reuseNoOp, blockConflict: plan.blockConflict, artifact: { target: R2G_TARGETS.officialPicks, plan } })
}

export async function persistOfficialPicks(input = {}) {
  assertNoLiveExecute(input.mode ?? 'DRY_RUN', input.liveAuthorization === true)
  if ((input.mode ?? 'DRY_RUN') === 'LIVE_EXECUTE') throw new Error('R2G_OFFICIAL_PICK_LIVE_PERSISTENCE_DEFERRED_TO_FUTURE_R2B')
  return classifyOfficialPickPersistence(input)
}

export function buildCommonPrewritePlan(results) {
  const plans = results.map((result) => {
    const plan = result.artifact?.plan ?? result.artifact?.observationPlan ?? result.artifact?.mappingPlan
    const rows = plan?.classifications ?? []
    return buildPrewritePlan({ domain: result.stage, rows, identityField: rows[0]?.deterministic_identity ? 'deterministic_identity' : rows[0]?.observation_identity ? 'observation_identity' : rows[0]?.value_identity ? 'value_identity' : rows[0]?.official_pick_identity ? 'official_pick_identity' : 'identity' })
  })
  return {
    domains: plans,
    plannedRows: plans.reduce((sum, row) => sum + row.plannedRows, 0),
    insertEligible: plans.reduce((sum, row) => sum + row.insertEligible, 0),
    reuseNoOp: plans.reduce((sum, row) => sum + row.reuseNoOp, 0),
    blockConflict: plans.reduce((sum, row) => sum + row.blockConflict, 0),
    outOfScopeRows: plans.reduce((sum, row) => sum + row.outOfScopeRows, 0),
    historicalTargetRows: plans.reduce((sum, row) => sum + row.historicalTargetRows, 0),
  }
}
