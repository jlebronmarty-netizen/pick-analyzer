import { getAICopilot } from '@/services/ai-copilot.service'

type CopilotPick = {
  id: string
  team: string
  opponent: string
  matchup: string
  sportKey: string
  sportsbook: string
  odds: number
  formattedOdds: string
  recommendation: string
  timing: string
  tone: string
  betNowOrWait: string
  suggestedStake: number
  formattedStake: string
  modelProbability: number
  impliedProbability: number
  edge: number
  ev: number
  confidence: number
  smartScore: number
  riskGrade: string
  riskLabel: string
  kellyPercent: number
  pros: string[]
  cons: string[]
  hiddenRisks: string[]
  professionalRead: string
  summary: string
  fullAnalysis: string
}

function normalize(value: string) {
  return value.trim().toLowerCase()
}

function formatPercent(value: number) {
  return `${Number(value).toFixed(2)}%`
}

function findPickByQuestion(question: string, picks: CopilotPick[]) {
  const normalizedQuestion = normalize(question)

  return (
    picks.find((pick) =>
      normalizedQuestion.includes(normalize(pick.team))
    ) ??
    picks.find((pick) =>
      normalizedQuestion.includes(normalize(pick.opponent))
    ) ??
    null
  )
}

function getSafestPick(picks: CopilotPick[]) {
  return [...picks].sort(
    (a, b) =>
      b.confidence - a.confidence ||
      b.smartScore - a.smartScore ||
      b.edge - a.edge
  )[0]
}

function getBestValuePick(picks: CopilotPick[]) {
  return [...picks].sort(
    (a, b) =>
      b.ev - a.ev ||
      b.edge - a.edge ||
      b.smartScore - a.smartScore
  )[0]
}

function getBestBetNowPick(picks: CopilotPick[]) {
  return (
    picks.find((pick) => pick.timing === 'BET_NOW') ??
    getSafestPick(picks)
  )
}

function getAvoidPicks(picks: CopilotPick[]) {
  return picks.filter(
    (pick) =>
      pick.timing === 'AVOID' ||
      pick.confidence < 70 ||
      pick.smartScore < 65 ||
      pick.odds >= 300
  )
}

function buildPickAnswer(pick: CopilotPick) {
  return [
    `${pick.team} ML (${pick.formattedOdds} at ${pick.sportsbook})`,
    '',
    `Recommendation: ${pick.timing}`,
    `Model probability: ${formatPercent(pick.modelProbability)}`,
    `Market implied probability: ${formatPercent(pick.impliedProbability)}`,
    `Edge: ${formatPercent(pick.edge)}`,
    `EV: ${formatPercent(pick.ev)}`,
    `Confidence: ${formatPercent(pick.confidence)}`,
    `Smart Score: ${pick.smartScore.toFixed(2)}`,
    `Suggested stake: ${pick.formattedStake}`,
    '',
    `Why: ${pick.summary}`,
    '',
    `Professional read: ${pick.professionalRead}`,
    '',
    `Main risks: ${pick.hiddenRisks.join(' ')}`,
  ].join('\n')
}

function buildSafestAnswer(picks: CopilotPick[]) {
  const pick = getSafestPick(picks)

  if (!pick) {
    return 'I do not see a qualified safe pick right now.'
  }

  return [
    `The safest pick right now is ${pick.team} ML.`,
    '',
    buildPickAnswer(pick),
  ].join('\n')
}

function buildBestValueAnswer(picks: CopilotPick[]) {
  const pick = getBestValuePick(picks)

  if (!pick) {
    return 'I do not see a clear best-value pick right now.'
  }

  return [
    `The best value pick right now is ${pick.team} ML.`,
    '',
    buildPickAnswer(pick),
  ].join('\n')
}

function buildBetNowAnswer(picks: CopilotPick[]) {
  const pick = getBestBetNowPick(picks)

  if (!pick) {
    return 'I do not see a Bet Now pick right now.'
  }

  return [
    `The top Bet Now pick is ${pick.team} ML.`,
    '',
    buildPickAnswer(pick),
  ].join('\n')
}

function buildAvoidAnswer(picks: CopilotPick[]) {
  const avoidPicks = getAvoidPicks(picks).slice(0, 5)

  if (!avoidPicks.length) {
    return 'I do not see any obvious avoid picks from the current Copilot list.'
  }

  return [
    'These are the picks I would be most careful with:',
    '',
    ...avoidPicks.map(
      (pick, index) =>
        `${index + 1}. ${pick.team} ML ${pick.formattedOdds} — ${pick.timing}. Main risk: ${pick.hiddenRisks[0] ?? 'Variance and line movement.'}`
    ),
  ].join('\n')
}

function buildParlayAnswer(picks: CopilotPick[]) {
  const legs = picks
    .filter(
      (pick) =>
        pick.confidence >= 70 &&
        pick.smartScore >= 65 &&
        pick.odds < 300
    )
    .slice(0, 3)

  if (legs.length < 2) {
    return 'I do not see enough qualified legs to build a safe parlay right now.'
  }

  return [
    'For the safest parlay, I would keep it small and use these legs:',
    '',
    ...legs.map(
      (pick, index) =>
        `${index + 1}. ${pick.team} ML ${pick.formattedOdds} — Confidence ${formatPercent(
          pick.confidence
        )}, Smart Score ${pick.smartScore.toFixed(2)}`
    ),
    '',
    'I would avoid adding too many legs. More legs increases variance even when each pick looks strong.',
  ].join('\n')
}

function buildGeneralAnswer(picks: CopilotPick[]) {
  const best = getBestBetNowPick(picks)
  const safest = getSafestPick(picks)
  const value = getBestValuePick(picks)

  return [
    'Here is my current read:',
    '',
    best
      ? `Best action pick: ${best.team} ML ${best.formattedOdds} (${best.timing}).`
      : 'Best action pick: none available.',
    safest
      ? `Safest pick: ${safest.team} ML with ${formatPercent(
          safest.confidence
        )} confidence.`
      : 'Safest pick: none available.',
    value
      ? `Best value: ${value.team} ML with ${formatPercent(value.ev)} EV.`
      : 'Best value: none available.',
    '',
    'Ask me things like: "what is the safest bet?", "what should I avoid?", "build me a safe parlay", or "why this pick?"',
  ].join('\n')
}

export async function answerAICopilotQuestion(question: string) {
  const copilot = await getAICopilot()
  const picks = (copilot.picks ?? []) as CopilotPick[]

  if (!picks.length) {
    return {
      success: true,
      question,
      answer: 'I do not have enough qualified picks to answer right now.',
      generatedAt: new Date().toISOString(),
    }
  }

  const normalizedQuestion = normalize(question)
  const mentionedPick = findPickByQuestion(question, picks)

  let answer: string

  if (
    normalizedQuestion.includes('safe') ||
    normalizedQuestion.includes('safest') ||
    normalizedQuestion.includes('segura') ||
    normalizedQuestion.includes('seguro')
  ) {
    answer = buildSafestAnswer(picks)
  } else if (
    normalizedQuestion.includes('value') ||
    normalizedQuestion.includes('ev') ||
    normalizedQuestion.includes('valor')
  ) {
    answer = buildBestValueAnswer(picks)
  } else if (
    normalizedQuestion.includes('bet now') ||
    normalizedQuestion.includes('now') ||
    normalizedQuestion.includes('ahora') ||
    normalizedQuestion.includes('jugar')
  ) {
    answer = buildBetNowAnswer(picks)
  } else if (
    normalizedQuestion.includes('avoid') ||
    normalizedQuestion.includes('evitar') ||
    normalizedQuestion.includes('riesgo') ||
    normalizedQuestion.includes('risk')
  ) {
    answer = buildAvoidAnswer(picks)
  } else if (
    normalizedQuestion.includes('parlay') ||
    normalizedQuestion.includes('combinada')
  ) {
    answer = buildParlayAnswer(picks)
  } else if (
    mentionedPick &&
    (normalizedQuestion.includes('why') ||
      normalizedQuestion.includes('porque') ||
      normalizedQuestion.includes('por qué') ||
      normalizedQuestion.includes('explain') ||
      normalizedQuestion.includes('explica'))
  ) {
    answer = buildPickAnswer(mentionedPick)
  } else {
    answer = buildGeneralAnswer(picks)
  }

  return {
    success: true,
    question,
    answer,
    generatedAt: new Date().toISOString(),
    source: {
      picksAnalyzed: picks.length,
      modelPerformance: copilot.modelPerformance,
    },
  }
}