// NHL read-only audit composition. Source forecasts are public DRatings observations,
// not an independently trained or calibrated Pick Analyzer betting model.
export function nhlWilson95(wins,losses){
 if(!Number.isInteger(wins)||!Number.isInteger(losses)||wins<0||losses<0||wins+losses===0)return null;
 const z=1.96,n=wins+losses,p=wins/n,den=1+z*z/n;
 const center=(p+z*z/(2*n))/den;
 const radius=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/den;
 return {lower:Number(Math.max(0,center-radius).toFixed(4)),upper:Number(Math.min(1,center+radius).toFixed(4)),confidence:0.95,sample:n};
}
export function nhlAuditSummary({report,learning,now=new Date().toISOString()}){
 if(report?.status!=='AVAILABLE'||learning?.status!=='AVAILABLE')return {status:'UNAVAILABLE',readOnly:true,externalProviderCalls:0,databaseWrites:0,modelChanged:false};
 const history=Array.isArray(report.history)?report.history:[],settled=history.filter(x=>x?.settlement?.outcome==='WIN'||x?.settlement?.outcome==='LOSS');
 const priced=settled.filter(x=>x.settlement.profitUnits!==null&&Number.isFinite(x.settlement.profitUnits));
 const pregame=history.filter(x=>Number.isFinite(Date.parse(x?.createdAt??''))&&Date.parse(x.createdAt)<Date.parse(x.scheduledAt));
 const overdue=history.filter(x=>!x.settlement&&Number.isFinite(Date.parse(x?.scheduledAt??''))&&Date.parse(x.scheduledAt)+6*3600000<Date.parse(now));
 const wins=settled.filter(x=>x.settlement.outcome==='WIN').length,losses=settled.filter(x=>x.settlement.outcome==='LOSS').length;
 const pricedProfit=priced.reduce((a,x)=>a+x.settlement.profitUnits,0),pricedROI=priced.length?100*pricedProfit/priced.length:null;
 const diagnostics=Number(learning.sample?.settled??0),context=Number(learning.evidence?.contextGames??0);
 const warnings=[];
 if(preGameMismatch(history,pregame))warnings.push('Non-pregame records found; investigate frozen-input lineage.');
 if(overdue.length)warnings.push('Overdue outcome(s) need reconciliation.');
 if(diagnostics!==settled.length)warnings.push('Learning/settlement cohort counts differ.');
 if(context<settled.length)warnings.push('NHL causal backfill is incomplete; continue bounded postgame enrichment.');
 if(priced.length<settled.length)warnings.push('ROI reflects a strictly smaller priced cohort, not the complete settled sample.');
 if(learning.evidence?.matchupReadCapped)warnings.push('Shooter-goalie matchup scan capped; pair profiles may be incomplete.');
 return {
  status:warnings.some(x=>x.includes('Non-pregame')||x.includes('Overdue'))?'ATTENTION':'READY_WITH_MONITORING',
  observedAt:now,classification:'MODEL_ONLY_SHADOW',researchOnly:true,
  sourceModel:'DRATINGS_PUBLIC_ARGMAX_V1',independentlyTrainedPickModel:false,
  productionBettingModelReady:false,priceBook:'CIRCA',fanDuelPricesCertified:false,
  supportedObservedMarket:'moneyline',spreadTotalRealDataModelReady:false,
  readOnly:true,externalProviderCalls:0,databaseWrites:0,modelChanged:false,officialPicksModified:false,
  frozen:{observations:history.length,pregameVerified:pregame.length,unverifiedTiming:history.length-pregame.length},
  settlement:{settled:settled.length,wins,losses,pending:history.length-settled.length,overdue:overdue.length,accuracy:settled.length?wins/settled.length:null,wilson95:nhlWilson95(wins,losses)},
  pricedSubset:{settled:priced.length,unpricedSettled:settled.length-priced.length,profitUnits:priced.length?Number(pricedProfit.toFixed(5)):null,roiPct:pricedROI===null?null:Number(pricedROI.toFixed(3)),stakeConvention:'ONE_UNIT_FLAT',certifiedProfitability:false},
  learning:{diagnosed:diagnostics,contextGames:context,pbpGames:Number(learning.evidence?.pbpGames??0),boxscoreGames:Number(learning.evidence?.boxscoreGames??0),
   missingContextGames:Math.max(0,settled.length-context),shooterGoalieObservations:Number(learning.evidence?.shooterGoalieObservations??0),
   shooterGoalieObservationsScanned:Number(learning.evidence?.shooterGoalieObservationsScanned??0),
   matchupReadCapped:Boolean(learning.evidence?.matchupReadCapped),
   brier:learning.sample?.brier??null,autoPromotion:false,postgameOnly:true},
  runtime:{lastRunStatus:report.health?.runStatus??null,lastRunAt:report.health?.latestRunAt??null,health:report.health?.status??null,issues:report.health?.issues??[]},
  warnings,
  disclaimer:'Observed public-source moneyline forecasts and Circa subset are research-only. Accuracy is not certified forward profitability; no NBA, NHL, or other model formula changed.'
 };
}
function preGameMismatch(history,pregame){return history.length!==pregame.length;}
