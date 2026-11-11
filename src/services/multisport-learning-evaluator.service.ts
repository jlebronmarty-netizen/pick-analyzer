import 'server-only';
import {supabaseAdmin as db} from '@/lib/supabase-admin';

type Rec={at:string;p:number;y:0|1};
type Eval={sport:string;model:string;records:number;state:'INSUFFICIENT_SAMPLE'|'NO_IMPROVEMENT'|'CHALLENGER_TEST'|'VALIDATED_CANDIDATE';alpha:number|null;baseline:any;challenger:any;reason:string};

const finite=(v:any)=>Number.isFinite(Number(v));
const clamp=(p:number)=>Math.max(1e-6,Math.min(1-1e-6,p));
const brier=(rows:Rec[],alpha=1)=>rows.length?rows.reduce((s,r)=>{const p=clamp(.5+alpha*(r.p-.5));return s+(p-r.y)**2},0)/rows.length:null;
const logLoss=(rows:Rec[],alpha=1)=>rows.length?rows.reduce((s,r)=>{const p=clamp(.5+alpha*(r.p-.5));return s-(r.y*Math.log(p)+(1-r.y)*Math.log(1-p))},0)/rows.length:null;
const metrics=(rows:Rec[],alpha=1)=>({n:rows.length,brier:brier(rows,alpha),logLoss:logLoss(rows,alpha)});
const valid=(p:any)=>finite(p)&&Number(p)>0&&Number(p)<1;
const win=(v:any)=>['WIN','W'].includes(String(v??'').toUpperCase());
const loss=(v:any)=>['LOSS','L'].includes(String(v??'').toUpperCase());

function evaluate(sport:string,model:string,input:Rec[]):Eval{
 const rows=input.filter(r=>Number.isFinite(Date.parse(r.at))&&valid(r.p)).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
 if(rows.length<100)return {sport,model,records:rows.length,state:'INSUFFICIENT_SAMPLE',alpha:null,baseline:null,challenger:null,reason:'Se requieren al menos 100 resultados para separar train/validation/holdout con >=20 en cada bloque de evaluación.'};
 const trainEnd=Math.floor(rows.length*.6),validEnd=Math.floor(rows.length*.8),train=rows.slice(0,trainEnd),validation=rows.slice(trainEnd,validEnd),holdout=rows.slice(validEnd);
 if(validation.length<20||holdout.length<20)return {sport,model,records:rows.length,state:'INSUFFICIENT_SAMPLE',alpha:null,baseline:null,challenger:null,reason:'Validation u holdout menor de 20.'};
 const alphas=[.5,.6,.7,.8,.9,1,1.1,1.2,1.3,1.4];
 let alpha=1,best=brier(train,1)!;
 for(const a of alphas){const x=brier(train,a)!;if(x<best-1e-12){best=x;alpha=a;}}
 const baseline={train:metrics(train,1),validation:metrics(validation,1),holdout:metrics(holdout,1)};
 const challenger={alpha,train:metrics(train,alpha),validation:metrics(validation,alpha),holdout:metrics(holdout,alpha)};
 if(alpha===1)return {sport,model,records:rows.length,state:'NO_IMPROVEMENT',alpha,baseline,challenger,reason:'La calibración original fue la mejor en train; no hay propuesta.'};
 const vb=baseline.validation.brier!-challenger.validation.brier!,hb=baseline.holdout.brier!-challenger.holdout.brier!;
 const vl=baseline.validation.logLoss!-challenger.validation.logLoss!,hl=baseline.holdout.logLoss!-challenger.holdout.logLoss!;
 const passed=vb>=.003&&hb>=.003&&vl>0&&hl>0;
 return {sport,model,records:rows.length,state:passed?'VALIDATED_CANDIDATE':'CHALLENGER_TEST',alpha,baseline,challenger,reason:passed
  ?`Recalibración alpha=${alpha.toFixed(1)} mejora Brier validation ${vb.toFixed(4)} y holdout ${hb.toFixed(4)}, y también mejora log loss en ambos bloques. No cambia la selección; solo propone recalibrar confianza.`
  :`Señal en train con alpha=${alpha.toFixed(1)}, pero no supera simultáneamente los gates de validation/holdout (ΔBrier ${vb.toFixed(4)} / ${hb.toFixed(4)}).`};
}

async function mlb():Promise<Rec[]>{
 const q=await db.from('mlb_2026_forward_master_ledger_v1').select('target_date,model_probability,result').eq('model_id','EQUILIZER_ML_V2_E2_STABLE6').order('target_date',{ascending:true}).limit(2000);
 if(q.error)throw Error('MLB_CALIBRATION_READ_FAILED');
 return (q.data??[]).filter(r=>valid(r.model_probability)&&(win(r.result)||loss(r.result))).map(r=>({at:String(r.target_date)+'T12:00:00Z',p:Number(r.model_probability),y:win(r.result)?1:0 as 0|1}));
}
async function nba():Promise<Rec[]>{
 const q=await db.from('prediction_history').select('commence_time,model_probability,result,feature_snapshot').eq('sport_key','basketball_nba').eq('prediction_origin','CURRENT_ERA_SHADOW').eq('feature_snapshot->>goatProviderPolicy','NBA_GOAT_ARCHIVE_SHADOW_V1').order('commence_time',{ascending:true}).limit(2000);
 if(q.error)throw Error('NBA_CALIBRATION_READ_FAILED');
 return (q.data??[]).filter(r=>valid(r.model_probability)&&(win(r.result)||loss(r.result))).map(r=>({at:r.commence_time,p:Number(r.model_probability),y:win(r.result)?1:0 as 0|1}));
}
async function nhl():Promise<Rec[]>{
 const [p,o]=await Promise.all([
  db.from('nhl_free_predictions_v1').select('event_id,scheduled_at,body').order('scheduled_at',{ascending:true}).limit(2000),
  db.from('nhl_free_outcomes_v1').select('event_id,body').limit(2000)
 ]);if(p.error||o.error)throw Error('NHL_CALIBRATION_READ_FAILED');
 const om=new Map((o.data??[]).map(x=>[x.event_id,x.body]));const out:Rec[]=[];
 for(const r of p.data??[]){const f:any=r.body??{},x:any=om.get(r.event_id);if(!x)continue;const ap=Number(f.awayProbability),hp=Number(f.homeProbability);if(!valid(ap)||!valid(hp))continue;const away=ap>=hp,pred=away?Number(f.awayId):Number(f.homeId),actual=Number(x.awayScore)>Number(x.homeScore)?Number(x.awayId):Number(x.homeId);out.push({at:r.scheduled_at,p:Math.max(ap,hp),y:pred===actual?1:0});}return out;
}
async function ncaab():Promise<Rec[]>{
 const [p,o]=await Promise.all([
  db.from('ncaab_daily_predictions_v1').select('event_id,scheduled_at,body').order('scheduled_at',{ascending:true}).limit(3000),
  db.from('ncaab_daily_outcomes_v1').select('event_id,body').limit(3000)
 ]);if(p.error||o.error)throw Error('NCAAB_CALIBRATION_READ_FAILED');
 const om=new Map((o.data??[]).map(x=>[x.event_id,x.body]));const out:Rec[]=[];
 for(const r of p.data??[]){const f:any=r.body??{},x:any=om.get(r.event_id);if(!x||f.state!=='FORECAST')continue;const hp=Number(f.home_win_probability),ap=Number(f.away_win_probability),pred=String(f.predicted_winner??''),actual=Number(x.home_score)>Number(x.away_score)?String(x.home_id):String(x.away_id);const pp=pred===String(f.home_id)?hp:ap;if(valid(pp)&&pred&&actual)out.push({at:r.scheduled_at,p:pp,y:pred===actual?1:0});}return out;
}
async function edgeSingle():Promise<Rec[]>{
 const [f,o]=await Promise.all([
  db.from('edge_lab_forecasts_v1').select('id,scheduled_at,probability,status').eq('sport','SOCCER').order('scheduled_at',{ascending:true}).limit(5000),
  db.from('edge_lab_outcomes_v1').select('forecast_id,status').limit(5000)
 ]);if(f.error||o.error)throw Error('SOCCER_CALIBRATION_READ_FAILED');
 const om=new Map((o.data??[]).map(x=>[x.forecast_id,x.status]));
 return (f.data??[]).filter(r=>r.status==='FORECAST'&&valid(r.probability)&&(win(om.get(r.id))||loss(om.get(r.id)))).map(r=>({at:r.scheduled_at,p:Number(r.probability),y:win(om.get(r.id))?1:0 as 0|1}));
}
async function edgeMulti(sport:string):Promise<Rec[]>{
 const [f,o]=await Promise.all([
  db.from('edge_lab_multi_forecasts_v1').select('id,scheduled_at,probability,status,market').eq('sport',sport).order('scheduled_at',{ascending:true}).limit(8000),
  db.from('edge_lab_multi_outcomes_v1').select('forecast_id,status').limit(8000)
 ]);if(f.error||o.error)throw Error(sport+'_CALIBRATION_READ_FAILED');
 const om=new Map((o.data??[]).map(x=>[x.forecast_id,x.status]));
 return (f.data??[]).filter(r=>r.status==='FORECAST'&&valid(r.probability)&&(win(om.get(r.id))||loss(om.get(r.id)))).map(r=>({at:r.scheduled_at,p:Number(r.probability),y:win(om.get(r.id))?1:0 as 0|1}));
}

async function persist(e:Eval){
 if(!['CHALLENGER_TEST','VALIDATED_CANDIDATE'].includes(e.state))return;
 const key='probability_calibration_alpha_v1';
 const old=await db.from('model_learning_candidates_v1').select('id,state').eq('sport',e.sport).eq('model_version',e.model).eq('hypothesis_key',key).maybeSingle();
 if(old.error)throw Error('CANDIDATE_READ_FAILED');if(['APPROVED','REJECTED'].includes(old.data?.state??''))return;
 const payload={
  sport:e.sport,model_version:e.model,hypothesis_key:key,title:'Recalibración de confianza probabilística',
  state:e.state,baseline_sample:e.records,validation_sample:e.baseline.validation.n,holdout_sample:e.baseline.holdout.n,
  baseline_metric:e.baseline,challenger_metric:e.challenger,
  validation_evidence:{method:'chronological_60_20_20',alpha:e.alpha,selection_changed:false,gate:{min_total:100,min_validation:20,min_holdout:20,min_brier_improvement_each:.003,log_loss_must_improve_each:true}},
  reason:e.reason,updated_at:new Date().toISOString(),
 };
 const q=old.data?.id?await db.from('model_learning_candidates_v1').update(payload).eq('id',old.data.id):await db.from('model_learning_candidates_v1').insert(payload);
 if(q.error)throw Error('CANDIDATE_WRITE_FAILED');
}

export async function runMultisportLearningEvaluation(){
 const inputs=await Promise.allSettled([
  mlb().then(r=>evaluate('MLB','EQUILIZER_ML_V2_E2_STABLE6',r)),
  nba().then(r=>evaluate('NBA','NBA GOAT',r)),
  nhl().then(r=>evaluate('NHL','NHL MODEL_ONLY',r)),
  ncaab().then(r=>evaluate('NCAAB','NCAAB_PRESEASON_V1',r)),
  edgeSingle().then(r=>evaluate('Fútbol','SOCCER_V0_PICK_PORT_1',r)),
  edgeMulti('TT').then(r=>evaluate('Tenis de mesa','TT SHADOW',r)),
  edgeMulti('NCAAF').then(r=>evaluate('NCAAF','NCAAF PPG V1',r)),
 ]);
 const evaluations:Eval[]=[],errors:string[]=[];
 for(const x of inputs){if(x.status==='fulfilled'){evaluations.push(x.value);await persist(x.value);}else errors.push(x.reason instanceof Error?x.reason.message:'LEARNING_EVAL_FAILED');}
 evaluations.push({sport:'UFC',model:'UFC Elo experimental',records:0,state:'INSUFFICIENT_SAMPLE',alpha:null,baseline:null,challenger:null,reason:'Sin resultados liquidados suficientes para calibración.'});
 return {status:errors.length?'PARTIAL':'SUCCESS',evaluatedAt:new Date().toISOString(),policy:{storedDataOnly:true,providerCalls:0,modelWrites:0,autoApply:false,autoPromotion:false},evaluations,errors};
}
