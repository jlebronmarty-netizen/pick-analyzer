import {createHash} from 'node:crypto';
export const NBA_DECISION_LEARNING_VERSION='NBA_DECISION_STATISTICAL_SHADOW_V1';
const okTime=v=>typeof v==='string'&&Number.isFinite(Date.parse(v));
const number=v=>v===null||v===undefined||v===''?null:Number.isFinite(Number(v))?Number(v):null;
const hash=obj=>createHash('sha256').update(JSON.stringify(obj)).digest('hex');
const round=x=>Math.round(x*1000)/1000;
const allowedMarkets=new Set(['moneyline','spread','total','props','team_total_home','team_total_away']);
const allowedPeriods=new Set(['ft','q1','q2','q3','q4','h1','h2']);

export const NBA_SHADOW_FREEZE_MAX_PER_RUN=240;
const round2=x=>Math.round(x*100)/100;
function plannedChallengers(row) {
 const l5=number(row.l5),l10=number(row.l10),baseline=number(row.projection);
 if(l5===null||l10===null||baseline===null)return [];
 if(row.market==='props'&&row.period==='ft'){
  return [
   {id:'NBA_PROP_BALANCED_50_50_V1',projection:round2(.5*l5+.5*l10)},
   {id:'NBA_PROP_STABLE_35_65_V1',projection:round2(.35*l5+.65*l10)}
  ];
 }
 if(row.market==='total'&&allowedPeriods.has(row.period)){
  return [
   {id:'NBA_TOTAL_TREND_PLUS10_V1',projection:round2(baseline+.1*(l5-l10))},
   {id:'NBA_TOTAL_TREND_MINUS10_V1',projection:round2(baseline-.1*(l5-l10))}
  ];
 }
 return [];
}
// Equal-game quota first; within each game cycle market/period groups to avoid props dominance.
// Max 240 hypotheses per scheduled slot, 480/day, within two settlement batches of 400 each.
export function balanceFrozenForecasts(candidates,maxPerRun=NBA_SHADOW_FREEZE_MAX_PER_RUN){
 if(!Array.isArray(candidates)||!Number.isSafeInteger(maxPerRun)||maxPerRun<1||maxPerRun>240)
  throw new Error('NBA_DECISION_INVALID_FREEZE_CAP');
 const games=[...new Set(candidates.map(f=>String(f.game_id)))].sort();
 if(!games.length)return [];
 const perGame=Math.min(60,Math.floor(maxPerRun/games.length));
 const result=[];
 for(let index=0;index<games.length;index++){
  const id=games[index], groups=new Map();
  const gameRows=candidates.filter(f=>String(f.game_id)===id);
  for(const f of gameRows){
   const key=f.market==='props'?'props|'+String(f.statistic):f.market+'|'+f.period;
   if(!groups.has(key))groups.set(key,[]);
   groups.get(key).push(f);
  }
  const mainKeys=['moneyline|ft','spread|ft','total|ft'];
  const otherKeys=[...groups.keys()].filter(k=>!mainKeys.includes(k)).sort();
  const offset=otherKeys.length?(index*7)%otherKeys.length:0;
  const keys=[...mainKeys.filter(k=>groups.has(k)),...otherKeys.slice(offset),...otherKeys.slice(0,offset)];
  for(const group of groups.values())group.sort((a,b)=>
    b.historical_n-a.historical_n||
    Math.abs(Number(b.evidence?.estimated_gap??0))-Math.abs(Number(a.evidence?.estimated_gap??0))||
    a.forecast_id.localeCompare(b.forecast_id));
  let count=0,progress=true;
  while(count<perGame&&progress){
   progress=false;
   for(const key of keys){
    if(count>=perGame)break;
    const next=groups.get(key)?.shift();
    if(next){result.push(next);count++;progress=true;}
   }
  }
 }
 return result.slice(0,maxPerRun);
}

export function planNbaShadowFreeze(board,asOf=new Date().toISOString()){
 const time=Date.parse(asOf);
 if(!Number.isFinite(time)||!board||!Array.isArray(board.games)||!board.rows)return {status:'INVALID_SHADOW_INPUT',rows:[]};
 const all=Object.values(board.rows).flat().filter(x=>x&&typeof x==='object');
 const selected=[],excluded={},seen=new Set();
 for(const row of all){
  const game=board.games.find(g=>String(g.id)===String(row.gameId));
  let reason=null;
  if(!game||!okTime(game.startsAt)||time>=Date.parse(game.startsAt)-10*60000)reason='NOT_PREGAME';
  else if(!allowedMarkets.has(row.market)||!allowedPeriods.has(row.period))reason='UNSUPPORTED_MARKET_PERIOD';
  else if(row.projection===null||!Number.isFinite(row.projection)||row.sample<5)reason='NO_PROJECTION_HISTORY';
  else if(row.quoteFreshness!=='RECENT'||!okTime(row.capturedAt)||Date.parse(row.capturedAt)>time+120000||
    time-Date.parse(row.capturedAt)>3*3600000)reason='STALE_OR_FUTURE_PRICE';
  else if(!row.quoteId||!['GOAT','HoopsAPI'].includes(row.source))reason='QUOTE_SOURCE_NOT_ARCHIVED';
  else if(!['home','away','Over','Under',game.home,game.away].includes(row.selection)&&row.market!=='props'&&
      !['team_total_home','team_total_away'].includes(row.market))reason='UNVERIFIED_SIDE';
  else if(!Number.isFinite(row.odds)||Math.abs(row.odds)<100)reason='INVALID_PRICE';
  else if(row.market!=='moneyline' && !Number.isFinite(row.line))reason='INVALID_LINE';
  else if(row.market==='moneyline' ? row.projection<=0 : !(Number.isFinite(row.advantage)&&row.advantage>=0.2))
    reason='NO_POSITIVE_DESCRIPTIVE_MARGIN';
  else if(row.market==='props'&&(!Number.isSafeInteger(row.playerId)||!row.statistic))reason='PLAYER_IDENTITY_UNVERIFIED';
  if(reason){excluded[reason]=(excluded[reason]??0)+1;continue;}
  const side=row.market==='props' ? (row.label.endsWith('OVER')?'over':'under') :
    row.selection==='Over'?'over':row.selection==='Under'?'under':
    row.selection===game.home?'home':row.selection===game.away?'away':
    row.label.includes('Over')?'over':row.label.includes('Under')?'under':null;
  if(!side){excluded.UNKNOWN_SIDE=(excluded.UNKNOWN_SIDE??0)+1;continue;}
  const identity=[board.version,game.id,row.market,row.period,side,row.playerId??null,row.statistic??null,
    row.line??null,row.quoteId,row.capturedAt,round(row.projection)];
  const id=hash(identity);
  if(seen.has(id))continue;seen.add(id);
  selected.push({
   forecast_id:id,model_version:board.version,decision_at:asOf,
   game_id:Number(game.id),game_start_at:game.startsAt,game_date_local:board.day,
   market:row.market,period:row.period,side,statistic:row.statistic??null,
   player_id:row.playerId??null,line:row.line??null,american_odds:row.odds,
   quote_id:String(row.quoteId),quote_source:row.source,quote_captured_at:row.capturedAt,
   projection:round(row.projection),l5:row.l5??null,l10:row.l10??null,
   historical_n:Number(row.sample),evidence:{
    origin:NBA_DECISION_LEARNING_VERSION,board_as_of:board.asOf,
    data_priority:'RESEARCH_ONLY_NOT_OFFICIAL',regional_price_verified:false,
    source_contract:'STATISTICAL_ONLY',quote_freshness:row.quoteFreshness,
    estimated_gap:row.advantage??null,
    player_name:row.playerName??null,matchup:row.matchup??null,
    challenger_projections:plannedChallengers(row),
   }
  });
 }
 selected.sort((a,b)=>a.game_id-b.game_id||a.market.localeCompare(b.market)||a.forecast_id.localeCompare(b.forecast_id));
 const balanced=balanceFrozenForecasts(selected);
 return {version:NBA_DECISION_LEARNING_VERSION,status:'SHADOW_PREVIEW_FREEZE_PLAN',
  rows:balanced,eligible_before_cap:selected.length,cap:NBA_SHADOW_FREEZE_MAX_PER_RUN,
  excluded:{...excluded,FAIR_SAMPLING_CAP:selected.length-balanced.length},
  provider_calls:0,official_model_writes:0};
}
function validatedFinal(raw,forecast){
 const g=raw?.game??raw;
 if(!g||g.status_state!=='final'||Number(g.id)!==forecast.game_id ||
    g.date!==forecast.game_date_local||!okTime(g.datetime)||
    Math.abs(Date.parse(g.datetime)-Date.parse(forecast.game_start_at))>3600000)return null;
 const home=[g.home_q1,g.home_q2,g.home_q3,g.home_q4].map(number);
 const away=[g.visitor_q1,g.visitor_q2,g.visitor_q3,g.visitor_q4].map(number);
 if([...home,...away].some(v=>v===null||!Number.isSafeInteger(v)||v<0))return null;
 const ho=['home_ot1','home_ot2','home_ot3'].reduce((s,k)=>s+(number(g[k])??0),0);
 const ao=['visitor_ot1','visitor_ot2','visitor_ot3'].reduce((s,k)=>s+(number(g[k])??0),0);
 const h=home.reduce((a,b)=>a+b,0)+ho,a=away.reduce((x,y)=>x+y,0)+ao;
 if(h!==number(g.home_team_score)||a!==number(g.visitor_team_score))return null;
 return {h,a,home,away,ho,ao};
}
function periodScore(final,side,period){
 const a=side==='home'?final.home:final.away,ot=side==='home'?final.ho:final.ao;
 if(/^q[1-4]$/.test(period))return a[Number(period.slice(1))-1];
 if(period==='h1')return a[0]+a[1];
 if(period==='h2')return a[2]+a[3]+ot;
 if(period==='ft')return a.reduce((x,y)=>x+y,0)+ot;
 return null;
}
const statsMap={points:['pts'],rebounds:['reb'],assists:['ast'],threes:['fg3m'],
  points_rebounds:['pts','reb'],points_assists:['pts','ast'],rebounds_assists:['reb','ast'],
  points_rebounds_assists:['pts','reb','ast']};
/** @param {any} forecast @param {any} sources */
export function settleNbaShadowForecast(forecast,{game,sourceReceivedAt,playerStat=null,playerStatReceivedAt=null}={}){
 if(!forecast||!okTime(sourceReceivedAt)||!okTime(forecast.game_start_at)||
    Date.parse(sourceReceivedAt)<=Date.parse(forecast.game_start_at))return null;
 const final=validatedFinal(game,forecast);
 if(!final)return null;
 let actual=null,source='BALLDONTLIE_FINAL_ARCHIVE';
 if(forecast.market==='props'){
  const cols=statsMap[forecast.statistic]??null;
  if(!cols||!playerStat||Number(playerStat.player_id)!==forecast.player_id||
     Number(playerStat.provider_game_id)!==forecast.game_id||
     !okTime(playerStatReceivedAt)||Date.parse(playerStatReceivedAt)<=Date.parse(forecast.game_start_at))
    return null;
  const vals=cols.map(k=>number(playerStat[k]));
  if(vals.some(x=>x===null||x<0||!Number.isSafeInteger(x)))return null;
  actual=vals.reduce((a,b)=>a+b,0);source='GOAT_PLAYER_STATS';
 } else if(forecast.market==='moneyline'||forecast.market==='spread'){
  const h=periodScore(final,'home',forecast.period),a=periodScore(final,'away',forecast.period);
  actual=forecast.side==='home'?h-a:a-h;
 }else if(forecast.market==='total'){
  actual=periodScore(final,'home',forecast.period)+periodScore(final,'away',forecast.period);
 }else if(forecast.market==='team_total_home'){
  actual=periodScore(final,'home',forecast.period);
 }else if(forecast.market==='team_total_away'){
  actual=periodScore(final,'away',forecast.period);
 }else return null;
 if(!Number.isFinite(actual)||!Number.isFinite(Number(forecast.projection)))return null;
 let verdict=null;
 if(forecast.market==='moneyline')verdict=actual>0?'win':actual<0?'loss':'push';
 else if(forecast.market==='spread'){const diff=actual+Number(forecast.line);verdict=diff>0?'win':diff<0?'loss':'push';}
 else if(forecast.side==='over'||forecast.side==='under'){
  const diff=actual-Number(forecast.line);
  verdict=diff===0?'push':(forecast.side==='over'?diff>0:diff<0)?'win':'loss';
 }
 if(!verdict)return null;
 return {forecast_id:forecast.forecast_id,actual:round(actual),
  absolute_error:round(Math.abs(Number(forecast.projection)-actual)),statistical_result:verdict,
  result_source:source,source_received_at:source==='GOAT_PLAYER_STATS'?playerStatReceivedAt:sourceReceivedAt,
  evidence:{settlement_scope:'STATISTICAL_ONLY_NOT_SPORTSBOOK',model_version:forecast.model_version,
    game_id:forecast.game_id,game_date_local:forecast.game_date_local,market:forecast.market,period:forecast.period}};
}
export function summarizeShadowLearning(forecasts,outcomes){
 const outcomeById=new Map((outcomes??[]).map(o=>[o.forecast_id,o])),buckets=new Map();
 for(const f of forecasts??[]){
  const o=outcomeById.get(f.forecast_id);
  if(!o)continue;
  const key=[f.model_version,f.market,f.period].join('|');
  if(!buckets.has(key))buckets.set(key,{modelVersion:f.model_version,market:f.market,period:f.period,n:0,games:new Set(),wins:0,losses:0,pushes:0,abs:0});
  const b=buckets.get(key);b.n++;b.games.add(String(f.game_id));b.abs+=Number(o.absolute_error);
  if(o.statistical_result==='win')b.wins++;
  else if(o.statistical_result==='loss')b.losses++;
  else b.pushes++;
 }
 return [...buckets.values()].map(b=>({
  modelVersion:b.modelVersion,market:b.market,period:b.period,
  scoredContracts:b.n,uniqueGames:b.games.size,wins:b.wins,losses:b.losses,pushes:b.pushes,
  mae:round(b.abs/b.n),hitRate:b.wins+b.losses>=30?round(100*b.wins/(b.wins+b.losses)):null,
  status:b.games.size>=100?'NEEDS_HOLDOUT_REVIEW':'INSUFFICIENT_INDEPENDENT_GAMES',
  automaticPromotion:false,
 })).sort((a,b)=>a.market.localeCompare(b.market)||a.period.localeCompare(b.period));
}
