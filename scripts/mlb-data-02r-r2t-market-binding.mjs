import { sha256 } from './mlb-data-02r-r2f-stage-contracts.mjs'
import { normalizeMarketEvidence, crosswalkMarketEvents, calculateNativeValue, classifyMarketFreshness } from './mlb-data-02r-r2g-persistence-interfaces.mjs'
import { assertDownstreamPayload, persistDownstreamRows } from './mlb-data-02r-r2t-downstream-persistence.mjs'
import { evaluateCertifiedPolicy, loadCertifiedPolicy } from './mlb-data-02r-r2t-policy-binding.mjs'

const ensure = (condition, reason) => { if (!condition) throw new Error(`R2T_MARKET_BLOCK:${reason}`) }
const timestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value))
const withoutServerFields = row => Object.fromEntries(Object.entries(row).filter(([key]) => !['id', 'created_at', 'updated_at'].includes(key)))
const orderedDigest=(rows,key)=>sha256([...rows].sort((a,b)=>String(a[key]).localeCompare(String(b[key]))))

export function canonicalMarketReference({markets,evidence,evaluatedAt}) {
  return {acquiredAt:evidence.acquiredAt,evaluatedAt,responseDigest:evidence.responseDigest,oddsDigest:sha256(evidence),
    mappingsDigest:orderedDigest(markets.mappings.rows,'provider_event_id'),observationsDigest:orderedDigest(markets.observations.rows,'observation_identity'),
    mappingCount:markets.mappings.rows.length,observationCount:markets.observations.rows.length,crosswalk:markets.crosswalk}
}

export async function restoreCanonicalMarkets({reference,repository,eligibleGamePks,beforeWrite}) {
  const matched=new Set(reference.crosswalk.filter(r=>r.classification==='MATCHED').map(r=>r.provider_event_id))
  const mappings=(await repository.readMarketMappingsByGames(eligibleGamePks)).filter(r=>matched.has(r.provider_event_id))
  const observations=await repository.readMarketObservationsByEvidence({eligibleGamePks,responseDigest:reference.responseDigest,acquiredAt:reference.acquiredAt})
  ensure(mappings.length===reference.mappingCount && observations.length===reference.observationCount,'MARKET_REFERENCE_COUNT')
  ensure(orderedDigest(mappings,'provider_event_id')===reference.mappingsDigest && orderedDigest(observations,'observation_identity')===reference.observationsDigest,'MARKET_REFERENCE_DRIFT')
  const mappingResult=await persistDownstreamRows({domain:'marketMappings',rows:mappings.map(withoutServerFields),repository,eligibleGamePks,cap:0,beforeWrite})
  const observationResult=await persistDownstreamRows({domain:'marketObservations',rows:observations.map(withoutServerFields),repository,eligibleGamePks,cap:0,beforeWrite})
  return {mappings:mappingResult,observations:observationResult,crosswalk:reference.crosswalk}
}

export async function persistCanonicalMarkets({ evidence, nativeGames, eligibleGamePks, repository, limits = {}, beforeWrite }) {
  ensure(timestamp(evidence?.acquiredAt) && evidence.responseDigest === sha256(evidence.payload), 'EVIDENCE_DIGEST_OR_TIME')
  const normalized = normalizeMarketEvidence({ providerResponse: evidence.payload, responseDigest: evidence.responseDigest, acquiredAt: evidence.acquiredAt })
  ensure(normalized.invalid.length === 0, 'INVALID_OUTCOME')
  const crosswalk = crosswalkMarketEvents({ normalizedRows: normalized.rows, nativeGames, eligibleGamePks, runAsOf: evidence.acquiredAt })
  const matched = new Map(crosswalk.filter(r => r.classification === 'MATCHED').map(r => [r.provider_event_id, r.game_pk]))
  ensure(new Set(matched.values()).size === matched.size, 'MULTIPLE_EVENTS_FOR_GAME')
  const plannedMappings = []
  const priorMappings = await repository.readMarketMappingsByGames(eligibleGamePks)
  for (const [providerEventId, gamePk] of matched) {
    const prior = priorMappings.filter(r => r.market_provider === 'the-odds-api' && (r.provider_event_id === providerEventId || r.game_pk === gamePk))
    ensure(prior.length <= 1 && prior.every(r => r.provider_event_id === providerEventId && r.game_pk === gamePk), 'MAPPING_CONFLICT')
    plannedMappings.push(prior.length ? withoutServerFields(prior[0]) : {
      game_pk: gamePk, market_provider: 'the-odds-api', provider_event_id: providerEventId, market_sport_key: 'baseball_mlb',
      matched_at: evidence.acquiredAt, mapping_version: 'MLB_NATIVE_MONEYLINE_MAPPING_V1',
      source_payload_digest: sha256({ gamePk, providerEventId, provider: 'the-odds-api' }),
      evidence: { method: 'canonical teams and scheduled time', response_digest: evidence.responseDigest }, legacy_sport_event_id: null,
    })
  }
  const mappingResult = await persistDownstreamRows({ domain: 'marketMappings', rows: plannedMappings, repository, eligibleGamePks, cap: limits.marketMappings ?? plannedMappings.length, beforeWrite })
  const mappingByEvent = new Map(mappingResult.rows.map(r => [r.provider_event_id, r]))
  const observations = normalized.rows.filter(row => mappingByEvent.has(row.provider_event_id)).map(row => {
    const mapping = mappingByEvent.get(row.provider_event_id)
    const native = nativeGames.find(g => g.game_pk === mapping.game_pk)
    ensure(timestamp(row.commence_time) && timestamp(row.provider_last_update), 'MISSING_MARKET_TIME')
    ensure(Date.parse(row.provider_last_update) <= Date.parse(evidence.acquiredAt), 'FUTURE_MARKET_UPDATE')
    ensure(Date.parse(native.scheduled_at) > Date.parse(evidence.acquiredAt) && Date.parse(row.commence_time) > Date.parse(evidence.acquiredAt), 'STARTED_GAME')
    ensure(row.sport_key === 'baseball_mlb' && row.market === 'MONEYLINE' && Math.abs(row.american_odds) >= 100, 'MARKET_CONTRACT')
    return assertDownstreamPayload('marketObservations', {
      observation_identity: row.observation_identity, game_pk: mapping.game_pk, provider: row.provider, provider_event_id: row.provider_event_id,
      market_event_mapping_id: mapping.id, region: 'us', bookmaker_key: row.bookmaker_key, bookmaker_name: row.bookmaker_name,
      market: row.market, provider_market_key: row.provider_market_key, side: row.side, outcome_name: row.outcome_name,
      american_odds: row.american_odds, provider_last_update: row.provider_last_update, acquired_at: row.acquired_at, commence_time: row.commence_time,
      source_payload_digest: row.source_payload_digest, source_response_digest: row.source_response_digest,
      source_provenance: { provider: row.provider, acquisition_time: evidence.acquiredAt, response_digest: evidence.responseDigest },
    })
  })
  const observationResult = await persistDownstreamRows({ domain: 'marketObservations', rows: observations, repository, eligibleGamePks, cap: limits.marketObservations ?? observations.length, beforeWrite })
  return { mappings: mappingResult, observations: observationResult, crosswalk }
}

export function buildCanonicalValues({ predictions, observations, evaluatedAt }) {
  ensure(timestamp(evaluatedAt), 'EVALUATION_TIME')
  const values = []
  for (const prediction of predictions) {
    const gameRows = observations.filter(r => r.game_pk === prediction.game_pk)
    const groups = new Map()
    for (const row of gameRows) {
      const key = `${row.provider}:${row.provider_event_id}:${row.bookmaker_key}`
      const group = groups.get(key) ?? []
      group.push(row); groups.set(key, group)
      ensure(timestamp(row.acquired_at) && timestamp(row.provider_last_update) && timestamp(row.commence_time), 'OBSERVATION_TIME')
      ensure(Date.parse(row.provider_last_update) <= Date.parse(row.acquired_at) && Date.parse(row.acquired_at) <= Date.parse(evaluatedAt), 'OBSERVATION_TIME_ORDER')
      ensure(Date.parse(row.commence_time) > Date.parse(evaluatedAt) && Date.parse(prediction.metadata.scheduled_at) > Date.parse(evaluatedAt), 'POST_START_VALUE')
    }
    ensure(Date.parse(prediction.predicted_at) <= Date.parse(evaluatedAt), 'PREDICTION_AFTER_EVALUATION')
    const pairs = [...groups.values()].filter(group => group.length === 2 && new Set(group.map(r => r.side)).size === 2)
    ensure([...groups.values()].every(group => group.length <= 2 && new Set(group.map(r => r.side)).size === group.length), 'DUPLICATE_BOOK_SIDE')
    if (!pairs.length) continue
    const complete = pairs.flat()
    const byId = new Map(complete.map(r => [r.id, r]))
    const calculated = calculateNativeValue({ prediction: { ...prediction, model_version: prediction.metadata.model_version, starter_status: prediction.metadata.starter_status, scheduled_at: prediction.metadata.scheduled_at }, observations: complete, runAsOf: evaluatedAt })
    for (const value of calculated) {
      const selected = byId.get(value.selected_side_market_observation_id)
      const pair = [byId.get(value.home_market_observation_id), byId.get(value.away_market_observation_id)]
      ensure(pair.every(r => r && r.provider === selected.provider && r.provider_event_id === selected.provider_event_id && r.acquired_at === selected.acquired_at), 'PAIR_LINKAGE')
      const freshness = pair.map(r => classifyMarketFreshness({ ...r, acquired_at: evaluatedAt }).state)
      const state = freshness.includes('STALE') ? 'STALE' : freshness.includes('AGING') ? 'AGING' : 'FRESH'
      values.push(assertDownstreamPayload('values', { ...value,
        bookmaker_name: selected.bookmaker_name ?? null, model_version_id: prediction.model_version_id, provider: selected.provider, provider_event_id: selected.provider_event_id,
        market: 'MONEYLINE', provider_market_key: 'h2h', market_freshness: state,
        temporal_eligibility: state === 'STALE' ? 'STALE_MARKET_BLOCKED' : state === 'AGING' ? 'AGING_ANALYTICAL_ONLY' : 'PREGAME_VALID',
        eligibility_flags: state === 'FRESH' ? ['PREGAME_VALID', 'COMPLETE_SAME_BOOK_TWO_SIDED_MARKET'] : [], risk_flags: [],
        evaluation_method_version: 'MLB_NATIVE_MONEYLINE_VALUE_V1', prediction_as_of: prediction.predicted_at,
        provider_last_update: selected.provider_last_update, market_acquired_at: selected.acquired_at, evaluated_at: evaluatedAt,
        metadata: { feature_snapshot_ids: prediction.metadata.feature_snapshot_ids, required_feature_missing: false },
      }))
    }
  }
  return values
}

export function buildCanonicalOfficialPicks({ values, decisionAt, scheduledByGame }) {
  ensure(timestamp(decisionAt), 'DECISION_TIME')
  const policy = loadCertifiedPolicy()
  const decisions = evaluateCertifiedPolicy({ values, runAsOf: decisionAt })
  const byGame = new Map()
  for (const decision of decisions.filter(d => d.status === 'OFFICIAL_PICK_ELIGIBLE')) {
    const row = decision.candidate
    ensure(Date.parse(scheduledByGame.get(row.game_pk)) > Date.parse(decisionAt) && Date.parse(row.evaluated_at) <= Date.parse(decisionAt), 'POST_START_PICK')
    ensure(classifyMarketFreshness({ provider_last_update: row.provider_last_update, acquired_at: decisionAt }).state === 'FRESH', 'STALE_AT_DECISION')
    const prior = byGame.get(row.game_pk)
    if (!prior || row.unit_ev > prior.candidate.unit_ev) byGame.set(row.game_pk, decision)
  }
  const rows = [...byGame.values()].map(decision => {
    const row = decision.candidate
    const payload = {
      official_pick_identity: sha256({ prediction_id: row.prediction_id, value_evaluation_id: row.id, game_pk: row.game_pk, side: row.side, policy_version: policy.version, decision_status: 'OFFICIAL_PICK', decision_basis_digest: row.evaluation_payload_digest }),
      prediction_id: row.prediction_id, value_evaluation_id: row.id, game_pk: row.game_pk, sport: 'MLB', market: 'MONEYLINE', side: row.side,
      bookmaker_key: row.bookmaker_key, bookmaker_name: row.bookmaker_name, american_odds: row.american_odds,
      model_version: row.model_version, model_probability: row.model_probability, consensus_probability: row.consensus_probability, consensus_edge: row.consensus_edge, unit_ev: row.unit_ev,
      policy_version: policy.version, decision_status: 'OFFICIAL_PICK', eligibility_flags: row.eligibility_flags, risk_flags: decision.risk_flags,
      reason_codes: decision.reason_codes, blocker_codes: decision.blocker_codes, prediction_as_of: row.prediction_as_of,
      market_acquired_at: row.market_acquired_at, evaluated_at: row.evaluated_at, decision_at: decisionAt, source_payload_digest: row.source_payload_digest,
      metadata: { policy_config_digest: policy.config.digest, provider_last_update: row.provider_last_update },
    }
    return assertDownstreamPayload('officialPicks', { ...payload, decision_payload_digest: sha256(payload) })
  })
  return { decisions, rows }
}
