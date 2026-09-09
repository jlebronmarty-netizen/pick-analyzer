import { timingSafeEqual } from 'node:crypto'
import { runMlbOperationalSchemaPreflight } from '@/services/pick2-mlb-unattended-preflight'
import activation from '../../../../../docs/CERTIFICATION/MLB_OPERATIONAL_AUTOMATION_ACTIVATION.json'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const supplied = Buffer.from(request.headers.get('authorization') ?? '')
  const expected = Buffer.from(`Bearer ${secret ?? ''}`)
  if (!secret || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return reply({ status: 'UNAUTHORIZED' }, 401)
  if (new URL(request.url).search) return reply({ status: 'INVALID_REQUEST' }, 400)
  const keys = ['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_DB_URL', 'DATABASE_URL', 'DIRECT_URL', 'SUPABASE_ACCESS_TOKEN', 'CRON_SECRET']
  const connectionInventory = keys.map(key => ({ name: key, present: Boolean(process.env[key]), serverOnly: !key.startsWith('NEXT_PUBLIC_'), scope: process.env.VERCEL_ENV ?? 'local' }))
  try {
    const preflight = await runMlbOperationalSchemaPreflight()
    return reply({ status: 'PASS', packageSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null, connectionInventory, preflight,
      automationActivation: activation.activation, runtimeBinding: activation.runtimeHost.verified ? 'PERSISTENT_HOST_VERIFIED' : 'PERSISTENT_EXECUTOR_HOST_REQUIRED', providerCalls: 0, productionDml: 0, productionDdl: 0 })
  } catch {
    return reply({ status: 'BLOCKED', reason: 'UNATTENDED_PREFLIGHT_FAILED', connectionInventory, providerCalls: 0, productionDml: 0, productionDdl: 0 }, 503)
  }
}
