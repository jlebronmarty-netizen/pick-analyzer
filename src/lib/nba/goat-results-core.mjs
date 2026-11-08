const finiteInt=v=>Number.isInteger(v)&&v>=0;
export function finalGamesFromSchedules(scheduleRows){
 if(!Array.isArray(scheduleRows))throw Error('NBA_GOAT_SCHEDULE_ROWS_INVALID');
 const map=new Map();
 for(const row of scheduleRows){
  const received=Date.parse(row?.source_received_at??'');if(!Number.isFinite(received))continue;
  const games=row?.payload?.data?.games;if(!Array.isArray(games))continue;
  for(const g of games){
   if(!Number.isSafeInteger(g?.id)||!Number.isFinite(Date.parse(g?.datetime??''))||!g?.home_team?.full_name||!g?.visitor_team?.full_name)continue;
   if(String(g.status_state??'').toLowerCase()!=='final'&&!/final/i.test(String(g.status??'')))continue;
   if(!finiteInt(g.home_team_score)||!finiteInt(g.visitor_team_score))continue;
   const old=map.get(g.id);if(!old||received>old.received)map.set(g.id,{game:g,received});
  }
 }
 return [...map.values()].map(x=>x.game).sort((a,b)=>Date.parse(a.datetime)-Date.parse(b.datetime)||a.id-b.id);
}
export function normalizedGameResult(game,event){
 const expected='bdl_nba_'+String(game?.id??'');
 if(!event||event.id!==expected||event.home_team!==game?.home_team?.full_name||event.away_team!==game?.visitor_team?.full_name)throw Error('NBA_GOAT_RESULT_IDENTITY_MISMATCH');
 if(String(game.status_state??'').toLowerCase()!=='final'&&!/final/i.test(String(game.status??'')))throw Error('NBA_GOAT_RESULT_NOT_FINAL');
 if(!finiteInt(game.home_team_score)||!finiteInt(game.visitor_team_score))throw Error('NBA_GOAT_RESULT_SCORE_INVALID');
 const home=game.home_team_score,away=game.visitor_team_score;
 return {eventId:event.id,homeScore:home,awayScore:away,winner:home===away?null:home>away?event.home_team:event.away_team,overtime:Number(game.period)>4||[game.home_ot1,game.home_ot2,game.home_ot3,game.visitor_ot1,game.visitor_ot2,game.visitor_ot3].some(v=>finiteInt(v)&&v>0),providerGameId:game.id,providerDatetime:game.datetime,postseason:game.postseason===true,istStage:game.ist_stage??null};
}
export function settleGoatContract(prediction,result){
 if(!prediction||!result)throw Error('NBA_GOAT_SETTLEMENT_INPUT_MISSING');
 const market=prediction.market,selection=String(prediction.team??prediction.selection??'').trim(),line=prediction.line;
 const home=String(result.homeTeam??''),away=String(result.awayTeam??''),hs=result.homeScore,as=result.awayScore;
 if(!finiteInt(hs)||!finiteInt(as)||!home||!away||hs===as)throw Error('NBA_GOAT_SETTLEMENT_FINAL_INVALID');
 if(market==='total'){
  if(!Number.isFinite(Number(line))||!['over','under'].includes(selection.toLowerCase()))throw Error('NBA_GOAT_SETTLEMENT_CONTRACT_INVALID');
  const total=hs+as,l=Number(line);if(total===l)return {outcome:'push',actual:total};
  const win=selection.toLowerCase()==='over'?total>l:total<l;return {outcome:win?'win':'loss',actual:total};
 }
 if(!['moneyline','spread'].includes(market)||![home,away].includes(selection))throw Error('NBA_GOAT_SETTLEMENT_CONTRACT_INVALID');
 const selected=selection===home?hs:as,opponent=selection===home?as:hs;
 if(market==='moneyline')return {outcome:selected>opponent?'win':'loss',actual:selected-opponent};
 if(!Number.isFinite(Number(line)))throw Error('NBA_GOAT_SETTLEMENT_CONTRACT_INVALID');
 const covered=selected+Number(line)-opponent;return {outcome:covered===0?'push':covered>0?'win':'loss',actual:covered};
}
