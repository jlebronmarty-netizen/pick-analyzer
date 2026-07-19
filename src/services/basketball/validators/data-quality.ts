import type { BasketballCanonicalEntity, BasketballQualityEnvelope } from '@/services/basketball/types/entities'

function scoreCompleteness(entity: BasketballCanonicalEntity) {
  const missing = entity.quality.missingFields.length
  return Math.max(0, Math.min(100, 100 - missing * 12))
}

export function evaluateBasketballDataQuality(entity: BasketballCanonicalEntity): BasketballQualityEnvelope {
  const completenessScore = Math.min(entity.quality.completenessScore, scoreCompleteness(entity))
  const provenanceConfidence = entity.provenance.length
    ? Math.round(entity.provenance.reduce((sum, item) => sum + item.confidence, 0) / entity.provenance.length)
    : 0
  const confidenceScore = Math.min(entity.quality.confidenceScore, provenanceConfidence || entity.quality.confidenceScore)
  const consistencyScore = entity.quality.warnings.some((warning) => warning.includes('conflict'))
    ? Math.min(entity.quality.consistencyScore, 55)
    : entity.quality.consistencyScore
  const validationStatus =
    completenessScore < 50
      ? 'invalid'
      : consistencyScore < 60
        ? 'conflict'
        : completenessScore < 90 || confidenceScore < 70
          ? 'partial'
          : 'valid'

  return {
    ...entity.quality,
    completenessScore,
    confidenceScore,
    consistencyScore,
    validationStatus,
  }
}

export function validateBasketballQualityFixtures() {
  const quality = evaluateBasketballDataQuality({
    id: 'basketball_bsn:bsn_pr:team:santurce',
    kind: 'team',
    sportKey: 'basketball_bsn',
    leagueKey: 'bsn_pr',
    season: '2026',
    version: 'fixture',
    name: 'Fixture',
    abbreviation: null,
    city: null,
    country: 'PR',
    provenance: [{
      sourceId: 'fixture_csv',
      connectorId: 'csv',
      providerId: null,
      fetchedAt: '2026-01-01T00:00:00.000Z',
      observedAt: null,
      confidence: 82,
      rawHash: null,
    }],
    quality: {
      completenessScore: 100,
      confidenceScore: 100,
      consistencyScore: 100,
      validationStatus: 'valid',
      missingFields: ['abbreviation'],
      warnings: [],
    },
  })
  return {
    success: quality.validationStatus === 'partial' && quality.confidenceScore === 82,
    mode: 'basketball_data_quality_validation_v1',
    checks: 2,
    passed: quality.validationStatus === 'partial' && quality.confidenceScore === 82 ? 2 : 0,
    failed: quality.validationStatus === 'partial' && quality.confidenceScore === 82 ? 0 : 2,
    providerCallsMade: 0,
  }
}
