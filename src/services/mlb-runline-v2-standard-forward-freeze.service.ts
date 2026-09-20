import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { normalizeMlbModelTeam, normalizedComponentScore, type FeatureValue, type NormalizationStat } from '@/lib/mlb-moneyline-high-confidence-v2'
import {
  buildStandardRunlineOpeningProxy,
  evaluateStandardRunlineV2,
  MLB_RUNLINE_V2_BROAD_MODEL,
  MLB_RUNLINE_V2_CORE_MODEL,
  MLB_RUNLINE_V2_STANDARD_FREEZE_VERSION,
  MLB_RUNLINE_V2_STANDARD_MARKET_POLICY,
  MLB_RUNLINE_V2_TRANSFER_MODEL,
  type StandardRunlineOpeningRow,
} from '@/lib/mlb-runline-v2-standard'

const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const SEASON = 2026
const JOB_TYPE = 'runline_v2_standard_forward_freeze_v1'
const FROZEN_START_DATE = '2026-09-17'
const FREEZE_START_HOUR_PR = 10
const FREEZE_START_MINUTE_PR = 45
const FREEZE_END_HOUR_PR = 10
const FREEZE_END_MINUTE_PR = 59
const TEAM_START_TOLERANCE_MS = 10 * 60 * 1000

type Pick2Game = {
  game_pk: number
  scheduled_at: string
  home_team_id: string
  away_team_id: string
  game_type: string | null
  official_status: string | null
}

type CanonicalTeam = { id: string; abbreviation: string | null }
type SportEvent = { id: string; start_time: string; home_team: string; away_team: string }
type OddsRow = {
  event_id: string
  sportsbook: string
  outcome: string
  price: number | string | null
  line: number | string | null
  snapshot_time: string
  provider: string | null
  odds_classification: string | null
  metadata: Record<string, unknown> | null
}
type TeamGame = {
  game_pk: number
  game_date: string
  team: string
  opponent: string
  is_home: boolean
  venue: string | null
  runs_for: number
  runs_against: number
  win: number
}
type PitcherGame = {
  game_pk: number
  game_date: string
  pitcher: number
  opponent: string
  starter: boolean
  batters_faced: number
  walks: number
  strikeouts: number
  p_throws: string | null
}
type StarterEvidence = { game_pk: number; side: 'HOME' | 'AWAY'; pitcher_mlbam_id: number }
type VenueGeo = { venue: string; lat: number; lon: number; utc_offset_hours: number }
type TeamVenue = { team: string; venue: string; lat: number; lon: number; utc_offset_hours: number }

type OfficialGame = {
  gamePk: number
  scheduledAt: string
  homeMlbTeamId: number | null
  awayMlbTeamId: number | null
  homeStarterId: number | null
  awayStarterId: number | null
  venueId: number | null
  homeOfficialVenueId: number | null
  specialSite: boolean
}

function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function asNum(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function isoDateInPuertoRico(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Puerto_Rico',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function puertoRicoClockParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Puerto_Rico',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')),
    minute: Number(get('minute')),
  }
}

function inFreezeWindow(date = new Date()) {
  const p = puertoRicoClockParts(date)
  const afterStart = p.hour > FREEZE_START_HOUR_PR || (p.hour === FREEZE_START_HOUR_PR && p.minute >= FREEZE_START_MINUTE_PR)
  const beforeEnd = p.hour < FREEZE_END_HOUR_PR || (p.hour === FREEZE_END_HOUR_PR && p.minute <= FREEZE_END_MINUTE_PR)
  return afterStart && beforeEnd
}

function dateDiffDays(later: string, earlier: string) {
  const a = Date.parse(`${later}T00:00:00Z`)
  const b = Date.parse(`${earlier}T00:00:00Z`)
  return Math.round((a - b) / 86400000)
}

function dateMinusDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function haversineMiles(a: VenueGeo | TeamVenue, b: VenueGeo | TeamVenue) {
  const radius = 3958.761
  const rad = (x: number) => x * Math.PI / 180
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return radius * 2 * Math.asin(Math.sqrt(h))
}

function sum(rows: PitcherGame[], key: 'batters_faced' | 'walks' | 'strikeouts') {
  return rows.reduce((acc, row) => acc + (finite(row[key]) ? row[key] : 0), 0)
}

function ratio(num: number, den: number) {
  return den > 0 ? num / den : null
}

async function loadAllRows<T>(
  table: string,
  select: string,
  configure: (q: any) => any,
  pageSize = 1000,
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += pageSize) {
    let q: any = supabaseAdmin.from(table).select(select)
    q = configure(q).range(from, from + pageSize - 1)
    const { data, error } = await q
    if (error) throw new Error(`${table.toUpperCase()}_READ_FAILED:${error.message}`)
    const rows = (data ?? []) as T[]
    out.push(...rows)
    if (rows.length < pageSize) break
  }
  return out
}

async function loadPick2Slate(targetDate: string) {
  const rows = await loadAllRows<Pick2Game>(
    'pick2_mlb_games',
    'game_pk,scheduled_at,home_team_id,away_team_id,game_type,official_status',
    (q) => q.eq('game_date', targetDate).eq('season', SEASON).order('scheduled_at').order('game_pk'),
  )
  return rows.filter((row) => row.game_type === 'R')
}

async function loadCanonicalTeams(ids: string[]) {
  if (!ids.length) return new Map<string, string>()
  const rows = await loadAllRows<CanonicalTeam>(
    'sports_teams',
    'id,abbreviation',
    (q) => q.in('id', [...new Set(ids)]),
  )
  return new Map(rows.map((row) => [row.id, String(row.abbreviation ?? '').toUpperCase()]))
}

async function fetchJson(url: string) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'pick-analyzer-runline-standard-v2/1.0' },
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`MLB_OFFICIAL_HTTP_${response.status}`)
  return response.json()
}

async function loadOfficialContext(targetDate: string) {
  const [schedulePayload, teamsPayload] = await Promise.all([
    fetchJson(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${targetDate}&hydrate=probablePitcher,venue`),
    fetchJson('https://statsapi.mlb.com/api/v1/teams?sportId=1&hydrate=venue'),
  ])
  const homeVenueByTeam = new Map<number, number>()
  for (const team of teamsPayload?.teams ?? []) {
    const teamId = Number(team?.id)
    const venueId = Number(team?.venue?.id)
    if (Number.isFinite(teamId) && Number.isFinite(venueId)) homeVenueByTeam.set(teamId, venueId)
  }

  const out = new Map<number, OfficialGame>()
  for (const dateBucket of schedulePayload?.dates ?? []) {
    for (const game of dateBucket?.games ?? []) {
      if (String(game?.gameType ?? '') !== 'R') continue
      const gamePk = Number(game?.gamePk)
      const homeMlbTeamId = asNum(game?.teams?.home?.team?.id)
      const awayMlbTeamId = asNum(game?.teams?.away?.team?.id)
      const venueId = asNum(game?.venue?.id)
      const homeOfficialVenueId = homeMlbTeamId === null ? null : (homeVenueByTeam.get(homeMlbTeamId) ?? null)
      out.set(gamePk, {
        gamePk,
        scheduledAt: new Date(String(game?.gameDate)).toISOString(),
        homeMlbTeamId,
        awayMlbTeamId,
        homeStarterId: asNum(game?.teams?.home?.probablePitcher?.id),
        awayStarterId: asNum(game?.teams?.away?.probablePitcher?.id),
        venueId,
        homeOfficialVenueId,
        specialSite: venueId !== null && homeOfficialVenueId !== null && venueId !== homeOfficialVenueId,
      })
    }
  }
  return out
}

async function loadNormalization() {
  const recentNames = [
    'home_l5_win_pct','home_l5_run_diff_pg','away_l5_win_pct','away_l5_run_diff_pg',
    'home_l10_win_pct','home_l10_run_diff_pg','away_l10_win_pct','away_l10_run_diff_pg',
  ]
  const fatigueNames = [
    'home_rest_days','away_rest_days','home_games_last_7d','away_games_last_7d',
    'home_travel_miles_48h','away_travel_miles_48h','home_timezone_changes_48h','away_timezone_changes_48h',
    'home_road_trip_game_number','away_road_trip_game_number',
  ]
  const historyNames = [
    'home_h2h_win_pct_prior','home_common_win_pct','away_common_win_pct',
    'home_sp_vs_opp_k_pct','home_sp_vs_opp_bb_pct','away_sp_vs_opp_k_pct','away_sp_vs_opp_bb_pct',
  ]
  const names = [...recentNames, ...fatigueNames, ...historyNames]
  const featureRows = await loadAllRows<{ feature_name: string; mean_value: number; sd_value: number }>(
    'mlb_ml_xyear_feature_stats_v1',
    'feature_name,mean_value,sd_value',
    (q) => q.eq('branch','PREGAME').in('feature_name', names),
  )
  const componentRows = await loadAllRows<{ component: string; mean_score: number; sd_score: number }>(
    'mlb_ml_xyear_component_stats_v1',
    'component,mean_score,sd_score',
    (q) => q.eq('branch','PREGAME').in('component',['recent_form','fatigue_travel','history']),
  )
  const featureStats = new Map<string, NormalizationStat>()
  for (const row of featureRows) featureStats.set(row.feature_name,{ mean:Number(row.mean_value), sd:Number(row.sd_value) })
  const componentStats = new Map<string, NormalizationStat>()
  for (const row of componentRows) componentStats.set(row.component,{ mean:Number(row.mean_score), sd:Number(row.sd_score) })
  ensure(featureStats.size === names.length, `RUNLINE_STANDARD_FEATURE_STATS_INCOMPLETE:${featureStats.size}/${names.length}`)
  ensure(componentStats.size === 3, `RUNLINE_STANDARD_COMPONENT_STATS_INCOMPLETE:${componentStats.size}/3`)
  return { featureStats, componentStats }
}

async function loadTeamGames(targetDate: string, teams: string[]) {
  return loadAllRows<TeamGame>(
    'mlb_ml_xyear_team_game_v1',
    'game_pk,game_date,team,opponent,is_home,venue,runs_for,runs_against,win',
    (q) => q.eq('season',SEASON).in('team',[...new Set(teams)]).lt('game_date',targetDate).order('game_date',{ascending:false}).order('game_pk',{ascending:false}),
  )
}

async function loadPitcherGames(targetDate: string, pitchers: number[]) {
  if (!pitchers.length) return [] as PitcherGame[]
  return loadAllRows<PitcherGame>(
    'mlb_ml_xyear_pitcher_game_v1',
    'game_pk,game_date,pitcher,opponent,starter,batters_faced,walks,strikeouts,p_throws',
    (q) => q.eq('season',SEASON).in('pitcher',[...new Set(pitchers)]).lt('game_date',targetDate).order('game_date',{ascending:false}).order('game_pk',{ascending:false}),
  )
}

async function loadVenueMaps(teams: string[]) {
  const teamVenueRows = await loadAllRows<TeamVenue>(
    'mlb_ml_team_venue_map_v1',
    'team,venue,lat,lon,utc_offset_hours',
    (q) => q.in('team',[...new Set(teams)]),
  )
  const geoRows = await loadAllRows<VenueGeo>(
    'mlb_ml_venue_geo_2025_v3',
    'venue,lat,lon,utc_offset_hours',
    (q) => q.order('venue'),
  )
  return {
    teamVenue: new Map(teamVenueRows.map((row) => [row.team,row])),
    geo: new Map(geoRows.map((row) => [row.venue,row])),
  }
}

function recentValues(homeRows: TeamGame[], awayRows: TeamGame[]): FeatureValue[] {
  const recent = (rows: TeamGame[], n: number) => rows.slice(0,n)
  const avg = (rows: TeamGame[], fn: (r: TeamGame) => number) => rows.length ? rows.reduce((a,r)=>a+fn(r),0)/rows.length : null
  const h5=recent(homeRows,5), a5=recent(awayRows,5), h10=recent(homeRows,10), a10=recent(awayRows,10)
  return [
    { featureName:'home_l5_win_pct', direction:1, value:avg(h5,r=>r.win) },
    { featureName:'home_l5_run_diff_pg', direction:1, value:avg(h5,r=>r.runs_for-r.runs_against) },
    { featureName:'away_l5_win_pct', direction:-1, value:avg(a5,r=>r.win) },
    { featureName:'away_l5_run_diff_pg', direction:-1, value:avg(a5,r=>r.runs_for-r.runs_against) },
    { featureName:'home_l10_win_pct', direction:1, value:avg(h10,r=>r.win) },
    { featureName:'home_l10_run_diff_pg', direction:1, value:avg(h10,r=>r.runs_for-r.runs_against) },
    { featureName:'away_l10_win_pct', direction:-1, value:avg(a10,r=>r.win) },
    { featureName:'away_l10_run_diff_pg', direction:-1, value:avg(a10,r=>r.runs_for-r.runs_against) },
  ]
}

function fatigueValues(
  targetDate: string,
  homeRows: TeamGame[],
  awayRows: TeamGame[],
  currentVenue: TeamVenue | null,
  geo: Map<string,VenueGeo>,
): FeatureValue[] {
  const hPrev=homeRows[0] ?? null
  const aPrev=awayRows[0] ?? null
  const within = (row: TeamGame | null, days: number) => row ? dateDiffDays(targetDate,row.game_date) <= days : false
  const travel = (prev: TeamGame | null) => {
    if (!prev || !currentVenue || !within(prev,2) || !prev.venue) return null
    const prevGeo=geo.get(prev.venue)
    return prevGeo ? haversineMiles(prevGeo,currentVenue) : null
  }
  const timezone = (prev: TeamGame | null) => {
    if (!prev || !currentVenue || !within(prev,2) || !prev.venue) return null
    const prevGeo=geo.get(prev.venue)
    return prevGeo ? Math.abs(currentVenue.utc_offset_hours-prevGeo.utc_offset_hours) : null
  }
  const hLast7=homeRows.filter((r)=>r.game_date>=dateMinusDays(targetDate,7)).length
  const aLast7=awayRows.filter((r)=>r.game_date>=dateMinusDays(targetDate,7)).length
  const lastAwayHomeDate=awayRows.find((r)=>r.is_home)?.game_date ?? '1900-01-01'
  const awayRoadTrip=1+awayRows.filter((r)=>!r.is_home && r.game_date>lastAwayHomeDate).length
  return [
    { featureName:'home_rest_days', direction:1, value:hPrev?Math.max(dateDiffDays(targetDate,hPrev.game_date)-1,0):null },
    { featureName:'away_rest_days', direction:-1, value:aPrev?Math.max(dateDiffDays(targetDate,aPrev.game_date)-1,0):null },
    { featureName:'home_games_last_7d', direction:-1, value:hLast7 },
    { featureName:'away_games_last_7d', direction:1, value:aLast7 },
    { featureName:'home_travel_miles_48h', direction:-1, value:travel(hPrev) },
    { featureName:'away_travel_miles_48h', direction:1, value:travel(aPrev) },
    { featureName:'home_timezone_changes_48h', direction:-1, value:timezone(hPrev) },
    { featureName:'away_timezone_changes_48h', direction:1, value:timezone(aPrev) },
    { featureName:'home_road_trip_game_number', direction:-1, value:0 },
    { featureName:'away_road_trip_game_number', direction:1, value:awayRoadTrip },
  ]
}

function historyValues(
  homeRows: TeamGame[],
  awayRows: TeamGame[],
  homePitcherRows: PitcherGame[],
  awayPitcherRows: PitcherGame[],
  homeTeam: string,
  awayTeam: string,
): FeatureValue[] {
  const h2hHome=homeRows.filter((r)=>r.opponent===awayTeam)
  const homeOpp=new Set(homeRows.map((r)=>r.opponent))
  const awayOpp=new Set(awayRows.map((r)=>r.opponent))
  const common=new Set([...homeOpp].filter((opponent)=>awayOpp.has(opponent)))
  const homeCommon=homeRows.filter((r)=>common.has(r.opponent))
  const awayCommon=awayRows.filter((r)=>common.has(r.opponent))
  const hp=homePitcherRows.filter((r)=>r.opponent===awayTeam)
  const ap=awayPitcherRows.filter((r)=>r.opponent===homeTeam)
  return [
    { featureName:'home_h2h_win_pct_prior', direction:1, value:h2hHome.length?h2hHome.reduce((a,r)=>a+r.win,0)/h2hHome.length:null },
    { featureName:'home_common_win_pct', direction:1, value:homeCommon.length?homeCommon.reduce((a,r)=>a+r.win,0)/homeCommon.length:null },
    { featureName:'away_common_win_pct', direction:-1, value:awayCommon.length?awayCommon.reduce((a,r)=>a+r.win,0)/awayCommon.length:null },
    { featureName:'home_sp_vs_opp_k_pct', direction:1, value:ratio(sum(hp,'strikeouts'),sum(hp,'batters_faced')) },
    { featureName:'home_sp_vs_opp_bb_pct', direction:-1, value:ratio(sum(hp,'walks'),sum(hp,'batters_faced')) },
    { featureName:'away_sp_vs_opp_k_pct', direction:-1, value:ratio(sum(ap,'strikeouts'),sum(ap,'batters_faced')) },
    { featureName:'away_sp_vs_opp_bb_pct', direction:1, value:ratio(sum(ap,'walks'),sum(ap,'batters_faced')) },
  ]
}

function latestHand(rows: PitcherGame[]) {
  return rows.find((row)=>row.p_throws==='L'||row.p_throws==='R')?.p_throws ?? null
}

function dogOrient(value: number | null, dogSide: 'HOME' | 'AWAY' | null) {
  if (!finite(value) || !dogSide) return null
  return dogSide==='HOME'?value:-value
}

async function loadSportEvents(targetDate: string) {
  const start=`${targetDate}T00:00:00.000Z`
  const endDate=new Date(start)
  endDate.setUTCDate(endDate.getUTCDate()+2)
  return loadAllRows<SportEvent>(
    'sport_events',
    'id,start_time,home_team,away_team',
    (q)=>q.eq('sport_key',SPORT_KEY).gte('start_time',start).lt('start_time',endDate.toISOString()).order('start_time'),
  )
}

function matchSportEvent(game: {scheduledAt:string;home:string;away:string}, events: SportEvent[]) {
  const targetMs=Date.parse(game.scheduledAt)
  const matches=events.filter((event)=>event.home_team===game.home&&event.away_team===game.away&&Math.abs(Date.parse(event.start_time)-targetMs)<=TEAM_START_TOLERANCE_MS)
  matches.sort((a,b)=>Math.abs(Date.parse(a.start_time)-targetMs)-Math.abs(Date.parse(b.start_time)-targetMs)||a.id.localeCompare(b.id))
  return matches[0] ?? null
}

async function loadOdds(eventIds: string[]) {
  if (!eventIds.length) return [] as OddsRow[]
  return loadAllRows<OddsRow>(
    'sports_odds_snapshots',
    'event_id,sportsbook,outcome,price,line,snapshot_time,provider,odds_classification,metadata',
    (q)=>q.in('event_id',eventIds).eq('sport_key',SPORT_KEY).eq('market','run_line').eq('provider','the-odds-api').eq('odds_classification','product_primary_pregame').order('snapshot_time'),
  )
}

async function existingJob(targetDate: string) {
  const {data,error}=await supabaseAdmin
    .from('sports_sync_jobs')
    .select('id,status,started_at,completed_at,metadata')
    .eq('job_type',JOB_TYPE)
    .eq('sport_key',SPORT_KEY)
    .contains('metadata',{targetDate})
    .order('created_at',{ascending:false})
    .limit(1)
    .maybeSingle()
  if(error) throw new Error(`RUNLINE_STANDARD_FREEZE_JOB_READ_FAILED:${error.message}`)
  return data
}

export async function freezeMlbRunlineV2StandardForward(input: { now?: Date } = {}) {
  const now=input.now ?? new Date()
  const targetDate=isoDateInPuertoRico(now)
  if(targetDate<FROZEN_START_DATE){
    return {success:true,status:'BEFORE_FROZEN_START_DATE',targetDate,productionEligible:false,officialPicksModified:false,apostarActivated:false}
  }

  const existing=await existingJob(targetDate)
  if(existing){
    return {success:true,status:'REUSE_NO_OP',targetDate,jobId:existing.id,metadata:existing.metadata,productionEligible:false,officialPicksModified:false,apostarActivated:false}
  }
  if(!inFreezeWindow(now)){
    const clock=puertoRicoClockParts(now)
    const afterWindow=clock.hour>FREEZE_END_HOUR_PR||(clock.hour===FREEZE_END_HOUR_PR&&clock.minute>FREEZE_END_MINUTE_PR)
    return {success:!afterWindow,status:afterWindow?'BLOCK_FREEZE_WINDOW_MISSED':'NOT_IN_FREEZE_WINDOW',targetDate,productionEligible:false,officialPicksModified:false,apostarActivated:false}
  }

  const slate=await loadPick2Slate(targetDate)
  ensure(slate.length>0,`RUNLINE_STANDARD_NO_PICK2_SLATE:${targetDate}`)
  ensure(slate.every((game)=>Date.parse(game.scheduled_at)>now.getTime()),'RUNLINE_STANDARD_TARGET_GAME_ALREADY_STARTED')

  const official=await loadOfficialContext(targetDate)
  ensure(official.size===slate.length,`RUNLINE_STANDARD_OFFICIAL_COVERAGE_MISMATCH:${official.size}/${slate.length}`)

  const teamIds=slate.flatMap((game)=>[game.home_team_id,game.away_team_id])
  const canonical=await loadCanonicalTeams(teamIds)
  const games=slate.map((game)=>{
    const home=canonical.get(game.home_team_id) ?? ''
    const away=canonical.get(game.away_team_id) ?? ''
    ensure(home&&away,`RUNLINE_STANDARD_TEAM_MAPPING_MISSING:${game.game_pk}`)
    const o=official.get(game.game_pk)
    ensure(o,`RUNLINE_STANDARD_OFFICIAL_GAME_MISSING:${game.game_pk}`)
    ensure(Math.abs(Date.parse(o.scheduledAt)-Date.parse(game.scheduled_at))<=TEAM_START_TOLERANCE_MS,`RUNLINE_STANDARD_START_MISMATCH:${game.game_pk}`)
    return {
      gamePk:game.game_pk,
      scheduledAt:new Date(game.scheduled_at).toISOString(),
      home,
      away,
      homeModel:normalizeMlbModelTeam(home),
      awayModel:normalizeMlbModelTeam(away),
      homeStarterId:o.homeStarterId,
      awayStarterId:o.awayStarterId,
      specialSite:o.specialSite,
      venueId:o.venueId,
      homeOfficialVenueId:o.homeOfficialVenueId,
    }
  })

  const modelTeams=games.flatMap((game)=>[game.homeModel,game.awayModel])
  const displayTeams=games.flatMap((game)=>[game.home,game.away])
  const pitcherIds=games.flatMap((game)=>[game.homeStarterId,game.awayStarterId]).filter((x):x is number=>Number.isInteger(x))
  const [normalization,teamGames,pitcherGames,venues,events]=await Promise.all([
    loadNormalization(),
    loadTeamGames(targetDate,modelTeams),
    loadPitcherGames(targetDate,pitcherIds),
    loadVenueMaps(displayTeams),
    loadSportEvents(targetDate),
  ])

  const eventByGame=new Map<number,SportEvent|null>()
  for(const game of games) eventByGame.set(game.gamePk,matchSportEvent(game,events))
  const eventIds=[...new Set([...eventByGame.values()].filter((x):x is SportEvent=>Boolean(x)).map((event)=>event.id))]
  const oddsRows=await loadOdds(eventIds)

  const observations=games.map((game)=>{
    const homeRows=teamGames.filter((row)=>row.team===game.homeModel)
    const awayRows=teamGames.filter((row)=>row.team===game.awayModel)
    const hpRows=game.homeStarterId?pitcherGames.filter((row)=>row.pitcher===game.homeStarterId):[]
    const apRows=game.awayStarterId?pitcherGames.filter((row)=>row.pitcher===game.awayStarterId):[]

    const recentHome=normalizedComponentScore(recentValues(homeRows,awayRows),normalization.featureStats,normalization.componentStats.get('recent_form')??null)

    const homeVenue=game.specialSite?null:(venues.teamVenue.get(game.home)??null)
    const fatigueHome=normalizedComponentScore(fatigueValues(targetDate,homeRows,awayRows,homeVenue,venues.geo),normalization.featureStats,normalization.componentStats.get('fatigue_travel')??null)

    const historyHome=normalizedComponentScore(historyValues(homeRows,awayRows,hpRows,apRows,game.homeModel,game.awayModel),normalization.featureStats,normalization.componentStats.get('history')??null)

    const event=eventByGame.get(game.gamePk)??null
    const eventOdds=event?oddsRows.filter((row)=>row.event_id===event.id&&Date.parse(row.snapshot_time)<Date.parse(game.scheduledAt)
      && row.metadata?.source==='odds03d_stage3_product_primary_v1' && row.metadata?.productionAuthority===true):[]
    const market=buildStandardRunlineOpeningProxy(eventOdds.map((row)=>({
      sportsbook:row.sportsbook,
      snapshotTime:row.snapshot_time,
      outcome:row.outcome==='home'?'home':'away',
      line:Number(row.line),
      price:Number(row.price),
    } as StandardRunlineOpeningRow)))

    const dogSide=market?.dogSide??null
    const homeHand=latestHand(hpRows)
    const awayHand=latestHand(apRows)
    const dogFavHand=dogSide==='HOME'&&homeHand&&awayHand?`${homeHand}/${awayHand}`
      :dogSide==='AWAY'&&homeHand&&awayHand?`${awayHand}/${homeHand}`:null

    const decision=evaluateStandardRunlineV2({
      market,
      recentFormDog:dogOrient(recentHome,dogSide),
      historyDog:dogOrient(historyHome,dogSide),
      fatigueTravelDog:dogOrient(fatigueHome,dogSide),
      dogFavHand,
    })

    const missing:string[]=[]
    if(!event) missing.push('SPORT_EVENT_IDENTITY')
    if(!market?.marketEligible) missing.push('STANDARD_PAIRED_RUNLINE_MARKET')
    if(!finite(recentHome)) missing.push('RECENT_FORM')
    if(!finite(fatigueHome)) missing.push('FATIGUE_TRAVEL')
    if(!finite(historyHome)) missing.push('HISTORY')
    if(!dogFavHand) missing.push('STARTER_HANDEDNESS')
    if(game.specialSite) missing.push('SPECIAL_SITE_FATIGUE_GEO')

    return {
      gamePk:game.gamePk,
      eventId:event?.id??null,
      scheduledAt:game.scheduledAt,
      homeTeam:game.home,
      awayTeam:game.away,
      homeModelTeam:game.homeModel,
      awayModelTeam:game.awayModel,
      homeStarterId:game.homeStarterId,
      awayStarterId:game.awayStarterId,
      homeStarterHand:homeHand,
      awayStarterHand:awayHand,
      specialSite:game.specialSite,
      venueId:game.venueId,
      homeOfficialVenueId:game.homeOfficialVenueId,
      market,
      dogSide,
      dogFavHand,
      components:{
        recentFormHome:recentHome,
        historyHome,
        fatigueTravelHome:fatigueHome,
        recentFormDog:dogOrient(recentHome,dogSide),
        historyDog:dogOrient(historyHome,dogSide),
        fatigueTravelDog:dogOrient(fatigueHome,dogSide),
      },
      decision,
      selectedModels:[
        ...(decision.coreSelected?[MLB_RUNLINE_V2_CORE_MODEL]:[]),
        ...(decision.transferSelected?[MLB_RUNLINE_V2_TRANSFER_MODEL]:[]),
        ...(decision.broadSelected?[MLB_RUNLINE_V2_BROAD_MODEL]:[]),
      ],
      missingReason:missing.length?missing.join('|'):null,
    }
  })

  const metadata={
    modelFamily:'RUNLINE_V2_PROSPECTIVE_SHADOW',
    version:MLB_RUNLINE_V2_STANDARD_FREEZE_VERSION,
    marketPolicy:MLB_RUNLINE_V2_STANDARD_MARKET_POLICY,
    targetDate,
    frozenAt:now.toISOString(),
    freezeWindowPuertoRico:'10:45-10:59',
    firstProspectiveRuntimeDate:'2026-09-21',
    slateGames:observations.length,
    marketEligibleGames:observations.filter((row)=>row.market?.marketEligible).length,
    coreEvaluableGames:observations.filter((row)=>row.decision.coreEvaluable).length,
    transferEvaluableGames:observations.filter((row)=>row.decision.transferEvaluable).length,
    coreSelectedGames:observations.filter((row)=>row.decision.coreSelected).length,
    transferSelectedGames:observations.filter((row)=>row.decision.transferSelected).length,
    broadSelectedGames:observations.filter((row)=>row.decision.broadSelected).length,
    providerCalls:{MLB_OFFICIAL:2,sportsbook:0},
    providerCreditSpend:0,
    sourceLineage:{
      slate:'pick2_mlb_games + MLB Official schedule/venue validation',
      market:'sports_odds_snapshots product_primary_pregame read-only',
      components:'mlb_ml_xyear strict-prior history + 2025-frozen normalization',
      marketProxy:'first complete paired run_line per sportsbook -> paired modal line; tie = earliest completed modal cohort; average American prices -> de-vig',
      identity:'canonical teams + scheduled start within 10 minutes',
      dogOrientation:'HOME dog = home-oriented z; AWAY dog = negative home-oriented z',
      dogFavHand:'DOG starter hand / FAVORITE starter hand',
    },
    frozenModels:[MLB_RUNLINE_V2_CORE_MODEL,MLB_RUNLINE_V2_TRANSFER_MODEL,MLB_RUNLINE_V2_BROAD_MODEL],
    observations,
    researchOnly:true,
    productionEligible:false,
    officialPicksModified:false,
    apostarActivated:false,
    roiCertified:false,
    evCertified:false,
  }

  const {data:inserted,error}=await supabaseAdmin
    .from('sports_sync_jobs')
    .insert({
      job_type:JOB_TYPE,
      sport_key:SPORT_KEY,
      league_key:LEAGUE_KEY,
      provider:'internal-model',
      season:String(SEASON),
      started_at:now.toISOString(),
      completed_at:new Date().toISOString(),
      status:'completed',
      records_fetched:observations.length,
      records_inserted:observations.length,
      records_updated:0,
      records_skipped:0,
      error_count:0,
      duration_ms:0,
      metadata,
    })
    .select('id')
    .single()
  if(error) throw new Error(`RUNLINE_STANDARD_FREEZE_INSERT_FAILED:${error.message}`)

  return {
    success:true,
    status:'FROZEN',
    targetDate,
    jobId:inserted?.id??null,
    metadata,
    productionEligible:false,
    officialPicksModified:false,
    apostarActivated:false,
  }
}
