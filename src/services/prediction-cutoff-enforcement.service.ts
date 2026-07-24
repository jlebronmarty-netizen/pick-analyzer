import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'

export const CUTOFF_ENFORCEMENT_VERSION = 'prediction_cutoff_enforcement_v1'

export type CutoffState = 'PREGAME' | 'POST_START' | 'POST_FINAL' | 'INVALID_CUTOFF' | 'UNKNOWN'

export type CutoffPredictionLike = {
  id?: string | null
  sport_key?: string | null
  game_id?: string | null
  commence_time?: string | null
  generated_at?: string | null
  cutoff_at?: string | null
  created_at?: string | null
  settled_at?: string | null
  validation_warnings?: unknown
  settlement_details?: Record<string, unknown> | null
  production_eligible?: boolean | null
  recommended_pick?: boolean | null
  lifecycle_status?: string | null
  validation_status?: string | null
}

export type CutoffEventLike = {
  id?: string | null
  start_time?: string | null
  status?: string | null
  updated_at?: string | null
  home_score?: number | null
  away_score?: number | null
}

function parseMs(value: string | null | undefined) {
  const parsed = Date.parse(value ?? '')
  return Number.isFinite(parsed) ? parsed : null
}

function lower(value: unknown) {
  return String(value ?? '').toLowerCase()
}

export function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function isFinalEvent(event?: CutoffEventLike | null) {
  const status = lower(event?.status)
  return ['completed', 'complete', 'final', 'closed'].includes(status) || (event?.home_score !== null && event?.away_score !== null)
}

function finalObservedAt(row: CutoffPredictionLike, event?: CutoffEventLike | null) {
  if (row.settled_at) return row.settled_at
  if (isFinalEvent(event) && event?.updated_at) return event.updated_at
  return null
}

export function classifyPredictionCutoff(row: CutoffPredictionLike, event?: CutoffEventLike | null) {
  const generatedAt = row.generated_at ?? row.created_at ?? null
  const eventStart = event?.start_time ?? row.commence_time ?? null
  const cutoffAt = row.cutoff_at ?? eventStart
  const finalAt = finalObservedAt(row, event)
  const generatedMs = parseMs(generatedAt)
  const startMs = parseMs(eventStart)
  const cutoffMs = parseMs(cutoffAt)
  const finalMs = parseMs(finalAt)

  let state: CutoffState = 'PREGAME'
  let reason = 'PREDICTION_BEFORE_CUTOFF'
  if (generatedMs === null || cutoffMs === null) {
    state = 'INVALID_CUTOFF'
    reason = generatedMs === null ? 'MISSING_GENERATED_TIMESTAMP' : 'MISSING_CUTOFF_TIMESTAMP'
  } else if (finalMs !== null && generatedMs >= finalMs) {
    state = 'POST_FINAL'
    reason = 'PREDICTION_AT_OR_AFTER_FINAL_OBSERVED_TIMESTAMP'
  } else if (startMs !== null && generatedMs >= startMs) {
    state = 'POST_START'
    reason = 'PREDICTION_AT_OR_AFTER_EVENT_START'
  } else if (generatedMs >= cutoffMs) {
    state = 'INVALID_CUTOFF'
    reason = 'PREDICTION_AT_OR_AFTER_CUTOFF'
  }

  return {
    version: CUTOFF_ENFORCEMENT_VERSION,
    state,
    reason,
    eligible: state === 'PREGAME',
    predictionTimestamp: generatedAt,
    persistedTimestamp: row.created_at ?? null,
    canonicalEventStart: eventStart,
    canonicalEventEnd: null,
    finalObservedAt: finalAt,
    cutoffTimestamp: cutoffAt,
    eventIdentifier: event?.id ?? row.game_id ?? null,
    confidence: 1,
  }
}

export function withCutoffMetadata<T extends CutoffPredictionLike>(row: T, event?: CutoffEventLike | null): T {
  const classification = classifyPredictionCutoff(row, event)
  if (classification.eligible) return row
  const warnings = Array.isArray(row.validation_warnings) ? row.validation_warnings.map(String) : []
  const details = asObject(row.settlement_details)
  return {
    ...row,
    production_eligible: false,
    recommended_pick: false,
    lifecycle_status: 'skipped',
    validation_status: 'skipped',
    validation_warnings: Array.from(new Set([...warnings, `${classification.state}: ${classification.reason}`])),
    settlement_details: {
      ...details,
      cutoff_enforcement_v1: classification,
    },
  }
}

function metadataFor(classification: ReturnType<typeof classifyPredictionCutoff>, timestamp: string) {
  return {
    ...classification,
    classificationVersion: CUTOFF_ENFORCEMENT_VERSION,
    classificationTimestamp: timestamp,
    source: 'existing_prediction_cutoff_classification_v1',
    mutationScope: 'classification_metadata_only',
  }
}

function existingClassification(row: CutoffPredictionLike) {
  return asObject(asObject(row.settlement_details).cutoff_enforcement_v1)
}

function classificationMatches(existing: Record<string, unknown>, next: Record<string, unknown>) {
  return (
    existing.version === next.version &&
    existing.state === next.state &&
    existing.reason === next.reason &&
    existing.predictionTimestamp === next.predictionTimestamp &&
    existing.persistedTimestamp === next.persistedTimestamp &&
    existing.canonicalEventStart === next.canonicalEventStart &&
    existing.finalObservedAt === next.finalObservedAt &&
    existing.cutoffTimestamp === next.cutoffTimestamp &&
    existing.eventIdentifier === next.eventIdentifier
  )
}

type StoredPredictionRow = CutoffPredictionLike & {
  id: string
  production_eligible?: boolean | null
  recommended_pick?: boolean | null
  lifecycle_status?: string | null
  validation_status?: string | null
}

export async function reconcilePredictionCutoffRows({
  apply = false,
  sportKey,
  batchSize = 100,
  maxBatches,
}: {
  apply?: boolean
  sportKey?: string | null
  batchSize?: number
  maxBatches?: number | null
} = {}) {
  const startedAt = new Date().toISOString()
  const predictions: StoredPredictionRow[] = []
  for (let from = 0; ; from += 1000) {
    let query = supabaseAdmin
      .from('prediction_history')
      .select('id, sport_key, game_id, commence_time, generated_at, cutoff_at, created_at, settled_at, production_eligible, recommended_pick, lifecycle_status, validation_status, validation_warnings, settlement_details')
      .order('created_at', { ascending: false })
      .range(from, from + 999)
    if (sportKey) query = query.eq('sport_key', sportKey)
    const { data, error } = await query
    if (error) throw new Error(`prediction cutoff read failed: ${error.message}`)
    predictions.push(...((data ?? []) as StoredPredictionRow[]))
    if (!data || data.length < 1000) break
  }

  const eventIds = Array.from(new Set(predictions.map((row) => row.game_id).filter(Boolean))) as string[]
  const events = new Map<string, CutoffEventLike>()
  for (let index = 0; index < eventIds.length; index += 100) {
    const { data, error } = await supabaseAdmin
      .from('sport_events')
      .select('id, start_time, status, updated_at, home_score, away_score')
      .in('id', eventIds.slice(index, index + 100))
    if (error) throw new Error(`prediction cutoff event read failed: ${error.message}`)
    for (const event of data ?? []) events.set(String(event.id), event as CutoffEventLike)
  }

  const classified = predictions.map((row) => {
    const event = row.game_id ? events.get(row.game_id) : undefined
    return { row, event, classification: classifyPredictionCutoff(row, event) }
  })
  const excluded = classified.filter((item) => !item.classification.eligible)
  const alreadyClassified = excluded.filter((item) =>
    classificationMatches(existingClassification(item.row), metadataFor(item.classification, String(existingClassification(item.row).classificationTimestamp ?? startedAt)))
  )
  const pendingClassification = excluded.filter((item) =>
    !classificationMatches(existingClassification(item.row), metadataFor(item.classification, String(existingClassification(item.row).classificationTimestamp ?? startedAt)))
  )
  const byState = excluded.reduce<Record<string, number>>((acc, item) => {
    acc[item.classification.state] = (acc[item.classification.state] ?? 0) + 1
    return acc
  }, {})

  let updated = 0
  let skipped = alreadyClassified.length
  let batchesCompleted = 0
  let syncJobId: string | null = null
  if (apply) {
    const job = await supabaseAdmin.from('sports_sync_jobs').insert({
      job_type: CUTOFF_ENFORCEMENT_VERSION,
      sport_key: sportKey ?? 'all',
      league_key: null,
      provider: 'internal',
      season: null,
      status: 'running',
      records_fetched: predictions.length,
      records_inserted: 0,
      records_updated: 0,
      records_skipped: skipped,
      error_count: 0,
      metadata: {
        mode: CUTOFF_ENFORCEMENT_VERSION,
        apply,
        mutationScope: 'classification_metadata_only',
        expectedExcluded: excluded.length,
        expectedByState: byState,
        startedAt,
      },
    }).select('id').single()
    if (job.error) throw new Error(`prediction cutoff job insert failed: ${job.error.message}`)
    syncJobId = String(job.data.id)

    const capped = maxBatches ? pendingClassification.slice(0, Math.max(0, maxBatches) * batchSize) : pendingClassification
    for (let index = 0; index < capped.length; index += batchSize) {
      const batch = capped.slice(index, index + batchSize)
      const batchNumber = Math.floor(index / batchSize) + 1
      const batchStarted = new Date().toISOString()
      let batchUpdated = 0
      for (const item of batch) {
        const details = asObject(item.row.settlement_details)
        const classificationTimestamp = new Date().toISOString()
        const metadata = metadataFor(item.classification, classificationTimestamp)
        const { error } = await supabaseAdmin
          .from('prediction_history')
          .update({
            settlement_details: {
              ...details,
              cutoff_enforcement_v1: metadata,
            },
          })
          .eq('id', item.row.id)
        if (error) throw new Error(`prediction cutoff metadata update failed for ${item.row.id}: ${error.message}`)
        batchUpdated += 1
      }
      updated += batchUpdated
      batchesCompleted += 1
      const batchFinished = new Date().toISOString()
      const checkpoint = await supabaseAdmin.from('historical_import_checkpoints').upsert([{
        id: `${CUTOFF_ENFORCEMENT_VERSION}:${syncJobId}:batch:${batchNumber}`,
        import_id: null,
        source_registry_id: null,
        checkpoint_level: 'normalization',
        checkpoint_key: `${CUTOFF_ENFORCEMENT_VERSION}_batch_${batchNumber}`,
        status: 'completed',
        record_count: batch.length,
        warning_count: 0,
        error_count: 0,
        checksum_sha256: null,
        started_at: batchStarted,
        finished_at: batchFinished,
        metadata: {
          mode: CUTOFF_ENFORCEMENT_VERSION,
          syncJobId,
          batchNumber,
          updated: batchUpdated,
          skipped: 0,
          firstPredictionId: batch[0]?.row.id ?? null,
          lastPredictionId: batch[batch.length - 1]?.row.id ?? null,
          mutationScope: 'classification_metadata_only',
        },
      }], { onConflict: 'id' })
      if (checkpoint.error) throw new Error(`prediction cutoff checkpoint failed: ${checkpoint.error.message}`)
    }
    const completedAt = new Date().toISOString()
    const jobUpdate = await supabaseAdmin.from('sports_sync_jobs').update({
      completed_at: completedAt,
      status: 'completed',
      records_updated: updated,
      records_skipped: skipped,
      duration_ms: Date.parse(completedAt) - Date.parse(startedAt),
      metadata: {
        mode: CUTOFF_ENFORCEMENT_VERSION,
        apply,
        mutationScope: 'classification_metadata_only',
        expectedExcluded: excluded.length,
        expectedByState: byState,
        updated,
        skipped,
        batchesCompleted,
        completedAt,
      },
    }).eq('id', syncJobId)
    if (jobUpdate.error) throw new Error(`prediction cutoff job update failed: ${jobUpdate.error.message}`)
  }

  return {
    success: true,
    mode: CUTOFF_ENFORCEMENT_VERSION,
    apply,
    audited: predictions.length,
    eligible: classified.length - excluded.length,
    excluded: excluded.length,
    byState,
    pendingClassification: pendingClassification.length,
    alreadyClassified: alreadyClassified.length,
    updated,
    skipped,
    batchesCompleted,
    syncJobId,
    sample: excluded.slice(0, 25).map((item) => ({
      predictionId: item.row.id,
      sportKey: item.row.sport_key,
      gameId: item.row.game_id,
      state: item.classification.state,
      reason: item.classification.reason,
      predictionTimestamp: item.classification.predictionTimestamp,
      persistedTimestamp: item.classification.persistedTimestamp,
      canonicalEventStart: item.classification.canonicalEventStart,
      finalObservedAt: item.classification.finalObservedAt,
      cutoffTimestamp: item.classification.cutoffTimestamp,
    })),
    providerCallsMade: 0,
    remoteMutationsMade: apply ? updated : 0,
  }
}
