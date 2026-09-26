import 'server-only'

import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'

const V1_FORMULA='MLB_ML_OPENING_CONSENSUS_FUNDAMENTALS_V1'
const V2_FORMULA='MLB_ML_OPENING_CONSENSUS_V2_SECONDARY_SCORE'
const V1_TABLE='mlb_ml_opening_consensus_forward_v1'
const V2_TABLE='mlb_ml_opening_consensus_v2_forward_v1'

const CUTS={
  bullpenRa9:0.935409247675931,
  commonOpp:0.158617424242424,
  venue:0.238452767470625,
  starterRa9:1.55737077764639,
}
const MIN_SCORE=2

type JsonMap=Record<string,unknown>

function hash(parts:unknown[]){
  return createHash('sha256').update(parts.map(x=>String(x??'null')).join('|')).digest('hex').slice(0,32)
}
function finite(v:unknown){
  const n=Number(v)
  return Number.isFinite(n)?n:null
}
function prDate(now=new Date()){
  const p=Object.fromEntries(
    new Intl.DateTimeFormat('en-CA',{
      timeZone:'America/Puerto_Rico',year:'numeric',month:'2-digit',day:'2-digit'
    }).formatToParts(now).filter(x=>x.type!=='literal').map(x=>[x.type,x.value])
  )
  return String(p.year)+'-'+String(p.month)+'-'+String(p.day)
}
function confidence(score:number){
  return score===4?'MAX':score===3?'STRONG':'STANDARD'
}

export async function freezeMlbOpeningConsensusV2(input:{targetDate?:string;now?:Date}={}){
  const now=input.now??new Date()
  const targetDate=input.targetDate??prDate(now)

  const v1=await supabaseAdmin.from(V1_TABLE)
    .select('id,target_date,game_pk,xyear_canonical_game_id,scheduled_at,home_team,away_team,pick,pick_side,favorite_probability,aligned_votes,feature_cutoff_date,feature_version,status')
    .eq('formula_id',V1_FORMULA)
    .eq('target_date',targetDate)
    .eq('status','PENDING')
    .limit(100)

  if(v1.error)throw new Error('V2_V1_FORWARD_READ_FAILED:'+v1.error.message)
  const future=(v1.data??[]).filter(r=>Date.parse(String(r.scheduled_at))>now.getTime())
  if(!future.length){
    return {
      success:true,status:'NO_ELIGIBLE_V1_FORWARD_ROWS',researchOnly:true,
      productionEligible:false,officialPicksModified:false,apostarActivated:false,
      targetDate,evaluated:0,qualifiers:0,inserted:0,reused:0
    }
  }

  const gamePks=future.map(r=>Number(r.game_pk)).filter(Number.isFinite)
  const features=await supabaseAdmin.from('mlb_ml_xyear_features_v1')
    .select('game_pk,canonical_game_id,game_date,actual_winner,feature_cutoff_date,home_sp_ra9,away_sp_ra9,home_bullpen_ra9,away_bullpen_ra9,home_common_win_pct,away_common_win_pct,home_home_win_pct,away_away_win_pct')
    .eq('season',2026)
    .in('game_pk',gamePks)
    .limit(100)

  if(features.error)throw new Error('V2_FEATURE_READ_FAILED:'+features.error.message)
  const fmap=new Map((features.data??[]).map(r=>[Number(r.game_pk),r]))

  const candidates:Array<Record<string,unknown>>=[]
  let missingSecondary=0
  let lineageBlocked=0

  for(const row of future){
    const f=fmap.get(Number(row.game_pk))
    if(!f){missingSecondary++;continue}
    if(f.actual_winner!==null){lineageBlocked++;continue}
    if(String(f.feature_cutoff_date??'')>=targetDate){lineageBlocked++;continue}
    if(String(row.feature_cutoff_date??'')>=targetDate){lineageBlocked++;continue}

    const home=row.pick_side==='HOME'
    const starter=home
      ? finite(f.away_sp_ra9)!-finite(f.home_sp_ra9)!
      : finite(f.home_sp_ra9)!-finite(f.away_sp_ra9)!
    const bullpen=home
      ? finite(f.away_bullpen_ra9)!-finite(f.home_bullpen_ra9)!
      : finite(f.home_bullpen_ra9)!-finite(f.away_bullpen_ra9)!
    const common=home
      ? finite(f.home_common_win_pct)!-finite(f.away_common_win_pct)!
      : finite(f.away_common_win_pct)!-finite(f.home_common_win_pct)!
    const venue=home
      ? finite(f.home_home_win_pct)!-finite(f.away_away_win_pct)!
      : finite(f.away_away_win_pct)!-finite(f.home_home_win_pct)!

    const values=[starter,bullpen,common,venue]
    if(values.some(v=>!Number.isFinite(v))){
      missingSecondary++
      continue
    }

    const checks={
      starter_ra9_edge:{value:starter,cut:CUTS.starterRa9,pass:starter>=CUTS.starterRa9},
      bullpen_ra9_edge:{value:bullpen,cut:CUTS.bullpenRa9,pass:bullpen>=CUTS.bullpenRa9},
      common_opponent_edge:{value:common,cut:CUTS.commonOpp,pass:common>=CUTS.commonOpp},
      venue_split_edge:{value:venue,cut:CUTS.venue,pass:venue>=CUTS.venue},
    }
    const score=Object.values(checks).filter(x=>x.pass).length
    if(score<MIN_SCORE)continue

    candidates.push({
      id:'mlv2fwd_'+hash([V2_FORMULA,row.game_pk]),
      v1_forward_id:row.id,
      formula_id:V2_FORMULA,
      target_date:targetDate,
      game_pk:row.game_pk,
      xyear_canonical_game_id:row.xyear_canonical_game_id,
      scheduled_at:row.scheduled_at,
      home_team:row.home_team,
      away_team:row.away_team,
      pick:row.pick,
      pick_side:row.pick_side,
      favorite_probability:row.favorite_probability,
      base_fundamentals_aligned:row.aligned_votes,
      secondary_score:score,
      confidence:confidence(score),
      secondary_snapshot:checks,
      feature_cutoff_date:row.feature_cutoff_date,
      freeze_timestamp:now.toISOString(),
      status:'PENDING',
      metadata:{
        researchOnly:true,productionEligible:false,officialPicksEligible:false,
        apostarEnabled:false,parentFormula:V1_FORMULA,forwardOnly:true,
        noRetune:true,noTeamFilter:true
      }
    })
  }

  if(!candidates.length){
    return {
      success:true,status:'NO_V2_THRESHOLD_CROSSING',researchOnly:true,
      productionEligible:false,officialPicksModified:false,apostarActivated:false,
      targetDate,evaluated:future.length,qualifiers:0,inserted:0,reused:0,
      missingSecondary,lineageBlocked
    }
  }

  const existing=await supabaseAdmin.from(V2_TABLE)
    .select('id')
    .in('id',candidates.map(x=>String(x.id)))
  if(existing.error)throw new Error('V2_EXISTING_READ_FAILED:'+existing.error.message)
  const seen=new Set((existing.data??[]).map(x=>String(x.id)))
  const fresh=candidates.filter(x=>!seen.has(String(x.id)))

  if(fresh.length){
    const write=await supabaseAdmin.from(V2_TABLE).insert(fresh)
    if(write.error)throw new Error('V2_FORWARD_WRITE_FAILED:'+write.error.message)
  }

  return {
    success:true,status:fresh.length?'V2_FORWARD_CANDIDATES_FROZEN':'V2_REUSE_NO_OP',
    researchOnly:true,productionEligible:false,officialPicksModified:false,apostarActivated:false,
    targetDate,evaluated:future.length,qualifiers:candidates.length,inserted:fresh.length,
    reused:seen.size,missingSecondary,lineageBlocked,
    candidates:candidates.map(x=>({
      gamePk:x.game_pk,matchup:String(x.away_team)+' @ '+String(x.home_team),
      pick:x.pick,secondaryScore:x.secondary_score,confidence:x.confidence,
      favoriteProbability:x.favorite_probability
    }))
  }
}

async function mlbFeed(gamePk:number){
  const r=await fetch(`https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`,{
    cache:'no-store',
    headers:{'User-Agent':'PickAnalyzerResearch/1.0'},
    signal:AbortSignal.timeout(15000),
  })
  if(!r.ok)throw new Error('MLB_V2_SETTLEMENT_HTTP_'+r.status)
  return r.json() as Promise<any>
}

export async function settleMlbOpeningConsensusV2(input:{now?:Date}={}){
  const now=input.now??new Date()
  const pending=await supabaseAdmin.from(V2_TABLE)
    .select('id,game_pk,scheduled_at,pick,status')
    .eq('status','PENDING')
    .lte('scheduled_at',now.toISOString())
    .limit(50)
  if(pending.error)throw new Error('V2_SETTLEMENT_READ_FAILED:'+pending.error.message)

  let settled=0,wins=0,losses=0,blocked=0
  const rows=[]

  for(const row of pending.data??[]){
    try{
      const feed=await mlbFeed(Number(row.game_pk))
      const abstract=String(feed?.gameData?.status?.abstractGameState??'')
      const detailed=String(feed?.gameData?.status?.detailedState??'')
      const isFinal=abstract.toLowerCase()==='final'||detailed.toLowerCase()==='final'
      if(!isFinal){
        rows.push({gamePk:row.game_pk,status:'PENDING_GAME_NOT_FINAL'})
        continue
      }

      const home=String(feed?.gameData?.teams?.home?.abbreviation??'').toUpperCase()
      const away=String(feed?.gameData?.teams?.away?.abbreviation??'').toUpperCase()
      const hr=Number(feed?.liveData?.linescore?.teams?.home?.runs)
      const ar=Number(feed?.liveData?.linescore?.teams?.away?.runs)
      if(!home||!away||!Number.isFinite(hr)||!Number.isFinite(ar)||hr===ar){
        blocked++
        rows.push({gamePk:row.game_pk,status:'BLOCKED_FINAL_SCORE_MISSING'})
        continue
      }

      const actual=hr>ar?home:away
      const result=actual===String(row.pick)?'WIN':'LOSS'
      const update=await supabaseAdmin.from(V2_TABLE).update({
        status:'SETTLED',result,actual_winner:actual,
        settled_at:now.toISOString(),updated_at:now.toISOString()
      }).eq('id',row.id).eq('status','PENDING')
      if(update.error)throw new Error('V2_SETTLEMENT_WRITE_FAILED:'+update.error.message)

      settled++
      if(result==='WIN')wins++;else losses++
      rows.push({gamePk:row.game_pk,status:'SETTLED',result,actualWinner:actual})
    }catch(error){
      blocked++
      rows.push({gamePk:row.game_pk,status:'BLOCKED_SETTLEMENT_ERROR',error:error instanceof Error?error.message:'UNKNOWN'})
    }
  }

  return {
    success:true,researchOnly:true,officialPicksModified:false,apostarActivated:false,
    pendingChecked:(pending.data??[]).length,settled,wins,losses,blocked,rows
  }
}

export async function runMlbOpeningConsensusV2Shadow(input:{targetDate?:string;now?:Date}={}){
  const now=input.now??new Date()
  const freeze=await freezeMlbOpeningConsensusV2({targetDate:input.targetDate,now})
  const settlement=await settleMlbOpeningConsensusV2({now})
  return {
    success:true,researchOnly:true,productionEligible:false,
    officialPicksModified:false,apostarActivated:false,
    formulaId:V2_FORMULA,freeze,settlement
  }
}
