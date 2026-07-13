import { serverCache } from '@/lib/server-cache'
import { getAITradingAdvisor } from '@/services/ai-trading-advisor.service'
import { getAdaptiveWeightRecommendations } from '@/services/adaptive-weight-engine.service'
import { getAnalyticsDashboard } from '@/services/analytics.service'
import { getClvAnalytics } from '@/services/clv-analytics.service'
import { getDailyReportFast } from '@/services/daily-report-fast.service'
import { getModelCalibration } from '@/services/model-calibration.service'
import { discoverPatterns } from '@/services/pattern-discovery.service'
import { getPlayOfTheDay } from '@/services/play-of-the-day.service'
import { getTopPicks } from '@/services/top-picks.service'

async function safe<T>(name: string, loader: () => Promise<T>, fallback: T) {
  try {
    return await loader()
  } catch (error) {
    console.error(`Dashboard ${name} failed:`, error)
    return fallback
  }
}

export async function getDashboard(bankroll = 1000) {
  return serverCache({
    key: `dashboard:${bankroll}`,
    ttlMs: 30_000,
    loader: () => buildDashboard(bankroll),
  })
}

async function buildDashboard(bankroll = 1000) {
  const [
    analytics,
    clv,
    calibration,
    playOfTheDay,
    topPicks,
    dailyReport,
    patterns,
    adaptiveWeights,
  ] = await Promise.all([
    safe('analytics', () => getAnalyticsDashboard(), null),
    safe('clv', () => getClvAnalytics(), null),
    safe('calibration', () => getModelCalibration(), null),
    safe('playOfTheDay', () => getPlayOfTheDay(), null),
    safe('topPicks', () => getTopPicks(), null),
    safe('dailyReportFast', () => getDailyReportFast(bankroll), null),
    safe('patterns', () => discoverPatterns(), null),
    safe(
      'adaptiveWeights',
      () => getAdaptiveWeightRecommendations('baseball_mlb'),
      null
    ),
  ])

  const advisor = getAITradingAdvisor({
    analytics,
    clv,
    calibration,
    playOfTheDay,
    topPicks,
    dailyReport,
    patterns,
  })

  return {
    success: true,
    generatedAt: new Date().toISOString(),
    mode: 'dashboard_fast_v4_cached',
    bankroll,

    advisor,

    analytics,
    clv,
    calibration,
    playOfTheDay,
    topPicks,
    dailyReport,
    patterns,
    adaptiveWeights,

    kpis: {
      winRate: analytics?.overall?.winRate ?? 0,
      roi: analytics?.overall?.roi ?? 0,
      profit: analytics?.overall?.profit ?? 0,
      settled: analytics?.overall?.settled ?? 0,
      pending: analytics?.overall?.pending ?? 0,
      clvAverage: clv?.summary?.averageClv ?? 0,
      calibrationScore: calibration?.overall?.calibrationScore ?? 0,
      modelStatus: calibration?.overall?.modelStatus ?? 'INSUFFICIENT_DATA',
      safePicks: topPicks?.summary?.safePendingPicks ?? 0,
      bestBets: topPicks?.summary?.bestBetsCount ?? 0,
      recommendedPicks: topPicks?.summary?.recommendedPicks ?? 0,
      bestSport: patterns?.bestSport?.key ?? null,
      bestSportsbook: patterns?.bestSportsbook?.key ?? null,
      bestOddsRange: patterns?.bestOddsRange?.key ?? null,
      bestConfidenceRange: patterns?.bestConfidenceRange?.key ?? null,
      adaptiveSampleSize: adaptiveWeights?.sampleSize ?? 0,
    },
  }
}