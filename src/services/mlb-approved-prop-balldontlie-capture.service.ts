import 'server-only'

import { createHash, randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'

const PROVIDER = 'balldontlie'
const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const JOB_TYPE = 'mlb_approved_prop_market_capture_bdl_v1'
export const BDL_CAPTURE_SOURCE = 'MLB_APPROVED_PROP_MARKET_CAPTURE_BDL_FALLBACK_V1'
const WRITE_BATCH_SIZE = 500
const PLAYER_CHUNK_SIZE = 100

type JsonMap = Record<string, unknown>

export type BdlCapturePlannedEvent = {
  eventId: string
  startTime: string
  homeTeam: string
  awayTeam: string
  gamePk: number | null
  probablePitchers: Array<{ id: number; name: string }>
}

type BdlGame = {
  id?: number
  date?: string
  status_state?: string
  home_team?: { abbreviation?: string }
  away_team?: { abbreviation?: string }
}

type BdlProp = {
  id?: number
  game_id?: number
  player_id?: number
  vendor?: string
  prop_type?: string
  line_value?: string | number | null
  market?: {
    type?: string
    over_odds?: number | null
    under_odds?: number | null
    odds?: number | null
  }
  updated_at?: string
}

type BdlPlayer = {
  id?: number
  full_name?: string
}

const PROP_MARKET_MAP: Record<string, string> = {
  hits: 'batter_hits',
  home_runs: 'batter_home_runs',
  total_bases: 'batter_total_bases',
  rbis: 'batter_rbis',
  singles: 'batter_singles',
  doubles: 'batter_doubles',
  triples: 'batter_triples',
  walks: 'batter_walks',
  strikeouts: 'batter_strikeouts',
  hits_runs_rbis: 'batter_hits_runs_rbis',
  pitcher_strikeouts: 'pitcher_strikeouts',
  pitcher_outs: 'pitcher_outs',
  pitcher_hits_allowed: 'pitcher_hits_allowed',
  pitcher_walks: 'pitcher_walks',
  pitcher_earned_runs: 'pitcher_earned_runs',
  pitcher_record_a_win: 'pitcher_record_a_win',
}

function key() {
  return process.env.BALLDONTLIE_API_KEY?.trim() ?? ''
}

function hash(parts: unknown[]) {
  return createHash('sha256').update(parts.map((part) => String(part ?? 'null')).join('|')).digest('hex').slice(0, 28)
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

function finiteNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function validIso(value: unknown) {
  const date = new Date(String(value ?? ''))
  return Number.isFinite(date.getTime()) ? date.toISOString() : null
}

function sameStart(a: string, b: string) {
  const left = Date.parse(a)
  const right = Date.parse(b)
  return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= 10 * 60_000
}

async function getJson(url: URL) {
  const response = await fetch(url.toString(), {
    cache: 'no-store',
    headers: { Authorization: key() },
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error('BALLDONTLIE_HTTP_' + response.status)
  return response.json() as Promise<any>
}

async function existingCheckpoint(targetDate: string, checkpoint: string) {
  const result = await supabaseAdmin
    .from('sports_sync_jobs')
    .select('id,status,completed_at,metadata')
    .eq('job_type', JOB_TYPE)
    .eq('provider', PROVIDER)
    .eq('sport_key', SPORT_KEY)
    .in('status', ['completed', 'partial'])
    .order('completed_at', { ascending: false })
    .limit(20)
  if (result.error) throw new Error('MLB_BDL_PROP_CHECKPOINT_READ_FAILED:' + result.error.message)
  return (result.data ?? []).find((row) => {
    const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata as JsonMap : {}
    return metadata.targetDate === targetDate &&
      metadata.checkpoint === checkpoint &&
      metadata.coverageComplete === true
  }) ?? null
}

async function loadBdlGames(targetDate: string) {
  const url = new URL('https://api.balldontlie.io/mlb/v1/games')
  url.searchParams.append('dates[]', targetDate)
  url.searchParams.set('season_type', 'regular')
  url.searchParams.set('per_page', '100')
  const payload = await getJson(url)
  return Array.isArray(payload?.data) ? payload.data as BdlGame[] : []
}

function matchGame(event: BdlCapturePlannedEvent, games: BdlGame[]) {
  return games.find((game) =>
    String(game.home_team?.abbreviation ?? '').toUpperCase() === event.homeTeam &&
    String(game.away_team?.abbreviation ?? '').toUpperCase() === event.awayTeam &&
    typeof game.date === 'string' &&
    sameStart(game.date, event.startTime) &&
    !['final', 'postponed', 'canceled', 'abandoned'].includes(String(game.status_state ?? '').toLowerCase())
  ) ?? null
}

async function loadProps(gameId: number) {
  const url = new URL('https://api.balldontlie.io/mlb/v1/odds/player_props')
  url.searchParams.set('game_id', String(gameId))
  const payload = await getJson(url)
  return Array.isArray(payload?.data) ? payload.data as BdlProp[] : []
}

async function loadPlayers(ids: number[]) {
  const out = new Map<number, string>()
  for (let offset = 0; offset < ids.length; offset += PLAYER_CHUNK_SIZE) {
    const chunk = ids.slice(offset, offset + PLAYER_CHUNK_SIZE)
    const url = new URL('https://api.balldontlie.io/mlb/v1/players')
    url.searchParams.set('per_page', '100')
    for (const id of chunk) url.searchParams.append('player_ids[]', String(id))
    const payload = await getJson(url)
    for (const player of Array.isArray(payload?.data) ? payload.data as BdlPlayer[] : []) {
      const id = finiteNumber(player.id)
      const name = String(player.full_name ?? '').trim()
      if (id !== null && Number.isSafeInteger(id) && id > 0 && name) out.set(id, name)
    }
  }
  return out
}

function rowsForProp(input: {
  event: BdlCapturePlannedEvent
  bdlGameId: number
  prop: BdlProp
  playerName: string
  exactPlayer: { id: number; name: string } | null
  identityMatchCount: number
  acquiredAt: string
}) {
  const canonicalMarket = PROP_MARKET_MAP[String(input.prop.prop_type ?? '')]
  if (!canonicalMarket) return [] as Array<Record<string, unknown>>
  const updatedAt = validIso(input.prop.updated_at)
  if (!updatedAt || Date.parse(updatedAt) >= Date.parse(input.event.startTime)) return []
  const sportsbook = String(input.prop.vendor ?? '').trim().toLowerCase()
  if (!sportsbook) return []
  const line = input.prop.line_value === null || input.prop.line_value === undefined
    ? null
    : finiteNumber(input.prop.line_value)
  const marketType = String(input.prop.market?.type ?? '')
  const selections: Array<{ outcome: 'over' | 'under' | 'yes'; price: number; line: number | null }> = []

  if (marketType === 'over_under' && line !== null) {
    const over = finiteNumber(input.prop.market?.over_odds)
    const under = finiteNumber(input.prop.market?.under_odds)
    if (over !== null && over !== 0) selections.push({ outcome: 'over', price: over, line })
    if (under !== null && under !== 0) selections.push({ outcome: 'under', price: under, line })
  } else if (marketType === 'milestone') {
    const odds = finiteNumber(input.prop.market?.odds)
    if (odds !== null && odds !== 0) selections.push({ outcome: 'yes', price: odds, line })
  }

  const isPitcher = canonicalMarket.startsWith('pitcher_')
  return selections.map((selection) => ({
    id: 'bdlprop_' + hash([
      input.event.eventId,
      input.bdlGameId,
      input.prop.id,
      sportsbook,
      canonicalMarket,
      input.playerName,
      selection.outcome,
      selection.line,
      selection.price,
      updatedAt,
    ]),
    sport_key: SPORT_KEY,
    league_key: LEAGUE_KEY,
    season: '2026',
    event_id: input.event.eventId,
    provider: PROVIDER,
    sportsbook,
    market: canonicalMarket,
    outcome: selection.outcome,
    price: selection.price,
    line: selection.line,
    snapshot_time: updatedAt,
    provider_timestamp: updatedAt,
    is_opening: false,
    is_closing: false,
    odds_classification: 'approved_prop_research_pregame_bdl_fallback',
    metadata: {
      source: BDL_CAPTURE_SOURCE,
      researchOnly: true,
      productionEligible: false,
      officialPicksEligible: false,
      apostarEnabled: false,
      canonicalGamePk: input.event.gamePk,
      bdlGameId: input.bdlGameId,
      bdlPlayerId: input.prop.player_id ?? null,
      bdlPropId: input.prop.id ?? null,
      providerPlayerName: input.playerName,
      playerMlbamId: input.exactPlayer?.id ?? null,
      canonicalPlayerName: input.exactPlayer?.name ?? null,
      identityMatchMethod: input.exactPlayer
        ? 'BDL_PLAYER_NAME_TO_MLB_DIRECTORY_UNIQUE_EXACT_NORMALIZED_NAME'
        : 'UNRESOLVED_EXACT_IDENTITY',
      identityMatchCount: input.identityMatchCount,
      fuzzyMatchingUsed: false,
      pitcherMlbamId: isPitcher ? input.exactPlayer?.id ?? null : null,
      pitcherName: isPitcher ? input.exactPlayer?.name ?? null : null,
      targetStart: input.event.startTime,
      providerTimestamp: updatedAt,
      acquiredAt: input.acquiredAt,
    },
    updated_at: input.acquiredAt,
  }))
}

export async function captureApprovedPropsFromBallDontLie(input: {
  targetDate: string
  checkpoint: string
  plannedEvents: BdlCapturePlannedEvent[]
  playerDirectory: Map<string, Array<{ id: number; name: string }>>
  requestId?: string | null
  now?: Date
}) {
  const base = {
    success: true,
    provider: PROVIDER,
    source: BDL_CAPTURE_SOURCE,
    targetDate: input.targetDate,
    checkpoint: input.checkpoint,
    providerCallsMade: 0,
    rowsAccepted: 0,
    rowsInserted: 0,
    rowsUpdated: 0,
    researchOnly: true,
    productionEligible: false,
    officialPicksModified: false,
    apostarActivated: false,
  }
  if (!key()) return { ...base, success: false, status: 'BLOCKED_MISSING_BALLDONTLIE_API_KEY' }
  const existing = await existingCheckpoint(input.targetDate, input.checkpoint)
  if (existing) return { ...base, status: 'REUSE_NO_OP', jobId: existing.id, completedAt: existing.completed_at }

  const startedAt = (input.now ?? new Date()).toISOString()
  let calls = 0
  const callErrors: Array<{ scope: string; error: string }> = []
  let games: BdlGame[] = []
  try {
    games = await loadBdlGames(input.targetDate)
    calls += 1
  } catch (error) {
    calls += 1
    callErrors.push({ scope: 'games', error: error instanceof Error ? error.message : String(error) })
  }

  const matched = input.plannedEvents.flatMap((event) => {
    const game = matchGame(event, games)
    const id = finiteNumber(game?.id)
    return id !== null && Number.isSafeInteger(id) && id > 0 ? [{ event, bdlGameId: id }] : []
  })

  const propsByGame = new Map<number, BdlProp[]>()
  for (const item of matched) {
    try {
      propsByGame.set(item.bdlGameId, await loadProps(item.bdlGameId))
    } catch (error) {
      callErrors.push({
        scope: 'player_props:' + item.bdlGameId,
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      calls += 1
    }
  }

  const bdlPlayerIds = Array.from(new Set(
    [...propsByGame.values()].flat()
      .map((prop) => finiteNumber(prop.player_id))
      .filter((id): id is number => id !== null && Number.isSafeInteger(id) && id > 0),
  ))
  let playerNames = new Map<number, string>()
  if (bdlPlayerIds.length) {
    try {
      playerNames = await loadPlayers(bdlPlayerIds)
      calls += Math.ceil(bdlPlayerIds.length / PLAYER_CHUNK_SIZE)
    } catch (error) {
      calls += Math.ceil(bdlPlayerIds.length / PLAYER_CHUNK_SIZE)
      callErrors.push({ scope: 'players', error: error instanceof Error ? error.message : String(error) })
    }
  }

  const acquiredAt = new Date().toISOString()
  const rows: Array<Record<string, unknown>> = []
  for (const item of matched) {
    const pitchers = new Map(item.event.probablePitchers.map((pitcher) => [normalizePerson(pitcher.name), pitcher]))
    for (const prop of propsByGame.get(item.bdlGameId) ?? []) {
      const bdlPlayerId = finiteNumber(prop.player_id)
      if (bdlPlayerId === null) continue
      const playerName = playerNames.get(bdlPlayerId) ?? ''
      if (!playerName) continue
      const personKey = normalizePerson(playerName)
      const pitcher = pitchers.get(personKey) ?? null
      const playerMatches = input.playerDirectory.get(personKey) ?? []
      const exactPlayer = pitcher ?? (playerMatches.length === 1 ? playerMatches[0] : null)
      rows.push(...rowsForProp({
        event: item.event,
        bdlGameId: item.bdlGameId,
        prop,
        playerName,
        exactPlayer,
        identityMatchCount: pitcher ? 1 : playerMatches.length,
        acquiredAt,
      }))
    }
  }

  const unique = new Map<string, Record<string, unknown>>()
  for (const row of rows) unique.set(String(row.id), row)
  const uniqueRows = [...unique.values()]
  const ids = uniqueRows.map((row) => String(row.id))
  let existingRows = 0
  for (let offset = 0; offset < ids.length; offset += 100) {
    const result = await supabaseAdmin.from('sports_odds_snapshots').select('id').in('id', ids.slice(offset, offset + 100))
    if (result.error) throw new Error('MLB_BDL_PROP_EXISTING_READ_FAILED:' + result.error.message)
    existingRows += result.data?.length ?? 0
  }
  for (let offset = 0; offset < uniqueRows.length; offset += WRITE_BATCH_SIZE) {
    const result = await supabaseAdmin
      .from('sports_odds_snapshots')
      .upsert(uniqueRows.slice(offset, offset + WRITE_BATCH_SIZE), { onConflict: 'id' })
    if (result.error) throw new Error('MLB_BDL_PROP_WRITE_FAILED:' + result.error.message)
  }

  const capturedEventIds = new Set(
    uniqueRows.map((row) => String(row.event_id)),
  )
  const coverageComplete = input.plannedEvents.every((event) => capturedEventIds.has(event.eventId))
  const completedAt = new Date().toISOString()
  const status = coverageComplete && callErrors.length === 0 ? 'completed' : 'partial'
  const jobId = randomUUID()
  const job = await supabaseAdmin.from('sports_sync_jobs').insert({
    id: jobId,
    job_type: JOB_TYPE,
    sport_key: SPORT_KEY,
    league_key: LEAGUE_KEY,
    provider: PROVIDER,
    season: '2026',
    started_at: startedAt,
    completed_at: completedAt,
    status,
    records_fetched: uniqueRows.length,
    records_inserted: Math.max(0, uniqueRows.length - existingRows),
    records_updated: Math.min(existingRows, uniqueRows.length),
    records_skipped: input.plannedEvents.length - capturedEventIds.size,
    error_count: callErrors.length,
    metadata: {
      source: BDL_CAPTURE_SOURCE,
      targetDate: input.targetDate,
      checkpoint: input.checkpoint,
      requestId: input.requestId ?? null,
      researchOnly: true,
      productionEligible: false,
      officialPicksModified: false,
      apostarActivated: false,
      providerCallsMade: calls,
      plannedEvents: input.plannedEvents.length,
      matchedGames: matched.length,
      capturedEvents: capturedEventIds.size,
      coverageComplete,
      callErrors,
    },
    updated_at: completedAt,
  })
  if (job.error) throw new Error('MLB_BDL_PROP_JOB_WRITE_FAILED:' + job.error.message)

  return {
    ...base,
    success: coverageComplete && callErrors.length === 0,
    status: coverageComplete ? 'BDL_APPROVED_PROP_CAPTURE_PERSISTED' : 'BDL_APPROVED_PROP_CAPTURE_PARTIAL',
    jobId,
    providerCallsMade: calls,
    rowsAccepted: uniqueRows.length,
    rowsInserted: Math.max(0, uniqueRows.length - existingRows),
    rowsUpdated: Math.min(existingRows, uniqueRows.length),
    plannedEvents: input.plannedEvents.length,
    matchedGames: matched.length,
    capturedEvents: capturedEventIds.size,
    coverageComplete,
    callErrors,
  }
}
