import { explainPick } from '@/services/analysis-explainer.service'
import { getBankrollManager } from '@/services/bankroll-manager.service'
import { getClvAnalytics } from '@/services/clv-analytics.service'
import { getModelCalibration } from '@/services/model-calibration.service'
import { getModelWeights } from '@/services/model-learning.service'
import { buildPortfolios } from '@/services/portfolio-builder.service'
import { getSportsbookIntelligence } from '@/services/sportsbook-intelligence.service'
import { getTopPicks } from '@/services/top-picks.service'
import { PRODUCTION_DATA_GATE_V1_POLICY } from '@/services/production-data-gate.service'

type ReportPick = {
  id: string
  team: string
  opponent: string
  sport_key?: string
  sportKey?: string
  odds: number
  formattedOdds?: string
  model_probability?: number
  modelProbability?: number
  implied_probability?: number
  impliedProbability?: number
  confidence: number
  edge: number
  ev: number
  risk_grade?: string
  riskGrade?: string
  risk_label?: string
  riskLabel?: string
  smart_score?: number
  smartScore?: number
  sharpSignal?: boolean
  sharpLabel?: string
  bettingUrgency?: string
  aiRecommendation?: string
  aiSummary?: string
  recommended_stake?: number
  recommendedStake?: number
  lineValue?: number
  valueGap?: number
}

async function safeSection<T>(
  name: string,
  fallback: T,
  loader: () => Promise<T>
): Promise<T> {
  try {
    return await loader()
  } catch (error) {
    console.error(`Daily report ${name} failed:`, error)
    return fallback
  }
}

function normalizePick(pick: ReportPick) {
  return {
    ...pick,
    sport_key: pick.sport_key ?? pick.sportKey ?? 'unknown',
    model_probability: pick.model_probability ?? pick.modelProbability ?? 0,
    implied_probability: pick.implied_probability ?? pick.impliedProbability ?? 0,
    risk_grade: pick.risk_grade ?? pick.riskGrade,
    risk_label: pick.risk_label ?? pick.riskLabel,
    smart_score: pick.smart_score ?? pick.smartScore ?? 0,
    recommended_stake: pick.recommended_stake ?? pick.recommendedStake ?? 0,
  }
}

function sortByPremiumScore(a: ReportPick, b: ReportPick) {
  return (
    Number(b.bettingUrgency === 'BET_NOW') -
      Number(a.bettingUrgency === 'BET_NOW') ||
    Number(Boolean(b.sharpSignal)) - Number(Boolean(a.sharpSignal)) ||
    (b.smart_score ?? b.smartScore ?? 0) - (a.smart_score ?? a.smartScore ?? 0) ||
    (b.lineValue ?? 0) - (a.lineValue ?? 0) ||
    b.confidence - a.confidence ||
    b.ev - a.ev
  )
}

function dedupePicks(picks: ReportPick[]) {
  const map = new Map<string, ReportPick>()

  for (const rawPick of picks) {
    const pick = normalizePick(rawPick)
    const key = `${pick.sport_key}:${pick.team}:${pick.opponent}`

    const existing = map.get(key)

    const pickScore =
      (pick.smart_score ?? 0) +
      pick.confidence +
      pick.ev +
      (pick.lineValue ?? 0) +
      Number(pick.sharpSignal) * 20 +
      Number(pick.bettingUrgency === 'BET_NOW') * 25

    const existingNormalized = existing ? normalizePick(existing) : null

    const existingScore = existingNormalized
      ? (existingNormalized.smart_score ?? 0) +
        existingNormalized.confidence +
        existingNormalized.ev +
        (existingNormalized.lineValue ?? 0) +
        Number(existingNormalized.sharpSignal) * 20 +
        Number(existingNormalized.bettingUrgency === 'BET_NOW') * 25
      : -1

    if (!existing || pickScore > existingScore) {
      map.set(key, pick)
    }
  }

  return [...map.values()]
}

function getBestUnderdog(picks: ReportPick[]) {
  return [...picks].filter((pick) => pick.odds > 0).sort(sortByPremiumScore)[0] ?? null
}

function getBestFavorite(picks: ReportPick[]) {
  return [...picks].filter((pick) => pick.odds < 0).sort(sortByPremiumScore)[0] ?? null
}

function getHighestEv(picks: ReportPick[]) {
  return [...picks].sort((a, b) => b.ev - a.ev)[0] ?? null
}

function getHighestConfidence(picks: ReportPick[]) {
  return [...picks].sort((a, b) => b.confidence - a.confidence)[0] ?? null
}

function getBestSharp(picks: ReportPick[]) {
  return [...picks].filter((pick) => pick.sharpSignal).sort(sortByPremiumScore)[0] ?? null
}

function getBestClv(picks: ReportPick[]) {
  return [...picks]
    .filter((pick) => (pick.lineValue ?? 0) > 0)
    .sort((a, b) => (b.lineValue ?? 0) - (a.lineValue ?? 0))[0] ?? null
}

function mapPick(pick: ReportPick | null) {
  if (!pick) return null

  const normalized = normalizePick(pick)

  return {
    ...normalized,
    explanation: explainPick(normalized),
  }
}

function getExecutiveSummary({
  totalPicks,
  betNow,
  sharpSignals,
  calibrationScore,
  learningRoi,
}: {
  totalPicks: number
  betNow: number
  sharpSignals: number
  calibrationScore: number
  learningRoi: number
}) {
  if (betNow >= 3 && sharpSignals >= 3) {
    return `Strong board today: ${betNow} BET_NOW opportunities and ${sharpSignals} sharp signals detected.`
  }

  if (totalPicks === 0) {
    return 'No strong betting board detected today. Preserve bankroll and wait for better spots.'
  }

  if (calibrationScore < 50 || learningRoi < -10) {
    return 'Proceed carefully. The board has opportunities, but model calibration or recent ROI requires discipline.'
  }

  return 'Moderate betting board. Focus on highest-confidence singles and keep exposure controlled.'
}

function getMlbValidationReportSection() {
  return {
    mode: 'mlb_validation_report_section_v1',
    labels: [
      'QUARANTINED REAL-DATA VALIDATION',
      'NOT A WAGERING RECOMMENDATION',
      'NOT PRODUCTION PERFORMANCE',
    ],
    status: 'ready_disabled_pending_explicit_activation',
    productionGate: {
      mode: PRODUCTION_DATA_GATE_V1_POLICY.mode,
      publicRecommendationsEnabled: false,
      productionMetricsEnabled: false,
      productionEligibleRequiredForPublicOutputs: true,
    },
    pregame: {
      fieldsReady: [
        'gamesScheduled',
        'mappedGames',
        'oddsCoverage',
        'snapshotsCaptured',
        'predictionCandidates',
        'predictionsCreated',
        'predictionsBlockedByReason',
        'dataQuality',
        'providerCallsUsed',
      ],
      currentValues: {
        gamesScheduled: null,
        mappedGames: null,
        oddsCoverage: null,
        snapshotsCaptured: null,
        predictionCandidates: null,
        predictionsCreated: null,
        predictionsBlockedByReason: [],
        dataQuality: null,
        providerCallsUsed: 0,
      },
    },
    postgame: {
      fieldsReady: [
        'predictionsSettled',
        'wins',
        'losses',
        'pushes',
        'voids',
        'pending',
        'byMarketResults',
        'technicalUnits',
        'brierScore',
        'dataIncidents',
        'unresolvedSettlement',
        'providerReliability',
      ],
      currentValues: {
        predictionsSettled: null,
        wins: null,
        losses: null,
        pushes: null,
        voids: null,
        pending: null,
        byMarketResults: [],
        technicalUnits: null,
        brierScore: null,
        dataIncidents: [],
        unresolvedSettlement: [],
        providerReliability: null,
      },
    },
    cumulativeThirtyDay: {
      fieldsReady: [
        'totalPredictions',
        'settledSample',
        'hitRate',
        'brierScore',
        'calibration',
        'technicalUnitsRoi',
        'maxDrawdown',
        'byMarketPerformance',
        'oddsCoverage',
        'closingComparisonCoverage',
        'costPerGame',
        'costPerSettledPrediction',
        'subscriptionContinuationScorecard',
      ],
      decisionCategories: [
        'insufficient_evidence',
        'continue_collecting',
        'continue_mlb_only',
        'reduce_provider_scope',
        'replace_free_compatible_feeds',
        'pause_subscription',
        'proceed_toward_controlled_production_review',
      ],
    },
  }
}

export async function getDailyReport(bankroll = 1000) {
  const topPicks = await safeSection(
    'top picks',
    {
      success: false,
      sportKey: 'baseball_mlb',
      adaptiveWeightsAvailable: false,
      summary: {
        productionGateMode: PRODUCTION_DATA_GATE_V1_POLICY.mode,
        recommendationPolicyMode: 'recommendation_eligibility_policy_v1',
        automaticProductionApproval: false,
        calibrationStatus: 'probationary',
        pendingPicks: 0,
        safePendingPicks: 0,
        recommendedPicks: 0,
        officialQualifiedPicks: 0,
        watchCandidates: 0,
        topEvCount: 0,
        topConfidenceCount: 0,
        bestBetsCount: 0,
        sportsAvailable: [] as string[],
      },
      bestBets: [],
      topConfidence: [],
      topEv: [],
    },
    () => getTopPicks()
  )

  const portfolios = await safeSection(
    'portfolios',
    {
      success: false,
      bankroll,
      generatedAt: new Date().toISOString(),
      summary: {
        sourcePicks: 0,
        intelligencePicks: 0,
        bestSingles: 0,
        avoidList: 0,
      },
      portfolios: {},
      bestSingles: [],
      avoidList: [],
    } as any,
    () => buildPortfolios(bankroll)
  )

  const officialPickCount = Number(topPicks.summary?.recommendedPicks ?? 0)

  const sportsbook = await safeSection(
    'sportsbook intelligence',
    {
      success: false,
      sportKey: 'baseball_mlb',
      bankroll,
      generatedAt: new Date().toISOString(),
      summary: {
        averageLineValue: 0,
        averageSharpConfidence: 0,
      },
      lists: {
        betNow: [],
        bestOdds: [],
        bestClv: [],
        sharpMoney: [],
      },
    } as any,
    () =>
      officialPickCount
        ? getSportsbookIntelligence({
            sportKey: 'baseball_mlb',
            bankroll,
          })
        : Promise.resolve({
            success: true,
            sportKey: 'baseball_mlb',
            bankroll,
            generatedAt: new Date().toISOString(),
            summary: {
              averageLineValue: 0,
              averageSharpConfidence: 0,
            },
            lists: {
              betNow: [],
              bestOdds: [],
              bestClv: [],
              sharpMoney: [],
            },
          } as any)
  )

  const bankrollManager = await safeSection(
    'bankroll manager',
    {
      success: false,
      bankroll,
      riskMode: 'balanced',
      playOfTheDay: null,
      stakePlan: {
        exposurePercent: 0,
        exposureLevel: 'LOW',
        overExposure: false,
        picks: [],
      },
      portfolios: {},
    } as any,
    () =>
      getBankrollManager({
        amount: bankroll,
        mode: 'balanced',
      })
  )

  const calibration = await safeSection(
    'calibration',
    {
      success: false,
      overall: {
        calibrationScore: 0,
        modelStatus: 'INSUFFICIENT_DATA',
      },
    } as any,
    () => getModelCalibration()
  )

  const learnedWeights = await safeSection(
    'model weights',
    {
      homeAwayAdvantage: 1.05,
      headToHeadAdvantage: 1.15,
      pitcherAdvantage: 1.45,
      injuryImpact: 1.3,
      weatherImpact: 0.75,
    },
    () => getModelWeights('baseball_mlb')
  )

  const clv = await safeSection(
    'clv analytics',
    {
      success: false,
      summary: {
        averageClv: 0,
      },
    } as any,
    () => getClvAnalytics()
  )

  const topPickSource = [
    ...(topPicks.bestBets as ReportPick[]),
    ...(topPicks.topConfidence as ReportPick[]),
    ...(topPicks.topEv as ReportPick[]),
  ]

  const sportsbookSource = [
    ...(sportsbook.lists?.betNow ?? []),
    ...(sportsbook.lists?.bestOdds ?? []),
    ...(sportsbook.lists?.bestClv ?? []),
    ...(sportsbook.lists?.sharpMoney ?? []),
  ] as ReportPick[]

  const picks = dedupePicks([...topPickSource, ...sportsbookSource]).sort(
    sortByPremiumScore
  )

  const betNow = picks.filter((pick) => pick.bettingUrgency === 'BET_NOW')
  const sharpPicks = picks.filter((pick) => pick.sharpSignal)

  const avoidList = dedupePicks([
    ...((portfolios.avoidList ?? []) as ReportPick[]),
    ...picks.filter(
      (pick) =>
        pick.bettingUrgency === 'AVOID' ||
        pick.confidence < 60 ||
        pick.ev < 3 ||
        pick.edge < 3
    ),
  ]).slice(0, 10)

  const bestPortfolio =
    Object.values(portfolios.portfolios ?? {}).sort(
      (a: any, b: any) => (b.portfolioScore ?? 0) - (a.portfolioScore ?? 0)
    )[0] ?? null

  const riskAlerts: string[] = []

  for (const portfolio of Object.values(portfolios.portfolios ?? {}) as any[]) {
    if (portfolio?.correlationRiskLevel === 'HIGH') {
      riskAlerts.push(`${portfolio.name} portfolio has high correlation risk.`)
    }

    if (portfolio?.warnings?.length) {
      riskAlerts.push(`${portfolio.name}: ${portfolio.warnings[0]}`)
    }
  }

  if (bankrollManager.stakePlan?.overExposure) {
    riskAlerts.push('Bankroll Manager detected overexposure versus daily limit.')
  }

  if (calibration.overall?.modelStatus === 'NEEDS_RECALIBRATION') {
    riskAlerts.push('Model calibration needs recalibration before increasing stake sizes.')
  }

  return {
    success: true,
    bankroll,
    generatedAt: new Date().toISOString(),
    executiveSummary: getExecutiveSummary({
      totalPicks: picks.length,
      betNow: betNow.length,
      sharpSignals: sharpPicks.length,
      calibrationScore: calibration.overall?.calibrationScore ?? 0,
      learningRoi: 0,
    }),
    summary: {
      totalQualifiedPicks: picks.length,
      recommendedPicks: topPicks.summary?.recommendedPicks ?? 0,
      bestBets: topPicks.summary?.bestBetsCount ?? 0,
      betNow: betNow.length,
      sharpSignals: sharpPicks.length,
      bestSingles: portfolios.bestSingles?.length ?? 0,
      avoidList: avoidList.length,
      averageLineValue: sportsbook.summary?.averageLineValue ?? 0,
      averageSharpConfidence: sportsbook.summary?.averageSharpConfidence ?? 0,
      bankrollExposurePercent: bankrollManager.stakePlan?.exposurePercent ?? 0,
      bankrollExposureLevel: bankrollManager.stakePlan?.exposureLevel ?? 'LOW',
      clvAverage: clv.summary?.averageClv ?? 0,
      calibrationScore: calibration.overall?.calibrationScore ?? 0,
      modelStatus: calibration.overall?.modelStatus ?? 'INSUFFICIENT_DATA',
    },
    todayCard: {
      playOfTheDay: bankrollManager.playOfTheDay
        ? {
            ...bankrollManager.playOfTheDay,
            explanation: explainPick(bankrollManager.playOfTheDay),
          }
        : null,
      bestUnderdog: mapPick(getBestUnderdog(picks)),
      bestFavorite: mapPick(getBestFavorite(picks)),
      highestEv: mapPick(getHighestEv(picks)),
      highestConfidence: mapPick(getHighestConfidence(picks)),
      bestSharp: mapPick(getBestSharp(picks)),
      bestClv: mapPick(getBestClv(picks)),
    },
    bankrollPlan: bankrollManager.stakePlan,
    bestPortfolio,
    portfolios: portfolios.portfolios ?? {},
    topSingles: (portfolios.bestSingles ?? []).slice(0, 10),
    sharpMoneyPlays: (sportsbook.lists?.sharpMoney ?? []).slice(0, 10),
    bestClvPlays: (sportsbook.lists?.bestClv ?? []).slice(0, 10),
    avoidList,
    modelHealth: {
      calibration: calibration.overall,
      learnedWeights,
      clv: clv.summary,
    },
    mlbValidation: getMlbValidationReportSection(),
    riskAlerts: [...new Set(riskAlerts)].slice(0, 8),
    notes: [
      'Use portfolio recommendations as decision support, not guaranteed outcomes.',
      'Prioritize singles over parlays when model calibration has insufficient data.',
      'Avoid increasing exposure when risk alerts mention concentration, correlation or negative ROI.',
      'Always verify the sportsbook line is still available before betting.',
    ],
  }
}
