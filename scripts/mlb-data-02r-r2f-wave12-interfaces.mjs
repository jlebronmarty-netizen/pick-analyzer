import {
  assertGameScope,
  assertIsoTimestamp,
  assertNoLiveExecute,
  assertProviderBudget,
  classifyInsertReuseConflict,
  makeProviderAccounting,
  makeRunContext,
  normalizeGamePk,
  sha256,
  stageResult,
  uniqueGamePks,
} from './mlb-data-02r-r2f-stage-contracts.mjs'

export const R2F_POLICY_VERSION = 'MLB_MONEYLINE_OFFICIAL_PICK_POLICY_V1'
export const R2F_MODEL_VERSION = 'MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1'
export const R2F_FEATURE_SET = 'MLB_ML_FEATURE_SET_V1'
export const R2F_FEATURE_COUNT = 76
export const R2F_RAW_BATCH_SIZE = 100

function statusText(game) {
  return String(game.status?.detailedState ?? game.status?.abstractGameState ?? game.status ?? '').toUpperCase()
}

function isCompleted(game) {
  return ['FINAL', 'GAME OVER'].includes(String(game.status?.abstractGameState ?? '').toUpperCase()) || ['F', 'O'].includes(String(game.status?.statusCode ?? '').toUpperCase())
}

function isInProgress(game) {
  return String(game.status?.abstractGameState ?? '').toUpperCase() === 'LIVE' || ['I', 'M', 'N'].includes(String(game.status?.statusCode ?? '').toUpperCase())
}

function isPostponed(game) {
  return /POSTPONED|SUSPENDED|CANCELLED|CANCELED/.test(statusText(game))
}

function normalizeScheduleGame(game, teamMap = new Map()) {
  const homeOfficialId = Number(game.teams?.home?.team?.id ?? game.home_mlb_team_id ?? game.homeMlbTeamId)
  const awayOfficialId = Number(game.teams?.away?.team?.id ?? game.away_mlb_team_id ?? game.awayMlbTeamId)
  const home = teamMap.get(homeOfficialId) ?? { canonicalId: game.home_team_id ?? homeOfficialId, abbreviation: game.teams?.home?.team?.abbreviation ?? game.home ?? null }
  const away = teamMap.get(awayOfficialId) ?? { canonicalId: game.away_team_id ?? awayOfficialId, abbreviation: game.teams?.away?.team?.abbreviation ?? game.away ?? null }
  const scheduledAt = game.gameDate ?? game.scheduled_at ?? game.start_time
  const gamePk = normalizeGamePk(game.gamePk ?? game.game_pk)
  const officialStatus = game.status?.detailedState ?? game.status?.abstractGameState ?? game.status ?? null
  let pregameClassification = 'PREGAME_SAFE'
  if (isInProgress(game)) pregameClassification = 'STARTED_IN_PROGRESS'
  else if (isCompleted(game)) pregameClassification = 'FINAL'
  else if (isPostponed(game)) pregameClassification = 'POSTPONED_OR_SUSPENDED'
  return {
    game_pk: gamePk,
    start_time: scheduledAt,
    scheduled_at: scheduledAt,
    game_date: game.officialDate ?? game.game_date ?? String(scheduledAt ?? '').slice(0, 10),
    game_type: game.gameType ?? game.game_type ?? null,
    metadata: {
      ...(game.metadata ?? {}),
      officialDate: game.officialDate ?? game.metadata?.officialDate ?? null,
      abstractGameState: game.status?.abstractGameState ?? game.metadata?.abstractGameState ?? null,
      statusCode: game.status?.statusCode ?? game.metadata?.statusCode ?? null,
      homeMlbTeamId: homeOfficialId,
      awayMlbTeamId: awayOfficialId,
      homeProbablePitcher: game.teams?.home?.probablePitcher ?? game.metadata?.homeProbablePitcher ?? null,
      awayProbablePitcher: game.teams?.away?.probablePitcher ?? game.metadata?.awayProbablePitcher ?? null,
    },
    home_team_id: home.canonicalId,
    away_team_id: away.canonicalId,
    home: { team_id: home.canonicalId, mlb_team_id: homeOfficialId, abbreviation: home.abbreviation },
    away: { team_id: away.canonicalId, mlb_team_id: awayOfficialId, abbreviation: away.abbreviation },
    status: officialStatus,
    doubleheader: game.doubleHeader ?? game.doubleheader ?? null,
    game_number: game.gameNumber ?? game.game_number ?? null,
    doubleheader_identity: `${game.officialDate ?? game.game_date ?? String(scheduledAt ?? '').slice(0, 10)}:${away.canonicalId}:${home.canonicalId}:${game.gameNumber ?? game.game_number ?? 1}`,
    starter_evidence: {
      homeProbablePitcher: game.teams?.home?.probablePitcher ?? game.metadata?.homeProbablePitcher ?? null,
      awayProbablePitcher: game.teams?.away?.probablePitcher ?? game.metadata?.awayProbablePitcher ?? null,
    },
    pregame_classification: pregameClassification,
    source_payload_digest: sha256(game),
  }
}

export async function getCurrentSlate({
  mode = 'DRY_RUN',
  runDate,
  runAsOf,
  providerClient = null,
  providerBudget = {},
  injectedEvidence = null,
  teamMap = new Map(),
  liveAuthorization = false,
} = {}) {
  assertNoLiveExecute(mode, liveAuthorization)
  assertIsoTimestamp(runAsOf, 'run_as_of')
  let evidence = injectedEvidence
  let providerCalls = 0
  if (!evidence) {
    if (mode !== 'LIVE_EXECUTE') throw new Error('SCHEDULE_INJECTED_EVIDENCE_REQUIRED_FOR_DRY_RUN')
    assertProviderBudget(providerBudget, 'MLB_OFFICIAL', 1, mode)
    if (!providerClient?.getSchedule) throw new Error('MLB_OFFICIAL_PROVIDER_CLIENT_REQUIRED')
    evidence = await providerClient.getSchedule({ runDate, runAsOf })
    providerCalls = 1
  }
  const sourceGames = Array.isArray(evidence?.dates)
    ? evidence.dates.flatMap((date) => date.games ?? [])
    : Array.isArray(evidence?.games)
      ? evidence.games
      : []
  const games = [...new Map(sourceGames.map((game) => [normalizeGamePk(game.gamePk ?? game.game_pk), normalizeScheduleGame(game, teamMap)])).values()]
  return stageResult({
    stage: '01 schedule sync',
    mode,
    plannedRows: games.length,
    providerCalls,
    artifact: {
      runDate,
      runAsOf,
      games,
      providerAccounting: providerCalls ? makeProviderAccounting('MLB_OFFICIAL', 1, 1) : makeProviderAccounting('MLB_OFFICIAL', 0, 0),
    },
  })
}

export function classifyStarterReadiness({ games = [], runAsOf, featureEvidence = new Map() } = {}) {
  assertIsoTimestamp(runAsOf, 'run_as_of')
  const rows = games.map((game) => {
    const status = String(game.status ?? '').toUpperCase()
    let classification = 'PROBABLE'
    const reasons = []
    if (['FINAL', 'GAME OVER', 'COMPLETED', 'IN PROGRESS', 'LIVE'].includes(status) || Date.parse(game.start_time ?? game.scheduled_at) <= Date.parse(runAsOf)) {
      classification = 'UNKNOWN'
      reasons.push('GAME_NOT_PREGAME')
    }
    const starter = game.starter_evidence ?? {}
    if (starter.homeProbablePitcher?.changed || starter.awayProbablePitcher?.changed) {
      classification = 'CHANGED'
      reasons.push('STARTER_CHANGED')
    } else if (!starter.homeProbablePitcher?.id || !starter.awayProbablePitcher?.id) {
      classification = 'UNKNOWN'
      reasons.push('STARTER_UNKNOWN')
    } else if (starter.homeProbablePitcher?.confirmed && starter.awayProbablePitcher?.confirmed) {
      classification = 'CONFIRMED'
      reasons.push('STARTER_CONFIRMED')
    } else {
      reasons.push('PROBABLE_STARTER')
    }
    const support = featureEvidence instanceof Map ? featureEvidence.get(Number(game.game_pk)) : featureEvidence?.[String(game.game_pk)]
    if (support?.requiredFeatureMissing) {
      classification = 'UNKNOWN'
      reasons.push('REQUIRED_FEATURE_MISSING')
    }
    return { game_pk: Number(game.game_pk), classification, reasons, evidence: { starter, support: support ?? null } }
  })
  return stageResult({ stage: '05 starter readiness', mode: 'READBACK_ONLY', plannedRows: rows.length, artifact: { rows } })
}

function transformVector(vector, preprocessing) {
  return vector.map((value, index) => {
    const filled = Number.isFinite(value) ? value : preprocessing.medians[index]
    return (filled - preprocessing.means[index]) / preprocessing.stds[index]
  })
}

function sigmoid(value) {
  if (value > 35) return 1 - 1e-15
  if (value < -35) return 1e-15
  return 1 / (1 + Math.exp(-value))
}

export function inferMoneyline({ gamePk, featureVector, modelArtifact, runAsOf, modelVersion = R2F_MODEL_VERSION } = {}) {
  assertIsoTimestamp(runAsOf, 'run_as_of')
  if (modelVersion !== R2F_MODEL_VERSION) throw new Error(`MODEL_VERSION_NOT_CERTIFIED:${modelVersion}`)
  if (!Array.isArray(featureVector) || featureVector.length !== R2F_FEATURE_COUNT) throw new Error(`FEATURE_VECTOR_LENGTH_MISMATCH:${featureVector?.length}`)
  if (!modelArtifact?.preprocessing || !Array.isArray(modelArtifact.weights) || modelArtifact.weights.length !== R2F_FEATURE_COUNT + 1) throw new Error('MODEL_ARTIFACT_SHAPE_MISMATCH')
  const transformed = transformVector(featureVector, modelArtifact.preprocessing)
  let linear = modelArtifact.weights[0]
  for (let index = 0; index < transformed.length; index += 1) linear += modelArtifact.weights[index + 1] * transformed[index]
  const homeProbability = sigmoid(linear)
  const awayProbability = 1 - homeProbability
  const inputPayload = {
    game_pk: normalizeGamePk(gamePk),
    model_version: modelVersion,
    feature_set: R2F_FEATURE_SET,
    as_of: runAsOf,
    ordered_feature_values: featureVector.map((value) => Number.isFinite(value) ? Number(value.toFixed(12)) : null),
  }
  return stageResult({
    stage: '06 moneyline inference',
    mode: 'READBACK_ONLY',
    plannedRows: 1,
    artifact: {
      game_pk: normalizeGamePk(gamePk),
      home_probability: homeProbability,
      away_probability: awayProbability,
      input_digest: sha256(inputPayload),
      range_audit: homeProbability > 0 && homeProbability < 1 && awayProbability > 0 && awayProbability < 1 ? 'PASS' : 'FAIL',
      validation_state: Number.isFinite(homeProbability) && Math.abs(homeProbability + awayProbability - 1) < 1e-12 ? 'PASS' : 'FAIL',
    },
  })
}

function num(value) {
  return Number(value)
}

function normalizeStarterStatus(value) {
  const status = String(value ?? 'UNKNOWN')
  if (status.includes('CONFIRMED')) return 'CONFIRMED'
  if (status.includes('PROBABLE')) return 'PROBABLE'
  if (status.includes('CHANGED')) return 'CHANGED'
  return status
}

export function evaluateOfficialPickPolicy({ candidate, policy, runAsOf } = {}) {
  assertIsoTimestamp(runAsOf, 'run_as_of')
  if (policy?.version !== R2F_POLICY_VERSION) throw new Error(`POLICY_VERSION_MISMATCH:${policy?.version}`)
  const blockers = []
  const riskFlags = []
  const starter = normalizeStarterStatus(candidate.starter_status)
  const marketDispersion = num(candidate.market_dispersion)
  const modelProbability = num(candidate.model_probability)
  const consensusEdge = num(candidate.consensus_edge)
  const unitEv = num(candidate.unit_ev)
  const bookCount = Number(candidate.book_count)
  const freshness = candidate.market_freshness
  if (!['PREGAME_VALID', 'PREGAME_VALID_AT_MARKET_ACQUISITION'].includes(candidate.temporal_eligibility)) blockers.push('GAME_STARTED')
  if (freshness === 'STALE') blockers.push('STALE_MARKET')
  if (freshness === 'AGING') blockers.push('AGING_MARKET_ANALYTICAL_ONLY')
  if (starter === 'UNKNOWN') blockers.push('STARTER_UNKNOWN')
  if (starter === 'CHANGED') blockers.push('STARTER_CHANGED')
  if (!candidate.home_market_observation_id || !candidate.away_market_observation_id || candidate.home_market_observation_id === candidate.away_market_observation_id) blockers.push('NO_COMPLETE_TWO_SIDED_MARKET')
  if (candidate.selected_side_market_observation_id !== (candidate.side === 'HOME' ? candidate.home_market_observation_id : candidate.away_market_observation_id)) blockers.push('AMBIGUOUS_MARKET')
  if (modelProbability < policy.modelRange.min || modelProbability > policy.modelRange.max) blockers.push('MODEL_OUT_OF_RANGE')
  if (!candidate.prediction_id || !candidate.source_payload_digest || !candidate.evaluation_payload_digest) blockers.push('SOURCE_LINKAGE_FAILURE')
  if (marketDispersion > policy.thresholds.dispersionMaximum) blockers.push('HIGH_RISK_CONFLICT')
  if (candidate.metadata?.required_feature_missing === true) blockers.push('REQUIRED_FEATURE_MISSING')
  if (starter === 'PROBABLE') riskFlags.push('PROBABLE_STARTER')
  if (marketDispersion > 0.015) riskFlags.push('MODERATE_MARKET_DISPERSION')
  if (Math.abs(Number(candidate.american_odds)) >= 180) riskFlags.push('EXTREME_PRICE')
  if (bookCount < policy.thresholds.minimumBookCount) riskFlags.push('LOW_BOOK_COVERAGE')
  if (consensusEdge > 0 && consensusEdge < policy.thresholds.consensusEdge) riskFlags.push('WEAK_CONSENSUS_EDGE')
  if (Math.abs(modelProbability - 0.5) <= 0.025) riskFlags.push('MODEL_PROBABILITY_NEAR_50')
  const eligible = blockers.length === 0 &&
    consensusEdge >= policy.thresholds.consensusEdge &&
    unitEv >= policy.thresholds.unitEv &&
    bookCount >= policy.thresholds.minimumBookCount &&
    freshness === policy.thresholds.freshness &&
    marketDispersion <= policy.thresholds.dispersionMaximum &&
    ['CONFIRMED', 'PROBABLE'].includes(starter)
  let status = 'WATCHLIST'
  if (eligible) status = 'OFFICIAL_PICK_ELIGIBLE'
  else if (blockers.length) status = 'BLOCKED'
  else if (consensusEdge > 0 && unitEv > 0) status = 'VALUE_CANDIDATE'
  return stageResult({
    stage: '11 Official Pick policy',
    mode: 'READBACK_ONLY',
    plannedRows: 1,
    artifact: {
      status,
      reason_codes: eligible ? ['MODEL_EDGE_OVER_CONSENSUS', 'POSITIVE_BEST_PRICE_EV', 'FRESH_MARKET'] : [],
      risk_flags: riskFlags,
      blocker_codes: blockers,
      starter_status: starter,
    },
  })
}

export function readValueBoardAdapter({ board, operatingDate = null, asOf = null } = {}) {
  const rows = board?.rows ?? []
  const counts = rows.reduce((acc, row) => {
    const status = row.status ?? row.decision_status ?? 'BLOCKED'
    acc[status] = (acc[status] ?? 0) + 1
    return acc
  }, {})
  const topPick = board?.topPick ?? rows.find((row) => row.status === 'OFFICIAL_PICK') ?? rows[0] ?? null
  return stageResult({
    stage: '13 Value Board readback',
    mode: 'READBACK_ONLY',
    plannedRows: rows.length,
    artifact: {
      operatingDate,
      asOf,
      OfficialPicks: counts.OFFICIAL_PICK ?? 0,
      ValueCandidates: counts.VALUE_CANDIDATE ?? 0,
      Watchlist: counts.WATCHLIST ?? 0,
      Blocked: counts.BLOCKED ?? 0,
      Total: rows.length,
      TopPick: topPick,
      freshness: board?.freshness ?? 'UNKNOWN',
      state: board?.state ?? 'PARTIAL_OR_STALE_UNKNOWN',
    },
  })
}

function compareNullableText(left, right) {
  if (left === undefined || left === null || right === undefined || right === null) return true
  return String(left) === String(right)
}

function assertNativeGameCompatibility(plannedRows, existingRows) {
  const plannedByPk = new Map(plannedRows.map((row) => [Number(row.game_pk), row]))
  const conflicts = []
  for (const existing of existingRows) {
    const planned = plannedByPk.get(Number(existing.game_pk))
    if (!planned) continue
    for (const field of ['game_date', 'home_team_id', 'away_team_id']) {
      if (!compareNullableText(planned[field], existing[field])) {
        conflicts.push({ game_pk: Number(existing.game_pk), field })
      }
    }
  }
  if (conflicts.length) throw new Error(`BLOCK_CONFLICT:${conflicts.length}:NATIVE_GAME_IDENTITY_MISMATCH`)
}

export async function reconcileNativeIdentity({
  mode = 'DRY_RUN',
  runContext = makeRunContext(),
  scheduleEvidence = [],
  eligibleGamePks = [],
  dmlCaps = {},
  repository,
  liveAuthorization = false,
} = {}) {
  assertNoLiveExecute(mode, liveAuthorization)
  const eligible = uniqueGamePks(eligibleGamePks)
  assertGameScope(scheduleEvidence, eligible)
  const games = scheduleEvidence.map((game) => ({
    game_pk: Number(game.game_pk),
    season: Number(game.season ?? String(game.game_date ?? runContext.run_date).slice(0, 4)),
    game_date: game.game_date,
    scheduled_at: game.scheduled_at ?? game.start_time,
    home_team_id: game.home_team_id,
    away_team_id: game.away_team_id,
    source_payload_digest: game.source_payload_digest ?? sha256(game),
  }))
  assertGameScope(games, eligible)
  const playersById = new Map()
  for (const game of scheduleEvidence) {
    for (const pitcher of [game.starter_evidence?.homeProbablePitcher, game.starter_evidence?.awayProbablePitcher]) {
      if (!pitcher?.id) continue
      playersById.set(Number(pitcher.id), {
        game_pk: Number(game.game_pk),
        mlbam_person_id: Number(pitcher.id),
        full_name: pitcher.fullName ?? pitcher.name ?? null,
        source_payload_digest: sha256(pitcher),
      })
    }
  }
  const playerRows = [...playersById.values()]
  const existingGames = await repository.readNativeGames(games.map((game) => game.game_pk))
  const existingPlayers = await repository.readNativePlayers(playerRows.map((row) => row.mlbam_person_id))
  assertNativeGameCompatibility(games, existingGames)
  const gamePlan = classifyInsertReuseConflict({ plannedRows: games, existingRows: existingGames, identityFields: ['game_pk'], digestField: null, eligibleGamePks: eligible, cap: dmlCaps.games ?? null })
  const playerPlan = classifyInsertReuseConflict({ plannedRows: playerRows, existingRows: existingPlayers, identityFields: ['mlbam_person_id'], digestField: null, eligibleGamePks: eligible, cap: dmlCaps.players ?? null })
  return stageResult({
    stage: '02 native reconciliation',
    mode,
    plannedRows: gamePlan.plannedRows + playerPlan.plannedRows,
    insertEligible: gamePlan.insertEligible + playerPlan.insertEligible,
    reuseNoOp: gamePlan.reuseNoOp + playerPlan.reuseNoOp,
    blockConflict: 0,
    artifact: { gamePlan, playerPlan, productionDml: 0 },
  })
}

export function statcastRowIdentity(row) {
  return `statcast:mlb:${String(row.game_year ?? row.season ?? String(row.game_date).slice(0, 4))}:${row.game_pk}:${row.at_bat_number}:${row.pitch_number}`
}

export function normalizeStatcastRows(rows, eligibleGamePks) {
  const eligible = new Set(uniqueGamePks(eligibleGamePks))
  return rows.map((row) => {
    const gamePk = normalizeGamePk(row.game_pk)
    if (!eligible.has(gamePk)) throw new Error(`OUT_OF_SCOPE_GAME_PK:${gamePk}`)
    const normalized = {
      ...row,
      game_pk: gamePk,
      id: row.id ?? statcastRowIdentity(row),
      raw_payload_digest: row.raw_payload_digest ?? sha256(row.raw_payload ?? row),
    }
    normalized.identity = normalized.id
    return normalized
  })
}

export async function reconcileCurrentSlateStatcast({
  mode = 'DRY_RUN',
  eligibleGamePks = [],
  dependencyDates = [],
  runAsOf,
  cachePolicy = { strategy: 'INJECTED_OR_CACHE_FIRST' },
  providerBudget = {},
  rawCap = null,
  checkpoint = null,
  providerClient = null,
  injectedEvidence = null,
  repository,
  allowFullSeason = false,
  liveAuthorization = false,
} = {}) {
  assertNoLiveExecute(mode, liveAuthorization)
  assertIsoTimestamp(runAsOf, 'run_as_of')
  const eligible = uniqueGamePks(eligibleGamePks)
  if (allowFullSeason || eligible.length === 0) throw new Error('R2_RAW_FULL_SEASON_SCOPE_FORBIDDEN')
  if (dependencyDates.length > 14) throw new Error(`R2_RAW_DEPENDENCY_WINDOW_TOO_BROAD:${dependencyDates.length}`)
  let sourceRows = injectedEvidence?.rows ?? []
  let providerCalls = 0
  if (!injectedEvidence) {
    if (mode !== 'LIVE_EXECUTE') throw new Error('RAW_INJECTED_EVIDENCE_REQUIRED_FOR_DRY_RUN')
    assertProviderBudget(providerBudget, 'STATCAST', eligible.length, mode)
    if (!providerClient?.fetchRowsForGames) throw new Error('STATCAST_PROVIDER_CLIENT_REQUIRED')
    sourceRows = await providerClient.fetchRowsForGames({ eligibleGamePks: eligible, dependencyDates, runAsOf, cachePolicy })
    providerCalls = eligible.length
  }
  const plannedRows = normalizeStatcastRows(sourceRows, eligible)
  const existingRows = await repository.readRawRows(plannedRows.map((row) => row.id))
  const plan = classifyInsertReuseConflict({
    plannedRows,
    existingRows,
    identityFields: ['id'],
    digestField: 'raw_payload_digest',
    eligibleGamePks: eligible,
    cap: rawCap,
  })
  checkpoint?.record?.('raw_plan', { plannedRows: plannedRows.length })
  return stageResult({
    stage: '03 raw Statcast reconciliation',
    mode,
    plannedRows: plannedRows.length,
    insertEligible: plan.insertEligible,
    reuseNoOp: plan.reuseNoOp,
    blockConflict: plan.blockConflict,
    providerCalls,
    artifact: {
      target: 'public.pick2_raw_mlb_statcast_pitches',
      batchSize: R2F_RAW_BATCH_SIZE,
      sourceIdentities: plannedRows.map((row) => row.id),
      present: plan.reuseNoOp,
      missing: plan.insertEligible,
      duplicates: plannedRows.length - new Set(plannedRows.map((row) => row.id)).size,
      unexpected: 0,
      providerAccounting: providerCalls ? makeProviderAccounting('STATCAST', providerCalls, providerCalls) : makeProviderAccounting('STATCAST', 0, 0),
      classifications: plan.classifications,
    },
  })
}

export async function planCurrentSlateFeatures({
  mode = 'DRY_RUN',
  targetGamePks = [],
  runAsOf,
  perDomainCaps = {},
  repository,
  plannedFeatureRows = {},
  liveAuthorization = false,
} = {}) {
  assertNoLiveExecute(mode, liveAuthorization)
  assertIsoTimestamp(runAsOf, 'run_as_of')
  const eligible = uniqueGamePks(targetGamePks)
  const domains = ['snapshots', 'team', 'starter', 'bullpen', 'batter', 'matchup', 'firstInning']
  const plans = {}
  for (const domain of domains) {
    const rows = (plannedFeatureRows[domain] ?? []).map((row) => ({
      ...row,
      target_game_pk: normalizeGamePk(row.target_game_pk ?? row.game_pk),
      identity: row.identity ?? row.deterministic_identity ?? `${domain}:${row.target_game_pk ?? row.game_pk}:${row.subject_id ?? row.team_id ?? row.mlbam_pitcher_id ?? row.mlbam_batter_id ?? 'game'}:${row.feature_version ?? 'v1'}`,
      feature_digest: row.feature_digest ?? row.input_digest ?? sha256(row.features ?? row),
    }))
    assertGameScope(rows, eligible, (row) => row.target_game_pk)
    const existing = await repository.readFeatureRows(domain, rows.map((row) => row.identity), rows)
    plans[domain] = classifyInsertReuseConflict({
      plannedRows: rows,
      existingRows: existing,
      identityFields: ['identity'],
      digestField: 'feature_digest',
      eligibleGamePks: eligible,
      cap: perDomainCaps[domain] ?? null,
      readGamePk: (row) => row.target_game_pk,
    })
  }
  const totals = Object.values(plans).reduce((acc, plan) => {
    acc.plannedRows += plan.plannedRows
    acc.insertEligible += plan.insertEligible
    acc.reuseNoOp += plan.reuseNoOp
    acc.blockConflict += plan.blockConflict
    return acc
  }, { plannedRows: 0, insertEligible: 0, reuseNoOp: 0, blockConflict: 0 })
  return stageResult({
    stage: '04 feature refresh',
    mode,
    ...totals,
    artifact: {
      domains: plans,
      targetGamePks: eligible,
      championFeatureSemantics: 'MLB_ML_FEATURE_SET_V1_PRESERVED',
      historicalReadsAllowed: true,
      productionDml: 0,
    },
  })
}
