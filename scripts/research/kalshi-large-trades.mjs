#!/usr/bin/env node
// Offline Kalshi research: single-print side notional, not an identified bettor's wager.
import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
const argv=process.argv.slice(2);
const arg=(k,d)=>argv.includes(k)?argv[argv.indexOf(k)+1]:d;
const dir=resolve(arg('--dir','tmp/kalshi-market-intelligence-expanded'));
const dest=resolve(arg('--out',join(dir,'large-trades-report')));
const min=Number(arg('--min-usd','25000'));
if(!(min>0)||!Number.isFinite(min))throw Error('Invalid --min-usd');
await mkdir(dest,{recursive:true});
const fmtPR=iso=>new Intl.DateTimeFormat('en-US',{timeZone:'America/Puerto_Rico',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(iso));
const round=(v,n=2)=>Number(v.toFixed(n));
const csv=(rows,cols)=>[cols.join(','),...rows.map(r=>cols.map(k=>'"'+String(r[k]??'').replaceAll('"','""')+'"').join(','))].join('\n')+'\n';
const starts=new Map();
try{
 const lines=(await readFile(join(dir,'espn-verified-market-summary.csv'),'utf8')).trim().split(/\r?\n/);
 const header=lines.shift().split(',');
 for(const line of lines){
  const cells=line.match(/(?:"(?:[^"]|"")*"|[^,]*)(?:,|$)/g)?.map(v=>v.replace(/,$/,'').replace(/^"|"$/g,'').replace(/""/g,'"'))||[];
  const x=Object.fromEntries(header.map((key,i)=>[key,cells[i]]));
  if(x.status==='MATCHED_VERIFIED'&&x.game_start_utc)starts.set(x.ticker,Date.parse(x.game_start_utc));
 }
}catch(e){console.warn('No verified schedule available:',e.message)}
const files=(await readdir(dir)).filter(n=>n.endsWith('.manifest.json')).sort();
const matches=[],errors=[],marketCounts=[];
for(const [i,file] of files.entries()){
 try{
  const m=JSON.parse(await readFile(join(dir,file),'utf8')),ticker=m.ticker||file.replace('.manifest.json','');
  const trades=JSON.parse(await readFile(join(dir,ticker+'.trades.json'),'utf8'));
  if(m.truncated||!Array.isArray(trades)||trades.length!==m.trade_count){errors.push({ticker,reason:'TRUNCATED_OR_COUNT_MISMATCH'});continue;}
  const start=starts.get(ticker),settlement=m.market?.result;
  let n=0;
  for(const t of trades){
   const side=t.taker_outcome_side,p=Number(t.yes_price),qty=Number(t.quantity),ms=Date.parse(t.time);
   if(!['yes','no'].includes(side)||!(p>0&&p<1)||!(qty>0)||!Number.isFinite(ms))continue;
   const px=side==='yes'?p:1-p,notional=qty*px;
   if(notional<min)continue;
   n++;
   const timing=Number.isFinite(start)?(ms<start?'BEFORE_SCHEDULED_START':'AT_OR_AFTER_SCHEDULED_START'):'START_UNVERIFIED';
   const outcome=['yes','no'].includes(settlement)?(side===settlement?'WINNING_SIDE':'LOSING_SIDE'):'UNKNOWN';
   matches.push({league:ticker.startsWith('KXNBA')?'NBA':'NHL',ticker,trade_id:t.trade_id,
    time_utc:t.time,time_puerto_rico:fmtPR(t.time),scheduled_start_utc:Number.isFinite(start)?new Date(start).toISOString():'',
    timing,taker_outcome_side:side,taker_book_side:t.taker_book_side,side_price_percent:round(px*100),
    yes_price_percent:round(p*100),contracts:round(qty),side_notional_usd:round(notional),
    is_block_trade:t.is_block_trade,contract_settlement:settlement,
    conditional_side_outcome:outcome,conditional_pnl_if_bought_held_usd:outcome==='UNKNOWN'?'':round((outcome==='WINNING_SIDE'?qty:0)-notional)});
  }
  marketCounts.push({ticker,prints:trades.length,qualifying:n});
 }catch(e){errors.push({file,reason:String(e).slice(0,200)});}
 if((i+1)%25===0)console.log('Scanned '+(i+1)+'/'+files.length);
}
matches.sort((a,b)=>b.side_notional_usd-a.side_notional_usd||a.time_utc.localeCompare(b.time_utc));
const cols=['league','ticker','trade_id','time_utc','time_puerto_rico','scheduled_start_utc','timing','taker_outcome_side','taker_book_side','side_price_percent','yes_price_percent','contracts','side_notional_usd','is_block_trade','contract_settlement','conditional_side_outcome','conditional_pnl_if_bought_held_usd'];
await writeFile(join(dest,'all-trades-over-threshold.csv'),csv(matches,cols));
await writeFile(join(dest,'pregame-only-over-threshold.csv'),csv(matches.filter(x=>x.timing==='BEFORE_SCHEDULED_START'),cols));
await writeFile(join(dest,'market-counts.csv'),csv(marketCounts,['ticker','prints','qualifying']));
const summary={threshold_usd:min,markets_scanned:files.length,complete_markets:marketCounts.length,
 qualifying_trades:matches.length,pre_start:matches.filter(x=>x.timing==='BEFORE_SCHEDULED_START').length,
 at_or_after_start:matches.filter(x=>x.timing==='AT_OR_AFTER_SCHEDULED_START').length,
 start_unverified:matches.filter(x=>x.timing==='START_UNVERIFIED').length,
 excluded_markets:errors,
 caveats:['Each print has buyer and seller; taker outcome side is not proof of a purchase or winning individual.',
  'A winning side is a conditional settlement label, not realized trading profit.',
  'Market selection, fees and scheduled-vs-actual start bias remain unresolved.',
  'Multiple prints with same timestamp may be fills of one order; do not treat as independent bettors.']};
await writeFile(join(dest,'large-trades-summary.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify({...summary,excluded_markets:errors.length,caveats:undefined},null,2));
console.log('Output: '+dest);
