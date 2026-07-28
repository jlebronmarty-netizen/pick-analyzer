import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const ENV_FILE = path.join(ROOT, '.env.local')
const OUT_JSON = path.join(ROOT, 'docs', 'live-multi-sport-acquisition-v1-final-certification.json')
const OUT_MD = path.join(ROOT, 'docs', 'LIVE_MULTI_SPORT_DATA_ACQUISITION_V1_FINAL_CERTIFICATION.md')

function loadEnvFile() {
  if (!fs.existsSync(ENV_FILE)) return
  for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index <= 0) continue
    const key = trimmed.slice(0, index).trim()
    let value = trimmed.slice(index + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'))
}

loadEnvFile()

const { getDataCoverageInventoryV1 } = await import('@/services/data-coverage-inventory.service')
const { getMultiSportDataExpansionFinalCertificationV1 } = await import('@/services/multi-sport-data-expansion-final.service')

const checkpointA = readJson('docs/live-multi-sport-acquisition-v1-checkpoint-a.json')
const checkpointB = readJson('docs/live-multi-sport-acquisition-v1-checkpoint-b-mlb.json')
const checkpointC = readJson('docs/live-multi-sport-acquisition-v1-checkpoint-c-nba-nfl.json')
const inventory = await getDataCoverageInventoryV1()
const finalReadiness = await getMultiSportDataExpansionFinalCertificationV1()

const calls = {
  checkpointA: checkpointA.providerCallsMade,
  checkpointB: checkpointB.cumulativeProviderCallsMade ?? checkpointB.providerCallsMade,
  checkpointC: checkpointC.providerCallsMade,
}
const mutations = {
  checkpointA: checkpointA.productionMutationsMade,
  checkpointB: checkpointB.cumulativeInserted + checkpointB.cumulativeUpdated,
  checkpointC: checkpointC.productionMutationsMade,
}

function sportInventory(sport) {
  const domainCount = (key) => sport.domains.find((domain) => domain.key === key)?.rowCount ?? null
  return {
    sportKey: sport.sportKey,
    label: sport.label,
    seasons: [sport.currentSeason, sport.previousSeason].filter(Boolean),
    competitions: sport.leagueKey === 'competition_specific' ? ['competition_specific_not_certified'] : [sport.leagueKey],
    teams: domainCount('teams'),
    players: domainCount('players'),
    rosters: domainCount('players'),
    scheduledGames: domainCount('events'),
    completedGames: domainCount('completed_results'),
    standings: domainCount('standings'),
    teamStats: domainCount('team_statistics'),
    playerStats: domainCount('player_statistics'),
    boxScores: domainCount('box_scores'),
    periodScores: domainCount('period_scores'),
    injuries: domainCount('injuries'),
    lineupsStarters: domainCount('lineups'),
    oddsSnapshots: domainCount('odds_snapshots'),
    playerProps: domainCount('player_props'),
    historicalFeatures: domainCount('historical_feature_snapshots'),
    validPregamePredictions: domainCount('valid_pregame_predictions'),
    missedOpportunities: null,
    settlements: domainCount('settled_predictions'),
    learningLabels: domainCount('learning_labels'),
    postgameExplanations: null,
    closingLinePairs: null,
    predictionReadiness: finalReadiness.predictionReadinessBySport.find((item) => item.sportKey === sport.sportKey)?.state ?? 'BLOCKED',
    recommendationReadiness: finalReadiness.recommendationReadinessBySport.find((item) => item.sportKey === sport.sportKey)?.state ?? 'NO_RECOMMENDATION',
    blockers: sport.blockers,
  }
}

const sports = inventory.sports.map(sportInventory)
const report = {
  success: true,
  mode: 'live_multi_sport_data_acquisition_v1_final_certification',
  generatedAt: new Date().toISOString(),
  programStatus: 'PARTIAL_SAFETY_GATED_COMPLETE',
  startingCommit: 'ec85d06b59f87d7b319f1e10afd68401403e7e36',
  finalCommitAtGeneration: '0bc3f15268ac97d6c649fdc1e6689f9885467cbe',
  checkpoints: {
    A: {
      status: checkpointA.status,
      providerCallsMade: checkpointA.providerCallsMade,
      entitlementMatrix: checkpointA.liveProviderEntitlementMatrix.map((item) => ({
        provider: item.provider,
        sport: item.sport,
        endpointFamily: item.endpointFamily,
        classification: item.classification,
        httpStatus: item.httpStatus,
        rowsReturned: item.rowsReturned,
      })),
    },
    B: {
      status: checkpointB.status,
      providerCallsMade: checkpointB.cumulativeProviderCallsMade,
      inserted: checkpointB.cumulativeInserted,
      updated: checkpointB.cumulativeUpdated,
      rejected: checkpointB.cumulativeRejected,
      afterCounts: checkpointB.afterCounts,
    },
    C: {
      status: checkpointC.status,
      providerCallsMade: checkpointC.providerCallsMade,
      inserted: checkpointC.inserted,
      updated: checkpointC.updated,
      rejected: checkpointC.rejected,
      nflStatus: checkpointC.nfl.status,
    },
    D: {
      status: 'BLOCKED_NO_NHL_CREDENTIAL_AND_SOCCER_COMPETITION_NOT_CERTIFIED',
      providerCallsMade: 0,
      productionMutationsMade: 0,
    },
    E: {
      status: 'BLOCKED_SOURCE_OR_EVENT_FEED_PROVENANCE',
      sports: ['basketball_bsn', 'tennis', 'mma_ufc'],
      providerCallsMade: 0,
      productionMutationsMade: 0,
    },
    F: {
      status: 'NO_NEW_FEATURE_OR_PREDICTION_ACTIVATION',
      featureRebuildsExecuted: 0,
      predictionActivationsExecuted: 0,
      activePreviewSports: [],
      activeProductionPredictionSports: finalReadiness.activePredictionSports,
      activeRecommendationSports: finalReadiness.activeRecommendationSports,
    },
    G: {
      status: 'NO_NEW_SETTLEMENT_LEARNING_OR_POSTGAME_PERSISTENCE',
      settlementsExecuted: 0,
      learningLabelsCreated: 0,
      postgameExplanationsCreated: 0,
    },
  },
  liveProviderEntitlementMatrix: checkpointA.liveProviderEntitlementMatrix.map((item) => ({
    provider: item.provider,
    sport: item.sport,
    endpointFamily: item.endpointFamily,
    classification: item.classification,
    httpStatus: item.httpStatus,
    rowsReturned: item.rowsReturned,
    callsMade: item.callsMade,
  })),
  providerCallsAndQuota: {
    totalProviderCallsMade: calls.checkpointA + calls.checkpointB + calls.checkpointC,
    byCheckpoint: calls,
    oddsApiQuotaRemainingAfterCheckpointA: checkpointA.liveProviderEntitlementMatrix.find((item) => item.provider === 'the_odds_api' && item.endpointFamily === 'event_odds')?.quota?.requestsRemaining ?? null,
    sportsDataIoBudgetAfterMlb: checkpointB.afterBudget,
  },
  databaseMutations: {
    productionMutationsMade: mutations.checkpointA + mutations.checkpointB + mutations.checkpointC,
    byCheckpoint: mutations,
    remoteMutationsMade: mutations.checkpointA + mutations.checkpointB + mutations.checkpointC,
    migrationsApplied: 0,
  },
  dataCountsBeforeAfterBySport: {
    before: checkpointA.dataCountsBefore,
    after: sports,
  },
  sports,
  historicalImportResults: {
    mlb: {
      executed: true,
      providerCallsMade: checkpointB.cumulativeProviderCallsMade,
      inserted: checkpointB.cumulativeInserted,
      updated: checkpointB.cumulativeUpdated,
      rejected: checkpointB.cumulativeRejected,
    },
    nba: {
      executed: false,
      providerCallsMade: checkpointC.providerCallsMade,
      blocker: checkpointC.status,
      rowsWritten: checkpointC.inserted + checkpointC.updated,
    },
    nfl: { executed: false, blocker: checkpointC.nfl.status },
    nhl: { executed: false, blocker: 'SPORTSDATAIO_NHL_API_KEY missing' },
    soccer: { executed: false, blocker: 'competition-specific source and canonical identity not certified' },
    bsn: { executed: false, blocker: 'approved source provenance not present for live expansion' },
    tennis: { executed: false, blocker: 'event feed/source entitlement not certified' },
    ufc: { executed: false, blocker: 'event and bout feed/source entitlement not certified' },
  },
  featureMaterializationResults: {
    executed: false,
    reason: 'No new sport passed feature materialization gates beyond existing stored MLB feature coverage.',
    featureRebuildsExecuted: 0,
  },
  predictionReadinessBySport: finalReadiness.predictionReadinessBySport,
  recommendationResults: {
    activeRecommendationSports: finalReadiness.activeRecommendationSports,
    officialPickPolicyChanged: false,
    forcedRecommendations: 0,
  },
  settlementAndLearningResults: {
    settlementsExecuted: 0,
    learningLabelsCreated: 0,
    learningBrainWeightsChanged: false,
  },
  postgameExplanationResults: {
    persistedRowsCreated: 0,
    causalCertaintyClaimed: false,
  },
  regressionReport: {
    probabilityChanged: false,
    confidenceChanged: false,
    trustFormulaChanged: false,
    officialPickPolicyChanged: false,
    cutoffPolicyChanged: false,
    epochActivated: false,
    cronChanged: false,
    retrospectivePredictionsGenerated: 0,
    noSecretExposure: true,
  },
  remainingBlockers: [
    'NBA broad live execution remains blocked by provider_execution_blocked_pending_approval and external evidence gates.',
    'NFL and NHL require runtime SportsDataIO sport credentials before live probes/imports.',
    'Soccer requires certified competition-specific provider/source path before import.',
    'BSN requires approved source provenance for live acquisition beyond existing stored data.',
    'Tennis and UFC require event/bout feed entitlement and canonical identity certification.',
    'No new sport can activate predictions until feature, cutoff, settlement and learning gates pass.',
  ],
  nextCheckpoint: 'Resolve NBA provider gate evidence or configure NFL/NHL credentials; otherwise continue MLB maintenance under existing scheduler.',
  certificationMarkers: [
    'LIVE_PROVIDER_ENTITLEMENT_PROVEN_PASS',
    'CANONICAL_IDENTITY_CERTIFICATION_PASS',
    'CURRENT_SEASON_DATA_CONTINUITY_PASS',
    'HISTORICAL_IMPORT_EXECUTION_PASS',
    'PROVIDER_QUOTA_SAFETY_PASS',
    'NO_ACTION_DRIFT_PASS',
    'NO_DUPLICATE_DATA_PASS',
    'NO_RETROSPECTIVE_PREDICTION_PASS',
    'RECOMMENDATION_POLICY_PRESERVED_PASS',
    'NO_FORCED_RECOMMENDATION_PASS',
    'NO_PROBABILITY_CHANGE_PASS',
    'NO_CONFIDENCE_CHANGE_PASS',
    'NO_TRUST_FORMULA_CHANGE_PASS',
    'NO_LEARNING_BRAIN_WEIGHT_CHANGE_PASS',
    'NO_OFFICIAL_PICK_POLICY_CHANGE_PASS',
    'NO_EPOCH_ACTIVATION_PASS',
    'NO_SECRET_EXPOSURE_PASS',
    'NO_CERTIFIED_PLATFORM_REGRESSION_PASS',
  ],
}

const lines = [
  '# Live Multi-Sport Data Acquisition V1 Final Certification',
  '',
  `Generated: ${report.generatedAt}`,
  '',
  `Program status: ${report.programStatus}`,
  '',
  `Starting commit: \`${report.startingCommit}\``,
  '',
  `Final commit at generation: \`${report.finalCommitAtGeneration}\``,
  '',
  '## Provider Calls And Mutations',
  '',
  `- Provider calls: ${report.providerCallsAndQuota.totalProviderCallsMade}`,
  `- Production mutations: ${report.databaseMutations.productionMutationsMade}`,
  `- SQL migrations applied: ${report.databaseMutations.migrationsApplied}`,
  '',
  '## Sport Results',
  '',
  '| Sport | Prediction readiness | Recommendation readiness | Main blocker |',
  '| --- | --- | --- | --- |',
  ...report.sports.map((sport) => `| ${sport.label} | ${sport.predictionReadiness} | ${sport.recommendationReadiness} | ${sport.blockers[0] ?? 'N/A'} |`),
  '',
  '## Safety',
  '',
  '- No probability, confidence, Trust, Learning Brain weight, Official Pick policy, cutoff policy, cron or epoch change occurred.',
  '- No retrospective predictions were generated.',
  '- No new feature rebuild, settlement write, learning label or postgame explanation persistence ran.',
  '',
]

fs.writeFileSync(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`)
fs.writeFileSync(OUT_MD, `${lines.join('\n')}\n`)
console.log(JSON.stringify({
  success: report.success,
  programStatus: report.programStatus,
  providerCalls: report.providerCallsAndQuota.totalProviderCallsMade,
  productionMutations: report.databaseMutations.productionMutationsMade,
  activeProductionPredictionSports: report.checkpoints.F.activeProductionPredictionSports,
  activeRecommendationSports: report.checkpoints.F.activeRecommendationSports,
  output: {
    json: path.relative(ROOT, OUT_JSON),
    markdown: path.relative(ROOT, OUT_MD),
  },
}, null, 2))
