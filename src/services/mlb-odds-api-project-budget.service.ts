import 'server-only'

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const MLB_ODDS_API_PROJECT_BUDGET_KEY = 'mlb-decision-board-v1'
export const MLB_ODDS_API_PROJECT_CREDIT_LIMIT = 5000
export const MLB_ODDS_API_ACCOUNT_CREDIT_TOTAL = 20000
export const MLB_ODDS_API_ACCOUNT_CREDITS_OUTSIDE_SCOPE = MLB_ODDS_API_ACCOUNT_CREDIT_TOTAL - MLB_ODDS_API_PROJECT_CREDIT_LIMIT
export const MLB_ODDS_API_PLAYER_PROP_JOB_TYPE = 'mlb_player_prop_ingestion_v1'
export const MLB_ODDS_API_BOOKMAKER_KEYS = ['fanduel', 'williamhill_us'] as const

const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const PROVIDER = 'the-odds-api'

type ProjectLedgerRow = {
  metadata: Record<string, unknown> | null
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function finiteNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function baseMetadata(input: { selectedDate: string; markets: string[]; estimatedCredits: number }) {
  return {
    projectBudgetKey: MLB_ODDS_API_PROJECT_BUDGET_KEY,
    projectCreditLimit: MLB_ODDS_API_PROJECT_CREDIT_LIMIT,
    accountCreditTotal: MLB_ODDS_API_ACCOUNT_CREDIT_TOTAL,
    accountCreditsOutsideProjectScope: MLB_ODDS_API_ACCOUNT_CREDITS_OUTSIDE_SCOPE,
    estimatedCreditsBeforeCall: input.estimatedCredits,
    bookmakers: [...MLB_ODDS_API_BOOKMAKER_KEYS],
    markets: input.markets,
    selectedDate: input.selectedDate,
    source: MLB_ODDS_API_PLAYER_PROP_JOB_TYPE,
  }
}

export function estimateMlbOddsApiCredits({
  eventCount,
  marketCount,
  bookmakerCount = MLB_ODDS_API_BOOKMAKER_KEYS.length,
}: {
  eventCount: number
  marketCount: number
  bookmakerCount?: number
}) {
  const events = Math.max(0, Math.floor(eventCount))
  const markets = Math.max(0, Math.floor(marketCount))
  const bookmakerRegionEquivalents = Math.max(1, Math.ceil(Math.max(1, bookmakerCount) / 10))
  return events * markets * bookmakerRegionEquivalents
}

async function readProjectLedger() {
  const { data, error } = await supabaseAdmin
    .from('sports_sync_jobs')
    .select('metadata')
    .eq('provider', PROVIDER)
    .eq('sport_key', SPORT_KEY)
    .eq('job_type', MLB_ODDS_API_PLAYER_PROP_JOB_TYPE)
    .order('created_at', { ascending: false })
    .limit(5000)

  if (error) {
    return {
      rows: [] as ProjectLedgerRow[],
      error: `MLB Odds API project ledger read failed: ${error.message}`,
    }
  }

  return {
    rows: ((data ?? []) as ProjectLedgerRow[]).filter((row) => asRecord(row.metadata).projectBudgetKey === MLB_ODDS_API_PROJECT_BUDGET_KEY),
    error: null as string | null,
  }
}

export async function getMlbOddsApiProjectBudgetStatus() {
  const ledger = await readProjectLedger()
  const uncertainEntries: string[] = []
  let usedCredits = 0

  for (const row of ledger.rows) {
    const metadata = asRecord(row.metadata)
    const accountingStatus = String(metadata.creditAccountingStatus ?? '')
    const accountedCredits = finiteNumber(metadata.accountedCredits ?? metadata.providerCreditsConsumed)
    if (accountedCredits === null) {
      uncertainEntries.push('PROJECT_LEDGER_ROW_WITHOUT_ACCOUNTED_CREDITS')
      continue
    }
    usedCredits += accountedCredits
    if (accountingStatus && accountingStatus !== 'CONFIRMED') uncertainEntries.push(accountingStatus)
  }

  if (ledger.error) uncertainEntries.push(ledger.error)
  const remainingCredits = Math.max(0, MLB_ODDS_API_PROJECT_CREDIT_LIMIT - usedCredits)
  const accountingCertain = uncertainEntries.length === 0

  return {
    success: accountingCertain,
    mode: 'mlb_odds_api_project_budget_v1',
    projectBudgetKey: MLB_ODDS_API_PROJECT_BUDGET_KEY,
    unit: 'CREDIT' as const,
    projectCreditLimit: MLB_ODDS_API_PROJECT_CREDIT_LIMIT,
    usedCredits,
    remainingCredits,
    accountCreditTotal: MLB_ODDS_API_ACCOUNT_CREDIT_TOTAL,
    accountCreditsOutsideProjectScope: MLB_ODDS_API_ACCOUNT_CREDITS_OUTSIDE_SCOPE,
    ledgerEntries: ledger.rows.length,
    accountingCertain,
    blockers: Array.from(new Set(uncertainEntries)),
  }
}

export async function authorizeMlbOddsApiProjectCredits(estimatedCredits: number) {
  const status = await getMlbOddsApiProjectBudgetStatus()
  const cost = finiteNumber(estimatedCredits)
  const blockers = [
    !status.accountingCertain ? 'PROJECT_CREDIT_ACCOUNTING_UNCERTAIN' : null,
    cost === null || cost <= 0 ? 'INVALID_ESTIMATED_CREDIT_COST' : null,
    cost !== null && cost > status.remainingCredits ? 'PROJECT_CREDIT_LIMIT_EXCEEDED' : null,
  ].filter(Boolean) as string[]

  return {
    allowed: blockers.length === 0,
    estimatedCredits: cost,
    status,
    blockers: Array.from(new Set([...status.blockers, ...blockers])),
  }
}

export async function reserveMlbOddsApiProjectCredits(input: {
  selectedDate: string
  markets: string[]
  providerCallsPlanned: number
  estimatedCredits: number
}) {
  const reservationId = randomUUID()
  const startedAt = new Date().toISOString()
  const { error } = await supabaseAdmin.from('sports_sync_jobs').insert({
    id: reservationId,
    job_type: MLB_ODDS_API_PLAYER_PROP_JOB_TYPE,
    sport_key: SPORT_KEY,
    league_key: LEAGUE_KEY,
    provider: PROVIDER,
    season: input.selectedDate.slice(0, 4),
    started_at: startedAt,
    status: 'running',
    records_fetched: 0,
    records_inserted: 0,
    records_updated: 0,
    records_skipped: 0,
    error_count: 0,
    metadata: {
      ...baseMetadata(input),
      providerCallsPlanned: input.providerCallsPlanned,
      providerCallsMade: 0,
      providerCreditsConsumed: 0,
      accountedCredits: input.estimatedCredits,
      creditAccountingStatus: 'RESERVED',
    },
    updated_at: startedAt,
  })

  return {
    success: !error,
    reservationId: error ? null : reservationId,
    startedAt,
    error: error?.message ?? null,
  }
}

export async function finalizeMlbOddsApiProjectUsage(input: {
  reservationId: string
  startedAt: string
  completedAt: string
  selectedDate: string
  markets: string[]
  providerCallsMade: number
  estimatedCredits: number
  requestsLast: Array<number | null>
  requestsRemainingBefore: number | null
  requestsRemainingAfter: number | null
  recordsFetched: number
  recordsPersisted: number
  recordsSkipped: number
  errorCount: number
  status: 'completed' | 'partial'
}) {
  const allHeadersPresent = input.requestsLast.length === input.providerCallsMade && input.requestsLast.every((value) => finiteNumber(value) !== null)
  const observedCredits = input.requestsLast.reduce((sum, value) => sum + (finiteNumber(value) ?? 0), 0)
  const accountedCredits = allHeadersPresent ? observedCredits : Math.max(observedCredits, input.estimatedCredits)
  const creditAccountingStatus = allHeadersPresent ? 'CONFIRMED' : 'ESTIMATED_FAIL_CLOSED'
  const updatedAt = new Date().toISOString()
  const { error } = await supabaseAdmin
    .from('sports_sync_jobs')
    .update({
      completed_at: input.completedAt,
      status: input.status,
      records_fetched: input.recordsFetched,
      records_inserted: input.recordsPersisted,
      records_updated: 0,
      records_skipped: input.recordsSkipped,
      error_count: input.errorCount,
      metadata: {
        ...baseMetadata(input),
        providerCreditsConsumed: observedCredits,
        accountedCredits,
        creditAccountingStatus,
        providerCallsMade: input.providerCallsMade,
        requestsLast: input.requestsLast,
        requestsRemainingBefore: input.requestsRemainingBefore,
        requestsRemainingAfter: input.requestsRemainingAfter,
      },
      updated_at: updatedAt,
    })
    .eq('id', input.reservationId)

  return {
    success: !error,
    error: error?.message ?? null,
    observedCredits,
    accountedCredits,
    creditAccountingStatus,
  }
}
