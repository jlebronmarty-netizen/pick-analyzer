import { ExposureSummary } from '@/services/exposure.service'

type ScoreInput = {
  expectedRoi: number
  averageConfidence: number
  totalStake: number
  bankroll: number
  exposure: ExposureSummary
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function round(value: number) {
  return Number(value.toFixed(2))
}

export function calculateRiskScore(input: ScoreInput) {
  const stakePercent =
    input.bankroll > 0 ? (input.totalStake / input.bankroll) * 100 : 0

  const warningPenalty = input.exposure.warnings.length * 8
  const stakePenalty = stakePercent * 0.8

  return round(clamp(warningPenalty + stakePenalty, 0, 100))
}

export function calculateDiversificationScore(exposure: ExposureSummary) {
  const sportCount = Object.keys(exposure.sportCounts).length
  const teamCount = Object.keys(exposure.teamCounts).length
  const warningPenalty = exposure.warnings.length * 10

  const rawScore = sportCount * 18 + teamCount * 8 - warningPenalty

  return round(clamp(rawScore, 0, 100))
}

export function calculatePortfolioScore(input: ScoreInput) {
  const riskScore = calculateRiskScore(input)
  const diversificationScore = calculateDiversificationScore(input.exposure)

  const score =
    input.averageConfidence * 0.35 +
    input.expectedRoi * 0.25 +
    diversificationScore * 0.25 -
    riskScore * 0.15

  return {
    riskScore,
    diversificationScore,
    portfolioScore: round(clamp(score, 0, 100)),
  }
}