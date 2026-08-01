'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { normalizeAmericanOddsInput, normalizeMoneyInput, normalizeOptionalLineInput } from '@/lib/wager-input-normalization'

type Category = 'OFFICIAL_PICK' | 'VALUE_CANDIDATE' | 'RESEARCH_ONLY' | 'NO_BET'
type SlipType = 'single' | 'parlay'
type WagerStatus = 'draft' | 'placed' | 'won' | 'lost' | 'push' | 'void'
type RemoteMode = 'checking' | 'local-only' | 'authenticated' | 'sync-pending' | 'syncing' | 'synced' | 'failed' | 'offline' | 'expired' | 'duplicate'

type Opportunity = {
  id: string
  eventId: string | null
  predictionId: string | null
  sport: string
  league: string
  matchup: string
  market: string
  selection: string
  startTime: string | null
  eventStatus: string
  source: string
  category: Category
  probability: number | null
  confidence: number | null
  odds: number | null
  line: number | null
  edge: number | null
  ev: number | null
  explanation: string
  freshness: string
  modelVersion: string
  featureVersion: string
  evidenceQuality: 'decision-grade' | 'directional' | 'insufficient'
  warnings: string[]
  missing: string[]
  segmentSample: number | null
  segmentAccuracy: number | null
  segmentBrier: number | null
  segmentCalibration: number | null
  boardLabel: string
  lastUpdate: string | null
  risk: string
  currentState: string
}

type DraftLeg = {
  odds: string
  line: string
  stake: string
  sportsbook: string
  notes: string
}

type UserWager = {
  id: string
  createdAt: string
  eventIds: string[]
  predictionIds: string[]
  sportsbook: string
  enteredOdds: number[]
  stake: number
  betType: SlipType
  legs: Array<{
    betId: string
    category: Category
    matchup: string
    market: string
    selection: string
    enteredOdds: number | null
    enteredLine: number | null
  }>
  status: WagerStatus
  potentialPayout: number | null
  actualPayout: number | null
  result: string
  notes: string
  sourceCategory: string
  remoteId?: string
  syncStatus?: 'local' | 'synced' | 'failed' | 'duplicate'
  archived?: boolean
}

type SessionState = {
  email: string | null
  userId: string | null
  expiresAt: string | null
}

const storageKey = 'pick-analyzer-release12-user-wagers-v1'
const localPersistenceScope = 'LOCAL_BROWSER_STORAGE_ONLY'
const marketThreshold = 100
const bucketThreshold = 50

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function rows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : []
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []
}

function num(value: unknown, fallback: number | null = null) {
  const next = Number(value)
  return Number.isFinite(next) ? next : fallback
}

function userOdds(value: unknown) {
  return normalizeAmericanOddsInput(value).value
}

function userStake(value: unknown, fallback = 0) {
  return normalizeMoneyInput(value).value ?? fallback
}

function userLine(value: unknown) {
  return normalizeOptionalLineInput(value).value
}

function text(value: unknown, fallback = 'Unavailable') {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function pct(value: number | null) {
  return value === null ? 'Unavailable' : `${value.toFixed(1)}%`
}

function signedPct(value: number | null) {
  if (value === null) return 'Unavailable'
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}

function money(value: number | null) {
  if (value === null || !Number.isFinite(value)) return 'Unavailable'
  return value.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

function odds(value: number | null) {
  if (value === null) return 'Unavailable'
  return value > 0 ? `+${value}` : String(value)
}

function line(value: number | null) {
  if (value === null) return 'Unavailable'
  return value > 0 ? `+${value}` : String(value)
}

function when(value: string | null) {
  if (!value) return 'Unavailable'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unavailable'
  return date.toLocaleString([], { timeZone: 'America/Puerto_Rico', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
}

function marketName(value: unknown) {
  const raw = text(value, 'Market')
  const key = raw.toLowerCase()
  if (key === 'moneyline') return 'Moneyline'
  if (key === 'spread' || key === 'run_line') return 'Run Line'
  if (key === 'total') return 'Total'
  return raw
}

function categoryLabel(value: Category) {
  if (value === 'OFFICIAL_PICK') return 'Official Pick'
  if (value === 'VALUE_CANDIDATE') return 'Value Candidate'
  if (value === 'RESEARCH_ONLY') return 'Research Pick'
  return 'No Bet / Avoid'
}

function decimalFromAmerican(value: number) {
  return value > 0 ? 1 + value / 100 : 1 + 100 / Math.abs(value)
}

function kelly(modelProbability: number | null, price: number | null) {
  if (modelProbability === null || price === null) return null
  const p = modelProbability / 100
  const b = decimalFromAmerican(price) - 1
  return Math.max(0, (((b * p) - (1 - p)) / b) * 100)
}

function locked(startTime: string | null, status: string) {
  const lowered = status.toLowerCase()
  if (lowered.includes('final') || lowered.includes('postponed') || lowered.includes('cancel')) return true
  if (!startTime) return false
  const start = new Date(startTime).getTime()
  return Number.isFinite(start) && Date.now() >= start
}

function localDayKey(value: Date | string | null) {
  const date = value instanceof Date ? value : value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return 'Unavailable'
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Puerto_Rico', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

function activePregameState(startTime: string | null, status: string) {
  const lowered = status.toLowerCase()
  if (lowered.includes('cancel') || lowered.includes('postpon')) return 'unavailable'
  if (lowered.includes('final') || lowered.includes('complete') || lowered.includes('settled')) return 'final'
  if (lowered.includes('live') || lowered.includes('in_progress') || lowered.includes('progress')) return 'live'
  if (!startTime) return 'unavailable'
  const start = new Date(startTime).getTime()
  if (!Number.isFinite(start)) return 'unavailable'
  if (Date.now() >= start) return 'live'
  if (localDayKey(startTime) !== localDayKey(new Date())) return 'history'
  return 'pregame'
}

function selection(opportunity: Opportunity) {
  if (opportunity.market === 'Total') return `${opportunity.selection} ${line(opportunity.line)} Total`
  if (opportunity.market === 'Run Line') return `${opportunity.selection} ${line(opportunity.line)} Run Line`
  if (opportunity.market === 'Moneyline') return `${opportunity.selection} Moneyline`
  return opportunity.selection
}

function segmentFor(segments: Record<string, unknown>, market: string) {
  const dimensions = record(segments.dimensions)
  const marketRows = rows(dimensions.market)
  const normalized = market.toLowerCase().replaceAll(' ', '_')
  const found = marketRows.find((item) => text(item.key ?? item.market ?? item.label, '').toLowerCase().replaceAll(' ', '_') === normalized)
  return {
    sample: num(found?.sampleSize ?? found?.scored),
    accuracy: num(found?.accuracy),
    brier: num(found?.brier),
    calibration: num(found?.calibrationError),
  }
}

function classify(input: { official: boolean; status: string; edge: number | null; ev: number | null; confidence: number | null }) {
  const status = input.status.toLowerCase()
  if (input.official) return 'OFFICIAL_PICK' as Category
  if (status.includes('avoid') || status.includes('pass') || status.includes('blocked')) return 'NO_BET' as Category
  if ((input.edge ?? 0) > 0 && (input.ev ?? 0) > 0 && (input.confidence ?? 0) >= 55) return 'VALUE_CANDIDATE' as Category
  return 'RESEARCH_ONLY' as Category
}

function evidence(sample: number | null, official: boolean, probability: number | null, price: number | null) {
  if (official && probability !== null) return 'decision-grade' as const
  if (sample !== null && sample >= marketThreshold && probability !== null) return 'directional' as const
  if (sample !== null && sample >= bucketThreshold && probability !== null && price !== null) return 'directional' as const
  return 'insufficient' as const
}

function mapBoardCandidate(candidate: Record<string, unknown>, segments: Record<string, unknown>): Opportunity {
  const market = marketName(candidate.marketLabel ?? candidate.market)
  const status = text(candidate.recommendationStatus ?? candidate.semanticLabel, 'ANALYZED')
  const official = status === 'QUALIFIED' || status === 'BEST_BET_CANDIDATE' || status === 'PLAY_OF_DAY_CANDIDATE'
  const probability = num(candidate.probability ?? candidate.modelProbability ?? candidate.rawProbability)
  const confidence = num(candidate.confidence)
  const price = candidate.odds === null || candidate.americanOdds === null ? null : num(candidate.odds ?? candidate.americanOdds)
  const edge = num(candidate.actionableEdge ?? candidate.edge)
  const ev = num(candidate.actionableExpectedValue ?? candidate.expectedValue ?? candidate.ev)
  const segment = segmentFor(segments, market)
  const category = classify({ official, status, edge, ev, confidence })
  const missing = [...strings(candidate.missingInformation), ...strings(candidate.blockers)]
  const startTime = typeof candidate.scheduledTime === 'string' ? candidate.scheduledTime : typeof candidate.startTime === 'string' ? candidate.startTime : null
  const eventStatus = text(candidate.eventStatus ?? candidate.status, status)
  const boardLabel = text(candidate.boardLabel ?? candidate.source, 'Current Board')
  const lastUpdate = typeof candidate.marketFreshnessTimestamp === 'string' ? candidate.marketFreshnessTimestamp : typeof candidate.oddsTimestamp === 'string' ? candidate.oddsTimestamp : typeof candidate.predictionGeneratedAt === 'string' ? candidate.predictionGeneratedAt : null
  const warnings = warningsFor({ category, probability, price, edge, ev, sample: segment.sample, missing, startTime, eventStatus })
  return {
    id: text(candidate.id ?? candidate.predictionId, `${text(candidate.selection ?? candidate.team, 'selection')}-${market}`),
    eventId: typeof candidate.eventId === 'string' ? candidate.eventId : null,
    predictionId: typeof candidate.predictionId === 'string' ? candidate.predictionId : typeof candidate.id === 'string' ? candidate.id : null,
    sport: text(candidate.sportKey ?? candidate.sport, 'baseball_mlb'),
    league: text(candidate.leagueKey ?? candidate.league, 'MLB'),
    matchup: text(candidate.matchup ?? candidate.game, 'Current slate'),
    market,
    selection: text(candidate.selection ?? candidate.team, 'Selection'),
    startTime,
    eventStatus,
    source: boardLabel,
    category,
    probability,
    confidence,
    odds: price,
    line: candidate.line === null || candidate.line === undefined ? null : num(candidate.line),
    edge,
    ev,
    explanation: text(candidate.why ?? candidate.reason ?? candidate.summary, 'Existing board evidence is available; no extra reason was supplied.'),
    freshness: text(candidate.marketFreshnessState ?? candidate.freshness ?? candidate.canonicalMarketState, 'Unavailable'),
    modelVersion: text(candidate.modelVersion, 'Unavailable'),
    featureVersion: text(candidate.featureVersion, 'Unavailable'),
    evidenceQuality: evidence(segment.sample, official, probability, price),
    warnings,
    missing,
    segmentSample: segment.sample,
    segmentAccuracy: segment.accuracy,
    segmentBrier: segment.brier,
    segmentCalibration: segment.calibration,
    boardLabel,
    lastUpdate,
    risk: text(candidate.riskGrade ?? candidate.reliability ?? candidate.confidenceLabel, 'Unavailable'),
    currentState: activePregameState(startTime, eventStatus),
  }
}

function mapTopPick(pick: Record<string, unknown>, segments: Record<string, unknown>): Opportunity {
  const market = marketName(pick.market)
  const probability = num(pick.model_probability ?? pick.modelProbability)
  const confidence = num(pick.confidence)
  const price = pick.odds === null ? null : num(pick.odds)
  const edge = num(pick.edge)
  const ev = num(pick.ev ?? pick.expectedValue)
  const segment = segmentFor(segments, market)
  const startTime = typeof pick.commence_time === 'string' ? pick.commence_time : typeof pick.startTime === 'string' ? pick.startTime : null
  const eventStatus = text(pick.status, 'OFFICIAL')
  const lastUpdate = typeof pick.generated_at === 'string' ? pick.generated_at : typeof pick.updatedAt === 'string' ? pick.updatedAt : null
  return {
    id: text(pick.id, `${text(pick.team ?? pick.selection, 'selection')}-${market}-top`),
    eventId: typeof pick.event_id === 'string' ? pick.event_id : typeof pick.eventId === 'string' ? pick.eventId : null,
    predictionId: typeof pick.id === 'string' ? pick.id : null,
    sport: text(pick.sport_key ?? pick.sportKey, 'baseball_mlb'),
    league: text(pick.league_key ?? pick.leagueKey, 'MLB'),
    matchup: `${text(pick.away_team ?? pick.awayTeam, '')} at ${text(pick.home_team ?? pick.homeTeam, '')}`.trim(),
    market,
    selection: text(pick.team ?? pick.selection, 'Selection'),
    startTime,
    eventStatus,
    source: 'Top Picks',
    category: 'OFFICIAL_PICK',
    probability,
    confidence,
    odds: price,
    line: pick.line === null || pick.line === undefined ? null : num(pick.line),
    edge,
    ev,
    explanation: 'Official Pick source only; recommendation policy remains owned by Top Picks.',
    freshness: 'Stored recommendation evidence',
    modelVersion: text(pick.model_version ?? pick.modelVersion, 'Unavailable'),
    featureVersion: text(pick.feature_version ?? pick.featureVersion, 'Unavailable'),
    evidenceQuality: evidence(segment.sample, true, probability, price),
    warnings: warningsFor({ category: 'OFFICIAL_PICK', probability, price, edge, ev, sample: segment.sample, missing: [], startTime, eventStatus }),
    missing: [],
    segmentSample: segment.sample,
    segmentAccuracy: segment.accuracy,
    segmentBrier: segment.brier,
    segmentCalibration: segment.calibration,
    boardLabel: 'CURRENT',
    lastUpdate,
    risk: 'Official policy candidate',
    currentState: activePregameState(startTime, eventStatus),
  }
}

function warningsFor(input: {
  category: Category
  probability: number | null
  price: number | null
  edge: number | null
  ev: number | null
  sample: number | null
  missing: string[]
  startTime: string | null
  eventStatus: string
}) {
  const warnings: string[] = []
  if (input.category === 'NO_BET') warnings.push('No Bet classification: not actionable.')
  if (input.probability === null) warnings.push('Model probability unavailable.')
  if (input.price === null) warnings.push('Price unavailable; EV and edge require a persisted or user-entered price.')
  if (input.edge !== null && input.edge <= 0) warnings.push('No positive edge at the available price.')
  if (input.ev !== null && input.ev <= 0) warnings.push('No positive EV at the available price.')
  if (input.sample !== null && input.sample < marketThreshold) warnings.push('Segment sample is below the Release 08 market threshold.')
  if (input.missing.length) warnings.push(`Missing information: ${input.missing.slice(0, 2).join(', ')}.`)
  if (locked(input.startTime, input.eventStatus)) warnings.push('Event has started or is no longer pregame; row is read-only.')
  return warnings
}

function unique(list: Opportunity[]) {
  const map = new Map<string, Opportunity>()
  list.forEach((item) => {
    const key = `${item.eventId ?? item.matchup}|${item.market}|${item.selection}|${item.line ?? 'null'}`
    const existing = map.get(key)
    if (!existing || item.category === 'OFFICIAL_PICK' || item.source === 'Current Board') map.set(key, item)
  })
  return Array.from(map.values())
}

function canonicalLiveOpportunities(list: Opportunity[]) {
  const map = new Map<string, Opportunity>()
  for (const item of list) {
    if (item.boardLabel.toUpperCase() === 'HISTORICAL') continue
    if (item.currentState !== 'pregame') continue
    const key = `${item.eventId ?? item.matchup}|${item.market}|${item.selection}|${item.line ?? 'null'}`
    const existing = map.get(key)
    const itemTime = item.lastUpdate ? new Date(item.lastUpdate).getTime() : 0
    const existingTime = existing?.lastUpdate ? new Date(existing.lastUpdate).getTime() : 0
    if (!existing || item.category === 'OFFICIAL_PICK' || itemTime >= existingTime) map.set(key, item)
  }
  return Array.from(map.values())
}

function slateEmptyState(history: Opportunity[]) {
  if (!history.length) return { title: 'No pregame opportunities remain today.', text: 'The active board returned no eligible pregame opportunities for the current Puerto Rico operating day.' }
  const states = history.map((item) => item.currentState)
  if (states.every((state) => state === 'final')) return { title: "Today's slate has concluded.", text: 'Use Results, Performance or Tomorrow\'s slate instead of stale active picks.' }
  if (states.every((state) => state === 'live' || state === 'final')) return { title: 'No pregame opportunities remain today.', text: 'All visible slate rows have started or finished, so the active betting board is empty.' }
  return { title: 'No pregame opportunities remain today.', text: 'Historical and stale snapshots are available only in History.' }
}

async function sessionSnapshot(refresh = false) {
  const { data, error } = refresh ? await supabase.auth.refreshSession() : await supabase.auth.getSession()
  const session = data.session
  return {
    token: session?.access_token ?? null,
    error: error?.message ?? null,
    state: {
      email: session?.user?.email ?? null,
      userId: session?.user?.id ?? null,
      expiresAt: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
    } satisfies SessionState,
  }
}

async function sessionToken() {
  const snapshot = await sessionSnapshot()
  return snapshot.token
}

async function bridgeServerSession(token: string) {
  const response = await fetch('/api/user/session-bridge', {
    method: 'POST',
    cache: 'no-store',
    credentials: 'same-origin',
    headers: authHeaders(token),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw remoteFailure(payload, response.status, 'AUTH_VERIFICATION_FAILED: Unable to establish authenticated API session bridge.')
}

function authHeaders(token: string | null) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

function sourceCategoryFor(legs: UserWager['legs']) {
  const categories = new Set(legs.map((leg) => leg.category === 'RESEARCH_ONLY' ? 'RESEARCH_PICK' : leg.category))
  if (categories.size > 1) return 'MIXED'
  return categories.values().next().value ?? 'USER_ONLY'
}

function remotePayload(wager: UserWager, opportunities: Opportunity[]) {
  return {
    clientCreatedId: wager.id,
    placedAt: wager.createdAt,
    sportsbook: wager.sportsbook,
    betType: wager.betType.toUpperCase(),
    stake: wager.stake,
    currency: 'USD',
    potentialPayout: wager.potentialPayout,
    actualPayout: wager.actualPayout,
    status: wager.status.toUpperCase(),
    result: wager.result,
    notes: wager.notes,
    sourceCategory: wager.sourceCategory,
    modelSnapshot: {
      release: 'Release 13',
      workspaceStorageKey: storageKey,
      modelDataLabel: 'decision-time snapshot only',
    },
    totalEnteredOdds: wager.enteredOdds[0] ?? null,
    legs: wager.legs.map((leg) => {
      const source = opportunities.find((item) => item.id === leg.betId)
      return {
        eventId: source?.eventId ?? null,
        predictionId: source?.predictionId ?? null,
        sport: source?.sport ?? null,
        league: source?.league ?? null,
        matchup: leg.matchup,
        eventStartTime: source?.startTime ?? null,
        market: leg.market,
        selection: leg.selection,
        userEnteredLine: leg.enteredLine,
        userEnteredOdds: leg.enteredOdds,
        canonicalLineSnapshot: source?.line ?? null,
        canonicalOddsSnapshot: source?.odds ?? null,
        modelProbabilitySnapshot: source?.probability ?? null,
        confidenceSnapshot: source?.confidence ?? null,
        evidenceGrade: source?.evidenceQuality ?? null,
        result: null,
        status: 'PENDING',
      }
    }),
  }
}

function remotePatchPayload(patch: Partial<UserWager>) {
  return {
    ...(patch.status ? { status: patch.status.toUpperCase() } : {}),
    ...(patch.actualPayout !== undefined ? { actualPayout: patch.actualPayout } : {}),
    ...(patch.result !== undefined ? { result: patch.result } : {}),
    ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
    ...(patch.archived !== undefined ? { isArchived: patch.archived } : {}),
  }
}

function remoteModeLabel(mode: RemoteMode) {
  if (mode === 'checking') return 'Checking session'
  if (mode === 'local-only') return 'Local Only Mode'
  if (mode === 'authenticated') return 'Remote Ledger Active'
  if (mode === 'sync-pending') return 'Sync pending'
  if (mode === 'syncing') return 'Syncing'
  if (mode === 'synced') return 'Synced'
  if (mode === 'failed') return 'Sync failed'
  if (mode === 'offline') return 'Offline mode'
  if (mode === 'expired') return 'Session recovery needed'
  return 'Duplicate ignored'
}

function remoteFailure(payload: unknown, status: number, fallback: string) {
  const error = record(record(payload).error)
  const code = text(error.code, status === 401 ? 'AUTH_REQUIRED' : 'REMOTE_SYNC_FAILED')
  const message = text(error.message, fallback)
  return new Error(`${code}: ${message}`)
}

export default function BettingDecisionWorkspace() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [historyOpportunities, setHistoryOpportunities] = useState<Opportunity[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [slipIds, setSlipIds] = useState<string[]>([])
  const [draft, setDraft] = useState<Record<string, DraftLeg>>({})
  const [wagers, setWagers] = useState<UserWager[]>(() => {
    if (typeof window === 'undefined') return []
    const stored = window.localStorage.getItem(storageKey)
    if (!stored) return []
    try {
      return JSON.parse(stored) as UserWager[]
    } catch {
      return []
    }
  })
  const [tab, setTab] = useState('Board')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<Category | 'all'>('all')
  const [slipType, setSlipType] = useState<SlipType>('single')
  const [bankroll, setBankroll] = useState('1000')
  const [notes, setNotes] = useState('')
  const [summary, setSummary] = useState<Record<string, unknown>>({})
  const [remoteMode, setRemoteMode] = useState<RemoteMode>('checking')
  const [remoteMessage, setRemoteMessage] = useState('Checking authenticated remote ledger availability.')
  const [sessionState, setSessionState] = useState<SessionState>({ email: null, userId: null, expiresAt: null })
  const [remoteWagerCount, setRemoteWagerCount] = useState(0)
  const [migrationPreviewOpen, setMigrationPreviewOpen] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(wagers))
  }, [wagers])

  const refreshRemoteState = useCallback(async (forceSessionRefresh = false) => {
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setRemoteMode('offline')
        setRemoteMessage('Offline mode: local wagers remain available and will be eligible for sync after reconnect.')
        return
      }
      const snapshot = await sessionSnapshot(forceSessionRefresh)
      setSessionState(snapshot.state)
      if (snapshot.error) {
        setRemoteMode('expired')
        setRemoteMessage(`SESSION_REFRESH_FAILED: ${snapshot.error}`)
        return
      }
      if (!snapshot.token) {
        setRemoteMode('local-only')
        setRemoteMessage(`Unauthenticated local-only mode: wagers remain in local browser storage (${localPersistenceScope}) until you sign in and sync.`)
        return
      }
      await bridgeServerSession(snapshot.token)
      const response = await fetch('/api/user/wagers?limit=100', { cache: 'no-store', credentials: 'same-origin', headers: authHeaders(snapshot.token) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        const failure = remoteFailure(payload, response.status, 'Remote wager ledger read failed. Local wagers were preserved.')
        const message = failure.message
        if (message.startsWith('AUTH_REQUIRED') || message.startsWith('SESSION_EXPIRED')) setRemoteMode('expired')
        else if (message.startsWith('LEDGER_TABLE_UNAVAILABLE') || message.startsWith('RLS_DENIED')) setRemoteMode('failed')
        else setRemoteMode('failed')
        setRemoteMessage(message)
        return
      }
      const remoteRows = rows(payload.wagers)
      setRemoteWagerCount(remoteRows.length)
      setRemoteMode(wagers.some((wager) => !wager.archived && wager.syncStatus !== 'synced' && wager.syncStatus !== 'duplicate') ? 'sync-pending' : 'authenticated')
      setRemoteMessage(`Authenticated remote ledger available with ${remoteRows.length} remote wager records.`)
    } catch (remoteError) {
      setRemoteMode('failed')
      setRemoteMessage(remoteError instanceof Error ? remoteError.message : 'Remote ledger check failed; local wagers were preserved.')
    }
  }, [wagers])

  useEffect(() => {
    const scheduleRefresh = () => {
      window.setTimeout(() => void refreshRemoteState(false), 0)
    }
    scheduleRefresh()
    const subscription = supabase.auth.onAuthStateChange(() => {
      scheduleRefresh()
    }).data.subscription
    const online = () => scheduleRefresh()
    const offline = () => {
      setRemoteMode('offline')
      setRemoteMessage('Offline mode: local wagers remain available and will be eligible for sync after reconnect.')
    }
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    return () => {
      subscription.unsubscribe()
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
    }
  }, [refreshRemoteState])

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        setError(null)
        const [boardResponse, historyResponse, topPicksResponse, intelligenceResponse, segmentsResponse, todayResponse] = await Promise.all([
          fetch('/api/current-board?mode=current&limit=100', { cache: 'no-store' }),
          fetch('/api/current-board?mode=all_stored_data&limit=100', { cache: 'no-store' }),
          fetch('/api/predictions/top', { cache: 'no-store' }),
          fetch('/api/model/intelligence', { cache: 'no-store' }),
          fetch('/api/model/segments', { cache: 'no-store' }),
          fetch('/api/dashboard/today', { cache: 'no-store' }),
        ])
        const [board, historicalBoard, topPicks, intelligence, segments, today] = await Promise.all([
          boardResponse.json(),
          historyResponse.json(),
          topPicksResponse.json(),
          intelligenceResponse.json(),
          segmentsResponse.json(),
          todayResponse.json(),
        ])
        const mapped = canonicalLiveOpportunities(unique([
          ...rows(board.candidates).map((item) => mapBoardCandidate(item, segments)),
          ...rows(topPicks.topEv).map((item) => mapTopPick(item, segments)),
          ...rows(topPicks.topConfidence).map((item) => mapTopPick(item, segments)),
          ...rows(topPicks.bestBets).map((item) => mapTopPick(item, segments)),
        ]))
        const history = unique(rows(historicalBoard.candidates).map((item) => mapBoardCandidate(item, segments)))
        setOpportunities(mapped)
        setHistoryOpportunities(history)
        setSelectedIds(mapped.slice(0, 3).map((item) => item.id))
        setSummary({ today, intelligence, segments, board, historicalBoard })
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load Betting Decision Workspace')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const grouped = useMemo(() => ({
    OFFICIAL_PICK: opportunities.filter((item) => item.category === 'OFFICIAL_PICK'),
    VALUE_CANDIDATE: opportunities.filter((item) => item.category === 'VALUE_CANDIDATE'),
    RESEARCH_ONLY: opportunities.filter((item) => item.category === 'RESEARCH_ONLY'),
    NO_BET: opportunities.filter((item) => item.category === 'NO_BET'),
  }), [opportunities])

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase()
    return opportunities.filter((item) => category === 'all' || item.category === category)
      .filter((item) => !search || `${item.matchup} ${item.market} ${item.selection}`.toLowerCase().includes(search))
  }, [opportunities, category, query])

  const compared = selectedIds.map((id) => opportunities.find((item) => item.id === id)).filter(Boolean) as Opportunity[]
  const slip = slipIds.map((id) => opportunities.find((item) => item.id === id)).filter(Boolean) as Opportunity[]
  const ticket = ticketSummary(slip, draft, slipType, num(bankroll, 0) ?? 0)
  const personal = personalMetrics(wagers)
  const sample = record(record(summary.intelligence).currentProductionSample)
  const emptyState = slateEmptyState(historyOpportunities)
  const migrationPreview = useMemo(() => ({
    unsynced: wagers.filter((wager) => !wager.archived && wager.syncStatus !== 'synced' && wager.syncStatus !== 'duplicate').length,
    failed: wagers.filter((wager) => !wager.archived && wager.syncStatus === 'failed').length,
    duplicate: wagers.filter((wager) => wager.syncStatus === 'duplicate').length,
    synced: wagers.filter((wager) => wager.syncStatus === 'synced').length,
  }), [wagers])

  function toggleCompare(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id].slice(-4))
  }

  function toggleSlip(id: string) {
    const item = opportunities.find((row) => row.id === id)
    if (!item || item.category === 'NO_BET' || locked(item.startTime, item.eventStatus)) return
    setSlipIds((current) => current.includes(id) ? current.filter((row) => row !== id) : [...current, id])
    setDraft((current) => ({
      ...current,
      [id]: current[id] ?? {
        odds: item.odds === null ? '' : String(item.odds),
        line: item.line === null ? '' : String(item.line),
        stake: '',
        sportsbook: '',
        notes: '',
      },
    }))
  }

  function updateDraft(id: string, patch: Partial<DraftLeg>) {
    setDraft((current) => ({ ...current, [id]: { ...current[id], ...patch } }))
  }

  async function syncOne(wager: UserWager) {
    const token = await sessionToken()
    if (!token) throw new Error('Sign in to sync personal wagers across devices.')
    const response = await fetch('/api/user/wagers', {
      method: 'POST',
      credentials: 'same-origin',
      headers: authHeaders(token),
      body: JSON.stringify(remotePayload(wager, opportunities)),
    })
    const payload = await response.json()
    if (!response.ok) throw remoteFailure(payload, response.status, 'Remote sync failed. Local wager was preserved.')
    return {
      remoteId: typeof payload.wager?.id === 'string' ? payload.wager.id : undefined,
      duplicate: Boolean(payload.idempotent),
    }
  }

  async function syncLocalWagers() {
    if (!migrationPreview.unsynced) {
      setRemoteMode('synced')
      setRemoteMessage('No unsynced wagers were found. Local copy remains available.')
      return
    }
    setRemoteMode('syncing')
    setRemoteMessage('Syncing local wagers to the authenticated remote ledger.')
    let synced = 0
    let duplicate = 0
    try {
      for (const wager of wagers) {
        if (wager.archived || wager.syncStatus === 'synced') continue
        const result = await syncOne(wager)
        synced += result.duplicate ? 0 : 1
        duplicate += result.duplicate ? 1 : 0
        setWagers((current) => current.map((item) => item.id === wager.id ? { ...item, remoteId: result.remoteId, syncStatus: result.duplicate ? 'duplicate' : 'synced' } : item))
      }
      const now = new Date().toISOString()
      setLastSyncedAt(now)
      setRemoteMode(duplicate > 0 && synced === 0 ? 'duplicate' : 'synced')
      setMigrationPreviewOpen(false)
      setRemoteMessage(`Sync complete: ${synced} created, ${duplicate} duplicate/idempotent, local copy retained.`)
    } catch (syncError) {
      const message = syncError instanceof Error ? syncError.message : 'Sync failed; local wagers were preserved.'
      setRemoteMode(message.toLowerCase().includes('sign in') || message.toLowerCase().includes('expired') ? 'expired' : 'failed')
      setRemoteMessage(syncError instanceof Error ? syncError.message : 'Sync failed; local wagers were preserved.')
      setWagers((current) => current.map((item) => item.syncStatus === 'synced' ? item : { ...item, syncStatus: item.syncStatus ?? 'failed' }))
    }
  }

  async function updateRemoteWager(wager: UserWager, patch: Partial<UserWager>) {
    if (!wager.remoteId) return
    const token = await sessionToken()
    if (!token) throw new Error('Sign in to update remote personal wagers.')
    const response = await fetch(`/api/user/wagers/${wager.remoteId}`, {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: authHeaders(token),
      body: JSON.stringify(remotePatchPayload(patch)),
    })
    const payload = await response.json()
    if (!response.ok) throw new Error(text(record(payload.error).message, 'Remote wager update failed. Local wager was preserved.'))
  }

  function updateWager(id: string, patch: Partial<UserWager>) {
    const currentWager = wagers.find((item) => item.id === id)
    setWagers((current) => current.map((item) => item.id === id ? { ...item, ...patch, syncStatus: item.syncStatus === 'synced' ? 'local' : item.syncStatus } : item))
    if (!currentWager?.remoteId) return
    void updateRemoteWager(currentWager, patch)
      .then(() => {
        setLastSyncedAt(new Date().toISOString())
        setRemoteMode('synced')
        setRemoteMessage('Remote wager update saved. Local copy retained.')
        setWagers((current) => current.map((item) => item.id === id ? { ...item, syncStatus: 'synced' } : item))
      })
      .catch((syncError) => {
        setRemoteMode('failed')
        setRemoteMessage(syncError instanceof Error ? syncError.message : 'Remote wager update failed. Local wager was preserved.')
        setWagers((current) => current.map((item) => item.id === id ? { ...item, syncStatus: 'failed' } : item))
      })
  }

  function archiveWager(id: string) {
    const currentWager = wagers.find((item) => item.id === id)
    setWagers((current) => current.map((item) => item.id === id ? { ...item, archived: true, syncStatus: item.syncStatus === 'synced' ? 'local' : item.syncStatus } : item))
    if (!currentWager?.remoteId) return
    void updateRemoteWager(currentWager, { archived: true })
      .then(() => {
        setLastSyncedAt(new Date().toISOString())
        setRemoteMode('synced')
        setRemoteMessage('Remote wager archived. Local archive copy retained.')
        setWagers((current) => current.map((item) => item.id === id ? { ...item, syncStatus: 'synced' } : item))
      })
      .catch((syncError) => {
        setRemoteMode('failed')
        setRemoteMessage(syncError instanceof Error ? syncError.message : 'Remote archive failed. Local wager was preserved.')
        setWagers((current) => current.map((item) => item.id === id ? { ...item, archived: false, syncStatus: 'failed' } : item))
      })
  }

  async function saveWager() {
    if (!slip.length || ticket.invalid.length) return
    const legs = slip.map((item) => ({
      betId: item.id,
      category: item.category,
      matchup: item.matchup,
      market: item.market,
      selection: selection(item),
      enteredOdds: userOdds(draft[item.id]?.odds),
      enteredLine: userLine(draft[item.id]?.line),
    }))
    const wager: UserWager = {
      id: `user-wager-${Date.now()}`,
      createdAt: new Date().toISOString(),
      eventIds: Array.from(new Set(slip.map((item) => item.eventId).filter(Boolean))) as string[],
      predictionIds: Array.from(new Set(slip.map((item) => item.predictionId).filter(Boolean))) as string[],
      sportsbook: Array.from(new Set(slip.map((item) => draft[item.id]?.sportsbook).filter(Boolean))).join(', ') || 'User entered',
      enteredOdds: ticket.enteredOdds,
      stake: ticket.totalStake,
      betType: slipType,
      legs,
      status: 'draft',
      potentialPayout: ticket.payout,
      actualPayout: null,
      result: 'Pending user outcome',
      notes,
      sourceCategory: sourceCategoryFor(legs),
      syncStatus: 'local',
    }
    setWagers((current) => [wager, ...current])
    setNotes('')
    if (['authenticated', 'sync-pending', 'synced', 'duplicate'].includes(remoteMode)) {
      try {
        setRemoteMode('syncing')
        const result = await syncOne(wager)
        setWagers((current) => current.map((item) => item.id === wager.id ? { ...item, remoteId: result.remoteId, syncStatus: result.duplicate ? 'duplicate' : 'synced' } : item))
        setLastSyncedAt(new Date().toISOString())
        setRemoteMode('synced')
        setRemoteMessage(result.duplicate ? 'Remote ledger already had this wager; local copy retained.' : 'Wager saved locally and synced remotely.')
      } catch (syncError) {
        setRemoteMode('failed')
        setRemoteMessage(syncError instanceof Error ? syncError.message : 'Remote sync failed; local wager was preserved.')
        setWagers((current) => current.map((item) => item.id === wager.id ? { ...item, syncStatus: 'failed' } : item))
      }
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <header className="border-b border-slate-800 pb-6">
          <Link href="/" className="text-sm font-bold text-emerald-300 hover:text-emerald-200">Back to Daily Brief</Link>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Release 13</p>
          <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-black sm:text-4xl">Betting Decision Workspace</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">Review, compare, draft and track user-controlled wagers. Authenticated sync writes only to the personal wager ledger; prediction settlement and learning remain separate.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-4 lg:w-[620px]">
              <Summary label="Official" value={grouped.OFFICIAL_PICK.length} />
              <Summary label="Value" value={grouped.VALUE_CANDIDATE.length} />
              <Summary label="Research" value={grouped.RESEARCH_ONLY.length} />
              <Summary label="No Bet" value={grouped.NO_BET.length} />
            </div>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-4">
          <Summary label="Provider Calls" value={String(record(summary.today).providerCallsMade ?? 0)} />
          <Summary label="Remote Mutations" value={String(record(summary.today).remoteMutationsMade ?? 0)} />
          <Summary label="Saved Wagers" value={wagers.length} />
          <Summary label="Model Sample" value={String(sample.sampleSize ?? 'Unavailable')} />
        </section>

        <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Account And Remote Ledger</p>
              <h2 className="mt-1 text-xl font-black">{remoteModeLabel(remoteMode)}</h2>
              <p className="mt-2 text-sm text-slate-400">{remoteMessage}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <Metric label="Connected account" value={sessionState.email ?? 'Not signed in'} />
                <Metric label="Remote rows" value={String(remoteWagerCount)} />
                <Metric label="Last sync" value={when(lastSyncedAt)} />
                <Metric label="Unsynced" value={String(migrationPreview.unsynced)} tone={migrationPreview.unsynced ? 'warn' : 'good'} />
              </div>
              {remoteMode === 'local-only' || remoteMode === 'expired' ? (
                <div className="mt-4 rounded-lg border border-sky-500/30 bg-sky-500/10 p-4">
                  <h3 className="font-black text-sky-100">Local Only Mode</h3>
                  <p className="mt-2 text-sm leading-6 text-sky-100/80">Sign in to sync wagers across devices, restore after browser refresh, use remote summary/export and keep a protected account-owned ledger. Local wagers stay in this browser until Sync Local Wagers succeeds.</p>
                </div>
              ) : null}
              {migrationPreviewOpen ? (
                <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <h3 className="font-black text-emerald-100">Migration Preview</h3>
                  <p className="mt-2 text-sm leading-6 text-emerald-100/80">{migrationPreview.unsynced} local wager(s) are ready to migrate. {migrationPreview.failed} failed item(s) will retry. {migrationPreview.duplicate} duplicate/idempotent item(s) are already protected. The local copy remains until the remote ledger confirms success.</p>
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2 lg:max-w-xs lg:justify-end">
              {remoteMode === 'local-only' || remoteMode === 'expired' ? <Link href="/login" className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950">Sign In</Link> : null}
              <button onClick={() => void refreshRemoteState(true)} disabled={remoteMode === 'syncing'} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-black text-slate-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400">Reconnect</button>
              {!migrationPreviewOpen && migrationPreview.unsynced > 0 ? <button onClick={() => setMigrationPreviewOpen(true)} disabled={remoteMode === 'syncing' || remoteMode === 'local-only' || remoteMode === 'expired'} className="rounded-lg bg-sky-400 px-4 py-2 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400">Preview Sync</button> : null}
              {migrationPreviewOpen ? <button onClick={syncLocalWagers} disabled={remoteMode === 'syncing' || !migrationPreview.unsynced} className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400">Confirm And Sync</button> : null}
              <Link href="/api/user/wagers/export?format=json" className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-black text-slate-200">Export JSON</Link>
              <Link href="/api/user/wagers/export?format=csv" className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-black text-slate-200">Export CSV</Link>
            </div>
          </div>
        </section>

        {loading ? <State title="Loading workspace" text="Reading Current Board, Top Picks, model intelligence, model segments and Daily Brief." /> : null}
        {error ? <State title="Workspace unavailable" text={error} tone="bad" /> : null}
        {!loading && !opportunities.length ? <State title={emptyState.title} text={emptyState.text} /> : null}

        <nav className="flex gap-2 overflow-x-auto border-y border-slate-800 py-3">
          {['Board', 'Compare', 'Bet Slip', 'Risk', 'Parlay Safety', 'History', 'Personal Results'].map((item) => (
            <button key={item} onClick={() => setTab(item)} className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-black ${tab === item ? 'bg-emerald-400 text-slate-950' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'}`}>{item}</button>
          ))}
        </nav>

        {tab === 'Board' ? <Board grouped={grouped} selected={selectedIds} slipIds={slipIds} onCompare={toggleCompare} onSlip={toggleSlip} /> : null}
        {tab === 'Compare' ? <Compare opportunities={filtered} compared={compared} selected={selectedIds} query={query} setQuery={setQuery} category={category} setCategory={setCategory} onCompare={toggleCompare} /> : null}
        {tab === 'Bet Slip' ? <SlipBuilder opportunities={filtered} slip={slip} slipIds={slipIds} draft={draft} type={slipType} setType={setSlipType} onToggle={toggleSlip} onUpdate={updateDraft} notes={notes} setNotes={setNotes} ticket={ticket} onSave={saveWager} /> : null}
        {tab === 'Risk' ? <Risk bankroll={bankroll} setBankroll={setBankroll} ticket={ticket} slip={slip} draft={draft} /> : null}
        {tab === 'Parlay Safety' ? <Parlay ticket={ticket} slip={slip} /> : null}
        {tab === 'History' ? <History opportunities={historyOpportunities} /> : null}
        {tab === 'Personal Results' ? <Personal wagers={wagers} metrics={personal} onUpdate={updateWager} onArchive={archiveWager} /> : null}
      </div>
    </main>
  )
}

function ticketSummary(slip: Opportunity[], draft: Record<string, DraftLeg>, type: SlipType, bankroll: number) {
  const enteredOdds = slip.map((item) => userOdds(draft[item.id]?.odds)).filter((value): value is number => value !== null)
  const allPrices = slip.length > 0 && enteredOdds.length === slip.length
  const singleStakes = slip.map((item) => userStake(draft[item.id]?.stake, 0))
  const totalStake = type === 'parlay' ? userStake(draft[slip[0]?.id]?.stake, 0) : singleStakes.reduce((sum, value) => sum + value, 0)
  const combinedDecimal = type === 'parlay' && allPrices ? enteredOdds.reduce((product, value) => product * decimalFromAmerican(value), 1) : null
  const payout = type === 'parlay'
    ? combinedDecimal === null ? null : totalStake * combinedDecimal
    : slip.reduce((sum, item) => {
      const price = userOdds(draft[item.id]?.odds)
      const stake = userStake(draft[item.id]?.stake, 0)
      return sum + (price === null ? 0 : stake * decimalFromAmerican(price))
    }, 0)
  const duplicateEvents = slip.map((item) => item.eventId).filter(Boolean).filter((id, index, all) => all.indexOf(id) !== index)
  const sameMarketEvents = new Set(slip.map((item) => `${item.eventId}|${item.market}`)).size < slip.filter((item) => item.eventId).length
  const invalid: string[] = []
  if (!slip.length) invalid.push('No selections added.')
  if (slip.some((item) => item.category === 'NO_BET')) invalid.push('No Bet / Avoid selections cannot be saved.')
  if (slip.some((item) => locked(item.startTime, item.eventStatus))) invalid.push('One or more events have started or are not pregame.')
  if (!allPrices) invalid.push('Every leg needs a user-entered or persisted price.')
  const invalidOdds = slip.map((item) => normalizeAmericanOddsInput(draft[item.id]?.odds)).find((item) => item.error && item.display)
  if (invalidOdds) invalid.push(invalidOdds.error as string)
  const invalidStake = slip.map((item) => normalizeMoneyInput(draft[item.id]?.stake)).find((item) => item.error && item.display)
  if (invalidStake) invalid.push(invalidStake.error as string)
  if (totalStake <= 0) invalid.push('Stake must be greater than zero.')
  if (duplicateEvents.length) invalid.push('Duplicate event detected.')
  if (sameMarketEvents) invalid.push('Potential conflicting same-event selections detected.')
  const warnings: string[] = []
  if (type === 'parlay' && slip.length > 1) warnings.push('Combined model probability unavailable because leg dependence has not been validated.')
  if (type === 'parlay' && duplicateEvents.length) warnings.push('Same-game legs may be correlated.')
  if (slip.some((item) => item.evidenceQuality === 'insufficient')) warnings.push('One low-evidence leg weakens the entire ticket.')
  if (bankroll > 0 && totalStake / bankroll > 0.05) warnings.push('High concentration: total stake exceeds 5% of bankroll.')
  return {
    enteredOdds,
    totalStake,
    payout: payout || null,
    maxLoss: totalStake || null,
    combinedDecimal,
    combinedImplied: combinedDecimal === null ? null : 100 / combinedDecimal,
    invalid,
    warnings,
    risk: riskGrade(totalStake, bankroll, slip.length, warnings),
  }
}

function riskGrade(stake: number, bankroll: number, legs: number, warnings: string[]) {
  const exposure = bankroll > 0 ? stake / bankroll : 0
  if (warnings.length > 2 || legs >= 4 || exposure > 0.05) return 'High'
  if (warnings.length || legs >= 3 || exposure > 0.02) return 'Moderate'
  return 'Conservative'
}

function personalMetrics(wagers: UserWager[]) {
  const settled = wagers.filter((item) => ['won', 'lost', 'push', 'void'].includes(item.status))
  const wins = settled.filter((item) => item.status === 'won').length
  const losses = settled.filter((item) => item.status === 'lost').length
  const pushes = settled.filter((item) => item.status === 'push').length
  const stake = settled.reduce((sum, item) => sum + item.stake, 0)
  const returned = settled.reduce((sum, item) => sum + (item.actualPayout ?? 0), 0)
  const net = returned - stake
  return { placed: wagers.length, wins, losses, pushes, stake, returned, net, roi: stake > 0 ? (net / stake) * 100 : null }
}

function Summary({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3"><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p><p className="mt-1 break-words text-xl font-black">{value}</p></div>
}

function State({ title, text, tone = 'neutral' }: { title: string; text: string; tone?: 'neutral' | 'bad' }) {
  return <div className={`rounded-lg border p-5 ${tone === 'bad' ? 'border-red-500/30 bg-red-950/20 text-red-100' : 'border-slate-800 bg-slate-900/70 text-slate-300'}`}><h2 className="text-xl font-black text-white">{title}</h2><p className="mt-2 text-sm leading-6">{text}</p></div>
}

function Board({ grouped, selected, slipIds, onCompare, onSlip }: { grouped: Record<Category, Opportunity[]>; selected: string[]; slipIds: string[]; onCompare: (id: string) => void; onSlip: (id: string) => void }) {
  const emptyTitles: Record<Category, string> = {
    OFFICIAL_PICK: 'No Official Picks Today',
    VALUE_CANDIDATE: 'No Value Picks Today',
    RESEARCH_ONLY: 'No Research Picks Today',
    NO_BET: 'No No Bet Rows Today',
  }
  return <section className="space-y-6">{(['OFFICIAL_PICK', 'VALUE_CANDIDATE', 'RESEARCH_ONLY', 'NO_BET'] as Category[]).map((category) => <div key={category}><div className="mb-3 flex items-center justify-between"><h2 className="text-2xl font-black">{categoryLabel(category)}</h2><span className="rounded-full border border-slate-800 px-3 py-1 text-xs font-bold text-slate-400">{grouped[category].length}</span></div><div className="grid gap-4 xl:grid-cols-2">{grouped[category].map((item) => <OpportunityCard key={item.id} item={item} selected={selected.includes(item.id)} inSlip={slipIds.includes(item.id)} onCompare={onCompare} onSlip={onSlip} />)}{!grouped[category].length ? <State title={emptyTitles[category]} text="Only current Puerto Rico operating-day pregame opportunities are shown here. Historical snapshots live in History." /> : null}</div></div>)}</section>
}

function OpportunityCard({ item, selected, inSlip, onCompare, onSlip }: { item: Opportunity; selected: boolean; inSlip: boolean; onCompare: (id: string) => void; onSlip: (id: string) => void }) {
  const readOnly = item.category === 'NO_BET' || locked(item.startTime, item.eventStatus)
  return <article className="rounded-lg border border-slate-800 bg-slate-900/70 p-5"><Title item={item} /><div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4"><Metric label="Probability" value={pct(item.probability)} /><Metric label="Confidence" value={pct(item.confidence)} /><Metric label="Price" value={odds(item.odds)} /><Metric label="Evidence" value={item.evidenceQuality} /><Metric label="Risk" value={item.risk} /><Metric label="Current State" value={item.currentState} /><Metric label="Last Update" value={when(item.lastUpdate)} /><Metric label="Data Freshness" value={item.freshness} /><Metric label="Edge" value={signedPct(item.edge)} tone={(item.edge ?? 0) > 0 ? 'good' : 'warn'} /><Metric label="EV" value={signedPct(item.ev)} tone={(item.ev ?? 0) > 0 ? 'good' : 'warn'} /><Metric label="Market" value={item.market} /><Metric label="Model" value={item.modelVersion} /></div><p className="mt-4 text-sm leading-6 text-slate-300">{item.explanation}</p>{item.warnings.length ? <ul className="mt-4 space-y-1 text-sm text-amber-100">{item.warnings.slice(0, 4).map((warning) => <li key={warning}>- {warning}</li>)}</ul> : null}<div className="mt-4 flex gap-2"><button onClick={() => onCompare(item.id)} className={`rounded-lg px-4 py-2 text-sm font-black ${selected ? 'bg-sky-400 text-slate-950' : 'bg-slate-800 text-slate-200'}`}>Compare</button><button disabled={readOnly} onClick={() => onSlip(item.id)} className={`rounded-lg px-4 py-2 text-sm font-black ${readOnly ? 'cursor-not-allowed bg-slate-800 text-slate-500' : inSlip ? 'bg-emerald-400 text-slate-950' : 'bg-slate-800 text-slate-200'}`}>{readOnly ? 'Read Only' : inSlip ? 'In Slip' : 'Add to Slip'}</button></div></article>
}

function Title({ item }: { item: Opportunity }) {
  return <div><div className="flex flex-wrap gap-2"><span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-100">{categoryLabel(item.category)}</span><span className="rounded-full border border-slate-700 px-3 py-1 text-xs font-bold text-slate-300">{item.sport} / {item.league}</span><span className="rounded-full border border-slate-700 px-3 py-1 text-xs font-bold text-slate-300">{item.source}</span></div><h3 className="mt-3 break-words text-2xl font-black">{selection(item)}</h3><p className="mt-1 text-sm text-slate-400">{item.matchup} | {when(item.startTime)} | {item.market}</p></div>
}

function Metric({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'good' | 'warn' }) {
  const color = tone === 'good' ? 'text-emerald-300' : tone === 'warn' ? 'text-amber-200' : 'text-white'
  return <div className="rounded-lg bg-slate-950/70 p-3"><p className="text-xs text-slate-500">{label}</p><p className={`mt-1 break-words font-black ${color}`}>{value}</p></div>
}

function Compare(props: { opportunities: Opportunity[]; compared: Opportunity[]; selected: string[]; query: string; setQuery: (value: string) => void; category: Category | 'all'; setCategory: (value: Category | 'all') => void; onCompare: (id: string) => void }) {
  return <section className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]"><aside className="rounded-lg border border-slate-800 bg-slate-900/70 p-4"><h2 className="text-xl font-black">Select</h2><input value={props.query} onChange={(event) => props.setQuery(event.target.value)} className="mt-4 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Search" /><select value={props.category} onChange={(event) => props.setCategory(event.target.value as Category | 'all')} className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"><option value="all">All categories</option><option value="OFFICIAL_PICK">Official Picks</option><option value="VALUE_CANDIDATE">Value Candidates</option><option value="RESEARCH_ONLY">Research Picks</option><option value="NO_BET">No Bet / Avoid</option></select><div className="mt-4 max-h-[620px] space-y-2 overflow-auto">{props.opportunities.map((item) => <button key={item.id} onClick={() => props.onCompare(item.id)} className={`w-full rounded-lg border p-3 text-left ${props.selected.includes(item.id) ? 'border-sky-400 bg-sky-500/10' : 'border-slate-800 bg-slate-950/60'}`}><p className="font-black">{selection(item)}</p><p className="mt-1 text-xs text-slate-400">{categoryLabel(item.category)} | {item.matchup}</p></button>)}</div></aside><div className="grid gap-4 xl:grid-cols-2">{props.compared.map((item) => <Comparison key={item.id} item={item} />)}{!props.compared.length ? <State title="No selections" text="Select up to four opportunities for side-by-side comparison." /> : null}</div></section>
}

function History({ opportunities }: { opportunities: Opportunity[] }) {
  return <section className="space-y-4"><div className="rounded-lg border border-slate-800 bg-slate-900/70 p-5"><h2 className="text-2xl font-black">History</h2><p className="mt-2 text-sm text-slate-400">Historical predictions and stale snapshots are read-only and never populate the active betting board.</p></div><div className="grid gap-4 xl:grid-cols-2">{opportunities.map((item) => <article key={`history-${item.id}`} className="rounded-lg border border-slate-800 bg-slate-900/70 p-5 opacity-80"><Title item={item} /><div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4"><Metric label="State" value={item.currentState} /><Metric label="Board" value={item.boardLabel} /><Metric label="Last Update" value={when(item.lastUpdate)} /><Metric label="Freshness" value={item.freshness} /></div></article>)}{!opportunities.length ? <State title="No history rows" text="No historical predictions were returned." /> : null}</div></section>
}

function Comparison({ item }: { item: Opportunity }) {
  const grade = item.evidenceQuality === 'decision-grade' ? 'Decision-grade evidence' : item.evidenceQuality === 'directional' ? 'Directional evidence' : 'Insufficient evidence'
  return <article className="rounded-lg border border-slate-800 bg-slate-900/70 p-5"><Title item={item} /><div className="mt-4 grid grid-cols-2 gap-3"><Metric label="Evidence" value={grade} /><Metric label="Sample" value={item.segmentSample === null ? 'Unavailable' : String(item.segmentSample)} /><Metric label="Segment Accuracy" value={pct(item.segmentAccuracy)} /><Metric label="Segment Brier" value={item.segmentBrier === null ? 'Unavailable' : item.segmentBrier.toFixed(4)} /><Metric label="Calibration" value={signedPct(item.segmentCalibration)} /><Metric label="Market" value={item.segmentSample !== null && item.segmentSample >= marketThreshold ? 'Directional evidence' : 'Insufficient evidence'} /><Metric label="Starter" value="Unavailable" /><Metric label="Bullpen" value="Unavailable" /><Metric label="Weather" value="Unavailable" /><Metric label="Park" value="Unavailable" /></div>{item.segmentSample !== null && item.segmentSample < marketThreshold ? <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">Segment comparison is not decision-grade because sample size is below the Release 08 threshold.</p> : null}{item.missing.length ? <p className="mt-4 text-sm text-slate-400">Missing information: {item.missing.join(', ')}</p> : null}</article>
}

function SlipBuilder(props: { opportunities: Opportunity[]; slip: Opportunity[]; slipIds: string[]; draft: Record<string, DraftLeg>; type: SlipType; setType: (value: SlipType) => void; onToggle: (id: string) => void; onUpdate: (id: string, patch: Partial<DraftLeg>) => void; notes: string; setNotes: (value: string) => void; ticket: ReturnType<typeof ticketSummary>; onSave: () => void | Promise<void> }) {
  return <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]"><div className="rounded-lg border border-slate-800 bg-slate-900/70 p-5"><div className="flex items-center justify-between gap-3"><h2 className="text-2xl font-black">User Bet Slip</h2><select value={props.type} onChange={(event) => props.setType(event.target.value as SlipType)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"><option value="single">Singles</option><option value="parlay">Parlay</option></select></div><p className="mt-2 text-sm text-slate-400">User-entered odds and stakes are separate from canonical stored model data.</p><div className="mt-5 grid gap-3 xl:grid-cols-2">{props.opportunities.filter((item) => item.category !== 'NO_BET').map((item) => <button key={item.id} disabled={locked(item.startTime, item.eventStatus)} onClick={() => props.onToggle(item.id)} className={`rounded-lg border p-3 text-left ${props.slipIds.includes(item.id) ? 'border-emerald-400 bg-emerald-500/10' : 'border-slate-800 bg-slate-950/60'} ${locked(item.startTime, item.eventStatus) ? 'opacity-50' : ''}`}><p className="font-black">{selection(item)}</p><p className="mt-1 text-xs text-slate-400">{categoryLabel(item.category)} | {odds(item.odds)}</p></button>)}</div></div><div className="rounded-lg border border-slate-800 bg-slate-900/70 p-5"><h3 className="text-xl font-black">Draft</h3><div className="mt-4 space-y-4">{props.slip.map((item, index) => <DraftEditor key={item.id} item={item} draft={props.draft[item.id]} parlayLocked={props.type === 'parlay' && index > 0} firstStake={props.draft[props.slip[0]?.id]?.stake ?? ''} onUpdate={props.onUpdate} />)}{!props.slip.length ? <p className="text-sm text-slate-500">No selections added.</p> : null}</div><textarea value={props.notes} onChange={(event) => props.setNotes(event.target.value)} className="mt-4 min-h-24 w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm" placeholder="User notes. This does not update prediction history." /><div className="mt-4 grid grid-cols-2 gap-3"><Summary label="Risk" value={money(props.ticket.maxLoss)} /><Summary label="Potential" value={money(props.ticket.payout)} /></div>{props.ticket.warnings.map((item) => <p key={item} className="mt-3 text-sm text-amber-100">{item}</p>)}{props.ticket.invalid.map((item) => <p key={item} className="mt-3 text-sm text-red-200">{item}</p>)}<button disabled={props.ticket.invalid.length > 0} onClick={props.onSave} className="mt-4 w-full rounded-lg bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400">Save User Wager</button></div></section>
}

function DraftEditor({ item, draft, parlayLocked, firstStake, onUpdate }: { item: Opportunity; draft?: DraftLeg; parlayLocked: boolean; firstStake: string; onUpdate: (id: string, patch: Partial<DraftLeg>) => void }) {
  return <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3"><p className="font-black">{selection(item)}</p><p className="mt-1 text-xs text-slate-400">{item.matchup}</p><label className="mt-3 block text-xs font-bold text-slate-400">Sportsbook<input value={draft?.sportsbook ?? ''} onChange={(event) => onUpdate(item.id, { sportsbook: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" placeholder="User entered" /></label><div className="mt-3 grid grid-cols-3 gap-2"><label className="text-xs font-bold text-slate-400">Odds<input value={draft?.odds ?? ''} onChange={(event) => onUpdate(item.id, { odds: event.target.value })} onBlur={() => { const next = normalizeAmericanOddsInput(draft?.odds); if (!next.error) onUpdate(item.id, { odds: next.display }) }} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-white" placeholder="+120" /></label><label className="text-xs font-bold text-slate-400">Line<input value={draft?.line ?? ''} onChange={(event) => onUpdate(item.id, { line: event.target.value })} onBlur={() => { const next = normalizeOptionalLineInput(draft?.line); if (!next.error) onUpdate(item.id, { line: next.display }) }} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-white" placeholder="Optional" /></label><label className="text-xs font-bold text-slate-400">Stake<input value={parlayLocked ? firstStake : draft?.stake ?? ''} disabled={parlayLocked} onChange={(event) => onUpdate(item.id, { stake: event.target.value })} onBlur={() => { const next = normalizeMoneyInput(parlayLocked ? firstStake : draft?.stake); if (!next.error) onUpdate(item.id, { stake: next.display }) }} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-white disabled:text-slate-500" placeholder="25" /></label></div></div>
}

function Risk({ bankroll, setBankroll, ticket, slip, draft }: { bankroll: string; setBankroll: (value: string) => void; ticket: ReturnType<typeof ticketSummary>; slip: Opportunity[]; draft: Record<string, DraftLeg> }) {
  const bankrollValue = num(bankroll, 0) ?? 0
  const exposure = bankrollValue > 0 && ticket.totalStake ? (ticket.totalStake / bankrollValue) * 100 : null
  const first = slip[0]
  const firstPrice = first ? userOdds(draft[first.id]?.odds) ?? first.odds : null
  const full = first ? kelly(first.probability, firstPrice) : null
  return <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-5"><h2 className="text-2xl font-black">Bankroll And Stake Guidance</h2><p className="mt-2 text-sm text-slate-400">Kelly-style guidance appears only when model probability and user-entered or persisted price are valid. It is not guaranteed.</p><label className="mt-5 block text-xs font-bold text-slate-400">Entered bankroll<input value={bankroll} onChange={(event) => setBankroll(event.target.value)} className="mt-1 w-full max-w-xs rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label><div className="mt-5 grid gap-3 md:grid-cols-4"><Summary label="Stake" value={money(ticket.totalStake || null)} /><Summary label="Bankroll %" value={pct(exposure)} /><Summary label="Max Loss" value={money(ticket.maxLoss)} /><Summary label="Risk Grade" value={ticket.risk} /><Summary label="Full Kelly" value={pct(full)} /><Summary label="Half Kelly" value={pct(full === null ? null : full / 2)} /><Summary label="Quarter Kelly" value={pct(full === null ? null : full / 4)} /><Summary label="Potential" value={money(ticket.payout)} /></div>{slip.length > 1 ? <p className="mt-4 text-sm text-amber-100">Concentration warning: multiple legs increase variance. Correlation warnings only use provable event overlap.</p> : null}</section>
}

function Parlay({ ticket, slip }: { ticket: ReturnType<typeof ticketSummary>; slip: Opportunity[] }) {
  return <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-5"><h2 className="text-2xl font-black">Parlay Safety</h2><p className="mt-2 text-sm text-slate-400">Combined model probability unavailable because leg dependence has not been validated.</p><div className="mt-5 grid gap-3 md:grid-cols-4"><Summary label="Legs" value={slip.length} /><Summary label="Decimal Odds" value={ticket.combinedDecimal === null ? 'Unavailable' : ticket.combinedDecimal.toFixed(3)} /><Summary label="Implied Probability" value={pct(ticket.combinedImplied)} /><Summary label="Potential" value={money(ticket.payout)} /></div><div className="mt-5 space-y-2">{[...ticket.warnings, ...ticket.invalid].map((item) => <p key={item} className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">{item}</p>)}{!ticket.warnings.length && !ticket.invalid.length ? <p className="text-sm text-slate-400">No duplicate-event or same-market conflicts detected from available data.</p> : null}</div></section>
}

function Personal({ wagers, metrics, onUpdate, onArchive }: { wagers: UserWager[]; metrics: ReturnType<typeof personalMetrics>; onUpdate: (id: string, patch: Partial<UserWager>) => void; onArchive: (id: string) => void }) {
  const visible = wagers.filter((wager) => !wager.archived)
  return <section className="space-y-5"><div className="grid gap-3 md:grid-cols-4"><Summary label="Wagers" value={metrics.placed} /><Summary label="W-L-P" value={`${metrics.wins}-${metrics.losses}-${metrics.pushes}`} /><Summary label="Net" value={money(metrics.net)} /><Summary label="ROI" value={pct(metrics.roi)} /></div><p className="text-sm text-slate-400">Personal betting ROI is separate from model accuracy, model Brier and prediction settlement. Result entry is user-led unless a future safe wager-line matching system is certified.</p><div className="grid gap-4 lg:grid-cols-2">{visible.map((wager) => <article key={wager.id} className="rounded-lg border border-slate-800 bg-slate-900/70 p-5"><div className="flex flex-wrap gap-2"><span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-black">{wager.betType}</span><span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-black">{wager.status}</span><span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-black">{wager.sourceCategory}</span><span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-black">{wager.syncStatus ?? 'local'}</span></div><p className="mt-3 text-sm text-slate-400">{when(wager.createdAt)} | {wager.sportsbook}</p><ul className="mt-4 space-y-1 text-sm text-slate-200">{wager.legs.map((leg) => <li key={`${wager.id}-${leg.betId}`}>- {leg.selection} | {leg.matchup} | {odds(leg.enteredOdds)}</li>)}</ul><div className="mt-4 grid grid-cols-3 gap-3"><Metric label="Stake" value={money(wager.stake)} /><Metric label="Potential" value={money(wager.potentialPayout)} /><Metric label="Actual" value={money(wager.actualPayout)} /></div><div className="mt-4 grid grid-cols-3 gap-3"><select value={wager.status} onChange={(event) => onUpdate(wager.id, { status: event.target.value as WagerStatus })} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"><option value="draft">Draft</option><option value="placed">Placed</option><option value="won">Won</option><option value="lost">Lost</option><option value="push">Push</option><option value="void">Void</option></select><input value={wager.actualPayout ?? ''} onChange={(event) => onUpdate(wager.id, { actualPayout: num(event.target.value) })} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Actual payout" /><button onClick={() => onArchive(wager.id)} className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-black text-slate-200">Archive</button></div>{wager.notes ? <p className="mt-4 text-sm text-slate-400">{wager.notes}</p> : null}</article>)}{!visible.length ? <State title="No personal wagers recorded" text="Saved wagers live in local browser storage and never alter prediction history." /> : null}</div></section>
}
