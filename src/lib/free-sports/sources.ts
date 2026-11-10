import type {Fixture,League,Party,Quote} from './model';

type Competition={id?:unknown;date?:unknown;timeValid?:unknown;status?:{type?:{name?:unknown;completed?:unknown;state?:unknown}};competitors?:Competitor[];odds?:Odds[]};
type Competitor={id?:unknown;homeAway?:unknown;team?:{id?:unknown;displayName?:unknown};athlete?:{fullName?:unknown};score?:unknown;winner?:unknown};
type Offer={odds?:unknown;link?:{tracking?:{tags?:{gameId?:unknown;betSide?:unknown}}}};
type Odds={provider?:{id?:unknown;name?:unknown};moneyline?:{displayName?:unknown;home?:{close?:Offer};away?:{close?:Offer}};homeTeamOdds?:{team?:{id?:unknown}};awayTeamOdds?:{team?:{id?:unknown}}};
type Event={id?:unknown;season?:{year?:unknown;type?:unknown};competitions?:Competition[];groupings?:{grouping?:{slug?:unknown};competitions?:Competition[]}[]};
export type BsnEvent={id:string;start_time:string|null;home_team_id:string|null;away_team_id:string|null;home_team:string|null;away_team:string|null;status:string|null;home_score:number|null;away_score:number|null;metadata:Record<string,unknown>|null};
const id=(x:unknown)=>typeof x==='string'&&/^[1-9]\d{0,12}$/.test(x)?x:null;
const name=(x:unknown)=>typeof x==='string'&&x.trim().length>1&&x.length<=150&&!/^(tbd|tba|bye|unknown|qualifier)$/i.test(x.trim())?x.trim():null;
const iso=(x:unknown)=>typeof x==='string'&&/^\d{4}-\d\d-\d\dT/.test(x)&&Number.isFinite(Date.parse(x))?new Date(x).toISOString():null;
const score=(x:unknown)=>typeof x==='number'&&Number.isSafeInteger(x)&&x>=0?x:typeof x==='string'&&/^\d{1,4}$/.test(x)?Number(x):null;
const list=<T,>(x:T[]|undefined):T[]=>Array.isArray(x)?x:[];
const odd=(x:unknown)=>typeof x==='string'&&/^[+-]\d{3,5}$/.test(x)&&Math.abs(Number(x))>=100&&Math.abs(Number(x))<=10000?Number(x):null;
function pregameQuote(c:Competition,eventId:string,a:string,b:string,observedAt:string):Quote|null{
 const offers=list(c.odds).filter(o=>o?.provider?.id==='100'&&['Draft Kings','DraftKings'].includes(String(o.provider.name)));
 if(offers.length!==1)return null;
 const q=offers[0],ml=q.moneyline,h=ml?.home?.close,v=ml?.away?.close;
 if(ml?.displayName!=='Moneyline'||q.homeTeamOdds?.team?.id!==a||q.awayTeamOdds?.team?.id!==b)return null;
 const tag=(o:Offer|undefined,side:string)=>{
  const t=o?.link?.tracking?.tags;
  return String(t?.gameId)===eventId&&t?.betSide===side;
 };
 const x=odd(h?.odds),y=odd(v?.odds);
 return x!==null&&y!==null&&tag(h,'home')&&tag(v,'away')?{book:'DraftKings',a:x,b:y,capturedAt:observedAt}:null;
}
function party(c:Competitor,nfl:boolean):Party|null{
 const pid=id(c?.id),label=name(nfl?c?.team?.displayName:c?.athlete?.fullName);
 return pid&&label&&(!nfl||c.team?.id===pid)?{id:pid,name:label}:null;
}
function competition(c:Competition,eventId:string,nfl:boolean,observedAt:string):Fixture|null{
 const start=iso(c.date);
 const people=list(c.competitors);
 if(!start||c.timeValid!==true||people.length!==2)return null;
 const aRaw=nfl?people.find(p=>p?.homeAway==='home'):people[0],bRaw=nfl?people.find(p=>p?.homeAway==='away'):people[1];
 if(!aRaw||!bRaw)return null;
 const a=party(aRaw,nfl),b=party(bRaw,nfl);
 if(!a||!b||a.id===b.id)return null;
 const status=c.status?.type,base={id:eventId,start,a,b,quote:null,winner:null,reason:null};
 if(status?.name==='STATUS_SCHEDULED'&&status.completed===false&&status.state==='pre'&&start>observedAt)
  return {...base,state:'PRE',quote:nfl?pregameQuote(c,eventId,a.id,b.id,observedAt):null};
 if(status?.name==='STATUS_FINAL'&&status.completed===true&&status.state==='post'&&start<observedAt){
  if(nfl){
   const x=score(aRaw.score),y=score(bRaw.score);
   if(x===null||y===null)return null;
   return x===y?{...base,state:'TIE',reason:'Empate oficial'}:{...base,state:'FINAL',winner:x>y?a.id:b.id};
  }
  if(typeof aRaw.winner!=='boolean'||typeof bRaw.winner!=='boolean'||aRaw.winner===bRaw.winner)return null;
  return {...base,state:'FINAL',winner:aRaw.winner?a.id:b.id};
 }
 if(['STATUS_RETIRED','STATUS_WALKOVER','STATUS_CANCELED','STATUS_CANCELLED','STATUS_ABANDONED','STATUS_DEFAULTED'].includes(String(status?.name)))
  return {...base,state:'EXCLUDED',reason:String(status?.name)};
 if(status?.state==='in'||status?.name==='STATUS_POSTPONED')return {...base,state:'LIVE',reason:String(status.name??'')};
 return null;
}
function unique(events:Fixture[]){
 const rows=new Map<string,Fixture>(),conflicts=new Set<string>();
 for(const e of events){const old=rows.get(e.id);if(old&&JSON.stringify(old)!==JSON.stringify(e))conflicts.add(e.id);rows.set(e.id,e);}
 return [...rows.values()].filter(e=>!conflicts.has(e.id)).sort((a,b)=>a.start.localeCompare(b.start)||a.id.localeCompare(b.id));
}
export function parseEspn(input:unknown,league:Exclude<League,'BSN'>,observedAt:string,year:number){
 if(!input||typeof input!=='object'||!Array.isArray((input as {events?:unknown}).events))throw Error('INVALID_SOURCE_SCHEMA');
 const events=(input as {events:Event[]}).events,rows:Fixture[]=[];
 for(const e of events){
  if(league==='NFL'){
   const eventId=id(e?.id);if(!eventId||e.season?.year!==year||e.season.type!==2)continue;
   for(const c of list(e.competitions)){if(c?.id!==eventId)continue;const row=competition(c,eventId,true,observedAt);if(row)rows.push(row);}
  }else{
   if(typeof e?.id!=='string'||!/^\d+-\d{4}$/.test(e.id))continue;
   for(const g of list(e.groupings)){
    if(g?.grouping?.slug!==(league==='ATP'?'mens-singles':'womens-singles'))continue;
    for(const c of list(g.competitions)){const match=id(c?.id);if(!match)continue;const row=competition(c,e.id+'/'+match,false,observedAt);if(row)rows.push(row);}
   }
  }
 }
 if(events.length>0&&rows.length===0&&league!=='NFL')throw Error('NO_PARSEABLE_COMPETITIONS');
 return unique(rows);
}
export function parseBsn(rows:BsnEvent[],observedAt:string){
 return unique(rows.flatMap((r):Fixture[]=>{
  const start=iso(r.start_time),a=r.home_team_id,b=r.away_team_id,x=name(r.home_team),y=name(r.away_team);
  if(!start||!r.id||!a||!b||a===b||!x||!y)return [];
  const base={id:r.id,start,a:{id:a,name:x},b:{id:b,name:y},quote:null,winner:null,reason:null};
  const status=r.status?.toLowerCase(),home=score(r.home_score),away=score(r.away_score);
  if(start<observedAt&&['completed','final','closed','postgame'].includes(status??'')&&home!==null&&away!==null&&home!==away)
   return [{...base,state:'FINAL',winner:home>away?a:b}];
  // Explicit operator contract. The existing retrospective homepage rows do not satisfy it.
  const att=r.metadata?.free_shadow_attestation as {source?:unknown;capturedAt?:unknown;reference?:unknown}|undefined;
  const capture=iso(att?.capturedAt);
  if(!['permissioned_feed','operator_attested_csv'].includes(String(att?.source))||typeof att?.reference!=='string'||
     !att.reference.trim()||!capture||capture>observedAt||capture>=start)return [];
  if(status==='scheduled'&&start>observedAt)return [{...base,state:'PRE'}];
  if(['cancelled','canceled','abandoned'].includes(status??''))return [{...base,state:'EXCLUDED',reason:status??null}];
  return [];
 }));
}

// Open CC BY 4.0 release; the legacy ESPN parser above is used only for offline source comparison.
export const NFLVERSE_SCHEDULE='https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv';
const nflNames:Record<string,string>={
 ARI:'Arizona Cardinals',ATL:'Atlanta Falcons',BAL:'Baltimore Ravens',BUF:'Buffalo Bills',CAR:'Carolina Panthers',
 CHI:'Chicago Bears',CIN:'Cincinnati Bengals',CLE:'Cleveland Browns',DAL:'Dallas Cowboys',DEN:'Denver Broncos',
 DET:'Detroit Lions',GB:'Green Bay Packers',HOU:'Houston Texans',IND:'Indianapolis Colts',JAX:'Jacksonville Jaguars',
 KC:'Kansas City Chiefs',LA:'Los Angeles Rams',LAC:'Los Angeles Chargers',LV:'Las Vegas Raiders',MIA:'Miami Dolphins',
 MIN:'Minnesota Vikings',NE:'New England Patriots',NO:'New Orleans Saints',NYG:'New York Giants',NYJ:'New York Jets',
 PHI:'Philadelphia Eagles',PIT:'Pittsburgh Steelers',SEA:'Seattle Seahawks',SF:'San Francisco 49ers',
 TB:'Tampa Bay Buccaneers',TEN:'Tennessee Titans',WAS:'Washington Commanders',
};
const eastern=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function easternKickoff(day:string,time:string){
 if(!/^\d{4}-\d\d-\d\d$/.test(day)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))return null;
 const local=day+' '+time,nominal=Date.parse(day+'T'+time+':00Z');
 if(!Number.isFinite(nominal))return null;
 const exact=[4,5].map(h=>new Date(nominal+h*3600000)).filter(d=>eastern.format(d)===local);
 return exact.length===1?exact[0].toISOString():null;
}
function csvRows(csv:string){
 const rows:string[][]=[];let fields:string[]=[],value='',quoted=false,closed=false;
 for(let i=0;i<csv.length;i++){
  const ch=csv[i];
  if(quoted){
   if(ch==='"'){
    if(csv[i+1]==='"'){value+='"';i++;}
    else{quoted=false;closed=true;}
   }else value+=ch;
  }else if(ch==='"'&&!value&&!closed)quoted=true;
  else if(ch===','){fields.push(value);value='';closed=false;}
  else if(ch==='\n'||ch==='\r'){
   if(ch==='\r'&&csv[i+1]==='\n')i++;
   fields.push(value);rows.push(fields);fields=[];value='';closed=false;
  }else if(closed||ch==='"')throw Error('NFLVERSE_INVALID_CSV');
  else value+=ch;
 }
 if(quoted)throw Error('NFLVERSE_INVALID_CSV');
 if(value||fields.length||closed)rows.push([...fields,value]);
 return rows;
}
export function parseNflverse(csv:string,observedAt:string,year:number){
 const [header,...lines]=csvRows(csv.replace(/^\uFEFF/,''));
 const required=['game_id','season','game_type','gameday','gametime','home_team','away_team','home_score','away_score','result'];
 if(!header||required.some(k=>header.filter(h=>h===k).length!==1))throw Error('NFLVERSE_INVALID_HEADER');
 const field=Object.fromEntries(required.map(k=>[k,header.indexOf(k)]));
 const rows=lines.flatMap((r):Fixture[]=>{
  if(r.length!==header.length||r[field.season]!==String(year)||r[field.game_type]!=='REG')return [];
  const home=r[field.home_team],away=r[field.away_team],eventId=r[field.game_id];
  const start=easternKickoff(r[field.gameday],r[field.gametime]);
  if(!start||!Object.hasOwn(nflNames,home)||!Object.hasOwn(nflNames,away)||home===away||
     !new RegExp('^'+year+'_\\d{2}_'+away+'_'+home+'$').test(eventId))return [];
  const base={id:eventId,start,a:{id:home,name:nflNames[home]},b:{id:away,name:nflNames[away]},quote:null,winner:null,reason:null};
  const x=score(r[field.home_score]),y=score(r[field.away_score]),result=r[field.result];
  if(start>observedAt&&r[field.home_score]===''&&r[field.away_score]===''&&result==='')return [{...base,state:'PRE'}];
  if(start<observedAt&&x!==null&&y!==null&&result!==''&&Number(result)===x-y)
   return x===y?[{...base,state:'TIE',reason:'Empate oficial'}]:[{...base,state:'FINAL',winner:x>y?home:away}];
  return [];
 });
 return unique(rows);
}
