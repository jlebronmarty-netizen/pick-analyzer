import assert from 'node:assert/strict'
import {
  SHARED_MLB_PITCHER_ER_OUTCOME_VERSION,
  pitcherErRawKey,
  readPitcherErOutcome,
  retrosheetGameReference,
} from '../src/lib/shared-mlb-pitcher-er-outcome-contract.ts'

const checksum = 'a'.repeat(64)
const mapping = {
  canonical_game_id: 'retrosheet:mlb:game:NYA202504010',
  target_game_pk: 777001,
  game_date: '2025-04-01',
  pitcher_source_id: 'pitch001',
  mlbam_pitcher_id: 600001,
  pitcher_name: 'Example Pitcher',
  mapping_method: 'NORMALIZED_EXACT_NAME',
  target_outs: 18,
  fixed_split: 'TRAIN',
}
const raw = {
  id: 'retrosheet:2025:data-er:1',
  source_filename: '2025eve.zip',
  source_line: 123,
  game_reference: 'NYA202504010',
  parsed_fields: ['data', 'er', 'pitch001', '2'],
  parser_version: 'RETROSHEET_V1',
  checksum_sha256: checksum,
  historical_only: true,
  postgame_known: true,
  training_eligible: false,
  pregame_eligible: false,
  validation_status: 'parsed',
}

assert.equal(SHARED_MLB_PITCHER_ER_OUTCOME_VERSION, 'SHARED_MLB_PITCHER_ER_OUTCOME_V1')
assert.equal(retrosheetGameReference(mapping.canonical_game_id), 'NYA202504010')
assert.equal(pitcherErRawKey(raw), 'NYA202504010|pitch001')

const row = readPitcherErOutcome(mapping, raw)
assert.ok(row)
assert.equal(row.canonicalGamePk, 777001)
assert.equal(row.pitcherMlbamId, 600001)
assert.equal(row.observedEarnedRuns, 2)
assert.equal(row.starterOuts, 18)
assert.equal(row.identityMappingMethod, 'NORMALIZED_EXACT_NAME')
assert.equal(row.researchOutcomeEligible, true)
assert.equal(row.sourceHistoricalOnly, true)
assert.equal(row.sourcePostgameKnown, true)
assert.equal(row.sourceTrainingEligible, false)
assert.equal(row.sourcePregameEligible, false)
assert.equal(row.sourceLineage.checksumSha256, checksum)
assert.equal(row.eligibilityScope, 'OUTCOME_LABEL_ONLY_NOT_PREGAME_FEATURE_ADMISSION')

const zeroOut = readPitcherErOutcome({ ...mapping, target_outs: 0 }, raw)
assert.ok(zeroOut)
assert.equal(zeroOut.researchOutcomeEligible, false)
assert.equal(zeroOut.researchOutcomeEligibilityReason, 'ZERO_OUT_START_EXCLUDED_FROM_RESEARCH_MODELING')

const explicitException = readPitcherErOutcome({ ...mapping, mapping_method: 'EXPLICIT_TEAM_DATE_NAME_EXCEPTION' }, raw)
assert.ok(explicitException)
assert.equal(explicitException.identityMappingMethod, 'EXPLICIT_TEAM_DATE_NAME_EXCEPTION')

assert.equal(readPitcherErOutcome({ ...mapping, mapping_method: 'FUZZY_NAME' }, raw), null)
assert.equal(readPitcherErOutcome({ ...mapping, target_game_pk: null }, raw), null)
assert.equal(readPitcherErOutcome({ ...mapping, mlbam_pitcher_id: null }, raw), null)
assert.equal(readPitcherErOutcome(mapping, { ...raw, game_reference: 'OTHER' }), null)
assert.equal(readPitcherErOutcome(mapping, { ...raw, parsed_fields: ['data', 'er', 'pitch001', null] }), null)
assert.equal(readPitcherErOutcome(mapping, { ...raw, parsed_fields: ['data', 'er', 'pitch001', '-1'] }), null)
assert.equal(readPitcherErOutcome(mapping, { ...raw, checksum_sha256: 'bad' }), null)
assert.equal(readPitcherErOutcome(mapping, { ...raw, postgame_known: false }), null)
assert.equal(readPitcherErOutcome(mapping, { ...raw, training_eligible: true }), null)
assert.equal(readPitcherErOutcome(mapping, { ...raw, pregame_eligible: true }), null)
assert.equal(readPitcherErOutcome(mapping, { ...raw, validation_status: 'invalid' }), null)

console.log('PA-12 exact Pitcher Earned Runs outcome contract: PASS')
