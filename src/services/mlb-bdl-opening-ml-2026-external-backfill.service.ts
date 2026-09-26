import 'server-only'

import { createHash, randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'

const PROVIDER='balldontlie'
const SPORT_KEY='baseball_mlb'
const LEAGUE_KEY='mlb'
const SEASON=2026
const SOURCE='BDL_2026_ML_EXTERNAL_OPENING_V1'
const JOB_TYPE='mlb_bdl_opening_ml_2026_external_backfill_v1'
const TARGET_TABLE='mlb_bdl_opening_ml_2026_external_v1'
const MAX_DATES_PER_BATCH=8
const MAX_GAMES_PAGES_PER_DATE=2
const MAX_OPENING_PAGES_PER_DATE=5
const REQUEST_PAUSE_MS=120
const ALLOWED_VENDORS=new Set(['betmgm','betrivers'])

type JsonMap=Record<string,unknown>
type FeatureGame={
  canonical_game_id:string
  game_pk:number|null
  game_date:string
  home_team:string
  away_team:string
  game_number:number
  start_time_local:string|null
}
type BdlGame={id?:number;date?:string;home_team?:{abbreviation?:string};away_team?:{abbreviation?:string}}
type BdlOpening={
  id?:number;game_id?:number;vendor?:string;moneyline_home_odds?:number|null;
  moneyline_away_odds?:number|null;opened_at?:string
}

function key(){return process.env.BALLDONTLIE_API_KEY?.trim()??''}
function sleep(ms:number){return new Promise(r=>setTimeout(r,ms))}
function finiteInt(v:unknown){const n=Number(v);return Number.isSafeInteger(n)?n:null}
function validIso(v:unknown){const d=new Date(String(v??''));return Number.isFinite(d.getTime())?d.toISOString():null}
function normalizeTeam(v:unknown){
  const raw=String(v??'').trim().toUpperCase()
  const aliases:Record<string,string>={ARI:'AZ',AZ:'AZ',CHW:'CWS',CWS:'CWS',WSN:'WSH',WAS:'WSH',WSH:'WSH',TBR:'TB',TB:'TB',OAK:'ATH',ATH:'ATH'}
  return aliases[raw]??raw
}
function pairKey(home:unknown,away:unknown){return normalizeTeam(home)+'|'+normalizeTeam(away)}
function id(parts:unknown[]){return 'bdlml26_'+createHash('sha256').update(parts.map(x=>String(x??'null')).join('|')).digest('hex').slice(0,32)}

async function providerGet(url:URL){
  let last:unknown=null
  for(let attempt=1;attempt<=3;attempt++){
    try{
      const r=await fetch(url.toString(),{cache:'no-store',headers:{Authorization:key()},signal:AbortSignal.timeout(25000)})
      if(r.ok)return r.json() as Promise<any>
      if(r.status===429||r.status>=500){last=new Error('BALLDONTLIE_HTTP_'+r.status);await sleep(700*attempt);continue}
      throw new Error('BALLDONTLIE_HTTP_'+r.status)
    }catch(e){last=e;if(attempt<3)await sleep(500*attempt)}
  }
  throw last instanceof Error?last:new Error('BALLDONTLIE_REQUEST_FAILED')
}

async function fetchPaged(base:string,date:string,maxPages:number,extra:Record<string,string>={}){
  const rows:any[]=[];let cursor:string|null=null;let pages=0
  do{
    pages++
    if(pages>maxPages)throw new Error('PAGINATION_BOUND_EXCEEDED:'+date)
    const url=new URL(base)
    url.searchParams.append('dates[]',date)
    url.searchParams.set('per_page','100')
    for(const [k,v] of Object.entries(extra))url.searchParams.set(k,v)
    if(cursor)url.searchParams.set('cursor',cursor)
    if(pages>1)await sleep(REQUEST_PAUSE_MS)
    const payload=await providerGet(url)
    if(Array.isArray(payload?.data))rows.push(...payload.data)
    const next=payload?.meta?.next_cursor
    cursor=next===null||next===undefined||String(next)===''?null:String(next)
  }while(cursor)
  return {rows,pages}
}

async function seasonDates(){
  const dates=new Set<string>();const pageSize=1000
  for(let offset=0;;offset+=pageSize){
    const r=await supabaseAdmin.from('mlb_ml_xyear_features_v1')
      .select('game_date').eq('season',SEASON).order('game_date',{ascending:true})
      .range(offset,offset+pageSize-1)
    if(r.error)throw new Error('XYEAR_DATE_READ_FAILED:'+r.error.message)
    const rows=r.data??[]
    for(const row of rows){const d=String(row.game_date??'');if(d)dates.add(d)}
    if(rows.length<pageSize)break
  }
  return [...dates].sort()
}

async function featureGames(date:string){
  const r=await supabaseAdmin.from('mlb_ml_xyear_features_v1')
    .select('canonical_game_id,game_pk,game_date,home_team,away_team,game_number,start_time_local')
    .eq('season',SEASON).eq('game_date',date)
    .order('game_number',{ascending:true}).limit(100)
  if(r.error)throw new Error('XYEAR_GAME_READ_FAILED:'+r.error.message)
  return (r.data??[]) as FeatureGame[]
}

async function completedDates(){
  const r=await supabaseAdmin.from('sports_sync_jobs').select('metadata,completed_at')
    .eq('job_type',JOB_TYPE).eq('sport_key',SPORT_KEY).eq('provider',PROVIDER)
    .eq('season',String(SEASON)).eq('status','completed').order('completed_at',{ascending:false}).limit(1000)
  if(r.error)throw new Error('CHECKPOINT_READ_FAILED:'+r.error.message)
  const out=new Set<string>()
  for(const row of r.data??[]){
    const m=row.metadata&&typeof row.metadata==='object'&&!Array.isArray(row.metadata)?row.metadata as JsonMap:{}
    const d=String(m.targetDate??'')
    if(/^2026-\d{2}-\d{2}$/.test(d))out.add(d)
  }
  return out
}

function groupFeature(rows:FeatureGame[]){
  const m=new Map<string,FeatureGame[]>()
  for(const row of rows){const k=pairKey(row.home_team,row.away_team);const b=m.get(k)??[];b.push(row);m.set(k,b)}
  for(const b of m.values())b.sort((a,b)=>(a.game_number??0)-(b.game_number??0))
  return m
}
function groupProvider(rows:BdlGame[]){
  const out=new Map<string,Map<string,BdlGame[]>>()
  for(const row of rows){
    const gid=finiteInt(row.id),ts=validIso(row.date)
    if(gid===null||!ts||!row.home_team?.abbreviation||!row.away_team?.abbreviation)continue
    const k=pairKey(row.home_team.abbreviation,row.away_team.abbreviation)
    const times=out.get(k)??new Map<string,BdlGame[]>()
    const b=times.get(ts)??[];b.push(row);times.set(ts,b);out.set(k,times)
  }
  return out
}

function mapGames(features:FeatureGame[],providerRows:BdlGame[]){
  const f=groupFeature(features),p=groupProvider(providerRows)
  const byProviderId=new Map<number,{feature:FeatureGame;providerGameIds:number[];providerTimestamp:string;mappingMethod:string}>()
  const anomalies:Array<Record<string,unknown>>=[]
  let mappedCanonicalGames=0
  const allPairs=new Set([...f.keys(),...p.keys()])
  for(const k of allPairs){
    const canonical=f.get(k)??[]
    const groups=[...(p.get(k)?.entries()??[])].sort((a,b)=>Date.parse(a[0])-Date.parse(b[0]))
    if(!canonical.length||!groups.length){
      anomalies.push({pairKey:k,reason:!canonical.length?'NO_XYEAR_PAIR':'NO_PROVIDER_PAIR',xyearGames:canonical.length,providerTimeGroups:groups.length});continue
    }
    if(canonical.length!==groups.length){
      anomalies.push({pairKey:k,reason:'PAIR_GAME_COUNT_MISMATCH',xyearGames:canonical.length,providerTimeGroups:groups.length});continue
    }
    for(let i=0;i<canonical.length;i++){
      const [ts,games]=groups[i]
      const ids=[...new Set(games.map(g=>finiteInt(g.id)).filter((x):x is number=>x!==null))].sort((a,b)=>a-b)
      if(!ids.length)continue
      const mapped={feature:canonical[i],providerGameIds:ids,providerTimestamp:ts,mappingMethod:canonical.length===1?'PAIR_SINGLE':'PAIR_ORDINAL_DATETIME'}
      for(const gid of ids)byProviderId.set(gid,mapped)
      mappedCanonicalGames++
    }
  }
  return {byProviderId,anomalies,mappedCanonicalGames}
}

function normalize(date:string,rows:BdlOpening[],map:ReturnType<typeof mapGames>['byProviderId']){
  const buckets=new Map<string,{mapped:ReturnType<typeof mapGames>['byProviderId'] extends Map<any,infer V>?V:never;vendor:string;rows:BdlOpening[]}>()
  let unmatchedOpeningRows=0
  for(const row of rows){
    const gid=finiteInt(row.game_id),vendor=String(row.vendor??'').trim().toLowerCase()
    if(gid===null||!ALLOWED_VENDORS.has(vendor))continue
    const mapped=map.get(gid)
    if(!mapped){unmatchedOpeningRows++;continue}
    const k=mapped.feature.canonical_game_id+'|'+vendor
    const b=buckets.get(k)??{mapped,vendor,rows:[]};b.rows.push(row);buckets.set(k,b)
  }
  const output:Array<Record<string,unknown>>=[];const blocked:Array<Record<string,unknown>>=[]
  for(const b of buckets.values()){
    const sigs=b.rows.flatMap(row=>{
      const hp=finiteInt(row.moneyline_home_odds),ap=finiteInt(row.moneyline_away_odds)
      if(hp===null||ap===null||hp===0||ap===0)return []
      return [{row,signature:JSON.stringify([hp,ap]),home:hp,away:ap}]
    })
    if(!sigs.length)continue
    const unique=[...new Set(sigs.map(x=>x.signature))]
    if(unique.length!==1){
      blocked.push({canonicalGameId:b.mapped.feature.canonical_game_id,vendor:b.vendor,reason:'DUPLICATE_PROVIDER_GAME_CONFLICT',signatures:unique});continue
    }
    const same=sigs.filter(x=>x.signature===unique[0])
    const opened=same.map(x=>validIso(x.row.opened_at)).filter((x):x is string=>x!==null).sort()
    if(!opened.length){blocked.push({canonicalGameId:b.mapped.feature.canonical_game_id,vendor:b.vendor,reason:'MISSING_OPENED_AT'});continue}
    const providerGameIds=[...new Set(same.map(x=>finiteInt(x.row.game_id)).filter((x):x is number=>x!==null))].sort((a,b)=>a-b)
    const providerOddsIds=[...new Set(same.map(x=>finiteInt(x.row.id)).filter((x):x is number=>x!==null))].sort((a,b)=>a-b)
    for(const item of [{outcome:'home',price:same[0].home},{outcome:'away',price:same[0].away}]){
      output.push({
        id:id([b.mapped.feature.canonical_game_id,b.vendor,item.outcome]),
        season:SEASON,game_date:date,xyear_canonical_game_id:b.mapped.feature.canonical_game_id,
        game_pk:b.mapped.feature.game_pk,home_team:b.mapped.feature.home_team,away_team:b.mapped.feature.away_team,
        game_number:b.mapped.feature.game_number,provider:PROVIDER,vendor:b.vendor,outcome:item.outcome,
        price:item.price,opened_at:opened[0],provider_game_ids:providerGameIds,provider_odds_ids:providerOddsIds,source:SOURCE,
        metadata:{researchOnly:true,externalOnly:true,frozenCandidate:'MLB_ML_OPENING_CONSENSUS_FUNDAMENTALS_V1',mappingMethod:b.mapped.mappingMethod,providerTimestamp:b.mapped.providerTimestamp,providerGameIds,providerOddsIds,historicalOddsApiCalls:0}
      })
    }
  }
  return {rows:output,blockedContracts:blocked,unmatchedOpeningRows}
}

async function existingIds(ids:string[]){
  const out=new Set<string>()
  for(let offset=0;offset<ids.length;offset+=100){
    const r=await supabaseAdmin.from(TARGET_TABLE).select('id').in('id',ids.slice(offset,offset+100))
    if(r.error)throw new Error('EXISTING_READ_FAILED:'+r.error.message)
    for(const row of r.data??[])out.add(String(row.id))
  }
  return out
}

async function recordJob(input:{date:string;status:'completed'|'failed';started:string;completed:string;fetched:number;inserted:number;skipped:number;errorCount:number;lastError:string|null;metadata:JsonMap}){
  const write=await supabaseAdmin.from('sports_sync_jobs').insert({
    id:randomUUID(),job_type:JOB_TYPE,sport_key:SPORT_KEY,league_key:LEAGUE_KEY,provider:PROVIDER,season:String(SEASON),
    started_at:input.started,completed_at:input.completed,status:input.status,records_fetched:input.fetched,
    records_inserted:input.inserted,records_updated:0,records_skipped:input.skipped,error_count:input.errorCount,last_error:input.lastError,
    duration_ms:Math.max(0,Date.parse(input.completed)-Date.parse(input.started)),
    metadata:{source:SOURCE,targetDate:input.date,researchOnly:true,externalOnly:true,officialPicksModified:false,apostarActivated:false,historicalOddsApiCalls:0,...input.metadata},
    created_at:input.completed,updated_at:input.completed
  })
  if(write.error)throw new Error('JOB_WRITE_FAILED:'+write.error.message)
}

async function processDate(date:string){
  const started=new Date().toISOString()
  try{
    const features=await featureGames(date)
    const [games,opening]=await Promise.all([
      fetchPaged('https://api.balldontlie.io/mlb/v1/games',date,MAX_GAMES_PAGES_PER_DATE,{season_type:'regular'}),
      fetchPaged('https://api.balldontlie.io/mlb/v1/odds/opening',date,MAX_OPENING_PAGES_PER_DATE)
    ])
    const mapping=mapGames(features,games.rows as BdlGame[])
    const normalized=normalize(date,opening.rows as BdlOpening[],mapping.byProviderId)
    const existing=await existingIds(normalized.rows.map(r=>String(r.id)))
    const fresh=normalized.rows.filter(r=>!existing.has(String(r.id)))
    for(let offset=0;offset<fresh.length;offset+=500){
      const w=await supabaseAdmin.from(TARGET_TABLE).insert(fresh.slice(offset,offset+500))
      if(w.error)throw new Error('INSERT_FAILED:'+w.error.message)
    }
    const completed=new Date().toISOString()
    await recordJob({date,status:'completed',started,completed,fetched:games.rows.length+opening.rows.length,inserted:fresh.length,skipped:existing.size+normalized.blockedContracts.length+normalized.unmatchedOpeningRows,errorCount:0,lastError:null,metadata:{
      xyearGames:features.length,providerGames:games.rows.length,openingRows:opening.rows.length,providerCallsMade:games.pages+opening.pages,
      mappedCanonicalGames:mapping.mappedCanonicalGames,mappingAnomalies:mapping.anomalies,normalizedRows:normalized.rows.length,
      existingRows:existing.size,blockedContracts:normalized.blockedContracts,unmatchedOpeningRows:normalized.unmatchedOpeningRows
    }})
    return {date,success:true,xyearGames:features.length,providerGames:games.rows.length,openingRows:opening.rows.length,providerCallsMade:games.pages+opening.pages,mappedCanonicalGames:mapping.mappedCanonicalGames,insertedRows:fresh.length,reusedRows:existing.size,blockedContractCount:normalized.blockedContracts.length}
  }catch(e){
    const completed=new Date().toISOString(),message=e instanceof Error?e.message:'UNKNOWN_EXTERNAL_BACKFILL_ERROR'
    await recordJob({date,status:'failed',started,completed,fetched:0,inserted:0,skipped:0,errorCount:1,lastError:message,metadata:{error:message}})
    return {date,success:false,error:message}
  }
}

export async function runMlbBdlOpeningMl2026ExternalBatch(){
  const base={success:true,researchOnly:true,externalOnly:true,productionEligible:false,officialPicksModified:false,apostarActivated:false,historicalOddsApiCalls:0,provider:PROVIDER,targetTable:TARGET_TABLE,maxDatesPerBatch:MAX_DATES_PER_BATCH}
  if(!key())return {...base,success:false,status:'BLOCKED_MISSING_BALLDONTLIE_API_KEY',done:false}
  const [dates,completed]=await Promise.all([seasonDates(),completedDates()])
  const pending=dates.filter(d=>!completed.has(d))
  if(!pending.length){
    const count=await supabaseAdmin.from(TARGET_TABLE).select('id',{count:'exact',head:true})
    if(count.error)throw new Error('FINAL_COUNT_FAILED:'+count.error.message)
    return {...base,status:'EXTERNAL_BACKFILL_COMPLETE',done:true,totalDates:dates.length,completedDates:completed.size,remainingDates:0,storedRows:count.count??null,processedDates:0}
  }
  const batch=pending.slice(0,MAX_DATES_PER_BATCH),results=[]
  for(const date of batch){results.push(await processDate(date));await sleep(REQUEST_PAUSE_MS)}
  const after=await completedDates()
  const remaining=dates.filter(d=>!after.has(d)).length
  return {...base,status:remaining===0?'EXTERNAL_BACKFILL_COMPLETE':'EXTERNAL_BACKFILL_BATCH_COMPLETE',done:remaining===0,totalDates:dates.length,completedDates:after.size,remainingDates:remaining,processedDates:results.length,insertedRows:results.reduce((s:any,r:any)=>s+Number(r.insertedRows??0),0),providerCallsMade:results.reduce((s:any,r:any)=>s+Number(r.providerCallsMade??0),0),failedDates:results.filter((r:any)=>!r.success).map((r:any)=>r.date),dates:results}
}
