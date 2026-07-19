import type { BasketballCanonicalEntity } from '@/services/basketball/types/entities'
import { evaluateBasketballDataQuality } from '@/services/basketball/validators/data-quality'

export type BasketballReconciliationConflict = {
  field: string
  values: Array<{ sourceId: string; value: unknown; confidence: number }>
}

export type BasketballReconciliationResult = {
  success: true
  mode: 'basketball_reconciliation_engine_v1'
  canonicalId: string
  selected: BasketballCanonicalEntity
  conflicts: BasketballReconciliationConflict[]
  provenancePreserved: true
  silentOverwrite: false
}

function comparableFields(entity: BasketballCanonicalEntity): string[] {
  if (entity.kind === 'game') return ['scheduledAt', 'status', 'homeScore', 'awayScore', 'venueId']
  if (entity.kind === 'team') return ['name', 'abbreviation', 'city', 'country']
  if (entity.kind === 'player') return ['fullName', 'teamId', 'position', 'jersey']
  return []
}

export function reconcileBasketballEntities(entities: BasketballCanonicalEntity[]): BasketballReconciliationResult | null {
  if (entities.length === 0) return null
  const sorted = [...entities].sort((left, right) => {
    const leftConfidence = left.provenance[0]?.confidence ?? 0
    const rightConfidence = right.provenance[0]?.confidence ?? 0
    return rightConfidence - leftConfidence
  })
  const selected = { ...sorted[0], provenance: sorted.flatMap((entity) => entity.provenance) } as BasketballCanonicalEntity
  const conflicts: BasketballReconciliationConflict[] = []
  for (const field of comparableFields(selected)) {
    const values = sorted.map((entity) => ({
      sourceId: entity.provenance[0]?.sourceId ?? 'unknown',
      value: (entity as unknown as Record<string, unknown>)[field],
      confidence: entity.provenance[0]?.confidence ?? 0,
    }))
    if (new Set(values.map((item) => JSON.stringify(item.value))).size > 1) conflicts.push({ field, values })
  }
  selected.quality = evaluateBasketballDataQuality({
    ...selected,
    quality: {
      ...selected.quality,
      warnings: [...selected.quality.warnings, ...conflicts.map((conflict) => `conflict:${conflict.field}`)],
    },
  })
  return {
    success: true,
    mode: 'basketball_reconciliation_engine_v1',
    canonicalId: selected.id,
    selected,
    conflicts,
    provenancePreserved: true,
    silentOverwrite: false,
  }
}
