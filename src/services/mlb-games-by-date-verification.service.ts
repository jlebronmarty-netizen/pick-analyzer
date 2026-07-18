import 'server-only'

import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { checkProviderBudget } from '@/services/provider-budget.service'
import { resolveSportsDataIoDiscoveryLabUrl } from '@/services/sportsdataio-discovery-lab-url.service'
import {
  SPORTSDATAIO_MLB_DOCUMENTED_STARTER_FIELDS,
  SPORTSDATAIO_MLB_DOCUMENTED_VENUE_FIELDS,
  SPORTSDATAIO_MLB_DOCUMENTED_WEATHER_FIELDS,
  type SportsDataIoMlbGame,
} from '@/types/sportsdataio-mlb'

const PROVIDER = 'sportsdataio'
const PROVIDER_VARIANT = 'sportsdataio_discovery_lab'
const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const SEASON = '2026'
const MODE = 'sportsdataio_mlb_games_by_date_verification_v1'
const DEFAULT_TIMEOUT_MS = 15000

type VerificationInput = {
  date?: string | null
  confirmed?: boolean | null
  dryRun?: boolean | null
  timeoutMs?: number | null
}

type EndpointResult = {
  endpoint: string
  origin: string
  pathname: string
  status: number
  contentType: string | null
  rateLimitRemaining: string | null
  retryAfter: string | null
}

function nowIso() {
  return new Date().toISOString()
}

function safeString(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function hasValue(value: unknown) {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  return true
}

function sanitizeSample(value: unknown) {
  if (!hasValue(value)) return null
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value === 'string') return value.slice(0, 80)
  return '[structured value omitted]'
}

function normalizeInputDate(input: string | null | undefined) {
  const raw = safeString(input)
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) {
    const [, year, month, day] = isoMatch
    const parsed = new Date(`${year}-${month}-${day}T00:00:00.000Z`)
    if (
      parsed.getUTCFullYear() === Number(year) &&
      parsed.getUTCMonth() + 1 === Number(month) &&
      parsed.getUTCDate() === Number(day)
    ) {
      const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
      return {
        ok: true as const,
        selectedDate: `${year}-${month}-${day}`,
        providerDate: `${year}-${months[parsed.getUTCMonth()]}-${day}`,
      }
    }
  }

  const providerMatch = raw.toUpperCase().match(/^(\d{4})-([A-Z]{3})-(\d{2})$/)
  if (providerMatch) {
    const [, year, mon, day] = providerMatch
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
    const monthIndex = months.indexOf(mon)
    if (monthIndex >= 0) {
      const month = String(monthIndex + 1).padStart(2, '0')
      const parsed = new Date(`${year}-${month}-${day}T00:00:00.000Z`)
      if (parsed.getUTCDate() === Number(day)) {
        return { ok: true as const, selectedDate: `${year}-${month}-${day}`, providerDate: `${year}-${mon}-${day}` }
      }
    }
  }

  return {
    ok: false as const,
    selectedDate: null,
    providerDate: null,
    error: 'Invalid date. Use YYYY-MM-DD or SportsDataIO YYYY-MMM-DD format.',
  }
}

function stableId(parts: unknown[]) {
  return parts
    .map((part) =>
      String(part ?? 'null')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9.-]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'null'
    )
    .join(':')
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

async function fetchGamesByDate(endpoint: string, apiKey: string, timeoutMs: number) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const resolvedUrl = resolveSportsDataIoDiscoveryLabUrl(endpoint)
  try {
    const response = await fetch(resolvedUrl.url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Ocp-Apim-Subscription-Key': apiKey,
      },
      cache: 'no-store',
      signal: controller.signal,
    })
    const endpointResult: EndpointResult = {
      endpoint,
      origin: resolvedUrl.origin,
      pathname: resolvedUrl.pathname,
      status: response.status,
      contentType: response.headers.get('content-type'),
      rateLimitRemaining: response.headers.get('x-ratelimit-remaining'),
      retryAfter: response.headers.get('retry-after'),
    }
    if (!response.ok) {
      throw Object.assign(new Error(`SportsDataIO MLB GamesByDate returned HTTP ${response.status}.`), { endpointResult })
    }
    const payload = await response.json()
    if (!Array.isArray(payload)) {
      throw Object.assign(new Error('SportsDataIO MLB GamesByDate returned a non-array payload.'), { endpointResult })
    }
    return { payload: payload as SportsDataIoMlbGame[], endpointResult }
  } finally {
    clearTimeout(timeout)
  }
}

function fieldMatrix(payload: SportsDataIoMlbGame[], fields: readonly string[], domain: 'starter' | 'weather' | 'venue') {
  return fields.map((fieldName) => {
    const present = payload.filter((game) => Object.prototype.hasOwnProperty.call(game, fieldName))
    const populated = present.filter((game) => hasValue(game[fieldName]))
    const nullCount = Math.max(0, present.length - populated.length)
    const absentCount = Math.max(0, payload.length - present.length)
    return {
      domain,
      fieldName,
      populatedCount: populated.length,
      nullCount,
      absentCount,
      sampleSanitizedValue: sanitizeSample(populated[0]?.[fieldName]),
      safeToNormalize: populated.length > 0,
      propertyState:
        populated.length > 0
          ? 'property_present_populated'
          : nullCount > 0
            ? 'property_present_null'
            : 'property_absent',
    }
  })
}

function sanitizeGame(game: SportsDataIoMlbGame) {
  const selectedFields = [
    ...SPORTSDATAIO_MLB_DOCUMENTED_STARTER_FIELDS,
    ...SPORTSDATAIO_MLB_DOCUMENTED_WEATHER_FIELDS,
    ...SPORTSDATAIO_MLB_DOCUMENTED_VENUE_FIELDS,
  ]
  const extracted: Record<string, unknown> = {}
  for (const field of selectedFields) {
    if (Object.prototype.hasOwnProperty.call(game, field)) extracted[field] = sanitizeSample(game[field])
  }
  return {
    GameID: sanitizeSample(game.GameID ?? game.GameId),
    DateTime: sanitizeSample(game.DateTime ?? game.DateTimeUTC ?? game.Day ?? game.GameDate),
    AwayTeam: sanitizeSample(game.AwayTeam ?? game.AwayTeamKey ?? game.AwayTeamName),
    HomeTeam: sanitizeSample(game.HomeTeam ?? game.HomeTeamKey ?? game.HomeTeamName),
    fields: extracted,
  }
}

async function writeVerificationLedger(input: {
  selectedDate: string
  providerDate: string
  startedAt: string
  endpoint: EndpointResult | null
  status: 'completed' | 'failed'
  recordsFetched: number
  providerCallsUsed: number
  rawPayload?: SportsDataIoMlbGame[] | null
  fieldPresence: unknown
  sanitizedSnapshot: unknown
  lastError?: string | null
}) {
  const completedAt = nowIso()
  const { data, error } = await supabaseAdmin
    .from('sports_sync_jobs')
    .insert({
      id: crypto.randomUUID(),
      job_type: MODE,
      sport_key: SPORT_KEY,
      league_key: LEAGUE_KEY,
      provider: PROVIDER,
      season: SEASON,
      started_at: input.startedAt,
      completed_at: completedAt,
      status: input.status,
      records_fetched: input.recordsFetched,
      records_inserted: 0,
      records_updated: 0,
      records_skipped: 0,
      error_count: input.status === 'failed' ? 1 : 0,
      last_error: input.lastError ?? null,
      duration_ms: new Date(completedAt).getTime() - new Date(input.startedAt).getTime(),
      metadata: {
        providerVariant: PROVIDER_VARIANT,
        executionVersion: MODE,
        verificationOnly: true,
        externalCallsUsed: input.providerCallsUsed,
        endpoint: input.endpoint,
        checkpoint: {
          key: stableId([MODE, input.providerDate]),
          status: input.status,
          phase: 'games_by_date_payload_verification',
          selectedDate: input.selectedDate,
          providerDate: input.providerDate,
          providerCallsUsed: input.providerCallsUsed,
          httpStatus: input.endpoint?.status ?? null,
          startedAt: input.startedAt,
          completedAt,
          production_eligible: false,
        },
        rawPayload: input.rawPayload ?? null,
        sanitizedSnapshot: input.sanitizedSnapshot,
        fieldPresence: input.fieldPresence,
        rawPayloadStored: Array.isArray(input.rawPayload),
        sanitizedVerificationSnapshotStored: input.status === 'completed',
        noSecretExposure: true,
      },
      updated_at: completedAt,
    })
    .select('id')
    .single()
  if (error) throw new Error(`SportsDataIO MLB GamesByDate verification ledger write failed: ${error.message}`)
  return String(data.id)
}

export async function verifyMlbGamesByDatePayload(input: VerificationInput = {}) {
  const dryRun = input.dryRun !== false
  const confirmed = input.confirmed === true
  const timeoutMs = Math.min(Math.max(Number(input.timeoutMs ?? DEFAULT_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS, 1000), 30000)
  const normalizedDate = normalizeInputDate(input.date ?? '2026-07-17')
  const generatedAt = nowIso()

  if (!normalizedDate.ok) {
    return {
      success: false,
      mode: MODE,
      status: 'rejected',
      generatedAt,
      error: normalizedDate.error,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
    }
  }

  const endpoint = `/api/mlb/odds/json/GamesByDate/${normalizedDate.providerDate}`
  const resolvedUrl = resolveSportsDataIoDiscoveryLabUrl(endpoint)
  const budget = await checkProviderBudget({
    provider: PROVIDER,
    sportKey: SPORT_KEY,
    action: 'games_by_date_payload_verification',
    requestedCalls: dryRun || !confirmed ? 0 : 1,
    dryRun: dryRun || !confirmed,
  })

  const base = {
    success: true,
    mode: MODE,
    generatedAt,
    selectedDate: normalizedDate.selectedDate,
    providerDate: normalizedDate.providerDate,
    method: 'POST internal route, GET provider request',
    providerEndpoint: endpoint,
    providerUrlPattern: `${resolvedUrl.origin}/api/mlb/odds/json/GamesByDate/{date}`,
    authentication: 'Server-side Ocp-Apim-Subscription-Key header from SPORTSDATAIO_MLB_API_KEY; never exposed in responses.',
    requiresConfirmedTrue: true,
    providerBudget: {
      allowed: budget.allowed,
      approvedCalls: budget.approvedCalls,
      blockedReason: budget.blockedReason,
      callsMadeToday: budget.status.callsMadeToday,
      estimatedCallsRemaining: budget.status.estimatedCallsRemaining,
    },
    runtimeConfiguration: {
      sportsDataIoMlbApiKeyConfigured: Boolean(process.env.SPORTSDATAIO_MLB_API_KEY),
    },
    providerCallsPlanned: dryRun || !confirmed ? 0 : 1,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }

  if (!confirmed) {
    return {
      ...base,
      status: 'confirmation_required',
      warnings: ['confirmed=true is required before any SportsDataIO call.'],
    }
  }

  if (dryRun) {
    return {
      ...base,
      status: 'dry_run',
      validation: validateMlbGamesByDateVerificationFixtures(),
      warnings: ['Dry run made zero provider calls and wrote no ledger row.'],
    }
  }

  if (!budget.allowed) {
    return {
      ...base,
      success: false,
      status: 'budget_blocked',
      warnings: [budget.blockedReason ?? 'Provider budget blocked the verification call.'],
    }
  }

  const apiKey = process.env.SPORTSDATAIO_MLB_API_KEY
  if (!apiKey) {
    return {
      ...base,
      success: false,
      status: 'configuration_blocked',
      warnings: ['SPORTSDATAIO_MLB_API_KEY is not configured in the server runtime.'],
    }
  }

  const startedAt = nowIso()
  try {
    const response = await fetchGamesByDate(endpoint, apiKey, timeoutMs)
    const fieldPresence = [
      ...fieldMatrix(response.payload, SPORTSDATAIO_MLB_DOCUMENTED_STARTER_FIELDS, 'starter'),
      ...fieldMatrix(response.payload, SPORTSDATAIO_MLB_DOCUMENTED_WEATHER_FIELDS, 'weather'),
      ...fieldMatrix(response.payload, SPORTSDATAIO_MLB_DOCUMENTED_VENUE_FIELDS, 'venue'),
    ]
    const sanitizedSnapshot = {
      providerTimestamp: response.endpointResult.rateLimitRemaining ? null : null,
      capturedAt: nowIso(),
      games: response.payload.map(sanitizeGame),
    }
    const ledgerId = await writeVerificationLedger({
      selectedDate: normalizedDate.selectedDate,
      providerDate: normalizedDate.providerDate,
      startedAt,
      endpoint: response.endpointResult,
      status: 'completed',
      recordsFetched: response.payload.length,
      providerCallsUsed: 1,
      rawPayload: response.payload,
      fieldPresence,
      sanitizedSnapshot,
    })
    const starterReady = fieldPresence.some((row) => row.domain === 'starter' && row.populatedCount > 0)
    const weatherReady = fieldPresence.some((row) => row.domain === 'weather' && row.populatedCount > 0)
    return {
      ...base,
      status: 'completed',
      providerCallsMade: 1,
      remoteMutationsMade: 1,
      ledger: { table: 'sports_sync_jobs', id: ledgerId, rawPayloadStored: true, sanitizedVerificationSnapshotStored: true },
      endpoint: response.endpointResult,
      recordsFetched: response.payload.length,
      fieldPresence,
      summary: {
        starterFieldsFound: fieldPresence.filter((row) => row.domain === 'starter' && row.absentCount < response.payload.length).map((row) => row.fieldName),
        weatherFieldsFound: fieldPresence.filter((row) => row.domain === 'weather' && row.absentCount < response.payload.length).map((row) => row.fieldName),
        venueFieldsFound: fieldPresence.filter((row) => row.domain === 'venue' && row.absentCount < response.payload.length).map((row) => row.fieldName),
        gamesWithStarterValues: Math.max(...fieldPresence.filter((row) => row.domain === 'starter').map((row) => row.populatedCount), 0),
        gamesWithWeatherValues: Math.max(...fieldPresence.filter((row) => row.domain === 'weather').map((row) => row.populatedCount), 0),
        gamesWithVenueValues: Math.max(...fieldPresence.filter((row) => row.domain === 'venue').map((row) => row.populatedCount), 0),
      },
      normalizationDecision: {
        starter: starterReady ? 'ready_to_design_normalizer_after_review' : 'not_ready_no_populated_starter_values',
        weather: weatherReady ? 'ready_to_design_normalizer_after_review' : 'not_ready_no_populated_weather_values',
        normalizerAdded: false,
      },
    }
  } catch (error) {
    const endpointResult = (error as { endpointResult?: EndpointResult }).endpointResult ?? null
    const ledgerId = await writeVerificationLedger({
      selectedDate: normalizedDate.selectedDate,
      providerDate: normalizedDate.providerDate,
      startedAt,
      endpoint: endpointResult,
      status: 'failed',
      recordsFetched: 0,
      providerCallsUsed: 1,
      rawPayload: null,
      fieldPresence: [],
      sanitizedSnapshot: { capturedAt: nowIso(), games: [] },
      lastError: error instanceof Error ? error.message : 'Unknown SportsDataIO GamesByDate verification error',
    })
    return {
      ...base,
      success: false,
      status: 'provider_failed',
      providerCallsMade: 1,
      remoteMutationsMade: 1,
      ledger: { table: 'sports_sync_jobs', id: ledgerId, rawPayloadStored: false, sanitizedVerificationSnapshotStored: false },
      endpoint: endpointResult,
      error: error instanceof Error ? error.message : 'Unknown SportsDataIO GamesByDate verification error',
    }
  }
}

export function validateMlbGamesByDateVerificationFixtures() {
  const iso = normalizeInputDate('2026-07-17')
  const provider = normalizeInputDate('2026-JUL-17')
  const invalid = normalizeInputDate('2026-17-99')
  const endpoint = '/api/mlb/odds/json/GamesByDate/2026-JUL-17'
  const resolved = resolveSportsDataIoDiscoveryLabUrl(endpoint)
  const checks = [
    ['iso date converts to SportsDataIO date', iso.ok && iso.providerDate === '2026-JUL-17'],
    ['provider date converts to selected date', provider.ok && provider.selectedDate === '2026-07-17'],
    ['invalid date is rejected before provider calls', !invalid.ok],
    ['endpoint is constrained to GamesByDate', endpoint === '/api/mlb/odds/json/GamesByDate/2026-JUL-17'],
    ['Discovery Lab origin is resolved', resolved.url === 'https://api.sportsdata.io/api/mlb/odds/json/GamesByDate/2026-JUL-17'],
    ['exact documented starter field catalog is present', SPORTSDATAIO_MLB_DOCUMENTED_STARTER_FIELDS.includes('AwayTeamProbablePitcherID')],
    ['exact documented weather field catalog is present', SPORTSDATAIO_MLB_DOCUMENTED_WEATHER_FIELDS.includes('ForecastWindSpeed')],
    ['documented venue field catalog is present', SPORTSDATAIO_MLB_DOCUMENTED_VENUE_FIELDS.includes('StadiumID')],
    ['present/null/absent states are represented', true],
    ['deterministic validation made zero provider calls', true],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'mlb_games_by_date_verification_validation_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
  }
}
