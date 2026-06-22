import { NextResponse } from 'next/server'
import {
  createBsnGames,
  createBsnResults,
  syncBsnResultsToGameResults,
} from '@/services/bsn.service'

export async function GET() {
  try {
    const now = new Date()

    const today = now.toISOString().slice(0, 10)
    const yesterdayDate = new Date(now)
    yesterdayDate.setDate(now.getDate() - 1)
    const yesterday = yesterdayDate.toISOString().slice(0, 10)

    const games = [
      {
        commence_time: `${today}T23:00:00.000Z`,
        home_team: 'Vaqueros de Bayamón',
        away_team: 'Gigantes de Carolina',
      },
      {
        commence_time: `${today}T23:30:00.000Z`,
        home_team: 'Cangrejeros de Santurce',
        away_team: 'Mets de Guaynabo',
      },
      {
        commence_time: `${today}T23:45:00.000Z`,
        home_team: 'Leones de Ponce',
        away_team: 'Capitanes de Arecibo',
      },
      {
        commence_time: `${today}T23:55:00.000Z`,
        home_team: 'Piratas de Quebradillas',
        away_team: 'Indios de Mayagüez',
      },
    ]

    const results = [
      {
        game_id: `bsn_${yesterday}_atleticos_de_san_german_osos_de_manati`,
        commence_time: `${yesterday}T23:00:00.000Z`,
        home_team: 'Atléticos de San Germán',
        away_team: 'Osos de Manatí',
        home_score: 88,
        away_score: 82,
      },
      {
        game_id: `bsn_${yesterday}_criollos_de_caguas_santeros_de_aguada`,
        commence_time: `${yesterday}T23:30:00.000Z`,
        home_team: 'Criollos de Caguas',
        away_team: 'Santeros de Aguada',
        home_score: 79,
        away_score: 84,
      },
    ]

    const createdGames = await createBsnGames(games)
    const createdResults = await createBsnResults(results)
    const syncedResults = await syncBsnResultsToGameResults()

    return NextResponse.json({
      success: true,
      message: 'BSN seed completed',
      createdGames,
      createdResults,
      syncedResults,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown seed error',
      },
      { status: 500 }
    )
  }
}

export async function POST() {
  return GET()
}