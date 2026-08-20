import 'server-only'

import { createHash } from 'crypto'
import { mapMlbStatsGameToSportEventStatus } from '@/services/mlb-event-status-mapper.service'

export type MlbOfficialCapability =
  | 'schedule'
  | 'game_status'
  | 'probable_pitchers'
  | 'boxscore'
  | 'team_game_stats'
  | 'player_game_stats'
  | 'roster'
  | 'standings'

export type MlbOfficialTeam = {
  id: string
  name: string
  abbreviation: string | null
}

export type MlbOfficialPlayer = {
  id: string
  fullName: string
}

export type MlbOfficialProbablePitcher = {
  side: 'home' | 'away'
  team: MlbOfficialTeam
  player: MlbOfficialPlayer | null
  status: 'PROBABLE' | 'UNAVAILABLE'
}

export type MlbOfficialScheduleGame = {
  provider: 'mlb_stats_api'
  gamePk: string
  officialDate: string | null
  gameDate: string | null
  home: MlbOfficialTeam
  away: MlbOfficialTeam
  venue: { id: string | null; name: string | null }
  gameNumber: number | null
  doubleHeader: 'Y' | 'N' | 'S' | null
  status: {
    abstractGameState: string | null
    detailedState: string | null
    codedGameState: string | null
    statusCode: string | null
    canonicalSportEventStatus: string
    lifecycle: string
    safeForPregame: boolean
  }
  probablePitchers: {
    home: MlbOfficialProbablePitcher
    away: MlbOfficialProbablePitcher
  }
  scores: {
    home: number | null
    away: number | null
  }
  sourceTimestamp: string | null
  capturedAt: string
  sourceMetadata: Record<string, unknown>
}

export type MlbOfficialLineupPlayer = {
  side: 'home' | 'away'
  team: MlbOfficialTeam
  player: MlbOfficialPlayer
  battingOrder: number | null
  position: string | null
  status: string | null
}

export type MlbOfficialLiveFeedLineups = {
  provider: 'mlb_stats_api'
  gamePk: string
  status: {
    abstractGameState: string | null
    detailedState: string | null
    codedGameState: string | null
    statusCode: string | null
    canonicalSportEventStatus: string
    lifecycle: string
    safeForPregame: boolean
  }
  gameDate: string | null
  lineups: {
    home: MlbOfficialLineupPlayer[]
    away: MlbOfficialLineupPlayer[]
  }
  lineupState: 'CONFIRMED' | 'PROJECTED' | 'UNKNOWN'
  capturedAt: string
  sourceMetadata: Record<string, unknown>
}

export type MlbOfficialProviderResponse<T> = {
  provider: 'mlb_stats_api'
  endpoint: string
  capability: MlbOfficialCapability
  requestedAt: string
  capturedAt: string
  providerCallsMade: number
  rows: T[]
  warnings: string[]
}

type MlbStatsTeam = { id?: number | string; name?: string; abbreviation?: string }
type MlbStatsPerson = { id?: number | string; fullName?: string }
type MlbStatsGame = {
  gamePk?: number | string
  gameDate?: string
  officialDate?: string
  gameNumber?: number
  doubleHeader?: string
  venue?: { id?: number | string; name?: string }
  status?: {
    abstractGameState?: string
    detailedState?: string
    codedGameState?: string
    statusCode?: string
  }
  teams?: {
    away?: { team?: MlbStatsTeam; score?: number; probablePitcher?: MlbStatsPerson }
    home?: { team?: MlbStatsTeam; score?: number; probablePitcher?: MlbStatsPerson }
  }
}
type MlbStatsLivePlayer = {
  person?: MlbStatsPerson
  battingOrder?: string | number
  position?: { abbreviation?: string; name?: string }
  status?: { code?: string; description?: string }
}
type MlbStatsLiveFeed = {
  gamePk?: number | string
  gameData?: {
    datetime?: { dateTime?: string }
    status?: MlbStatsGame['status']
    teams?: {
      home?: MlbStatsTeam
      away?: MlbStatsTeam
    }
  }
  liveData?: {
    boxscore?: {
      teams?: {
        home?: { battingOrder?: Array<string | number>; players?: Record<string, MlbStatsLivePlayer> }
        away?: { battingOrder?: Array<string | number>; players?: Record<string, MlbStatsLivePlayer> }
      }
    }
  }
}
const BASE_URL = 'https://statsapi.mlb.com'
const DEFAULT_TIMEOUT_MS = 12000

function nowIso() {
  return new Date().toISOString()
}

function text(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function num(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function stablePart(value: unknown) {
  return String(value ?? 'null').trim().toLowerCase().replace(/[^a-z0-9.-]+/g, '_').replace(/^_+|_+$/g, '') || 'null'
}

export function stableMlbOfficialId(parts: unknown[]) {
  return createHash('sha256').update(parts.map(stablePart).join(':')).digest('hex').slice(0, 20)
}

function normalizeTeam(team: MlbStatsTeam | undefined, fallback: string): MlbOfficialTeam {
  return {
    id: text(team?.id) ?? stableMlbOfficialId(['mlb_team', fallback]),
    name: text(team?.name) ?? fallback,
    abbreviation: text(team?.abbreviation),
  }
}

function normalizePlayer(person: MlbStatsPerson | undefined): MlbOfficialPlayer | null {
  const id = text(person?.id)
  const fullName = text(person?.fullName)
  if (!id || !fullName) return null
  return { id, fullName }
}

function pitcher(side: 'home' | 'away', team: MlbOfficialTeam, person: MlbStatsPerson | undefined): MlbOfficialProbablePitcher {
  const player = normalizePlayer(person)
  return {
    side,
    team,
    player,
    status: player ? 'PROBABLE' : 'UNAVAILABLE',
  }
}

export function normalizeMlbOfficialSchedulePayload(payload: unknown, capturedAt = nowIso()): MlbOfficialScheduleGame[] {
  const record = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as Record<string, unknown> : {}
  const dates = Array.isArray(record.dates) ? record.dates as Array<Record<string, unknown>> : []
  return dates.flatMap((dateRow) => {
    const games = Array.isArray(dateRow.games) ? dateRow.games as MlbStatsGame[] : []
    return games.map((game) => {
      const home = normalizeTeam(game.teams?.home?.team, 'Home Team')
      const away = normalizeTeam(game.teams?.away?.team, 'Away Team')
      const mapped = mapMlbStatsGameToSportEventStatus(game)
      const canonicalStatus = mapped.status ?? 'scheduled'
      return {
        provider: 'mlb_stats_api' as const,
        gamePk: text(game.gamePk) ?? stableMlbOfficialId(['mlb_game', game.gameDate, away.id, home.id]),
        officialDate: text(game.officialDate),
        gameDate: text(game.gameDate),
        home,
        away,
        venue: { id: text(game.venue?.id), name: text(game.venue?.name) },
        gameNumber: num(game.gameNumber),
        doubleHeader: ['Y', 'N', 'S'].includes(String(game.doubleHeader ?? '')) ? game.doubleHeader as 'Y' | 'N' | 'S' : null,
        status: {
          abstractGameState: text(game.status?.abstractGameState),
          detailedState: text(game.status?.detailedState),
          codedGameState: text(game.status?.codedGameState),
          statusCode: text(game.status?.statusCode),
          canonicalSportEventStatus: canonicalStatus,
          lifecycle: mapped.lifecycle,
          safeForPregame: canonicalStatus === 'scheduled',
        },
        probablePitchers: {
          home: pitcher('home', home, game.teams?.home?.probablePitcher),
          away: pitcher('away', away, game.teams?.away?.probablePitcher),
        },
        scores: {
          home: num(game.teams?.home?.score),
          away: num(game.teams?.away?.score),
        },
        sourceTimestamp: text(game.gameDate),
        capturedAt,
        sourceMetadata: {
          gamePk: game.gamePk ?? null,
          officialDate: game.officialDate ?? null,
          rawStatus: game.status ?? null,
          doubleHeader: game.doubleHeader ?? null,
        },
      }
    })
  })
}

async function fetchJson(endpoint: string, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), Math.max(2000, timeoutMs))
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, { cache: 'no-store', signal: controller.signal })
    const textBody = await response.text()
    const payload = textBody ? JSON.parse(textBody) : null
    if (!response.ok) throw new Error(`MLB Stats API returned HTTP ${response.status}`)
    return payload
  } finally {
    clearTimeout(timeout)
  }
}

export async function fetchMlbOfficialSchedule(date: string, options: { timeoutMs?: number } = {}): Promise<MlbOfficialProviderResponse<MlbOfficialScheduleGame>> {
  const requestedAt = nowIso()
  const endpoint = `/api/v1/schedule?sportId=1&date=${date}&hydrate=probablePitcher,team,venue`
  const payload = await fetchJson(endpoint, options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  const capturedAt = nowIso()
  return {
    provider: 'mlb_stats_api',
    endpoint,
    capability: 'schedule',
    requestedAt,
    capturedAt,
    providerCallsMade: 1,
    rows: normalizeMlbOfficialSchedulePayload(payload, capturedAt),
    warnings: [],
  }
}

function normalizeLiveStatus(payload: MlbStatsLiveFeed) {
  const mapped = mapMlbStatsGameToSportEventStatus({ status: payload.gameData?.status })
  const canonicalStatus = mapped.status ?? 'scheduled'
  return {
    abstractGameState: text(payload.gameData?.status?.abstractGameState),
    detailedState: text(payload.gameData?.status?.detailedState),
    codedGameState: text(payload.gameData?.status?.codedGameState),
    statusCode: text(payload.gameData?.status?.statusCode),
    canonicalSportEventStatus: canonicalStatus,
    lifecycle: mapped.lifecycle,
    safeForPregame: canonicalStatus === 'scheduled',
  }
}

function battingSlot(value: unknown) {
  const parsed = num(value)
  if (parsed === null) return null
  return Math.floor(parsed / 100)
}

function normalizeLineupSide(side: 'home' | 'away', team: MlbOfficialTeam, payload: MlbStatsLiveFeed, capturedAt: string): MlbOfficialLineupPlayer[] {
  const box = payload.liveData?.boxscore?.teams?.[side]
  const players = box?.players ?? {}
  const order = Array.isArray(box?.battingOrder) ? box.battingOrder.map(String) : []
  const rows = Object.values(players)
    .filter((player) => player.person?.id && player.person?.fullName && player.battingOrder !== undefined)
    .map((player) => ({
      side,
      team,
      player: {
        id: text(player.person?.id) ?? stableMlbOfficialId(['mlb_player', player.person?.fullName, capturedAt]),
        fullName: text(player.person?.fullName) ?? 'Unknown Player',
      },
      battingOrder: battingSlot(player.battingOrder),
      position: text(player.position?.abbreviation) ?? text(player.position?.name),
      status: text(player.status?.description) ?? text(player.status?.code),
    }))
    .filter((player) => player.battingOrder !== null && player.battingOrder >= 1 && player.battingOrder <= 9)
    .sort((left, right) => Number(left.battingOrder) - Number(right.battingOrder))
  if (rows.length) return rows
  return order.map((id, index): MlbOfficialLineupPlayer | null => {
    const player = players[`ID${id}`]
    return player?.person?.fullName ? {
      side,
      team,
      player: { id, fullName: player.person.fullName },
      battingOrder: index + 1,
      position: text(player.position?.abbreviation) ?? text(player.position?.name),
      status: text(player.status?.description) ?? text(player.status?.code),
    } : null
  }).filter((player): player is MlbOfficialLineupPlayer => player !== null)
}

export async function fetchMlbOfficialLiveFeedLineups(gamePk: string, options: { timeoutMs?: number } = {}): Promise<MlbOfficialProviderResponse<MlbOfficialLiveFeedLineups>> {
  const requestedAt = nowIso()
  const endpoint = `/api/v1.1/game/${gamePk}/feed/live`
  const payload = await fetchJson(endpoint, options.timeoutMs ?? DEFAULT_TIMEOUT_MS) as MlbStatsLiveFeed
  const capturedAt = nowIso()
  const home = normalizeTeam(payload.gameData?.teams?.home, 'Home Team')
  const away = normalizeTeam(payload.gameData?.teams?.away, 'Away Team')
  const lineups = {
    home: normalizeLineupSide('home', home, payload, capturedAt),
    away: normalizeLineupSide('away', away, payload, capturedAt),
  }
  const lineupState = lineups.home.length >= 9 && lineups.away.length >= 9 ? 'PROJECTED' : 'UNKNOWN'
  return {
    provider: 'mlb_stats_api',
    endpoint,
    capability: 'boxscore',
    requestedAt,
    capturedAt,
    providerCallsMade: 1,
    rows: [{
      provider: 'mlb_stats_api',
      gamePk,
      status: normalizeLiveStatus(payload),
      gameDate: text(payload.gameData?.datetime?.dateTime),
      lineups,
      lineupState,
      capturedAt,
      sourceMetadata: {
        gamePk: payload.gamePk ?? gamePk,
        source: 'mlb_stats_api_live_feed_boxscore_battingOrder',
      },
    }],
    warnings: lineupState === 'UNKNOWN' ? ['LINEUP_BATTING_ORDER_NOT_EXPOSED'] : ['LINEUP_BATTING_ORDER_PROJECTED_NOT_CONFIRMED'],
  }
}

export function validateMlbOfficialProviderFixtures() {
  const fixture = {
    dates: [{
      games: [
        {
          gamePk: 1,
          gameDate: '2026-08-09T17:05:00Z',
          officialDate: '2026-08-09',
          gameNumber: 1,
          doubleHeader: 'Y',
          venue: { id: 10, name: 'Example Park' },
          status: { abstractGameState: 'Preview', detailedState: 'Scheduled', codedGameState: 'S', statusCode: 'S' },
          teams: {
            away: { team: { id: 100, name: 'Away Club', abbreviation: 'AWY' }, probablePitcher: { id: 9001, fullName: 'Away Starter' } },
            home: { team: { id: 200, name: 'Home Club', abbreviation: 'HOM' }, probablePitcher: { id: 9002, fullName: 'Home Starter' } },
          },
        },
        {
          gamePk: 2,
          gameDate: '2026-08-09T20:05:00Z',
          officialDate: '2026-08-09',
          gameNumber: 2,
          doubleHeader: 'Y',
          status: { abstractGameState: 'Final', detailedState: 'Final', codedGameState: 'F', statusCode: 'F' },
          teams: {
            away: { team: { id: 100, name: 'Away Club', abbreviation: 'AWY' }, score: 4 },
            home: { team: { id: 200, name: 'Home Club', abbreviation: 'HOM' }, score: 5 },
          },
        },
      ],
    }],
  }
  const rows = normalizeMlbOfficialSchedulePayload(fixture, '2026-08-09T12:00:00.000Z')
  const checks = [
    ['normalizes two games', rows.length === 2],
    ['doubleheader game numbers preserved', rows[0]?.gameNumber === 1 && rows[1]?.gameNumber === 2],
    ['probable pitchers normalized', rows[0]?.probablePitchers.home.player?.id === '9002' && rows[0]?.probablePitchers.away.player?.id === '9001'],
    ['final maps to completed', rows[1]?.status.canonicalSportEventStatus === 'completed'],
    ['pregame safety fails closed for final', rows[1]?.status.safeForPregame === false],
  ]
  return {
    success: checks.every(([, passed]) => passed),
    mode: 'mlb_official_provider_fixture_validation_v1',
    checks: checks.map(([name, passed]) => ({ name, passed })),
    providerCallsMade: 0,
    databaseMutationsMade: 0,
  }
}
