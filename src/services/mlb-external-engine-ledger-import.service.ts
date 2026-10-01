import 'server-only'

import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isMlbModelGameType } from '@/services/mlb-game-type-policy'

const LEDGER='mlb_2026_forward_master_ledger_v1'
const AUDIT='mlb_external_engine_import_audit_v1'
const SEASON=2026
const PICK_EDGE_REPO='jlebronmarty-netizen/pick-edge'
const EQUILIZER_REPO='jlebronmarty-netizen/equilizer-picks'
const REF='main'
const PE_MODEL='PE_ML_V1'
const EQ_MODEL='EQUILIZER_ML_V2_E2_STABLE6'
const PE_START='2026-09-21'
const PE_END='2026-11-10'
const EQUILIZER_COHORT_DATES=[
  '2026-09-15','2026-09-16','2026-09-18','2026-09-19','2026-09-20',
  '2026-09-21','2026-09-23','2026-09-24','2026-09-25','2026-09-26',
] as const

type JsonMap=Record<string,unknown>
type ExternalRow={
  target_date:string
  game_pk:number
  scheduled_start:string
  home_team:string
  away_team:string
  p_home:number
  p_away:number
  model_id:string
  generated_at:string
  history_cutoff:string
  [key:string]:unknown
}

function hash(value:string){return createHash('sha256').update(value).digest('hex')}
function shortHash(parts:unknown[]){return hash(parts.map(v=>String(v??'null')).join('|')).slice(0,40)}
function rawUrl(repo:string,path:string){
  const encoded=path.split('/').map(encodeURIComponent).join('/')
  return `https://raw.githubusercontent.com/${repo}/${REF}/${encoded}`
}
async function fetchTextMaybe(repo:string,path:string){
  const response=await fetch(rawUrl(repo,path),{cache:'no-store',signal:AbortSignal.timeout(15000)})
  if(response.status===404)return null
  if(!response.ok)throw new Error(`MLB_EXTERNAL_ARTIFACT_HTTP_${response.status}:${repo}:${path}`)
  return response.text()
}
function parseCsv(text:string){
  const rows:string[][]=[]
  let row:string[]=[],field='',quoted=false
  for(let i=0;i<text.length;i++){
    const ch=text[i]
    if(quoted){
      if(ch==='"'&&text[i+1]==='"'){field+='"';i++;continue}
      if(ch==='"'){quoted=false;continue}
      field+=ch;continue
    }
    if(ch==='"'){quoted=true;continue}
    if(ch===','){row.push(field);field='';continue}
    if(ch==='\n'){
      row.push(field.replace(/\r$/,''))
      if(row.some(v=>v.length))rows.push(row)
      row=[];field='';continue
    }
    field+=ch
  }
  if(field.length||row.length){row.push(field.replace(/\r$/,''));if(row.some(v=>v.length))rows.push(row)}
  if(!rows.length)return [] as JsonMap[]
  const headers=rows[0]
  return rows.slice(1).map(values=>Object.fromEntries(headers.map((h,i)=>[h,values[i]??''])))
}
function finite(v:unknown){const n=Number(v);return Number.isFinite(n)?n:null}
function integer(v:unknown){const n=Number(v);return Number.isSafeInteger(n)?n:null}
function text(v:unknown){return typeof v==='string'&&v.trim()?v.trim():null}
function normalizeTeam(v:unknown){
  const s=String(v??'').trim().toUpperCase()
  if(s==='CHW')return 'CWS'
  if(s==='ARI')return 'AZ'
  return s
}
function datePr(now=new Date()){
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{
    timeZone:'America/Puerto_Rico',year:'numeric',month:'2-digit',day:'2-digit',
  }).formatToParts(now).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]))
  return `${p.year}-${p.month}-${p.day}`
}
function addDays(date:string,days:number){
  const d=new Date(`${date}T00:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)
}
function dateRange(start:string,end:string){
  const out:string[]=[]
  for(let d=start;d<=end;d=addDays(d,1))out.push(d)
  return out
}
function record(v:unknown):JsonMap{return v&&typeof v==='object'&&!Array.isArray(v)?v as JsonMap:{}}
function array(v:unknown):JsonMap[]{return Array.isArray(v)?v.filter(x=>x&&typeof x==='object'&&!Array.isArray(x)) as JsonMap[]:[]}

async function gameContext(gamePks:number[]){
  const ids=[...new Set(gamePks.filter(Number.isSafeInteger))]
  const out=new Map<number,{gameType:string;phase:'REGULAR_SEASON'|'POSTSEASON';scheduledAt:string|null;home:string;away:string}>()
  for(let i=0;i<ids.length;i+=100){
    const r=await supabaseAdmin.from('pick2_mlb_games')
      .select('game_pk,game_type,scheduled_at,home_team,away_team')
      .eq('season',SEASON).in('game_pk',ids.slice(i,i+100))
    if(r.error)throw new Error('MLB_EXTERNAL_ENGINE_GAME_CONTEXT:'+r.error.message)
    for(const row of r.data??[]){
      const gamePk=integer(row.game_pk),gameType=text(row.game_type)
      if(gamePk===null||!gameType||!isMlbModelGameType(gameType))continue
      out.set(gamePk,{
        gameType,
        phase:gameType==='R'?'REGULAR_SEASON':'POSTSEASON',
        scheduledAt:text(row.scheduled_at),
        home:normalizeTeam(row.home_team),
        away:normalizeTeam(row.away_team),
      })
    }
  }
  return out
}
async function regularGameFallback(gamePks:number[]){
  const ids=[...new Set(gamePks.filter(Number.isSafeInteger))]
  const out=new Map<number,{gameDate:string;home:string;away:string;winner:string|null;homeScore:number|null;awayScore:number|null}>()
  for(let i=0;i<ids.length;i+=100){
    const r=await supabaseAdmin.from('mlb_ml_xyear_game_v1')
      .select('game_pk,game_date,home_team,away_team,actual_winner,home_score,away_score')
      .eq('season',SEASON).in('game_pk',ids.slice(i,i+100))
    if(r.error)throw new Error('MLB_EXTERNAL_ENGINE_REGULAR_CONTEXT:'+r.error.message)
    for(const row of r.data??[]){
      const gamePk=integer(row.game_pk),gameDate=text(row.game_date)
      if(gamePk===null||!gameDate)continue
      out.set(gamePk,{
        gameDate,
        home:normalizeTeam(row.home_team),
        away:normalizeTeam(row.away_team),
        winner:text(row.actual_winner)?normalizeTeam(row.actual_winner):null,
        homeScore:finite(row.home_score),
        awayScore:finite(row.away_score),
      })
    }
  }
  return out
}

function resolveArtifactContext(
  row:ExternalRow,
  canonical:Map<number,{gameType:string;phase:'REGULAR_SEASON'|'POSTSEASON';scheduledAt:string|null;home:string;away:string}>,
  regularFallback:Map<number,{gameDate:string;home:string;away:string;winner:string|null;homeScore:number|null;awayScore:number|null}>,
){
  const direct=canonical.get(row.game_pk)
  if(direct){
    if(direct.home!==normalizeTeam(row.home_team)||direct.away!==normalizeTeam(row.away_team)){
      throw new Error(`EXTERNAL_ENGINE_TEAM_IDENTITY_MISMATCH:${row.game_pk}`)
    }
    return {...direct,contextSource:'pick2_mlb_games' as const}
  }
  const fallback=regularFallback.get(row.game_pk)
  if(!fallback)return null
  if(fallback.gameDate!==row.target_date)throw new Error(`EXTERNAL_ENGINE_DATE_IDENTITY_MISMATCH:${row.game_pk}`)
  if(fallback.home!==normalizeTeam(row.home_team)||fallback.away!==normalizeTeam(row.away_team)){
    throw new Error(`EXTERNAL_ENGINE_TEAM_IDENTITY_MISMATCH:${row.game_pk}`)
  }
  return {
    gameType:'R',
    phase:'REGULAR_SEASON' as const,
    scheduledAt:null,
    home:fallback.home,
    away:fallback.away,
    contextSource:'mlb_ml_xyear_game_v1_exact_gamePk_regular_fallback' as const,
  }
}

async function canonicalOutcomes(gamePks:number[]){
  const ids=[...new Set(gamePks.filter(Number.isSafeInteger))]
  const out=new Map<number,{winner:string;homeScore:number|null;awayScore:number|null}>()
  for(let i=0;i<ids.length;i+=100){
    const r=await supabaseAdmin.from('mlb_ml_xyear_game_v1')
      .select('game_pk,actual_winner,home_score,away_score')
      .eq('season',SEASON).in('game_pk',ids.slice(i,i+100))
    if(r.error)throw new Error('MLB_EXTERNAL_ENGINE_OUTCOME_READ:'+r.error.message)
    for(const row of r.data??[]){
      const gamePk=integer(row.game_pk),winner=text(row.actual_winner)
      if(gamePk===null||!winner)continue
      out.set(gamePk,{winner:normalizeTeam(winner),homeScore:finite(row.home_score),awayScore:finite(row.away_score)})
    }
  }
  return out
}
function topSide(row:ExternalRow){
  return row.p_home>=row.p_away
    ? {side:'HOME',team:normalizeTeam(row.home_team),prob:row.p_home}
    : {side:'AWAY',team:normalizeTeam(row.away_team),prob:row.p_away}
}

async function importPickEdge(dates:string[]){
  const artifacts:Array<{date:string;manifest:JsonMap;manifestText:string;csvText:string;settlement:JsonMap|null;settlementText:string|null;rows:ExternalRow[]}>=[]

  for(const date of dates){
    const manifestPath=`predictions/shadow/${date}_PE_ML_V1.manifest.json`
    const manifestText=await fetchTextMaybe(PICK_EDGE_REPO,manifestPath)
    if(!manifestText)continue
    const manifest=JSON.parse(manifestText) as JsonMap
    if(manifest.model_id!==PE_MODEL||manifest.contract!=='PE_ML_V1_DAILY_FREEZE/1.0.0')throw new Error(`PE_ARTIFACT_CONTRACT_MISMATCH:${date}`)
    if(manifest.generated_before_all_game_starts!==true)throw new Error(`PE_ARTIFACT_NOT_PREGAME:${date}`)
    const csvPath=String(manifest.csv_path??'')
    if(!csvPath.startsWith('predictions/shadow/'))throw new Error(`PE_CSV_PATH_INVALID:${date}`)
    const csvText=await fetchTextMaybe(PICK_EDGE_REPO,csvPath)
    if(csvText===null)throw new Error(`PE_CSV_MISSING:${date}`)
    if(hash(csvText)!==String(manifest.csv_sha256))throw new Error(`PE_CSV_SHA_MISMATCH:${date}`)
    const parsed=parseCsv(csvText).map(row=>({
      ...row,
      target_date:String(row.target_date),
      game_pk:Number(row.game_pk),
      scheduled_start:String(row.scheduled_start),
      home_team:String(row.home_team),
      away_team:String(row.away_team),
      p_home:Number(row.p_home),
      p_away:Number(row.p_away),
      model_id:String(row.model_id),
      generated_at:String(row.generated_at),
      history_cutoff:String(row.history_cutoff),
    } as ExternalRow))
    if(parsed.length!==Number(manifest.games??0))throw new Error(`PE_ROW_COUNT_MISMATCH:${date}`)

    const settlementPath=`predictions/settled/${date}_PE_ML_V1.settlement.json`
    const settlementText=await fetchTextMaybe(PICK_EDGE_REPO,settlementPath)
    const settlement=settlementText?JSON.parse(settlementText) as JsonMap:null
    if(settlement){
      const source=record(settlement.source_freeze)
      if(source.csv_sha256!==manifest.csv_sha256||source.csv_path!==manifest.csv_path)throw new Error(`PE_SETTLEMENT_FREEZE_MISMATCH:${date}`)
    }
    artifacts.push({date,manifest,manifestText,csvText,settlement,settlementText,rows:parsed})
  }

  const allRows=artifacts.flatMap(a=>a.rows)
  const context=await gameContext(allRows.map(r=>r.game_pk))
  const regularFallback=await regularGameFallback(allRows.map(r=>r.game_pk))
  const ledgerRows:any[]=[]
  const auditRows:any[]=[]

  for(const artifact of artifacts){
    const settlementRows=new Map<number,JsonMap>()
    if(artifact.settlement)for(const row of array(artifact.settlement.rows)){
      const gp=integer(row.game_pk);if(gp!==null)settlementRows.set(gp,row)
    }
    let settled=0,voided=0
    for(const row of artifact.rows){
      const ctx=resolveArtifactContext(row,context,regularFallback)
      if(!ctx)continue
      const top=topSide(row)
      const sr=settlementRows.get(row.game_pk)
      let result:null|'WIN'|'LOSS'|'VOID'=null,actualLabel:string|null=null
      if(sr){
        if(sr.result==='VOID'){result='VOID';voided++}
        else if(sr.result==='SETTLED'&&typeof sr.correct_top_side==='boolean'){
          result=sr.correct_top_side?'WIN':'LOSS';settled++
          actualLabel=sr.actual_side==='HOME'?normalizeTeam(row.home_team):sr.actual_side==='AWAY'?normalizeTeam(row.away_team):null
        }
      }
      const sourceRelation='github_artifact:pick-edge'
      const sourceRowId=`${artifact.manifest.csv_path}:${row.game_pk}`
      ledgerRows.push({
        id:'mlb26fwd_'+shortHash([sourceRelation,sourceRowId,PE_MODEL]),
        season:2026,season_phase:ctx.phase,game_type:ctx.gameType,target_date:row.target_date,
        game_pk:row.game_pk,scheduled_at:row.scheduled_start||ctx.scheduledAt,
        engine:'PICK_EDGE',model_id:PE_MODEL,contract_id:'PE_ML_V1_DAILY_FREEZE/1.0.0',
        evidence_class:ctx.phase==='POSTSEASON'?'POSTSEASON_SHADOW_DOMAIN_SHIFT_PE_ML_V1':'REGULAR_SEASON_FORWARD_PE_ML_V1',
        market:'moneyline_probability',line:null,direction:'TOP_SIDE_ML',selection:top.team,
        player_mlbam_id:null,player_name:null,sportsbook:null,odds:null,odds_snapshot_id:null,
        projection:finite(row.home_run_margin),model_probability:top.prob,historical_accuracy:null,threshold:null,
        freeze_timestamp:String(artifact.manifest.generated_at),
        source_relation:sourceRelation,source_row_id:sourceRowId,
        result,actual_value:null,actual_label:actualLabel,settled_at:sr&&result?String(artifact.settlement?.outcome_source?record(artifact.settlement.outcome_source).acquired_at??'': '')||null:null,
        metadata:{
          pHome:row.p_home,pAway:row.p_away,predictedSide:top.side,
          recommendation:false,continuousProbability:true,
          manifestPath:`predictions/shadow/${artifact.date}_PE_ML_V1.manifest.json`,
          manifestSha256:hash(artifact.manifestText),csvPath:artifact.manifest.csv_path,csvSha256:artifact.manifest.csv_sha256,
          settlementPath:artifact.settlement?`predictions/settled/${artifact.date}_PE_ML_V1.settlement.json`:null,
          settlementRow:sr??null,
          historyCutoff:row.history_cutoff,
          contextSource:ctx.contextSource,
          inferenceVersion:row.inference_version??null,
          moneylineInputDigest:row.moneyline_input_digest??null,
          moneylineOutputDigest:row.moneyline_output_digest??null,
        },
        research_only:true,production_eligible:false,official_picks_eligible:false,apostar_enabled:false,updated_at:new Date().toISOString(),
      })
    }
    auditRows.push({
      id:'mlbext_'+shortHash(['PICK_EDGE',PE_MODEL,artifact.date,artifact.manifest.csv_sha256]),
      engine:'PICK_EDGE',model_id:PE_MODEL,target_date:artifact.date,repo:PICK_EDGE_REPO,repo_ref:REF,
      manifest_path:`predictions/shadow/${artifact.date}_PE_ML_V1.manifest.json`,
      manifest_sha256:hash(artifact.manifestText),csv_path:String(artifact.manifest.csv_path),csv_sha256:String(artifact.manifest.csv_sha256),
      settlement_path:artifact.settlement?`predictions/settled/${artifact.date}_PE_ML_V1.settlement.json`:null,
      settlement_sha256:artifact.settlementText?hash(artifact.settlementText):null,
      artifact_status:String(artifact.manifest.status??'UNKNOWN'),rows_imported:artifact.rows.length,rows_settled:settled,rows_void:voided,
      verification:{csvShaVerified:true,generatedBeforeAllStarts:true,sourceFreezeMatched:artifact.settlement?true:null},
      research_only:true,production_eligible:false,official_picks_eligible:false,apostar_enabled:false,updated_at:new Date().toISOString(),
    })
  }
  return {ledgerRows,auditRows,artifacts:artifacts.length}
}

async function importEquilizer(){
  const artifacts:Array<{date:string;manifest:JsonMap;manifestText:string;csvText:string;rows:ExternalRow[]}>=[]

  for(const date of EQUILIZER_COHORT_DATES){
    const manifestPath=`predictions/shadow/${date}_E2_STABLE6.manifest.json`
    const manifestText=await fetchTextMaybe(EQUILIZER_REPO,manifestPath)
    if(!manifestText)throw new Error(`EQUILIZER_FROZEN_MANIFEST_MISSING:${date}`)
    const manifest=JSON.parse(manifestText) as JsonMap
    if(manifest.model_id!==EQ_MODEL)throw new Error(`EQUILIZER_MODEL_MISMATCH:${date}`)
    if(manifest.generated_before_all_game_starts!==true||manifest.immutable_after_generation!==true)throw new Error(`EQUILIZER_ARTIFACT_NOT_IMMUTABLE_PREGAME:${date}`)
    const csvPath=String(manifest.csv_path??'')
    const csvText=await fetchTextMaybe(EQUILIZER_REPO,csvPath)
    if(csvText===null)throw new Error(`EQUILIZER_CSV_MISSING:${date}`)
    if(hash(csvText)!==String(manifest.csv_sha256))throw new Error(`EQUILIZER_CSV_SHA_MISMATCH:${date}`)
    const parsed=parseCsv(csvText).map(row=>({
      ...row,target_date:String(row.target_date),game_pk:Number(row.game_pk),scheduled_start:String(row.scheduled_start),
      home_team:String(row.home_team),away_team:String(row.away_team),p_home:Number(row.p_home),p_away:Number(row.p_away),
      model_id:String(row.model_id),generated_at:String(row.generated_at),history_cutoff:String(row.history_cutoff),
    } as ExternalRow))
    if(parsed.length!==Number(manifest.games??0))throw new Error(`EQUILIZER_ROW_COUNT_MISMATCH:${date}`)
    artifacts.push({date,manifest,manifestText,csvText,rows:parsed})
  }

  const allRows=artifacts.flatMap(a=>a.rows)
  const context=await gameContext(allRows.map(r=>r.game_pk))
  const regularFallback=await regularGameFallback(allRows.map(r=>r.game_pk))
  const outcomes=await canonicalOutcomes(allRows.map(r=>r.game_pk))
  const ledgerRows:any[]=[],auditRows:any[]=[]

  for(const artifact of artifacts){
    let settled=0
    for(const row of artifact.rows){
      const ctx=resolveArtifactContext(row,context,regularFallback)
      if(!ctx)continue
      if(ctx.gameType!=='R')throw new Error(`EQUILIZER_ORIGINAL_COHORT_NON_REGULAR_GAME:${row.game_pk}`)
      const top=topSide(row),outcome=outcomes.get(row.game_pk)
      const result=outcome?(normalizeTeam(outcome.winner)===top.team?'WIN':'LOSS'):null
      if(result)settled++
      const sourceRelation='github_artifact:equilizer'
      const sourceRowId=`${artifact.manifest.csv_path}:${row.game_pk}`
      ledgerRows.push({
        id:'mlb26fwd_'+shortHash([sourceRelation,sourceRowId,EQ_MODEL]),
        season:2026,season_phase:'REGULAR_SEASON',game_type:'R',target_date:row.target_date,
        game_pk:row.game_pk,scheduled_at:row.scheduled_start||ctx.scheduledAt,
        engine:'EQUILIZER',model_id:EQ_MODEL,contract_id:'EQUILIZER_ML_V2_E2_MODEL_CONTRACT/1.0.0',
        evidence_class:'REGULAR_SEASON_FORWARD_EQUILIZER_E2_ORIGINAL_COHORT',
        market:'moneyline_probability',line:null,direction:'TOP_SIDE_ML',selection:top.team,
        player_mlbam_id:null,player_name:null,sportsbook:null,odds:null,odds_snapshot_id:null,
        projection:null,model_probability:top.prob,historical_accuracy:null,threshold:null,
        freeze_timestamp:String(artifact.manifest.generated_at),source_relation:sourceRelation,source_row_id:sourceRowId,
        result,actual_value:null,actual_label:outcome?.winner??null,settled_at:result?new Date().toISOString():null,
        metadata:{
          pHome:row.p_home,pAway:row.p_away,predictedSide:top.side,recommendation:false,continuousProbability:true,
          manifestPath:`predictions/shadow/${artifact.date}_E2_STABLE6.manifest.json`,manifestSha256:hash(artifact.manifestText),
          csvPath:artifact.manifest.csv_path,csvSha256:artifact.manifest.csv_sha256,historyCutoff:row.history_cutoff,
          originalCohort:true,postseasonEnrollmentAllowed:false,contextSource:ctx.contextSource,
          outcomeSource:'mlb_ml_xyear_game_v1 canonical official-final materialization',
          homeScore:outcome?.homeScore??null,awayScore:outcome?.awayScore??null,
        },
        research_only:true,production_eligible:false,official_picks_eligible:false,apostar_enabled:false,updated_at:new Date().toISOString(),
      })
    }
    auditRows.push({
      id:'mlbext_'+shortHash(['EQUILIZER',EQ_MODEL,artifact.date,artifact.manifest.csv_sha256]),
      engine:'EQUILIZER',model_id:EQ_MODEL,target_date:artifact.date,repo:EQUILIZER_REPO,repo_ref:REF,
      manifest_path:`predictions/shadow/${artifact.date}_E2_STABLE6.manifest.json`,
      manifest_sha256:hash(artifact.manifestText),csv_path:String(artifact.manifest.csv_path),csv_sha256:String(artifact.manifest.csv_sha256),
      settlement_path:null,settlement_sha256:null,artifact_status:'IMMUTABLE_PREGAME_FREEZE',
      rows_imported:artifact.rows.length,rows_settled:settled,rows_void:0,
      verification:{csvShaVerified:true,generatedBeforeAllStarts:true,immutableAfterGeneration:true,originalRegularSeasonCohort:true},
      research_only:true,production_eligible:false,official_picks_eligible:false,apostar_enabled:false,updated_at:new Date().toISOString(),
    })
  }
  return {ledgerRows,auditRows,artifacts:artifacts.length}
}

async function writeRows(table:string,rows:any[],onConflict:string){
  for(let i=0;i<rows.length;i+=100){
    const r=await supabaseAdmin.from(table).upsert(rows.slice(i,i+100),{onConflict})
    if(r.error)throw new Error(`MLB_EXTERNAL_ENGINE_WRITE:${table}:${r.error.message}`)
  }
}

export async function importMlbExternalEngineArtifacts(input:{now?:Date}={}){
  const today=datePr(input.now??new Date())
  const peEnd=today<PE_END?today:PE_END
  const peDates=peEnd>=PE_START?dateRange(PE_START,peEnd):[]
  const [pe,eq]=await Promise.all([importPickEdge(peDates),importEquilizer()])
  const ledgerRows=[...pe.ledgerRows,...eq.ledgerRows]
  const auditRows=[...pe.auditRows,...eq.auditRows]
  await writeRows(LEDGER,ledgerRows,'id')
  await writeRows(AUDIT,auditRows,'id')
  return {
    success:true,status:'MLB_EXTERNAL_ENGINE_ARTIFACTS_IMPORTED',
    researchOnly:true,productionEligible:false,officialPicksModified:false,apostarActivated:false,
    ledgerRows:ledgerRows.length,auditRows:auditRows.length,
    pickEdge:{artifacts:pe.artifacts,rows:pe.ledgerRows.length},
    equilizer:{artifacts:eq.artifacts,rows:eq.ledgerRows.length,originalCohortOnly:true},
  }
}
