import { createClient } from '@supabase/supabase-js'
import { evaluateMoneylineHighConfidenceHomeV2, normalizedComponentScore, normalizeMlbModelTeam } from '../../src/lib/mlb-moneyline-high-confidence-v2.ts'

if (process.env.VERCEL_ENV !== 'preview') {
  console.log(JSON.stringify({ status: 'ML_MONEYLINE_DRYRUN_SKIPPED_NON_PREVIEW' }))
  process.exit(0)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('ML_DRYRUN_DB_ENV_MISSING')
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const date = '2026-09-16'
const teamById = {108:'LAA',109:'ARI',110:'BAL',111:'BOS',112:'CHC',113:'CIN',114:'CLE',115:'COL',116:'DET',117:'HOU',118:'KC',119:'LAD',120:'WSH',121:'NYM',133:'ATH',134:'PIT',135:'SD',136:'SEA',137:'SF',138:'STL',139:'TB',140:'TEX',141:'TOR',142:'MIN',143:'PHI',144:'ATL',145:'CHW',146:'MIA',147:'NYY',158:'MIL'}
const starterFeatures = [
 ['home_sp_ra9',-1],['home_sp_whip',-1],['home_sp_k_pct',1],['home_sp_bb_pct',-1],['home_sp_whiff_rate',1],['home_sp_hard_hit_pct',-1],['home_sp_l5_ra9',-1],['home_sp_l5_whip',-1],
 ['away_sp_ra9',1],['away_sp_whip',1],['away_sp_k_pct',-1],['away_sp_bb_pct',1],['away_sp_whiff_rate',-1],['away_sp_hard_hit_pct',1],['away_sp_l5_ra9',1],['away_sp_l5_whip',1],
]
const scheduleResponse = await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}&hydrate=probablePitcher`)
if (!scheduleResponse.ok) throw new Error(`ML_DRYRUN_SCHEDULE_HTTP_${scheduleResponse.status}`)
const schedule = await scheduleResponse.json()
const games = (schedule.dates ?? []).flatMap(d=>d.games ?? []).filter(g=>g.gameType==='R').map(g=>({
  gamePk:Number(g.gamePk),startTime:g.gameDate,home:teamById[Number(g.teams?.home?.team?.id)],away:teamById[Number(g.teams?.away?.team?.id)],
  hp:Number(g.teams?.home?.probablePitcher?.id)||null,ap:Number(g.teams?.away?.probablePitcher?.id)||null,
  hpName:g.teams?.home?.probablePitcher?.fullName??null,apName:g.teams?.away?.probablePitcher?.fullName??null,
})).sort((a,b)=>Date.parse(a.startTime)-Date.parse(b.startTime))
if (games.length !== 15) throw new Error(`ML_DRYRUN_SLATE_COUNT_${games.length}`)

const [{data:priorRows,error:priorError},{data:featureRows,error:featureError},{data:componentRows,error:componentError},{data:existing,error:existingError}] = await Promise.all([
 db.from('mlb_ml_prior2025_team_v1').select('team,team_prior_score'),
 db.from('mlb_ml_xyear_feature_stats_v1').select('feature_name,mean_value,sd_value').eq('branch','PREGAME').in('feature_name',starterFeatures.map(x=>x[0])),
 db.from('mlb_ml_xyear_component_stats_v1').select('component,mean_score,sd_score').eq('branch','PREGAME').eq('component','starter'),
 db.from('mlb_ml_forward_tracker_v1').select('home_team,away_team,pick_status,route_details').eq('tracking_date',date).eq('model_version','pregame_high_conf_home_v2'),
])
if (priorError||featureError||componentError||existingError) throw new Error(`ML_DRYRUN_DB_READ:${priorError?.message??featureError?.message??componentError?.message??existingError?.message}`)
const priors = new Map((priorRows??[]).map(r=>[String(r.team),Number(r.team_prior_score)]))
const featureStats = new Map((featureRows??[]).map(r=>[String(r.feature_name),{mean:Number(r.mean_value),sd:Number(r.sd_value)}]))
const c = componentRows?.[0]
const componentStat = c ? {mean:Number(c.mean_score),sd:Number(c.sd_score)} : null
const deep = games.filter(g=>{
 const h=priors.get(normalizeMlbModelTeam(g.home)),a=priors.get(normalizeMlbModelTeam(g.away));return Number.isFinite(h)&&Number.isFinite(a)&&(h-a)>=1.2
})
const pitcherIds=[...new Set(deep.flatMap(g=>[g.hp,g.ap]).filter(Boolean))]
const {data:pitcherRows,error:pitcherError}=await db.from('mlb_ml_xyear_pitcher_game_v1').select('game_pk,game_date,pitcher,team,opponent,outs,batters_faced,hits,walks,strikeouts,runs,swings,whiffs,batted_balls,hard_hits').eq('season',2026).lt('game_date',date).eq('starter',true).in('pitcher',pitcherIds).order('game_date',{ascending:false}).order('game_pk',{ascending:false})
if (pitcherError) throw new Error(`ML_DRYRUN_PITCHER_READ:${pitcherError.message}`)
const ratio=(a,b)=>b>0?a/b:null
function summary(id){const s=(pitcherRows??[]).filter(r=>Number(r.pitcher)===id);if(!s.length)return null;const agg=rows=>{const outs=rows.reduce((x,r)=>x+(Number(r.outs)||0),0),ip=outs/3,h=rows.reduce((x,r)=>x+(Number(r.hits)||0),0),w=rows.reduce((x,r)=>x+(Number(r.walks)||0),0),so=rows.reduce((x,r)=>x+(Number(r.strikeouts)||0),0),runs=rows.reduce((x,r)=>x+(Number(r.runs)||0),0),bf=rows.reduce((x,r)=>x+(Number(r.batters_faced)||0),0),sw=rows.reduce((x,r)=>x+(Number(r.swings)||0),0),wh=rows.reduce((x,r)=>x+(Number(r.whiffs)||0),0),bb=rows.reduce((x,r)=>x+(Number(r.batted_balls)||0),0),hh=rows.reduce((x,r)=>x+(Number(r.hard_hits)||0),0);return{ra9:ip>0?9*runs/ip:null,whip:ip>0?(h+w)/ip:null,k:ratio(so,bf),walk:ratio(w,bf),whiff:ratio(wh,sw),hard:ratio(hh,bb)}};return{season:agg(s),l5:agg(s.slice(0,5))}}
function starterScore(g){const h=summary(g.hp),a=summary(g.ap),raw={home_sp_ra9:h?.season.ra9??null,home_sp_whip:h?.season.whip??null,home_sp_k_pct:h?.season.k??null,home_sp_bb_pct:h?.season.walk??null,home_sp_whiff_rate:h?.season.whiff??null,home_sp_hard_hit_pct:h?.season.hard??null,home_sp_l5_ra9:h?.l5.ra9??null,home_sp_l5_whip:h?.l5.whip??null,away_sp_ra9:a?.season.ra9??null,away_sp_whip:a?.season.whip??null,away_sp_k_pct:a?.season.k??null,away_sp_bb_pct:a?.season.walk??null,away_sp_whiff_rate:a?.season.whiff??null,away_sp_hard_hit_pct:a?.season.hard??null,away_sp_l5_ra9:a?.l5.ra9??null,away_sp_l5_whip:a?.l5.whip??null};return normalizedComponentScore(starterFeatures.map(([featureName,direction])=>({featureName,direction,value:raw[featureName]})),featureStats,componentStat)}
const calculated=games.map(g=>{const h=priors.get(normalizeMlbModelTeam(g.home)),a=priors.get(normalizeMlbModelTeam(g.away)),prior=Number.isFinite(h)&&Number.isFinite(a)?h-a:null;const starter=prior!==null&&prior>=1.2?starterScore(g):null;const decision=evaluateMoneylineHighConfidenceHomeV2({teamPrior2025:prior,starter,recentForm:null,history:null,lineupMatchup:null});return{...g,prior,starter,pick:decision.pickStatus,reason:decision.reason}})
const mismatches=[]
for(const row of calculated){const old=(existing??[]).find(x=>x.home_team===row.home&&x.away_team===row.away);const oldReason=old?.route_details?.reason??null;if(!old||old.pick_status!==row.pick||oldReason!==row.reason)mismatches.push({home:row.home,away:row.away,newPick:row.pick,newReason:row.reason,oldPick:old?.pick_status??null,oldReason})}
const output={status:mismatches.length?'ML_MONEYLINE_DRYRUN_PARITY_FAIL':'ML_MONEYLINE_DRYRUN_PARITY_PASS',games:calculated.length,existing:(existing??[]).length,picks:calculated.filter(x=>x.pick==='PICK').length,mismatches,deepCandidates:calculated.filter(x=>x.prior!==null&&x.prior>=1.2).map(x=>({gamePk:x.gamePk,away:x.away,home:x.home,awayProbable:x.apName,homeProbable:x.hpName,teamPrior:x.prior,starterScore:x.starter,reason:x.reason}))}
console.log(`ML_MONEYLINE_DRYRUN_EVIDENCE=${JSON.stringify(output)}`)
if(mismatches.length) process.exit(1)
