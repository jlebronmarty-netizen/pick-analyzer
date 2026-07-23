import { NextResponse } from 'next/server'
import { loadNbaPredictionEngine } from '@/lib/server-lazy-diagnostics'

export async function GET() {
  const { getNbaPredictionHealth } = await loadNbaPredictionEngine()
    const result = await getNbaPredictionHealth()
  return NextResponse.json(result)
}
