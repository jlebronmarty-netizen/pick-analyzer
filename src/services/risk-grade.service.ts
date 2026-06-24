export type RiskGrade = {
  grade: string
  stars: number
  label: string
}

export function getRiskGrade(
  confidence: number,
  ev: number,
  edge: number
): RiskGrade {
  if (
    confidence >= 85 &&
    ev >= 20 &&
    edge >= 10
  ) {
    return {
      grade: 'A+',
      stars: 5,
      label: 'Elite',
    }
  }

  if (
    confidence >= 75 &&
    ev >= 12 &&
    edge >= 8
  ) {
    return {
      grade: 'A',
      stars: 4,
      label: 'Strong',
    }
  }

  if (
    confidence >= 65 &&
    ev >= 6 &&
    edge >= 5
  ) {
    return {
      grade: 'B',
      stars: 3,
      label: 'Playable',
    }
  }

  if (confidence >= 55) {
    return {
      grade: 'C',
      stars: 2,
      label: 'Risky',
    }
  }

  return {
    grade: 'D',
    stars: 1,
    label: 'Avoid',
  }
}