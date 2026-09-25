import fs from 'node:fs/promises'
const TARGET_DATE='2026-09-25'
const THRESHOLD=0.05
const MIN_PRIOR_GAMES=10
const INPUT='artifacts/research/mlb_hrrbi_u0p5_forward_targets_20260925.json'
const OUTPUT=process.env.HRRBI_FORWARD_RESULT_PATH || '/tmp/mlb_hrrbi_u0p5_forward_20260925.json'
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms))
async function fetchLog(playerId){
  const url=new URL(`https://statsapi.mlb.com/api/v1/people/${playerId}/stats`)
  url.searchParams.set('stats','gameLog');url.searchParams.set('group','hitting');url.searchParams.set('season','2026')
  let last
  for(let attempt=0;attempt<3;attempt++){
    try{
      const res=await fetch(url,{headers:{'User-Agent':'PickAnalyzerResearch/1.0'}})
      if(!res.ok) throw new Error(`HTTP_${res.status}`)
      const payload=await res.json()
      const splits=(payload?.stats||[]).flatMap(x=>Array.isArray(x?.splits)?x.splits:[])
      return splits.flatMap((split)=>{
        const gamePk=Number(split?.game?.gamePk); const date=typeof split?.date==='string'?split.date.slice(0,10):''
        if(!gamePk||!date||date>=TARGET_DATE) return []
        const st=split?.stat||{}
        return [{gamePk,date,plateAppearances:Number(st.plateAppearances||0),hits:Number(st.hits||0),runs:Number(st.runs||0),rbi:Number(st.rbi||0)}]
      }).sort((a,b)=>a.date.localeCompare(b.date)||a.gamePk-b.gamePk)
    }catch(e){last=e;await sleep(250*(attempt+1))}
  }
  throw last
}
function projection(rows){
  if(rows.length<MIN_PRIOR_GAMES) return null
  const priorPa=rows.reduce((s,r)=>s+r.plateAppearances,0); if(priorPa<=0) return null
  const recent=rows.slice(-10); const recentPaPerGame=recent.reduce((s,r)=>s+r.plateAppearances,0)/recent.length
  const comp=(key)=>{const priorY=rows.reduce((s,r)=>s+r[key],0);const recentY=recent.reduce((s,r)=>s+r[key],0)/recent.length;const priorRate=priorY/priorPa;return {priorY,priorRate,recentPerGame:recentY,projected:0.50*(priorRate*recentPaPerGame)+0.50*recentY}}
  const hits=comp('hits'),runs=comp('runs'),rbi=comp('rbi')
  return {predicted:hits.projected+runs.projected+rbi.projected,priorGames:rows.length,priorPa,recentPaPerGame,latestPriorDate:rows.at(-1)?.date??null,hits,runs,rbi}
}
async function mapLimit(items,limit,fn){const out=new Array(items.length);let next=0;async function worker(){for(;;){const i=next++;if(i>=items.length)return;out[i]=await fn(items[i],i)}}await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));return out}
const input=JSON.parse(await fs.readFile(INPUT,'utf8'))
const results=await mapLimit(input.targets,8,async(target)=>{try{const rows=await fetchLog(target.playerId);const p=projection(rows);return {...target,evaluable:Boolean(p),qualifies:Boolean(p&&p.predicted<=THRESHOLD),projection:p?.predicted??null,featureSnapshot:p,blocker:p?null:'MINIMUM_10_PRIOR_GAMES_OR_PA_NOT_MET'}}catch(e){return {...target,evaluable:false,qualifies:false,projection:null,featureSnapshot:null,blocker:String(e?.message||e).slice(0,180)}}})
const evaluable=results.filter(x=>x.evaluable),qualifiers=results.filter(x=>x.qualifies)
const output={contract:'MLB_BATTER_HRRBI_U0P5_FORWARD_SHADOW_V1/1.0.0',targetDate:TARGET_DATE,researchOnly:true,productionEligible:false,officialPicksModified:false,apostarActivated:false,threshold:THRESHOLD,exactLine:0.5,side:'UNDER',sourceRule:'game_date < target_date',targetRows:results.length,evaluableRows:evaluable.length,qualifierRows:qualifiers.length,results,qualifiers,pricePolicy:{calculateEv:false},generatedAt:new Date().toISOString()}
await fs.writeFile(OUTPUT,JSON.stringify(output,null,2)+'\n')
console.log(JSON.stringify({success:true,targetRows:results.length,evaluableRows:evaluable.length,qualifierRows:qualifiers.length,qualifiers:qualifiers.map(x=>({playerName:x.playerName,gamePk:x.gamePk,projection:x.projection,sportsbook:x.sportsbook,price:x.price}))},null,2))
