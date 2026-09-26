#!/usr/bin/env node
import fs from 'node:fs/promises'

const INPUT='artifacts/research/mlb_ml_opening_consensus_forward_20260926.json'
const OUTPUT=process.env.MLB_ML_FORWARD_SETTLEMENT_OUT || '/tmp/mlb_ml_opening_consensus_forward_settlement_20260926.json'

async function feed(gamePk){
  const r=await fetch(`https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`,{
    headers:{'User-Agent':'PickAnalyzerResearch/1.0'},
    signal:AbortSignal.timeout(15000),
  })
  if(!r.ok) throw new Error(`MLB_GAME_FEED_HTTP_${r.status}`)
  return r.json()
}

const ledger=JSON.parse(await fs.readFile(INPUT,'utf8'))
const results=[]
for(const c of ledger.candidates){
  try{
    const f=await feed(c.game_pk)
    const abstract=String(f?.gameData?.status?.abstractGameState??'')
    const detailed=String(f?.gameData?.status?.detailedState??'')
    const isFinal=abstract.toLowerCase()==='final'||detailed.toLowerCase()==='final'
    if(!isFinal){
      results.push({...c,settlement_status:'PENDING_GAME_NOT_FINAL',result:null,actual_winner:null,game_status:{abstract,detailed}})
      continue
    }
    const home=String(f?.gameData?.teams?.home?.abbreviation??'').toUpperCase()
    const away=String(f?.gameData?.teams?.away?.abbreviation??'').toUpperCase()
    const homeRuns=Number(f?.liveData?.linescore?.teams?.home?.runs)
    const awayRuns=Number(f?.liveData?.linescore?.teams?.away?.runs)
    if(!home||!away||!Number.isFinite(homeRuns)||!Number.isFinite(awayRuns)||homeRuns===awayRuns){
      results.push({...c,settlement_status:'BLOCKED_FINAL_SCORE_MISSING',result:null,actual_winner:null,game_status:{abstract,detailed}})
      continue
    }
    const actualWinner=homeRuns>awayRuns?home:away
    results.push({
      ...c,
      settlement_status:'SETTLED',
      actual_winner:actualWinner,
      final_score:{home_team:home,away_team:away,home_runs:homeRuns,away_runs:awayRuns},
      result:actualWinner===c.pick?'WIN':'LOSS',
      game_status:{abstract,detailed},
    })
  }catch(e){
    results.push({...c,settlement_status:'BLOCKED_FEED_ERROR',result:null,actual_winner:null,error:String(e?.message||e)})
  }
}
const settled=results.filter(x=>x.settlement_status==='SETTLED')
const wins=settled.filter(x=>x.result==='WIN').length
const output={
  contract:'MLB_ML_OPENING_CONSENSUS_FORWARD_SETTLEMENT_20260926/1.0.0',
  researchOnly:true,
  candidateCount:results.length,
  settledCount:settled.length,
  wins,
  losses:settled.length-wins,
  accuracy:settled.length?wins/settled.length:null,
  results,
  boundaries:{formulaRetuned:false,openingPricesReplaced:false,officialPicksModified:false,apostarActivated:false},
  generatedAt:new Date().toISOString(),
}
await fs.writeFile(OUTPUT,JSON.stringify(output,null,2)+'\n')
console.log(JSON.stringify({
  success:true,
  candidateCount:output.candidateCount,
  settledCount:output.settledCount,
  wins:output.wins,
  losses:output.losses,
  rows:results.map(x=>({evidence_id:x.evidence_id,pick:x.pick,status:x.settlement_status,result:x.result,actual_winner:x.actual_winner}))
},null,2))
