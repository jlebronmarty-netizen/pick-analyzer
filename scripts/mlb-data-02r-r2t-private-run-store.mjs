import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

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
  const load = key => fs.existsSync(file(key)) ? JSON.parse(fs.readFileSync(file(key), 'utf8')) : null
  const save = (key, value) => {
    const destination = file(key)
    const pending = path.join(resolved, `${key}-${randomUUID()}.pending`)
    fs.writeFileSync(pending, JSON.stringify(value), { flag: 'wx' })
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
