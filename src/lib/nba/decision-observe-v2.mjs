// Only the SSO-protected generated production hostname is valid. The operator must also open a
// short database window for that exact deployment, which this read-only client cannot change.
export function operatorHost(request,env) {
  const host=env.VERCEL_URL,sha=env.VERCEL_GIT_COMMIT_SHA;
  return env.VERCEL_ENV==='production' && (env.NBA_DECISION_V2_MODE??'off')==='off' &&
    /^[0-9a-f]{40}$/.test(sha??'') && /^pick-analyzer-[a-z0-9-]+\.vercel\.app$/.test(host??'') &&
    request.headers.get('host')===host && !!request.headers.get('x-vercel-oidc-token') && !new URL(request.url).search;
}

export function observationTransport(base,upstream=fetch) {
  const origin=new URL(base).origin;
  const metrics={requests:0,restReads:0,storageReads:0,rpcReads:0,responseBytes:0,httpErrors:0};
  const readRpcs=new Set(['/rest/v1/rpc/nba_v2_shadow_observe_allowed','/rest/v1/rpc/nba_v2_shadow_due']);
  const transport=async(input,init)=>{
    const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);
    const method=(init?.method??input?.method??'GET').toUpperCase();
    const rpc=readRpcs.has(url.pathname),storage=url.pathname.startsWith('/storage/v1/object/');
    const rest=url.pathname.startsWith('/rest/v1/')&&!url.pathname.startsWith('/rest/v1/rpc/');
    if(url.origin!==origin || !(rpc&&method==='POST'||(storage||rest)&&['GET','HEAD'].includes(method)))
      throw Error('OBSERVATION_READ_BOUNDARY');
    metrics.requests++;
    metrics[rpc?'rpcReads':storage?'storageReads':'restReads']++;
    const response=await upstream(input,{...init,redirect:'error'});
    if(!response.ok)metrics.httpErrors++;
    if(!response.body)return response;
    const body=response.body.pipeThrough(new TransformStream({transform(chunk,controller){
      metrics.responseBytes+=chunk.byteLength;controller.enqueue(chunk);
    }}));
    return new Response(body,{status:response.status,statusText:response.statusText,headers:response.headers});
  };
  return {metrics,fetch:transport};
}
