import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { supabaseAdmin } from '@/lib/supabase-admin'

const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const PROVIDER = 'the-odds-api'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const eventId = request.nextUrl.searchParams.get('eventId')?.trim()
    if (!eventId || !eventId.startsWith('baseball_mlb:mlb:')) {
      return apiError({ id, code: 'INVALID_REQUEST', message: 'A canonical MLB eventId is required.' }, 400)
    }

    const { data, error } = await supabaseAdmin
      .from('sports_odds_snapshots')
      .select('id,event_id,provider,sportsbook,market,outcome,price,line,snapshot_time,provider_timestamp,created_at,updated_at,metadata')
      .eq('sport_key', SPORT_KEY)
      .eq('league_key', LEAGUE_KEY)
      .eq('provider', PROVIDER)
      .eq('event_id', eventId)
      .order('snapshot_time', { ascending: false })
      .limit(100)

    if (error) throw new Error(`MLB certification snapshot read failed: ${error.message}`)

    const rows = (data ?? []).map((row) => {
      const metadata = row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
        ? row.metadata as Record<string, unknown>
        : {}
      return {
        id: row.id,
        eventId: row.event_id,
        provider: row.provider,
        sportsbook: row.sportsbook,
        market: row.market,
        outcome: row.outcome,
        price: row.price,
        line: row.line,
        snapshotTime: row.snapshot_time,
        providerTimestamp: row.provider_timestamp,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        sourceVersion: metadata.sourceVersion ?? null,
        providerMarketKey: metadata.providerMarketKey ?? null,
        providerEventId: metadata.providerEventId ?? null,
        playerId: metadata.playerId ?? null,
        playerName: metadata.playerName ?? null,
        bookmakerKey: metadata.bookmakerKey ?? null,
        officialPickEligible: metadata.officialPickEligible ?? null,
      }
    })

    return apiOk({
      success: true,
      mode: 'mlb_decision_board_certification_snapshot_read_v1',
      readOnly: true,
      eventId,
      rows,
      summary: {
        count: rows.length,
        sportsbooks: Array.from(new Set(rows.map((row) => row.sportsbook).filter(Boolean))).sort(),
        markets: Array.from(new Set(rows.map((row) => row.market).filter(Boolean))).sort(),
        providerEventIds: Array.from(new Set(rows.map((row) => row.providerEventId).filter(Boolean))).sort(),
      },
    }, id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown MLB certification snapshot read error') })
  }
}
