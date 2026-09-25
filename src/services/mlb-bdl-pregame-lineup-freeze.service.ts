import 'server-only'

import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'

const PROVIDER = 'balldontlie'
const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const SOURCE = 'BDL_PREGAME_LINEUP_FREEZE_V1'
const WINDOW_MINUTES = 180
const MAX_PAGES = 5
const PLAYER_DIRECTORY_LIMIT = 5000

type JsonMap = Record<string, unknown>
type GameRef = {
  gamePk: number
  bdlGameId: number
  eventId: string
  targetStart: string
}
type BdlLineup = {
  id?: number
  game_id?: number
  batting_order?: number | null
  position?: string | null
  is_probable_pitcher?: boolean
  player?: {
    id?: number
    full_name?: string
  }
  team?: {
    id?: number
    abbreviation?: string
  }
}

function key() {
  return process.env.BALLDONTLIE_API_KEY?.trim() ?? ''
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

function finiteInt(value: unknown) {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : null
}

function hash(parts: unknown[]) {
  return createHash('sha256')
    .update(parts.map((part) => String(part ?? 'null')).join('|'))
    .digest('hex')
    .slice(0, 28)
}

function asRecord(value: unknown): JsonMap {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonMap : {}
}

async function gameRefs(now: Date): Promise<GameRef[]> {
  const currentDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Puerto_Rico',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)

  const result = await supabaseAdmin
    .from('sports_odds_snapshots')
    .select('event_id,metadata,snapshot_time')
    .eq('provider', PROVIDER)
    .eq('sport_key', SPORT_KEY)
    .eq('metadata->>source', 'MLB_APPROVED_PROP_MARKET_CAPTURE_BDL_FALLBACK_V1')
    .gte('snapshot_time', currentDate + 'T00:00:00-04:00')
    .lt('snapshot_time', currentDate + 'T23:59:59.999-04:00')
    .order('snapshot_time', { ascending: false })
    .limit(5000)

  if (result.error) throw new Error('BDL_LINEUP_GAME_REF_READ_FAILED:' + result.error.message)

  const byGamePk = new Map<number, GameRef>()
  for (const row of result.data ?? []) {
    const metadata = asRecord(row.metadata)
    const gamePk = finiteInt(metadata.canonicalGamePk)
    const bdlGameId = finiteInt(metadata.bdlGameId)
    const targetStartRaw = String(metadata.targetStart ?? '')
    const targetStartMs = Date.parse(targetStartRaw)
    if (gamePk === null || bdlGameId === null || !Number.isFinite(targetStartMs)) continue
    if (targetStartMs <= now.getTime()) continue
    const minutes = (targetStartMs - now.getTime()) / 60_000
    if (minutes > WINDOW_MINUTES) continue
    if (!byGamePk.has(gamePk)) {
      byGamePk.set(gamePk, {
        gamePk,
        bdlGameId,
        eventId: String(row.event_id),
        targetStart: new Date(targetStartMs).toISOString(),
      })
    }
  }
  return [...byGamePk.values()].sort((a,b) => Date.parse(a.targetStart) - Date.parse(b.targetStart))
}

async function existingFrozenEvents(eventIds: string[]) {
  if (!eventIds.length) return new Set<string>()
  const result = await supabaseAdmin
    .from('sport_lineups')
    .select('event_id,metadata')
    .eq('sport_key', SPORT_KEY)
    .eq('league_key', LEAGUE_KEY)
    .eq('provider', PROVIDER)
    .eq('lineup_type', 'starting_batting_order')
    .in('event_id', eventIds)
    .limit(5000)
  if (result.error) throw new Error('BDL_LINEUP_EXISTING_READ_FAILED:' + result.error.message)

  const counts = new Map<string, number>()
  for (const row of result.data ?? []) {
    const metadata = asRecord(row.metadata)
    if (metadata.source !== SOURCE) continue
    const eventId = String(row.event_id ?? '')
    if (!eventId) continue
    counts.set(eventId, (counts.get(eventId) ?? 0) + 1)
  }
  return new Set([...counts.entries()].filter(([,count]) => count >= 18).map(([eventId]) => eventId))
}

async function playerDirectory() {
  const result = await supabaseAdmin
    .from('pick2_mlb_players')
    .select('mlbam_person_id,full_name')
    .order('mlbam_person_id', { ascending: true })
    .limit(PLAYER_DIRECTORY_LIMIT)
  if (result.error) throw new Error('BDL_LINEUP_PLAYER_DIRECTORY_READ_FAILED:' + result.error.message)

  const map = new Map<string, Array<{ id: number; name: string }>>()
  for (const row of result.data ?? []) {
    const id = finiteInt(row.mlbam_person_id)
    const name = String(row.full_name ?? '').trim()
    const personKey = normalizePerson(name)
    if (id === null || !name || !personKey) continue
    const bucket = map.get(personKey) ?? []
    if (!bucket.some((item) => item.id === id)) bucket.push({ id, name })
    map.set(personKey, bucket)
  }
  return map
}

async function fetchLineups(gameIds: number[]) {
  if (!gameIds.length) return { rows: [] as BdlLineup[], calls: 0 }
  const rows: BdlLineup[] = []
  let cursor: string | null = null
  let calls = 0
  do {
    calls += 1
    if (calls > MAX_PAGES) throw new Error('BDL_LINEUP_PAGINATION_BOUND_EXCEEDED')
    const url = new URL('https://api.balldontlie.io/mlb/v1/lineups')
    for (const id of gameIds) url.searchParams.append('game_ids[]', String(id))
    url.searchParams.set('per_page', '100')
    if (cursor) url.searchParams.set('cursor', cursor)

    const response = await fetch(url.toString(), {
      cache: 'no-store',
      headers: { Authorization: key() },
      signal: AbortSignal.timeout(20_000),
    })
    if (!response.ok) throw new Error('BALLDONTLIE_LINEUPS_HTTP_' + response.status)
    const payload = await response.json() as any
    if (Array.isArray(payload?.data)) rows.push(...payload.data as BdlLineup[])
    const next = payload?.meta?.next_cursor
    cursor = next === null || next === undefined || String(next) === '' ? null : String(next)
  } while (cursor)

  return { rows, calls }
}

function completeGameRows(
  ref: GameRef,
  rows: BdlLineup[],
  directory: Map<string, Array<{ id: number; name: string }>>,
  capturedAt: string,
) {
  const byTeam = new Map<string, Map<number, {
    lineup: BdlLineup
    mlbam: { id: number; name: string }
  }>>()
  let unresolved = 0
  let ambiguous = 0

  for (const lineup of rows) {
    if (finiteInt(lineup.game_id) !== ref.bdlGameId) continue
    const order = finiteInt(lineup.batting_order)
    if (order === null || order < 1 || order > 9) continue
    const teamAbbr = String(lineup.team?.abbreviation ?? '').trim().toUpperCase()
    const playerName = String(lineup.player?.full_name ?? '').trim()
    if (!teamAbbr || !playerName) continue
    const matches = directory.get(normalizePerson(playerName)) ?? []
    if (matches.length === 0) { unresolved += 1; continue }
    if (matches.length !== 1) { ambiguous += 1; continue }
    const teamMap = byTeam.get(teamAbbr) ?? new Map()
    if (teamMap.has(order)) {
      ambiguous += 1
      continue
    }
    teamMap.set(order, { lineup, mlbam: matches[0] })
    byTeam.set(teamAbbr, teamMap)
  }

  if (byTeam.size !== 2 || [...byTeam.values()].some((teamRows) => teamRows.size !== 9)) {
    return { complete: false, rows: [] as Array<Record<string, unknown>>, unresolved, ambiguous }
  }

  const output: Array<Record<string, unknown>> = []
  for (const [teamAbbr, teamRows] of byTeam) {
    for (const [order, item] of [...teamRows.entries()].sort((a,b) => a[0] - b[0])) {
      const bdlPlayerId = finiteInt(item.lineup.player?.id)
      const bdlTeamId = finiteInt(item.lineup.team?.id)
      output.push({
        id: 'bdllineup_' + hash([SOURCE, ref.gamePk, teamAbbr, order]),
        sport_key: SPORT_KEY,
        league_key: LEAGUE_KEY,
        season: '2026',
        event_id: ref.eventId,
        team_id: bdlTeamId === null ? null : 'baseball_mlb:mlb:balldontlie:team:' + bdlTeamId,
        player_id: String(item.mlbam.id),
        player_name: item.mlbam.name,
        provider: PROVIDER,
        lineup_type: 'starting_batting_order',
        position: item.lineup.position ?? null,
        depth_order: order,
        role: 'batter',
        starter: true,
        lineup_status: 'pregame_complete_observed',
        confirmation_level: 'FIRST_COMPLETE_OBSERVED',
        source_timestamp: capturedAt,
        provider_ids: {
          bdlGameId: ref.bdlGameId,
          bdlLineupRowId: finiteInt(item.lineup.id),
          bdlPlayerId,
          canonicalGamePk: ref.gamePk,
          mlbamPersonId: item.mlbam.id,
        },
        metadata: {
          source: SOURCE,
          researchOnly: true,
          productionEligible: false,
          officialPicksEligible: false,
          apostarEnabled: false,
          canonicalGamePk: ref.gamePk,
          targetStart: ref.targetStart,
          capturedAt,
          strictPregame: Date.parse(capturedAt) < Date.parse(ref.targetStart),
          providerPublishedAtAvailable: false,
          observationSemantics: 'first complete BALLDONTLIE lineup observed by Pick Analyzer before first pitch',
          identityMatchMethod: 'BDL_PLAYER_NAME_TO_MLB_DIRECTORY_UNIQUE_EXACT_NORMALIZED_NAME',
          identityMatchCount: 1,
          fuzzyMatchingUsed: false,
          canonicalTeamAbbreviation: teamAbbr,
          battingOrder: order,
        },
        created_at: capturedAt,
        updated_at: capturedAt,
      })
    }
  }

  return { complete: output.length === 18, rows: output, unresolved, ambiguous }
}

export async function freezeBdlPregameLineups(input: { now?: Date } = {}) {
  const now = input.now ?? new Date()
  const capturedAt = now.toISOString()
  const base = {
    success: true,
    status: 'NO_ELIGIBLE_GAMES',
    researchOnly: true,
    productionEligible: false,
    officialPicksModified: false,
    apostarActivated: false,
    provider: PROVIDER,
    providerCallsMade: 0,
    eligibleGames: 0,
    completeGamesObserved: 0,
    rowsInserted: 0,
    rowsReused: 0,
  }

  if (!key()) return { ...base, success: false, status: 'BLOCKED_MISSING_BALLDONTLIE_API_KEY' }

  const refs = await gameRefs(now)
  if (!refs.length) return base

  const frozen = await existingFrozenEvents(refs.map((ref) => ref.eventId))
  const pending = refs.filter((ref) => !frozen.has(ref.eventId))
  if (!pending.length) {
    return {
      ...base,
      status: 'REUSE_NO_OP_ALL_ELIGIBLE_GAMES_ALREADY_FROZEN',
      eligibleGames: refs.length,
      rowsReused: refs.length * 18,
    }
  }

  const [directory, lineups] = await Promise.all([
    playerDirectory(),
    fetchLineups(pending.map((ref) => ref.bdlGameId)),
  ])

  const insertRows: Array<Record<string, unknown>> = []
  const observations: Array<Record<string, unknown>> = []

  for (const ref of pending) {
    const built = completeGameRows(ref, lineups.rows, directory, capturedAt)
    observations.push({
      gamePk: ref.gamePk,
      eventId: ref.eventId,
      bdlGameId: ref.bdlGameId,
      targetStart: ref.targetStart,
      minutesToStart: Math.round((Date.parse(ref.targetStart) - now.getTime()) / 60_000),
      complete: built.complete,
      exactRows: built.rows.length,
      unresolvedPlayers: built.unresolved,
      ambiguousPlayers: built.ambiguous,
    })
    if (built.complete) insertRows.push(...built.rows)
  }

  if (insertRows.length) {
    const ids = insertRows.map((row) => String(row.id))
    const existing = await supabaseAdmin.from('sport_lineups').select('id').in('id', ids)
    if (existing.error) throw new Error('BDL_LINEUP_ID_READ_FAILED:' + existing.error.message)
    const existingIds = new Set((existing.data ?? []).map((row) => String(row.id)))
    const newRows = insertRows.filter((row) => !existingIds.has(String(row.id)))
    if (newRows.length) {
      const write = await supabaseAdmin.from('sport_lineups').insert(newRows)
      if (write.error) throw new Error('BDL_LINEUP_WRITE_FAILED:' + write.error.message)
    }
    return {
      ...base,
      status: 'BDL_PREGAME_LINEUP_FREEZE_PERSISTED',
      providerCallsMade: lineups.calls,
      eligibleGames: refs.length,
      pendingGames: pending.length,
      completeGamesObserved: observations.filter((row) => row.complete === true).length,
      rowsInserted: newRows.length,
      rowsReused: refs.length * 18 - newRows.length - pending.filter((ref) => !observations.some((row) => row.eventId === ref.eventId && row.complete === true)).length * 18,
      observations,
    }
  }

  return {
    ...base,
    status: 'NO_COMPLETE_LINEUPS_OBSERVED',
    providerCallsMade: lineups.calls,
    eligibleGames: refs.length,
    pendingGames: pending.length,
    observations,
  }
}
