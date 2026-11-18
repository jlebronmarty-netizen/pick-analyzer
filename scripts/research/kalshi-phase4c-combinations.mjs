#!/usr/bin/env node
// Phase 4C: exploratory rule search on historical TRAIN/VALIDATION only.
// Existing HOLDOUT is already inspected and must never be reused as a clean test.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const argv=process.argv.slice(2);
const arg=(x,d)=>argv.includes(x)?argv[argv.indexOf(x)+1]:d;
const input=resolve(arg('--input','tmp/kalshi-market-intelligence-expanded/phase4-all-trades/all-trade-features.csv'));
const out=resolve(arg('--out','tmp/kalshi-market-intelligence-expanded/phase4c-exploration'));
await mkdir(out,{recursive:true});
function csvParse(text){
 const records=[];let row=[],cur='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];
  if(quoted){if(c==='"'&&text[i+1]==='"'){cur+='"';i++}else if(c==='"')quoted=false;else cur+=c;}
  else if(c==='"')quoted=true;else if(c===','){row.push(cur);cur='';}
  else if(c==='\n'){row.push(cur.replace(/\r$/,''));cur='';if(row.some(x=>x!==''))records.push(row);row=[];}
  else cur+=c;
 }
 if(cur!==''||row.length){row.push(cur);records.push(row)}
 const header=records.shift();if(!header?.includes('ticker'))throw Error('Missing ticker');
 return records.map((r,i)=>{if(r.length!==header.length)throw Error('Invalid CSV row '+i);return Object.fromEntries(header.map((k,j)=>[k,r[j]]))});
}
function csvWrite(rows,cols){return [cols.join(','),...rows.map(r=>cols.map(c=>'"'+String(r[c]??'').replaceAll('"','""')+'"').join(','))].join('\n')+'\n'}
const raw=csvParse(await readFile(input,'utf8'));
const filtered=raw.filter(r=>r.season_type==='2'&&['NBA','NHL'].includes(r.league)&&['TRAIN','VALIDATION'].includes(r.split)&&r.price_yes!==''&&r.yes_won!=='');
const excludedHoldout=raw.filter(r=>r.split==='HOLDOUT').length;
const numberFields=['price_yes','yes_won','recent_60m_prints','trade_count_ratio','contract_volume_ratio','acceleration_15m','median_notional_usd','top_10pct_volume_share','price_momentum_60m','price_volatility_60m','last_price_age_minutes'];
const records=filtered.map(r=>{const x={...r};for(const f of numberFields)x[f]=r[f]===''?NaN:Number(r[f]);return x});
const conditions=[
 ['price_20_40',r=>r.price_yes>=.2&&r.price_yes<.4],
 ['price_40_60',r=>r.price_yes>=.4&&r.price_yes<.6],
 ['price_60_80',r=>r.price_yes>=.6&&r.price_yes<.8],
 ['price_80_plus',r=>r.price_yes>=.8],
 ['momentum_up_1pp',r=>r.price_momentum_60m>=.01],
 ['momentum_down_1pp',r=>r.price_momentum_60m<=-.01],
 ['momentum_up_3pp',r=>r.price_momentum_60m>=.03],
 ['momentum_down_3pp',r=>r.price_momentum_60m<=-.03],
 ['volume_spike_1p5',r=>r.contract_volume_ratio>=1.5],
 ['volume_spike_3',r=>r.contract_volume_ratio>=3],
 ['print_spike_2',r=>r.trade_count_ratio>=2],
 ['activity_accel_2',r=>r.acceleration_15m>=2],
 ['prints_60m_over_50',r=>r.recent_60m_prints>=50],
 ['small_median_under_100',r=>r.median_notional_usd<100],
 ['large_median_over_500',r=>r.median_notional_usd>=500],
 ['top10_share_over_60pct',r=>r.top_10pct_volume_share>=.6],
 ['low_volatility',r=>r.price_volatility_60m<=.01],
 ['high_volatility',r=>r.price_volatility_60m>=.03],
 ['fresh_price_5min',r=>r.last_price_age_minutes<=5]
];
const rules=[['ALL',()=>true]];
for(const [name,test] of conditions)rules.push([name,test]);
for(let i=0;i<conditions.length;i++)for(let j=i+1;j<conditions.length;j++){
 // Keep contradictory price and directional momentum conditions out.
 const [a,b]=[conditions[i][0],conditions[j][0]];
 if(a.startsWith('price_')&&b.startsWith('price_'))continue;
 if(a.startsWith('momentum_up')&&b.startsWith('momentum_down')||a.startsWith('momentum_down')&&b.startsWith('momentum_up'))continue;
 rules.push([a+'__'+b,r=>conditions[i][1](r)&&conditions[j][1](r)]);
}
function score(rows,side){
 const n=rows.length;if(!n)return {n:0,wins:0,expected:0,edge:null,roi:null,brier:null};
 const p=rows.map(r=>side==='YES'?r.price_yes:1-r.price_yes);
 const y=rows.map(r=>side==='YES'?r.yes_won:1-r.yes_won);
 const expected=p.reduce((a,b)=>a+b,0),wins=y.reduce((a,b)=>a+b,0);
 return {n,wins,expected:Number(expected.toFixed(3)),edge:Number(((wins-expected)/n).toFixed(4)),
  roi:Number((rows.reduce((a,r,i)=>a+(y[i]===1?1/p[i]-1:-1),0)/n).toFixed(4)),
  brier:Number((rows.reduce((a,r,i)=>a+(y[i]-p[i])**2,0)/n).toFixed(4))};
}
const result=[];
for(const league of ['NBA','NHL'])for(const side of ['YES','NO'])for(const [name,test] of rules){
 const train=records.filter(r=>r.league===league&&r.split==='TRAIN'&&test(r));
 const val=records.filter(r=>r.league===league&&r.split==='VALIDATION'&&test(r));
 const tr=score(train,side),va=score(val,side);
 // Both splits require material support; no positive claim at small N.
 const eligible=tr.n>=15&&va.n>=8;
 const stable=eligible&&tr.edge>0&&va.edge>0&&tr.roi>0&&va.roi>0;
 result.push({league,side,rule:name,train_n:tr.n,train_wins:tr.wins,train_expected:tr.expected,train_edge:tr.edge,train_roi_no_fees:tr.roi,
  validation_n:va.n,validation_wins:va.wins,validation_expected:va.expected,validation_edge:va.edge,validation_roi_no_fees:va.roi,
  passes_min_samples:eligible,stable_preliminary:stable,interpretation:stable?'EXPLORATORY_REPEAT_NOT_VALIDATED':'INSUFFICIENT_OR_INCONSISTENT'});
}
const cols=Object.keys(result[0]);
result.sort((a,b)=>Number(b.stable_preliminary)-Number(a.stable_preliminary)||Number(b.passes_min_samples)-Number(a.passes_min_samples)||(b.validation_edge??-999)-(a.validation_edge??-999));
await writeFile(join(out,'all-rule-combinations.csv'),csvWrite(result,cols));
await writeFile(join(out,'potential-candidates.csv'),csvWrite(result.filter(r=>r.stable_preliminary),cols));
const summary={status:'HYPOTHESIS_GENERATION_ONLY',markets_available:raw.length,season_regular_train_validation_markets:records.length,
 old_holdout_markets_excluded:excludedHoldout,conditions:conditions.length,rule_patterns:rules.length,
 candidate_tests:result.length,passes_sample_floor:result.filter(r=>r.passes_min_samples).length,
 preliminary_repeated_candidates:result.filter(r=>r.stable_preliminary).length,
 warnings:['All rules searched on already-observed markets. No result constitutes a validated edge.',
 'Historical holdout was inspected in earlier phases and is NOT treated as an untouched test.',
 'Prices are transaction prices, not executable quotes; ROI excludes fees and slippage.',
 'Fixed thresholds were not calibrated to the sport; multiple comparisons can yield false discoveries.',
 'One chosen YES contract per event; discovery not representative of both sides without improved cohort sampling.',
 'New data beyond the previously inspected date window is needed for a true prospective holdout.',
 'Do not promote a pattern to a production model or place bets using exploratory results.']};
await writeFile(join(out,'exploration-summary.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
