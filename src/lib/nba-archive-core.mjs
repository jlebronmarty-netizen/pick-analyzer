export const VERSION='NBA_SHARED_ARCHIVE_V1';
export function localDay(now=new Date()) {const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Puerto_Rico',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);return ['year','month','day'].map(k=>p.find(x=>x.type===k).value).join('-');}
const stamp=x=>typeof x==='string'&&/(?:Z|[+-]\d\d:\d\d)$/.test(x)&&Number.isFinite(Date.parse(x));
export function validateArchive(p,now=new Date()) {
 const m=p?.meta,d=p?.data;
 if(m?.contract_version!=='NBA_MARKET_DATA_V1'||m.provider!=='BALLDONTLIE'||m.sportsbook!=='FanDuel'||m.id_namespace!=='balldontlie'||!d||!/^[a-f0-9]{64}$/.test(m.snapshot_id??''))throw new Error('ARCHIVE_SOURCE_MISMATCH');
 if(!stamp(m.source_received_at)||Date.parse(m.source_received_at)>now.getTime()+60000)throw new Error('ARCHIVE_TIME_INVALID');
 if(Array.isArray(d.games)){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(m.date_local)||d.games.length>40)throw new Error('ARCHIVE_SCHEDULE_INVALID');
  const ids=new Set();for(const g of d.games){checkGame(g);if(ids.has(g.id)||localDay(new Date(g.datetime))!==m.date_local)throw new Error('ARCHIVE_SCHEDULE_MISMATCH');ids.add(g.id);}return p;
 }
 checkGame(d.game);
 if(!['PREGAME','IN_PLAY','NOT_OPEN_FOR_PREGAME','START_STATE_UNCERTAIN'].includes(d.phase)||!Array.isArray(d.quotes)||d.quotes.length!==m.quote_count||d.quotes.length>3000)throw new Error('ARCHIVE_COUNT_OR_PHASE_INVALID');
 const seen=new Set();for(const q of d.quotes){
  if(q.game_id!==d.game.id||q.provider!=='BALLDONTLIE'||q.sportsbook!=='FanDuel'||!/^[a-f0-9]{64}$/.test(q.quote_id??'')||seen.has(q.quote_id))throw new Error('ARCHIVE_QUOTE_IDENTITY_INVALID');seen.add(q.quote_id);
  if(!Number.isInteger(q.american_odds)||Math.abs(q.american_odds)<100||!['moneyline','spread','total','props'].includes(q.market))throw new Error('ARCHIVE_QUOTE_PRICE_INVALID');
  if(q.market!=='moneyline'&&!Number.isFinite(q.line))throw new Error('ARCHIVE_LINE_MISSING');
  if(typeof q.period!=='string'||typeof q.statistic!=='string'||typeof q.contract!=='string')throw new Error('ARCHIVE_CONTRACT_MISSING');
  if(q.market==='props'&&(!Number.isSafeInteger(q.player_id)||q.player_id<=0))throw new Error('ARCHIVE_PLAYER_MISSING');
  if(q.provider_updated_at!=null&&!stamp(q.provider_updated_at))throw new Error('ARCHIVE_PROVIDER_TIME_INVALID');
  if(q.side==='over'&&q.contract!=='STRICT_GREATER_THAN'||q.side==='under'&&q.contract!=='STRICT_LESS_THAN')throw new Error('ARCHIVE_CONTRACT_CONFLICT');
 }
 return p;
}
function checkGame(g){if(!Number.isSafeInteger(g?.id)||g.id<=0||!stamp(g.datetime)||!Number.isInteger(g.season)||!g.home_team?.abbreviation||!g.visitor_team?.abbreviation||g.home_team.id===g.visitor_team.id)throw new Error('ARCHIVE_GAME_INVALID');}
export function gameState(g){return g.postponed?'postponed':/cancel/i.test(g.status_state??g.status)?'cancelled':g.status_state==='final'||/final/i.test(g.status)?'completed':Number(g.period)>0||g.status_state==='in_progress'?'live':'scheduled';}
export function normalizeEvent(g,eid=`bdl_nba_${g.id}`){
 const participant=(t)=>({id:`nba_${t.abbreviation.toLowerCase()}`,sportKey:'basketball_nba',leagueKey:'nba',displayName:t.full_name,type:'team',providerIds:{balldontlie:String(t.id)},metadata:{source:'NBA_MARKET_DATA_V1'}});
 const home=participant(g.home_team),away=participant(g.visitor_team);
 return {id:eid,sportKey:'basketball_nba',leagueKey:'nba',displayName:`${away.displayName} @ ${home.displayName}`,startTime:g.datetime,status:gameState(g),homeParticipant:home,awayParticipant:away,participants:[home,away],venue:{neutralSite:false,metadata:{verification:'UNVERIFIED'}},providerIds:{balldontlie:String(g.id)},rawProvider:'balldontlie',metadata:{dataOnly:true,seasonPhase:'unverified',season:g.season,postseason:g.postseason,settlementEligible:false}};
}
export function normalizeOdds(p,eid,now=new Date()) {
 validateArchive(p,now);const g=p.data.game,groups=new Map();
 for(const q of p.data.quotes){
  if(!['moneyline','spread','total'].includes(q.market)||q.period!=='FULL_GAME_LABEL_OT_UNVERIFIED'||!stamp(q.provider_updated_at))continue;
  const age=now.getTime()-Date.parse(q.provider_updated_at);if(age<0||age>300000)continue;
  const key=[q.market,q.provider_updated_at].join('|');
  const x=groups.get(key)??{id:p.meta.snapshot_id+':'+q.market,eventId:eid,sportKey:'basketball_nba',provider:'balldontlie',sportsbook:'fanduel',marketKey:q.market,lastUpdated:q.provider_updated_at,outcomes:[],metadata:{module:'NBA_MARKET_DATA_V1',phase:p.data.phase,sourceReceivedAt:p.meta.source_received_at,overtimeRule:'NOT_VERIFIED',settlementEligible:false,dataOnly:true}};
  x.outcomes.push({id:q.quote_id,label:q.side==='home'?g.home_team.full_name:q.side==='away'?g.visitor_team.full_name:q.side==='over'?'Over':'Under',participantId:q.side==='home'?`nba_${g.home_team.abbreviation.toLowerCase()}`:q.side==='away'?`nba_${g.visitor_team.abbreviation.toLowerCase()}`:undefined,price:q.american_odds,...(q.line!=null?{point:q.line}:{}),metadata:{side:q.side,contract:q.contract,period:q.period,quoteId:q.quote_id}});groups.set(key,x);
 }
 return [...groups.values()].filter(x=>{if(x.outcomes.length!==2)return false;const sides=x.outcomes.map(o=>o.metadata.side).sort().join(',');if(x.marketKey==='total')return sides==='over,under'&&x.outcomes[0].point===x.outcomes[1].point;if(sides!=='away,home')return false;return x.marketKey!=='spread'||Math.abs(x.outcomes[0].point+x.outcomes[1].point)<1e-9;});
}
export function syncPlan(games,now=new Date(),slot=Math.floor(now.getTime()/1800000)){
 const eligible=games.filter(g=>Number.isFinite(Date.parse(g.datetime))&&!['completed','cancelled','postponed'].includes(gameState(g))&&Date.parse(g.datetime)>=now.getTime()-18000000&&Date.parse(g.datetime)<=now.getTime()+86400000).sort((a,b)=>Date.parse(a.datetime)-Date.parse(b.datetime));
 const near=eligible.filter(g=>Date.parse(g.datetime)<=now.getTime()+7200000);
 const propGames=near.length?[...near.slice(slot%near.length),...near.slice(0,slot%near.length)].slice(0,2):[];
 return {main:eligible.slice(0,16),props:propGames.flatMap(g=>['points','rebounds','assists','threes'].map(prop_type=>({game_id:g.id,prop_type}))),eligible:eligible.length,not_selected:Math.max(0,eligible.length-16)};
}
