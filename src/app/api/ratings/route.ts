import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getRatingFromTeamStats } from '@/services/rating.service'

export async function GET() {
  const { data, error } = await supabase
    .from('team_stats')
    .select('*')
    .eq('sport_key', 'baseball_mlb')

  if (error) {
    return NextResponse.json({
      success: false,
      error: error.message,
    })
  }

  const ratings =
    data?.map((team) => ({
      team: team.team_name,
      rating: getRatingFromTeamStats(
        team,
        true
      ),
    })) ?? []

  ratings.sort(
    (a, b) => b.rating - a.rating
  )

  return NextResponse.json({
    success: true,
    ratings,
  })
}