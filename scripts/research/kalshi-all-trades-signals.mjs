#!/usr/bin/env node
// Research only. Scan ALL public Kalshi trade prints, without minimum value.
// Temporal cuts prevent leakage; one observation per contract/game per cutoff.
import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
const a=process.argv.slice(2), flag=(k,d)=>a.includes(k)?a[a.indexOf(k)+1]:d;
const root=resolve(flag('--dir','tmp/kalshi-market-intelligence-expanded'));
const out=resolve(flag('--out',join(root,'phase4-all-trades')));
const cutoffMin=Number(flag('--cutoff-minutes','60'));
if(!Number.isInteger(cutoffMin)||cutoffMin<30||cutoffMin>360) throw Error('cutoff-minutes 30..360');
await mkdir(out,{recursive:true});
function parseCSV(s){
 const rows=[],row=[];let v='',quoted=false;let current=row;
 for(let i=0;i<s.length;i++){const c=s[i];
  if(quoted){if(c==='"'&&s[i+1]==='"'){v+='"';i++;}else if(c==='"')quoted=false;else v+=c;}
  else if(c==='"')quoted=true;else if(c===','){current.push(v);v='';}
  else if(c==='\n'){current.push(v.replace(/\r$/,''));v='';if(current.some(Boolean))rows.push(current);current=[];}
  else v+=c;
 }
 if(quoted)throw Error('Malformed CSV quotes');
 if(v||current.length){current.push(v);rows.push(current);}
 const head=rows.shift();if(!head?.includes('ticker'))throw Error('Missing ticker column');
 return rows.map((r,i)=>{if(r.length!==head.length)throw Error('Invalid CSV row '+(i+2));return Object.fromEntries(head.map((h,j)=>[h,r[j]]))});
}
function percentile(vals,p){if(!vals.length)return null;const v=[...vals].sort((x,y)=>x-y);return v[Math.floor((v.length-1)*p)];}
function stdev(vals){if(vals.length<2)return 0;const mean=vals.reduce((a,b)=>a+b,0)/vals.length;return Math.sqrt(vals.reduce((a,v)=>a+(v-mean)**2,0)/vals.length)}
function csv(rows){const cols=Object.keys(rows[0]||{ticker:'',status:''});return [cols.join(','),...rows.map(r=>cols.map(k=>'"'+String(r[k]??'').replaceAll('"','""')+'"').join(','))].join('\n')+'\n';}
const source=parseCSV(await readFile(join(root,'espn-verified-market-summary.csv'),'utf8'));
const eligible=source.filter(r=>r.status==='MATCHED_VERIFIED'&&r.contract_outcome_verified?.toLowerCase()==='true');
const feat=[],issues=[];let inspected=0,eligiblePrints=0;
for(const [index,r] of eligible.entries()){
 try{
  const start=Date.parse(r.game_start_utc),cut=start-cutoffMin*60000;
  if(!Number.isFinite(cut)||!['yes','no'].includes(r.kalshi_result))throw Error('NO_VERIFIED_START_OR_RESULT');
  const m=JSON.parse(await readFile(join(root,r.ticker+'.manifest.json'),'utf8'));
  const trades=JSON.parse(await readFile(join(root,r.ticker+'.trades.json'),'utf8'));
  if(m.truncated||!Array.isArray(trades)||trades.length!==Number(m.trade_count)||trades.length!==Number(r.manifest_count))throw Error('INCOMPLETE_MARKET');
  inspected+=trades.length;
  let pre=[],seen=new Set(),bad=0;
  for(const t of trades){
   const ms=Date.parse(t.time),px=Number(t.yes_price),qty=Number(t.quantity);
   if(!t.trade_id||!Number.isFinite(ms)||!Number.isFinite(px)||px<=0||px>=1||!(qty>0)||seen.has(t.trade_id)){bad++;continue;}
   seen.add(t.trade_id);
   if(ms<cut)pre.push({ms,px,qty,notional:qty*px,side:t.taker_outcome_side});
  }
  if(bad)throw Error('INVALID_OR_DUPLICATE_PRINTS_'+bad);
  pre.sort((x,y)=>x.ms-y.ms);eligiblePrints+=pre.length;
  const at=mins=>pre.filter(t=>t.ms>=cut-mins*60000);
  const last=at(60),two=at(120),prior=two.filter(t=>t.ms<cut-3600000),wide=at(360);
  if(!pre.length||last.length<2)throw Error('TOO_FEW_PRINTS_AT_CUTOFF');
  const sum=(xs,k)=>xs.reduce((s,x)=>s+x[k],0);
  const amounts=last.map(t=>t.notional),q=last.map(t=>t.qty);
  const windows=[15,30,60].map(mins=>at(mins).length);
  const price=pre.at(-1).px;
  const positive=last.filter(t=>t.side==='yes').length,negative=last.filter(t=>t.side==='no').length;
  feat.push({ticker:r.ticker,event_id:r.espn_event_id,league:r.league,season_type:Number(r.season_type),
   start_utc:r.game_start_utc,cutoff_utc:new Date(cut).toISOString(),yes_won:r.kalshi_result==='yes'?1:0,price_yes:price,
   prints_before_cutoff:pre.length,recent_60m_prints:last.length,prior_60m_prints:prior.length,
   recent_60m_contracts:sum(last,'qty'),prior_60m_contracts:sum(prior,'qty'),
   trade_count_ratio:prior.length?last.length/prior.length:null,
   contract_volume_ratio:sum(prior,'qty')?sum(last,'qty')/sum(prior,'qty'):null,
   prints_15m:windows[0],prints_30m:windows[1],prints_60m:windows[2],
   acceleration_15m:windows[1]>windows[0]?(windows[0]/(windows[1]-windows[0])):null,
   median_notional_usd:percentile(amounts,.5),p90_notional_usd:percentile(amounts,.9),
   max_notional_usd:Math.max(...amounts),median_contracts:percentile(q,.5),
   top_10pct_volume_share:sum(last.filter(t=>t.qty>=percentile(q,.9)),'qty')/sum(last,'qty'),
   price_momentum_60m:last.at(-1).px-last[0].px,
   price_volatility_60m:stdev(last.slice(1).map((t,i)=>t.px-last[i].px)),
   last_price_age_minutes:(cut-pre.at(-1).ms)/60000,
   taker_yes_prints:positive,taker_no_prints:negative,
   taker_outcome_unknown:last.length-positive-negative,
   take_side_imbalance:(positive+negative)?(positive-negative)/(positive+negative):null});
 }catch(e){issues.push({ticker:r.ticker,reason:String(e.message)})}
 if((index+1)%25===0)console.log('Processed '+(index+1)+'/'+eligible.length);
}
feat.sort((x,y)=>x.start_utc.localeCompare(y.start_utc)||x.ticker.localeCompare(y.ticker));
const groups=new Map();
for(const r of feat){const key=r.league+'|'+r.season_type;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r)}
for(const group of groups.values()){const n=group.length;group.forEach((r,i)=>r.split=i<Math.floor(n*.6)?'TRAIN':i<Math.floor(n*.8)?'VALIDATION':'HOLDOUT');}
const rules=[
 ['activity_acceleration',r=>r.acceleration_15m!==null&&r.acceleration_15m>=2],
 ['trade_count_spike_2x',r=>r.trade_count_ratio!==null&&r.trade_count_ratio>=2],
 ['contracts_spike_2x',r=>r.contract_volume_ratio!==null&&r.contract_volume_ratio>=2],
 ['broad_participation',r=>r.recent_60m_prints>=100],
 ['small_prints_momentum_up',r=>r.price_momentum_60m>=.02&&r.median_notional_usd<=100],
 ['large_relative_prints_momentum_up',r=>r.price_momentum_60m>=.02&&r.top_10pct_volume_share>=.7],
 ['momentum_up_2pp',r=>r.price_momentum_60m>=.02],
 ['momentum_down_2pp',r=>r.price_momentum_60m<=-.02],
 ['favourite_yes',r=>r.price_yes>=.6],
 ['underdog_yes',r=>r.price_yes<=.4]
];
const metrics=(rows,group,split,signal)=>{
 const n=rows.length,actual=rows.reduce((a,r)=>a+r.yes_won,0),expected=rows.reduce((a,r)=>a+r.price_yes,0);
 return {group,split,signal,n,yes_wins:actual,expected_yes_wins:Number(expected.toFixed(3)),
   mean_actual_minus_expected:n?(actual-expected)/n:null,
   brier:n?rows.reduce((a,r)=>a+(r.yes_won-r.price_yes)**2,0)/n:null,
   illustrative_yes_return_no_fees:n?rows.reduce((a,r)=>a+(r.yes_won?1/r.price_yes-1:-1),0)/n:null};
};
const results=[];
for(const [group,rows] of groups)for(const split of ['TRAIN','VALIDATION','HOLDOUT']){
 const sub=rows.filter(r=>r.split===split);
 results.push(metrics(sub,group,split,'ALL'));for(const [key,fn] of rules)results.push(metrics(sub.filter(fn),group,split,key));
}
await writeFile(join(out,'all-trade-features.csv'),csv(feat));
await writeFile(join(out,'all-trade-signals.csv'),csv(results));
await writeFile(join(out,'all-trade-exclusions.csv'),csv(issues));
const report={generated_at:new Date().toISOString(),status:'EXPLORATORY_NOT_VALIDATED',
 markets_with_verified_start:eligible.length,markets_analyzed:feat.length,excluded:issues.length,
 input_trade_prints_scanned:inspected,pre_cutoff_trade_prints:eligiblePrints,cutoff_minutes:cutoffMin,
 split_counts:Object.fromEntries(['TRAIN','VALIDATION','HOLDOUT'].map(x=>[x,feat.filter(f=>f.split===x).length])),
 notes:['No dollar threshold: every valid trade print before cutoff contributes to market features.',
  'One market observation per cutoff; same-game prints are NOT independent predictions.',
  'Analyzes selected YES contracts, not all possible sports sides; selection bias remains.',
  'Last transacted price is not an executable market order or a no-vig consensus.',
  'Time is scheduled tipoff/puck drop and must be verified for near-start backtests.',
  'NO validated insider information or trading edge; never use same holdout to choose rules repeatedly.',
  'Taker outcome flags are not sufficient evidence of directional purchases by identifiable bettors.',
  'Fixed heuristics can be reviewed on train/validation but require independent future holdout.']};
await writeFile(join(out,'all-trade-report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
