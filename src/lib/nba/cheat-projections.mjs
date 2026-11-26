import {inOddsBand} from './cheat-ranking.mjs';
// These rows describe the existing Decision Board model and archived price.
// They never enter the verified trend ranking or its pregame snapshot.
const permittedIssues=new Map([
  ['ORIGINAL_BOX_NOT_CROSS_CHECKED','Box score original pendiente de cotejo'],
  ['OVERTIME_RULE_UNVERIFIED','Regla de tiempo extra pendiente'],
  ['PLAYER_AVAILABILITY_UNCONFIRMED','Disponibilidad del jugador pendiente']
]);
export function projectionRows(rows,histories={}){
  return rows.filter(r=>Number.isFinite(r.projection) && Number.isFinite(r.line) &&
    Number.isFinite(r.odds) && Number.isFinite(r.advantage) && r.advantage>=0 &&
    r.sample===10 && r.quoteFreshness==='RECENT' && r.dataQuality?.book==='FanDuel' &&
    r.dataQuality.issues.every(i=>permittedIssues.has(i.reason))).map(r=>({
      ...histories[r.historyKey],player:r.playerId,gameId:r.gameId,name:r.playerName,matchup:r.matchup,market:r.statistic,start:r.startsAt,
      projection:r.projection,line:r.line,side:r.selection,odds:r.odds,edge:r.advantage,
      ten:r.hit10,five:r.hit5,l5:r.l5,l10:r.l10,quote:r.quoteId,
      captured:r.capturedAt,expires:r.dataQuality.expiresAt,
      warnings:[...new Set(r.dataQuality.issues.map(i=>permittedIssues.get(i.reason)))]
    }));
}
export function topProjections(rows,market,window,floor,now){
  if(!['ten','five'].includes(window))return [];
  const other=window==='ten'?'five':'ten';
  const sorted=rows.filter(r=>r.market===market && inOddsBand(r.odds,floor) && Date.parse(r.expires)>now &&
    Date.parse(r.start)>now && Number.isInteger(r[window])).sort((a,b)=>
    b[window]-a[window] || b[other]-a[other] || b.odds-a.odds || a.quote.localeCompare(b.quote));
  const seen=new Set();
  return sorted.filter(r=>{if(seen.has(r.player))return false;seen.add(r.player);return true;}).slice(0,10);
}
