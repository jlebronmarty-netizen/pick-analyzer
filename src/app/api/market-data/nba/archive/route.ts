import { archiveEnabled, archiveStatus, runSharedNbaArchive } from '@/services/nba-shared-storage.service'
import { privateHost } from '@/lib/nba-production-feed.mjs'
export const dynamic='force-dynamic'
export const maxDuration=60
function allowed(r:Request){return archiveEnabled()&&privateHost(r,process.env)&&Boolean(r.headers.get('x-vercel-oidc-token'))}
const reply=(b:unknown,status=200)=>Response.json(b,{status,headers:{'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff'}})
export async function GET(r:Request){
 if(!allowed(r))return reply({error:'PRIVATE_PRODUCTION_REQUIRED'},403)
 try{return reply(await archiveStatus())}catch{return reply({error:'ARCHIVE_STATUS_UNAVAILABLE'},502)}
}
export async function POST(r:Request){
 if(!allowed(r))return reply({error:'PRIVATE_PRODUCTION_REQUIRED'},403)
 const origin=r.headers.get('origin'),site=r.headers.get('sec-fetch-site')
 if(origin!==new URL(r.url).origin||site!=='same-origin'||!r.headers.get('content-type')?.startsWith('application/json'))return reply({error:'SAME_ORIGIN_REQUIRED'},403)
 try{const b=await r.json();if(!b||typeof b!=='object'||Array.isArray(b)||Object.keys(b).length)return reply({error:'NO_PARAMETERS_ALLOWED'},400)}catch{return reply({error:'INVALID_JSON'},400)}
 try{const out=await runSharedNbaArchive(r.headers.get('x-vercel-oidc-token')!,'manual');return reply(out,out.success?200:207)}catch{return reply({error:'ARCHIVE_RUN_FAILED'},502)}
}
