// Research-only NCAAF dispute evidence classifier.
// Never re-settles immutable outcomes; strictly identifies manual review candidates.
const ms=v=>{const t=Date.parse(String(v??''));return Number.isFinite(t)?t:null};
const result=(status,reason,details={})=>({status,reason,...details,
 gradeAllowed:false,databaseWriteAllowed:false,officialPick:false});
export function reviewNcaafDispute(forecast,finalSnapshots,{toleranceMinutes=120}={}){
 if(!Number.isInteger(toleranceMinutes)||toleranceMinutes<0||toleranceMinutes>120)throw Error('INVALID_REVIEW_TOLERANCE');
 const input=forecast?.payload?.input;
 const id=forecast?.event_id,at=ms(forecast?.emitted_at),tip=ms(forecast?.scheduled_at);
 if(forecast?.sport!=='NCAAF'||!/^espn:\d+$/.test(String(id??''))||at==null||tip==null||at>=tip||
    !input||input.event_id!==id||ms(input.scheduled_at)!==tip||!input.home_id||!input.away_id||
    input.home_id===input.away_id||typeof input.neutral_site!=='boolean')
    return result('REVIEW_REQUIRED','INVALID_FROZEN_FORECAST');
 if(!Array.isArray(finalSnapshots)||finalSnapshots.length<2)
   return result('REVIEW_REQUIRED','INSUFFICIENT_FINAL_SNAPSHOTS');
 const finals=finalSnapshots.filter(x=>x?.status==='FINAL');
 if(finals.length<2)return result('REVIEW_REQUIRED','INSUFFICIENT_FINAL_SNAPSHOTS');
 const signatures=new Set();
 for(const g of finals){
  const scoreH=g.home_score,scoreA=g.away_score,captured=ms(g.captured_at),start=ms(g.scheduled_at);
  if(g.event_id!==id||g.home_id!==input.home_id||g.away_id!==input.away_id||
     g.season!==input.season||g.neutral_site!==input.neutral_site||
     g.outcome_validation!=='PASS'||start==null||captured==null||
     captured<=start||captured<=at||!Number.isSafeInteger(scoreH)||!Number.isSafeInteger(scoreA)||
     scoreH<0||scoreA<0||scoreH===scoreA)
    return result('REVIEW_REQUIRED','FINAL_EVIDENCE_IDENTITY_OR_TIME_CONFLICT');
  signatures.add(JSON.stringify([start,scoreH,scoreA]));
 }
 if(signatures.size!==1)return result('REVIEW_REQUIRED','CONTRADICTORY_FINAL_SNAPSHOTS');
 if(new Set(finals.map(x=>x.captured_at)).size<2)
   return result('REVIEW_REQUIRED','NO_INDEPENDENT_CAPTURE_TIMES');
 const g=finals[0],diff=Math.abs(ms(g.scheduled_at)-tip),minutes=diff/60000;
 if(minutes>toleranceMinutes)return result('MANUAL_REVIEW','START_TIME_DRIFT_TOO_LARGE',{driftMinutes:minutes,consistentFinalCaptures:finals.length});
 return result('REVIEW_CANDIDATE','VERIFIED_SAME_EVENT_FINAL_WITH_TIME_CORRECTION',
   {driftMinutes:minutes,consistentFinalCaptures:finals.length});
}
