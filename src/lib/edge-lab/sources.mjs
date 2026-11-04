import {normalize,soccerProjection,COHORT,SOCCER_MODEL} from './engines.mjs';
import {createHash} from 'node:crypto';
export const sha=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
export const dayPR=now=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Puerto_Rico',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
export const addDay=(day,offset)=>new Date(Date.parse(day+'T12:00:00Z')+offset*86400000).toISOString().slice(0,10);
const aliases={'alaves':['alaves'],'athletic club':['ath bilbao','athletic club'],'atletico madrid':['ath madrid','atletico madrid'],'celta vigo':['celta','celta vigo'],'deportivo la coruna':['la coruna','deportivo la coruna','rc deportivo'],'espanyol':['espanol','espanyol'],'racing santander':['santander','racing santander'],'real betis':['betis','real betis'],'real sociedad':['sociedad','real sociedad'],'rayo vallecano':['vallecano','rayo vallecano']};
export function resolveTeam(names,external){const n=normalize(external),options=aliases[n]??[n];const hits=[...new Set(names)].filter(x=>options.includes(normalize(x)));return hits.length===1?hits[0]:null;}
function split(line){const out=[];let value='',quoted=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){out.push(value);value='';}else value+=c;}if(quoted)throw Error('UNTERMINATED_CSV');out.push(value);return out;}
function csvDate(text){const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);if(!m)throw Error('INVALID_HISTORY_DATE');const s=`${m[3]}-${m[2]}-${m[1]}`;if(new Date(s+'T12:00:00Z').toISOString().slice(0,10)!==s)throw Error('INVALID_HISTORY_DATE');return s;}
export function parseHistory(csv,now){
 const lines=csv.replace(/^\uFEFF/,'').split(/\r?\n/).filter(s=>s.trim()),headers=split(lines.shift()??'');
 for(const key of ['Div','Date','HomeTeam','AwayTeam','FTHG','FTAG'])if(!headers.includes(key))throw Error('HISTORY_SCHEMA_CHANGED');
 const cutoff=now.toISOString().slice(0,10),seen=new Set(),rows=[];
 for(const line of lines){const cells=split(line),r=Object.fromEntries(headers.map((h,i)=>[h,cells[i]??'']));if(r.Div!=='SP1'||!r.FTHG.trim()||!r.FTAG.trim())continue;
 const date=csvDate(r.Date);if(date>=cutoff)continue;const h=Number(r.FTHG),a=Number(r.FTAG);if(!Number.isInteger(h)||!Number.isInteger(a)||h<0||a<0||h>30||a>30||!r.HomeTeam||!r.AwayTeam)throw Error('INVALID_FINAL');
 const key=[date,r.HomeTeam,r.AwayTeam].join('|');if(seen.has(key))throw Error('DUPLICATE_HISTORY');seen.add(key);rows.push({date,homeTeam:r.HomeTeam,awayTeam:r.AwayTeam,homeGoals:h,awayGoals:a});}
 return rows.sort((a,b)=>a.date.localeCompare(b.date));
}
export function parseSchedule(body){
 if(!Array.isArray(body.events))throw Error('SCHEDULE_SCHEMA_CHANGED');if(body.events.length>=100)throw Error('SCHEDULE_POSSIBLY_TRUNCATED');
 const events=[],seen=new Set();for(const e of body.events){const c=e.competitions?.[0];if(e.competitions?.length!==1)throw Error('AMBIGUOUS_COMPETITION');
 const h=c.competitors?.find(x=>x.homeAway==='home'),a=c.competitors?.find(x=>x.homeAway==='away'),type=c.status?.type??e.status?.type;
 if(!/^\d+$/.test(String(e.id))||seen.has(String(e.id))||!h?.team?.displayName||!a?.team?.displayName||!Number.isFinite(Date.parse(e.date)))throw Error('INVALID_EVENT');seen.add(String(e.id));
 events.push({id:String(e.id),home:h.team.displayName,away:a.team.displayName,home_id:String(h.id),away_id:String(a.id),scheduled_at:new Date(e.date).toISOString(),completed:type?.completed===true,state:type?.state,status:type?.name,time_valid:c.timeValid===true,home_score:/^\d+$/.test(String(h.score))?Number(h.score):null,away_score:/^\d+$/.test(String(a.score))?Number(a.score):null});}
 return events;
}
export function forecastRows(events,history,now,source){
 const names=history.flatMap(x=>[x.homeTeam,x.awayTeam]),rows=[],skipped=[];
 for(const e of events){
 if(e.state!=='pre'||e.status!=='STATUS_SCHEDULED'||!e.time_valid||e.completed||Date.parse(e.scheduled_at)<=now.getTime()+600000)continue;
 const h=resolveTeam(names,e.home),a=resolveTeam(names,e.away);
 if(!h||!a||h===a){skipped.push({id:e.id,reason:'TEAM_NOT_RESOLVED'});continue;}
 const p=soccerProjection(history,h,a),base={cohort:COHORT,sport:'SOCCER',competition:'LaLiga',season:source.season,model_version:SOCCER_MODEL,event_id:e.id,home_name:e.home,away_name:e.away,home_id:e.home_id,away_id:e.away_id,scheduled_at:e.scheduled_at,emitted_at:now.toISOString(),source_received_at:source.received_at,history_digest:source.history_digest,input_version:'FOOTBALL_DATA_SEASON_PRIOR_DAYS_ESPN_V1',projection:p,evidence:{...source,home_history_name:h,away_history_name:a,history_rows:history.length,history_latest:history.at(-1)?.date??null},odds:null,sportsbook:null,scope:'REGULATION_90_PLUS_STOPPAGE',recommendation_status:'RESEARCH_PROJECTION_NOT_BET'};
 const choices=Object.entries({HOME:p.oneXTwo.home,DRAW:p.oneXTwo.draw,AWAY:p.oneXTwo.away}).sort((x,y)=>y[1]-x[1]);
 for(const [market,selection,probability,tie] of [['1X2',choices[0][0],choices[0][1],Math.abs(choices[0][1]-choices[1][1])<1e-12],['TOTAL_2_5',p.total25.over>.5?'OVER':'UNDER',Math.max(p.total25.over,p.total25.under),Math.abs(p.total25.over-.5)<1e-12]]){
 const ok=p.warmupComplete&&!tie;rows.push({...base,id:sha([COHORT,e.id,market,SOCCER_MODEL]),market,line:market==='TOTAL_2_5'?2.5:null,selection:ok?selection:null,probability:ok?probability:null,status:ok?'FORECAST':'ABSTAIN',reason:!p.warmupComplete?'INSUFFICIENT_SPLIT_HISTORY':tie?'TIED_PROBABILITY':'MODEL_ONLY'});}
 }
 return {rows,skipped};
}
export async function boundedGet(url,fetchFn=fetch){
 const u=new URL(url);if(u.protocol!=='https:'||!['football-data.co.uk','site.api.espn.com'].includes(u.hostname))throw Error('SOURCE_NOT_ALLOWED');
 const r=await fetchFn(u,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000),headers:{Accept:u.pathname.endsWith('.csv')?'text/csv':'application/json'}});
 if(!r.ok)throw Error('SOURCE_HTTP_'+r.status);const reader=r.body?.getReader();if(!reader)throw Error('EMPTY_SOURCE');let size=0;const parts=[];try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2000000)throw Error('SOURCE_TOO_LARGE');parts.push(Buffer.from(value));}}finally{await reader.cancel().catch(()=>{});}return Buffer.concat(parts).toString('utf8');
}
export async function loadSoccer(now=new Date(),extraDates=[],fetchFn=fetch){
 const year=now.getUTCMonth()>=6?now.getUTCFullYear():now.getUTCFullYear()-1,season=String(year).slice(-2)+String(year+1).slice(-2);
 const history_url=`https://football-data.co.uk/mmz4281/${season}/SP1.csv`,csv=await boundedGet(history_url,fetchFn),history=parseHistory(csv,now);
 if(history.length<20)throw Error('INSUFFICIENT_LEAGUE_HISTORY');
 const day=dayPR(now),dates=[...new Set([...Array.from({length:9},(_,i)=>addDay(day,i-1)),...extraDates])].sort();if(dates.length>24)throw Error('SETTLEMENT_BACKLOG_LIMIT');
 const events=new Map(),sources=[],errors=[];
 for(let i=0;i<dates.length;i+=3){await Promise.all(dates.slice(i,i+3).map(async d=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(d))throw Error('INVALID_DATE');const url=`https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard?dates=${d.replaceAll('-','')}`;try{const text=await boundedGet(url,fetchFn),parsed=parseSchedule(JSON.parse(text));sources.push({date:d,url,digest:sha(text),events:parsed.length});for(const e of parsed){const old=events.get(e.id);if(old&&JSON.stringify(old)!==JSON.stringify(e))throw Error('SCHEDULE_CHANGED_DURING_READ');events.set(e.id,e);}}catch(e){errors.push({date:d,error:/^[A-Z0-9_]+$/.test(e.message)?e.message:'SOURCE_FAILURE'});}}));}
 return {history,events:[...events.values()],errors,source:{season:`${year}/${year+1}`,history_url,history_digest:sha(csv),received_at:new Date().toISOString(),schedule_sources:sources,coverage_dates:dates,history_cutoff:'STRICTLY_BEFORE_UTC_DATE'}};
}
