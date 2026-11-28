/** Current, read-only NCAAB observations. No provider calls or forecast calculation.
 * Pregame scoreboard statistics are SEASON values; final scoreboard statistics
 * describe THAT GAME. Only verified, prior-local-day finals enter aggregates.
 */
import {buildNcaabArchivedEvidence, NCAAB_ARCHIVE_BASE, NCAAB_ARCHIVE_MAX_EVENTS,
  type ArchiveForecast, type NcaabArchiveReceipt, type NcaabEventArchiveEvidence} from './ncaab-archived-evidence';
import type {NcaabManualAggregate, NcaabManualDataReport, NcaabManualFixture,
  NcaabManualRecentGame, NcaabManualTeam} from '../types/ncaab-manual-data';

type Obj = Record<string, unknown>;
type Stats = NcaabManualRecentGame['stats'];
type Side = {id:string;name:string;abbreviation:string|null;conference:string|null;raw:Obj};
type PossessionSample = {possessions:number;minutes:number;pointsFor:number;pointsAgainst:number};
export type SheetArchive = { histories:Map<string,NcaabManualRecentGame[]>; possessions:Map<string,Record<string,PossessionSample>> };
type Observation = {
  offensiveBoards?:[number|null,number|null];
  eventId:string;scheduledAt:string;date:string;season:number;state:NcaabManualFixture['state'];
  home:Side;away:Side;neutralSite:boolean|null;homeScore:number|null;awayScore:number|null;
  capturedAt:string;sourceId:string;sourceDate:string|null;context:boolean;
  homeStats:Stats;awayStats:Stats;periods:{period:number;home:number;away:number}[];
  detailCapturedAt:string|null;warnings:string[];
};
export type NcaabManualDataInput = {
  date:string;readAt:string;receipts:NcaabArchiveReceipt[];contexts:Obj[];predictions:Obj[];
  readComplete:boolean;sourceErrors?:string[];
};
const TZ = 'America/Puerto_Rico' as const;
const object = (v:unknown):Obj => v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Obj:{};
const array = (v:unknown):unknown[] => Array.isArray(v)?v:[];
const string = (v:unknown):string|null => typeof v==='string'&&v.trim()?v.trim():null;
const nested = (v:unknown,...keys:string[]):unknown => keys.reduce<unknown>((a,k)=>object(a)[k],v);
const id = (v:unknown):string|null => typeof v==='string'&&/^\d{1,20}$/.test(v)?v:null;
const number = (v:unknown):number|null => (typeof v==='number'||typeof v==='string'&&/^-?\d+(?:\.\d+)?$/.test(v))&&Number.isFinite(Number(v))?Number(v):null;
const integer = (v:unknown):number|null => {const n=number(v);return n!==null&&Number.isSafeInteger(n)&&n>=0&&n<=100000?n:null;};
const instant = (v:unknown):string|null => {
  if(typeof v!=='string'||!/(?:Z|[+-]\d{2}(?::?\d{2})?)$/i.test(v)||!Number.isFinite(Date.parse(v)))return null;
  return new Date(v).toISOString();
};
const day = (v:string):string => new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v));
const addDay = (v:string,n:number):string => new Date(Date.parse(v+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
const validDate = (v:string):boolean => /^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
const round = (v:number):number => Math.round(v*1e6)/1e6;
const pct = (made:number,attempted:number):number|null => attempted>0?round(made/attempted):null;
const emptyStats = ():Stats => ({fieldGoalsMade:null,fieldGoalsAttempted:null,threePointersMade:null,threePointersAttempted:null,
  freeThrowsMade:null,freeThrowsAttempted:null,rebounds:null,assists:null,turnovers:null});
const canonical = (v:unknown):string => JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);

function sourceDate(url:string):string|null {
  const match=new RegExp('^'+NCAAB_ARCHIVE_BASE.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\?dates=(\\d{4})(\\d{2})(\\d{2})&groups=50&limit=1000$').exec(url);
  if(!match)return null;const date=match.slice(1).join('-');return validDate(date)?date:null;
}
function selectedReceipts(input:NcaabManualDataInput,readAt:string,rejectedDates:Set<string>):NcaabArchiveReceipt[] {
  const groups=new Map<string,NcaabArchiveReceipt[]>();
  for(const r of input.receipts) {
    const date=sourceDate(r.source_url),at=instant(r.captured_at);
    if(!date)continue;
    if(!at||!string(r.id))throw Error('NCAAB_MANUAL_INVALID_RECEIPT');
    if(at>readAt||date>addDay(input.date,1))continue;
    groups.set(date,[...(groups.get(date)??[]),{...r,captured_at:at}]);
  }
  const result:NcaabArchiveReceipt[]=[];
  for(const rows of groups.values()) {
    rows.sort((a,b)=>b.captured_at.localeCompare(a.captured_at)||a.id.localeCompare(b.id));
    const tied=rows.filter(r=>r.captured_at===rows[0].captured_at);
    if(new Set(tied.map(r=>r.id)).size!==1||new Set(tied.map(r=>canonical(r.body))).size!==1)throw Error('NCAAB_MANUAL_CONFLICTING_RECEIPTS');
    if(!Array.isArray(object(rows[0].body).events)||array(object(rows[0].body).events).length>NCAAB_ARCHIVE_MAX_EVENTS) {
      const date=sourceDate(rows[0].source_url)!;
      // Historical seed/reconciliation bodies are not raw daily scoreboards.
      // Leave a visible gap; never revive an older receipt for the same date.
      if(date>=input.date)throw Error('NCAAB_MANUAL_INCOMPLETE_RECEIPT');
      rejectedDates.add(date);continue;
    }
    result.push(rows[0]);
  }
  return result.sort((a,b)=>a.source_url.localeCompare(b.source_url));
}
function offensiveBoards(values:unknown) {
  const found=array(values).map(object).filter(r=>r.name==='offensiveRebounds');
  return found.length===1?integer(found[0].displayValue??found[0].value):null;
}
function possessionSample(event:Observation,home:boolean):PossessionSample|null {
  if(!event.periods.length||!event.offensiveBoards)return null;
  const counts=[event.homeStats,event.awayStats].map((s,i)=>{
    const orb=event.offensiveBoards![i];
    if(orb===null||s.fieldGoalsAttempted===null||s.freeThrowsAttempted===null||s.turnovers===null||
       (s.rebounds!==null&&orb>s.rebounds))return null;
    return s.fieldGoalsAttempted-orb+s.turnovers+0.475*s.freeThrowsAttempted;
  });
  if(counts[0]===null||counts[1]===null||counts[0]<=0||counts[1]<=0)return null;
  return {possessions:(counts[0]+counts[1])/2,minutes:40+5*(event.periods.length-2),
    pointsFor:(home?event.homeScore:event.awayScore)!,pointsAgainst:(home?event.awayScore:event.homeScore)!};
}
function stats(values:unknown):Stats {
  const result=emptyStats(),map=new Map<string,unknown>();
  for(const raw of array(values)) {const s=object(raw),name=string(s.name);if(name)map.set(name,s.displayValue??s.value);}
  const pairs:[keyof Stats,keyof Stats,string,string,string][]=[
    ['fieldGoalsMade','fieldGoalsAttempted','fieldGoalsMade','fieldGoalsAttempted','fieldGoalsMade-fieldGoalsAttempted'],
    ['threePointersMade','threePointersAttempted','threePointFieldGoalsMade','threePointFieldGoalsAttempted','threePointFieldGoalsMade-threePointFieldGoalsAttempted'],
    ['freeThrowsMade','freeThrowsAttempted','freeThrowsMade','freeThrowsAttempted','freeThrowsMade-freeThrowsAttempted'],
  ];
  for(const [made,attempted,mkey,akey,pairkey] of pairs) {
    let m=integer(map.get(mkey)),a=integer(map.get(akey));
    const match=/^(\d+)-(\d+)$/.exec(String(map.get(pairkey)??''));
    if(m===null&&a===null&&match){m=integer(match[1]);a=integer(match[2]);}
    if(m!==null&&a!==null&&m<=a){result[made]=m;result[attempted]=a;}
  }
  result.rebounds=integer(map.get('rebounds')??map.get('totalRebounds'));
  result.assists=integer(map.get('assists'));
  result.turnovers=integer(map.get('totalTurnovers')??map.get('turnovers'));
  return result;
}
function side(value:unknown):Side|null {
  const raw=object(value),team=object(raw.team),teamId=id(raw.id),nestedId=id(team.id);
  if(!teamId||teamId!==nestedId)return null;
  const group=object(team.groups),name=string(team.displayName)??string(team.shortDisplayName)??string(team.name);
  if(!name)return null;
  const groupName=string(group.name)??string(group.shortName)??string(group.slug);
  return {id:teamId,name,abbreviation:string(team.abbreviation),conference:group.isConference===true?groupName:
    id(team.conferenceId)?'Conferencia ESPN '+team.conferenceId:null,raw};
}
function state(event:Obj,competition:Obj):NcaabManualFixture['state'] {
  const values=[competition.status,event.status].filter(v=>v!==undefined).map(v=>object(nested(v,'type')));
  if(!values.length)return 'UNKNOWN';
  const kinds=values.map(t=>t.name==='STATUS_POSTPONED'?'POSTPONED':['STATUS_CANCELED','STATUS_CANCELLED'].includes(String(t.name))?'CANCELLED':
    t.completed===true&&t.state==='post'?'FINAL':t.state==='in'&&t.completed!==true?'LIVE':t.state==='pre'&&t.completed===false?'PREGAME':'UNKNOWN');
  return new Set(kinds).size===1?kinds[0] as NcaabManualFixture['state']:'UNKNOWN';
}
function lines(home:Side,away:Side,homeScore:number,awayScore:number):Observation['periods'] {
  const parse=(raw:unknown)=>array(raw).map((v,i)=>{const r=object(v);return{period:integer(r.period??i+1),value:integer(r.value??r.displayValue)};});
  const h=parse(home.raw.linescores),a=parse(away.raw.linescores);
  if(h.length<2||h.length>12||h.length!==a.length||h.some((p,i)=>p.period!==i+1||p.value===null||a[i].period!==p.period||a[i].value===null))return [];
  if(h.reduce((s,p)=>s+p.value!,0)!==homeScore||a.reduce((s,p)=>s+p.value!,0)!==awayScore)return [];
  return h.map((p,i)=>({period:p.period!,home:p.value!,away:a[i].value!}));
}
function observation(event:unknown,source:{sourceId:string;capturedAt:string;sourceDate:string|null;context:boolean},season:number):Observation|null {
  const e=object(event),eventId=id(e.id),competitions=array(e.competitions);
  if(!eventId||competitions.length!==1||integer(nested(e,'season','year'))!==season)return null;
  const c=object(competitions[0]),at=instant(c.date??e.date);
  if(!at||c.timeValid===false||e.timeValid===false||(c.id!==undefined&&c.id!==eventId)||
      [c.date,e.date].filter(v=>v!==undefined).some(v=>instant(v)!==at))return null;
  const competitors=array(c.competitors),homes=competitors.filter(x=>object(x).homeAway==='home'),aways=competitors.filter(x=>object(x).homeAway==='away');
  if(competitors.length!==2||homes.length!==1||aways.length!==1)return null;
  const home=side(homes[0]),away=side(aways[0]);if(!home||!away||home.id===away.id)return null;
  const phase=state(e,c),h=integer(home.raw.score),a=integer(away.raw.score);
  if(phase==='FINAL'&&(h===null||a===null||h===a||at>=source.capturedAt))return null;
  const periods=phase==='FINAL'?lines(home,away,h!,a!):[];
  return{eventId:'espn:'+eventId,scheduledAt:at,date:day(at),season,state:phase,home,away,
    neutralSite:typeof c.neutralSite==='boolean'?c.neutralSite:null,homeScore:['LIVE','FINAL'].includes(phase)?h:null,awayScore:['LIVE','FINAL'].includes(phase)?a:null,
    ...source,homeStats:phase==='FINAL'?stats(home.raw.statistics):emptyStats(),awayStats:phase==='FINAL'?stats(away.raw.statistics):emptyStats(),
    periods,detailCapturedAt:null,warnings:phase==='FINAL'&&!periods.length?['Marcador por mitades no verificado.']:[]};
}
function identity(v:Observation):string {return [v.eventId,v.home.id,v.away.id,v.season].join('|');}
function eventSignature(v:Observation):string {return canonical({identity:identity(v),scheduledAt:v.scheduledAt,state:v.state,homeScore:v.homeScore,awayScore:v.awayScore,
  neutralSite:v.neutralSite,periods:v.periods,homeStats:v.homeStats,awayStats:v.awayStats});}
function detailStats(row:Obj,observed:Observation,homeAway:'home'|'away'):Stats|null {
  const teams=array(row.teams),matching=teams.map(object).filter(t=>nested(t,'team','id')===observed[homeAway].id);
  if(teams.length!==2||matching.length!==1||(matching[0].homeAway!==undefined&&matching[0].homeAway!==homeAway))return null;
  return stats(matching[0].statistics);
}
function mergeStats(primary:Stats,supplement:Stats,issues:string[]):Stats {
  const output={...primary};
  for(const key of Object.keys(output) as (keyof Stats)[]) {
    if(output[key]===null)output[key]=supplement[key];
    else if(supplement[key]!==null&&supplement[key]!==output[key]){output[key]=null;issues.push('Estadística discrepante entre capturas: '+key+'.');}
  }
  for(const [m,a] of [['fieldGoalsMade','fieldGoalsAttempted'],['threePointersMade','threePointersAttempted'],['freeThrowsMade','freeThrowsAttempted']] as const)
    if(output[m]===null||output[a]===null||output[m]!>output[a]!){output[m]=null;output[a]=null;}
  return output;
}
function recent(event:Observation,teamId:string):NcaabManualRecentGame {
  const home=event.home.id===teamId,opponent=home?event.away:event.home,pf=home?event.homeScore!:event.awayScore!,pa=home?event.awayScore!:event.homeScore!;
  return{eventId:event.eventId,scheduledAt:event.scheduledAt,date:event.date,opponentId:opponent.id,opponentName:opponent.name,
    venue:event.neutralSite===true?'NEUTRAL':event.neutralSite===false?home?'HOME':'AWAY':'UNKNOWN',pointsFor:pf,pointsAgainst:pa,result:pf>pa?'W':'L',
    sourceId:event.sourceId,capturedAt:event.capturedAt,periods:event.periods.map(p=>({period:p.period,pointsFor:home?p.home:p.away,pointsAgainst:home?p.away:p.home})),
    stats:home?event.homeStats:event.awayStats,detailCapturedAt:event.detailCapturedAt};
}
function aggregate(games:NcaabManualRecentGame[]):NcaabManualAggregate {
  const mean=(key:'pointsFor'|'pointsAgainst')=>games.length?round(games.reduce((s,g)=>s+g[key],0)/games.length):null;
  const rate=(made:keyof Stats,attempted:keyof Stats)=>{const rows=games.filter(g=>g.stats[made]!==null&&g.stats[attempted]!==null);
    return{value:rows.length?pct(rows.reduce((s,g)=>s+g.stats[made]!,0),rows.reduce((s,g)=>s+g.stats[attempted]!,0)):null,games:rows.length};};
  const statMean=(key:keyof Stats)=>{const rows=games.filter(g=>g.stats[key]!==null);return{value:rows.length?round(rows.reduce((s,g)=>s+g.stats[key]!,0)/rows.length):null,games:rows.length};};
  return{games:games.length,wins:games.filter(g=>g.result==='W').length,losses:games.filter(g=>g.result==='L').length,
    pointsFor:mean('pointsFor'),pointsAgainst:mean('pointsAgainst'),margin:games.length?round(games.reduce((s,g)=>s+g.pointsFor-g.pointsAgainst,0)/games.length):null,
    stats:{fieldGoalPct:rate('fieldGoalsMade','fieldGoalsAttempted'),threePointPct:rate('threePointersMade','threePointersAttempted'),freeThrowPct:rate('freeThrowsMade','freeThrowsAttempted'),
      rebounds:statMean('rebounds'),assists:statMean('assists'),turnovers:statMean('turnovers')},
    periods:([1,2] as const).map(period=>{const rows=games.flatMap(g=>g.periods.filter(p=>p.period===period));return{period,games:rows.length,
      pointsFor:rows.length?round(rows.reduce((s,p)=>s+p.pointsFor,0)/rows.length):null,pointsAgainst:rows.length?round(rows.reduce((s,p)=>s+p.pointsAgainst,0)/rows.length):null};})};
}
function record(side:Side,event:Observation):NcaabManualTeam['reportedRecord'] {
  const values=array(side.raw.records),read=(type:string)=>{
    const rows=values.map(object).filter(r=>r.type===type),summaries=rows.map(r=>string(r.summary??r.displayValue)).filter((s):s is string=>!!s&&/^\d{1,3}-\d{1,3}$/.test(s));
    return summaries.length&&new Set(summaries).size===1?summaries[0]:null;
  };
  if(!values.length)return null;
  return{overall:read('total'),home:read('home'),away:read('road'),conference:read('vsconf'),capturedAt:event.capturedAt,sourceId:event.sourceId,eventId:event.eventId};
}
function missingMarket(eventId:string):NcaabEventArchiveEvidence {
  return{eventId,status:'MISSING',sourceId:null,capturedAt:null,sourceUrl:null,knownAtOriginalEmission:null,ageMinutes:null,operatorTimestamp:null,
    neutralSite:null,quotes:[],reasons:['FORECAST_NOT_AVAILABLE_FOR_CONTRACT_MATCH'],currentExecutable:false,contractVerified:false,validatedProbability:null,expectedValue:null,eligible:false};
}
function savedForecast(rows:Obj[],event:Observation,readAt:string):{forecast:NcaabManualFixture['forecast'];archive:ArchiveForecast}|null {
  const matching=rows.filter(r=>r.event_id===event.eventId&&instant(r.scheduled_at)===event.scheduledAt&&instant(r.created_at)!==null&&instant(r.created_at)!<=readAt)
    .sort((a,b)=>instant(b.created_at)!.localeCompare(instant(a.created_at)!));
  if(!matching.length)return null;
  const row=matching[0],created=instant(row.created_at)!,body=object(row.body);
  if(matching.filter(r=>instant(r.created_at)===created).some(r=>canonical(r.body)!==canonical(body)))return null;
  if(created>=event.scheduledAt||body.event_id!==event.eventId||instant(body.scheduled_at)!==event.scheduledAt||instant(body.created_at)!==created||
    body.home_id!==event.home.id||body.away_id!==event.away.id||body.state!=='FORECAST'||body.review_required===true||!string(body.model))return null;
  const probability=(v:unknown)=>{const n=number(v);return n!==null&&n>=0&&n<=1?n:null;};
  const hp=probability(body.home_win_probability),ap=probability(body.away_win_probability);
  if(hp!==null&&ap!==null&&Math.abs(hp+ap-1)>0.000001)return null;
  return{forecast:{model:String(body.model),emittedAt:created,homePoints:number(body.home_score),awayPoints:number(body.away_score),homeProbability:hp,awayProbability:ap,
    projectedMargin:number(body.projected_margin),projectedTotal:number(body.projected_total),winnerTeamId:[event.home.id,event.away.id].includes(String(body.predicted_winner))?String(body.predicted_winner):null,status:'EXPERIMENTAL'},
    archive:{event_id:event.eventId,scheduled_at:event.scheduledAt,created_at:created,home_id:event.home.id,away_id:event.away.id,state:'FORECAST',review_required:false}};
}

export function buildNcaabManualDataReport(input:NcaabManualDataInput, sheet?:SheetArchive):NcaabManualDataReport {
  const readAt=instant(input.readAt);
  if(!readAt||!validDate(input.date))throw Error('NCAAB_MANUAL_INVALID_DATE');
  if(input.readComplete!==true)throw Error('NCAAB_MANUAL_INCOMPLETE_SCAN');
  const year=Number(input.date.slice(0,4)),season=Number(input.date.slice(5,7))>=7?year+1:year;
  const rejectedDates=new Set<string>(),receipts=selectedReceipts(input,readAt,rejectedDates),sourceDates=receipts.map(r=>sourceDate(r.source_url)!).sort(),warnings=new Set<string>();
  const observations:Observation[]=[],blockedTeams=new Set<string>(),unverifiedDates=new Set<string>();let excludedEvents=0;
  for(const receipt of receipts)for(const raw of array(object(receipt.body).events)) {
    const e=observation(raw,{sourceId:receipt.id,capturedAt:receipt.captured_at,sourceDate:sourceDate(receipt.source_url),context:false},season);
    if(!e){
      excludedEvents++;unverifiedDates.add(sourceDate(receipt.source_url)!);
      for(const c of array(object(raw).competitions))for(const s of array(object(c).competitors)) {
        for(const candidate of [object(s).id,nested(s,'team','id')]){const teamId=id(candidate);if(teamId)blockedTeams.add(teamId);}
      }
      continue;
    }observations.push(e);
  }
  for(const raw of input.contexts) {
    const at=instant(raw.captured_at),updated=raw.updated_at===undefined?at:instant(raw.updated_at),header=object(raw.header);
    if(!at||!updated||at>readAt||updated>readAt)continue;
    if(raw.event_id!=='espn:'+id(header.id)||raw.provider_event_id!==id(header.id)){excludedEvents++;continue;}
    const e=observation(header,{sourceId:'ncaab_game_context_v2:'+String(raw.event_id),capturedAt:at,sourceDate:null,context:true},season);
    if(!e||e.state!=='FINAL'){excludedEvents++;continue;}
    const hs=detailStats(raw,e,'home'),as=detailStats(raw,e,'away');
    if(!hs||!as){excludedEvents++;continue;}
    e.offensiveBoards=[e.home,e.away].map(side=>offensiveBoards(array(raw.teams).map(object).find(t=>nested(t,'team','id')===side.id)?.statistics)) as [number|null,number|null];
    e.homeStats=hs;e.awayStats=as;e.detailCapturedAt=at;observations.push(e);
  }
  const grouped=new Map<string,Observation[]>();
  for(const e of observations)grouped.set(e.eventId,[...(grouped.get(e.eventId)??[]),e]);
  const events:Observation[]=[];
  for(const versions of grouped.values()) {
    if(new Set(versions.map(identity)).size!==1){excludedEvents++;for(const e of versions){blockedTeams.add(e.home.id);blockedTeams.add(e.away.id);}continue;}
    const primary=versions.filter(e=>!e.context),candidates=primary.length?primary:versions;
    candidates.sort((a,b)=>b.capturedAt.localeCompare(a.capturedAt)||a.sourceId.localeCompare(b.sourceId));
    const latest=candidates[0],tied=candidates.filter(e=>e.capturedAt===latest.capturedAt);
    const finals=versions.filter(e=>e.state==='FINAL');
    if(new Set(tied.map(eventSignature)).size!==1||new Set(finals.map(e=>[e.homeScore,e.awayScore].join(':'))).size>1) {
      excludedEvents++;blockedTeams.add(latest.home.id);blockedTeams.add(latest.away.id);continue;
    }
    latest.offensiveBoards??=[offensiveBoards(latest.home.raw.statistics),offensiveBoards(latest.away.raw.statistics)];
    const details=versions.filter(e=>e.context&&e.scheduledAt===latest.scheduledAt&&e.homeScore===latest.homeScore&&e.awayScore===latest.awayScore)
      .sort((a,b)=>b.capturedAt.localeCompare(a.capturedAt));
    if(!latest.context&&latest.state==='FINAL'&&details[0]) {
      const detail=details[0];
      latest.offensiveBoards=latest.offensiveBoards.map((primary,i)=>{
        const supplement=detail.offensiveBoards?.[i]??null;
        if(primary!==null&&supplement!==null&&primary!==supplement){if(sheet)latest.warnings.push('Rebotes ofensivos discrepantes.');return null;}
        return primary??supplement;
      }) as [number|null,number|null];
      latest.homeStats=mergeStats(latest.homeStats,detail.homeStats,latest.warnings);latest.awayStats=mergeStats(latest.awayStats,detail.awayStats,latest.warnings);
      if(!latest.periods.length)latest.periods=detail.periods;
      else if(detail.periods.length&&canonical(latest.periods)!==canonical(detail.periods)){latest.periods=[];latest.warnings.push('Mitades discrepantes entre capturas.');}
      latest.detailCapturedAt=detail.capturedAt;
    }
    events.push(latest);
  }
  events.sort((a,b)=>a.scheduledAt.localeCompare(b.scheduledAt)||a.eventId.localeCompare(b.eventId));
  const finals=events.filter(e=>e.state==='FINAL'&&e.date<input.date),today=events.filter(e=>e.date===input.date);
  const earliest=[...sourceDates.filter(d=>d<=input.date),...rejectedDates,...finals.map(e=>e.date)].sort()[0]??null,missingDates:string[]=[];
  if(earliest)for(let d=earliest;d<=input.date;d=addDay(d,1))if(!sourceDates.includes(d))missingDates.push(d);
  const recordsByTeam=new Map<string,{event:Observation;side:Side;record:NcaabManualTeam['reportedRecord']}[]>(),definitions=new Map<string,Side>();
  // Sort by the represented fixture date first. Re-reading an old scoreboard
  // today must not replace a newer season record with an old postgame record.
  for(const e of [...events].sort((a,b)=>a.scheduledAt.localeCompare(b.scheduledAt)||a.capturedAt.localeCompare(b.capturedAt)))for(const s of [e.home,e.away]) {
    const old=definitions.get(s.id),richerConference=old?.conference&&!old.conference.startsWith('Conferencia ESPN ')?old.conference:null;
    definitions.set(s.id,{...s,conference:s.conference?.startsWith('Conferencia ESPN ')?richerConference??s.conference:s.conference??old?.conference??null});
    if(!e.context){const r=record(s,e);if(r)recordsByTeam.set(s.id,[...(recordsByTeam.get(s.id)??[]),{event:e,side:s,record:r}]);}
  }
  const teams:NcaabManualTeam[]=[];
  for(const def of definitions.values()) {
    const history=finals.filter(e=>e.home.id===def.id||e.away.id===def.id).sort((a,b)=>b.scheduledAt.localeCompare(a.scheduledAt)||b.eventId.localeCompare(a.eventId));
    const all=history.map(e=>recent(e,def.id)),last=all.slice(0,10),archive=aggregate(all),recentAggregate=aggregate(last);
    if(sheet) {
      sheet.histories.set(def.id,all);
      const samples:Record<string,PossessionSample>={};
      for(const e of history){const value=possessionSample(e,e.home.id===def.id);if(value)samples[e.eventId]=value;}
      sheet.possessions.set(def.id,samples);
    }
    const reportedRecord=recordsByTeam.get(def.id)?.at(-1)?.record??null,wl=reportedRecord?.overall?.split('-').map(Number),gp=wl?.length===2?wl[0]+wl[1]:null;
    const unresolved=events.some(e=>(e.home.id===def.id||e.away.id===def.id)&&e.date<input.date&&!['FINAL','POSTPONED','CANCELLED'].includes(e.state));
    const completeSeason=gp!==null&&gp===all.length&&wl![0]===archive.wins&&wl![1]===archive.losses&&!unresolved&&!blockedTeams.has(def.id);
    const intervalMissing=last.length>0&&[...missingDates,...unverifiedDates].some(d=>d>=last.at(-1)!.date&&d<input.date);
    const sequenceVerified=!blockedTeams.has(def.id)&&!unresolved&&(completeSeason||last.length===10&&!intervalMissing);
    const complete=sequenceVerified&&last.length===10;
    const coverage=!last.length?'NO_HISTORY':complete?'COMPLETE_TEN':completeSeason&&gp!==null&&gp<10?'SEASON_UNDER_TEN':'PARTIAL';
    const teamWarnings=new Set<string>();
    if(!completeSeason)teamWarnings.add('La muestra archivada no verifica toda la temporada; el récord reportado se muestra por separado.');
    if(coverage==='SEASON_UNDER_TEN')teamWarnings.add('Temporada con menos de diez partidos verificados.');
    if(coverage==='PARTIAL')teamWarnings.add('La secuencia reciente no está completamente verificada.');
    if(unresolved)teamWarnings.add('Hay un partido anterior sin final verificado en el archivo.');
    if(blockedTeams.has(def.id))teamWarnings.add('Una identidad o marcador discrepante impide certificar la secuencia.');
    for(const e of history.slice(0,10))for(const w of e.warnings)teamWarnings.add(w);
    const lastGameAt=last[0]?.scheduledAt??null;
    teams.push({id:def.id,name:def.name,abbreviation:def.abbreviation,conference:def.conference,reportedRecord,
      archive:{...archive,completeSeason,from:all.at(-1)?.date??null,through:all[0]?.date??null,
        home:aggregate(all.filter(g=>g.venue==='HOME')),away:aggregate(all.filter(g=>g.venue==='AWAY')),neutral:aggregate(all.filter(g=>g.venue==='NEUTRAL'))},
      last10:{...recentAggregate,complete,sequenceVerified,expectedGames:gp===null?null:Math.min(10,gp),coverage},recentGames:last,
      rest:{lastGameAt,daysOff:sequenceVerified&&lastGameAt?Math.max(0,Math.round((Date.parse(input.date+'T12:00:00Z')-Date.parse(last[0].date+'T12:00:00Z'))/86400000)-1):null,verified:sequenceVerified&&lastGameAt!==null},
      warnings:[...teamWarnings]});
  }
  teams.sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
  const forecasts=new Map<string,NonNullable<ReturnType<typeof savedForecast>>>();
  for(const e of today){const f=savedForecast(input.predictions,e,readAt);if(f)forecasts.set(e.eventId,f);}
  const marketEvidence=buildNcaabArchivedEvidence({forecasts:[...forecasts.values()].map(f=>f.archive),receipts,asOf:readAt,dates:[input.date]});
  const fixtures:NcaabManualFixture[]=today.map(e=>({eventId:e.eventId,scheduledAt:e.scheduledAt,date:e.date,homeId:e.home.id,awayId:e.away.id,homeName:e.home.name,awayName:e.away.name,
    state:e.state,neutralSite:e.neutralSite,homeScore:e.homeScore,awayScore:e.awayScore,capturedAt:e.capturedAt,sourceId:e.sourceId,
    forecast:forecasts.get(e.eventId)?.forecast??null,markets:marketEvidence.events[e.eventId]??missingMarket(e.eventId)}));
  const slateCapturedAt=receipts.find(r=>sourceDate(r.source_url)===input.date)?.captured_at??null;
  if(!slateCapturedAt)warnings.add('No hay una captura de cartelera para la fecha solicitada; la cobertura del día no está verificada.');
  if(missingDates.length)warnings.add('Faltan capturas diarias en parte del intervalo; la cobertura se comprueba por equipo.');
  if(rejectedDates.size)warnings.add('Hay capturas históricas sin eventos diarios verificables; se conservan como huecos de cobertura.');
  if(excludedEvents)warnings.add('Se excluyeron eventos con identidad, cronología o marcador no verificable.');
  if(input.sourceErrors?.length)warnings.add('Parte del detalle adicional no estuvo disponible; cada estadística conserva su tamaño de muestra.');
  warnings.add('Historial y promedios: solo finales de días anteriores en Puerto Rico. Los finales de hoy no entran en esta muestra.');
  warnings.add('Los equipos incluyen rivales de otras divisiones presentes en las capturas; no es un censo completo de División I.');
  warnings.add('Las mitades se calculan con marcadores reales; el total final puede incluir prórroga. Porcentajes ponderados por intentos y muestra visible.');
  warnings.add('Esta consulta actual no reconstruye lo que conocía un pronóstico anterior. No crea predicciones ni cambia probabilidades.');
  const report:NcaabManualDataReport={schemaVersion:'NCAAB_MANUAL_DATA_V1',sport:'NCAAB',status:!slateCapturedAt||excludedEvents||rejectedDates.size||input.sourceErrors?.length?'PARTIAL':!fixtures.length?'EMPTY':'READY',
    date:input.date,timezone:TZ,readAt,seasonEndingYear:season,readOnly:true,providerCalls:0,databaseWrites:0,predictionAdjustment:false,modelPromoted:false,
    source:{name:'Archivo ESPN de Pick',slateCapturedAt,latestCapturedAt:[...receipts.map(r=>r.captured_at),...events.map(e=>e.detailCapturedAt).filter((x):x is string=>!!x)].sort().at(-1)??null,
      archiveFrom:finals.map(e=>e.date).sort()[0]??null,archiveThrough:finals.map(e=>e.date).sort().at(-1)??null,sourceDates,missingDates},
    coverage:{games:fixtures.length,teams:teams.length,archivedFinals:finals.length,sourceReceipts:receipts.length,teamsWithCompleteLast10:teams.filter(t=>t.last10.complete).length,
      teamsWithVerifiedSeason:teams.filter(t=>t.archive.completeSeason).length,gamesWithPeriods:finals.filter(e=>e.periods.length>=2).length,gamesWithDetailedStats:finals.filter(e=>e.detailCapturedAt!==null).length,
      excludedEvents,readComplete:true},fixtures,teams,warnings:[...warnings]};
  return report;
}

export function unavailableNcaabManualDataReport(input:{date:string;readAt:string;reason:string}):NcaabManualDataReport {
  const year=Number(input.date.slice(0,4)),safeReason=/^[A-Z0-9_]{1,80}$/.test(input.reason)?input.reason:'READ_UNAVAILABLE';
  return{schemaVersion:'NCAAB_MANUAL_DATA_V1',sport:'NCAAB',status:'UNAVAILABLE',date:input.date,timezone:TZ,readAt:input.readAt,
    seasonEndingYear:Number(input.date.slice(5,7))>=7?year+1:year,readOnly:true,providerCalls:0,databaseWrites:0,predictionAdjustment:false,modelPromoted:false,
    source:{name:'Archivo ESPN de Pick',slateCapturedAt:null,latestCapturedAt:null,archiveFrom:null,archiveThrough:null,sourceDates:[],missingDates:[]},
    coverage:{games:0,teams:0,archivedFinals:0,sourceReceipts:0,teamsWithCompleteLast10:0,teamsWithVerifiedSeason:0,gamesWithPeriods:0,gamesWithDetailedStats:0,excludedEvents:0,readComplete:false},
    fixtures:[],teams:[],warnings:['No fue posible verificar una lectura completa de los datos compartidos.',safeReason]};
}
