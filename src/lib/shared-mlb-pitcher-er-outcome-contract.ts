export const SHARED_MLB_PITCHER_ER_OUTCOME_VERSION = 'SHARED_MLB_PITCHER_ER_OUTCOME_V1'

const CANONICAL_PREFIX = 'retrosheet:mlb:game:'
const ALLOWED_MAPPING_METHODS = new Set(['NORMALIZED_EXACT_NAME', 'EXPLICIT_TEAM_DATE_NAME_EXCEPTION'])

function positiveInteger(value: unknown) {
  return Number.isSafeInteger(value) && Number(value) > 0 ? Number(value) : null
}

function nonNegativeInteger(value: unknown) {
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : null
}

function parsedNonNegativeInteger(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null
}

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function sha256(value: unknown) {
  const candidate = text(value)
  return candidate && /^[a-f0-9]{64}$/.test(candidate) ? candidate : null
}

export type PitcherErMappingRow = Readonly<{
  canonical_game_id: unknown
  target_game_pk: unknown
  game_date: unknown
  pitcher_source_id: unknown
  mlbam_pitcher_id: unknown
  pitcher_name: unknown
  mapping_method: unknown
  target_outs: unknown
  fixed_split: unknown
}>

export type PitcherErRawRow = Readonly<{
  id: unknown
  source_filename: unknown
  source_line: unknown
  game_reference: unknown
  parsed_fields: unknown
  parser_version: unknown
  checksum_sha256: unknown
  historical_only: unknown
  postgame_known: unknown
  training_eligible: unknown
  pregame_eligible: unknown
  validation_status: unknown
}>

export function retrosheetGameReference(canonicalGameId: unknown) {
  const value = text(canonicalGameId)
  return value?.startsWith(CANONICAL_PREFIX) ? value.slice(CANONICAL_PREFIX.length) : null
}

export function pitcherErRawKey(row: PitcherErRawRow) {
  if (!Array.isArray(row.parsed_fields)) return null
  const gameReference = text(row.game_reference)
  const recordType = text(row.parsed_fields[0])
  const statType = text(row.parsed_fields[1])
  const pitcherSourceId = text(row.parsed_fields[2])
  if (!gameReference || recordType !== 'data' || statType !== 'er' || !pitcherSourceId) return null
  return `${gameReference}|${pitcherSourceId}`
}

export function readPitcherErOutcome(mapping: PitcherErMappingRow, raw: PitcherErRawRow) {
  const canonicalGameId = text(mapping.canonical_game_id)
  const gameReference = retrosheetGameReference(canonicalGameId)
  const pitcherSourceId = text(mapping.pitcher_source_id)
  const canonicalGamePk = positiveInteger(mapping.target_game_pk)
  const pitcherMlbamId = positiveInteger(mapping.mlbam_pitcher_id)
  const pitcherName = text(mapping.pitcher_name)
  const mappingMethod = text(mapping.mapping_method)
  const gameDate = text(mapping.game_date)
  const starterOuts = nonNegativeInteger(mapping.target_outs)
  const fixedSplit = text(mapping.fixed_split)

  if (!canonicalGameId || !gameReference || !pitcherSourceId || !canonicalGamePk || !pitcherMlbamId || !pitcherName || !gameDate || starterOuts === null) return null
  if (!mappingMethod || !ALLOWED_MAPPING_METHODS.has(mappingMethod)) return null
  if (!['TRAIN', 'VALIDATION', 'TEST'].includes(fixedSplit ?? '')) return null

  if (pitcherErRawKey(raw) !== `${gameReference}|${pitcherSourceId}`) return null
  if (!Array.isArray(raw.parsed_fields)) return null
  const observedEarnedRuns = parsedNonNegativeInteger(raw.parsed_fields[3])
  const recordId = text(raw.id)
  const sourceFilename = text(raw.source_filename)
  const sourceLine = positiveInteger(raw.source_line)
  const parserVersion = text(raw.parser_version)
  const checksumSha256 = sha256(raw.checksum_sha256)
  const validationStatus = text(raw.validation_status)
  if (observedEarnedRuns === null || !recordId || !sourceFilename || !sourceLine || !parserVersion || !checksumSha256) return null
  if (raw.historical_only !== true || raw.postgame_known !== true || raw.pregame_eligible !== false || raw.training_eligible !== false || validationStatus !== 'parsed') return null

  const researchOutcomeEligible = starterOuts > 0
  return Object.freeze({
    canonicalGamePk,
    pitcherMlbamId,
    gameDate,
    pitcherName,
    observedEarnedRuns,
    starterOuts,
    identityMappingMethod: mappingMethod,
    researchOutcomeEligible,
    researchOutcomeEligibilityReason: researchOutcomeEligible ? 'EXACT_POSTGAME_ER_STARTER_WITH_POSITIVE_OUTS' : 'ZERO_OUT_START_EXCLUDED_FROM_RESEARCH_MODELING',
    fixedSplit,
    source: 'retrosheet_data_er',
    sourceHistoricalOnly: true,
    sourcePostgameKnown: true,
    sourceTrainingEligible: false,
    sourcePregameEligible: false,
    sourceValidationStatus: validationStatus,
    sourceLineage: Object.freeze({
      canonicalGameId,
      retrosheetGameReference: gameReference,
      retrosheetPitcherSourceId: pitcherSourceId,
      recordId,
      sourceFilename,
      sourceLine,
      parserVersion,
      checksumSha256,
    }),
    eligibilityScope: 'OUTCOME_LABEL_ONLY_NOT_PREGAME_FEATURE_ADMISSION',
  })
}
