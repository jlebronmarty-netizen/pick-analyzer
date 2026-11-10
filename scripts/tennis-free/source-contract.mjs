/** No credentials, remote fetching or database writes here. Provider responses remain unverified until a real FREE account preflight. */
export const TENNIS_HOST='tennis-api-atp-wta-itf.p.rapidapi.com';
export const TENNIS_URL='https://'+TENNIS_HOST+'/tennis/v2/upcoming/matches?group=singles&rank=2,3,4,7&sortBy=startTime&include=fixtureDetails,metadata&pageSize=500&pageNo=1';
const fail=code=>{throw Error(code);};
const numericId=x=>(typeof x==='number'&&Number.isSafeInteger(x)&&x>0)||typeof x==='string'&&/^[1-9]\d{0,10}$/.test(x)?String(x):null;
const instant=x=>typeof x==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?(?:Z|[+-]\d\d:\d\d)$/.test(x)&&Number.isFinite(Date.parse(x))?new Date(x).toISOString():null;
const label=x=>typeof x==='string'&&x.length>=3&&x.length<150&&!/unknown|tbd|bye|qualifier|\//i.test(x)?x:null;
const decimal=x=>typeof x==='number'&&Number.isFinite(x)&&x>=1.01&&x<=1000?x:null;
function identity(row){
 const p=numericId(row.player1?.id),q=numericId(row.player2?.id),t=numericId(row.tournament?.id),r=numericId(row.roundId??row.round?.id);
 if(!p||!q||p===q||!t||!r||!['atp','wta'].includes(row.type))return null;
 const [a,b]=[p,q].sort((a,b)=>Number(a)-Number(b));
 const provided=String(row.liveMatchId??'').split('-');
 if(provided.length!==4||provided[2]!==t||provided[3]!==r||new Set(provided.slice(0,2)).size!==2||!provided.slice(0,2).every(x=>x===p||x===q))return null;
 return {key:row.type+':'+a+'-'+b+'-'+t+'-'+r,a:p,b:q,tournamentId:t,roundId:r};
}
function price(row,id,observedAt){
 const q=row.odds;
 if(!q||Array.isArray(q)||typeof q!=='object'||!['1','2'].includes(String(q.id_b_o)))return null;
 const x=numericId(q.id1_o),y=numericId(q.id2_o),a=decimal(q.k1),b=decimal(q.k2);
 if(!x||!y||x===y||!a||!b||!(x===id.a&&y===id.b||x===id.b&&y===id.a))return null;
 return {book:String(q.id_b_o)==='2'?'Pinnacle':'Marathonbet',aDecimal:x===id.a?a:b,bDecimal:x===id.a?b:a,observedAt,sourceUpdatedAt:null,executionVerified:false};
}
export function parseUpcoming(body,observedAt){
 if(!instant(observedAt)||!body||!Array.isArray(body.matches)||body.hasNextPage!==false)fail('SOURCE_SCHEMA_OR_PAGE_INCOMPLETE');
 const accepted=[],rejected=[];
 for(let index=0;index<body.matches.length;index++){
  const r=body.matches[index],id=r&&identity(r),a=label(r?.player1?.name),b=label(r?.player2?.name);
  const date=instant(r?.date??r?.startTime);
  if(!id||!a||!b||r.isBye===true||r.awaitingParticipants===true||r.player1?.members||r.player2?.members){rejected.push({index,code:'PARTICIPANTS_OR_IDENTITY'});continue;}
  if(!date||date<=observedAt||!['live','schedule'].includes(r.startTimeSource)){rejected.push({index,code:'NOT_VERIFIED_FUTURE_TIME'});continue;}
  if(![2,3,4,7].includes(Number(r.tournament?.rankId??r.rank))){rejected.push({index,code:'OUTSIDE_MAIN_TOUR_SINGLES'});continue;}
  accepted.push({...id,aName:a,bName:b,scheduledAt:date,sourceTimeBasis:r.startTimeSource,price:price(r,id,observedAt)});
 }
 const byId=new Map(),conflicts=new Set();
 for(const r of accepted){if(byId.has(r.key))conflicts.add(r.key);byId.set(r.key,r);}
 return {schema:'TENNIS_SOURCE_CANDIDATE_V1',status:'OFFLINE_CONTRACT_ONLY',observedAt,events:[...byId.values()].filter(r=>!conflicts.has(r.key)).sort((a,b)=>a.scheduledAt.localeCompare(b.scheduledAt)||a.key.localeCompare(b.key)),
  rejected:[...rejected,...[...conflicts].map(key=>({key,code:'DUPLICATE_IDENTITY'}))],forecastsIssued:0,databaseWrites:0};
}
export function parseResults(body,observedAt,tour){
 if(!instant(observedAt)||!['atp','wta'].includes(tour)||!body||!Array.isArray(body.data)||body.hasNextPage!==false)fail('SOURCE_SCHEMA_OR_PAGE_INCOMPLETE');
 const accepted=[],rejected=[];
 for(let index=0;index<body.data.length;index++){
  const r=body.data[index],row=r?{...r,type:tour}:null,id=row&&identity(row),date=instant(r?.date);
  if(!id||!date||date>observedAt||!label(r?.player1?.name)||!label(r?.player2?.name)){rejected.push({index,code:'RESULT_IDENTITY_OR_DATE'});continue;}
  if(r.result_type!=='completed'||numericId(r.match_winner)!==id.a||typeof r.result!=='string'||!/\d[ -]\d/.test(r.result)||/ret|w\/?o|def/i.test(r.result)){rejected.push({index,code:'NON_DECISIVE_OR_AMBIGUOUS_RESULT'});continue;}
  accepted.push({...id,recordedDate:date,winnerId:id.a,result:r.result,observedAt});
 }
 const keys=new Set(),conflicts=new Set();
 for(const r of accepted){if(keys.has(r.key))conflicts.add(r.key);keys.add(r.key);}
 return {results:accepted.filter(r=>!conflicts.has(r.key)),rejected:[...rejected,...[...conflicts].map(key=>({key,code:'DUPLICATE_IDENTITY'}))]};
}
