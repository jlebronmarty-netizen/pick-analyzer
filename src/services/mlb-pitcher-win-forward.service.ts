import 'server-only'

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  applyNumericCatBoostProbability,
  type NumericCatBoostModel,
} from '@/lib/catboost-oblivious-numeric'
import model0Json from '../../python_models/pitcher_win_forward_numeric_model_0.json'
import model1Json from '../../python_models/pitcher_win_forward_numeric_model_1.json'

const TIME_ZONE='America/Puerto_Rico'
const SEASON=2026
const FORWARD_MIN_DATE='2026-09-20'
const FREEZE_START_MINUTE=10*60+45
const FREEZE_END_MINUTE=11*60
const THRESHOLD=0.15
const FREEZE_JOB_TYPE='pitcher_win_forward_numeric_v1_freeze'
const SETTLEMENT_JOB_TYPE='pitcher_win_forward_numeric_v1_settlement'
const PROVIDER='internal-model'
const CANDIDATE_ID='pitcher_win_forward_numeric_p015_v1'
const MODEL0=model0Json as NumericCatBoostModel
const MODEL1=model1Json as NumericCatBoostModel

const MLB_TEAM_BY_ID:Record<number,string>={
  108:'LAA',109:'ARI',110:'BAL',111:'BOS',112:'CHC',113:'CIN',114:'CLE',115:'COL',116:'DET',117:'HOU',
  118:'KC',119:'LAD',120:'WSH',121:'NYM',133:'ATH',134:'PIT',135:'SD',136:'SEA',137:'SF',138:'STL',
  139:'TB',140:'TEX',141:'TOR',142:'MIN',143:'PHI',144:'ATL',145:'CHW',146:'MIA',147:'NYY',158:'MIL',
}

type SlateGame={
  gamePk:number
  startTime:string
  homeTeam:string
  awayTeam:string
  homePitcherId:number|null
  awayPitcherId:number|null
  homePitcherName:string|null
  awayPitcherName:string|null
  gameNumber:number
  doubleheader:boolean
}

type TeamHistory={
  game_pk:number
  game_date:string
  team:string
  opponent:string
  runs_for:number
  runs_against:number
  win:number
}

type StarterHistory={
  game_pk:number
  game_date:string
  starter_side:'home'|'away'
  starter_mlbam_id:number
  y_win:number|null
}

function normalizeTeam(team:string){
  if(team==='CHW') return 'CWS'
  if(team==='ARI') return 'AZ'
  return team
}

function dateInTimeZone(date:Date){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date)
  const v=Object.fromEntries(parts.filter(p=>p.type!=='literal').map(p=>[p.type,p.value]))
  return `${v.year}-${v.month}-${v.day}`
}

function minuteOfDay(date:Date){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:TIME_ZONE,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date)
  const v=Object.fromEntries(parts.filter(p=>p.type!=='literal').map(p=>[p.type,p.value]))
  return Number(v.hour)*60+Number(v.minute)
}

function daysBetween(a:string,b:string){
  return Math.floor((Date.parse(`${b}T00:00:00Z`)-Date.parse(`${a}T00:00:00Z`))/86400000)
}

function finiteOrNaN(value:unknown){
  const n=Number(value)
  return Number.isFinite(n)?n:Number.NaN
}

async function officialSlate(date:string):Promise<SlateGame[]>{
  const params=new URLSearchParams({sportId:'1',date,hydrate:'probablePitcher'})
  const response=await fetch('https://statsapi.mlb.com/api/v1/schedule?'+params.toString(),{cache:'no-store'})
  if(!response.ok) throw new Error(`PITCHER_WIN_SCHEDULE_HTTP_${response.status}`)
  const json=await response.json() as any
  const games=(json?.dates??[]).flatMap((d:any)=>Array.isArray(d?.games)?d.games:[])
  const out:SlateGame[]=[]
  for(const game of games){
    const gamePk=Number(game?.gamePk)
    const type=String(game?.gameType??'')
    const detailed=String(game?.status?.detailedState??'').toLowerCase()
    if(!Number.isSafeInteger(gamePk)||gamePk<=0||(type&&type!=='R')) continue
    if(detailed.includes('postpon')||detailed.includes('cancel')) continue
    const homeRaw=MLB_TEAM_BY_ID[Number(game?.teams?.home?.team?.id)]
    const awayRaw=MLB_TEAM_BY_ID[Number(game?.teams?.away?.team?.id)]
    const startTime=String(game?.gameDate??'')
    if(!homeRaw||!awayRaw||!Number.isFinite(Date.parse(startTime))) throw new Error(`PITCHER_WIN_SCHEDULE_IDENTITY:${gamePk}`)
    const hp=game?.teams?.home?.probablePitcher
    const ap=game?.teams?.away?.probablePitcher
    out.push({
      gamePk,startTime,
      homeTeam:normalizeTeam(homeRaw),awayTeam:normalizeTeam(awayRaw),
      homePitcherId:Number.isSafeInteger(Number(hp?.id))?Number(hp.id):null,
      awayPitcherId:Number.isSafeInteger(Number(ap?.id))?Number(ap.id):null,
      homePitcherName:typeof hp?.fullName==='string'?hp.fullName:null,
      awayPitcherName:typeof ap?.fullName==='string'?ap.fullName:null,
      gameNumber:Number.isFinite(Number(game?.gameNumber))?Number(game.gameNumber):1,
      doubleheader:String(game?.doubleHeader??'N').toUpperCase()!=='N',
    })
  }
  return out.sort((a,b)=>Date.parse(a.startTime)-Date.parse(b.startTime)||a.gamePk-b.gamePk)
}

async function officialDecisions(date:string){
  const fields='dates,date,games,gamePk,decisions,winner,id,fullName,loser'
  const params=new URLSearchParams({sportId:'1',date,hydrate:'decisions',fields})
  const response=await fetch('https://statsapi.mlb.com/api/v1/schedule?'+params.toString(),{cache:'no-store'})
  if(!response.ok) throw new Error(`PITCHER_WIN_DECISIONS_HTTP_${response.status}`)
  const json=await response.json() as any
  const games=(json?.dates??[]).flatMap((d:any)=>Array.isArray(d?.games)?d.games:[])
  const map=new Map<number,number>()
  for(const game of games){
    const gamePk=Number(game?.gamePk)
    const winnerId=Number(game?.decisions?.winner?.id)
    if(Number.isSafeInteger(gamePk)&&Number.isSafeInteger(winnerId)) map.set(gamePk,winnerId)
  }
  return map
}

async function loadTeamHistory(targetDate:string,teams:string[]){
  if(!teams.length) return [] as TeamHistory[]
  const {data,error}=await supabaseAdmin.from('mlb_pitcher_win_forward_team_history_v1')
    .select('game_pk,game_date,team,opponent,runs_for,runs_against,win')
    .eq('season',SEASON).lt('game_date',targetDate).in('team',teams)
    .order('game_date',{ascending:false}).order('game_pk',{ascending:false}).limit(10000)
  if(error) throw new Error(`PITCHER_WIN_TEAM_HISTORY_READ:${error.message}`)
  return (data??[]) as TeamHistory[]
}

async function loadStarterHistory(targetDate:string,pitcherIds:number[]){
  if(!pitcherIds.length) return [] as StarterHistory[]
  const {data,error}=await supabaseAdmin.from('mlb_pitcher_win_forward_starter_history_v1')
    .select('game_pk,game_date,starter_side,starter_mlbam_id,y_win')
    .eq('season',SEASON).lt('game_date',targetDate).in('starter_mlbam_id',pitcherIds)
    .order('game_date',{ascending:false}).order('game_pk',{ascending:false}).limit(10000)
  if(error) throw new Error(`PITCHER_WIN_STARTER_HISTORY_READ:${error.message}`)
  return (data??[]) as StarterHistory[]
}

function teamSummary(team:string,rows:TeamHistory[],targetDate:string){
  const games=rows.filter(r=>normalizeTeam(String(r.team))===team)
  const aggregate=(g:TeamHistory[])=>{
    if(!g.length) return {games:0,winPct:Number.NaN,runDiff:Number.NaN,pyth:Number.NaN}
    const wins=g.reduce((s,r)=>s+Number(r.win),0)
    const rf=g.reduce((s,r)=>s+Number(r.runs_for),0)
    const ra=g.reduce((s,r)=>s+Number(r.runs_against),0)
    const rfP=rf>0?rf**1.83:0
    const raP=ra>0?ra**1.83:0
    return {games:g.length,winPct:wins/g.length,runDiff:(rf-ra)/g.length,pyth:rfP+raP>0?rfP/(rfP+raP):Number.NaN}
  }
  const all=aggregate(games)
  const l5=aggregate(games.slice(0,5))
  const l10=aggregate(games.slice(0,10))
  const last=games[0]?.game_date
  return {
    games:all.games,winPct:all.winPct,runDiff:all.runDiff,pyth:all.pyth,
    l5Games:l5.games,l5WinPct:l5.winPct,l5RunDiff:l5.runDiff,
    l10Games:l10.games,l10WinPct:l10.winPct,l10RunDiff:l10.runDiff,
    restDays:last?Math.max(daysBetween(last,targetDate)-1,0):Number.NaN,
  }
}

function h2hWinPct(own:string,opp:string,rows:TeamHistory[]){
  const games=rows.filter(r=>normalizeTeam(String(r.team))===own&&normalizeTeam(String(r.opponent))===opp)
  return games.length?games.reduce((s,r)=>s+Number(r.win),0)/games.length:Number.NaN
}

function starterDecisionSummary(pitcherId:number,rows:StarterHistory[]){
  const prior=rows.filter(r=>Number(r.starter_mlbam_id)===pitcherId)
  if(prior.some(r=>r.y_win===null)) return {starts:prior.length,wins:Number.NaN,rate:Number.NaN,complete:false}
  const wins=prior.reduce((s,r)=>s+Number(r.y_win??0),0)
  return {starts:prior.length,wins,rate:prior.length?wins/prior.length:Number.NaN,complete:true}
}

function featureVector(args:{
  isHome:boolean,game:SlateGame,own:string,opp:string,
  teamRows:TeamHistory[],starterRows:StarterHistory[],pitcherId:number
}){
  const ownS=teamSummary(args.own,args.teamRows,dateInTimeZone(new Date(args.game.startTime)))
  const oppS=teamSummary(args.opp,args.teamRows,dateInTimeZone(new Date(args.game.startTime)))
  const starter=starterDecisionSummary(args.pitcherId,args.starterRows)
  return {
    values:[
      args.isHome?1:0,args.game.gameNumber,args.game.doubleheader?1:0,
      ownS.games,oppS.games,ownS.winPct,oppS.winPct,ownS.runDiff,oppS.runDiff,ownS.pyth,oppS.pyth,
      ownS.l5Games,oppS.l5Games,ownS.l5WinPct,oppS.l5WinPct,ownS.l5RunDiff,oppS.l5RunDiff,
      ownS.l10Games,oppS.l10Games,ownS.l10WinPct,oppS.l10WinPct,ownS.l10RunDiff,oppS.l10RunDiff,
      ownS.restDays,oppS.restDays,h2hWinPct(args.own,args.opp,args.teamRows),
      starter.starts,starter.wins,starter.rate,
    ].map(finiteOrNaN),
    historyComplete:starter.complete,
    priorStarts:starter.starts,
    priorWins:starter.wins,
    priorWinRate:starter.rate,
  }
}

async function existingJob(jobType:string,targetDate:string){
  const {data,error}=await supabaseAdmin.from('sports_sync_jobs')
    .select('id,status,completed_at,metadata')
    .eq('job_type',jobType).eq('sport_key','baseball_mlb').eq('provider',PROVIDER)
    .in('status',['completed','partial']).order('completed_at',{ascending:false}).limit(100)
  if(error) throw new Error(`PITCHER_WIN_JOB_READ:${error.message}`)
  return (data??[]).find(row=>{
    const m=row.metadata&&typeof row.metadata==='object'?row.metadata as Record<string,unknown>:{}
    return m.targetDate===targetDate&&m.candidateId===CANDIDATE_ID
  })??null
}

export async function syncPitcherWinForwardHistory(targetDate:string){
  const [teamSync,starterSync]=await Promise.all([
    supabaseAdmin.rpc('sync_mlb_pitcher_win_forward_team_history_v1',{p_target_date:targetDate}),
    supabaseAdmin.rpc('sync_mlb_pitcher_win_forward_starter_history_v1',{p_target_date:targetDate}),
  ])
  if(teamSync.error) throw new Error(`PITCHER_WIN_TEAM_SYNC:${teamSync.error.message}`)
  if(starterSync.error) throw new Error(`PITCHER_WIN_STARTER_SYNC:${starterSync.error.message}`)

  const decisions=await officialDecisions(targetDate)
  const {data:rows,error}=await supabaseAdmin.from('mlb_pitcher_win_forward_starter_history_v1')
    .select('game_pk,starter_side,starter_mlbam_id')
    .eq('season',SEASON).eq('game_date',targetDate)
  if(error) throw new Error(`PITCHER_WIN_SYNC_STARTERS_READ:${error.message}`)
  let labeled=0
  for(const row of rows??[]){
    const winner=decisions.get(Number(row.game_pk))
    if(!winner) continue
    const yWin=Number(row.starter_mlbam_id)===winner?1:0
    const upd=await supabaseAdmin.from('mlb_pitcher_win_forward_starter_history_v1')
      .update({y_win:yWin,outcome_source:'MLB_OFFICIAL_DECISIONS_FORWARD_SYNC_V1',updated_at:new Date().toISOString()})
      .eq('season',SEASON).eq('game_pk',row.game_pk).eq('starter_side',row.starter_side)
    if(upd.error) throw new Error(`PITCHER_WIN_SYNC_UPDATE:${upd.error.message}`)
    labeled+=1
  }
  return {targetDate,teamRows:Number(teamSync.data?.[0]?.inserted_rows??0),starterRows:Number(starterSync.data?.[0]?.upserted_rows??0),resolvedGames:decisions.size,labeledStarterRows:labeled}
}

export async function freezePitcherWinForward({
  targetDate,now=new Date(),
}:{targetDate?:string,now?:Date}={}){
  const today=dateInTimeZone(now)
  const date=targetDate??today
  const base={success:true,candidateId:CANDIDATE_ID,targetDate:date,threshold:THRESHOLD,researchOnly:true,productionEligible:false,officialPicksModified:false,apostarActivated:false,writes:0}
  if(date<FORWARD_MIN_DATE) return {...base,status:'NOT_IN_PROSPECTIVE_WINDOW'}
  if(date!==today) return {...base,success:false,status:'BLOCK_NONCURRENT_WRITE_DATE'}
  const minute=minuteOfDay(now)
  if(minute<FREEZE_START_MINUTE) return {...base,status:'NOT_IN_FREEZE_WINDOW'}
  const prior=await existingJob(FREEZE_JOB_TYPE,date)
  if(prior) return {...base,status:'REUSE_NO_OP',freezeJobId:prior.id,frozenAt:prior.completed_at}
  if(minute>=FREEZE_END_MINUTE) return {...base,success:false,status:'BLOCK_FREEZE_WINDOW_MISSED'}

  const slate=await officialSlate(date)
  if(!slate.length) return {...base,status:'NO_SCHEDULED_GAMES'}
  const earliest=Math.min(...slate.map(g=>Date.parse(g.startTime)))
  if(!Number.isFinite(earliest)||now.getTime()>=earliest) return {...base,success:false,status:'BLOCK_FREEZE_AFTER_FIRST_PITCH'}

  const teams=[...new Set(slate.flatMap(g=>[g.homeTeam,g.awayTeam]))]
  const pitcherIds=[...new Set(slate.flatMap(g=>[g.homePitcherId,g.awayPitcherId]).filter((x):x is number=>Number.isSafeInteger(x)))]
  const [teamRows,starterRows]=await Promise.all([loadTeamHistory(date,teams),loadStarterHistory(date,pitcherIds)])

  const observations:Array<Record<string,unknown>>=[]
  for(const game of slate){
    for(const side of ['home','away'] as const){
      const pitcherId=side==='home'?game.homePitcherId:game.awayPitcherId
      const pitcherName=side==='home'?game.homePitcherName:game.awayPitcherName
      const own=side==='home'?game.homeTeam:game.awayTeam
      const opp=side==='home'?game.awayTeam:game.homeTeam
      if(!pitcherId){
        observations.push({gamePk:game.gamePk,startTime:game.startTime,starterSide:side,pitcherId:null,pitcherName,ownTeam:own,oppTeam:opp,pWin:null,selected:false,reason:'MISSING_PROBABLE_PITCHER'})
        continue
      }
      const fv=featureVector({isHome:side==='home',game,own,opp,teamRows,starterRows,pitcherId})
      const p0=applyNumericCatBoostProbability(MODEL0,fv.values)
      const p1=applyNumericCatBoostProbability(MODEL1,fv.values)
      const pWin=(p0+p1)/2
      const selected=fv.historyComplete&&pWin<=THRESHOLD
      observations.push({
        gamePk:game.gamePk,startTime:game.startTime,starterSide:side,pitcherId,pitcherName,
        ownTeam:own,oppTeam:opp,pWinModel0:p0,pWinModel1:p1,pWin,threshold:THRESHOLD,
        selected,reason:fv.historyComplete?(selected?'FROZEN_NO_WIN_SELECTION':'ABOVE_THRESHOLD'):'INCOMPLETE_PRIOR_DECISION_HISTORY',
        priorStarts:fv.priorStarts,priorWins:fv.priorWins,priorWinRate:fv.priorWinRate,
        featureContract:'DEPLOYABLE_EXACT_PARITY_NUMERIC_V1',
      })
    }
  }

  const selected=observations.filter(o=>o.selected===true)
  const incomplete=observations.filter(o=>o.reason==='INCOMPLETE_PRIOR_DECISION_HISTORY'||o.reason==='MISSING_PROBABLE_PITCHER')
  const completedAt=new Date().toISOString()
  const {data:job,error}=await supabaseAdmin.from('sports_sync_jobs').insert({
    id:randomUUID(),job_type:FREEZE_JOB_TYPE,sport_key:'baseball_mlb',league_key:'mlb',
    provider:PROVIDER,season:String(SEASON),started_at:now.toISOString(),completed_at:completedAt,
    status:incomplete.length?'partial':'completed',
    records_fetched:observations.length,records_inserted:selected.length,records_updated:0,
    records_skipped:observations.length-selected.length,error_count:incomplete.length,
    metadata:{
      candidateId:CANDIDATE_ID,targetDate:date,forwardMinDate:FORWARD_MIN_DATE,frozenAt:now.toISOString(),
      threshold:THRESHOLD,direction:'NO_STARTER_WIN',featureContract:'DEPLOYABLE_EXACT_PARITY_NUMERIC_V1',
      historicalEvidence:{correct:128,n:147,accuracy:128/147,worstMonthAccuracy:0.75,coverage:147/8380},
      modelHashes:[
        '1a65260e5a3d97a647dc990f433bfd27b8750e4557a1a33e02e9a0e07d4b2fda',
        '13cfa39ecb8713580d740bb798279ce68bc2f301bb541eb09ed1f7bbd5211432',
      ],
      observations,selectedGames:selected.length,outcomesRead:false,
      researchOnly:true,productionEligible:false,officialPicksModified:false,apostarActivated:false,
    },updated_at:completedAt,
  }).select('id').single()
  if(error) throw new Error(`PITCHER_WIN_FREEZE_WRITE:${error.message}`)
  return {...base,status:selected.length?'FROZEN_SELECTIONS_AVAILABLE':'FROZEN_NO_SELECTION',freezeJobId:job?.id??null,games:slate.length,starterObservations:observations.length,selectedGames:selected.length,incompleteGames:incomplete.length,writes:1}
}

export async function settlePitcherWinForward(targetDate:string){
  const base={success:true,candidateId:CANDIDATE_ID,targetDate,researchOnly:true,productionEligible:false,officialPicksModified:false,apostarActivated:false,writes:0}
  if(targetDate<FORWARD_MIN_DATE) return {...base,status:'NOT_IN_PROSPECTIVE_WINDOW'}
  const prior=await existingJob(SETTLEMENT_JOB_TYPE,targetDate)
  if(prior) return {...base,status:'REUSE_NO_OP',settlementJobId:prior.id}
  const freeze=await existingJob(FREEZE_JOB_TYPE,targetDate)
  if(!freeze) return {...base,status:'WAITING_FOR_FREEZE'}
  const meta=freeze.metadata&&typeof freeze.metadata==='object'?freeze.metadata as Record<string,unknown>:{}
  const observations=Array.isArray(meta.observations)?meta.observations as Array<Record<string,unknown>>:[]
  const selected=observations.filter(o=>o.selected===true)
  const decisions=await officialDecisions(targetDate)
  const unresolved=selected.filter(o=>!decisions.has(Number(o.gamePk)))
  if(unresolved.length) return {...base,status:'WAITING_FOR_FINAL_OUTCOMES',selectedGames:selected.length,unresolvedGames:unresolved.map(o=>o.gamePk)}
  const results=selected.map(o=>{
    const winner=decisions.get(Number(o.gamePk))!
    const starterId=Number(o.pitcherId)
    const starterWon=winner===starterId
    return {...o,winnerPitcherId:winner,starterWon,result:starterWon?'LOSS':'WIN'}
  })
  const correct=results.filter(r=>r.result==='WIN').length
  const completedAt=new Date().toISOString()
  const {data:job,error}=await supabaseAdmin.from('sports_sync_jobs').insert({
    id:randomUUID(),job_type:SETTLEMENT_JOB_TYPE,sport_key:'baseball_mlb',league_key:'mlb',
    provider:PROVIDER,season:String(SEASON),started_at:completedAt,completed_at:completedAt,status:'completed',
    records_fetched:results.length,records_inserted:results.length,records_updated:0,records_skipped:0,error_count:0,
    metadata:{candidateId:CANDIDATE_ID,targetDate,freezeJobId:freeze.id,selectedGames:results.length,correct,accuracy:results.length?correct/results.length:null,outcomesRead:true,results,researchOnly:true,productionEligible:false,officialPicksModified:false,apostarActivated:false},
    updated_at:completedAt,
  }).select('id').single()
  if(error) throw new Error(`PITCHER_WIN_SETTLEMENT_WRITE:${error.message}`)
  return {...base,status:'SETTLED',settlementJobId:job?.id??null,selectedGames:results.length,correct,accuracy:results.length?correct/results.length:null,writes:1}
}
