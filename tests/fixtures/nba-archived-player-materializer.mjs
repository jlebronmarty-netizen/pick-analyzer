import {createHash} from 'node:crypto';

// Synthetic, complete two-team box. No provider fixture or current-game claim.
export function materializerFixture(id=700001,now='2026-11-23T00:00:00.000Z'){
 const at=new Date(now),tip=new Date(at.getTime()-30*3600000).toISOString();
 const captured=new Date(at.getTime()-20*3600000).toISOString();
 const game={id,date:tip.slice(0,10),datetime:tip,season:at.getUTCFullYear(),period:4,
  status:'Final',status_state:'final',postponed:false,home_team:{id:1},visitor_team:{id:2},
  home_team_id:1,visitor_team_id:2,home_team_score:100,visitor_team_score:90,
  home_q1:25,home_q2:25,home_q3:25,home_q4:25,visitor_q1:22,visitor_q2:23,visitor_q3:22,visitor_q4:23,
  home_ot1:null,home_ot2:null,home_ot3:null,visitor_ot1:null,visitor_ot2:null,visitor_ot3:null};
 const data=[];
 for(const team of [1,2])for(let i=0;i<6;i++)data.push({
  player:{id:id*100+team*10+i,team_id:team},team:{id:team},game:structuredClone(game),
  min:i===5?'0':'48:00',...Object.fromEntries(['pts','reb','ast','fg3m','stl','blk','turnover'].map(k=>[k,i===5?null:k==='pts'?(team===1?20:18):k==='fg3m'?1:2]))
 });
 const context={game_id:'bdl_nba_'+id,provider_game_id:id,provider:'balldontlie',source_version:'TEST_ARCHIVED_SOURCE',
  player_stats_captured_at:captured,player_stats:{data,meta:{next_cursor:null}}};
 const schedule={snapshot_id:createHash('sha256').update('test-final:'+id).digest('hex'),
  source_received_at:captured,recorded_at:captured,date_local:game.date,payload:{data:{games:[game]}}};
 return {context,schedule,asOf:at.toISOString()};
}
