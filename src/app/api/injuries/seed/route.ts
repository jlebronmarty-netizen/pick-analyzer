import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  try {
    const rows = [
      {
        sport_key: 'baseball_mlb',
        team: 'Detroit Tigers',
        team_name: 'Detroit Tigers',
        player_name: 'Key Tigers Batter',
        status: 'out',
        impact_score: 2.5,
      },
      {
        sport_key: 'baseball_mlb',
        team: 'Washington Nationals',
        team_name: 'Washington Nationals',
        player_name: 'Nationals Starter',
        status: 'questionable',
        impact_score: 1.5,
      },
      {
        sport_key: 'basketball_bsn',
        team: 'Gigantes de Carolina',
        team_name: 'Gigantes de Carolina',
        player_name: 'Carolina Key Guard',
        status: 'out',
        impact_score: 3,
      },
      {
        sport_key: 'basketball_bsn',
        team: 'Mets de Guaynabo',
        team_name: 'Mets de Guaynabo',
        player_name: 'Guaynabo Forward',
        status: 'questionable',
        impact_score: 1.25,
      },
    ]

    const { data, error } = await supabaseAdmin
      .from('injuries')
      .upsert(rows)
      .select('*')

    if (error) {
      throw new Error(error.message)
    }

    return NextResponse.json({
      success: true,
      inserted: data?.length ?? 0,
      injuries: data ?? [],
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown injury seed error',
      },
      { status: 500 }
    )
  }
}

export async function POST() {
  return GET()
}