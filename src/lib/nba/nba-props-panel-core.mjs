// NBA GOAT props display — read-only descriptive baselines, not model picks.
// All samples used for a row were actually captured before its frozen quote.
export const PANEL_MARKETS=Object.freeze(['points','rebounds','assists','threes']);
export const PANEL_VERSION='NBA_PROPS_DESCRIPTIVE_SHADOW_V1';
const date=x=>Date.parse(String(x??''));
const numeric=x=>x===null||x===undefined||x===''?null:Number(x);
const round=x=>Number(x.toFixed(2));
const stats=Object.freeze({points:'pts',rebounds:'reb',assists:'ast',threes:'fg3m'});
export function buildPropPanelRows({game,quotes,facts,asOf,playerNames={}}){
 const now=date(asOf),start=date(game?.datetime);
 if(!Number.isFinite(now)||!Number.isFinite(start)||game?.status_state!=='scheduled'||now>=start-600000)
  return {status:'NO_VERIFIED_UPCOMING_PREGAME_GAME',rows:[]};
 const history=new Map();
 for(const f of facts){
  const pid=Number(f.player_id),gid=Number(f.provider_game_id);
  if(!Number.isSafeInteger(pid)||!Number.isSafeInteger(gid)||!f.projection_eligible)continue;
  const played=date(f.game_datetime),captured=date(f.source_captured_at);
  if(!Number.isFinite(played)||!Number.isFinite(captured)||played>=start||captured>now)continue;
  const key=String(pid),list=history.get(key)??[];list.push(f);history.set(key,list);
 }
 const seen=new Set(),rows=[];
 const selected=[...quotes].sort((a,b)=>date(b.source_received_at)-date(a.source_received_at));
 for(const q of selected){
  const playerId=Number(q.player_id),market=String(q.statistic),side=String(q.side).toLowerCase(),line=numeric(q.line),odds=numeric(q.american_odds);
  const quoteAt=date(q.source_received_at);
  if(!Number.isSafeInteger(playerId)||!PANEL_MARKETS.includes(market)||!['over','under'].includes(side)||!Number.isFinite(quoteAt)||
   quoteAt>now+1000||now-quoteAt>30*60000||quoteAt>=start-600000||
   line===null||!Number.isFinite(line)||line<0||odds===null||!Number.isInteger(odds)||Math.abs(odds)<100||
   String(q.market)!=='props'||String(q.phase)!=='PREGAME'||
   q.period!=='FULL_GAME_LABEL_OT_UNVERIFIED'||
   q.contract!==(side==='over'?'STRICT_GREATER_THAN':'STRICT_LESS_THAN'))continue;
  const key=[playerId,market,side,line].join('|');if(seen.has(key))continue;seen.add(key);
  const selectedHistory=[...(history.get(String(playerId))??[])].filter(f=>
    date(f.game_datetime)<quoteAt&&date(f.source_captured_at)<=quoteAt&&
    numeric(f[stats[market]])!==null&&Number.isInteger(numeric(f[stats[market]]))&&numeric(f[stats[market]])>=0);
  const games=new Map();
  for(const f of selectedHistory)games.set(Number(f.provider_game_id),f);
  const prior=[...games.values()].sort((a,b)=>date(b.game_datetime)-date(a.game_datetime));
  const sample=prior.slice(0,10),last5=sample.slice(0,5);
  const avg=x=>x.reduce((s,f)=>s+Number(f[stats[market]]),0)/x.length;
  const valid=last5.length>=5,has10=sample.length>=10;
  const projection=valid?(has10?avg(sample):avg(last5)):null;
  rows.push({playerId,playerName:String(playerNames[String(playerId)]??'')||null,statistic:market,side,line,americanOdds:odds,
   sourceReceivedAt:q.source_received_at,quoteId:q.quote_id??null,
   projection:projection===null?null:round(projection),
   delta:projection===null?null:round(projection-line),
   l5:valid?round(avg(last5)):null,l10:has10?round(avg(sample)):null,availablePriorGames:prior.length,
   formula:has10?'L10':valid?'L5_DESCRIPTIVE':'INSUFFICIENT_CAPTURED_PRIOR_GAMES',
   status:projection===null?'INSUFFICIENT_CAPTURED_PRIOR_GAMES':'DESCRIPTIVE_SHADOW_ONLY',
   modelProbability:null,expectedValue:null,confidence:null,recommendedPick:false,
   productionEligible:false,validated:false,source:'GOAT_COMPACT_ASOF_VERIFIED'});
 }
 return {status:rows.length?'READ_ONLY_DESCRIPTIVE_SHADOW':'NO_FRESH_VERIFIED_PROP_QUOTES',rows};
}
