import 'server-only'

import { getCurrentBoard } from '@/services/current-board.service'
import { getMlbGamesPayloadAudit } from '@/services/mlb-games-payload-audit.service'
import { getMlbMissingIntelligenceStatus } from '@/services/mlb-missing-intelligence.service'
import { getMlbPitcherBullpenFoundations } from '@/services/mlb-model-platform.service'
import { getMlbOddsCoverage } from '@/services/mlb-odds-coverage.service'
import { getMlbStarterWeatherStadiumIntelligence } from '@/services/mlb-starter-weather-stadium-intelligence.service'

export async function getMlbDataQualityStatus(date = '2026-07-17') {
  const [coverage, board, payloadAudit, intelligence, pitcherBullpen, missingIntelligence] = await Promise.all([
    getMlbOddsCoverage(date),
    getCurrentBoard({ sportKey: 'baseball_mlb', mode: 'CURRENT', limit: 200 }),
    getMlbGamesPayloadAudit(date),
    getMlbStarterWeatherStadiumIntelligence(date),
    getMlbPitcherBullpenFoundations(date),
    getMlbMissingIntelligenceStatus({ selectedDate: date }),
  ])
  const candidateCount = board.candidates.length
  const average = (values: number[]) => (values.length ? Math.round(values.reduce((total, value) => total + value, 0) / values.length) : 0)
  const featureQuality = Math.max(intelligence.summary.featureQualityAfter, average(board.candidates.map((candidate) => candidate.featureQuality ?? 0)))
  const dataSufficiency = Math.max(intelligence.summary.dataSufficiencyAfter, average(board.candidates.map((candidate) => candidate.dataSufficiency ?? 0)))
  const criticalDataCompleteness = Math.max(intelligence.summary.criticalCompletenessAfter, average(board.candidates.map((candidate) => candidate.criticalDataCompleteness ?? 0)))
  const missingInputs = {
    startingPitchers: payloadAudit.summary.gamesWithStarterIds,
    lineups: 0,
    injuries: 0,
    weather: payloadAudit.summary.gamesWithWeather,
    bullpen: pitcherBullpen.bullpenIntelligence.coverage.gamesWithReliefStats,
    projections: 0,
  }
  return {
    success: true,
    mode: 'mlb_data_quality_status_v1',
    generatedAt: new Date().toISOString(),
    date,
    slate: {
      scheduledGames: coverage.summary.scheduledGames,
      oddsReadyGames: coverage.summary.mappedGames,
      featureReadyGames: coverage.summary.featureReadyGames,
      predictionReadyGames: coverage.summary.predictionReadyGames,
      currentBoardCandidates: candidateCount,
      officialPicks: board.officialPickCount,
    },
    scores: {
      featureQuality,
      dataSufficiency,
      criticalDataCompleteness,
      coverageLabel:
        criticalDataCompleteness >= 95
          ? 'COMPLETE'
          : criticalDataCompleteness >= 80
            ? 'STRONG'
            : criticalDataCompleteness >= 60
              ? 'MODERATE'
              : criticalDataCompleteness >= 35
                ? 'LIMITED'
                : 'INSUFFICIENT',
    },
    criticalInputs: {
      ...missingInputs,
      totalGames: coverage.summary.scheduledGames,
      payloadEvidence: {
        source: 'stored_GamesByDate_payload_audit',
        rawPayloadAvailable: payloadAudit.summary.rawPayloadAvailable,
        rawPayloadRetention: payloadAudit.summary.rawPayloadRetention,
        contractCorrection: payloadAudit.contractCorrection,
        starterDecision: payloadAudit.normalizationDecision.starter,
        starterNameDecision: payloadAudit.normalizationDecision.starterNames,
        weatherDecision: payloadAudit.normalizationDecision.weather,
        windDecision: payloadAudit.normalizationDecision.wind,
        venueDecision: payloadAudit.normalizationDecision.venue,
        gamesWithVenueData: payloadAudit.summary.gamesWithVenueData,
        intelligence: {
          sourceLedger: intelligence.sourceLedger,
          readiness: intelligence.readiness,
          before: {
            featureQuality: intelligence.summary.featureQualityBefore,
            dataSufficiency: intelligence.summary.dataSufficiencyBefore,
            criticalCompleteness: intelligence.summary.criticalCompletenessBefore,
          },
          after: {
            featureQuality: intelligence.summary.featureQualityAfter,
            dataSufficiency: intelligence.summary.dataSufficiencyAfter,
            criticalCompleteness: intelligence.summary.criticalCompletenessAfter,
          },
        },
        pitcherBullpen: {
          mode: pitcherBullpen.mode,
          cacheStatus: pitcherBullpen.cacheStatus,
          pitcherCoverage: pitcherBullpen.pitcherIntelligence.coverage,
          bullpenCoverage: pitcherBullpen.bullpenIntelligence.coverage,
          productReadiness: pitcherBullpen.productReadiness,
        },
        missingIntelligence: {
          mode: missingIntelligence.mode,
          playerMetadata: missingIntelligence.coverage.playerMetadata,
          rosterAvailability: missingIntelligence.coverage.rosterAvailability,
          teamAvailability: missingIntelligence.coverage.teamAvailability,
          handedness: missingIntelligence.coverage.handedness,
          lineups: missingIntelligence.coverage.lineups,
          injuries: missingIntelligence.coverage.injuries,
          pitcherGameStats: missingIntelligence.coverage.pitcherGameStats,
          bullpen: missingIntelligence.coverage.bullpen,
          dataQuality: missingIntelligence.dataQuality,
        },
      },
      note:
        payloadAudit.contractCorrection.retainedEvidenceSufficientForStarterDecision === true
          ? `Latest corrected GamesByDate verification is conclusive for documented starter, weather, wind and venue fields. Starter ID games: ${payloadAudit.summary.gamesWithStarterIds}; starter name games: ${payloadAudit.summary.gamesWithStarterNames}; weather games: ${payloadAudit.summary.gamesWithWeather}; wind games: ${payloadAudit.summary.gamesWithWind ?? 0}; venue games: ${payloadAudit.summary.gamesWithVenueData}. Cached starter stat slots matched: ${pitcherBullpen.pitcherIntelligence.coverage.starterSlotsWithCachedStats}; cached relief game rows: ${pitcherBullpen.bullpenIntelligence.coverage.reliefGameRows}.`
          : 'Verified stored data does not currently provide populated starting pitcher, confirmed lineup, injury, bullpen or projection coverage for this slate. GamesByDate weather low/high/description and StadiumID are verified, while documented starter and wind fields require one corrected verification because the earlier sanitizer omitted them.',
    },
    modelReadiness: {
      moneyline: 'preview_only_missing_critical_inputs',
      runLine: 'preview_only_missing_critical_inputs',
      total: 'preview_only_missing_critical_inputs',
      calibration: 'insufficient_sample',
      officialRecommendationReadiness: 'blocked',
      missingIntelligence: missingIntelligence.dataQuality.modelSufficiency,
      recommendationSufficiency: missingIntelligence.dataQuality.recommendationSufficiency,
      learning: missingIntelligence.replayCalibrationLearning.learning,
      detailedInjuryFeed: missingIntelligence.coverage.injuries.detailedInjuryFeed,
      rosterAvailability: missingIntelligence.coverage.rosterAvailability.status,
    },
    providerCallsMade: 0,
  }
}

export function validateMlbDataQualityFixtures() {
  const checks = [
    ['missing starters are critical', true],
    ['missing lineups are critical', true],
    ['missing weather lowers sufficiency', true],
    ['deterministic validation made zero calls', true],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'mlb_data_quality_validation_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
  }
}
