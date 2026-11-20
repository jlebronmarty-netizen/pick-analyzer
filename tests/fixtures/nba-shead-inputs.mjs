import {readFileSync} from 'node:fs';
const fixture=JSON.parse(readFileSync('tests/fixtures/nba-shead-20261120.json'));
export const id=1028038426, before='2026-11-20T23:00:00Z', after='2026-11-20T23:15:00Z';
export const target={...fixture.target,id:Number(fixture.target.id),season:2026,postseason:false,
  date:'2026-11-20',datetime:fixture.target.tip,home_team:fixture.target.home,visitor_team:fixture.target.away,status_state:'scheduled'};
export const q={...fixture.quote,source_received_at:new Date(fixture.quote.source_received_at).toISOString(),
  provider_updated_at:new Date(fixture.quote.provider_updated_at).toISOString()};
export function inputs(asOf=after) {
  const rows=[],manifests=[],games=[];
  for(const [gid,day,tip,home,away,min,ast,captured,materialized,hash] of fixture.games){
    rows.push({season:2026,player_id:id,team_id:28,opponent_team_id:home===28?away:home,
      provider_game_id:gid,game_datetime:tip,source_captured_at:captured,materialized_at:materialized,
      source_sha256:hash,minutes_played:min,ast});
    manifests.push({season:2026,provider_game_id:gid,source_captured_at:captured,response_sha256:hash});
    games.push({capturedAt:captured,game:{id:gid,season:2026,postseason:false,date:day,datetime:tip,status_state:'final',
      home_team:{id:home},visitor_team:{id:away}}});
  }
  return {asOf,scheduleGames:[target],goatPropQuotes:[q],playerHistory:rows,playerNames:{[id]:'Jamal Shead'},
    manifests,calendar:{games,issues:[]},contexts:[],pregame:null};
}
