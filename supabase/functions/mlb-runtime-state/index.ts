import postgres from 'npm:postgres@3.4.7'
import { timingSafeEqual } from 'node:crypto'
import { createRuntimeStateAuthority } from '../_shared/mlb-runtime-state.mjs'

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
})

Deno.serve(async request => {
  const secrets = [Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')]
  try {
    const modern = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}')
    if (!modern || typeof modern !== 'object' || Array.isArray(modern)) return reply(503, { status: 'BLOCKED', reason: 'SERVER_KEY_CONFIGURATION' })
    for (const value of Object.values(modern)) if (typeof value === 'string' && value.length > 20) secrets.push(value)
  } catch { return reply(503, { status: 'BLOCKED', reason: 'SERVER_KEY_CONFIGURATION' }) }
  const supplied = new TextEncoder().encode(request.headers.get('authorization') ?? '')
  const authorized = secrets.some(secret => {
    if (!secret) return false
    const expected = new TextEncoder().encode(`Bearer ${secret}`)
    return supplied.length === expected.length && timingSafeEqual(supplied, expected)
  })
  if (!authorized) return reply(401, { status: 'UNAUTHORIZED' })
  if (request.method !== 'POST' || new URL(request.url).search || request.headers.get('content-type')?.split(';')[0] !== 'application/json') return reply(400, { status: 'INVALID_REQUEST' })
  // Stream the small metadata command; never buffer an unbounded request body.
  let size = 0, body = ''
  const reader = request.body?.getReader(), decoder = new TextDecoder()
  if (!reader) return reply(400, { status: 'INVALID_REQUEST' })
  try {
    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > 62000) { await reader.cancel(); return reply(413, { status: 'METADATA_LIMIT' }) }
      body += decoder.decode(chunk.value, { stream: true })
    }
    body += decoder.decode()
  } catch { return reply(400, { status: 'INVALID_REQUEST' }) }
  let command
  try { command = JSON.parse(body) } catch { return reply(400, { status: 'INVALID_REQUEST' }) }
  const connection = Deno.env.get('SUPABASE_DB_URL')
  if (!connection) return reply(503, { status: 'BLOCKED', reason: 'DATABASE_CONNECTION_MISSING' })
  const sql = postgres(connection, { max: 1, prepare: false, connect_timeout: 10, idle_timeout: 5 })
  try {
    const execute = createRuntimeStateAuthority({ transaction: async (fn: (query: (text: string, values?: unknown[]) => Promise<unknown>) => Promise<unknown>) => sql.begin(async tx => {
      await tx`SET LOCAL statement_timeout = '15000ms'`
      await tx`SET LOCAL lock_timeout = '5000ms'`
      await tx`SET LOCAL ROLE service_role`
      return fn((text, values = []) => tx.unsafe(text, values))
    }) })
    const result = await execute(command)
    return reply(200, { status: 'PASS', result })
  } catch (error) {
    const reason = error instanceof Error && /^R6_STATE:[A-Z_]+$/.test(error.message) ? error.message : 'RUNTIME_STATE_TRANSACTION_FAILED'
    return reply(409, { status: 'BLOCKED', reason })
  } finally { await sql.end({ timeout: 2 }).catch(() => {}) }
})
