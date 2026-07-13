import { NextResponse } from 'next/server'
import { getNbaSyncStatus } from '@/services/nba-data-sync.service'

export async function GET() {
  const result = await getNbaSyncStatus()
  return NextResponse.json(result, { status: result.success ? 200 : 500 })
}
