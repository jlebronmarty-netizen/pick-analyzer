#!/usr/bin/env node
import fs from 'node:fs'

const input=JSON.parse(fs.readFileSync('artifacts/research/mlb_hrrbi_u1p5_forward_targets_20260925.json','utf8'))
const TARGET_DATE=input.tracking_date
const MIN_GAMES=10
const THRESHOLD=0.90
const CONCURRENCY=8

const finite=(v)=>{const n=Number(v);return Number.isFinite(n)?n:null}

async function fetchLog(playerId){
  const url=new URL(`https://statsapi.mlb.com/api/v1/people/${playerId}/stats`)
  url.searchParams.set('stats','gameLog')
  url.searchParams.set('group','hitting')
  url.searchParams.set('season','2026')
  const res=await fetch(url,{signal:AbortSignal.timeout(15000)})
  if(!res.ok) throw new Error(`MLB_OFFICIAL_HTTP_${res.status}`)
  const payload=await res.json()
  const splits=(payload?.stats??[]).flatMap((b)=>Array.isArray(b?.splits)?b.splits:[])
  return splits.flatMap((s)=>{
    const gamePk=finite(s?.game?.gamePk)
    const date=typeof s?.date==='string'?s.date.slice(0,10):''
    if(!gamePk||!date) return []
    return [{
      gamePk,date,
      plateAppearances:finite(s?.stat?.plateAppearances)??0,
      hits:finite(s?.stat?.hits)??0,
      runs:finite(s?.stat?.runs)??0,
      rbi:finite(s?.stat?.rbi)??0,
    }]
  }).filter((r)=>r.date<TARGET_DATE)
    .sort((a,b)=>a.date.localeCompare(b.date)||a.gamePk-b.gamePk)
}

function projection(rows){
  if(rows.length<MIN_GAMES) return null
  const recent=rows.slice(-10)
  const priorPa=rows.reduce((s,r)=>s+r.plateAppearances,0)
  if(priorPa<=0) return null
  const recentPaPerGame=recent.reduce((s,r)=>s+r.plateAppearances,0)/recent.length
  const component=(key)=>{
    const priorY=rows.reduce((s,r)=>s+r[key],0)
    const recentPerGame=recent.reduce((s,r)=>s+r[key],0)/recent.length
    const priorRate=priorY/priorPa
    return {priorY,priorRate,recentPerGame,projected:0.50*(priorRate*recentPaPerGame)+0.50*recentPerGame}
  }
  const hits=component('hits'),runs=component('runs'),rbi=component('rbi')
  return {
    projection:hits.projected+runs.projected+rbi.projected,
    priorGames:rows.length,priorPa,recentPaPerGame,
    latestPriorDate:rows.at(-1)?.date??null,
    latestPriorGamePk:rows.at(-1)?.gamePk??null,
    hits,runs,rbi
  }
}

async function mapConcurrent(items,limit,fn){
  const out=new Array(items.length);let next=0
  async function worker(){
    for(;;){
      const i=next++
      if(i>=items.length)return
      out[i]=await fn(items[i],i)
    }
  }
  await Promise.all(Array.from({length:Math.min(limit,items.length)},worker))
  return out
}

const uniqueIds=[...new Set(input.targets.map((t)=>Number(t.player_id)))]
const logs=await mapConcurrent(uniqueIds,CONCURRENCY,async(id)=>{
  try{return {id,rows:await fetchLog(id),error:null}}
  catch(e){return {id,rows:[],error:e instanceof Error?e.message:String(e)}}
})
const byId=new Map(logs.map((x)=>[x.id,x]))
const evaluated=input.targets.map((t)=>{
  const item=byId.get(Number(t.player_id))
  if(!item||item.error){
    return {...t,evaluable:false,qualifies:false,projection:null,blocker:item?.error??'MISSING_LOG'}
  }
  const p=projection(item.rows)
  if(!p){
    return {...t,evaluable:false,qualifies:false,projection:null,blocker:'MINIMUM_10_STRICT_PRIOR_GAMES_NOT_MET'}
  }
  return {
    ...t,evaluable:true,qualifies:p.projection<=THRESHOLD,
    projection:p.projection,blocker:null,
    prior_games:p.priorGames,prior_pa:p.priorPa,recent_pa_per_game:p.recentPaPerGame,
    latest_prior_date:p.latestPriorDate,latest_prior_game_pk:p.latestPriorGamePk,
    component_projection:{hits:p.hits,runs:p.runs,rbi:p.rbi}
  }
})
const candidates=evaluated.filter((x)=>x.qualifies)
const blocked=evaluated.filter((x)=>!x.evaluable)

const result={
  contract:input.contract,
  research_only:true,
  production_eligible:false,
  official_picks_eligible:false,
  apostar_enabled:false,
  target_date:TARGET_DATE,
  market:input.exact_market,
  exact_line:input.exact_line,
  side:input.side,
  frozen_projection_max:THRESHOLD,
  formula:'component=0.50*(prior_event_per_PA*L10_PA_per_game)+0.50*L10_event_per_game; HRRBI=sum(hits,runs,rbi)',
  strict_prior_rule:'game_date < target_date',
  same_date_history_allowed:false,
  target_count:evaluated.length,
  evaluable_count:evaluated.filter((x)=>x.evaluable).length,
  blocked_count:blocked.length,
  candidate_count:candidates.length,
  candidates,
  blockers:blocked.map((x)=>({game_pk:x.game_pk,player_id:x.player_id,player_name:x.player_name,blocker:x.blocker})),
  price_policy:{collect_price:true,calculate_ev:false,reason:'forward-only candidate has no calibrated per-play probability'},
  boundaries:{no_threshold_retune:true,no_line_extrapolation:true,no_fuzzy_identity:true,no_historical_odds_api_spend:true}
}
fs.writeFileSync('/tmp/mlb_hrrbi_u1p5_forward_20260925.json',JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify({
  target_count:result.target_count,
  evaluable_count:result.evaluable_count,
  blocked_count:result.blocked_count,
  candidate_count:result.candidate_count,
  candidates:candidates.map((x)=>({
    game_pk:x.game_pk,player_id:x.player_id,player_name:x.player_name,
    projection:Number(x.projection.toFixed(6)),sportsbook:x.sportsbook,price:x.price,
    latest_prior_date:x.latest_prior_date
  }))
},null,2))
