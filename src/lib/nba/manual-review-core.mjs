// Descriptive analysis and independent manual prediction grading only.
// No sportsbook settlement, model writes, or provider calls.
const stamp=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))?Date.parse(v):null;
const number=v=>typeof v==='number'&&Number.isFinite(v);
const score=v=>Number.isSafeInteger(v)&&v>=0;
const id=v=>/^[0-9]+$/.test(String(v));
export function validManualPrediction(p){
 return !!p&&typeof p.id==='string'&&id(p.gameId)&&typeof p.home==='string'&&typeof p.away==='string'&&p.home!==p.away&&
 stamp(p.recordedAt)!==null&&stamp(p.scheduledAt)!==null&&stamp(p.recordedAt)<stamp(p.scheduledAt)&&
 (p.market==='moneyline'&&['home','away'].includes(p.side)&&p.line===null||
 p.market==='spread'&&['home','away'].includes(p.side)&&number(p.line)&&Math.abs(p.line)<=100&&Number.isInteger(p.line*2)||
 p.market==='total'&&['over','under'].includes(p.side)&&number(p.line)&&p.line>0&&p.line<=500&&Number.isInteger(p.line*2));
}
export function createManualPrediction(fixture,selection,recordedAt,recordId){
 const p={id:recordId,gameId:String(fixture?.id),home:fixture?.home?.name,away:fixture?.away?.name,scheduledAt:fixture?.scheduledAt,recordedAt,market:selection?.market,side:selection?.side,line:selection?.market==='moneyline'?null:selection?.line};
 if(fixture?.state!=='scheduled'||!validManualPrediction(p))return null;
 return p;
}
export function gradeManualPrediction(p,finals){
 if(!validManualPrediction(p)||!Array.isArray(finals))return 'PENDING';
 const candidates=finals.filter(f=>String(f?.gameId)===p.gameId);
 if(candidates.length!==1)return 'PENDING';
 const f=candidates[0],h=f.homeScore,a=f.awayScore;
 if(f.home!==p.home||f.away!==p.away||stamp(f.scheduledAt)!==stamp(p.scheduledAt)||!score(h)||!score(a)||h===a)return 'PENDING';
 let margin;
 if(p.market==='moneyline')margin=p.side==='home'?h-a:a-h;
 else if(p.market==='spread')margin=(p.side==='home'?h-a:a-h)+p.line;
 else margin=p.side==='over'?h+a-p.line:p.line-h-a;
 return margin>0?'WIN':margin<0?'LOSS':'PUSH';
}
export function summarizeManualAccuracy(predictions,finals){
 const counts={wins:0,losses:0,pushes:0,pending:0,accuracy:null};
 for(const p of predictions){const g=gradeManualPrediction(p,finals);if(g==='WIN')counts.wins++;else if(g==='LOSS')counts.losses++;else if(g==='PUSH')counts.pushes++;else counts.pending++;}
 counts.accuracy=counts.wins+counts.losses?counts.wins/(counts.wins+counts.losses):null;
 return counts;
}
export function recentTeamSummary(team){
 const games=Array.isArray(team?.recent)?team.recent.filter(g=>score(g.pointsFor)&&score(g.pointsAgainst)&&g.pointsFor!==g.pointsAgainst):[];
 const n=games.length;
 const wins=games.filter(g=>g.pointsFor>g.pointsAgainst).length;
 const pointsFor=n?games.reduce((s,g)=>s+g.pointsFor,0)/n:null;
 const pointsAgainst=n?games.reduce((s,g)=>s+g.pointsAgainst,0)/n:null;
 return {n,wins,losses:n-wins,pointsFor,pointsAgainst,margin:n?pointsFor-pointsAgainst:null,sequenceVerified:team?.sequenceVerified===true};
}
