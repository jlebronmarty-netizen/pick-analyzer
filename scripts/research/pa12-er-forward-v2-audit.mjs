#!/usr/bin/env node

const EXPECTED_BRANCH='research/pa12-er-forward-shadow-v2-audit-20260918'
if(process.env.VERCEL!=='1'||process.env.VERCEL_ENV!=='preview'||process.env.VERCEL_GIT_COMMIT_REF!==EXPECTED_BRANCH){
  console.log(JSON.stringify({status:'PA12_ER_FORWARD_V2_AUDIT_SKIPPED'}))
  process.exit(0)
}

const { supabaseAdmin } = await import('../../src/lib/supabase-admin.ts')

const TARGET_DATE='2026-09-18'
const MODEL={
  version:'MLB_PITCHER_ER_PA12_FORWARD_SHADOW_V2',
  inheritedFrozenMathFrom:'MLB_PITCHER_ER_PA12_RESEARCH_V1',
  baseIntercept:1.90273530551357,
  baseSlope:0.227085168912444,
  kResidualIntercept:0.653408289475204,
  kResidualSlope:-3.0156054216154,
  minimumPriorStarts:3,
}

const paritySample=[
  [778452,593958,4],[778389,656605,0],[778204,608372,3],[778129,676440,1],
  [777989,686613,0],[777943,656605,2],[777702,666200,12],[777713,693433,3],
  [777370,668678,5],[777544,647336,4],[777311,434378,1],[777474,641927,4],
  [777251,688138,0],[777182,681857,2],[777286,669358,3],[777017,684007,7],
  [776824,622491,2],[776566,690997,0],[776661,605135,2],[776544,607074,1],
  [776474,676282,1],[776183,641816,1],[776225,676282,1],[776287,571510,4],
]

function n(v){const x=Number(v);return Number.isFinite(x)?x:null}
function dateOnly(v){return typeof v==='string'?v.slice(0,10):''}
async function mapConcurrent(values,limit,fn){
  const output=new Array(values.length)
  let next=0
  async function worker(){
    for(;;){
      const index=next++
      if(index>=values.length)return
      output[index]=await fn(values[index],index)
    }
  }
  await Promise.all(Array.from({length:Math.min(limit,values.length)},()=>worker()))
  return output
}

async function mlbGameLog(pitcherId,season){
  const url=new URL(`https://statsapi.mlb.com/api/v1/people/${pitcherId}/stats`)
  url.searchParams.set('stats','gameLog')
  url.searchParams.set('group','pitching')
  url.searchParams.set('season',String(season))
  const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000)})
  if(!response.ok) throw new Error(`MLB_GAMELOG_HTTP_${response.status}:${pitcherId}:${season}`)
  const payload=await response.json()
  const blocks=Array.isArray(payload?.stats)?payload.stats:[]
  const splits=blocks.flatMap(block=>Array.isArray(block?.splits)?block.splits:[])
  return splits.map(split=>({
    gamePk:n(split?.game?.gamePk),
    date:dateOnly(split?.date),
    gamesStarted:n(split?.stat?.gamesStarted)??0,
    earnedRuns:n(split?.stat?.earnedRuns),
    strikeOuts:n(split?.stat?.strikeOuts),
    battersFaced:n(split?.stat?.battersFaced),
  })).filter(row=>row.gamePk&&row.date)
}

const cache=new Map()
async function cachedLog(pitcherId,season){
  const key=`${pitcherId}:${season}`
  if(!cache.has(key)) cache.set(key,await mlbGameLog(pitcherId,season))
  return cache.get(key)
}

// 1) Independent source parity against frozen Retrosheet sample.
const parity=await mapConcurrent(paritySample,8,async ([gamePk,pitcherId,retrosheetEr])=>{
  try{
    const log=await cachedLog(pitcherId,2025)
    const row=log.find(x=>x.gamePk===gamePk)
    return {
      gamePk,pitcherId,retrosheetEr,
      mlbOfficialEr:row?.earnedRuns??null,
      gamesStarted:row?.gamesStarted??null,
      exactMatch:Boolean(row&&row.earnedRuns===retrosheetEr&&row.gamesStarted>0),
    }
  }catch(error){
    return {gamePk,pitcherId,retrosheetEr,mlbOfficialEr:null,gamesStarted:null,exactMatch:false,error:error instanceof Error?error.message:String(error)}
  }
})

// 2) Exact forward target population comes only from certified PA13 pregame rows.
const {data:quoteRows,error:quoteError}=await supabaseAdmin
  .from('sports_odds_snapshots')
  .select('event_id,metadata')
  .eq('provider','the-odds-api')
  .eq('market','pitcher_earned_runs')
  .eq('metadata->>source','PA13_PITCHER_ER_FORWARD_CAPTURE_V1')
  .gte('snapshot_time','2026-09-18T00:00:00Z')
if(quoteError) throw new Error(`PA12_V2_QUOTE_SCOPE_READ_FAILED:${quoteError.message}`)

const targetMap=new Map()
for(const row of quoteRows??[]){
  const metadata=row.metadata&&typeof row.metadata==='object'?row.metadata:{}
  const pitcherId=n(metadata.pitcherMlbamId)
  const gamePk=n(metadata.canonicalGamePk)
  const targetStart=typeof metadata.targetStart==='string'?metadata.targetStart:null
  const pitcherName=typeof metadata.pitcherName==='string'?metadata.pitcherName:null
  if(!pitcherId||!gamePk||!targetStart) continue
  targetMap.set(`${gamePk}:${pitcherId}`,{gamePk,pitcherId,pitcherName,targetStart,eventId:row.event_id})
}
const targets=[...targetMap.values()].sort((a,b)=>a.gamePk-b.gamePk||a.pitcherId-b.pitcherId)
const ids=[...new Set(targets.map(x=>x.pitcherId))]
await mapConcurrent(ids,8,async pitcherId=>cachedLog(pitcherId,2026))

const {data:kRows,error:kError}=await supabaseAdmin
 .from('mlb_ml_xyear_pitcher_game_v1')
 .select('game_pk,game_date,pitcher,starter,strikeouts,batters_faced')
 .eq('season',2026)
 .lt('game_date',TARGET_DATE)
 .in('pitcher',ids)
 .order('game_date',{ascending:true})
if(kError) throw new Error(`PA12_V2_K_HISTORY_READ_FAILED:${kError.message}`)

const kByPitcher=new Map()
for(const row of kRows??[]){
  const pid=n(row.pitcher),k=n(row.strikeouts),bf=n(row.batters_faced)
  if(!pid||k===null||bf===null) continue
  const agg=kByPitcher.get(pid)??{k:0,bf:0,appearances:0}
  agg.k+=k;agg.bf+=bf;agg.appearances+=1
  kByPitcher.set(pid,agg)
}

const predictions=[]
for(const target of targets){
  try{
    const log=(await cachedLog(target.pitcherId,2026))
      .filter(row=>row.date<TARGET_DATE&&row.gamesStarted>0&&row.earnedRuns!==null)
      .sort((a,b)=>a.date.localeCompare(b.date)||a.gamePk-b.gamePk)
    const kAgg=kByPitcher.get(target.pitcherId)??{k:0,bf:0,appearances:0}
    const priorStarts=log.length
    const priorErAll=priorStarts?log.reduce((sum,row)=>sum+row.earnedRuns,0)/priorStarts:null
    const kRate=kAgg.bf>0?kAgg.k/kAgg.bf:null
    const eligible=priorStarts>=MODEL.minimumPriorStarts&&priorErAll!==null&&kRate!==null
    const predictedEr=eligible
      ? MODEL.baseIntercept+MODEL.baseSlope*priorErAll+MODEL.kResidualIntercept+MODEL.kResidualSlope*kRate
      : null
    predictions.push({
      ...target,
      eligible,
      priorStarts,
      priorErAll,
      kRate,
      priorAllAppearances:kAgg.appearances,
      priorK:kAgg.k,
      priorBF:kAgg.bf,
      predictedEr,
      reason:eligible?null:priorStarts<MODEL.minimumPriorStarts?'SHORT_ER_START_HISTORY':kRate===null?'MISSING_K_RATE':'MISSING_ER_HISTORY',
      maxPriorStartDate:log.at(-1)?.date??null,
      maxPriorStartGamePk:log.at(-1)?.gamePk??null,
    })
  }catch(error){
    predictions.push({...target,eligible:false,priorStarts:0,priorErAll:null,kRate:null,predictedEr:null,reason:'MLB_OFFICIAL_GAMELOG_READ_FAILED',error:error instanceof Error?error.message:String(error)})
  }
}

const parityExact=parity.filter(x=>x.exactMatch).length
const eligible=predictions.filter(x=>x.eligible)
console.log('PA12_ER_FORWARD_V2_AUDIT='+JSON.stringify({
  status:'COMPLETE',
  model:MODEL,
  sourceParity:{
    sampleRows:parity.length,
    exactMatches:parityExact,
    mismatches:parity.filter(x=>!x.exactMatch),
  },
  forward:{
    targetDate:TARGET_DATE,
    targetRows:predictions.length,
    eligibleRows:eligible.length,
    blockedRows:predictions.length-eligible.length,
    predictions,
  },
  boundaries:{
    researchOnly:true,
    shadowOnly:true,
    productionEligible:false,
    probabilityLayerAuthorized:false,
    sportsbookInputToModel:false,
    officialPicksModified:false,
    apostarActivated:false,
    supabaseWrites:0,
    oddsApiCalls:0,
    modelRetuned:false,
  }
}))
