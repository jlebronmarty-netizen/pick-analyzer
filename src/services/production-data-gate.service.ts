export type ProductionGateConsumer =
  | 'feature_store'
  | 'prediction_persistence'
  | 'settlement_metrics'
  | 'backtesting'
  | 'calibration'
  | 'clv'
  | 'model_promotion'
  | 'recommendations'
  | 'bankroll'
  | 'kelly'
  | 'portfolio'

export type ProductionGateInput = {
  production_eligible?: boolean | null
  productionEligible?: boolean | null
  trial?: boolean | null
  scrambled?: boolean | null
  odds?: number | null
  stake?: number | null
  result?: string | null
  status?: string | null
  feature_snapshot_id?: string | null
  featureSnapshotId?: string | null
  feature_set_version?: string | null
  featureSetVersion?: string | null
  feature_snapshot_generated_at?: string | null
  featureSnapshotGeneratedAt?: string | null
  odds_timestamp?: string | null
  oddsTimestamp?: string | null
  generated_at?: string | null
  generatedAt?: string | null
  cutoff_at?: string | null
  cutoffAt?: string | null
  unresolvedCriticalMappings?: number | null
  sampleSize?: number | null
}

export type ProductionGateResult = {
  mode: 'production_data_gate_v1'
  consumer: ProductionGateConsumer
  eligible: boolean
  blockedReasons: string[]
  warnings: string[]
  requiredConditions: string[]
}

const MIN_MODEL_PROMOTION_SAMPLE = 250

function bool(value: boolean | null | undefined) {
  return value === true
}

function productionEligible(input: ProductionGateInput) {
  return bool(input.production_eligible ?? input.productionEligible)
}

function hasFiniteNumber(value: unknown) {
  return Number.isFinite(Number(value))
}

function timestamp(value: string | null | undefined) {
  if (!value) return null
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : null
}

export function isProductionEligibleRow(input: ProductionGateInput) {
  return (
    productionEligible(input) &&
    input.trial !== true &&
    input.scrambled !== true
  )
}

export function isSettledProductionRow(input: ProductionGateInput) {
  const result = String(input.result ?? input.status ?? '').toLowerCase()
  return isProductionEligibleRow(input) && ['win', 'loss', 'push'].includes(result)
}

export function evaluateProductionDataGate(
  input: ProductionGateInput,
  consumer: ProductionGateConsumer
): ProductionGateResult {
  const blockedReasons: string[] = []
  const warnings: string[] = []
  const requiredConditions = [
    'production_eligible=true',
    'trial is not true',
    'scrambled is not true',
    'no unresolved critical mappings',
    'prediction-time odds are present when prices affect output',
    'no timestamp leakage when cutoff/generation metadata is available',
  ]

  if (!productionEligible(input)) {
    blockedReasons.push('production_eligible is not true')
  }
  if (input.trial === true) {
    blockedReasons.push('trial row')
  }
  if (input.scrambled === true) {
    blockedReasons.push('scrambled row')
  }
  if (Number(input.unresolvedCriticalMappings ?? 0) > 0) {
    blockedReasons.push('unresolved critical mappings')
  }

  if (
    ['prediction_persistence', 'recommendations', 'bankroll', 'kelly', 'portfolio', 'clv'].includes(
      consumer
    ) &&
    !hasFiniteNumber(input.odds)
  ) {
    blockedReasons.push('missing usable offered odds')
  }

  const cutoffAt = timestamp(input.cutoff_at ?? input.cutoffAt)
  const generatedAt = timestamp(input.generated_at ?? input.generatedAt)
  const oddsAt = timestamp(input.odds_timestamp ?? input.oddsTimestamp)
  const snapshotAt = timestamp(
    input.feature_snapshot_generated_at ?? input.featureSnapshotGeneratedAt
  )

  if (cutoffAt !== null && generatedAt !== null && generatedAt > cutoffAt) {
    blockedReasons.push('prediction generated after cutoff')
  }
  if (cutoffAt !== null && oddsAt !== null && oddsAt > cutoffAt) {
    blockedReasons.push('odds timestamp after cutoff')
  }
  if (generatedAt !== null && snapshotAt !== null && snapshotAt > generatedAt) {
    blockedReasons.push('feature snapshot generated after prediction')
  }

  if (consumer === 'model_promotion') {
    const sample = Number(input.sampleSize ?? 0)
    requiredConditions.push(`minimum production sample size ${MIN_MODEL_PROMOTION_SAMPLE}`)
    if (sample < MIN_MODEL_PROMOTION_SAMPLE) {
      blockedReasons.push('insufficient production sample for model promotion')
    }
  }

  if (
    ['backtesting', 'calibration', 'settlement_metrics'].includes(consumer) &&
    !isSettledProductionRow(input)
  ) {
    warnings.push('row is not a settled production metric row')
  }

  return {
    mode: 'production_data_gate_v1',
    consumer,
    eligible: blockedReasons.length === 0,
    blockedReasons,
    warnings,
    requiredConditions,
  }
}

export const PRODUCTION_DATA_GATE_V1_POLICY = {
  mode: 'production_data_gate_v1',
  trialRowsCanImproveProductionConfidence: false,
  scrambledRowsCanImproveProductionConfidence: false,
  trialRowsCanEnterProductionMetrics: false,
  modelPromotionMinimumProductionSample: MIN_MODEL_PROMOTION_SAMPLE,
  consumers: [
    'feature_store',
    'prediction_persistence',
    'settlement_metrics',
    'backtesting',
    'calibration',
    'clv',
    'model_promotion',
    'recommendations',
    'bankroll',
    'kelly',
    'portfolio',
  ] satisfies ProductionGateConsumer[],
}
