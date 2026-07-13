import { NextResponse } from 'next/server'
import { getMultiSportHealth } from '@/services/multi-sport-health.service'
import { validateMultiSportEngine } from '@/services/multi-sport-validation.service'

export async function GET() {
  const [health, validation] = await Promise.all([
    getMultiSportHealth(),
    Promise.resolve(validateMultiSportEngine()),
  ])

  return NextResponse.json({
    ...health,
    validation,
  })
}
