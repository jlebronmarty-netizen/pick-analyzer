import { NextResponse } from 'next/server'
import { getMultiSportRegistry } from '@/services/multi-sport-query.service'
import { validateMultiSportEngine } from '@/services/multi-sport-validation.service'

export async function GET() {
  const registry = getMultiSportRegistry()
  const validation = validateMultiSportEngine()

  return NextResponse.json({
    ...registry,
    validation,
  })
}
