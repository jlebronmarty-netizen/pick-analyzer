import {createHash} from 'node:crypto';
import {normalizeHoopsNbaList} from '../lib/nba/hoopsapi-preview-core.mjs';
export const HOOPS_API_PREVIEW_CONFIRM = 'HOOPS_NBA_SINGLE_MANUAL_REQUEST';
export const HOOPS_API_PREVIEW_URL = 'https://hoopsapi.com/api/v1/games?competition=NBA';
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const account = value => typeof value === 'string' && /^[a-z0-9_-]{3,80}$/.test(value);
export function getHoopsPreviewStatus(env = process.env) {
  const configured = env.HOOPS_API_DURABLE_ENABLED === 'true' && account(env.HOOPS_API_ACCOUNT_SCOPE);
  return {
    status: env.VERCEL_ENV === 'preview' ? configured ? 'DURABLE_PREVIEW_CONFIGURED' : 'DURABLE_CAPTURE_DISABLED' : 'PREVIEW_ONLY',
    enabled: env.VERCEL_ENV === 'preview', credential_configured: Boolean(env.HOOPS_API_KEY),
    capture_configured: Boolean(configured), provider: 'hoopsapi',
    expected_free_tier_provider_cap: '10 requests per rolling 24 hours', automatic_schedule_enabled: false,
    provider_calls_made: 0, database_writes: 0, manual_test_calls_per_click: 1,
    rate_limit_authority: 'ATOMIC_ACCOUNT_LEDGER_AND_PROVIDER_429',
    warning: 'The ledger covers the configured provider account scope. Calls outside this integration also consume the provider quota.',
  };
}
export async function readHoopsPreviewState({store, accountScope, env = process.env}) {
  const configuration = getHoopsPreviewStatus(env);
  if (!configuration.enabled || !configuration.capture_configured || !store || !account(accountScope)) return configuration;
  try {
    const [quota, capture] = await Promise.all([store.status(accountScope), store.latest(accountScope)]);
    return {...configuration, quota, capture, capture_enabled: configuration.credential_configured && quota.enabled &&
      !quota.blocked_until && !quota.uncertain_or_in_flight && quota.remaining_app_reservations > 0};
  } catch { return {...configuration, status: 'HOOPSAPI_LEDGER_UNAVAILABLE', capture_enabled: false}; }
}
// No unguarded exported provider-fetch method.
export async function captureHoopsPreviewDurably({key, store, accountScope, requestId,
  fetcher = fetch, now = () => new Date().toISOString()}) {
  if (typeof key !== 'string' || key.length < 10 || !store || !account(accountScope) || !uuid(requestId))
    return {status: 'HOOPSAPI_CAPTURE_CONFIGURATION_INVALID', provider_calls_made: 0, capture_persisted: false};
  let claim;
  try { claim = await store.claim(accountScope, requestId); }
  catch { return {status: 'HOOPSAPI_LEDGER_UNAVAILABLE', provider_calls_made: 0, capture_persisted: false}; }
  if (claim.status !== 'RESERVED') {
    if (claim.status === 'ALREADY_CLAIMED' && claim.capture_id) {
      try {
        const previous = await store.capture(accountScope, claim.capture_id);
        if (previous) return {...previous, request_replayed: true, provider_calls_made: 0};
      } catch { /* Fail closed without another provider request. */ }
    }
    return {...claim, provider_calls_made: 0, capture_persisted: false};
  }
  const attemptId = claim.attempt_id;
  let dispatch;
  try { dispatch = await store.dispatch(accountScope, attemptId); }
  catch { return {status: 'HOOPSAPI_DISPATCH_UNCONFIRMED', attempt_id: attemptId, provider_calls_made: 0, capture_persisted: false}; }
  if (dispatch.status !== 'DISPATCH_GRANTED') return {...dispatch, attempt_id: attemptId, provider_calls_made: 0, capture_persisted: false};
  async function failure(code, status, http = null, retrySeconds = null) {
    let recorded = false;
    try { recorded = (await store.fail(accountScope, attemptId, {code, http, retrySeconds})).status === 'FAILURE_RECORDED'; } catch { /* Unresolved dispatch blocks another request. */ }
    return {status, attempt_id: attemptId, provider_calls_made: 1, capture_persisted: false,
      provider_http_status: http, failure_recorded: recorded, automatic_retry: false};
  }
  let response;
  try {
    response = await fetcher(HOOPS_API_PREVIEW_URL, {
      method: 'GET', headers: {Authorization: 'Bearer ' + key, Accept: 'application/json'},
      signal: AbortSignal.timeout(15000), cache: 'no-store', redirect: 'error',
    });
  } catch { return failure('TRANSPORT_UNKNOWN', 'HOOPSAPI_TRANSPORT_UNKNOWN'); }
  if (response.status === 429) {
    const retry = response.headers.get('retry-after');
    return failure('PROVIDER_429', 'HOOPSAPI_RATE_LIMITED', 429, /^[0-9]{1,8}$/.test(retry ?? '') ? Number(retry) : null);
  }
  if (!response.ok) return failure('PROVIDER_HTTP', 'HOOPSAPI_PROVIDER_UNAVAILABLE', response.status);
  if (Number(response.headers.get('content-length') ?? 0) > 2_000_000)
    return failure('RESPONSE_BOUND', 'HOOPSAPI_RESPONSE_TOO_LARGE', response.status);
  let raw;
  try { raw = await response.text(); } catch { return failure('TRANSPORT_UNKNOWN', 'HOOPSAPI_TRANSPORT_UNKNOWN', response.status); }
  if (Buffer.byteLength(raw, 'utf8') > 2_000_000) return failure('RESPONSE_BOUND', 'HOOPSAPI_RESPONSE_TOO_LARGE', response.status);
  if (raw.includes(key)) return failure('CREDENTIAL_ECHO', 'HOOPSAPI_RESPONSE_REJECTED', response.status);
  const receivedAt = now();
  let normalized;
  try { normalized = normalizeHoopsNbaList(JSON.parse(raw), receivedAt); }
  catch { return failure('INVALID_RESPONSE', 'HOOPSAPI_RESPONSE_INVALID', response.status); }
  const sha256 = createHash('sha256').update(raw).digest('hex');
  try {
    const saved = await store.complete(accountScope, attemptId, {receivedAt, raw, sha256, normalized});
    if (saved.status !== 'ARCHIVED' || !saved.capture_id) throw new Error('HOOPSAPI_ARCHIVE_UNCONFIRMED');
    return {...normalized, capture_id: saved.capture_id, attempt_id: attemptId,
      response_sha256: sha256, capture_persisted: true, provider_calls_made: 1,
      database_writes: 4, request_replayed: false};
  } catch {
    // Leave dispatch unresolved: it blocks calls until recovery or 24h expiry.
    return {...normalized, status: 'HOOPSAPI_ARCHIVE_UNCONFIRMED', attempt_id: attemptId,
      response_sha256: sha256, capture_persisted: false, provider_calls_made: 1,
      automatic_retry: false, warning: 'Persistence was not confirmed. Download this response and use recovery GET before another capture.'};
  }
}

