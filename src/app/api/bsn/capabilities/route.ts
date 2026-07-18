import { NextResponse } from 'next/server'
import {
  getBsnCapabilityMatrix,
  getBsnSourceIntelligence,
} from '@/services/bsn-platform.service'

export async function GET() {
  return NextResponse.json({
    success: true,
    mode: 'bsn_capabilities_bundle_v1',
    generatedAt: new Date().toISOString(),
    sourceIntelligence: getBsnSourceIntelligence(),
    capabilityMatrix: getBsnCapabilityMatrix(),
    providerCallsMade: 0,
  })
}
