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


// Model-direction research display: exactly one row per player/stat/line,
// with an explicit PASS whenever data quality or evidence is insufficient.
// It DOES NOT produce a calibrated edge, EV, probability or betting recommendation.
export const DIRECTION_VERSION='NBA_PROPS_DIRECTIONAL_RESEARCH_V1';
const minDistance=Object.freeze({points:2,rebounds:1,assists:1,threes:.6});
export function buildDirectionalResearchRows(rows,{maxPairMinutes=5}={}){
 if(!Array.isArray(rows)||!Number.isFinite(maxPairMinutes)||maxPairMinutes<0||maxPairMinutes>30)
  throw Error('INVALID_DIRECTIONAL_INPUT');
 const groups=new Map();
 for(const r of rows){
  const key=[r.playerId,r.statistic,r.line].join('|');
  const g=groups.get(key)??{over:null,under:null};
  if(r.side==='over'||r.side==='under'){
   if(!g[r.side]||date(r.sourceReceivedAt)>date(g[r.side].sourceReceivedAt))g[r.side]=r;
   groups.set(key,g);
  }
 }
 const result=[];
 for(const {over,under} of groups.values()){
  const base=over??under;
  if(!base)continue;
  const hasBoth=Boolean(over&&under),pairTime=hasBoth?Math.abs(date(over.sourceReceivedAt)-date(under.sourceReceivedAt)):Infinity;
  const enough=base.formula==='L10'&&base.availablePriorGames>=10&&Number.isFinite(base.projection);
  const spread=enough?base.projection-base.line:null;
  const threshold=minDistance[base.statistic]??Infinity;
  let tendency='PASS',reason='MISSING_BOTH_VERIFIED_SIDES';
  if(hasBoth&&pairTime<=maxPairMinutes*60000){
   if(!enough)reason='INSUFFICIENT_L10_PRIOR_GAMES';
   else if(!Number.isFinite(spread)||Math.abs(spread)<threshold)reason='MARGIN_BELOW_EXPLORATORY_THRESHOLD';
   else if(spread>0){tendency='OVER_TENDENCY';reason='DESCRIPTIVE_PROJECTION_ABOVE_LINE'}
   else{tendency='UNDER_TENDENCY';reason='DESCRIPTIVE_PROJECTION_BELOW_LINE'}
  }else if(hasBoth)reason='SIDES_NOT_TIME_COMPARABLE';
  const selected=tendency==='OVER_TENDENCY'?over:tendency==='UNDER_TENDENCY'?under:null;
  result.push({version:DIRECTION_VERSION,playerId:base.playerId,playerName:base.playerName??null,
   statistic:base.statistic,line:base.line,projection:base.projection,delta:base.delta,
   l5:base.l5,l10:base.l10,availablePriorGames:base.availablePriorGames,
   tendency,reason,exploratoryThreshold:threshold,
   observedOverOdds:over?.americanOdds??null,observedUnderOdds:under?.americanOdds??null,
   selectedSideOdds:selected?.americanOdds??null,quoteCapturedAt:selected?.sourceReceivedAt??base.sourceReceivedAt,
   modelProbability:null,expectedValue:null,confidence:null,recommendedPick:false,
   validated:false,productionEligible:false,comparisonOnly:true});
 }
 return result.sort((a,b)=>a.statistic.localeCompare(b.statistic)||a.playerId-b.playerId||a.line-b.line);
}
