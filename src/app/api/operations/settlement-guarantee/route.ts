import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getSettlementGuaranteeStatus, validateSettlementGuaranteeFixtures } from '@/services/settlement-guarantee.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const lookbackDays = Number(request.nextUrl.searchParams.get('lookbackDays') ?? 2)
    const includeValidation = request.nextUrl.searchParams.get('includeValidation') === 'true'
    const status = await getSettlementGuaranteeStatus({ lookbackDays: Number.isFinite(lookbackDays) ? lookbackDays : 2 })
    return apiOk(
      {
        ...status,
        validation: includeValidation ? validateSettlementGuaranteeFixtures() : undefined,
      },
      id,
      { status: status.success ? 200 : 409 },
    )
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown settlement guarantee error') })
  }
}
