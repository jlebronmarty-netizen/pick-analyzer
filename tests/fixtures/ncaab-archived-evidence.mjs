// Synthetic identities and prices. No production receipt is committed.
export const archiveAsOf = '2026-11-21T20:00:00Z';
export const archiveDate = '2026-11-21';
export function archiveForecast() {
  return {event_id:'espn:1234',home_id:'11',away_id:'22',home_name:'Synthetic Home',away_name:'Synthetic Away',
    scheduled_at:'2026-11-22T00:30:00Z',created_at:'2026-11-21T18:00:00Z',state:'FORECAST',
    predicted_winner:'11',home_win_probability:.6,away_win_probability:.4,
    home_score:76,away_score:70,projected_margin:6,projected_total:146,
    reason:null,settlement:null,review_required:false};
}
export function archiveReceipt() {
  return {id:'synthetic-receipt',captured_at:'2026-11-21T17:55:00Z',
    source_url:'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates=20261121&groups=50&limit=1000',
    body:{events:[{id:'1234',date:'2026-11-22T00:30:00Z',competitions:[{
      id:'1234',date:'2026-11-22T00:30:00Z',timeValid:true,neutralSite:true,
      status:{type:{state:'pre',name:'STATUS_SCHEDULED',completed:false}},
      competitors:[{id:'11',homeAway:'home',team:{id:'11'}},{id:'22',homeAway:'away',team:{id:'22'}}],
      odds:[{provider:{name:'Draft Kings'},homeTeamOdds:{team:{id:'11'}},awayTeamOdds:{team:{id:'22'}},
        moneyline:{home:{close:{odds:'-140'}},away:{close:{odds:'+120'}}},
        pointSpread:{home:{close:{line:'-3.5',odds:'-110'}},away:{close:{line:'+3.5',odds:'-110'}}},
        total:{over:{close:{line:'o147.5',odds:'-105'}},under:{close:{line:'u147.5',odds:'-115'}}},
      }],
    }]}]}};
}
