import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildPropPanelRows,buildDirectionalResearchRows,PANEL_MARKETS} from '../src/lib/nba/nba-props-panel-core.mjs';
const at='2026-11-17T23:00:00Z';
const game={id:300000,datetime:'2026-11-18T01:00:00Z',status_state:'scheduled'};
const quote=(more={})=>({quote_id:'sample',provider_game_id:300000,player_id:42,market:'props',
 statistic:'rebounds',side:'over',line:7.5,american_odds:-110,phase:'PREGAME',
 contract:'STRICT_GREATER_THAN',period:'FULL_GAME_LABEL_OT_UNVERIFIED',source_received_at:at,...more});
const f=(i,more={})=>({player_id:42,provider_game_id:i,pts:18,reb:7,ast:4,fg3m:2,
 game_datetime:'2026-11-'+String(i).padStart(2,'0')+'T01:00:00Z',
 source_captured_at:'2026-11-16T04:00:00Z',projection_eligible:true,...more});
test('panel supports four props markets without certifying picks or EV',()=>{
 assert.deepEqual(PANEL_MARKETS,['points','rebounds','assists','threes','points_rebounds_assists','points_rebounds','points_assists','rebounds_assists']);
 const x=buildPropPanelRows({game,quotes:[quote()],facts:Array.from({length:10},(_,i)=>f(i+1)),asOf:at});
 assert.equal(x.status,'READ_ONLY_DESCRIPTIVE_SHADOW');
 assert.equal(x.rows.length,1);
 const row=x.rows[0];assert.equal(row.projection,7);assert.equal(row.l5,7);assert.equal(row.l10,7);
 assert.equal(row.delta,-.5);assert.equal(row.availablePriorGames,10);
 assert.equal(row.formula,'L10');assert.equal(row.modelProbability,null);
 assert.equal(row.expectedValue,null);assert.equal(row.recommendedPick,false);assert.equal(row.productionEligible,false);
});
test('5 to 9 captured prior games are explicitly L5 descriptive only',()=>{
 const x=buildPropPanelRows({game,quotes:[quote()],facts:Array.from({length:7},(_,i)=>f(i+1)),asOf:at});
 assert.equal(x.rows[0].l10,null);
 assert.equal(x.rows[0].formula,'L5_DESCRIPTIVE');
 assert.equal(x.rows[0].availablePriorGames,7);
});
test('four captured prior games do not invent a projection',()=>{
 const x=buildPropPanelRows({game,quotes:[quote()],facts:Array.from({length:4},(_,i)=>f(i+1)),asOf:at});
 assert.equal(x.rows[0].projection,null);
 assert.equal(x.rows[0].status,'INSUFFICIENT_CAPTURED_PRIOR_GAMES');
});
test('last-game facts first ingested after quote are excluded, even if played before',()=>{
 const facts=Array.from({length:10},(_,i)=>f(i+1));
 facts[9].source_captured_at='2026-11-17T23:05:00Z';
 const x=buildPropPanelRows({game,quotes:[quote()],facts,asOf:at});
 assert.equal(x.rows[0].availablePriorGames,9);
 assert.equal(x.rows[0].l10,null);
});
test('future and same-game truth do not enter prior features',()=>{
 const facts=Array.from({length:10},(_,i)=>f(i+1));
 facts.push(f(11,{provider_game_id:300000,game_datetime:game.datetime,reb:100}));
 const x=buildPropPanelRows({game,quotes:[quote()],facts,asOf:at});
 assert.equal(x.rows[0].projection,7);
});
test('never invent data when game already started or quote stale',()=>{
 const facts=Array.from({length:10},(_,i)=>f(i+1));
 assert.equal(buildPropPanelRows({game,quotes:[quote()],facts,asOf:'2026-11-18T00:55:00Z'}).rows.length,0);
 assert.equal(buildPropPanelRows({game,quotes:[quote({source_received_at:'2026-11-17T21:00:00Z'})],facts,asOf:at}).rows.length,0);
});
test('rejects in-play, unverified period, and mismatched contract',()=>{
 const facts=Array.from({length:10},(_,i)=>f(i+1));
 for(const item of [quote({phase:'IN_PLAY'}),quote({period:'UNKNOWN'}),quote({contract:'OTHER'})])
  assert.equal(buildPropPanelRows({game,quotes:[item],facts,asOf:at}).rows.length,0);
});
test('deduplicates observations without miscounting props',()=>{
 const facts=Array.from({length:10},(_,i)=>f(i+1));
 const x=buildPropPanelRows({game,quotes:[quote(),quote({quote_id:'different'})],facts,asOf:at});
 assert.equal(x.rows.length,1);
});
test('NBA panel UI and private API remain strictly research-only',()=>{
 const ui=readFileSync('src/app/nba-market-data/props-shadow-panel.jsx','utf8');
 const board=readFileSync('src/app/nba-market-data/board.jsx','utf8');
 const route=readFileSync('src/app/api/market-data/nba/props-shadow/route.ts','utf8');
 assert.match(ui,/SIN PROBABILIDADES/);
 assert.match(ui,/SIN EV/);
 assert.match(board,/PropsShadowPanel/);
 assert.match(route,/privateHost/);
 assert.match(route,/x-vercel-oidc-token/);
 assert.match(route,/GOAT_COMPACT_HISTORY_UNAVAILABLE/);
 assert.doesNotMatch(route,/\.(insert|upsert|update|delete)\(/);
});

test('private preview is restricted to a single review branch and never allows public host',()=>{
 const feed=readFileSync('src/lib/nba-production-feed.mjs','utf8');
 const route=readFileSync('src/app/api/market-data/nba/props-shadow/route.ts','utf8');
 assert.match(feed,/feat\/nba-props-ui-reconciled-20261118/);
 assert.match(feed,/NBA_SHARED_FEED_ENABLED/);
 assert.match(route,/VERCEL_ENV==='preview'/);
 assert.match(route,/VERCEL_GIT_COMMIT_REF==='feat\/nba-props-ui-reconciled-20261118'/);
 assert.match(route,/privateHost\(request,env\)/);
 assert.match(route,/x-vercel-oidc-token/);
});


test('both prices become one directional research line, never a certified pick',()=>{
 const facts=Array.from({length:10},(_,i)=>f(i+1,{reb:10}));
 const quotes=[quote({quote_id:'over-source',american_odds:-115}),quote({quote_id:'under-source',side:'under',contract:'STRICT_LESS_THAN',american_odds:-105})];
 const raw=buildPropPanelRows({game,quotes,facts,asOf:at});
 assert.equal(raw.rows.length,2);
 const result=buildDirectionalResearchRows(raw.rows);
 assert.equal(result.length,1);
 assert.equal(result[0].tendency,'OVER_TENDENCY');
 assert.equal(result[0].selectedSideOdds,-115);
 assert.equal(result[0].projection,10);
 assert.equal(result[0].modelProbability,null);
 assert.equal(result[0].expectedValue,null);
 assert.equal(result[0].recommendedPick,false);
});
test('no reliable counterpart or less than ten prior games yields PASS',()=>{
 const quotes=[quote(),quote({quote_id:'under',side:'under',contract:'STRICT_LESS_THAN',american_odds:105})];
 const seven=buildPropPanelRows({game,quotes,facts:Array.from({length:7},(_,i)=>f(i+1,{reb:10})),asOf:at});
 assert.equal(buildDirectionalResearchRows(seven.rows)[0].tendency,'PASS');
 const onlyOver=buildPropPanelRows({game,quotes:[quote()],facts:Array.from({length:10},(_,i)=>f(i+1,{reb:10})),asOf:at});
 assert.equal(buildDirectionalResearchRows(onlyOver.rows)[0].reason,'MISSING_BOTH_VERIFIED_SIDES');
});
test('negligible margin yields PASS even with both prices and ten games',()=>{
 const quotes=[quote(),quote({quote_id:'under',side:'under',contract:'STRICT_LESS_THAN'})];
 const ten=buildPropPanelRows({game,quotes,facts:Array.from({length:10},(_,i)=>f(i+1,{reb:8})),asOf:at});
 const d=buildDirectionalResearchRows(ten.rows)[0];
 assert.equal(d.tendency,'PASS');
 assert.equal(d.reason,'MARGIN_BELOW_EXPLORATORY_THRESHOLD');
});
test('under tendency selects under price once, but remains unvalidated',()=>{
 const quotes=[quote({american_odds:-106}),quote({quote_id:'under',side:'under',contract:'STRICT_LESS_THAN',american_odds:-114})];
 const ten=buildPropPanelRows({game,quotes,facts:Array.from({length:10},(_,i)=>f(i+1,{reb:5})),asOf:at});
 const d=buildDirectionalResearchRows(ten.rows)[0];
 assert.equal(d.tendency,'UNDER_TENDENCY');
 assert.equal(d.selectedSideOdds,-114);
 assert.equal(d.productionEligible,false);
});
test('panel renders experimental direction table before both-side quote diagnostic',()=>{
 const ui=readFileSync('src/app/nba-market-data/props-shadow-panel.jsx','utf8');
 const board=readFileSync('src/app/nba-market-data/board.jsx','utf8');
 const route=readFileSync('src/app/api/market-data/nba/props-shadow/route.ts','utf8');
 assert.match(ui,/Evaluación única por jugador y línea/);
 assert.match(ui,/PASS/);
 assert.match(ui,/OVER \(sin validar\)/);
 assert.match(ui,/UNDER \(sin validar\)/);
 assert.ok(ui.indexOf('Evaluación única por jugador y línea')<ui.indexOf('Ver ambas cuotas Over'));
 assert.ok(board.indexOf('<PropsShadowPanel')<board.indexOf('result&&<section'));
 assert.match(route,/directionalRows:buildDirectionalResearchRows/);
});

test('newest quote batch excludes repeated historical snapshots before selecting one per line',()=>{
 const route=readFileSync('src/app/api/market-data/nba/props-shadow/route.ts','utf8');
 assert.match(route,/const newest=await db\.from\('nba_market_quotes_v1'\)/);
 assert.match(route,/const latestAt=Date\.parse\(newest\.data\[0\]\.source_received_at\)/);
 assert.match(route,/const batchStart=new Date\(latestAt-90000\)/);
 assert.match(route,/\.gte\('source_received_at',batchStart\)\.lte\('source_received_at',newest\.data\[0\]\.source_received_at\)/);
 assert.match(route,/QUOTE_BATCH_LIMIT_REVIEW_REQUIRED/);
 assert.match(route,/quoteBatchWindowSeconds:90/);
 assert.doesNotMatch(route,/QUOTE_SCAN_LIMIT_REVIEW_REQUIRED/);
});


test('combined PRA L10 is mean of per-game point/rebound/assist sums, not an independent-bet probability',()=>{
 const facts=Array.from({length:10},(_,i)=>f(i+1,{pts:20+i,reb:4,ast:3}));
 const q=quote({statistic:'points_rebounds_assists',line:32.5});
 const result=buildPropPanelRows({game,quotes:[q],facts,asOf:at});
 assert.equal(result.rows.length,1);
 assert.equal(result.rows[0].l10,31.5);
 assert.equal(result.rows[0].delta,-1);
 assert.equal(result.rows[0].modelProbability,null);
});
test('all three two-stat combo markets are valid and independently summed per prior game',()=>{
 const facts=Array.from({length:10},(_,i)=>f(i+1,{pts:20,reb:6,ast:4}));
 for(const [market,expected] of [['points_rebounds',26],['points_assists',24],['rebounds_assists',10]]){
  const row=buildPropPanelRows({game,quotes:[quote({statistic:market,line:20.5})],facts,asOf:at}).rows[0];
  assert.equal(row.l10,expected,market);
 }
});
test('a missing component in a combo game is not silently treated as zero',()=>{
 const facts=Array.from({length:10},(_,i)=>f(i+1,{pts:20,reb:6,ast:4}));
 facts[9].reb=null;
 const row=buildPropPanelRows({game,quotes:[quote({statistic:'points_rebounds_assists',line:30.5})],facts,asOf:at}).rows[0];
 assert.equal(row.availablePriorGames,9);
 assert.equal(row.l10,null);
});
test('selected-market API reads only requested props and retains quote cap',()=>{
 const route=readFileSync('src/app/api/market-data/nba/props-shadow/route.ts','utf8');
 const ui=readFileSync('src/app/nba-market-data/props-shadow-panel.jsx','utf8');
 assert.match(route,/const market=request\.nextUrl\.searchParams\.get\('market'\)/);
 assert.match(route,/PANEL_MARKETS\.includes\(market as string\)/);
 assert.match(route,/\.eq\('statistic',market!\)/);
 assert.match(route,/QUOTE_BATCH_LIMIT_REVIEW_REQUIRED/);
 assert.match(ui,/encodeURIComponent\(market\)/);
 assert.match(ui,/Puntos \+ rebotes \+ asistencias \(PRA\)/);
});
