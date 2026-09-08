// Preload for R2S certification only. Legacy validator outputs and caches are isolated.
import fs from 'node:fs'
import path from 'node:path'
import { syncBuiltinESMExports } from 'node:module'

const root = process.cwd()
const isolated = process.env.R2S_VALIDATION_DIR
if (!isolated || !path.isAbsolute(isolated)) throw new Error('R2S_VALIDATION_DIR_REQUIRED')
const original = Object.fromEntries(['existsSync', 'readFileSync', 'writeFileSync', 'mkdirSync', 'appendFileSync', 'statSync', 'readdirSync'].map((key) => [key, fs[key].bind(fs)]))
function mapped(file, writing = false) {
  if (typeof file !== 'string' && !(file instanceof URL)) return file
  const resolved = file instanceof URL ? file : path.resolve(file)
  if (resolved instanceof URL) return file
  const relative = path.relative(root, resolved).replaceAll('\\', '/')
  if (relative === '.worktrees' || relative.startsWith('.worktrees/')) throw new Error('R2S_PROTECTED_WORKTREES_ACCESS')
  if (relative === '.tmp' || relative.startsWith('.tmp/')) return path.join(isolated, 'cache', relative.slice(4))
  if (relative === 'docs/CERTIFICATION' || relative.startsWith('docs/CERTIFICATION/')) {
    const redirected = path.join(isolated, 'artifacts', path.relative(path.join(root, 'docs/CERTIFICATION'), resolved))
    return writing || original.existsSync(redirected) ? redirected : file
  }
  if (writing && !resolved.startsWith(isolated + path.sep) && resolved !== isolated) throw new Error('R2S_UNEXPECTED_FILE_WRITE')
  return file
}
for (const name of ['existsSync', 'readFileSync', 'statSync', 'readdirSync']) {
  fs[name] = (file, ...args) => original[name](mapped(file), ...args)
}
fs.mkdirSync = (file, ...args) => original.mkdirSync(mapped(file, true), ...args)
for (const name of ['writeFileSync', 'appendFileSync']) {
  fs[name] = (file, ...args) => {
    const target = mapped(file, true)
    original.mkdirSync(path.dirname(target), { recursive: true })
    return original[name](target, ...args)
  }
}
syncBuiltinESMExports()

// Explicitly discard inherited live authorization. Test authorization stays injected.
delete process.env.MLB_DATA_02R_R2_LIVE_EXECUTION_AUTHORIZED
delete process.env.MLB_DATA_02R_R2_EXECUTION_AUTHORIZED
delete process.env.MLB_DATA_02R_R2_ALLOW_CERTIFIED_COMPONENT_EXECUTION
const realFetch = globalThis.fetch
const ledger = { readOnlyRequests: 0, forbiddenRequests: 0, skippedOptionalReads: 0, providerCalls: 0, productionDml: 0, productionDdl: 0 }
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
  const method = String(init.method ?? input?.method ?? 'GET').toUpperCase()
  if (method === 'GET' && url.origin === 'https://pick-analyzer.vercel.app' && url.pathname === '/api/operating-day/automation/status') {
    ledger.skippedOptionalReads += 1
    throw new Error('R2S_OPTIONAL_AUTOMATION_STATUS_NOT_REQUESTED')
  }
  const dbOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : null
  const allowed = ['GET', 'HEAD'].includes(method) && (
    (url.origin === dbOrigin && url.pathname.startsWith('/rest/v1/') && !url.pathname.startsWith('/rest/v1/rpc/')) ||
    (url.origin === 'https://pick-analyzer.vercel.app' && url.pathname === '/api/system/version')
  )
  if (!allowed) { ledger.forbiddenRequests += 1; throw new Error('R2S_FORBIDDEN_NETWORK_REQUEST') }
  ledger.readOnlyRequests += 1
  return realFetch(input, { ...init, redirect: 'error' })
}
process.on('exit', () => {
  original.mkdirSync(isolated, { recursive: true })
  original.writeFileSync(path.join(isolated, `network-${process.pid}.json`), JSON.stringify(ledger))
  if (ledger.forbiddenRequests) process.exitCode = 1
})
