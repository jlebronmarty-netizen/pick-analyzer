import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { summarizeQualifiedPlays, readQualifiedSnapshot, unavailableQualifiedReport } from '../../src/lib/qualified-plays.ts'
import QualifiedPlaysPanel from '../../src/components/dashboard/QualifiedPlaysPanel.tsx'
const at='2026-10-14T12:00:00Z'
const row=(id,extra={})=>({id,season:2026,season_phase:'POSTSEASON',engine:'PICK_ANALYZER',model_id:'test_model',contract_id:null,market:'batter_doubles',line:'0.5',direction:'UNDER',evidence_class:'POSTSEASON_SHADOW_DOMAIN_SHIFT_APPROVED_PROP_EXACT_LINE',result:'WIN',freeze_timestamp:'2026-10-13T16:00:00Z',scheduled_at:'2026-10-13T20:00:00Z',settled_at:at,updated_at:at,source_relation:'test_source',source_row_id:id,research_only:true,production_eligible:false,official_picks_eligible:false,apostar_enabled:false,...extra})
test('exact line, direction, model, contract, engine and season phase remain distinct',()=>{
 const data=[row('a'),row('b',{line:1.5}),row('c',{direction:'OVER'}),row('d',{model_id:'other'}),row('e',{contract_id:'other'}),row('f',{engine:'PICK_EDGE'}),row('g',{season_phase:'REGULAR_SEASON',evidence_class:'REGULAR_SEASON_FORWARD_APPROVED_PROP_EXACT_LINE'})]
 assert.equal(summarizeQualifiedPlays(data,at,at).groups.length,7)
})
test('W/L hit rate excludes OPEN, PUSH and VOID without pooling',()=>{
 const data=['WIN','LOSS',null,'PUSH','VOID'].map((result,i)=>row(String(i),{result,settled_at:result?at:null}))
 const r=summarizeQualifiedPlays(data,at,at);assert.equal(r.groups[0].accuracy,0.5);assert.equal(r.groups[0].observations,5);assert.equal(r.groups[0].open,1)
 assert.equal(summarizeQualifiedPlays([row('x',{result:null,settled_at:null})],at,at).groups[0].accuracy,null)
})
test('unsafe flags, duplicate source/id, missing settlement timestamp, wrong phase and late freezes fail closed',()=>{
 for(const invalid of [{production_eligible:true},{research_only:false},{official_picks_eligible:true},{apostar_enabled:true},{line:''},{result:'UNKNOWN'},{settled_at:null},{evidence_class:'REGULAR_SEASON_FORWARD'},{freeze_timestamp:'2026-10-13T20:00:00Z'}]) assert.throws(()=>summarizeQualifiedPlays([row('a',invalid)],at,at))
 assert.throws(()=>summarizeQualifiedPlays([row('a'),row('a')],at,at))
 assert.throws(()=>summarizeQualifiedPlays([row('a'),row('b',{source_row_id:'a'})],at,at))
})
test('snapshot pagination reads beyond 500 and matches complete count',async()=>{
 const data=Array.from({length:815},(_,i)=>row(String(i).padStart(4,'0')))
 const cursors=[];const report=await readQualifiedSnapshot(async()=>({count:815,updatedAt:at}),async(after)=>{cursors.push(after);return data.filter(r=>after===null||r.id>after).slice(0,500)})
 assert.equal(report.status,'AVAILABLE');assert.equal(report.observations,815);assert.deepEqual(cursors,[null,'0499'])
})
test('changed watermark/count, duplicate cursor and partial reads cannot publish partial metrics',async()=>{
 let n=0
 const changed=await readQualifiedSnapshot(async()=>({count:1,updatedAt:n++? '2026-10-14T13:00:00Z':at}),async()=>[row('a')])
 assert.equal(changed.status,'UNAVAILABLE');assert.equal(changed.observations,null)
 const partial=await readQualifiedSnapshot(async()=>({count:2,updatedAt:at}),async(after)=>after?[]:[row('a')])
 assert.equal(partial.status,'UNAVAILABLE')
 const duplicate=await readQualifiedSnapshot(async()=>({count:2,updatedAt:at}),async()=>[row('a'),row('a')])
 assert.equal(duplicate.status,'UNAVAILABLE')
 const failed=await readQualifiedSnapshot(async()=>{throw Error('database unavailable')},async()=>[])
 assert.equal(failed.status,'UNAVAILABLE')
})
test('empty ledger is distinct from unavailable and does not invent zero percent',async()=>{
 const empty=await readQualifiedSnapshot(async()=>({count:0,updatedAt:null}),async()=>{throw Error('no page should be read')})
 assert.equal(empty.status,'EMPTY');assert.deepEqual(empty.groups,[])
 const html=renderToStaticMarkup(React.createElement(QualifiedPlaysPanel,{report:empty}))
 assert.match(html,/No synced observations/);assert.doesNotMatch(html,/0.00%/)
 const unavailable=renderToStaticMarkup(React.createElement(QualifiedPlaysPanel,{report:unavailableQualifiedReport()}))
 assert.match(unavailable,/unavailable or changed/);assert.doesNotMatch(unavailable,/No synced observations/)
})
test('research rendering labels domain shift, sample sizes, current-source timestamps and no official status',()=>{
 const report=summarizeQualifiedPlays([row('a'),row('b',{result:'LOSS'})],at,at)
 const html=renderToStaticMarkup(React.createElement(QualifiedPlaysPanel,{report}))
 for(const value of ['Research only','SHADOW DOMAIN SHIFT','50.00%','Small sample','not Official Picks','awaiting sync','View official pick performance'])assert.ok(html.includes(value),value)
})
