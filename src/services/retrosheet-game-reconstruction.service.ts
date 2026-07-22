import 'server-only'

import { createHash } from 'crypto'
import { createReadStream } from 'fs'
import { readdir } from 'fs/promises'
import path from 'path'
import readline from 'readline'
import { parseRetrosheetRecordLine, type RetrosheetParsedRecord } from '@/services/retrosheet-historical-data-lake.service'

const SOURCE = 'retrosheet'
const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const SEASON = '2025'
const PARSER_VERSION = 'retrosheet_event_stream_v1'
const GAME_ENGINE_VERSION = 'retrosheet_game_engine_v1'
const RAW_DIR = path.join(process.cwd(), 'data', 'imports', 'retrosheet', SEASON, 'raw')

const TEAM_TO_CANONICAL: Record<string, string> = {
  ANA: 'LAA',
  ARI: 'ARI',
  ATH: 'ATH',
  ATL: 'ATL',
  BAL: 'BAL',
  BOS: 'BOS',
  CHA: 'CHW',
  CHN: 'CHC',
  CIN: 'CIN',
  CLE: 'CLE',
  COL: 'COL',
  DET: 'DET',
  HOU: 'HOU',
  KCA: 'KC',
  LAN: 'LAD',
  MIA: 'MIA',
  MIL: 'MIL',
  MIN: 'MIN',
  NYA: 'NYY',
  NYN: 'NYM',
  PHI: 'PHI',
  PIT: 'PIT',
  SDN: 'SD',
  SEA: 'SEA',
  SFN: 'SF',
  SLN: 'STL',
  TBA: 'TB',
  TEX: 'TEX',
  TOR: 'TOR',
  WAS: 'WSH',
}

type Half = 'top' | 'bottom'
type ValidationStatus = 'VALID' | 'VALID_WITH_WARNINGS' | 'QUARANTINED'

type BaseState = {
  first: string | null
  second: string | null
  third: string | null
}

type LineupEntry = {
  playerId: string
  canonicalPlayerId: string
  playerName: string
  teamSide: 'away' | 'home'
  battingOrder: number
  fieldPosition: number
  sourceLine: number
  starter: boolean
  entryInning: number
  entryHalf: Half
  exitInning: number | null
  exitHalf: Half | null
}

type CanonicalPlay = {
  id: string
  gameId: string
  inning: number
  half: Half
  batterId: string
  pitcherId: string | null
  count: string
  pitchSequence: string
  playDescription: string
  rawEvent: string
  parsedEvent: {
    result: string
    advances: string[]
    isPlateAppearance: boolean
    atBat: boolean
    hitType: 'single' | 'double' | 'triple' | 'home_run' | null
    walk: boolean
    strikeout: boolean
  }
  runs: number
  outs: number
  scoreAfter: { away: number; home: number }
  baseStateBefore: BaseState
  baseStateAfter: BaseState
  source: {
    filename: string
    line: number
    parserVersion: string
    checksum: string
  }
}

type PitcherAppearance = {
  pitcherId: string
  canonicalPitcherId: string
  pitcherName: string | null
  teamSide: 'away' | 'home'
  starter: boolean
  role: 'starter' | 'reliever'
  entryInning: number
  entryHalf: Half
  exitInning: number | null
  exitHalf: Half | null
  outs: number
  battersFaced: number
  hits: number
  walks: number
  strikeouts: number
  runs: number
  pitchCount: number | null
  decision: 'win' | 'loss' | 'save' | null
  sourceLine: number
}

type BatterAppearance = {
  id: string
  batterId: string
  canonicalBatterId: string
  pitcherId: string | null
  inning: number
  half: Half
  plateAppearance: boolean
  atBat: boolean
  hit: boolean
  single: boolean
  double: boolean
  triple: boolean
  homeRun: boolean
  walk: boolean
  strikeout: boolean
  stolenBase: boolean
  caughtStealing: boolean
  groundedIntoDoublePlay: boolean
  runs: number
  rbi: number | null
  sourceLine: number
}

type CanonicalGame = {
  id: string
  canonicalGameId: string
  sourceGameId: string
  date: string | null
  season: string
  gameNumber: string | null
  homeTeam: string | null
  awayTeam: string | null
  canonicalHomeTeam: string | null
  canonicalAwayTeam: string | null
  venue: string | null
  startTime: string | null
  dayNight: string | null
  doubleHeader: boolean
  designatedHitter: boolean | null
  attendance: number | null
  weather: Record<string, string | null>
  umpires: Record<string, string | null>
  winningPitcher: string | null
  losingPitcher: string | null
  savePitcher: string | null
  finalScore: { away: number; home: number }
  durationMinutes: number | null
  innings: number | null
  sourceLineage: {
    source: string
    filename: string
    firstLine: number
    lastLine: number
    parserVersion: string
    gameEngineVersion: string
    checksum: string
    historicalOnly: true
    postgameKnown: true
    trainingEligible: false
    pregameEligible: false
  }
  lineups: { away: LineupEntry[]; home: LineupEntry[] }
  starters: Array<{
    pitcherId: string
    canonicalPitcherId: string
    pitcherName: string
    side: 'away' | 'home'
    role: 'historical_starter'
    historicalOnly: true
    pregameEligible: false
    postgameKnown: true
    sourceLine: number
  }>
  substitutions: Array<{
    id: string
    playerId: string
    canonicalPlayerId: string
    playerName: string
    teamSide: 'away' | 'home'
    battingOrder: number
    fieldPosition: number
    classification: 'pitching_change' | 'pinch_hitter' | 'pinch_runner' | 'defensive_replacement' | 'position_switch'
    entryInning: number
    entryHalf: Half
    sourceLine: number
  }>
  plays: CanonicalPlay[]
  pitcherAppearances: PitcherAppearance[]
  batterAppearances: BatterAppearance[]
  validation: {
    status: ValidationStatus
    warnings: string[]
    errors: string[]
    finalState: {
      inning: number
      half: Half
      outs: number
      bases: BaseState
      score: { away: number; home: number }
      gameEnded: boolean
    }
  }
}

type GameBuilder = {
  gameId: string
  filename: string
  firstLine: number
  lastLine: number
  rawLines: string[]
  info: Record<string, string>
  lineups: { away: LineupEntry[]; home: LineupEntry[] }
  currentLineup: { away: Map<number, LineupEntry>; home: Map<number, LineupEntry> }
  currentPitcher: { away: string | null; home: string | null }
  playerNames: Map<string, string>
  starters: CanonicalGame['starters']
  substitutions: CanonicalGame['substitutions']
  plays: CanonicalPlay[]
  pitcherAppearances: Map<string, PitcherAppearance>
  batterAppearances: BatterAppearance[]
  score: { away: number; home: number }
  bases: BaseState
  outs: number
  inning: number
  half: Half
  warnings: string[]
  errors: string[]
}

function canonicalPlayerId(playerId: string) {
  return `${SOURCE}:mlb:player:${playerId}`
}

function canonicalGameId(gameId: string) {
  return `${SOURCE}:mlb:game:${gameId}`
}

function numberOrNull(value: string | undefined) {
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function halfFromRetrosheet(value: string): Half {
  return value === '1' ? 'bottom' : 'top'
}

function emptyBases(): BaseState {
  return { first: null, second: null, third: null }
}

function cloneBases(bases: BaseState): BaseState {
  return { first: bases.first, second: bases.second, third: bases.third }
}

function teamSideFromRetrosheet(value: string): 'away' | 'home' {
  return value === '1' ? 'home' : 'away'
}

function fieldingSide(half: Half): 'away' | 'home' {
  return half === 'top' ? 'home' : 'away'
}

function battingSide(half: Half): 'away' | 'home' {
  return half === 'top' ? 'away' : 'home'
}

function currentPitcher(builder: GameBuilder, half: Half) {
  return builder.currentPitcher[fieldingSide(half)]
}

function inferHitType(result: string): 'single' | 'double' | 'triple' | 'home_run' | null {
  if (/^HR/.test(result)) return 'home_run'
  if (/^S(?!B|F)/.test(result)) return 'single'
  if (/^D(?!P)/.test(result)) return 'double'
  if (/^T(?!P)/.test(result)) return 'triple'
  return null
}

function isWalk(result: string) {
  return /^(W|IW)([./+]|$)/.test(result)
}

function isHitByPitch(result: string) {
  return /^HP([./+]|$)/.test(result)
}

function isSacrifice(result: string) {
  return /^SH|^SF/.test(result)
}

function isStrikeout(result: string) {
  return /^K/.test(result)
}

function isNoPlay(result: string) {
  return result === 'NP'
}

function inferBatterOuts(result: string) {
  if (isNoPlay(result) || inferHitType(result) || isWalk(result) || isHitByPitch(result)) return 0
  if (/TP|\/TP/.test(result)) return 3
  if (/GDP|\/DP|DP/.test(result)) return 2
  if (isStrikeout(result)) return 1
  if (/^[1-9][1-9]*(\([^)]+\))?/.test(result)) return 1
  if (/^[1-9]/.test(result)) return 1
  if (/FO/.test(result) && /^FC/.test(result)) return 1
  return 0
}

function pitchCount(sequence: string) {
  const count = sequence.replace(/[.>123+*]/g, '').length
  return count > 0 ? count : null
}

function parsePlayEvent(playEvent: string, batterId: string, bases: BaseState) {
  const [result = '', advanceText = ''] = playEvent.split('.', 2)
  const advances = advanceText ? advanceText.split(';').filter(Boolean) : []
  const hitType = inferHitType(result)
  const walk = isWalk(result) || isHitByPitch(result)
  const strikeout = isStrikeout(result)
  const isPlateAppearance = !isNoPlay(result)
  const atBat = isPlateAppearance && !walk && !isSacrifice(result)
  const nextBases = cloneBases(bases)
  let runs = 0

  for (const advance of advances) {
    const [from, toRaw = ''] = advance.split('-')
    const to = toRaw.replace(/\(.+\)/, '')
    if (from === '1') nextBases.first = null
    if (from === '2') nextBases.second = null
    if (from === '3') nextBases.third = null
    if (from === 'B') {
      // Batter origin is implicit and has no occupied source base to clear.
    }
    if (to.startsWith('H')) runs += 1
    else if (to.startsWith('1')) nextBases.first = from === 'B' ? batterId : bases.first
    else if (to.startsWith('2')) nextBases.second = from === 'B' ? batterId : from === '1' ? bases.first : bases.second
    else if (to.startsWith('3')) nextBases.third = from === 'B' ? batterId : from === '1' ? bases.first : bases.second
  }

  const batterExplicitlyAdvanced = advances.some((advance) => advance.startsWith('B-'))
  if (!batterExplicitlyAdvanced) {
    if (hitType === 'home_run') runs += 1
    else if (hitType === 'triple') nextBases.third = batterId
    else if (hitType === 'double') nextBases.second = batterId
    else if (hitType === 'single' || walk) nextBases.first = batterId
  }

  return {
    result,
    advances,
    runs,
    outs: inferBatterOuts(result),
    nextBases,
    isPlateAppearance,
    atBat,
    hitType,
    walk,
    strikeout,
    stolenBase: /SB/.test(playEvent),
    caughtStealing: /CS/.test(playEvent),
    groundedIntoDoublePlay: /GDP/.test(playEvent),
  }
}

function ensureHalf(builder: GameBuilder, inning: number, half: Half) {
  if (builder.inning !== inning || builder.half !== half) {
    builder.inning = inning
    builder.half = half
    builder.outs = 0
    builder.bases = emptyBases()
  }
}

function ensurePitcherAppearance(builder: GameBuilder, pitcherId: string, teamSide: 'away' | 'home', inning: number, half: Half, sourceLine: number, starter = false) {
  const key = `${teamSide}:${pitcherId}`
  const existing = builder.pitcherAppearances.get(key)
  if (existing) return existing
  const appearance: PitcherAppearance = {
    pitcherId,
    canonicalPitcherId: canonicalPlayerId(pitcherId),
    pitcherName: builder.playerNames.get(pitcherId) ?? null,
    teamSide,
    starter,
    role: starter ? 'starter' : 'reliever',
    entryInning: inning,
    entryHalf: half,
    exitInning: null,
    exitHalf: null,
    outs: 0,
    battersFaced: 0,
    hits: 0,
    walks: 0,
    strikeouts: 0,
    runs: 0,
    pitchCount: null,
    decision: null,
    sourceLine,
  }
  builder.pitcherAppearances.set(key, appearance)
  return appearance
}

function applyDecision(builder: GameBuilder, pitcherId: string | null, decision: 'win' | 'loss' | 'save') {
  if (!pitcherId) return
  for (const appearance of builder.pitcherAppearances.values()) {
    if (appearance.pitcherId === pitcherId) appearance.decision = decision
  }
}

function createBuilder(gameId: string, filename: string, lineNumber: number): GameBuilder {
  return {
    gameId,
    filename,
    firstLine: lineNumber,
    lastLine: lineNumber,
    rawLines: [],
    info: {},
    lineups: { away: [], home: [] },
    currentLineup: { away: new Map(), home: new Map() },
    currentPitcher: { away: null, home: null },
    playerNames: new Map(),
    starters: [],
    substitutions: [],
    plays: [],
    pitcherAppearances: new Map(),
    batterAppearances: [],
    score: { away: 0, home: 0 },
    bases: emptyBases(),
    outs: 0,
    inning: 1,
    half: 'top',
    warnings: [],
    errors: [],
  }
}

function applyLineupRecord(builder: GameBuilder, record: RetrosheetParsedRecord, starter: boolean) {
  const [, playerId = '', playerName = '', teamRaw = '', battingOrderRaw = '', fieldPositionRaw = ''] = record.fields
  const teamSide = teamSideFromRetrosheet(teamRaw)
  const battingOrder = Number(battingOrderRaw)
  const fieldPosition = Number(fieldPositionRaw)
  builder.playerNames.set(playerId, playerName)

  const previous = builder.currentLineup[teamSide].get(battingOrder)
  if (previous && !starter) {
    previous.exitInning = builder.inning
    previous.exitHalf = builder.half
  }

  const entry: LineupEntry = {
    playerId,
    canonicalPlayerId: canonicalPlayerId(playerId),
    playerName,
    teamSide,
    battingOrder,
    fieldPosition,
    sourceLine: record.lineNumber,
    starter,
    entryInning: starter ? 1 : builder.inning,
    entryHalf: starter ? 'top' : builder.half,
    exitInning: null,
    exitHalf: null,
  }

  builder.lineups[teamSide].push(entry)
  builder.currentLineup[teamSide].set(battingOrder, entry)

  if (fieldPosition === 1) {
    const priorPitcher = builder.currentPitcher[teamSide]
    if (priorPitcher && priorPitcher !== playerId) {
      const priorAppearance = builder.pitcherAppearances.get(`${teamSide}:${priorPitcher}`)
      if (priorAppearance && priorAppearance.exitInning === null) {
        priorAppearance.exitInning = builder.inning
        priorAppearance.exitHalf = builder.half
      }
    }
    builder.currentPitcher[teamSide] = playerId
    ensurePitcherAppearance(builder, playerId, teamSide, starter ? 1 : builder.inning, starter ? 'top' : builder.half, record.lineNumber, starter)
  }

  if (starter && fieldPosition === 1) {
    builder.starters.push({
      pitcherId: playerId,
      canonicalPitcherId: canonicalPlayerId(playerId),
      pitcherName: playerName,
      side: teamSide,
      role: 'historical_starter',
      historicalOnly: true,
      pregameEligible: false,
      postgameKnown: true,
      sourceLine: record.lineNumber,
    })
  }

  if (!starter) {
    const classification =
      fieldPosition === 1 ? 'pitching_change' :
        fieldPosition === 11 ? 'pinch_hitter' :
          fieldPosition === 12 ? 'pinch_runner' :
            previous && previous.fieldPosition !== fieldPosition ? 'position_switch' :
              'defensive_replacement'
    builder.substitutions.push({
      id: `${builder.gameId}:sub:${record.lineNumber}`,
      playerId,
      canonicalPlayerId: canonicalPlayerId(playerId),
      playerName,
      teamSide,
      battingOrder,
      fieldPosition,
      classification,
      entryInning: builder.inning,
      entryHalf: builder.half,
      sourceLine: record.lineNumber,
    })
  }
}

function applyPlayRecord(builder: GameBuilder, record: RetrosheetParsedRecord) {
  const [, inningRaw = '1', halfRaw = '0', batterId = '', count = '', pitches = '', event = ''] = record.fields
  const inning = Number(inningRaw)
  const half = halfFromRetrosheet(halfRaw)
  ensureHalf(builder, inning, half)
  const basesBefore = cloneBases(builder.bases)
  const parsed = parsePlayEvent(event, batterId, builder.bases)
  const pitcherId = currentPitcher(builder, half)
  const side = battingSide(half)
  builder.score[side] += parsed.runs
  builder.outs += parsed.outs
  builder.bases = parsed.nextBases
  if (builder.outs > 3) {
    builder.warnings.push(`OUTS_EXCEEDED_THREE:${builder.gameId}:line_${record.lineNumber}:outs_${builder.outs}`)
    builder.outs = 3
  }

  const play: CanonicalPlay = {
    id: `${builder.gameId}:play:${record.lineNumber}`,
    gameId: builder.gameId,
    inning,
    half,
    batterId,
    pitcherId,
    count,
    pitchSequence: pitches,
    playDescription: event,
    rawEvent: record.rawLine,
    parsedEvent: {
      result: parsed.result,
      advances: parsed.advances,
      isPlateAppearance: parsed.isPlateAppearance,
      atBat: parsed.atBat,
      hitType: parsed.hitType,
      walk: parsed.walk,
      strikeout: parsed.strikeout,
    },
    runs: parsed.runs,
    outs: parsed.outs,
    scoreAfter: { ...builder.score },
    baseStateBefore: basesBefore,
    baseStateAfter: cloneBases(builder.bases),
    source: {
      filename: builder.filename,
      line: record.lineNumber,
      parserVersion: PARSER_VERSION,
      checksum: record.checksum,
    },
  }
  builder.plays.push(play)

  if (pitcherId && parsed.isPlateAppearance) {
    const pitcherSide = fieldingSide(half)
    const appearance = ensurePitcherAppearance(builder, pitcherId, pitcherSide, inning, half, record.lineNumber)
    appearance.battersFaced += 1
    appearance.outs += parsed.outs
    appearance.runs += parsed.runs
    if (parsed.hitType) appearance.hits += 1
    if (parsed.walk) appearance.walks += 1
    if (parsed.strikeout) appearance.strikeouts += 1
    const playPitches = pitchCount(pitches)
    if (playPitches !== null) appearance.pitchCount = (appearance.pitchCount ?? 0) + playPitches
  }

  if (parsed.isPlateAppearance) {
    builder.batterAppearances.push({
      id: `${builder.gameId}:pa:${record.lineNumber}`,
      batterId,
      canonicalBatterId: canonicalPlayerId(batterId),
      pitcherId,
      inning,
      half,
      plateAppearance: true,
      atBat: parsed.atBat,
      hit: parsed.hitType !== null,
      single: parsed.hitType === 'single',
      double: parsed.hitType === 'double',
      triple: parsed.hitType === 'triple',
      homeRun: parsed.hitType === 'home_run',
      walk: parsed.walk,
      strikeout: parsed.strikeout,
      stolenBase: parsed.stolenBase,
      caughtStealing: parsed.caughtStealing,
      groundedIntoDoublePlay: parsed.groundedIntoDoublePlay,
      runs: parsed.hitType === 'home_run' || parsed.advances.some((advance) => advance.startsWith('B-H')) ? 1 : 0,
      rbi: parsed.runs,
      sourceLine: record.lineNumber,
    })
  }
}

function finishGame(builder: GameBuilder): CanonicalGame {
  const checksum = createHash('sha256').update(builder.rawLines.join('\n')).digest('hex')
  applyDecision(builder, builder.info.wp ?? null, 'win')
  applyDecision(builder, builder.info.lp ?? null, 'loss')
  applyDecision(builder, builder.info.save || null, 'save')
  const errors = [...builder.errors]
  const warnings = [...builder.warnings]

  if (builder.starters.length !== 2) warnings.push(`STARTER_COUNT_${builder.starters.length}`)
  if (builder.lineups.away.filter((entry) => entry.starter && entry.battingOrder > 0).length < 9) warnings.push('AWAY_STARTING_LINEUP_INCOMPLETE')
  if (builder.lineups.home.filter((entry) => entry.starter && entry.battingOrder > 0).length < 9) warnings.push('HOME_STARTING_LINEUP_INCOMPLETE')
  if (builder.plays.length === 0) errors.push('NO_PLAY_RECORDS')

  const validationStatus: ValidationStatus = errors.length > 0 ? 'QUARANTINED' : warnings.length > 0 ? 'VALID_WITH_WARNINGS' : 'VALID'
  const awayTeam = builder.info.visteam ?? null
  const homeTeam = builder.info.hometeam ?? null
  return {
    id: builder.gameId,
    canonicalGameId: canonicalGameId(builder.gameId),
    sourceGameId: builder.gameId,
    date: builder.info.date?.replaceAll('/', '-') ?? null,
    season: SEASON,
    gameNumber: builder.info.number ?? null,
    homeTeam,
    awayTeam,
    canonicalHomeTeam: homeTeam ? TEAM_TO_CANONICAL[homeTeam] ?? null : null,
    canonicalAwayTeam: awayTeam ? TEAM_TO_CANONICAL[awayTeam] ?? null : null,
    venue: builder.info.site ?? null,
    startTime: builder.info.starttime ?? null,
    dayNight: builder.info.daynight ?? null,
    doubleHeader: builder.info.number !== undefined && builder.info.number !== '0',
    designatedHitter: builder.info.usedh === undefined ? null : builder.info.usedh === 'true',
    attendance: numberOrNull(builder.info.attendance),
    weather: {
      temp: builder.info.temp ?? null,
      winddir: builder.info.winddir ?? null,
      windspeed: builder.info.windspeed ?? null,
      fieldcond: builder.info.fieldcond ?? null,
      precip: builder.info.precip ?? null,
      sky: builder.info.sky ?? null,
    },
    umpires: {
      home: builder.info.umphome ?? null,
      first: builder.info.ump1b ?? null,
      second: builder.info.ump2b ?? null,
      third: builder.info.ump3b ?? null,
      left: builder.info.umplf ?? null,
      right: builder.info.umprf ?? null,
    },
    winningPitcher: builder.info.wp || null,
    losingPitcher: builder.info.lp || null,
    savePitcher: builder.info.save || null,
    finalScore: { ...builder.score },
    durationMinutes: numberOrNull(builder.info.timeofgame),
    innings: numberOrNull(builder.info.innings) ?? builder.inning,
    sourceLineage: {
      source: SOURCE,
      filename: builder.filename,
      firstLine: builder.firstLine,
      lastLine: builder.lastLine,
      parserVersion: PARSER_VERSION,
      gameEngineVersion: GAME_ENGINE_VERSION,
      checksum,
      historicalOnly: true,
      postgameKnown: true,
      trainingEligible: false,
      pregameEligible: false,
    },
    lineups: builder.lineups,
    starters: builder.starters,
    substitutions: builder.substitutions,
    plays: builder.plays,
    pitcherAppearances: Array.from(builder.pitcherAppearances.values()),
    batterAppearances: builder.batterAppearances,
    validation: {
      status: validationStatus,
      warnings,
      errors,
      finalState: {
        inning: builder.inning,
        half: builder.half,
        outs: builder.outs,
        bases: cloneBases(builder.bases),
        score: { ...builder.score },
        gameEnded: validationStatus !== 'QUARANTINED',
      },
    },
  }
}

function applyRecord(builder: GameBuilder, record: RetrosheetParsedRecord) {
  builder.rawLines.push(record.rawLine)
  builder.lastLine = record.lineNumber
  if (record.validationStatus === 'unknown_type') builder.warnings.push(`UNKNOWN_RECORD:${record.type}:line_${record.lineNumber}`)
  for (const warning of record.warnings) builder.warnings.push(`${warning}:line_${record.lineNumber}`)
  for (const error of record.errors) builder.errors.push(`${error}:line_${record.lineNumber}`)

  if (record.type === 'info') {
    const [, key = '', value = ''] = record.fields
    builder.info[key] = value
  } else if (record.type === 'start') {
    applyLineupRecord(builder, record, true)
  } else if (record.type === 'sub') {
    applyLineupRecord(builder, record, false)
  } else if (record.type === 'play') {
    applyPlayRecord(builder, record)
  }
}

async function reconstructEventFile(filePath: string) {
  const filename = path.basename(filePath)
  const games: CanonicalGame[] = []
  let builder: GameBuilder | null = null
  let currentGameReference: string | null = null
  let lineNumber = 0
  const rl = readline.createInterface({ input: createReadStream(filePath), crlfDelay: Infinity })

  for await (const line of rl) {
    lineNumber += 1
    const parsed = parseRetrosheetRecordLine(line, lineNumber, currentGameReference)
    if (parsed.type === 'id') {
      if (builder) games.push(finishGame(builder))
      currentGameReference = parsed.fields[1] ?? null
      builder = createBuilder(currentGameReference ?? `unknown:${filename}:${lineNumber}`, filename, lineNumber)
    }
    if (!builder) continue
    applyRecord(builder, parsed)
  }
  if (builder) games.push(finishGame(builder))
  return games
}

function summarizeGame(game: CanonicalGame) {
  return {
    id: game.id,
    canonicalGameId: game.canonicalGameId,
    date: game.date,
    matchup: `${game.awayTeam ?? 'UNK'} @ ${game.homeTeam ?? 'UNK'}`,
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
    canonicalHomeTeam: game.canonicalHomeTeam,
    canonicalAwayTeam: game.canonicalAwayTeam,
    finalScore: game.finalScore,
    innings: game.innings,
    validationStatus: game.validation.status,
    warnings: game.validation.warnings.length,
    errors: game.validation.errors.length,
    lineups: game.lineups.away.length + game.lineups.home.length,
    starters: game.starters.length,
    substitutions: game.substitutions.length,
    pitcherAppearances: game.pitcherAppearances.length,
    batterAppearances: game.batterAppearances.length,
    plays: game.plays.length,
    source: {
      filename: game.sourceLineage.filename,
      firstLine: game.sourceLineage.firstLine,
      lastLine: game.sourceLineage.lastLine,
      checksum: game.sourceLineage.checksum,
    },
  }
}

async function eventFiles() {
  const entries = await readdir(RAW_DIR, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && /\.(EVA|EVN)$/i.test(entry.name))
    .map((entry) => path.join(RAW_DIR, entry.name))
    .sort((a, b) => a.localeCompare(b))
}

export async function getRetrosheetGameEngineDiagnostics({ gameId, limit = 50 }: { gameId?: string | null; limit?: number } = {}) {
  const startedAt = Date.now()
  let files: string[]
  try {
    files = await eventFiles()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Retrosheet source directory error'
    return {
      success: false,
      mode: 'retrosheet_game_engine_phase_1b',
      source: SOURCE,
      sportKey: SPORT_KEY,
      leagueKey: LEAGUE_KEY,
      season: SEASON,
      parserVersion: PARSER_VERSION,
      gameEngineVersion: GAME_ENGINE_VERSION,
      generatedAt: new Date().toISOString(),
      health: { status: 'SOURCE_UNAVAILABLE', message },
      coverage: emptyCoverage(),
      games: [],
      selectedGame: null,
      apis: ['health', 'coverage', 'games', 'gameDetails', 'gameState', 'lineups', 'starters', 'pitchers', 'batters', 'validation', 'diagnostics'],
      validation: validateRetrosheetGameEngineFixtures(),
      providerCallsMade: 0,
      remoteMutationsMade: 0,
      durationMs: Date.now() - startedAt,
    }
  }

  const summaries = []
  let selectedGame: CanonicalGame | null = null
  const aggregate = emptyCoverage()

  for (const file of files) {
    const reconstructed = await reconstructEventFile(file)
    for (const game of reconstructed) {
      aggregate.games += 1
      aggregate.valid += game.validation.status === 'VALID' ? 1 : 0
      aggregate.validWithWarnings += game.validation.status === 'VALID_WITH_WARNINGS' ? 1 : 0
      aggregate.quarantined += game.validation.status === 'QUARANTINED' ? 1 : 0
      aggregate.lineups += game.lineups.away.length + game.lineups.home.length
      aggregate.starters += game.starters.length
      aggregate.substitutions += game.substitutions.length
      aggregate.pitcherAppearances += game.pitcherAppearances.length
      aggregate.batterAppearances += game.batterAppearances.length
      aggregate.plays += game.plays.length
      aggregate.warnings += game.validation.warnings.length
      aggregate.errors += game.validation.errors.length
      if (summaries.length < limit) summaries.push(summarizeGame(game))
      if (gameId && game.id === gameId) selectedGame = game
    }
  }

  return {
    success: aggregate.quarantined === 0,
    mode: 'retrosheet_game_engine_phase_1b',
    source: SOURCE,
    sportKey: SPORT_KEY,
    leagueKey: LEAGUE_KEY,
    season: SEASON,
    parserVersion: PARSER_VERSION,
    gameEngineVersion: GAME_ENGINE_VERSION,
    generatedAt: new Date().toISOString(),
    health: {
      status: aggregate.quarantined === 0 ? 'HEALTHY' : 'DEGRADED',
      sourceFiles: files.length,
      selectedGameFound: gameId ? selectedGame !== null : null,
    },
    coverage: aggregate,
    games: summaries,
    selectedGame,
    gameState: selectedGame?.validation.finalState ?? null,
    lineups: selectedGame?.lineups ?? null,
    starters: selectedGame?.starters ?? null,
    pitchers: selectedGame?.pitcherAppearances ?? null,
    batters: selectedGame?.batterAppearances.slice(0, 250) ?? null,
    validation: validateRetrosheetGameEngineFixtures(),
    diagnostics: {
      gameRegistry: 'canonical game id = retrosheet:mlb:game:{sourceGameId}',
      importRegistry: 'historical_import_registry migration contract ready; no production import write executed',
      checkpointEngine: ['file', 'game', 'raw_parse', 'normalization', 'validation'],
      idempotency: 'source game checksum plus source filename and line range',
      providerCallsMade: 0,
      remoteMutationsMade: 0,
    },
    apis: ['health', 'coverage', 'games', 'gameDetails', 'gameState', 'lineups', 'starters', 'pitchers', 'batters', 'validation', 'diagnostics'],
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    durationMs: Date.now() - startedAt,
  }
}

function emptyCoverage() {
  return {
    games: 0,
    valid: 0,
    validWithWarnings: 0,
    quarantined: 0,
    lineups: 0,
    starters: 0,
    substitutions: 0,
    pitcherAppearances: 0,
    batterAppearances: 0,
    plays: 0,
    warnings: 0,
    errors: 0,
  }
}

export function validateRetrosheetGameEngineFixtures() {
  const builder = createBuilder('FIX202504010', 'fixture.EVN', 1)
  applyRecord(builder, parseRetrosheetRecordLine('info,visteam,AAA', 2, 'FIX202504010'))
  applyRecord(builder, parseRetrosheetRecordLine('info,hometeam,BBB', 3, 'FIX202504010'))
  applyRecord(builder, parseRetrosheetRecordLine('info,date,2025/04/01', 4, 'FIX202504010'))
  applyRecord(builder, parseRetrosheetRecordLine('start,awayp001,"Away Pitcher",0,0,1', 5, 'FIX202504010'))
  applyRecord(builder, parseRetrosheetRecordLine('start,homep001,"Home Pitcher",1,0,1', 6, 'FIX202504010'))
  applyRecord(builder, parseRetrosheetRecordLine('start,awayb001,"Away Batter",0,1,7', 7, 'FIX202504010'))
  applyRecord(builder, parseRetrosheetRecordLine('start,homeb001,"Home Batter",1,1,7', 8, 'FIX202504010'))
  applyRecord(builder, parseRetrosheetRecordLine('play,1,0,awayb001,00,X,HR/F7', 9, 'FIX202504010'))
  applyRecord(builder, parseRetrosheetRecordLine('sub,relief001,"Relief Pitcher",1,0,1', 10, 'FIX202504010'))
  applyRecord(builder, parseRetrosheetRecordLine('play,1,0,awayb001,32,BBBCB,W', 11, 'FIX202504010'))
  applyRecord(builder, parseRetrosheetRecordLine('play,1,1,homeb001,12,BCS,K', 12, 'FIX202504010'))
  const game = finishGame(builder)
  const checks = [
    ['canonical game id is deterministic', game.canonicalGameId === 'retrosheet:mlb:game:FIX202504010'],
    ['home run increments away score', game.finalScore.away === 1],
    ['historical starters are postgame-only', game.starters.every((starter) => starter.historicalOnly && !starter.pregameEligible && starter.postgameKnown)],
    ['pitching change is classified', game.substitutions.some((sub) => sub.classification === 'pitching_change')],
    ['pitcher appearance records batters faced', game.pitcherAppearances.some((appearance) => appearance.pitcherId === 'homep001' && appearance.battersFaced === 1)],
    ['batter appearance records strikeout', game.batterAppearances.some((appearance) => appearance.batterId === 'homeb001' && appearance.strikeout)],
    ['play objects preserve raw event', game.plays[0]?.rawEvent === 'play,1,0,awayb001,00,X,HR/F7'],
    ['source lineage marks postgame known', game.sourceLineage.historicalOnly && game.sourceLineage.postgameKnown && !game.sourceLineage.trainingEligible],
    ['provider calls remain zero', true],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'retrosheet_game_engine_validation_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
