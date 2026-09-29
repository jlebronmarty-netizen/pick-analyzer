import 'server-only'

import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  MLB_RUNLINE_V2_BROAD_MODEL,
  MLB_RUNLINE_V2_CORE_MODEL,
  MLB_RUNLINE_V2_CORE_THRESHOLD,
  MLB_RUNLINE_V2_TRANSFER_MODEL,
  MLB_RUNLINE_V2_TRANSFER_THRESHOLD,
} from '@/lib/mlb-runline-v2-standard'
import { isMlbModelGameType } from '@/services/mlb-game-type-policy'
import { RUNLINE_V2_HOME_P15_ALT_CANDIDATE_ID } from '@/services/mlb-runline-home-p15-alt-shadow.service'

const LEDGER = 'mlb_2026_forward_master_ledger_v1'
const SEASON = 2026
const PAGE_SIZE = 500
const REGULAR_START = '2026-09-15'

type JsonMap = Record<string, unknown>

type LedgerRow = {
  id: string
  season: 2026
  season_phase: 'REGULAR_SEASON' | 'POSTSEASON'
  game_type: string
  target_date: string
  game_pk: number
  scheduled_at: string | null
  engine: string
  model_id: string
  contract_id: string | null
  evidence_class: string
  market: string
  line: number | null
  direction: string
  selection: string
  player_mlbam_id: number | null
  player_name: string | null
  sportsbook: string | null
  odds: number | null
  odds_snapshot_id: string | null
  projection: number | null
  model_probability: number | null
  historical_accuracy: number | null
  threshold: number | null
  freeze_timestamp: string
  source_relation: string
  source_row_id: string
  result: 'WIN' | 'LOSS' | 'PUSH' | 'VOID' | null
  actual_value: number | null
  actual_label: string | null
  settled_at: string | null
  metadata: JsonMap
  research_only: true
  production_eligible: false
  official_picks_eligible: false
  apostar_enabled: false
  updated_at: string
}

function record(value: unknown): JsonMap {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonMap : {}
}

function array(value: unknown): JsonMap[] {
  return Array.isArray(value) ? value.filter((item): item is JsonMap => Boolean(item && typeof item === 'object')) : []
}

function finite(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function integer(value: unknown) {
  const n = Number(value)
  return Number.isSafeInteger(n) ? n : null
}

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function result(value: unknown): LedgerRow['result'] {
  const normalized = String(value ?? '').toUpperCase()
  return ['WIN', 'LOSS', 'PUSH', 'VOID'].includes(normalized) ? normalized as LedgerRow['result'] : null
}

function hash(parts: unknown[]) {
  return createHash('sha256').update(parts.map((part) => String(part ?? 'null')).join('|')).digest('hex').slice(0, 40)
}

async function pagedRead<T>(
  table: string,
  columns: string,
  configure: (query: any) => any,
): Promise<T[]> {
  const rows: T[] = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const response = await configure(supabaseAdmin.from(table).select(columns))
      .range(offset, offset + PAGE_SIZE - 1)
    if (response.error) throw new Error(`MLB_FORWARD_MASTER_SOURCE_READ_FAILED:${table}:${response.error.message}`)
    rows.push(...((response.data ?? []) as T[]))
    if (!response.data || response.data.length < PAGE_SIZE) break
  }
  return rows
}

async function gameContext(gamePks: number[]) {
  const out = new Map<number, { gameType: string; phase: LedgerRow['season_phase']; scheduledAt: string | null }>()
  const ids = [...new Set(gamePks.filter(Number.isSafeInteger))]
  for (let offset = 0; offset < ids.length; offset += 100) {
    const chunk = ids.slice(offset, offset + 100)
    const response = await supabaseAdmin
      .from('pick2_mlb_games')
      .select('game_pk,game_type,scheduled_at')
      .eq('season', SEASON)
      .in('game_pk', chunk)
    if (response.error) throw new Error(`MLB_FORWARD_MASTER_GAME_CONTEXT_FAILED:${response.error.message}`)
    for (const row of response.data ?? []) {
      const gamePk = Number(row.game_pk)
      if (!Number.isSafeInteger(gamePk) || !isMlbModelGameType(row.game_type)) continue
      out.set(gamePk, {
        gameType: row.game_type,
        phase: row.game_type === 'R' ? 'REGULAR_SEASON' : 'POSTSEASON',
        scheduledAt: row.scheduled_at ? String(row.scheduled_at) : null,
      })
    }
  }
  return out
}

function evidenceClass(phase: LedgerRow['season_phase'], suffix: string) {
  return phase === 'POSTSEASON'
    ? `POSTSEASON_SHADOW_DOMAIN_SHIFT_${suffix}`
    : `REGULAR_SEASON_FORWARD_${suffix}`
}

function baseRow(input: {
  context: { gameType: string; phase: LedgerRow['season_phase']; scheduledAt: string | null }
  targetDate: string
  gamePk: number
  engine: string
  modelId: string
  contractId?: string | null
  evidenceSuffix: string
  market: string
  line?: number | null
  direction: string
  selection: string
  playerId?: number | null
  playerName?: string | null
  sportsbook?: string | null
  odds?: number | null
  oddsSnapshotId?: string | null
  projection?: number | null
  modelProbability?: number | null
  historicalAccuracy?: number | null
  threshold?: number | null
  freezeTimestamp: string
  sourceRelation: string
  sourceRowId: string
  result?: LedgerRow['result']
  actualValue?: number | null
  actualLabel?: string | null
  settledAt?: string | null
  metadata?: JsonMap
}): LedgerRow {
  const id = 'mlb26fwd_' + hash([
    input.sourceRelation,
    input.sourceRowId,
    input.modelId,
  ])
  return {
    id,
    season: 2026,
    season_phase: input.context.phase,
    game_type: input.context.gameType,
    target_date: input.targetDate,
    game_pk: input.gamePk,
    scheduled_at: input.context.scheduledAt,
    engine: input.engine,
    model_id: input.modelId,
    contract_id: input.contractId ?? null,
    evidence_class: evidenceClass(input.context.phase, input.evidenceSuffix),
    market: input.market,
    line: input.line ?? null,
    direction: input.direction,
    selection: input.selection,
    player_mlbam_id: input.playerId ?? null,
    player_name: input.playerName ?? null,
    sportsbook: input.sportsbook ?? null,
    odds: input.odds ?? null,
    odds_snapshot_id: input.oddsSnapshotId ?? null,
    projection: input.projection ?? null,
    model_probability: input.modelProbability ?? null,
    historical_accuracy: input.historicalAccuracy ?? null,
    threshold: input.threshold ?? null,
    freeze_timestamp: input.freezeTimestamp,
    source_relation: input.sourceRelation,
    source_row_id: input.sourceRowId,
    result: input.result ?? null,
    actual_value: input.actualValue ?? null,
    actual_label: input.actualLabel ?? null,
    settled_at: input.settledAt ?? null,
    metadata: input.metadata ?? {},
    research_only: true,
    production_eligible: false,
    official_picks_eligible: false,
    apostar_enabled: false,
    updated_at: new Date().toISOString(),
  }
}

async function syncMoneylineV2(): Promise<{ rows: LedgerRow[]; missingGameContext: number }> {
  const source = await pagedRead<any>(
    'mlb_ml_opening_consensus_v2_forward_v1',
    'id,formula_id,target_date,game_pk,scheduled_at,home_team,away_team,pick,pick_side,favorite_probability,secondary_score,confidence,secondary_snapshot,freeze_timestamp,status,result,actual_winner,settled_at,metadata',
    (query) => query.gte('target_date', REGULAR_START).order('target_date', { ascending: true }).order('game_pk'),
  )
  const context = await gameContext(source.map((row) => Number(row.game_pk)))
  const rows: LedgerRow[] = []
  let missingGameContext = 0
  for (const row of source) {
    const gamePk = integer(row.game_pk)
    const targetDate = text(row.target_date)
    const ctx = gamePk === null ? null : context.get(gamePk)
    if (gamePk === null || !targetDate || !ctx) { missingGameContext++; continue }
    rows.push(baseRow({
      context: ctx,
      targetDate,
      gamePk,
      engine: 'PICK_ANALYZER',
      modelId: String(row.formula_id),
      contractId: 'MLB_ML_OPENING_CONSENSUS_V2_SECONDARY_SCORE/1.0.0',
      evidenceSuffix: 'ML_V2',
      market: 'moneyline',
      direction: String(row.pick_side),
      selection: String(row.pick),
      modelProbability: finite(row.favorite_probability),
      projection: finite(row.secondary_score),
      threshold: 2,
      freezeTimestamp: String(row.freeze_timestamp),
      sourceRelation: 'mlb_ml_opening_consensus_v2_forward_v1',
      sourceRowId: String(row.id),
      result: result(row.result),
      actualLabel: text(row.actual_winner),
      settledAt: text(row.settled_at),
      metadata: {
        homeTeam: row.home_team,
        awayTeam: row.away_team,
        confidence: row.confidence,
        secondarySnapshot: row.secondary_snapshot,
        sourceStatus: row.status,
        sourceMetadata: row.metadata,
        probabilitySemantics: 'OPENING_MARKET_FAVORITE_PROBABILITY_NOT_MODEL_CALIBRATION',
      },
    }))
  }
  return { rows, missingGameContext }
}

async function syncApprovedProps(): Promise<{ rows: LedgerRow[]; missingGameContext: number }> {
  const source = await pagedRead<any>(
    'mlb_approved_prop_daily_v1',
    'id,tracking_date,game_pk,start_time,market,candidate_id,player_mlbam_id,player_name,direction,required_line,sportsbook,observed_line,price,odds_snapshot_id,model_projection,model_probability,historical_accuracy,model_qualifies,market_verified,status,blocker,feature_snapshot,market_snapshot,frozen_at',
    (query) => query
      .gte('tracking_date', REGULAR_START)
      .eq('model_qualifies', true)
      .eq('market_verified', true)
      .eq('status', 'QUALIFIES_MARKET_VERIFIED')
      .order('tracking_date', { ascending: true })
      .order('game_pk'),
  )
  const context = await gameContext(source.map((row) => Number(row.game_pk)))
  const settlements = await pagedRead<any>(
    'mlb_approved_prop_settlement_v1',
    'approved_prop_daily_id,result,actual_value,actual_label,settled_at,blocker,outcome_source,outcome_source_identity',
    (query) => query.gte('tracking_date', REGULAR_START),
  )
  const settlementByDailyId = new Map(settlements.map((row) => [String(row.approved_prop_daily_id), row]))
  const rows: LedgerRow[] = []
  let missingGameContext = 0
  for (const row of source) {
    const gamePk = integer(row.game_pk)
    const targetDate = text(row.tracking_date)
    const ctx = gamePk === null ? null : context.get(gamePk)
    if (gamePk === null || !targetDate || !ctx) { missingGameContext++; continue }
    rows.push(baseRow({
      context: ctx,
      targetDate,
      gamePk,
      engine: 'PICK_ANALYZER',
      modelId: String(row.candidate_id),
      evidenceSuffix: 'APPROVED_PROP_EXACT_LINE',
      market: String(row.market),
      line: finite(row.observed_line ?? row.required_line),
      direction: String(row.direction),
      selection: String(row.player_name),
      playerId: integer(row.player_mlbam_id),
      playerName: String(row.player_name),
      sportsbook: text(row.sportsbook),
      odds: finite(row.price),
      oddsSnapshotId: text(row.odds_snapshot_id),
      projection: finite(row.model_projection),
      modelProbability: finite(row.model_probability),
      historicalAccuracy: finite(row.historical_accuracy),
      freezeTimestamp: String(row.frozen_at),
      sourceRelation: 'mlb_approved_prop_daily_v1',
      sourceRowId: String(row.id),
      result: result(settlementByDailyId.get(String(row.id))?.result),
      actualValue: finite(settlementByDailyId.get(String(row.id))?.actual_value),
      actualLabel: text(settlementByDailyId.get(String(row.id))?.actual_label),
      settledAt: text(settlementByDailyId.get(String(row.id))?.settled_at),
      metadata: {
        requiredLine: row.required_line,
        sourceStatus: row.status,
        blocker: row.blocker,
        featureSnapshot: row.feature_snapshot,
        marketSnapshot: row.market_snapshot,
        probabilitySemantics: row.model_probability == null ? 'NO_CALIBRATED_PER_PLAY_PROBABILITY' : 'SOURCE_MODEL_PROBABILITY',
        settlement: settlementByDailyId.get(String(row.id)) ?? null,
      },
    }))
  }
  return { rows, missingGameContext }
}

async function syncExactLineShadows(): Promise<{ rows: LedgerRow[]; missingGameContext: number }> {
  const source = await pagedRead<any>(
    'mlb_exact_line_forward_shadow_v1',
    'id,tracking_date,game_pk,start_time,game_type,season_phase,market,contract_id,player_mlbam_id,player_name,direction,exact_line,sportsbook,price,odds_snapshot_id,quotes,projection,threshold,historical_accuracy_2025,historical_accuracy_2026_diagnostic,evidence_class,freeze_timestamp,latest_prior_date,prior_starts,result,actual_value,settled_at,metadata',
    (query) => query
      .gte('tracking_date', REGULAR_START)
      .order('tracking_date', { ascending: true })
      .order('game_pk'),
  )
  const context = await gameContext(source.map((row) => Number(row.game_pk)))
  const rows: LedgerRow[] = []
  let missingGameContext = 0

  for (const row of source) {
    const gamePk = integer(row.game_pk)
    const targetDate = text(row.tracking_date)
    const ctx = gamePk === null ? null : context.get(gamePk)
    if (gamePk === null || !targetDate || !ctx) { missingGameContext++; continue }

    rows.push(baseRow({
      context: ctx,
      targetDate,
      gamePk,
      engine: 'PICK_ANALYZER',
      modelId: String(row.contract_id),
      contractId: String(row.contract_id),
      evidenceSuffix: 'EXACT_LINE_FORWARD_SHADOW',
      market: String(row.market),
      line: finite(row.exact_line),
      direction: String(row.direction),
      selection: String(row.player_name),
      playerId: integer(row.player_mlbam_id),
      playerName: String(row.player_name),
      sportsbook: text(row.sportsbook),
      odds: finite(row.price),
      oddsSnapshotId: text(row.odds_snapshot_id),
      projection: finite(row.projection),
      historicalAccuracy: finite(row.historical_accuracy_2025),
      threshold: finite(row.threshold),
      freezeTimestamp: String(row.freeze_timestamp),
      sourceRelation: 'mlb_exact_line_forward_shadow_v1',
      sourceRowId: String(row.id),
      result: result(row.result),
      actualValue: finite(row.actual_value),
      settledAt: text(row.settled_at),
      metadata: {
        allQuotes: row.quotes,
        historicalAccuracy2026Diagnostic: row.historical_accuracy_2026_diagnostic,
        sourceEvidenceClass: row.evidence_class,
        latestPriorDate: row.latest_prior_date,
        priorStarts: row.prior_starts,
        sourceMetadata: row.metadata,
        probabilitySemantics: 'NO_CALIBRATED_PER_PLAY_PROBABILITY',
      },
    }))
  }
  return { rows, missingGameContext }
}

async function syncStandardRunline(): Promise<{ rows: LedgerRow[]; missingGameContext: number }> {
  const jobs = await pagedRead<any>(
    'sports_sync_jobs',
    'id,job_type,status,started_at,completed_at,metadata',
    (query) => query
      .eq('job_type', 'runline_v2_standard_forward_freeze_v1')
      .in('status', ['completed', 'partial'])
      .order('started_at', { ascending: true }),
  )
  const allPks = jobs.flatMap((job) => array(record(job.metadata).observations).map((obs) => Number(obs.gamePk)))
  const context = await gameContext(allPks)
  const rows: LedgerRow[] = []
  let missingGameContext = 0

  for (const job of jobs) {
    const meta = record(job.metadata)
    const targetDate = text(meta.targetDate)
    const frozenAt = text(meta.frozenAt) ?? text(job.completed_at) ?? text(job.started_at)
    if (!targetDate || targetDate < REGULAR_START || !frozenAt) continue

    for (const obs of array(meta.observations)) {
      const gamePk = integer(obs.gamePk)
      const ctx = gamePk === null ? null : context.get(gamePk)
      const models = Array.isArray(obs.selectedModels) ? obs.selectedModels.map(String) : []
      if (!models.length) continue
      if (gamePk === null || !ctx) { missingGameContext++; continue }

      const decision = record(obs.decision)
      const market = record(obs.market)
      const dogSide = text(obs.dogSide)
      const selection = dogSide === 'HOME' ? text(obs.homeTeam) : dogSide === 'AWAY' ? text(obs.awayTeam) : null
      if (!dogSide || !selection) continue

      for (const modelId of models) {
        const projection = modelId === MLB_RUNLINE_V2_CORE_MODEL
          ? finite(decision.coreScore)
          : modelId === MLB_RUNLINE_V2_TRANSFER_MODEL
            ? finite(decision.transferScore)
            : null
        const threshold = modelId === MLB_RUNLINE_V2_CORE_MODEL
          ? MLB_RUNLINE_V2_CORE_THRESHOLD
          : modelId === MLB_RUNLINE_V2_TRANSFER_MODEL
            ? MLB_RUNLINE_V2_TRANSFER_THRESHOLD
            : null
        rows.push(baseRow({
          context: ctx,
          targetDate,
          gamePk,
          engine: 'PICK_ANALYZER',
          modelId,
          contractId: 'MLB_STANDARD_RUNLINE_V2_FORWARD_FREEZE',
          evidenceSuffix: 'STANDARD_RUNLINE',
          market: 'run_line',
          line: 1.5,
          direction: 'DOG_PLUS_1P5',
          selection,
          projection,
          threshold,
          freezeTimestamp: frozenAt,
          sourceRelation: 'sports_sync_jobs',
          sourceRowId: `${job.id}:${gamePk}:${modelId}`,
          metadata: {
            dogSide,
            marketProxy: market,
            decision,
            components: obs.components,
            sourceJobId: job.id,
            marketProbabilitySemantics: 'OPENING_MARKET_PROXY_NOT_MODEL_PROBABILITY',
          },
        }))
      }
    }
  }
  return { rows, missingGameContext }
}

async function syncHomeP15(): Promise<{ rows: LedgerRow[]; missingGameContext: number }> {
  const freezeJobs = await pagedRead<any>(
    'sports_sync_jobs',
    'id,job_type,status,started_at,completed_at,metadata',
    (query) => query
      .eq('job_type', 'runline_v2_home_p15_alt_forward_freeze_v1')
      .in('status', ['completed', 'partial'])
      .order('started_at', { ascending: true }),
  )
  const settlementJobs = await pagedRead<any>(
    'sports_sync_jobs',
    'id,job_type,status,started_at,completed_at,metadata',
    (query) => query
      .eq('job_type', 'runline_v2_home_p15_alt_forward_settlement_v1')
      .eq('status', 'completed')
      .order('started_at', { ascending: true }),
  )

  const settlementByKey = new Map<string, { result: LedgerRow['result']; actualValue: number | null; label: string | null; settledAt: string | null; jobId: string }>()
  for (const job of settlementJobs) {
    const meta = record(job.metadata)
    const targetDate = text(meta.targetDate)
    if (!targetDate) continue
    for (const item of array(meta.results)) {
      const gamePk = integer(item.gamePk)
      if (gamePk === null) continue
      settlementByKey.set(`${targetDate}:${gamePk}`, {
        result: result(item.result),
        actualValue: finite(item.homeMargin),
        label: item.homeP15Cover === true ? 'HOME_PLUS_1P5_COVER' : item.homeP15Cover === false ? 'HOME_PLUS_1P5_NO_COVER' : null,
        settledAt: text(job.completed_at),
        jobId: String(job.id),
      })
    }
  }

  const allPks = freezeJobs.flatMap((job) => array(record(job.metadata).observations).map((obs) => Number(obs.gamePk)))
  const context = await gameContext(allPks)
  const rows: LedgerRow[] = []
  let missingGameContext = 0

  for (const job of freezeJobs) {
    const meta = record(job.metadata)
    const targetDate = text(meta.targetDate)
    const frozenAt = text(meta.frozenAt) ?? text(job.completed_at) ?? text(job.started_at)
    if (!targetDate || targetDate < REGULAR_START || !frozenAt) continue
    for (const obs of array(meta.observations)) {
      if (obs.selected !== true) continue
      const gamePk = integer(obs.gamePk)
      const ctx = gamePk === null ? null : context.get(gamePk)
      if (gamePk === null || !ctx) { missingGameContext++; continue }
      const quotes = array(obs.alternateHomeP15Quotes)
      const fanDuel = quotes.find((quote) => String(quote.sportsbook ?? '').toLowerCase() === 'fanduel') ?? null
      const settlement = settlementByKey.get(`${targetDate}:${gamePk}`) ?? null
      rows.push(baseRow({
        context: ctx,
        targetDate,
        gamePk,
        engine: 'PICK_ANALYZER',
        modelId: RUNLINE_V2_HOME_P15_ALT_CANDIDATE_ID,
        contractId: 'MLB_RUNLINE_HOME_P15_ALT_FORWARD_FREEZE_V1',
        evidenceSuffix: 'HOME_PLUS_1P5_ALT',
        market: 'run_line_alt',
        line: 1.5,
        direction: 'HOME_PLUS_1P5',
        selection: String(obs.homeTeam ?? ''),
        sportsbook: fanDuel ? text(fanDuel.sportsbook) : null,
        odds: fanDuel ? finite(fanDuel.price) : null,
        oddsSnapshotId: fanDuel ? text(fanDuel.id) : null,
        projection: finite(obs.score),
        threshold: finite(obs.threshold ?? meta.threshold),
        freezeTimestamp: frozenAt,
        sourceRelation: 'sports_sync_jobs',
        sourceRowId: `${job.id}:${gamePk}:${RUNLINE_V2_HOME_P15_ALT_CANDIDATE_ID}`,
        result: settlement?.result ?? null,
        actualValue: settlement?.actualValue ?? null,
        actualLabel: settlement?.label ?? null,
        settledAt: settlement?.settledAt ?? null,
        metadata: {
          awayTeam: obs.awayTeam,
          allQuotes: quotes,
          sourceFreezeJobId: job.id,
          settlementJobId: settlement?.jobId ?? null,
          componentSnapshot: {
            teamStrength: obs.teamStrength,
            starter: obs.starter,
            history: obs.history,
          },
        },
      }))
    }
  }
  return { rows, missingGameContext }
}

async function writeRows(rows: LedgerRow[]) {
  if (!rows.length) return { written: 0 }
  let written = 0
  for (let offset = 0; offset < rows.length; offset += 100) {
    const chunk = rows.slice(offset, offset + 100)
    const response = await supabaseAdmin
      .from(LEDGER)
      .upsert(chunk, { onConflict: 'id' })
    if (response.error) throw new Error(`MLB_FORWARD_MASTER_WRITE_FAILED:${response.error.message}`)
    written += chunk.length
  }
  return { written }
}

export async function syncMlb2026ForwardMasterLedger() {
  const [moneyline, props, exactLine, standardRunline, homeP15] = await Promise.all([
    syncMoneylineV2(),
    syncApprovedProps(),
    syncExactLineShadows(),
    syncStandardRunline(),
    syncHomeP15(),
  ])
  const rows = [
    ...moneyline.rows,
    ...props.rows,
    ...exactLine.rows,
    ...standardRunline.rows,
    ...homeP15.rows,
  ]
  const write = await writeRows(rows)

  return {
    success: true,
    status: 'MLB_2026_FORWARD_MASTER_LEDGER_SYNCED',
    researchOnly: true,
    productionEligible: false,
    officialPicksModified: false,
    apostarActivated: false,
    rowsPrepared: rows.length,
    rowsWritten: write.written,
    sourceCounts: {
      moneylineV2: moneyline.rows.length,
      approvedPropsExactLine: props.rows.length,
      exactLineForwardShadows: exactLine.rows.length,
      standardRunline: standardRunline.rows.length,
      homeP15Alt: homeP15.rows.length,
    },
    missingGameContext: {
      moneylineV2: moneyline.missingGameContext,
      approvedPropsExactLine: props.missingGameContext,
      exactLineForwardShadows: exactLine.missingGameContext,
      standardRunline: standardRunline.missingGameContext,
      homeP15Alt: homeP15.missingGameContext,
    },
    externalEnginesIncluded: false,
    externalEnginePolicy: 'PICK_EDGE_AND_EQUILIZER_REQUIRE_IMMUTABLE_ARTIFACT_IMPORTERS',
  }
}
