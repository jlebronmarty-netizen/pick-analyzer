'use client'

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  DEFAULT_SPORT,
  getSportDefinition,
  isSupportedSport,
  SportKey,
} from '@/config/sports.config'

type SportContextValue = {
  sportKey: SportKey
  setSportKey: (sportKey: SportKey) => void
  sport: ReturnType<typeof getSportDefinition>
  isAllSports: boolean
}

const SportContext = createContext<SportContextValue | null>(null)

const STORAGE_KEY = 'pick-analyzer-selected-sport'

export function SportProvider({ children }: { children: ReactNode }) {
  const [sportKey, setSportKeyState] = useState<SportKey>(DEFAULT_SPORT)

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)

    if (stored && isSupportedSport(stored)) {
      setSportKeyState(stored)
    }
  }, [])

  function setSportKey(nextSport: SportKey) {
    setSportKeyState(nextSport)
    window.localStorage.setItem(STORAGE_KEY, nextSport)
  }

  const value = useMemo(
    () => ({
      sportKey,
      setSportKey,
      sport: getSportDefinition(sportKey),
      isAllSports: sportKey === 'all',
    }),
    [sportKey]
  )

  return (
    <SportContext.Provider value={value}>
      {children}
    </SportContext.Provider>
  )
}

export function useSport() {
  const context = useContext(SportContext)

  if (!context) {
    throw new Error('useSport must be used inside SportProvider')
  }

  return context
}