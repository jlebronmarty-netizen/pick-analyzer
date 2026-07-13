import { NextResponse } from 'next/server'
import { getNbaPredictionHealth } from '@/services/nba-prediction-engine.service'

export async function GET() {
  const result = await getNbaPredictionHealth()
  return NextResponse.json(result)
}
