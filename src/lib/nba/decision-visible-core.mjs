// Presentation-only guard: never derive picks from archived raw quote rows.
const finite=v=>typeof v==='number'&&Number.isFinite(v);
function contractKey(r){
 const base=[String(r.gameId),String(r.market),String(r.period)];
 if(r.market==='props')return [...base,String(r.playerId),String(r.statistic)].join('|');
 if(r.market==='moneyline')return base.join('|');
 if(r.market==='spread')return [...base,finite(r.line)?Math.abs(r.line).toFixed(3):'MISSING'].join('|');
 return [...base,finite(r.line)?r.line.toFixed(3):'MISSING'].join('|');
}
export function visibleNbaPreferredRows(rows){
 if(!Array.isArray(rows))return [];
 const seen=new Map();
 for(const r of rows){
  if(!r||r.classification!=='VIGILAR'||r.preference?.evidenceScope!=='DESCRIPTIVE_SHADOW_NOT_PROBABILITY'||
     !finite(r.preference.numericGap)||r.preference.numericGap<=0||
     !finite(r.preference.sortIndex)||!Number.isInteger(r.preference.favorableCount)||r.preference.favorableCount<1)continue;
  const key=contractKey(r),previous=seen.get(key);
  if(!previous||r.preference.sortIndex>previous.preference.sortIndex||
     (r.preference.sortIndex===previous.preference.sortIndex&&String(r.id).localeCompare(String(previous.id))<0)){
   seen.set(key,r);
  }
 }
 return [...seen.values()];
}
