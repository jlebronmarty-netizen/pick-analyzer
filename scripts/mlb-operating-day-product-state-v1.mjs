import fs from 'node:fs'

const envPath = '.env.local'
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([^#][^=]+)=(.*)$/)
    if (match) process.env[match[1].trim()] ??= match[2].trim()
  }
}

const [
  dashboardToday,
  currentBoard,
  pipelineTrace,
  adaptiveRefresh,
  autonomousOps,
] = await Promise.all([
  import('../src/services/dashboard-today.service.ts'),
  import('../src/services/current-board.service.ts'),
  import('../src/services/recommendation-pipeline-trace.service.ts'),
  import('../src/services/adaptive-refresh-orchestrator.service.ts'),
  import('../src/services/autonomous-daily-operations.service.ts'),
])

const today = await dashboardToday.getDashboardToday()
const board = await currentBoard.getCurrentBoard({ sportKey: 'baseball_mlb', mode: 'CURRENT', limit: 200 })
const trace = await pipelineTrace.getRecommendationPipelineTrace()
const adaptiveStatus = await adaptiveRefresh.getAdaptiveRefreshStatus()
const adaptiveDryRun = await adaptiveRefresh.runAdaptiveRefresh({ dryRun: true, source: 'SYSTEM' })
const opsStatus = await autonomousOps.getAutonomousDailyOperationsStatus({})

const traceToday = trace.today ?? trace.days?.find?.((day) => day.label === 'Today') ?? null

const result = {
  success: true,
  mode: 'mlb_operating_day_product_state_v1',
  generatedAt: new Date().toISOString(),
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  productionMutationsMade: 0,
  dashboardToday: {
    status: today.status,
    operatingDate: today.operatingDate,
    currentGames: today.currentGames,
    upcomingGames: today.upcomingGames,
    finalGames: today.finalGames,
    gamesWaitingForOdds: today.gamesWaitingForOdds,
    gamesReadyForAnalysis: today.gamesReadyForAnalysis,
    predictionCandidates: today.predictionCandidates,
    officialPicks: today.officialPicks,
    freshness: today.freshness,
    nextAction: today.nextAction,
    latestOddsTimestamp: today.marketStatus?.latestOddsTimestamp ?? today.sections?.marketPrices?.data?.latestOddsTimestamp ?? null,
    providerCallsMade: today.providerCallsMade ?? 0,
    remoteMutationsMade: today.remoteMutationsMade ?? 0,
    warnings: today.warnings ?? [],
  },
  currentBoard: {
    operatingDate: board.operatingDate,
    slateDate: board.slateDate,
    games: board.games.length,
    candidates: board.candidates.length,
    officialPickCount: board.officialPickCount,
    modeledValueCount: board.modeledValueCount,
    watchCount: board.watchCount,
    latestOddsTimestamp: board.latestOddsTimestamp,
    latestVisibleMarketSnapshotTimestamp: board.latestVisibleMarketSnapshotTimestamp,
    dataFreshness: board.dataFreshness,
    boardHealth: board.boardHealth,
    games: board.games.map((game) => ({
      eventId: game.eventId,
      matchup: game.matchup,
      scheduledTime: game.scheduledTime,
      candidates: game.candidates,
      storedOddsCount: game.storedOddsCount,
      displayableMarketCount: game.displayableMarketCount,
      latestOddsTimestamp: game.latestOddsTimestamp,
      markets: game.markets,
    })),
  },
  pipelineTraceToday: traceToday ? {
    date: traceToday.date,
    counts: traceToday.counts,
    coverage: traceToday.coverage,
    providerCallsMade: trace.providerCallsMade ?? 0,
    remoteMutationsMade: trace.remoteMutationsMade ?? 0,
  } : null,
  adaptiveRefresh: {
    status: {
      selectedDate: adaptiveStatus.selectedDate,
      nextAction: adaptiveStatus.nextAction,
      currentGames: adaptiveStatus.currentGames,
      gamesWaitingForOdds: adaptiveStatus.gamesWaitingForOdds,
      gamesReadyForAnalysis: adaptiveStatus.gamesReadyForAnalysis,
      latestOddsTimestamp: adaptiveStatus.latestOddsTimestamp,
      refreshPlan: adaptiveStatus.refreshPlan,
      marketRefreshEligibility: adaptiveStatus.marketRefreshEligibility,
      providerBudget: adaptiveStatus.providerBudget,
    },
    dryRun: {
      status: adaptiveDryRun.status,
      selectedAction: adaptiveDryRun.selectedAction,
      expectedActionMatched: adaptiveDryRun.expectedActionMatched,
      providerCallsMade: adaptiveDryRun.providerCallsMade,
      remoteMutationsMade: adaptiveDryRun.remoteMutationsMade,
      productionMutationsMade: adaptiveDryRun.productionMutationsMade,
      blockedReason: adaptiveDryRun.blockedReason,
      warnings: adaptiveDryRun.warnings,
    },
  },
  autonomousDailyOperations: {
    selectedDate: opsStatus.selectedDate,
    currentLifecycleState: opsStatus.currentLifecycleState,
    nextAction: opsStatus.nextAction,
    stages: opsStatus.stages?.map((stage) => ({
      id: stage.id,
      title: stage.title,
      status: stage.status,
      value: stage.value,
      detail: stage.detail,
    })) ?? [],
    providerCallsMade: opsStatus.providerCallsMade ?? 0,
    remoteMutationsMade: opsStatus.remoteMutationsMade ?? 0,
  },
}

console.log(JSON.stringify(result, null, 2))
