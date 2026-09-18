import 'server-only'

import { createHash } from 'node:crypto'

import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  buildPePitcherKV2Row,
  pa14V2CanonicalJson,
  pa14V2Sha256,
  type Pa14V2BuildInput,
  type Pa14V2Dependency,
  type Pa14V2OpponentGame,
  type Pa14V2Pitch,
  type Pa14V2SourceStart,
  type Pa14V2TerminalOnlyPa,
} from '@/lib/pe-pitcher-k-v2-builder'

export type Pa14HistoricalAuditTarget = {
  canonicalGamePk: number
  expectedPitcherIds: [number, number]
  targetPitcherId: number
}

let TARGET_GAME_PK = 0
let TARGET_PITCHER_ID = 0
let TARGET_OPPONENT_MLB_ID = 0
let TARGET_OPPONENT_CANONICAL = ''
let TARGET_DATE = ''
let TARGET_EVENT_ID = ''
let SEASON = 2025
const PAGE_SIZE = 1000

let SOURCE_STATCAST = 'PICK2_MLB_STATCAST_CLASSIFIED_V/2025_V1'
const SOURCE_GUMBO = 'MLB_STATSAPI_GUMBO/1.1'
const SOURCE_TIMECODES = 'MLB_STATSAPI_GUMBO_TIMESTAMPS/1.1'
let SOURCE_GAMELOG = 'MLB_STATSAPI_GAMELOG/2025'
const SOURCE_SCHEDULE = 'MLB_STATSAPI_SCHEDULE/1'
const SOURCE_PREGAME = 'MLB_STATSAPI_GUMBO_ARCHIVED_PREGAME/1.1'

const COMPLETED_EVENTS = new Set([
  'catcher_interf',
  'double',
  'double_play',
  'field_error',
  'field_out',
  'fielders_choice',
  'fielders_choice_out',
  'force_out',
  'grounded_into_double_play',
  'hit_by_pitch',
  'home_run',
  'intent_walk',
  'sac_bunt',
  'sac_bunt_double_play',
  'sac_fly',
  'sac_fly_double_play',
  'single',
  'strikeout',
  'strikeout_double_play',
  'triple',
  'triple_play',
  'walk',
])

const RUNNER_WITNESS_EVENT = /(?:caught_stealing|pickoff|other_out)/

function isRunnerOutWitness(play: JsonObject) {
  const eventType = String(play?.result?.eventType ?? '')
  if (!RUNNER_WITNESS_EVENT.test(eventType)) return false
  const runners = Array.isArray(play?.runners) ? play.runners : []
  return runners.some((runner: JsonObject) => runner?.movement?.isOut === true)
}

const OFFICIAL_TYPE_BY_DESCRIPTION = new Map<string, 'S' | 'B' | 'X'>([
  ['called_strike', 'S'],
  ['swinging_strike', 'S'],
  ['swinging_strike_blocked', 'S'],
  ['foul', 'S'],
  ['foul_tip', 'S'],
  ['foul_bunt', 'S'],
  ['missed_bunt', 'S'],
  ['bunt_foul_tip', 'S'],
  ['swinging_pitchout', 'S'],
  ['foul_pitchout', 'S'],
  ['automatic_strike', 'S'],
  ['ball', 'B'],
  ['blocked_ball', 'B'],
  ['pitchout', 'B'],
  ['hit_by_pitch', 'B'],
  ['intentional_ball', 'B'],
  ['automatic_ball', 'B'],
  ['hit_into_play', 'X'],
  ['hit_into_play_no_out', 'X'],
  ['hit_into_play_score', 'X'],
])

const OFFICIAL_DESCRIPTION_MAP = new Map<string, string>([
  ['Called Strike', 'called_strike'],
  ['Swinging Strike', 'swinging_strike'],
  ['Swinging Strike (Blocked)', 'swinging_strike_blocked'],
  ['Foul', 'foul'],
  ['Foul Tip', 'foul_tip'],
  ['Foul Bunt', 'foul_bunt'],
  ['Missed Bunt', 'missed_bunt'],
  ['Bunt Foul Tip', 'bunt_foul_tip'],
  ['Swinging Pitchout', 'swinging_pitchout'],
  ['Foul Pitchout', 'foul_pitchout'],
  ['Ball', 'ball'],
  ['Ball In Dirt', 'blocked_ball'],
  ['Pitchout', 'pitchout'],
  ['Hit By Pitch', 'hit_by_pitch'],
  ['Intent Ball', 'intentional_ball'],
  ['In play, out(s)', 'hit_into_play'],
  ['In play, no out', 'hit_into_play_no_out'],
  ['In play, run(s)', 'hit_into_play_score'],
  ['Automatic Ball', 'automatic_ball'],
  ['Automatic Strike', 'automatic_strike'],
])

type JsonObject = Record<string, any>

type StatcastRow = {
  game_pk: number | string
  game_date: string
  canonical_home_team_id: string | null
  canonical_away_team_id: string | null
  inning_topbot: string | null
  at_bat_number: number | string
  pitch_number: number | string
  mlbam_pitcher_id: number | string
  description: string | null
  type: string | null
  events: string | null
  release_speed: number | string | null
}

type OfficialSplit = {
  date?: string
  game?: { gamePk?: number }
  team?: { id?: number; name?: string }
  opponent?: { id?: number; name?: string }
  stat?: {
    gamesStarted?: number
    battersFaced?: number
    numberOfPitches?: number
    strikeOuts?: number
    plateAppearances?: number
  }
}

type PregameSnapshot = {
  snapshot_timestamp: string
  target_event_start_time: string
  source_lineage: JsonObject
  components: JsonObject
}

type FetchedJson = {
  raw: string
  json: any
  sha256: string
}

function sha256Text(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function canonicalDigest(value: unknown) {
  return pa14V2Sha256(pa14V2CanonicalJson(value))
}

function asPositiveInteger(value: unknown, label: string) {
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number <= 0) throw new Error(`${label}: invalid positive integer ${String(value)}`)
  return number
}

function isoMillis(value: string, label: string) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) throw new Error(`${label}: invalid timestamp ${value}`)
  return date.toISOString()
}

function timecodeToIso(value: string) {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})$/)
  if (!match) throw new Error(`Invalid MLB timecode: ${value}`)
  const [, y, mo, d, h, mi, s] = match
  return new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s))).toISOString()
}

async function fetchJsonWithDigest(url: string): Promise<FetchedJson> {
  const response = await fetch(url, { cache: 'no-store', headers: { accept: 'application/json' } })
  const raw = await response.text()
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}: ${raw.slice(0, 200)}`)
  return { raw, json: JSON.parse(raw), sha256: sha256Text(raw) }
}

async function mapConcurrent<T, R>(values: T[], concurrency: number, fn: (value: T) => Promise<R>): Promise<R[]> {
  const output = new Array<R>(values.length)
  let next = 0
  async function worker() {
    while (true) {
      const index = next
      next += 1
      if (index >= values.length) return
      output[index] = await fn(values[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, () => worker()))
  return output
}

async function resolveArchivedTarget(config: Pa14HistoricalAuditTarget) {
  const scheduleSource = await fetchJsonWithDigest(
    `https://statsapi.mlb.com/api/v1/schedule?sportId=1&gamePk=${config.canonicalGamePk}&hydrate=team`,
  )
  const scheduleGames = (scheduleSource.json?.dates ?? []).flatMap((row: any) => row?.games ?? [])
  const scheduleGame = scheduleGames.find((row: any) => Number(row?.gamePk) === config.canonicalGamePk)
  if (!scheduleGame) throw new Error(`TARGET_SCHEDULE_MISSING:${config.canonicalGamePk}`)

  const targetStart = isoMillis(String(scheduleGame?.gameDate ?? ''), 'historical targetStart')
  const targetDate = String(scheduleGame?.officialDate ?? '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) throw new Error(`TARGET_DATE_INVALID:${config.canonicalGamePk}`)

  const timestampSource = await fetchJsonWithDigest(
    `https://statsapi.mlb.com/api/v1.1/game/${config.canonicalGamePk}/feed/live/timestamps`,
  )
  if (!Array.isArray(timestampSource.json)) throw new Error(`TARGET_TIMESTAMPS_INVALID:${config.canonicalGamePk}`)
  const targetStartMs = new Date(targetStart).getTime()
  const candidates = timestampSource.json
    .map((timecode: unknown) => String(timecode))
    .map((timecode: string) => ({ timecode, at: timecodeToIso(timecode) }))
    .filter((row: { at: string }) => new Date(row.at).getTime() < targetStartMs)
    .sort((a: { at: string }, b: { at: string }) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 20)

  for (const candidate of candidates) {
    const feed = await fetchJsonWithDigest(
      `https://statsapi.mlb.com/api/v1.1/game/${config.canonicalGamePk}/feed/live?timecode=${encodeURIComponent(candidate.timecode)}`,
    )
    const metadataTimecode = String(feed.json?.metaData?.timeStamp ?? '')
    if (!metadataTimecode) continue
    const metadataAt = timecodeToIso(metadataTimecode)
    if (new Date(metadataAt).getTime() >= targetStartMs) continue

    const probable = feed.json?.gameData?.probablePitchers ?? {}
    const awayPitcherId = Number(probable?.away?.id)
    const homePitcherId = Number(probable?.home?.id)
    const ids = [awayPitcherId, homePitcherId].filter(Number.isSafeInteger)
    if (!config.expectedPitcherIds.every((id) => ids.includes(id))) continue
    const targetSide = awayPitcherId === config.targetPitcherId ? 'away' : homePitcherId === config.targetPitcherId ? 'home' : null
    if (!targetSide) continue

    const opponentSide = targetSide === 'away' ? 'home' : 'away'
    const opponentTeam = feed.json?.gameData?.teams?.[opponentSide]
    const opponentMlbId = asPositiveInteger(opponentTeam?.id, 'historical opponent MLB id')
    let opponentAbbr = String(opponentTeam?.abbreviation ?? '').trim()
    if (!opponentAbbr) {
      const teamSource = await fetchJsonWithDigest(`https://statsapi.mlb.com/api/v1/teams/${opponentMlbId}`)
      opponentAbbr = String(teamSource.json?.teams?.[0]?.abbreviation ?? '').trim()
    }
    if (!opponentAbbr) throw new Error(`OPPONENT_ABBREVIATION_MISSING:${opponentMlbId}`)
    const canonicalOpponentAbbr = opponentAbbr === 'AZ' ? 'ARI' : opponentAbbr === 'CWS' ? 'CHW' : opponentAbbr

    const { data: canonicalRows, error: canonicalError } = await supabaseAdmin
      .from('sports_teams')
      .select('id,abbreviation')
      .eq('sport_key', 'baseball_mlb')
      .eq('league_key', 'mlb')
      .eq('abbreviation', canonicalOpponentAbbr)
      .eq('active', true)
      .limit(2)
    if (canonicalError) throw new Error(`OPPONENT_CANONICAL_QUERY:${canonicalError.message}`)
    if (!canonicalRows || canonicalRows.length !== 1) {
      throw new Error(`OPPONENT_CANONICAL_IDENTITY_CONFLICT:${opponentAbbr}->${canonicalOpponentAbbr}/${canonicalRows?.length ?? 0}`)
    }

    TARGET_GAME_PK = config.canonicalGamePk
    TARGET_PITCHER_ID = config.targetPitcherId
    TARGET_OPPONENT_MLB_ID = opponentMlbId
    TARGET_OPPONENT_CANONICAL = String(canonicalRows[0].id)
    TARGET_DATE = targetDate
    TARGET_EVENT_ID = `archived-mlb:${config.canonicalGamePk}`
    SEASON = Number(targetDate.slice(0, 4))
    SOURCE_STATCAST = `PICK2_MLB_STATCAST_CLASSIFIED_V/${SEASON}_V1`
    SOURCE_GAMELOG = `MLB_STATSAPI_GAMELOG/${SEASON}`

    const pregame: PregameSnapshot = {
      snapshot_timestamp: metadataAt,
      target_event_start_time: targetStart,
      source_lineage: {
        providerTimestamp: metadataAt,
        observedAt: metadataAt,
        payloadSha256: feed.sha256,
        requestedTimecode: candidate.timecode,
        schedulePayloadSha256: scheduleSource.sha256,
        timestampArchiveSha256: timestampSource.sha256,
        temporalAuthorityMode: 'MLB_ARCHIVED_TIMECODE_SOURCE_STATE',
      },
      components: {
        starters: {
          away: { mlbamId: awayPitcherId },
          home: { mlbamId: homePitcherId },
        },
        event: { abstractGameState: 'Preview' },
      },
    }
    return {
      pregame,
      targetSide,
      opponentAbbr,
      schedulePayloadSha256: scheduleSource.sha256,
      timestampArchiveSha256: timestampSource.sha256,
    }
  }
  throw new Error(`STARTER_STATE_INVALID:NO_COMPLETE_PREGAME_MATCH:${config.canonicalGamePk}`)
}

function getSplits(payload: any): OfficialSplit[] {
  const splits = payload?.stats?.[0]?.splits
  if (!Array.isArray(splits)) throw new Error('MLB gameLog missing stats[0].splits')
  return splits
}

async function loadOfficialLogs() {
  const pitcher = await fetchJsonWithDigest(
    `https://statsapi.mlb.com/api/v1/people/${TARGET_PITCHER_ID}/stats?stats=gameLog&group=pitching&season=${SEASON}&gameType=R`,
  )
  const opponent = await fetchJsonWithDigest(
    `https://statsapi.mlb.com/api/v1/teams/${TARGET_OPPONENT_MLB_ID}/stats?stats=gameLog&group=hitting&season=${SEASON}&gameType=R`,
  )

  const starts = getSplits(pitcher.json)
    .filter((split) => Number(split.stat?.gamesStarted ?? 0) === 1 && String(split.date ?? '') < TARGET_DATE)
    .map((split) => ({
      raw: split,
      gamePk: asPositiveInteger(split.game?.gamePk, 'pitcher gamePk'),
      gameDate: String(split.date),
      bf: asPositiveInteger(split.stat?.battersFaced, 'battersFaced'),
      pitchCount: asPositiveInteger(split.stat?.numberOfPitches, 'numberOfPitches'),
      strikeouts: Number(split.stat?.strikeOuts ?? 0),
    }))
    .sort((a, b) => a.gameDate.localeCompare(b.gameDate) || a.gamePk - b.gamePk)

  const opponentGames = getSplits(opponent.json)
    .filter((split) => String(split.date ?? '') < TARGET_DATE)
    .map((split) => ({
      raw: split,
      gamePk: asPositiveInteger(split.game?.gamePk, 'opponent gamePk'),
      gameDate: String(split.date),
      plateAppearances: asPositiveInteger(split.stat?.plateAppearances, 'plateAppearances'),
      strikeouts: Number(split.stat?.strikeOuts ?? 0),
    }))
    .sort((a, b) => a.gameDate.localeCompare(b.gameDate) || a.gamePk - b.gamePk)

  if (starts.length < 5) throw new Error(`SHORT_HISTORY: only ${starts.length} official starts`)
  if (opponentGames.length === 0) throw new Error('COVERAGE_INCOMPLETE: opponent gameLog is empty')
  return { pitcher, opponent, starts, opponentGames }
}

const STATCAST_FIELDS = [
  'game_pk',
  'game_date',
  'canonical_home_team_id',
  'canonical_away_team_id',
  'inning_topbot',
  'at_bat_number',
  'pitch_number',
  'mlbam_pitcher_id',
  'description',
  'type',
  'events',
  'release_speed',
].join(',')

async function loadPitcherStatcast(startGamePks: number[]): Promise<StatcastRow[]> {
  const rows: StatcastRow[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from('pick2_raw_mlb_statcast_pitches')
      .select(STATCAST_FIELDS)
      .eq('game_year', SEASON)
      .eq('game_type', 'R')
      .lt('game_date', TARGET_DATE)
      .eq('mlbam_pitcher_id', TARGET_PITCHER_ID)
      .in('game_pk', startGamePks)
      .order('game_pk', { ascending: true })
      .order('at_bat_number', { ascending: true })
      .order('pitch_number', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`Pitcher Statcast query failed: ${error.message}`)
    const page = (data ?? []) as unknown as StatcastRow[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
  }
  return rows
}

async function loadOpponentStatcast(opponentGamePks: number[]): Promise<StatcastRow[]> {
  const gameRows = await mapConcurrent([...new Set(opponentGamePks)].sort((a, b) => a - b), 12, async (gamePk) => {
    const { data, error } = await supabaseAdmin
      .from('pick2_raw_mlb_statcast_pitches')
      .select(STATCAST_FIELDS)
      .eq('game_pk', gamePk)
      .eq('game_type', 'R')
      .order('at_bat_number', { ascending: true })
      .order('pitch_number', { ascending: true })
      .limit(PAGE_SIZE)
    if (error) throw new Error(`Opponent Statcast query failed ${gamePk}: ${error.message}`)
    const page = (data ?? []) as unknown as StatcastRow[]
    if (page.length >= PAGE_SIZE) throw new Error(`Opponent Statcast game ${gamePk} reached page limit ${PAGE_SIZE}`)
    return page.filter((row) =>
      (row.canonical_away_team_id === TARGET_OPPONENT_CANONICAL && row.inning_topbot === 'Top') ||
      (row.canonical_home_team_id === TARGET_OPPONENT_CANONICAL && row.inning_topbot === 'Bot'),
    )
  })
  return gameRows.flat()
}

function normalizeStatcastRow(row: StatcastRow): Pa14V2Pitch {
  const event = row.events === 'truncated_pa' || row.events === '' ? null : row.events
  return {
    gamePk: asPositiveInteger(row.game_pk, 'Statcast gamePk'),
    atBatNumber: asPositiveInteger(row.at_bat_number, 'Statcast atBatNumber'),
    pitchNumber: asPositiveInteger(row.pitch_number, 'Statcast pitchNumber'),
    pitcherMlbamId: asPositiveInteger(row.mlbam_pitcher_id, 'Statcast pitcher'),
    description: row.description,
    type: row.type,
    releaseSpeed: row.release_speed === null ? null : String(row.release_speed),
    event,
  }
}

function groupByGame<T extends { gamePk: number }>(rows: T[]) {
  const map = new Map<number, T[]>()
  for (const row of rows) {
    const group = map.get(row.gamePk) ?? []
    group.push(row)
    map.set(row.gamePk, group)
  }
  return map
}

function unfinishedAtBatsFromRows(rows: StatcastRow[]) {
  const groups = new Map<string, StatcastRow[]>()
  for (const row of rows) {
    const key = `${row.game_pk}:${row.at_bat_number}`
    const group = groups.get(key) ?? []
    group.push(row)
    groups.set(key, group)
  }
  const unfinished = new Map<number, number[]>()
  for (const group of groups.values()) {
    const hasTerminal = group.some((row) => row.events && row.events !== '' && row.events !== 'truncated_pa' && COMPLETED_EVENTS.has(row.events))
    const hasTruncated = group.some((row) => row.events === 'truncated_pa')
    if (!hasTerminal || hasTruncated) {
      const gamePk = asPositiveInteger(group[0]?.game_pk, 'unfinished gamePk')
      const atBat = asPositiveInteger(group[0]?.at_bat_number, 'unfinished atBat')
      const list = unfinished.get(gamePk) ?? []
      list.push(atBat)
      unfinished.set(gamePk, list)
    }
  }
  for (const [gamePk, values] of unfinished) unfinished.set(gamePk, [...new Set(values)].sort((a, b) => a - b))
  return unfinished
}

async function verifyUnfinishedWitnesses(unfinished: Map<number, number[]>) {
  const evidence = new Map<number, JsonObject[]>()
  await mapConcurrent([...unfinished.entries()], 8, async ([gamePk, atBats]) => {
    const feed = await fetchJsonWithDigest(`https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`)
    const plays = feed.json?.liveData?.plays?.allPlays
    if (!Array.isArray(plays)) throw new Error(`Missing allPlays for unfinished witness game ${gamePk}`)
    const selected: JsonObject[] = []
    for (const atBat of atBats) {
      const play = plays[atBat - 1]
      if (!play || Number(play.atBatIndex) + 1 !== atBat) throw new Error(`Unfinished witness identity mismatch ${gamePk}/${atBat}`)
      const eventType = String(play?.result?.eventType ?? '')
      if (!isRunnerOutWitness(play)) throw new Error(`Uncertified unfinished witness ${gamePk}/${atBat}: ${eventType}`)
      selected.push({
        gamePk,
        atBatNumber: atBat,
        eventType,
        description: String(play?.result?.description ?? ''),
        feedSha256: feed.sha256,
        playDigest: sha256Text(JSON.stringify(play)),
      })
    }
    evidence.set(gamePk, selected)
  })
  return evidence
}

function normalizeOfficialDescription(value: unknown) {
  const raw = String(value ?? '')
  const normalized = OFFICIAL_DESCRIPTION_MAP.get(raw)
  if (!normalized) throw new Error(`SOURCE_VOCABULARY_INVALID: unsupported MLB description "${raw}"`)
  return normalized
}

function normalizeOfficialGame(feed: FetchedJson, gamePk: number) {
  const game = feed.json?.gameData
  const plays = feed.json?.liveData?.plays?.allPlays
  if (!Array.isArray(plays)) throw new Error(`Missing allPlays for ${gamePk}`)
  const awayId = Number(game?.teams?.away?.id)
  const homeId = Number(game?.teams?.home?.id)
  const opponentHalf = awayId === TARGET_OPPONENT_MLB_ID ? 'top' : homeId === TARGET_OPPONENT_MLB_ID ? 'bottom' : null
  if (!opponentHalf) throw new Error(`Opponent identity conflict for ${gamePk}`)

  const pitches: Pa14V2Pitch[] = []
  const terminalOnlyPas: Pa14V2TerminalOnlyPa[] = []
  const unfinished: number[] = []

  for (const play of plays) {
    if (String(play?.about?.halfInning ?? '').toLowerCase() !== opponentHalf) continue
    const atBatNumber = asPositiveInteger(Number(play.atBatIndex) + 1, 'official atBatNumber')
    const pitcherId = asPositiveInteger(play?.matchup?.pitcher?.id, 'official pitcher')
    const resultEvent = String(play?.result?.eventType ?? '')
    const playEvents = Array.isArray(play?.playEvents) ? play.playEvents : []
    const pitchEvents = playEvents.filter((event: JsonObject) => event?.isPitch === true)

    if (pitchEvents.length === 0) {
      if (resultEvent === 'intent_walk') {
        terminalOnlyPas.push({
          atBatNumber,
          pitcherMlbamId: pitcherId,
          event: resultEvent,
          evidenceDigest: sha256Text(JSON.stringify(play)),
        })
        continue
      }
      if (isRunnerOutWitness(play)) {
        unfinished.push(atBatNumber)
        continue
      }
      throw new Error(`SOURCE_INCOMPLETE: pitchless unsupported PA ${gamePk}/${atBatNumber}/${resultEvent}`)
    }

    for (let index = 0; index < pitchEvents.length; index += 1) {
      const event = pitchEvents[index]
      const description = normalizeOfficialDescription(event?.details?.description)
      const type = OFFICIAL_TYPE_BY_DESCRIPTION.get(description)
      if (!type) throw new Error(`SOURCE_VOCABULARY_INVALID: ${gamePk}/${atBatNumber} description ${description}`)
      const lastPitch = index === pitchEvents.length - 1
      const completed = COMPLETED_EVENTS.has(resultEvent)
      const release = event?.pitchData?.startSpeed
      pitches.push({
        gamePk,
        atBatNumber,
        pitchNumber: asPositiveInteger(event?.pitchNumber, 'official pitchNumber'),
        pitcherMlbamId: pitcherId,
        description,
        type,
        releaseSpeed: release === null || release === undefined ? null : String(release),
        event: lastPitch && completed ? resultEvent : null,
      })
    }
    if (!COMPLETED_EVENTS.has(resultEvent)) {
      if (!isRunnerOutWitness(play)) throw new Error(`SOURCE_INCOMPLETE: unsupported nonterminal result ${gamePk}/${atBatNumber}/${resultEvent}`)
      unfinished.push(atBatNumber)
    }
  }

  return {
    pitches,
    terminalOnlyPas,
    unfinishedPaAtBatNumbers: [...new Set(unfinished)].sort((a, b) => a - b),
    rawEvidenceDigest: feed.sha256,
  }
}

async function loadSchedules(gamePks: number[]) {
  const url = new URL('https://statsapi.mlb.com/api/v1/schedule')
  url.searchParams.set('gamePks', gamePks.join(','))
  url.searchParams.set('hydrate', 'team')
  const schedule = await fetchJsonWithDigest(url.toString())
  const map = new Map<number, string>()
  for (const date of schedule.json?.dates ?? []) {
    for (const game of date?.games ?? []) {
      const gamePk = Number(game?.gamePk)
      const gameDate = String(game?.gameDate ?? '')
      if (Number.isSafeInteger(gamePk) && gameDate) map.set(gamePk, isoMillis(gameDate, `schedule ${gamePk}`))
    }
  }
  if (map.size !== gamePks.length) {
    const missing = gamePks.filter((gamePk) => !map.has(gamePk))
    throw new Error(`Schedule coverage incomplete: ${missing.join(',')}`)
  }
  return { schedule, map }
}

async function loadCompletionEvidence(gamePks: number[]) {
  const entries = await mapConcurrent([...new Set(gamePks)].sort((a, b) => a - b), 12, async (gamePk) => {
    const source = await fetchJsonWithDigest(`https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live/timestamps`)
    if (!Array.isArray(source.json) || source.json.length === 0) throw new Error(`Missing MLB timecodes for ${gamePk}`)
    const lastTimecode = String(source.json[source.json.length - 1])
    return {
      gamePk,
      lastTimecode,
      completedBy: timecodeToIso(lastTimecode),
      evidenceDigest: source.sha256,
      count: source.json.length,
    }
  })
  return new Map(entries.map((entry) => [entry.gamePk, entry]))
}

function dependency(
  role: Pa14V2Dependency['role'],
  gamePk: number,
  pitcherId: number | null,
  sourceVersion: string,
  time: string,
  evidenceDigest: string,
): Pa14V2Dependency {
  return {
    role,
    canonicalGamePk: gamePk,
    pitcherMlbamId: pitcherId,
    sourceVersion,
    authoritativeAt: isoMillis(time, `${role} authoritativeAt`),
    availableBy: isoMillis(time, `${role} availableBy`),
    evidenceDigest,
  }
}

function terminalDigest(pitches: Pa14V2Pitch[], terminalOnlyPas: Pa14V2TerminalOnlyPa[], unfinished: number[], witness: JsonObject[] = []) {
  return canonicalDigest({
    terminals: pitches.filter((pitch) => pitch.event).map((pitch) => ({
      atBatNumber: pitch.atBatNumber,
      pitchNumber: pitch.pitchNumber,
      pitcherMlbamId: pitch.pitcherMlbamId,
      event: pitch.event,
    })),
    terminalOnlyPas,
    unfinished,
    witness,
  })
}

async function builderVersionSha256() {
  const commit = process.env.VERCEL_GIT_COMMIT_SHA || 'af5e1bada8a923032a2f995fd4402b866607ffb8'
  const rawUrl = `https://raw.githubusercontent.com/jlebronmarty-netizen/pick-analyzer/${commit}/src/lib/pe-pitcher-k-v2-builder.ts`
  const response = await fetch(rawUrl, { cache: 'no-store' })
  if (!response.ok) throw new Error(`Unable to bind builderVersion at ${commit}: HTTP ${response.status}`)
  return sha256Text(await response.text())
}

export async function auditHistoricalPa14V2Target(config: Pa14HistoricalAuditTarget) {
  const archived = await resolveArchivedTarget(config)
  const pregame = archived.pregame
  const [logs, builderVersion] = await Promise.all([
    loadOfficialLogs(),
    builderVersionSha256(),
  ])

  const providerTimestamp = isoMillis(String(pregame.source_lineage?.providerTimestamp ?? pregame.snapshot_timestamp), 'pregame provider timestamp')
  const observedAt = isoMillis(String(pregame.source_lineage?.observedAt ?? ''), 'pregame observedAt')
  const targetStart = isoMillis(String(pregame.target_event_start_time), 'targetStart')
  const pregameDigest = String(pregame.source_lineage?.payloadSha256 ?? '')
  if (!/^[a-f0-9]{64}$/.test(pregameDigest)) throw new Error('Pregame snapshot missing payload SHA-256')
  if (new Date(providerTimestamp) >= new Date(targetStart) || new Date(observedAt) >= new Date(targetStart)) {
    throw new Error('CUTOFF_VIOLATION: target source state was not retained pregame')
  }

  const probableAway = Number(pregame.components?.starters?.away?.mlbamId)
  const probableHome = Number(pregame.components?.starters?.home?.mlbamId)
  const targetState = String(pregame.components?.event?.abstractGameState ?? '')
  if (![probableAway, probableHome].includes(TARGET_PITCHER_ID) || targetState !== 'Preview') {
    throw new Error(`STARTER_STATE_INVALID:${probableAway}/${probableHome}/${targetState}`)
  }

  const startGamePks = logs.starts.map((row) => row.gamePk)
  const opponentGamePks = logs.opponentGames.map((row) => row.gamePk)
  const [pitcherStatcastRaw, opponentStatcastRaw, schedules] = await Promise.all([
    loadPitcherStatcast(startGamePks),
    loadOpponentStatcast(opponentGamePks),
    loadSchedules(startGamePks),
  ])

  const pitcherStatcast = pitcherStatcastRaw.map(normalizeStatcastRow)
  const opponentStatcast = opponentStatcastRaw.map(normalizeStatcastRow)
  const pitcherByGame = groupByGame(pitcherStatcast)
  const opponentByGame = groupByGame(opponentStatcast)
  const opponentRawByGame = new Map<number, StatcastRow[]>()
  for (const row of opponentStatcastRaw) {
    const gamePk = asPositiveInteger(row.game_pk, 'opponent raw gamePk')
    const group = opponentRawByGame.get(gamePk) ?? []
    group.push(row)
    opponentRawByGame.set(gamePk, group)
  }

  const missingOpponentGames = logs.opponentGames.filter((row) => !opponentByGame.has(row.gamePk))
  const missingFeeds = await mapConcurrent(missingOpponentGames, 6, async (game) => ({
    gamePk: game.gamePk,
    feed: await fetchJsonWithDigest(`https://statsapi.mlb.com/api/v1.1/game/${game.gamePk}/feed/live`),
  }))
  const officialOpponentEvidence = new Map(
    missingFeeds.map(({ gamePk, feed }) => [gamePk, { feed, normalized: normalizeOfficialGame(feed, gamePk) }]),
  )

  const unfinished = unfinishedAtBatsFromRows(opponentStatcastRaw)
  const witnessEvidence = await verifyUnfinishedWitnesses(unfinished)
  const pitcherUnfinished = unfinishedAtBatsFromRows(pitcherStatcastRaw)
  const pitcherWitnessEvidence = await verifyUnfinishedWitnesses(pitcherUnfinished)
  const allSourceGamePks = [...new Set([...startGamePks, ...opponentGamePks])]
  const completion = await loadCompletionEvidence(allSourceGamePks)

  const startRows: Pa14V2SourceStart[] = logs.starts.map((official) => {
    const pitches = pitcherByGame.get(official.gamePk) ?? []
    const complete = completion.get(official.gamePk)
    const scheduledStart = schedules.map.get(official.gamePk)
    if (!complete || !scheduledStart) throw new Error(`Missing start provenance for ${official.gamePk}`)
    const terminalCount = pitches.filter((pitch) => pitch.event && COMPLETED_EVENTS.has(pitch.event)).length
    const deliveredCount = pitches.filter((pitch) => pitch.description !== 'automatic_ball' && pitch.description !== 'automatic_strike').length
    const kCount = pitches.filter((pitch) => pitch.event === 'strikeout' || pitch.event === 'strikeout_double_play').length
    if (terminalCount !== official.bf || deliveredCount !== official.pitchCount || kCount !== official.strikeouts) {
      throw new Error(`Starter reconciliation failed ${official.gamePk}: BF ${terminalCount}/${official.bf}, pitches ${deliveredCount}/${official.pitchCount}, K ${kCount}/${official.strikeouts}`)
    }
    const unfinishedPaAtBatNumbers = pitcherUnfinished.get(official.gamePk) ?? []
    const witnesses = pitcherWitnessEvidence.get(official.gamePk) ?? []
    const pitchDigest = canonicalDigest(pitches)
    const boxDigest = canonicalDigest(official.raw)
    const gameDigest = canonicalDigest({
      gamePk: official.gamePk,
      gameDate: official.gameDate,
      scheduledStart,
      completion: complete,
    })
    return {
      gamePk: official.gamePk,
      pitcherMlbamId: TARGET_PITCHER_ID,
      season: SEASON,
      officialGameDate: official.gameDate,
      scheduledStart,
      regularSeason: true,
      startCorroborated: true,
      completePitchCensus: true,
      authoritativeBoxScoreBF: official.bf,
      pitches,
      terminalOnlyPas: [],
      unfinishedPaAtBatNumbers,
      dependencies: [
        dependency('SOURCE_GAME', official.gamePk, TARGET_PITCHER_ID, SOURCE_TIMECODES, complete.completedBy, gameDigest),
        dependency('PITCHES', official.gamePk, TARGET_PITCHER_ID, SOURCE_STATCAST, complete.completedBy, pitchDigest),
        dependency('TERMINAL', official.gamePk, TARGET_PITCHER_ID, SOURCE_STATCAST, complete.completedBy, terminalDigest(pitches, [], unfinishedPaAtBatNumbers, witnesses)),
        dependency('BOX_SCORE', official.gamePk, TARGET_PITCHER_ID, SOURCE_GAMELOG, complete.completedBy, boxDigest),
      ],
    }
  })

  const opponentRows: Pa14V2OpponentGame[] = logs.opponentGames.map((official) => {
    const complete = completion.get(official.gamePk)
    if (!complete) throw new Error(`Missing opponent completion provenance for ${official.gamePk}`)
    const statcastPitches = opponentByGame.get(official.gamePk)
    const officialEvidence = officialOpponentEvidence.get(official.gamePk)
    const pitches = statcastPitches ?? officialEvidence?.normalized.pitches ?? []
    const terminalOnlyPas = officialEvidence?.normalized.terminalOnlyPas ?? []
    const unfinishedPaAtBatNumbers = statcastPitches
      ? unfinished.get(official.gamePk) ?? []
      : officialEvidence?.normalized.unfinishedPaAtBatNumbers ?? []
    const witnesses = witnessEvidence.get(official.gamePk) ?? []
    const terminalCount = pitches.filter((pitch) => pitch.event && COMPLETED_EVENTS.has(pitch.event)).length + terminalOnlyPas.length
    const kCount = pitches.filter((pitch) => pitch.event === 'strikeout' || pitch.event === 'strikeout_double_play').length
    if (terminalCount !== official.plateAppearances || kCount !== official.strikeouts) {
      throw new Error(`Opponent reconciliation failed ${official.gamePk}: PA ${terminalCount}/${official.plateAppearances}, K ${kCount}/${official.strikeouts}`)
    }
    const pitchSource = statcastPitches ? SOURCE_STATCAST : SOURCE_GUMBO
    const pitchDigest = canonicalDigest(pitches)
    const rawSourceDigest = statcastPitches
      ? canonicalDigest(opponentRawByGame.get(official.gamePk) ?? [])
      : String(officialEvidence?.normalized.rawEvidenceDigest ?? '')
    const boxDigest = canonicalDigest(official.raw)
    const gameDigest = canonicalDigest({
      gamePk: official.gamePk,
      gameDate: official.gameDate,
      completion: complete,
      rawSourceDigest,
    })
    return {
      gamePk: official.gamePk,
      season: SEASON,
      officialGameDate: official.gameDate,
      battingTeam: TARGET_OPPONENT_CANONICAL,
      regularSeason: true,
      completePitchCensus: true,
      pitches,
      terminalOnlyPas,
      unfinishedPaAtBatNumbers,
      dependencies: [
        dependency('SOURCE_GAME', official.gamePk, null, SOURCE_TIMECODES, complete.completedBy, gameDigest),
        dependency('PITCHES', official.gamePk, null, pitchSource, complete.completedBy, pitchDigest),
        dependency('TERMINAL', official.gamePk, null, pitchSource, complete.completedBy, terminalDigest(pitches, terminalOnlyPas, unfinishedPaAtBatNumbers, witnesses)),
        dependency('BOX_SCORE', official.gamePk, null, SOURCE_GAMELOG, complete.completedBy, boxDigest),
      ],
    }
  })

  const maxCompletion = [...completion.values()].reduce((max, item) => Math.max(max, new Date(item.completedBy).getTime()), 0)
  if (maxCompletion >= new Date(observedAt).getTime()) throw new Error('CUTOFF_VIOLATION: historical source completion exceeds cutoff')

  const censusDigest = canonicalDigest({
    startGamePks,
    opponentGamePks,
    pitcherGameLogSha256: logs.pitcher.sha256,
    opponentGameLogSha256: logs.opponent.sha256,
    scheduleSha256: schedules.schedule.sha256,
    missingOpponentGamePks: missingOpponentGames.map((row) => row.gamePk),
    completion: [...completion.values()].sort((a, b) => a.gamePk - b.gamePk),
  })

  const input: Pa14V2BuildInput = {
    target: {
      canonicalGamePk: TARGET_GAME_PK,
      pitcherMlbamId: TARGET_PITCHER_ID,
      opponentTeam: TARGET_OPPONENT_CANONICAL,
      season: SEASON,
      officialGameDate: TARGET_DATE,
      targetStart,
      cutoff: observedAt,
      starterStateValid: true,
      scheduleDependency: {
        role: 'SCHEDULE',
        canonicalGamePk: TARGET_GAME_PK,
        pitcherMlbamId: null,
        sourceVersion: SOURCE_PREGAME,
        authoritativeAt: providerTimestamp,
        availableBy: observedAt,
        evidenceDigest: pregameDigest,
      },
      starterDependency: {
        role: 'STARTER',
        canonicalGamePk: TARGET_GAME_PK,
        pitcherMlbamId: TARGET_PITCHER_ID,
        sourceVersion: SOURCE_PREGAME,
        authoritativeAt: providerTimestamp,
        availableBy: observedAt,
        evidenceDigest: pregameDigest,
      },
    },
    census: {
      qualifyingStartGamePks: startGamePks,
      opponentGamePks,
      complete: true,
      dependency: {
        role: 'CENSUS',
        canonicalGamePk: TARGET_GAME_PK,
        pitcherMlbamId: TARGET_PITCHER_ID,
        sourceVersion: `${SOURCE_GAMELOG}+${SOURCE_TIMECODES}`,
        authoritativeAt: new Date(maxCompletion).toISOString(),
        availableBy: new Date(maxCompletion).toISOString(),
        evidenceDigest: censusDigest,
      },
    },
    starts: startRows,
    opponentGames: opponentRows,
    builderVersion,
  }

  const inputDigest = pa14V2Sha256(pa14V2CanonicalJson(input))
  const first = buildPePitcherKV2Row(input)
  const second = buildPePitcherKV2Row(input)
  const replayMatch = pa14V2CanonicalJson(first) === pa14V2CanonicalJson(second)

  return {
    researchOnly: true,
    productionEligible: false,
    contractReady: false,
    target: {
      canonicalGamePk: TARGET_GAME_PK,
      pitcherMlbamId: TARGET_PITCHER_ID,
      opponentMlbTeamId: TARGET_OPPONENT_MLB_ID,
      opponentCanonicalTeam: TARGET_OPPONENT_CANONICAL,
      targetStart,
      cutoff: observedAt,
      providerTimestamp,
    },
    result: first,
    storedInput: input,
    inputDigest,
    replayMatch,
    certificationCandidate: false,
    historicalAuditEligible: first.status === 'ELIGIBLE' && replayMatch,
    audit: {
      builderVersion,
      startCount: startRows.length,
      opponentGameCount: opponentRows.length,
      pitcherStatcastRows: pitcherStatcast.length,
      opponentStatcastRows: opponentStatcast.length,
      missingOpponentGames: missingOpponentGames.map((row) => row.gamePk),
      unfinishedOpponentPas: [...unfinished.entries()].map(([gamePk, atBats]) => ({ gamePk, atBats })),
      maxHistoricalCompletion: new Date(maxCompletion).toISOString(),
      pregamePayloadSha256: pregameDigest,
      pitcherGameLogSha256: logs.pitcher.sha256,
      opponentGameLogSha256: logs.opponent.sha256,
      scheduleSha256: schedules.schedule.sha256,
      censusDigest,
      archivedTarget: {
        targetSide: archived.targetSide,
        opponentAbbr: archived.opponentAbbr,
        schedulePayloadSha256: archived.schedulePayloadSha256,
        timestampArchiveSha256: archived.timestampArchiveSha256,
      },
    },
  }
}
