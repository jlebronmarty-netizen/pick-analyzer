import { NextRequest, NextResponse } from 'next/server'
import {
  createBsnResults,
  getBsnResults,
  syncBsnResultsToGameResults,
} from '@/services/bsn.service'

export async function GET() {
  try {
    const data = await getBsnResults()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const results = Array.isArray(body) ? body : body.results

    if (!Array.isArray(results)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Expected an array of results or { results: [...] }',
        },
        { status: 400 }
      )
    }

    const created = await createBsnResults(results)
    const synced = await syncBsnResultsToGameResults()

    return NextResponse.json({
      success: true,
      created,
      synced,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}