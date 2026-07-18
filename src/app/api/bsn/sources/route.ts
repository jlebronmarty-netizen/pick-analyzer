import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getBsnSourceFramework, getBsnSourceQuality, validateBsnSourceFrameworkFixtures } from '@/services/bsn-platform.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const sourceId = request.nextUrl.searchParams.get('sourceId') ?? request.nextUrl.searchParams.get('source')
    return apiOk(
      {
        success: true,
        mode: 'bsn_source_framework_bundle_v1',
        generatedAt: new Date().toISOString(),
        framework: getBsnSourceFramework(),
        quality: getBsnSourceQuality(sourceId),
        validation: validateBsnSourceFrameworkFixtures(),
        providerCallsMade: 0,
      },
      id
    )
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown BSN source framework error') })
  }
}
