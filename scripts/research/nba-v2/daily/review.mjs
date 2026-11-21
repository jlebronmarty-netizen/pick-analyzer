import {researchDecision} from '../../../../src/lib/nba/decision-probability-v2.mjs';

export function contractReview(f,result,reference={}) {
  const c=f.displayContext??reference,decision=researchDecision({...f,dataQuality:f.qualityStatus},null,f.frozenAt);
  return {id:f.forecastId,day:f.gameDay,game:f.gameId,matchup:c.matchup??('Partido '+f.gameId),
    market:f.market,period:f.period,side:f.side,statistic:f.statistic,playerId:f.playerId,playerName:c.playerName??null,
    selection:c.selection??(f.side==='home'?'Local':'Over'),line:f.line,projection:f.projection,p:f.probability,
    implied:f.impliedProbability,ev:f.expectedValue,book:f.book,odds:f.americanOdds,
    quoteAt:f.quoteAt,capturedAt:f.capturedAt,frozenAt:f.frozenAt,model:f.modelVersion,quality:f.qualityStatus,
    sample:f.historyGameIds.map(ids=>ids.length),l5:c.l5??null,l10:c.l10??null,warnings:f.quality.warnings??[],
    classification:decision.classification,reason:decision.reason,status:result?.result??'pending',
    actual:result?.actual??null,regionVerified:f.regionalExecutionVerified};
}

export function twoRecentDays(contracts) {
  const days=new Set([...new Set(contracts.map(c=>c.day))].sort().slice(-2));
  return contracts.filter(c=>days.has(c.day));
}

// Ledger reports are computed once by settlement. A preview read also includes newer first freezes.
export function ledgerReview(snapshot,archive) {
  if(!snapshot?.report)return null;
  const refs=new Map(archive.contracts.map(c=>[c.id,c]));
  const contracts=new Map(snapshot.report.recentContracts.map(c=>[c.id,{...c,
    ...(refs.has(c.id)?{matchup:refs.get(c.id).matchup,l5:refs.get(c.id).l5,l10:refs.get(c.id).l10}:{})}]));
  for(const f of snapshot.newForecasts){
    if(!contracts.has(f.forecastId))contracts.set(f.forecastId,contractReview(f,null,refs.get(f.forecastId)));
  }
  const recent=twoRecentDays([...contracts.values()]);
  const pendingNew=new Set(snapshot.newForecasts.map(f=>f.forecastId));
  return {asOf:snapshot.capturedAt??snapshot.report.asOf,metricsAsOf:snapshot.report.asOf,source:'ledger',
    challenge:archive.challenge,bankroll:archive.bankroll,approvedForBetting:false,
    report:snapshot.report.scopes,contracts:recent,pendingAfterReport:pendingNew.size,
    exclusions:snapshot.exclusions??{},exclusionsAt:snapshot.freezeAt??null};
}
