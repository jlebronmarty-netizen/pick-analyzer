// The live review shares the protected Decision Board deployment and has no write path.
export function v2ReviewAccess(env, requestHeaders) {
  if (env.VERCEL_ENV === 'preview') {
    return {source: env.NBA_DECISION_V2_PREVIEW_LEDGER === 'read' ? 'ledger' : 'archive'};
  }
  const hostname = env.VERCEL_URL;
  if (env.VERCEL_ENV !== 'production' || env.NBA_DECISION_BOARD_ENABLED !== 'true' ||
      !hostname || !/^[a-z0-9-]+\.vercel\.app$/.test(hostname)) return null;
  if (requestHeaders.get('host') !== hostname) {
    return {redirect: 'https://' + hostname + '/nba-decision-v2'};
  }
  return requestHeaders.get('x-vercel-oidc-token') ? {source: 'ledger'} : null;
}
