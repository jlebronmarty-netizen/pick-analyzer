import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getDataCoverageInventoryV1, validateDataCoverageInventoryV1Fixtures } from '@/services/data-coverage-inventory.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const inventory = await getDataCoverageInventoryV1()
    return apiOk({
      success: true,
      mode: 'data_health_center_v1',
      generatedAt: inventory.generatedAt,
      readOnly: true,
      providerCallsMade: inventory.providerCallsMade,
      remoteMutationsMade: inventory.remoteMutationsMade,
      productionMutationsMade: inventory.productionMutationsMade,
      summary: inventory.summary,
      sports: inventory.sports.map((sport) => ({
        key: sport.key,
        sportKey: sport.sportKey,
        label: sport.label,
        status: sport.status,
        coverage: {
          numerator: sport.health.domainsWithRows,
          denominator: sport.health.totalDomains,
          exactCountDomains: sport.health.domainsWithExactCounts,
          measurementWindow: {
            earliestDate: sport.earliestDate,
            latestDate: sport.latestDate,
            applicableSeason: sport.currentSeason,
            freshnessWindow: 'stored-data current inventory; no provider refresh executed',
          },
        },
        dataHealth: {
          duplicateIndicators: sport.health.duplicateIndicators,
          invalidSamples: sport.health.invalidSamples,
          orphanSamples: sport.health.orphanSamples,
          staleSamples: sport.health.staleSamples,
          providerCapable: sport.health.providerCapable,
          providerEntitled: sport.health.providerEntitled,
          importReady: sport.health.importReady,
          predictionReady: sport.health.predictionReady,
          settlementReady: sport.domains.find((domain) => domain.key === 'settled_predictions')?.rowCount ? 'partial' : 'blocked',
          learningReady: sport.domains.find((domain) => domain.key === 'learning_labels')?.exactCountAvailable ? 'partial' : 'blocked',
          highestValueNextAcquisition: sport.health.highestValueNextAcquisition,
        },
        readiness: sport.predictionReadiness,
        blockers: sport.blockers,
      })),
      validation: request.nextUrl.searchParams.get('validate') === 'true' ? validateDataCoverageInventoryV1Fixtures() : undefined,
      warnings: inventory.warnings,
    }, id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown data health center error') })
  }
}
