import { getTopPicks } from '@/services/top-picks.service'

type RiskPreference = 'low' | 'medium' | 'high'

type SportsBrainPick = {
  id?: string
  sport_key: string
  game_id?: string
  team: string
  opponent: string
  sportsbook?: string
  market?: string
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

type StrategyInput = {
  bankroll?: number
  targetProfit?: number
  riskPreference?: RiskPreference
  maxParlayLegs?: number
  sportKey?: string
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

  return 1 + 100 / Math.abs(americanOdds)
}

function americanFromDecimal(decimal: number) {
  if (decimal <= 1) return 0

  if (decimal >= 2) {
    return round((decimal - 1) * 100)
  }

  return round(-100 / (decimal - 1))
}

function formatOdds(value: number) {
  return value > 0 ? `+${value}` : `${value}`
}

function uniquePicks(rows: SportsBrainPick[]) {
  const seen = new Set<string>()

  return rows.filter((pick) => {
    const key = [
      pick.sport_key,
      pick.game_id ?? '',
      pick.team,
      pick.opponent,
      pick.market ?? 'moneyline',
      pick.odds,
    ]
      .join(':')
      .toLowerCase()

    if (seen.has(key)) return false

    seen.add(key)
    return true
  })
}

function getPickScore(pick: SportsBrainPick) {
  const adaptive = Number(
    pick.adaptive_score ?? pick.smart_score ?? 0
  )

  return round(
    adaptive * 0.34 +
      Number(pick.confidence ?? 0) * 0.25 +
      Number(pick.ev ?? 0) * 0.23 +
      Number(pick.edge ?? 0) * 0.18
  )
}

function getRiskScore(pick: SportsBrainPick) {
  const confidenceRisk = Math.max(
    0,
    70 - Number(pick.confidence ?? 0)
  )

  const oddsRisk =
    pick.odds >= 300
      ? 30
      : pick.odds >= 200
        ? 20
        : pick.odds >= 100
          ? 12
          : 5

  const edgeProtection = Math.max(
    0,
    Number(pick.edge ?? 0) * 1.2
  )

  const evProtection = Math.max(
    0,
    Number(pick.ev ?? 0) * 0.6
  )

  return round(
    clamp(
      confidenceRisk +
        oddsRisk -
        edgeProtection -
        evProtection,
      0,
      100
    )
  )
}

function qualifiesForRisk(
  pick: SportsBrainPick,
  riskPreference: RiskPreference
) {
  const score = getPickScore(pick)
  const risk = getRiskScore(pick)

  if (riskPreference === 'low') {
    return (
      pick.confidence >= 68 &&
      pick.edge >= 4 &&
      pick.ev >= 4 &&
      pick.odds < 220 &&
      score >= 52 &&
      risk <= 45
    )
  }

  if (riskPreference === 'high') {
    return (
      pick.confidence >= 56 &&
      pick.edge >= 2 &&
      pick.ev >= 2 &&
      pick.odds < 600 &&
      score >= 40 &&
      risk <= 75
    )
  }

  return (
    pick.confidence >= 62 &&
    pick.edge >= 3 &&
    pick.ev >= 3 &&
    pick.odds < 350 &&
    score >= 46 &&
    risk <= 60
  )
}

function calculateKellyFraction(pick: SportsBrainPick) {
  const decimal = decimalOdds(pick.odds)
  const probability =
    Number(
      pick.model_probability ?? pick.confidence ?? 0
    ) / 100

  const b = decimal - 1
  const q = 1 - probability

  if (b <= 0) return 0

  return clamp((b * probability - q) / b, 0, 0.05)
}

function getStakeMultiplier(riskPreference: RiskPreference) {
  if (riskPreference === 'low') return 0.25
  if (riskPreference === 'high') return 0.75
  return 0.5
}

function buildSingle({
  pick,
  bankroll,
  riskPreference,
}: {
  pick: SportsBrainPick
  bankroll: number
  riskPreference: RiskPreference
}) {
  const kellyFraction = calculateKellyFraction(pick)

  const baseStake =
    bankroll *
    kellyFraction *
    getStakeMultiplier(riskPreference)

  const maximumPercent =
    riskPreference === 'low'
      ? 0.015
      : riskPreference === 'high'
        ? 0.035
        : 0.025

  const stake = round(
    clamp(
      baseStake || bankroll * 0.005,
      Math.min(2, bankroll * 0.0025),
      bankroll * maximumPercent
    )
  )

  const decimal = decimalOdds(pick.odds)
  const potentialPayout = round(stake * decimal)
  const potentialProfit = round(potentialPayout - stake)

  return {
    ...pick,
    formattedOdds: formatOdds(pick.odds),
    aiScore: getPickScore(pick),
    riskScore: getRiskScore(pick),
    stake,
    potentialPayout,
    potentialProfit,
    expectedProfit: round(stake * (pick.ev / 100)),
    kellyFraction: round(kellyFraction * 100),
  }
}

function hasGameConflict(
  selected: SportsBrainPick[],
  candidate: SportsBrainPick
) {
  return selected.some((pick) => {
    if (
      pick.game_id &&
      candidate.game_id &&
      pick.game_id === candidate.game_id
    ) {
      return true
    }

    const pickTeams = [
      pick.team.toLowerCase(),
      pick.opponent.toLowerCase(),
    ]

    return (
      pickTeams.includes(candidate.team.toLowerCase()) ||
      pickTeams.includes(candidate.opponent.toLowerCase())
    )
  })
}

function buildParlay({
  candidates,
  bankroll,
  riskPreference,
  maxLegs,
}: {
  candidates: SportsBrainPick[]
  bankroll: number
  riskPreference: RiskPreference
  maxLegs: number
}) {
  const selected: SportsBrainPick[] = []

  for (const candidate of candidates) {
    if (selected.length >= maxLegs) break
    if (hasGameConflict(selected, candidate)) continue

    selected.push(candidate)
  }

  let combinedDecimal = 1
  let combinedProbability = 1

  for (const pick of selected) {
    combinedDecimal *= decimalOdds(pick.odds)

    combinedProbability *=
      Number(
        pick.model_probability ?? pick.confidence ?? 0
      ) / 100
  }

  const combinedEv = round(
    (
      combinedProbability * (combinedDecimal - 1) -
      (1 - combinedProbability)
    ) * 100
  )

  const maximumStakePercent =
    riskPreference === 'low'
      ? 0.005
      : riskPreference === 'high'
        ? 0.015
        : 0.01

  const stake = round(
    selected.length >= 2
      ? bankroll * maximumStakePercent
      : 0
  )

  const payout = round(stake * combinedDecimal)
  const profit = round(payout - stake)

  const averageScore =
    selected.length > 0
      ? selected.reduce(
          (sum, pick) => sum + getPickScore(pick),
          0
        ) / selected.length
      : 0

  const averageRisk =
    selected.length > 0
      ? selected.reduce(
          (sum, pick) => sum + getRiskScore(pick),
          0
        ) / selected.length
      : 100

  const ticketRisk = round(
    clamp(
      averageRisk +
        Math.max(0, selected.length - 1) * 12,
      0,
      100
    )
  )

  return {
    available: selected.length >= 2,
    legs: selected.length,
    picks: selected.map((pick) => ({
      ...pick,
      formattedOdds: formatOdds(pick.odds),
      aiScore: getPickScore(pick),
      riskScore: getRiskScore(pick),
    })),
    decimalOdds: round(combinedDecimal),
    americanOdds: americanFromDecimal(combinedDecimal),
    probability: round(combinedProbability * 100),
    expectedValue: combinedEv,
    stake,
    potentialPayout: payout,
    potentialProfit: profit,
    expectedProfit: round(stake * (combinedEv / 100)),
    ticketScore: round(
      clamp(
        averageScore -
          Math.max(0, selected.length - 2) * 4,
        0,
        100
      )
    ),
    riskScore: ticketRisk,
    riskLevel:
      ticketRisk >= 70
        ? 'HIGH'
        : ticketRisk >= 45
          ? 'MEDIUM'
          : 'LOW',
  }
}

function getExposureLimit(
  bankroll: number,
  riskPreference: RiskPreference
) {
  if (riskPreference === 'low') return bankroll * 0.04
  if (riskPreference === 'high') return bankroll * 0.1
  return bankroll * 0.07
}

function buildWarnings({
  picksAvailable,
  totalExposurePercent,
  riskPreference,
  targetProfit,
  projectedMaximumProfit,
}: {
  picksAvailable: number
  totalExposurePercent: number
  riskPreference: RiskPreference
  targetProfit: number
  projectedMaximumProfit: number
}) {
  const warnings: string[] = []

  if (picksAvailable < 2) {
    warnings.push(
      'There are not enough qualified independent picks to build a diversified strategy.'
    )
  }

  if (totalExposurePercent > 10) {
    warnings.push(
      'Recommended exposure exceeds 10% of bankroll and should be reduced.'
    )
  }

  if (
    targetProfit > 0 &&
    targetProfit > projectedMaximumProfit
  ) {
    warnings.push(
      'The requested profit target is higher than the projected maximum profit of the selected strategy.'
    )
  }

  if (riskPreference === 'high') {
    warnings.push(
      'High-risk mode increases variance and does not guarantee a higher realized return.'
    )
  }

  return warnings
}

export async function getAISportsBrainStrategy({
  bankroll = 1000,
  targetProfit = 100,
  riskPreference = 'medium',
  maxParlayLegs = 3,
  sportKey = 'baseball_mlb',
}: StrategyInput = {}) {
  const safeBankroll = clamp(Number(bankroll) || 1000, 50, 1_000_000)

  const safeTargetProfit = clamp(
    Number(targetProfit) || 0,
    0,
    safeBankroll * 2
  )

  const safeMaxLegs = Math.round(
    clamp(Number(maxParlayLegs) || 3, 2, 4)
  )

  const topPicks = await getTopPicks(sportKey)

  const pool = uniquePicks([
    ...topPicks.bestBets,
    ...topPicks.topEv,
    ...topPicks.topConfidence,
  ] as SportsBrainPick[])

  const qualified = pool
    .filter((pick) =>
      qualifiesForRisk(pick, riskPreference)
    )
    .sort(
      (a, b) =>
        getPickScore(b) - getPickScore(a) ||
        b.ev - a.ev ||
        b.confidence - a.confidence
    )

  const desiredSingles =
    riskPreference === 'low'
      ? 3
      : riskPreference === 'high'
        ? 2
        : 3

  const singles = qualified
    .slice(0, desiredSingles)
    .map((pick) =>
      buildSingle({
        pick,
        bankroll: safeBankroll,
        riskPreference,
      })
    )

  const parlayCandidates = qualified.filter(
    (candidate) =>
      !singles.some(
        (single) =>
          single.game_id &&
          candidate.game_id &&
          single.game_id === candidate.game_id
      )
  )

  const parlay = buildParlay({
    candidates:
      parlayCandidates.length >= 2
        ? parlayCandidates
        : qualified,
    bankroll: safeBankroll,
    riskPreference,
    maxLegs: safeMaxLegs,
  })

  const exposureLimit = getExposureLimit(
    safeBankroll,
    riskPreference
  )

  const singlesExposure = singles.reduce(
    (sum, pick) => sum + pick.stake,
    0
  )

  const requestedExposure =
    singlesExposure + parlay.stake

  const exposureScale =
    requestedExposure > exposureLimit &&
    requestedExposure > 0
      ? exposureLimit / requestedExposure
      : 1

  const adjustedSingles = singles.map((pick) => ({
    ...pick,
    stake: round(pick.stake * exposureScale),
    potentialPayout: round(
      pick.potentialPayout * exposureScale
    ),
    potentialProfit: round(
      pick.potentialProfit * exposureScale
    ),
    expectedProfit: round(
      pick.expectedProfit * exposureScale
    ),
  }))

  const adjustedParlay = {
    ...parlay,
    stake: round(parlay.stake * exposureScale),
    potentialPayout: round(
      parlay.potentialPayout * exposureScale
    ),
    potentialProfit: round(
      parlay.potentialProfit * exposureScale
    ),
    expectedProfit: round(
      parlay.expectedProfit * exposureScale
    ),
  }

  const totalStake = round(
    adjustedSingles.reduce(
      (sum, pick) => sum + pick.stake,
      0
    ) + adjustedParlay.stake
  )

  const expectedProfit = round(
    adjustedSingles.reduce(
      (sum, pick) => sum + pick.expectedProfit,
      0
    ) + adjustedParlay.expectedProfit
  )

  const maximumProfit = round(
    adjustedSingles.reduce(
      (sum, pick) => sum + pick.potentialProfit,
      0
    ) + adjustedParlay.potentialProfit
  )

  const averageSingleProbability =
    adjustedSingles.length > 0
      ? adjustedSingles.reduce(
          (sum, pick) =>
            sum +
            Number(
              pick.model_probability ??
                pick.confidence ??
                0
            ),
          0
        ) / adjustedSingles.length
      : 0

  const probabilityPositive = round(
    clamp(
      averageSingleProbability * 0.7 +
        (adjustedParlay.available
          ? adjustedParlay.probability * 0.15
          : 0) +
        Math.min(expectedProfit, 25) * 0.6,
      0,
      95
    )
  )

  const targetCoverage =
    safeTargetProfit > 0
      ? round(
          clamp(
            (maximumProfit / safeTargetProfit) * 100,
            0,
            200
          )
        )
      : 100

  const totalExposurePercent = round(
    (totalStake / safeBankroll) * 100
  )

  const warnings = buildWarnings({
    picksAvailable: qualified.length,
    totalExposurePercent,
    riskPreference,
    targetProfit: safeTargetProfit,
    projectedMaximumProfit: maximumProfit,
  })

  const status =
    qualified.length === 0
      ? 'NO_QUALIFIED_PICKS'
      : targetCoverage >= 100 &&
          probabilityPositive >= 65
        ? 'TARGET_SUPPORTED'
        : targetCoverage >= 70
          ? 'TARGET_AGGRESSIVE'
          : 'TARGET_UNREALISTIC'

  return {
    success: true,
    generatedAt: new Date().toISOString(),
    mode: 'ai_sports_brain_v1',

    request: {
      bankroll: safeBankroll,
      targetProfit: safeTargetProfit,
      riskPreference,
      maxParlayLegs: safeMaxLegs,
      sportKey,
    },

    analysis: {
      scannedPicks: pool.length,
      qualifiedPicks: qualified.length,
      rejectedPicks: Math.max(
        pool.length - qualified.length,
        0
      ),
      status,
      targetCoverage,
      probabilityPositive,
      totalExposure: totalStake,
      totalExposurePercent,
      expectedProfit,
      projectedMaximumProfit: maximumProfit,
      remainingBankroll: round(
        safeBankroll - totalStake
      ),
    },

    strategy: {
      singles: adjustedSingles,
      parlay: adjustedParlay,
    },

    warnings,

    conclusion:
      qualified.length === 0
        ? `No qualified ${sportKey} opportunities currently satisfy the selected risk profile.`
        : `The strategy uses ${adjustedSingles.length} singles${
            adjustedParlay.available
              ? ` and one ${adjustedParlay.legs}-leg parlay`
              : ''
          }, with ${totalExposurePercent}% bankroll exposure and ${probabilityPositive}% estimated probability of finishing positive.`,
  }
}