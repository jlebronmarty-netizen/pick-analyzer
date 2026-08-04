'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type PersonalizationLanguage = 'EN' | 'ES'
export type PersonalizationAppearance = 'SYSTEM' | 'LIGHT' | 'DARK'
export type PersonalizationOddsFormat = 'AMERICAN' | 'DECIMAL'
export type HomepageDensity = 'COMPACT' | 'COMFORTABLE'
export type PreferredTeam = { sportKey: string; teamId: string; teamLabel: string }
export type PersonalizationContract = {
  contractVersion: 'personalization_v1'
  language: PersonalizationLanguage
  appearance: PersonalizationAppearance
  timezone: string
  oddsFormat: PersonalizationOddsFormat
  preferredSports: string[]
  preferredTeams: PreferredTeam[]
  homepageDensity: HomepageDensity
  showAdvancedEvidence: boolean
  updatedAt: string
  source: 'default' | 'localStorage' | 'system'
  persistenceStatus: 'DEFAULT' | 'LOCAL_PERSISTED' | 'LOCAL_UNAVAILABLE' | 'RESET'
}

type PersonalizationContextValue = {
  preferences: PersonalizationContract
  effectiveAppearance: 'LIGHT' | 'DARK'
  setPreferences: (next: PersonalizationContract) => void
  updatePreferences: (patch: Partial<PersonalizationContract>) => void
  resetPreferences: () => void
  t: (key: TranslationKey) => string
  formatDateTime: (value: string | null | undefined) => string
  formatOdds: (value: number | null | undefined) => string
  isPreferredSport: (sportKey: string | null | undefined) => boolean
  isPreferredTeamLabel: (label: string | null | undefined) => boolean
}

export const PERSONALIZATION_STORAGE_KEY = 'pick-analyzer.personalization.v1'
export const CANONICAL_OPERATING_TIMEZONE = 'America/Puerto_Rico'
export const SUPPORTED_TIMEZONES = ['America/Puerto_Rico', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'UTC']
export const SUPPORTED_SPORTS = [
  ['baseball_mlb', 'MLB'],
  ['basketball_nba', 'NBA'],
  ['americanfootball_nfl', 'NFL'],
  ['icehockey_nhl', 'NHL'],
  ['soccer', 'Soccer'],
  ['basketball_bsn', 'BSN'],
] as const
export const SUPPORTED_TEAMS: PreferredTeam[] = [
  { sportKey: 'baseball_mlb', teamId: 'mlb_ari', teamLabel: 'Arizona Diamondbacks' },
  { sportKey: 'baseball_mlb', teamId: 'mlb_atl', teamLabel: 'Atlanta Braves' },
  { sportKey: 'baseball_mlb', teamId: 'mlb_bal', teamLabel: 'Baltimore Orioles' },
  { sportKey: 'baseball_mlb', teamId: 'mlb_bos', teamLabel: 'Boston Red Sox' },
  { sportKey: 'baseball_mlb', teamId: 'mlb_chc', teamLabel: 'Chicago Cubs' },
  { sportKey: 'baseball_mlb', teamId: 'mlb_cws', teamLabel: 'Chicago White Sox' },
  { sportKey: 'baseball_mlb', teamId: 'mlb_cin', teamLabel: 'Cincinnati Reds' },
  { sportKey: 'baseball_mlb', teamId: 'mlb_cle', teamLabel: 'Cleveland Guardians' },
  { sportKey: 'baseball_mlb', teamId: 'mlb_col', teamLabel: 'Colorado Rockies' },
  { sportKey: 'baseball_mlb', teamId: 'mlb_det', teamLabel: 'Detroit Tigers' },
  { sportKey: 'baseball_mlb', teamId: 'mlb_hou', teamLabel: 'Houston Astros' },
  { sportKey: 'baseball_mlb', teamId: 'mlb_kc', teamLabel: 'Kansas City Royals' },
  { sportKey: 'baseball_mlb', teamId: 'mlb_laa', teamLabel: 'Los Angeles Angels' },
  { sportKey: 'baseball_mlb', teamId: 'mlb_lad', teamLabel: 'Los Angeles Dodgers' },
  { sportKey: 'baseball_mlb', teamId: 'mlb_mia', teamLabel: 'Miami Marlins' },
  { sportKey: 'baseball_mlb', teamId: 'mlb_mil', teamLabel: 'Milwaukee Brewers' },
  { sportKey: 'baseball_mlb', teamId: 'mlb_min', teamLabel: 'Minnesota Twins' },
  { sportKey: 'baseball_mlb', teamId: 'mlb_nym', teamLabel: 'New York Mets' },
  { sportKey: 'baseball_mlb', teamId: 'mlb_nyy', teamLabel: 'New York Yankees' },
  { sportKey: 'baseball_mlb', teamId: 'mlb_oak', teamLabel: 'Oakland Athletics' },
  { sportKey: 'baseball_mlb', teamId: 'mlb_phi', teamLabel: 'Philadelphia Phillies' },
  { sportKey: 'baseball_mlb', teamId: 'mlb_pit', teamLabel: 'Pittsburgh Pirates' },
  { sportKey: 'baseball_mlb', teamId: 'mlb_sd', teamLabel: 'San Diego Padres' },
  { sportKey: 'baseball_mlb', teamId: 'mlb_sf', teamLabel: 'San Francisco Giants' },
  { sportKey: 'baseball_mlb', teamId: 'mlb_sea', teamLabel: 'Seattle Mariners' },
  { sportKey: 'baseball_mlb', teamId: 'mlb_stl', teamLabel: 'St. Louis Cardinals' },
  { sportKey: 'baseball_mlb', teamId: 'mlb_tb', teamLabel: 'Tampa Bay Rays' },
  { sportKey: 'baseball_mlb', teamId: 'mlb_tex', teamLabel: 'Texas Rangers' },
  { sportKey: 'baseball_mlb', teamId: 'mlb_tor', teamLabel: 'Toronto Blue Jays' },
  { sportKey: 'baseball_mlb', teamId: 'mlb_wsh', teamLabel: 'Washington Nationals' },
]

const translations = {
  EN: {
    settings: 'Settings', personalization: 'Personalization', save: 'Save', saved: 'Saved', reset: 'Reset defaults', language: 'Language', appearance: 'Appearance', timezone: 'Display timezone', oddsFormat: 'Odds format', favoriteSports: 'Favorite sports', favoriteTeams: 'Favorite teams', displayPreferences: 'Display preferences', homepageDensity: 'Homepage density', showAdvancedEvidence: 'Show advanced evidence', system: 'System', light: 'Light', dark: 'Dark', compact: 'Compact', comfortable: 'Comfortable', english: 'English', spanish: 'Spanish', american: 'American', decimal: 'Decimal', localOnly: 'Local persistence', predictionSafe: 'Display preferences only. Predictions, rankings, Official Picks, settlement and learning are unchanged.', canonicalTimezone: 'Canonical operating timezone', userDisplayTimezone: 'Your display timezone', goodMorning: 'Good Morning.', whatToday: 'What should I do today?', decisionCore: 'Decision Core Morning Brief', bettingWeather: "Today's Betting Weather", performanceCenter: 'Performance Center', performanceIntro: 'Trust reflects settled canonical prediction evidence. Display preferences never regroup rows or change calculations.', favorite: 'Favorite', settingsReady: 'Personalization ready', noFavoriteTeams: 'No favorite teams selected.', addTeam: 'Add team', remove: 'Remove', anonymousOnly: 'Authenticated profile persistence is not enabled for this release; anonymous local persistence is active.', loading: 'Loading', unavailable: 'Unavailable', backToday: 'Today', noMutation: 'Settings makes no provider calls or model writes.'
  },
  ES: {
    settings: 'Configuracion', personalization: 'Personalizacion', save: 'Guardar', saved: 'Guardado', reset: 'Restablecer', language: 'Idioma', appearance: 'Apariencia', timezone: 'Zona horaria de visualizacion', oddsFormat: 'Formato de cuotas', favoriteSports: 'Deportes favoritos', favoriteTeams: 'Equipos favoritos', displayPreferences: 'Preferencias de pantalla', homepageDensity: 'Densidad de inicio', showAdvancedEvidence: 'Mostrar evidencia avanzada', system: 'Sistema', light: 'Claro', dark: 'Oscuro', compact: 'Compacto', comfortable: 'Comodo', english: 'Ingles', spanish: 'Espanol', american: 'Americano', decimal: 'Decimal', localOnly: 'Persistencia local', predictionSafe: 'Solo preferencias de visualizacion. Predicciones, rankings, Official Picks, settlement y learning no cambian.', canonicalTimezone: 'Zona horaria canonica operativa', userDisplayTimezone: 'Tu zona horaria de visualizacion', goodMorning: 'Buenos dias.', whatToday: 'Que debo hacer hoy?', decisionCore: 'Resumen Decision Core', bettingWeather: 'Clima de apuestas de hoy', performanceCenter: 'Centro de rendimiento', performanceIntro: 'La confianza refleja evidencia canonica liquidada. Las preferencias no reagrupan filas ni cambian calculos.', favorite: 'Favorito', settingsReady: 'Personalizacion lista', noFavoriteTeams: 'No hay equipos favoritos.', addTeam: 'Agregar equipo', remove: 'Quitar', anonymousOnly: 'La persistencia autenticada de perfil no esta habilitada en esta version; la persistencia local anonima esta activa.', loading: 'Cargando', unavailable: 'No disponible', backToday: 'Hoy', noMutation: 'Settings no hace llamadas a proveedores ni escrituras de modelo.'
  },
} as const
export type TranslationKey = keyof typeof translations.EN

export const DEFAULT_PERSONALIZATION: PersonalizationContract = {
  contractVersion: 'personalization_v1', language: 'EN', appearance: 'SYSTEM', timezone: CANONICAL_OPERATING_TIMEZONE, oddsFormat: 'AMERICAN', preferredSports: ['baseball_mlb'], preferredTeams: [], homepageDensity: 'COMFORTABLE', showAdvancedEvidence: false, updatedAt: 'default', source: 'default', persistenceStatus: 'DEFAULT'
}

function boundedStringArray(value: unknown, allowed?: Set<string>, limit = 12) {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of value) {
    const item = String(raw ?? '').trim()
    if (!item || seen.has(item)) continue
    if (allowed && !allowed.has(item)) continue
    seen.add(item); out.push(item)
    if (out.length >= limit) break
  }
  return out
}

export function normalizePersonalization(input: unknown, source: PersonalizationContract['source'] = 'default'): PersonalizationContract {
  const raw = typeof input === 'object' && input !== null ? input as Partial<PersonalizationContract> : {}
  const sportKeys = new Set(SUPPORTED_SPORTS.map(([key]) => key))
  const teamIds = new Set(SUPPORTED_TEAMS.map((team) => `${team.sportKey}:${team.teamId}`))
  const rawTeams = Array.isArray(raw.preferredTeams) ? raw.preferredTeams : []
  const teams = rawTeams.filter((team): team is PreferredTeam => {
    const key = `${String(team?.sportKey ?? '')}:${String(team?.teamId ?? '')}`
    return teamIds.has(key) && Boolean(team.teamLabel)
  }).slice(0, 12)
  return {
    contractVersion: 'personalization_v1',
    language: raw.language === 'ES' ? 'ES' : 'EN',
    appearance: raw.appearance === 'LIGHT' || raw.appearance === 'DARK' ? raw.appearance : 'SYSTEM',
    timezone: typeof raw.timezone === 'string' && (SUPPORTED_TIMEZONES as readonly string[]).includes(raw.timezone) ? raw.timezone : CANONICAL_OPERATING_TIMEZONE,
    oddsFormat: raw.oddsFormat === 'DECIMAL' ? 'DECIMAL' : 'AMERICAN',
    preferredSports: boundedStringArray(raw.preferredSports, sportKeys, 8),
    preferredTeams: teams.filter((team, index) => teams.findIndex((candidate) => candidate.sportKey === team.sportKey && candidate.teamId === team.teamId) === index),
    homepageDensity: raw.homepageDensity === 'COMPACT' ? 'COMPACT' : 'COMFORTABLE',
    showAdvancedEvidence: raw.showAdvancedEvidence === true,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
    source,
    persistenceStatus: source === 'localStorage' ? 'LOCAL_PERSISTED' : 'DEFAULT',
  }
}

function systemAppearance(): 'LIGHT' | 'DARK' {
  if (typeof window === 'undefined') return 'DARK'
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'LIGHT' : 'DARK'
}

export function readStoredPreferences() {
  if (typeof window === 'undefined') return DEFAULT_PERSONALIZATION
  try {
    const stored = window.localStorage.getItem(PERSONALIZATION_STORAGE_KEY)
    return stored ? normalizePersonalization(JSON.parse(stored), 'localStorage') : DEFAULT_PERSONALIZATION
  } catch {
    return { ...DEFAULT_PERSONALIZATION, persistenceStatus: 'LOCAL_UNAVAILABLE' as const }
  }
}

export function formatOddsValue(value: number | null | undefined, format?: PersonalizationOddsFormat) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return translations.EN.unavailable
  const odds = Number(value)
  const resolved = format ?? readStoredPreferences().oddsFormat
  if (resolved === 'DECIMAL') {
    const decimal = odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds)
    return decimal.toFixed(2)
  }
  return odds > 0 ? `+${odds}` : `${odds}`
}

export function formatDateTimeValue(value: string | null | undefined, timezone?: string, language?: PersonalizationLanguage) {
  if (!value) return translations.EN.unavailable
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return translations.EN.unavailable
  const prefs = readStoredPreferences()
  return parsed.toLocaleString(language === 'ES' ? 'es-US' : 'en-US', { timeZone: timezone ?? prefs.timezone, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
}

const PersonalizationContext = createContext<PersonalizationContextValue | null>(null)

export function PersonalizationProvider({ children }: { children: ReactNode }) {
  const [preferences, setState] = useState<PersonalizationContract>(() => readStoredPreferences())
  const effectiveAppearance = preferences.appearance === 'LIGHT' ? 'LIGHT' : preferences.appearance === 'DARK' ? 'DARK' : systemAppearance()
  useEffect(() => {
    const resolved = effectiveAppearance
    document.documentElement.lang = preferences.language === 'ES' ? 'es' : 'en'
    document.documentElement.dataset.appearance = resolved.toLowerCase()
    document.documentElement.dataset.personalizationContract = preferences.contractVersion
    document.documentElement.classList.toggle('pa-light', resolved === 'LIGHT')
    document.documentElement.classList.toggle('pa-dark', resolved === 'DARK')
  }, [preferences, effectiveAppearance])
  const setPreferences = useCallback((next: PersonalizationContract) => {
    const normalized = normalizePersonalization({ ...next, updatedAt: new Date().toISOString() }, 'localStorage')
    setState(normalized)
    try { window.localStorage.setItem(PERSONALIZATION_STORAGE_KEY, JSON.stringify(normalized)) } catch { setState({ ...normalized, persistenceStatus: 'LOCAL_UNAVAILABLE' }) }
  }, [])
  const updatePreferences = useCallback((patch: Partial<PersonalizationContract>) => setPreferences({ ...preferences, ...patch }), [preferences, setPreferences])
  const resetPreferences = useCallback(() => setPreferences({ ...DEFAULT_PERSONALIZATION, updatedAt: new Date().toISOString(), persistenceStatus: 'RESET' }), [setPreferences])
  const value = useMemo<PersonalizationContextValue>(() => ({
    preferences,
    effectiveAppearance,
    setPreferences,
    updatePreferences,
    resetPreferences,
    t: (key) => translations[preferences.language][key] ?? translations.EN[key],
    formatDateTime: (value) => formatDateTimeValue(value, preferences.timezone, preferences.language),
    formatOdds: (value) => formatOddsValue(value, preferences.oddsFormat),
    isPreferredSport: (sportKey) => Boolean(sportKey && preferences.preferredSports.includes(sportKey)),
    isPreferredTeamLabel: (label) => Boolean(label && preferences.preferredTeams.some((team) => String(label).toLowerCase().includes(team.teamLabel.toLowerCase()))),
  }), [preferences, effectiveAppearance, setPreferences, updatePreferences, resetPreferences])
  return <PersonalizationContext.Provider value={value}>{children}</PersonalizationContext.Provider>
}

export function usePersonalization() {
  const value = useContext(PersonalizationContext)
  if (!value) throw new Error('usePersonalization must be used inside PersonalizationProvider')
  return value
}
