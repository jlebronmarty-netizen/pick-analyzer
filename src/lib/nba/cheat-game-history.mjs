const fields={points:'pts',rebounds:'reb',assists:'ast',threes:'fg3m'};

// Match the exact game IDs that contributed to the displayed projection.
export function projectionHistories(board,input){
  const output={};
  const targetGames=new Map(input.scheduleGames.map(g=>[g.id,g]));
  const finals=new Map(input.calendar.games.filter(({game,capturedAt})=>
    game.status_state==='final' && !game.postponed && Date.parse(capturedAt)<=Date.parse(input.asOf)
  ).map(({game})=>[game.id,game]));
  const players=new Map();
  for(const row of input.playerHistory){
    if(!players.has(row.player_id))players.set(row.player_id,new Map());
    const games=players.get(row.player_id);
    games.set(row.provider_game_id,games.has(row.provider_game_id)?null:row);
  }
  for(const r of board.rows.props){
    if(output[r.historyKey] || !Number.isFinite(r.projection) || !Object.hasOwn(fields,r.statistic))continue;
    const data=players.get(r.playerId),target=targetGames.get(r.gameId);
    const included=board.historyEvidence[r.historyKey]?.player?.included??[];
    if(!data || !target || included.length!==10)continue;
    const team=data.get(included[0].id)?.team_id;
    const opponent=team===target.home_team.id?target.visitor_team:team===target.visitor_team.id?target.home_team:null;
    if(!opponent)continue;
    function point(row){
      const game=row && finals.get(row.provider_game_id),value=row?.[fields[r.statistic]];
      if(!game || game.season!==target.season || game.postseason!==target.postseason ||
        Date.parse(game.datetime)!==Date.parse(row.game_datetime) || Date.parse(game.datetime)>=Date.parse(target.datetime) ||
        row.team_id===row.opponent_team_id || !Number.isInteger(value) || value<0 || !(row.minutes_played>0))return null;
      const teams=[game.home_team,game.visitor_team],opp=teams.find(t=>t.id===row.opponent_team_id);
      if(!opp || !teams.some(t=>t.id===row.team_id))return null;
      return {id:game.id,date:game.datetime,rival:opp.abbreviation??opp.full_name??String(opp.id),value};
    }
    const trend=included.map(({id})=>point(data.get(id)));
    const meetings=[...data.values()].filter(row=>row?.opponent_team_id===opponent.id)
      .map(point).filter(Boolean).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)).slice(0,10);
    output[r.historyKey]={trend:trend.every(Boolean)?trend:[],meetings,rival:opponent.full_name};
  }
  return output;
}
