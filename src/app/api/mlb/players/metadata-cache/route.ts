import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getMlbPlayerMetadataCoverage } from '@/services/mlb-model-platform.service'

export async function GET(request: Request) {
  const id = requestId(request)
  try {
    return apiOk(await getMlbPlayerMetadataCoverage(), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown MLB player metadata cache error') })
  }
}
