export const TRAINING_FEATURE_CONTRACT_VERSION = 'training_feature_governance_v1' as const

export type TrainingFeatureEligibility =
  | 'TRAINING_ALLOWED'
  | 'TRAINING_ALLOWED_IF_CUTOFF_FROZEN'
  | 'TRAINING_RESEARCH_ONLY'
  | 'TRAINING_PROHIBITED_LABEL'
  | 'TRAINING_PROHIBITED_POST_START'
  | 'TRAINING_PROHIBITED_POST_FINAL'
  | 'TRAINING_PROHIBITED_MODEL_OUTPUT'
  | 'TRAINING_PROHIBITED_RECOMMENDATION_OUTPUT'
  | 'TRAINING_PROHIBITED_SETTLEMENT'
  | 'TRAINING_PROHIBITED_MUTABLE_MARKET'
  | 'TRAINING_UNKNOWN_REVIEW_REQUIRED'

export type FeatureQualityTier =
  | 'TIER_A_CORE'
  | 'TIER_B_RECOMMENDED'
  | 'TIER_C_OPTIONAL'
  | 'TIER_D_EXPERIMENTAL'
  | 'TIER_R_RESEARCH_ONLY'
  | 'TIER_X_PROHIBITED'

export type AliasTransformation =
  | 'DIRECT_ALIAS'
  | 'NORMALIZED_ALIAS'
  | 'DERIVED_EQUIVALENT'
  | 'LEGACY_ALIAS'
  | 'NOT_EQUIVALENT'
  | 'UNKNOWN'

export type FeatureAuditEntry = {
  feature: string
  category: string
  presentCount: number
  coveragePercent: number
  nullPercent: number
  missingPercent: number
  constant: boolean
  dataTypes: Record<string, number>
  availableSports: string[]
  availableMarkets: string[]
  seasonCoverage: Record<string, number>
  signalQuality: string
  leakageSeverity: string
  trainingDisposition: string
}

export type TrainingFeatureContractEntry = {
  featureKey: string
  canonicalName: string
  category: string
  source: string
  sourceTableOrPayload: string
  calculationFunction: string
  valueType: string
  sportSupport: string[]
  marketSupport: string[]
  earliestAvailabilityRule: string
  cutoffAvailability: 'REQUIRED' | 'NOT_ALLOWED' | 'REVIEW_REQUIRED'
  frozenAtTimestamp: string
  mutableAfterPrediction: boolean
  trainingEligibility: TrainingFeatureEligibility
  researchEligibility: boolean
  leakageSeverity: string
  aliases: string[]
  replacementCanonicalKey: string | null
  deprecationState: 'ACTIVE' | 'ALIAS' | 'RESEARCH_ONLY' | 'PROHIBITED'
  rationale: string
  qualityTier: FeatureQualityTier
  contractVersion: typeof TRAINING_FEATURE_CONTRACT_VERSION
}

export type AliasGroup = {
  groupKey: string
  canonicalKey: string
  transformation: AliasTransformation
  aliases: string[]
  rationale: string
}

export type TemporalEvidence = {
  featureKey: string
  predictionCutoff?: string | null
  predictionGeneratedAt?: string | null
  eventStartTime?: string | null
  featureCapturedAt?: string | null
  oddsSnapshotTimestamp?: string | null
  resultTimestamp?: string | null
  settledAt?: string | null
  closingLineTimestamp?: string | null
  eventIdentityMatches?: boolean
  marketIdentityMatches?: boolean
  sourceIdentityMatches?: boolean
  mutableAfterPrediction?: boolean
}

export type TemporalSafetyResult = {
  safe: boolean
  status:
    | 'TEMPORAL_SAFE'
    | 'MISSING_CUTOFF'
    | 'MISSING_FEATURE_TIMESTAMP'
    | 'POST_CUTOFF_FEATURE'
    | 'POST_START_FEATURE'
    | 'POST_FINAL_FEATURE'
    | 'MISMATCHED_IDENTITY'
    | 'MUTABLE_AFTER_PREDICTION'
  reasons: string[]
}

export type EnforcementResult = {
  allowedKeys: string[]
  cutoffFrozenKeys: string[]
  researchOnlyKeys: string[]
  prohibitedKeys: { key: string; eligibility: TrainingFeatureEligibility; reason: string }[]
  unknownKeys: string[]
  aliasCollisions: { canonicalKey: string; keys: string[] }[]
  normalizedKeys: string[]
}

function lower(value: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

function canonicalizeKey(key: string) {
  return key.trim().replace(/\[(\d+)\]/g, '').replace(/_/g, '.')
}

function valueType(entry: FeatureAuditEntry) {
  const types = Object.entries(entry.dataTypes ?? {}).sort((a, b) => b[1] - a[1])
  return types[0]?.[0] ?? 'unknown'
}

function sourceForKey(featureKey: string) {
  const key = lower(featureKey)
  if (key.startsWith('marketodds') || /odds|price|sportsbook/.test(key)) return 'sports_odds_snapshots'
  if (key.startsWith('derivedbaseballfeatures') || /pitch|bullpen|bat|last\d+|weather|park/.test(key)) return 'historical_feature_snapshots.feature_values'
  if (key.startsWith('eventcontext') || /home|away|event|team/.test(key)) return 'sport_events'
  return 'historical_feature_snapshots.feature_values'
}

function sourceServiceForKey(featureKey: string) {
  const key = lower(featureKey)
  if (key.startsWith('marketodds')) return 'sportsdataio-mlb-prospective-preview.service.ts'
  if (key.startsWith('derivedbaseballfeatures')) return 'retrosheet/sportsdataio feature builders'
  if (key.startsWith('eventcontext')) return 'feature-store-core.service.ts'
  return 'historical feature snapshot producers'
}

export function classifyTrainingEligibility(featureKey: string): {
  eligibility: TrainingFeatureEligibility
  rationale: string
  mutableAfterPrediction: boolean
  cutoffAvailability: TrainingFeatureContractEntry['cutoffAvailability']
} {
  const key = lower(featureKey)
  if (!featureKey || /unknown|unregistered/.test(key)) {
    return {
      eligibility: 'TRAINING_UNKNOWN_REVIEW_REQUIRED',
      rationale: 'Unknown feature keys default deny until explicitly classified.',
      mutableAfterPrediction: true,
      cutoffAvailability: 'REVIEW_REQUIRED',
    }
  }
  if (/recommend|official.?pick|pick.?status/.test(key)) {
    return {
      eligibility: 'TRAINING_PROHIBITED_RECOMMENDATION_OUTPUT',
      rationale: 'Recommendation outputs must not feed future model input matrices.',
      mutableAfterPrediction: true,
      cutoffAvailability: 'NOT_ALLOWED',
    }
  }
  if (/eventid|event_id|snapshot|timestamp|generated|source|version|deterministic|metadata|unavailable|key$|\.key/.test(key)) {
    return {
      eligibility: 'TRAINING_RESEARCH_ONLY',
      rationale: 'Lineage and metadata fields are useful for joins/audits but not as predictive inputs.',
      mutableAfterPrediction: false,
      cutoffAvailability: 'REVIEW_REQUIRED',
    }
  }
  if (/profit|pnl|roi|brier|actual/.test(key)) {
    return {
      eligibility: 'TRAINING_PROHIBITED_LABEL',
      rationale: 'Post-outcome label or performance field cannot be model input.',
      mutableAfterPrediction: true,
      cutoffAvailability: 'NOT_ALLOWED',
    }
  }
  if (/settle|settlement|settled/.test(key)) {
    return {
      eligibility: 'TRAINING_PROHIBITED_SETTLEMENT',
      rationale: 'Settlement fields are labels/audit outputs and must be excluded from model inputs.',
      mutableAfterPrediction: true,
      cutoffAvailability: 'NOT_ALLOWED',
    }
  }
  if (/result|final|score|status$|eventcontext\.status/.test(key)) {
    return {
      eligibility: 'TRAINING_PROHIBITED_POST_FINAL',
      rationale: 'Result or final-status information may be known only after start/final.',
      mutableAfterPrediction: true,
      cutoffAvailability: 'NOT_ALLOWED',
    }
  }
  if (/model|probability|confidence|edge|ev|trust|prediction/.test(key)) {
    return {
      eligibility: 'TRAINING_PROHIBITED_MODEL_OUTPUT',
      rationale: 'Model outputs and derived decision scores must remain outside training features.',
      mutableAfterPrediction: true,
      cutoffAvailability: 'NOT_ALLOWED',
    }
  }
  if (/closing|close/.test(key)) {
    return {
      eligibility: 'TRAINING_PROHIBITED_MUTABLE_MARKET',
      rationale: 'Closing-line information is evaluation-only unless separately proven pre-cutoff for the decision timestamp.',
      mutableAfterPrediction: true,
      cutoffAvailability: 'NOT_ALLOWED',
    }
  }
  if (/odds|price|line|sportsbook|implied|market|outcome|peerrowsineventmarketbook/.test(key)) {
    return {
      eligibility: 'TRAINING_ALLOWED_IF_CUTOFF_FROZEN',
      rationale: 'Market data is allowed only when source timestamp, event, market and source identity prove pre-cutoff immutability.',
      mutableAfterPrediction: true,
      cutoffAvailability: 'REQUIRED',
    }
  }
  return {
    eligibility: 'TRAINING_ALLOWED',
    rationale: 'Domain feature has no direct leakage pattern and remains subject to point-in-time snapshot validation.',
    mutableAfterPrediction: false,
    cutoffAvailability: 'REQUIRED',
  }
}

export function tierForFeature(entry: FeatureAuditEntry, eligibility: TrainingFeatureEligibility): FeatureQualityTier {
  if (eligibility.startsWith('TRAINING_PROHIBITED')) return 'TIER_X_PROHIBITED'
  if (eligibility === 'TRAINING_RESEARCH_ONLY') return 'TIER_R_RESEARCH_ONLY'
  if (eligibility === 'TRAINING_UNKNOWN_REVIEW_REQUIRED') return 'TIER_D_EXPERIMENTAL'
  if (['Odds', 'Market', 'Pitching', 'Team strength'].includes(entry.category)) return 'TIER_A_CORE'
  if (['Batting', 'Schedule', 'Home/Away', 'Historical performance', 'Weather', 'Rest'].includes(entry.category)) return 'TIER_B_RECOMMENDED'
  if (['Roster', 'Opponent quality', 'Streaks', 'Standings', 'Travel'].includes(entry.category)) return 'TIER_C_OPTIONAL'
  return 'TIER_D_EXPERIMENTAL'
}

export function buildTrainingFeatureContract(entries: FeatureAuditEntry[]): TrainingFeatureContractEntry[] {
  return entries.map((entry) => {
    const classified = classifyTrainingEligibility(entry.feature)
    const canonicalName = canonicalizeKey(entry.feature)
    const qualityTier = tierForFeature(entry, classified.eligibility)
    return {
      featureKey: entry.feature,
      canonicalName,
      category: entry.category,
      source: sourceServiceForKey(entry.feature),
      sourceTableOrPayload: sourceForKey(entry.feature),
      calculationFunction: entry.feature.includes('.') ? 'nested_feature_snapshot_value' : 'feature_group_payload',
      valueType: valueType(entry),
      sportSupport: entry.availableSports,
      marketSupport: entry.availableMarkets,
      earliestAvailabilityRule: classified.eligibility === 'TRAINING_ALLOWED_IF_CUTOFF_FROZEN'
        ? 'source timestamp must be <= prediction cutoff and before event start'
        : classified.cutoffAvailability === 'NOT_ALLOWED'
          ? 'not allowed as model input'
          : 'feature snapshot must be captured <= prediction cutoff and before event start',
      cutoffAvailability: classified.cutoffAvailability,
      frozenAtTimestamp: classified.eligibility === 'TRAINING_ALLOWED_IF_CUTOFF_FROZEN'
        ? 'oddsSnapshotTimestamp or featureCapturedAt'
        : 'featureCapturedAt/as_of_timestamp',
      mutableAfterPrediction: classified.mutableAfterPrediction,
      trainingEligibility: classified.eligibility,
      researchEligibility: !classified.eligibility.startsWith('TRAINING_PROHIBITED'),
      leakageSeverity: entry.leakageSeverity,
      aliases: [],
      replacementCanonicalKey: null,
      deprecationState: classified.eligibility.startsWith('TRAINING_PROHIBITED')
        ? 'PROHIBITED'
        : classified.eligibility === 'TRAINING_RESEARCH_ONLY'
          ? 'RESEARCH_ONLY'
          : 'ACTIVE',
      rationale: classified.rationale,
      qualityTier,
      contractVersion: TRAINING_FEATURE_CONTRACT_VERSION,
    }
  })
}

export function buildAliasGroups(entries: TrainingFeatureContractEntry[]): AliasGroup[] {
  const groups: AliasGroup[] = [
    {
      groupKey: 'market_price_aliases',
      canonicalKey: 'marketOdds.price',
      transformation: 'DIRECT_ALIAS',
      aliases: entries.filter((entry) => /marketOdds\.(price|odds)$/i.test(entry.featureKey)).map((entry) => entry.featureKey),
      rationale: 'One canonical price field should enter a dataset; implied probability must be computed once from that price.',
    },
    {
      groupKey: 'market_line_aliases',
      canonicalKey: 'marketOdds.line',
      transformation: 'DIRECT_ALIAS',
      aliases: entries.filter((entry) => /marketOdds\.line|handicap|spread/i.test(entry.featureKey)).map((entry) => entry.featureKey),
      rationale: 'Spread/total lines should use one canonical side-aware line representation.',
    },
    {
      groupKey: 'model_output_aliases',
      canonicalKey: 'model_outputs_excluded',
      transformation: 'NOT_EQUIVALENT',
      aliases: entries.filter((entry) => /probability|confidence|edge|ev|trust|model/i.test(entry.featureKey)).map((entry) => entry.featureKey),
      rationale: 'Model-output-like fields are not equivalent training inputs; all are excluded from feature matrices.',
    },
    {
      groupKey: 'settlement_label_aliases',
      canonicalKey: 'training_label_only',
      transformation: 'NOT_EQUIVALENT',
      aliases: entries.filter((entry) => /result|settle|profit|final|score/i.test(entry.featureKey)).map((entry) => entry.featureKey),
      rationale: 'Outcome and settlement fields may exist only as labels/evaluation evidence, never model inputs.',
    },
    {
      groupKey: 'home_away_symmetry',
      canonicalKey: 'side_relative_team_context',
      transformation: 'DERIVED_EQUIVALENT',
      aliases: entries.filter((entry) => /\.(home|away)\./i.test(entry.featureKey)).map((entry) => entry.featureKey),
      rationale: 'Home/away raw features should be transformed into side-relative or differential representations for compact future training.',
    },
  ]
  return groups.map((group) => ({ ...group, aliases: Array.from(new Set(group.aliases)).sort() })).filter((group) => group.aliases.length > 0)
}

function parseTime(value?: string | null) {
  if (!value) return null
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : null
}

export function evaluateTemporalSafety(evidence: TemporalEvidence): TemporalSafetyResult {
  const reasons: string[] = []
  const cutoff = parseTime(evidence.predictionCutoff)
  const generated = parseTime(evidence.predictionGeneratedAt)
  const eventStart = parseTime(evidence.eventStartTime)
  const featureTime = parseTime(evidence.featureCapturedAt ?? evidence.oddsSnapshotTimestamp)
  const resultTime = parseTime(evidence.resultTimestamp)
  const settledTime = parseTime(evidence.settledAt)
  const closingTime = parseTime(evidence.closingLineTimestamp)

  if (cutoff === null) reasons.push('missing prediction cutoff')
  if (featureTime === null) reasons.push('missing feature/source timestamp')
  if (evidence.eventIdentityMatches === false || evidence.marketIdentityMatches === false || evidence.sourceIdentityMatches === false) reasons.push('identity mismatch')
  if (featureTime !== null && cutoff !== null && featureTime > cutoff) reasons.push('feature timestamp after prediction cutoff')
  if (featureTime !== null && generated !== null && featureTime > generated) reasons.push('feature timestamp after prediction generation')
  if (featureTime !== null && eventStart !== null && featureTime > eventStart) reasons.push('feature timestamp after event start')
  if (featureTime !== null && resultTime !== null && featureTime >= resultTime) reasons.push('feature timestamp at/after result evidence')
  if (featureTime !== null && settledTime !== null && featureTime >= settledTime) reasons.push('feature timestamp at/after settlement')
  if (closingTime !== null && cutoff !== null && closingTime > cutoff) reasons.push('closing line after prediction cutoff')
  if (evidence.mutableAfterPrediction) reasons.push('feature is mutable after prediction')

  if (reasons.some((reason) => reason.includes('identity mismatch'))) return { safe: false, status: 'MISMATCHED_IDENTITY', reasons }
  if (reasons.some((reason) => reason.includes('missing prediction cutoff'))) return { safe: false, status: 'MISSING_CUTOFF', reasons }
  if (reasons.some((reason) => reason.includes('missing feature/source timestamp'))) return { safe: false, status: 'MISSING_FEATURE_TIMESTAMP', reasons }
  if (reasons.some((reason) => reason.includes('after prediction cutoff') || reason.includes('after prediction generation'))) return { safe: false, status: 'POST_CUTOFF_FEATURE', reasons }
  if (reasons.some((reason) => reason.includes('after event start'))) return { safe: false, status: 'POST_START_FEATURE', reasons }
  if (reasons.some((reason) => reason.includes('result') || reason.includes('settlement'))) return { safe: false, status: 'POST_FINAL_FEATURE', reasons }
  if (reasons.some((reason) => reason.includes('mutable'))) return { safe: false, status: 'MUTABLE_AFTER_PREDICTION', reasons }
  return { safe: true, status: 'TEMPORAL_SAFE', reasons: [] }
}

export function enforceTrainingFeatureContract(featureKeys: string[], contract: TrainingFeatureContractEntry[]): EnforcementResult {
  const byKey = new Map(contract.map((entry) => [entry.featureKey, entry]))
  const byCanonical = new Map<string, string[]>()
  const allowedKeys: string[] = []
  const cutoffFrozenKeys: string[] = []
  const researchOnlyKeys: string[] = []
  const prohibitedKeys: EnforcementResult['prohibitedKeys'] = []
  const unknownKeys: string[] = []

  for (const key of featureKeys) {
    const entry = byKey.get(key)
    if (!entry) {
      unknownKeys.push(key)
      continue
    }
    const keys = byCanonical.get(entry.canonicalName) ?? []
    keys.push(key)
    byCanonical.set(entry.canonicalName, keys)
    if (entry.trainingEligibility === 'TRAINING_ALLOWED') allowedKeys.push(entry.featureKey)
    else if (entry.trainingEligibility === 'TRAINING_ALLOWED_IF_CUTOFF_FROZEN') cutoffFrozenKeys.push(entry.featureKey)
    else if (entry.trainingEligibility === 'TRAINING_RESEARCH_ONLY') researchOnlyKeys.push(entry.featureKey)
    else prohibitedKeys.push({ key: entry.featureKey, eligibility: entry.trainingEligibility, reason: entry.rationale })
  }

  return {
    allowedKeys,
    cutoffFrozenKeys,
    researchOnlyKeys,
    prohibitedKeys,
    unknownKeys,
    aliasCollisions: Array.from(byCanonical.entries())
      .filter(([, keys]) => keys.length > 1)
      .map(([canonicalKey, keys]) => ({ canonicalKey, keys })),
    normalizedKeys: Array.from(byCanonical.keys()).sort(),
  }
}

export function runTrainingFeatureGovernanceFixtures() {
  const fixtures = [
    ['final score used as feature', 'game.finalScore', 'TRAINING_PROHIBITED_POST_FINAL'],
    ['game result status', 'eventContext.status', 'TRAINING_PROHIBITED_POST_FINAL'],
    ['settled outcome', 'settlement.outcome', 'TRAINING_PROHIBITED_SETTLEMENT'],
    ['profit', 'prediction.profit', 'TRAINING_PROHIBITED_LABEL'],
    ['model probability', 'model.probability', 'TRAINING_PROHIBITED_MODEL_OUTPUT'],
    ['confidence', 'model.confidence', 'TRAINING_PROHIBITED_MODEL_OUTPUT'],
    ['edge', 'market.edge', 'TRAINING_PROHIBITED_MODEL_OUTPUT'],
    ['recommendation', 'recommendation.status', 'TRAINING_PROHIBITED_RECOMMENDATION_OUTPUT'],
    ['Official Pick status', 'officialPick.status', 'TRAINING_PROHIBITED_RECOMMENDATION_OUTPUT'],
    ['Trust', 'model.trust', 'TRAINING_PROHIBITED_MODEL_OUTPUT'],
    ['mutable closing line', 'marketOdds.closingLine', 'TRAINING_PROHIBITED_MUTABLE_MARKET'],
    ['valid cutoff-frozen odds', 'marketOdds.price', 'TRAINING_ALLOWED_IF_CUTOFF_FROZEN'],
    ['valid pregame pitching feature', 'derivedBaseballFeatures.home.starter.era', 'TRAINING_ALLOWED'],
    ['unknown feature key', 'unregisteredFeature.futureMagic', 'TRAINING_UNKNOWN_REVIEW_REQUIRED'],
    ['research-only key', 'eventContext.eventId', 'TRAINING_RESEARCH_ONLY'],
  ].map(([name, key, expected]) => {
    const actual = classifyTrainingEligibility(key).eligibility
    return { name, key, expected, actual, pass: actual === expected }
  })

  const validTemporal = evaluateTemporalSafety({
    featureKey: 'marketOdds.price',
    predictionCutoff: '2026-07-29T17:00:00.000Z',
    predictionGeneratedAt: '2026-07-29T16:55:00.000Z',
    eventStartTime: '2026-07-29T23:00:00.000Z',
    oddsSnapshotTimestamp: '2026-07-29T16:50:00.000Z',
    eventIdentityMatches: true,
    marketIdentityMatches: true,
    sourceIdentityMatches: true,
  })
  const postStartTemporal = evaluateTemporalSafety({
    featureKey: 'marketOdds.price',
    predictionCutoff: '2026-07-29T17:00:00.000Z',
    predictionGeneratedAt: '2026-07-29T16:55:00.000Z',
    eventStartTime: '2026-07-29T18:00:00.000Z',
    oddsSnapshotTimestamp: '2026-07-29T18:05:00.000Z',
    eventIdentityMatches: true,
    marketIdentityMatches: true,
    sourceIdentityMatches: true,
  })
  const missingTimestamp = evaluateTemporalSafety({
    featureKey: 'marketOdds.price',
    predictionCutoff: '2026-07-29T17:00:00.000Z',
    eventStartTime: '2026-07-29T23:00:00.000Z',
    eventIdentityMatches: true,
    marketIdentityMatches: true,
    sourceIdentityMatches: true,
  })
  const temporalFixtures = [
    { name: 'valid cutoff-frozen odds temporal check', expectedSafe: true, actual: validTemporal.safe, pass: validTemporal.safe === true },
    { name: 'post-start odds temporal check', expectedSafe: false, actual: postStartTemporal.safe, pass: postStartTemporal.safe === false && postStartTemporal.status === 'POST_CUTOFF_FEATURE' },
    { name: 'missing timestamp temporal check', expectedSafe: false, actual: missingTimestamp.safe, pass: missingTimestamp.safe === false && missingTimestamp.status === 'MISSING_FEATURE_TIMESTAMP' },
  ]

  return {
    success: fixtures.every((fixture) => fixture.pass) && temporalFixtures.every((fixture) => fixture.pass),
    fixtures,
    temporalFixtures,
    passed: fixtures.filter((fixture) => fixture.pass).length + temporalFixtures.filter((fixture) => fixture.pass).length,
    total: fixtures.length + temporalFixtures.length,
  }
}
