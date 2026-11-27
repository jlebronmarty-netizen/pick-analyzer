import {inOddsBand} from '../cheat-ranking.mjs';
export const sorts={rate:'Frecuencia histórica',gap:'Brecha en unidades',pct:'Brecha porcentual',conditions:'Condiciones favorables'};
export const marketLabels={points:'Puntos',rebounds:'Rebotes',assists:'Asistencias',threes:'Triples',points_rebounds_assists:'PRA',points_rebounds:'PR',points_assists:'PA',rebounds_assists:'RA'};
export function rankContracts(rows,{market,game,player,side,period,band,sort},now){
 return rows.filter(r=>Date.parse(r.expires)>now&&Date.parse(r.start)>now&&inOddsBand(r.odds,Number(band))&&
   (!market||r.market===market)&&(!game||String(r.gameId)===game)&&(!player||String(r.playerId)===player)&&(!side||r.side===side)&&
   (!period||r.period===period)&&r.n>=5&&Number.isFinite(r[sort]))
  .sort((a,b)=>b[sort]-a[sort]||b.n-a.n||b.odds-a.odds||a.id.localeCompare(b.id)).slice(0,10);
}
