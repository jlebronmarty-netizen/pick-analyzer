import { NextResponse } from 'next/server'
import { getNbaDataHealth } from '@/services/nba-data-sync.service'

export async function GET() {
  const result = await getNbaDataHealth()
  return NextResponse.json({
    ...result,
    scope: 'LEGACY_AND_GENERAL_NBA_DATA_HEALTH',
    goatCurrentEraAuthoritativeHealth: '/api/nba/goat/audit',
    note: 'Legacy/trial feeds and historical backlogs are retained here for compatibility and do not by themselves indicate NBA GOAT current-era failure.',
  })
}
