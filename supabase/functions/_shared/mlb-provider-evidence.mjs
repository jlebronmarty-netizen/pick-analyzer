import {sha256} from '../../../scripts/mlb-data-02r-r2f-stage-contracts.mjs'

export const EVIDENCE_BUCKET='mlb-operational-evidence'
export const EVIDENCE_LIMIT=4*1024*1024
const ensure=(ok,why)=>{if(!ok)throw Error(`R6_STATE:${why}`)}
const bytes=x=>new TextEncoder().encode(JSON.stringify(x)).length
export async function assertEvidenceAccess(query) {
  const rows=await query("SELECT relrowsecurity AS rls, (SELECT count(*)::int FROM pg_policies WHERE schemaname='storage' AND tablename='objects') AS policies FROM pg_class WHERE oid='storage.objects'::regclass")
  ensure(rows.length===1 && rows[0].rls===true && Number(rows[0].policies)===0,'EVIDENCE_PUBLIC_ACCESS')
}

// The object key is known before acquisition. An upload committed before a lost
// checkpoint acknowledgement can therefore be found without another provider call.
export function evidenceIdentity(run,kind) {
  ensure(['odds','schedule'].includes(kind),'EVIDENCE_KIND')
  const provider=kind==='odds'?'THE_ODDS_API':'MLB_OFFICIAL'
  const reservation=sha256(`${run.run_id}:${provider}:1`)
  ensure((run.dml_accounting.providerReservations??[]).includes(reservation),'EVIDENCE_RESERVATION')
  return {key:`${run.package_sha}/${run.run_id}/${kind}.json`,reservation,provider}
}

export function evidenceEnvelope(run,kind,evidence) {
  const identity=evidenceIdentity(run,kind)
  ensure(evidence && Object.keys(evidence).every(k=>['payload','acquiredAt',kind==='odds'?'responseDigest':'digest'].includes(k)),'EVIDENCE_FIELDS')
  ensure(Number.isFinite(Date.parse(evidence.acquiredAt)) && Date.parse(evidence.acquiredAt)>=Date.parse(run.run_as_of),'EVIDENCE_TIME')
  ensure(evidence[kind==='odds'?'responseDigest':'digest']===sha256(evidence.payload),'EVIDENCE_DIGEST')
  if(kind==='odds')ensure(run.odds_calls===1 && run.checkpoint.scope.length>0 && Array.isArray(evidence.payload?.events) && evidence.payload.events.length<=100,'EVIDENCE_SCOPE')
  else ensure(Array.isArray(evidence.payload?.dates),'EVIDENCE_SCHEDULE')
  const envelope={version:1,runId:run.run_id,packageSha:run.package_sha,runAsOf:new Date(run.run_as_of).toISOString(),kind,reservation:identity.reservation,evidence}
  ensure(bytes(envelope)<=EVIDENCE_LIMIT,'EVIDENCE_SIZE')
  return envelope
}

export async function persistOrRecoverEvidence({run,kind,evidence,storage}) {
  ensure(storage,'EVIDENCE_STORAGE_REQUIRED')
  const {key}=evidenceIdentity(run,kind)
  await storage.preflight()
  let stored=await storage.read(key)
  if(evidence) {
    const envelope=evidenceEnvelope(run,kind,evidence)
    if(!stored) {await storage.create(key,envelope);stored=await storage.read(key)}
    ensure(stored && sha256(stored)===sha256(envelope),'EVIDENCE_IMMUTABLE_CONFLICT')
  }
  if(!stored)return null
  const expected=evidenceEnvelope(run,kind,stored.evidence)
  ensure(sha256(stored)===sha256(expected),'EVIDENCE_FREEZE_DRIFT')
  return {evidence:stored.evidence,reference:{kind:`${kind}_evidence`,identity:run.run_id,digest:sha256(stored),count:1,asOf:stored.evidence.acquiredAt}}
}

// Server credential only; fixed private bucket, immutable creates, no delete,
// overwrite, signed/public URLs, caller-selected host, or arbitrary object paths.
export function createEvidenceStorage({url,key,fetchImpl=fetch}) {
  ensure(url==='https://ynuocvexviorgdjrfthw.supabase.co' && typeof key==='string' && key.length>20,'EVIDENCE_CONFIGURATION')
  const call=async(path,options={})=>fetchImpl(`${url}/storage/v1/${path}`,{...options,headers:{Authorization:`Bearer ${key}`,apikey:key,'Content-Type':'application/json',...options.headers},redirect:'error',signal:AbortSignal.timeout(15000)})
  const objectPath=value=>{ensure(/^[a-f0-9]{40}\/[A-Za-z0-9_-]{1,100}\/(odds|schedule)\.json$/.test(value),'EVIDENCE_PATH');return `${EVIDENCE_BUCKET}/${value}`}
  return {
    async preflight(){const r=await call(`bucket/${EVIDENCE_BUCKET}`);ensure(r.ok,'EVIDENCE_BUCKET_REQUIRED');const b=await r.json();ensure(b.id===EVIDENCE_BUCKET && b.public===false && Number(b.file_size_limit)===EVIDENCE_LIMIT && JSON.stringify(b.allowed_mime_types)===JSON.stringify(['application/json']),'EVIDENCE_BUCKET_CONTRACT')},
    async read(path){const r=await call(`object/authenticated/${objectPath(path)}`);if(!r.ok){const failure=await r.json().catch(()=>null);if(r.status===404 || failure?.error==='not_found' || failure?.code==='NoSuchKey')return null;throw Error('R6_STATE:EVIDENCE_READ_FAILED')}const text=await r.text();ensure(new TextEncoder().encode(text).length<=EVIDENCE_LIMIT,'EVIDENCE_SIZE');return JSON.parse(text)},
    async create(path,value){const r=await call(`object/${objectPath(path)}`,{method:'POST',headers:{'x-upsert':'false'},body:JSON.stringify(value)});ensure(r.ok || r.status===409,'EVIDENCE_CREATE_FAILED')},
  }
}
