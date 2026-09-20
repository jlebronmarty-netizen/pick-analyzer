import 'server-only'

const BASE_URL = 'https://api.balldontlie.io/mlb/v1'
const MAX_CALLS = 2

type ProbeMode = 'opening_props' | 'markets' | 'opening_odds'

type ProviderCall = {
  path: string
  httpStatus: number | null
  ok: boolean
  rows: number
  error: string | null
}

function apiKey() {
  return process.env.BALLDONTLIE_API_KEY?.trim() || process.env.BDL_API_KEY?.trim() || ''
}

function safeError(value: unknown) {
  const raw = typeof value === 'string' ? value : JSON.stringify(value ?? '')
  return raw.replace(/Authorization[^,}]*/gi, 'Authorization:[REDACTED]').slice(0, 500)
}

function rowCount(payload: unknown) {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const data = (payload as Record<string, unknown>).data
    return Array.isArray(data) ? data.length : data ? 1 : 0
  }
  return 0
}

function dataRows(payload: unknown): Array<Record<string, unknown>> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return []
  const data = (payload as Record<string, unknown>).data
  return Array.isArray(data)
    ? data.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === 'object' && !Array.isArray(row)))
    : []
}

async function providerGet(path: string, query: URLSearchParams, calls: ProviderCall[]) {
  if (calls.length >= MAX_CALLS) throw new Error('BALLDONTLIE_PROBE_CALL_BUDGET_REACHED')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const url = new URL(BASE_URL + path)
    for (const [key, value] of query.entries()) url.searchParams.append(key, value)
    const response = await fetch(url.toString(), {
      cache: 'no-store',
      signal: controller.signal,
      headers: { Authorization: apiKey() },
    })
    const text = await response.text()
    let payload: unknown = null
    try { payload = text ? JSON.parse(text) : null } catch { payload = text }
    calls.push({
      path: path + (query.toString() ? '?' + query.toString() : ''),
      httpStatus: response.status,
      ok: response.ok,
      rows: response.ok ? rowCount(payload) : 0,
      error: response.ok ? null : safeError(payload),
    })
    return response.ok ? payload : null
  } catch (error) {
    calls.push({
      path: path + (query.toString() ? '?' + query.toString() : ''),
      httpStatus: null,
      ok: false,
      rows: 0,
      error: safeError(error instanceof Error ? error.message : error),
    })
    return null
  } finally {
    clearTimeout(timeout)
  }
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function summarizeOpeningProps(rows: Array<Record<string, unknown>>) {
  const propTypes = new Map<string, number>()
  const vendors = new Map<string, number>()
  for (const row of rows) {
    const propType = String(row.prop_type ?? 'unknown')
    const vendor = String(row.vendor ?? 'unknown')
    propTypes.set(propType, (propTypes.get(propType) ?? 0) + 1)
    vendors.set(vendor, (vendors.get(vendor) ?? 0) + 1)
  }
  const wanted = [
    'pitcher_strikeouts','pitcher_outs','pitcher_hits_allowed','pitcher_walks',
    'pitcher_earned_runs','pitcher_record_a_win','hits','home_runs','total_bases',
    'rbis','runs_scored','hits_runs_rbis','singles','doubles','triples','walks','strikeouts','stolen_bases'
  ]
  return {
    rows: rows.length,
    vendors: Object.fromEntries([...vendors.entries()].sort()),
    propTypes: Object.fromEntries([...propTypes.entries()].sort()),
    certifiedModelMarketCoverage: Object.fromEntries(wanted.map((key) => [key, propTypes.get(key) ?? 0])),
  }
}

function summarizeMarkets(rows: Array<Record<string, unknown>>) {
  const keys = new Map<string, number>()
  const periods = new Map<string, number>()
  const vendors = new Map<string, number>()
  for (const row of rows) {
    const key = String(row.key ?? 'unknown')
    const period = String(row.period ?? 'unknown')
    const vendor = String(row.vendor ?? 'unknown')
    keys.set(key, (keys.get(key) ?? 0) + 1)
    periods.set(period, (periods.get(period) ?? 0) + 1)
    vendors.set(vendor, (vendors.get(vendor) ?? 0) + 1)
  }
  const targetHints = ['1st','first','inning','team_total','spread','total','moneyline']
  const targetKeys = [...keys.keys()].filter((key) => targetHints.some((hint) => key.toLowerCase().includes(hint))).sort()
  return {
    rows: rows.length,
    vendors: Object.fromEntries([...vendors.entries()].sort()),
    periods: Object.fromEntries([...periods.entries()].sort()),
    targetMarketKeys: targetKeys,
    allMarketKeys: [...keys.keys()].sort(),
  }
}

export async function probeBalldontlieMlbGoat(input: { date: string; mode: ProbeMode }) {
  const calls: ProviderCall[] = []
  const previewOnly = process.env.VERCEL_ENV !== 'production'
  const base = {
    success: false,
    mode: input.mode,
    date: input.date,
    provider: 'balldontlie',
    researchOnly: true,
    previewOnly: true,
    productionEligible: false,
    officialPicksModified: false,
    apostarActivated: false,
    databaseWrites: 0,
    providerCallsMade: 0,
    credentialPresent: Boolean(apiKey()),
  }
  if (!previewOnly) return { ...base, status: 'BLOCKED_PRODUCTION_ENV' }
  if (!validDate(input.date)) return { ...base, status: 'BLOCKED_INVALID_DATE' }
  if (!apiKey()) return { ...base, status: 'BLOCKED_MISSING_BALLDONTLIE_API_KEY' }

  if (input.mode === 'opening_odds') {
    const q = new URLSearchParams()
    q.append('dates[]', input.date)
    q.set('per_page', '100')
    const payload = await providerGet('/odds/opening', q, calls)
    const rows = dataRows(payload)
    return {
      ...base,
      success: Boolean(payload),
      status: payload ? 'PASS' : 'PROVIDER_CALL_FAILED',
      providerCallsMade: calls.length,
      calls,
      summary: {
        rows: rows.length,
        vendors: [...new Set(rows.map((row) => String(row.vendor ?? 'unknown')))].sort(),
        withMoneyline: rows.filter((row) => row.moneyline_home_odds != null || row.moneyline_away_odds != null).length,
        withSpread: rows.filter((row) => row.spread_home_value != null || row.spread_away_value != null).length,
        withTotal: rows.filter((row) => row.total_value != null).length,
      },
    }
  }

  const gamesQ = new URLSearchParams()
  gamesQ.append('dates[]', input.date)
  gamesQ.set('season_type', 'regular')
  gamesQ.set('per_page', '100')
  const gamesPayload = await providerGet('/games', gamesQ, calls)
  const games = dataRows(gamesPayload)
  const selectedGame = games.find((game) => String(game.status_state ?? '') !== 'canceled') ?? games[0] ?? null
  const selectedGameId = selectedGame ? Number(selectedGame.id) : null
  if (!gamesPayload || !selectedGameId || !Number.isFinite(selectedGameId)) {
    return {
      ...base,
      success: Boolean(gamesPayload),
      status: gamesPayload ? 'NO_GAME_AVAILABLE_FOR_SECOND_CALL' : 'PROVIDER_CALL_FAILED',
      providerCallsMade: calls.length,
      calls,
      gamesFound: games.length,
    }
  }

  if (input.mode === 'opening_props') {
    const q = new URLSearchParams()
    q.set('game_id', String(selectedGameId))
    q.append('vendors[]', 'fanduel')
    q.append('vendors[]', 'draftkings')
    const payload = await providerGet('/odds/player_props/opening', q, calls)
    const rows = dataRows(payload)
    return {
      ...base,
      success: Boolean(payload),
      status: payload ? 'PASS' : 'PROVIDER_CALL_FAILED',
      providerCallsMade: calls.length,
      calls,
      gamesFound: games.length,
      selectedGameId,
      selectedMatchup: selectedGame ? {
        away: (selectedGame.away_team as Record<string, unknown> | undefined)?.abbreviation ?? selectedGame.away_team_name ?? null,
        home: (selectedGame.home_team as Record<string, unknown> | undefined)?.abbreviation ?? selectedGame.home_team_name ?? null,
        startTime: selectedGame.date ?? null,
      } : null,
      summary: summarizeOpeningProps(rows),
    }
  }

  const q = new URLSearchParams()
  q.set('game_id', String(selectedGameId))
  q.append('vendors[]', 'fanduel')
  q.append('vendors[]', 'draftkings')
  q.set('per_page', '100')
  const payload = await providerGet('/odds/markets', q, calls)
  const rows = dataRows(payload)
  return {
    ...base,
    success: Boolean(payload),
    status: payload ? 'PASS' : 'PROVIDER_CALL_FAILED',
    providerCallsMade: calls.length,
    calls,
    gamesFound: games.length,
    selectedGameId,
    selectedMatchup: selectedGame ? {
      away: (selectedGame.away_team as Record<string, unknown> | undefined)?.abbreviation ?? selectedGame.away_team_name ?? null,
      home: (selectedGame.home_team as Record<string, unknown> | undefined)?.abbreviation ?? selectedGame.home_team_name ?? null,
      startTime: selectedGame.date ?? null,
    } : null,
    summary: summarizeMarkets(rows),
  }
}
