import {hasValidatedInputs} from '../data-quality/window.mjs';
// NBA Preferred Side V1: purely presentational, never changes the frozen forecast input.
// A lead is a research WATCH signal, never a calibrated probability, EV, official bet or guaranteed event.
export const NBA_PREFERRED_SIDE_VERSION='NBA_PREFERRED_SIDE_RESEARCH_VIEW_V1';
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const absLine=x=>finite(x)?Math.abs(x).toFixed(3):'ML';
const signed=(x,d=2)=>finite(x)?(x>=0?'+':'')+x.toFixed(d):'—';
const isSideOver=r=>r.selection==='Over'||String(r.label??'').endsWith(' OVER')||/ Over$/.test(r.label??'');
const isSideUnder=r=>r.selection==='Under'||String(r.label??'').endsWith(' UNDER')||/ Under$/.test(r.label??'');
function contractKey(r){
 // Alternate lines remain separate for team markets, but one preferred main prop line per player/stat.
 const base=[r.gameId,r.market,r.period];
 if(r.market==='props')return [...base,r.playerId??'UNKNOWN',r.statistic??'UNKNOWN'].join('|');
 if(r.market==='moneyline')return base.join('|');
 if(r.market==='spread')return [...base,absLine(r.line)].join('|');
 return [...base,finite(r.line)?r.line.toFixed(3):'MISSING'].join('|');
}
function marketScale(row){
 if(row.market==='props'){
  if(row.statistic==='threes')return .7;
  if(row.statistic==='assists'||row.statistic==='rebounds')return 1.6;
  return 3.3;
 }
 if(row.market==='moneyline')return row.period==='ft'?8:row.period==='h1'||row.period==='h2'?5:3.5;
 if(row.period==='ft')return row.market==='spread'?6:12;
 if(row.period==='h1'||row.period==='h2')return row.market==='spread'?4.5:9;
 return row.market==='spread'?3:6;
}
function minDifference(row){
 if(row.market==='moneyline')return row.period==='ft'?4:
   row.period==='h1'||row.period==='h2'?2.5:1.5;
 if(row.market==='props')return row.statistic==='threes'?.4:.65;
 if(row.period==='ft')return row.market==='spread'?1.25:1.75;
 if(row.period==='h1'||row.period==='h2')return row.market==='spread'?.8:1.5;
 return row.market==='spread'?.65:1;
}
function lineAligned(row,value){
 if(!finite(value)||!finite(row.line))return false;
 if(isSideOver(row))return value>row.line;
 if(isSideUnder(row))return value<row.line;
 return false;
}
function preferenceCandidate(r,asOf){
 const now=Date.parse(asOf);
 if(!Number.isFinite(now)||!hasValidatedInputs(r)||!Number.isFinite(Date.parse(r.startsAt??''))||
    now>=Date.parse(r.startsAt)-10*60000)return null;
 if(r.quoteFreshness!=='RECENT'||!finite(r.odds)||Math.abs(r.odds)<100||
    !finite(r.projection)||!Number.isInteger(r.sample)||r.sample<5||
    !r.quoteId||!['GOAT','HoopsAPI'].includes(r.source))return null;
 const magnitude=r.market==='moneyline'?r.projection:r.advantage;
 if(!finite(magnitude)||magnitude<minDifference(r))return null;
 // Fail closed when an archived line, projection and alleged advantage disagree.
 if(r.market==='spread'&&(!finite(r.line)||!finite(r.advantage)||
     Math.abs(r.advantage-(r.projection+r.line))>.25))return null;
 if(r.market!=='moneyline'&&r.market!=='spread'&&
    (!finite(r.line)||(!isSideOver(r)&&!isSideUnder(r))||
     Math.abs(r.advantage-(isSideOver(r)?r.projection-r.line:r.line-r.projection))>.25))return null;
 if(r.market==='props'){
  if(!Number.isSafeInteger(r.playerId)||!r.statistic||
      !finite(r.line)||(!isSideOver(r)&&!isSideUnder(r))||
      !r.playerName||r.playerName.startsWith('Jugador ID '))return null;
 }else if(r.market!=='moneyline'&&!finite(r.line))return null;
 // Only concrete, inspectable positives. Odds availability does not imply value or win probability.
 const conditions=[
  {id:'brecha',ok:true,label:r.market==='moneyline'?'Margen proyectado '+signed(magnitude)+' pts':
    'Brecha proyectada favorable '+signed(magnitude)+' pts'},
  {id:'muestra',ok:r.sample>=10,label:'Historial de '+r.sample+' juegos'},
  {id:'precio',ok:Math.abs(r.odds)<=300,label:'Cotización reciente no extrema'},
 ];
 if((r.market==='props'||r.market==='total')&&finite(r.line)&&finite(r.l5)&&finite(r.l10)){
  conditions.push({id:'tendencia',ok:lineAligned(r,r.l5)&&lineAligned(r,r.l10),
    label:'Promedios L5 y L10 del mismo lado de la línea'});
 }
 if(r.market==='props'){
  if(finite(r.hit5))conditions.push({id:'acierto5',ok:r.hit5>=3,
    label:'Historial L5 favorable '+r.hit5+'/5'});
  if(finite(r.hit10)&&r.sample>=8)conditions.push({id:'acierto10',ok:r.hit10>=Math.ceil(.6*r.sample),
    label:'Historial L10 favorable '+r.hit10+'/'+r.sample});
  if(finite(r.minutesL5)&&finite(r.minutesL10)&&r.minutesL10>0)
   conditions.push({id:'minutos',ok:r.minutesL5>=.85*r.minutesL10,
    label:'Minutos recientes estables'});
 }
 const positives=conditions.filter(x=>x.ok);
 const ratio=positives.length/conditions.length;
 const marginStrength=Math.max(0,Math.min(2.5,magnitude/marketScale(r)));
 // Score is a ranking index only; never convert it into an estimated hit probability.
 const sortIndex=+(positives.length*100+ratio*35+marginStrength*15+
   Math.min(12,r.sample)*.3+(r.market==='props'?(r.hit10??0)*.2:0)).toFixed(4);
 return {...r,classification:'VIGILAR',reason:'PREFERRED_SHADOW_SIDE_REQUIRES_CALIBRATION',
    preference:{version:NBA_PREFERRED_SIDE_VERSION,sortIndex,
      favorableCount:positives.length,conditionCount:conditions.length,
      favorableReasons:positives.map(x=>x.label),
      cautions:conditions.filter(x=>!x.ok).map(x=>x.label),
      numericGap:magnitude,modelProbability:null,expectedValue:null,
      evidenceScope:'DESCRIPTIVE_SHADOW_NOT_PROBABILITY',
      bookmakerExecutionVerified:false}};
}
function sortPreferred(a,b){
 return b.preference.sortIndex-a.preference.sortIndex||
   b.preference.favorableCount-a.preference.favorableCount||
   b.preference.numericGap-a.preference.numericGap||
   String(a.gameId).localeCompare(String(b.gameId))||
   String(a.id).localeCompare(String(b.id));
}
export function rankNbaPreferredSides(rows,asOf){
 if(!rows||typeof rows!=='object'||!Number.isFinite(Date.parse(asOf)))throw Error('PREFERRED_SIDES_INVALID_INPUT');
 const tabs=['ml','spread','total','props','periods'];
 const preferred=Object.fromEntries(tabs.map(t=>[t,[]]));
 const summary={evaluatedSides:0,eligibleSides:0,discardedSides:0,withNoPreferredContract:0,
   preferredByMarket:{},contractGroups:0};
 for(const tab of tabs){
  const candidates=Array.isArray(rows[tab])?rows[tab]:[];
  const grouped=new Map();
  for(const row of candidates){
   const key=contractKey(row);
   if(!grouped.has(key))grouped.set(key,[]);
   grouped.get(key).push(row);
  }
  summary.contractGroups+=grouped.size;
  for(const group of grouped.values()){
   summary.evaluatedSides+=group.length;
   const qualified=group.map(r=>preferenceCandidate(r,asOf)).filter(Boolean).sort(sortPreferred);
   summary.eligibleSides+=qualified.length;
   if(qualified.length)preferred[tab].push(qualified[0]);
   else summary.withNoPreferredContract++;
  }
  preferred[tab].sort(sortPreferred);
  summary.preferredByMarket[tab]=preferred[tab].length;
 }
 summary.discardedSides=summary.evaluatedSides-Object.values(preferred).reduce((n,a)=>n+a.length,0);
 // The Top 25 is a diverse shortlist, not an automatic claim of the 25 likeliest winning outcomes.
 const top25=shortlistNbaPreferred(Object.values(preferred).flat());
 return {version:NBA_PREFERRED_SIDE_VERSION,rows:preferred,top25,summary:{
  ...summary,shortlistSize:top25.length,notCalibrated:true,topIsNotWinProbabilityRanking:true}};
}

export function shortlistNbaPreferred(rows){
 const candidates=rows.slice().sort(sortPreferred);
 const gameCount=new Set(candidates.map(c=>String(c.gameId))).size;
 const allowedGame=Math.max(5,Math.ceil(25/Math.max(1,gameCount))+1);
 const top25=[];const byGame=new Map(),byTab=new Map();
 for(const row of candidates){
  if(top25.length>=25)break;
  const game=String(row.gameId),market=row.market==='props'?'props':row.period==='ft'?row.market:'periods';
  if((byGame.get(game)??0)>=allowedGame)continue;
  if(market==='props'&&(byTab.get(market)??0)>=13)continue;
  top25.push(row);
  byGame.set(game,(byGame.get(game)??0)+1);
  byTab.set(market,(byTab.get(market)??0)+1);
 }
 return top25;
}
