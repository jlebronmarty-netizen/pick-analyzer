import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import {createMlbOfficialLiveClient,createTheOddsApiLiveClient,createStatcastLiveClient} from './mlb-data-02r-r2i-live-execution-interfaces.mjs'
const checks=[]
for(const provider of ['MLB_OFFICIAL','THE_ODDS_API','STATCAST']) {
  for(const rejected of [false,true]) {
    let resolve,reject,fetchCalls=0,reservations=0
    const pending=new Promise((yes,no)=>{resolve=yes;reject=no})
    const ledger={consume:async actual=>{assert.equal(actual,provider);reservations++;await pending}}
    const fetchImpl=async()=>{fetchCalls++;return {ok:true,json:async()=>({dates:[]})}}
    let execution
    if(provider==='MLB_OFFICIAL')execution=createMlbOfficialLiveClient({ledger,fetchImpl}).getSchedule({runDate:'2026-09-09'})
    else if(provider==='THE_ODDS_API')execution=createTheOddsApiLiveClient({ledger,fetchImpl,apiKey:'ISOLATED_TEST_VALUE'}).getMoneylineOdds()
    else execution=createStatcastLiveClient({ledger,fetchImpl,cacheDir:path.join(os.tmpdir(),'unused-r6-test-cache'),fetchRowsForGames:async({fetchImpl:counted})=>counted('https://baseballsavant.mlb.com/isolated-test')}).fetchRowsForGames({})
    assert.equal(reservations,1);assert.equal(fetchCalls,0)
    if(rejected){reject(Error('DURABLE_RESERVATION_REJECTED'));await assert.rejects(execution,/DURABLE_RESERVATION_REJECTED/);assert.equal(fetchCalls,0)}
    else{resolve();await execution;assert.equal(fetchCalls,1)}
    checks.push({provider,reservation:rejected?'REJECTED':'COMMITTED',fetchCalls,status:'PASS'})
  }
}
console.log(JSON.stringify({status:'PASS',checks,realProviderCalls:0,productionDml:0,productionDdl:0}))
