import 'server-only'

import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { captureMlbMoneylinePregameStarterEvidence } from '@/services/mlb-moneyline-daily-materializer.service'

const FORMULA_ID='MLB_ML_OPENING_CONSENSUS_FUNDAMENTALS_V1'
const OPENING_TABLE='mlb_bdl_opening_ml_2026_external_v1'
const FORWARD_TABLE='mlb_ml_opening_consensus_forward_v1'
const PROVIDER='balldontlie'
const REQUIRED_BOOKS=['betmgm','betrivers'] as const
const FAVORITE_THRESHOLD=0.65
const REQUIRED_VOTES=6
const MAX_GAMES_PAGES=2
const MAX_OPENING_PAGES=5

type JsonMap=Record<string,unknown>
type Pick2Game={game_pk:number;game_date:string;scheduled_at:string;doubleheader:string|null;game_number:number|null;metadata:JsonMap|null}
type XyearGame={canonical_game_id:string;game_pk:number;game_date:string;home_team:string;away_team:string;game_number:number;scheduled_at:string|null}
type BdlGame={id?:number;date?:string;home_team?:{abbreviation?:string};away_team?:{abbreviation?:string}}
type BdlOpening={id?:number;game_id?:number;vendor?:string;moneyline_home_odds?:number|null;moneyline_away_odds?:number|null;opened_at?:string}

function key(){return process.env.BALLDONTLIE_API_KEY?.trim()??''}
function finite(v:unknown){const n=Number(v);return Number.isFinite(n)?n:null}
function finiteInt(v:unknown){const n=Number(v);return Number.isSafeInteger(n)?n:null}
function validIso(v:unknown){const d=new Date(String(v??''));return Number.isFinite(d.getTime())?d.toISOString():null}
function asRecord(v:unknown):JsonMap{return v&&typeof v==='object'&&!Array.isArray(v)?v as JsonMap:{}}
function alias(v:unknown){
  const raw=String(v??'').trim().toUpperCase()
  const map:Record<string,string>={ARI:'AZ',AZ:'AZ',CHW:'CWS',CWS:'CWS',WSN:'WSH',WAS:'WSH',WSH:'WSH',TBR:'TB',TB:'TB',OAK:'ATH',ATH:'ATH'}
  return map[raw]??raw
}
function pair(home:unknown,away:unknown){return alias(home)+'|'+alias(away)}
function hash(parts:unknown[]){return createHash('sha256').update(parts.map(x=>String(x??'null')).join('|')).digest('hex').slice(0,32)}
function prDate(now=new Date()){
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Puerto_Rico',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]))
  return String(p.year)+'-'+String(p.month)+'-'+String(p.day)
}
function americanImplied(price:number){return price<0?(-price)/((-price)+100):100/(price+100)}

async function providerGet(url:URL){
  const r=await fetch(url.toString(),{cache:'no-store',headers:{Authorization:key()},signal:AbortSignal.timeout(20000)})
  if(!r.ok)throw new Error('BALLDONTLIE_HTTP_'+r.status)
  return r.json() as Promise<any>
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
    const payload=await providerGet(url)
    if(Array.isArray(payload?.data))rows.push(...payload.data)
    const next=payload?.meta?.next_cursor
    cursor=next===null||next===undefined||String(next)===''?null:String(next)
  }while(cursor)
  return {rows,pages}
}

async function stageSchedule(targetDate:string,now:Date){
  const games=await supabaseAdmin.from('pick2_mlb_games')
    .select('game_pk,game_date,scheduled_at,doubleheader,game_number,metadata')
    .eq('game_date',targetDate).order('scheduled_at',{ascending:true}).limit(50)
  if(games.error)throw new Error('PICK2_GAME_READ_FAILED:'+games.error.message)

  const future=((games.data??[]) as Pick2Game[]).filter(g=>Date.parse(String(g.scheduled_at))>now.getTime())
  if(!future.length)return {futureGames:0,inserted:0,reused:0}

  const homeTeams=[...new Set(future.map(g=>{
    const identity=asRecord(asRecord(g.metadata).mlb_official_identity)
    return alias(identity.home_abbreviation)
  }).filter(Boolean))]
  const venues=await supabaseAdmin.from('mlb_ml_team_venue_map_v1').select('team,venue,utc_offset_hours').in('team',homeTeams)
  if(venues.error)throw new Error('VENUE_MAP_READ_FAILED:'+venues.error.message)
  const vmap=new Map((venues.data??[]).map(v=>[String(v.team),v]))

  const existing=await supabaseAdmin.from('mlb_ml_xyear_game_v1').select('game_pk').eq('season',2026).eq('game_date',targetDate)
  if(existing.error)throw new Error('XYEAR_EXISTING_GAME_READ_FAILED:'+existing.error.message)
  const seen=new Set((existing.data??[]).map(r=>Number(r.game_pk)))

  const rows=future.filter(g=>!seen.has(Number(g.game_pk))).flatMap(g=>{
    const identity=asRecord(asRecord(g.metadata).mlb_official_identity)
    const home=alias(identity.home_abbreviation),away=alias(identity.away_abbreviation)
    if(!home||!away)return []
    const venue=vmap.get(home) as any
    const offset=Number(venue?.utc_offset_hours??0)
    const localHour=new Date(Date.parse(g.scheduled_at)+offset*3600000).getUTCHours()
    return [{
      season:2026,game_pk:g.game_pk,game_date:g.game_date,home_team:home,away_team:away,
      venue:venue?.venue??null,day_night:localHour<17?'day':'night',
      doubleheader_flag:String(g.doubleheader??'N')!=='N',game_number:g.game_number??1,
      scheduled_at:g.scheduled_at,innings:null,home_score:null,away_score:null,actual_winner:null
    }]
  })

  if(rows.length){
    const w=await supabaseAdmin.from('mlb_ml_xyear_game_v1').insert(rows)
    if(w.error)throw new Error('XYEAR_PREGAME_STAGE_WRITE_FAILED:'+w.error.message)
  }
  return {futureGames:future.length,inserted:rows.length,reused:future.length-rows.length}
}

async function materialize(targetDate:string){
  const starter=await captureMlbMoneylinePregameStarterEvidence(targetDate)
  const r=await supabaseAdmin.rpc('mlb_ml_xyear_materialize_pregame_v4',{p_target_date:targetDate})
  if(r.error)throw new Error('MLB_ML_XYEAR_MATERIALIZER_V4_FAILED:'+r.error.message)
  return {starter,result:asRecord(r.data)}
}

function groupFeatureGames(rows:XyearGame[]){
  const m=new Map<string,XyearGame[]>()
  for(const g of rows){const k=pair(g.home_team,g.away_team),b=m.get(k)??[];b.push(g);m.set(k,b)}
  for(const b of m.values())b.sort((a,b)=>(a.game_number??0)-(b.game_number??0))
  return m
}
function groupBdlGames(rows:BdlGame[]){
  const m=new Map<string,Map<string,BdlGame[]>>()
  for(const g of rows){
    const gid=finiteInt(g.id),ts=validIso(g.date)
    if(gid===null||!ts||!g.home_team?.abbreviation||!g.away_team?.abbreviation)continue
    const k=pair(g.home_team.abbreviation,g.away_team.abbreviation),times=m.get(k)??new Map<string,BdlGame[]>()
    const b=times.get(ts)??[];b.push(g);times.set(ts,b);m.set(k,times)
  }
  return m
}

async function captureOpening(targetDate:string){
  if(!key())return {success:false,status:'BLOCKED_MISSING_BALLDONTLIE_API_KEY',providerCallsMade:0,inserted:0}
  const xg=await supabaseAdmin.from('mlb_ml_xyear_game_v1')
    .select('canonical_game_id,game_pk,game_date,home_team,away_team,game_number,scheduled_at')
    .eq('season',2026).eq('game_date',targetDate).order('game_number',{ascending:true}).limit(50)
  if(xg.error)throw new Error('XYEAR_OPENING_MAP_READ_FAILED:'+xg.error.message)
  const features=(xg.data??[]) as XyearGame[]

  const [games,opening]=await Promise.all([
    fetchPaged('https://api.balldontlie.io/mlb/v1/games',targetDate,MAX_GAMES_PAGES,{season_type:'regular'}),
    fetchPaged('https://api.balldontlie.io/mlb/v1/odds/opening',targetDate,MAX_OPENING_PAGES)
  ])
  const f=groupFeatureGames(features),p=groupBdlGames(games.rows as BdlGame[])
  const providerToFeature=new Map<number,XyearGame>()
  let mappingAnomalies=0
  for(const k of new Set([...f.keys(),...p.keys()])){
    const fg=f.get(k)??[],groups=[...(p.get(k)?.entries()??[])].sort((a,b)=>Date.parse(a[0])-Date.parse(b[0]))
    if(!fg.length||fg.length!==groups.length){mappingAnomalies++;continue}
    for(let i=0;i<fg.length;i++){
      for(const g of groups[i][1]){
        const gid=finiteInt(g.id);if(gid!==null)providerToFeature.set(gid,fg[i])
      }
    }
  }

  const buckets=new Map<string,{feature:XyearGame;vendor:string;rows:BdlOpening[]}>()
  for(const row of opening.rows as BdlOpening[]){
    const gid=finiteInt(row.game_id),vendor=String(row.vendor??'').toLowerCase()
    if(gid===null||!REQUIRED_BOOKS.includes(vendor as any))continue
    const feature=providerToFeature.get(gid);if(!feature)continue
    const k=feature.canonical_game_id+'|'+vendor,b=buckets.get(k)??{feature,vendor,rows:[]};b.rows.push(row);buckets.set(k,b)
  }

  const normalized:Array<Record<string,unknown>>=[];let blocked=0
  for(const b of buckets.values()){
    const valid=b.rows.flatMap(row=>{
      const hp=finiteInt(row.moneyline_home_odds),ap=finiteInt(row.moneyline_away_odds),opened=validIso(row.opened_at)
      if(hp===null||ap===null||hp===0||ap===0||!opened)return []
      return [{row,hp,ap,opened,signature:JSON.stringify([hp,ap])}]
    })
    if(!valid.length)continue
    const sigs=[...new Set(valid.map(x=>x.signature))]
    if(sigs.length!==1){blocked++;continue}
    const opened=valid.map(x=>x.opened).sort()[0]
    if(b.feature.scheduled_at&&Date.parse(opened)>=Date.parse(b.feature.scheduled_at)){blocked++;continue}
    const providerGameIds=[...new Set(valid.map(x=>finiteInt(x.row.game_id)).filter((x):x is number=>x!==null))]
    const providerOddsIds=[...new Set(valid.map(x=>finiteInt(x.row.id)).filter((x):x is number=>x!==null))]
    for(const item of [{outcome:'home',price:valid[0].hp},{outcome:'away',price:valid[0].ap}]){
      normalized.push({
        id:'bdlml26_'+hash([b.feature.canonical_game_id,b.vendor,item.outcome]),
        season:2026,game_date:targetDate,xyear_canonical_game_id:b.feature.canonical_game_id,game_pk:b.feature.game_pk,
        home_team:b.feature.home_team,away_team:b.feature.away_team,game_number:b.feature.game_number,
        provider:PROVIDER,vendor:b.vendor,outcome:item.outcome,price:item.price,opened_at:opened,
        provider_game_ids:providerGameIds,provider_odds_ids:providerOddsIds,source:'BDL_2026_ML_EXTERNAL_OPENING_V1',
        metadata:{researchOnly:true,forwardCapture:true,frozenCandidate:FORMULA_ID,providerGameIds,providerOddsIds,historicalOddsApiCalls:0}
      })
    }
  }

  const existing=new Set<string>()
  for(let i=0;i<normalized.length;i+=100){
    const r=await supabaseAdmin.from(OPENING_TABLE).select('id').in('id',normalized.slice(i,i+100).map(x=>String(x.id)))
    if(r.error)throw new Error('OPENING_EXISTING_READ_FAILED:'+r.error.message)
    for(const row of r.data??[])existing.add(String(row.id))
  }
  const fresh=normalized.filter(x=>!existing.has(String(x.id)))
  if(fresh.length){
    const w=await supabaseAdmin.from(OPENING_TABLE).insert(fresh)
    if(w.error)throw new Error('OPENING_FORWARD_WRITE_FAILED:'+w.error.message)
  }
  return {success:true,status:fresh.length?'OPENING_ROWS_INSERTED':'OPENING_REUSE_NO_OP',providerCallsMade:games.pages+opening.pages,providerGames:games.rows.length,openingRows:opening.rows.length,normalizedRows:normalized.length,inserted:fresh.length,reused:existing.size,mappingAnomalies,blocked}
}

async function scoreAndFreeze(targetDate:string,now:Date){
  const [features,opening,games]=await Promise.all([
    supabaseAdmin.from('mlb_ml_xyear_features_v1').select('canonical_game_id,game_pk,game_date,home_team,away_team,feature_cutoff_date,feature_version,home_win_pct,away_win_pct,home_run_diff_pg,away_run_diff_pg,home_pyth_win_pct,away_pyth_win_pct,home_l5_win_pct,away_l5_win_pct,home_sp_ra9,away_sp_ra9,home_bullpen_ra9,away_bullpen_ra9,actual_winner').eq('season',2026).eq('game_date',targetDate).limit(50),
    supabaseAdmin.from(OPENING_TABLE).select('xyear_canonical_game_id,vendor,outcome,price,opened_at').eq('game_date',targetDate).in('vendor',[...REQUIRED_BOOKS]).limit(500),
    supabaseAdmin.from('mlb_ml_xyear_game_v1').select('canonical_game_id,game_pk,scheduled_at').eq('season',2026).eq('game_date',targetDate).limit(50)
  ])
  if(features.error)throw new Error('FORWARD_FEATURE_READ_FAILED:'+features.error.message)
  if(opening.error)throw new Error('FORWARD_OPENING_READ_FAILED:'+opening.error.message)
  if(games.error)throw new Error('FORWARD_GAME_READ_FAILED:'+games.error.message)

  const gameMap=new Map((games.data??[]).map(g=>[String(g.canonical_game_id),g]))
  const byGame=new Map<string,Map<string,{home?:number;away?:number;openedAt?:string}>>()
  for(const row of opening.data??[]){
    const gid=String(row.xyear_canonical_game_id),vendor=String(row.vendor),books=byGame.get(gid)??new Map()
    const b=books.get(vendor)??{}
    if(row.outcome==='home')b.home=Number(row.price)
    if(row.outcome==='away')b.away=Number(row.price)
    b.openedAt=String(row.opened_at);books.set(vendor,b);byGame.set(gid,books)
  }

  const candidates:Array<Record<string,unknown>>=[]
  for(const f of features.data??[]){
    const gid=String(f.canonical_game_id),g=gameMap.get(gid),books=byGame.get(gid)
    if(!g||!g.scheduled_at||Date.parse(String(g.scheduled_at))<=now.getTime())continue
    if(f.actual_winner!==null)continue
    if(String(f.feature_cutoff_date??'')>=targetDate)continue
    if(!books||!REQUIRED_BOOKS.every(v=>books.get(v)?.home&&books.get(v)?.away))continue

    const numeric=[f.home_win_pct,f.away_win_pct,f.home_run_diff_pg,f.away_run_diff_pg,f.home_pyth_win_pct,f.away_pyth_win_pct,f.home_l5_win_pct,f.away_l5_win_pct,f.home_sp_ra9,f.away_sp_ra9,f.home_bullpen_ra9,f.away_bullpen_ra9]
    if(numeric.some(v=>v===null||v===undefined||!Number.isFinite(Number(v))))continue

    const probs=REQUIRED_BOOKS.map(v=>{
      const b=books.get(v)!;const hi=americanImplied(b.home!),ai=americanImplied(b.away!)
      return hi/(hi+ai)
    })
    const homeProb=(probs[0]+probs[1])/2
    const favoriteProb=Math.max(homeProb,1-homeProb),homeFav=homeProb>=0.5
    const vals=[
      homeFav?Number(f.home_win_pct)>Number(f.away_win_pct):Number(f.away_win_pct)>Number(f.home_win_pct),
      homeFav?Number(f.home_run_diff_pg)>Number(f.away_run_diff_pg):Number(f.away_run_diff_pg)>Number(f.home_run_diff_pg),
      homeFav?Number(f.home_pyth_win_pct)>Number(f.away_pyth_win_pct):Number(f.away_pyth_win_pct)>Number(f.home_pyth_win_pct),
      homeFav?Number(f.home_l5_win_pct)>Number(f.away_l5_win_pct):Number(f.away_l5_win_pct)>Number(f.home_l5_win_pct),
      homeFav?Number(f.home_sp_ra9)<Number(f.away_sp_ra9):Number(f.away_sp_ra9)<Number(f.home_sp_ra9),
      homeFav?Number(f.home_bullpen_ra9)<Number(f.away_bullpen_ra9):Number(f.away_bullpen_ra9)<Number(f.home_bullpen_ra9),
    ]
    const votes=vals.filter(Boolean).length
    if(favoriteProb<FAVORITE_THRESHOLD||votes!==REQUIRED_VOTES)continue

    const pick=homeFav?String(f.home_team):String(f.away_team),side=homeFav?'HOME':'AWAY'
    const featureSnapshot={
      home_win_pct:f.home_win_pct,away_win_pct:f.away_win_pct,
      home_run_diff_pg:f.home_run_diff_pg,away_run_diff_pg:f.away_run_diff_pg,
      home_pyth_win_pct:f.home_pyth_win_pct,away_pyth_win_pct:f.away_pyth_win_pct,
      home_l5_win_pct:f.home_l5_win_pct,away_l5_win_pct:f.away_l5_win_pct,
      home_sp_ra9:f.home_sp_ra9,away_sp_ra9:f.away_sp_ra9,
      home_bullpen_ra9:f.home_bullpen_ra9,away_bullpen_ra9:f.away_bullpen_ra9
    }
    const mgm=books.get('betmgm')!,br=books.get('betrivers')!
    candidates.push({
      id:'mlopenfwd_'+hash([FORMULA_ID,f.game_pk]),
      formula_id:FORMULA_ID,target_date:targetDate,game_pk:f.game_pk,xyear_canonical_game_id:gid,scheduled_at:g.scheduled_at,
      home_team:f.home_team,away_team:f.away_team,pick,pick_side:side,favorite_probability:favoriteProb,aligned_votes:votes,
      betmgm_price:homeFav?mgm.home:mgm.away,betrivers_price:homeFav?br.home:br.away,
      betmgm_no_vig_probability:homeFav?probs[0]:1-probs[0],betrivers_no_vig_probability:homeFav?probs[1]:1-probs[1],
      feature_cutoff_date:f.feature_cutoff_date,feature_version:f.feature_version,feature_snapshot:featureSnapshot,
      opening_snapshot:{betmgm:mgm,betrivers:br,consensus_home_probability:homeProb},
      freeze_timestamp:now.toISOString(),status:'PENDING',
      metadata:{researchOnly:true,productionEligible:false,officialPicksEligible:false,apostarEnabled:false,formulaState:'EXTERNAL_ACCURACY_PASS_N_AND_STABILITY_FAIL_NO_RETUNE',strictPregame:true}
    })
  }

  const existing=new Set<string>()
  if(candidates.length){
    const r=await supabaseAdmin.from(FORWARD_TABLE).select('id').in('id',candidates.map(x=>String(x.id)))
    if(r.error)throw new Error('FORWARD_EXISTING_READ_FAILED:'+r.error.message)
    for(const row of r.data??[])existing.add(String(row.id))
    const fresh=candidates.filter(x=>!existing.has(String(x.id)))
    if(fresh.length){const w=await supabaseAdmin.from(FORWARD_TABLE).insert(fresh);if(w.error)throw new Error('FORWARD_FREEZE_WRITE_FAILED:'+w.error.message)}
    return {evaluatedGames:(features.data??[]).length,qualifiers:candidates.length,inserted:fresh.length,reused:existing.size,candidates:candidates.map(x=>({gamePk:x.game_pk,matchup:String(x.away_team)+' @ '+String(x.home_team),pick:x.pick,favoriteProbability:x.favorite_probability,alignedVotes:x.aligned_votes,betmgmPrice:x.betmgm_price,betriversPrice:x.betrivers_price}))}
  }
  return {evaluatedGames:(features.data??[]).length,qualifiers:0,inserted:0,reused:0,candidates:[]}
}

export async function runMlbOpeningConsensusProspective(input:{targetDate?:string;now?:Date}={}){
  const now=input.now??new Date(),targetDate=input.targetDate??prDate(now)
  const base={researchOnly:true,productionEligible:false,officialPicksModified:false,apostarActivated:false,modelRetuned:false,historicalOddsApiCalls:0,formulaId:FORMULA_ID,targetDate}
  const stage=await stageSchedule(targetDate,now)
  if(stage.futureGames===0)return {...base,success:true,status:'NO_FUTURE_GAMES',stage,providerCallsMade:0}
  const materialization=await materialize(targetDate)
  if(String(materialization.result.syncStatus)!=='COMPLETE'||String(materialization.result.integrityStatus)!=='READY_CORE_FAIL_CLOSED'){
    return {...base,success:false,status:'BLOCKED_MATERIALIZATION_NOT_COMPLETE',stage,materialization,providerCallsMade:0}
  }
  if(Number(materialization.result.cutoffViolationRows??0)!==0||Number(materialization.result.starterEvidenceTimeViolations??0)!==0){
    return {...base,success:false,status:'BLOCKED_PREGAME_LINEAGE_VIOLATION',stage,materialization,providerCallsMade:0}
  }
  const opening=await captureOpening(targetDate)
  if(opening.success===false)return {...base,success:false,status:opening.status,stage,materialization,opening,providerCallsMade:opening.providerCallsMade}
  const freeze=await scoreAndFreeze(targetDate,now)
  return {...base,success:true,status:freeze.qualifiers?'FORWARD_CANDIDATES_FROZEN':'NO_THRESHOLD_CROSSING',stage,materialization,opening,freeze,providerCallsMade:opening.providerCallsMade}
}
