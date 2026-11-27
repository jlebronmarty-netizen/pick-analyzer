export const oddsBands={'-250':'−250 o mejor','-650':'−251 a −650'};
export function inOddsBand(odds,floor){
  if(!Number.isInteger(odds) || Math.abs(odds)<100)return false;
  return floor===-250 ? odds>=-250 : floor===-650 && odds>=-650 && odds<=-251;
}
export const markets={points:'Puntos',rebounds:'Rebotes',assists:'Asistencias',threes:'Triples'};
export const outcome=(card,value)=>value===card.line?'push':(card.side==='over'?value>card.line:value<card.line)?'win':'loss';
export const hits=(card,window)=>card[window].filter(r=>outcome(card,r.value)==='win').length;
export function rankSheet(cards,market,window='ten',floor=-250){
  const eligible=cards.filter(c=>c.market===market && inOddsBand(c.odds,floor) && c[window].length>=(window==='ten'?10:5));
  const tie=window==='five'?'ten':'five';
  const sorted=eligible.sort((a,b)=>hits(b,window)/b[window].length-hits(a,window)/a[window].length ||
    hits(b,tie)-hits(a,tie) || b.odds-a.odds || a.quoteId.localeCompare(b.quoteId));
  const seen=new Set();
  return sorted.filter(c=>{if(seen.has(c.playerId))return false;seen.add(c.playerId);return true;}).slice(0,10);
}
export function captureRankings(cards,now){
  const active=cards.filter(c=>Date.parse(c.expiresAt)>now);
  const rankings=[];
  for(const market of Object.keys(markets))for(const window of ['ten','five','h2h'])for(const floor of Object.keys(oddsBands).map(Number)){
    const top=rankSheet(active,market,window,floor);
    if(top.length)rankings.push({market,window,floor,ceiling:floor===-650?-251:null,quotes:top.map(c=>c.quoteId)});
  }
  const ids=new Set(rankings.flatMap(r=>r.quotes));
  return {rankings,cards:active.filter(c=>ids.has(c.quoteId)).sort((a,b)=>a.quoteId.localeCompare(b.quoteId))};
}
