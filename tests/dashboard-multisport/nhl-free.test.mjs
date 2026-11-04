import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeNhlScore,matchFreeNhl,freezeNhlForecast,finalNhl,reconcileFreeNhl,freeNhlMetrics} from '../../src/lib/nhl-free.ts';
import {parseDratingsUpcoming,parseDratingsCirca} from '../../src/lib/nhl-free-source.ts';
import {nhlOpportunities} from '../../src/lib/nhl-view.ts';
const at='2026-11-04T15:00:00Z';
const raw={games:[{id:2026020190,startTimeUTC:'2026-11-05T00:30:00Z',gameState:'FUT',awayTeam:{id:9,placeName:{default:'Ottawa'},commonName:{default:'Senators'}},homeTeam:{id:7,placeName:{default:'Buffalo'},commonName:{default:'Sabres'}}}]};
const game=normalizeNhlScore(raw)[0];
const f={awayName:'Ottawa Senators',homeName:'Buffalo Sabres',scheduledAt:'2026-11-05T00:37:00Z',awayProbability:0.429,homeProbability:0.571,detailUrl:'https://www.dratings.com/predictor/nhl-hockey-predictions/1234-abcd',rawRow:'test fixture'};
const forecast=(prices=null)=>freezeNhlForecast(game,f,at,prices);
const final=(away=1,home=3)=>finalNhl({...game,status:'FINAL',awayScore:away,homeScore:home},'2026-11-05T04:00:00Z');
test('official identities, status and unique pregame time are required; no score default',()=>{
 assert.equal(game.away,'Ottawa Senators');assert.equal(game.awayScore,null);assert.equal(matchFreeNhl(f,[game],at),game);
 for(const gs of [[{...game,status:'LIVE'}],[{...game,status:'UNKNOWN'}],[{...game,home:'Seattle Kraken'}],[game,game],[{...game,scheduledAt:'2026-11-04T14:00:00Z'}]])assert.equal(matchFreeNhl(f,gs,at),null);
 assert.throws(()=>normalizeNhlScore({games:[raw.games[0],raw.games[0]]}));
 assert.equal(normalizeNhlScore({games:[{...raw.games[0],gameState:'NEW_UNKNOWN'}]})[0].status,'UNKNOWN');
 assert.equal(forecast().capturedAt,at);assert.equal(freezeNhlForecast(game,{...f,homeProbability:0.5,awayProbability:0.5},at,null),null);
});
test('only exact paired Circa prices are parsed, never Best Line or another book',()=>{
 const table=(book='Circa',home='Buffalo')=>`id="scroll-money"><table><tr><th>Team</th><th>${book}</th></tr><tr><td>Ottawa</td><td>+120</td></tr><tr><td>${home}</td><td>-135</td></tr></table><div id="scroll-spread">`;
 assert.deepEqual(parseDratingsCirca(table(),f),{awayOdds:120,homeOdds:-135,book:'CIRCA',rawTable:table().match(/<table.*<\/table>/)[0]});
 assert.equal(parseDratingsCirca(table('Best Line'),f),null);assert.equal(parseDratingsCirca(table('Circa','Seattle'),f),null);
 const html=`id="scroll-upcoming"><table><tr><th>Time</th><th>Teams</th><th>Goalies</th><th>Win</th></tr><tr><td><time datetime="${f.scheduledAt}"></time><a href="/predictor/nhl-hockey-predictions/1234-abcd">Details</a></td><td><a href="/teams/nhl-hockey-ratings/ottawa">Ottawa Senators</a><a href="/teams/nhl-hockey-ratings/buffalo">Buffalo Sabres</a></td><td></td><td><span>42.9%</span><span>57.1%</span></td></tr></table>`;
 assert.ok(Math.abs(parseDratingsUpcoming(html)[0].homeProbability-0.571)<1e-12);assert.throws(()=>parseDratingsUpcoming(html.replace('<th>Win</th>','<th>Odds</th>')));
});
test('missing original price permits W/L accuracy but never profit, ROI or edge',()=>{
 const p=reconcileFreeNhl(forecast(),[final()]);assert.equal(p.direction,'Buffalo Sabres ML');assert.equal(p.settlement.outcome,'WIN');assert.equal(p.settlement.profitUnits,null);
 assert.deepEqual(freeNhlMetrics([p]),{settled:1,wins:1,losses:0,pushes:0,voids:0,pending:0,accuracyPct:100,profitUnits:null,roiPct:null,staked:0});
 assert.deepEqual(nhlOpportunities({readAt:at,health:{status:'PASS',latestRunAt:at},forecasts:[forecast()]}),[]);
});
test('OT/SO final settles with immutable entry price; wrong identity and conflicting corrections never auto settle',()=>{
 const f=forecast({awayOdds:120,homeOdds:-135}),p=reconcileFreeNhl(f,[final()]);assert.equal(p.settlement.profitUnits,100/135);
 assert.equal(reconcileFreeNhl(f,[final(3,1)]).settlement.profitUnits,-1);
 assert.equal(reconcileFreeNhl(f,[final(),final(3,1)]).quality,'REVIEW_CONFLICTING_FINALS');assert.equal(reconcileFreeNhl(f,[final(),final(3,1)]).settlement,null);
 for(const x of [{...final(),homeId:99},{...final(),scheduledAt:'2026-11-05T00:31:00Z'},{...final(),capturedAt:at}])assert.equal(reconcileFreeNhl(f,[x]).settlement,null);
 assert.equal(finalNhl({...game,status:'LIVE',awayScore:1,homeScore:3},at),null);assert.equal(finalNhl({...game,status:'FINAL',awayScore:1,homeScore:null},at),null);
});
test('persisted probabilities, entry-price pairs, edges and cutoff cannot be silently repaired',async()=>{
 const {verifyFreeNhlForecast}=await import('../../src/lib/nhl-free.ts');const f=forecast({awayOdds:120,homeOdds:-135});assert.equal(verifyFreeNhlForecast(f),f);
 for(const bad of [{...f,capturedAt:f.scheduledAt},{...f,homeProbability:0.9},{...f,awayOdds:null},{...f,awayEdgePp:20},{...f,id:'old-hub-id'}])assert.throws(()=>verifyFreeNhlForecast(bad));
});
test('real score API nickname-only shape joins full names by official numeric ID and abbreviation',async()=>{
 const {normalizeNhlDirectory}=await import('../../src/lib/nhl-free.ts');
 const directory=normalizeNhlDirectory({data:[{id:9,triCode:'OTT',fullName:'Ottawa Senators'},{id:7,triCode:'BUF',fullName:'Buffalo Sabres'}]});
 const source={games:[{...raw.games[0],awayTeam:{id:9,abbrev:'OTT',name:{default:'Senators'}},homeTeam:{id:7,abbrev:'BUF',name:{default:'Sabres'}}}]};
 assert.equal(matchFreeNhl(f,normalizeNhlScore(source),at),null);
 assert.equal(matchFreeNhl(f,normalizeNhlScore(source,directory),at)?.home,'Buffalo Sabres');
 assert.throws(()=>normalizeNhlScore({games:[{...source.games[0],awayTeam:{...source.games[0].awayTeam,abbrev:'SEA'}}]},directory));
 assert.throws(()=>normalizeNhlDirectory({data:[{id:9,triCode:'OTT',fullName:'Ottawa Senators'},{id:9,triCode:'OTT',fullName:'Ottawa Senators'}]}));
});
