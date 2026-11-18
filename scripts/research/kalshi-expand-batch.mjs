#!/usr/bin/env node
// Read-only, resumable, capped discovery and collection. No trading or production writes.
import {mkdir,readFile,writeFile,stat} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const ROOT='https://external-api.kalshi.com/trade-api/v2';
const argv=process.argv.slice(2);
const arg=(n,d)=>argv.includes(n)?argv[argv.indexOf(n)+1]:d;
const games=Number(arg('--games','200')), pages=Number(arg('--discovery-pages','40'));
if(!Number.isInteger(games)||games<2||games>1200||!Number.isInteger(pages)||pages<1||pages>200) throw Error('Invalid --games (2..1200) or --discovery-pages (1..200)');
const out=resolve(arg('--out','tmp/kalshi-market-intelligence-expanded'));
await mkdir(out,{recursive:true});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function get(path,query){
 const u=new URL(ROOT+path);
 for(const [k,v] of Object.entries(query)) if(v)u.searchParams.set(k,String(v));
 for(let a=0;a<4;a++){
  try{
   const r=await fetch(u,{signal:AbortSignal.timeout(20000)});
   if([429,500,502,503,504].includes(r.status)&&a<3){await wait(900*(a+1));continue;}
   if(!r.ok)throw Error('HTTP '+r.status+' '+path);
   return r.json();
  }catch(e){if(a===3||/^HTTP 4(?!29)/.test(e.message))throw e;await wait(900*(a+1));}
 }
}
async function discover(series){
 const rows=[];const warnings=[];
 for(const endpoint of ['/markets','/historical/markets']){
  let cursor='',done=false;const seen=new Set();
  for(let i=0;i<pages;i++){
   const data=await get(endpoint,{series_ticker:series,limit:1000,cursor});
   if(!Array.isArray(data.markets))throw Error('Malformed markets response');
   rows.push(...data.markets);
   const next=data.cursor||'';
   if(!next){done=true;break;}
   if(seen.has(next))break;
   seen.add(next);cursor=next;
  }
  if(!done)warnings.push('Pagination cap reached: '+endpoint);
 }
 const byEvent=new Map();
 for(const m of rows){
  if(!m?.ticker?.startsWith(series+'-')||!['yes','no'].includes(m.result))continue;
  const event=m.event_ticker||m.ticker.slice(0,m.ticker.lastIndexOf('-'));
  if(!byEvent.has(event))byEvent.set(event,[]);
  byEvent.get(event).push(m);
 }
 const selected=[...byEvent].sort((a,b)=>b[0].localeCompare(a[0])).slice(0,Math.ceil(games/2))
  .map(([event,ms])=>{
   const m=ms.sort((a,b)=>a.ticker.localeCompare(b.ticker))[0];
   return {league:series==='KXNBAGAME'?'NBA':'NHL',event_ticker:event,ticker:m.ticker,result:m.result,title:m.title,game_start_utc:null};
  });
 return {series,found_events:byEvent.size,warnings,selected};
}
const scans=[];
for(const s of ['KXNBAGAME','KXNHLGAME']){
 try{scans.push(await discover(s));}
 catch(e){scans.push({series:s,found_events:0,warnings:[String(e)],selected:[]});}
}
const markets=scans.flatMap(x=>x.selected).slice(0,games);
await writeFile(join(out,'discovery.json'),JSON.stringify({generated_at:new Date().toISOString(),requested:games,discovered:markets.length,scans,selection:'One lexicographically first settled contract per game, independent of outcome; start time not verified'},null,2));
console.log('Discovered '+markets.length+' settled game contracts');
const collector=join(dirname(fileURLToPath(import.meta.url)),'kalshi-market-intelligence-v1.mjs');
const results=[];
for(let i=0;i<markets.length;i++){
 const m=markets[i], manifestFile=join(out,m.ticker+'.manifest.json');
 let old=null;try{old=JSON.parse(await readFile(manifestFile,'utf8'));}catch{}
 let status='REUSED', error=null, trades=old?.trade_count||0;
 if(!old||old.truncated||trades===0||!(await stat(join(out,m.ticker+'.trades.json')).catch(()=>null))){
  const p=spawnSync(process.execPath,[collector,'--ticker',m.ticker,'--out',out,'--max-pages','100'],{encoding:'utf8',timeout:180000,maxBuffer:1048576});
  try{old=JSON.parse(await readFile(manifestFile,'utf8'));}catch{}
  trades=old?.trade_count||0;status=p.status===0&&trades>0&&!old?.truncated?'DOWNLOADED':old?.truncated?'TRUNCATED':'FAILED';
  if(status==='FAILED')error=String(p.stderr||p.error?.message||'Collector failure').slice(0,300);
 }
 results.push({ticker:m.ticker,league:m.league,status,trades,error});
 if((i+1)%10===0||i===markets.length-1){
  await writeFile(join(out,'expanded-summary.json'),JSON.stringify({generated_at:new Date().toISOString(),requested_games:games,discovered_games:markets.length,processed:results.length,results,status:'RAW_UNVALIDATED'},null,2));
  console.log((i+1)+'/'+markets.length+' markets processed');
 }
 await wait(250);
}
console.log('Saved to '+out);
if(markets.length<games||results.some(r=>['TRUNCATED','FAILED'].includes(r.status)))process.exitCode=1;
