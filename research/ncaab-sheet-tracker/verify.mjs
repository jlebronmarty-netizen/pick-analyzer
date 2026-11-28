// Laboratory boundary: pass original archived scoreboard events and rule receipts.
// Empty rule catalog in production. All times and identities come from the inputs.
const instant = s => typeof s === "string" && /(?:Z|[+-]\d\d:\d\d)$/.test(s) ? Date.parse(s) : NaN;
function count(value) {
  const n=typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  return Number.isSafeInteger(n) && n>=0 ? n : null;
}
function verifiedScore(contract, {event, capturedAt, sourceId}, cutoff) {
  const c=event?.competitions?.[0];
  const at=instant(capturedAt), start=instant(contract.start);
  if(typeof sourceId!=="string" || !sourceId.trim() || !(at>start && at<=cutoff) || event?.competitions?.length!==1 ||
    !c?.id || "espn:"+c.id!==contract.eventId || event.id!==c.id ||
    instant(c.date)!==start || (event.date && instant(event.date)!==start) ||
    ![event.status,c.status].filter(Boolean).length ||
    [event.status,c.status].filter(Boolean).some(s=>s.type?.completed!==true || s.type?.state!=="post") ||
    c.timeValid===false || event.timeValid===false || !Array.isArray(c.competitors) || c.competitors?.length!==2) return null;
  const lines=[];
  for(const [side,id] of [["home",contract.homeId],["away",contract.awayId]]) {
    const t=c.competitors.find(t=>t?.homeAway===side);
    if(!t || String(id)!==t.id || t.team?.id!==t.id || !Array.isArray(t.linescores) || t.linescores.length<2) return null;
    const scores=t.linescores.map((p,i)=>p?.period===i+1 && (p.value===undefined || p.displayValue===undefined || count(p.value)===count(p.displayValue)) ? count(p.value??p.displayValue):null);
    if(scores.includes(null) || scores.reduce((a,b)=>a+b,0)!==count(t.score))return null;
    lines.push(scores);
  }
  const [h,a]=lines;
  if(h.length!==a.length || contract.homeId===contract.awayId)return null;
  let home=0,away=0;
  for(let i=0;i<h.length;i++) {
    if(i>=2 && home!==away)return null;
    home+=h[i];away+=a[i];
  }
  if(home===away)return null;
  return {lines,sourceId,at};
}
export function verifyGrade(contract, rule, receipts, asOf) {
  const cut=instant(asOf),start=instant(contract.start);
  if(!rule?.verified || !rule.source || !rule.voidTerms || rule.push!=="refund" ||
    !["book","market","jurisdiction","period","label","ruleId"].every(k=>typeof contract[k]==="string" && contract[k] && contract[k]===rule[k]) ||
    !(instant(rule.validFrom)<=instant(contract.quotedAt) && instant(contract.quotedAt)<instant(rule.validUntil) &&
      instant(contract.quotedAt)<=instant(contract.cutAt) && instant(contract.cutAt)<=instant(contract.recordedAt) && instant(contract.recordedAt)<start) ||
    !["FT_OT","REG","H1","H2_REG"].includes(contract.period) || !Number.isFinite(contract.line))return null;
  if(!Array.isArray(receipts)||receipts.some(r=>!r || !Number.isFinite(instant(r.capturedAt))))return null;
  const rows=receipts.filter(r=>"espn:"+r.event?.id===contract.eventId && instant(r.capturedAt)<=cut);
  if(!rows.length || new Set(rows.map(r=>r.sourceId)).size!==rows.length)return null;
  const scored=rows.map(r=>verifiedScore(contract,r,cut));
  if(scored.some(v=>v===null)||new Set(scored.map(v=>JSON.stringify(v.lines))).size!==1)return null;
  const evidence=scored.sort((a,b)=>a.at-b.at||a.sourceId.localeCompare(b.sourceId))[0];
  const [h,a]=evidence.lines.map(s=>contract.period==="H1"?s[0]:contract.period==="H2_REG"?s[1]:
    (contract.period==="REG"?s.slice(0,2):s).reduce((x,y)=>x+y,0));
  let margin;
  if(contract.market==="total" && ["over","under"].includes(contract.side) && contract.line>0)
    margin=(h+a-contract.line)*(contract.side==="over"?1:-1);
  else if(["ml","spread"].includes(contract.market) && ["home","away"].includes(contract.side) &&
    (contract.market==="spread"||contract.line===0))
    margin=(h-a)*(contract.side==="home"?1:-1)+contract.line;
  else return null;
  return {result:margin>0?"win":margin<0?"loss":"push",evidenceId:evidence.sourceId,observedAt:new Date(evidence.at).toISOString()};
}
