import postgres from 'npm:postgres@3.4.7'
import { timingSafeEqual } from 'node:crypto'
import { query } from './query.ts'
import { reviewSchemaCatalog } from './review.mjs'
import contract from './contract.json' with { type: 'json' }

// Only the fixed repository-reviewed SELECT is callable. Request input cannot
// specify SQL, connection strings, tables, or database credentials.
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
})
Deno.serve(async request => {
  // Supabase runtime supplies both legacy and modern server keys. Modern
  // sb_secret keys are not JWTs: authenticate exact server keys here, before DB.
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
  if (request.method !== 'GET' || new URL(request.url).search) return reply(400, { status: 'INVALID_REQUEST' })
  const connection = Deno.env.get('SUPABASE_DB_URL')
  if (!connection) return reply(503, { status: 'BLOCKED', reason: 'DATABASE_CONNECTION_MISSING' })
  const sql = postgres(connection, { max: 1, prepare: false, connect_timeout: 10, idle_timeout: 5 })
  try {
    const result = await sql.begin('read only', async transaction => {
      await transaction`SET LOCAL statement_timeout = '20000ms'`
      return await transaction.unsafe(query)
    })
    if (result.length !== 1 || !result[0].evidence) return reply(503, { status: 'BLOCKED', reason: 'CATALOG_SHAPE' })
    const catalog = result[0].evidence
    const review = reviewSchemaCatalog(catalog, catalog.historicalChecks, contract.expected, contract.constraints, contract.indexes)
    return reply(review.status === 'PASS' ? 200 : 503, { ...review, projectRef: 'ynuocvexviorgdjrfthw', connection: { databaseUrl: 'PRESENT', serverOnly: true, transaction: 'READ_ONLY' } })
  } catch {
    // Never expose driver errors containing connection details.
    return reply(503, { status: 'BLOCKED', reason: 'DATABASE_PREFLIGHT_FAILED' })
  } finally {
    await sql.end({ timeout: 2 }).catch(() => {})
  }
})
