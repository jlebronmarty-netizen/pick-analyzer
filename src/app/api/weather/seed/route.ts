import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  try {
    const rows = [
      {
        sport_key: 'baseball_mlb',
        game_id: '7eeb2a9fecc4a8958efb172e75c65224',
        temperature: 78,
        wind_speed: 12,
        precipitation_chance: 15,
        impact_score: 0.75,
      },
      {
        sport_key: 'baseball_mlb',
        game_id: '2bbd66d60ea2fc31f947643a281cfb84',
        temperature: 91,
        wind_speed: 18,
        precipitation_chance: 35,
        impact_score: -1.25,
      },
      {
        sport_key: 'basketball_bsn',
        game_id: 'bsn_2026_06_22_vaqueros_de_bayam_n_gigantes_de_carolina',
        temperature: 84,
        wind_speed: 0,
        precipitation_chance: 0,
        impact_score: 0,
      },
    ]

    const { data, error } = await supabaseAdmin
      .from('weather_impacts')
      .upsert(rows)
      .select('*')

    if (error) {
      throw new Error(error.message)
    }

    return NextResponse.json({
      success: true,
      inserted: data?.length ?? 0,
      weather: data ?? [],
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown weather seed error',
      },
      { status: 500 }
    )
  }
}

export async function POST() {
  return GET()
}