// NBA period projections research V1. Retrospective, leak-safe scoring only.
// No prop odds, calibrated probabilities, betting decisions or official model promotion.
export const NBA_PERIOD_RESEARCH_VERSION = 'NBA_PERIOD_RETROSPECTIVE_SHADOW_V1';
export const NBA_PERIOD_RESEARCH_PERIODS = Object.freeze(['q1','q2','q3','q4','h1','h2','ft']);
export const NBA_PERIOD_RESEARCH_DEV_START = '2026-11-04';
export const NBA_PERIOD_RESEARCH_HOLDOUT_START = '2026-11-12';
export const NBA_PERIOD_RESEARCH_CANDIDATES = Object.freeze([
  Object.freeze({id:'baseline_40_60_50_50',recent5:0.40,offense:0.50,league:0}),
  Object.freeze({id:'recent_65_35_50_50',recent5:0.65,offense:0.50,league:0}),
  Object.freeze({id:'all10_50_50',recent5:0,offense:0.50,league:0}),
  Object.freeze({id:'offense70_defense30',recent5:0.4,offense:0.70,league:0}),
  Object.freeze({id:'offense30_defense70',recent5:0.4,offense:0.30,league:0}),
  Object.freeze({id:'offense85_defense15',recent5:0.4,offense:0.85,league:0}),
  Object.freeze({id:'league_shrink20',recent5:0.4,offense:0.50,league:0.20}),
  Object.freeze({id:'league_shrink40',recent5:0.4,offense:0.50,league:0.40}),
  Object.freeze({id:'offense70_shrink20',recent5:0.4,offense:0.70,league:0.20}),
  Object.freeze({id:'offense70_shrink40',recent5:0.4,offense:0.70,league:0.40}),
  Object.freeze({id:'offense85_shrink40',recent5:0.4,offense:0.85,league:0.40}),
  Object.freeze({id:'offense100',recent5:0.4,offense:1,league:0}),
  Object.freeze({id:'league_only',recent5:0.4,offense:0.5,league:1}),
]);
const round = x => Math.round(x * 1000) / 1000;
const mean = values => values.reduce((sum,x)=>sum+x,0) / values.length;
const dateString = x => typeof x==='string' && /^\d{4}-\d\d-\d\d$/.test(x);
const safeInteger = x => Number.isSafeInteger(x);
function parseGame(input) {
  const g=input?.game ?? input;
  if (!g || g.status_state!=='final' || !safeInteger(g.id) || g.id<=0 ||
      !safeInteger(g.home_team?.id) || !safeInteger(g.visitor_team?.id) ||
      g.home_team.id===g.visitor_team.id || !dateString(g.date) ||
      typeof g.datetime!=='string' || !Number.isFinite(Date.parse(g.datetime))) return null;
  const home=[],away=[];
  for(let i=1;i<=4;i++) {
    const h=g['home_q'+i],a=g['visitor_q'+i];
    if(!safeInteger(h)||!safeInteger(a)||h<0||a<0||h>90||a>90)return null;
    home.push(h);away.push(a);
  }
  function overtime(side) {
    let v=0;
    for(let i=1;i<=3;i++){
      const n=g[side+'_ot'+i];
      if(n===undefined||n===null)continue;
      if(!safeInteger(n)||n<0||n>80)return null;
      v+=n;
    }
    return v;
  }
  const hOT=overtime('home'),aOT=overtime('visitor');
  if(hOT===null||aOT===null||!safeInteger(g.home_team_score)||!safeInteger(g.visitor_team_score))return null;
  if(home.reduce((a,b)=>a+b,0)+hOT!==g.home_team_score ||
     away.reduce((a,b)=>a+b,0)+aOT!==g.visitor_team_score)return null;
  return {id:g.id,date:g.date,startedAt:g.datetime,homeTeam:g.home_team.id,awayTeam:g.visitor_team.id,
    home,away,homeOT:hOT,awayOT:aOT};
}
function periodPoints(game,side,period) {
 const q=side==='home'?game.home:game.away,ot=side==='home'?game.homeOT:game.awayOT;
 if(period.startsWith('q'))return q[Number(period[1])-1];
 if(period==='h1')return q[0]+q[1];
 if(period==='h2')return q[2]+q[3]+ot; // per FanDuel half settlement; not Q4.
 if(period==='ft')return q.reduce((a,b)=>a+b,0)+ot;
 throw new Error('UNKNOWN_PERIOD');
}
export function normalizePeriodResearchHistory(raw,{maxGames=2000}={}) {
 if(!Array.isArray(raw)||raw.length<1||raw.length>maxGames)throw new Error('NBA_PERIOD_HISTORY_BOUND');
 const used=new Set(),rows=[];
 for(const input of raw) {
  const game=parseGame(input);
  if(!game)throw new Error('NBA_PERIOD_FINAL_PERIOD_SCORE_INVALID');
  if(used.has(game.id))throw new Error('NBA_PERIOD_DUPLICATE_FINAL');
  used.add(game.id);rows.push(game);
 }
 rows.sort((a,b)=>a.date.localeCompare(b.date)||a.startedAt.localeCompare(b.startedAt)||a.id-b.id);
 return rows;
}
function prior(values,kind,cap) {return mean(values.slice(-cap).map(x=>x[kind]));}
function historicalFeatures({own,opponent,period,league}) {
 const mine=own.map(g=>g[period]),against=opponent.map(g=>g[period]);
 return {
  offense5:prior(mine,'for',5),offense10:prior(mine,'for',10),
  oppAllowed5:prior(against,'against',5),oppAllowed10:prior(against,'against',10),
  leaguePrior:league.length>=25?mean(league):null, priorOwnGames:mine.length,priorOpponentGames:against.length,
 };
}
export function createHistoricalPeriodRows(games, {minPriorGames=5}={}) {
 if(!Array.isArray(games)||!Number.isSafeInteger(minPriorGames)||minPriorGames<5)throw new Error('NBA_PERIOD_UNSAFE_CONFIG');
 const teamHistory=new Map(),leagueHistory=Object.fromEntries(NBA_PERIOD_RESEARCH_PERIODS.map(p=>[p,[]])),rows=[];
 const days=[...new Set(games.map(g=>g.date))];
 for(const day of days) {
  const batch=games.filter(g=>g.date===day);
  // Score ALL games on the same date before adding any of them to the feature history.
  for(const game of batch) {
   const homeHistory=teamHistory.get(game.homeTeam)||[],awayHistory=teamHistory.get(game.awayTeam)||[];
   if(homeHistory.length<minPriorGames||awayHistory.length<minPriorGames)continue;
   for(const period of NBA_PERIOD_RESEARCH_PERIODS) {
    const league=leagueHistory[period];
    rows.push({gameId:game.id,date:game.date,period,
      actualHome:periodPoints(game,'home',period),actualAway:periodPoints(game,'away',period),
      home:historicalFeatures({own:homeHistory,opponent:awayHistory,period,league}),
      away:historicalFeatures({own:awayHistory,opponent:homeHistory,period,league}),
    });
   }
  }
  for(const game of batch) {
   const forHome={},forAway={};
   for(const period of NBA_PERIOD_RESEARCH_PERIODS) {
    const h=periodPoints(game,'home',period),a=periodPoints(game,'away',period);
    forHome[period]={for:h,against:a};forAway[period]={for:a,against:h};
    leagueHistory[period].push(h,a);
   }
   if(!teamHistory.has(game.homeTeam))teamHistory.set(game.homeTeam,[]);
   if(!teamHistory.has(game.awayTeam))teamHistory.set(game.awayTeam,[]);
   teamHistory.get(game.homeTeam).push(forHome);
   teamHistory.get(game.awayTeam).push(forAway);
  }
 }
 return rows;
}
function estimate(feature,config) {
 const own=config.recent5*feature.offense5+(1-config.recent5)*feature.offense10;
 const opp=config.recent5*feature.oppAllowed5+(1-config.recent5)*feature.oppAllowed10;
 const blended=config.offense*own+(1-config.offense)*opp;
 return feature.leaguePrior===null?blended:(1-config.league)*blended+config.league*feature.leaguePrior;
}
export function scoreHistoricalPeriodRow(row,config) {
 const home=estimate(row.home,config),away=estimate(row.away,config);
 return {
  home,away,teamHomeError:Math.abs(home-row.actualHome),teamAwayError:Math.abs(away-row.actualAway),
  totalError:Math.abs(home+away-row.actualHome-row.actualAway),
  spreadError:Math.abs(home-away-row.actualHome+row.actualAway),
 };
}
export function periodErrorMetrics(rows,config) {
 if(!Array.isArray(rows)||rows.length===0) return {n:0,team_mae:null,total_mae:null,spread_mae:null,total_rmse:null,spread_rmse:null};
 let team=0,total=0,spread=0,totalSquared=0,spreadSquared=0;
 for(const row of rows){
  const scored=scoreHistoricalPeriodRow(row,config);
  if(![scored.home,scored.away,scored.totalError,scored.spreadError].every(Number.isFinite))
   throw new Error('NBA_PERIOD_NONFINITE_PROJECTION');
  team+=(scored.teamHomeError+scored.teamAwayError)/2;total+=scored.totalError;spread+=scored.spreadError;
  totalSquared+=scored.totalError**2;spreadSquared+=scored.spreadError**2;
 }
 return {n:rows.length,team_mae:round(team/rows.length),total_mae:round(total/rows.length),
  spread_mae:round(spread/rows.length),total_rmse:round(Math.sqrt(totalSquared/rows.length)),
  spread_rmse:round(Math.sqrt(spreadSquared/rows.length))};
}
export function pairedHoldoutErrorInterval(rows,candidate,baseline,seed=271828) {
 if(!Array.isArray(rows)||!rows.length)return {delta_total_mae:null,lower:null,upper:null,paired_n:0};
 const differences=rows.map(r=>scoreHistoricalPeriodRow(r,candidate).totalError-scoreHistoricalPeriodRow(r,baseline).totalError);
 const delta=mean(differences);
 const estimates=[];
 let state=seed>>>0;
 for(let trial=0;trial<2000;trial++){
  let total=0;
  for(let j=0;j<differences.length;j++){
   state=(Math.imul(1664525,state)+1013904223)>>>0;
   total+=differences[Math.floor((state/4294967296)*differences.length)];
  }
  estimates.push(total/differences.length);
 }
 estimates.sort((a,b)=>a-b);
 return {delta_total_mae:round(delta),lower:round(estimates[49]),upper:round(estimates[1949]),
   paired_n:differences.length,method:'DETERMINISTIC_PAIRED_BOOTSTRAP_2000_NONCONFIRMATORY'};
}
export function runNbaPeriodBacktest(raw,opts={}) {
 const games=normalizePeriodResearchHistory(raw);
 const start=opts.devStart??NBA_PERIOD_RESEARCH_DEV_START,holdout=opts.holdoutStart??NBA_PERIOD_RESEARCH_HOLDOUT_START;
 if(!dateString(start)||!dateString(holdout)||start>=holdout)throw new Error('NBA_PERIOD_INVALID_SPLIT');
 const rows=createHistoricalPeriodRows(games),baseline=NBA_PERIOD_RESEARCH_CANDIDATES[0];
 const periods={};let sufficientHoldout=true;
 for(const period of NBA_PERIOD_RESEARCH_PERIODS) {
  const dev=rows.filter(r=>r.period===period&&r.date>=start&&r.date<holdout);
  const later=rows.filter(r=>r.period===period&&r.date>=holdout);
  if(later.length<30||dev.length<30)sufficientHoldout=false;
  const candidates=NBA_PERIOD_RESEARCH_CANDIDATES.map(config=>({config,development:periodErrorMetrics(dev,config)}));
  candidates.sort((a,b)=>a.development.total_mae-b.development.total_mae||
    a.development.spread_mae-b.development.spread_mae||a.config.id.localeCompare(b.config.id));
  const winner=candidates[0].config;
  const baselineLater=periodErrorMetrics(later,baseline),candidateLater=periodErrorMetrics(later,winner);
  const paired=pairedHoldoutErrorInterval(later,winner,baseline,271828+NBA_PERIOD_RESEARCH_PERIODS.indexOf(period));
  periods[period]={
   development_n:dev.length,holdout_n:later.length,selected_by_development:winner.id,
   baseline_development:periodErrorMetrics(dev,baseline),candidate_development:periodErrorMetrics(dev,winner),
   baseline_holdout:baselineLater,candidate_holdout:candidateLater,paired_holdout:paired,
   holdout_total_mae_improved:paired.delta_total_mae<0,
   holdout_ci_excludes_zero:paired.upper<0||paired.lower>0,
   candidate_wins_both_total_and_spread:
     candidateLater.total_mae<baselineLater.total_mae&&candidateLater.spread_mae<baselineLater.spread_mae,
  };
 }
 return {
  version:NBA_PERIOD_RESEARCH_VERSION,status:sufficientHoldout?'RETROSPECTIVE_EXPLORATORY':'INSUFFICIENT_CHRONOLOGICAL_HOLDOUT',
  source:{games:games.length,first_date:games[0]?.date,last_date:games.at(-1)?.date,
    overtime_games:games.filter(g=>g.homeOT+g.awayOT>0).length,all_final_period_scores_verified:true,
    provider_calls:0,database_writes:0,retrospective_backfill:true,
    historical_feature_availability_at_original_pregame_time_not_certified:true},
  splits:{development_start:start,holdout_start:holdout,holdout_last_date:games.at(-1)?.date},
  candidate_count:NBA_PERIOD_RESEARCH_CANDIDATES.length,eligible_games:rows.length/NBA_PERIOD_RESEARCH_PERIODS.length,
  baseline_version:baseline.id,periods,
  promotion:{eligible:false,reason:'SMALL_RETROSPECTIVE_SAMPLE_NEEDS_INDEPENDENT_PROSPECTIVE_FROZEN_VALIDATION',
    official_models_changed:false,market_probabilities_calibrated:false,expected_value_verified:false},
 };
}
