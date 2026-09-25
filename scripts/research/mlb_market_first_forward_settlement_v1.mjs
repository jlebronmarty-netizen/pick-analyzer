#!/usr/bin/env node
import fs from 'node:fs/promises'

const INPUT='artifacts/research/mlb_market_first_forward_ledger_v1_20260925.json'
const OUTPUT=process.env.MLB_FORWARD_SETTLEMENT_OUT || '/tmp/mlb_market_first_forward_settlement_20260925.json'

function finite(v){const n=Number(v);return Number.isFinite(n)?n:null}

async function gameFeed(gamePk){
  const url=`https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`
  const r=await fetch(url,{headers:{'User-Agent':'PickAnalyzerResearch/1.0'},signal:AbortSignal.timeout(15000)})
  if(!r.ok) throw new Error(`MLB_GAME_FEED_HTTP_${r.status}:${gamePk}`)
  return r.json()
}

function battingStat(feed,playerId){
  const key=`ID${playerId}`
  const home=feed?.liveData?.boxscore?.teams?.home?.players?.[key]
  const away=feed?.liveData?.boxscore?.teams?.away?.players?.[key]
  const p=home??away
  const b=p?.stats?.batting
  if(!b) return null
  const hits=finite(b.hits)??0
  const doubles=finite(b.doubles)??0
  const triples=finite(b.triples)??0
  const homeRuns=finite(b.homeRuns)??0
  const runs=finite(b.runs)??0
  const rbi=finite(b.rbi)??0
  const singles=Math.max(0,hits-doubles-triples-homeRuns)
  const totalBases=singles+2*doubles+3*triples+4*homeRuns
  const hrrbi=hits+runs+rbi
  return {hits,doubles,triples,homeRuns,runs,rbi,singles,totalBases,hrrbi}
}

const ledger=JSON.parse(await fs.readFile(INPUT,'utf8'))
const feeds=new Map()
const results=[]
for(const candidate of ledger.candidates){
  let feed=feeds.get(candidate.game_pk)
  if(!feed){
    try{feed=await gameFeed(candidate.game_pk);feeds.set(candidate.game_pk,feed)}
    catch(e){
      results.push({...candidate,settlement_status:'BLOCKED_FEED_ERROR',result:null,error:String(e?.message||e)})
      continue
    }
  }
  const abstract=String(feed?.gameData?.status?.abstractGameState??'')
  const detailed=String(feed?.gameData?.status?.detailedState??'')
  const isFinal=abstract.toLowerCase()==='final' || detailed.toLowerCase()==='final'
  if(!isFinal){
    results.push({...candidate,settlement_status:'PENDING_GAME_NOT_FINAL',game_status:{abstract,detailed},result:null})
    continue
  }
  const stat=battingStat(feed,candidate.player_mlbam_id)
  if(!stat){
    results.push({...candidate,settlement_status:'BLOCKED_PLAYER_BOX_SCORE_MISSING',game_status:{abstract,detailed},result:null})
    continue
  }
  let actual=null
  if(candidate.market==='batter_total_bases') actual=stat.totalBases
  else if(candidate.market==='batter_hits_runs_rbis') actual=stat.hrrbi
  else {
    results.push({...candidate,settlement_status:'BLOCKED_UNSUPPORTED_MARKET',game_status:{abstract,detailed},result:null})
    continue
  }
  const won=candidate.side==='UNDER'
    ? actual < Number(candidate.line)
    : candidate.side==='OVER'
      ? actual > Number(candidate.line)
      : null
  results.push({
    ...candidate,
    settlement_status:won===null?'BLOCKED_UNSUPPORTED_SIDE':'SETTLED',
    game_status:{abstract,detailed},
    actual,
    box_score:stat,
    result:won===null?null:(won?'WIN':'LOSS')
  })
}

const settled=results.filter(x=>x.settlement_status==='SETTLED')
const wins=settled.filter(x=>x.result==='WIN').length
const losses=settled.filter(x=>x.result==='LOSS').length
const output={
  contract:'MLB_MARKET_FIRST_FORWARD_SETTLEMENT_V1/1.0.0',
  trackingDate:ledger.tracking_date,
  researchOnly:true,
  source:'MLB Official live game feed / final boxscore',
  candidateCount:results.length,
  settledCount:settled.length,
  pendingCount:results.filter(x=>x.settlement_status==='PENDING_GAME_NOT_FINAL').length,
  wins,losses,
  accuracy:settled.length?wins/settled.length:null,
  results,
  generatedAt:new Date().toISOString(),
  boundaries:{
    modelRecomputed:false,
    frozenPricesReplaced:false,
    officialPicksModified:false,
    apostarActivated:false
  }
}
await fs.writeFile(OUTPUT,JSON.stringify(output,null,2)+'\n')
console.log(JSON.stringify({
  success:true,
  candidateCount:output.candidateCount,
  settledCount:output.settledCount,
  pendingCount:output.pendingCount,
  wins,losses,accuracy:output.accuracy,
  rows:results.map(x=>({evidence_id:x.evidence_id,player:x.player_name,market:x.market,status:x.settlement_status,result:x.result,actual:x.actual??null}))
},null,2))
