import {z} from 'zod';
import type {ModelCohort} from './sport-model-overview';

const number=z.number().finite();
const probability=number.min(0).max(1);
const timestamp=z.string().datetime({offset:true});
const observation=z.object({
 event_id:z.string().min(1),home_id:z.string(),away_id:z.string(),home_name:z.string().nullable(),away_name:z.string().nullable(),
 scheduled_at:timestamp,state:z.enum(['FORECAST','ABSTAIN']),reason:z.string().nullable(),
 home_score:number.nullable(),away_score:number.nullable(),home_win_probability:probability.nullable(),away_win_probability:probability.nullable(),
 predicted_winner:z.string().nullable(),projected_total:number.nullable(),projected_margin:number.nullable(),
 created_at:timestamp.nullable(),settlement:z.null(),review_required:z.literal(false),
});
const model=z.object({id:z.enum(['NCAAB_PRESEASON_V1','NCAAB_FREE_SCORE_V1_1']),forecasts:z.number().int().nonnegative(),abstentions:z.number().int().nonnegative(),settled:z.literal(0),wins:z.literal(0),winnerDenominator:z.literal(0),accuracy:z.null()});
export const checkpointSchema=z.object({schemaVersion:z.literal(1),sport:z.literal('NCAAB'),sourceCommit:z.literal('c451d9fc9767bbeff751e26e631fe0b48579fe75'),sourceRepository:z.literal('jlebronmarty-netizen/sports-edge-hub'),
 sourceHashes:z.object({preseason:z.literal('7cbfce2daa127fe7d6f5cec16ff88e1faec0b6b24a8e693a66b6904af3e937a7'),inSeason:z.literal('4d0e6ff6ad933b2f8420f6736ff8a85cbf9096d8f89da4ce250cbd85107d1fbe')}),
 generatedAt:timestamp,connection:z.literal('PUBLISHED_CHECKPOINT'),continuousSync:z.literal(false),modelValidated:z.literal(false),hostedPipelineReady:z.literal(false),oddsRoiClv:z.literal('DEFERRED'),models:z.array(model).length(2),observations:z.array(observation),
}).superRefine((s,ctx)=>{
 const fail=(message:string)=>ctx.addIssue({code:'custom',message});
 const preseason=s.models.find(m=>m.id==='NCAAB_PRESEASON_V1'),inSeason=s.models.find(m=>m.id==='NCAAB_FREE_SCORE_V1_1');
 if(!preseason||!inSeason||inSeason.forecasts!==0||inSeason.abstentions!==0)fail('Model identity/count mismatch');
 const forecasts=s.observations.filter(r=>r.state==='FORECAST');
 if(forecasts.length!==preseason?.forecasts||s.observations.length-forecasts.length!==preseason?.abstentions)fail('Observation counts mismatch');
 if(new Set(s.observations.map(r=>r.event_id)).size!==s.observations.length)fail('Duplicate events');
 for(const r of s.observations){
  if(r.home_id===r.away_id)fail('Identical opponents');
  if(r.state==='ABSTAIN'){
   if(!r.reason||[r.home_score,r.away_score,r.home_win_probability,r.away_win_probability,r.predicted_winner,r.projected_total,r.projected_margin,r.created_at].some(v=>v!==null))fail('Abstention contains forecast');
   continue;
  }
  if(r.reason!==null||!r.created_at||Date.parse(r.created_at)>=Date.parse(r.scheduled_at)||Date.parse(r.created_at)>Date.parse(s.generatedAt))fail('Invalid prospective timing');
  if([r.home_score,r.away_score,r.home_win_probability,r.away_win_probability,r.projected_total,r.projected_margin].some(v=>v===null))fail('Incomplete forecast');
  else if(Math.abs(r.home_win_probability!+r.away_win_probability!-1)>1e-10||Math.abs(r.home_score!+r.away_score!-r.projected_total!)>1e-8||Math.abs(r.home_score!-r.away_score!-r.projected_margin!)>1e-8)fail('Forecast arithmetic mismatch');
  const winner=r.home_score===r.away_score?null:r.home_score!>r.away_score!?r.home_id:r.away_id;
  if(r.predicted_winner!==winner)fail('Winner mismatch');
 }
});
export type NcaabCheckpoint=z.infer<typeof checkpointSchema>;
export type NcaabReport={status:'AVAILABLE';data:NcaabCheckpoint}|{status:'UNAVAILABLE';warning:string};
export function ncaabModelCohort(report:NcaabReport):ModelCohort{
 const available=report.status==='AVAILABLE';
 return {key:'PUBLISHED_CHECKPOINT',label:'NCAAB · observación prospectiva experimental',available,wins:available?0:null,losses:available?0:null,pending:available?report.data.models.reduce((n,m)=>n+m.forecasts,0):null,pushes:available?0:null,voids:available?0:null,models:available?report.data.models.length:null,accuracy:null,note:available?'Checkpoint publicado; sin sincronización continua ni resultados liquidados. Históricos excluidos.':report.warning};
}
export function ncaabDate(iso:string){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Puerto_Rico',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));}
