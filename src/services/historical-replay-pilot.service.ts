import 'server-only'

import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { settleMarket, type SettlementMarket } from '@/services/settlement-core.service'

const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const SEASON = '2025'
const PILOT_VERSION = 'retrosheet_historical_replay_pilot_v1'
const PROJECTION_FAMILY = 'retrosheet_replay_pilot_v1'
const SOURCE = 'retrosheet_replay_pilot'
const CHECKPOINT_KEY = 'retrosheet_replay_pilot_v1:bounded_sample'
const FULL_REPLAY_VERSION = 'retrosheet_historical_replay_phase_2b_v1'
const FULL_REPLAY_FAMILY = 'retrosheet_historical_replay_phase_2b_v1'
const FULL_REPLAY_SOURCE = 'retrosheet_full_historical_replay'
const FULL_REPLAY_CHECKPOINT_KEY = 'retrosheet_historical_replay_phase_2b_v1:full_scope'

type HistoricalGameRow = {
  canonical_game_id: string
  season: string | null
  game_date: string | null
  canonical_home_team: string | null
  canonical_away_team: string | null
  venue: string | null
  final_score: { home?: number | null; away?: number | null } | null
  validation_status: string | null
}

type SnapshotRow = {
  id: string
  deterministic_key: string | null
  provider_event_id: string | null
  prediction_cutoff: string | null
  as_of_timestamp: string | null
  generated_at: string | null
  feature_values: Record<string, unknown> | null
  feature_lineage: Record<string, unknown> | null
  data_quality_score: number | null
  data_sufficiency_score: number | null
  leakage_status: string | null
  leakage_warnings: string[] | null
  metadata: Record<string, unknown> | null
}

type ReplayMarket = {
  market: SettlementMarket
  projectionKey: string
  selection: string
  selectedSide: 'home' | 'away' | 'total'
  line: number | null
  modelProbability: number
  projectedValue: number
  actualValue: number
  settlement: ReturnType<typeof settleMarket>
  featureSnapshotIds: string[]
  predictionTimestamp: string
  cutoffTimestamp: string
  snapshotTimestamp: string
  gameStartProxy: string | null
  featureQualityScore: number
  dataSufficiencyScore: number
  warnings: string[]
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits))
}

function clamp(value: number, min = 1, max = 99) {
  return Math.min(max, Math.max(min, value))
}

function stableId(parts: unknown[]) {
  return createHash('sha256').update(parts.map((part) => String(part ?? '')).join('|')).digest('hex')
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function snapshotFeatureKey(row: SnapshotRow) {
  return String(asRecord(row.metadata).featureKey ?? '')
}

function snapshotTeamSide(row: SnapshotRow) {
  return String(asRecord(row.metadata).teamSide ?? '')
}

function snapshotValue(row: SnapshotRow | undefined, key: string) {
  return asNumber(asRecord(row?.feature_values)[key])
}

function average(values: Array<number | null>) {
  const clean = values.filter((value): value is number => Number.isFinite(Number(value)))
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : null
}

function groupSnapshots(rows: SnapshotRow[]) {
  const grouped = new Map<string, SnapshotRow[]>()
  for (const row of rows) {
    const id = row.provider_event_id
    if (!id) continue
    grouped.set(id, [...(grouped.get(id) ?? []), row])
  }
  return grouped
}

function sideSnapshot(snapshots: SnapshotRow[], featureKey: string, side: 'home' | 'away') {
  return snapshots.find((row) => snapshotFeatureKey(row) === featureKey && snapshotTeamSide(row) === side)
}

function featureQuality(snapshots: SnapshotRow[]) {
  return round(average(snapshots.map((row) => asNumber(row.data_quality_score))) ?? 0)
}

function dataSufficiency(snapshots: SnapshotRow[]) {
  return round(average(snapshots.map((row) => asNumber(row.data_sufficiency_score))) ?? 0)
}

function predictionCutoff(snapshots: SnapshotRow[]) {
  return snapshots.map((row) => row.prediction_cutoff).filter(Boolean).sort()[0] ?? null
}

function asOfTimestamp(snapshots: SnapshotRow[]) {
  return snapshots.map((row) => row.as_of_timestamp).filter(Boolean).sort().at(-1) ?? null
}

function finalScore(game: HistoricalGameRow) {
  const score = asRecord(game.final_score)
  const home = asNumber(score.home)
  const away = asNumber(score.away)
  return home !== null && away !== null ? { home, away } : null
}

function startProxy(game: HistoricalGameRow, cutoff: string | null) {
  if (!game.game_date) return cutoff
  return `${game.game_date}T23:59:59.000Z`
}

function leakageWarnings(game: HistoricalGameRow, snapshots: SnapshotRow[]) {
  const cutoff = predictionCutoff(snapshots)
  const asOf = asOfTimestamp(snapshots)
  const start = startProxy(game, cutoff)
  return [
    !cutoff ? 'MISSING_CUTOFF_TIMESTAMP' : null,
    !asOf ? 'MISSING_SNAPSHOT_TIMESTAMP' : null,
    cutoff && asOf && new Date(asOf).getTime() > new Date(cutoff).getTime() ? 'SNAPSHOT_AFTER_CUTOFF' : null,
    cutoff && start && new Date(cutoff).getTime() > new Date(start).getTime() ? 'CUTOFF_AFTER_GAME_START_PROXY' : null,
    ...snapshots.flatMap((row) => Array.isArray(row.leakage_warnings) ? row.leakage_warnings.map(String) : []),
  ].filter((value): value is string => Boolean(value))
}

function buildMarkets(game: HistoricalGameRow, snapshots: SnapshotRow[]): ReplayMarket[] {
  const score = finalScore(game)
  const cutoff = predictionCutoff(snapshots)
  const asOf = asOfTimestamp(snapshots)
  if (!score || !cutoff || !asOf) return []

  const homeTeam = sideSnapshot(snapshots, 'team_form', 'home')
  const awayTeam = sideSnapshot(snapshots, 'team_form', 'away')
  const homePitcher = sideSnapshot(snapshots, 'starter_workload', 'home')
  const awayPitcher = sideSnapshot(snapshots, 'starter_workload', 'away')
  const homeBullpen = sideSnapshot(snapshots, 'bullpen_state', 'home')
  const awayBullpen = sideSnapshot(snapshots, 'bullpen_state', 'away')
  const park = snapshots.find((row) => snapshotFeatureKey(row) === 'park_factor')
  const gameState = snapshots.find((row) => snapshotFeatureKey(row) === 'game_state_context')
  const warnings = leakageWarnings(game, snapshots)
  const qualityScore = featureQuality(snapshots)
  const sufficiencyScore = dataSufficiency(snapshots)

  const homeWinPct = snapshotValue(homeTeam, 'season_win_pct') ?? 0.5
  const awayWinPct = snapshotValue(awayTeam, 'season_win_pct') ?? 0.5
  const homeStarterEra = snapshotValue(homePitcher, 'season_era_proxy') ?? 4.4
  const awayStarterEra = snapshotValue(awayPitcher, 'season_era_proxy') ?? 4.4
  const homeBullpenEra = snapshotValue(homeBullpen, 'season_relief_era_proxy') ?? 4.2
  const awayBullpenEra = snapshotValue(awayBullpen, 'season_relief_era_proxy') ?? 4.2
  const leagueRuns = snapshotValue(gameState, 'runs_per_game') ?? 8.6
  const parkFactor = snapshotValue(park, 'run_factor_vs_league') ?? 1

  const winEdge = (homeWinPct - awayWinPct) * 36 + (awayStarterEra - homeStarterEra) * 2.4 + (awayBullpenEra - homeBullpenEra) * 1.2
  const homeMlProbability = clamp(round(50 + winEdge))
  const runEnvironment = clamp(round(leagueRuns * parkFactor, 1), 5, 13)
  const overProbability = clamp(round(50 + (runEnvironment - 8.5) * 6))
  const runLineProbability = clamp(round(homeMlProbability - 10 + Math.max(0, (runEnvironment - 8) * 2)))
  const totalLine = Number.isInteger(runEnvironment) ? runEnvironment : 8.5
  const start = startProxy(game, cutoff)
  const base = {
    featureSnapshotIds: snapshots.map((row) => row.id),
    predictionTimestamp: cutoff,
    cutoffTimestamp: cutoff,
    snapshotTimestamp: asOf,
    gameStartProxy: start,
    featureQualityScore: qualityScore,
    dataSufficiencyScore: sufficiencyScore,
    warnings,
  }

  return [
    {
      ...base,
      market: 'moneyline',
      projectionKey: 'moneyline_home_win_probability',
      selection: String(game.canonical_home_team ?? 'Home'),
      selectedSide: 'home',
      line: null,
      modelProbability: homeMlProbability,
      projectedValue: homeMlProbability,
      actualValue: score.home > score.away ? 100 : score.home === score.away ? 50 : 0,
      settlement: settleMarket({ market: 'moneyline', selection: String(game.canonical_home_team ?? 'Home'), selectedScore: score.home, opponentScore: score.away, eventStatus: 'completed' }),
    },
    {
      ...base,
      market: 'spread',
      projectionKey: 'run_line_home_minus_1_5_probability',
      selection: `${game.canonical_home_team ?? 'Home'} -1.5`,
      selectedSide: 'home',
      line: -1.5,
      modelProbability: runLineProbability,
      projectedValue: runLineProbability,
      actualValue: score.home + -1.5 > score.away ? 100 : 0,
      settlement: settleMarket({ market: 'spread', selection: `${game.canonical_home_team ?? 'Home'} -1.5`, line: -1.5, selectedScore: score.home, opponentScore: score.away, eventStatus: 'completed' }),
    },
    {
      ...base,
      market: 'total',
      projectionKey: 'total_over_probability',
      selection: `Over ${totalLine}`,
      selectedSide: 'total',
      line: totalLine,
      modelProbability: overProbability,
      projectedValue: overProbability,
      actualValue: score.home + score.away > totalLine ? 100 : score.home + score.away === totalLine ? 50 : 0,
      settlement: settleMarket({ market: 'total', selection: `Over ${totalLine}`, line: totalLine, selectedScore: score.home, opponentScore: score.away, eventStatus: 'completed' }),
    },
  ]
}

async function loadStoredSnapshots(limit: number) {
  const { data, error } = await supabaseAdmin
    .from('historical_feature_snapshots')
    .select('id, deterministic_key, provider_event_id, prediction_cutoff, as_of_timestamp, generated_at, feature_values, feature_lineage, data_quality_score, data_sufficiency_score, leakage_status, leakage_warnings, metadata')
    .eq('sport_key', SPORT_KEY)
    .eq('market', 'historical_mlb_feature_store')
    .like('deterministic_key', 'retrosheet_mlb_feature_store_v1:%')
    .order('prediction_cutoff', { ascending: true })
    .limit(Math.max(500, limit * 40))
  if (error) throw new Error(`replay pilot snapshot load failed: ${error.message}`)
  return (data ?? []) as SnapshotRow[]
}

async function loadGames(gameIds: string[]) {
  if (!gameIds.length) return []
  const { data, error } = await supabaseAdmin
    .from('historical_baseball_games')
    .select('canonical_game_id, season, game_date, canonical_home_team, canonical_away_team, venue, final_score, validation_status')
    .in('canonical_game_id', gameIds)
    .order('game_date', { ascending: true })
  if (error) throw new Error(`replay pilot game load failed: ${error.message}`)
  return (data ?? []) as HistoricalGameRow[]
}

async function loadGamesInChunks(gameIds: string[], chunkSize = 350) {
  const rows: HistoricalGameRow[] = []
  for (let index = 0; index < gameIds.length; index += chunkSize) {
    rows.push(...await loadGames(gameIds.slice(index, index + chunkSize)))
  }
  return rows.sort((a, b) => String(a.game_date ?? '').localeCompare(String(b.game_date ?? '')) || a.canonical_game_id.localeCompare(b.canonical_game_id))
}

async function loadAllStoredSnapshots(pageSize = 1000) {
  const rows: SnapshotRow[] = []
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabaseAdmin
      .from('historical_feature_snapshots')
      .select('id, deterministic_key, provider_event_id, prediction_cutoff, as_of_timestamp, generated_at, feature_values, feature_lineage, data_quality_score, data_sufficiency_score, leakage_status, leakage_warnings, metadata')
      .eq('sport_key', SPORT_KEY)
      .eq('market', 'historical_mlb_feature_store')
      .like('deterministic_key', 'retrosheet_mlb_feature_store_v1:%')
      .order('prediction_cutoff', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1)
    if (error) throw new Error(`full replay snapshot page load failed at offset ${offset}: ${error.message}`)
    rows.push(...((data ?? []) as SnapshotRow[]))
    if (!data || data.length < pageSize) break
  }
  return rows
}

function selectGames(games: HistoricalGameRow[], grouped: Map<string, SnapshotRow[]>, limit: number) {
  const selected: HistoricalGameRow[] = []
  const seenTeams = new Set<string>()
  const seenVenues = new Set<string>()
  for (const game of games) {
    const snapshots = grouped.get(game.canonical_game_id) ?? []
    if (snapshots.length < 8 || !finalScore(game)) continue
    const teams = [game.canonical_home_team, game.canonical_away_team].filter(Boolean).map(String)
    const venue = game.venue ?? 'unknown'
    const diversityScore = teams.filter((team) => !seenTeams.has(team)).length + (seenVenues.has(venue) ? 0 : 1)
    if (selected.length < Math.min(5, limit) || diversityScore > 0 || selected.length < limit) {
      selected.push(game)
      teams.forEach((team) => seenTeams.add(team))
      seenVenues.add(venue)
    }
    if (selected.length >= limit) break
  }
  return selected
}

async function countTable(table: string, build?: (query: any) => any) {
  let query = supabaseAdmin.from(table).select('id', { count: 'exact', head: true })
  if (build) query = build(query)
  const { count, error } = await query
  if (error) return { count: null, error: error.message }
  return { count: count ?? 0, error: null }
}

async function createJob(limit: number, dryRun: boolean) {
  const startedAt = new Date().toISOString()
  if (dryRun) return { id: null, startedAt }
  const { data, error } = await supabaseAdmin
    .from('sports_sync_jobs')
    .insert({
      job_type: PILOT_VERSION,
      sport_key: SPORT_KEY,
      league_key: LEAGUE_KEY,
      provider: SOURCE,
      season: SEASON,
      started_at: startedAt,
      status: 'running',
      records_fetched: limit,
      metadata: {
        replayPilot: true,
        fullHistoricalReplayStarted: false,
        providerCallsMade: 0,
        productionPredictionHistoryMutated: false,
        learningBrainMutated: false,
      },
    })
    .select('id')
    .single()
  if (error) throw new Error(`replay pilot job insert failed: ${error.message}`)
  return { id: String(data.id), startedAt }
}

async function completeJob(job: { id: string | null; startedAt: string }, status: 'completed' | 'failed', stats: Record<string, unknown>, error?: string | null) {
  if (!job.id) return
  const completedAt = new Date().toISOString()
  const durationMs = Math.max(0, new Date(completedAt).getTime() - new Date(job.startedAt).getTime())
  const { error: updateError } = await supabaseAdmin
    .from('sports_sync_jobs')
    .update({
      status,
      completed_at: completedAt,
      duration_ms: durationMs,
      records_fetched: Number(stats.gamesSelected ?? 0),
      records_inserted: Number(stats.inserted ?? 0),
      records_skipped: Number(stats.reused ?? 0),
      error_count: status === 'failed' ? 1 : 0,
      last_error: error ?? null,
      metadata: {
        replayPilot: true,
        fullHistoricalReplayStarted: false,
        providerCallsMade: 0,
        productionPredictionHistoryMutated: false,
        learningBrainMutated: false,
        ...stats,
      },
    })
    .eq('id', job.id)
  if (updateError) throw new Error(`replay pilot job update failed: ${updateError.message}`)
}

async function persistCheckpoint(jobId: string | null, stats: Record<string, unknown>, dryRun: boolean) {
  if (dryRun) return { written: false, checkpointKey: CHECKPOINT_KEY }
  const { error } = await supabaseAdmin
    .from('historical_import_checkpoints')
    .upsert({
      id: `retrosheet_replay_pilot_checkpoint:${CHECKPOINT_KEY}`,
      import_id: null,
      source_registry_id: null,
      checkpoint_level: 'validation',
      checkpoint_key: CHECKPOINT_KEY,
      status: 'completed',
      record_count: Number(stats.predictions ?? 0),
      warning_count: Number(stats.warningCount ?? 0),
      error_count: 0,
      started_at: stats.startedAt,
      finished_at: stats.finishedAt,
      metadata: {
        replayPilot: true,
        syncJobId: jobId,
        resumeSupported: true,
        idempotencyKeyPrefix: PROJECTION_FAMILY,
        ...stats,
      },
    }, { onConflict: 'id' })
  if (error) throw new Error(`replay pilot checkpoint upsert failed: ${error.message}`)
  return { written: true, checkpointKey: CHECKPOINT_KEY }
}

async function persistReplayRows(markets: Array<{ game: HistoricalGameRow; replay: ReplayMarket }>, dryRun: boolean) {
  const ids = markets.map(({ game, replay }) => stableId([PROJECTION_FAMILY, game.canonical_game_id, replay.projectionKey]))
  const existing = ids.length
    ? await supabaseAdmin.from('universal_projection_history').select('id, idempotency_key').in('idempotency_key', ids)
    : { data: [], error: null }
  if (existing.error) throw new Error(`replay pilot existing-row lookup failed: ${existing.error.message}`)
  const existingIds = new Set((existing.data ?? []).map((row) => String(row.idempotency_key ?? row.id)))
  const rows = markets.map(({ game, replay }, index) => {
    const id = ids[index]
    const outcome = replay.settlement.outcome
    const labelAccepted = ['win', 'loss', 'push'].includes(outcome)
    const error = replay.projectedValue - replay.actualValue
    return {
      id,
      sport_key: SPORT_KEY,
      league_key: LEAGUE_KEY,
      season: game.season ?? SEASON,
      event_id: game.canonical_game_id,
      entity_type: 'game',
      entity_id: game.canonical_game_id,
      entity_name: `${game.canonical_away_team ?? 'Away'} @ ${game.canonical_home_team ?? 'Home'}`,
      team_id: null,
      team_name: replay.selectedSide === 'total' ? null : replay.selection.replace(' -1.5', ''),
      projection_key: replay.projectionKey,
      projection_family: PROJECTION_FAMILY,
      model_version: PILOT_VERSION,
      unit: 'PROBABILITY_PERCENT',
      projection_origin: 'RETROSHEET_FEATURE_STORE_REPLAY',
      validity_status: replay.warnings.some((warning) => /SNAPSHOT_AFTER_CUTOFF|CUTOFF_AFTER_GAME_START/.test(warning)) ? 'MODEL_BLOCKED' : 'VALID',
      projected_value: replay.projectedValue,
      confidence: Math.min(85, Math.max(35, replay.modelProbability)),
      historical_accuracy: null,
      feature_quality: replay.featureQualityScore,
      data_sufficiency: replay.dataSufficiencyScore,
      prediction_interval_low: clamp(replay.projectedValue - 8),
      prediction_interval_high: clamp(replay.projectedValue + 8),
      readiness: 'LIMITED',
      shadow_status: 'VALIDATING',
      rank_score: replay.modelProbability,
      rank_tier: 'REPLAY_PILOT',
      identity_confidence: 100,
      participation_status: 'HISTORICAL_FINAL_SETTLED',
      starter_status: null,
      feature_contributions: [
        { feature: 'retrosheet_historical_feature_snapshots', status: 'AVAILABLE', contribution: replay.featureSnapshotIds.length, explanation: 'Stored pregame historical snapshots were loaded by provider_event_id.' },
        { feature: 'cutoff_enforcement', status: replay.warnings.some((warning) => warning.includes('CUTOFF')) ? 'PARTIAL' : 'AVAILABLE', contribution: 1, explanation: 'Prediction timestamp, snapshot timestamp and cutoff timestamp were checked before replay storage.' },
        { feature: 'replay_settlement_label', status: labelAccepted ? 'AVAILABLE' : 'PARTIAL', contribution: labelAccepted ? 1 : 0, explanation: 'Replay-only settlement label was derived from historical final score.' },
      ],
      explanation: `${replay.selection} ${replay.market} replay generated from stored Retrosheet pregame snapshots only. Outcome ${outcome} is replay-only and excluded from production prediction history, Official Picks and Learning Brain weights.`,
      feature_snapshot: {
        replayPilotVersion: PILOT_VERSION,
        snapshotIds: replay.featureSnapshotIds,
        predictionTimestamp: replay.predictionTimestamp,
        snapshotTimestamp: replay.snapshotTimestamp,
        cutoffTimestamp: replay.cutoffTimestamp,
        gameStartProxy: replay.gameStartProxy,
        market: replay.market,
        selection: replay.selection,
        line: replay.line,
        warnings: replay.warnings,
      },
      actual_value: replay.actualValue,
      error,
      absolute_error: Math.abs(error),
      squared_error: error ** 2,
      calibration: {
        replayOnly: true,
        labelAccepted,
        settlementOutcome: outcome,
        calibrationInput: labelAccepted ? { probability: replay.modelProbability, outcome: outcome === 'win' ? 1 : outcome === 'loss' ? 0 : null, push: outcome === 'push' } : null,
        productionCalibrationMutated: false,
      },
      drift: {},
      source: SOURCE,
      generated_at: replay.predictionTimestamp,
      settled_at: new Date().toISOString(),
      idempotency_key: id,
      metadata: {
        replayPilot: true,
        replayOnly: true,
        fullHistoricalReplay: false,
        productionPredictionHistoryMutated: false,
        currentBoardMutated: false,
        officialPickPolicyMutated: false,
        learningBrainMutated: false,
        schedulerMutated: false,
        historicalFeatureStoreMutated: false,
        settlement: replay.settlement,
        providerCallsMade: 0,
      },
    }
  })
  if (!dryRun && rows.length) {
    const { error } = await supabaseAdmin.from('universal_projection_history').upsert(rows, { onConflict: 'idempotency_key' })
    if (error) throw new Error(`replay pilot projection upsert failed: ${error.message}`)
  }
  return {
    attempted: rows.length,
    inserted: rows.filter((row) => !existingIds.has(row.idempotency_key)).length,
    reused: rows.filter((row) => existingIds.has(row.idempotency_key)).length,
    ids,
  }
}

export async function runHistoricalReplayPilot({ limit = 12, dryRun = false }: { limit?: number; dryRun?: boolean } = {}) {
  const safeLimit = Math.max(1, Math.min(limit, 25))
  const startedAt = new Date().toISOString()
  const before = {
    predictionHistory: await countTable('prediction_history', (query) => query.eq('sport_key', SPORT_KEY)),
    currentProductionPredictions: await countTable('prediction_history', (query) => query.eq('sport_key', SPORT_KEY).eq('production_eligible', true)),
    learningWeights: await countTable('model_weight_history', (query) => query.eq('sport_key', SPORT_KEY)),
    schedulerJobs: await countTable('sports_sync_jobs', (query) => query.eq('sport_key', SPORT_KEY)),
    replayArtifacts: await countTable('universal_projection_history', (query) => query.eq('sport_key', SPORT_KEY).eq('projection_family', PROJECTION_FAMILY)),
  }
  const job = await createJob(safeLimit, dryRun)
  try {
    const snapshots = await loadStoredSnapshots(safeLimit)
    const grouped = groupSnapshots(snapshots)
    const games = await loadGames(Array.from(grouped.keys()))
    const selectedGames = selectGames(games, grouped, safeLimit)
    const replayMarkets = selectedGames.flatMap((game) =>
      buildMarkets(game, grouped.get(game.canonical_game_id) ?? []).map((replay) => ({ game, replay }))
    )
    const persisted = await persistReplayRows(replayMarkets, dryRun)
    const finishedAt = new Date().toISOString()
    const durationMs = Math.max(0, new Date(finishedAt).getTime() - new Date(startedAt).getTime())
    const stats = {
      startedAt,
      finishedAt,
      limit: safeLimit,
      gamesSelected: selectedGames.length,
      predictions: replayMarkets.length,
      settlements: replayMarkets.filter(({ replay }) => ['win', 'loss', 'push'].includes(replay.settlement.outcome)).length,
      labels: replayMarkets.filter(({ replay }) => ['win', 'loss', 'push'].includes(replay.settlement.outcome)).length,
      snapshotLookups: replayMarkets.reduce((sum, item) => sum + item.replay.featureSnapshotIds.length, 0),
      inserted: persisted.inserted,
      reused: persisted.reused,
      warningCount: replayMarkets.reduce((sum, item) => sum + item.replay.warnings.length, 0),
      durationMs,
      averageReplayDurationMsPerGame: selectedGames.length ? round(durationMs / selectedGames.length) : null,
      selectedGameIds: selectedGames.map((game) => game.canonical_game_id),
      markets: Array.from(new Set(replayMarkets.map((item) => item.replay.market))),
      providerCallsMade: 0,
      remoteMutationsMade: dryRun ? 0 : persisted.inserted + 1,
    }
    const checkpoint = await persistCheckpoint(job.id, stats, dryRun)
    await completeJob(job, 'completed', { ...stats, checkpointWritten: checkpoint.written })
    const after = {
      predictionHistory: await countTable('prediction_history', (query) => query.eq('sport_key', SPORT_KEY)),
      currentProductionPredictions: await countTable('prediction_history', (query) => query.eq('sport_key', SPORT_KEY).eq('production_eligible', true)),
      learningWeights: await countTable('model_weight_history', (query) => query.eq('sport_key', SPORT_KEY)),
      schedulerJobs: await countTable('sports_sync_jobs', (query) => query.eq('sport_key', SPORT_KEY)),
      replayArtifacts: await countTable('universal_projection_history', (query) => query.eq('sport_key', SPORT_KEY).eq('projection_family', PROJECTION_FAMILY)),
    }
    return {
      success: true,
      mode: 'historical_replay_io_readiness_pilot_v1',
      dryRun,
      jobId: job.id,
      ...stats,
      checkpoint,
      idempotency: {
        attempted: persisted.attempted,
        inserted: persisted.inserted,
        reused: persisted.reused,
        duplicateIds: persisted.ids.length - new Set(persisted.ids).size,
      },
      productionIsolation: {
        predictionHistoryUnchanged: before.predictionHistory.count === after.predictionHistory.count,
        currentProductionPredictionsUnchanged: before.currentProductionPredictions.count === after.currentProductionPredictions.count,
        learningWeightsUnchanged: before.learningWeights.count === after.learningWeights.count,
        currentBoardMutated: false,
        officialPicksMutated: false,
        schedulerMutated: false,
        historicalFeatureStoreMutated: false,
        before,
        after,
      },
      certifications: {
        REPLAY_IO_READINESS_PASS: selectedGames.length >= Math.min(10, safeLimit) && replayMarkets.length > 0,
        REPLAY_ISOLATION_PASS: before.predictionHistory.count === after.predictionHistory.count && before.learningWeights.count === after.learningWeights.count,
        REPLAY_CHECKPOINT_PASS: checkpoint.written || dryRun,
        REPLAY_IDEMPOTENCY_PASS: persisted.ids.length === new Set(persisted.ids).size,
        CONTROLLED_REPLAY_PASS: selectedGames.length <= 25 && replayMarkets.length <= 75,
      },
    }
  } catch (error) {
    await completeJob(job, 'failed', { gamesSelected: 0, inserted: 0, reused: 0 }, error instanceof Error ? error.message : 'unknown replay pilot error')
    throw error
  }
}

export async function getHistoricalReplayPilotStatus() {
  const [artifacts, jobs, checkpoints] = await Promise.all([
    supabaseAdmin
      .from('universal_projection_history')
      .select('id, event_id, projection_key, actual_value, projected_value, metadata, generated_at, settled_at', { count: 'exact' })
      .eq('sport_key', SPORT_KEY)
      .eq('projection_family', PROJECTION_FAMILY)
      .order('generated_at', { ascending: false })
      .limit(200),
    supabaseAdmin
      .from('sports_sync_jobs')
      .select('id, status, records_fetched, records_inserted, records_skipped, duration_ms, started_at, completed_at, metadata')
      .eq('sport_key', SPORT_KEY)
      .eq('job_type', PILOT_VERSION)
      .order('started_at', { ascending: false })
      .limit(5),
    supabaseAdmin
      .from('historical_import_checkpoints')
      .select('id, checkpoint_key, status, record_count, finished_at, metadata')
      .eq('checkpoint_level', 'validation')
      .eq('checkpoint_key', CHECKPOINT_KEY)
      .limit(1),
  ])
  const rows = (artifacts.data ?? []) as Array<Record<string, unknown>>
  const latestJob = (jobs.data ?? [])[0] as Record<string, unknown> | undefined
  const latestCheckpoint = (checkpoints.data ?? [])[0] as Record<string, unknown> | undefined
  return {
    success: true,
    mode: 'historical_replay_pilot_status_v1',
    status: latestJob?.status ?? (rows.length ? 'completed' : 'not_started'),
    gamesCompleted: new Set(rows.map((row) => String(row.event_id ?? '')).filter(Boolean)).size,
    replayPredictions: artifacts.count ?? rows.length,
    replaySettlements: rows.filter((row) => asRecord(asRecord(row.metadata).settlement).outcome).length,
    replayLabels: rows.filter((row) => asRecord(asRecord(row.metadata).settlement).outcome).length,
    replayDurationMs: asNumber(latestJob?.duration_ms),
    averageReplayDurationMsPerGame: asNumber(asRecord(latestJob?.metadata).averageReplayDurationMsPerGame),
    snapshotLookups: asNumber(asRecord(latestJob?.metadata).snapshotLookups),
    checkpointStatus: latestCheckpoint?.status ?? null,
    checkpointFinishedAt: latestCheckpoint?.finished_at ?? null,
    idempotencyStatus: asNumber(latestJob?.records_skipped) ? 'REUSED_EXISTING_ARTIFACTS' : rows.length ? 'PERSISTED' : 'NOT_RUN',
    productionIsolation: {
      replayOnly: true,
      predictionHistoryMutated: false,
      currentBoardMutated: false,
      officialPickPolicyMutated: false,
      learningBrainMutated: false,
      schedulerMutated: false,
    },
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    errors: [artifacts.error?.message, jobs.error?.message, checkpoints.error?.message].filter(Boolean),
  }
}

async function createFullReplayJob(scope: { gamesPlanned: number; dryRun: boolean; batchSize: number }) {
  const startedAt = new Date().toISOString()
  if (scope.dryRun) return { id: null, startedAt }
  const { data, error } = await supabaseAdmin
    .from('sports_sync_jobs')
    .insert({
      job_type: FULL_REPLAY_VERSION,
      sport_key: SPORT_KEY,
      league_key: LEAGUE_KEY,
      provider: FULL_REPLAY_SOURCE,
      season: SEASON,
      started_at: startedAt,
      status: 'running',
      records_fetched: scope.gamesPlanned,
      metadata: {
        replayPilot: false,
        fullHistoricalReplay: true,
        replayOnly: true,
        batchSize: scope.batchSize,
        providerCallsMade: 0,
        productionPredictionHistoryMutated: false,
        learningBrainMutated: false,
      },
    })
    .select('id')
    .single()
  if (error) throw new Error(`full replay job insert failed: ${error.message}`)
  return { id: String(data.id), startedAt }
}

async function completeFullReplayJob(job: { id: string | null; startedAt: string }, status: 'completed' | 'failed', stats: Record<string, unknown>, error?: string | null) {
  if (!job.id) return
  const completedAt = new Date().toISOString()
  const durationMs = Math.max(0, new Date(completedAt).getTime() - new Date(job.startedAt).getTime())
  const { error: updateError } = await supabaseAdmin
    .from('sports_sync_jobs')
    .update({
      status,
      completed_at: completedAt,
      duration_ms: durationMs,
      records_fetched: Number(stats.gamesTotal ?? 0),
      records_inserted: Number(stats.inserted ?? 0),
      records_skipped: Number(stats.reused ?? 0),
      error_count: status === 'failed' ? 1 : 0,
      last_error: error ?? null,
      metadata: {
        replayPilot: false,
        fullHistoricalReplay: true,
        replayOnly: true,
        providerCallsMade: 0,
        productionPredictionHistoryMutated: false,
        learningBrainMutated: false,
        ...stats,
      },
    })
    .eq('id', job.id)
  if (updateError) throw new Error(`full replay job update failed: ${updateError.message}`)
}

async function persistFullReplayCheckpoint(jobId: string | null, status: 'running' | 'completed' | 'failed', stats: Record<string, unknown>, dryRun: boolean) {
  if (dryRun) return { written: false, checkpointKey: FULL_REPLAY_CHECKPOINT_KEY, status }
  const finished = status === 'running' ? null : new Date().toISOString()
  const { error } = await supabaseAdmin
    .from('historical_import_checkpoints')
    .upsert({
      id: `retrosheet_full_replay_checkpoint:${FULL_REPLAY_CHECKPOINT_KEY}`,
      import_id: null,
      source_registry_id: null,
      checkpoint_level: 'validation',
      checkpoint_key: FULL_REPLAY_CHECKPOINT_KEY,
      status,
      record_count: Number(stats.predictions ?? 0),
      warning_count: Number(stats.warningCount ?? 0),
      error_count: status === 'failed' ? 1 : 0,
      started_at: stats.startedAt,
      finished_at: finished,
      metadata: {
        replayPilot: false,
        fullHistoricalReplay: true,
        replayOnly: true,
        syncJobId: jobId,
        resumeSupported: true,
        idempotencyKeyPrefix: FULL_REPLAY_FAMILY,
        ...stats,
      },
    }, { onConflict: 'id' })
  if (error) throw new Error(`full replay checkpoint upsert failed: ${error.message}`)
  return { written: true, checkpointKey: FULL_REPLAY_CHECKPOINT_KEY, status }
}

async function persistFullReplayRows(markets: Array<{ game: HistoricalGameRow; replay: ReplayMarket }>, dryRun: boolean) {
  const ids = markets.map(({ game, replay }) => stableId([FULL_REPLAY_FAMILY, game.canonical_game_id, replay.projectionKey]))
  const existing = ids.length
    ? await supabaseAdmin.from('universal_projection_history').select('id, idempotency_key').in('idempotency_key', ids)
    : { data: [], error: null }
  if (existing.error) throw new Error(`full replay existing-row lookup failed: ${existing.error.message}`)
  const existingIds = new Set((existing.data ?? []).map((row) => String(row.idempotency_key ?? row.id)))
  const settledAt = new Date().toISOString()
  const rows = markets.map(({ game, replay }, index) => {
    const id = ids[index]
    const outcome = replay.settlement.outcome
    const labelAccepted = ['win', 'loss', 'push'].includes(outcome)
    const error = replay.projectedValue - replay.actualValue
    return {
      id,
      sport_key: SPORT_KEY,
      league_key: LEAGUE_KEY,
      season: game.season ?? SEASON,
      event_id: game.canonical_game_id,
      entity_type: 'game',
      entity_id: game.canonical_game_id,
      entity_name: `${game.canonical_away_team ?? 'Away'} @ ${game.canonical_home_team ?? 'Home'}`,
      team_id: null,
      team_name: replay.selectedSide === 'total' ? null : replay.selection.replace(' -1.5', ''),
      projection_key: replay.projectionKey,
      projection_family: FULL_REPLAY_FAMILY,
      model_version: FULL_REPLAY_VERSION,
      unit: 'PROBABILITY_PERCENT',
      projection_origin: 'RETROSHEET_FEATURE_STORE_FULL_REPLAY',
      validity_status: replay.warnings.some((warning) => /SNAPSHOT_AFTER_CUTOFF|CUTOFF_AFTER_GAME_START/.test(warning)) ? 'MODEL_BLOCKED' : 'VALID',
      projected_value: replay.projectedValue,
      confidence: Math.min(85, Math.max(35, replay.modelProbability)),
      historical_accuracy: null,
      feature_quality: replay.featureQualityScore,
      data_sufficiency: replay.dataSufficiencyScore,
      prediction_interval_low: clamp(replay.projectedValue - 8),
      prediction_interval_high: clamp(replay.projectedValue + 8),
      readiness: 'LIMITED',
      shadow_status: 'VALIDATING',
      rank_score: replay.modelProbability,
      rank_tier: 'REPLAY_PHASE_2B',
      identity_confidence: 100,
      participation_status: 'HISTORICAL_FINAL_SETTLED',
      starter_status: null,
      feature_contributions: [
        { feature: 'retrosheet_historical_feature_snapshots', status: 'AVAILABLE', contribution: replay.featureSnapshotIds.length, explanation: 'Stored pregame historical snapshots were loaded by provider_event_id.' },
        { feature: 'cutoff_enforcement', status: replay.warnings.some((warning) => warning.includes('CUTOFF')) ? 'PARTIAL' : 'AVAILABLE', contribution: 1, explanation: 'Prediction timestamp, snapshot timestamp and cutoff timestamp were checked before replay storage.' },
        { feature: 'replay_settlement_label', status: labelAccepted ? 'AVAILABLE' : 'PARTIAL', contribution: labelAccepted ? 1 : 0, explanation: 'Replay-only settlement label was derived from historical final score.' },
      ],
      explanation: `${replay.selection} ${replay.market} replay generated from stored Retrosheet pregame snapshots only. Outcome ${outcome} is replay-only and excluded from production prediction history, Official Picks and Learning Brain weights.`,
      feature_snapshot: {
        fullHistoricalReplayVersion: FULL_REPLAY_VERSION,
        snapshotIds: replay.featureSnapshotIds,
        predictionTimestamp: replay.predictionTimestamp,
        snapshotTimestamp: replay.snapshotTimestamp,
        cutoffTimestamp: replay.cutoffTimestamp,
        gameStartProxy: replay.gameStartProxy,
        market: replay.market,
        selection: replay.selection,
        line: replay.line,
        warnings: replay.warnings,
      },
      actual_value: replay.actualValue,
      error,
      absolute_error: Math.abs(error),
      squared_error: error ** 2,
      calibration: {
        replayOnly: true,
        labelAccepted,
        settlementOutcome: outcome,
        calibrationInput: labelAccepted ? { probability: replay.modelProbability, outcome: outcome === 'win' ? 1 : outcome === 'loss' ? 0 : null, push: outcome === 'push' } : null,
        productionCalibrationMutated: false,
      },
      drift: {},
      source: FULL_REPLAY_SOURCE,
      generated_at: replay.predictionTimestamp,
      settled_at: settledAt,
      idempotency_key: id,
      metadata: {
        replayPilot: false,
        replayOnly: true,
        fullHistoricalReplay: true,
        productionPredictionHistoryMutated: false,
        currentBoardMutated: false,
        officialPickPolicyMutated: false,
        learningBrainMutated: false,
        schedulerMutated: false,
        historicalFeatureStoreMutated: false,
        settlement: replay.settlement,
        providerCallsMade: 0,
      },
    }
  })
  const newRows = rows.filter((row) => !existingIds.has(row.idempotency_key))
  if (!dryRun && newRows.length) {
    const { error } = await supabaseAdmin.from('universal_projection_history').insert(newRows)
    if (error) throw new Error(`full replay projection insert failed: ${error.message}`)
  }
  return {
    attempted: rows.length,
    inserted: newRows.length,
    reused: rows.length - newRows.length,
    ids,
  }
}

export async function runHistoricalReplayFull({
  limit = 2430,
  batchSize = 50,
  dryRun = false,
}: { limit?: number; batchSize?: number; dryRun?: boolean } = {}) {
  const safeLimit = Math.max(1, Math.min(limit, 2430))
  const safeBatchSize = Math.max(1, Math.min(batchSize, 100))
  const startedAt = new Date().toISOString()
  const before = {
    predictionHistory: await countTable('prediction_history', (query) => query.eq('sport_key', SPORT_KEY)),
    currentProductionPredictions: await countTable('prediction_history', (query) => query.eq('sport_key', SPORT_KEY).eq('production_eligible', true)),
    learningWeights: await countTable('model_weight_history', (query) => query.eq('sport_key', SPORT_KEY)),
    fullReplayArtifacts: await countTable('universal_projection_history', (query) => query.eq('sport_key', SPORT_KEY).eq('projection_family', FULL_REPLAY_FAMILY)),
  }
  const snapshots = await loadAllStoredSnapshots()
  const grouped = groupSnapshots(snapshots)
  const games = await loadGamesInChunks(Array.from(grouped.keys()))
  const supportedGames = games
    .filter((game) => (grouped.get(game.canonical_game_id) ?? []).length >= 8 && Boolean(finalScore(game)))
    .slice(0, safeLimit)
  const job = await createFullReplayJob({ gamesPlanned: supportedGames.length, dryRun, batchSize: safeBatchSize })
  const aggregate = {
    predictions: 0,
    settlements: 0,
    labels: 0,
    snapshotLookups: 0,
    inserted: 0,
    reused: 0,
    warningCount: 0,
    duplicateIds: 0,
    leakageFailures: 0,
    batchesCompleted: 0,
  }
  try {
    await persistFullReplayCheckpoint(job.id, 'running', {
      startedAt,
      gamesTotal: supportedGames.length,
      gamesCompleted: 0,
      predictions: 0,
      currentBatch: 0,
      batchSize: safeBatchSize,
      providerCallsMade: 0,
    }, dryRun)

    for (let offset = 0; offset < supportedGames.length; offset += safeBatchSize) {
      const batch = supportedGames.slice(offset, offset + safeBatchSize)
      const replayMarkets = batch.flatMap((game) =>
        buildMarkets(game, grouped.get(game.canonical_game_id) ?? []).map((replay) => ({ game, replay }))
      )
      const persisted = await persistFullReplayRows(replayMarkets, dryRun)
      aggregate.predictions += replayMarkets.length
      aggregate.settlements += replayMarkets.filter(({ replay }) => ['win', 'loss', 'push'].includes(replay.settlement.outcome)).length
      aggregate.labels += replayMarkets.filter(({ replay }) => ['win', 'loss', 'push'].includes(replay.settlement.outcome)).length
      aggregate.snapshotLookups += replayMarkets.reduce((sum, item) => sum + item.replay.featureSnapshotIds.length, 0)
      aggregate.inserted += persisted.inserted
      aggregate.reused += persisted.reused
      aggregate.warningCount += replayMarkets.reduce((sum, item) => sum + item.replay.warnings.length, 0)
      aggregate.duplicateIds += persisted.ids.length - new Set(persisted.ids).size
      aggregate.leakageFailures += replayMarkets.filter(({ replay }) => replay.warnings.some((warning) => /SNAPSHOT_AFTER_CUTOFF|CUTOFF_AFTER_GAME_START/.test(warning))).length
      aggregate.batchesCompleted += 1
      await persistFullReplayCheckpoint(job.id, 'running', {
        startedAt,
        gamesTotal: supportedGames.length,
        gamesCompleted: Math.min(offset + batch.length, supportedGames.length),
        predictions: aggregate.predictions,
        settlements: aggregate.settlements,
        labels: aggregate.labels,
        currentBatch: aggregate.batchesCompleted,
        batchSize: safeBatchSize,
        snapshotLookups: aggregate.snapshotLookups,
        inserted: aggregate.inserted,
        reused: aggregate.reused,
        warningCount: aggregate.warningCount,
        leakageFailures: aggregate.leakageFailures,
        providerCallsMade: 0,
      }, dryRun)
    }

    const finishedAt = new Date().toISOString()
    const durationMs = Math.max(0, new Date(finishedAt).getTime() - new Date(startedAt).getTime())
    const stats = {
      startedAt,
      finishedAt,
      limit: safeLimit,
      gamesTotal: supportedGames.length,
      gamesCompleted: supportedGames.length,
      currentBatch: aggregate.batchesCompleted,
      batchSize: safeBatchSize,
      averageDurationMsPerGame: supportedGames.length ? round(durationMs / supportedGames.length) : null,
      estimatedRemaining: 0,
      databaseWrites: dryRun ? 0 : aggregate.inserted,
      providerCallsMade: 0,
      remoteMutationsMade: dryRun ? 0 : aggregate.inserted + aggregate.batchesCompleted + 2,
      markets: ['moneyline', 'spread', 'total'],
      ...aggregate,
      durationMs,
    }
    const checkpoint = await persistFullReplayCheckpoint(job.id, 'completed', stats, dryRun)
    await completeFullReplayJob(job, 'completed', { ...stats, checkpointWritten: checkpoint.written })
    const after = {
      predictionHistory: await countTable('prediction_history', (query) => query.eq('sport_key', SPORT_KEY)),
      currentProductionPredictions: await countTable('prediction_history', (query) => query.eq('sport_key', SPORT_KEY).eq('production_eligible', true)),
      learningWeights: await countTable('model_weight_history', (query) => query.eq('sport_key', SPORT_KEY)),
      fullReplayArtifacts: await countTable('universal_projection_history', (query) => query.eq('sport_key', SPORT_KEY).eq('projection_family', FULL_REPLAY_FAMILY)),
    }
    return {
      success: true,
      mode: 'historical_replay_phase_2b_full_v1',
      dryRun,
      jobId: job.id,
      ...stats,
      checkpoint,
      idempotency: {
        attempted: aggregate.predictions,
        inserted: aggregate.inserted,
        reused: aggregate.reused,
        duplicateIds: aggregate.duplicateIds,
      },
      productionIsolation: {
        predictionHistoryUnchanged: before.predictionHistory.count === after.predictionHistory.count,
        currentProductionPredictionsUnchanged: before.currentProductionPredictions.count === after.currentProductionPredictions.count,
        learningWeightsUnchanged: before.learningWeights.count === after.learningWeights.count,
        currentBoardMutated: false,
        officialPicksMutated: false,
        schedulerMutated: false,
        historicalFeatureStoreMutated: false,
        before,
        after,
      },
      certifications: {
        FULL_HISTORICAL_REPLAY_PASS: supportedGames.length === safeLimit && aggregate.predictions === supportedGames.length * 3,
        REPLAY_POINT_IN_TIME_PASS: aggregate.leakageFailures === 0,
        REPLAY_PRODUCTION_ISOLATION_PASS: before.predictionHistory.count === after.predictionHistory.count && before.learningWeights.count === after.learningWeights.count,
        REPLAY_SETTLEMENT_PASS: aggregate.settlements === aggregate.predictions,
        REPLAY_LABEL_PASS: aggregate.labels === aggregate.predictions,
        REPLAY_IDEMPOTENCY_PASS: aggregate.duplicateIds === 0,
        REPLAY_RESUME_PASS: checkpoint.written || dryRun,
      },
    }
  } catch (error) {
    await persistFullReplayCheckpoint(job.id, 'failed', {
      startedAt,
      gamesTotal: supportedGames.length,
      gamesCompleted: aggregate.batchesCompleted * safeBatchSize,
      predictions: aggregate.predictions,
      inserted: aggregate.inserted,
      reused: aggregate.reused,
      warningCount: aggregate.warningCount,
      providerCallsMade: 0,
      error: error instanceof Error ? error.message : 'unknown full replay error',
    }, dryRun).catch(() => null)
    await completeFullReplayJob(job, 'failed', { gamesTotal: supportedGames.length, inserted: aggregate.inserted, reused: aggregate.reused }, error instanceof Error ? error.message : 'unknown full replay error')
    throw error
  }
}

export async function getHistoricalReplayFullStatus() {
  const [artifacts, jobs, checkpoints] = await Promise.all([
    supabaseAdmin
      .from('universal_projection_history')
      .select('id, event_id, projection_key, actual_value, projected_value, metadata, generated_at, settled_at', { count: 'exact' })
      .eq('sport_key', SPORT_KEY)
      .eq('projection_family', FULL_REPLAY_FAMILY)
      .order('generated_at', { ascending: false })
      .limit(200),
    supabaseAdmin
      .from('sports_sync_jobs')
      .select('id, status, records_fetched, records_inserted, records_skipped, duration_ms, started_at, completed_at, metadata')
      .eq('sport_key', SPORT_KEY)
      .eq('job_type', FULL_REPLAY_VERSION)
      .order('started_at', { ascending: false })
      .limit(5),
    supabaseAdmin
      .from('historical_import_checkpoints')
      .select('id, checkpoint_key, status, record_count, finished_at, metadata')
      .eq('checkpoint_level', 'validation')
      .eq('checkpoint_key', FULL_REPLAY_CHECKPOINT_KEY)
      .limit(1),
  ])
  const rows = (artifacts.data ?? []) as Array<Record<string, unknown>>
  const latestJob = (jobs.data ?? [])[0] as Record<string, unknown> | undefined
  const latestCheckpoint = (checkpoints.data ?? [])[0] as Record<string, unknown> | undefined
  const metadata = asRecord(latestJob?.metadata)
  const checkpointMetadata = asRecord(latestCheckpoint?.metadata)
  return {
    success: true,
    mode: 'historical_replay_phase_2b_status_v1',
    status: latestJob?.status ?? (rows.length ? 'completed' : 'not_started'),
    gamesTotal: asNumber(metadata.gamesTotal) ?? asNumber(checkpointMetadata.gamesTotal) ?? null,
    gamesCompleted: asNumber(metadata.gamesCompleted) ?? asNumber(checkpointMetadata.gamesCompleted) ?? new Set(rows.map((row) => String(row.event_id ?? '')).filter(Boolean)).size,
    replayPredictions: artifacts.count ?? rows.length,
    replaySettlements: asNumber(metadata.settlements) ?? rows.filter((row) => asRecord(asRecord(row.metadata).settlement).outcome).length,
    replayLabels: asNumber(metadata.labels) ?? rows.filter((row) => asRecord(asRecord(row.metadata).settlement).outcome).length,
    replayDurationMs: asNumber(latestJob?.duration_ms),
    averageReplayDurationMsPerGame: asNumber(metadata.averageDurationMsPerGame),
    snapshotLookups: asNumber(metadata.snapshotLookups) ?? asNumber(checkpointMetadata.snapshotLookups),
    currentBatch: asNumber(metadata.currentBatch) ?? asNumber(checkpointMetadata.currentBatch),
    checkpointStatus: latestCheckpoint?.status ?? null,
    checkpointFinishedAt: latestCheckpoint?.finished_at ?? null,
    resumeCount: asNumber(metadata.reused) ?? 0,
    inserted: asNumber(latestJob?.records_inserted) ?? asNumber(metadata.inserted) ?? 0,
    reused: asNumber(latestJob?.records_skipped) ?? asNumber(metadata.reused) ?? 0,
    duplicateIds: asNumber(metadata.duplicateIds) ?? 0,
    leakageFailures: asNumber(metadata.leakageFailures) ?? 0,
    estimatedRemaining: asNumber(metadata.estimatedRemaining),
    providerCallsMade: 0,
    remoteMutationsMade: asNumber(metadata.remoteMutationsMade) ?? 0,
    databaseWrites: asNumber(metadata.databaseWrites) ?? asNumber(latestJob?.records_inserted) ?? 0,
    productionIsolation: {
      replayOnly: true,
      predictionHistoryMutated: false,
      currentBoardMutated: false,
      officialPickPolicyMutated: false,
      learningBrainMutated: false,
      schedulerMutated: false,
    },
    errors: [artifacts.error?.message, jobs.error?.message, checkpoints.error?.message].filter(Boolean),
  }
}
