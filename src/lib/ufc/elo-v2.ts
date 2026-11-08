export const UFC_MODEL='UFC_ELO_K32_FREE_V2_IDENTITY' as const;
export type Rating={name:string;elo:number;decisive:number;lastDate:string};
export type BoutFact={id:string;event:string;date:string;a:string;b:string;result:'A'|'B'|'DRAW'|'NC'};
export const fighterKey=(s:string)=>s.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g,'');
export const eloProbability=(a:number,b:number)=>1/(1+10**((b-a)/400));
export function predictElo(ratings:Map<string,Rating>,a:string,b:string){
 const ak=fighterKey(a),bk=fighterKey(b),ra=ratings.get(ak),rb=ratings.get(bk);
 if(!ak||!bk||ak===bk||!ra||!rb||ra.decisive<3||rb.decisive<3)return null;
 const p=eloProbability(ra.elo,rb.elo);return {probabilityA:p,probabilityB:1-p,eloA:ra.elo,eloB:rb.elo,priorA:ra.decisive,priorB:rb.decisive,lastDateA:ra.lastDate,lastDateB:rb.lastDate};
}
// Apply an entire date as one batch. No bout can consume another result on that date.
export function updateEloDate(ratings:Map<string,Rating>,bouts:BoutFact[],k=32){
 if(new Set(bouts.map(b=>b.date)).size>1)throw Error('UFC_NOT_ONE_DATE');
 const changes=new Map<string,{name:string;delta:number;n:number;date:string}>();
 const ids=new Set<string>();
 for(const b of bouts){
  if(ids.has(b.id))throw Error('UFC_DUPLICATE_BOUT');ids.add(b.id);
  if(b.result==='NC')continue;
  const a=fighterKey(b.a),c=fighterKey(b.b);if(!a||!c||a===c)throw Error('UFC_FIGHTER_IDENTITY');
  const ra=ratings.get(a),rb=ratings.get(c);if([ra,rb].some(r=>r&&r.lastDate>=b.date))throw Error('UFC_NON_CHRONOLOGICAL');
  const p=eloProbability(ra?.elo??1500,rb?.elo??1500),score=b.result==='A'?1:b.result==='B'?0:.5,delta=k*(score-p),n=b.result==='DRAW'?0:1;
  for(const [id,name,d] of [[a,b.a,delta],[c,b.b,-delta]] as const){const old=changes.get(id);changes.set(id,{name,delta:(old?.delta??0)+d,n:(old?.n??0)+n,date:b.date});}
 }
 for(const [id,c] of changes){const old=ratings.get(id);ratings.set(id,{name:c.name,elo:(old?.elo??1500)+c.delta,decisive:(old?.decisive??0)+c.n,lastDate:c.date});}
}
export function buildElo(bouts:BoutFact[],k=32){
 const ratings=new Map<string,Rating>(),dates=new Map<string,BoutFact[]>();
 for(const b of bouts)dates.set(b.date,[...(dates.get(b.date)??[]),b]);
 for(const date of [...dates.keys()].sort())updateEloDate(ratings,dates.get(date)!,k);return ratings;
}
