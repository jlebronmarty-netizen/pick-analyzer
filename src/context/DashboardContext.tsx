'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'

type DashboardData = any

type DashboardContextType = {
  dashboard: DashboardData | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const DashboardContext = createContext<DashboardContextType>({
  dashboard: null,
  loading: true,
  error: null,
  refresh: async () => {},
})

export function DashboardProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/dashboard', {
        cache: 'no-store',
      })

      const json = await response.json()

      if (!response.ok || !json.success) {
        throw new Error(json.error ?? 'Dashboard load failed')
      }

      setDashboard(json)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unknown dashboard error'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <DashboardContext.Provider
      value={{
        dashboard,
        loading,
        error,
        refresh,
      }}
    >
      {children}
    </DashboardContext.Provider>
  )
}

export function useDashboard() {
  return useContext(DashboardContext)
}