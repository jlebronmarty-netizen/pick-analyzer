import { NextRequest, NextResponse } from 'next/server'
import { getPerformanceProductContract } from '@/services/performance-product-contract.service'

export async function GET(request: NextRequest) {
  const sportKey = request.nextUrl.searchParams.get('sportKey')
  const data = await getPerformanceProductContract({ sportKey })
  return NextResponse.json({ success: true, apiStatus: data.apiStatus, mode: 'performance_evolution_api_v1', generatedAt: data.generatedAt, evolution: data.evolution, scopePolicy: data.scopePolicy, providerCallsMade: 0, remoteMutationsMade: 0 })
}
