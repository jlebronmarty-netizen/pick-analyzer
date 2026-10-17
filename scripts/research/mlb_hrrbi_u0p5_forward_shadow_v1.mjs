#!/usr/bin/env node
import fs from 'node:fs'
const input=JSON.parse(fs.readFileSync('artifacts/research/mlb_hrrbi_u0p5_forward_targets_20260925.json','utf8'))
const TARGET_DATE=input.tracking_date, THRESHOLD=0.05, MIN_GAMES=10
const finite=(v)=>{const n=Number(v);return Number.isFinite(n)?n:null}
async function fetchLog(id){
  const u=new URL(`https://statsapi.mlb.com/api/v1/people/${id}/stats`)
  u.searchParams.set('stats','gameLog');u.searchParams.set('group','hitting');u.searchParams.set('season','2026')
  const r=await fetch(u,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error(`MLB_OFFICIAL_HTTP_${r.status}`)
  const p=await r.json();const s=(p?.stats??[]).flatMap((b)=>Array.isArray(b?.splits)?b.splits:[])
  return s.flatMap((x)=>{const pk=finite(x?.game?.gamePk),date=typeof x?.date==='string'?x.date.slice(0,10):'';if(!pk||!date)return[]
    return [{gamePk:pk,date,plateAppearances:finite(x?.stat?.plateAppearances)??0,hits:finite(x?.stat?.hits)??0,runs:finite(x?.stat?.runs)??0,rbi:finite(x?.stat?.rbi)??0}]
  }).filter((x)=>x.date<TARGET_DATE).sort((a,b)=>a.date.localeCompare(b.date)||a.gamePk-b.gamePk)
}
function score(rows){
  if(rows.length<MIN_GAMES)return null
  const recent=rows.slice(-10),pa=rows.reduce((s,r)=>s+r.plateAppearances,0);if(pa<=0)return null
  const l10pa=recent.reduce((s,r)=>s+r.plateAppearances,0)/recent.length
  const comp=(k)=>{const y=rows.reduce((s,r)=>s+r[k],0),l10=recent.reduce((s,r)=>s+r[k],0)/recent.length,rate=y/pa
    return {priorY:y,priorRate:rate,recentPerGame:l10,projected:0.5*(rate*l10pa)+0.5*l10}}
  const h=comp('hits'),r=comp('runs'),b=comp('rbi')
  return {projection:h.projected+r.projected+b.projected,priorGames:rows.length,priorPa:pa,recentPaPerGame:l10pa,latestPriorDate:rows.at(-1)?.date??null,latestPriorGamePk:rows.at(-1)?.gamePk??null,components:{hits:h,runs:r,rbi:b}}
}
async function mapLimit(items,limit,fn){const out=new Array(items.length);let next=0;async function w(){for(;;){const i=next++;if(i>=items.length)return;out[i]=await fn(items[i])}}await Promise.all(Array.from({length:Math.min(limit,items.length)},w));return out}
const ids=[...new Set(input.targets.map((x)=>Number(x.player_id)))]
const logs=await mapLimit(ids,8,async(id)=>{try{return{id,rows:await fetchLog(id),error:null}}catch(e){return{id,rows:[],error:e instanceof Error?e.message:String(e)}}})
const by=new Map(logs.map(x=>[x.id,x]))
const evaluated=input.targets.map((t)=>{const l=by.get(Number(t.player_id));if(!l||l.error)return{...t,evaluable:false,qualifies:false,projection:null,blocker:l?.error??'MISSING_LOG'}
  const s=score(l.rows);if(!s)return{...t,evaluable:false,qualifies:false,projection:null,blocker:'MINIMUM_10_STRICT_PRIOR_GAMES_NOT_MET'}
  return{...t,evaluable:true,qualifies:s.projection<=THRESHOLD,projection:s.projection,blocker:null,prior_games:s.priorGames,prior_pa:s.priorPa,recent_pa_per_game:s.recentPaPerGame,latest_prior_date:s.latestPriorDate,latest_prior_game_pk:s.latestPriorGamePk,component_projection:s.components}}
)
const candidates=evaluated.filter(x=>x.qualifies), blocked=evaluated.filter(x=>!x.evaluable)
const result={contract:input.contract,research_only:true,production_eligible:false,official_picks_eligible:false,apostar_enabled:false,target_date:TARGET_DATE,market:input.exact_market,exact_line:0.5,side:'UNDER',frozen_projection_max:THRESHOLD,strict_prior_rule:'game_date < target_date',same_date_history_allowed:false,target_count:evaluated.length,evaluable_count:evaluated.filter(x=>x.evaluable).length,blocked_count:blocked.length,candidate_count:candidates.length,candidates,blockers:blocked.map(x=>({game_pk:x.game_pk,player_id:x.player_id,player_name:x.player_name,blocker:x.blocker})),price_policy:{collect_price:true,calculate_ev:false,reason:'forward-only candidate has no calibrated per-play probability'},boundaries:{no_threshold_retune:true,no_line_extrapolation:true,no_fuzzy_identity:true,no_historical_odds_api_spend:true}}
fs.writeFileSync('/tmp/mlb_hrrbi_u0p5_forward_20260925.json',JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify({target_count:result.target_count,evaluable_count:result.evaluable_count,blocked_count:result.blocked_count,candidate_count:result.candidate_count,candidates:candidates.map(x=>({game_pk:x.game_pk,player_id:x.player_id,player_name:x.player_name,projection:Number(x.projection.toFixed(6)),sportsbook:x.sportsbook,price:x.price,latest_prior_date:x.latest_prior_date}))},null,2))
