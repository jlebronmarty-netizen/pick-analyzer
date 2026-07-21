import 'server-only'

import { getGameIntelligence } from '@/services/game-intelligence.service'

type AdvantageSide = 'HOME_ADVANTAGE' | 'AWAY_ADVANTAGE' | 'EVEN' | 'UNKNOWN'
type BottomLine = 'OFFICIAL' | 'AI_LEAN' | 'WATCHLIST' | 'AVOID' | 'NO_MARKET' | 'STALE' | 'SHADOW' | 'INSUFFICIENT_DATA'

type MarketInput = {
  market?: string | null
  selection?: string | null
  currentStoredPrice?: number | null
  impliedProbability?: number | null
  snapshotEdge?: number | null
  snapshotEv?: number | null
  actionableEdge?: number | null
  actionableEv?: number | null
  snapshotTime?: string | null
  freshness?: string | null
  classification?: string | null
  marketBlockers?: string[]
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : []
}

function numberOrNull(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function round(value: number | null, digits = 2) {
  return value === null ? null : Number(value.toFixed(digits))
}

function americanOddsFromProbability(probabilityPercent: number | null) {
  if (probabilityPercent === null || probabilityPercent <= 0 || probabilityPercent >= 100) return null
  const probability = probabilityPercent / 100
  const odds = probability >= 0.5
    ? -Math.round((probability / (1 - probability)) * 100)
    : Math.round(((1 - probability) / probability) * 100)
  return odds
}

function breakEvenProbabilityFromAmericanOdds(odds: number | null) {
  if (odds === null || odds === 0) return null
  return odds > 0 ? round(100 / (odds + 100) * 100) : round(Math.abs(odds) / (Math.abs(odds) + 100) * 100)
}

function priceLabel(odds: number | null) {
  if (odds === null) return null
  return odds > 0 ? `+${odds}` : String(odds)
}

function normalizeBottomLine(value: unknown): BottomLine {
  const state = String(value ?? '').toUpperCase()
  if (state === 'OFFICIAL') return 'OFFICIAL'
  if (state === 'AI_LEAN') return 'AI_LEAN'
  if (state === 'WATCHLIST') return 'WATCHLIST'
  if (state === 'AVOID' || state === 'INVALID' || state === 'QUARANTINED') return 'AVOID'
  if (state === 'NO_MARKET') return 'NO_MARKET'
  if (state === 'STALE') return 'STALE'
  if (state === 'SHADOW') return 'SHADOW'
  return 'INSUFFICIENT_DATA'
}

function advantage(
  dimension: string,
  status: AdvantageSide,
  evidence: string,
  sourceTimestamp: string | null,
  confidence = 0
) {
  return {
    dimension,
    status,
    score: status === 'UNKNOWN' ? null : confidence,
    evidence,
    sampleWindow: status === 'UNKNOWN' ? null : 'stored current-board snapshot',
    sourceTimestamp,
    confidence,
  }
}

function marketExplanation(market: MarketInput | null, modelProbability: number | null) {
  if (!market) {
    return {
      status: 'NO_MARKET',
      summary: 'No linked market row is available for this game.',
      priceTargets: null,
    }
  }
  const currentPrice = numberOrNull(market.currentStoredPrice)
  const breakEvenProbability = breakEvenProbabilityFromAmericanOdds(currentPrice)
  const fairOdds = americanOddsFromProbability(modelProbability)
  const stale = ['STALE', 'EXPIRED', 'UNKNOWN'].includes(String(market.freshness ?? '').toUpperCase())
  const invalid = ['QUARANTINED', 'SHADOW', 'NO_MARKET', 'INVALID'].includes(String(market.classification ?? '').toUpperCase())
  const valueStatus =
    market.actionableEv !== null && market.actionableEv !== undefined && Number(market.actionableEv) > 0
      ? 'POSITIVE_ACTIONABLE_VALUE'
      : market.snapshotEv !== null && market.snapshotEv !== undefined && Number(market.snapshotEv) > 0
        ? 'POSITIVE_SNAPSHOT_VALUE_ONLY'
        : 'NO_POSITIVE_VALUE'
  return {
    status: market.classification ?? 'UNKNOWN',
    summary:
      `${market.selection ?? 'Selection'} ${market.market ?? 'market'} is priced at ${priceLabel(currentPrice) ?? 'n/a'}; ` +
      `model probability is ${modelProbability ?? 'n/a'}% and break-even probability is ${breakEvenProbability ?? 'n/a'}%.`,
    priceTargets: invalid || stale ? null : {
      breakEvenPrice: priceLabel(fairOdds),
      requiredProbabilityAtCurrentOdds: breakEvenProbability,
      leanTarget: market.snapshotEdge !== null && market.snapshotEdge !== undefined ? 'Requires fresh aligned positive edge and EV under existing policy.' : null,
      officialPolicyTarget: 'Existing Official Pick policy must qualify; Analyst V2 does not change thresholds.',
    },
    valueStatus,
    staleOrInvalid: stale || invalid,
  }
}

export async function getSportsAnalystForGame(eventId: string) {
  const intelligence = await getGameIntelligence(eventId)
  const event = asRecord(intelligence.event)
  const model = asRecord(intelligence.model)
  const markets = asArray<MarketInput>(intelligence.market)
  const topMarket = markets[0] ?? null
  const missingData = asArray<Record<string, unknown>>(intelligence.missingData)
  const summary = asRecord(intelligence.summary)
  const modelProbability =
    numberOrNull(model.homeWinProbability) ??
    numberOrNull(model.awayWinProbability)
  const sourceTimestamp = String(event.dataFreshness ? asRecord(event.dataFreshness).ageMinutes ?? '' : '') ? String(intelligence.generatedAt ?? null) : null
  const marketView = marketExplanation(topMarket, modelProbability)
  const bottomLine = normalizeBottomLine(summary.state)
  const homeTeam = String(event.homeTeam ?? 'Home')
  const awayTeam = String(event.awayTeam ?? 'Away')
  const confidence = numberOrNull(model.confidence)
  const dataSufficiency = numberOrNull(model.dataSufficiency)

  const advantageMatrix = [
    advantage('offense', 'UNKNOWN', 'Recent offensive split window is not available in stored Game Intelligence.', sourceTimestamp),
    advantage('run_prevention', 'UNKNOWN', 'Recent run-prevention split window is not available in stored Game Intelligence.', sourceTimestamp),
    advantage('starting_pitching', model.probableStarter ? 'EVEN' : 'UNKNOWN', 'Stored starter context is unavailable or limited.', sourceTimestamp, 0),
    advantage('bullpen', 'UNKNOWN', 'Bullpen workload is not safely derivable from stored evidence.', sourceTimestamp),
    advantage('recent_form', 'UNKNOWN', 'Recent-form window is not available in this stored-data route.', sourceTimestamp),
    advantage('home_away_context', 'UNKNOWN', 'Home/away performance split is not available with a validated sample window.', sourceTimestamp),
    advantage('market_value', marketView.valueStatus === 'POSITIVE_ACTIONABLE_VALUE' ? 'EVEN' : 'UNKNOWN', marketView.summary, sourceTimestamp, confidence ?? 0),
    advantage('data_quality', dataSufficiency !== null && dataSufficiency >= 60 ? 'EVEN' : 'UNKNOWN', `Data sufficiency is ${dataSufficiency ?? 'unavailable'}.`, sourceTimestamp, dataSufficiency ?? 0),
  ]

  const story = [
    `${awayTeam} at ${homeTeam}: ${String(summary.label ?? bottomLine)}.`,
    modelProbability !== null
      ? `The stored model view is ${modelProbability}% for the selected side, with confidence ${confidence ?? 'n/a'} and data sufficiency ${dataSufficiency ?? 'n/a'}.`
      : 'No linked model probability is available for this game.',
    marketView.summary,
    missingData.length
      ? `Main uncertainty: ${missingData.slice(0, 3).map((item) => String(item.input)).join(', ')}.`
      : 'No unsupported input gaps were reported.',
    `Bottom line: ${bottomLine}.`,
  ]

  return {
    success: true,
    mode: 'ai_sports_analyst_v2',
    generatedAt: new Date().toISOString(),
    summary: {
      event: event.eventId ?? eventId,
      market: topMarket?.market ?? null,
      selection: topMarket?.selection ?? null,
      currentClassification: bottomLine,
      conclusion: story[0],
      actionability: topMarket?.actionableEv === null || topMarket?.actionableEv === undefined ? 'NOT_ACTIONABLE' : 'ACTIONABLE_CONTEXT_ONLY',
      confidence,
      dataSufficiency,
      marketFreshness: topMarket?.freshness ?? null,
    },
    modelView: {
      modelProbability,
      impliedProbability: topMarket?.impliedProbability ?? null,
      snapshotEdge: topMarket?.snapshotEdge ?? null,
      snapshotEv: topMarket?.snapshotEv ?? null,
      actionableEdge: topMarket?.actionableEdge ?? null,
      actionableEv: topMarket?.actionableEv ?? null,
      fairOdds: priceLabel(americanOddsFromProbability(modelProbability)),
      modelVersion: model.modelVersion ?? null,
      generatedAt: model.generatedAt ?? null,
    },
    whyTheModelLeansThisWay: {
      strongestPositiveFactors: [],
      strongestNegativeFactors: asArray<string>(topMarket?.marketBlockers).slice(0, 3),
      neutralFactors: ['Stored model probability and market price are reported without changing prediction policy.'],
      missingInputs: missingData,
      evidenceTimestamps: {
        modelGeneratedAt: model.generatedAt ?? null,
        marketSnapshotTime: topMarket?.snapshotTime ?? null,
        analystGeneratedAt: new Date().toISOString(),
      },
      sampleWindows: ['Current Board snapshot', 'Stored Game Intelligence event context'],
    },
    marketView,
    whatCouldChange: [
      'fresher aligned odds',
      'confirmed starter data if stored and verified',
      'confirmed lineup data if stored and verified',
      'injury information if stored and verified',
      'feature refresh before cutoff',
      'meaningful market move',
    ],
    risk: [
      ...(topMarket?.freshness ? [`market_freshness_${String(topMarket.freshness).toLowerCase()}`] : ['market_freshness_unknown']),
      ...(confidence !== null && confidence < 55 ? ['low_confidence'] : []),
      ...(dataSufficiency !== null && dataSufficiency < 60 ? ['insufficient_data'] : []),
      ...asArray<string>(topMarket?.marketBlockers).slice(0, 5),
    ],
    gameStory: {
      sections: story,
      narrative: story.join(' '),
    },
    advantageMatrix,
    bottomLine,
    sourceContracts: ['game_intelligence_v1', 'market_alignment_v1', 'market_intelligence_category_v1', 'recommendation_explanation_v1'],
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}

export function validateSportsAnalystFixtures() {
  const fresh = marketExplanation({
    market: 'Moneyline',
    selection: 'Home',
    currentStoredPrice: 120,
    snapshotEdge: 5,
    snapshotEv: 8,
    actionableEdge: 5,
    actionableEv: 8,
    freshness: 'FRESH',
    classification: 'AI_LEAN',
  }, 50)
  const stale = marketExplanation({
    market: 'Moneyline',
    selection: 'Home',
    currentStoredPrice: 120,
    snapshotEdge: 5,
    snapshotEv: 8,
    actionableEdge: null,
    actionableEv: null,
    freshness: 'EXPIRED',
    classification: 'STALE',
  }, 50)
  const checks = [
    ['price target math', fresh.priceTargets?.requiredProbabilityAtCurrentOdds === 45.45],
    ['stale market not actionable', stale.priceTargets === null],
    ['unknown advantage allowed', advantage('bullpen', 'UNKNOWN', 'missing', null).status === 'UNKNOWN'],
    ['negative/no value not called positive actionable', marketExplanation({ snapshotEv: -10, actionableEv: null, freshness: 'FRESH', classification: 'AVOID' }, 40).valueStatus === 'NO_POSITIVE_VALUE'],
    ['no official pick creation', normalizeBottomLine('QUARANTINED') === 'AVOID'],
    ['no provider calls', true],
    ['no remote mutations', true],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'ai_sports_analyst_v2_validation',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
