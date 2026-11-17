#!/usr/bin/env node
// Research only: independently verify event start using ESPN scores and analyze Kalshi prints.
// No credentials, production writes, betting, or live recommendation.
import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
const argv=process.argv.slice(2);
const opt=(k,d)=>argv.includes(k)?argv[argv.indexOf(k)+1]:d;
const dir=resolve(opt('--dir','tmp/kalshi-market-intelligence-expanded'));
const output=resolve(opt('--out',dir));
const validOnly=opt('--season','all'); // all / regular / preseason
await mkdir(output,{recursive:true});
const aliases={
 NBA:{GS:'GSW',NY:'NYK',SA:'SAS',NO:'NOP',UTAH:'UTA',UT:'UTA',BKN:'BKN',BRK:'BKN',PHX:'PHX'},
 NHL:{TB:'TBL',NJ:'NJD',LA:'LAK',SJ:'SJS',MON:'MTL',MTL:'MTL',WAS:'WSH',VGK:'VGK',VEG:'VGK',NYI:'NYI',NYR:'NYR',UTA:'UTA'}
};
function normalize(league,s){const code=String(s||'').toUpperCase().replace(/[^A-Z]/g,'');return aliases[league]?.[code]||code;}
function eventInfo(manifest) {
 const ticker=manifest.market?.event_ticker || manifest.ticker?.slice(0,manifest.ticker.lastIndexOf('-'));
 const hit=/^KX(NBA|NHL)GAME-(\d\d)([A-Z]{3})(\d\d)([A-Z]{6,8})$/.exec(ticker||'');
 if(!hit)return null;
 const league=hit[1],date='20'+hit[2]+'-'+({JAN:'01',FEB:'02',MAR:'03',APR:'04',MAY:'05',JUN:'06',JUL:'07',AUG:'08',SEP:'09',OCT:'10',NOV:'11',DEC:'12'}[hit[3]]||'00')+'-'+hit[4];
 const teams=hit[5];if(teams.length!==6)return null;
 return {league,date,teams:[normalize(league,teams.slice(0,3)),normalize(league,teams.slice(3,6))],ticker};
}
const timeZone='America/New_York';
function eventDateUTC(iso){return new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));}
function yyyyMMdd(d){return d.replaceAll('-','');}
const dateCache=new Map();
async function fetchSchedule(league,date) {
 const key=league+'|'+date;
 if(dateCache.has(key))return dateCache.get(key);
 const path=league==='NBA'?'basketball/nba':'hockey/nhl';
 const url='https://site.api.espn.com/apis/site/v2/sports/'+path+'/scoreboard?dates='+yyyyMMdd(date)+'&limit=200';
 let lastErr;
 for(let attempt=0;attempt<3;attempt++){
  try{
   const resp=await fetch(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(18000)});
   if(!resp.ok)throw Error('ESPN HTTP '+resp.status);
   const body=await resp.json();
   if(!Array.isArray(body.events))throw Error('Missing ESPN events array');
   dateCache.set(key,body.events);
   return body.events;
  }catch(e){lastErr=e;await new Promise(r=>setTimeout(r,(attempt+1)*600));}
 }
 throw lastErr;
}
function matchGame(info,events){
 const hits=events.filter(ev=>{
  const comps=ev.competitions?.[0]?.competitors||[];
  const codes=comps.map(c=>normalize(info.league,c.team?.abbreviation));
  return comps.length===2&&codes.length===2&&info.teams.every(x=>codes.includes(x))&&eventDateUTC(ev.date)===info.date;
 });
 if(hits.length!==1)return {reason:hits.length?'AMBIGUOUS_ESPN_MATCH':'NO_ESPN_MATCH'};
 const e=hits[0], comps=e.competitions[0].competitors;
 const winner=comps.find(c=>c.winner===true);
 const seasonType=e.season?.type ?? null;
 const match={espn_event_id:e.id,game_start_utc:e.date,season_type:seasonType,game_status:e.status?.type?.name||null,
  winner_code:winner?normalize(info.league,winner.team?.abbreviation):null};
 return {match};
}
const files=(await readdir(dir)).filter(x=>x.endsWith('.manifest.json')).sort();
const summary=[],buckets=[],issues=[];
for(let i=0;i<files.length;i++){
 const file=files[i];let m;
 try{m=JSON.parse(await readFile(join(dir,file),'utf8'))}catch(e){issues.push({file,reason:'BAD_MANIFEST'});continue;}
 const info=eventInfo(m),row={ticker:m.ticker,league:info?.league||null,date:info?.date||null,kalshi_result:m.market?.result||null,
  manifest_count:m.trade_count,manifest_truncated:Boolean(m.truncated),status:'EXCLUDED',reason:null,espn_event_id:null,
  game_start_utc:null,season_type:null,observed_trades:null,pregame_trades:null,window_60m_trades:null,
  window_60m_quantity:null,window_60m_price_change:null,large_trade_max_quantity:null,contract_outcome_verified:null};
 if(!info){row.reason='UNPARSEABLE_EVENT';summary.push(row);continue;}
 let events;
 try{events=await fetchSchedule(info.league,info.date);}
 catch(e){row.reason='ESPN_UNAVAILABLE';issues.push({file,reason:row.reason,detail:String(e)});summary.push(row);continue;}
 const match=matchGame(info,events);
 if(!match.match){row.reason=match.reason;summary.push(row);continue;}
 const e=match.match;Object.assign(row,{espn_event_id:e.espn_event_id,game_start_utc:e.game_start_utc,season_type:e.season_type});
 if(!e.winner_code||!['yes','no'].includes(m.market?.result)){row.reason='MISSING_FINAL_RESULT';summary.push(row);continue;}
 const expected=(e.winner_code===normalize(info.league,String(m.ticker).split('-').at(-1)))?'yes':'no';
 if(expected!==m.market.result){row.reason='SETTLEMENT_MISMATCH';summary.push(row);continue;}
 row.contract_outcome_verified=true;
 if(validOnly==='regular'&&e.season_type!==2||validOnly==='preseason'&&e.season_type!==1){row.reason='SEASON_FILTER';summary.push(row);continue;}
 if(m.truncated){row.reason='TRUNCATED';summary.push(row);continue;}
 let trades;
 try{trades=JSON.parse(await readFile(join(dir,m.ticker+'.trades.json'),'utf8'));}
 catch(e){row.reason='MISSING_OR_BAD_TRADES';summary.push(row);continue;}
 if(!Array.isArray(trades)||trades.length!==m.trade_count){row.reason='TRADE_COUNT_MISMATCH';summary.push(row);continue;}
 let invalid=0;
 const parsed=trades.map(t=>({ms:Date.parse(t.time),price:Number(t.yes_price),qty:Number(t.quantity)}))
 .filter(t=>{const ok=Number.isFinite(t.ms)&&Number.isFinite(t.price)&&t.price>0&&t.price<1&&Number.isFinite(t.qty)&&t.qty>0;if(!ok)invalid++;return ok;})
 .sort((a,b)=>a.ms-b.ms);
 if(invalid){row.reason='INVALID_TRADE_ROWS';summary.push(row);continue;}
 const start=Date.parse(e.game_start_utc),pre=parsed.filter(t=>t.ms<start);
 row.observed_trades=parsed.length;row.pregame_trades=pre.length;
 const lastHour=pre.filter(t=>t.ms>=start-3600000);
 row.window_60m_trades=lastHour.length;
 row.window_60m_quantity=lastHour.reduce((sum,t)=>sum+t.qty,0);
 row.window_60m_price_change=lastHour.length>1?Number((lastHour.at(-1).price-lastHour[0].price).toFixed(4)):null;
 row.large_trade_max_quantity=pre.length?pre.reduce((max,t)=>Math.max(max,t.qty),0):null;
 for(let window=24;window>0;window--){
  const end=start-(window-1)*900000,begin=end-900000;
  const ts=pre.filter(t=>t.ms>=begin&&t.ms<end);
  buckets.push({ticker:m.ticker,league:info.league,game_start_utc:e.game_start_utc,minutes_to_start:window*15,
   trades:ts.length,contracts:ts.reduce((a,t)=>a+t.qty,0),price_first:ts[0]?.price??null,price_last:ts.at(-1)?.price??null,
   outcome:m.market.result});
 }
 row.status='MATCHED_VERIFIED';summary.push(row);
 if((i+1)%25===0)console.log((i+1)+'/'+files.length+' checked');
}
function csv(rows){
 const cols=Object.keys(rows[0]||{ticker:'',reason:''});
 return [cols.join(','),...rows.map(r=>cols.map(k=>'"'+String(r[k]??'').replaceAll('"','""')+'"').join(',')).join('\n')].join('\n')+'\n';
}
await writeFile(join(output,'espn-verified-market-summary.csv'),csv(summary));
await writeFile(join(output,'espn-verified-15m-buckets.csv'),csv(buckets));
const report={generated_at:new Date().toISOString(),files:files.length,verified:summary.filter(r=>r.status==='MATCHED_VERIFIED').length,
 excluded:summary.filter(r=>r.status!=='MATCHED_VERIFIED').length,reason_counts:Object.fromEntries([...new Set(summary.filter(r=>r.reason).map(r=>r.reason))].map(reason=>[reason,summary.filter(r=>r.reason===reason).length])),
 pregame_trades:summary.reduce((a,r)=>a+(r.pregame_trades||0),0),not_a_predictive_backtest:true,
 caveats:['ESPN event.date is scheduled start, not independently observed actual tipoff/puck drop','ESPN public feed may be incomplete or altered; unmatched markets excluded','Last-hour trade prints cannot establish executable bid/ask, insider identities or causality','In-game trades excluded using scheduled start; starts earlier than scheduled could leak','Selection of one contract per event is not a random sample of all sides']};
await writeFile(join(output,'espn-verification-report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
