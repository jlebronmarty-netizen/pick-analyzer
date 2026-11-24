// No public exposure of NBA archived player data. Match the private Decision Board.
export function nbaManualAccess(request,env=process.env){
 const allowed=env.VERCEL_ENV==='preview'||(env.VERCEL_ENV==='production'&&env.NBA_DECISION_BOARD_ENABLED==='true');
 if(!allowed)return {status:404,code:'NBA_MANUAL_DISABLED'};
 if(env.VERCEL_ENV==='production'){
 const h=env.VERCEL_URL;
 if(typeof h!=='string'||!(/^[a-z0-9-]+\.vercel\.app$/).test(h)||new URL(request.url).hostname!==h||request.headers.get('host')!==h)
 return {status:404,code:'PRIVATE_DEPLOYMENT_HOST_REQUIRED'};
 }
 if(!request.headers.get('x-vercel-oidc-token'))return {status:401,code:'PRIVATE_VERCEL_AUTH_REQUIRED'};
 return null;
}
