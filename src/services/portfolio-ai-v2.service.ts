import { getTopPicks } from '@/services/top-picks.service'

export type PortfolioMode =
  | 'low_variance'
  | 'income'
  | 'balanced'
  | 'growth'
  | 'high_ev'
  | 'singles_only'
  | 'cross_sport'

export type PortfolioRisk = 'low' | 'medium' | 'high'

type PortfolioPick = {
  id?: string
  sport_key: string
  game_id?: string
  commence_time?: string
  team: string
  opponent: string
  market?: string
  sportsbook?: string
  odds: number
  model_probability: number
  implied_probability: number
  confidence: number
  edge: number
  ev: number
  smart_score?: number
  adaptive_score?: number
  risk_grade?: string
  risk_label?: string
}

type BuildPortfolioInput = {
  bankroll?: number
  targetProfit?: number
  sportKey?: string
  mode?: PortfolioMode
  risk?: PortfolioRisk
  maxExposurePercent?: number
  maxSelections?: number
}

type EnrichedPick = PortfolioPick & {
  aiScore: number
  riskScore: number
  decimalOdds: number
  formattedOdds: string
  suggestedStake: number
  expectedProfit: number
  potentialProfit: number
  potentialPayout: number
}

function round(value: number) {
  return Number(value.toFixed(2))
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function decimalOdds(americanOdds: number) {
  if (americanOdds > 0) {
    return 1 + americanOdds / 100
  }

  if (americanOdds < 0) {
    return 1 + 100 / Math.abs(americanOdds)
  }

  return 1
}

function formatOdds(americanOdds: number) {
  return americanOdds > 0
    ? `+${americanOdds}`
    : `${americanOdds}`
}

function normalize(value?: string) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}

function uniquePicks(rows: PortfolioPick[]) {
  const seen = new Set<string>()

  return rows.filter((pick) => {
    const key = [
      pick.sport_key,
      pick.game_id ?? '',
      normalize(pick.team),
      normalize(pick.opponent),
      pick.market ?? 'moneyline',
      pick.odds,
    ].join(':')

    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function calculateAiScore(pick: PortfolioPick) {
  const adaptive = Number(
    pick.adaptive_score ??
      pick.smart_score ??
      0
  )

  return round(
    clamp(
      adaptive * 0.34 +
        Number(pick.confidence ?? 0) * 0.27 +
        Number(pick.ev ?? 0) * 0.22 +
        Number(pick.edge ?? 0) * 0.17,
      0,
      100
    )
  )
}

function calculateRiskScore(pick: PortfolioPick) {
  const confidence = Number(pick.confidence ?? 0)
  const ev = Number(pick.ev ?? 0)
  const edge = Number(pick.edge ?? 0)
  const odds = Number(pick.odds ?? 0)

  const confidenceRisk = Math.max(0, 72 - confidence)

  const oddsRisk =
    odds >= 500
      ? 38
      : odds >= 300
        ? 30
        : odds >= 200
          ? 22
          : odds >= 100
            ? 15
            : odds >= -120
              ? 10
              : 5

  const valueProtection =
    Math.max(ev, 0) * 0.7 +
    Math.max(edge, 0) * 1.1

  return round(
    clamp(
      confidenceRisk +
        oddsRisk -
        valueProtection,
      0,
      100
    )
  )
}

function scoreByMode(
  pick: PortfolioPick,
  mode: PortfolioMode
) {
  const ai = calculateAiScore(pick)
  const risk = calculateRiskScore(pick)
  const confidence = Number(pick.confidence ?? 0)
  const ev = Number(pick.ev ?? 0)
  const edge = Number(pick.edge ?? 0)
  const odds = Number(pick.odds ?? 0)

  if (mode === 'low_variance') {
    return (
      confidence * 0.42 +
      ai * 0.28 +
      edge * 0.18 +
      ev * 0.12 -
      risk * 0.3
    )
  }

  if (mode === 'income') {
    return (
      confidence * 0.34 +
      ai * 0.28 +
      ev * 0.18 +
      edge * 0.2 -
      risk * 0.22
    )
  }

  if (mode === 'growth') {
    return (
      ai * 0.3 +
      ev * 0.32 +
      edge * 0.22 +
      confidence * 0.16 -
      risk * 0.12
    )
  }

  if (mode === 'high_ev') {
    return (
      ev * 0.44 +
      edge * 0.25 +
      ai * 0.2 +
      confidence * 0.11 -
      risk * 0.08
    )
  }

  if (mode === 'singles_only') {
    return (
      ai * 0.34 +
      confidence * 0.3 +
      ev * 0.2 +
      edge * 0.16 -
      risk * 0.18
    )
  }

  if (mode === 'cross_sport') {
    return (
      ai * 0.32 +
      confidence * 0.25 +
      ev * 0.25 +
      edge * 0.18 -
      risk * 0.14 +
      (odds > 0 ? 2 : 0)
    )
  }

  return (
    ai * 0.34 +
    confidence * 0.24 +
    ev * 0.24 +
    edge * 0.18 -
    risk * 0.16
  )
}

function qualifiesForMode(
  pick: PortfolioPick,
  mode: PortfolioMode,
  risk: PortfolioRisk
) {
  const confidence = Number(pick.confidence ?? 0)
  const ev = Number(pick.ev ?? 0)
  const edge = Number(pick.edge ?? 0)
  const odds = Number(pick.odds ?? 0)
  const riskScore = calculateRiskScore(pick)

  if (mode === 'low_variance') {
    return (
      confidence >= 68 &&
      ev >= 3 &&
      edge >= 3 &&
      odds < 220 &&
      riskScore <= 42
    )
  }

  if (mode === 'income') {
    return (
      confidence >= 65 &&
      ev >= 4 &&
      edge >= 4 &&
      odds < 260 &&
      riskScore <= 50
    )
  }

  if (mode === 'growth') {
    return (
      confidence >= 60 &&
      ev >= 5 &&
      edge >= 3 &&
      odds < 450 &&
      riskScore <= 68
    )
  }

  if (mode === 'high_ev') {
    return (
      confidence >= 55 &&
      ev >= 7 &&
      edge >= 4 &&
      odds < 700 &&
      riskScore <= 78
    )
  }

  if (mode === 'singles_only') {
    return (
      confidence >= 62 &&
      ev >= 3 &&
      edge >= 3 &&
      odds < 400 &&
      riskScore <= 65
    )
  }

  if (risk === 'low') {
    return (
      confidence >= 67 &&
      ev >= 4 &&
      edge >= 4 &&
      odds < 250 &&
      riskScore <= 45
    )
  }

  if (risk === 'high') {
    return (
      confidence >= 55 &&
      ev >= 2 &&
      edge >= 2 &&
      odds < 700 &&
      riskScore <= 80
    )
  }

  return (
    confidence >= 61 &&
    ev >= 3 &&
    edge >= 3 &&
    odds < 450 &&
    riskScore <= 65
  )
}

function sameGame(
  first: PortfolioPick,
  second: PortfolioPick
) {
  if (
    first.game_id &&
    second.game_id &&
    first.game_id === second.game_id
  ) {
    return true
  }

  const firstTeams = [
    normalize(first.team),
    normalize(first.opponent),
  ]

  const secondTeams = [
    normalize(second.team),
    normalize(second.opponent),
  ]

  return firstTeams.some((team) =>
    secondTeams.includes(team)
  )
}

function selectDiversifiedPicks({
  candidates,
  maxSelections,
  mode,
}: {
  candidates: PortfolioPick[]
  maxSelections: number
  mode: PortfolioMode
}) {
  const selected: PortfolioPick[] = []
  const sportCounts = new Map<string, number>()

  for (const candidate of candidates) {
    if (selected.length >= maxSelections) {
      break
    }

    const hasConflict = selected.some((pick) =>
      sameGame(pick, candidate)
    )

    if (hasConflict) {
      continue
    }

    if (mode === 'cross_sport') {
      const count =
        sportCounts.get(candidate.sport_key) ?? 0

      if (count >= 2) {
        continue
      }
    }

    selected.push(candidate)

    sportCounts.set(
      candidate.sport_key,
      (sportCounts.get(candidate.sport_key) ?? 0) + 1
    )
  }

  return selected
}

function calculateKellyFraction(pick: PortfolioPick) {
  const decimal = decimalOdds(pick.odds)
  const probability =
    Number(
      pick.model_probability ??
        pick.confidence ??
        0
    ) / 100

  const b = decimal - 1
  const q = 1 - probability

  if (b <= 0) {
    return 0
  }

  return clamp((b * probability - q) / b, 0, 0.05)
}

function getModeStakeMultiplier(mode: PortfolioMode) {
  if (mode === 'low_variance') return 0.25
  if (mode === 'income') return 0.35
  if (mode === 'balanced') return 0.5
  if (mode === 'growth') return 0.65
  if (mode === 'high_ev') return 0.75
  if (mode === 'singles_only') return 0.5
  return 0.45
}

function getPickWeight(
  pick: PortfolioPick,
  mode: PortfolioMode
) {
  const modeScore = Math.max(
    scoreByMode(pick, mode),
    1
  )

  const kelly = calculateKellyFraction(pick)

  return modeScore * (1 + kelly * 10)
}

function buildEnrichedPicks({
  selected,
  bankroll,
  maximumExposure,
  mode,
}: {
  selected: PortfolioPick[]
  bankroll: number
  maximumExposure: number
  mode: PortfolioMode
}): EnrichedPick[] {
  const weights = selected.map((pick) =>
    getPickWeight(pick, mode)
  )

  const totalWeight = weights.reduce(
    (sum, weight) => sum + weight,
    0
  )

  return selected.map((pick, index) => {
    const weight =
      totalWeight > 0
        ? weights[index] / totalWeight
        : 1 / Math.max(selected.length, 1)

    const stake = round(
      maximumExposure *
        weight *
        getModeStakeMultiplier(mode)
    )

    const decimal = decimalOdds(pick.odds)
    const potentialPayout = round(stake * decimal)
    const potentialProfit = round(
      potentialPayout - stake
    )

    return {
      ...pick,
      aiScore: calculateAiScore(pick),
      riskScore: calculateRiskScore(pick),
      decimalOdds: round(decimal),
      formattedOdds: formatOdds(pick.odds),
      suggestedStake: stake,
      expectedProfit: round(
        stake * (Number(pick.ev ?? 0) / 100)
      ),
      potentialProfit,
      potentialPayout,
    }
  })
}

function buildMiniParlay({
  picks,
  bankroll,
  mode,
  enabled,
}: {
  picks: EnrichedPick[]
  bankroll: number
  mode: PortfolioMode
  enabled: boolean
}) {
  if (
    !enabled ||
    mode === 'singles_only' ||
    picks.length < 2
  ) {
    return {
      available: false,
      legs: 0,
      picks: [] as EnrichedPick[],
      decimalOdds: 1,
      americanOdds: 0,
      probability: 0,
      expectedValue: 0,
      stake: 0,
      potentialPayout: 0,
      potentialProfit: 0,
      expectedProfit: 0,
      riskScore: 100,
      riskLevel: 'HIGH',
    }
  }

  const legCount =
    mode === 'low_variance'
      ? 2
      : Math.min(3, picks.length)

  const legs = picks.slice(0, legCount)

  let combinedDecimal = 1
  let combinedProbability = 1

  for (const pick of legs) {
    combinedDecimal *= pick.decimalOdds
    combinedProbability *=
      Number(
        pick.model_probability ??
          pick.confidence ??
          0
      ) / 100
  }

  const expectedValue = round(
    (
      combinedProbability *
        (combinedDecimal - 1) -
      (1 - combinedProbability)
    ) * 100
  )

  const stakePercent =
    mode === 'low_variance'
      ? 0.003
      : mode === 'income'
        ? 0.005
        : mode === 'high_ev'
          ? 0.012
          : 0.008

  const stake = round(bankroll * stakePercent)
  const potentialPayout = round(
    stake * combinedDecimal
  )

  const averageRisk =
    legs.reduce(
      (sum, pick) => sum + pick.riskScore,
      0
    ) / Math.max(legs.length, 1)

  const riskScore = round(
    clamp(
      averageRisk +
        Math.max(0, legs.length - 1) * 14,
      0,
      100
    )
  )

  return {
    available: true,
    legs: legs.length,
    picks: legs,
    decimalOdds: round(combinedDecimal),
    americanOdds:
      combinedDecimal >= 2
        ? round((combinedDecimal - 1) * 100)
        : round(-100 / (combinedDecimal - 1)),
    probability: round(
      combinedProbability * 100
    ),
    expectedValue,
    stake,
    potentialPayout,
    potentialProfit: round(
      potentialPayout - stake
    ),
    expectedProfit: round(
      stake * (expectedValue / 100)
    ),
    riskScore,
    riskLevel:
      riskScore >= 70
        ? 'HIGH'
        : riskScore >= 45
          ? 'MEDIUM'
          : 'LOW',
  }
}

function buildCorrelationSummary(
  picks: PortfolioPick[]
) {
  let sameSportPairs = 0
  let conflictPairs = 0
  let totalPairs = 0

  for (let first = 0; first < picks.length; first++) {
    for (
      let second = first + 1;
      second < picks.length;
      second++
    ) {
      totalPairs += 1

      if (
        picks[first].sport_key ===
        picks[second].sport_key
      ) {
        sameSportPairs += 1
      }

      if (sameGame(picks[first], picks[second])) {
        conflictPairs += 1
      }
    }
  }

  const score =
    totalPairs > 0
      ? round(
          clamp(
            (sameSportPairs / totalPairs) * 35 +
              conflictPairs * 40,
            0,
            100
          )
        )
      : 0

  return {
    score,
    level:
      score >= 70
        ? 'HIGH'
        : score >= 35
          ? 'MEDIUM'
          : 'LOW',
    sameSportPairs,
    conflictPairs,
    totalPairs,
  }
}

function modeLabel(mode: PortfolioMode) {
  const labels: Record<PortfolioMode, string> = {
    low_variance: 'Low Variance',
    income: 'Income',
    balanced: 'Balanced',
    growth: 'Growth',
    high_ev: 'High EV',
    singles_only: 'Singles Only',
    cross_sport: 'Cross-Sport',
  }

  return labels[mode]
}

export async function buildPortfolioAIV2({
  bankroll = 1000,
  targetProfit = 100,
  sportKey = 'baseball_mlb',
  mode = 'balanced',
  risk = 'medium',
  maxExposurePercent = 7,
  maxSelections = 6,
}: BuildPortfolioInput = {}) {
  const safeBankroll = clamp(
    Number(bankroll) || 1000,
    50,
    1_000_000
  )

  const safeTargetProfit = clamp(
    Number(targetProfit) || 0,
    0,
    safeBankroll * 3
  )

  const safeExposurePercent = clamp(
    Number(maxExposurePercent) || 7,
    1,
    risk === 'low'
      ? 6
      : risk === 'high'
        ? 15
        : 10
  )

  const safeSelections = Math.round(
    clamp(Number(maxSelections) || 6, 2, 12)
  )

  const requestedSport =
    mode === 'cross_sport'
      ? 'all'
      : sportKey

  const topPicks = await getTopPicks(
    requestedSport
  )

  const pool = uniquePicks([
    ...topPicks.bestBets,
    ...topPicks.topEv,
    ...topPicks.topConfidence,
  ] as PortfolioPick[])

  const qualified = pool
    .filter((pick) =>
      qualifiesForMode(pick, mode, risk)
    )
    .sort(
      (first, second) =>
        scoreByMode(second, mode) -
          scoreByMode(first, mode) ||
        second.ev - first.ev ||
        second.confidence - first.confidence
    )

  const selected = selectDiversifiedPicks({
    candidates: qualified,
    maxSelections: safeSelections,
    mode,
  })

  const exposureLimit = round(
    safeBankroll *
      (safeExposurePercent / 100)
  )

  const singlesExposure =
    mode === 'singles_only'
      ? exposureLimit
      : exposureLimit * 0.82

  const singles = buildEnrichedPicks({
    selected,
    bankroll: safeBankroll,
    maximumExposure: singlesExposure,
    mode,
  })

  const miniParlay = buildMiniParlay({
    picks: singles,
    bankroll: safeBankroll,
    mode,
    enabled: mode !== 'singles_only',
  })

  const rawTotalStake =
    singles.reduce(
      (sum, pick) =>
        sum + pick.suggestedStake,
      0
    ) + miniParlay.stake

  const scale =
    rawTotalStake > exposureLimit &&
    rawTotalStake > 0
      ? exposureLimit / rawTotalStake
      : 1

  const scaledSingles = singles.map((pick) => ({
    ...pick,
    suggestedStake: round(
      pick.suggestedStake * scale
    ),
    expectedProfit: round(
      pick.expectedProfit * scale
    ),
    potentialProfit: round(
      pick.potentialProfit * scale
    ),
    potentialPayout: round(
      pick.potentialPayout * scale
    ),
  }))

  const scaledParlay = {
    ...miniParlay,
    stake: round(miniParlay.stake * scale),
    potentialPayout: round(
      miniParlay.potentialPayout * scale
    ),
    potentialProfit: round(
      miniParlay.potentialProfit * scale
    ),
    expectedProfit: round(
      miniParlay.expectedProfit * scale
    ),
  }

  const totalStake = round(
    scaledSingles.reduce(
      (sum, pick) =>
        sum + pick.suggestedStake,
      0
    ) + scaledParlay.stake
  )

  const expectedProfit = round(
    scaledSingles.reduce(
      (sum, pick) =>
        sum + pick.expectedProfit,
      0
    ) + scaledParlay.expectedProfit
  )

  const maximumProfit = round(
    scaledSingles.reduce(
      (sum, pick) =>
        sum + pick.potentialProfit,
      0
    ) + scaledParlay.potentialProfit
  )

  const averageConfidence =
    scaledSingles.length > 0
      ? scaledSingles.reduce(
          (sum, pick) =>
            sum + Number(pick.confidence ?? 0),
          0
        ) / scaledSingles.length
      : 0

  const averageEv =
    scaledSingles.length > 0
      ? scaledSingles.reduce(
          (sum, pick) =>
            sum + Number(pick.ev ?? 0),
          0
        ) / scaledSingles.length
      : 0

  const averageRisk =
    scaledSingles.length > 0
      ? scaledSingles.reduce(
          (sum, pick) =>
            sum + pick.riskScore,
          0
        ) / scaledSingles.length
      : 100

  const correlation =
    buildCorrelationSummary(selected)

  const diversificationScore = round(
    clamp(
      100 -
        correlation.score -
        Math.max(
          0,
          4 - new Set(
            selected.map(
              (pick) => pick.sport_key
            )
          ).size
        ) *
          (mode === 'cross_sport' ? 8 : 2),
      0,
      100
    )
  )

  const probabilityPositive = round(
    clamp(
      averageConfidence * 0.72 +
        Math.max(averageEv, 0) * 0.8 -
        averageRisk * 0.16 -
        correlation.score * 0.08 +
        diversificationScore * 0.08,
      0,
      95
    )
  )

  const targetCoverage =
    safeTargetProfit > 0
      ? round(
          clamp(
            (maximumProfit /
              safeTargetProfit) *
              100,
            0,
            250
          )
        )
      : 100

  const portfolioScore = round(
    clamp(
      averageConfidence * 0.28 +
        Math.max(averageEv, 0) * 1.6 +
        diversificationScore * 0.24 +
        (100 - averageRisk) * 0.26 -
        correlation.score * 0.12,
      0,
      100
    )
  )

  const portfolioRisk = round(
    clamp(
      averageRisk * 0.65 +
        correlation.score * 0.2 +
        (scaledParlay.available
          ? scaledParlay.riskScore * 0.15
          : 0),
      0,
      100
    )
  )

  const warnings: string[] = []

  if (selected.length < 2) {
    warnings.push(
      'Not enough independent qualified picks are available for a diversified portfolio.'
    )
  }

  if (correlation.level === 'HIGH') {
    warnings.push(
      'Portfolio correlation is high. Reduce selections from the same sport or matchup.'
    )
  }

  if (
    safeTargetProfit > 0 &&
    maximumProfit < safeTargetProfit
  ) {
    warnings.push(
      'The requested target profit exceeds the projected maximum profit of this controlled portfolio.'
    )
  }

  if (mode === 'high_ev') {
    warnings.push(
      'High EV mode accepts higher variance and may produce larger short-term drawdowns.'
    )
  }

  const status =
    selected.length === 0
      ? 'NO_QUALIFIED_PICKS'
      : targetCoverage >= 100 &&
          probabilityPositive >= 62
        ? 'TARGET_SUPPORTED'
        : targetCoverage >= 70
          ? 'TARGET_AGGRESSIVE'
          : 'TARGET_UNREALISTIC'

  return {
    success: true,
    generatedAt: new Date().toISOString(),
    mode: 'portfolio_ai_v2',

    request: {
      bankroll: safeBankroll,
      targetProfit: safeTargetProfit,
      sportKey: requestedSport,
      portfolioMode: mode,
      portfolioModeLabel: modeLabel(mode),
      risk,
      maxExposurePercent:
        safeExposurePercent,
      maxSelections: safeSelections,
    },

    summary: {
      scannedPicks: pool.length,
      qualifiedPicks: qualified.length,
      selectedPicks: selected.length,
      sportsRepresented: [
        ...new Set(
          selected.map(
            (pick) => pick.sport_key
          )
        ),
      ],
      totalStake,
      exposurePercent: round(
        (totalStake / safeBankroll) * 100
      ),
      expectedProfit,
      projectedMaximumProfit: maximumProfit,
      remainingBankroll: round(
        safeBankroll - totalStake
      ),
      averageConfidence: round(
        averageConfidence
      ),
      averageEv: round(averageEv),
      probabilityPositive,
      targetCoverage,
      portfolioScore,
      portfolioRisk,
      portfolioRiskLevel:
        portfolioRisk >= 70
          ? 'HIGH'
          : portfolioRisk >= 45
            ? 'MEDIUM'
            : 'LOW',
      diversificationScore,
      correlation,
      status,
    },

    allocations: {
      singles: scaledSingles,
      miniParlay: scaledParlay,
    },

    warnings,

    conclusion:
      selected.length === 0
        ? 'No picks currently satisfy the selected portfolio rules.'
        : `${modeLabel(
            mode
          )} portfolio created with ${
            selected.length
          } selections, ${round(
            (totalStake / safeBankroll) * 100
          )}% bankroll exposure and ${probabilityPositive}% estimated probability of finishing positive.`,
  }
}