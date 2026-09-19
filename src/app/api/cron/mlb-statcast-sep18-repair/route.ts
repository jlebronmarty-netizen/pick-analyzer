import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import { errorMessage } from '@/lib/api-contract'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { refreshMlbStatcastDaily } from '@/services/mlb-statcast-daily-refresh.service'
import { refreshMlbStatcastDailyAnalytics } from '@/services/mlb-statcast-daily-analytics.service'
import { getMlbDailyHistoryReadiness } from '@/services/mlb-daily-history-readiness.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'
export const maxDuration = 800

const JOB_TYPE = 'mlb_statcast_sep18_one_shot_repair_v1'
const TARGET_DATE = '2026-09-18'
const EXECUTION_DATE = '2026-09-19'

function cronSecret() {
  return process.env.CRON_SECRET?.trim() ?? ''
}

function authorized(request: NextRequest) {
  const secret = cronSecret()
  return Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`
}

function puertoRicoDate(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Puerto_Rico',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day}`
}

async function priorCompleted() {
  const { data, error } = await supabaseAdmin
    .from('sports_sync_jobs')
    .select('id,completed_at,metadata')
    .eq('job_type', JOB_TYPE)
    .eq('sport_key', 'baseball_mlb')
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`STATCAST_REPAIR_LEDGER_READ_FAILED:${error.message}`)
  return data
}

async function writeLedger({
  startedAt,
  status,
  rawResult,
  analyticsResult,
  readiness,
  failureStage,
  failure,
}: {
  startedAt: string
  status: 'completed' | 'failed'
  rawResult: unknown
  analyticsResult: unknown
  readiness: unknown
  failureStage: string | null
  failure: string | null
}) {
  const completedAt = new Date().toISOString()
  const raw = rawResult && typeof rawResult === 'object' ? rawResult as Record<string, unknown> : {}
  const { data, error } = await supabaseAdmin.from('sports_sync_jobs').insert({
    id: randomUUID(),
    job_type: JOB_TYPE,
    sport_key: 'baseball_mlb',
    league_key: 'mlb',
    provider: 'baseball-savant',
    season: '2026',
    started_at: startedAt,
    completed_at: completedAt,
    status,
    records_fetched: Number(raw.sourceRows ?? 0),
    records_inserted: Number(raw.inserted ?? 0),
    records_updated: 0,
    records_skipped: Number(raw.reuses ?? 0),
    error_count: status === 'completed' ? 0 : 1,
    metadata: {
      checkpoint: JOB_TYPE,
      targetDate: TARGET_DATE,
      executionDate: EXECUTION_DATE,
      rawResult,
      analyticsResult,
      readiness,
      failureStage,
      failure,
      oneShot: true,
      repairOnly: true,
      researchOnly: true,
      sportsbookProviderCalls: 0,
      historicalOddsCalls: 0,
      officialPicksModified: false,
      apostarActivated: false,
    },
    updated_at: completedAt,
  }).select('id').single()
  if (error) throw new Error(`STATCAST_REPAIR_LEDGER_WRITE_FAILED:${error.message}`)
  return { id: data?.id ?? null, completedAt }
}

export async function GET(request: NextRequest) {
  if (!cronSecret()) return Response.json({ status: 'AUTH_REQUIRED' }, { status: 503 })
  if (!authorized(request)) return Response.json({ status: 'UNAUTHORIZED' }, { status: 401 })

  if (puertoRicoDate() !== EXECUTION_DATE) {
    return Response.json({ status: 'ONE_SHOT_EXPIRED', targetDate: TARGET_DATE })
  }

  const prior = await priorCompleted()
  if (prior) {
    return Response.json({
      status: 'REUSE_NO_OP',
      targetDate: TARGET_DATE,
      jobId: prior.id,
      completedAt: prior.completed_at,
    })
  }

  const startedAt = new Date().toISOString()
  let rawResult: Awaited<ReturnType<typeof refreshMlbStatcastDaily>> | null = null
  let analyticsResult: Awaited<ReturnType<typeof refreshMlbStatcastDailyAnalytics>> | null = null
  let readiness: Awaited<ReturnType<typeof getMlbDailyHistoryReadiness>> | null = null
  let failureStage: string | null = 'RAW_INGESTION'

  try {
    rawResult = await refreshMlbStatcastDaily({ date: TARGET_DATE, refreshAnalytics: false })
    if (!rawResult.success) {
      const ledger = await writeLedger({
        startedAt,
        status: 'failed',
        rawResult,
        analyticsResult,
        readiness,
        failureStage,
        failure: String(rawResult.status ?? 'RAW_INGESTION_BLOCKED'),
      })
      return Response.json({
        status: 'STATCAST_REPAIR_BLOCKED',
        targetDate: TARGET_DATE,
        rawResult,
        ledger,
      }, { status: 500 })
    }

    failureStage = 'ANALYTICS_REFRESH'
    analyticsResult = await refreshMlbStatcastDailyAnalytics()

    failureStage = 'READINESS'
    readiness = await getMlbDailyHistoryReadiness({ date: TARGET_DATE })
    if (!readiness.ready) {
      const ledger = await writeLedger({
        startedAt,
        status: 'failed',
        rawResult,
        analyticsResult,
        readiness,
        failureStage,
        failure: 'DAILY_HISTORY_NOT_READY_AFTER_REPAIR',
      })
      return Response.json({
        status: 'STATCAST_REPAIR_NOT_READY',
        targetDate: TARGET_DATE,
        rawResult,
        analyticsResult,
        readiness,
        ledger,
      }, { status: 500 })
    }

    failureStage = null
    const ledger = await writeLedger({
      startedAt,
      status: 'completed',
      rawResult,
      analyticsResult,
      readiness,
      failureStage,
      failure: null,
    })

    return Response.json({
      status: 'STATCAST_REPAIR_COMPLETE',
      targetDate: TARGET_DATE,
      rawResult,
      analyticsResult,
      readiness,
      ledger,
      officialPicksModified: false,
      apostarActivated: false,
    })
  } catch (error) {
    const failure = errorMessage(error, 'STATCAST_REPAIR_UNKNOWN')
    const ledger = await writeLedger({
      startedAt,
      status: 'failed',
      rawResult,
      analyticsResult,
      readiness,
      failureStage,
      failure,
    }).catch(() => null)
    return Response.json({
      status: 'STATCAST_REPAIR_EXCEPTION',
      targetDate: TARGET_DATE,
      failureStage,
      failure,
      ledger,
      officialPicksModified: false,
      apostarActivated: false,
    }, { status: 500 })
  }
}
