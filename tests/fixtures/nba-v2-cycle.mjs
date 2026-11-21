import {readFileSync} from 'node:fs';
export const model=JSON.parse(readFileSync('docs/research/nba-v2/model.json'));
export const at='2026-11-22T15:35:10.000Z',tip='2026-11-23T01:00:00.000Z';
export function makeBoard(){
 const gameId=999050,quoteAt='2026-11-22T15:30:00Z',capturedAt='2026-11-22T15:30:30Z';
 const quality={status:'VALIDATED',issues:[],book:'FanDuel',providerUpdatedAt:quoteAt,expiresAt:tip,overtimeRule:'NOT_VERIFIED'};
 const row={gameId,id:'a',quoteId:'A',selection:'Over',market:'total',period:'q1',line:55.5,odds:-110,capturedAt,
  dataQuality:quality,quoteFreshness:'RECENT',sample:10,projection:57.12,startsAt:tip,historyKey:'h',source:'HoopsAPI'};
 const h={cutoff:at,status:'VALIDATED',issues:[],required:10,included:Array.from({length:10},(_,id)=>({id,date:'2026-11-20T00:00:00Z'}))};
 return {asOf:at,day:'2026-11-22',games:[{id:gameId,startsAt:tip,status:'scheduled',home:'H',away:'A'}],
  rows:{periods:[row,{...row,id:'b',quoteId:'B',selection:'Under',odds:-105},{...row,id:'x',dataQuality:{status:'INCOMPLETE_HISTORY'}}]},
  historyEvidence:{h:{home:h,away:h}}};
}
