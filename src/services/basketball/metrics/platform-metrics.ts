import type { BasketballCanonicalEntity } from '@/services/basketball/types/entities'

export function summarizeBasketballPlatformMetrics(entities: BasketballCanonicalEntity[] = []) {
  const qualityScores = entities.map((entity) => entity.quality)
  const average = (values: number[]) =>
    values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : null

  return {
    success: true,
    mode: 'basketball_platform_metrics_v1',
    providerCallsMade: 0,
    entities: entities.length,
    validationStatus: {
      valid: qualityScores.filter((quality) => quality.validationStatus === 'valid').length,
      partial: qualityScores.filter((quality) => quality.validationStatus === 'partial').length,
      conflict: qualityScores.filter((quality) => quality.validationStatus === 'conflict').length,
      invalid: qualityScores.filter((quality) => quality.validationStatus === 'invalid').length,
    },
    scores: {
      completeness: average(qualityScores.map((quality) => quality.completenessScore)),
      confidence: average(qualityScores.map((quality) => quality.confidenceScore)),
      consistency: average(qualityScores.map((quality) => quality.consistencyScore)),
    },
  }
}
