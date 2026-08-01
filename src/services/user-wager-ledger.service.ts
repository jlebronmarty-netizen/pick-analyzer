import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type UserWagerStatus = 'DRAFT' | 'PLACED' | 'WON' | 'LOST' | 'PUSH' | 'VOID' | 'ARCHIVED'
export type UserWagerBetType = 'SINGLE' | 'PARLAY'
export type UserWagerSourceCategory = 'OFFICIAL_PICK' | 'VALUE_CANDIDATE' | 'RESEARCH_PICK' | 'USER_ONLY' | 'MIXED'

export type UserWagerLegInput = {
  eventId?: string | null
  predictionId?: string | null
  sport?: string | null
  league?: string | null
  matchup?: string | null
  eventStartTime?: string | null
  market?: string | null
  selection: string
  userEnteredLine?: number | null
  userEnteredOdds?: number | null
  canonicalLineSnapshot?: number | null
  canonicalOddsSnapshot?: number | null
  modelProbabilitySnapshot?: number | null
  confidenceSnapshot?: number | null
  evidenceGrade?: string | null
  result?: string | null
  status?: string | null
}

type AuthContext = {
  userId: string
  client: SupabaseClient
}

export type UserWagerErrorCode =
  | 'AUTH_REQUIRED'
  | 'SESSION_EXPIRED'
  | 'SESSION_INVALID'
  | 'AUTH_VERIFICATION_FAILED'
  | 'LEDGER_TABLE_UNAVAILABLE'
  | 'RLS_DENIED'
  | 'VALIDATION_FAILED'
  | 'REMOTE_SYNC_FAILED'
  | 'UNKNOWN_REMOTE_ERROR'

const counters = {
  providerCallsMade: 0,
  predictionMutationsMade: 0,
  modelMutationsMade: 0,
  settlementMutationsMade: 0,
}

export const userWagerSessionCookieName = 'pick_analyzer_user_access'

function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) throw new Error('Remote wager persistence is unavailable because Supabase public configuration is missing.')
  return { url, anonKey }
}

function bearer(request: Request) {
  const header = request.headers.get('authorization') ?? ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1] ?? null
}

function cookieToken(request: Request) {
  const cookie = request.headers.get('cookie') ?? ''
  const found = cookie.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${userWagerSessionCookieName}=`))
  if (!found) return null
  const value = found.slice(userWagerSessionCookieName.length + 1)
  return value ? decodeURIComponent(value) : null
}

export function userWagerBearerToken(request: Request) {
  return bearer(request)
}

function authToken(request: Request) {
  return bearer(request) ?? cookieToken(request)
}

function userWagerError(code: UserWagerErrorCode, message: string, status = 500) {
  return Object.assign(new Error(message), { status, code })
}

export function userWagerErrorCode<T extends string = UserWagerErrorCode>(error: unknown, fallback: T | UserWagerErrorCode = 'UNKNOWN_REMOTE_ERROR') {
  return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
    ? error.code as UserWagerErrorCode
    : fallback
}

function dbError(error: unknown, operation: string) {
  const record = error && typeof error === 'object' ? error as Record<string, unknown> : {}
  const code = typeof record.code === 'string' ? record.code : ''
  const message = typeof record.message === 'string' ? record.message.toLowerCase() : ''
  if (code === '42P01' || message.includes('relation') || message.includes('does not exist')) {
    console.warn('[user-wager-ledger]', { operation, classification: 'LEDGER_TABLE_UNAVAILABLE' })
    return userWagerError('LEDGER_TABLE_UNAVAILABLE', 'Personal wager ledger tables are unavailable. The Release 13 database migration may not be applied in production.', 503)
  }
  if (code === '42501' || message.includes('permission denied') || message.includes('row-level security')) {
    console.warn('[user-wager-ledger]', { operation, classification: 'RLS_DENIED' })
    return userWagerError('RLS_DENIED', 'Personal wager ledger access was denied by ownership policy.', 403)
  }
  console.warn('[user-wager-ledger]', { operation, classification: 'REMOTE_SYNC_FAILED' })
  return userWagerError('REMOTE_SYNC_FAILED', 'Remote personal wager ledger operation failed safely. Local wager data should be preserved.', 502)
}

export async function authenticateUserWagerRequest(request: Request): Promise<AuthContext> {
  const token = authToken(request)
  if (!token) throw userWagerError('AUTH_REQUIRED', 'Authentication required for remote wager persistence.', 401)
  const { url, anonKey } = supabaseEnv()
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data, error } = await client.auth.getUser(token)
  if (error) throw userWagerError('SESSION_INVALID', 'Session verification failed.', 401)
  if (!data.user) throw userWagerError('SESSION_EXPIRED', 'Invalid or expired session.', 401)
  return { userId: data.user.id, client }
}

function text(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function nullableText(value: unknown) {
  const next = text(value)
  return next || null
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const next = Number(value)
  return Number.isFinite(next) ? next : null
}

function boundedMoney(value: unknown, field: string, min = 0) {
  const next = Number(value)
  if (!Number.isFinite(next) || next < min) throw userWagerError('VALIDATION_FAILED', `Invalid ${field}.`, 400)
  return Math.round(next * 100) / 100
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T, field: string) {
  const next = text(value, fallback).toUpperCase() as T
  if (!allowed.includes(next)) throw userWagerError('VALIDATION_FAILED', `Invalid ${field}.`, 400)
  return next
}

function parseDate(value: unknown) {
  const raw = nullableText(value)
  if (!raw) return null
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) throw userWagerError('VALIDATION_FAILED', 'Invalid date.', 400)
  return date.toISOString()
}

function statusValue(value: unknown) {
  return enumValue(value, ['DRAFT', 'PLACED', 'WON', 'LOST', 'PUSH', 'VOID', 'ARCHIVED'] as const, 'DRAFT', 'status')
}

function betTypeValue(value: unknown) {
  return enumValue(value, ['SINGLE', 'PARLAY'] as const, 'SINGLE', 'betType')
}

function sourceCategoryValue(value: unknown) {
  const mapped = text(value, 'USER_ONLY').toUpperCase() === 'RESEARCH_ONLY' ? 'RESEARCH_PICK' : value
  return enumValue(mapped, ['OFFICIAL_PICK', 'VALUE_CANDIDATE', 'RESEARCH_PICK', 'USER_ONLY', 'MIXED'] as const, 'USER_ONLY', 'sourceCategory')
}

function bodyRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function rows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => item !== null && typeof item === 'object' && !Array.isArray(item)) : []
}

function normalizeLegs(input: unknown): UserWagerLegInput[] {
  const legs = rows(input)
  if (!legs.length) throw userWagerError('VALIDATION_FAILED', 'At least one wager leg is required.', 400)
  return legs.slice(0, 12).map((leg) => {
    const selection = text(leg.selection)
    if (!selection) throw userWagerError('VALIDATION_FAILED', 'Each wager leg requires a selection.', 400)
    return {
      eventId: nullableText(leg.eventId),
      predictionId: nullableText(leg.predictionId),
      sport: nullableText(leg.sport),
      league: nullableText(leg.league),
      matchup: nullableText(leg.matchup),
      eventStartTime: parseDate(leg.eventStartTime),
      market: nullableText(leg.market),
      selection,
      userEnteredLine: numberOrNull(leg.userEnteredLine),
      userEnteredOdds: numberOrNull(leg.userEnteredOdds),
      canonicalLineSnapshot: numberOrNull(leg.canonicalLineSnapshot),
      canonicalOddsSnapshot: numberOrNull(leg.canonicalOddsSnapshot),
      modelProbabilitySnapshot: numberOrNull(leg.modelProbabilitySnapshot),
      confidenceSnapshot: numberOrNull(leg.confidenceSnapshot),
      evidenceGrade: nullableText(leg.evidenceGrade),
      result: nullableText(leg.result),
      status: enumValue(leg.status, ['PENDING', 'WON', 'LOST', 'PUSH', 'VOID', 'BLOCKED'] as const, 'PENDING', 'leg.status'),
    }
  })
}

function serializeWager(row: Record<string, unknown>, legs: Record<string, unknown>[] = []) {
  return {
    id: row.id,
    userId: row.user_id,
    clientCreatedId: row.client_created_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    placedAt: row.placed_at,
    sportsbook: row.sportsbook,
    betType: row.bet_type,
    stake: row.stake,
    currency: row.currency,
    potentialPayout: row.potential_payout,
    actualPayout: row.actual_payout,
    status: row.status,
    result: row.result,
    notes: row.notes,
    sourceCategory: row.source_category,
    modelSnapshot: row.model_snapshot,
    modelProbability: row.model_probability,
    confidence: row.confidence,
    totalEnteredOdds: row.total_entered_odds,
    isArchived: row.is_archived,
    archivedAt: row.archived_at,
    legs: legs.map((leg) => ({
      id: leg.id,
      wagerId: leg.wager_id,
      eventId: leg.event_id,
      predictionId: leg.prediction_id,
      sport: leg.sport,
      league: leg.league,
      matchup: leg.matchup,
      eventStartTime: leg.event_start_time,
      market: leg.market,
      selection: leg.selection,
      userEnteredLine: leg.user_entered_line,
      userEnteredOdds: leg.user_entered_odds,
      canonicalLineSnapshot: leg.canonical_line_snapshot,
      canonicalOddsSnapshot: leg.canonical_odds_snapshot,
      modelProbabilitySnapshot: leg.model_probability_snapshot,
      confidenceSnapshot: leg.confidence_snapshot,
      evidenceGrade: leg.evidence_grade,
      result: leg.result,
      status: leg.status,
      createdAt: leg.created_at,
    })),
  }
}

export function userWagerCounters(extra: Record<string, unknown> = {}) {
  return { ...counters, ...extra }
}

export async function listUserWagers(auth: AuthContext, params: URLSearchParams) {
  const limit = Math.min(Math.max(Number(params.get('limit') ?? 50), 1), 100)
  const offset = Math.max(Number(params.get('offset') ?? 0), 0)
  let query = auth.client
    .from('user_wagers')
    .select('*, user_wager_legs(*)')
    .eq('user_id', auth.userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  for (const [param, column] of [['status', 'status'], ['sourceCategory', 'source_category']] as const) {
    const value = params.get(param)
    if (value) query = query.eq(column, value.toUpperCase())
  }
  if (params.get('includeArchived') !== 'true') query = query.eq('is_archived', false)
  if (params.get('dateFrom')) query = query.gte('created_at', params.get('dateFrom') as string)
  if (params.get('dateTo')) query = query.lte('created_at', params.get('dateTo') as string)

  const { data, error } = await query
  if (error) throw dbError(error, 'listUserWagers')
  let wagers = (data ?? []).map((row) => serializeWager(row, rows(row.user_wager_legs)))
  const sport = params.get('sport')?.toLowerCase()
  const market = params.get('market')?.toLowerCase()
  if (sport) wagers = wagers.filter((wager) => wager.legs.some((leg) => String(leg.sport ?? '').toLowerCase() === sport))
  if (market) wagers = wagers.filter((wager) => wager.legs.some((leg) => String(leg.market ?? '').toLowerCase() === market))
  return { version: 'release13.user-wagers.v1', wagers, pagination: { limit, offset, returned: wagers.length }, ...userWagerCounters() }
}

export async function createUserWager(auth: AuthContext, input: unknown) {
  const body = bodyRecord(input)
  const clientCreatedId = text(body.clientCreatedId)
  if (!clientCreatedId) throw userWagerError('VALIDATION_FAILED', 'clientCreatedId is required for idempotent creation.', 400)
  const legs = normalizeLegs(body.legs)
  const existing = await auth.client
    .from('user_wagers')
    .select('*, user_wager_legs(*)')
    .eq('user_id', auth.userId)
    .eq('client_created_id', clientCreatedId)
    .maybeSingle()
  if (existing.error) throw dbError(existing.error, 'createUserWager.existing')
  if (existing.data) return { version: 'release13.user-wagers.v1', idempotent: true, wager: serializeWager(existing.data, rows(existing.data.user_wager_legs)), ...userWagerCounters({ wagerMutationsMade: 0 }) }

  const wagerPayload = {
    user_id: auth.userId,
    client_created_id: clientCreatedId,
    placed_at: parseDate(body.placedAt),
    sportsbook: nullableText(body.sportsbook),
    bet_type: betTypeValue(body.betType),
    stake: boundedMoney(body.stake, 'stake'),
    currency: text(body.currency, 'USD').slice(0, 3).toUpperCase(),
    potential_payout: numberOrNull(body.potentialPayout),
    actual_payout: numberOrNull(body.actualPayout),
    status: statusValue(body.status),
    result: nullableText(body.result),
    notes: nullableText(body.notes),
    source_category: sourceCategoryValue(body.sourceCategory),
    model_snapshot: body.modelSnapshot && typeof body.modelSnapshot === 'object' ? body.modelSnapshot : {},
    model_probability: numberOrNull(body.modelProbability),
    confidence: numberOrNull(body.confidence),
    total_entered_odds: numberOrNull(body.totalEnteredOdds),
  }
  const inserted = await auth.client.from('user_wagers').insert(wagerPayload).select('*').single()
  if (inserted.error) throw dbError(inserted.error, 'createUserWager.insertWager')
  const legPayloads = legs.map((leg) => ({
    wager_id: inserted.data.id,
    event_id: leg.eventId,
    prediction_id: leg.predictionId,
    sport: leg.sport,
    league: leg.league,
    matchup: leg.matchup,
    event_start_time: leg.eventStartTime,
    market: leg.market,
    selection: leg.selection,
    user_entered_line: leg.userEnteredLine,
    user_entered_odds: leg.userEnteredOdds,
    canonical_line_snapshot: leg.canonicalLineSnapshot,
    canonical_odds_snapshot: leg.canonicalOddsSnapshot,
    model_probability_snapshot: leg.modelProbabilitySnapshot,
    confidence_snapshot: leg.confidenceSnapshot,
    evidence_grade: leg.evidenceGrade,
    result: leg.result,
    status: leg.status,
  }))
  const insertedLegs = await auth.client.from('user_wager_legs').insert(legPayloads).select('*')
  if (insertedLegs.error) throw dbError(insertedLegs.error, 'createUserWager.insertLegs')
  return { version: 'release13.user-wagers.v1', idempotent: false, wager: serializeWager(inserted.data, insertedLegs.data ?? []), ...userWagerCounters({ wagerMutationsMade: 1 }) }
}

export async function getUserWager(auth: AuthContext, id: string) {
  const { data, error } = await auth.client
    .from('user_wagers')
    .select('*, user_wager_legs(*)')
    .eq('user_id', auth.userId)
    .eq('id', id)
    .maybeSingle()
  if (error) throw dbError(error, 'getUserWager')
  if (!data) throw userWagerError('REMOTE_SYNC_FAILED', 'User wager not found.', 404)
  return { version: 'release13.user-wagers.v1', wager: serializeWager(data, rows(data.user_wager_legs)), ...userWagerCounters() }
}

export async function updateUserWager(auth: AuthContext, id: string, input: unknown) {
  const body = bodyRecord(input)
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if ('sportsbook' in body) patch.sportsbook = nullableText(body.sportsbook)
  if ('placedAt' in body) patch.placed_at = parseDate(body.placedAt)
  if ('stake' in body) patch.stake = boundedMoney(body.stake, 'stake')
  if ('potentialPayout' in body) patch.potential_payout = numberOrNull(body.potentialPayout)
  if ('actualPayout' in body) patch.actual_payout = numberOrNull(body.actualPayout)
  if ('status' in body) patch.status = statusValue(body.status)
  if ('result' in body) patch.result = nullableText(body.result)
  if ('notes' in body) patch.notes = nullableText(body.notes)
  if ('isArchived' in body) {
    patch.is_archived = Boolean(body.isArchived)
    patch.archived_at = body.isArchived ? new Date().toISOString() : null
  }
  const { data, error } = await auth.client.from('user_wagers').update(patch).eq('user_id', auth.userId).eq('id', id).select('*, user_wager_legs(*)').maybeSingle()
  if (error) throw dbError(error, 'updateUserWager')
  if (!data) throw userWagerError('REMOTE_SYNC_FAILED', 'User wager not found.', 404)
  return { version: 'release13.user-wagers.v1', wager: serializeWager(data, rows(data.user_wager_legs)), ...userWagerCounters({ wagerMutationsMade: 1 }) }
}

export async function archiveUserWager(auth: AuthContext, id: string) {
  return updateUserWager(auth, id, { status: 'ARCHIVED', isArchived: true })
}

export async function summarizeUserWagers(auth: AuthContext, params: URLSearchParams) {
  const listed = await listUserWagers(auth, new URLSearchParams({ ...Object.fromEntries(params), limit: '100' }))
  const wagers = listed.wagers
  const settled = wagers.filter((wager) => ['WON', 'LOST', 'PUSH', 'VOID'].includes(String(wager.status)))
  const stake = settled.reduce((sum, wager) => sum + Number(wager.stake ?? 0), 0)
  const returned = settled.reduce((sum, wager) => sum + Number(wager.actualPayout ?? 0), 0)
  const wins = settled.filter((wager) => wager.status === 'WON').length
  const losses = settled.filter((wager) => wager.status === 'LOST').length
  const pushes = settled.filter((wager) => wager.status === 'PUSH').length
  const voids = settled.filter((wager) => wager.status === 'VOID').length
  const by = (field: 'sport' | 'market') => {
    const output: Record<string, { wagers: number; stake: number; returned: number; net: number }> = {}
    for (const wager of wagers) {
      const keys = new Set(wager.legs.map((leg) => String(leg[field] ?? 'UNKNOWN')))
      for (const key of keys) {
        output[key] ??= { wagers: 0, stake: 0, returned: 0, net: 0 }
        output[key].wagers += 1
        output[key].stake += Number(wager.stake ?? 0)
        output[key].returned += Number(wager.actualPayout ?? 0)
        output[key].net = output[key].returned - output[key].stake
      }
    }
    return output
  }
  const bySourceCategory: Record<string, number> = {}
  const byBetType: Record<string, number> = {}
  for (const wager of wagers) {
    bySourceCategory[String(wager.sourceCategory)] = (bySourceCategory[String(wager.sourceCategory)] ?? 0) + 1
    byBetType[String(wager.betType)] = (byBetType[String(wager.betType)] ?? 0) + 1
  }
  return {
    version: 'release13.user-wagers.summary.v1',
    sampleSize: wagers.length,
    settledSampleSize: settled.length,
    wins,
    losses,
    pushes,
    voids,
    totalStake: stake,
    totalReturned: returned,
    net: returned - stake,
    roi: stake > 0 ? ((returned - stake) / stake) * 100 : null,
    averageOdds: null,
    byBetType,
    bySourceCategory,
    bySport: by('sport'),
    byMarket: by('market'),
    separation: 'Personal wagering metrics are not model accuracy, Brier, calibration, Official Pick performance, or learning metrics.',
    ...userWagerCounters(),
  }
}

export async function exportUserWagers(auth: AuthContext, params: URLSearchParams) {
  const listed = await listUserWagers(auth, new URLSearchParams({ ...Object.fromEntries(params), limit: '100' }))
  if ((params.get('format') ?? 'json').toLowerCase() !== 'csv') return { body: JSON.stringify(listed, null, 2), contentType: 'application/json; charset=utf-8' }
  const headers = ['id', 'createdAt', 'sportsbook', 'betType', 'status', 'stake', 'potentialPayout', 'actualPayout', 'sourceCategory', 'legs', 'notes']
  const lines = [headers.join(',')]
  for (const wager of listed.wagers) {
    const values = [
      wager.id,
      wager.createdAt,
      wager.sportsbook,
      wager.betType,
      wager.status,
      wager.stake,
      wager.potentialPayout,
      wager.actualPayout,
      wager.sourceCategory,
      wager.legs.map((leg) => `${leg.selection} ${leg.market ?? ''}`).join('; '),
      wager.notes,
    ].map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`)
    lines.push(values.join(','))
  }
  return { body: lines.join('\n'), contentType: 'text/csv; charset=utf-8' }
}
