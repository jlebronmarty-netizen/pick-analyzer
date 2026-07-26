import { apiOk, requestId } from '@/lib/api-contract'
import { validateProbabilityPickFixtures } from '@/services/probability-picks.service'

export async function GET(request: Request) {
  return apiOk(validateProbabilityPickFixtures(), requestId(request))
}
