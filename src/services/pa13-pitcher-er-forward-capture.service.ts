import 'server-only'

import { createHash, randomUUID } from 'node:crypto'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { puertoRicoUtcRange } from '@/services/active-event.service'
import { normalizeOddsAuthorityTeam } from '@/services/odds-primary-authority.service'

const PROVIDER = 'the-odds-api'
const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const MARKET = 'pitcher_earned_runs'
const JOB_TYPE = 'pa13_pitcher_er_forward_capture_v1'
const SOURCE = 'PA13_PITCHER_ER_FORWARD_CAPTURE_V1'
const CREDIT_RESERVE = 2000
const MAX_CALLS_PER_DAY = 16
const PAGE_LIMIT = 5000

const MLB_TEAM_BY_ID: Record<number, string> = {
  108: 'LAA', 109: 'ARI', 110: 'BAL', 111: 'BOS', 112: 'CHC', 113: 'CIN', 114: 'CLE', 115: 'COL', 116: 'DET', 117: 'HOU',
  118: 'KC', 119: 'LAD', 120: 'WSH', 121: 'NYM', 133: 'ATH', 134: 'PIT', 135: 'SD', 136: 'SEA', 137: 'SF', 138: 'STL',
  139: 'TB', 140: 'TEX', 141: 'TOR', 142: 'MIN', 143: 'PHI', 144: 'ATL', 145: 'CHW', 146: 'MIA', 147: 'NYY', 158: 'MIL',
}

type LifecycleEvent = {
  id: string
  start_time: string
  home_team: string | null
  away_team: string | null
}

type CoreOddsRow = {
  event_id: string
  snapshot_time: string
  metadata: Record<string, unknown> | null
}

type OfficialGame = {
  gamePk: number
  startTime: string
  homeTeam: string
  awayTeam: string
  homePitcher: { id: number; name: string } | null
  awayPitcher: { id: number; name: string } | null
}

type ProviderOutcome = {
  name?: string
  description?: string
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

type CapturedRow = {
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
  canonicalGamePk: number
  httpStatus: number | null
  ok: boolean
  rowsAccepted: number
  rowsRejected: number
  requestsLast: number | null
  requestsRemaining: number | null
  error: string | null
}

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

function validIso(value: unknown) {
  const parsed = new Date(String(value ?? ''))
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null
}

function headerNumber(headers: Headers, name: string) {
  const raw = headers.get(name)
  if (!raw) return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

function sameStart(left: string, right: string) {
  const a = Date.parse(left)
  const b = Date.parse(right)
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 5 * 60_000
}

function normalizePerson(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, '')
    .replace(/[^a-z0-9]+/g, '')
}

function dateInPuertoRico(date: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Puerto_Rico',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day}`
}

function hourInPuertoRico(date: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Puerto_Rico',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  )
  return { hour: Number(parts.hour), minute: Number(parts.minute) }
}

async function officialSlate(targetDate: string): Promise<OfficialGame[]> {
  const response = await fetch(
    `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${targetDate}&hydrate=probablePitcher`,
    { cache: 'no-store', signal: AbortSignal.timeout(15_000) },
  )
  if (!response.ok) throw new Error(`PA13_MLB_SCHEDULE_HTTP_${response.status}`)
  const payload = await response.json() as any
  const games = (payload?.dates ?? []).flatMap((entry: any) => Array.isArray(entry?.games) ? entry.games : [])
  const result: OfficialGame[] = []

  for (const game of games) {
    const gamePk = Number(game?.gamePk)
    const gameType = String(game?.gameType ?? '')
    const detailed = String(game?.status?.detailedState ?? '').toLowerCase()
    if (!Number.isSafeInteger(gamePk) || gamePk <= 0 || (gameType && gameType !== 'R')) continue
    if (detailed.includes('postpon') || detailed.includes('cancel')) continue

    const startTime = validIso(game?.gameDate)
    const homeTeam = MLB_TEAM_BY_ID[Number(game?.teams?.home?.team?.id)]
    const awayTeam = MLB_TEAM_BY_ID[Number(game?.teams?.away?.team?.id)]
    if (!startTime || !homeTeam || !awayTeam) continue

    const hp = game?.teams?.home?.probablePitcher
    const ap = game?.teams?.away?.probablePitcher
    const homePitcherId = Number(hp?.id)
    const awayPitcherId = Number(ap?.id)

    result.push({
      gamePk,
      startTime,
      homeTeam,
      awayTeam,
      homePitcher: Number.isSafeInteger(homePitcherId) && homePitcherId > 0 && typeof hp?.fullName === 'string'
        ? { id: homePitcherId, name: hp.fullName }
        : null,
      awayPitcher: Number.isSafeInteger(awayPitcherId) && awayPitcherId > 0 && typeof ap?.fullName === 'string'
        ? { id: awayPitcherId, name: ap.fullName }
        : null,
    })
  }

  return result.sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime) || a.gamePk - b.gamePk)
}

async function loadLifecycleEvents(targetDate: string, now: Date) {
  const range = puertoRicoUtcRange(targetDate)
  const { data, error } = await supabaseAdmin
    .from('sport_events')
    .select('id,start_time,home_team,away_team')
    .eq('sport_key', SPORT_KEY)
    .eq('league_key', LEAGUE_KEY)
    .gte('start_time', range.utcStart)
    .lt('start_time', range.utcEndExclusive)
    .gt('start_time', now.toISOString())
    .order('start_time', { ascending: true })
    .limit(50)
  if (error) throw new Error(`PA13_EVENT_SCOPE_READ_FAILED:${error.message}`)
  return (data ?? []) as LifecycleEvent[]
}

async function loadProviderEventIds(eventIds: string[]) {
  if (!eventIds.length) return new Map<string, string>()

  const { data, error } = await supabaseAdmin
    .from('sports_odds_snapshots')
    .select('event_id,snapshot_time,metadata')
    .eq('provider', PROVIDER)
    .in('event_id', eventIds)
    .in('market', ['moneyline', 'run_line', 'total'])
    .order('snapshot_time', { ascending: false })
    .limit(PAGE_LIMIT)
  if (error) throw new Error(`PA13_PROVIDER_EVENT_MAP_READ_FAILED:${error.message}`)

  const map = new Map<string, string>()
  for (const row of (data ?? []) as CoreOddsRow[]) {
    if (map.has(row.event_id)) continue
    const providerEventId = String(asRecord(row.metadata).providerEventId ?? '').trim()
    if (providerEventId) map.set(row.event_id, providerEventId)
  }
  return map
}

function matchOfficialGame(event: LifecycleEvent, slate: OfficialGame[]) {
  return slate.find((game) =>
    normalizeOddsAuthorityTeam(String(event.home_team ?? '')) === game.homeTeam &&
    normalizeOddsAuthorityTeam(String(event.away_team ?? '')) === game.awayTeam &&
    sameStart(event.start_time, game.startTime)
  ) ?? null
}

function probablePitcherMap(game: OfficialGame) {
  const pitchers = [game.homePitcher, game.awayPitcher].filter(
    (pitcher): pitcher is { id: number; name: string } => Boolean(pitcher),
  )
  const map = new Map<string, { id: number; name: string }>()
  for (const pitcher of pitchers) {
    const key = normalizePerson(pitcher.name)
    if (!key || map.has(key)) continue
    map.set(key, pitcher)
  }
  return map
}

async function attemptedProviderEventIds(targetDate: string) {
  const range = puertoRicoUtcRange(targetDate)
  const { data, error } = await supabaseAdmin
    .from('sports_sync_jobs')
    .select('metadata')
    .eq('job_type', JOB_TYPE)
    .eq('provider', PROVIDER)
    .eq('sport_key', SPORT_KEY)
    .gte('completed_at', range.utcStart)
    .lt('completed_at', range.utcEndExclusive)
    .order('completed_at', { ascending: false })
    .limit(20)
  if (error) throw new Error(`PA13_CAPTURE_LEDGER_READ_FAILED:${error.message}`)

  const attempted = new Set<string>()
  for (const row of data ?? []) {
    const metadata = asRecord(row.metadata)
    const values = Array.isArray(metadata.attemptedProviderEventIds) ? metadata.attemptedProviderEventIds : []
    for (const value of values) {
      const id = String(value ?? '').trim()
      if (id) attempted.add(id)
    }
  }
  return attempted
}

function validateProviderIdentity(providerEvent: ProviderEvent, event: LifecycleEvent) {
  const commenceTime = validIso(providerEvent.commence_time)
  if (!commenceTime || !sameStart(commenceTime, event.start_time)) return false
  return (
    normalizeOddsAuthorityTeam(String(providerEvent.home_team ?? '')) === normalizeOddsAuthorityTeam(String(event.home_team ?? '')) &&
    normalizeOddsAuthorityTeam(String(providerEvent.away_team ?? '')) === normalizeOddsAuthorityTeam(String(event.away_team ?? ''))
  )
}

function normalizeRows({
  providerEvent,
  providerEventId,
  event,
  game,
  acquiredAt,
}: {
  providerEvent: ProviderEvent
  providerEventId: string
  event: LifecycleEvent
  game: OfficialGame
  acquiredAt: string
}) {
  const rows: CapturedRow[] = []
  let rejected = 0
  const pitchers = probablePitcherMap(game)
  const targetStartMs = Date.parse(event.start_time)

  for (const bookmaker of providerEvent.bookmakers ?? []) {
    const sportsbook = String(bookmaker.key ?? bookmaker.title ?? '').trim().toLowerCase()
    if (!sportsbook) continue

    for (const market of bookmaker.markets ?? []) {
      if (market.key !== MARKET) continue
      const snapshotTime = validIso(market.last_update ?? bookmaker.last_update)
      if (!snapshotTime || Date.parse(snapshotTime) >= targetStartMs) {
        rejected += market.outcomes?.length ?? 1
        continue
      }

      for (const outcome of market.outcomes ?? []) {
        const playerName = String(outcome.description ?? '').trim()
        const pitcher = pitchers.get(normalizePerson(playerName))
        const selection = String(outcome.name ?? '').trim().toLowerCase()
        const line = Number(outcome.point)
        const price = Number(outcome.price)

        if (!pitcher || (selection !== 'over' && selection !== 'under') || !Number.isFinite(line) || !Number.isFinite(price) || price === 0) {
          rejected += 1
          continue
        }

        const rowId = `oddsapi_pa13er_${hash([
          event.id,
          game.gamePk,
          pitcher.id,
          sportsbook,
          selection,
          line,
          snapshotTime,
        ])}`

        rows.push({
          id: rowId,
          sport_key: SPORT_KEY,
          league_key: LEAGUE_KEY,
          season: String(new Date(event.start_time).getUTCFullYear()),
          event_id: event.id,
          provider: PROVIDER,
          sportsbook,
          market: MARKET,
          outcome: selection,
          price,
          line,
          snapshot_time: snapshotTime,
          provider_timestamp: snapshotTime,
          is_opening: false,
          is_closing: false,
          odds_classification: 'pa13_pitcher_er_forward_pregame_research',
          metadata: {
            checkpoint: JOB_TYPE,
            source: SOURCE,
            researchOnly: true,
            shadowOnly: true,
            productionEligible: false,
            officialPicksEligible: false,
            apostarEnabled: false,
            historicalPricingCertified: false,
            roiCertified: false,
            clvCertified: false,
            evCertified: false,
            canonicalGamePk: game.gamePk,
            pitcherMlbamId: pitcher.id,
            pitcherName: pitcher.name,
            providerPlayerName: playerName,
            selection,
            line,
            providerEventId,
            providerMarketKey: MARKET,
            providerHomeTeam: providerEvent.home_team ?? null,
            providerAwayTeam: providerEvent.away_team ?? null,
            targetStart: event.start_time,
            providerTimestamp: snapshotTime,
            acquiredAt,
          },
          updated_at: acquiredAt,
        })
      }
    }
  }

  return { rows, rejected }
}

export async function capturePa13PitcherErForward({
  operatingDate,
  now = new Date(),
  requestId,
}: {
  operatingDate?: string
  now?: Date
  requestId?: string | null
} = {}) {
  const targetDate = operatingDate ?? dateInPuertoRico(now)
  const clock = hourInPuertoRico(now)
  const base = {
    success: true,
    status: 'NOT_DUE',
    contract: 'PA13_PITCHER_ER_FORWARD_CAPTURE/1.0.0',
    targetDate,
    provider: PROVIDER,
    market: MARKET,
    researchOnly: true,
    shadowOnly: true,
    productionEligible: false,
    historicalPricingCertified: false,
    roiCertified: false,
    clvCertified: false,
    evCertified: false,
    officialPicksModified: false,
    apostarActivated: false,
    providerCallsMade: 0,
    providerCreditsConsumed: 0 as number | null,
    rowsAccepted: 0,
    rowsInserted: 0,
    rowsUpdated: 0,
  }

  if (!apiKey()) return { ...base, success: false, status: 'BLOCKED_MISSING_API_KEY' }
  if (targetDate !== dateInPuertoRico(now)) return { ...base, success: false, status: 'BLOCK_NONCURRENT_WRITE_DATE' }

  // The existing scheduler runs at 10:15 and 10:45 Puerto Rico.
  // Capture once in that hour to maximize starter certainty while staying pregame.
  if (clock.hour !== 10) return base

  const [events, slate, attempted] = await Promise.all([
    loadLifecycleEvents(targetDate, now),
    officialSlate(targetDate),
    attemptedProviderEventIds(targetDate),
  ])

  if (!events.length) return { ...base, status: 'NO_PREGAME_EVENTS' }

  const providerIds = await loadProviderEventIds(events.map((event) => event.id))
  const planned = events.flatMap((event) => {
    const providerEventId = providerIds.get(event.id)
    if (!providerEventId || attempted.has(providerEventId)) return []
    const game = matchOfficialGame(event, slate)
    if (!game) return []
    if (!game.homePitcher && !game.awayPitcher) return []
    return [{ event, game, providerEventId }]
  }).slice(0, MAX_CALLS_PER_DAY)

  if (!planned.length) {
    return {
      ...base,
      status: attempted.size ? 'ALREADY_ATTEMPTED_OR_NO_NEW_ELIGIBLE_EVENTS' : 'NO_IDENTITY_COMPLETE_ELIGIBLE_EVENTS',
      attemptedProviderEvents: attempted.size,
    }
  }

  const calls: ProviderCall[] = []
  const rows: CapturedRow[] = []
  let remaining: number | null = null

  for (const item of planned) {
    if (remaining !== null && remaining <= CREDIT_RESERVE) break

    const url = new URL(`https://api.the-odds-api.com/v4/sports/${SPORT_KEY}/events/${encodeURIComponent(item.providerEventId)}/odds`)
    url.searchParams.set('apiKey', apiKey())
    url.searchParams.set('regions', 'us')
    url.searchParams.set('markets', MARKET)
    url.searchParams.set('oddsFormat', 'american')

    let call: ProviderCall
    try {
      const response = await fetch(url.toString(), { cache: 'no-store', signal: AbortSignal.timeout(15_000) })
      const text = await response.text()
      let payload: ProviderEvent | null = null
      try {
        payload = text ? JSON.parse(text) as ProviderEvent : null
      } catch {
        payload = null
      }

      const requestsLast = headerNumber(response.headers, 'x-requests-last')
      remaining = headerNumber(response.headers, 'x-requests-remaining')
      let normalized = { rows: [] as CapturedRow[], rejected: 0 }
      let identityOk = false

      if (response.ok && payload) {
        identityOk = validateProviderIdentity(payload, item.event)
        if (identityOk) {
          normalized = normalizeRows({
            providerEvent: payload,
            providerEventId: item.providerEventId,
            event: item.event,
            game: item.game,
            acquiredAt: nowIso(),
          })
          rows.push(...normalized.rows)
        }
      }

      call = {
        eventId: item.event.id,
        providerEventId: item.providerEventId,
        canonicalGamePk: item.game.gamePk,
        httpStatus: response.status,
        ok: response.ok && identityOk,
        rowsAccepted: normalized.rows.length,
        rowsRejected: normalized.rejected,
        requestsLast,
        requestsRemaining: remaining,
        error: response.ok
          ? identityOk ? null : 'PROVIDER_EVENT_IDENTITY_MISMATCH'
          : `HTTP_${response.status}`,
      }

      if (remaining === null) {
        call.ok = false
        call.error = call.error ?? 'CREDIT_HEADERS_UNAVAILABLE'
      }
    } catch (error) {
      call = {
        eventId: item.event.id,
        providerEventId: item.providerEventId,
        canonicalGamePk: item.game.gamePk,
        httpStatus: null,
        ok: false,
        rowsAccepted: 0,
        rowsRejected: 0,
        requestsLast: null,
        requestsRemaining: remaining,
        error: error instanceof Error ? error.message.slice(0, 180) : 'UNKNOWN_FETCH_ERROR',
      }
    }
    calls.push(call)

    if (call.requestsRemaining === null) break
  }

  const ids = rows.map((row) => row.id)
  let existing = 0
  if (ids.length) {
    for (let index = 0; index < ids.length; index += 100) {
      const chunk = ids.slice(index, index + 100)
      const readback = await supabaseAdmin.from('sports_odds_snapshots').select('id').in('id', chunk)
      if (readback.error) throw new Error(`PA13_EXISTING_ROW_READ_FAILED:${readback.error.message}`)
      existing += readback.data?.length ?? 0
    }

    const write = await supabaseAdmin.from('sports_odds_snapshots').upsert(rows, { onConflict: 'id' })
    if (write.error) throw new Error(`PA13_SNAPSHOT_UPSERT_FAILED:${write.error.message}`)
  }

  const completedAt = nowIso()
  const knownCredits = calls.map((call) => call.requestsLast)
  const credits = knownCredits.length > 0 && knownCredits.every((value): value is number => typeof value === 'number')
    ? knownCredits.reduce((sum, value) => sum + value, 0)
    : null
  const failedCalls = calls.filter((call) => !call.ok).length
  const jobStatus = failedCalls > 0 ? 'partial' : 'completed'

  const job = await supabaseAdmin.from('sports_sync_jobs').insert({
    id: randomUUID(),
    job_type: JOB_TYPE,
    sport_key: SPORT_KEY,
    league_key: LEAGUE_KEY,
    provider: PROVIDER,
    season: String(new Date(`${targetDate}T12:00:00Z`).getUTCFullYear()),
    started_at: now.toISOString(),
    completed_at: completedAt,
    status: jobStatus,
    records_fetched: rows.length + calls.reduce((sum, call) => sum + call.rowsRejected, 0),
    records_inserted: Math.max(0, rows.length - existing),
    records_updated: Math.min(existing, rows.length),
    records_skipped: calls.reduce((sum, call) => sum + call.rowsRejected, 0),
    error_count: failedCalls,
    metadata: {
      checkpoint: JOB_TYPE,
      source: SOURCE,
      requestId: requestId ?? null,
      targetDate,
      market: MARKET,
      researchOnly: true,
      shadowOnly: true,
      productionEligible: false,
      historicalPricingCertified: false,
      roiCertified: false,
      clvCertified: false,
      evCertified: false,
      officialPicksModified: false,
      apostarActivated: false,
      providerCallsMade: calls.length,
      providerCreditsConsumed: credits,
      requestsRemainingAfter: remaining,
      creditReserve: CREDIT_RESERVE,
      attemptedProviderEventIds: calls.map((call) => call.providerEventId),
      calls,
    },
    updated_at: completedAt,
  })
  if (job.error) throw new Error(`PA13_CAPTURE_JOB_WRITE_FAILED:${job.error.message}`)

  return {
    ...base,
    success: calls.length > 0 && failedCalls === 0,
    status: jobStatus === 'completed' ? 'FORWARD_CAPTURE_PERSISTED' : 'FORWARD_CAPTURE_PARTIAL',
    providerCallsMade: calls.length,
    providerCreditsConsumed: credits,
    rowsAccepted: rows.length,
    rowsInserted: Math.max(0, rows.length - existing),
    rowsUpdated: Math.min(existing, rows.length),
    rowsRejected: calls.reduce((sum, call) => sum + call.rowsRejected, 0),
    attemptedProviderEvents: calls.length,
    requestsRemainingAfter: remaining,
    calls,
  }
}
