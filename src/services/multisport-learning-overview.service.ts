import 'server-only';
import {supabaseAdmin as db} from '@/lib/supabase-admin';

type LearningState='COLLECTING'|'MONITORING'|'PATTERN_DETECTED'|'VALIDATED_CANDIDATE';
type SportLearning={
  sport:string;
  model:string;
  settled:number;
  wins:number;
  losses:number;
  pushes:number;
  accuracy:number|null;
  numericEvaluations:number;
  mae:number|null;
  recentSettled:number;
  recentAccuracy:number|null;
  state:LearningState;
  summary:string;
  evidence:string[];
  candidate:null|{title:string;reason:string;validation:string;requiresApproval:true};
};

const pct=(w:number,l:number)=>w+l?w/(w+l):null;
const average=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
const canonical=(v:any)=>String(v??'').toUpperCase();
const resultWL=(v:any)=>{const x=canonical(v);return x==='WIN'||x==='W'?'W':x==='LOSS'||x==='L'?'L':x==='PUSH'?'PUSH':null};

function stateFor(s:SportLearning):SportLearning{
  if(s.candidate)return {...s,state:'VALIDATED_CANDIDATE'};
  if(s.settled<20&&s.numericEvaluations<20)return {...s,state:'COLLECTING',summary:'Muestra todavía pequeña; no se propone ningún cambio.'};
  const recentDrift=s.accuracy!==null&&s.recentAccuracy!==null&&s.recentSettled>=10&&(s.accuracy-s.recentAccuracy)>=0.10;
  if(recentDrift)return {...s,state:'PATTERN_DETECTED',summary:'Hay una señal de deterioro reciente que merece diagnóstico, pero todavía no es una mejora validada.'};
  return {...s,state:'MONITORING',summary:'Hay evidencia suficiente para monitoreo, pero no existe una corrección validada que justifique cambiar el modelo.'};
}

async function nba():Promise<SportLearning>{
 const q=await db.from('prediction_history').select('result,settled_at,market,model_version,feature_snapshot').eq('sport_key','basketball_nba').eq('prediction_origin','CURRENT_ERA_SHADOW').eq('feature_snapshot->>goatProviderPolicy','NBA_GOAT_ARCHIVE_SHADOW_V1').not('settled_at','is',null).order('settled_at',{ascending:false}).limit(500);
 if(q.error)throw Error('NBA_LEARNING_READ_FAILED');
 const rows=q.data??[], wl=rows.map(r=>resultWL(r.result)).filter(Boolean), wins=wl.filter(x=>x==='W').length,losses=wl.filter(x=>x==='L').length,pushes=wl.filter(x=>x==='PUSH').length;
 const recent=wl.slice(0,25),rw=recent.filter(x=>x==='W').length,rl=recent.filter(x=>x==='L').length;
 return stateFor({sport:'NBA',model:'NBA GOAT',settled:wins+losses+pushes,wins,losses,pushes,accuracy:pct(wins,losses),numericEvaluations:0,mae:null,recentSettled:recent.length,recentAccuracy:pct(rw,rl),state:'COLLECTING',summary:'',evidence:['Pregame freeze + settlement archivado','NBA Causal Learning V3 combina Q1-Q4, PBP, lineup esperado/real y player stats','Matchups jugador-vs-defensor y tracking se incorporan solo cuando BALLDONTLIE los confirma'],candidate:null});
}

async function nhl():Promise<SportLearning>{
 const [p,o]=await Promise.all([
  db.from('nhl_free_predictions_v1').select('id,event_id,scheduled_at,body').order('scheduled_at',{ascending:false}).limit(1000),
  db.from('nhl_free_outcomes_v1').select('event_id,observed_at,body').order('observed_at',{ascending:false}).limit(1000)
 ]);
 if(p.error||o.error)throw Error('NHL_LEARNING_READ_FAILED');
 const outcomes=new Map((o.data??[]).map(x=>[x.event_id,x]));
 const rows=(p.data??[]).map(x=>({p:x,o:outcomes.get(x.event_id)})).filter(x=>x.o).map(({p,o}:any)=>{
  const pb=p.body??{},ob=o.body??{},pred=Number(pb.awayProbability)>=Number(pb.homeProbability)?Number(pb.awayId):Number(pb.homeId);
  const actual=Number(ob.awayScore)>Number(ob.homeScore)?Number(ob.awayId):Number(ob.homeId);
  return pred===actual?'W':'L';
 });
 const wins=rows.filter(x=>x==='W').length,losses=rows.filter(x=>x==='L').length,recent=rows.slice(0,25),rw=recent.filter(x=>x==='W').length,rl=recent.filter(x=>x==='L').length;
 return stateFor({sport:'NHL',model:'NHL MODEL_ONLY',settled:wins+losses,wins,losses,pushes:0,accuracy:pct(wins,losses),numericEvaluations:0,mae:null,recentSettled:recent.length,recentAccuracy:pct(rw,rl),state:'COLLECTING',summary:'',evidence:['Probabilidad ML y resultado final almacenados','NHL Causal Learning V1–V3 usa PBP oficial, boxscore y goalie real','Shooter-vs-goalie confirmado se acumula históricamente cuando el PBP lo identifica'],candidate:null});
}

async function ncaab():Promise<SportLearning>{
 const [p,o]=await Promise.all([
  db.from('ncaab_daily_predictions_v1').select('event_id,scheduled_at,body').order('scheduled_at',{ascending:false}).limit(1000),
  db.from('ncaab_daily_outcomes_v1').select('event_id,observed_at,body').order('observed_at',{ascending:false}).limit(1000)
 ]);
 if(p.error||o.error)throw Error('NCAAB_LEARNING_READ_FAILED');
 const om=new Map((o.data??[]).map(x=>[x.event_id,x]));
 const rows=(p.data??[]).map(x=>({p:x,o:om.get(x.event_id)})).filter(x=>x.o).map(({p,o}:any)=>{
  const pb=p.body??{},ob=o.body??{};const predicted=String(pb.predicted_winner??'');
  const actual=Number(ob.home_score)>Number(ob.away_score)?String(ob.home_id):String(ob.away_id);
  return predicted&&actual?predicted===actual?'W':'L':null;
 }).filter(Boolean);
 const wins=rows.filter(x=>x==='W').length,losses=rows.filter(x=>x==='L').length,recent=rows.slice(0,25),rw=recent.filter(x=>x==='W').length,rl=recent.filter(x=>x==='L').length;
 return stateFor({sport:'NCAAB',model:'NCAAB_PRESEASON_V1',settled:wins+losses,wins,losses,pushes:0,accuracy:pct(wins,losses),numericEvaluations:0,mae:null,recentSettled:recent.length,recentAccuracy:pct(rw,rl),state:'COLLECTING',summary:'',evidence:['Forecast prospectivo congelado','NCAAB Causal Learning V1–V3 usa ESPN PBP + boxscore','V3 es jugador-vs-equipo rival; no se afirma defensor individual'],candidate:null});
}

async function edgeSports(){
 const [f,o]=await Promise.all([
  db.from('edge_lab_multi_forecasts_v1').select('id,sport,model_version,market,status,scheduled_at,probability,projection').in('sport',['TT','NCAAF']).order('scheduled_at',{ascending:false}).limit(5000),
  db.from('edge_lab_multi_outcomes_v1').select('forecast_id,status,actual,absolute_error,checked_at').order('checked_at',{ascending:false}).limit(5000)
 ]);
 if(f.error||o.error)throw Error('EDGE_MULTI_LEARNING_READ_FAILED');
 const om=new Map((o.data??[]).map(x=>[x.forecast_id,x]));
 const one=(sport:string,label:string):SportLearning=>{
  const rows=(f.data??[]).filter(x=>x.sport===sport).map(x=>({f:x,o:om.get(x.id)})).filter(x=>x.o);
  const wl=rows.map(x=>resultWL((x.o as any).status)).filter(Boolean),wins=wl.filter(x=>x==='W').length,losses=wl.filter(x=>x==='L').length,pushes=wl.filter(x=>x==='PUSH').length;
  const nums=rows.map(x=>Number((x.o as any).absolute_error)).filter(Number.isFinite),recent=wl.slice(0,25),rw=recent.filter(x=>x==='W').length,rl=recent.filter(x=>x==='L').length;
  return stateFor({sport:sport==='TT'?'Tenis de mesa':'NCAAF',model:label,settled:wins+losses+pushes,wins,losses,pushes,accuracy:pct(wins,losses),numericEvaluations:nums.length,mae:average(nums),recentSettled:recent.length,recentAccuracy:pct(rw,rl),state:'COLLECTING',summary:'',evidence:sport==='TT'?['ML/sets y errores de Total almacenados','Resultados públicos o proveedor con trazabilidad','Secuencia completa punto-a-punto no disponible para todos los partidos']:['Ganador, margen y total pueden evaluarse','ESPN current-season schedules como fuente FREE','Drive-level/play-by-play causal attribution todavía no automatizada'],candidate:null} as any);
 };
 return [one('TT','TT SHADOW'),one('NCAAF','NCAAF PPG V1')];
}
function modelLabel(x:string){return x}

async function soccer():Promise<SportLearning>{
 const [f,o]=await Promise.all([
  db.from('edge_lab_forecasts_v1').select('id,model_version,market,status,scheduled_at,probability').eq('sport','SOCCER').order('scheduled_at',{ascending:false}).limit(2000),
  db.from('edge_lab_outcomes_v1').select('forecast_id,status,checked_at,payload').order('checked_at',{ascending:false}).limit(2000)
 ]);
 if(f.error||o.error)throw Error('SOCCER_LEARNING_READ_FAILED');
 const om=new Map((o.data??[]).map(x=>[x.forecast_id,x])),rows=(f.data??[]).map(x=>({f:x,o:om.get(x.id)})).filter(x=>x.o),wl=rows.map(x=>resultWL((x.o as any).status)).filter(Boolean),wins=wl.filter(x=>x==='W').length,losses=wl.filter(x=>x==='L').length,pushes=wl.filter(x=>x==='PUSH').length,recent=wl.slice(0,25),rw=recent.filter(x=>x==='W').length,rl=recent.filter(x=>x==='L').length;
 return stateFor({sport:'Fútbol',model:'SOCCER_V0_PICK_PORT_1',settled:wins+losses+pushes,wins,losses,pushes,accuracy:pct(wins,losses),numericEvaluations:0,mae:null,recentSettled:recent.length,recentAccuracy:pct(rw,rl),state:'COLLECTING',summary:'',evidence:['1X2 y Total 2.5 prospectivos','Resultado ESPN almacenado','xG/eventos detallados todavía no alimentan diagnóstico causal'],candidate:null});
}

async function ufc():Promise<SportLearning>{
 const [p,r]=await Promise.all([
  db.from('ufc_free_predictions_v1').select('bout_id,scheduled_at,body').order('scheduled_at',{ascending:false}).limit(1000),
  db.from('ufc_free_results_v1').select('bout_id,captured_at,body').order('captured_at',{ascending:false}).limit(1000)
 ]);
 if(p.error||r.error)throw Error('UFC_LEARNING_READ_FAILED');
 const rm=new Map((r.data??[]).map(x=>[x.bout_id,x])),rows=(p.data??[]).map(x=>({p:x,r:rm.get(x.bout_id)})).filter(x=>x.r);
 const wl=rows.map(x=>resultWL((x.r as any)?.body?.outcome??(x.r as any)?.body?.result)).filter(Boolean),wins=wl.filter(x=>x==='W').length,losses=wl.filter(x=>x==='L').length,pushes=wl.filter(x=>x==='PUSH').length,recent=wl.slice(0,25),rw=recent.filter(x=>x==='W').length,rl=recent.filter(x=>x==='L').length;
 return stateFor({sport:'UFC',model:'UFC Elo experimental',settled:wins+losses+pushes,wins,losses,pushes,accuracy:pct(wins,losses),numericEvaluations:0,mae:null,recentSettled:recent.length,recentAccuracy:pct(rw,rl),state:'COLLECTING',summary:'',evidence:['Elo pre-fight almacenado','Resultados se incorporan cuando son inequívocos','Striking/grappling round-level causal attribution pendiente'],candidate:null});
}

async function mlb():Promise<SportLearning>{
 const q=await db.from('mlb_2026_forward_master_ledger_v1').select('result,settled_at,model_id,market,target_date').eq('model_id','EQUILIZER_ML_V2_E2_STABLE6').order('target_date',{ascending:false}).limit(1000);
 if(q.error)throw Error('MLB_LEARNING_READ_FAILED');
 const rows=q.data??[],wl=rows.map(x=>resultWL(x.result)).filter(Boolean),wins=wl.filter(x=>x==='W').length,losses=wl.filter(x=>x==='L').length,pushes=wl.filter(x=>x==='PUSH').length,recent=wl.slice(0,25),rw=recent.filter(x=>x==='W').length,rl=recent.filter(x=>x==='L').length;
 return stateFor({sport:'MLB',model:'EQUILIZER_ML_V2_E2_STABLE6',settled:wins+losses+pushes,wins,losses,pushes,accuracy:pct(wins,losses),numericEvaluations:0,mae:null,recentSettled:recent.length,recentAccuracy:pct(rw,rl),state:'COLLECTING',summary:'',evidence:['Cohorte forward congelada y liquidada','Historial separado de otros motores MLB','Learning Brain y auto-tuning legacy no autorizan promoción multideporte'],candidate:null});
}

export async function getMultisportLearningOverview(){
 const [results,candidatesR]=await Promise.all([
  Promise.allSettled([mlb(),nba(),nhl(),ncaab(),soccer(),ufc(),edgeSports()]),
  db.from('model_learning_candidates_v1').select('sport,model_version,title,state,reason,validation_sample,holdout_sample,validation_evidence,updated_at').in('state',['PATTERN','CHALLENGER_TEST','VALIDATED_CANDIDATE']).order('updated_at',{ascending:false}).limit(100),
 ]);
 const sports:SportLearning[]=[];
 const errors:string[]=[];
 for(const r of results){
  if(r.status==='fulfilled'){if(Array.isArray(r.value))sports.push(...r.value);else sports.push(r.value);}
  else errors.push(r.reason instanceof Error?r.reason.message:'LEARNING_READ_FAILED');
 }
 const candidates=candidatesR.error?[]:(candidatesR.data??[]);
 const validated=candidates.filter((x:any)=>x.state==='VALIDATED_CANDIDATE'&&Number(x.validation_sample)>=20&&Number(x.holdout_sample)>=20);
 const alerts=validated.map((x:any)=>({
  sport:x.sport,
  model:x.model_version,
  candidate:{title:x.title,reason:x.reason,validation:`validation n=${x.validation_sample} · holdout n=${x.holdout_sample}`,requiresApproval:true as const},
 }));
 for(const s of sports){
  const x=validated.find((c:any)=>c.sport===s.sport||c.model_version===s.model);
  if(x){s.state='VALIDATED_CANDIDATE';s.candidate={title:x.title,reason:x.reason,validation:`validation n=${x.validation_sample} · holdout n=${x.holdout_sample}`,requiresApproval:true};s.summary='Existe una mejora candidata validada. Requiere evaluación humana antes de cualquier implementación.';}
 }
 return {
  status:errors.length?'PARTIAL':'AVAILABLE',
  generatedAt:new Date().toISOString(),
  policy:{
   autoApply:false,
   autoPromotion:false,
   notificationGate:'VALIDATED_CANDIDATE_ONLY',
   minimumRule:'A pattern is not a candidate. A candidate requires explicit out-of-sample/holdout improvement evidence.',
  },
  alerts,
  candidates,
  sports:sports.sort((a,b)=>a.sport.localeCompare(b.sport)),
  errors:[...errors,...(candidatesR.error?['LEARNING_CANDIDATE_REGISTRY_UNAVAILABLE']:[])],
 };
}
