import 'server-only';
import {cache} from 'react';
import {supabaseAdmin as db} from '@/lib/supabase-admin';
import type {SportModelCard} from '@/lib/sport-model-overview';
const SPORT='basketball_nba',ORIGIN='CURRENT_ERA_SHADOW',POLICY='NBA_GOAT_ARCHIVE_SHADOW_V1';
type Row={id:string;game_id:string;commence_time:string;home_team:string;away_team:string;market:string;team:string|null;selection:string|null;line:number|null;sportsbook:string|null;odds:number|null;model_probability:number|null;implied_probability:number|null;edge:number|null;ev:number|null;confidence:number|null;result:string|null;status:string|null;lifecycle_status:string|null;created_at:string;recommended_pick:boolean|null;production_eligible:boolean|null;feature_snapshot:Record<string,unknown>|null};
function accuracy(w:number,l:number){return w+l?w/(w+l):null}
function metric(rows:Row[],market:string){const r=rows.filter(x=>x.market===market),w=r.filter(x=>x.result==='win').length,l=r.filter(x=>x.result==='loss').length,push=r.filter(x=>x.result==='push').length,pending=r.filter(x=>!x.result||x.result==='pending').length;return {market,wins:w,losses:l,pushes:push,pending,accuracy:accuracy(w,l),rows:r.length};}
export const getNbaGoatModelReport=cache(async()=>{
 const q=await db.from('prediction_history').select('id,game_id,commence_time,home_team,away_team,market,team,selection,line,sportsbook,odds,model_probability,implied_probability,edge,ev,confidence,result,status,lifecycle_status,created_at,recommended_pick,production_eligible,feature_snapshot').eq('sport_key',SPORT).eq('prediction_origin',ORIGIN).eq('feature_snapshot->>goatProviderPolicy',POLICY).order('created_at',{ascending:false}).limit(500);
 if(q.error)throw Error('NBA_GOAT_MODEL_REPORT_READ_FAILED');
 const rows=(q.data??[]) as Row[];
 if(rows.length>=500)throw Error('NBA_GOAT_MODEL_REPORT_SCAN_LIMIT');
 for(const r of rows){if(!['moneyline','spread','total'].includes(r.market)||!['pending','win','loss','push',null].includes(r.result as any)||r.recommended_pick!==false||r.production_eligible!==false)throw Error('NBA_GOAT_MODEL_REPORT_INTEGRITY_FAILED');}
 const metrics=['moneyline','spread','total'].map(m=>metric(rows,m));
 return {status:'AVAILABLE',policy:POLICY,checked_at:new Date().toISOString(),rows,metrics,total:{rows:rows.length,pending:rows.filter(r=>!r.result||r.result==='pending').length,wins:rows.filter(r=>r.result==='win').length,losses:rows.filter(r=>r.result==='loss').length,pushes:rows.filter(r=>r.result==='push').length},read_only:true};
});
export async function getNbaGoatModelCard():Promise<SportModelCard>{
 try{
  const r=await getNbaGoatModelReport(),m=r.metrics.find(x=>x.market==='moneyline')!;
  const details=r.metrics.filter(x=>x.market!=='moneyline').map(x=>`${x.market==='spread'?'Spread':'Total'}: ${x.wins} W / ${x.losses} L · ${x.pending} pendientes · accuracy ${x.accuracy===null?'N/A':(100*x.accuracy).toFixed(2)+'%'}`);
  return {key:'nba',label:'NBA',href:'/nba-market-data',classification:'SHADOW / MODEL_ONLY · GOAT',metricLabel:'Moneyline',linkLabel:'Ver selecciones, cuotas y resultados →',checkedAt:r.checked_at,detailLines:details,cohorts:[{key:'NBA_GOAT',label:'NBA GOAT · cohort prospectivo',available:true,wins:m.wins,losses:m.losses,pending:m.pending,pushes:m.pushes,voids:0,models:1,accuracy:m.accuracy,note:'BALLDONTLIE/GOAT + FanDuel full-game. No incluye las 61 filas legacy ni Official Picks.'}]};
 }catch{return {key:'nba',label:'NBA',href:'/nba-market-data',classification:'SHADOW / MODEL_ONLY · GOAT',metricLabel:'Moneyline',cohorts:[{key:'NBA_GOAT',label:'NBA GOAT · cohort prospectivo',available:false,wins:null,losses:null,pending:null,pushes:null,voids:null,models:null,accuracy:null,note:'Reporte GOAT no verificado; no se sustituye por cero.'}]};}
}
