// Offline boundary. The caller supplies an independently reconciled final and an
// exact archived rule receipt. No production adapter supplies these inputs yet.
export function gradeTeamContract(contract, rule, final) {
  if (!rule?.verified || !final?.verified || !rule.id ||
      rule.id !== contract.ruleId || rule.book !== contract.book ||
      rule.market !== contract.market || rule.scope !== contract.scope ||
      final.eventId !== contract.eventId || final.scope !== rule.scope ||
      !['REG','FINAL_WITH_SO'].includes(rule.scope) ||
      !(Date.parse(final.observedAt) > Date.parse(contract.start))) return null;
  const {home,away}=final;
  if (![home,away].every(x=>Number.isSafeInteger(x)&&x>=0)) return null;
  if (contract.market==='ml' && home===away) return null;
  let margin;
  if (contract.market==='total' && ['under','over'].includes(contract.side) && Number.isFinite(contract.line))
    margin=(home+away-contract.line)*(contract.side==='under'?-1:1);
  else if (['ml','spread'].includes(contract.market) && ['home','away'].includes(contract.side)) {
    if(contract.market==='spread' && !Number.isFinite(contract.line)) return null;
    margin=(home-away)*(contract.side==='home'?1:-1)+(contract.market==='spread'?contract.line:0);
  } else return null;
  return margin>0?'win':margin<0?'loss':'push';
}
