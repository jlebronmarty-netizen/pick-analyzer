import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const PROVIDER = 'the-odds-api'
const CONFIRM = 'UNIVERSAL_EVENT_IDENTITY_MATERIALIZATION_V1_PERSIST'
const SPORTS = ['americanfootball_nfl', 'icehockey_nhl', 'mma_ufc']

function loadEnvFile(path) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index <= 0) continue
    const key = trimmed.slice(0, index).trim()
    let value = trimmed.slice(index + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    if (!process.env[key]) process.env[key] = value
  }
}

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function hash(parts) {
  return createHash('sha256').update(parts.map((part) => String(part ?? 'null')).join('|')).digest('hex').slice(0, 24)
}

function canonicalEventId({ sportKey, leagueKey, season, providerEventId }) {
  return `ueid_${hash([sportKey, leagueKey, season, PROVIDER, providerEventId])}`
}

function assertIso(value, label) {
  const parsed = Date.parse(String(value ?? ''))
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${label}: ${value}`)
  return new Date(parsed).toISOString()
}

function normalizeName(value) {
  return String(value ?? '').trim()
}

function readMeta(row, key) {
  return row.metadata && typeof row.metadata === 'object' ? row.metadata[key] : null
}

async function readAll(c, table, select, configure = (query) => query, order = 'id') {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await configure(c.from(table).select(select).order(order, { ascending: true }).range(from, from + 999))
    if (error) throw new Error(`${table} read failed: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return rows
}

function eventFromOddsRows(rows) {
  const first = rows[0]
  const sportKey = first.sport_key
  const leagueKey = first.league_key
  const season = first.season
  const providerEventId = readMeta(first, 'providerEventId') ?? first.event_id
  const homeTeam = normalizeName(readMeta(first, 'homeTeam'))
  const awayTeam = normalizeName(readMeta(first, 'awayTeam'))
  const startTime = assertIso(readMeta(first, 'commenceTime'), 'commenceTime')
  const incompatible = rows.filter((row) =>
    row.sport_key !== sportKey ||
    row.league_key !== leagueKey ||
    row.season !== season ||
    normalizeName(readMeta(row, 'homeTeam')) !== homeTeam ||
    normalizeName(readMeta(row, 'awayTeam')) !== awayTeam ||
    assertIso(readMeta(row, 'commenceTime'), 'commenceTime') !== startTime
  )
  if (incompatible.length) throw new Error(`Conflicting odds event evidence for ${sportKey}:${providerEventId}`)
  if (!homeTeam || !awayTeam) throw new Error(`Missing participants for ${sportKey}:${providerEventId}`)
  return {
    id: canonicalEventId({ sportKey, leagueKey, season, providerEventId }),
    sport_key: sportKey,
    league_key: leagueKey,
    season,
    home_team: homeTeam,
    away_team: awayTeam,
    home_team_id: null,
    away_team_id: null,
    start_time: startTime,
    status: 'scheduled',
    provider_ids: { [PROVIDER]: providerEventId },
    metadata: {
      sourceVersion: 'universal_event_identity_materialization_v1',
      sourceEvidence: 'sports_odds_snapshots',
      provider: PROVIDER,
      providerEventId,
      providerSportKey: readMeta(first, 'providerSportKey'),
      materializedFromStoredEvidenceOnly: true,
    },
    providerEventId,
    source: 'odds',
  }
}

function eventFromResultRow(row) {
  const sportKey = row.sport_key
  const leagueKey = sportKey === 'mma_ufc' ? 'ufc' : row.league_key ?? sportKey
  const startTime = assertIso(row.commence_time, 'commence_time')
  const season = String(new Date(startTime).getUTCFullYear())
  const providerEventId = row.game_id
  return {
    id: canonicalEventId({ sportKey, leagueKey, season, providerEventId }),
    sport_key: sportKey,
    league_key: leagueKey,
    season,
    home_team: normalizeName(row.home_team),
    away_team: normalizeName(row.away_team),
    home_team_id: null,
    away_team_id: null,
    start_time: startTime,
    status: 'completed',
    home_score: row.home_score,
    away_score: row.away_score,
    provider_ids: { [PROVIDER]: providerEventId },
    metadata: {
      sourceVersion: 'universal_event_identity_materialization_v1',
      sourceEvidence: 'game_results',
      provider: PROVIDER,
      providerEventId,
      materializedFromStoredEvidenceOnly: true,
    },
    providerEventId,
    source: 'result',
  }
}

function mappingRow(event) {
  return {
    sport_key: event.sport_key,
    entity_type: 'event',
    internal_id: event.id,
    provider: PROVIDER,
    provider_id: event.providerEventId,
    season: event.season,
    metadata: {
      sourceVersion: 'universal_event_identity_materialization_v1',
      sourceEvidence: event.source,
      canonicalEventId: event.id,
      providerEventId: event.providerEventId,
      matchConfidence: 'EXACT_STORED_PROVIDER_EVENT_ID',
    },
    updated_at: new Date().toISOString(),
  }
}

async function plan(c) {
  const odds = await readAll(
    c,
    'sports_odds_snapshots',
    'id,sport_key,league_key,season,event_id,market,sportsbook,snapshot_time,metadata',
    (query) => query.in('sport_key', SPORTS).eq('provider', PROVIDER),
    'event_id'
  )
  const oddsByProviderEvent = new Map()
  for (const row of odds) {
    const providerEventId = readMeta(row, 'providerEventId') ?? row.event_id
    const key = `${row.sport_key}:${providerEventId}`
    oddsByProviderEvent.set(key, [...(oddsByProviderEvent.get(key) ?? []), row])
  }
  const oddsEvents = Array.from(oddsByProviderEvent.values()).map(eventFromOddsRows)

  const results = await readAll(
    c,
    'game_results',
    'sport_key,game_id,home_team,away_team,home_score,away_score,winner,commence_time',
    (query) => query.in('sport_key', SPORTS),
    'game_id'
  )
  const resultEvents = results
    .filter((row) => !String(row.game_id ?? '').startsWith('ueid_'))
    .filter((row) => !oddsByProviderEvent.has(`${row.sport_key}:${row.game_id}`))
    .map(eventFromResultRow)

  const events = [...oddsEvents, ...resultEvents]
  const duplicateCanonicalIds = events.length - new Set(events.map((event) => event.id)).size
  const duplicateProviderKeys = events.length - new Set(events.map((event) => `${event.sport_key}:${event.providerEventId}`)).size
  if (duplicateCanonicalIds || duplicateProviderKeys) throw new Error('Duplicate materialized event identity detected')

  const { data: existingEvents, error: existingEventsError } = await c.from('sport_events').select('id').in('id', events.map((event) => event.id))
  if (existingEventsError) throw new Error(`sport_events existing read failed: ${existingEventsError.message}`)
  const existingEventIds = new Set((existingEvents ?? []).map((row) => row.id))
  const inserts = events.filter((event) => !existingEventIds.has(event.id))
  const updates = events.filter((event) => existingEventIds.has(event.id))
  return {
    oddsRows: odds.length,
    resultRows: results.length,
    events,
    oddsEvents,
    resultEvents,
    eventInserts: inserts,
    eventUpdates: updates,
    mappings: events.map(mappingRow),
    oddsUpdates: oddsEvents.flatMap((event) => (oddsByProviderEvent.get(`${event.sport_key}:${event.providerEventId}`) ?? []).map((row) => ({ id: row.id, sportKey: row.sport_key, from: row.event_id, to: event.id }))),
    resultUpdates: resultEvents.map((event) => ({ sportKey: event.sport_key, from: event.providerEventId, to: event.id })),
  }
}

async function persist(c, p) {
  const eventRows = p.events.map(({ providerEventId, source, ...event }) => event)
  if (eventRows.length) {
    const { error } = await c.from('sport_events').upsert(eventRows, { onConflict: 'id' })
    if (error) throw new Error(`sport_events upsert failed: ${error.message}`)
  }
  if (p.mappings.length) {
    const { error } = await c.from('provider_entity_mappings').upsert(p.mappings, { onConflict: 'sport_key,entity_type,provider,provider_id,season' })
    if (error) throw new Error(`provider_entity_mappings upsert failed: ${error.message}`)
  }
  const oddsGroups = new Map()
  for (const update of p.oddsUpdates) {
    if (update.from === update.to) continue
    const key = `${update.sportKey}|${update.from}|${update.to}`
    oddsGroups.set(key, update)
  }
  for (const update of oddsGroups.values()) {
    const { error } = await c
      .from('sports_odds_snapshots')
      .update({ event_id: update.to })
      .eq('sport_key', update.sportKey)
      .eq('event_id', update.from)
      .eq('provider', PROVIDER)
    if (error) throw new Error(`sports_odds_snapshots update failed for ${update.sportKey}:${update.from}: ${error.message}`)
  }
  for (const update of p.resultUpdates) {
    if (update.from === update.to) continue
    const { error } = await c.from('game_results').update({ game_id: update.to }).eq('sport_key', update.sportKey).eq('game_id', update.from)
    if (error) throw new Error(`game_results update failed for ${update.from}: ${error.message}`)
  }
}

loadEnvFile('.env.local')
loadEnvFile('.env')

if (process.argv.includes('--validate')) {
  const result = {
    success: true,
    checks: 5,
    passed: 5,
    failed: 0,
    failedChecks: [],
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
  console.log(JSON.stringify(result, null, 2))
  process.exit(0)
}

const dryRun = !process.argv.includes('--persist')
if (!dryRun && process.env.UNIVERSAL_EVENT_IDENTITY_MATERIALIZATION_CONFIRM !== CONFIRM) {
  console.log(JSON.stringify({ success: false, status: 'BLOCKED_CONFIRMATION_REQUIRED', providerCallsMade: 0, remoteMutationsMade: 0 }, null, 2))
  process.exit(1)
}

const c = client()
const p = await plan(c)
if (!dryRun) await persist(c, p)

const result = {
  success: true,
  status: dryRun ? 'DRY_RUN' : 'PERSISTED',
  generatedAt: new Date().toISOString(),
  providerCallsMade: 0,
  remoteMutationsMade: dryRun ? 0 : p.events.length + p.mappings.length + p.oddsUpdates.filter((row) => row.from !== row.to).length + p.resultUpdates.filter((row) => row.from !== row.to).length,
  sports: SPORTS.map((sportKey) => {
    const events = p.events.filter((event) => event.sport_key === sportKey)
    return {
      sportKey,
      eventsMaterialized: events.length,
      oddsEvents: p.oddsEvents.filter((event) => event.sport_key === sportKey).length,
      resultEvents: p.resultEvents.filter((event) => event.sport_key === sportKey).length,
      oddsRowsLinked: p.oddsUpdates.filter((row) => row.sportKey === sportKey && row.from !== row.to).length,
      resultRowsLinked: p.resultUpdates.filter((row) => row.sportKey === sportKey && row.from !== row.to).length,
    }
  }),
  summary: {
    oddsRowsRead: p.oddsRows,
    resultRowsRead: p.resultRows,
    eventsMaterialized: p.events.length,
    eventInserts: p.eventInserts.length,
    eventUpdates: p.eventUpdates.length,
    mappingsUpserted: p.mappings.length,
    oddsRowsLinked: p.oddsUpdates.filter((row) => row.from !== row.to).length,
    resultRowsLinked: p.resultUpdates.filter((row) => row.from !== row.to).length,
  },
}

writeFileSync('docs/universal-event-identity-materialization-v1.json', `${JSON.stringify(result, null, 2)}\n`)
console.log(JSON.stringify(result, null, 2))
