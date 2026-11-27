const keys=['pts','reb','ast','fg3m','stl','blk','turnover'];
const timestamp=x=>Date.parse(x);
const available=(at,cut)=>Number.isFinite(timestamp(at))&&timestamp(at)<=timestamp(cut);
export function minutesValue(raw){
 if(typeof raw!=='string'||!/^\d+(?::[0-5]\d)?$/.test(raw))return null;
 const [minutes,seconds='0']=raw.split(':');return Number(minutes)+Number(seconds)/60;
}
export function segmentValues(values){
 return Object.fromEntries(keys.map((key,i)=>[key,Number.isFinite(values?.[i])?values[i]:null]));
}
export function enrichEvidence(d,archive){
 if(!archive)return d;
 const finals=new Map(d.finals.map(f=>[String(f.gameId),f])),players=new Map(d.players.map(p=>[String(p.playerId),{...p,recent:[...p.recent,...(p.earlierAppearances??[])],earlierAppearances:[]}]));
 const periods=[...(d.periods??[])];
 for(const g of archive.schedule){
  const f=g.final;
  if(!f||!available(g.at,d.readAt)||!d.date||new Intl.DateTimeFormat('en-CA',{timeZone:'America/Puerto_Rico'}).format(new Date(g.start))>=d.date||finals.has(g.id))continue;
  const ot=side=>Object.values(f[side+'Overtime']??{});
  const valid=['home','away'].every(side=>{
   const q=f[side+'Quarters'];if(!Array.isArray(q)||q.length!==4)return false;
   const scores=[...q,...ot(side)];
   return scores.every(x=>Number.isInteger(x)&&x>=0)&&scores.reduce((sum,x)=>sum+x,0)===f[side+'Score'];
  });
  if(!valid||f.homeScore===f.awayScore)continue;
  finals.set(g.id,{gameId:g.id,scheduledAt:g.start,home:g.home,away:g.away,homeScore:f.homeScore,awayScore:f.awayScore});
  periods.push({...f,id:'bdl_nba_'+g.id,date:g.start,home:g.home,away:g.away,homeOvertime:ot('home'),awayOvertime:ot('away')});
 }
 const evidence={}, boxGames=new Set();
 for(const game of archive.games){
  const final=finals.get(game.id);
  if(!final||!available(game.at,d.readAt)||timestamp(game.start)!==timestamp(final.scheduledAt)||game.scores[0]!==final.homeScore||game.scores[1]!==final.awayScore)continue;
  boxGames.add(game.id);
  for(const [id,team,raw,...values] of game.players){
   const p=players.get(String(id));if(!p)continue;
   const minutes=minutesValue(raw),stats=segmentValues(values),verified=available(game.periodAt,d.readAt)?game.periods[id]:null;
   const rows=evidence[id]??={};const old=p.recent.find(g=>String(g.gameId)===game.id);
   const conflict=old&&(Number(old.teamId)!==Number(team)||keys.some(k=>Number.isFinite(old[k])&&Number.isFinite(stats[k])&&old[k]!==stats[k])||(old.minutes_played>0&&minutes===0));
   rows[game.id]={state:conflict?'Conflicto':minutes>0?'Jugó':minutes===0&&keys.every(k=>stats[k]===0)?'DNP · 0 min registrados':'Participación sin confirmar',periods:conflict?null:verified};
   if(conflict){p.recent=p.recent.filter(r=>String(r.gameId)!==game.id);continue;}
   if(minutes>0){
    if(!old)p.recent.push({gameId:game.id,date:game.start,teamId:Number(team),opponentId:Number(team)===game.home?game.away:game.home,minutes_played:minutes,...stats});
    else for(const k of keys)if(old[k]==null&&stats[k]!=null){const i=p.recent.indexOf(old);p.recent[i]={...p.recent[i],[k]:stats[k]};}
   }
  }
 }
 return {...d,finals:[...finals.values()],periods,players:[...players.values()],evidence,boxGames:[...boxGames],archiveSchedule:archive.schedule.filter(g=>available(g.at,d.readAt)&&timestamp(g.start)<timestamp(d.readAt))};
}
export function periodRows(history,report,id,period){
 if(period==='FT')return history;
 return history.map(g=>({...g,...segmentValues(report.evidence?.[id]?.[g.gameId]?.periods?.[period]),minutes_played:null}));
}
export function auditRows(report,m,history,limit){
 if(!m.t?.id)return [];
 const team=m.t.name,prior=new Map();
 for(const g of report.finals)if([g.home,g.away].includes(team))prior.set(String(g.gameId),{id:String(g.gameId),start:g.scheduledAt});
 for(const g of report.archiveSchedule??[])if([g.home,g.away].includes(team)&&new Intl.DateTimeFormat('en-CA',{timeZone:'America/Puerto_Rico'}).format(new Date(g.start))<report.date&&!prior.has(g.id))prior.set(g.id,g);
 return [...prior.values()].sort((a,b)=>timestamp(b.start)-timestamp(a.start)).slice(0,limit).map(g=>{
  const r=history.find(r=>String(r.gameId)===g.id),proof=report.evidence?.[m.playerId]?.[g.id];
  return {...g,state:proof?.state??(r?'Jugó':report.boxGames?.includes(g.id)?'Sin fila individual':'Sin evidencia individual'),missing:r?keys.filter(k=>!Number.isFinite(r[k])).join(', '):null};
 });
}
export function originalFor(p,originals){
 if(!available(p.recordedAt,p.scheduledAt)||timestamp(p.recordedAt)===timestamp(p.scheduledAt))return null;
 const period=({FT:'ft','1H':'h1','2H':'h2'})[p.period??'FT']??p.period.toLowerCase();
 const canonical=(market,side,line)=>market==='spread'&&side==='away'?-line:line;
 return originals.find(o=>o.gameId===String(p.gameId)&&timestamp(o.scheduledAt)===timestamp(p.scheduledAt)&&available(o.recordedAt,p.recordedAt)&&available(o.decisionAt,p.recordedAt)&&o.period===period&&
 o.market===(p.market==='ml'?'moneyline':p.market)&&(o.statistic??null)===(p.statistic??null)&&String(o.playerId??'')===String(p.playerId??'')&&canonical(o.market,o.side,o.line)===canonical(p.market,p.side,p.line))??null;
}

export function pairedSummary(records){
 const groups=new Map(),conditions=new Map();
 const decided=value=>value==='Acierto'||value==='Fallo';
 function count(map,label,record){
  const row=map.get(label)??{n:0,manual:0,pick:0};
  row.n++;row.manual+=Number(record.result==='Acierto');row.pick+=Number(record.original.result==='Acierto');map.set(label,row);
 }
 let paired=0,unmatched=0,unresolved=0;
 for(const record of records){
  if(!record.original){unmatched++;continue;}
  if(!decided(record.result)||!decided(record.original.result)){unresolved++;continue;}
  paired++;
  const label=[record.market,record.period??'FT',record.statistic??'Equipo'].join(' · ');
  count(groups,label,record);
  for(const [name,state] of Object.entries(record.conditions??{})){
   count(conditions,[label,name,state==null?'Sin evidencia':state?'Cumple':'No cumple'].join(' · '),record);
  }
 }
 return {paired,unmatched,unresolved,groups,conditions};
}
