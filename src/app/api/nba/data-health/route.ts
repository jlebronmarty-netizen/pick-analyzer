import { NextResponse } from 'next/server'
import { getNbaDataHealth } from '@/services/nba-data-sync.service'

export async function GET() {
  const result = await getNbaDataHealth()
  return NextResponse.json(result)
}
