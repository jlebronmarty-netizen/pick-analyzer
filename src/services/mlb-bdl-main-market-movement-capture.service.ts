import 'server-only'

import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'

const PROVIDER = 'balldontlie'
const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const SOURCE = 'BDL_MAIN_MARKET_MOVEMENT_V1'
const WINDOW_MINUTES = 180
const MAX_PAGES = 5

type JsonMap = Record<string, unknown>
type GameRef = {
  gamePk: number
  bdlGameId: number
  eventId: string
  targetStart: string
}
type BdlOdds = {
  id?: number
  game_id?: number
  vendor?: string
  spread_home_value?: string | number | null
  spread_home_odds?: number | null
  spread_away_value?: string | number | null
  spread_away_odds?: number | null
  moneyline_home_odds?: number | null
  moneyline_away_odds?: number | null
  total_value?: string | number | null
  total_over_odds?: number | null
  total_under_odds?: number | null
  updated_at?: string
}

function key() {
  return process.env.BALLDONTLIE_API_KEY?.trim() ?? ''
}

function asRecord(value: unknown): JsonMap {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonMap : {}
}

function finite(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function validIso(value: unknown) {
  const d = new Date(String(value ?? ''))
  return Number.isFinite(d.getTime()) ? d.toISOString() : null
}

function hash(parts: unknown[]) {
  return createHash('sha256')
    .update(parts.map((part) => String(part ?? 'null')).join('|'))
    .digest('hex')
    .slice(0, 28)
}

function currentPuertoRicoDate(now: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Puerto_Rico',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now).filter((p) => p.type !== 'literal').map((p) => [p.type,p.value])
  )
  return String(parts.year)+'-'+String(parts.month)+'-'+String(parts.day)
}

async function gameRefs(now: Date): Promise<GameRef[]> {
  const date = currentPuertoRicoDate(now)
  const result = await supabaseAdmin
    .from('sports_odds_snapshots')
    .select('event_id,metadata,snapshot_time')
    .eq('provider', PROVIDER)
    .eq('sport_key', SPORT_KEY)
    .eq('metadata->>source', 'MLB_APPROVED_PROP_MARKET_CAPTURE_BDL_FALLBACK_V1')
    .gte('snapshot_time', date + 'T00:00:00-04:00')
    .lt('snapshot_time', date + 'T23:59:59.999-04:00')
    .order('snapshot_time', { ascending: false })
    .limit(5000)

  if (result.error) throw new Error('BDL_MAIN_MARKET_GAME_REF_READ_FAILED:' + result.error.message)

  const byGamePk = new Map<number, GameRef>()
  for (const row of result.data ?? []) {
    const metadata = asRecord(row.metadata)
    const gamePk = finite(metadata.canonicalGamePk)
    const bdlGameId = finite(metadata.bdlGameId)
    const targetStart = validIso(metadata.targetStart)
    if (gamePk === null || bdlGameId === null || !targetStart) continue
    if (!Number.isSafeInteger(gamePk) || !Number.isSafeInteger(bdlGameId)) continue
    const startMs = Date.parse(targetStart)
    if (startMs <= now.getTime()) continue
    const minutes = (startMs - now.getTime()) / 60_000
    if (minutes > WINDOW_MINUTES) continue
    if (!byGamePk.has(gamePk)) {
      byGamePk.set(gamePk,{
        gamePk,
        bdlGameId,
        eventId:String(row.event_id),
        targetStart,
      })
    }
  }
  return [...byGamePk.values()].sort((a,b)=>Date.parse(a.targetStart)-Date.parse(b.targetStart))
}

async function fetchOdds(gameIds: number[]) {
  if (!gameIds.length) return { rows: [] as BdlOdds[], calls: 0 }
  const rows: BdlOdds[] = []
  let cursor: string | null = null
  let calls = 0
  do {
    calls += 1
    if (calls > MAX_PAGES) throw new Error('BDL_MAIN_MARKET_PAGINATION_BOUND_EXCEEDED')
    const url = new URL('https://api.balldontlie.io/mlb/v1/odds')
    for (const id of gameIds) url.searchParams.append('game_ids[]',String(id))
    url.searchParams.set('per_page','100')
    if (cursor) url.searchParams.set('cursor',cursor)

    const response = await fetch(url.toString(),{
      cache:'no-store',
      headers:{Authorization:key()},
      signal:AbortSignal.timeout(20_000),
    })
    if (!response.ok) throw new Error('BALLDONTLIE_MAIN_MARKET_HTTP_'+response.status)
    const payload = await response.json() as any
    if (Array.isArray(payload?.data)) rows.push(...payload.data as BdlOdds[])
    const next=payload?.meta?.next_cursor
    cursor=next===null||next===undefined||String(next)===''?null:String(next)
  } while(cursor)
  return { rows,calls }
}

function normalizedRows(ref: GameRef,row: BdlOdds,acquiredAt:string) {
  const bdlOddsId = finite(row.id)
  const vendor = String(row.vendor ?? '').trim().toLowerCase()
  const providerTimestamp = validIso(row.updated_at)
  if (bdlOddsId === null || !vendor || !providerTimestamp) return [] as Array<Record<string,unknown>>
  if (Date.parse(providerTimestamp) >= Date.parse(ref.targetStart)) return []

  const items:Array<{market:string;outcome:string;price:number;line:number|null}> = []
  const homeMl=finite(row.moneyline_home_odds),awayMl=finite(row.moneyline_away_odds)
  if (homeMl !== null && homeMl !== 0) items.push({market:'moneyline',outcome:'home',price:homeMl,line:null})
  if (awayMl !== null && awayMl !== 0) items.push({market:'moneyline',outcome:'away',price:awayMl,line:null})

  const homeSpread=finite(row.spread_home_value),awaySpread=finite(row.spread_away_value)
  const homeSpreadOdds=finite(row.spread_home_odds),awaySpreadOdds=finite(row.spread_away_odds)
  if (homeSpread !== null && homeSpreadOdds !== null && homeSpreadOdds !== 0) {
    items.push({market:'run_line',outcome:'home',price:homeSpreadOdds,line:homeSpread})
  }
  if (awaySpread !== null && awaySpreadOdds !== null && awaySpreadOdds !== 0) {
    items.push({market:'run_line',outcome:'away',price:awaySpreadOdds,line:awaySpread})
  }

  const total=finite(row.total_value),over=finite(row.total_over_odds),under=finite(row.total_under_odds)
  if (total !== null && over !== null && over !== 0) items.push({market:'total',outcome:'over',price:over,line:total})
  if (total !== null && under !== null && under !== 0) items.push({market:'total',outcome:'under',price:under,line:total})

  return items.map((item)=>({
    id:'bdlmain_'+hash([SOURCE,bdlOddsId,item.market,item.outcome,item.line,item.price,providerTimestamp]),
    sport_key:SPORT_KEY,
    league_key:LEAGUE_KEY,
    season:'2026',
    event_id:ref.eventId,
    provider:PROVIDER,
    sportsbook:vendor,
    market:item.market,
    outcome:item.outcome,
    price:item.price,
    line:item.line,
    snapshot_time:providerTimestamp,
    provider_timestamp:providerTimestamp,
    is_opening:false,
    is_closing:false,
    odds_classification:'research_pregame_bdl_main_market_movement',
    metadata:{
      source:SOURCE,
      researchOnly:true,
      productionEligible:false,
      officialPicksEligible:false,
      apostarEnabled:false,
      canonicalGamePk:ref.gamePk,
      bdlGameId:ref.bdlGameId,
      bdlOddsId,
      targetStart:ref.targetStart,
      providerTimestamp,
      acquiredAt,
      strictPregame:true,
      historical:false,
      movementEvidence:true,
    },
    created_at:acquiredAt,
    updated_at:acquiredAt,
  }))
}

export async function captureBdlMainMarketMovement(input:{now?:Date}={}) {
  const now=input.now??new Date()
  const acquiredAt=now.toISOString()
  const base={
    success:true,
    status:'NO_ELIGIBLE_GAMES',
    researchOnly:true,
    productionEligible:false,
    officialPicksModified:false,
    apostarActivated:false,
    historicalOddsApiCalls:0,
    provider:PROVIDER,
    providerCallsMade:0,
    eligibleGames:0,
    rowsObserved:0,
    rowsInserted:0,
    rowsReused:0,
  }
  if(!key()) return {...base,success:false,status:'BLOCKED_MISSING_BALLDONTLIE_API_KEY'}

  const refs=await gameRefs(now)
  if(!refs.length) return base
  const byBdlId=new Map(refs.map((ref)=>[ref.bdlGameId,ref]))
  const odds=await fetchOdds(refs.map((ref)=>ref.bdlGameId))

  const normalized:Array<Record<string,unknown>>=[]
  for(const row of odds.rows){
    const gameId=finite(row.game_id)
    if(gameId===null) continue
    const ref=byBdlId.get(gameId)
    if(!ref) continue
    normalized.push(...normalizedRows(ref,row,acquiredAt))
  }

  if(!normalized.length){
    return {...base,status:'NO_USABLE_PREGAME_MAIN_MARKET_ROWS',providerCallsMade:odds.calls,eligibleGames:refs.length}
  }

  const ids=normalized.map((row)=>String(row.id))
  const existing=new Set<string>()
  for(let offset=0;offset<ids.length;offset+=100){
    const result=await supabaseAdmin.from('sports_odds_snapshots').select('id').in('id',ids.slice(offset,offset+100))
    if(result.error) throw new Error('BDL_MAIN_MARKET_EXISTING_READ_FAILED:'+result.error.message)
    for(const row of result.data??[]) existing.add(String(row.id))
  }
  const newRows=normalized.filter((row)=>!existing.has(String(row.id)))
  if(newRows.length){
    for(let offset=0;offset<newRows.length;offset+=500){
      const write=await supabaseAdmin.from('sports_odds_snapshots').insert(newRows.slice(offset,offset+500))
      if(write.error) throw new Error('BDL_MAIN_MARKET_WRITE_FAILED:'+write.error.message)
    }
  }

  const markets=new Set(normalized.map((row)=>String(row.market)))
  const books=new Set(normalized.map((row)=>String(row.sportsbook)))
  return {
    ...base,
    status:newRows.length?'BDL_MAIN_MARKET_MOVEMENT_PERSISTED':'REUSE_NO_OP_NO_PROVIDER_CHANGES',
    providerCallsMade:odds.calls,
    eligibleGames:refs.length,
    providerRows:odds.rows.length,
    rowsObserved:normalized.length,
    rowsInserted:newRows.length,
    rowsReused:normalized.length-newRows.length,
    markets:[...markets].sort(),
    sportsbooks:[...books].sort(),
  }
}
