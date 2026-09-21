import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

function cronSecret() {
  return process.env.CRON_SECRET?.trim() ?? ''
}

function authorized(request: NextRequest) {
  const secret = cronSecret()
  return Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  const environment = process.env.VERCEL_ENV ?? 'unknown'
  const branch = process.env.VERCEL_GIT_COMMIT_REF ?? null

  if (environment === 'production') {
    if (!cronSecret()) {
      return Response.json({ ok: false, code: 'BLOCKED_MISSING_CRON_SECRET' }, { status: 503 })
    }
    if (!authorized(request)) {
      return Response.json({ ok: false, code: 'UNAUTHORIZED' }, { status: 401 })
    }
  }

  return Response.json({
    ok: true,
    environment,
    branch,
    provider: 'balldontlie',
    configured: Boolean(process.env.BALLDONTLIE_API_KEY),
    providerCallsMade: 0,
    secretValueExposed: false,
  })
}
