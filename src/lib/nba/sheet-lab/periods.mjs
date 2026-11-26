// Same event roles as V13's nba-period.sql. Fail closed per game, then per player/metric.
const fields=['pts','reb','ast','fg3m','stl','blk','turnover'];
const integer=v=>Number.isSafeInteger(v)&&v>=0;
export function reconcilePeriods(game,players,events){
 const count=game.period;
 if(!integer(count)||count<4||count>7||!Array.isArray(events)||!events.length)return {};
 const ordered=[...events].sort((a,b)=>a.order-b.order);
 if(ordered.some((e,i)=>!integer(e.order)||!integer(e.period)||e.period<1||e.period>count||i&&ordered[i-1].order===e.order))return {};
 const last=ordered.at(-1),ends=ordered.filter(e=>e.type==='End Period');
 if(ordered.filter(e=>e.type==='End Game').length!==Number(last.type==='End Game'))return {};
 if(ends.length!==count||last.period!==count||!['End Game','End Period'].includes(last.type)||
   last.type==='End Period'&&!['0.0','0:00','00:00'].includes(last.clock)||
   last.home_score!==game.home_team_score||last.away_score!==game.visitor_team_score)return {};
 let home=0,away=0;
 for(let i=1;i<=count;i++){
  const suffix=i<5?'q'+i:'ot'+(i-4),h=game['home_'+suffix],a=game['visitor_'+suffix];
  if(!integer(h)||!integer(a))return {};
  home+=h;away+=a;
  if(ends[i-1].period!==i||ends[i-1].home_score!==home||ends[i-1].away_score!==away)return {};
 }
 if(home!==last.home_score||away!==last.away_score)return {};
 const byPlayer=new Map();
 for(const e of ordered){
  const t=(e.text??'').toLowerCase(),points=e.scoring_play===true?e.score_value:0;
  if(!integer(points))return {};
  if(e.participants!=null&&!Array.isArray(e.participants))return {};
  for(const [idx,id] of (e.participants??[]).entries()){
   if(!byPlayer.has(id))byPlayer.set(id,new Map());
   const periods=byPlayer.get(id),r=periods.get(e.period)??{v:Array(7).fill(0),active:false};
   if(idx===0){r.v[0]+=points;r.v[3]+=Number(points===3);r.v[1]+=Number(['Offensive Rebound','Defensive Rebound'].includes(e.type)&&!t.includes('team rebound'));r.v[6]+=Number(t.includes('turnover'));}
   if(idx===1){r.v[2]+=Number(points>0&&t.includes('assists)'));r.v[4]+=Number(t.includes('steals)'));r.v[5]+=Number(t.includes(' blocks '));}
   r.active ||= points>0||['Substitution','Jumpball','Defensive Rebound','Offensive Rebound'].includes(e.type)||t.includes('misses ')||t.includes(' blocks ');
   periods.set(e.period,r);
  }
 }
 const out={};
 for(const p of players){
  const rows=byPlayer.get(p.player.id);if(!rows||!parseFloat(String(p.min).replace(':','.')))continue;
  const sum=(rs,j)=>rs.reduce((a,r)=>a+r.v[j],0),valid=fields.map((k,j)=>integer(p[k])&&sum([...rows.values()],j)===p[k]);
  if(!valid.some(Boolean))continue;
  const segments={Q1:[1],Q2:[2],Q3:[3],Q4:[4],'1H':[1,2],'2H':Array.from({length:count-2},(_,i)=>i+3),OT:Array.from({length:count-4},(_,i)=>i+5)};
  out[p.player.id]={};
  for(const [k,period] of Object.entries(segments)){
   const rs=period.map(i=>rows.get(i)).filter(Boolean);
   if(rs.some(r=>r.active))out[p.player.id][k]=valid.map((v,j)=>v?sum(rs,j):null);
  }
 }
 return out;
}
