import fs from 'node:fs'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { summarizeQualifiedPlays, readQualifiedSnapshot } from '../src/lib/qualified-plays.ts'
const filename=process.argv[2]
if(!filename)throw Error('Usage: node --loader ./tests/dashboard-multisport/tsx-loader.mjs scripts/verify-qualified-plays-live.mjs <atomic-sql-snapshot.json>')
const raw=fs.readFileSync(filename,'utf8'),snapshot=JSON.parse(raw)
const watermark=snapshot.rows.map(r=>r.updated_at).sort((a,b)=>Date.parse(b)-Date.parse(a))[0]??null
const report=summarizeQualifiedPlays(snapshot.rows,snapshot.read_at,watermark)
const identity=g=>JSON.stringify([g.phase??g.season_phase,g.engine,g.model??g.model_id,g.contract??g.contract_id,g.market,g.line===null?null:Number(g.line),g.direction,g.evidenceClass??g.evidence_class])
const sql=new Map(snapshot.expected.map(g=>[identity(g),g]))
assert.equal(report.groups.length,sql.size)
for(const group of report.groups){const expected=sql.get(identity(group));assert.ok(expected);for(const key of ['observations','wins','losses','pushes','voids','open'])assert.equal(group[key],expected[key],`${group.key}: ${key}`)}
const ordered=[...snapshot.rows].sort((a,b)=>a.id.localeCompare(b.id))
const paged=await readQualifiedSnapshot(async()=>({count:ordered.length,updatedAt:watermark}),async(after)=>ordered.filter(r=>after===null||r.id>after).slice(0,500))
assert.equal(paged.status,'AVAILABLE');assert.deepEqual(paged.groups,report.groups)
const verification={status:'PASS',project:'ynuocvexviorgdjrfthw',source:'public.mlb_2026_forward_master_ledger_v1',readAt:snapshot.read_at,sourceUpdatedAt:watermark,snapshotSha256:createHash('sha256').update(raw).digest('hex'),observations:report.observations,groups:report.groups,sqlGroupParity:true,paginatedMapperParity:true,scope:'Atomic read-only SQL snapshot compared with application aggregation and simulated pagination. Not live HTTP/Supabase SDK end-to-end certification.'}
fs.writeFileSync('docs/product/QUALIFIED_PLAYS_READ_VERIFICATION_20261014.json',JSON.stringify(verification,null,2)+'\n')
console.log(JSON.stringify({status:verification.status,observations:report.observations,groups:report.groups.length,readAt:snapshot.read_at}))
