import {projectedPeriod} from '../../../src/lib/nba/decision-board-core.mjs';
import {impliedProbability} from '../../../src/lib/nba/decision-probability-v2.mjs';

const sum=xs=>xs.reduce((a,b)=>a+b,0);
const mean=xs=>sum(xs)/xs.length;
const validStat=n=>Number.isSafeInteger(n)&&n>=0;
const sides={moneyline:['home','away'],spread:['home','away'],total:['over','under']};
const key=(...values)=>JSON.stringify(values);
function index(rows,fn) {
  const groups=new Map();
  for(const r of rows){const k=fn(r); if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);}
  return groups;
}
export function verifiedPrices(prices,pairs,byGame) {
  const archive=index(pairs,p=>key(p[1],p[2],p[4],p[5]));
  const groups=index(prices,p=>key(p[0],p[1]));
  const usable=new Map(), reasons={};
  const skip=k=>{reasons[k]=(reasons[k]??0)+1;};
  for(const entries of groups.values()) {
    if(entries.length!==1){skip('DUPLICATE_BINDING');continue;}
    const [game,market,sel,home,away,line,odds,at,cut,settled]=entries[0];
    const g=byGame.get(game);
    if (!g || cut!==g[2]-3600 || at>cut || cut-at>21600){skip('PRICE_OUTSIDE_6H_WINDOW_OR_CUTOFF');continue;}
    // Reconcile the same two teams in order, same original snapshot, certified side and price.
    // Provider tip times may differ; reject any ambiguity and use the earlier of the two starts.
    const list=(archive.get(key(home,away,at,market))??[]).filter(r=>
      Math.abs(r[3]-g[2])<=15*60 && cut<=Math.min(r[3],g[2])-3600);
    if(list.length!==1 || list[0][6].length!==2){skip('MISSING_UNIQUE_ORIGINAL_PAIR');continue;}
    const pair=list[0][6], labels=market==='total'?['Over','Under']:[home,away];
    const [a,b]=labels.map(label=>pair.find(r=>r[0]===label));
    const selected=pair.find(r=>r[0]===sel);
    if (!a||!b||!selected||selected[1]!==line||selected[2]!==odds ||
        !impliedProbability(a[2])||!impliedProbability(b[2])||
        (market==='moneyline'?(a[1]!==null||b[1]!==null):
          !Number.isSafeInteger(2*a[1])||a[1]===null||b[1]===null||b[1]!== (market==='total'?a[1]:-a[1]))) {
      skip('CONTRACT_OR_PRICE_MISMATCH');continue;
    }
    const y=market==='total'?g[5]+g[6]:g[5]-g[6];
    const threshold=market==='moneyline'?0:market==='total'?a[1]:-a[1];
    const delta=(y-threshold)*(sel===labels[0]?1:-1);
    if ((delta===0?'push':delta>0?'win':'loss')!==settled){skip('SETTLEMENT_DISPUTE');continue;}
    const p=impliedProbability(a[2]),q=impliedProbability(b[2]);
    usable.set(key(game,market),{line:threshold,odds:a[2],book:p/(p+q),exactTip:list[0][3]===g[2],side:sides[market][0]});
  }
  return {usable,reasons};
}
export function buildSamples(games,players,prices,pairs) {
  const byGame=new Map(games.map(g=>[g[0],g]));
  if(byGame.size!==games.length)throw Error('DUPLICATE_GAME');
  const books=verifiedPrices(prices,pairs,byGame);
  const playerRows=index(players,p=>p[0]);
  const teamNames=[...new Set(games.flatMap(g=>g.slice(3,5)))];
  const periods=['ft','q1','q2','q3','q4','h1','h2'];
  const samples=[],teams=new Map(),playerPast=new Map(),diagnostics={};
  const count=k=>{diagnostics[k]=(diagnostics[k]??0)+1;};
  for(const [game,season,tip,home,away,h,a,qh,qa] of games.toSorted((a,b)=>a[2]-b[2])) {
    const cutoff=tip-3600;
    // Archive contains final scores but no original final-receipt timestamps. This is reconstruction only.
    const prior=(map,id)=>(map.get(key(season,id))??[]).slice(-10);
    const append=(map,id,r)=>{const k=key(season,id); if(!map.has(k))map.set(k,[]);map.get(k).push(r);};
    const ok=validStat(h)&&validStat(a)&&h!==a&&qh?.length===4&&qa?.length===4&&
      [...qh,...qa].every(validStat)&&sum(qh)<=h&&sum(qa)<=a&&
      ((sum(qh)===h && sum(qa)===a)||sum(qh)===sum(qa));
    const hId=teamNames.indexOf(home),aId=teamNames.indexOf(away);
    const target={datetime:new Date(tip*1000).toISOString(),home_team:{id:hId},visitor_team:{id:aId}};
    const windows=[prior(teams,home),prior(teams,away)];
    if(ok && windows.every(w=>w.length===10 && w.every(x=>x.ok && x.t/1000+28800<=cutoff))) {
      const history=[...new Map(windows.flat().map(r=>[r.id,r])).values()];
      for(const period of periods) {
        const proj=projectedPeriod(target,history,period);
        const emit=(scope,mu,y,line,market)=>samples.push({game,season,tip,scope,mu,y,line,
          price:books.usable.get(key(game,market))??null});
        if(period==='ft'){
          emit('moneyline',proj.margin,h-a,0,'moneyline');
          emit('spread',proj.margin,h-a,3.5,'spread');
          emit('total',proj.total,h+a,219.5,'total');
        }else{
          const scores=qh.map((n,i)=>n+qa[i]);
          const y=period==='h1'?scores[0]+scores[1]:period==='h2'?h+a-scores[0]-scores[1]:scores[Number(period[1])-1];
          emit('total_'+period,proj.total,y,period.startsWith('h')?109.5:54.5,null);
        }
      }
    }else count('teamGameWithoutUsableWindowOrResult');
    const original={id:game,t:tip*1000,ok,home:hId,away:aId,qh,qa,ho:ok?h-sum(qh):null,ao:ok?a-sum(qa):null};
    append(teams,home,original);append(teams,away,original);
    for(const entries of index(playerRows.get(game)??[],r=>r[1]).values()) {
      const [,id,team,mins,ast]=entries[0];
      if(entries.length===1 && mins===0){count('dnp');continue;}
      const w=prior(playerPast,id);
      const good=entries.length===1 && [home,away].includes(team) && Number.isFinite(mins)&&mins>0&&validStat(ast);
      if(good && w.length===10 && w.at(-1).team===team && w.every(x=>x.good && x.tip+28800<=cutoff)) {
        const values=w.map(x=>x.ast);
        samples.push({game,season,tip,scope:'props_assists',mu:Number((.65*mean(values.slice(-5))+.35*mean(values)).toFixed(2)),
          y:ast,line:4.5,price:null});
      }
      // Ten-minute rule applies to prior features. A short appearance today still settles the forecast.
      if(!good || mins>=10)append(playerPast,id,{good,tip,team,ast});
    }
  }
  return {samples,coverage:{archivedGames:games.length,playerBoxRows:players.length,certifiedPriceBindings:prices.length,
    originalPairGroups:pairs.length,verifiedBindings:books.usable.size,priceExclusions:books.reasons,...diagnostics}};
}
