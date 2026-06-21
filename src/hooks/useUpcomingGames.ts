'use client'

import { useEffect, useState } from 'react'

type UpcomingGame = {
  id: string
  sport_key: string
  sport_title: string
  commence_time: string
  home_team: string
  away_team: string
  bookmakers: {
    title: string
    markets: {
      key: string
      outcomes: {
        name: string
        price: number
      }[]
    }[]
  }[]
  predictions?: {
    team: string
    opponent: string
    odds: number
    impliedProbability: number
    modelProbability: number
    edge: number
    ev: number
    confidence: number
    recommendedPick: boolean
  }[]
  recommendedPick?: {
    team: string
    opponent: string
    odds: number
    impliedProbability: number
    modelProbability: number
    edge: number
    ev: number
    confidence: number
    recommendedPick: boolean
  } | null
}

export function useUpcomingGames(sport = 'baseball_mlb') {
  const [games, setGames] = useState<UpcomingGame[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadGames() {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/odds?sport=${sport}`)

        const data = await response.json()

        if (!response.ok || !data.success) {
          throw new Error(data.error ?? 'Failed to load upcoming games')
        }

        setGames(data.games ?? [])
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unexpected error loading games'
        )
        setGames([])
      } finally {
        setLoading(false)
      }
    }

    loadGames()
  }, [sport])

  return {
    games,
    loading,
    error,
  }
}