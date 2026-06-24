type SmartRankingInput = {
  confidence: number
  ev: number
  edge: number
  risk_stars?: number
  kelly_percent?: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function calculateSmartScore(input: SmartRankingInput) {
  const confidenceScore = clamp(input.confidence, 0, 100) * 0.35
  const evScore = clamp(input.ev, 0, 100) * 0.3
  const edgeScore = clamp(input.edge, 0, 40) * 0.5
  const kellyScore = clamp(input.kelly_percent ?? 0, 0, 15) * 1
  const gradeScore = clamp(input.risk_stars ?? 1, 1, 5) * 3

  const score =
    confidenceScore +
    evScore +
    edgeScore +
    kellyScore +
    gradeScore

  return Number(clamp(score, 0, 100).toFixed(2))
}