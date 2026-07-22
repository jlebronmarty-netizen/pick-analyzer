import 'server-only'

import { getCurrentBoard, type CurrentBoardCandidate } from '@/services/current-board.service'

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits))
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function complementProbability(candidate: CurrentBoardCandidate | undefined, side: 'home' | 'away') {
  if (!candidate) return null
  const [away = '', home = ''] = candidate.matchup.split(' @ ')
  const selected = candidate.selection.toLowerCase()
  const probability = clamp(Number(candidate.rawProbability ?? 0), 0, 100)
  if (side === 'home') {
    if (selected === home.toLowerCase() || selected === 'home') return probability
    if (selected === away.toLowerCase() || selected === 'away') return 100 - probability
  }
  if (selected === away.toLowerCase() || selected === 'away') return probability
  if (selected === home.toLowerCase() || selected === 'home') return 100 - probability
  return null
}

function totalExpectation(candidate: CurrentBoardCandidate | undefined) {
  if (!candidate || candidate.line === null) return null
  const probability = clamp(Number(candidate.rawProbability ?? 50), 0, 100)
  const selected = candidate.selection.toLowerCase()
  const directionalLean = selected.includes('under') ? 50 - probability : probability - 50
  return round(clamp(candidate.line + directionalLean / 8, 1, 30), 2)
}

function runDifferential(homeWinProbability: number | null, spreadCandidate: CurrentBoardCandidate | undefined) {
  if (homeWinProbability !== null) return round(clamp((homeWinProbability - 50) / 9, -6, 6), 2)
  if (!spreadCandidate || spreadCandidate.line === null) return 0
  const [away = '', home = ''] = spreadCandidate.matchup.split(' @ ')
  const selected = spreadCandidate.selection.toLowerCase()
  const selectedIsHome = selected === home.toLowerCase() || selected === 'home'
  const selectedIsAway = selected === away.toLowerCase() || selected === 'away'
  if (!selectedIsHome && !selectedIsAway) return 0
  const probability = clamp(Number(spreadCandidate.rawProbability ?? 50), 0, 100)
  const selectedDiff = -spreadCandidate.line + (probability - 50) / 12
  return round(clamp(selectedIsHome ? selectedDiff : -selectedDiff, -6, 6), 2)
}

function projectGame(candidates: CurrentBoardCandidate[]) {
  const first = candidates[0]
  const [awayTeam = 'Away', homeTeam = 'Home'] = first.matchup.split(' @ ')
  const moneyline = candidates.find((candidate) => candidate.market === 'moneyline')
  const total = candidates.find((candidate) => candidate.market === 'total')
  const spread = candidates.find((candidate) => candidate.market === 'spread')
  const homeWinProbability = complementProbability(moneyline, 'home')
  const awayWinProbability = complementProbability(moneyline, 'away')
  const expectedTotal = totalExpectation(total) ?? 8.5
  const differential = runDifferential(homeWinProbability, spread)
  const homeRuns = round(clamp((expectedTotal + differential) / 2, 0, 20), 2)
  const awayRuns = round(clamp(expectedTotal - homeRuns, 0, 20), 2)
  const confidence = round(
    candidates.reduce((sum, candidate) => sum + Number(candidate.confidence ?? 0), 0) / Math.max(1, candidates.length)
  )
  const featureQuality = round(
    candidates.reduce((sum, candidate) => sum + Number(candidate.featureQuality ?? 0), 0) / Math.max(1, candidates.length)
  )
  return {
    eventId: first.eventId,
    matchup: first.matchup,
    scheduledTime: first.scheduledTime,
    awayTeam,
    homeTeam,
    projectedAwayRuns: awayRuns,
    projectedHomeRuns: homeRuns,
    expectedTotalRuns: round(expectedTotal),
    projectedRunDifferentialHome: differential,
    projectedRuns: {
      away: awayRuns,
      home: homeRuns,
      expectedTotal: round(expectedTotal),
      runDifferentialHome: differential,
    },
    expectedWinner: homeRuns >= awayRuns ? homeTeam : awayTeam,
    winProbability: {
      home: homeWinProbability === null ? null : round(homeWinProbability),
      away: awayWinProbability === null ? null : round(awayWinProbability),
      source: moneyline ? 'moneyline_binary_complement' : 'unavailable',
    },
    confidence,
    variance: round(Math.max(1.5, 6 - confidence / 20), 2),
    quality: {
      featureQuality,
      dataSufficiency: round(candidates.reduce((sum, candidate) => sum + Number(candidate.dataSufficiency ?? 0), 0) / Math.max(1, candidates.length)),
      freshness: first.stale ? 'stale' : 'current_board_selected_market',
    },
    inputs: {
      moneylinePredictionId: moneyline?.predictionId ?? null,
      totalPredictionId: total?.predictionId ?? null,
      spreadPredictionId: spread?.predictionId ?? null,
      oddsSnapshotIds: candidates.map((candidate) => candidate.oddsSnapshotId).filter(Boolean),
    },
    warning: 'Projected score is an approximate game-level orientation derived from stored moneyline, total and run-line candidates. It is not an Official Pick.',
  }
}

export async function getMlbProjectedScores() {
  const board = await getCurrentBoard({ sportKey: 'baseball_mlb', mode: 'CURRENT', limit: 200, includeMlbContext: true })
  const byEvent = new Map<string, CurrentBoardCandidate[]>()
  for (const candidate of board.candidates) {
    const rows = byEvent.get(candidate.eventId) ?? []
    rows.push(candidate)
    byEvent.set(candidate.eventId, rows)
  }
  const games = Array.from(byEvent.values()).map(projectGame)
  return {
    success: true,
    mode: 'mlb_projected_score_engine_v1',
    generatedAt: new Date().toISOString(),
    slateDate: board.slateDate,
    games,
    summary: {
      gamesProjected: games.length,
      sourceCandidates: board.candidates.length,
      currentBoardFreshness: board.dataFreshness.status,
      officialPickCount: board.officialPickCount,
    },
    guardrails: {
      providerCallsMade: 0,
      remoteMutationsMade: 0,
      predictionRowsMutated: false,
      officialPolicyChanged: false,
      fabricatedInputs: false,
    },
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}

export function validateMlbProjectedScoreFixtures() {
  const checks = [
    ['rounds deterministically', round(8.126, 2) === 8.13],
    ['clamps low run total', clamp(-1, 0, 20) === 0],
    ['clamps high probability', clamp(120, 0, 100) === 100],
    ['projects top-level runs', Number.isFinite(projectGame([{
      eventId: 'fixture',
      predictionId: 'fixture-prediction',
      oddsSnapshotId: 'fixture-odds',
      matchup: 'AWY @ HOM',
      scheduledTime: new Date().toISOString(),
      market: 'total',
      selection: 'Over',
      line: 8.5,
      stale: false,
      rawProbability: 55,
      confidence: 40,
      featureQuality: 70,
      dataSufficiency: 70,
    } as unknown as CurrentBoardCandidate]).projectedAwayRuns)],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'mlb_projected_score_validation_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
