import {indexEvidence,playerWindow,marketQuality} from './decision-integrity.mjs';
import {latestUniqueQuotes} from './decision-board-core.mjs';
const fields={points:'pts',rebounds:'reb',assists:'ast',threes:'fg3m'};

export function buildCheatCandidates(input){
  const {asOf,scheduleGames,playerNames,goatPropQuotes}=input;
  const evidence=indexEvidence(input), cache=new Map(), cards=[];
  const games=new Map(scheduleGames.filter(g=>!g.postponed && g.status_state==='scheduled').map(g=>[g.id,g]));
  const quotes=latestUniqueQuotes(goatPropQuotes,q=>[q.provider_game_id,q.player_id,q.statistic,q.side,q.line,q.period].join('|'));
  for(const q of quotes){
    const game=games.get(q.provider_game_id), field=fields[q.statistic], id=q.player_id;
    if(!game || !field || !playerNames[id] || q.american_odds < -650 || q.line==null || Number(q.line)<0)continue;
    const key=[game.id,id,field].join('|');
    if(!cache.has(key)){
      const records=evidence.compact.get(id)??[];
      const byGame=new Map(records.map(r=>[r.provider_game_id,r]));
      const read=(required,opponentId=null)=>{
        const w=playerWindow(evidence,game,id,[field],undefined,{allMinutes:true,required,opponentId});
        if(w.issues.length || !['VALIDATED','INSUFFICIENT_SAMPLE'].includes(w.status))return [];
        return w.included.map(({id,date})=>{
          const r=byGame.get(id), prior=evidence.games.find(e=>e.game.id===id)?.game;
          const opponent=[prior?.home_team,prior?.visitor_team].find(t=>t?.id===r.opponent_team_id);
          return {id,date,team:r.team_id,rival:opponent?.abbreviation??String(r.opponent_team_id),minutes:r.minutes_played,value:r[field]};
        });
      };
      const ten=read(10), five=ten.length>=5?ten.slice(0,5):read(5);
      const team=five[0]?.team??ten[0]?.team??records.slice().sort((a,b)=>Date.parse(b.game_datetime)-Date.parse(a.game_datetime))[0]?.team_id;
      const opponent=[game.home_team,game.visitor_team].find(t=>t.id!==team);
      const h2h=opponent?read(10,opponent.id):[];
      cache.set(key,{ten:ten.length===10?ten:[],five:five.length===5?five:[],h2h,team});
    }
    const {ten,five,h2h,team}=cache.get(key);
    if(!five.length && h2h.length<5)continue;
    const quality=marketQuality(q,game,evidence,[{status:'VALIDATED',included:[{teamId:team}]}]);
    if(quality.status!=='VALIDATED' || Date.parse(quality.expiresAt)<=Date.parse(asOf))continue;
    cards.push({quoteId:q.quote_id,gameId:game.id,playerId:id,name:playerNames[id],market:q.statistic,
      line:Number(q.line),side:q.side,odds:q.american_odds,book:quality.book,updated:quality.providerUpdatedAt,expiresAt:quality.expiresAt,
      matchup:game.visitor_team.abbreviation+' @ '+game.home_team.abbreviation,start:game.datetime,ten,five,h2h});
  }
  return cards;
}

