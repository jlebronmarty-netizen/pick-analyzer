import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const sampleMlbStats = [
  {
    team_name: 'New York Yankees',
    sport_key: 'baseball_mlb',
    season: '2026',
    wins: 48,
    losses: 29,
    ties: 0,
    home_wins: 26,
    home_losses: 13,
    away_wins: 22,
    away_losses: 16,
    last_5_wins: 4,
    last_5_losses: 1,
    last_10_wins: 7,
    last_10_losses: 3,
    streak: 'W3',
    win_percentage: 0.623,
  },
  {
    team_name: 'Los Angeles Dodgers',
    sport_key: 'baseball_mlb',
    season: '2026',
    wins: 50,
    losses: 27,
    ties: 0,
    home_wins: 28,
    home_losses: 12,
    away_wins: 22,
    away_losses: 15,
    last_5_wins: 3,
    last_5_losses: 2,
    last_10_wins: 6,
    last_10_losses: 4,
    streak: 'W1',
    win_percentage: 0.649,
  },
  {
    team_name: 'St. Louis Cardinals',
    sport_key: 'baseball_mlb',
    season: '2026',
    wins: 39,
    losses: 38,
    ties: 0,
    home_wins: 21,
    home_losses: 17,
    away_wins: 18,
    away_losses: 21,
    last_5_wins: 3,
    last_5_losses: 2,
    last_10_wins: 5,
    last_10_losses: 5,
    streak: 'L1',
    win_percentage: 0.506,
  },
  {
    team_name: 'Kansas City Royals',
    sport_key: 'baseball_mlb',
    season: '2026',
    wins: 34,
    losses: 43,
    ties: 0,
    home_wins: 18,
    home_losses: 20,
    away_wins: 16,
    away_losses: 23,
    last_5_wins: 2,
    last_5_losses: 3,
    last_10_wins: 4,
    last_10_losses: 6,
    streak: 'W1',
    win_percentage: 0.442,
  },
]

export async function GET() {
  const { data, error } = await supabase
    .from('team_stats')
    .select('*')
    .eq('sport_key', 'baseball_mlb')
    .order('win_percentage', { ascending: false })

  if (error) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    count: data.length,
    data,
  })
}

export async function POST() {
  const { data, error } = await supabase
    .from('team_stats')
    .upsert(sampleMlbStats, {
      onConflict: 'team_name,sport_key,season',
    })
    .select()

  if (error) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    count: data.length,
    message: 'Sample MLB team stats inserted.',
    data,
  })
}