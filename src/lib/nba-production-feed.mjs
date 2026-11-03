import {parseQuery,validateFeed} from './nba-shared-feed.mjs';
export {parseQuery};
export const BRANCH='research/nba-functional-20261102';
export const ORIGIN='https://nba-odds-on-demand-preview.vercel.app';
const PREVIEW='https://nba-odds-on-demand-preview-cw39aetf8-pick-analyzer.vercel.app';
export function enabled(env){return env.VERCEL==='1'&&env.NBA_SHARED_FEED_ENABLED==='true'&&(env.VERCEL_ENV==='production'||env.VERCEL_ENV==='preview'&&[BRANCH,'research/nba-production-auto-20261102','research/nba-shared-feed-20261102'].includes(env.VERCEL_GIT_COMMIT_REF));}
export function privateHost(request,env){const h=env.VERCEL_URL;return typeof h==='string'&&/^[a-z0-9-]+\.vercel\.app$/.test(h)&&new URL(request.url).hostname===h&&request.headers.get('host')===h;}
export function makeHandler({env=process.env,fetchFn=globalThis.fetch,now=()=>new Date()}={}){
 const reply=(b,status=200)=>Response.json(b,{status,headers:{'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff'}});
 return async function(request){
  if(request.method!=='GET')return reply({error:'METHOD_NOT_ALLOWED'},405);
  if(!enabled(env))return reply({error:'INTEGRATION_NOT_ENABLED'},503);
  if(env.VERCEL_ENV==='production'&&!privateHost(request,env))return reply({error:'PRIVATE_DEPLOYMENT_REQUIRED'},401);
  let p;try{p=parseQuery(request.url);}catch(e){return reply({error:e.message},400);}
  const token=request.headers.get('x-vercel-oidc-token');if(!token)return reply({error:'SERVICE_IDENTITY_UNAVAILABLE'},503);
  try{
   const u=new URL('/api/consumer',env.VERCEL_ENV==='production'?ORIGIN:PREVIEW);u.search=p.toString();
   const r=await fetchFn(u,{method:'GET',cache:'no-store',redirect:'manual',headers:{Accept:'application/json','x-vercel-trusted-oidc-idp-token':token},signal:AbortSignal.timeout(55000)});
   if([301,302,303,307,308,401,403].includes(r.status))return reply({error:'FEED_ACCESS_DENIED'},502);
   if(!r.ok)return reply({error:r.status===429?'FEED_RATE_LIMITED':'FEED_UPSTREAM_ERROR'},r.status===429?429:502);
   if(!(r.headers.get('content-type')||'').includes('application/json'))return reply({error:'FEED_NOT_JSON'},502);
   const b=validateFeed(await r.json(),p,now());b.meta.integration_mode=env.VERCEL_ENV==='production'?'PRODUCTION_READ_ONLY':'PREVIEW_READ_ONLY';b.meta.consumer_project=env.VERCEL_PROJECT_ID??null;return reply(b);
  }catch{return reply({error:'FEED_VALIDATION_OR_NETWORK_FAILURE'},502);}
 };
}
