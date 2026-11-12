// Offline research only. No network, credentials, production writes or picks.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {parseResults} from '../../scripts/tennis-free/source-contract.mjs';
import {predictElo,updateEloDate} from '../../src/lib/ufc/elo-v2.ts';

const dayPattern=/^\d{4}-\d\d-\d\d$/;
const mainTour=new Set([2,3,4,7]);
const validDay=x=>typeof x==='string'&&dayPattern.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x;
const codeCounts=(counts,code)=>{counts[code]=(counts[code]??0)+1;};
export function replay({captures,holdoutFrom,holdoutThrough}){
 if(!Array.isArray(captures)||!validDay(holdoutFrom)||!validDay(holdoutThrough)||holdoutFrom>holdoutThrough)throw Error('INVALID_REPLAY_INPUT');
 const byKey=new Map(),conflicts=new Set(),excluded={};
 for(const {tour,observedAt,body} of captures){
  // A provider query filter is not an independent validation of the response.
  const parsed=parseResults(body,observedAt,tour);
  const allowed=body.data.filter(r=>r&&mainTour.has(Number(r.tournament?.rankId??r.rank))&&!r.player1?.members&&!r.player2?.members);
  for(let i=0;i<body.data.length-allowed.length;i++)codeCounts(excluded,'OUTSIDE_VERIFIED_MAIN_SINGLES');
  const {results,rejected}=parseResults({...body,data:allowed},observedAt,tour);
  // A duplicated identity within any archived page is ambiguous across the replay.
  for(const r of [...parsed.rejected,...rejected])if(r.code==='DUPLICATE_IDENTITY')conflicts.add(r.key);
  for(const r of rejected)codeCounts(excluded,r.code);
  for(const r of results){
   const day=r.recordedDate.slice(0,10);
   if(day>holdoutThrough)continue;
   const [a,b]=[r.a,r.b].sort((x,y)=>Number(x)-Number(y));
   const fact={id:r.key,event:tour,date:day,a:'p'+a,b:'p'+b,result:r.winnerId===a?'A':'B'};
   const existing=byKey.get(r.key);
   if(existing&&JSON.stringify(existing)!==JSON.stringify(fact))conflicts.add(r.key);
   else byKey.set(r.key,fact);
  }
 }
 for(const key of conflicts)byKey.delete(key);
 excluded.CONFLICTING_IDENTITIES=conflicts.size;
 const summaries={},forecasts=[];
 for(const tour of ['atp','wta']){
  const days=new Map(),ratings=new Map();
  for(const f of byKey.values())if(f.event===tour){
   if(!days.has(f.date))days.set(f.date,[]);
   days.get(f.date).push(f);
  }
  let training=0,eligible=0,abstained=0,issued=0,correct=0,brier=0,logLoss=0;
  for(const [date,facts] of [...days].sort(([a],[b])=>a.localeCompare(b))){
   facts.sort((a,b)=>a.id.localeCompare(b.id));
   if(date<holdoutFrom)training+=facts.length;
   else for(const f of facts){
    eligible++;
    const p=predictElo(ratings,f.a,f.b);
    if(!p||p.probabilityA===.5){abstained++;continue;}
    const expected=p.probabilityA>.5?'A':'B',actual=f.result==='A'?1:0;
    issued++;correct+=Number(expected===f.result);
    brier+=(p.probabilityA-actual)**2;
    logLoss-=Math.log(Math.max(1e-15,actual?p.probabilityA:1-p.probabilityA));
    forecasts.push({tour,key:f.id,day:date,sideA:f.a,sideB:f.b,selectedId:expected==='A'?f.a:f.b,
      probabilityA:p.probabilityA,priorA:p.priorA,priorB:p.priorB,lastDateA:p.lastDateA,lastDateB:p.lastDateB,
      actualWinnerId:f.result==='A'?f.a:f.b,correct:expected===f.result});
   }
   updateEloDate(ratings,facts,32);
  }
  summaries[tour]={training,eligible,abstained,issued,correct,coverage:eligible?issued/eligible:null,
   accuracy:issued?correct/issued:null,brier:issued?brier/issued:null,logLoss:issued?logLoss/issued:null};
 }
 return {model:'TENNIS_ELO_K32_RETROSPECTIVE_V1',holdoutFrom,holdoutThrough,excluded,summaries,forecasts,
   retrospectiveOnly:true,providerTimeCertified:false,roi:null,productionWrites:0};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==3)throw Error('USAGE: replay.mjs <authorized-local-captures.json>');
 const input=readFileSync(process.argv[2]);
 const result=replay(JSON.parse(input));
 console.log(JSON.stringify({inputSha256:createHash('sha256').update(input).digest('hex'),...result},null,2));
}
