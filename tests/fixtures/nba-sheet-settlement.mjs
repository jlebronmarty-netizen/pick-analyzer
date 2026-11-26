// Synthetic final with two independently reconciled team scores.
export function evidence(start,received){
 const final={id:1,date:start.slice(0,10),datetime:start,status_state:'final',
  home_team_id:1,visitor_team_id:2,home_team_score:10,visitor_team_score:5};
 const rows=Array.from({length:10},(_,i)=>{
  const team=i<5?1:2;
  return {game:final,team:{id:team},player:{id:i+1,team_id:team},min:'12:00',
   pts:team===1?2:1,reb:4,ast:3,fg3m:0};
 });
 return {final,context:{provider_game_id:1,player_stats_captured_at:received,player_stats:{data:rows}}};
}
