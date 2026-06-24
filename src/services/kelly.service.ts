export function calculateKellyPercent(
  modelProbability: number,
  americanOdds: number
) {
  const p = modelProbability / 100

  const decimalOdds =
    americanOdds > 0
      ? 1 + americanOdds / 100
      : 1 + 100 / Math.abs(americanOdds)

  const b = decimalOdds - 1

  const kelly = ((b * p) - (1 - p)) / b

  return Math.max(0, kelly)
}

export function calculateQuarterKellyStake(
  bankroll: number,
  modelProbability: number,
  americanOdds: number
) {
  const kelly =
    calculateKellyPercent(
      modelProbability,
      americanOdds
    )

  const quarterKelly = kelly * 0.25

  return {
    kellyPercent: Number(
      (quarterKelly * 100).toFixed(2)
    ),
    stake: Number(
      (bankroll * quarterKelly).toFixed(2)
    ),
  }
}