import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const TARGET = '2026-09-17';
const CUTOFF = '2026-09-16';
const MLB = 'https://statsapi.mlb.com/api/v1';
const BDL = 'https://api.balldontlie.io/mlb/v1';

function norm(s: unknown) {
  return String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\b(jr|ii|iii|iv)\b$/, '').trim();
}
function implied(o: number) { return o > 0 ? 100 / (o + 100) : Math.abs(o) / (Math.abs(o) + 100); }
function profit(o: number) { return o > 0 ? o / 100 : 100 / Math.abs(o); }
function mean(a: number[]) { return a.length ? a.reduce((x,y)=>x+y,0)/a.length : 0; }
function sd(a: number[]) { if (a.length < 2) return 0; const m=mean(a); return Math.sqrt(a.reduce((s,x)=>s+(x-m)*(x-m),0)/(a.length-1)); }
function erf(x: number) {
  const sign=x<0?-1:1; x=Math.abs(x);
  const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911;
  const t=1/(1+p*x); const y=1-(((((a5*t+a4)*t)+a3)*t+a2)*t+a1)*t*Math.exp(-x*x); return sign*y;
}
function ncdf(x: number) { return 0.5*(1+erf(x/Math.SQRT2)); }
function poissonCdf(k: number, lambda: number) { let p=Math.exp(-lambda),sum=p; for(let i=1;i<=k;i++){p*=lambda/i;sum+=p;} return Math.min(1,sum); }
function americanToEv(p: number, odds: number) { return p*profit(odds)-(1-p); }

async function fj(url: string, init?: RequestInit) {
  const r=await fetch(url,{...init,cache:'no-store'}); if(!r.ok) throw new Error(`${r.status} ${url} ${await r.text()}`); return r.json();
}

function metricFromHitStat(s: any) {
  const hits=Number(s.hits??0), doubles=Number(s.doubles??0), triples=Number(s.triples??0), hr=Number(s.homeRuns??0);
  const singles=Math.max(0,hits-doubles-triples-hr);
  const runs=Number(s.runs??0), rbi=Number(s.rbi??0);
  return { hits, total_bases:Number(s.totalBases??(singles+2*doubles+3*triples+4*hr)), home_runs:hr, walks:Number(s.baseOnBalls??0), runs, rbis:rbi, hits_runs_rbis:hits+runs+rbi, stolen_bases:Number(s.stolenBases??0), singles, doubles, triples };
}
function metricFromPitchStat(s: any) {
  const ip=String(s.inningsPitched??'0'); const [whole,frac='0']=ip.split('.'); const outs=Number(whole)*3+(frac==='1'?1:frac==='2'?2:0);
  return { pitcher_strikeouts:Number(s.strikeOuts??0), pitcher_outs:outs, pitcher_walks:Number(s.baseOnBalls??0), pitcher_hits_allowed:Number(s.hits??0), pitcher_earned_runs:Number(s.earnedRuns??0) };
}
function canonicalPropType(x: string) {
  const s=x.toLowerCase();
  const map: Record<string,string>={
    hits:'hits', total_bases:'total_bases', home_runs:'home_runs', walks:'walks', runs:'runs', rbis:'rbis',
    hits_runs_rbis:'hits_runs_rbis', stolen_bases:'stolen_bases', singles:'singles', doubles:'doubles', triples:'triples',
    pitcher_strikeouts:'pitcher_strikeouts', strikeouts:'pitcher_strikeouts', pitcher_outs:'pitcher_outs', outs:'pitcher_outs',
    pitcher_walks:'pitcher_walks', pitcher_hits_allowed:'pitcher_hits_allowed', hits_allowed:'pitcher_hits_allowed',
    pitcher_earned_runs:'pitcher_earned_runs', earned_runs:'pitcher_earned_runs'
  }; return map[s]??s;
}
function probability(values: number[], line: number, side: 'Over'|'Under', projection: number, metric: string) {
  if (!values.length) return null;
  const recent=values.slice(-10); let pOver=0;
  const lowFreq=['home_runs','stolen_bases','doubles','triples','singles','walks','rbis','runs'].includes(metric);
  if (lowFreq) {
    const k=Math.floor(line); pOver=1-poissonCdf(k,Math.max(0.01,projection));
  } else {
    const sigma=Math.max(metric==='pitcher_outs'?2.2:1.0, 0.65*sd(values)+0.35*sd(recent));
    pOver=1-ncdf((line-projection)/sigma);
  }
  return side==='Over'?pOver:1-pOver;
}

export async function GET() {
  try {
    const oddsKey=process.env.THE_ODDS_API_KEY;
    const bdlKey=process.env.BALLDONTLIE_API_KEY;
    if (!oddsKey || !bdlKey) return NextResponse.json({error:'missing server env'}, {status:500});
    const bdlHeaders={Authorization:bdlKey};

    const [today,yesterday,roster] = await Promise.all([
      fj(`${MLB}/schedule?sportId=1&date=${TARGET}&hydrate=probablePitcher,linescore`),
      fj(`${MLB}/schedule?sportId=1&date=${CUTOFF}&hydrate=probablePitcher,linescore`),
      fj(`${MLB}/sports/1/players?season=2026`),
    ]);

    const oddsUrl=new URL('https://api.the-odds-api.com/v4/sports/baseball_mlb/odds');
    oddsUrl.searchParams.set('apiKey',oddsKey); oddsUrl.searchParams.set('regions','us'); oddsUrl.searchParams.set('markets','h2h,spreads,totals'); oddsUrl.searchParams.set('bookmakers','fanduel,williamhill_us'); oddsUrl.searchParams.set('oddsFormat','american'); oddsUrl.searchParams.set('dateFormat','iso');
    const coreOdds=await fj(oddsUrl.toString());

    const bg=await fj(`${BDL}/games?dates[]=${TARGET}&per_page=100`,{headers:bdlHeaders});
    const bdlGames=bg.data??[];
    const props:any[]=[];
    for (const g of bdlGames) {
      const u=new URL(`${BDL}/odds/player_props`); u.searchParams.set('game_id',String(g.id)); u.searchParams.append('vendors[]','fanduel'); u.searchParams.append('vendors[]','caesars');
      const p=await fj(u.toString(),{headers:bdlHeaders});
      for (const row of p.data??[]) if (row.market?.type==='over_under') props.push({...row,_game_id:g.id});
    }

    const ids=[...new Set(props.map(x=>x.player_id).filter(Boolean))];
    const players:any[]=[];
    for(let i=0;i<ids.length;i+=80){ const u=new URL(`${BDL}/players`); u.searchParams.set('per_page','100'); for(const id of ids.slice(i,i+80))u.searchParams.append('player_ids[]',String(id)); const p=await fj(u.toString(),{headers:bdlHeaders}); players.push(...(p.data??[])); }
    const bdlById=new Map(players.map(p=>[p.id,p]));
    const byName=new Map<string,any>();
    for(const p of roster.people??[]){ for(const n of [p.fullName,p.firstLastName,p.nameFirstLast,`${p.useName??p.firstName??''} ${p.useLastName??p.lastName??''}`]){const k=norm(n);if(k&&!byName.has(k))byName.set(k,p);} }

    const mapping=new Map<number,any>(); const mlbIds=new Set<number>();
    for(const id of ids){ const bp=bdlById.get(id); let mp=bp?byName.get(norm(bp.full_name)):null; if(mp){mapping.set(id,mp);mlbIds.add(mp.id);} }
    const todayGames=(today.dates??[]).flatMap((d:any)=>d.games??[]);
    for(const g of todayGames) for(const side of ['away','home']){const id=g.teams?.[side]?.probablePitcher?.id;if(id)mlbIds.add(id);}

    async function logs(group:string){ const out:Record<string,any>={}; const arr=[...mlbIds]; for(let i=0;i<arr.length;i+=20){const u=new URL(`${MLB}/people`);u.searchParams.set('personIds',arr.slice(i,i+20).join(','));u.searchParams.set('hydrate',`stats(group=[${group}],type=[gameLog],season=2026)`);const p=await fj(u.toString());for(const person of p.people??[]){const block=(person.stats??[]).find((x:any)=>x.type?.displayName==='gameLog'&&x.group?.displayName===group);out[person.id]={name:person.fullName,splits:(block?.splits??[]).filter((x:any)=>x.gameType==='R'&&x.date<=CUTOFF)};}}return out; }
    const [hitLogs,pitchLogs]=await Promise.all([logs('hitting'),logs('pitching')]);

    const evaluated:any[]=[];
    for(const pr of props){
      const bp=bdlById.get(pr.player_id); const mp=mapping.get(pr.player_id); if(!bp||!mp) continue;
      const metric=canonicalPropType(pr.prop_type); const source=metric.startsWith('pitcher_')?pitchLogs[mp.id]:hitLogs[mp.id]; if(!source) continue;
      const vals:number[]=[];
      for(const sp of source.splits??[]){const obj=metric.startsWith('pitcher_')?metricFromPitchStat(sp.stat??{}):metricFromHitStat(sp.stat??{}); if(metric in obj) vals.push(Number((obj as any)[metric]));}
      if(!vals.length) continue;
      const l5=mean(vals.slice(-5)),l10=mean(vals.slice(-10)),season=mean(vals),n=vals.length;
      const weight5=n>=10?0.5:0.25, weight10=n>=10?0.3:0.25, weightS=1-weight5-weight10; const proj=weight5*l5+weight10*l10+weightS*season;
      const q=n>=80?0.86:n>=40?0.78:n>=20?0.70:0.58;
      const line=Number(pr.line_value); const overOdds=Number(pr.market?.over_odds), underOdds=Number(pr.market?.under_odds); if(!Number.isFinite(line)||!Number.isFinite(overOdds)||!Number.isFinite(underOdds))continue;
      const io=implied(overOdds),iu=implied(underOdds),den=io+iu;
      for(const side of ['Over','Under'] as const){const odds=side==='Over'?overOdds:underOdds;const marketP=(side==='Over'?io:iu)/den;const p=probability(vals,line,side,proj,metric);if(p==null)continue;const edge=p-marketP;const ev=americanToEv(p,odds);evaluated.push({game_id:pr.game_id,player_id:pr.player_id,player:bp.full_name,team:bp.team?.display_name??null,vendor:pr.vendor,prop_type:metric,line,side,odds,proj,diff:side==='Over'?proj-line:line-proj,p,market_p:marketP,edge,ev,l5,l10,season,n,quality:q,updated_at:pr.updated_at});}
    }

    const starters:any[]=[];
    for(const g of todayGames){for(const side of ['away','home']){const p=g.teams?.[side]?.probablePitcher;if(!p?.id)continue;const splits=pitchLogs[p.id]?.splits??[];const starts=splits.filter((x:any)=>Number(x.stat?.gamesStarted??0)>0);const k=starts.reduce((a:number,x:any)=>a+Number(x.stat?.strikeOuts??0),0),bb=starts.reduce((a:number,x:any)=>a+Number(x.stat?.baseOnBalls??0),0),er=starts.reduce((a:number,x:any)=>a+Number(x.stat?.earnedRuns??0),0),outs=starts.reduce((a:number,x:any)=>{const ip=String(x.stat?.inningsPitched??'0').split('.');return a+Number(ip[0])*3+(ip[1]==='1'?1:ip[1]==='2'?2:0)},0);const ip=outs/3;starters.push({id:p.id,name:p.fullName,side,gamePk:g.gamePk,starts:starts.length,era:ip?9*er/ip:null,k9:ip?9*k/ip:null,bb9:ip?9*bb/ip:null,logs:starts.map((x:any)=>({date:x.date,opp:x.opponent?.name??null,isWin:x.isWin??null,stat:x.stat}))});}}

    return NextResponse.json({date:TARGET,cutoff:CUTOFF,generated_at:new Date().toISOString(),today_games:todayGames,yesterday_games:(yesterday.dates??[]).flatMap((d:any)=>d.games??[]),core_odds:coreOdds,bdl_games:bdlGames,evaluated_props:evaluated,starters});
  } catch (e:any) { return NextResponse.json({error:String(e?.message??e)}, {status:500}); }
}
