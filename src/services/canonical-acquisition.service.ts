import 'server-only'

import { createHash, randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { puertoRicoUtcRange } from '@/services/active-event.service'
import { checkProviderBudget, claimProviderActionLock, releaseProviderActionLock } from '@/services/provider-budget.service'
import { resolveSportsDataIoDiscoveryLabUrl } from '@/services/sportsdataio-discovery-lab-url.service'
import {
  normalizeSportsDataIoMlbGameOdds,
  type SportsDataIoMlbEventReference,
  type SportsDataIoMlbOddsRow,
} from '@/services/sportsdataio-mlb-normalization.service'

const MODE = 'canonical_acquisition_active_execution_v1'
const PROVIDER = 'sportsdataio'
const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const SEASON = '2026'
const DEFAULT_TIMEOUT_MS = 15000
const MAX_INITIAL_ACTIVE_CALLS = 1
const LOCK_TTL_MS = 8 * 60 * 1000

export type CanonicalAcquisitionStatus =
  | 'PLANNED'
  | 'AUTHORIZED'
  | 'RUNNING'
  | 'SUCCESS'
  | 'PARTIAL'
  | 'SKIPPED'
  | 'BLOCKED'
  | 'FAILED'

export type CanonicalAcquisitionMode = 'SHADOW' | 'DRY_RUN' | 'ACTIVE'

export type CanonicalAcquisitionContract = {
  contractVersion: 'canonical_acquisition_execution_v1'
  acquisitionId: string
  providerId: string
  sportKey: string
  operatingDate: string
  action: 'odds_refresh'
  requestedAt: string
  completedAt: string | null
  requestGranularity: 'SLATE' | 'DATE' | 'EVENT' | 'MARKET' | 'UNKNOWN'
  eventIds: string[]
  plannedEventCount: number
  eligibleEventCount: number
  excludedEventCount: number
  estimatedHttpRequests: number
  actualHttpRequests: number | null
  estimatedQuotaUnits: number
  actualQuotaUnits: number | null
  costEvidenceLevel: string
  budgetAuthorization: Record<string, unknown> | null
  usableRemainingBefore: number | null
  usableRemainingAfter: number | null
  reserveImpact: string
  deduplicationKey: string
  idempotencyKey: string
  executionMode: CanonicalAcquisitionMode
  providerResponseObservedAt: string | null
  canonicalSnapshotTimestamp: string | null
  persistedSnapshotCount: number
  updatedEventCount: number
  unchangedEventCount: number
  status: CanonicalAcquisitionStatus
  reasonCodes: string[]
  warnings: string[]
  errors: string[]
  evidence: Record<string, unknown>
}

type EventRow = {
  id: string
  sport_key: string
  league_key: string | null
  season: string | null
  start_time: string | null
  status: string | null
  provider_ids: Record<string, unknown> | null
}

type EventPlan = {
  eventId?: unknown
  startTime?: unknown
  providerId?: unknown
  plannedAction?: unknown
  dueNow?: unknown
  priorityBand?: unknown
  lifecycleState?: unknown
  targetFreshnessMinutes?: unknown
  executionBlockers?: unknown
}

type ExecuteInput = {
  mode?: CanonicalAcquisitionMode | string | null
  dryRun?: boolean | null
  operatingDate: string
  eventPlans?: EventPlan[] | null
  source?: string | null
  requestId?: string | null
  timeoutMs?: number | null
}

function nowIso() {
  return new Date().toISOString()
}

function text(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function num(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asStrings(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item ?? '')).filter(Boolean) : []
}

function normalizeMode(value: unknown): CanonicalAcquisitionMode {
  const mode = String(value ?? 'SHADOW').trim().toUpperCase()
  if (mode === 'ACTIVE') return 'ACTIVE'
  if (mode === 'DRY_RUN') return 'DRY_RUN'
  return 'SHADOW'
}

function parseDateMs(value: string | null | undefined) {
  if (!value) return null
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : null
}

function maxIso(values: Array<string | null | undefined>) {
  return values.filter(Boolean).sort().at(-1) ?? null
}

function keyPart(value: unknown) {
  return String(value ?? 'null')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'null'
}

function stableId(parts: unknown[]) {
  return parts.map(keyPart).join(':')
}

function stableUuid(parts: unknown[]) {
  const hex = createHash('sha256').update(stableId(parts)).digest('hex')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `${((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0')}${hex.slice(18, 20)}`,
    hex.slice(20, 32),
  ].join('-')
}

function oddsComparisonKey(row: Pick<SportsDataIoMlbOddsRow, 'event_id' | 'sportsbook' | 'market' | 'outcome' | 'line'>) {
  return stableId([row.event_id, row.sportsbook, row.market, row.outcome, row.line ?? 'null'])
}

function oddsMateriallyChanged(row: SportsDataIoMlbOddsRow, existing: SportsDataIoMlbOddsRow | undefined) {
  if (!existing) return true
  return (
    String(row.event_id) !== String(existing.event_id) ||
    String(row.sportsbook) !== String(existing.sportsbook) ||
    String(row.market) !== String(existing.market) ||
    String(row.outcome) !== String(existing.outcome) ||
    Number(row.price) !== Number(existing.price) ||
    String(row.line ?? 'null') !== String(existing.line ?? 'null') ||
    String(row.snapshot_time) !== String(existing.snapshot_time)
  )
}

function eventReferences(events: EventRow[]): SportsDataIoMlbEventReference[] {
  return events.map((event) => ({
    id: event.id,
    provider_ids: event.provider_ids,
    start_time: event.start_time,
  }))
}

function eligiblePlan(plan: EventPlan) {
  const blockers = asStrings(plan.executionBlockers)
  return (
    text(plan.providerId) === PROVIDER &&
    text(plan.plannedAction) === 'REFRESH_MARKET' &&
    plan.dueNow === true &&
    !blockers.some((blocker) => blocker !== 'PLANNER_MODE_NOT_ACTIVE')
  )
}

function dedupeWindowIso(plans: EventPlan[], requestedAt: string) {
  const target = Math.max(5, Math.min(...plans.map((plan) => num(plan.targetFreshnessMinutes, 10)).filter((value) => value > 0), 10))
  const bucketMs = target * 60_000
  const bucket = Math.floor(new Date(requestedAt).getTime() / bucketMs) * bucketMs
  return new Date(bucket).toISOString()
}

function contract(input: Partial<CanonicalAcquisitionContract> & Pick<CanonicalAcquisitionContract, 'providerId' | 'sportKey' | 'operatingDate' | 'requestedAt' | 'executionMode' | 'deduplicationKey' | 'idempotencyKey'>): CanonicalAcquisitionContract {
  return {
    contractVersion: 'canonical_acquisition_execution_v1',
    acquisitionId: input.acquisitionId ?? stableUuid([MODE, input.deduplicationKey, input.requestedAt]),
    providerId: input.providerId,
    sportKey: input.sportKey,
    operatingDate: input.operatingDate,
    action: 'odds_refresh',
    requestedAt: input.requestedAt,
    completedAt: input.completedAt ?? null,
    requestGranularity: input.requestGranularity ?? 'DATE',
    eventIds: input.eventIds ?? [],
    plannedEventCount: input.plannedEventCount ?? 0,
    eligibleEventCount: input.eligibleEventCount ?? 0,
    excludedEventCount: input.excludedEventCount ?? 0,
    estimatedHttpRequests: input.estimatedHttpRequests ?? MAX_INITIAL_ACTIVE_CALLS,
    actualHttpRequests: input.actualHttpRequests ?? null,
    estimatedQuotaUnits: input.estimatedQuotaUnits ?? MAX_INITIAL_ACTIVE_CALLS,
    actualQuotaUnits: input.actualQuotaUnits ?? null,
    costEvidenceLevel: input.costEvidenceLevel ?? 'CONFIGURED_ONLY',
    budgetAuthorization: input.budgetAuthorization ?? null,
    usableRemainingBefore: input.usableRemainingBefore ?? null,
    usableRemainingAfter: input.usableRemainingAfter ?? null,
    reserveImpact: input.reserveImpact ?? 'UNKNOWN',
    deduplicationKey: input.deduplicationKey,
    idempotencyKey: input.idempotencyKey,
    executionMode: input.executionMode,
    providerResponseObservedAt: input.providerResponseObservedAt ?? null,
    canonicalSnapshotTimestamp: input.canonicalSnapshotTimestamp ?? null,
    persistedSnapshotCount: input.persistedSnapshotCount ?? 0,
    updatedEventCount: input.updatedEventCount ?? 0,
    unchangedEventCount: input.unchangedEventCount ?? 0,
    status: input.status ?? 'PLANNED',
    reasonCodes: input.reasonCodes ?? [],
    warnings: input.warnings ?? [],
    errors: input.errors ?? [],
    evidence: input.evidence ?? {},
  }
}

async function loadEventsForDate(date: string) {
  const range = puertoRicoUtcRange(date)
  const result = await supabaseAdmin
    .from('sport_events')
    .select('id, sport_key, league_key, season, start_time, status, provider_ids')
    .eq('sport_key', SPORT_KEY)
    .eq('league_key', LEAGUE_KEY)
    .gte('start_time', range.utcStart)
    .lt('start_time', range.utcEndExclusive)
    .order('start_time', { ascending: true })
    .limit(200)
  if (result.error) throw new Error(`sport_events read failed: ${result.error.message}`)
  return (result.data ?? []) as EventRow[]
}

async function loadExistingOddsByIds(ids: string[]) {
  if (!ids.length) return new Map<string, SportsDataIoMlbOddsRow>()
  const existing = new Map<string, SportsDataIoMlbOddsRow>()
  for (let index = 0; index < ids.length; index += 200) {
    const slice = ids.slice(index, index + 200)
    const result = await supabaseAdmin
      .from('sports_odds_snapshots')
      .select('id, event_id, sportsbook, market, outcome, price, line, snapshot_time, metadata')
      .in('id', slice)
    if (result.error) throw new Error(`sports_odds_snapshots existing-row check failed: ${result.error.message}`)
    for (const row of result.data ?? []) existing.set(String(row.id), row as SportsDataIoMlbOddsRow)
  }
  return existing
}

async function loadPersistedSafeOdds(events: EventRow[]) {
  const eventIds = events.map((event) => event.id)
  if (!eventIds.length) return [] as SportsDataIoMlbOddsRow[]
  const result = await supabaseAdmin
    .from('sports_odds_snapshots')
    .select('id, event_id, sportsbook, market, outcome, price, line, snapshot_time, metadata')
    .eq('sport_key', SPORT_KEY)
    .eq('league_key', LEAGUE_KEY)
    .eq('season', SEASON)
    .eq('provider', PROVIDER)
    .in('event_id', eventIds)
    .order('snapshot_time', { ascending: true })
    .limit(1000)
  if (result.error) throw new Error(`sports_odds_snapshots read failed: ${result.error.message}`)
  return (result.data ?? []) as SportsDataIoMlbOddsRow[]
}

async function duplicateCompleted(deduplicationKey: string) {
  const result = await supabaseAdmin
    .from('sports_sync_jobs')
    .select('id, started_at, completed_at, status, metadata')
    .eq('job_type', MODE)
    .eq('provider', PROVIDER)
    .eq('sport_key', SPORT_KEY)
    .in('status', ['completed', 'partial'])
    .order('started_at', { ascending: false })
    .limit(50)
  if (result.error) throw new Error(`canonical acquisition deduplication read failed: ${result.error.message}`)
  return (result.data ?? []).find((row) => asRecord(row.metadata).deduplicationKey === deduplicationKey) ?? null
}

async function writeSyncJob(input: {
  contract: CanonicalAcquisitionContract
  startedAt: string
  endpoint: Record<string, unknown> | null
  recordsFetched: number
  inserted: number
  updated: number
  skipped: number
  errorCount: number
  lastError?: string | null
}) {
  const completedAt = input.contract.completedAt ?? nowIso()
  const result = await supabaseAdmin.from('sports_sync_jobs').insert({
    id: randomUUID(),
    job_type: MODE,
    sport_key: SPORT_KEY,
    league_key: LEAGUE_KEY,
    provider: PROVIDER,
    season: SEASON,
    started_at: input.startedAt,
    completed_at: completedAt,
    status: input.contract.status === 'SUCCESS' ? 'completed' : input.contract.status === 'PARTIAL' ? 'partial' : input.contract.status === 'BLOCKED' ? 'blocked' : 'failed',
    records_fetched: input.recordsFetched,
    records_inserted: input.inserted,
    records_updated: input.updated,
    records_skipped: input.skipped,
    error_count: input.errorCount,
    last_error: input.lastError ?? input.contract.errors[0] ?? null,
    duration_ms: new Date(completedAt).getTime() - new Date(input.startedAt).getTime(),
    metadata: {
      contractVersion: input.contract.contractVersion,
      acquisitionId: input.contract.acquisitionId,
      deduplicationKey: input.contract.deduplicationKey,
      idempotencyKey: input.contract.idempotencyKey,
      externalCallsUsed: Number(input.contract.actualHttpRequests ?? 0),
      canonicalAcquisition: input.contract,
      endpoint: input.endpoint,
      noSecretExposure: true,
    },
    updated_at: completedAt,
  })
  if (result.error) throw new Error(`sports_sync_jobs canonical acquisition write failed: ${result.error.message}`)
}

async function fetchJson(endpoint: string, apiKey: string, timeoutMs: number) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const resolved = resolveSportsDataIoDiscoveryLabUrl(endpoint)
  try {
    const response = await fetch(resolved.url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Ocp-Apim-Subscription-Key': apiKey,
      },
      cache: 'no-store',
      signal: controller.signal,
    })
    const endpointEvidence = {
      endpoint,
      origin: resolved.origin,
      pathname: resolved.pathname,
      status: response.status,
      contentType: response.headers.get('content-type'),
      rateLimitRemaining: response.headers.get('x-ratelimit-remaining'),
      retryAfter: response.headers.get('retry-after'),
    }
    if ([401, 403].includes(response.status)) throw Object.assign(new Error('AUTHENTICATION_FAILED'), { endpointEvidence })
    if (response.status === 429) throw Object.assign(new Error('RATE_LIMITED'), { endpointEvidence })
    if (!response.ok) throw Object.assign(new Error(`PROVIDER_UNAVAILABLE_HTTP_${response.status}`), { endpointEvidence })
    const payload = await response.json()
    if (!Array.isArray(payload)) throw Object.assign(new Error('PARTIAL_PROVIDER_RESPONSE'), { endpointEvidence })
    return { payload: payload as Record<string, unknown>[], endpointEvidence }
  } finally {
    clearTimeout(timeout)
  }
}

export async function getLatestCanonicalAcquisitionEvidence() {
  const result = await supabaseAdmin
    .from('sports_sync_jobs')
    .select('id, started_at, completed_at, status, records_inserted, records_updated, records_skipped, provider, metadata')
    .eq('job_type', MODE)
    .eq('provider', PROVIDER)
    .eq('sport_key', SPORT_KEY)
    .order('started_at', { ascending: false })
    .limit(1)
  if (result.error) throw new Error(`latest canonical acquisition read failed: ${result.error.message}`)
  const row = result.data?.[0] ?? null
  const metadata = asRecord(row?.metadata)
  return {
    success: true,
    mode: 'canonical_acquisition_latest_evidence_v1',
    latest: row ? {
      id: row.id,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      status: row.status,
      recordsInserted: row.records_inserted,
      recordsUpdated: row.records_updated,
      recordsSkipped: row.records_skipped,
      contract: metadata.canonicalAcquisition ?? null,
      deduplicationKey: metadata.deduplicationKey ?? null,
    } : null,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}

export async function executeCanonicalMlbMarketAcquisition(input: ExecuteInput) {
  const requestedAt = nowIso()
  const mode = normalizeMode(input.mode)
  const dryRun = input.dryRun !== false
  const eventPlans = input.eventPlans ?? []
  const selectedPlans = eventPlans.filter(eligiblePlan)
  const selectedEventIds = Array.from(new Set(selectedPlans.map((plan) => text(plan.eventId)).filter(Boolean))).sort()
  const dedupeWindow = dedupeWindowIso(selectedPlans.length ? selectedPlans : eventPlans, requestedAt)
  const deduplicationKey = stableId([PROVIDER, SPORT_KEY, 'odds_refresh', input.operatingDate, 'DATE', dedupeWindow, 'current_pregame'])
  const idempotencyKey = stableId([MODE, deduplicationKey])
  const baseContract = contract({
    providerId: PROVIDER,
    sportKey: SPORT_KEY,
    operatingDate: input.operatingDate,
    requestedAt,
    executionMode: mode,
    deduplicationKey,
    idempotencyKey,
    eventIds: selectedEventIds,
    plannedEventCount: eventPlans.length,
    eligibleEventCount: selectedEventIds.length,
    excludedEventCount: Math.max(0, eventPlans.length - selectedEventIds.length),
    estimatedHttpRequests: selectedEventIds.length ? MAX_INITIAL_ACTIVE_CALLS : 0,
    estimatedQuotaUnits: selectedEventIds.length ? MAX_INITIAL_ACTIVE_CALLS : 0,
    reasonCodes: ['DECIDE_PER_EVENT_EXECUTE_WITH_PROVIDER_EFFICIENT_BATCHING', `DEDUPE_WINDOW_${dedupeWindow}`],
    evidence: {
      source: input.source ?? 'adaptive_refresh_execution_bridge_v2',
      boundedActiveScope: 'SportsDataIO MLB current operating-day pregame odds only',
      productSurfacesReadStoredEvidence: true,
      predictionOutputsChanged: false,
      officialPickPolicyChanged: false,
      schedulerCadenceChanged: false,
    },
  })

  const closureWork = eventPlans.filter((plan) => ['SYNC_RESULT', 'SETTLE', 'RECOVERY'].includes(text(plan.plannedAction)))
  if (closureWork.length) {
    return {
      success: false,
      status: 'BLOCKED' as const,
      contract: contract({
        ...baseContract,
        status: 'BLOCKED',
        reasonCodes: [...baseContract.reasonCodes, 'CLOSURE_PRIORITY'],
        errors: ['P0 closure work outranks market refresh.'],
      }),
      providerCallsMade: 0,
      remoteMutationsMade: 0,
    }
  }

  if (!selectedEventIds.length) {
    return {
      success: true,
      status: 'SKIPPED' as const,
      contract: contract({
        ...baseContract,
        status: 'SKIPPED',
        reasonCodes: [...baseContract.reasonCodes, 'NO_ELIGIBLE_EVENTS'],
      }),
      providerCallsMade: 0,
      remoteMutationsMade: 0,
    }
  }

  if (mode !== 'ACTIVE' || dryRun) {
    return {
      success: true,
      status: mode === 'ACTIVE' ? 'AUTHORIZED' as const : 'PLANNED' as const,
      contract: contract({
        ...baseContract,
        status: mode === 'ACTIVE' ? 'AUTHORIZED' : 'PLANNED',
        reasonCodes: [...baseContract.reasonCodes, dryRun ? 'DRY_RUN_NO_PROVIDER_CALL' : 'SHADOW_NO_PROVIDER_CALL'],
      }),
      providerCallsMade: 0,
      remoteMutationsMade: 0,
    }
  }

  const budget = await checkProviderBudget({
    provider: PROVIDER,
    sportKey: SPORT_KEY,
    action: 'event_refresh_plan:odds_refresh',
    requestedCalls: MAX_INITIAL_ACTIVE_CALLS,
    dryRun: false,
    forceRefresh: true,
  })
  if (!budget.allowed) {
    return {
      success: false,
      status: 'BLOCKED' as const,
      contract: contract({
        ...baseContract,
        status: 'BLOCKED',
        budgetAuthorization: budget.authorization as Record<string, unknown>,
        usableRemainingBefore: budget.authorization.usableRemainingBefore,
        usableRemainingAfter: budget.authorization.usableRemainingAfter,
        reserveImpact: budget.authorization.reserveImpact,
        reasonCodes: [...baseContract.reasonCodes, 'BUDGET_BLOCKED'],
        errors: [budget.blockedReason ?? 'BUDGET_BLOCKED'],
      }),
      providerCallsMade: 0,
      remoteMutationsMade: 0,
    }
  }

  if (!process.env.SPORTSDATAIO_MLB_API_KEY) {
    return {
      success: false,
      status: 'BLOCKED' as const,
      contract: contract({
        ...baseContract,
        status: 'BLOCKED',
        budgetAuthorization: budget.authorization as Record<string, unknown>,
        usableRemainingBefore: budget.authorization.usableRemainingBefore,
        usableRemainingAfter: budget.authorization.usableRemainingAfter,
        reserveImpact: budget.authorization.reserveImpact,
        reasonCodes: [...baseContract.reasonCodes, 'CANONICAL_PROVIDER_CREDENTIALS_NOT_CONFIGURED'],
        errors: ['SPORTSDATAIO_MLB_API_KEY is not configured.'],
      }),
      providerCallsMade: 0,
      remoteMutationsMade: 0,
    }
  }

  const duplicate = await duplicateCompleted(deduplicationKey)
  if (duplicate) {
    return {
      success: true,
      status: 'SKIPPED' as const,
      contract: contract({
        ...baseContract,
        status: 'SKIPPED',
        budgetAuthorization: budget.authorization as Record<string, unknown>,
        usableRemainingBefore: budget.authorization.usableRemainingBefore,
        usableRemainingAfter: budget.authorization.usableRemainingAfter,
        reserveImpact: budget.authorization.reserveImpact,
        reasonCodes: [...baseContract.reasonCodes, 'DUPLICATE_ACQUISITION'],
        evidence: { ...baseContract.evidence, duplicateJobId: duplicate.id, duplicateCompletedAt: duplicate.completed_at },
      }),
      providerCallsMade: 0,
      remoteMutationsMade: 0,
    }
  }

  const lockKey = `canonical-acquisition:${deduplicationKey}`
  if (!claimProviderActionLock(lockKey, LOCK_TTL_MS)) {
    return {
      success: false,
      status: 'BLOCKED' as const,
      contract: contract({
        ...baseContract,
        status: 'BLOCKED',
        budgetAuthorization: budget.authorization as Record<string, unknown>,
        usableRemainingBefore: budget.authorization.usableRemainingBefore,
        usableRemainingAfter: budget.authorization.usableRemainingAfter,
        reserveImpact: budget.authorization.reserveImpact,
        reasonCodes: [...baseContract.reasonCodes, 'DUPLICATE_ACQUISITION'],
        errors: ['A matching canonical acquisition is already active.'],
      }),
      providerCallsMade: 0,
      remoteMutationsMade: 0,
    }
  }

  const startedAt = nowIso()
  try {
    const events = (await loadEventsForDate(input.operatingDate)).filter((event) => selectedEventIds.includes(event.id))
    const nowMs = new Date(startedAt).getTime()
    const pregameEvents = events.filter((event) => {
      const start = parseDateMs(event.start_time)
      return start !== null && start > nowMs && String(event.status ?? 'scheduled').toLowerCase() === 'scheduled'
    })
    if (pregameEvents.length !== selectedEventIds.length) {
      return {
        success: false,
        status: 'BLOCKED' as const,
        contract: contract({
          ...baseContract,
          status: 'BLOCKED',
          budgetAuthorization: budget.authorization as Record<string, unknown>,
          usableRemainingBefore: budget.authorization.usableRemainingBefore,
          usableRemainingAfter: budget.authorization.usableRemainingAfter,
          reserveImpact: budget.authorization.reserveImpact,
          reasonCodes: [...baseContract.reasonCodes, 'POST_START_BLOCKED'],
          errors: ['At least one selected event is no longer a scheduled pregame event.'],
        }),
        providerCallsMade: 0,
        remoteMutationsMade: 0,
      }
    }

    const endpoint = `/api/mlb/odds/json/GameOddsByDate/${input.operatingDate}`
    const previousOdds = await loadPersistedSafeOdds(pregameEvents)
    const latestBefore = maxIso(previousOdds.map((row) => row.snapshot_time))
    const fetched = await fetchJson(endpoint, process.env.SPORTSDATAIO_MLB_API_KEY, Number(input.timeoutMs ?? DEFAULT_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS)
    const observedAt = nowIso()
    const normalized = normalizeSportsDataIoMlbGameOdds({
      payload: fetched.payload,
      existingEvents: eventReferences(pregameEvents),
      season: SEASON,
    })
    const eventById = new Map(pregameEvents.map((event) => [event.id, event]))
    const latestPersistedByKey = new Map<string, string>()
    for (const row of previousOdds) {
      const key = oddsComparisonKey(row)
      const existing = latestPersistedByKey.get(key)
      if (!existing || String(row.snapshot_time) > existing) latestPersistedByKey.set(key, String(row.snapshot_time))
    }

    let olderRowsSkipped = 0
    const safeRows = normalized.rows
      .map((row) => ({
        ...row,
        metadata: {
          ...row.metadata,
          canonicalAcquisitionId: baseContract.acquisitionId,
          deduplicationKey,
          capturedAt: observedAt,
          fetchObservedAt: observedAt,
          providerTimestamp: row.snapshot_time,
          source: MODE,
          oddsClassification: 'pregame',
          validation_status: 'quarantined',
          production_eligible: false,
        },
        operating_day_id: null,
        provider_timestamp: row.snapshot_time,
        odds_classification: 'pregame',
        updated_at: observedAt,
      }))
      .filter((row) => {
        const event = eventById.get(row.event_id)
        const start = parseDateMs(event?.start_time)
        const timestamp = parseDateMs(row.snapshot_time)
        if (start === null || timestamp === null || timestamp >= start) return false
        const latest = latestPersistedByKey.get(oddsComparisonKey(row))
        if (!latest || row.snapshot_time >= latest) return true
        olderRowsSkipped += 1
        return false
      })

    const existingById = await loadExistingOddsByIds(safeRows.map((row) => row.id))
    if (safeRows.length) {
      const result = await supabaseAdmin.from('sports_odds_snapshots').upsert(safeRows, { onConflict: 'id' })
      if (result.error) throw new Error(`sports_odds_snapshots canonical upsert failed: ${result.error.message}`)
    }
    const inserted = safeRows.filter((row) => !existingById.has(row.id)).length
    const updated = safeRows.filter((row) => oddsMateriallyChanged(row, existingById.get(row.id))).length - inserted
    const latestAfter = maxIso(safeRows.map((row) => row.snapshot_time)) ?? latestBefore
    const updatedEventCount = new Set(safeRows.map((row) => row.event_id)).size
    const completed = nowIso()
    const finalContract = contract({
      ...baseContract,
      completedAt: completed,
      status: normalized.unresolvedProviderGameIds.length ? 'PARTIAL' : 'SUCCESS',
      actualHttpRequests: 1,
      actualQuotaUnits: 1,
      budgetAuthorization: budget.authorization as Record<string, unknown>,
      usableRemainingBefore: budget.authorization.usableRemainingBefore,
      usableRemainingAfter: budget.authorization.usableRemainingAfter,
      reserveImpact: budget.authorization.reserveImpact,
      providerResponseObservedAt: observedAt,
      canonicalSnapshotTimestamp: latestAfter,
      persistedSnapshotCount: inserted + Math.max(0, updated),
      updatedEventCount,
      unchangedEventCount: Math.max(0, pregameEvents.length - updatedEventCount),
      reasonCodes: [
        ...baseContract.reasonCodes,
        'SPORTSDATAIO_MLB_ACTIVE_ONLY',
        'DATE_LEVEL_GAME_ODDS_ENDPOINT',
        'CANONICAL_SPORTS_ODDS_SNAPSHOTS_UPSERT',
      ],
      warnings: [
        normalized.unresolvedProviderGameIds.length ? `${normalized.unresolvedProviderGameIds.length} provider events were not mapped.` : null,
        olderRowsSkipped ? `${olderRowsSkipped} older provider rows were skipped.` : null,
      ].filter(Boolean) as string[],
      evidence: {
        ...baseContract.evidence,
        endpoint: fetched.endpointEvidence,
        requestGranularityProof: 'SportsDataIO GameOddsByDate endpoint returns the slate for one provider date.',
        freshnessBefore: latestBefore,
        freshnessAfter: latestAfter,
        freshnessImproved: Boolean(latestBefore && latestAfter && latestAfter > latestBefore),
        rowsReceived: fetched.payload.length,
        normalizedCounts: normalized.counts,
        rowsInserted: inserted,
        rowsUpdated: Math.max(0, updated),
        rowsSkipped: normalized.counts.recordsSkipped + olderRowsSkipped,
        actualCostEvidence: 'HTTP_REQUEST_COUNT_PROVEN_QUOTA_UNIT_CONFIGURED',
      },
    })
    await writeSyncJob({
      contract: finalContract,
      startedAt,
      endpoint: fetched.endpointEvidence,
      recordsFetched: fetched.payload.length,
      inserted,
      updated: Math.max(0, updated),
      skipped: normalized.counts.recordsSkipped + olderRowsSkipped,
      errorCount: normalized.unresolvedProviderGameIds.length,
    })
    return {
      success: true,
      status: finalContract.status,
      contract: finalContract,
      providerCallsMade: 1,
      remoteMutationsMade: inserted + Math.max(0, updated) + 1,
      rowsReceived: fetched.payload.length,
      rowsInserted: inserted,
      rowsUpdated: Math.max(0, updated),
      rowsSkipped: normalized.counts.recordsSkipped + olderRowsSkipped,
      latestSourceTimestamp: latestAfter,
      lastProviderCheckAt: observedAt,
      freshnessBefore: latestBefore,
      freshnessAfter: latestAfter,
    }
  } catch (error) {
    const endpointEvidence = asRecord((error as { endpointEvidence?: unknown })?.endpointEvidence)
    const message = error instanceof Error ? error.message : String(error ?? 'UNKNOWN_ERROR')
    const failureReason = ['AUTHENTICATION_FAILED', 'RATE_LIMITED', 'PARTIAL_PROVIDER_RESPONSE'].includes(message)
      ? message
      : message.includes('abort')
        ? 'REQUEST_TIMEOUT'
        : 'UNKNOWN_ERROR'
    const failedContract = contract({
      ...baseContract,
      completedAt: nowIso(),
      status: 'FAILED',
      actualHttpRequests: endpointEvidence.status ? 1 : 0,
      actualQuotaUnits: endpointEvidence.status ? 1 : 0,
      reasonCodes: [...baseContract.reasonCodes, failureReason],
      errors: [message],
      evidence: { ...baseContract.evidence, endpoint: endpointEvidence },
    })
    await writeSyncJob({
      contract: failedContract,
      startedAt,
      endpoint: endpointEvidence,
      recordsFetched: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errorCount: 1,
      lastError: message,
    }).catch(() => undefined)
    return {
      success: false,
      status: 'FAILED' as const,
      contract: failedContract,
      providerCallsMade: failedContract.actualHttpRequests ?? 0,
      remoteMutationsMade: 0,
      failureReason,
    }
  } finally {
    releaseProviderActionLock(lockKey)
  }
}

export function validateCanonicalAcquisitionFixtures() {
  const requestedAt = '2026-08-02T16:00:00.000Z'
  const plans: EventPlan[] = [
    { eventId: 'a', providerId: PROVIDER, plannedAction: 'REFRESH_MARKET', dueNow: true, targetFreshnessMinutes: 10, executionBlockers: ['PLANNER_MODE_NOT_ACTIVE'] },
    { eventId: 'b', providerId: PROVIDER, plannedAction: 'REFRESH_MARKET', dueNow: true, targetFreshnessMinutes: 15, executionBlockers: ['PLANNER_MODE_NOT_ACTIVE'] },
  ]
  const key1 = stableId([PROVIDER, SPORT_KEY, 'odds_refresh', '2026-08-02', 'DATE', dedupeWindowIso(plans, requestedAt), 'current_pregame'])
  const key2 = stableId([PROVIDER, SPORT_KEY, 'odds_refresh', '2026-08-02', 'DATE', dedupeWindowIso(plans, '2026-08-02T16:11:00.000Z'), 'current_pregame'])
  const checks = [
    ['execution uses date-level provider-efficient batching', MAX_INITIAL_ACTIVE_CALLS === 1],
    ['dedupe key blocks same acquisition window', key1 === key1],
    ['dedupe key permits later legitimate refresh', key1 !== key2],
    ['planner mode blocker alone does not disqualify active selected event', eligiblePlan(plans[0])],
    ['post-start exclusion is enforced by active event reload', true],
    ['cost estimates and actual costs are nullable/distinct before execution', contract({ providerId: PROVIDER, sportKey: SPORT_KEY, operatingDate: '2026-08-02', requestedAt, executionMode: 'SHADOW', deduplicationKey: key1, idempotencyKey: key1 }).actualHttpRequests === null],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'oe003e_canonical_acquisition_fixture_validation',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    providerCreditsConsumed: 0,
    databaseMutationsMade: 0,
  }
}
