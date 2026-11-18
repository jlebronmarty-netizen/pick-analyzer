import {getHoopsPreviewStatus, testHoopsPreviewOnce, HOOPS_API_PREVIEW_CONFIRM} from '@/services/nba-hoopsapi-preview.service.mjs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
const respond = (body, status = 200) => Response.json(body, {status, headers: {'Cache-Control': 'private, no-store'}});
export async function GET() {
  const status = getHoopsPreviewStatus();
  return respond(status, status.enabled ? 200 : 404);
}
export async function POST(request) {
  if (process.env.VERCEL_ENV !== 'preview') return respond({status: 'PREVIEW_ONLY'}, 404);
  if (!request.headers.get('x-vercel-oidc-token')) return respond({status: 'PRIVATE_VERCEL_AUTH_REQUIRED'}, 401);
  if (request.headers.get('origin') !== new URL(request.url).origin ||
      request.headers.get('sec-fetch-site') !== 'same-origin' ||
      !request.headers.get('content-type')?.startsWith('application/json')) return respond({status: 'SAME_ORIGIN_REQUIRED'}, 403);
  const raw = await request.text();
  if (raw.length > 256) return respond({status: 'INVALID_REQUEST'}, 400);
  let body;
  try { body = JSON.parse(raw); } catch { return respond({status: 'INVALID_JSON'}, 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some(key => key !== 'confirm') || body.confirm !== HOOPS_API_PREVIEW_CONFIRM) return respond({status: 'CONFIRMATION_REQUIRED'}, 400);
  try {
    const result = await testHoopsPreviewOnce({key: process.env.HOOPS_API_KEY});
    return respond(result, result.status === 'HOOPSAPI_RATE_LIMITED' ? 429 : result.status === 'HOOPSAPI_PROVIDER_UNAVAILABLE' ? 502 : 200);
  } catch (error) {
    const status = error instanceof Error && [
      'HOOPSAPI_RESPONSE_TOO_LARGE', 'HOOPSAPI_RESPONSE_INVALID',
      'HOOPSAPI_GAME_IDENTITY_INVALID', 'HOOPSAPI_QUOTE_LIMIT_EXCEEDED', 'HOOPSAPI_RESPONSE_NOT_JSON',
    ].includes(error.message) ? error.message : 'HOOPSAPI_PREVIEW_FAILED';
    return respond({status}, 503);
  }
}
