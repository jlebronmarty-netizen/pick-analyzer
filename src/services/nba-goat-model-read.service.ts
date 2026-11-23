import 'server-only';
import {cache} from 'react';
import {supabaseAdmin as db} from '@/lib/supabase-admin';
import type {SportModelCard} from '@/lib/sport-model-overview';
import {buildNbaVersionReport,type NbaVersionRow} from '@/lib/nba/model-version-evidence';

const SPORT='basketball_nba',ORIGIN='CURRENT_ERA_SHADOW',POLICY='NBA_GOAT_ARCHIVE_SHADOW_V1';
type Row=NbaVersionRow & {home_team:string;away_team:string;team:string|null;selection:string|null;line:number|null;sportsbook:string|null;odds:number|null;implied_probability:number|null;edge:number|null;ev:number|null;confidence:number|null;status:string|null;lifecycle_status:string|null;feature_snapshot:Record<string,unknown>|null};

export const getNbaGoatModelReport=cache(async()=>{
 const q=await db.from('prediction_history').select('id,game_id,model_version,commence_time,home_team,away_team,market,team,selection,line,sportsbook,odds,model_probability,implied_probability,edge,ev,confidence,result,status,lifecycle_status,generated_at,created_at,settled_at,recommended_pick,production_eligible,feature_snapshot').eq('sport_key',SPORT).eq('prediction_origin',ORIGIN).eq('feature_snapshot->>goatProviderPolicy',POLICY).order('created_at',{ascending:false}).limit(500);
 if(q.error)throw Error('NBA_GOAT_MODEL_REPORT_READ_FAILED');
 const rows=(q.data??[]) as Row[];
 if(rows.length>=500)throw Error('NBA_GOAT_MODEL_REPORT_SCAN_LIMIT');
 return {status:'AVAILABLE',policy:POLICY,checked_at:new Date().toISOString(),...buildNbaVersionReport(rows),read_only:true};
});

export async function getNbaGoatModelCard():Promise<SportModelCard>{
 try{
  const r=await getNbaGoatModelReport();
  const details=r.versions.flatMap(version=>version.metrics.filter(x=>x.market!=='moneyline').map(x=>`${version.modelVersion} · ${x.market==='spread'?'Spread':'Total'}: ${x.wins} W / ${x.losses} L · ${x.pending} pendientes · accuracy ${x.accuracy===null?'N/A':(100*x.accuracy).toFixed(2)+'%'} · ${x.settledUniqueGames} juegos liquidados`));
  return {key:'nba',label:'NBA',href:'/nba-decision-board',classification:'SHADOW / MODEL_ONLY · GOAT',metricLabel:'Moneyline',linkLabel:'Abrir Decision Board NBA →',checkedAt:r.checked_at,detailLines:details,models:r.models,
   cohorts:r.versions.map(version=>{
    const m=version.metrics.find(x=>x.market==='moneyline')!;
    return {key:'NBA_GOAT:'+version.modelVersion,label:'NBA GOAT · '+version.modelVersion,modelVersion:version.modelVersion,aggregationGroup:'NBA_GOAT',market:'moneyline',available:true,wins:m.wins,losses:m.losses,pending:m.pending,pushes:m.pushes,voids:0,models:1,accuracy:m.accuracy,uniqueGames:m.uniqueGames,settledUniqueGames:m.settledUniqueGames,note:'Registros de esta versión, sin combinar cohortes. Accuracy descriptiva por contrato; los juegos se cuentan aparte. Probabilidades exploratorias sin validación. No incluye legacy ni Official Picks.'};
   })};
 }catch{return {key:'nba',label:'NBA',href:'/nba-decision-board',classification:'SHADOW / MODEL_ONLY · GOAT',metricLabel:'Moneyline',cohorts:[{key:'NBA_GOAT',label:'NBA GOAT · cohort prospectivo',available:false,wins:null,losses:null,pending:null,pushes:null,voids:null,models:null,accuracy:null,note:'Reporte GOAT no verificado; no se sustituye por cero.'}]};}
}
