import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'

export const CURRENT_V2_EPOCH_KEY = 'CURRENT_V2_PRODUCTION'
export const LEGACY_PRE_V2_EPOCH_KEY = 'LEGACY_PRE_V2'
export const P2_0_POLICY_VERSION = 'production_evaluation_policy_v1_3'
export const P2_0_PRODUCTION_SCOPE_VERSION = 'current_v2_production_scope_v1'
export const P2_0_TIMEZONE = 'America/Puerto_Rico'

export type ActivePredictionEpoch = {
  id: string
  epochKey: string
  epochName: string
  status: string
  activatedAt: string
  dataWindowStart: string
  metadata: Record<string, unknown>
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function nowIso() {
  return new Date().toISOString()
}

export async function getActivePredictionEpoch(): Promise<ActivePredictionEpoch | null> {
  const { data, error } = await supabaseAdmin
    .from('prediction_epochs')
    .select('id, epoch_key, epoch_name, status, activated_at, data_window_start, metadata')
    .eq('status', 'ACTIVE')
    .order('activated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return null
  if (!data || data.epoch_key !== CURRENT_V2_EPOCH_KEY || !data.activated_at) return null
  return {
    id: String(data.id),
    epochKey: String(data.epoch_key),
    epochName: String(data.epoch_name),
    status: String(data.status),
    activatedAt: String(data.activated_at),
    dataWindowStart: String(data.data_window_start ?? data.activated_at),
    metadata: asRecord(data.metadata),
  }
}

export async function epochColumnsAvailable() {
  const { error } = await supabaseAdmin
    .from('prediction_history')
    .select('id,prediction_epoch_id,prediction_epoch_key')
    .limit(1)
  return !error
}

export async function buildPredictionEpochStamp(generatedAt: string) {
  const [columnsAvailable, activeEpoch] = await Promise.all([
    epochColumnsAvailable(),
    getActivePredictionEpoch(),
  ])
  if (!columnsAvailable || !activeEpoch) return null
  const generatedMs = new Date(generatedAt).getTime()
  const activeMs = new Date(activeEpoch.dataWindowStart).getTime()
  if (!Number.isFinite(generatedMs) || !Number.isFinite(activeMs) || generatedMs < activeMs) return null
  return {
    columns: {
      prediction_epoch_id: activeEpoch.id,
      prediction_epoch_key: activeEpoch.epochKey,
    },
    snapshot: {
      epochId: activeEpoch.id,
      epochKey: activeEpoch.epochKey,
      epochName: activeEpoch.epochName,
      epochStartedAt: activeEpoch.dataWindowStart,
      timezone: P2_0_TIMEZONE,
      policyVersion: P2_0_POLICY_VERSION,
      productionScopeVersion: P2_0_PRODUCTION_SCOPE_VERSION,
      productionScope: CURRENT_V2_EPOCH_KEY,
    },
  }
}

type ActivationInput = {
  dryRun?: boolean | null
  confirmed?: boolean | null
  activationTimestamp?: string | null
  certifiedBaselineCommit?: string | null
  activatedBy?: string | null
}

export async function activatePredictionEpochV2(input: ActivationInput = {}) {
  const generatedAt = nowIso()
  const activationTimestamp = input.activationTimestamp ?? generatedAt
  const dryRun = input.dryRun !== false
  const confirmed = input.confirmed === true
  const existing = await getActivePredictionEpoch()
  if (existing) {
    return {
      success: true,
      status: 'ALREADY_ACTIVE',
      mode: 'prediction_epoch_v2_activation_v1',
      dryRun,
      generatedAt,
      activeEpoch: existing,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
      predictionRowsMutated: 0,
    }
  }
  if (!dryRun && !confirmed) {
    return {
      success: false,
      status: 'CONFIRMATION_REQUIRED',
      mode: 'prediction_epoch_v2_activation_v1',
      dryRun,
      generatedAt,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
      predictionRowsMutated: 0,
    }
  }

  const legacyRow = {
    epoch_key: LEGACY_PRE_V2_EPOCH_KEY,
    epoch_name: 'Legacy Pre-V2 Historical Era',
    status: 'ARCHIVED',
    data_window_start: null,
    data_window_end: activationTimestamp,
    training_window_start: null,
    training_window_end: null,
    model_versions: ['legacy_pre_v2'],
    feature_versions: ['legacy_pre_v2'],
    activation_reason: 'Historical rows preserved before Current V2 Production activation.',
    rollback_epoch_key: null,
    activated_at: null,
    archived_at: activationTimestamp,
    metadata: {
      scope: LEGACY_PRE_V2_EPOCH_KEY,
      timezone: P2_0_TIMEZONE,
      prediction_history_backfilled: false,
      historical_rows_rewritten: false,
    },
  }
  const currentRow = {
    epoch_key: CURRENT_V2_EPOCH_KEY,
    epoch_name: 'Current V2 Production Era',
    status: 'ACTIVE',
    data_window_start: activationTimestamp,
    data_window_end: null,
    training_window_start: null,
    training_window_end: null,
    model_versions: ['mlb_prospective_preview_v6', 'mlb_prospective_preview_v7'],
    feature_versions: ['mlb_v6_feature_contract', 'sportsdataio_stored_odds'],
    activation_reason: 'P2.0 certified future-only production epoch activation.',
    rollback_epoch_key: LEGACY_PRE_V2_EPOCH_KEY,
    activated_at: activationTimestamp,
    archived_at: null,
    metadata: {
      scope: CURRENT_V2_EPOCH_KEY,
      timezone: P2_0_TIMEZONE,
      certifiedBaselineCommit: input.certifiedBaselineCommit ?? null,
      activatedBy: input.activatedBy ?? 'p2_0_prediction_epoch_v2_activation',
      policyVersion: P2_0_POLICY_VERSION,
      productionScopeVersion: P2_0_PRODUCTION_SCOPE_VERSION,
      prediction_history_backfilled: false,
      historical_rows_rewritten: false,
      recommendation_policy_changed: false,
      official_pick_policy_changed: false,
    },
  }

  if (dryRun) {
    return {
      success: true,
      status: 'DRY_RUN_READY',
      mode: 'prediction_epoch_v2_activation_v1',
      dryRun,
      generatedAt,
      plannedRows: [legacyRow, currentRow],
      providerCallsMade: 0,
      remoteMutationsMade: 0,
      predictionRowsMutated: 0,
    }
  }

  const { error } = await supabaseAdmin
    .from('prediction_epochs')
    .upsert([legacyRow, currentRow], { onConflict: 'epoch_key' })
  if (error) throw new Error(`prediction epoch activation upsert failed: ${error.message}`)
  const activeEpoch = await getActivePredictionEpoch()
  return {
    success: Boolean(activeEpoch),
    status: activeEpoch ? 'ACTIVATED' : 'ACTIVATION_NOT_OBSERVED',
    mode: 'prediction_epoch_v2_activation_v1',
    dryRun,
    generatedAt,
    activeEpoch,
    providerCallsMade: 0,
    remoteMutationsMade: 2,
    predictionRowsMutated: 0,
  }
}
