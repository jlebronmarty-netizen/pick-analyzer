// One bounded owner-authorized activation. Uses the same prediction/normalization
// functions as the hosted cron. SQL is reviewed/applied through the DB connector.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {normalizeNcaab} from '../../src/services/ncaab-daily.service.ts';
import {predictNcaab} from '../../src/lib/ncaab-live.ts';
const root='research/ncaab-daily-20261103';await fs.mkdir(root,{recursive:true});
const dates=[0,1].map(n=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Puerto_Rico',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+n*86400000)).replaceAll('-',''));
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const quote=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb";
const run='ACTIVATION_20261103';let calls=0,forecasts=0;const abstentions=[];let sql=`insert into public.ncaab_daily_runs_v1(id,status) values ('${run}','RUNNING') on conflict do nothing;\n`;
for(const date of dates){
 if(calls)await new Promise(r=>setTimeout(r,1000));
 const url='https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates='+date+'&groups=50&limit=1000';
 calls++;const res=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(25000)});if(!res.ok)throw Error('SOURCE_HTTP_'+res.status);
 const text=await res.text();const now=new Date().toISOString();const raw=JSON.parse(text);if(!Array.isArray(raw.events)||raw.events.length>=1000)throw Error('SOURCE_SCHEMA');
 await fs.writeFile(root+'/scoreboard-'+date+'.json',text);const sid=hash(text);
 sql+=`insert into public.ncaab_daily_source_v1(id,run_id,captured_at,source_url,body) values ('${sid}','${run}','${now}','${url}',${quote(raw)}) on conflict do nothing;\n`;
 for(const event of raw.events){
  const {schedule}=normalizeNcaab(event,now);const f=predictNcaab(schedule,new Date().toISOString());
  if(f.state!=='FORECAST'){abstentions.push(f);continue;}
  const body={...f,model:'NCAAB_PRESEASON_V1',profile_sha256:'4fd07cc48ade1b1accd1ebb0f00c0ea414e93a2991567d70ed4ac890c88fdbf4'};
  sql+=`insert into public.ncaab_daily_predictions_v1(id,event_id,scheduled_at,created_at,body,source_id) values ('NCAAB_PRESEASON_V1:${f.event_id}','${f.event_id}','${f.scheduled_at}','${f.created_at}',${quote(body)},'${sid}') on conflict do nothing;\n`;forecasts++;
 }
}
sql+=`update public.ncaab_daily_runs_v1 set status='PASS',provider_calls=${calls},completed_at=now(),detail=${quote({forecasts,abstentions,mode:'BOUNDED_MANUAL_ACTIVATION'})} where id='${run}';\n`;
await fs.writeFile(root+'/activation.sql',sql);await fs.writeFile(root+'/activation-receipt.json',JSON.stringify({calls,forecasts,abstentions:abstentions.length,sqlSha256:crypto.createHash('sha256').update(sql).digest('hex')},null,2));
console.log({calls,forecasts,abstentions:abstentions.length,sqlBytes:sql.length});
