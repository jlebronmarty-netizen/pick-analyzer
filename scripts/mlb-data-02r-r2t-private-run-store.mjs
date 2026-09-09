import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { sha256 } from './mlb-data-02r-r2f-stage-contracts.mjs'

// Operational evidence stays outside the public repository. Exclusive run locks
// prevent concurrent consumers from racing a provider budget or checkpoint.
export function createPrivateRunStore(root) {
  if (!path.isAbsolute(root)) throw new Error('PRIVATE_RUN_ROOT_REQUIRED')
  const resolved = path.resolve(root)
  const relative = path.relative(os.tmpdir(), resolved)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('PRIVATE_RUN_ROOT_MUST_BE_UNDER_OS_TEMP')
  fs.mkdirSync(resolved, { recursive: true })
  if (fs.realpathSync(resolved) !== resolved) throw new Error('PRIVATE_RUN_ROOT_SYMLINK_FORBIDDEN')
  const file = key => {
    if (!/^[a-zA-Z0-9_-]+$/.test(key)) throw new Error('PRIVATE_RUN_KEY_INVALID')
    return path.join(resolved, `${key}.json`)
  }
  const load = key => {
    if (!fs.existsSync(file(key))) return null
    const value = JSON.parse(fs.readFileSync(file(key), 'utf8'))
    if (value?.privateContextShards) {
      if (value.privateContextShards.version !== 1 || !Array.isArray(value.privateContextShards.parts) || value.privateContextShards.parts.length > 50 || !value.evidence || Object.hasOwn(value.evidence, 'contexts')) throw new Error('PRIVATE_CONTEXT_MANIFEST_INVALID')
      value.evidence.contexts = value.privateContextShards.parts.map(part => {
        if (!part.key.startsWith(`${key}-context-`)) throw new Error('PRIVATE_CONTEXT_KEY_INVALID')
        const context = JSON.parse(fs.readFileSync(file(part.key), 'utf8'))
        if (sha256(context) !== part.digest) throw new Error('PRIVATE_CONTEXT_DIGEST_DRIFT')
        return context
      })
      delete value.privateContextShards
    }
    return value
  }
  const save = (key, value) => {
    const destination = file(key)
    const pending = path.join(resolved, `${key}-${randomUUID()}.pending`)
    let payload = value
    if (Array.isArray(value?.evidence?.contexts) && value.evidence.contexts.length) {
      if (value.evidence.contexts.length > 50) throw new Error('PRIVATE_CONTEXT_CAP')
      const generation = randomUUID()
      const parts = value.evidence.contexts.map((context, index) => {
        const partKey = `${key}-context-${generation}-${index}`
        fs.writeFileSync(file(partKey), JSON.stringify(context), { flag: 'wx' })
        return { key: partKey, digest: sha256(context) }
      })
      const { contexts: _contexts, ...evidence } = value.evidence
      payload = { ...value, evidence, privateContextShards: { version: 1, parts } }
    }
    fs.writeFileSync(pending, JSON.stringify(payload), { flag: 'wx' })
    fs.renameSync(pending, destination)
  }
  let lock = null
  return {
    root: resolved, load, save,
    get locked() { return lock !== null },
    acquire() {
      if (lock !== null) throw new Error('PRIVATE_RUN_LOCK_ALREADY_HELD')
      lock = fs.openSync(path.join(resolved, 'mission.lock'), 'wx')
      fs.writeSync(lock, JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() }))
    },
    release() {
      if (lock === null) return
      fs.closeSync(lock); lock = null
      fs.unlinkSync(path.join(resolved, 'mission.lock'))
    },
  }
}
