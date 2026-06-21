'use client'

import { useEffect, useState } from 'react'
import { TeamStats } from '@/types/database'
import { getTeamStats } from '@/services/team-stats.service'

export function useTeamStats(sportKey = 'baseball_mlb') {
  const [teamStats, setTeamStats] = useState<TeamStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadTeamStats() {
      try {
        setLoading(true)
        setError(null)

        const data = await getTeamStats(sportKey)
        setTeamStats(data)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Could not load team stats.'

        setError(message)
      } finally {
        setLoading(false)
      }
    }

    loadTeamStats()
  }, [sportKey])

  return {
    teamStats,
    loading,
    error,
  }
}