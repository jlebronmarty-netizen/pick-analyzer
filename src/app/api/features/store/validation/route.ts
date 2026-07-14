import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { probeHistoricalFeatureSchemaCapabilities } from '@/lib/server-schema-capabilities'
import { runFeatureStoreValidation } from '@/services/feature-store-core.service'
import { runHistoricalFeatureGenerationValidation } from '@/services/historical-feature-generation.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    const featureStore = runFeatureStoreValidation()
    const schemaCapabilities = await probeHistoricalFeatureSchemaCapabilities()
    const historicalFeatureGeneration = runHistoricalFeatureGenerationValidation(schemaCapabilities)

    return apiOk({
      ...featureStore,
      success: featureStore.success && historicalFeatureGeneration.success,
      schemaCapabilities,
      historicalFeatureGeneration,
    }, id)
  } catch (error) {
    console.error('Feature Store validation error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown Feature Store validation error'),
    })
  }
}
