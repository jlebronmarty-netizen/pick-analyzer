import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {classifyNhlBookQuote,evaluateNhlOddsSnapshotCoverage} from '../src/lib/nhl-market-quote-contract-v4.mjs';
import {classifyNhlPregameGoalie,assessNhlGoaltenderCoverage} from '../src/lib/nhl-pregame-goalie-contract-v4.mjs';
const decision='2026-11-15T18:00:00Z';
const event={eventId:'nhl:2026020400',scheduledAt:'2026-11-16T01:00:00Z',providerCommenceTime:'2026-11-16T01:00:00Z',
 status:'SCHEDULED',home:'Boston Bruins',away:'New York Rangers',providerHome:'Boston Bruins',providerAway:'New York Rangers',
 homeId:6,awayId:3};
const book={key:'fanduel',last_update:'2026-11-15T17:56:00Z'};
const market=(key,outcomes)=>({key,last_update:'2026-11-15T17:56:00Z',outcomes});
const quote=(m,g=event)=>classifyNhlBookQuote({game:g,bookmaker:book,market:m,
 receivedAt:'2026-11-15T17:58:00Z',decisionAt:decision});
test('Complete timestamped two-sided NHL moneyline contract is research only',()=>{
 const p=quote(market('h2h',[{name:event.home,price:-135},{name:event.away,price:+120}]));
 assert.equal(p.status,'EXACT_PRICE_PAIR_RESEARCH');assert.equal(p.market,'h2h');
 assert.equal(p.bookmakerKey,'fanduel');assert.equal(p.eligibleForRecommendation,false);
 assert.equal(p.fullGameOTSOContractCertified,false);assert.equal(p.estimatedEdge,null);
 assert.ok(Math.abs(p.first.probNoVig+p.second.probNoVig-1)<1e-9);
});
test('Puck line must have exact paired opposite handicaps and two valid prices',()=>{
 const ok=quote(market('spreads',[{name:event.home,price:+150,point:-1.5},{name:event.away,price:-170,point:1.5}]));
 assert.equal(ok.status,'EXACT_PRICE_PAIR_RESEARCH');assert.equal(ok.line,-1.5);
 const bad=quote(market('spreads',[{name:event.home,price:+150,point:-1.5},{name:event.away,price:-170,point:2.5}]));
 assert.equal(bad.status,'NOT_CERTIFIED');
});
test('Totals Over and Under need identical line, not generic 5.5 implied',()=>{
 const ok=quote(market('totals',[{name:'Over',price:-115,point:6},{name:'Under',price:-105,point:6}]));
 assert.equal(ok.status,'EXACT_PRICE_PAIR_RESEARCH');assert.equal(ok.line,6);
 assert.equal(quote(market('totals',[{name:'Over',price:-115,point:6},{name:'Under',price:-105,point:6.5}])).status,'NOT_CERTIFIED');
});
test('Stale prices, source after decision, wrong team or late pregame are never accepted',()=>{
 const m=market('h2h',[{name:event.home,price:-135},{name:event.away,price:+120}]);
 assert.equal(quote({...m,last_update:'2026-11-15T17:20:00Z'}).status,'NOT_CERTIFIED');
 assert.equal(quote({...m,last_update:'2026-11-15T18:01:00Z'}).status,'NOT_CERTIFIED');
 assert.equal(quote(m,{...event,providerHome:'Different Team'}).status,'NOT_CERTIFIED');
 assert.equal(quote(m,{...event,scheduledAt:'2026-11-15T18:20:00Z',providerCommenceTime:'2026-11-15T18:20:00Z'}).status,'NOT_CERTIFIED');
});
test('Legacy NHL market archive is stale, not evidence of current FanDuel availability',()=>{
 const r=evaluateNhlOddsSnapshotCoverage({rows:[{market:'moneyline',snapshot_time:'2026-07-28T01:00:00Z'}],now:decision});
 assert.equal(r.checks[0].fresh20MinuteRows,0);assert.equal(r.checks[0].verifiedFanDuelPairs,0);
 assert.equal(r.providerCalls,0);
});
const goalie={eventId:event.eventId,teamId:6,goalieId:123456,
 publishedAt:'2026-11-15T16:10:00Z',capturedAt:'2026-11-15T16:12:00Z',
 sourceName:'Named club statement',sourceArticleUrl:'https://example.org/official-confirmation',
 status:'confirmed',sourceSaysStart:true,identityCrosswalkVerified:true};
test('Confirmed goalie requires direct sourced statement and stable identity',()=>{
 const r=classifyNhlPregameGoalie({event,observation:goalie,asOf:decision});
 assert.equal(r.status,'SOURCE_CONFIRMED_STARTER');assert.equal(r.confirmedPregameStarter,true);
 for(const variant of [{...goalie,status:'probable'}, {...goalie,sourceSaysStart:false},
  {...goalie,identityCrosswalkVerified:false}]){
  const x=classifyNhlPregameGoalie({event,observation:variant,asOf:decision});
  assert.equal(x.confirmedPregameStarter,false);
 }
});
test('After-decision goalie announcements, unknown ID, or missing article fail closed',()=>{
 for(const g of [{...goalie,capturedAt:'2026-11-15T19:00:00Z'},
  {...goalie,goalieId:null},{...goalie,sourceArticleUrl:''}]){
  assert.equal(classifyNhlPregameGoalie({event,observation:g,asOf:decision}).status,'UNVERIFIED');
 }
 const empty=assessNhlGoaltenderCoverage({observations:[],events:[event],asOf:decision});
 assert.equal(empty.confirmedBoth,0);assert.equal(empty.modelAdjusted,false);
});
test('New API reads stored data only, no provider credits, picks or model weight writes',()=>{
 const svc=fs.readFileSync('src/services/nhl-market-goalie-v4-readiness.service.ts','utf8');
 const route=fs.readFileSync('src/app/api/nhl/market-goalie-readiness/route.ts','utf8');
 assert.ok(!/\.insert\(|\.upsert\(|\.update\(|\.delete\(|fetch\(/.test(svc+route));
 assert.match(route,/getNhlMarketGoalieV4Readiness/);
 assert.match(svc,/additionalCreditsConsumed:0/);
});
