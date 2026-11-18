import {normalizeHoopsNbaList} from '../lib/nba/hoopsapi-preview-core.mjs';
export const HOOPS_API_PREVIEW_CONFIRM = 'HOOPS_NBA_SINGLE_MANUAL_REQUEST';
export const HOOPS_API_PREVIEW_URL = 'https://hoopsapi.com/api/v1/games?competition=NBA';
export function getHoopsPreviewStatus(env = process.env) {
  return {
    status: env.VERCEL_ENV === 'preview' ? 'PREVIEW_AVAILABLE' : 'PREVIEW_ONLY',
    enabled: env.VERCEL_ENV === 'preview', credential_configured: Boolean(env.HOOPS_API_KEY),
    provider: 'hoopsapi', expected_free_tier_provider_cap: '10 requests per rolling 24 hours',
    automatic_schedule_enabled: false, provider_calls_made: 0, writes_performed: 0, manual_test_calls_per_click: 1,
    rate_limit_authority: 'PROVIDER_429',
    warning: 'No durable application quota ledger is active. Do not schedule until a quota ledger and deduplication guard are deployed.',
  };
}
export async function testHoopsPreviewOnce({key, fetcher = fetch, receivedAt = new Date().toISOString()}) {
  if (typeof key !== 'string' || key.length < 10) throw new Error('HOOPSAPI_PREVIEW_CREDENTIAL_UNAVAILABLE');
  const response = await fetcher(HOOPS_API_PREVIEW_URL, {
    method: 'GET', headers: {Authorization: 'Bearer ' + key, Accept: 'application/json'},
    signal: AbortSignal.timeout(15000), cache: 'no-store', redirect: 'error',
  });
  if (response.status === 429) return {
    status: 'HOOPSAPI_RATE_LIMITED', provider_http_status: 429, provider_calls_made: 1,
    retry_after: /^[0-9]{1,8}$/.test(response.headers.get('retry-after') ?? '') ? response.headers.get('retry-after') : null,
  };
  if (!response.ok) return {status: 'HOOPSAPI_PROVIDER_UNAVAILABLE', provider_http_status: response.status, provider_calls_made: 1};
  const raw = await response.text();
  if (raw.length > 2_000_000) throw new Error('HOOPSAPI_RESPONSE_TOO_LARGE');
  let payload;
  try { payload = JSON.parse(raw); } catch { throw new Error('HOOPSAPI_RESPONSE_NOT_JSON'); }
  return {...normalizeHoopsNbaList(payload, receivedAt), provider_http_status: 200, provider_calls_made: 1, database_writes: 0};
}
