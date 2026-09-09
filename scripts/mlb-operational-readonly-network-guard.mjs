// Validation preload: Supabase table SELECT only, no provider or mutation call.
import fs from 'node:fs'
import path from 'node:path'
const root = process.env.R2S_VALIDATION_DIR
if (!root || !path.isAbsolute(root)) throw Error('PRIVATE_VALIDATION_ROOT_REQUIRED')
const ledger = { readOnlyDatabaseRequests: 0, blockedRequests: 0, blockedTargets: [], providerCalls: 0, productionDml: 0, productionDdl: 0 }
const original = globalThis.fetch
const save = () => fs.writeFileSync(path.join(root, 'ui-readonly-network.json'), JSON.stringify(ledger))
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
  const method = String(init.method ?? input?.method ?? 'GET').toUpperCase()
  const allowed = ['GET', 'HEAD'].includes(method) && url.origin === new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin && url.pathname.startsWith('/rest/v1/') && !url.pathname.startsWith('/rest/v1/rpc/')
  if (!allowed) { ledger.blockedRequests++; ledger.blockedTargets.push({ method, host: url.hostname, path: url.pathname }); save(); throw Error('READONLY_VALIDATION_NETWORK_BLOCK') }
  ledger.readOnlyDatabaseRequests++; save(); return original(input, { ...init, redirect: 'error' })
}
save()
