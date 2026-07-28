import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const envPath = '.env.local'
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([^#][^=]+)=(.*)$/)
    if (match) process.env[match[1].trim()] ??= match[2].trim()
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Missing Supabase read credentials')

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch },
})

const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const TIMEZONE = 'America/Puerto_Rico'
const CORE_MARKETS = new Set(['moneyline', 'run_line', 'spread', 'total'])

function localDateInZone(date = new Date(), timeZone = TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const get = (type) => parts.find((part) => part.type === type)?.value
  return `${get('year')}-${get('month')}-${get('day')}`
}

function utcRangeForLocalDate(date, timeZone = TIMEZONE) {
  const startGuess = new Date(`${date}T12:00:00.000Z`)
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  function zonedParts(utc) {
    const out = {}
    for (const part of formatter.formatToParts(utc)) {
      if (part.type !== 'literal') out[part.type] = part.value
    }
    return out
  }
  function offsetMs(utc) {
    const part = zonedParts(utc)
    const asUtc = Date.UTC(
      Number(part.year),
      Number(part.month) - 1,
      Number(part.day),
      Number(part.hour),
      Number(part.minute),
      Number(part.second),
    )
    return asUtc - utc.getTime()
  }
  const localStartAsUtc = new Date(`${date}T00:00:00.000Z`)
  const start = new Date(localStartAsUtc.getTime() - offsetMs(startGuess))
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { utcStart: start.toISOString(), utcEndExclusive: end.toISOString() }
}

async function safeRead(label, fn, fallback) {
  const { data, error, count } = await fn()
  if (error) return { label, error: error.message, data: fallback, count: count ?? null }
  return { label, error: null, data: data ?? fallback, count: count ?? null }
}

function teamKey(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function providerEventIdFrom(row) {
  const metadata = row.metadata ?? {}
  return metadata.providerEventId ?? metadata.provider_event_id ?? metadata.theOddsApiEventId ?? metadata.the_odds_api_event_id ?? null
}

function canonicalStart(row) {
  return row.start_time ?? row.metadata?.commenceTime ?? row.metadata?.commence_time ?? null
}

function isPregame(row, nowMs) {
  const start = Date.parse(canonicalStart(row) ?? '')
  return Number.isFinite(start) && start - 10 * 60 * 1000 > nowMs
}

function classifyCutoff(row, nowMs) {
  const start = Date.parse(canonicalStart(row) ?? '')
  if (!Number.isFinite(start)) return 'START_TIME_UNAVAILABLE'
  if (start <= nowMs) return 'STARTED_OR_PAST_START'
  if (start - 10 * 60 * 1000 <= nowMs) return 'PAST_10_MINUTE_CUTOFF'
  return 'PREGAME_SAFE'
}

function summarizeOdds(rows) {
  const coreRows = rows.filter((row) => CORE_MARKETS.has(row.market))
  const markets = [...new Set(coreRows.map((row) => row.market))].sort()
  const bookmakers = [...new Set(coreRows.map((row) => row.sportsbook).filter(Boolean))].sort()
  const latest = coreRows.map((row) => row.snapshot_time).filter(Boolean).sort().at(-1) ?? null
  return { rows: rows.length, coreRows: coreRows.length, markets, bookmakers, latest }
}

const now = new Date()
const localDate = localDateInZone(now)
const range = utcRangeForLocalDate(localDate)
const nowMs = now.getTime()

const eventsResult = await safeRead('today_events', () =>
  supabase
    .from('sport_events')
    .select('id,sport_key,league_key,season,home_team,away_team,start_time,status,updated_at,metadata')
    .eq('sport_key', SPORT_KEY)
    .eq('league_key', LEAGUE_KEY)
    .gte('start_time', range.utcStart)
    .lt('start_time', range.utcEndExclusive)
    .order('start_time', { ascending: true }),
  [],
)
if (eventsResult.error) throw new Error(eventsResult.error)

const events = eventsResult.data
const eventIds = events.map((event) => event.id)
const providerIds = [...new Set(events.map(providerEventIdFrom).filter(Boolean).map(String))]

const oddsCanonicalResult = eventIds.length ? await safeRead('odds_by_canonical_event_id', () =>
  supabase
    .from('sports_odds_snapshots')
    .select('id,sport_key,league_key,season,event_id,provider,sportsbook,market,outcome,price,line,snapshot_time,provider_timestamp,created_at,updated_at,metadata')
    .eq('sport_key', SPORT_KEY)
    .in('event_id', eventIds)
    .order('snapshot_time', { ascending: false })
    .limit(5000),
  [],
) : { data: [], error: null }
if (oddsCanonicalResult.error) throw new Error(oddsCanonicalResult.error)

const oddsProviderResult = providerIds.length ? await safeRead('odds_by_provider_event_id_from_event_metadata', () =>
  supabase
    .from('sports_odds_snapshots')
    .select('id,sport_key,league_key,season,event_id,provider,sportsbook,market,outcome,price,line,snapshot_time,provider_timestamp,created_at,updated_at,metadata')
    .eq('sport_key', SPORT_KEY)
    .in('event_id', providerIds)
    .order('snapshot_time', { ascending: false })
    .limit(5000),
  [],
) : { data: [], error: null }
if (oddsProviderResult.error) throw new Error(oddsProviderResult.error)

const latestMlbOddsResult = await safeRead('latest_mlb_odds', () =>
  supabase
    .from('sports_odds_snapshots')
    .select('id,event_id,provider,sportsbook,market,outcome,price,line,snapshot_time,provider_timestamp,created_at,updated_at,metadata')
    .eq('sport_key', SPORT_KEY)
    .order('snapshot_time', { ascending: false })
    .limit(2000),
  [],
)
if (latestMlbOddsResult.error) throw new Error(latestMlbOddsResult.error)

const predictionsResult = eventIds.length ? await safeRead('today_predictions', () =>
  supabase
    .from('prediction_history')
    .select('id,game_id,sport_key,market,team,opponent,odds_snapshot_id,odds_timestamp,generated_at,created_at,cutoff_at,status,result,recommended_pick,production_eligible,trial,scrambled,lifecycle_status,model_role,is_current')
    .eq('sport_key', SPORT_KEY)
    .in('game_id', eventIds)
    .limit(5000),
  [],
) : { data: [], error: null }
if (predictionsResult.error) throw new Error(predictionsResult.error)

const operatingDaysResult = await safeRead('operating_days', () =>
  supabase
    .from('operating_days')
    .select('id,sport_key,league_key,local_date,timezone,status,morning_sync_at,midday_refresh_at,final_refresh_at,recommendations_locked_at,results_synced_at,settlement_completed_at,provider_calls_used,last_error,retry_count,metadata,created_at,updated_at')
    .eq('sport_key', SPORT_KEY)
    .eq('league_key', LEAGUE_KEY)
    .eq('local_date', localDate)
    .limit(5),
  [],
)

const operatingDayIds = operatingDaysResult.data.map((row) => row.id)
const lifecycleResult = operatingDayIds.length ? await safeRead('operating_day_lifecycle_events', () =>
  supabase
    .from('operating_day_lifecycle_events')
    .select('id,operating_day_id,action,status,started_at,completed_at,provider_calls_planned,provider_calls_made,database_writes,reused_records,blocking_reason,metadata,created_at')
    .in('operating_day_id', operatingDayIds)
    .order('started_at', { ascending: false })
    .limit(50),
  [],
) : { data: [], error: null }

const syncJobsResult = await safeRead('sports_sync_jobs', () =>
  supabase
    .from('sports_sync_jobs')
    .select('id,job_type,sport_key,league_key,provider,season,status,records_fetched,records_inserted,records_updated,records_skipped,error_count,started_at,completed_at,metadata,updated_at')
    .or('sport_key.eq.baseball_mlb,sport_key.eq.all,league_key.eq.mlb')
    .order('started_at', { ascending: false, nullsFirst: false })
    .limit(50),
  [],
)

const featureSnapshotsResult = eventIds.length ? await safeRead('feature_snapshots', () =>
  supabase
    .from('historical_feature_snapshots')
    .select('id,event_id,market,prediction_cutoff,as_of_timestamp,generated_at,model_version,feature_set_version,data_quality_score,data_sufficiency_score,leakage_status,trial,scrambled,production_eligible,metadata')
    .eq('sport_key', SPORT_KEY)
    .in('event_id', eventIds)
    .limit(5000),
  [],
) : { data: [], error: null }

const oddsByCanonical = new Map()
for (const row of oddsCanonicalResult.data) {
  oddsByCanonical.set(row.event_id, [...(oddsByCanonical.get(row.event_id) ?? []), row])
}
const oddsByProvider = new Map()
for (const row of oddsProviderResult.data) {
  oddsByProvider.set(row.event_id, [...(oddsByProvider.get(row.event_id) ?? []), row])
}
const predictionsByEvent = new Map()
for (const row of predictionsResult.data) {
  predictionsByEvent.set(row.game_id, [...(predictionsByEvent.get(row.game_id) ?? []), row])
}
const featuresByEvent = new Map()
for (const row of featureSnapshotsResult.data ?? []) {
  featuresByEvent.set(row.event_id, [...(featuresByEvent.get(row.event_id) ?? []), row])
}

const duplicateMatchups = Object.entries(events.reduce((acc, event) => {
  const key = `${teamKey(event.away_team)}@${teamKey(event.home_team)}`
  acc[key] = [...(acc[key] ?? []), event]
  return acc
}, {})).filter(([, rows]) => rows.length > 1)

const perEvent = events.map((event) => {
  const providerEventId = providerEventIdFrom(event)
  const canonicalOdds = oddsByCanonical.get(event.id) ?? []
  const providerOdds = providerEventId ? oddsByProvider.get(String(providerEventId)) ?? [] : []
  const canonicalSummary = summarizeOdds(canonicalOdds)
  const providerSummary = summarizeOdds(providerOdds)
  const exactBlocker =
    canonicalSummary.coreRows > 0
      ? 'CANONICAL_ODDS_AVAILABLE'
      : providerSummary.coreRows > 0
        ? 'ODDS_STORED_UNDER_PROVIDER_EVENT_ID'
        : providerEventId
          ? 'NO_STORED_ODDS_FOR_CANONICAL_OR_PROVIDER_EVENT_ID'
          : 'PROVIDER_EVENT_MAPPING_MISSING'
  return {
    canonicalEventId: event.id,
    providerEventId,
    matchup: `${event.away_team ?? 'Away'} @ ${event.home_team ?? 'Home'}`,
    homeTeam: event.home_team,
    awayTeam: event.away_team,
    startTime: event.start_time,
    status: event.status,
    cutoffState: classifyCutoff(event, nowMs),
    pregameSafe: isPregame(event, nowMs),
    canonicalOdds: canonicalSummary,
    providerIdOdds: providerSummary,
    featureSnapshots: featuresByEvent.get(event.id)?.length ?? 0,
    predictions: predictionsByEvent.get(event.id)?.length ?? 0,
    predictionEligibility: isPregame(event, nowMs) && (canonicalSummary.coreRows > 0 || providerSummary.coreRows > 0)
      ? 'PREGAME_WITH_ODDS_EVIDENCE'
      : isPregame(event, nowMs)
        ? 'PREGAME_BLOCKED_BY_ODDS'
        : 'CUTOFF_OR_STARTED',
    exactBlocker,
  }
})

const allCanonicalOdds = oddsCanonicalResult.data
const allProviderOdds = oddsProviderResult.data
const canonicalCore = allCanonicalOdds.filter((row) => CORE_MARKETS.has(row.market))
const providerCore = allProviderOdds.filter((row) => CORE_MARKETS.has(row.market))
const latestMlbOdds = latestMlbOddsResult.data
const latestMlbSummary = summarizeOdds(latestMlbOdds)
const predictionRows = predictionsResult.data
const productionPredictions = predictionRows.filter((row) => row.production_eligible === true && row.trial !== true && row.scrambled !== true)
const validPregame = predictionRows.filter((row) => {
  const event = events.find((item) => item.id === row.game_id)
  if (!event) return false
  const generated = Date.parse(row.generated_at ?? row.created_at ?? '')
  const start = Date.parse(event.start_time ?? '')
  return Number.isFinite(generated) && Number.isFinite(start) && generated < start
})

const result = {
  success: true,
  mode: 'mlb_operating_day_odds_audit_v1',
  generatedAt: now.toISOString(),
  timezone: TIMEZONE,
  localDate,
  utcRange: range,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  productionMutationsMade: 0,
  schedule: {
    events: events.length,
    earliestStart: events.map((event) => event.start_time).filter(Boolean).sort()[0] ?? null,
    latestStart: events.map((event) => event.start_time).filter(Boolean).sort().at(-1) ?? null,
    statuses: events.reduce((acc, event) => {
      const key = event.status ?? 'unknown'
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {}),
    duplicateMatchups: duplicateMatchups.map(([key, rows]) => ({
      key,
      count: rows.length,
      eventIds: rows.map((row) => row.id),
      startTimes: rows.map((row) => row.start_time),
      classification: new Set(rows.map((row) => row.start_time)).size === rows.length ? 'POSSIBLE_GENUINE_DOUBLEHEADER' : 'POSSIBLE_DUPLICATE',
    })),
  },
  oddsAudit: {
    eventsWithCanonicalOdds: perEvent.filter((event) => event.canonicalOdds.coreRows > 0).length,
    eventsWithProviderIdOdds: perEvent.filter((event) => event.providerIdOdds.coreRows > 0).length,
    eventsWithoutAnyStoredOdds: perEvent.filter((event) => event.canonicalOdds.coreRows === 0 && event.providerIdOdds.coreRows === 0).length,
    canonicalCoreRows: canonicalCore.length,
    providerIdCoreRows: providerCore.length,
    latestMlbOddsSnapshot: latestMlbSummary.latest,
    latestMlbBookmakers: latestMlbSummary.bookmakers,
    latestMlbMarkets: latestMlbSummary.markets,
  },
  predictions: {
    storedForSlate: predictionRows.length,
    validPregame: validPregame.length,
    productionEligible: productionPredictions.length,
    currentRows: predictionRows.filter((row) => row.is_current === true).length,
    officialPicks: predictionRows.filter((row) => row.recommended_pick === true).length,
  },
  features: {
    snapshotsForSlate: featureSnapshotsResult.data?.length ?? 0,
  },
  scheduler: {
    operatingDays: operatingDaysResult.data,
    lifecycleEvents: lifecycleResult.data ?? [],
    syncJobs: syncJobsResult.data ?? [],
  },
  perEvent,
}

console.log(JSON.stringify(result, null, 2))
