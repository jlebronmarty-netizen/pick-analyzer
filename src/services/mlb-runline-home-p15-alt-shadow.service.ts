import 'server-only'

import { createHash, randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { puertoRicoUtcRange } from '@/services/active-event.service'

const PROVIDER = 'the-odds-api'
const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const SOURCE = 'RUNLINE_V2_HOME_P15_ALT_SHADOW_CAPTURE'
const JOB_TYPE = 'runline_v2_home_p15_alt_shadow_capture_v1'
const ALT_MARKET = 'alternate_spreads'
const STORED_MARKET = 'run_line_alt'
const CREDIT_RESERVE = 2000
const MAX_ALT_CALLS_PER_INVOCATION = 12
const TARGET_HOME_LINE = 1.5
const STANDARD_HOME_FAVORITE_LINE = -1.5

export const RUNLINE_V2_HOME_P15_ALT_CANDIDATE_ID = 'rl_v2_home_p15_alt_favorite_tsh_q92_v1'

function nowIso() {
  return new Date().toISOString()
}

function apiKey() {
  return process.env.THE_ODDS_API_KEY?.trim() ?? ''
}

function hash(parts: unknown[]) {
  return createHash('sha256')
    .update(parts.map((part) => String(part ?? 'null')).join('|'))
    .digest('hex')
    .slice(0, 28)
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}


async function latestKnownRequestsRemaining() {
  const { data, error } = await supabaseAdmin
    .from('sports_sync_jobs')
    .select('completed_at,metadata')
    .eq('provider', PROVIDER)
    .eq('sport_key', SPORT_KEY)
    .order('completed_at', { ascending: false })
    .limit(100)
  if (error) throw new Error(`RUNLINE_ALT_QUOTA_PREFLIGHT_READ_FAILED:${error.message}`)

  for (const row of data ?? []) {
    const metadata = asRecord(row.metadata)
    const candidate = metadata.requestsRemainingAfter ?? metadata.requestsRemaining
    const remaining = Number(candidate)
    if (Number.isFinite(remaining)) return remaining
  }
  return null
}

function validIso(value: unknown) {
  const parsed = new Date(String(value ?? ''))
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null
}

function headerNumber(headers: Headers, name: string) {
  const value = headers.get(name)
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function sameLine(value: unknown, expected: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && Math.abs(parsed - expected) < 1e-9
}

type EventRow = {
  id: string
  start_time: string
  home_team: string | null
  away_team: string | null
}

type CoreOddsRow = {
  id: string
  event_id: string
  sportsbook: string
  outcome: string
  line: number | string | null
  price: number | string | null
  snapshot_time: string
  metadata: Record<string, unknown> | null
}

type ProviderOutcome = {
  name?: string
  price?: number
  point?: number
}

type ProviderMarket = {
  key?: string
  last_update?: string
  outcomes?: ProviderOutcome[]
}

type ProviderBookmaker = {
  key?: string
  title?: string
  last_update?: string
  markets?: ProviderMarket[]
}

type ProviderEvent = {
  id?: string
  sport_key?: string
  commence_time?: string
  home_team?: string
  away_team?: string
  bookmakers?: ProviderBookmaker[]
}

type AltOddsRow = {
  id: string
  sport_key: string
  league_key: string
  season: string
  event_id: string
  provider: string
  sportsbook: string
  market: string
  outcome: string
  price: number
  line: number
  snapshot_time: string
  provider_timestamp: string
  is_opening: boolean
  is_closing: boolean
  odds_classification: string
  metadata: Record<string, unknown>
  updated_at: string
}

type ProviderCall = {
  eventId: string
  providerEventId: string
  httpStatus: number | null
  ok: boolean
  requestsLast: number | null
  requestsRemaining: number | null
  rowsAccepted: number
  error: string | null
}

function latestCoreRows(rows: CoreOddsRow[]) {
  const latest = new Map<string, CoreOddsRow>()
  for (const row of rows) {
    const key = `${row.event_id}|${row.sportsbook}|${row.outcome}`
    const prior = latest.get(key)
    if (!prior || Date.parse(row.snapshot_time) > Date.parse(prior.snapshot_time)) latest.set(key, row)
  }
  return [...latest.values()]
}

function qualifyHomeFavoriteEvents(events: EventRow[], rows: CoreOddsRow[]) {
  const byEvent = new Map<string, CoreOddsRow[]>()
  for (const row of latestCoreRows(rows)) {
    const bucket = byEvent.get(row.event_id) ?? []
    bucket.push(row)
    byEvent.set(row.event_id, bucket)
  }

  return events.flatMap((event) => {
    const eventRows = byEvent.get(event.id) ?? []
    const byBook = new Map<string, CoreOddsRow[]>()
    for (const row of eventRows) {
      const bucket = byBook.get(row.sportsbook) ?? []
      bucket.push(row)
      byBook.set(row.sportsbook, bucket)
    }

    const paired = [...byBook.entries()].flatMap(([sportsbook, bookRows]) => {
      const home = bookRows.find((row) => row.outcome.toLowerCase() === 'home')
      const away = bookRows.find((row) => row.outcome.toLowerCase() === 'away')
      if (!home || !away) return []
      const homeLine = Number(home.line)
      const awayLine = Number(away.line)
      if (!Number.isFinite(homeLine) || !Number.isFinite(awayLine) || Math.abs(homeLine + awayLine) > 1e-9) return []
      return [{ sportsbook, home, away, homeLine }]
    })

    if (!paired.length) return []
    const counts = new Map<number, number>()
    for (const pair of paired) counts.set(pair.homeLine, (counts.get(pair.homeLine) ?? 0) + 1)
    const modal = [...counts.entries()].sort((a, b) => b[1] - a[1] || Math.abs(a[0]) - Math.abs(b[0]))[0]?.[0]
    if (!sameLine(modal, STANDARD_HOME_FAVORITE_LINE)) return []

    const providerEventId = paired
      .map((pair) => String(asRecord(pair.home.metadata).providerEventId ?? ''))
      .find(Boolean)
    if (!providerEventId) return []

    return [{
      event,
      providerEventId,
      pairedBookCount: paired.length,
      modalHomeLine: modal,
    }]
  })
}

function normalizeAlternateRows({
  canonicalEvent,
  providerEventId,
  providerEvent,
  capturedAt,
  pairedBookCount,
}: {
  canonicalEvent: EventRow
  providerEventId: string
  providerEvent: ProviderEvent
  capturedAt: string
  pairedBookCount: number
}) {
  const rows: AltOddsRow[] = []
  const startMs = Date.parse(canonicalEvent.start_time)
  const providerHome = String(providerEvent.home_team ?? '').trim()
  const providerAway = String(providerEvent.away_team ?? '').trim()

  for (const bookmaker of providerEvent.bookmakers ?? []) {
    const sportsbook = String(bookmaker.key ?? bookmaker.title ?? 'unknown_bookmaker').trim().toLowerCase()
    for (const market of bookmaker.markets ?? []) {
      if (market.key !== ALT_MARKET) continue
      const snapshotTime = validIso(market.last_update ?? bookmaker.last_update)
      if (!snapshotTime || Date.parse(snapshotTime) >= startMs) continue

      const outcomes = market.outcomes ?? []
      const home = outcomes.find((outcome) =>
        String(outcome.name ?? '').trim() === providerHome && sameLine(outcome.point, TARGET_HOME_LINE)
      )
      const away = outcomes.find((outcome) =>
        String(outcome.name ?? '').trim() === providerAway && sameLine(outcome.point, -TARGET_HOME_LINE)
      )

      const candidates = [
        home ? { key: 'home', outcome: home, paired: Boolean(away) } : null,
        away ? { key: 'away', outcome: away, paired: Boolean(home) } : null,
      ].filter(Boolean) as Array<{ key: 'home' | 'away'; outcome: ProviderOutcome; paired: boolean }>

      for (const candidate of candidates) {
        const price = Number(candidate.outcome.price)
        const line = Number(candidate.outcome.point)
        if (!Number.isFinite(price) || !Number.isFinite(line) || price === 0) continue
        const id = `oddsapi_rlv2alt_${hash([
          canonicalEvent.id,
          sportsbook,
          candidate.key,
          line,
          snapshotTime.slice(0, 16),
        ])}`
        rows.push({
          id,
          sport_key: SPORT_KEY,
          league_key: LEAGUE_KEY,
          season: '2026',
          event_id: canonicalEvent.id,
          provider: PROVIDER,
          sportsbook,
          market: STORED_MARKET,
          outcome: candidate.key,
          price,
          line,
          snapshot_time: snapshotTime,
          provider_timestamp: snapshotTime,
          is_opening: false,
          is_closing: false,
          odds_classification: 'runline_v2_home_p15_alt_shadow_pregame',
          metadata: {
            checkpoint: JOB_TYPE,
            source: SOURCE,
            researchOnly: true,
            production_eligible: false,
            official_picks_eligible: false,
            apostar_enabled: false,
            candidateId: RUNLINE_V2_HOME_P15_ALT_CANDIDATE_ID,
            providerEventId,
            providerMarketKey: ALT_MARKET,
            providerHomeTeam: providerHome,
            providerAwayTeam: providerAway,
            pairedCounterpartAvailable: candidate.paired,
            standardMarketCondition: 'HOME -1.5 modal paired pregame',
            standardPairedBookCount: pairedBookCount,
            capturedAt,
          },
          updated_at: capturedAt,
        })
      }
    }
  }
  return rows
}

export async function captureRunlineV2HomeP15AlternateShadow({
  operatingDate,
  requestId,
}: {
  operatingDate: string
  requestId?: string | null
}) {
  const generatedAt = nowIso()
  const base = {
    success: true,
    researchOnly: true,
    productionEligible: false,
    officialPicksModified: false,
    apostarActivated: false,
    candidateId: RUNLINE_V2_HOME_P15_ALT_CANDIDATE_ID,
    operatingDate,
    providerCallsMade: 0,
    providerCreditsConsumed: 0,
    eligibleHomeFavoriteEvents: 0,
    eventsAlreadyCaptured: 0,
    eventsFetched: 0,
    rowsAccepted: 0,
    rowsInserted: 0,
    rowsUpdated: 0,
  }

  if (!apiKey()) return { ...base, success: false, status: 'BLOCKED_MISSING_API_KEY' }

  const knownRemainingBefore = await latestKnownRequestsRemaining()
  if (knownRemainingBefore !== null && knownRemainingBefore <= CREDIT_RESERVE) {
    return {
      ...base,
      status: 'BLOCKED_CREDIT_RESERVE',
      requestsRemainingBefore: knownRemainingBefore,
      creditReserve: CREDIT_RESERVE,
    }
  }

  const range = puertoRicoUtcRange(operatingDate)
  const eventsResult = await supabaseAdmin
    .from('sport_events')
    .select('id,start_time,home_team,away_team')
    .eq('sport_key', SPORT_KEY)
    .eq('league_key', LEAGUE_KEY)
    .gte('start_time', range.utcStart)
    .lt('start_time', range.utcEndExclusive)
    .gt('start_time', generatedAt)
    .order('start_time', { ascending: true })
    .limit(50)
  if (eventsResult.error) throw new Error(`runline V2 alternate event scope read failed: ${eventsResult.error.message}`)
  const events = (eventsResult.data ?? []) as EventRow[]
  if (!events.length) return { ...base, status: 'NO_PREGAME_EVENTS' }

  const eventIds = events.map((event) => event.id)
  const coreResult = await supabaseAdmin
    .from('sports_odds_snapshots')
    .select('id,event_id,sportsbook,outcome,line,price,snapshot_time,metadata')
    .eq('provider', PROVIDER)
    .eq('market', 'run_line')
    .in('event_id', eventIds)
    .order('snapshot_time', { ascending: false })
    .limit(5000)
  if (coreResult.error) throw new Error(`runline V2 alternate core odds read failed: ${coreResult.error.message}`)

  const qualifying = qualifyHomeFavoriteEvents(events, (coreResult.data ?? []) as CoreOddsRow[])
  if (!qualifying.length) return { ...base, status: 'NO_HOME_MINUS_1P5_EVENTS' }

  const existingResult = await supabaseAdmin
    .from('sports_odds_snapshots')
    .select('event_id')
    .eq('provider', PROVIDER)
    .eq('market', STORED_MARKET)
    .eq('outcome', 'home')
    .eq('line', TARGET_HOME_LINE)
    .in('event_id', qualifying.map((item) => item.event.id))
    .limit(500)
  if (existingResult.error) throw new Error(`runline V2 alternate existing capture read failed: ${existingResult.error.message}`)
  const already = new Set((existingResult.data ?? []).map((row) => String(row.event_id)))
  const pending = qualifying.filter((item) => !already.has(item.event.id)).slice(0, MAX_ALT_CALLS_PER_INVOCATION)

  if (!pending.length) {
    return {
      ...base,
      status: 'ALREADY_CAPTURED',
      eligibleHomeFavoriteEvents: qualifying.length,
      eventsAlreadyCaptured: already.size,
    }
  }

  const calls: ProviderCall[] = []
  const rows: AltOddsRow[] = []
  let remaining: number | null = knownRemainingBefore

  for (const item of pending) {
    if (remaining !== null && remaining <= CREDIT_RESERVE) break
    const path = `/v4/sports/${SPORT_KEY}/events/${encodeURIComponent(item.providerEventId)}/odds`
    const url = new URL(`https://api.the-odds-api.com${path}`)
    url.searchParams.set('apiKey', apiKey())
    url.searchParams.set('regions', 'us')
    url.searchParams.set('markets', ALT_MARKET)
    url.searchParams.set('oddsFormat', 'american')

    let call: ProviderCall
    try {
      const response = await fetch(url.toString(), { cache: 'no-store', signal: AbortSignal.timeout(15000) })
      const payload = response.ok ? await response.json() as ProviderEvent : null
      const requestsLast = headerNumber(response.headers, 'x-requests-last')
      remaining = headerNumber(response.headers, 'x-requests-remaining')
      const normalized = payload
        ? normalizeAlternateRows({
            canonicalEvent: item.event,
            providerEventId: item.providerEventId,
            providerEvent: payload,
            capturedAt: nowIso(),
            pairedBookCount: item.pairedBookCount,
          })
        : []
      rows.push(...normalized)
      call = {
        eventId: item.event.id,
        providerEventId: item.providerEventId,
        httpStatus: response.status,
        ok: response.ok,
        requestsLast,
        requestsRemaining: remaining,
        rowsAccepted: normalized.length,
        error: response.ok ? null : `HTTP_${response.status}`,
      }
    } catch (error) {
      call = {
        eventId: item.event.id,
        providerEventId: item.providerEventId,
        httpStatus: null,
        ok: false,
        requestsLast: null,
        requestsRemaining: remaining,
        rowsAccepted: 0,
        error: error instanceof Error ? error.message.slice(0, 160) : 'UNKNOWN_FETCH_ERROR',
      }
    }
    calls.push(call)
  }

  const ids = rows.map((row) => row.id)
  let existingIds = 0
  if (ids.length) {
    const readback = await supabaseAdmin.from('sports_odds_snapshots').select('id').in('id', ids)
    if (readback.error) throw new Error(`runline V2 alternate existing id read failed: ${readback.error.message}`)
    existingIds = readback.data?.length ?? 0
    const write = await supabaseAdmin.from('sports_odds_snapshots').upsert(rows, { onConflict: 'id' })
    if (write.error) throw new Error(`runline V2 alternate snapshot upsert failed: ${write.error.message}`)
  }

  const credits = calls.reduce((sum, call) => sum + (call.requestsLast ?? 0), 0)
  const completedAt = nowIso()
  const failedCalls = calls.filter((call) => !call.ok).length
  const capturedHomeEvents = new Set(rows.filter((row) => row.outcome === 'home' && sameLine(row.line, TARGET_HOME_LINE)).map((row) => row.event_id)).size
  const status = failedCalls > 0 || capturedHomeEvents < pending.length ? 'partial' : 'completed'

  const job = await supabaseAdmin.from('sports_sync_jobs').insert({
    id: randomUUID(),
    job_type: JOB_TYPE,
    sport_key: SPORT_KEY,
    league_key: LEAGUE_KEY,
    provider: PROVIDER,
    season: '2026',
    started_at: generatedAt,
    completed_at: completedAt,
    status,
    records_fetched: rows.length,
    records_inserted: Math.max(0, rows.length - existingIds),
    records_updated: Math.min(existingIds, rows.length),
    records_skipped: 0,
    error_count: failedCalls,
    metadata: {
      checkpoint: JOB_TYPE,
      source: SOURCE,
      requestId: requestId ?? null,
      candidateId: RUNLINE_V2_HOME_P15_ALT_CANDIDATE_ID,
      researchOnly: true,
      productionEligible: false,
      officialPicksModified: false,
      apostarActivated: false,
      providerCallsMade: calls.length,
      providerCreditsConsumed: credits,
      requestsRemainingBefore: knownRemainingBefore,
      requestsRemainingAfter: remaining,
      marketRequested: ALT_MARKET,
      regionRequested: 'us',
      standardMarketCondition: 'HOME -1.5 modal paired pregame',
      eligibleHomeFavoriteEvents: qualifying.length,
      eventsAlreadyCaptured: already.size,
      pendingEventCount: pending.length,
      capturedHomeEvents,
      calls,
    },
    updated_at: completedAt,
  })
  if (job.error) throw new Error(`runline V2 alternate sync job insert failed: ${job.error.message}`)

  return {
    ...base,
    success: failedCalls === 0,
    status: status === 'completed' ? 'ALT_HOME_P15_CAPTURED' : 'ALT_HOME_P15_CAPTURE_PARTIAL',
    providerCallsMade: calls.length,
    providerCreditsConsumed: credits,
    eligibleHomeFavoriteEvents: qualifying.length,
    eventsAlreadyCaptured: already.size,
    eventsFetched: calls.length,
    rowsAccepted: rows.length,
    rowsInserted: Math.max(0, rows.length - existingIds),
    rowsUpdated: Math.min(existingIds, rows.length),
    capturedHomeEvents,
    requestsRemainingBefore: knownRemainingBefore,
    requestsRemainingAfter: remaining,
    calls,
  }
}
