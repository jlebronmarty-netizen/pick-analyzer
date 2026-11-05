import {createHash} from 'node:crypto';
const SITE='https://site.api.espn.com/apis/site/v2/sports/football/college-football';
const CORE='https://sports.core.api.espn.com/v2/sports/football/leagues/college-football';
export const sourceHash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const id=x=>/^\d+$/.test(String(x))?String(x):null;
const score=x=>{const v=x&&typeof x==='object'?x.value:x;if(v===undefined||v===null||v===''||typeof v==='boolean')return null;const n=Number(v);return Number.isInteger(n)&&n>=0&&n<=200?n:null;};
function collection(body,max){if(!Array.isArray(body.items)||!Number.isInteger(body.count)||body.count<0||body.count>max||body.pageIndex!==1||body.pageCount!==1||body.items.length!==body.count)throw Error('FBS_UNIVERSE_INCOMPLETE');return body.items;}
function reference(ref,pattern){let u;try{u=new URL(ref);}catch{throw Error('FBS_REFERENCE_INVALID');}const match=pattern.exec(u.pathname);if(!['https:','http:'].includes(u.protocol)||u.hostname!=='sports.core.api.espn.com'||!match)throw Error('FBS_REFERENCE_INVALID');return match[1];}
export function parseFbsMembers(body,season){const result=new Set();for(const item of collection(body,180)){const team=reference(item.$ref,new RegExp('^/v2/sports/football/leagues/college-football/seasons/'+season+'/teams/(\\d+)$'));if(result.has(team))throw Error('FBS_REFERENCE_INVALID');result.add(team);}return [...result].sort((a,b)=>Number(a)-Number(b));}
export function parseFbsConferences(body,season){const result=new Set();for(const item of collection(body,20)){const group=reference(item.$ref,new RegExp('^/v2/sports/football/leagues/college-football/seasons/'+season+'/types/2/groups/(\\d+)$'));if(group==='80'||result.has(group))throw Error('FBS_REFERENCE_INVALID');result.add(group);}if(!result.size)throw Error('FBS_CONFERENCES_EMPTY');return [...result];}
export function verifyConference(body,group,season){if(String(body.id)!==group)throw Error('FBS_CONFERENCE_IDENTITY');const parent=reference(body.parent?.$ref,new RegExp('^/v2/sports/football/leagues/college-football/seasons/'+season+'/types/2/groups/(\\d+)$'));if(parent!=='80')throw Error('CONFERENCE_NOT_FBS');return {id:group,verified_parent:'80',name:body.name};}
export function parseTeamSchedule(body,team,season,capture,conference=null){
 if(id(body.team?.id)!==team||body.requestedSeason?.year!==season||body.requestedSeason?.type!==2||body.season?.year!==season||body.season?.type!==2||!Array.isArray(body.events)||body.events.length>20)throw Error('TEAM_SCHEDULE_IDENTITY_MISMATCH');
 const group=body.team?.groups;const fbs=conference?conference.verified_parent==='80'&&[String(group?.id),String(group?.parent?.id)].includes(conference.id):String(group?.id)==='80'||String(group?.parent?.id)==='80';
 if(!fbs)throw Error('TEAM_NOT_VERIFIED_FBS');
 const rows=[],excluded=[],seen=new Set();for(const e of body.events){
  const eid=id(e.id);if(!eid||seen.has(eid)||e.season?.year!==season||e.competitions?.length!==1)throw Error('EVENT_IDENTITY_MISMATCH');seen.add(eid);
  const c=e.competitions[0],h=c.competitors?.find(x=>x.homeAway==='home'),a=c.competitors?.find(x=>x.homeAway==='away'),st=c.status?.type;
  const hi=id(h?.id),ai=id(a?.id),tip=Date.parse(e.date);
  if(st?.state==='pre'&&st?.name==='STATUS_SCHEDULED'&&c.timeValid===false&&(!hi||!ai)){excluded.push({event_id:'espn:'+eid,scheduled_at:e.date,reason:'UNASSIGNED_FUTURE_OPPONENT'});continue;}
  if(!hi||!ai||hi===ai||![hi,ai].includes(team)||id(c.id)!==eid||!Number.isFinite(tip)||!h.team?.displayName||!a.team?.displayName)throw Error('EVENT_IDENTITY_MISMATCH');
  const hs=score(h.score),as=score(a.score),complete=st?.completed===true&&st.state==='post'&&st.name==='STATUS_FINAL';
  const valid=complete&&hs!==null&&as!==null&&hs!==as&&h.winner===(hs>as)&&a.winner===(as>hs)&&tip<Date.parse(capture.captured_at);
  rows.push({event_id:'espn:'+eid,sport:'NCAAF',season,home_id:hi,away_id:ai,home_name:h.team.displayName,away_name:a.team.displayName,home_score:complete?hs:null,away_score:complete?as:null,scheduled_at:new Date(tip).toISOString(),captured_at:capture.captured_at,capture_id:capture.id,source_team:team,status:complete?'FINAL':st?.state==='pre'&&st?.name==='STATUS_SCHEDULED'?'SCHEDULED':'OTHER',outcome_validation:valid?'PASS':'NOT_FINAL_OR_INVALID',time_verified:c.timeValid===true,neutral_site:typeof c.neutralSite==='boolean'?c.neutralSite:null});
 }
 return {team,name:body.team.displayName,conference_id:conference?.id??String(group.id),rows,excluded};
}
export function reconcileSchedules(schedules,membership,membershipCapture){
 const successful=new Set(schedules.map(s=>s.team)),byId=new Map(),conflicts=[];
 for(const s of schedules)for(const e of s.rows){const values=byId.get(e.event_id)??[];values.push(e);byId.set(e.event_id,values);}
 const events=[];
 for(const [event_id,versions] of byId){
  const signature=e=>JSON.stringify([e.season,e.home_id,e.away_id,e.scheduled_at,e.status,e.home_score,e.away_score,e.time_verified,e.neutral_site,e.outcome_validation]);
  if(new Set(versions.map(signature)).size!==1){conflicts.push(event_id);continue;}
  const e=[...versions].sort((a,b)=>a.captured_at.localeCompare(b.captured_at)).at(-1);
  const home=membership.includes(e.home_id)&&successful.has(e.home_id),away=membership.includes(e.away_id)&&successful.has(e.away_id);
  events.push({...e,home_FBS_membership:home,away_FBS_membership:away,home_membership_captured_at:membershipCapture.captured_at,away_membership_captured_at:membershipCapture.captured_at,source_capture_ids:versions.map(r=>r.capture_id)});
 }
 return {events:events.sort((a,b)=>a.scheduled_at.localeCompare(b.scheduled_at)||a.event_id.localeCompare(b.event_id)),conflicts};
}
export async function loadNcaafSchedules({now=new Date(),fetchFn=fetch,sleep=ms=>new Promise(r=>setTimeout(r,ms)),spacing=1100,deadlineMs=235000}={}){
 const start=Date.now(),season=now.getUTCFullYear()-(now.getUTCMonth()<6?1:0),captures=[],errors=[];let requests=0,lastStart=0;
 async function get(url){
  const u=new URL(url);if(u.protocol!=='https:'||!url.startsWith(SITE+'/')&&!url.startsWith(CORE+'/'))throw Error('NCAAF_SOURCE_NOT_ALLOWED');
  if(requests>=205||Date.now()-start>deadlineMs)throw Error('NCAAF_SOURCE_BUDGET_REACHED');await sleep(Math.max(0,lastStart+spacing-Date.now()));lastStart=Date.now();requests++;
  const r=await fetchFn(url,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000),headers:{Accept:'application/json'}});if(!r.ok)throw Error('NCAAF_SOURCE_HTTP_'+r.status);
  const reader=r.body?.getReader();if(!reader)throw Error('NCAAF_EMPTY_SOURCE');const parts=[];let size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2500000)throw Error('NCAAF_SOURCE_TOO_LARGE');parts.push(Buffer.from(value));}}finally{await reader.cancel().catch(()=>{});}
  const raw=Buffer.concat(parts).toString('utf8'),captured_at=new Date().toISOString(),raw_sha256=sourceHash(raw),id=sourceHash([url,captured_at,raw_sha256]),body=JSON.parse(raw);const capture={id,url,captured_at,raw_sha256,bytes:size};captures.push(capture);return {body,capture};
 }
 const root=await get(`${CORE}/seasons/${season}/types/2/groups/80/children?limit=1000`),groups=parseFbsConferences(root.body,season),membership=new Map(),conferences=[];
 for(const group of groups){const meta=await get(`${CORE}/seasons/${season}/types/2/groups/${group}`),conf=verifyConference(meta.body,group,season);const roster=await get(`${CORE}/seasons/${season}/types/2/groups/${group}/teams?limit=1000`);const teams=parseFbsMembers(roster.body,season);conferences.push({...conf,teams,captured_at:roster.capture.captured_at});for(const team of teams){if(membership.has(team))throw Error('FBS_MEMBERSHIP_CONFLICT');membership.set(team,conf);}}
 const members=[...membership.keys()].sort((a,b)=>Number(a)-Number(b));if(!members.length||members.length>180)throw Error('FBS_UNIVERSE_INCOMPLETE');
 const membershipCapture={id:sourceHash(conferences),captured_at:new Date().toISOString(),source:'ESPN same-season conferences with parent80'},schedules=[];
 for(const team of members){try{const response=await get(`${SITE}/teams/${team}/schedule?season=${season}&seasontype=2`);schedules.push(parseTeamSchedule(response.body,team,season,response.capture,membership.get(team)));}catch(e){const reason=/^[A-Z0-9_]+$/.test(e.message)?e.message:'NCAAF_SOURCE_FAILED';errors.push({team,reason});if(reason==='NCAAF_SOURCE_BUDGET_REACHED')break;}}
 const joined=reconcileSchedules(schedules,members,membershipCapture),captured_at=new Date().toISOString(),excluded=[...new Map(schedules.flatMap(s=>s.excluded).map(e=>[e.event_id,e])).values()];
 return {season,captured_at,membership:members,conferences,membership_capture:membershipCapture,successful_teams:schedules.map(s=>({id:s.team,name:s.name,conference_id:s.conference_id})),events:joined.events,captures,errors,conflicts:joined.conflicts,excluded,coverage:{source:'ESPN verified FBS conferences and team schedules; no scoreboard truncation',expected_teams:members.length,successful_teams:schedules.length,complete:schedules.length===members.length&&errors.length===0&&joined.conflicts.length===0,unique_events:joined.events.length,unassigned_future_events:excluded.length},requests};
}
