import 'server-only'

import { createHash, randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { puertoRicoUtcRange } from '@/services/active-event.service'
import { normalizeOddsAuthorityTeam } from '@/services/odds-primary-authority.service'

const PROVIDER = 'the-odds-api'
const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const JOB_TYPE = 'mlb_approved_prop_market_capture_v1'
const SOURCE = 'MLB_APPROVED_PROP_MARKET_CAPTURE_V1'
const CREDIT_RESERVE = 2000
const PAGE_SIZE = 100
const WRITE_BATCH_SIZE = 500

const MAIN_MARKETS = [
  'pitcher_outs',
  'pitcher_hits_allowed',
  'pitcher_walks',
  'pitcher_record_a_win',
  'pitcher_earned_runs',
  'batter_hits',
  'batter_total_bases',
  'batter_home_runs',
  'batter_strikeouts',
  'batter_walks',
  'batter_singles',
  'batter_doubles',
  'batter_triples',
] as const

const ALT_MARKETS = [
  'pitcher_outs_alternate',
  'pitcher_hits_allowed_alternate',
  'pitcher_walks_alternate',
  'pitcher_earned_runs_alternate',
  'batter_hits_alternate',
  'batter_total_bases_alternate',
  'batter_home_runs_alternate',
  'batter_strikeouts_alternate',
  'batter_walks_alternate',
  'batter_singles_alternate',
  'batter_doubles_alternate',
  'batter_triples_alternate',
] as const

const REQUEST_MARKETS = [...MAIN_MARKETS, ...ALT_MARKETS]

const MLB_TEAM_BY_ID: Record<number, string> = {
  108: 'LAA', 109: 'AZ', 110: 'BAL', 111: 'BOS', 112: 'CHC', 113: 'CIN', 114: 'CLE', 115: 'COL',
  116: 'DET', 117: 'HOU', 118: 'KC', 119: 'LAD', 120: 'WSH', 121: 'NYM', 133: 'ATH', 134: 'PIT',
  135: 'SD', 136: 'SEA', 137: 'SF', 138: 'STL', 139: 'TB', 140: 'TEX', 141: 'TOR', 142: 'MIN',
  143: 'PHI', 144: 'ATL', 145: 'CHW', 146: 'MIA', 147: 'NYY', 158: 'MIL',
}

type JsonMap = Record<string, unknown>
type LifecycleEvent = {
  id: string
  start_time: string
  home_team: string | null
  away_team: string | null
}
type OfficialGame = {
  gamePk: number
  startTime: string
  homeTeam: string
  awayTeam: string
  homePitcher: { id: number; name: string } | null
  awayPitcher: { id: number; name: string } | null
}
type ProviderOutcome = { name?: string; description?: string; price?: number; point?: number }
type ProviderMarket = { key?: string; last_update?: string; outcomes?: ProviderOutcome[] }
type ProviderBookmaker = { key?: string; title?: string; last_update?: string; markets?: ProviderMarket[] }
type ProviderEvent = {
  id?: string
  commence_time?: string
  home_team?: string
  away_team?: string
  bookmakers?: ProviderBookmaker[]
}
type CaptureCall = {
  eventId: string
  gamePk: number | null
  providerEventId: string
  httpStatus: number | null
  ok: boolean
  rowsAccepted: number
  requestsLast: number | null
  requestsRemaining: number | null
  error: string | null
}

function apiKey() {
  return process.env.THE_ODDS_API_KEY?.trim() ?? ''
}

function asRecord(value: unknown): JsonMap {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonMap : {}
}

function hash(parts: unknown[]) {
  return createHash('sha256').update(parts.map((part) => String(part ?? 'null')).join('|')).digest('hex').slice(0, 28)
}

function headerNumber(headers: Headers, name: string) {
  const raw = headers.get(name)
  const value = raw === null ? NaN : Number(raw)
  return Number.isFinite(value) ? value : null
}

function validIso(value: unknown) {
  const date = new Date(String(value ?? ''))
  return Number.isFinite(date.getTime()) ? date.toISOString() : null
}

function sameStart(a: string, b: string) {
  const left = Date.parse(a)
  const right = Date.parse(b)
  return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= 5 * 60_000
}

function normalizePerson(value: string) {
  const trimmed = value.trim()
  const ordered = trimmed.includes(',')
    ? trimmed.split(',').slice(1).join(',').trim() + ' ' + trimmed.split(',')[0].trim()
    : trimmed
  return ordered
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, '')
    .replace(/[^a-z0-9]+/g, '')
}

function baseMarket(providerMarket: string) {
  return providerMarket.endsWith('_alternate')
    ? providerMarket.slice(0, -'_alternate'.length)
    : providerMarket
}

function puertoRicoClock(now: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Puerto_Rico',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]),
  )
  return {
    date: String(parts.year) + '-' + String(parts.month) + '-' + String(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  }
}

async function officialSlate(targetDate: string): Promise<OfficialGame[]> {
  const response = await fetch(
    'https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=' + encodeURIComponent(targetDate) + '&hydrate=probablePitcher',
    { cache: 'no-store', signal: AbortSignal.timeout(15_000) },
  )
  if (!response.ok) throw new Error('MLB_APPROVED_PROP_SCHEDULE_HTTP_' + response.status)
  const payload = await response.json() as any
  const games = (payload?.dates ?? []).flatMap((entry: any) => Array.isArray(entry?.games) ? entry.games : [])
  const out: OfficialGame[] = []
  for (const game of games) {
    const gamePk = Number(game?.gamePk)
    const startTime = validIso(game?.gameDate)
    const homeTeam = MLB_TEAM_BY_ID[Number(game?.teams?.home?.team?.id)]
    const awayTeam = MLB_TEAM_BY_ID[Number(game?.teams?.away?.team?.id)]
    const detailed = String(game?.status?.detailedState ?? '').toLowerCase()
    if (!Number.isSafeInteger(gamePk) || !startTime || !homeTeam || !awayTeam) continue
    if (String(game?.gameType ?? '') !== 'R' || detailed.includes('postpon') || detailed.includes('cancel')) continue
    const hp = game?.teams?.home?.probablePitcher
    const ap = game?.teams?.away?.probablePitcher
    const hpId = Number(hp?.id)
    const apId = Number(ap?.id)
    out.push({
      gamePk,
      startTime,
      homeTeam,
      awayTeam,
      homePitcher: Number.isSafeInteger(hpId) && hpId > 0 && typeof hp?.fullName === 'string'
        ? { id: hpId, name: hp.fullName }
        : null,
      awayPitcher: Number.isSafeInteger(apId) && apId > 0 && typeof ap?.fullName === 'string'
        ? { id: apId, name: ap.fullName }
        : null,
    })
  }
  return out
}

function matchOfficial(event: LifecycleEvent, slate: OfficialGame[]) {
  return slate.find((game) =>
    normalizeOddsAuthorityTeam(String(event.home_team ?? '')) === game.homeTeam &&
    normalizeOddsAuthorityTeam(String(event.away_team ?? '')) === game.awayTeam &&
    sameStart(event.start_time, game.startTime)
  ) ?? null
}

async function loadEvents(targetDate: string, now: Date) {
  const range = puertoRicoUtcRange(targetDate)
  const result = await supabaseAdmin
    .from('sport_events')
    .select('id,start_time,home_team,away_team')
    .eq('sport_key', SPORT_KEY)
    .eq('league_key', LEAGUE_KEY)
    .gte('start_time', range.utcStart)
    .lt('start_time', range.utcEndExclusive)
    .gt('start_time', now.toISOString())
    .order('start_time', { ascending: true })
    .limit(50)
  if (result.error) throw new Error('MLB_APPROVED_PROP_EVENT_READ_FAILED:' + result.error.message)
  return (result.data ?? []) as LifecycleEvent[]
}

async function loadProviderEventIds(eventIds: string[]) {
  const result = await supabaseAdmin
    .from('sports_odds_snapshots')
    .select('event_id,snapshot_time,metadata')
    .eq('provider', PROVIDER)
    .in('event_id', eventIds)
    .in('market', ['moneyline', 'run_line', 'total'])
    .order('snapshot_time', { ascending: false })
    .limit(5000)
  if (result.error) throw new Error('MLB_APPROVED_PROP_PROVIDER_ID_READ_FAILED:' + result.error.message)
  const map = new Map<string, string>()
  for (const row of result.data ?? []) {
    if (map.has(String(row.event_id))) continue
    const providerEventId = String(asRecord(row.metadata).providerEventId ?? '').trim()
    if (providerEventId) map.set(String(row.event_id), providerEventId)
  }
  return map
}

async function loadPlayerDirectory() {
  const result = await supabaseAdmin
    .from('pick2_mlb_players')
    .select('mlbam_person_id,full_name')
    .order('mlbam_person_id', { ascending: true })
    .limit(5000)
  if (result.error) throw new Error('MLB_APPROVED_PROP_PLAYER_DIRECTORY_READ_FAILED:' + result.error.message)

  const map = new Map<string, Array<{ id: number; name: string }>>()
  for (const row of result.data ?? []) {
    const id = Number(row.mlbam_person_id)
    const name = String(row.full_name ?? '').trim()
    const key = normalizePerson(name)
    if (!Number.isSafeInteger(id) || id <= 0 || !name || !key) continue
    const bucket = map.get(key) ?? []
    bucket.push({ id, name })
    map.set(key, bucket)
  }
  return map
}

async function existingCheckpoint(targetDate: string, checkpoint: string) {
  const range = puertoRicoUtcRange(targetDate)
  const result = await supabaseAdmin
    .from('sports_sync_jobs')
    .select('id,status,completed_at,metadata')
    .eq('job_type', JOB_TYPE)
    .eq('provider', PROVIDER)
    .eq('sport_key', SPORT_KEY)
    .in('status', ['completed', 'partial'])
    .gte('completed_at', range.utcStart)
    .lt('completed_at', range.utcEndExclusive)
    .order('completed_at', { ascending: false })
    .limit(20)
  if (result.error) throw new Error('MLB_APPROVED_PROP_CHECKPOINT_READ_FAILED:' + result.error.message)
  return (result.data ?? []).find((row) => {
    const metadata = asRecord(row.metadata)
    return metadata.targetDate === targetDate && metadata.checkpoint === checkpoint
  }) ?? null
}

function normalizeRows(input: {
  event: LifecycleEvent
  game: OfficialGame | null
  providerEvent: ProviderEvent
  providerEventId: string
  acquiredAt: string
  playerDirectory: Map<string, Array<{ id: number; name: string }>>
}) {
  const rows: Array<Record<string, unknown>> = []
  const startMs = Date.parse(input.event.start_time)
  const pitchers = [input.game?.homePitcher, input.game?.awayPitcher].filter(Boolean) as Array<{ id: number; name: string }>
  const pitcherByName = new Map(pitchers.map((pitcher) => [normalizePerson(pitcher.name), pitcher]))
  for (const bookmaker of input.providerEvent.bookmakers ?? []) {
    const sportsbook = String(bookmaker.key ?? bookmaker.title ?? '').trim().toLowerCase()
    if (!sportsbook) continue
    for (const market of bookmaker.markets ?? []) {
      const providerMarket = String(market.key ?? '')
      if (!REQUEST_MARKETS.includes(providerMarket as any)) continue
      const snapshotTime = validIso(market.last_update ?? bookmaker.last_update)
      if (!snapshotTime || Date.parse(snapshotTime) >= startMs) continue
      for (const outcome of market.outcomes ?? []) {
        const playerName = String(outcome.description ?? '').trim()
        const selection = String(outcome.name ?? '').trim().toLowerCase()
        const price = Number(outcome.price)
        const line = outcome.point === undefined || outcome.point === null ? null : Number(outcome.point)
        if (!playerName || !['over', 'under', 'yes', 'no'].includes(selection) || !Number.isFinite(price) || price === 0) continue
        if (line !== null && !Number.isFinite(line)) continue
        const playerKey = normalizePerson(playerName)
        const pitcher = pitcherByName.get(playerKey) ?? null
        const playerMatches = input.playerDirectory.get(playerKey) ?? []
        const exactPlayer = pitcher ?? (playerMatches.length === 1 ? playerMatches[0] : null)
        const identityMatchMethod = pitcher
          ? 'MLB_PROBABLE_PITCHER_EXACT_NORMALIZED_NAME'
          : playerMatches.length === 1
            ? 'PICK2_MLB_PLAYER_UNIQUE_EXACT_NORMALIZED_NAME'
            : 'UNRESOLVED_EXACT_IDENTITY'
        rows.push({
          id: 'mlbprop_' + hash([
            input.event.id, sportsbook, providerMarket, playerName, selection, line, snapshotTime,
          ]),
          sport_key: SPORT_KEY,
          league_key: LEAGUE_KEY,
          season: '2026',
          event_id: input.event.id,
          provider: PROVIDER,
          sportsbook,
          market: baseMarket(providerMarket),
          outcome: selection,
          price,
          line,
          snapshot_time: snapshotTime,
          provider_timestamp: snapshotTime,
          is_opening: false,
          is_closing: false,
          odds_classification: 'approved_prop_research_pregame',
          metadata: {
            source: SOURCE,
            checkpoint: JOB_TYPE,
            researchOnly: true,
            productionEligible: false,
            officialPicksEligible: false,
            apostarEnabled: false,
            canonicalGamePk: input.game?.gamePk ?? null,
            providerEventId: input.providerEventId,
            providerMarketKey: providerMarket,
            alternateMarket: providerMarket.endsWith('_alternate'),
            providerPlayerName: playerName,
            playerMlbamId: exactPlayer?.id ?? null,
            canonicalPlayerName: exactPlayer?.name ?? null,
            identityMatchMethod,
            identityMatchCount: pitcher ? 1 : playerMatches.length,
            fuzzyMatchingUsed: false,
            pitcherMlbamId: pitcher?.id ?? null,
            pitcherName: pitcher?.name ?? null,
            targetStart: input.event.start_time,
            providerTimestamp: snapshotTime,
            acquiredAt: input.acquiredAt,
          },
          updated_at: input.acquiredAt,
        })
      }
    }
  }
  return rows
}

export async function captureMlbApprovedPropMarkets(input: {
  operatingDate?: string
  now?: Date
  requestId?: string | null
} = {}) {
  const now = input.now ?? new Date()
  const clock = puertoRicoClock(now)
  const targetDate = input.operatingDate ?? clock.date
  const base = {
    success: true,
    targetDate,
    researchOnly: true,
    productionEligible: false,
    officialPicksModified: false,
    apostarActivated: false,
    providerCallsMade: 0,
    providerCreditsConsumed: 0 as number | null,
    rowsAccepted: 0,
    rowsInserted: 0,
    rowsUpdated: 0,
  }
  if (!apiKey()) return { ...base, success: false, status: 'BLOCKED_MISSING_API_KEY' }
  if (targetDate !== clock.date) return { ...base, success: false, status: 'BLOCK_NONCURRENT_WRITE_DATE' }
  const recoveryWindow = clock.hour === 11 && clock.minute <= 30
  if (clock.hour !== 10 && !recoveryWindow) return { ...base, status: 'NOT_DUE' }

  // A bounded 11:00-11:10 recovery reuses the 10:45 checkpoint identity,
  // so a successful normal capture remains a strict REUSE_NO_OP.
  const checkpoint = clock.hour === 10 && clock.minute < 30 ? '10:15' : '10:45'
  const existing = await existingCheckpoint(targetDate, checkpoint)
  if (existing) {
    return { ...base, status: 'REUSE_NO_OP', checkpoint, jobId: existing.id, completedAt: existing.completed_at }
  }

  const [events, slate, playerDirectory] = await Promise.all([
    loadEvents(targetDate, now),
    officialSlate(targetDate),
    loadPlayerDirectory(),
  ])
  if (!events.length) return { ...base, status: 'NO_PREGAME_EVENTS', checkpoint }
  const providerIds = await loadProviderEventIds(events.map((event) => event.id))
  const planned = events.flatMap((event) => {
    const providerEventId = providerIds.get(event.id)
    return providerEventId ? [{ event, providerEventId, game: matchOfficial(event, slate) }] : []
  })
  if (!planned.length) return { ...base, status: 'NO_PROVIDER_EVENT_IDENTITIES', checkpoint }

  const calls: CaptureCall[] = []
  const rows: Array<Record<string, unknown>> = []
  let remaining: number | null = null
  for (const item of planned) {
    if (remaining !== null && remaining <= CREDIT_RESERVE) break
    const url = new URL('https://api.the-odds-api.com/v4/sports/' + SPORT_KEY + '/events/' + encodeURIComponent(item.providerEventId) + '/odds')
    url.searchParams.set('apiKey', apiKey())
    url.searchParams.set('regions', 'us')
    url.searchParams.set('markets', REQUEST_MARKETS.join(','))
    url.searchParams.set('oddsFormat', 'american')
    let call: CaptureCall
    try {
      const response = await fetch(url.toString(), { cache: 'no-store', signal: AbortSignal.timeout(15_000) })
      const payload = response.ok ? await response.json() as ProviderEvent : null
      const requestsLast = headerNumber(response.headers, 'x-requests-last')
      remaining = headerNumber(response.headers, 'x-requests-remaining')
      const normalized = payload ? normalizeRows({
        event: item.event,
        game: item.game,
        providerEvent: payload,
        providerEventId: item.providerEventId,
        acquiredAt: new Date().toISOString(),
        playerDirectory,
      }) : []
      rows.push(...normalized)
      call = {
        eventId: item.event.id,
        gamePk: item.game?.gamePk ?? null,
        providerEventId: item.providerEventId,
        httpStatus: response.status,
        ok: response.ok,
        rowsAccepted: normalized.length,
        requestsLast,
        requestsRemaining: remaining,
        error: response.ok ? null : 'HTTP_' + response.status,
      }
      if (remaining === null) {
        call.ok = false
        call.error = call.error ?? 'CREDIT_HEADERS_UNAVAILABLE'
      }
    } catch (error) {
      call = {
        eventId: item.event.id,
        gamePk: item.game?.gamePk ?? null,
        providerEventId: item.providerEventId,
        httpStatus: null,
        ok: false,
        rowsAccepted: 0,
        requestsLast: null,
        requestsRemaining: remaining,
        error: error instanceof Error ? error.message.slice(0, 180) : 'UNKNOWN_FETCH_ERROR',
      }
    }
    calls.push(call)
    if (call.requestsRemaining === null) break
  }

  const uniqueRowsById = new Map<string, Record<string, unknown>>()
  for (const row of rows) {
    const id = String(row.id)
    const previous = uniqueRowsById.get(id)
    if (previous && JSON.stringify(previous) !== JSON.stringify(row)) {
      throw new Error('MLB_APPROVED_PROP_DUPLICATE_ID_PAYLOAD_CONFLICT:' + id)
    }
    uniqueRowsById.set(id, row)
  }
  const uniqueRows = [...uniqueRowsById.values()]
  const ids = uniqueRows.map((row) => String(row.id))
  let existingRows = 0
  for (let offset = 0; offset < ids.length; offset += PAGE_SIZE) {
    const readback = await supabaseAdmin.from('sports_odds_snapshots').select('id').in('id', ids.slice(offset, offset + PAGE_SIZE))
    if (readback.error) throw new Error('MLB_APPROVED_PROP_EXISTING_READ_FAILED:' + readback.error.message)
    existingRows += readback.data?.length ?? 0
  }
  if (uniqueRows.length) {
    // A full multi-market MLB slate can produce several thousand quote rows.
    // Keep each PostgREST write bounded instead of sending one oversized upsert.
    for (let offset = 0; offset < uniqueRows.length; offset += WRITE_BATCH_SIZE) {
      const batch = uniqueRows.slice(offset, offset + WRITE_BATCH_SIZE)
      const write = await supabaseAdmin.from('sports_odds_snapshots').upsert(batch, { onConflict: 'id' })
      if (write.error) throw new Error('MLB_APPROVED_PROP_SNAPSHOT_WRITE_FAILED:' + write.error.message)
    }
  }

  const completedAt = new Date().toISOString()
  const creditsKnown = calls.every((call) => typeof call.requestsLast === 'number')
  const credits = creditsKnown ? calls.reduce((sum, call) => sum + Number(call.requestsLast ?? 0), 0) : null
  const failedCalls = calls.filter((call) => !call.ok).length
  const status = failedCalls ? 'partial' : 'completed'
  const jobId = randomUUID()
  const job = await supabaseAdmin.from('sports_sync_jobs').insert({
    id: jobId,
    job_type: JOB_TYPE,
    sport_key: SPORT_KEY,
    league_key: LEAGUE_KEY,
    provider: PROVIDER,
    season: '2026',
    started_at: now.toISOString(),
    completed_at: completedAt,
    status,
    records_fetched: uniqueRows.length,
    records_inserted: Math.max(0, uniqueRows.length - existingRows),
    records_updated: Math.min(existingRows, uniqueRows.length),
    records_skipped: 0,
    error_count: failedCalls,
    metadata: {
      source: SOURCE,
      targetDate,
      checkpoint,
      requestId: input.requestId ?? null,
      researchOnly: true,
      productionEligible: false,
      officialPicksModified: false,
      apostarActivated: false,
      requestedMarkets: REQUEST_MARKETS,
      providerCallsMade: calls.length,
      providerCreditsConsumed: credits,
      requestsRemainingAfter: remaining,
      creditReserve: CREDIT_RESERVE,
      plannedEvents: planned.length,
      calls,
    },
    updated_at: completedAt,
  })
  if (job.error) throw new Error('MLB_APPROVED_PROP_JOB_WRITE_FAILED:' + job.error.message)

  return {
    ...base,
    success: failedCalls === 0,
    status: status === 'completed' ? 'APPROVED_PROP_CAPTURE_PERSISTED' : 'APPROVED_PROP_CAPTURE_PARTIAL',
    checkpoint,
    jobId,
    providerCallsMade: calls.length,
    providerCreditsConsumed: credits,
    rowsAccepted: uniqueRows.length,
    rowsInserted: Math.max(0, uniqueRows.length - existingRows),
    rowsUpdated: Math.min(existingRows, uniqueRows.length),
    requestsRemainingAfter: remaining,
    calls,
  }
}
