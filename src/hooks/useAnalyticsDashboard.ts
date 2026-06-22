'use client'

import { useEffect, useState } from 'react'

type Summary = {
  picks: number
  settled: number
  pending: number
  wins: number
  losses: number
  pushes: number
  winRate: number
  profit: number
  roi: number
}

type GroupSummary = Summary & {
  key: string
}

type AnalyticsDashboard = {
  success: boolean
  overall: Summary
  bySport: GroupSummary[]
  bestTeams: GroupSummary[]
  worstTeams: GroupSummary[]
}

export function useAnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadAnalytics() {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch('/api/analytics/dashboard')
        const payload = await response.json()

        if (!response.ok || !payload.success) {
          throw new Error(payload.error ?? 'Failed to load analytics')
        }

        setData(payload)
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unexpected analytics error'
        )
      } finally {
        setLoading(false)
      }
    }

    loadAnalytics()
  }, [])

  return {
    data,
    loading,
    error,
  }
}