import 'server-only'

import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { readMlbOfficialBatterGameLog } from '@/services/mlb-official-batter-gamelog.service'
import { mapConcurrent, readMlbOfficialPitcherGameLog } from '@/services/mlb-official-pitcher-gamelog.service'

const SOURCE='mlb_approved_prop_daily_v1'
const SETTLEMENT='mlb_approved_prop_settlement_v1'
const SEASON=2026
const PAGE=500

type JsonMap=Record<string,unknown>
type DailyRow={
  id:string; tracking_date:string; game_pk:number; market:string; candidate_id:string;
  player_mlbam_id:number; player_name:string; direction:string; required_line:number|null;
  observed_line:number|null; status:string; model_qualifies:boolean; market_verified:boolean;
}
type BatterBasic={game_pk:number;batter:number;hits:number;home_runs:number;strikeouts:number;walks:number}
type BatterSdt={game_pk:number;batter:number;singles:number;doubles:number;triples:number}
type BatterTb={game_pk:number;batter:number;total_bases:number}
type Pitcher={game_pk:number;pitcher:number;hits:number|null;walks:number|null;strikeouts:number|null;outs:number|null}
type PitcherWin={tracking_date:string;game_pk:number;starter_mlbam_id:number;outcome_status:string;starter_recorded_win:boolean|null;selection_result:string|null;graded_at:string|null}

function datePR(now=new Date()){
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Puerto_Rico',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]))
  return `${p.year}-${p.month}-${p.day}`
}
function finite(v:unknown){const n=Number(v);return Number.isFinite(n)?n:null}
function hash(parts:unknown[]){return createHash('sha256').update(parts.map(v=>String(v??'null')).join('|')).digest('hex').slice(0,40)}
async function page<T>(table:string,cols:string,configure:(q:any)=>any){
  const out:T[]=[]
  for(let off=0;;off+=PAGE){
    const r=await configure(supabaseAdmin.from(table).select(cols)).range(off,off+PAGE-1)
    if(r.error)throw new Error(`MLB_APPROVED_SETTLEMENT_READ:${table}:${r.error.message}`)
    out.push(...((r.data??[]) as T[]))
    if(!r.data||r.data.length<PAGE)break
  }
  return out
}
function key(gamePk:number,player:number){return `${gamePk}:${player}`}
function grade(direction:string,line:number|null,actual:number){
  const d=direction.toUpperCase()
  if(d==='NO')return actual===0?'WIN':'LOSS'
  if(line===null)return null
  if(actual===line)return 'PUSH'
  if(d==='OVER')return actual>line?'WIN':'LOSS'
  if(d==='UNDER')return actual<line?'WIN':'LOSS'
  return null
}
function exactLine(r:DailyRow){return finite(r.observed_line??r.required_line)}

export async function settleMlbApprovedPropDaily(input:{throughDate?:string;now?:Date}={}){
  const now=input.now??new Date()
  const through=input.throughDate??datePR(now)
  const rows=await page<DailyRow>(SOURCE,
    'id,tracking_date,game_pk,market,candidate_id,player_mlbam_id,player_name,direction,required_line,observed_line,status,model_qualifies,market_verified',
    q=>q.lt('tracking_date',through).eq('model_qualifies',true).eq('market_verified',true).eq('status','QUALIFIES_MARKET_VERIFIED').order('tracking_date').order('game_pk')
  )
  if(!rows.length)return {success:true,status:'NO_SETTLEABLE_APPROVED_PROP_ROWS',writes:0,researchOnly:true,officialPicksModified:false,apostarActivated:false}

  const gamePks=[...new Set(rows.map(r=>Number(r.game_pk)))]
  const playerIds=[...new Set(rows.map(r=>Number(r.player_mlbam_id)))]

  const [basic,sdt,tb,pitcher,pitcherWin]=await Promise.all([
    page<BatterBasic>('mlb_statcast_batter_game_logs','game_pk,batter,hits,home_runs,strikeouts,walks',
      q=>q.eq('season',SEASON).in('game_pk',gamePks).in('batter',playerIds)),
    page<BatterSdt>('mlb_statcast_batter_sdt_game_mv','game_pk,batter,singles,doubles,triples',
      q=>q.eq('season',SEASON).in('game_pk',gamePks).in('batter',playerIds)),
    page<BatterTb>('mlb_statcast_batter_total_bases_game_mv','game_pk,batter,total_bases',
      q=>q.eq('season',SEASON).in('game_pk',gamePks).in('batter',playerIds)),
    page<Pitcher>('mlb_ml_xyear_pitcher_game_v1','game_pk,pitcher,hits,walks,strikeouts,outs',
      q=>q.eq('season',SEASON).in('game_pk',gamePks).in('pitcher',playerIds)),
    page<PitcherWin>('mlb_pitcher_win_forward_tracker_v1','tracking_date,game_pk,starter_mlbam_id,outcome_status,starter_recorded_win,selection_result,graded_at',
      q=>q.in('game_pk',gamePks).in('starter_mlbam_id',playerIds)),
  ])

  const basicMap=new Map(basic.map(r=>[key(Number(r.game_pk),Number(r.batter)),r]))
  const sdtMap=new Map(sdt.map(r=>[key(Number(r.game_pk),Number(r.batter)),r]))
  const tbMap=new Map(tb.map(r=>[key(Number(r.game_pk),Number(r.batter)),r]))
  const pitcherMap=new Map(pitcher.map(r=>[key(Number(r.game_pk),Number(r.pitcher)),r]))
  const winMap=new Map(pitcherWin.map(r=>[key(Number(r.game_pk),Number(r.starter_mlbam_id)),r]))

  const rbiMarkets=rows.filter(r=>r.market==='batter_rbis'||r.market==='batter_hits_runs_rbis')
  const erMarkets=rows.filter(r=>r.market==='pitcher_earned_runs')
  const batterOfficialIds=[...new Set(rbiMarkets.map(r=>Number(r.player_mlbam_id)))]
  const pitcherOfficialIds=[...new Set(erMarkets.map(r=>Number(r.player_mlbam_id)))]

  const batterOfficial=await mapConcurrent(batterOfficialIds,6,async id=>{
    try{return {id,rows:await readMlbOfficialBatterGameLog(id,SEASON),error:null as string|null}}
    catch(e){return {id,rows:[],error:e instanceof Error?e.message:String(e)}}
  })
  const pitcherOfficial=await mapConcurrent(pitcherOfficialIds,6,async id=>{
    try{return {id,rows:await readMlbOfficialPitcherGameLog(id,SEASON),error:null as string|null}}
    catch(e){return {id,rows:[],error:e instanceof Error?e.message:String(e)}}
  })
  const batterOfficialMap=new Map<number,Map<number,any>>()
  for(const p of batterOfficial)batterOfficialMap.set(p.id,new Map(p.rows.map(r=>[r.gamePk,r])))
  const pitcherOfficialMap=new Map<number,Map<number,any>>()
  for(const p of pitcherOfficial)pitcherOfficialMap.set(p.id,new Map(p.rows.map(r=>[r.gamePk,r])))

  const prepared:any[]=[]
  let settled=0,blocked=0
  const settledAt=now.toISOString()

  for(const row of rows){
    const k=key(Number(row.game_pk),Number(row.player_mlbam_id))
    const line=exactLine(row)
    let actual:number|null=null
    let source=''
    let sourceIdentity:JsonMap={gamePk:row.game_pk,playerMlbamId:row.player_mlbam_id}
    let blocker:string|null=null
    let sourceResult:string|null=null
    let sourceSettledAt:string|null=null

    if(row.market==='batter_hits'||row.market==='batter_home_runs'||row.market==='batter_strikeouts'||row.market==='batter_walks'){
      const v=basicMap.get(k)
      const field=row.market==='batter_hits'?'hits':row.market==='batter_home_runs'?'home_runs':row.market==='batter_strikeouts'?'strikeouts':'walks'
      actual=v?finite(v[field as keyof BatterBasic]):null
      source='mlb_statcast_batter_game_logs'
    }else if(row.market==='batter_singles'||row.market==='batter_doubles'||row.market==='batter_triples'){
      const v=sdtMap.get(k)
      const field=row.market==='batter_singles'?'singles':row.market==='batter_doubles'?'doubles':'triples'
      actual=v?finite(v[field as keyof BatterSdt]):null
      source='mlb_statcast_batter_sdt_game_mv'
    }else if(row.market==='batter_total_bases'){
      actual=finite(tbMap.get(k)?.total_bases);source='mlb_statcast_batter_total_bases_game_mv'
    }else if(row.market==='batter_rbis'||row.market==='batter_hits_runs_rbis'){
      const v=batterOfficialMap.get(Number(row.player_mlbam_id))?.get(Number(row.game_pk))
      actual=v?(row.market==='batter_rbis'?finite(v.rbi):finite(v.hits+v.runs+v.rbi)):null
      source='MLB_OFFICIAL_BATTER_GAMELOG'
    }else if(['pitcher_strikeouts','pitcher_walks','pitcher_hits_allowed','pitcher_outs'].includes(row.market)){
      const v=pitcherMap.get(k)
      const field=row.market==='pitcher_strikeouts'?'strikeouts':row.market==='pitcher_walks'?'walks':row.market==='pitcher_hits_allowed'?'hits':'outs'
      actual=v?finite(v[field as keyof Pitcher]):null
      source='mlb_ml_xyear_pitcher_game_v1'
    }else if(row.market==='pitcher_earned_runs'){
      const v=pitcherOfficialMap.get(Number(row.player_mlbam_id))?.get(Number(row.game_pk))
      actual=v?finite(v.earnedRuns):null;source='MLB_OFFICIAL_PITCHER_GAMELOG'
    }else if(row.market==='pitcher_record_a_win'){
      const v=winMap.get(k)
      source='mlb_pitcher_win_forward_tracker_v1'
      if(v?.outcome_status==='SETTLED'&&v.starter_recorded_win!==null){
        actual=v.starter_recorded_win?1:0
        sourceResult=v.selection_result==='WIN'?'WIN':v.selection_result==='LOSS'?'LOSS':null
        sourceSettledAt=v.graded_at
      }
    }else{
      blocker='UNSUPPORTED_MARKET'
      source='UNSUPPORTED'
    }

    const finalResult=sourceResult??(actual===null?null:grade(row.direction,line,actual))
    if(actual===null&&!blocker)blocker='EXACT_OUTCOME_NOT_AVAILABLE'
    if(finalResult)settled++;else blocked++

    prepared.push({
      id:'mlbapsettle_'+hash([row.id,row.candidate_id]),
      approved_prop_daily_id:row.id,
      tracking_date:row.tracking_date,
      game_pk:row.game_pk,
      market:row.market,
      candidate_id:row.candidate_id,
      player_mlbam_id:row.player_mlbam_id,
      direction:row.direction,
      exact_line:line,
      actual_value:actual,
      actual_label:actual===null?null:`${row.market}=${actual}`,
      result:finalResult,
      outcome_source:source,
      outcome_source_identity:sourceIdentity,
      settled_at:finalResult?(sourceSettledAt??settledAt):null,
      blocker,
      research_only:true,
      production_eligible:false,
      official_picks_eligible:false,
      apostar_enabled:false,
      updated_at:settledAt,
    })
  }

  for(let i=0;i<prepared.length;i+=100){
    const r=await supabaseAdmin.from(SETTLEMENT).upsert(prepared.slice(i,i+100),{onConflict:'approved_prop_daily_id'})
    if(r.error)throw new Error('MLB_APPROVED_PROP_SETTLEMENT_WRITE:'+r.error.message)
  }

  return {
    success:true,status:'MLB_APPROVED_PROP_SETTLEMENT_REFRESHED',
    rows:prepared.length,settled,blocked,
    blockerCounts:prepared.reduce((m:any,r:any)=>{const k=r.blocker??'NONE';m[k]=(m[k]??0)+1;return m},{}),
    researchOnly:true,productionEligible:false,officialPicksModified:false,apostarActivated:false,
  }
}
