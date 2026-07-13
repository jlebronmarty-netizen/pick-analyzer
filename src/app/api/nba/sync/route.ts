import { NextRequest, NextResponse } from 'next/server'
import {
  parseNbaSyncOptions,
  runNbaSync,
  validateNbaSyncOptions,
} from '@/services/nba-data-sync.service'

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) return true

  const authHeader = request.headers.get('authorization')
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

  return authHeader === `Bearer ${cronSecret}` || secret === cronSecret
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const options = parseNbaSyncOptions(request.nextUrl.searchParams)
  const validation = validateNbaSyncOptions(options)

  if (!validation.valid) {
    return NextResponse.json(
      { success: false, errors: validation.errors },
      { status: 400 }
    )
  }

  const result = await runNbaSync('all', options)

  return NextResponse.json(result, {
    status: result.success ? 200 : 207,
  })
}

export async function GET(request: NextRequest) {
  return POST(request)
}
