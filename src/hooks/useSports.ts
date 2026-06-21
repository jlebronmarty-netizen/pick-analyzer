'use client'

import { useEffect, useState } from 'react'
import { getSports } from '@/services/sports.service'
import { Sport } from '@/types/database'

export function useSports() {
  const [sports, setSports] = useState<Sport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadSports() {
      try {
        setLoading(true)
        setError(null)

        const data = await getSports()
        setSports(data)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not load sports.'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    loadSports()
  }, [])

  return {
    sports,
    loading,
    error,
  }
}