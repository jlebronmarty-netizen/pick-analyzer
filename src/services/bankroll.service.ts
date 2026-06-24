export function normalizeBankroll(value: unknown) {
  const amount = Number(value)

  if (!Number.isFinite(amount) || amount <= 0) {
    return 1000
  }

  return Math.min(Math.max(amount, 100), 100000)
}

export function getMaxStakePercentByGrade(riskGrade?: string) {
  if (riskGrade === 'A+') return 8
  if (riskGrade === 'A') return 6
  if (riskGrade === 'B') return 4
  if (riskGrade === 'C') return 2

  return 1
}

export function calculateStakeFromKelly({
  bankroll,
  kellyPercent,
  riskGrade,
  maxStakePercent,
}: {
  bankroll: number
  kellyPercent?: number
  riskGrade?: string
  maxStakePercent?: number
}) {
  const kelly = Number(kellyPercent ?? 0)
  const rawStake = bankroll * (kelly / 100)

  const capPercent =
    maxStakePercent ?? getMaxStakePercentByGrade(riskGrade)

  const maxStake = bankroll * (capPercent / 100)

  return Number(Math.min(rawStake, maxStake).toFixed(2))
}