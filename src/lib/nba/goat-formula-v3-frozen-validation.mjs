// Frozen V3 NBA GOAT formula hypotheses, for FUTURE game-level checks only.
// No training on evaluation results. This is an as-of replay, not proof a pick was actually issued.
import {gameClusterCI} from './goat-formula-lab-v3.mjs';
export const FROZEN_FORMULAS=Object.freeze({
 rebounds:'MEAN_Q35_50',
 threes:'MEAN_MED10_25'
});
export const EARLIEST_FUTURE_DAY='2026-11-16';
const round=x=>Number(x.toFixed(6));
export function checkFrozenV3(examples,{firstDay=EARLIEST_FUTURE_DAY,minGames=30,minPlayerGames=200}={}){
 if(firstDay<EARLIEST_FUTURE_DAY)throw Error('REUSED_HISTORICAL_TEST_WINDOW');
 const results=[];
 for(const [market,formula] of Object.entries(FROZEN_FORMULAS)){
  const rows=examples.filter(e=>e.market===market&&e.mode==='PROSPECTIVE_ASOF_VERIFIED'&&
   e.day>=firstDay && e.predictions?.[formula]!=null && e.predictions?.L10!=null);
  const evidence=gameClusterCI(rows,formula,'L10',{iterations:3000,seed:87453});
  const baselineError=rows.length?rows.reduce((sum,x)=>sum+Math.abs(x.actual-x.predictions.L10),0)/rows.length:null;
  const selectedError=rows.length?rows.reduce((sum,x)=>sum+Math.abs(x.actual-x.predictions[formula]),0)/rows.length:null;
  const enough=rows.length>=minPlayerGames&&evidence.nGames>=minGames;
  const ciPositive=Boolean(evidence.ci95&&evidence.ci95[0]>0);
  results.push({
   market,formula,frozenAsOf:'2026-11-16',firstDay,playerGameObservations:rows.length,uniqueGames:evidence.nGames,
   baselineMAE:baselineError===null?null:round(baselineError),
   candidateMAE:selectedError===null?null:round(selectedError),
   deltaMAE:evidence.pointDelta,gameCluster95CI:evidence.ci95,
   status:!enough?'INSUFFICIENT_NEW_GAME_EVIDENCE':ciPositive?'POSITIVE_ASOF_REPLAY_REQUIRES_HUMAN_REVIEW':'NO_DEFENSIBLE_IMPROVEMENT',
   validatedCandidate:false,holdoutCertified:false,modelPromotionAuthorized:false,
   note:'Frozen formula and game-level as-of reconstruction; no actual recorded pregame picks, odds, settlement, ROI or independent certification.'
  });
 }
 return results;
}
