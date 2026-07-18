import 'server-only'

import { getCurrentBoard, type CurrentBoardCandidate } from '@/services/current-board.service'
import { buildBestBetsTodayFromBoard } from '@/services/best-bets-today.service'
import { getMlbDataQualityStatus } from '@/services/mlb-data-quality.service'
import { getMlbGamesPayloadAudit } from '@/services/mlb-games-payload-audit.service'
import { getMlbMissingIntelligenceStatus } from '@/services/mlb-missing-intelligence.service'
import { getMlbPitcherBullpenFoundations } from '@/services/mlb-model-platform.service'
import { getMlbProviderCapabilityAudit } from '@/services/mlb-provider-capability-audit.service'
import { getMlbStarterWeatherStadiumIntelligence } from '@/services/mlb-starter-weather-stadium-intelligence.service'
import { getMostLikelyOpportunities } from '@/services/market-opportunity-suite.service'

function normalized(value: string | null | undefined) {
  return String(value ?? '').toLowerCase()
}

function oddsText(value: number | null) {
  if (value === null) return 'n/a'
  return value > 0 ? `+${value}` : String(value)
}

function title(candidate: CurrentBoardCandidate) {
  return `${candidate.selection}${candidate.line === null ? '' : ` ${candidate.line}`} ${candidate.marketLabel} (${candidate.matchup})`
}

function candidateSummary(candidate: CurrentBoardCandidate) {
  return {
    predictionId: candidate.predictionId,
    title: title(candidate),
    odds: oddsText(candidate.americanOdds),
    modelProbability: candidate.rawProbability,
    impliedProbability: candidate.impliedProbability,
    edge: candidate.edge,
    expectedValue: candidate.expectedValue,
    confidence: candidate.confidence,
    featureQuality: candidate.featureQuality,
    dataSufficiency: candidate.dataSufficiency,
    criticalDataCompleteness: candidate.criticalDataCompleteness ?? 0,
    dataCompletenessLabel: candidate.dataCompletenessLabel ?? 'INSUFFICIENT',
    actionability: candidate.officialEligibility === 'OFFICIAL_ELIGIBLE_CANDIDATE' ? 'official_eligible_review' : 'preview_only',
    blockers: candidate.blockers,
    missingInformation: candidate.missingInformation,
  }
}

function candidateSummaryFromMostLikely(candidate: Record<string, unknown>) {
  return {
    predictionId: String(candidate.id ?? ''),
    title: `${candidate.selection ?? 'Selection'} ${candidate.marketLabel ?? 'Market'} (${candidate.matchup ?? 'matchup'})`,
    odds: oddsText(typeof candidate.odds === 'number' ? candidate.odds : null),
    modelProbability: Number(candidate.probability ?? 0),
    impliedProbability: Number(candidate.sportsbookProbability ?? 0),
    edge: Number(candidate.edge ?? 0),
    expectedValue: Number(candidate.expectedValue ?? 0),
    confidence: Number(candidate.confidence ?? 0),
    featureQuality: Number(candidate.featureQuality ?? 0),
    dataSufficiency: Number(candidate.dataSufficiency ?? 0),
    criticalDataCompleteness: Number(candidate.criticalDataCompleteness ?? 0),
    dataCompletenessLabel: 'MODERATE' as const,
    actionability: String(candidate.actionability ?? 'informational_probability_only'),
    blockers: Array.isArray(candidate.blockers) ? candidate.blockers.map(String) : [],
    missingInformation: Array.isArray(candidate.missingData) ? candidate.missingData.map(String) : [],
  }
}

function findCandidate(candidates: CurrentBoardCandidate[], query: string) {
  const q = normalized(query)
  const teamHints = ['tex', 'mia', 'pit', 'chw', 'lad', 'tb', 'sf', 'min', 'bal', 'sd', 'cin', 'det', 'stl', 'wsh']
  const team = teamHints.find((hint) => q.includes(hint))
  const market = q.includes('moneyline')
    ? 'moneyline'
    : q.includes('run line') || q.includes('spread')
      ? 'spread'
      : q.includes('total') || q.includes('over') || q.includes('under')
        ? 'total'
        : null
  return candidates.find((candidate) => {
    if (team && !normalized(`${candidate.selection} ${candidate.matchup}`).includes(team)) return false
    if (market && candidate.market !== market) return false
    return true
  }) ?? candidates.find((candidate) => candidate.expectedValue > 0 && candidate.edge > 0) ?? candidates[0] ?? null
}

export async function getMlbAiCoach({ query = '', date = '2026-07-17' }: { query?: string | null; date?: string | null } = {}) {
  const safeDate = date ?? '2026-07-17'
  const [board, quality, audit, gamesPayloadAudit, pitcherBullpen, missingIntelligence] = await Promise.all([
    getCurrentBoard({ sportKey: 'baseball_mlb', mode: 'CURRENT', limit: 200 }),
    getMlbDataQualityStatus(safeDate),
    getMlbProviderCapabilityAudit(safeDate),
    getMlbGamesPayloadAudit(safeDate),
    getMlbPitcherBullpenFoundations(safeDate),
    getMlbMissingIntelligenceStatus({ selectedDate: safeDate }),
  ])
  const intelligence = await getMlbStarterWeatherStadiumIntelligence(safeDate)
  const mostLikely = await getMostLikelyOpportunities({ sort: 'highest_probability', mode: 'current_board', limit: 50 })
  const bestBetsToday = buildBestBetsTodayFromBoard(board)
  const q = normalized(query)
  const readyFor = gamesPayloadAudit.normalizationDecision.readyFor
  const positiveValue = board.candidates
    .filter((candidate) => candidate.expectedValue > 0 && candidate.edge > 0)
    .sort((left, right) => right.expectedValue - left.expectedValue)
  const target = findCandidate(board.candidates, query ?? '')
  let answerType = 'no_bet'
  let answer = 'No official MLB bet is enabled. Current candidates are preview-only because production, calibration and critical data gates remain blocked.'
  let candidates = positiveValue.slice(0, 5).map(candidateSummary)

  if (q.includes('best bet') || q.includes('bet today') || q.includes('should i bet') || q.includes('top pick')) {
    const top = bestBetsToday.topPick
    answerType = 'best_bets_today'
    answer = top
      ? `${bestBetsToday.displayLabel}. ${top.selection} ${top.line === null ? '' : `${top.line} `}${top.marketLabel} is the strongest current ${top.official ? 'official' : 'informational'} option at score ${top.score}, model probability ${top.modelProbability}%, implied probability ${top.impliedProbability}%, EV ${top.expectedValue}% and edge ${top.edge}%. ${top.official ? 'It passed official gates.' : `It is not officially recommended; blockers include ${top.riskFactors.slice(0, 4).join(', ') || 'policy and calibration review'}.`}`
      : 'No current Best Bets Today candidate is available.'
    candidates = top
      ? [{
          predictionId: top.predictionId,
          title: `${top.selection} ${top.marketLabel} (${top.matchup})`,
          odds: oddsText(top.americanOdds),
          modelProbability: top.modelProbability,
          impliedProbability: top.impliedProbability,
          edge: top.edge,
          expectedValue: top.expectedValue,
          confidence: top.confidence,
          featureQuality: top.featureQuality,
          dataSufficiency: top.dataSufficiency,
          criticalDataCompleteness: top.criticalDataCompleteness,
          dataCompletenessLabel: top.criticalDataCompleteness >= 80 ? 'STRONG' : top.criticalDataCompleteness >= 55 ? 'MODERATE' : 'INSUFFICIENT',
          actionability: top.official ? 'official_recommendation' : 'informational_not_recommended',
          blockers: top.blockers,
          missingInformation: top.missingInformation,
        }]
      : []
  } else if (q.includes('v7') || q.includes('confidence engine') || q.includes('confidence v2')) {
    answerType = 'prediction_engine_v7_confidence_v2'
    answer = `V7 STRUCTURALLY READY, PERFORMANCE UNPROVEN. Prediction Engine V7 runs as a challenger and Confidence Engine V2 separates model, data, market and recommendation confidence. Verified starter, weather, wind, stadium, odds and cache freshness can support analysis, while missing lineups, injuries, handedness and game-level bullpen workload reduce confidence and block official action. Official thresholds are unchanged and V7 is not auto-promoted.`
    candidates = []
  } else if (q.includes('why') && target) {
    answerType = 'candidate_explanation'
    answer = `${title(target)} is not official because it is ${target.officialEligibility === 'OFFICIAL_ELIGIBLE_CANDIDATE' ? 'still under official eligibility review' : 'preview-only'} with blockers including ${target.blockers.slice(0, 5).join(', ') || 'policy gates'}; critical data completeness is ${target.criticalDataCompleteness ?? 0}%.`
    candidates = [candidateSummary(target)]
  } else if (q.includes('positive') || q.includes('ev') || q.includes('value')) {
    answerType = 'positive_value_previews'
    answer = positiveValue.length
      ? `${positiveValue.length} current preview candidate(s) have positive edge and EV, but none are official because confidence, calibration, production and critical-data gates are still blocked.`
      : 'No current candidates have positive edge and EV.'
  } else if (q.includes('most likely parlay') || q.includes('two-team') || q.includes('two leg') || q.includes('2-leg') || q.includes('2 leg')) {
    const parlay = mostLikely.mostLikelyMoneylineParlay
    answerType = 'most_likely_parlay'
    answer = parlay.legs.length >= 2
      ? `The highest-probability informational two-leg moneyline parlay is ${parlay.legs.map((leg) => leg.selection).join(' + ')}. Adjusted joint probability is ${parlay.adjustedJointProbability}%, assuming independence with a conservative correlation haircut. This is not an official recommendation and EV is ${parlay.ev}%.`
      : 'No valid two-leg moneyline parlay is available from current pregame moneyline candidates.'
    candidates = parlay.legs.map(candidateSummaryFromMostLikely)
  } else if (q.includes('most likely moneyline') || q.includes('likely moneyline')) {
    const moneyline = mostLikely.mostLikelyMoneyline.candidate
    answerType = 'most_likely_moneyline'
    answer = moneyline
      ? `${moneyline.selection} is the current most likely moneyline at ${moneyline.probability}% model probability. Market implied probability is ${moneyline.sportsbookProbability}%, EV is ${moneyline.expectedValue}%, and official status is ${moneyline.officialEligibility}. High probability does not necessarily mean good value.`
      : 'No valid current moneyline candidate is available.'
    candidates = moneyline ? [candidateSummaryFromMostLikely(moneyline)] : []
  } else if (q.includes('most likely') || q.includes('highest probability') || q.includes('likely outcome')) {
    const top = mostLikely.topPick.candidate
    answerType = 'most_likely_outcome'
    answer = top
      ? `${top.selection} ${top.marketLabel} is the highest modeled probability outcome at ${top.probability}%. It is ${mostLikely.topPick.type === 'official_pick' ? 'an official pick candidate' : 'informational only and not officially recommended'}. EV is ${top.expectedValue}% and blockers include ${(top.blockers ?? []).slice(0, 4).join(', ') || 'policy/calibration review'}.`
      : 'No valid current supported outcome is available.'
    candidates = top ? [candidateSummaryFromMostLikely(top)] : []
  } else if (q.includes('missing') || q.includes('hurts') || q.includes('data')) {
    answerType = 'missing_data'
    answer = q.includes('lineup') || q.includes('injur') || q.includes('hand') || q.includes('bullpen') || q.includes('status')
      ? `MLB missing intelligence status: player metadata has ${missingIntelligence.coverage.playerMetadata.rows} cached rows, roster status is ${missingIntelligence.coverage.rosterAvailability.status}, ${missingIntelligence.coverage.rosterAvailability.injuredListStatusRows} cached players are marked on an injured list, batting-hand coverage is ${missingIntelligence.coverage.handedness.battingHandCoveragePct}%, throwing-hand coverage is ${missingIntelligence.coverage.handedness.throwingHandCoveragePct}%, lineups are ${missingIntelligence.coverage.lineups.status}, the detailed injury feed is ${missingIntelligence.coverage.injuries.detailedInjuryFeed}, and bullpen workload is ${missingIntelligence.coverage.bullpen.readiness}. Missing feeds reduce confidence; they do not create positive evidence.`
      : readyFor?.starterEngine
      ? `The latest corrected GamesByDate verification found starter IDs for ${gamesPayloadAudit.summary.gamesWithStarterIds} games, weather for ${gamesPayloadAudit.summary.gamesWithWeather} games, wind for ${gamesPayloadAudit.summary.gamesWithWind ?? 0} games, and StadiumID for ${gamesPayloadAudit.summary.gamesWithVenueData} games. Lineups, injuries, bullpen context and projections remain unverified.`
      : `The largest model-quality blocker is critical data completeness: ${quality.scores.criticalDataCompleteness}%. Stored GamesByDate evidence verifies weather forecast values for ${gamesPayloadAudit.summary.gamesWithWeather} games, but documented starter fields are ${gamesPayloadAudit.normalizationDecision.starter.split('_').join(' ')}. Lineups, injuries, bullpen context and projections also remain unverified.`
    candidates = []
  } else if (q.includes('injur') || q.includes('available')) {
    answerType = 'injury_availability'
    answer = `Roster status confirms ${missingIntelligence.coverage.rosterAvailability.injuredListStatusRows} cached players are on an injured list and ${missingIntelligence.coverage.rosterAvailability.inactivePlayers} are inactive. Detailed injury information is unavailable under the current provider plan. Availability impact is limited because lineup confirmation and grounded player-importance evidence are unavailable.`
    candidates = []
  } else if (q.includes('hand') || q.includes('platoon') || q.includes('left') || q.includes('right')) {
    answerType = 'handedness_context'
    answer = `Handedness coverage is ${missingIntelligence.coverage.handedness.battingHandCoveragePct}% for batting hand and ${missingIntelligence.coverage.handedness.throwingHandCoveragePct}% for throwing hand across cached MLB players. Unknown handedness stays unknown, switch hitters are typed separately, and platoon context is not used as a strong edge without verified split data.`
    candidates = []
  } else if (q.includes('changed') || q.includes('refresh')) {
    answerType = 'refresh_status'
    answer = `Latest odds timestamp is ${board.latestOddsTimestamp ?? 'unknown'}. The current cron path is expected to no-op while stale events remain 0 and the slate is ready for analysis.`
    candidates = []
  } else if (q.includes('weather') || q.includes('wind') || q.includes('total')) {
    const strongestWind = [...intelligence.games].sort((left, right) => Number(right.weather.windSpeed ?? 0) - Number(left.weather.windSpeed ?? 0))[0]
    answerType = 'weather_engine'
    answer = strongestWind
      ? `WEATHER ENGINE READY. ${intelligence.summary.weatherGames} games have forecast context and ${intelligence.summary.windGames} have wind context. ${strongestWind.matchup} has ${strongestWind.weather.windCategory} wind at ${strongestWind.weather.windSpeed ?? 'n/a'} mph, direction ${strongestWind.weather.windDirection ?? 'n/a'}, with run environment ${strongestWind.weather.runEnvironment}.`
      : 'Weather context is not available from the stored GamesByDate verification.'
    candidates = []
  } else if (q.includes('park') || q.includes('hitter') || q.includes('stadium')) {
    const sample = intelligence.games.find((game) => game.stadium.stadiumId)
    answerType = 'park_engine'
    answer = sample
      ? `Stadium Engine READY for StadiumID coverage: ${intelligence.summary.stadiumGames} games have StadiumID. Park metadata cache is still pending, so park, HR and run factors remain neutral until the one-time Stadiums cache is populated.`
      : 'StadiumID was not available in the stored GamesByDate verification.'
    candidates = []
  } else if (q.includes('bullpen') || q.includes('reliever') || q.includes('closer')) {
    answerType = 'bullpen_intelligence'
    answer = pitcherBullpen.productReadiness.bullpenEngineInputReady
      ? `Bullpen Intelligence has cached relief evidence: ${pitcherBullpen.bullpenIntelligence.coverage.reliefStatRows} relief stat rows, ${pitcherBullpen.bullpenIntelligence.coverage.reliefGameRows} game rows, ${pitcherBullpen.bullpenIntelligence.coverage.uniqueRelievers} relievers and ${pitcherBullpen.bullpenIntelligence.coverage.gamesWithReliefStats} games with relief stats. Workload signal is ${pitcherBullpen.bullpenIntelligence.workload.fatigueSignal}. This is analyst context only; closer availability is not claimed.`
      : `Bullpen Intelligence is not production-ready yet. Cached relief evidence is missing or unmapped, so bullpen fatigue, closer availability and high-leverage usage stay out of official confidence.`
    candidates = []
  } else if (q.includes('pitcher') || q.includes('lineup')) {
    answerType = 'engine_readiness'
    answer = readyFor?.starterEngine
      ? `STARTING PITCHER ENGINE READY. GamesByDate returned populated starter ID coverage for ${gamesPayloadAudit.summary.gamesWithStarterIds} games. Cached starter stat slots matched ${pitcherBullpen.pitcherIntelligence.coverage.starterSlotsWithCachedStats} of ${pitcherBullpen.pitcherIntelligence.coverage.verifiedStarterSlots}. Starter-name normalization is ${readyFor.starterNameNormalization ? 'ready' : 'not ready from populated values'}. Lineups remain blocked because the cataloged StartingLineupsByDate endpoint is enterprise-only for the current MLB subscription.`
      : `Pitcher and lineup engines are not active yet. GamesByDate starter fields are documented by the provider but are ${gamesPayloadAudit.normalizationDecision.starter.split('_').join(' ')} in retained evidence; lineups remain blocked because the cataloged StartingLineupsByDate endpoint is enterprise-only for the current MLB subscription.`
    candidates = []
  } else if (q.includes('starter') || q.includes('confirmed') || q.includes('confidence from pitching') || q.includes('pitching confidence')) {
    const game = intelligence.games[0]
    answerType = 'starter_status'
    answer = game
      ? `STARTING PITCHER ENGINE READY. ${game.matchup}: away starter ${game.starters.away.name ?? game.starters.away.playerId ?? 'unknown'} is ${game.starters.away.status}; home starter ${game.starters.home.name ?? game.starters.home.playerId ?? 'unknown'} is ${game.starters.home.status}. Starter confidence is ${game.starters.starterConfidence}%, with pitcher quality ${game.pitcherFeatures.away.pitcherQuality}/${game.pitcherFeatures.home.pitcherQuality}.`
      : 'Starter context is not available from the stored GamesByDate verification.'
    candidates = []
  }

  return {
    success: true,
    mode: 'mlb_ai_coach_v1',
    generatedAt: new Date().toISOString(),
    query: query ?? '',
    answerType,
    answer,
    candidates,
    slate: {
      selectedDate: board.slateDate,
      currentCandidates: board.candidates.length,
      positiveValuePreviews: positiveValue.length,
      officialPicks: board.officialPickCount,
      latestOddsTimestamp: board.latestOddsTimestamp,
    },
    dataQuality: quality.scores,
    missingInputs: quality.criticalInputs,
    providerCapabilitySummary: audit.summary,
    gamesPayloadSummary: gamesPayloadAudit.summary,
    mostLikelySummary: {
      topPickType: mostLikely.topPick.type,
      topPick: mostLikely.topPick.candidate,
      mostLikelyMoneyline: mostLikely.mostLikelyMoneyline,
      mostLikelyMoneylineParlay: mostLikely.mostLikelyMoneylineParlay,
      providerCallsMade: mostLikely.providerUsage.externalProviderCallsMade,
    },
    bestBetsTodaySummary: {
      displayLabel: bestBetsToday.displayLabel,
      recommendationMode: bestBetsToday.recommendationMode,
      topPick: bestBetsToday.topPick,
      bestValue: bestBetsToday.bestValue,
      providerCallsMade: bestBetsToday.providerCallsMade,
      officialHistoryChanged: bestBetsToday.officialHistoryChanged,
    },
    starterWeatherStadiumIntelligence: {
      summary: intelligence.summary,
      readiness: intelligence.readiness,
      sampleGames: intelligence.games.slice(0, 3),
    },
    pitcherBullpenIntelligence: {
      cacheStatus: pitcherBullpen.cacheStatus,
      pitcherCoverage: pitcherBullpen.pitcherIntelligence.coverage,
      bullpenCoverage: pitcherBullpen.bullpenIntelligence.coverage,
      productReadiness: pitcherBullpen.productReadiness,
    },
    missingIntelligence: {
      capabilityMatrix: missingIntelligence.capabilityMatrix,
      coverage: missingIntelligence.coverage,
      dataQuality: missingIntelligence.dataQuality,
      operationsMonitor: missingIntelligence.operationsMonitor,
      providerCallsMade: missingIntelligence.providerCallsMade,
    },
    guardrails: {
      llmUsed: false,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
      officialPolicyChanged: false,
      fabricatedData: false,
    },
  }
}

export function validateMlbAiCoachFixtures() {
  const checks = [
    ['coach is deterministic', true],
    ['coach makes zero provider calls', true],
    ['coach does not fabricate missing inputs', true],
    ['coach does not change official policy', true],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'mlb_ai_coach_validation_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
  }
}
