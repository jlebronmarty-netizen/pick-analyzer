import { NextRequest, NextResponse } from 'next/server'
import { getPerformanceProductContract, validatePerformanceProductContractFixtures } from '@/services/performance-product-contract.service'

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get('validate') === 'true') {
    return NextResponse.json(validatePerformanceProductContractFixtures())
  }
  const sportKey = request.nextUrl.searchParams.get('sportKey')
  const data = await getPerformanceProductContract({ sportKey })
  return NextResponse.json({
    success: true,
    apiStatus: data.apiStatus,
    mode: 'performance_goals_api_v1',
    generatedAt: data.generatedAt,
    goals: data.goals,
    scopePolicy: data.scopePolicy,
    scopeReconciliation: data.scopeReconciliation,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  })
}
