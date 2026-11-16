import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseNhlCircaFreeMainMarkets} from '../src/lib/nhl-free-circa-main-markets.mjs';
const forecast={awayName:'Edmonton Oilers',homeName:'Philadelphia Flyers'};
const table=(headers,a,b)=>'<table><tr>'+headers.map(x=>'<th>'+x+'</th>').join('')+'</tr>'+
 '<tr>'+a.map(x=>'<td>'+x+'</td>').join('')+'</tr><tr>'+b.map(x=>'<td>'+x+'</td>').join('')+'</tr></table>';
const other=table(['','Open Line','BetOnline'],['Edmonton','-1½+171','-1½+180'],['Philadelphia','+1½-190','+1½-210']);
const spread=table(['','Open Line','South Point','Circa','Wynn','Best Line'],
 ['Edmonton','-1½+165','-1½+175','-1½+175','-1½+165','-1½+175'],
 ['Philadelphia','+1½-185','+1½-200','+1½-200','+1½-185','+1½-185']);
const ou=table(['','Open Line','South Point','Circa','Wynn'],
 ['Over','o6+100','o6-105','o6-105','o6-110'],
 ['Under','u6-120','u6-115','u6-115','u6-110']);
const html='<div id="scroll-money"></div><div id="scroll-spread">'+other+spread+
 '</div><div id="scroll-ou">'+other+ou+'</div>';
test('Extract real Circa puck line and total from two exact sides using already available HTML',()=>{
 const p=parseNhlCircaFreeMainMarkets(html,forecast);
 assert.equal(p.observations.length,2);
 assert.equal(p.observations[0].market,'spread');
 assert.deepEqual(p.observations[0].away,{name:forecast.awayName,line:-1.5,price:175});
 assert.deepEqual(p.observations[0].home,{name:forecast.homeName,line:1.5,price:-200});
 assert.equal(p.observations[1].over.line,6);
 assert.equal(p.observations[1].under.line,6);
 assert.equal(p.observations[1].over.price,-105);
 assert.equal(p.observations[1].under.price,-115);
 assert.equal(p.providerCalls,0);assert.equal(p.subscriptionCost,0);
});
test('Frac unicode and HTML entity on totals are normalized to exact 6.5',()=>{
 const raw=html.replace(/o6-105/g,'o6½-105').replace(/u6-115/g,'u6&frac12;-115');
 const p=parseNhlCircaFreeMainMarkets(raw,forecast);
 assert.equal(p.observations.find(o=>o.market==='total').over.line,6.5);
 assert.equal(p.observations.find(o=>o.market==='total').under.line,6.5);
});
test('Do not compare unmatched total 6 versus 6.5 and do not manufacture a total quote',()=>{
 const p=parseNhlCircaFreeMainMarkets(html.replace('<td>u6-115</td><td>u6-115</td>','<td>u6-115</td><td>u6½-115</td>'),forecast);
 assert.equal(p.observations.length,1);
 assert.ok(p.rejected.includes('UNPAIRED_CIRCA_TOTAL_LINE'));
});
test('Reject mismatched teams, handicaps, incomplete odds, or imaginary Circa column',()=>{
 const wrongTeam=html.replaceAll('<td>Philadelphia</td>','<td>Dallas</td>');
 const p=parseNhlCircaFreeMainMarkets(wrongTeam,forecast);
 assert.ok(!p.observations.some(o=>o.market==='spread'));
 const wrongHandicap=html.replaceAll('+1½-200','+2½-200');
 const h=parseNhlCircaFreeMainMarkets(wrongHandicap,forecast);
 assert.ok(h.rejected.includes('UNPAIRED_CIRCA_PUCK_LINE'));
 const wrongPrice=html.replace('<td>-1½+175</td><td>-1½+175</td>','<td>-1½+175</td><td>-1½+99</td>');
 const x=parseNhlCircaFreeMainMarkets(wrongPrice,forecast);
 assert.ok(x.rejected.includes('UNPAIRED_CIRCA_PUCK_LINE'));
 const missing=html.replaceAll('<th>Circa</th>','<th>Unknown Book</th>');
 assert.equal(parseNhlCircaFreeMainMarkets(missing,forecast).observations.length,0);
});
test('Do not mix odds from distinct books, use opening price instead, or certify FanDuel or game rules',()=>{
 const p=parseNhlCircaFreeMainMarkets(html,forecast);
 for(const row of p.observations){
  assert.equal(row.book,'CIRCA');
  assert.equal(row.sourceUpdatedAt,null);
  assert.equal(row.fullGameContractCertified,false);
  assert.equal(row.readyForOfficialPicks,false);
 }
});
test('NHL free cron must reuse already fetched detail page with no new external calls',()=>{
 const cron=fs.readFileSync('src/services/nhl-free.service.ts','utf8');
 assert.match(cron,/parseNhlCircaFreeMainMarkets/);
 assert.match(cron,/marketQuoteObservations/);
 assert.match(cron,/q\.raw/);
 assert.equal((fs.readFileSync('vercel.json','utf8').match(/\/api\/cron\/nhl-free/g)||[]).length,1);
});
