import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getMlbOfficialReplacementStatus, runMlbOfficialSportsDataIoOffDryRun } from '@/services/mlb-official-replacement.service'
import { validateMlbOfficialProviderFixtures } from '@/services/mlb-official-data-provider.service'
import { apiError, errorMessage } from '@/lib/api-contract'

export async function GET(request: Request) {
  const id = randomUUID()
  try {
    const url = new URL(request.url)
    const includeValidation = url.searchParams.get('includeValidation') === 'true'
    const status = await getMlbOfficialReplacementStatus()
    return NextResponse.json({
      ...status,
      validation: includeValidation ? {
        officialProviderFixtures: validateMlbOfficialProviderFixtures(),
        sportsDataIoOffDryRun: runMlbOfficialSportsDataIoOffDryRun(),
      } : null,
      providerCallsMade: 0,
      databaseMutationsMade: 0,
      requestId: id,
    })
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown MLB official replacement status error') })
  }
}
