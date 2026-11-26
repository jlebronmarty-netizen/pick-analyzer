// Freeze only an original already stored by Pick before the same cutoff.
export async function readSheetOriginals(db,lab){
 const ids=[...new Set(lab.rows.map(r=>r.gameId))];
 if(!ids.length)return [];
 const originals=[];
 for(let offset=0;;offset+=500){
  const {data,error}=await db.from('nba_decision_shadow_forecasts_v1')
   .select('forecast_id,quote_id,game_id,player_id,game_start_at,market,period,statistic,side,line,quote_captured_at,decision_at,inserted_at,evidence')
   .eq('model_version','NBA_DECISION_BOARD_SHADOW_V1').eq('market','props').in('game_id',ids).lte('inserted_at',lab.at)
   .order('forecast_id').range(offset,offset+499);
  if(error)throw Error('SHADOW_ARCHIVE_READ_FAILED');
  for(const f of data){
   const quality=f.evidence?.quality;
   originals.push({id:f.forecast_id,quoteId:f.quote_id,gameId:f.game_id,playerId:f.player_id,start:f.game_start_at,market:f.market,period:f.period,statistic:f.statistic,side:f.side,line:f.line,
    captured:f.quote_captured_at,decisionAt:f.decision_at,recordedAt:f.inserted_at,book:quality?.book,
    ot:({INCLUDES_OVERTIME:'INCLUDES_OT',EXCLUDES_OVERTIME:'EXCLUDES_OT'})[quality?.overtimeRule]??'NOT_VERIFIED'});
  }
  if(data.length<500)return originals;
 }
}
