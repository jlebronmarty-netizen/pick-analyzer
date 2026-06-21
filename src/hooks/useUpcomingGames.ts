'use client'

import { useEffect, useState } from 'react'
import {
  getUpcomingOddsGames,
  OddsGame,
} from '@/services/odds.service'

export function useUpcomingGames(sport = 'baseball_mlb') {
  const [games, setGames] = useState<OddsGame[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadGames() {
      try {
        setLoading(true)
        setError(null)

        const data = await getUpcomingOddsGames(sport)
        setGames(data)
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Could not load upcoming games.'

        setError(message)
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