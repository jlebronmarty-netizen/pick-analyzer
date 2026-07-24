import { NextResponse } from 'next/server'
import { getPerformanceProductContract } from '@/services/performance-product-contract.service'

export async function GET() {
  try {
    const data = await getPerformanceProductContract()
    return NextResponse.json({
      success: true,
      apiStatus: data.apiStatus,
      mode: 'performance_sports_api_v1',
      generatedAt: data.generatedAt,
      sports: data.sports,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
    })
  } catch (error) {
    return NextResponse.json({ success: false, apiStatus: 'ERROR', error: error instanceof Error ? error.message : 'Unknown sports performance error' }, { status: 500 })
  }
}
