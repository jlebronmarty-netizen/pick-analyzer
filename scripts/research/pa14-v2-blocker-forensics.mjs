#!/usr/bin/env node

const EXPECTED_BRANCH = 'research/pa14-v2-blocker-forensics-20260917'
if (
  process.env.VERCEL !== '1' ||
  process.env.VERCEL_ENV !== 'preview' ||
  process.env.VERCEL_GIT_COMMIT_REF !== EXPECTED_BRANCH
) {
  console.log(JSON.stringify({ status: 'PA14_V2_BLOCKER_FORENSICS_SKIPPED_NOT_EXACT_PREVIEW_BRANCH' }))
  process.exit(0)
}

const { auditHistoricalPa14V2Target } = await import('../../src/services/pa14-v2-historical-yield-audit.service.ts')

const REQUIRED_TYPE_BY_DESCRIPTION = new Map([
  ['called_strike', 'S'], ['swinging_strike', 'S'], ['swinging_strike_blocked', 'S'],
  ['foul', 'S'], ['foul_tip', 'S'], ['foul_bunt', 'S'], ['missed_bunt', 'S'],
  ['bunt_foul_tip', 'S'], ['swinging_pitchout', 'S'], ['foul_pitchout', 'S'],
  ['ball', 'B'], ['blocked_ball', 'B'], ['pitchout', 'B'], ['hit_by_pitch', 'B'],
  ['intentional_ball', 'B'], ['hit_into_play', 'X'], ['hit_into_play_no_out', 'X'],
  ['hit_into_play_score', 'X'], ['automatic_ball', 'B'], ['automatic_strike', 'S'],
])

const AUTO = new Set(['automatic_ball', 'automatic_strike'])

function perGameDiagnostics(game, role) {
  const reasons = new Set()
  const details = {
    role,
    gamePk: game.gamePk,
    pitchRows: game.pitches?.length ?? 0,
    terminalOnlyPas: game.terminalOnlyPas?.length ?? 0,
    unfinishedPaAtBatNumbers: game.unfinishedPaAtBatNumbers ?? [],
    multiPitcherPas: [],
    zeroTerminalPasNotWitnessed: [],
    multiTerminalPas: [],
    unfinishedWithoutPitchRows: [],
    missingVelocity: [],
    strikeTypeConflicts: [],
    sourceVocabularyInvalid: [],
  }

  const byPa = new Map()
  for (const pitch of game.pitches ?? []) {
    const rows = byPa.get(pitch.atBatNumber) ?? []
    rows.push(pitch)
    byPa.set(pitch.atBatNumber, rows)

    if (pitch.description == null || pitch.type == null || !REQUIRED_TYPE_BY_DESCRIPTION.has(pitch.description)) {
      details.sourceVocabularyInvalid.push({
        atBatNumber: pitch.atBatNumber,
        pitchNumber: pitch.pitchNumber,
        description: pitch.description,
        type: pitch.type,
      })
      reasons.add('SOURCE_VOCABULARY_INVALID')
      continue
    }
    const expectedType = REQUIRED_TYPE_BY_DESCRIPTION.get(pitch.description)
    if (pitch.type !== expectedType) {
      details.strikeTypeConflicts.push({
        atBatNumber: pitch.atBatNumber,
        pitchNumber: pitch.pitchNumber,
        description: pitch.description,
        type: pitch.type,
        expectedType,
      })
      reasons.add('STRIKE_TYPE_CONFLICT')
    }
    if (!AUTO.has(pitch.description) && (pitch.releaseSpeed == null || !Number.isFinite(Number(pitch.releaseSpeed)))) {
      details.missingVelocity.push({
        atBatNumber: pitch.atBatNumber,
        pitchNumber: pitch.pitchNumber,
        description: pitch.description,
      })
      reasons.add('MISSING_VELOCITY')
    }
  }

  const unfinished = new Set(game.unfinishedPaAtBatNumbers ?? [])
  for (const [atBatNumber, rows] of byPa) {
    const pitcherIds = [...new Set(rows.map((row) => row.pitcherMlbamId))]
    if (pitcherIds.length !== 1) {
      details.multiPitcherPas.push({ atBatNumber, pitcherIds })
      reasons.add('INCOMPLETE_PA')
    }
    const terminals = rows.filter((row) => row.event != null && row.event !== '')
    if (terminals.length === 0 && !unfinished.has(atBatNumber)) {
      details.zeroTerminalPasNotWitnessed.push({ atBatNumber })
      reasons.add('INCOMPLETE_PA')
    }
    if (terminals.length > 1) {
      details.multiTerminalPas.push({
        atBatNumber,
        terminals: terminals.map((row) => ({ pitchNumber: row.pitchNumber, event: row.event })),
      })
      reasons.add('INCOMPLETE_PA')
    }
  }
  for (const atBatNumber of unfinished) {
    if (!byPa.has(atBatNumber)) {
      details.unfinishedWithoutPitchRows.push(atBatNumber)
      reasons.add('INCOMPLETE_PA')
    }
  }
  details.reasons = [...reasons].sort()
  return details
}

const targets = [
  { canonicalGamePk: 776184, expectedPitcherIds: [607074, 663436], targetPitcherId: 607074 },
  { canonicalGamePk: 776184, expectedPitcherIds: [607074, 663436], targetPitcherId: 663436 },
  { canonicalGamePk: 776410, expectedPitcherIds: [676979, 806960], targetPitcherId: 676979 },
  { canonicalGamePk: 776372, expectedPitcherIds: [670912, 700249], targetPitcherId: 670912 },
]

for (const target of targets) {
  try {
    const evidence = await auditHistoricalPa14V2Target(target)
    const input = evidence.storedInput
    const startDiagnostics = (input.starts ?? []).map((row) => perGameDiagnostics(row, 'START'))
      .filter((row) => row.reasons.length > 0)
    const opponentDiagnostics = (input.opponentGames ?? []).map((row) => perGameDiagnostics(row, 'OPPONENT'))
      .filter((row) => row.reasons.length > 0)
    console.log('PA14_V2_BLOCKER_FORENSICS=' + JSON.stringify({
      target: evidence.target,
      builderStatus: evidence.result.status,
      builderReasons: evidence.result.status === 'BLOCKED' ? evidence.result.reasons : [],
      problematicStarts: startDiagnostics,
      problematicOpponentGames: opponentDiagnostics,
      counts: {
        starts: input.starts?.length ?? 0,
        opponentGames: input.opponentGames?.length ?? 0,
        problematicStarts: startDiagnostics.length,
        problematicOpponentGames: opponentDiagnostics.length,
      },
      researchOnly: true,
      supabaseWrites: 0,
      sportsbookCalls: 0,
      modelTrainingAuthorized: false,
    }))
  } catch (error) {
    console.log('PA14_V2_BLOCKER_FORENSICS_ERROR=' + JSON.stringify({
      target,
      error: error instanceof Error ? error.message : String(error),
      researchOnly: true,
      supabaseWrites: 0,
    }))
  }
}
