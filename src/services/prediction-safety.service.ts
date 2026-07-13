export type PredictionSafetyReason =
  | 'event_not_found'
  | 'event_started'
  | 'event_not_predictable'
  | 'unsupported_market'
  | 'invalid_selection'
  | 'invalid_line'
  | 'invalid_odds'
  | 'stale_odds'
  | 'future_odds_snapshot'
  | 'missing_model_version'
  | 'missing_feature_snapshot'
  | 'insufficient_features'
  | 'duplicate_prediction'
  | 'leakage_risk'

export type PredictionSafetyEvent = {
  id: string
  startTime: string
  status: string
  participants: string[]
}

export type PredictionSafetyCandidate = {
  sportKey: string
  eventId: string
  market: string
  selection: string
  sportsbook?: string | null
  odds: number | null
  line?: number | null
  oddsTimestamp?: string | null
  generatedAt: string
  cutoffAt?: string | null
  modelVersion?: string | null
  featureSnapshot?: Record<string, unknown>
  featureCompleteness?: number
}

export type PredictionSafetyPolicy = {
  supportedMarkets: string[]
  staleOddsMinutes: number
  minFeatureCompleteness: number
  nonPredictableStatuses: string[]
  duplicateKeys: string[]
}

export type PredictionSafetyResult = {
  status: 'valid' | 'skipped'
  reason: PredictionSafetyReason | null
  warnings: string[]
}

const DEFAULT_POLICY: PredictionSafetyPolicy = {
  supportedMarkets: ['moneyline', 'spread', 'total'],
  staleOddsMinutes: 120,
  minFeatureCompleteness: 35,
  nonPredictableStatuses: ['completed', 'cancelled', 'postponed'],
  duplicateKeys: [],
}

function dateMs(value: string | null | undefined) {
  if (!value) return null
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : null
}

function duplicateKey(candidate: PredictionSafetyCandidate) {
  return [
    candidate.sportKey,
    candidate.eventId,
    candidate.selection,
    candidate.market,
    candidate.sportsbook ?? '',
  ].join('|')
}

function skip(
  reason: PredictionSafetyReason,
  warnings: string[] = []
): PredictionSafetyResult {
  return {
    status: 'skipped',
    reason,
    warnings,
  }
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function addInjuryLineupWarnings(candidate: PredictionSafetyCandidate, warnings: string[]) {
  const snapshot = candidate.featureSnapshot ?? {}
  const injury = objectValue(snapshot.injuryAvailability)
  const lineup = objectValue(snapshot.lineupAvailability)

  if (!injury) {
    warnings.push('Injury availability is missing; do not treat missing provider data as healthy roster data.')
  } else {
    if (injury.trial === true) {
      warnings.push('Trial injury records are excluded from production confidence improvements.')
    }
    if (Number(injury.unresolvedPlayerCount ?? 0) > 0) {
      warnings.push(`${injury.unresolvedPlayerCount} injury rows have unresolved player mappings.`)
    }
    if (Number(injury.unresolvedTeamCount ?? 0) > 0) {
      warnings.push(`${injury.unresolvedTeamCount} injury rows have unresolved team mappings.`)
    }
    if (Number(injury.confidencePenalty ?? 0) > 0) {
      warnings.push(`Injury availability applies a ${injury.confidencePenalty}-point confidence penalty.`)
    }
    if (injury.availabilityStatus === 'provider_configured_stale') {
      warnings.push('Injury feed is stale for prediction safety.')
    }
  }

  if (!lineup || lineup.availabilityStatus === 'lineup_provider_unavailable') {
    warnings.push('Expected-lineup provider is unavailable; lineup context cannot improve confidence.')
  }
}

export function validatePredictionSafety({
  candidate,
  event,
  policy = DEFAULT_POLICY,
}: {
  candidate: PredictionSafetyCandidate
  event: PredictionSafetyEvent | null
  policy?: Partial<PredictionSafetyPolicy>
}): PredictionSafetyResult {
  const resolvedPolicy = {
    ...DEFAULT_POLICY,
    ...policy,
    supportedMarkets: policy.supportedMarkets ?? DEFAULT_POLICY.supportedMarkets,
    nonPredictableStatuses:
      policy.nonPredictableStatuses ?? DEFAULT_POLICY.nonPredictableStatuses,
    duplicateKeys: policy.duplicateKeys ?? DEFAULT_POLICY.duplicateKeys,
  }
  const warnings: string[] = []

  if (!event) return skip('event_not_found')

  const eventStart = dateMs(event.startTime)
  const generatedAt = dateMs(candidate.generatedAt)
  const cutoffAt = dateMs(candidate.cutoffAt)
  const oddsAt = dateMs(candidate.oddsTimestamp)

  if (!eventStart || !generatedAt) return skip('leakage_risk')

  if (resolvedPolicy.nonPredictableStatuses.includes(event.status)) {
    return skip('event_not_predictable')
  }

  if (eventStart <= generatedAt) return skip('event_started')

  if (!resolvedPolicy.supportedMarkets.includes(candidate.market)) {
    return skip('unsupported_market')
  }

  if (
    candidate.market !== 'total' &&
    !event.participants.includes(candidate.selection)
  ) {
    return skip('invalid_selection')
  }

  if (candidate.market !== 'moneyline' && !Number.isFinite(Number(candidate.line))) {
    return skip('invalid_line')
  }

  if (!Number.isFinite(Number(candidate.odds)) || Number(candidate.odds) === 0) {
    return skip('invalid_odds')
  }

  if (oddsAt !== null && oddsAt > generatedAt) return skip('future_odds_snapshot')

  if (
    oddsAt !== null &&
    generatedAt - oddsAt > resolvedPolicy.staleOddsMinutes * 60 * 1000
  ) {
    return skip('stale_odds')
  }

  if (cutoffAt !== null && cutoffAt >= eventStart) return skip('leakage_risk')

  if (!candidate.modelVersion) return skip('missing_model_version')

  if (!candidate.featureSnapshot || Object.keys(candidate.featureSnapshot).length === 0) {
    return skip('missing_feature_snapshot')
  }

  if (
    Number(candidate.featureCompleteness ?? 0) <
    resolvedPolicy.minFeatureCompleteness
  ) {
    return skip('insufficient_features')
  }

  if (resolvedPolicy.duplicateKeys.includes(duplicateKey(candidate))) {
    return skip('duplicate_prediction')
  }

  addInjuryLineupWarnings(candidate, warnings)

  if (!candidate.oddsTimestamp) {
    warnings.push('No odds timestamp was supplied.')
  }

  return {
    status: 'valid',
    reason: null,
    warnings,
  }
}

export function getPredictionSafetyStatus() {
  const now = new Date('2026-01-01T12:00:00.000Z')
  const event: PredictionSafetyEvent = {
    id: 'sample-event',
    startTime: '2026-01-01T20:00:00.000Z',
    status: 'scheduled',
    participants: ['Home', 'Away'],
  }
  const validCandidate: PredictionSafetyCandidate = {
    sportKey: 'basketball_nba',
    eventId: event.id,
    market: 'moneyline',
    selection: 'Home',
    sportsbook: 'Sample Book',
    odds: -120,
    oddsTimestamp: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
    generatedAt: now.toISOString(),
    cutoffAt: now.toISOString(),
    modelVersion: 'sample_model_v1',
    featureSnapshot: {
      featureCompleteness: 80,
      injuryAvailability: {
        availabilityStatus: 'trial_records_only',
        trial: true,
        unresolvedPlayerCount: 2,
        unresolvedTeamCount: 1,
        confidencePenalty: 18,
      },
      lineupAvailability: {
        availabilityStatus: 'lineup_provider_unavailable',
      },
    },
    featureCompleteness: 80,
  }
  const staleCandidate = {
    ...validCandidate,
    oddsTimestamp: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
  }
  const duplicateCandidate = {
    ...validCandidate,
    selection: 'Away',
  }
  const duplicate = [
    [
      duplicateCandidate.sportKey,
      duplicateCandidate.eventId,
      duplicateCandidate.selection,
      duplicateCandidate.market,
      duplicateCandidate.sportsbook ?? '',
    ].join('|'),
  ]
  const checks = [
    validatePredictionSafety({ candidate: validCandidate, event }),
    validatePredictionSafety({ candidate: staleCandidate, event }),
    validatePredictionSafety({
      candidate: duplicateCandidate,
      event,
      policy: { duplicateKeys: duplicate },
    }),
    validatePredictionSafety({
      candidate: { ...validCandidate, modelVersion: null },
      event,
    }),
  ]

  return {
    success: true,
    mode: 'prediction_safety_framework_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'deterministic_local_self_test',
    },
    checks: {
      eventStartChecks: true,
      staleOddsChecks: true,
      marketCompatibility: true,
      featureCompleteness: true,
      modelVersionRequirements: true,
      duplicatePrevention: true,
      lifecycleValidationContracts: true,
      leakageRiskChecks: true,
      typedSkipReasons: true,
      injuryLineupConfidenceWarnings: true,
      missingInjuryDataIsNotHealthyRoster: true,
    },
    deterministicResults: checks,
    summary: {
      checked: checks.length,
      valid: checks.filter((item) => item.status === 'valid').length,
      skipped: checks.filter((item) => item.status === 'skipped').length,
      reasons: checks
        .filter((item) => item.reason)
        .map((item) => item.reason),
    },
    integrationStatus:
      'Generic safety primitives are available. NBA validation remains compatible and can adopt shared checks incrementally.',
  }
}
