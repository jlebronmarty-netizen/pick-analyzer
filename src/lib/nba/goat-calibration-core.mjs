// Statistical reporting only. Sample confidence is not a promotion or betting policy.
export function wilsonInterval(wins,losses,z=1.96) {
 if(!Number.isSafeInteger(wins)||!Number.isSafeInteger(losses)||wins<0||losses<0||wins+losses===0)return null;
 const n=wins+losses,p=wins/n,denom=1+z*z/n;
 const center=(p+z*z/(2*n))/denom;
 const margin=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/denom;
 return {lower:Number(Math.max(0,center-margin).toFixed(4)),upper:Number(Math.min(1,center+margin).toFixed(4)),confidence:0.95,sample:n};
}

export function nbaGoatLearningReadiness({settledMarkets,settledMoneyline,distinctMoneylineProbabilities,featureScoresCaptured}) {
 const sample=Math.max(0,Math.trunc(settledMarkets??0));
 const moneyline=Math.max(0,Math.trunc(settledMoneyline??0));
 return {
  minimumDirectionalSample:30,
  settledMarkets:sample,
  stillNeededForDirectionalMinimum:Math.max(0,30-sample),
  moneylineRows:moneyline,
  probabilityDistinctValues:distinctMoneylineProbabilities,
  probabilitySaturated:moneyline>=5&&distinctMoneylineProbabilities.length===1,
  historicInputReplaySufficient:featureScoresCaptured>0,
  validationReady:false,
  holdoutReady:false,
  approvedForModelPromotion:false,
  note:'Directional 30-row threshold is not statistical validation; independent chronological validation and holdout remain required.'
 };
}
