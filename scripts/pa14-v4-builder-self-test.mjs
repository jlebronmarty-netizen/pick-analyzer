import fs from 'node:fs'
import { createHash } from 'node:crypto'
import {
  buildPePitcherKV2Row,
  pa14V2CanonicalJson,
  pePitcherKV2Envelope,
  PE_PITCHER_K_V2_CONTRACT_VERSION,
} from '../src/lib/pe-pitcher-k-v2-builder.ts'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function digest(label) {
  return createHash('sha256').update(label).digest('hex')
}

const builderVersion = createHash('sha256')
  .update(fs.readFileSync('src/lib/pe-pitcher-k-v2-builder.ts'))
  .digest('hex')

function dependency(role, gamePk, pitcherMlbamId, timestamp, suffix = '') {
  return {
    role,
    canonicalGamePk: gamePk,
    pitcherMlbamId,
    sourceVersion: `fixture_${role.toLowerCase()}_v1`,
    authoritativeAt: timestamp,
    availableBy: timestamp,
    evidenceDigest: digest(`${role}:${gamePk}:${pitcherMlbamId ?? 'null'}:${suffix}`),
  }
}

function pa(gamePk, pitcherMlbamId, atBatNumber, terminalEvent, speeds = ['90.0', '90.0']) {
  const terminalStrikeout = terminalEvent === 'strikeout'
  return [
    {
      gamePk,
      atBatNumber,
      pitchNumber: 1,
      pitcherMlbamId,
      description: terminalStrikeout ? 'ball' : 'called_strike',
      type: terminalStrikeout ? 'B' : 'S',
      releaseSpeed: speeds[0],
      event: null,
    },
    {
      gamePk,
      atBatNumber,
      pitchNumber: 2,
      pitcherMlbamId,
      description: terminalStrikeout ? 'swinging_strike' : 'hit_into_play',
      type: terminalStrikeout ? 'S' : 'X',
      releaseSpeed: speeds[1],
      event: terminalEvent,
    },
  ]
}

function sourceDependencies(gamePk, pitcherMlbamId, day) {
  const timestamp = `${day}T23:00:00.000Z`
  return [
    dependency('SOURCE_GAME', gamePk, pitcherMlbamId, timestamp),
    dependency('PITCHES', gamePk, pitcherMlbamId, timestamp),
    dependency('TERMINAL', gamePk, pitcherMlbamId, timestamp),
    dependency('BOX_SCORE', gamePk, pitcherMlbamId, timestamp),
  ]
}

function opponentDependencies(gamePk, day) {
  const timestamp = `${day}T23:00:00.000Z`
  return [
    dependency('SOURCE_GAME', gamePk, null, timestamp, 'opp'),
    dependency('PITCHES', gamePk, null, timestamp, 'opp'),
    dependency('TERMINAL', gamePk, null, timestamp, 'opp'),
    dependency('BOX_SCORE', gamePk, null, timestamp, 'opp'),
  ]
}

function fixture() {
  const pitcherMlbamId = 600001
  const opponentPitcher = 600099
  const startDates = ['2026-06-01', '2026-06-05', '2026-06-09', '2026-06-13', '2026-06-17']
  const starts = startDates.map((day, index) => {
    const gamePk = 810001 + index
    return {
      gamePk,
      pitcherMlbamId,
      season: 2026,
      officialGameDate: day,
      scheduledStart: `${day}T18:00:00.000Z`,
      regularSeason: true,
      startCorroborated: true,
      completePitchCensus: true,
      authoritativeBoxScoreBF: 2,
      pitches: [
        ...pa(gamePk, pitcherMlbamId, 1, 'strikeout'),
        ...pa(gamePk, pitcherMlbamId, 2, 'field_out'),
      ],
      dependencies: sourceDependencies(gamePk, pitcherMlbamId, day),
    }
  })
  const opponentGames = startDates.map((day, index) => {
    const gamePk = 811001 + index
    return {
      gamePk,
      season: 2026,
      officialGameDate: day,
      battingTeam: 'SEA',
      regularSeason: true,
      completePitchCensus: true,
      pitches: [
        ...pa(gamePk, opponentPitcher + index, 1, 'strikeout'),
        ...pa(gamePk, opponentPitcher + index, 2, 'field_out'),
      ],
      dependencies: opponentDependencies(gamePk, day),
    }
  })
  const targetGamePk = 812000
  return {
    target: {
      canonicalGamePk: targetGamePk,
      pitcherMlbamId,
      opponentTeam: 'SEA',
      season: 2026,
      officialGameDate: '2026-06-20',
      targetStart: '2026-06-20T22:00:00.000Z',
      cutoff: '2026-06-19T18:00:00.000Z',
      starterStateValid: true,
      scheduleDependency: dependency('SCHEDULE', targetGamePk, null, '2026-06-19T16:00:00.000Z'),
      starterDependency: dependency('STARTER', targetGamePk, pitcherMlbamId, '2026-06-19T17:00:00.000Z'),
    },
    census: {
      qualifyingStartGamePks: starts.map((row) => row.gamePk),
      opponentGamePks: opponentGames.map((row) => row.gamePk),
      complete: true,
      dependency: dependency('CENSUS', targetGamePk, null, '2026-06-19T15:00:00.000Z'),
    },
    starts,
    opponentGames,
    builderVersion,
  }
}

const base = fixture()
const first = buildPePitcherKV2Row(base)
assert(first.status === 'ELIGIBLE', `normal fixture blocked: ${first.status === 'BLOCKED' ? first.reasons.join(',') : ''}`)
if (first.status !== 'ELIGIBLE') process.exit(1)
assert(first.row.contractVersion === PE_PITCHER_K_V2_CONTRACT_VERSION, 'contract version mismatch')
assert(first.row.features.seasonPitches === 4, 'seasonPitches mismatch')
assert(first.row.features.l5Pitches === 4, 'l5Pitches mismatch')
assert(first.row.features.seasonBF === 2, 'seasonBF mismatch')
assert(first.row.features.l5BF === 2, 'l5BF mismatch')
assert(first.row.features.daysRest === 3, 'daysRest mismatch')
assert(first.row.features.pitcherKRateV2 === 0.5, 'pitcherKRateV2 mismatch')
assert(first.row.features.opponentKRateV2 === 0.5, 'opponentKRateV2 mismatch')
assert(first.row.features.avgReleaseSpeedV2 === 90, 'avgReleaseSpeedV2 mismatch')
assert(first.row.features.strikeRateV2 === 0.5, 'strikeRateV2 mismatch')
assert(first.row.statistics.seasonStarts === 5, 'seasonStarts mismatch')
assert(first.row.statistics.seasonDeliveredPitches === 20, 'pitch count mismatch')
assert(first.row.statistics.seasonBFCount === 10, 'BF count mismatch')
assert(first.row.statistics.pitcherStrikeouts === 5, 'pitcher K count mismatch')
assert(first.row.statistics.opponentStrikeouts === 5, 'opponent K count mismatch')
assert(first.row.statistics.opponentPA === 10, 'opponent PA count mismatch')
assert(first.row.statistics.speedSumMph === '1800', 'speed sum mismatch')
assert(first.row.statistics.speedCount === 20, 'speed count mismatch')
assert(first.row.statistics.strikeCount === 10, 'strike count mismatch')
assert(first.row.dataAsOf === '2026-06-19T17:00:00.000Z', 'dataAsOf must be latest authoritative dependency')

const replay = buildPePitcherKV2Row(structuredClone(base))
assert(replay.status === 'ELIGIBLE', 'replay unexpectedly blocked')
assert(pa14V2CanonicalJson(replay) === pa14V2CanonicalJson(first), 'deterministic replay mismatch')
assert(replay.status === 'ELIGIBLE' && replay.row.lineageDigest === first.row.lineageDigest, 'lineage digest mismatch')

const conflict = structuredClone(base)
conflict.starts[0].pitches[1].type = 'X'
const conflictResult = buildPePitcherKV2Row(conflict)
assert(conflictResult.status === 'BLOCKED' && conflictResult.reasons.includes('STRIKE_TYPE_CONFLICT'), 'strike collision must block')

const missingSpeed = structuredClone(base)
missingSpeed.starts[0].pitches[0].releaseSpeed = null
const missingSpeedResult = buildPePitcherKV2Row(missingSpeed)
assert(missingSpeedResult.status === 'BLOCKED' && missingSpeedResult.reasons.includes('MISSING_VELOCITY'), 'missing speed must block')

const bfMismatch = structuredClone(base)
bfMismatch.starts[0].authoritativeBoxScoreBF = 3
const bfMismatchResult = buildPePitcherKV2Row(bfMismatch)
assert(bfMismatchResult.status === 'BLOCKED' && bfMismatchResult.reasons.includes('BF_UNRECONCILED'), 'BF mismatch must block')

const shortHistory = structuredClone(base)
shortHistory.starts = shortHistory.starts.slice(0, 4)
shortHistory.census.qualifyingStartGamePks = shortHistory.starts.map((row) => row.gamePk)
const shortHistoryResult = buildPePitcherKV2Row(shortHistory)
assert(shortHistoryResult.status === 'BLOCKED' && shortHistoryResult.reasons.includes('SHORT_HISTORY'), 'short history must block')

const temporal = structuredClone(base)
temporal.target.starterDependency.authoritativeAt = '2026-06-19T19:00:00.000Z'
temporal.target.starterDependency.availableBy = '2026-06-19T19:00:00.000Z'
const temporalResult = buildPePitcherKV2Row(temporal)
assert(temporalResult.status === 'BLOCKED' && temporalResult.reasons.includes('CUTOFF_VIOLATION'), 'post-cutoff evidence must block')

const incompletePa = structuredClone(base)
incompletePa.starts[0].pitches[1].event = null
const incompletePaResult = buildPePitcherKV2Row(incompletePa)
assert(incompletePaResult.status === 'BLOCKED' && incompletePaResult.reasons.includes('INCOMPLETE_PA'), 'unfinished PA without witness must block')

const witnessedPa = structuredClone(base)
witnessedPa.starts[0].pitches[1].event = null
witnessedPa.starts[0].unfinishedPaAtBatNumbers = [1]
witnessedPa.starts[0].authoritativeBoxScoreBF = 1
const witnessedResult = buildPePitcherKV2Row(witnessedPa)
assert(witnessedResult.status === 'ELIGIBLE', `witnessed unfinished PA should be handled: ${witnessedResult.status === 'BLOCKED' ? witnessedResult.reasons.join(',') : ''}`)

const envelope = pePitcherKV2Envelope('2026-06-19T18:00:00.000Z', [first.row], [
  { canonicalGamePk: 812001, pitcherMlbamId: 600002, reasons: ['SHORT_HISTORY'] },
])
assert(envelope.status === 'PARTIAL', 'envelope PARTIAL status mismatch')
assert(envelope.data.length === 1 && envelope.blocked.length === 1, 'envelope cardinality mismatch')

console.log(JSON.stringify({
  certification: 'PA14_V2_BUILDER_SELF_TEST_PASS',
  contractVersion: PE_PITCHER_K_V2_CONTRACT_VERSION,
  builderVersion,
  checks: 31,
  normalLineageDigest: first.row.lineageDigest,
}, null, 2))
