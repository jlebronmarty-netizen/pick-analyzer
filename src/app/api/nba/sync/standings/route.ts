import { NextRequest, NextResponse } from 'next/server'
import {
  parseNbaSyncOptions,
  syncNbaStandings,
  validateNbaSyncOptions,
} from '@/services/nba-data-sync.service'

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return true
  const authHeader = request.headers.get('authorization')
  const { searchParams } = new URL(request.url)
  return authHeader === `Bearer ${cronSecret}` || searchParams.get('secret') === cronSecret
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  const options = parseNbaSyncOptions(request.nextUrl.searchParams)
  const validation = validateNbaSyncOptions(options)
  if (!validation.valid) return NextResponse.json({ success: false, errors: validation.errors }, { status: 400 })
  const result = await syncNbaStandings(options)
  return NextResponse.json(result, { status: result.success ? 200 : 207 })
}
