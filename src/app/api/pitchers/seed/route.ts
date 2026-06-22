import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  try {
    const rows = [
      {
        sport_key: 'baseball_mlb',
        team: 'New York Yankees',
        team_name: 'New York Yankees',
        player_name: 'Yankees Starter',
        pitcher_name: 'Yankees Starter',
        era: 3.25,
        whip: 1.12,
        k_per_9: 9.4,
        is_probable_starter: true,
      },
      {
        sport_key: 'baseball_mlb',
        team: 'Detroit Tigers',
        team_name: 'Detroit Tigers',
        player_name: 'Tigers Starter',
        pitcher_name: 'Tigers Starter',
        era: 4.65,
        whip: 1.38,
        k_per_9: 7.1,
        is_probable_starter: true,
      },
      {
        sport_key: 'baseball_mlb',
        team: 'Philadelphia Phillies',
        team_name: 'Philadelphia Phillies',
        player_name: 'Phillies Starter',
        pitcher_name: 'Phillies Starter',
        era: 2.95,
        whip: 1.05,
        k_per_9: 10.2,
        is_probable_starter: true,
      },
      {
        sport_key: 'baseball_mlb',
        team: 'Washington Nationals',
        team_name: 'Washington Nationals',
        player_name: 'Nationals Starter',
        pitcher_name: 'Nationals Starter',
        era: 5.1,
        whip: 1.46,
        k_per_9: 6.8,
        is_probable_starter: true,
      },
    ]

    const { data, error } = await supabaseAdmin
      .from('pitcher_stats')
      .upsert(rows)
      .select('*')

    if (error) {
      throw new Error(error.message)
    }

    return NextResponse.json({
      success: true,
      inserted: data?.length ?? 0,
      pitchers: data ?? [],
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown pitcher seed error',
      },
      { status: 500 }
    )
  }
}

export async function POST() {
  return GET()
}