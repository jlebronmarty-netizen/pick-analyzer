/** Preview-only market reader. Vercel Deployment Protection is the incoming auth boundary.
 * Tokens come from the Vercel Function Request, never the browser or an API key.
 * https://vercel.com/docs/oidc#in-vercel-functions
 * No models, DB writes, ingestion, settlement, orders, schedules or provider keys.
 */
export const BRANCH = 'research/nba-shared-feed-20261102';
const ORIGIN = 'https://nba-odds-on-demand-preview-fyp1exr0l-pick-analyzer.vercel.app';
const TYPES = new Set(['points','rebounds','assists','threes','blocks','steals','points_rebounds_assists','points_rebounds','points_assists','rebounds_assists']);
export function enabled(env) {
  return env.VERCEL === '1' && env.VERCEL_ENV === 'preview' && env.VERCEL_GIT_COMMIT_REF === BRANCH && env.NBA_SHARED_FEED_ENABLED === 'true';
}
export function parseQuery(url) {
  const q = new URL(url).searchParams;
  for (const k of q.keys()) if (k !== '_vercel_share' && (!['action','date','game_id','group','player_id','prop_type'].includes(k) || q.getAll(k).length !== 1)) throw new Error('INVALID_PARAMETER');
  const p = new URLSearchParams(); const action = q.get('action') || 'games';
  if (!['games','quote'].includes(action)) throw new Error('INVALID_ACTION');
  p.set('action',action);
  if (action === 'games') {
    const d = q.get('date');
    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d) || !Number.isFinite(Date.parse(d+'T12:00:00Z')) || new Date(d+'T12:00:00Z').toISOString().slice(0,10) !== d) throw new Error('INVALID_DATE');
    if (['game_id','group','player_id','prop_type'].some(k=>q.has(k))) throw new Error('INVALID_PARAMETER');
    p.set('date',d);
  } else {
    for (const k of ['game_id','player_id']) {
      const v=q.get(k); if(k==='player_id' && v===null) continue;
      if(!v || !/^\d+$/.test(v) || !Number.isSafeInteger(Number(v)) || Number(v)<1) throw new Error('INVALID_ID');
      p.set(k,String(Number(v)));
    }
    if(q.has('date')) throw new Error('INVALID_PARAMETER');
    const group=q.get('group') || 'main'; if(!['main','props'].includes(group)) throw new Error('INVALID_GROUP');
    p.set('group',group);
    if(group==='props') { if(!TYPES.has(q.get('prop_type'))) throw new Error('INVALID_PROP_TYPE'); p.set('prop_type',q.get('prop_type')); }
    else if(q.has('prop_type') || q.has('player_id')) throw new Error('INVALID_PARAMETER');
  }
  return p;
}
export function validateFeed(b, p, now=new Date()) {
  if (b?.meta?.contract_version!=='NBA_MARKET_DATA_V1' || b.meta.provider!=='BALLDONTLIE' || b.meta.sportsbook!=='FanDuel' || b.meta.id_namespace!=='balldontlie' || !b.data) throw new Error('FEED_CONTRACT_MISMATCH');
  if(p.get('action')==='games') {
    if(!Array.isArray(b.data.games) || b.meta.date_local!==p.get('date')) throw new Error('SCHEDULE_MISMATCH');
  } else {
    const id=Number(p.get('game_id'));
    if(b.data.game?.id!==id || !Array.isArray(b.data.quotes)) throw new Error('GAME_ID_MISMATCH');
    if(b.meta.quote_count!==b.data.quotes.length) throw new Error('QUOTE_COUNT_MISMATCH');
    for(const q of b.data.quotes) {
      if(q.game_id!==id || q.provider!=='BALLDONTLIE' || q.sportsbook!=='FanDuel' || !Number.isInteger(q.american_odds) || Math.abs(q.american_odds)<100) throw new Error('QUOTE_MISMATCH');
      if(p.get('group')==='main' ? !['moneyline','spread','total'].includes(q.market) : q.market!=='props' || q.statistic!==p.get('prop_type')) throw new Error('MARKET_MISMATCH');
      if(p.has('player_id') && q.player_id!==Number(p.get('player_id'))) throw new Error('PLAYER_MISMATCH');
      if(q.market!=='moneyline' && !Number.isFinite(q.line)) throw new Error('INVALID_LINE');
      const t=typeof q.provider_updated_at==='string' && /(?:Z|[+-]\d\d:\d\d)$/.test(q.provider_updated_at) ? Date.parse(q.provider_updated_at) : NaN;
      const a=(now.getTime()-t)/1000;
      q.age_seconds=Number.isFinite(a)?Math.round(a):null;
      q.freshness=!Number.isFinite(a)?'UNKNOWN_TIMESTAMP':a<0?'FUTURE_TIMESTAMP':a<=180?'RECENT':a<=300?'AGING':'STALE';
      q.model_probability=null; q.expected_value=null; q.recommendation=null; q.execution_available=false;
    }
    const g=b.data.game;
    if(g.postponed || /final|cancel|postpon/i.test(`${g.status} ${g.status_state}`)) b.data.phase='NOT_OPEN_FOR_PREGAME';
    else if(Number(g.period)>0 || g.status_state==='in_progress') b.data.phase='IN_PLAY';
    else if(!Number.isFinite(Date.parse(g.datetime)) || Date.parse(g.datetime)<=now.getTime()) b.data.phase='START_STATE_UNCERTAIN';
  }
  b.meta.display_checked_at=now.toISOString();
  b.meta.freshness_counts=Object.fromEntries(['RECENT','AGING','STALE','UNKNOWN_TIMESTAMP','FUTURE_TIMESTAMP'].map(s=>[s,(b.data.quotes||[]).filter(q=>q.freshness===s).length]));
  b.meta.integration_mode='PREVIEW_READ_ONLY'; b.meta.picks_written=false; b.meta.settlement_performed=false;
  return b;
}
export function makeHandler({env=process.env,fetchFn=globalThis.fetch,now=()=>new Date()}={}) {
  const reply=(b,status=200)=>Response.json(b,{status,headers:{'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff'}});
  return async function GET(request) {
    if(request.method!=='GET') return reply({error:'METHOD_NOT_ALLOWED'},405);
    if(!enabled(env)) return reply({error:'INTEGRATION_NOT_ENABLED'},503);
    // This header is injected by the protected Vercel Function runtime. Never echo it.
    const token=request.headers.get('x-vercel-oidc-token');
    if(!token) return reply({error:'SERVICE_IDENTITY_UNAVAILABLE'},503);
    let p; try{p=parseQuery(request.url);}catch(e){return reply({error:e.message},400);}
    try {
      const u=new URL('/api/consumer',ORIGIN); u.search=p.toString();
      const r=await fetchFn(u,{method:'GET',cache:'no-store',redirect:'manual',headers:{Accept:'application/json','x-vercel-trusted-oidc-idp-token':token},signal:AbortSignal.timeout(55000)});
      if([301,302,303,307,308,401,403].includes(r.status)) return reply({error:'FEED_ACCESS_DENIED'},502);
      if(!r.ok) return reply({error:r.status===429?'FEED_RATE_LIMITED':'FEED_UPSTREAM_ERROR'},r.status===429?429:502);
      if(!(r.headers.get('content-type')||'').includes('application/json')) return reply({error:'FEED_NOT_JSON'},502);
      const b=validateFeed(await r.json(),p,now());
      b.meta.consumer_project=env.VERCEL_PROJECT_ID || null;
      return reply(b);
    } catch { return reply({error:'FEED_VALIDATION_OR_NETWORK_FAILURE'},502); }
  };
}
