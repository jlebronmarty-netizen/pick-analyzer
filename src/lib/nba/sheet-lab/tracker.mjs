import {createHash} from 'node:crypto';
import {verifiedArchivedPlayerFinal} from '../decision-archived-final-core.mjs';
import {reconcilePeriods} from './periods.mjs';
import {playerValues} from './nba-props.mjs';
import {minutesValue,segmentValues} from './nba-evidence.mjs';
import {marketLabels,rankContracts,sorts} from './rank.mjs';
const stamp=Date.parse;
const periodKey=p=>({ft:'FT',h1:'1H',h2:'2H',q1:'Q1',q2:'Q2',q3:'Q3',q4:'Q4'})[p]??p;
export function comparableOriginal(r,originals,cutoff){
 const matches=originals.filter(o=>String(o.gameId)===String(r.gameId)&&String(o.playerId)===String(r.playerId)&&o.market==='props'&&
  o.statistic===r.market&&o.line===r.line&&periodKey(o.period)===r.period&&o.ot===r.ot&&r.ot!=='NOT_VERIFIED'&&o.book==='FanDuel'&&
  ['over','under'].includes(o.side)&&stamp(o.start)===stamp(r.start)&&stamp(o.captured)<=stamp(o.decisionAt)&&
  stamp(o.decisionAt)<=stamp(o.recordedAt)&&stamp(o.recordedAt)<=stamp(cutoff)&&stamp(cutoff)<stamp(r.start));
 return matches.sort((a,b)=>stamp(b.recordedAt)-stamp(a.recordedAt)||String(a.id).localeCompare(String(b.id)))[0]??null;
}
// One snapshot per methodology, band and scope, with exact archived quote IDs.
export function prepareSnapshots(lab, originals=[]){
 const snapshots=[];
 for(const method of Object.keys(sorts))for(const band of ['-250','-650'])for(const market of ['',...Object.keys(marketLabels)]){
  const rows=rankContracts(lab.rows,{market,band,sort:method},stamp(lab.at));
  if(!rows.length)continue;
  const cards=rows.map(r=>({quoteId:r.id,gameId:r.gameId,playerId:r.playerId,statistic:r.market,metric:r.metric,period:r.period,side:r.side,
   line:r.line,odds:r.odds,book:'FanDuel',ot:r.ot,start:r.start,captured:r.captured,expires:r.expires,
   score:r[method],n:r.n,original:comparableOriginal(r,originals,lab.at)}));
  const payload={version:'NBA_SHEET_LAB_V1',method,band,scope:market||'general',cards};
  const snapshot_id=createHash('sha256').update(JSON.stringify([lab.date,payload])).digest('hex');
  snapshots.push({snapshot_id,day_local:lab.date,expires_at:new Date(Math.min(...cards.map(c=>stamp(c.expires)))).toISOString(),payload});
 }
 return snapshots;
}
const metricFor={points:'pts',rebounds:'reb',assists:'ast',threes:'fg3m',points_rebounds_assists:'pra',points_rebounds:'pr',points_assists:'pa',rebounds_assists:'ra'};
export function settleContract(c,{context,final,pbp,voidReceipt},registeredAt){
 const pending={result:'pending',value:null};
 if(!Number.isFinite(stamp(registeredAt))||!(stamp(c.captured)<=stamp(registeredAt)&&stamp(registeredAt)<stamp(c.start)&&stamp(registeredAt)<stamp(c.expires)))return pending;
 if(voidReceipt?.quoteId&&voidReceipt.quoteId===c.quoteId&&voidReceipt.book===c.book&&voidReceipt.status==='VOID'&&stamp(voidReceipt.at)>=stamp(registeredAt))return {result:'void',value:null};
 const verified=verifiedArchivedPlayerFinal({context,final,providerGameId:c.gameId,allowPartialComponents:true});
 if(!verified||stamp(final.datetime)!==stamp(c.start)||!['over','under'].includes(c.side)||!Number.isFinite(c.line))return pending;
 const rows=context.player_stats.data,raw=rows.find(r=>r.player.id===c.playerId);
 if(!raw)return pending;
 if(minutesValue(String(raw.min))===0)return ['pts','reb','ast','fg3m','stl','blk','turnover'].every(k=>raw[k]==null||Number(raw[k])===0)?{result:'dnp',value:null}:pending;
 if(c.book!=='FanDuel'||!metricFor[c.statistic]||c.ot==='NOT_VERIFIED'||!['FT','Q1','Q2','Q3','Q4','1H','2H','OT'].includes(c.period))return pending;
 const expected=['FT','2H'].includes(c.period)?'INCLUDES_OT':'EXCLUDES_OT';
 if(c.period!=='OT'&&c.ot!==expected)return pending;
 let values=raw;
 if(c.period!=='FT'){
  if(!pbp||pbp.provider_game_id!==c.gameId||!(stamp(pbp.captured_at)>stamp(c.start))||!Array.isArray(pbp.payload?.data)||!pbp.payload.data.every(e=>e.game_id===c.gameId))return pending;
  const s=reconcilePeriods(raw.game,rows,pbp.payload.data)[c.playerId]?.[c.period];
  if(!s)return pending;values=segmentValues(s);
 }
 const value=playerValues(values)[metricFor[c.statistic]];
 if(!Number.isFinite(value))return pending;
 return {value,result:value===c.line?'push':(c.side==='over'?value>c.line:value<c.line)?'win':'loss'};
}
export function gradeSnapshot(snapshot,evidence){
 return snapshot.payload.cards.map(c=>{
  const data=evidence.get(c.gameId)??{},grade=settleContract(c,data,snapshot.captured_at);
  const original=c.original?settleContract({...c,side:c.original.side,quoteId:c.original.quoteId},data,snapshot.captured_at):null;
  return {snapshot_id:snapshot.snapshot_id,quote_id:c.quoteId,...grade,pick_result:original?.result??null};
 });
}
