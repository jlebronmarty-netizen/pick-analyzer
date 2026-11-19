import {getHoopsPreviewStatus, readHoopsPreviewState, captureHoopsPreviewDurably, HOOPS_API_PREVIEW_CONFIRM} from '@/services/nba-hoopsapi-preview.service.mjs';
import {createHoopsDurableStore} from '@/lib/nba/hoopsapi-durable-store.mjs';
export const dynamic = 'force-dynamic';
export const maxDuration = 45;
const respond = (body, status = 200) => Response.json(body, {status, headers: {'Cache-Control': 'private, no-store'}});
async function storage() {
  const {supabaseAdmin} = await import('@/lib/supabase-admin');
  return createHoopsDurableStore(supabaseAdmin);
}
export async function GET(request) {
  const configuration = getHoopsPreviewStatus();
  if (!configuration.enabled) return respond(configuration, 404);
  if (!request.headers.get('x-vercel-oidc-token')) return respond({status:'PRIVATE_VERCEL_AUTH_REQUIRED'},401);
  if (!configuration.capture_configured) return respond(configuration);
  try {
    const state = await readHoopsPreviewState({store: await storage(), accountScope: process.env.HOOPS_API_ACCOUNT_SCOPE});
    return respond(state, state.status === 'HOOPSAPI_LEDGER_UNAVAILABLE' ? 503 : 200);
  } catch { return respond({status:'HOOPSAPI_LEDGER_UNAVAILABLE',capture_enabled:false,provider_calls_made:0},503); }
}
export async function POST(request) {
  const configuration = getHoopsPreviewStatus();
  if (!configuration.enabled) return respond({status:'PREVIEW_ONLY'},404);
  if (!request.headers.get('x-vercel-oidc-token')) return respond({status:'PRIVATE_VERCEL_AUTH_REQUIRED'},401);
  if (request.headers.get('origin') !== new URL(request.url).origin ||
      request.headers.get('sec-fetch-site') !== 'same-origin' ||
      !request.headers.get('content-type')?.startsWith('application/json')) return respond({status:'SAME_ORIGIN_REQUIRED'},403);
  if (!configuration.capture_configured) return respond({status:'DURABLE_CAPTURE_DISABLED',provider_calls_made:0},503);
  const raw = await request.text();
  if (raw.length > 256) return respond({status:'INVALID_REQUEST'},400);
  let body;
  try { body = JSON.parse(raw); } catch { return respond({status:'INVALID_JSON'},400); }
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some(key => !['confirm','request_id'].includes(key)) ||
      body.confirm !== HOOPS_API_PREVIEW_CONFIRM ||
      typeof body.request_id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.request_id))
    return respond({status:'CONFIRMATION_AND_REQUEST_ID_REQUIRED'},400);
  try {
    const result = await captureHoopsPreviewDurably({
      key:process.env.HOOPS_API_KEY,store:await storage(),accountScope:process.env.HOOPS_API_ACCOUNT_SCOPE,requestId:body.request_id,
    });
    const status = result.capture_persisted ? 200 :
      ['HOOPSAPI_RATE_LIMITED','APP_QUOTA_EXHAUSTED','ACCOUNT_COOLDOWN'].includes(result.status) ? 429 :
      ['ALREADY_CLAIMED','REQUEST_IN_PROGRESS_OR_UNCERTAIN','DISPATCH_DENIED'].includes(result.status) ? 409 : 503;
    return respond(result,status);
  } catch { return respond({status:'HOOPSAPI_CAPTURE_UNAVAILABLE',provider_calls_made:0,capture_persisted:false},503); }
}

