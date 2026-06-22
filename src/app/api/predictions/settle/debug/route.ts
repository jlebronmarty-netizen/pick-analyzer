import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    const { data: pendingPredictions, error: predictionError } = await supabase
      .from('prediction_history')
      .select(
        'id, sport_key, game_id, commence_time, home_team, away_team, team, opponent, status'
      )
      .or('status.is.null,status.eq.pending')
      .order('commence_time', { ascending: true })
      .limit(10)

    if (predictionError) {
      throw new Error(predictionError.message)
    }

    const { data: recentResults, error: resultError } = await supabase
      .from('game_results')
      .select(
        'id, sport_key, game_id, commence_time, home_team, away_team, home_score, away_score'
      )
      .order('commence_time', { ascending: false })
      .limit(10)

    if (resultError) {
      throw new Error(resultError.message)
    }

    return NextResponse.json({
      success: true,
      pendingPredictionSample: pendingPredictions ?? [],
      recentResultSample: recentResults ?? [],
      counts: {
        pendingSample: pendingPredictions?.length ?? 0,
        resultSample: recentResults?.length ?? 0,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown debug error',
      },
      { status: 500 }
    )
  }
}