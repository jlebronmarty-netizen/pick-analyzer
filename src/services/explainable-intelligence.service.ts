import 'server-only'

export type ExplanationImpact =
  | 'STRONG_POSITIVE'
  | 'MODERATE_POSITIVE'
  | 'NEUTRAL'
  | 'MODERATE_NEGATIVE'
  | 'STRONG_NEGATIVE'
  | 'UNAVAILABLE'

export type ExplanationFactorGroup =
  | 'starting_pitcher'
  | 'bullpen'
  | 'lineup_quality'
  | 'player_form'
  | 'season_form'
  | 'handedness'
  | 'park_factor'
  | 'weather'
  | 'travel'
  | 'rest'
  | 'injuries'
  | 'market_freshness'
  | 'feature_sufficiency'
  | 'historical_calibration'

export type ExplanationFactor = {
  group: ExplanationFactorGroup
  label: string
  impact: ExplanationImpact
  status: 'SUPPORTED' | 'UNAVAILABLE'
  evidence: string
  confidenceImpact: 'raises_confidence' | 'lowers_confidence' | 'neutral' | 'unknown'
}

export type ExplainableIntelligenceContract = {
  version: 'explainable_intelligence_v1'
  subject: string
  summary: string
  positiveDrivers: ExplanationFactor[]
  negativeDrivers: ExplanationFactor[]
  neutralFactors: ExplanationFactor[]
  unavailableFactors: ExplanationFactor[]
  dataQualityLimitations: string[]
  confidenceImpact: string
  recommendationBoundary: string
}

type BuildInput = {
  subject: string
  positive?: string[]
  negative?: string[]
  neutral?: string[]
  unavailable?: string[]
  missingData?: string[]
  blockers?: string[]
  confidence?: number | null
  featureQuality?: number | null
  dataSufficiency?: number | null
  marketFreshness?: string | null
  calibrationStatus?: string | null
  officialEligible?: boolean
}

const GROUP_KEYWORDS: Array<[ExplanationFactorGroup, string[]]> = [
  ['starting_pitcher', ['starter', 'pitcher', 'pitching']],
  ['bullpen', ['bullpen', 'relief']],
  ['lineup_quality', ['lineup', 'batting order', 'eligible batter']],
  ['player_form', ['player projection', 'player form', 'batter', 'hitter']],
  ['season_form', ['season', 'recent form', 'team form']],
  ['handedness', ['handedness', 'left-handed', 'right-handed', 'split']],
  ['park_factor', ['park', 'venue']],
  ['weather', ['weather', 'wind', 'temperature']],
  ['travel', ['travel']],
  ['rest', ['rest']],
  ['injuries', ['injury', 'injuries']],
  ['market_freshness', ['odds', 'market', 'price', 'fresh', 'stale', 'snapshot']],
  ['feature_sufficiency', ['feature', 'data sufficiency', 'missing data', 'coverage']],
  ['historical_calibration', ['calibration', 'validation', 'holdout', 'brier']],
]

const GROUP_LABELS: Record<ExplanationFactorGroup, string> = {
  starting_pitcher: 'Starting pitcher',
  bullpen: 'Bullpen',
  lineup_quality: 'Lineup quality',
  player_form: 'Player form',
  season_form: 'Season form',
  handedness: 'Handedness',
  park_factor: 'Park factor',
  weather: 'Weather',
  travel: 'Travel',
  rest: 'Rest',
  injuries: 'Injuries',
  market_freshness: 'Market freshness',
  feature_sufficiency: 'Feature sufficiency',
  historical_calibration: 'Historical calibration',
}

function groupFor(text: string): ExplanationFactorGroup {
  const lower = text.toLowerCase()
  return GROUP_KEYWORDS.find(([, keywords]) => keywords.some((keyword) => lower.includes(keyword)))?.[0] ?? 'feature_sufficiency'
}

function factor(text: string, impact: ExplanationImpact, status: ExplanationFactor['status'] = 'SUPPORTED'): ExplanationFactor {
  const group = groupFor(text)
  return {
    group,
    label: GROUP_LABELS[group],
    impact,
    status,
    evidence: text,
    confidenceImpact:
      impact === 'STRONG_POSITIVE' || impact === 'MODERATE_POSITIVE'
        ? 'raises_confidence'
        : impact === 'STRONG_NEGATIVE' || impact === 'MODERATE_NEGATIVE'
          ? 'lowers_confidence'
          : status === 'UNAVAILABLE'
            ? 'unknown'
            : 'neutral',
  }
}

function qualityLimitations(input: BuildInput) {
  const limitations = new Set<string>()
  ;[...(input.missingData ?? []), ...(input.blockers ?? [])].forEach((item) => {
    if (item) limitations.add(item.replace(/_/g, ' '))
  })
  if (typeof input.featureQuality === 'number' && input.featureQuality < 60) limitations.add('Feature quality is limited.')
  if (typeof input.dataSufficiency === 'number' && input.dataSufficiency < 60) limitations.add('Data sufficiency is limited.')
  if (input.marketFreshness && ['STALE', 'EXPIRED', 'UNKNOWN'].includes(input.marketFreshness)) {
    limitations.add(`Market freshness is ${input.marketFreshness.toLowerCase()}.`)
  }
  if (input.calibrationStatus && !['validated', 'VALIDATED', 'calibrated', 'CALIBRATED'].includes(input.calibrationStatus)) {
    limitations.add(`Calibration status is ${input.calibrationStatus}.`)
  }
  return Array.from(limitations)
}

export function buildExplainableIntelligence(input: BuildInput): ExplainableIntelligenceContract {
  const positiveDrivers = (input.positive ?? []).filter(Boolean).slice(0, 6).map((item) => factor(item, 'MODERATE_POSITIVE'))
  const negativeDrivers = (input.negative ?? []).filter(Boolean).slice(0, 6).map((item) => factor(item, 'MODERATE_NEGATIVE'))
  const neutralFactors = (input.neutral ?? []).filter(Boolean).slice(0, 6).map((item) => factor(item, 'NEUTRAL'))
  const unavailableFactors = (input.unavailable ?? []).filter(Boolean).slice(0, 8).map((item) => factor(item, 'UNAVAILABLE', 'UNAVAILABLE'))
  const dataQualityLimitations = qualityLimitations(input)
  const confidence = typeof input.confidence === 'number' ? input.confidence : null

  return {
    version: 'explainable_intelligence_v1',
    subject: input.subject,
    summary:
      positiveDrivers[0]?.evidence ??
      negativeDrivers[0]?.evidence ??
      neutralFactors[0]?.evidence ??
      unavailableFactors[0]?.evidence ??
      'No supported active factor group has enough stored evidence for a stronger explanation.',
    positiveDrivers,
    negativeDrivers,
    neutralFactors,
    unavailableFactors,
    dataQualityLimitations,
    confidenceImpact:
      confidence === null
        ? 'Confidence impact is unavailable because no stored confidence score was supplied.'
        : confidence >= 70
          ? 'Stored confidence is high, subject to the listed data-quality limitations.'
          : confidence >= 55
            ? 'Stored confidence is moderate; limitations should be reviewed before acting.'
            : 'Stored confidence is limited and should be treated as informational.',
    recommendationBoundary: input.officialEligible
      ? 'This explanation supports review only; Official Pick policy still controls recommendation status.'
      : 'This is informational analysis only and is not an Official Pick or betting recommendation.',
  }
}
