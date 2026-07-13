'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSport } from '@/context/SportContext'

type League = {
  key: string
  displayName: string
  active: boolean
}

type Provider = {
  id: string
  name: string
  health: 'healthy' | 'degraded' | 'unavailable'
  features: string[]
  lastError?: string
}

type Market = {
  key: string
  displayName: string
  category: string
}

type Participant = {
  id: string
  displayName: string
  type: 'team' | 'individual'
}

type EngineEvent = {
  id: string
  displayName: string
  startTime: string
  status: string
  participants: Participant[]
  leagueKey?: string
  venue: {
    displayName?: string
    city?: string
    neutralSite: boolean
  }
  rawProvider?: string
}

type SportDetail = {
  key: string
  label: string
  shortLabel: string
  description: string
  productionReady: boolean
  adapterId: string
  format: 'team' | 'individual'
  seasonFormat: string
  supportedPredictionTypes: string[]
}

type EngineState = {
  sport: SportDetail | null
  leagues: League[]
  events: EngineEvent[]
  markets: Market[]
  providers: Provider[]
  healthStatus: string
  adapterStatus: string
  warnings: string[]
  emptyMessage?: string
}

const DEFAULT_STATE: EngineState = {
  sport: null,
  leagues: [],
  events: [],
  markets: [],
  providers: [],
  healthStatus: 'unavailable',
  adapterStatus: 'unavailable',
  warnings: [],
}

function statusClass(status: string) {
  if (status === 'healthy') {
    return 'border-emerald-500/30 bg-emerald-950/20 text-emerald-300'
  }

  if (status === 'degraded') {
    return 'border-amber-500/30 bg-amber-950/20 text-amber-300'
  }

  if (status === 'scheduled') {
    return 'border-sky-500/30 bg-sky-950/20 text-sky-300'
  }

  if (status === 'live') {
    return 'border-rose-500/30 bg-rose-950/20 text-rose-300'
  }

  return 'border-slate-700 bg-slate-900 text-slate-300'
}

function formatDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return 'Time unavailable'

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

async function loadJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' })
  const json = await response.json()

  if (!response.ok || json.success === false) {
    throw new Error(json.error ?? `Request failed: ${url}`)
  }

  return json as T
}

export default function MultiSportEnginePanel() {
  const { sportKey } = useSport()
  const [leagueKey, setLeagueKey] = useState('')
  const [status, setStatus] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')
  const [state, setState] = useState<EngineState>(DEFAULT_STATE)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLeagueKey('')
  }, [sportKey])

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        setError(null)

        const params = new URLSearchParams()
        if (leagueKey) params.set('league', leagueKey)
        if (status) params.set('status', status)
        if (dateFrom) params.set('dateFrom', dateFrom)
        if (dateTo) params.set('dateTo', dateTo)
        if (search.trim()) params.set('search', search.trim())
        params.set('limit', '12')

        const query = params.toString()
        const [
          detail,
          leagues,
          events,
          markets,
          providers,
          health,
        ] = await Promise.all([
          loadJson<{ sport: SportDetail }>(`/api/sports/${sportKey}`),
          loadJson<{ leagues: League[] }>(
            `/api/sports/${sportKey}/leagues`
          ),
          loadJson<{
            events: EngineEvent[]
            warnings?: string[]
            emptyMessage?: string
          }>(`/api/sports/${sportKey}/events${query ? `?${query}` : ''}`),
          loadJson<{ markets: Market[] }>(
            `/api/sports/${sportKey}/markets`
          ),
          loadJson<{ providers: Provider[] }>(
            `/api/sports/${sportKey}/providers`
          ),
          loadJson<{
            status: string
            coverage: {
              sportKey: string
              status: string
              adapter: { status: string }
            }[]
          }>('/api/sports/health'),
        ])

        const selectedHealth = health.coverage.find(
          (item) => item.sportKey === sportKey
        )

        setState({
          sport: detail.sport,
          leagues: leagues.leagues,
          events: events.events,
          markets: markets.markets,
          providers: providers.providers,
          healthStatus: selectedHealth?.status ?? health.status,
          adapterStatus: selectedHealth?.adapter.status ?? 'unavailable',
          warnings: events.warnings ?? [],
          emptyMessage: events.emptyMessage,
        })
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load Multi-Sport Engine.'
        )
        setState(DEFAULT_STATE)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [dateFrom, dateTo, leagueKey, search, sportKey, status])

  const activeProvider = useMemo(
    () =>
      state.providers.find((provider) => provider.health === 'healthy') ??
      state.providers[0],
    [state.providers]
  )

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300">
            Multi-Sport Engine
          </p>

          <h2 className="mt-2 text-3xl font-black text-white">
            {state.sport?.label ?? 'Sport Engine'}
          </h2>

          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
            {state.sport?.description ??
              'Central sport registry, adapter resolution, normalized events, provider health and market capabilities.'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[520px]">
          <Pill label="Coverage" value={state.healthStatus} />
          <Pill label="Adapter" value={state.adapterStatus} />
          <Pill
            label="Provider"
            value={activeProvider?.name ?? 'None'}
          />
          <Pill
            label="Mode"
            value={state.sport?.format ?? 'unknown'}
          />
        </div>
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-5">
        <Control label="League">
          <select
            value={leagueKey}
            onChange={(event) => setLeagueKey(event.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/60"
          >
            <option value="">All leagues</option>
            {state.leagues.map((league) => (
              <option key={league.key} value={league.key}>
                {league.displayName}
              </option>
            ))}
          </select>
        </Control>

        <Control label="Status">
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/60"
          >
            <option value="">Any status</option>
            <option value="scheduled">Scheduled</option>
            <option value="live">Live</option>
            <option value="completed">Completed</option>
            <option value="postponed">Postponed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </Control>

        <Control label="From">
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/60"
          />
        </Control>

        <Control label="To">
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/60"
          />
        </Control>

        <Control label="Search">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Team, fighter, event"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-500/60"
          />
        </Control>
      </div>

      {error ? (
        <div className="mt-6 rounded-2xl border border-red-900/60 bg-red-950/30 p-5 text-sm text-red-300">
          {error}
        </div>
      ) : loading ? (
        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-5 text-sm text-slate-400">
          Loading normalized engine data...
        </div>
      ) : (
        <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_420px]">
          <div className="space-y-3">
            {state.events.length === 0 ? (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-950/10 p-5">
                <p className="font-bold text-amber-300">
                  No normalized events available
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {state.emptyMessage ??
                    'This sport is registered, but no active provider data matched the selected filters.'}
                </p>
              </div>
            ) : (
              state.events.map((event) => (
                <EventRow key={event.id} event={event} />
              ))
            )}
          </div>

          <aside className="space-y-4">
            <InfoPanel title="Providers">
              {state.providers.map((provider) => (
                <div
                  key={provider.id}
                  className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-white">
                        {provider.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {provider.features.join(', ')}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${statusClass(
                        provider.health
                      )}`}
                    >
                      {provider.health}
                    </span>
                  </div>
                  {provider.lastError ? (
                    <p className="mt-2 text-xs leading-5 text-amber-300">
                      {provider.lastError}
                    </p>
                  ) : null}
                </div>
              ))}
            </InfoPanel>

            <InfoPanel title="Markets">
              <div className="flex flex-wrap gap-2">
                {state.markets.map((market) => (
                  <span
                    key={market.key}
                    className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs font-semibold text-slate-300"
                  >
                    {market.displayName}
                  </span>
                ))}
              </div>
            </InfoPanel>

            <InfoPanel title="Adapter">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Mini
                  label="ID"
                  value={state.sport?.adapterId ?? 'none'}
                />
                <Mini
                  label="Season"
                  value={state.sport?.seasonFormat ?? 'unknown'}
                />
                <Mini
                  label="Leagues"
                  value={`${state.leagues.length}`}
                />
                <Mini
                  label="Events"
                  value={`${state.events.length}`}
                />
              </div>
              {state.warnings.length > 0 ? (
                <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-950/10 p-3 text-xs leading-5 text-amber-300">
                  {state.warnings.join(' ')}
                </div>
              ) : null}
            </InfoPanel>
          </aside>
        </div>
      )}
    </section>
  )
}

function Control({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  )
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-black text-white">
        {value}
      </p>
    </div>
  )
}

function InfoPanel({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
      <h3 className="mb-3 text-sm font-black text-white">
        {title}
      </h3>
      {children}
    </div>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-1 truncate font-bold text-white">{value}</p>
    </div>
  )
}

function EventRow({ event }: { event: EngineEvent }) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-black text-white">
              {event.displayName}
            </h3>
            <span
              className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${statusClass(
                event.status
              )}`}
            >
              {event.status}
            </span>
          </div>

          <p className="mt-2 text-sm text-slate-400">
            {formatDate(event.startTime)}
            {event.venue.displayName
              ? ` | ${event.venue.displayName}`
              : ''}
            {event.venue.neutralSite ? ' | Neutral site' : ''}
          </p>
        </div>

        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          {event.rawProvider ?? 'normalized'}
        </p>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {event.participants.map((participant) => (
          <div
            key={participant.id}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-3"
          >
            <p className="text-sm font-bold text-white">
              {participant.displayName}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {participant.type}
            </p>
          </div>
        ))}
      </div>
    </article>
  )
}
