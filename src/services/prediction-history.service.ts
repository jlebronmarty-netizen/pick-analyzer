import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  evaluateProductionDataGate,
  isProductionEligibleRow,
} from '@/services/production-data-gate.service'
import { evaluateRecommendationEligibility } from '@/services/recommendation-eligibility-policy.service'
import { getNextSlateStatus } from '@/services/next-slate.service'
import { getMlbStarterWeatherStadiumIntelligence } from '@/services/mlb-starter-weather-stadium-intelligence.service'

export type PredictionHistoryInput = {
  sport_key: string
  game_id: string
  commence_time: string
  home_team: string
  away_team: string
  team: string
  opponent: string
  market?: string
  sportsbook?: string
  odds: number | null
  implied_probability: number | null
  model_probability: number
  edge: number
  ev: number
  confidence: number
  recommended_pick: boolean
  selection?: string | null
  line?: number | null
  projected_line?: number | null
  odds_timestamp?: string | null
  generated_at?: string
  cutoff_at?: string | null
  model_version?: string | null
  feature_snapshot?: Record<string, unknown>
  feature_snapshot_id?: string | null
  feature_snapshot_key?: string | null
  feature_set_version?: string | null
  feature_snapshot_generated_at?: string | null
  production_eligible?: boolean
  trial?: boolean
  scrambled?: boolean
  validation_warnings?: string[]
  validation_status?: string
  lifecycle_status?: string
  skip_reason?: string | null
  settlement_market?: string | null
  status?: string
  result?: string
  stake?: number
  profit?: number | null
}

type HistoricalReplayRow = PredictionHistoryInput & {
  id: string
  sport_key: string
  game_id: string
  home_team: string
  away_team: string
  team: string
  opponent: string
  market?: string | null
  sportsbook?: string | null
  selection?: string | null
  line?: number | null
  projected_line?: number | null
  odds_timestamp?: string | null
  generated_at?: string | null
  cutoff_at?: string | null
  model_version?: string | null
  feature_snapshot_id?: string | null
  feature_snapshot_key?: string | null
  feature_set_version?: string | null
  feature_snapshot_generated_at?: string | null
  validation_warnings?: string[] | null
  validation_status?: string | null
  lifecycle_status?: string | null
  settlement_details?: Record<string, unknown> | null
  settled_at?: string | null
}

type HistoricalReplayEvent = {
  id: string
  home_team: string | null
  away_team: string | null
  start_time: string | null
  status: string | null
  home_score: number | null
  away_score: number | null
}

type HistoricalReplaySnapshot = {
  id: string
  deterministic_key: string | null
  event_id: string | null
  market: string | null
  prediction_cutoff: string | null
  as_of_timestamp: string | null
  generated_at: string | null
  model_version: string | null
  feature_set_version: string | null
  feature_values: Record<string, unknown> | null
  feature_lineage: Record<string, unknown> | null
  data_quality_score: number | null
  data_sufficiency_score: number | null
  unresolved_mapping_count: number | null
  leakage_status: string | null
  leakage_warnings: string[] | null
  trial: boolean | null
  scrambled: boolean | null
  production_eligible: boolean | null
}

type HistoricalReplayOptions = {
  sportKey: string
  date: string
  validationMode: string | null
  historicalValidation: boolean
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String) : []
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits))
}

function numberOrNull(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function brierScore(rows: HistoricalReplayRow[]) {
  const scored = rows
    .map((row) => {
      const probability = Number(row.model_probability ?? 0) / 100
      const result = String(row.result ?? row.status ?? '').toLowerCase()
      const outcome = result === 'win' ? 1 : result === 'loss' ? 0 : null
      return { probability, outcome }
    })
    .filter((row) => row.outcome !== null && Number.isFinite(row.probability))

  if (!scored.length) return null

  return round(
    scored.reduce((sum, row) => sum + (row.probability - Number(row.outcome)) ** 2, 0) /
      scored.length,
    4
  )
}

function resultLabel(row: HistoricalReplayRow) {
  return String(row.result ?? row.status ?? 'unknown').toLowerCase()
}

function marketLabel(value: string | null | undefined) {
  if (value === 'spread') return 'run_line'
  return value ?? 'unknown'
}

function formatOdds(value: number | null | undefined) {
  const odds = Number(value)
  if (!Number.isFinite(odds)) return null
  return odds > 0 ? `+${odds}` : String(odds)
}

function qualityBand(value: number) {
  if (value >= 80) return 'strong'
  if (value >= 60) return 'usable'
  if (value >= 35) return 'thin'
  return 'limited'
}

function confidenceLabel(value: number) {
  if (value >= 80) return 'Very High'
  if (value >= 70) return 'High'
  if (value >= 60) return 'Medium'
  return 'Low'
}

function reliabilityLabel(quality: number, sufficiency: number) {
  const score = Math.min(quality, sufficiency)
  if (score >= 85) return 'Strong'
  if (score >= 70) return 'Solid'
  if (score >= 55) return 'Developing'
  return 'Limited data'
}

function oddsMovementSummary(snapshot: HistoricalReplaySnapshot | undefined) {
  const values = asObject(snapshot?.feature_values)
  const oddsRows = Array.isArray(values.odds) ? values.odds.map(asObject) : []
  const timestamps = oddsRows
    .map((row) => String(row.snapshotTime ?? ''))
    .filter(Boolean)
    .sort()

  return {
    sourceRows: oddsRows.length,
    earliestSnapshot: timestamps[0] ?? null,
    latestSnapshot: timestamps[timestamps.length - 1] ?? null,
  }
}

function buildReplayExplanation(
  row: HistoricalReplayRow,
  event: HistoricalReplayEvent | undefined,
  snapshot: HistoricalReplaySnapshot | undefined
) {
  const featureSnapshot = asObject(row.feature_snapshot)
  const quality = Number(
    snapshot?.data_quality_score ?? featureSnapshot.featureQualityScore ?? 0
  )
  const sufficiency = Number(
    snapshot?.data_sufficiency_score ?? featureSnapshot.dataSufficiencyScore ?? 0
  )
  const movement = oddsMovementSummary(snapshot)
  const warnings = [
    ...asStringArray(row.validation_warnings),
    ...asStringArray(snapshot?.leakage_warnings),
    'Probable pitchers, weather, confirmed lineups, injury detail and bullpen workload were not fabricated.',
    'Final score and postgame stats were not prediction inputs.',
  ]

  return {
    mode: 'historical_validation_replay_explanation_v1',
    summary:
      `${row.team} was the model selection for ${marketLabel(row.market)} at ${formatOdds(row.odds) ?? 'unpriced'} in a quarantined historical replay. ` +
      `The linked pregame snapshot had ${qualityBand(quality)} quality (${quality}) and ${qualityBand(sufficiency)} sufficiency (${sufficiency}).`,
    positiveFactors: [
      row.edge > 0
        ? {
            direction: 'positive',
            label: 'Modeled edge',
            explanation: `Model probability exceeded sportsbook implied probability by ${round(row.edge)} percentage points.`,
            sourceAvailability: 'available',
          }
        : null,
      row.ev > 0
        ? {
            direction: 'positive',
            label: 'Expected value',
            explanation: `Pregame expected value was ${round(row.ev)}%.`,
            sourceAvailability: 'available',
          }
        : null,
    ].filter(Boolean),
    negativeFactors: [
      row.edge <= 0
        ? {
            direction: 'negative',
            label: 'No modeled edge',
            explanation: `Model edge was ${round(row.edge)}%, so this row is not a recommended wager under current policy.`,
            sourceAvailability: 'available',
          }
        : null,
      row.ev <= 0
        ? {
            direction: 'negative',
            label: 'No modeled value',
            explanation: `Expected value was ${round(row.ev)}%, so the value gate fails.`,
            sourceAvailability: 'available',
          }
        : null,
      quality < 60 || sufficiency < 60
        ? {
            direction: 'negative',
            label: 'Limited feature support',
            explanation: `Quality ${quality} and sufficiency ${sufficiency} are below official-pick defaults.`,
            sourceAvailability: 'partial',
          }
        : null,
    ].filter(Boolean),
    factors: [
      {
        label: 'Event context',
        detail: `${event?.away_team ?? row.away_team} at ${event?.home_team ?? row.home_team}, scheduled ${event?.start_time ?? row.commence_time}.`,
      },
      {
        label: 'Historical odds position',
        detail: `Offered price ${formatOdds(row.odds) ?? 'unavailable'} at ${row.sportsbook ?? 'Unknown'} with line ${row.line ?? 'none'} before cutoff ${row.cutoff_at ?? 'unknown'}.`,
      },
      {
        label: 'Line movement before cutoff',
        detail:
          movement.sourceRows > 0
            ? `${movement.sourceRows} timestamped odds rows were represented in the linked pregame snapshot from ${movement.earliestSnapshot} to ${movement.latestSnapshot}.`
            : 'No detailed line-movement rows were exposed in the compact replay payload.',
      },
      {
        label: 'Data quality',
        detail: `Feature quality ${quality}, data sufficiency ${sufficiency}, leakage status ${snapshot?.leakage_status ?? featureSnapshot.leakageStatus ?? 'unknown'}.`,
      },
    ],
    warnings: Array.from(new Set(warnings)).slice(0, 8),
  }
}

function segmentReplay(rows: HistoricalReplayRow[], keyFn: (row: HistoricalReplayRow) => string) {
  return Array.from(
    rows.reduce((map, row) => {
      const key = keyFn(row)
      map.set(key, [...(map.get(key) ?? []), row])
      return map
    }, new Map<string, HistoricalReplayRow[]>())
  ).map(([market, segmentRows]) => {
    const wins = segmentRows.filter((row) => resultLabel(row) === 'win').length
    const losses = segmentRows.filter((row) => resultLabel(row) === 'loss').length
    const pushes = segmentRows.filter((row) => resultLabel(row) === 'push').length
    const voids = segmentRows.filter((row) => resultLabel(row) === 'void').length
    const profit = segmentRows.reduce((sum, row) => sum + Number(row.profit ?? 0), 0)

    return {
      key: market,
      label: market,
      predictions: segmentRows.length,
      wins,
      losses,
      pushes,
      voids,
      winRate: segmentRows.length ? round((wins / segmentRows.length) * 100) : 0,
      technicalUnits: round(profit / 100, 2),
      brierScore: brierScore(segmentRows),
    }
  })
}

export async function savePredictionHistory(rows: PredictionHistoryInput[]) {
  if (!rows.length) {
    return {
      success: true,
      saved: 0,
    }
  }

  const requestedProductionEventIds = Array.from(
    new Set(rows.filter((row) => row.production_eligible === true).map((row) => row.game_id).filter(Boolean))
  )
  const canonicalEventIds = new Set<string>()
  if (requestedProductionEventIds.length > 0) {
    for (let index = 0; index < requestedProductionEventIds.length; index += 100) {
      const chunk = requestedProductionEventIds.slice(index, index + 100)
      const { data, error } = await supabaseAdmin
        .from('sport_events')
        .select('id')
        .in('id', chunk)
      if (error) throw new Error(`production event identity gate failed: ${error.message}`)
      for (const event of data ?? []) canonicalEventIds.add(String(event.id))
    }
  }

  const gatedRows = rows.map((row) => {
    const eventIdentityBlocked = row.production_eligible === true && !canonicalEventIds.has(row.game_id)
    const gate = evaluateProductionDataGate(row, 'prediction_persistence')
    const validationWarnings = [
      ...(row.validation_warnings ?? []),
      ...(eventIdentityBlocked
        ? ['EVENT_IDENTITY_REQUIRED: production prediction references an unimported canonical event']
        : []),
      ...(row.production_eligible === true && !gate.eligible
        ? [`Production Data Gate blocked production eligibility: ${gate.blockedReasons.join('; ')}`]
        : []),
    ]

    return {
      ...row,
      production_eligible: gate.eligible && !eventIdentityBlocked,
      validation_warnings: validationWarnings,
      validation_status:
        eventIdentityBlocked
          ? 'blocked_by_event_identity_required'
          : row.production_eligible === true && !gate.eligible
          ? 'blocked_by_production_data_gate_v1'
          : row.validation_status,
    }
  })

  const { error } = await supabaseAdmin
    .from('prediction_history')
    .upsert(gatedRows, {
      onConflict: 'sport_key,game_id,team,market,sportsbook',
    })

  if (error) {
    throw new Error(error.message)
  }

  return {
    success: true,
    saved: gatedRows.length,
  }
}

export async function settlePredictionHistory(sportKey: string) {
  const { data: predictions, error } = await supabaseAdmin
    .from('prediction_history')
    .select('*')
    .eq('sport_key', sportKey)
    .eq('result', 'pending')

  if (error) throw new Error(error.message)

  let settled = 0

  for (const pick of predictions ?? []) {
    const { data: result } = await supabaseAdmin
      .from('game_results')
      .select('*')
      .eq('sport_key', pick.sport_key)
      .eq('game_id', pick.game_id)
      .maybeSingle()

    if (!result?.winner) continue

    const pickResult =
      result.winner === pick.team
        ? 'win'
        : result.home_score === result.away_score
          ? 'push'
          : 'loss'

    const odds = Number(pick.odds)
    const stake = Number(pick.stake ?? 100)

    let profit = 0

    if (pickResult === 'win') {
      profit = odds > 0 ? stake * (odds / 100) : stake * (100 / Math.abs(odds))
    }

    if (pickResult === 'loss') {
      profit = -stake
    }

    const { error: updateError } = await supabaseAdmin
      .from('prediction_history')
      .update({
        result: pickResult,
        profit,
        settled_at: new Date().toISOString(),
      })
      .eq('id', pick.id)

    if (updateError) throw new Error(updateError.message)

    settled++
  }

  return {
    success: true,
    settled,
  }
}

export async function getPredictionPerformance(sportKey?: string) {
  let query = supabaseAdmin
    .from('prediction_history')
    .select('*')
    .neq('result', 'pending')
    .eq('production_eligible', true)

  if (sportKey) {
    query = query.eq('sport_key', sportKey)
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)

  const rows = ((data ?? []) as PredictionHistoryInput[]).filter(isProductionEligibleRow)
  const wins = rows.filter((row) => row.result === 'win').length
  const losses = rows.filter((row) => row.result === 'loss').length
  const pushes = rows.filter((row) => row.result === 'push').length
  const totalProfit = rows.reduce((sum, row) => sum + Number(row.profit ?? 0), 0)
  const totalStake = rows.reduce((sum, row) => sum + Number(row.stake ?? 0), 0)

  return {
    success: true,
    picks: rows.length,
    wins,
    losses,
    pushes,
    winRate: rows.length ? Number(((wins / rows.length) * 100).toFixed(2)) : 0,
    profit: Number(totalProfit.toFixed(2)),
    roi: totalStake ? Number(((totalProfit / totalStake) * 100).toFixed(2)) : 0,
  }
}

export async function getHistoricalValidationReplay(options: HistoricalReplayOptions) {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/
  const explicit =
    options.historicalValidation === true &&
    options.validationMode === 'quarantined' &&
    options.sportKey === 'baseball_mlb' &&
    datePattern.test(options.date)

  if (!explicit) {
    return {
      success: false,
      mode: 'historical_validation_replay_v1',
      error:
        'Historical replay requires historicalValidation=true, validationMode=quarantined, sportKey=baseball_mlb and date=YYYY-MM-DD.',
    }
  }

  const start = `${options.date}T00:00:00.000Z`
  const next = new Date(`${options.date}T00:00:00.000Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  const end = next.toISOString()

  const { data, error } = await supabaseAdmin
    .from('prediction_history')
    .select(
      'id, sport_key, game_id, commence_time, home_team, away_team, team, opponent, market, sportsbook, odds, implied_probability, model_probability, edge, ev, confidence, recommended_pick, selection, line, projected_line, odds_timestamp, generated_at, cutoff_at, model_version, feature_snapshot, feature_snapshot_id, feature_snapshot_key, feature_set_version, feature_snapshot_generated_at, production_eligible, trial, scrambled, validation_warnings, validation_status, lifecycle_status, status, result, stake, profit, settlement_details, settled_at'
    )
    .eq('sport_key', options.sportKey)
    .eq('production_eligible', false)
    .eq('trial', false)
    .eq('scrambled', false)
    .gte('commence_time', start)
    .lt('commence_time', end)
    .order('commence_time', { ascending: true })
    .order('market', { ascending: true })

  if (error) throw new Error(error.message)

  const rows = ((data ?? []) as HistoricalReplayRow[]).filter(
    (row) =>
      row.production_eligible === false &&
      row.trial === false &&
      row.scrambled === false &&
      Boolean(row.feature_snapshot_id) &&
      asObject(row.feature_snapshot).mode === 'historical_prediction_snapshot_lineage_pilot_v1'
  )
  const eventIds = Array.from(new Set(rows.map((row) => row.game_id).filter(Boolean))) as string[]
  const snapshotIds = Array.from(
    new Set(rows.map((row) => row.feature_snapshot_id).filter(Boolean))
  ) as string[]

  const eventsResult = eventIds.length
    ? await supabaseAdmin
        .from('sport_events')
        .select('id, home_team, away_team, start_time, status, home_score, away_score')
        .eq('sport_key', options.sportKey)
        .in('id', eventIds)
    : { data: [], error: null }

  if (eventsResult.error) throw new Error(eventsResult.error.message)

  const snapshotsResult = snapshotIds.length
    ? await supabaseAdmin
        .from('historical_feature_snapshots')
        .select(
          'id, deterministic_key, event_id, market, prediction_cutoff, as_of_timestamp, generated_at, model_version, feature_set_version, feature_values, feature_lineage, data_quality_score, data_sufficiency_score, unresolved_mapping_count, leakage_status, leakage_warnings, trial, scrambled, production_eligible'
        )
        .in('id', snapshotIds)
    : { data: [], error: null }

  if (snapshotsResult.error) throw new Error(snapshotsResult.error.message)

  const eventsById = new Map(
    ((eventsResult.data ?? []) as HistoricalReplayEvent[]).map((event) => [event.id, event])
  )
  const snapshotsById = new Map(
    ((snapshotsResult.data ?? []) as HistoricalReplaySnapshot[]).map((snapshot) => [snapshot.id, snapshot])
  )
  const wins = rows.filter((row) => resultLabel(row) === 'win').length
  const losses = rows.filter((row) => resultLabel(row) === 'loss').length
  const pushes = rows.filter((row) => resultLabel(row) === 'push').length
  const voids = rows.filter((row) => resultLabel(row) === 'void').length
  const pending = rows.filter((row) => resultLabel(row) === 'pending').length
  const profit = rows.reduce((sum, row) => sum + Number(row.profit ?? 0), 0)

  return {
    success: true,
    mode: 'historical_validation_replay_v1',
    generatedAt: new Date().toISOString(),
    labels: [
      'REAL NON-SCRAMBLED DATA',
      'QUARANTINED HISTORICAL VALIDATION',
      'GAMES ALREADY COMPLETED',
      'NOT A CURRENT WAGERING RECOMMENDATION',
      'NOT PRODUCTION PERFORMANCE',
    ],
    request: {
      sportKey: options.sportKey,
      date: options.date,
      validationMode: options.validationMode,
      historicalValidation: options.historicalValidation,
    },
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'stored_prediction_history_and_feature_snapshots',
    },
    productionGate: {
      currentProductionRecommendation: false,
      quarantinedHistoricalPrediction: true,
      settledHistoricalReplay: true,
      productionEligibleRows: rows.filter((row) => row.production_eligible === true).length,
      recommendedPicks: rows.filter((row) => row.recommended_pick === true).length,
    },
    summary: {
      predictions: rows.length,
      wins,
      losses,
      pushes,
      voids,
      pending,
      winRate: rows.length ? round((wins / rows.length) * 100) : 0,
      technicalUnits: round(profit / 100, 2),
      brierScore: brierScore(rows),
      featureSnapshotsLinked: new Set(rows.map((row) => row.feature_snapshot_id).filter(Boolean)).size,
      events: eventIds.length,
      markets: Array.from(new Set(rows.map((row) => marketLabel(row.market)))).sort(),
      noProductionLeakage: rows.every(
        (row) =>
          row.production_eligible === false &&
          row.trial === false &&
          row.scrambled === false &&
          row.recommended_pick !== true
      ),
    },
    byMarket: segmentReplay(rows, (row) => marketLabel(row.market)),
    byResult: segmentReplay(rows, resultLabel),
    predictions: rows.map((row) => {
      const event = row.game_id ? eventsById.get(row.game_id) : undefined
      const snapshot = row.feature_snapshot_id
        ? snapshotsById.get(row.feature_snapshot_id)
        : undefined
      const settlement = asObject(row.settlement_details)
      const dataQualityScore =
        numberOrNull(snapshot?.data_quality_score) ??
        numberOrNull(asObject(row.feature_snapshot).featureQualityScore)
      const dataSufficiencyScore =
        numberOrNull(snapshot?.data_sufficiency_score) ??
        numberOrNull(asObject(row.feature_snapshot).dataSufficiencyScore)
      const recommendationPolicy = evaluateRecommendationEligibility(
        {
          ...row,
          data_quality_score: dataQualityScore,
          data_sufficiency_score: dataSufficiencyScore,
          calibrationStatus: 'probationary',
        },
        {
          now: new Date(options.date + 'T00:00:00.000Z'),
        }
      )

      return {
        id: row.id,
        eventId: row.game_id,
        matchup: {
          homeTeam: event?.home_team ?? row.home_team,
          awayTeam: event?.away_team ?? row.away_team,
          scheduledStart: event?.start_time ?? row.commence_time,
        },
        market: marketLabel(row.market),
        selectedSide: row.selection ?? row.team,
        team: row.team,
        opponent: row.opponent,
        line: row.line ?? null,
        offeredAmericanOdds: row.odds,
        formattedOdds: formatOdds(row.odds),
        predictedProbability: row.model_probability,
        impliedProbability: row.implied_probability,
        confidence: row.confidence,
        edge: row.edge,
        ev: row.ev,
        recommendationStatusAtPredictionTime:
          row.recommended_pick === true ? 'LEGACY_RECOMMENDED_FLAG' : 'TECHNICAL_VALIDATION_ROW',
        currentRecommendationStatus: recommendationPolicy.status,
        recommendationLabel: recommendationPolicy.labels.recommendation,
        confidenceLabel: confidenceLabel(Number(row.confidence ?? 0)),
        reliabilityLabel: reliabilityLabel(
          Number(dataQualityScore ?? 0),
          Number(dataSufficiencyScore ?? 0)
        ),
        valueLabel: recommendationPolicy.labels.value,
        qualificationBlockers: recommendationPolicy.blockers,
        wouldPassCurrentOfficialPickPolicy: recommendationPolicy.officialPickEligible,
        riskGrade: qualityBand(
          Number(dataSufficiencyScore ?? 0)
        ),
        dataQualityScore,
        dataSufficiencyScore,
        featureSnapshotId: row.feature_snapshot_id,
        featureSnapshotKey: row.feature_snapshot_key,
        modelVersion: row.model_version,
        featureSetVersion: row.feature_set_version,
        predictionTimestamp: row.generated_at,
        cutoffTimestamp: row.cutoff_at,
        oddsTimestamp: row.odds_timestamp,
        sportsbook: row.sportsbook,
        finalScore: {
          homeScore: event?.home_score ?? settlement.homeScore ?? null,
          awayScore: event?.away_score ?? settlement.awayScore ?? null,
        },
        settlement: {
          result: resultLabel(row),
          status: row.status,
          settledAt: row.settled_at,
          technicalUnits:
            row.profit === null || row.profit === undefined
              ? null
              : round(Number(row.profit) / 100, 2),
          profit: row.profit,
          stake: row.stake,
        },
        flags: {
          trial: row.trial === true,
          scrambled: row.scrambled === true,
          productionEligible: row.production_eligible === true,
          quarantined: row.production_eligible === false,
          currentProductionRecommendation: false,
        },
        explanation: buildReplayExplanation(row, event, snapshot),
      }
    }),
    warnings: [
      'Replay rows are historical and settled; do not present them as current wagering recommendations.',
      'Feature explanations are compact summaries from linked pregame snapshot lineage, not raw provider payloads.',
    ],
  }
}

export async function getMlbProspectivePreview() {
  const nowMs = Date.now()
  const { data, error } = await supabaseAdmin
    .from('prediction_history')
    .select(
      'id, game_id, commence_time, home_team, away_team, team, opponent, market, sportsbook, odds, implied_probability, model_probability, edge, ev, confidence, recommended_pick, selection, line, odds_timestamp, generated_at, cutoff_at, feature_snapshot_id, feature_snapshot_key, feature_set_version, feature_snapshot_generated_at, production_eligible, trial, scrambled, validation_warnings, validation_status, lifecycle_status, skip_reason, feature_snapshot'
    )
    .eq('sport_key', 'baseball_mlb')
    .eq('production_eligible', false)
    .eq('trial', false)
    .eq('scrambled', false)
    .order('commence_time', { ascending: true })
    .order('market', { ascending: true })

  if (error) throw new Error(error.message)

  const rows = ((data ?? []) as Array<Record<string, unknown>>).filter(
    (row) =>
      asObject(row.feature_snapshot).prospective_preview === true &&
      new Date(String(row.commence_time ?? '')).getTime() > nowMs
  )
  const nextSlate = await getNextSlateStatus({ sportKey: 'baseball_mlb', leagueKey: 'mlb' })
  const intelligence = await getMlbStarterWeatherStadiumIntelligence(nextSlate.selectedSlateDate ?? '2026-07-17')
  const intelligenceByEvent = new Map(intelligence.games.filter((game) => game.eventId).map((game) => [String(game.eventId), game]))
  const statusOf = (row: Record<string, unknown>) => {
    const blockers = String(row.skip_reason ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
    if (row.recommended_pick === true || row.production_eligible === true) return 'Blocked'
    if (!blockers.length) return 'Qualified Preview'
    if (
      blockers.every((blocker) =>
        ['CALIBRATION_INSUFFICIENT', 'LOW_CONFIDENCE', 'LOW_EDGE', 'LOW_EV'].includes(blocker)
      )
    ) {
      return 'Watch'
    }
    return 'Analyzed / Not Recommended'
  }
  const candidates = rows.map((row) => {
    const snapshot = asObject(row.feature_snapshot)
    const verified = intelligenceByEvent.get(String(row.game_id))
    const comparison = asObject(snapshot.comparison)
    const previousPreview = asObject(snapshot.previousPreview)
    const blockers = String(row.skip_reason ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
    return {
      id: row.id,
      category: statusOf(row),
      matchup: `${row.away_team ?? 'Away'} @ ${row.home_team ?? 'Home'}`,
      startTime: row.commence_time,
      market: row.market,
      selection: row.selection ?? row.team,
      line: row.line,
      odds: row.odds,
      impliedProbability: row.implied_probability,
      modelProbability: row.model_probability,
      calibratedProbability: null,
      edge: row.edge,
      ev: row.ev,
      confidence: row.confidence,
      confidenceLabel: snapshot.confidenceLabel ?? null,
      reliability: snapshot.reliabilityLabel ?? null,
      reliabilityScore: snapshot.reliabilityScore ?? null,
      aiRating: snapshot.aiRating ?? null,
      aiGrade: snapshot.aiGrade ?? null,
      rankingScore: snapshot.rankingScore ?? null,
      featureQuality: Math.max(Number(asObject(snapshot).quality ?? 0), verified ? intelligence.summary.featureQualityAfter : 0) || null,
      dataSufficiency: Math.max(Number(asObject(snapshot).sufficiency ?? 0), verified ? intelligence.summary.dataSufficiencyAfter : 0) || null,
      positiveFactors: Array.isArray(snapshot.positiveFactors)
        ? Array.from(new Set([...(verified?.positiveFactors ?? []), ...snapshot.positiveFactors.map(String)]))
        : verified?.positiveFactors ?? [],
      negativeFactors: Array.isArray(snapshot.negativeFactors)
        ? Array.from(new Set([...snapshot.negativeFactors.map(String), ...(verified?.negativeFactors ?? [])]))
        : verified?.negativeFactors ?? [],
      missingData: Array.isArray(snapshot.missingData)
        ? snapshot.missingData.map(String).filter((item) => !['starting_pitcher', 'weather'].includes(item))
        : verified?.missingData ?? [],
      starterContext: verified?.starters ?? null,
      pitcherContext: verified?.pitcherFeatures ?? null,
      weatherContext: verified?.weather ?? null,
      parkContext: verified?.stadium ?? null,
      marketStability: asObject(snapshot.marketStability),
      previousPreview,
      comparison,
      sportsbook: row.sportsbook,
      oddsTimestamp: row.odds_timestamp,
      cutoff: row.cutoff_at,
      recommendationStatus: String(snapshot.recommendationStatus ?? 'ANALYZED_ONLY'),
      blockers,
      warnings: Array.isArray(row.validation_warnings)
        ? row.validation_warnings.map(String)
        : [],
      labels: [
        'QUARANTINED MODEL PREVIEW',
        'NOT AN OFFICIAL PICK',
        'NOT A WAGERING RECOMMENDATION',
      ],
    }
  }).sort((left, right) => {
    const leftRank = Number(left.rankingScore ?? 0)
    const rightRank = Number(right.rankingScore ?? 0)
    if (leftRank !== rightRank) return rightRank - leftRank
    return String(left.market).localeCompare(String(right.market))
  })
  const latestOddsCapture = candidates
    .map((item) => String(item.oddsTimestamp ?? ''))
    .filter(Boolean)
    .sort()
    .at(-1) ?? null
  const nextGameTime = candidates
    .map((item) => String(item.startTime ?? ''))
    .filter(Boolean)
    .sort()[0] ?? null

  return {
    success: true,
    mode: 'mlb_prospective_model_preview_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'stored_quarantined_prospective_preview_rows',
    },
    labels: [
      'MLB MODEL PREVIEW',
      'QUARANTINED MODEL PREVIEW',
      'NOT AN OFFICIAL PICK',
      'NOT A WAGERING RECOMMENDATION',
    ],
    summary: {
      nextGameTime,
      latestOddsCapture,
      gamesWithOdds: new Set(candidates.map((item) => item.matchup)).size,
      previewCandidates: candidates.length,
      qualifiedPreviews: candidates.filter((item) => item.category === 'Qualified Preview').length,
      watch: candidates.filter((item) => item.category === 'Watch').length,
      analyzedNotRecommended: candidates.filter((item) => item.category === 'Analyzed / Not Recommended').length,
      blocked: candidates.filter((item) => item.category === 'Blocked').length,
      officialPicks: 0,
      nextRequiredCaptureAction:
        candidates.length
          ? 'Run a final pregame odds refresh before cutoff if still within the approved provider-call budget.'
          : nextSlate.eventsFound > 0
            ? 'Upcoming games found. Preparing odds and model analysis.'
            : 'No upcoming MLB games were found in the stored seven-day slate window.',
      slateStatus: candidates.length
        ? 'active_candidates'
        : nextSlate.eventsFound > 0
          ? nextSlate.waitingForOdds > 0
            ? 'waiting_for_odds'
            : 'waiting_for_predictions'
          : 'no_upcoming_games',
      selectedSlateDate: nextSlate.selectedSlateDate,
      upcomingGames: nextSlate.eventsFound,
      readyForAnalysis: nextSlate.readyForAnalysis,
      waitingForOdds: nextSlate.waitingForOdds,
      waitingForPredictions: nextSlate.waitingForPredictions,
    },
    nextSlate,
    categories: {
      qualifiedPreview: candidates.filter((item) => item.category === 'Qualified Preview'),
      watch: candidates.filter((item) => item.category === 'Watch'),
      analyzedNotRecommended: candidates.filter((item) => item.category === 'Analyzed / Not Recommended'),
      blocked: candidates.filter((item) => item.category === 'Blocked'),
    },
    candidates,
  }
}
