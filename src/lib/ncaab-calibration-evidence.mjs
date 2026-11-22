// Evidence helpers only. These do not calculate or promote a prediction.
import {createHash} from 'node:crypto';

export function ncaabEvidenceTime(value){
 if(typeof value!=='string')return null;
 // Require an explicit offset and a real calendar date. Date.parse alone accepts
 // ambiguous local times and normalizes impossible dates such as February 30.
 const m=/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(Z|[+-]\d{2}(?::?\d{2})?)$/.exec(value);
 if(!m)return null;
 const [year,month,day,hour,minute,second]=m.slice(1,7).map(x=>Number(x??0));
 const date=new Date(Date.UTC(year,month-1,day));
 if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||
  date.getUTCDate()!==day||hour>23||minute>59||second>59)return null;
 const at=Date.parse(value);return Number.isFinite(at)?at:null;
}
export const ncaabTeamId=x=>typeof x==='string'&&/^\d{1,12}$/.test(x);
export const ncaabEventId=x=>typeof x==='string'&&/^espn:\d{6,15}$/.test(x);
export const ncaabHash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
export function ncaabCanonicalDigest(value){
 const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?
  Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
 return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}
// Preserve the original byte-level JSON order and timestamp representation.
// Legacy ledger hashes must never be replaced with the canonical evidence hash.
export const ncaabLegacyDigest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
// Quarantine every occurrence of a duplicate event, independent of input order.
// A Map constructed directly from rows silently selected the last original.
export function ncaabUniqueEventIndex(rows){
 const unique=new Map(),duplicates=new Set();
 for(const row of rows){
  const id=row?.event_id;if(!ncaabEventId(id)||duplicates.has(id))continue;
  if(unique.has(id)){unique.delete(id);duplicates.add(id);}
  else unique.set(id,row);
 }
 return {unique,duplicates};
}
export function ncaabWinnerMatchesProbability(body){
 const p=body?.home_win_probability;
 return typeof p==='number'&&Number.isFinite(p)&&p!==.5&&
  body?.predicted_winner===(p>.5?body?.home_id:body?.away_id);
}
