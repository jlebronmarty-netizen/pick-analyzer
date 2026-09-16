import 'server-only'

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { RUNLINE_V2_HOME_P15_ALT_CANDIDATE_ID } from '@/services/mlb-runline-home-p15-alt-shadow.service'

const SEASON = 2026
const FREEZE_JOB_TYPE = 'runline_v2_home_p15_alt_forward_freeze_v1'
const SETTLEMENT_JOB_TYPE = 'runline_v2_home_p15_alt_forward_settlement_v1'
const PROVIDER = 'internal-model'

type FrozenObservation = {
  gamePk?: number
  eventId?: string | null
  startTime?: string
  homeTeam?: string
  awayTeam?: string
  score?: number | null
  threshold?: number
  selected?: boolean
  marketEligible?: boolean
  alternateHomeP15Quotes?: Array<Record<string, unknown>>
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function asObservations(value: unknown): FrozenObservation[] {
  return Array.isArray(value)
    ? value.filter((item): item is FrozenObservation => Boolean(item && typeof item === 'object'))
    : []
}

async function findFreezeJob(targetDate: string) {
  const { data, error } = await supabaseAdmin
    .from('sports_sync_jobs')
    .select('id,status,completed_at,metadata')
    .eq('job_type', FREEZE_JOB_TYPE)
    .eq('sport_key', 'baseball_mlb')
    .eq('provider', PROVIDER)
    .in('status', ['completed', 'partial'])
    .order('completed_at', { ascending: false })
    .limit(100)
  if (error) throw new Error(`MLB_RUNLINE_V2_SETTLEMENT_FREEZE_READ_FAILED:${error.message}`)
  return (data ?? []).find((row) => {
    const metadata = asRecord(row.metadata)
    return metadata.targetDate === targetDate && metadata.candidateId === RUNLINE_V2_HOME_P15_ALT_CANDIDATE_ID
  }) ?? null
}

async function findSettlementJob(targetDate: string) {
  const { data, error } = await supabaseAdmin
    .from('sports_sync_jobs')
    .select('id,status,completed_at,metadata')
    .eq('job_type', SETTLEMENT_JOB_TYPE)
    .eq('sport_key', 'baseball_mlb')
    .eq('provider', PROVIDER)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(100)
  if (error) throw new Error(`MLB_RUNLINE_V2_SETTLEMENT_EXISTING_READ_FAILED:${error.message}`)
  return (data ?? []).find((row) => {
    const metadata = asRecord(row.metadata)
    return metadata.targetDate === targetDate && metadata.candidateId === RUNLINE_V2_HOME_P15_ALT_CANDIDATE_ID
  }) ?? null
}

export async function settleRunlineV2HomeP15Alternate(targetDate: string) {
  const base = {
    success: true,
    candidateId: RUNLINE_V2_HOME_P15_ALT_CANDIDATE_ID,
    targetDate,
    researchOnly: true,
    productionEligible: false,
    officialPicksModified: false,
    apostarActivated: false,
    roiCertified: false,
    writes: 0,
  }

  if (targetDate < '2026-09-17') return { ...base, status: 'NOT_IN_PROSPECTIVE_WINDOW' }

  const priorSettlement = await findSettlementJob(targetDate)
  if (priorSettlement) {
    const metadata = asRecord(priorSettlement.metadata)
    return {
      ...base,
      status: 'REUSE_NO_OP',
      settlementJobId: priorSettlement.id,
      settledAt: priorSettlement.completed_at,
      selectedGames: Number(metadata.selectedGames ?? 0),
      correct: Number(metadata.correct ?? 0),
      accuracy: metadata.accuracy ?? null,
    }
  }

  const freeze = await findFreezeJob(targetDate)
  if (!freeze) return { ...base, status: 'WAITING_FOR_FREEZE' }

  const freezeMetadata = asRecord(freeze.metadata)
  const observations = asObservations(freezeMetadata.observations)
  const selected = observations.filter((item) => item.selected === true && Number.isSafeInteger(Number(item.gamePk)))

  if (!selected.length) {
    const completedAt = new Date().toISOString()
    const { data: inserted, error } = await supabaseAdmin.from('sports_sync_jobs').insert({
      id: randomUUID(),
      job_type: SETTLEMENT_JOB_TYPE,
      sport_key: 'baseball_mlb',
      league_key: 'mlb',
      provider: PROVIDER,
      season: String(SEASON),
      started_at: completedAt,
      completed_at: completedAt,
      status: 'completed',
      records_fetched: 0,
      records_inserted: 0,
      records_updated: 0,
      records_skipped: 0,
      error_count: 0,
      metadata: {
        candidateId: RUNLINE_V2_HOME_P15_ALT_CANDIDATE_ID,
        targetDate,
        freezeJobId: freeze.id,
        freezeCompletedAt: freeze.completed_at,
        selectedGames: 0,
        correct: 0,
        accuracy: null,
        outcomesRead: true,
        roiCertified: false,
        researchOnly: true,
        productionEligible: false,
        officialPicksModified: false,
        apostarActivated: false,
        results: [],
      },
      updated_at: completedAt,
    }).select('id').single()
    if (error) throw new Error(`MLB_RUNLINE_V2_SETTLEMENT_ZERO_WRITE_FAILED:${error.message}`)
    return { ...base, status: 'SETTLED_NO_SELECTIONS', settlementJobId: inserted?.id ?? null, writes: 1, selectedGames: 0, correct: 0, accuracy: null }
  }

  const gamePks = [...new Set(selected.map((item) => Number(item.gamePk)))]
  const { data: outcomes, error: outcomeError } = await supabaseAdmin
    .from('mlb_ml_xyear_game_v1')
    .select('game_pk,game_date,home_team,away_team,home_score,away_score,actual_winner')
    .eq('season', SEASON)
    .eq('game_date', targetDate)
    .in('game_pk', gamePks)
  if (outcomeError) throw new Error(`MLB_RUNLINE_V2_SETTLEMENT_OUTCOME_READ_FAILED:${outcomeError.message}`)

  const outcomeByGame = new Map((outcomes ?? []).map((row) => [Number(row.game_pk), row]))
  const unresolved = selected.filter((item) => {
    const row = outcomeByGame.get(Number(item.gamePk))
    return !row || row.home_score === null || row.away_score === null
  })
  if (unresolved.length) {
    return {
      ...base,
      status: 'WAITING_FOR_FINAL_OUTCOMES',
      selectedGames: selected.length,
      unresolvedGames: unresolved.map((item) => Number(item.gamePk)),
    }
  }

  const results = selected.map((item) => {
    const row = outcomeByGame.get(Number(item.gamePk))!
    const homeScore = Number(row.home_score)
    const awayScore = Number(row.away_score)
    const homeP15Cover = homeScore + 1.5 > awayScore
    return {
      gamePk: Number(item.gamePk),
      eventId: item.eventId ?? null,
      homeTeam: item.homeTeam ?? row.home_team,
      awayTeam: item.awayTeam ?? row.away_team,
      frozenScore: item.score ?? null,
      threshold: item.threshold ?? null,
      homeScore,
      awayScore,
      homeMargin: homeScore - awayScore,
      homeP15Cover,
      result: homeP15Cover ? 'WIN' : 'LOSS',
      alternateHomeP15Quotes: item.alternateHomeP15Quotes ?? [],
    }
  })
  const correct = results.filter((item) => item.homeP15Cover).length
  const accuracy = results.length ? correct / results.length : null
  const completedAt = new Date().toISOString()

  const { data: inserted, error } = await supabaseAdmin.from('sports_sync_jobs').insert({
    id: randomUUID(),
    job_type: SETTLEMENT_JOB_TYPE,
    sport_key: 'baseball_mlb',
    league_key: 'mlb',
    provider: PROVIDER,
    season: String(SEASON),
    started_at: completedAt,
    completed_at: completedAt,
    status: 'completed',
    records_fetched: results.length,
    records_inserted: results.length,
    records_updated: 0,
    records_skipped: 0,
    error_count: 0,
    metadata: {
      candidateId: RUNLINE_V2_HOME_P15_ALT_CANDIDATE_ID,
      targetDate,
      freezeJobId: freeze.id,
      freezeCompletedAt: freeze.completed_at,
      selectedGames: results.length,
      correct,
      accuracy,
      outcomesRead: true,
      outcomeSource: 'mlb_ml_xyear_game_v1_after_daily_history_sync',
      roiCertified: false,
      pricingPolicyCertified: false,
      researchOnly: true,
      productionEligible: false,
      officialPicksModified: false,
      apostarActivated: false,
      results,
    },
    updated_at: completedAt,
  }).select('id').single()
  if (error) throw new Error(`MLB_RUNLINE_V2_SETTLEMENT_WRITE_FAILED:${error.message}`)

  return {
    ...base,
    status: 'SETTLED',
    settlementJobId: inserted?.id ?? null,
    writes: 1,
    selectedGames: results.length,
    correct,
    accuracy,
  }
}
