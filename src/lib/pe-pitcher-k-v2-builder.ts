import { createHash } from 'node:crypto'

export const PE_PITCHER_K_V2_CONTRACT_VERSION = 'PE_PITCHER_K_V2_INPUT_CONTRACT/2.0.0' as const

export const PA14_V2_BLOCK_REASONS = [
  'SHORT_HISTORY',
  'MISSING_VELOCITY',
  'SOURCE_VOCABULARY_INVALID',
  'STRIKE_TYPE_CONFLICT',
  'INCOMPLETE_PA',
  'IDENTITY_CONFLICT',
  'TEMPORAL_PROVENANCE_MISSING',
  'CUTOFF_VIOLATION',
  'COVERAGE_INCOMPLETE',
  'BF_UNRECONCILED',
  'STARTER_STATE_INVALID',
  'SOURCE_INCOMPLETE',
  'ORDERING_AMBIGUOUS',
  'ZERO_DENOMINATOR',
] as const

export type Pa14V2BlockReason = (typeof PA14_V2_BLOCK_REASONS)[number]
export type Pa14V2DependencyRole = 'SCHEDULE' | 'STARTER' | 'SOURCE_GAME' | 'PITCHES' | 'TERMINAL' | 'BOX_SCORE' | 'CENSUS'

export type Pa14V2Dependency = {
  role: Pa14V2DependencyRole
  canonicalGamePk: number
  pitcherMlbamId: number | null
  sourceVersion: string
  authoritativeAt: string
  availableBy: string
  evidenceDigest: string
}

export type Pa14V2Pitch = {
  gamePk: number
  atBatNumber: number
  pitchNumber: number
  pitcherMlbamId: number
  description: string | null
  type: string | null
  releaseSpeed: string | null
  event: string | null
}

export type Pa14V2TerminalOnlyPa = {
  atBatNumber: number
  pitcherMlbamId: number
  event: string
  evidenceDigest: string
}

export type Pa14V2SourceStart = {
  gamePk: number
  pitcherMlbamId: number
  season: number
  officialGameDate: string
  scheduledStart: string
  regularSeason: boolean
  startCorroborated: boolean
  completePitchCensus: boolean
  authoritativeBoxScoreBF: number | null
  pitches: Pa14V2Pitch[]
  terminalOnlyPas?: Pa14V2TerminalOnlyPa[]
  unfinishedPaAtBatNumbers?: number[]
  dependencies: Pa14V2Dependency[]
}

export type Pa14V2OpponentGame = {
  gamePk: number
  season: number
  officialGameDate: string
  battingTeam: string
  regularSeason: boolean
  completePitchCensus: boolean
  pitches: Pa14V2Pitch[]
  terminalOnlyPas?: Pa14V2TerminalOnlyPa[]
  unfinishedPaAtBatNumbers?: number[]
  dependencies: Pa14V2Dependency[]
}

export type Pa14V2BuildInput = {
  target: {
    canonicalGamePk: number
    pitcherMlbamId: number
    opponentTeam: string
    season: number
    officialGameDate: string
    targetStart: string
    cutoff: string
    starterStateValid: boolean
    scheduleDependency: Pa14V2Dependency
    starterDependency: Pa14V2Dependency
  }
  census: {
    qualifyingStartGamePks: number[]
    opponentGamePks: number[]
    complete: boolean
    dependency: Pa14V2Dependency
  }
  starts: Pa14V2SourceStart[]
  opponentGames: Pa14V2OpponentGame[]
  builderVersion: string
}

export type Pa14V2EligibleRow = {
  canonicalGamePk: number
  pitcherMlbamId: number
  targetStart: string
  dataAsOf: string
  cutoff: string
  contractVersion: typeof PE_PITCHER_K_V2_CONTRACT_VERSION
  builderVersion: string
  sourceVersions: string[]
  dependencies: Pa14V2Dependency[]
  features: {
    seasonPitches: number
    l5Pitches: number
    seasonBF: number
    l5BF: number
    daysRest: number
    pitcherKRateV2: number
    opponentKRateV2: number
    avgReleaseSpeedV2: number
    strikeRateV2: number
  }
  statistics: {
    seasonStarts: number
    seasonDeliveredPitches: number
    l5DeliveredPitches: number
    seasonBFCount: number
    l5BFCount: number
    pitcherStrikeouts: number
    opponentStrikeouts: number
    opponentPA: number
    speedSumMph: string
    speedCount: number
    strikeCount: number
  }
  lineageDigest: string
}

export type Pa14V2BuildResult =
  | { status: 'ELIGIBLE'; row: Pa14V2EligibleRow }
  | { status: 'BLOCKED'; canonicalGamePk: number; pitcherMlbamId: number; reasons: Pa14V2BlockReason[] }

const REQUIRED_TYPE_BY_DESCRIPTION = new Map<string, 'S' | 'B' | 'X'>([
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
  ['ball', 'B'],
  ['blocked_ball', 'B'],
  ['pitchout', 'B'],
  ['hit_by_pitch', 'B'],
  ['intentional_ball', 'B'],
  ['hit_into_play', 'X'],
  ['hit_into_play_no_out', 'X'],
  ['hit_into_play_score', 'X'],
  ['automatic_ball', 'B'],
  ['automatic_strike', 'S'],
])

const AUTOMATIC_DESCRIPTIONS = new Set(['automatic_ball', 'automatic_strike'])
const COMPLETED_PA_EVENTS = new Set([
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
const STRIKEOUT_EVENTS = new Set(['strikeout', 'strikeout_double_play'])
const HEX_64 = /^[a-f0-9]{64}$/
const ASCII = /^[\x20-\x7e]+$/
const ISO_UTC_MILLIS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

function positiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0
}

function parseIsoMillis(value: string): number | null {
  if (!ISO_UTC_MILLIS.test(value)) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function sortedUniqueNumbers(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b)
}

function arraysEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index])
}

function canonicalDateDays(value: string): number | null {
  if (!DATE_ONLY.test(value)) return null
  const parsed = Date.parse(`${value}T00:00:00.000Z`)
  return Number.isFinite(parsed) ? Math.trunc(parsed / 86_400_000) : null
}

function dependencySortKey(dep: Pa14V2Dependency): string {
  const pitcher = dep.pitcherMlbamId === null ? '' : String(dep.pitcherMlbamId).padStart(16, '0')
  return `${dep.role}\u0000${String(dep.canonicalGamePk).padStart(16, '0')}\u0000${pitcher}\u0000${dep.evidenceDigest}`
}

function compareDependencies(a: Pa14V2Dependency, b: Pa14V2Dependency): number {
  return dependencySortKey(a).localeCompare(dependencySortKey(b))
}

function validateDependency(dep: Pa14V2Dependency): boolean {
  return (
    ['SCHEDULE', 'STARTER', 'SOURCE_GAME', 'PITCHES', 'TERMINAL', 'BOX_SCORE', 'CENSUS'].includes(dep.role) &&
    positiveSafeInteger(dep.canonicalGamePk) &&
    (dep.pitcherMlbamId === null || positiveSafeInteger(dep.pitcherMlbamId)) &&
    typeof dep.sourceVersion === 'string' && dep.sourceVersion.length > 0 && ASCII.test(dep.sourceVersion) &&
    parseIsoMillis(dep.authoritativeAt) !== null &&
    parseIsoMillis(dep.availableBy) !== null &&
    HEX_64.test(dep.evidenceDigest)
  )
}

function decimalParts(value: string): { coefficient: bigint; scale: number } | null {
  if (!/^(0|[1-9]\d*)(\.\d+)?$/.test(value)) return null
  const [whole, fraction = ''] = value.split('.')
  const coefficient = BigInt(`${whole}${fraction}`)
  if (coefficient <= 0n) return null
  return { coefficient, scale: fraction.length }
}

function pow10(exp: number): bigint {
  return 10n ** BigInt(exp)
}

function addDecimal(
  left: { coefficient: bigint; scale: number },
  right: { coefficient: bigint; scale: number },
): { coefficient: bigint; scale: number } {
  const scale = Math.max(left.scale, right.scale)
  const l = left.coefficient * pow10(scale - left.scale)
  const r = right.coefficient * pow10(scale - right.scale)
  return normalizeDecimal({ coefficient: l + r, scale })
}

function normalizeDecimal(value: { coefficient: bigint; scale: number }): { coefficient: bigint; scale: number } {
  let { coefficient, scale } = value
  while (scale > 0 && coefficient % 10n === 0n) {
    coefficient /= 10n
    scale -= 1
  }
  return { coefficient, scale }
}

function decimalToString(value: { coefficient: bigint; scale: number }): string {
  const normalized = normalizeDecimal(value)
  const digits = normalized.coefficient.toString()
  if (normalized.scale === 0) return digits
  if (digits.length <= normalized.scale) return `0.${'0'.repeat(normalized.scale - digits.length)}${digits}`
  return `${digits.slice(0, -normalized.scale)}.${digits.slice(-normalized.scale)}`
}

function roundedRatioString(numerator: bigint, denominator: bigint, numeratorScale = 0, decimals = 8): string | null {
  if (denominator <= 0n || numerator < 0n) return null
  const scaledNumerator = numerator * pow10(decimals)
  const scaledDenominator = denominator * pow10(numeratorScale)
  let quotient = scaledNumerator / scaledDenominator
  const remainder = scaledNumerator % scaledDenominator
  const doubled = remainder * 2n
  if (doubled > scaledDenominator || (doubled === scaledDenominator && quotient % 2n === 1n)) quotient += 1n
  const base = pow10(decimals)
  const whole = quotient / base
  const fraction = (quotient % base).toString().padStart(decimals, '0').replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : whole.toString()
}

function roundedRatioNumber(numerator: bigint, denominator: bigint, numeratorScale = 0): number | null {
  const text = roundedRatioString(numerator, denominator, numeratorScale, 8)
  if (text === null) return null
  const value = Number(text)
  return Number.isFinite(value) && value >= 0 ? value : null
}

function canonicalNumber(value: number): string {
  if (!Number.isFinite(value) || value < 0 || Object.is(value, -0)) throw new Error('NON_CANONICAL_NUMBER')
  if (Number.isInteger(value)) return String(value)
  const fixed = value.toFixed(8).replace(/0+$/, '').replace(/\.$/, '')
  if (fixed.includes('e') || fixed.includes('E')) throw new Error('NON_CANONICAL_NUMBER')
  return fixed
}

export function pa14V2CanonicalJson(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return canonicalNumber(value)
  if (typeof value === 'string') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(pa14V2CanonicalJson).join(',')}]`
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${pa14V2CanonicalJson(entry)}`).join(',')}}`
  }
  throw new Error('NON_CANONICAL_VALUE')
}

export function pa14V2Sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function uniqueSortedReasons(reasons: Iterable<Pa14V2BlockReason>): Pa14V2BlockReason[] {
  return [...new Set(reasons)].sort((a, b) => a.localeCompare(b))
}

type PaAggregate = {
  deliveredPitches: number
  strikes: number
  speedSum: { coefficient: bigint; scale: number }
  speedCount: number
  completedBF: number
  strikeouts: number
}

function aggregatePitchPopulation(
  gamePk: number,
  expectedPitcherId: number | null,
  pitches: Pa14V2Pitch[],
  terminalOnlyPas: Pa14V2TerminalOnlyPa[],
  unfinishedPaAtBatNumbers: number[],
): { aggregate: PaAggregate | null; reasons: Pa14V2BlockReason[] } {
  const reasons = new Set<Pa14V2BlockReason>()
  const keySet = new Map<string, Pa14V2Pitch>()
  for (const pitch of pitches) {
    if (
      pitch.gamePk !== gamePk ||
      !positiveSafeInteger(pitch.gamePk) ||
      !positiveSafeInteger(pitch.atBatNumber) ||
      !positiveSafeInteger(pitch.pitchNumber) ||
      !positiveSafeInteger(pitch.pitcherMlbamId)
    ) {
      reasons.add('IDENTITY_CONFLICT')
      continue
    }
    const key = `${pitch.gamePk}:${pitch.atBatNumber}:${pitch.pitchNumber}`
    const prior = keySet.get(key)
    if (prior) {
      if (pa14V2CanonicalJson(prior) !== pa14V2CanonicalJson(pitch)) reasons.add('IDENTITY_CONFLICT')
      continue
    }
    keySet.set(key, pitch)
  }

  const rows = [...keySet.values()].sort((a, b) => a.atBatNumber - b.atBatNumber || a.pitchNumber - b.pitchNumber)
  const byPa = new Map<number, Pa14V2Pitch[]>()
  let deliveredPitches = 0
  let strikes = 0
  let speedSum = { coefficient: 0n, scale: 0 }
  let speedCount = 0

  for (const pitch of rows) {
    const pa = byPa.get(pitch.atBatNumber) ?? []
    pa.push(pitch)
    byPa.set(pitch.atBatNumber, pa)

    if (pitch.description === null || pitch.type === null) {
      reasons.add('SOURCE_VOCABULARY_INVALID')
      continue
    }
    const requiredType = REQUIRED_TYPE_BY_DESCRIPTION.get(pitch.description)
    if (!requiredType) {
      reasons.add('SOURCE_VOCABULARY_INVALID')
      continue
    }
    if (pitch.type !== requiredType) {
      reasons.add('STRIKE_TYPE_CONFLICT')
      continue
    }
    if (AUTOMATIC_DESCRIPTIONS.has(pitch.description)) continue

    deliveredPitches += 1
    if (pitch.type === 'S') strikes += 1
    if (pitch.releaseSpeed === null) {
      reasons.add('MISSING_VELOCITY')
      continue
    }
    const parsedSpeed = decimalParts(pitch.releaseSpeed)
    if (!parsedSpeed) {
      reasons.add('MISSING_VELOCITY')
      continue
    }
    speedSum = addDecimal(speedSum, parsedSpeed)
    speedCount += 1
  }

  const unfinished = new Set(unfinishedPaAtBatNumbers)
  const terminalOnlyByAb = new Map<number, Pa14V2TerminalOnlyPa>()
  for (const terminal of terminalOnlyPas) {
    if (!positiveSafeInteger(terminal.atBatNumber) || !positiveSafeInteger(terminal.pitcherMlbamId) || !HEX_64.test(terminal.evidenceDigest)) {
      reasons.add('IDENTITY_CONFLICT')
      continue
    }
    if (!COMPLETED_PA_EVENTS.has(terminal.event)) {
      reasons.add('SOURCE_VOCABULARY_INVALID')
      continue
    }
    if (terminalOnlyByAb.has(terminal.atBatNumber) || byPa.has(terminal.atBatNumber)) {
      reasons.add('IDENTITY_CONFLICT')
      continue
    }
    terminalOnlyByAb.set(terminal.atBatNumber, terminal)
  }

  let completedBF = 0
  let strikeouts = 0
  for (const [atBatNumber, paRows] of byPa) {
    const pitcherIds = new Set(paRows.map((row) => row.pitcherMlbamId))
    if (pitcherIds.size !== 1) {
      reasons.add('INCOMPLETE_PA')
      continue
    }
    const pitcherId = paRows[0]?.pitcherMlbamId
    if (expectedPitcherId !== null && pitcherId !== expectedPitcherId) {
      reasons.add('IDENTITY_CONFLICT')
      continue
    }
    const terminalRows = paRows.filter((row) => row.event !== null && row.event !== '')
    if (terminalRows.length === 0) {
      if (!unfinished.has(atBatNumber)) reasons.add('INCOMPLETE_PA')
      continue
    }
    if (terminalRows.length !== 1) {
      reasons.add('INCOMPLETE_PA')
      continue
    }
    const event = terminalRows[0]?.event
    if (!event || !COMPLETED_PA_EVENTS.has(event)) {
      reasons.add('SOURCE_VOCABULARY_INVALID')
      continue
    }
    completedBF += 1
    if (STRIKEOUT_EVENTS.has(event)) strikeouts += 1
  }

  for (const terminal of terminalOnlyByAb.values()) {
    if (expectedPitcherId !== null && terminal.pitcherMlbamId !== expectedPitcherId) {
      reasons.add('IDENTITY_CONFLICT')
      continue
    }
    completedBF += 1
    if (STRIKEOUT_EVENTS.has(terminal.event)) strikeouts += 1
  }

  for (const atBatNumber of unfinished) {
    if (!byPa.has(atBatNumber)) reasons.add('INCOMPLETE_PA')
  }

  if (deliveredPitches > 0 && speedCount !== deliveredPitches) reasons.add('MISSING_VELOCITY')

  if (reasons.size > 0) return { aggregate: null, reasons: uniqueSortedReasons(reasons) }
  return {
    aggregate: { deliveredPitches, strikes, speedSum, speedCount, completedBF, strikeouts },
    reasons: [],
  }
}

function validateChronologyAndDependencies(
  input: Pa14V2BuildInput,
  dependencies: Pa14V2Dependency[],
): Pa14V2BlockReason[] {
  const reasons = new Set<Pa14V2BlockReason>()
  const cutoff = parseIsoMillis(input.target.cutoff)
  const targetStart = parseIsoMillis(input.target.targetStart)
  if (cutoff === null || targetStart === null || cutoff >= targetStart) reasons.add('CUTOFF_VIOLATION')

  const roles = new Set<Pa14V2DependencyRole>()
  for (const dependency of dependencies) {
    if (!validateDependency(dependency)) {
      reasons.add('TEMPORAL_PROVENANCE_MISSING')
      continue
    }
    roles.add(dependency.role)
    const authoritativeAt = parseIsoMillis(dependency.authoritativeAt)
    const availableBy = parseIsoMillis(dependency.availableBy)
    if (cutoff === null || authoritativeAt === null || availableBy === null) {
      reasons.add('TEMPORAL_PROVENANCE_MISSING')
      continue
    }
    if (authoritativeAt > cutoff || availableBy > cutoff) reasons.add('CUTOFF_VIOLATION')
  }
  for (const role of ['SCHEDULE', 'STARTER', 'SOURCE_GAME', 'PITCHES', 'TERMINAL', 'BOX_SCORE', 'CENSUS'] as const) {
    if (!roles.has(role)) reasons.add('TEMPORAL_PROVENANCE_MISSING')
  }
  return uniqueSortedReasons(reasons)
}

function sourceDateAndSeasonValid(season: number, sourceDate: string, targetSeason: number, targetDate: string): boolean {
  const sourceDay = canonicalDateDays(sourceDate)
  const targetDay = canonicalDateDays(targetDate)
  return season === targetSeason && sourceDay !== null && targetDay !== null && sourceDay < targetDay
}

export function buildPePitcherKV2Row(input: Pa14V2BuildInput): Pa14V2BuildResult {
  const reasons = new Set<Pa14V2BlockReason>()
  const { target } = input

  if (
    !positiveSafeInteger(target.canonicalGamePk) ||
    !positiveSafeInteger(target.pitcherMlbamId) ||
    !Number.isInteger(target.season) ||
    target.season <= 0 ||
    !DATE_ONLY.test(target.officialGameDate) ||
    !HEX_64.test(input.builderVersion)
  ) {
    reasons.add('IDENTITY_CONFLICT')
  }
  if (!target.starterStateValid) reasons.add('STARTER_STATE_INVALID')
  if (target.scheduleDependency.role !== 'SCHEDULE' || target.scheduleDependency.canonicalGamePk !== target.canonicalGamePk) reasons.add('IDENTITY_CONFLICT')
  if (
    target.starterDependency.role !== 'STARTER' ||
    target.starterDependency.canonicalGamePk !== target.canonicalGamePk ||
    target.starterDependency.pitcherMlbamId !== target.pitcherMlbamId
  ) reasons.add('STARTER_STATE_INVALID')

  const expectedStarts = sortedUniqueNumbers(input.census.qualifyingStartGamePks)
  const actualStarts = sortedUniqueNumbers(input.starts.map((start) => start.gamePk))
  const expectedOpponentGames = sortedUniqueNumbers(input.census.opponentGamePks)
  const actualOpponentGames = sortedUniqueNumbers(input.opponentGames.map((game) => game.gamePk))
  if (!input.census.complete || !arraysEqual(expectedStarts, actualStarts) || !arraysEqual(expectedOpponentGames, actualOpponentGames)) reasons.add('COVERAGE_INCOMPLETE')
  if (expectedStarts.length < 5) reasons.add('SHORT_HISTORY')

  const startSummaries: Array<{ start: Pa14V2SourceStart; aggregate: PaAggregate }> = []
  for (const start of input.starts) {
    if (
      !positiveSafeInteger(start.gamePk) ||
      start.pitcherMlbamId !== target.pitcherMlbamId ||
      !start.regularSeason ||
      !start.startCorroborated ||
      !start.completePitchCensus ||
      !sourceDateAndSeasonValid(start.season, start.officialGameDate, target.season, target.officialGameDate) ||
      parseIsoMillis(start.scheduledStart) === null
    ) {
      reasons.add(!start.startCorroborated ? 'STARTER_STATE_INVALID' : 'SOURCE_INCOMPLETE')
      continue
    }
    const aggregateResult = aggregatePitchPopulation(
      start.gamePk,
      target.pitcherMlbamId,
      start.pitches,
      start.terminalOnlyPas ?? [],
      start.unfinishedPaAtBatNumbers ?? [],
    )
    for (const reason of aggregateResult.reasons) reasons.add(reason)
    if (!aggregateResult.aggregate) continue
    if (!Number.isSafeInteger(start.authoritativeBoxScoreBF) || Number(start.authoritativeBoxScoreBF) < 0) {
      reasons.add('BF_UNRECONCILED')
      continue
    }
    if (aggregateResult.aggregate.completedBF !== start.authoritativeBoxScoreBF) {
      reasons.add('BF_UNRECONCILED')
      continue
    }
    startSummaries.push({ start, aggregate: aggregateResult.aggregate })
  }

  const opponentSummaries: Array<{ game: Pa14V2OpponentGame; aggregate: PaAggregate }> = []
  for (const game of input.opponentGames) {
    if (
      !positiveSafeInteger(game.gamePk) ||
      game.battingTeam !== target.opponentTeam ||
      !game.regularSeason ||
      !game.completePitchCensus ||
      !sourceDateAndSeasonValid(game.season, game.officialGameDate, target.season, target.officialGameDate)
    ) {
      reasons.add('SOURCE_INCOMPLETE')
      continue
    }
    const aggregateResult = aggregatePitchPopulation(
      game.gamePk,
      null,
      game.pitches,
      game.terminalOnlyPas ?? [],
      game.unfinishedPaAtBatNumbers ?? [],
    )
    for (const reason of aggregateResult.reasons) reasons.add(reason)
    if (aggregateResult.aggregate) opponentSummaries.push({ game, aggregate: aggregateResult.aggregate })
  }

  const scheduledStarts = startSummaries
    .map(({ start }) => ({ start, millis: parseIsoMillis(start.scheduledStart) }))
    .filter((item): item is { start: Pa14V2SourceStart; millis: number } => item.millis !== null)
    .sort((a, b) => a.millis - b.millis || a.start.gamePk - b.start.gamePk)
  for (let i = 1; i < scheduledStarts.length; i += 1) {
    if (scheduledStarts[i - 1]?.millis === scheduledStarts[i]?.millis) reasons.add('ORDERING_AMBIGUOUS')
  }

  const allDependencies = [
    target.scheduleDependency,
    target.starterDependency,
    input.census.dependency,
    ...input.starts.flatMap((start) => start.dependencies),
    ...input.opponentGames.flatMap((game) => game.dependencies),
  ].sort(compareDependencies)
  for (const reason of validateChronologyAndDependencies(input, allDependencies)) reasons.add(reason)

  if (reasons.size > 0) {
    return {
      status: 'BLOCKED',
      canonicalGamePk: target.canonicalGamePk,
      pitcherMlbamId: target.pitcherMlbamId,
      reasons: uniqueSortedReasons(reasons),
    }
  }

  if (startSummaries.length < 5) {
    return { status: 'BLOCKED', canonicalGamePk: target.canonicalGamePk, pitcherMlbamId: target.pitcherMlbamId, reasons: ['SHORT_HISTORY'] }
  }

  const ordered = [...startSummaries].sort((a, b) => {
    const aTime = parseIsoMillis(a.start.scheduledStart) ?? 0
    const bTime = parseIsoMillis(b.start.scheduledStart) ?? 0
    return aTime - bTime || a.start.gamePk - b.start.gamePk
  })
  const latestFive = ordered.slice(-5)
  const latestStart = ordered.at(-1)
  const targetDay = canonicalDateDays(target.officialGameDate)
  const latestDay = latestStart ? canonicalDateDays(latestStart.start.officialGameDate) : null
  if (targetDay === null || latestDay === null || targetDay <= latestDay) {
    return { status: 'BLOCKED', canonicalGamePk: target.canonicalGamePk, pitcherMlbamId: target.pitcherMlbamId, reasons: ['ORDERING_AMBIGUOUS'] }
  }
  const daysRest = targetDay - latestDay

  const seasonPitchesCount = startSummaries.reduce((sum, item) => sum + item.aggregate.deliveredPitches, 0)
  const l5PitchesCount = latestFive.reduce((sum, item) => sum + item.aggregate.deliveredPitches, 0)
  const seasonBFCount = startSummaries.reduce((sum, item) => sum + item.aggregate.completedBF, 0)
  const l5BFCount = latestFive.reduce((sum, item) => sum + item.aggregate.completedBF, 0)
  const pitcherStrikeouts = startSummaries.reduce((sum, item) => sum + item.aggregate.strikeouts, 0)
  const opponentStrikeouts = opponentSummaries.reduce((sum, item) => sum + item.aggregate.strikeouts, 0)
  const opponentPA = opponentSummaries.reduce((sum, item) => sum + item.aggregate.completedBF, 0)
  const strikeCount = startSummaries.reduce((sum, item) => sum + item.aggregate.strikes, 0)
  const speedCount = startSummaries.reduce((sum, item) => sum + item.aggregate.speedCount, 0)
  let speedSum = { coefficient: 0n, scale: 0 }
  for (const item of startSummaries) speedSum = addDecimal(speedSum, item.aggregate.speedSum)

  const zeroDenominator = seasonPitchesCount <= 0 || seasonBFCount <= 0 || opponentPA <= 0 || speedCount <= 0
  if (zeroDenominator) {
    return { status: 'BLOCKED', canonicalGamePk: target.canonicalGamePk, pitcherMlbamId: target.pitcherMlbamId, reasons: ['ZERO_DENOMINATOR'] }
  }

  const seasonStarts = startSummaries.length
  const seasonPitches = roundedRatioNumber(BigInt(seasonPitchesCount), BigInt(seasonStarts))
  const l5Pitches = roundedRatioNumber(BigInt(l5PitchesCount), 5n)
  const seasonBF = roundedRatioNumber(BigInt(seasonBFCount), BigInt(seasonStarts))
  const l5BF = roundedRatioNumber(BigInt(l5BFCount), 5n)
  const pitcherKRateV2 = roundedRatioNumber(BigInt(pitcherStrikeouts), BigInt(seasonBFCount))
  const opponentKRateV2 = roundedRatioNumber(BigInt(opponentStrikeouts), BigInt(opponentPA))
  const avgReleaseSpeedV2 = roundedRatioNumber(speedSum.coefficient, BigInt(speedCount), speedSum.scale)
  const strikeRateV2 = roundedRatioNumber(BigInt(strikeCount), BigInt(seasonPitchesCount))
  if ([seasonPitches, l5Pitches, seasonBF, l5BF, pitcherKRateV2, opponentKRateV2, avgReleaseSpeedV2, strikeRateV2].some((v) => v === null)) {
    return { status: 'BLOCKED', canonicalGamePk: target.canonicalGamePk, pitcherMlbamId: target.pitcherMlbamId, reasons: ['ZERO_DENOMINATOR'] }
  }

  const authoritativeTimes = allDependencies.map((dep) => parseIsoMillis(dep.authoritativeAt)).filter((value): value is number => value !== null)
  const dataAsOfMillis = Math.max(...authoritativeTimes)
  const dataAsOf = new Date(dataAsOfMillis).toISOString()
  const sourceVersions = [...new Set(allDependencies.map((dep) => dep.sourceVersion))].sort((a, b) => a.localeCompare(b))

  const rowWithoutDigest = {
    canonicalGamePk: target.canonicalGamePk,
    pitcherMlbamId: target.pitcherMlbamId,
    targetStart: target.targetStart,
    dataAsOf,
    cutoff: target.cutoff,
    contractVersion: PE_PITCHER_K_V2_CONTRACT_VERSION,
    builderVersion: input.builderVersion,
    sourceVersions,
    dependencies: allDependencies,
    features: {
      seasonPitches: seasonPitches as number,
      l5Pitches: l5Pitches as number,
      seasonBF: seasonBF as number,
      l5BF: l5BF as number,
      daysRest,
      pitcherKRateV2: pitcherKRateV2 as number,
      opponentKRateV2: opponentKRateV2 as number,
      avgReleaseSpeedV2: avgReleaseSpeedV2 as number,
      strikeRateV2: strikeRateV2 as number,
    },
    statistics: {
      seasonStarts,
      seasonDeliveredPitches: seasonPitchesCount,
      l5DeliveredPitches: l5PitchesCount,
      seasonBFCount,
      l5BFCount,
      pitcherStrikeouts,
      opponentStrikeouts,
      opponentPA,
      speedSumMph: decimalToString(speedSum),
      speedCount,
      strikeCount,
    },
  }
  const lineageDigest = pa14V2Sha256(pa14V2CanonicalJson(rowWithoutDigest))
  return { status: 'ELIGIBLE', row: { ...rowWithoutDigest, lineageDigest } }
}

export function pePitcherKV2Envelope(
  asOf: string,
  eligible: Pa14V2EligibleRow[],
  blocked: Array<{ canonicalGamePk: number; pitcherMlbamId: number; reasons: Pa14V2BlockReason[] }>,
) {
  const data = [...eligible].sort((a, b) => a.canonicalGamePk - b.canonicalGamePk || a.pitcherMlbamId - b.pitcherMlbamId)
  const blockedRows = [...blocked]
    .map((row) => ({ ...row, reasons: uniqueSortedReasons(row.reasons) }))
    .sort((a, b) => a.canonicalGamePk - b.canonicalGamePk || a.pitcherMlbamId - b.pitcherMlbamId)
  const status = data.length > 0 ? (blockedRows.length > 0 ? 'PARTIAL' : 'OK') : blockedRows.length > 0 ? 'BLOCKED' : 'EMPTY'
  return { version: PE_PITCHER_K_V2_CONTRACT_VERSION, status, asOf, data, blocked: blockedRows }
}
