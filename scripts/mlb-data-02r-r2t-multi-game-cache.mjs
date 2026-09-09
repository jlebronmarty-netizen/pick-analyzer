// Authorized read-only evidence capture. Output is private and never committed.
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { sha256 } from './mlb-data-02r-r2f-stage-contracts.mjs'
import { createPregameReadRepository } from './mlb-data-02r-r2t-r1-read-repository.mjs'
import { resolvePregameTarget, resolveStarterContext, buildPregameFeatureRows, assemblePregameVector } from './mlb-data-02r-r2t-r1-pregame-contract.mjs'

if (!process.env.R2S_VALIDATION_DIR || !process.env.R2T_MULTI_NATIVE_CACHE) throw new Error('PRIVATE_GUARDED_CACHE_REQUIRED')
const root = process.env.R2S_VALIDATION_DIR
const output = path.join(root, 'private-multi-game-cache.json')
const input = JSON.parse(fs.readFileSync(process.env.R2T_MULTI_NATIVE_CACHE, 'utf8'))
const existing = fs.existsSync(output) ? JSON.parse(fs.readFileSync(output, 'utf8')) : { sourceDigest: sha256(input), cases: [] }
if (existing.sourceDigest !== sha256(input)) throw new Error('PRIVATE_NATIVE_CACHE_DRIFT')
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^(NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '')
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const repository = createPregameReadRepository(db)
const eligible = input.nativeRows.map(r => r.game_pk)
for (const native of input.nativeRows) {
  const target = resolvePregameTarget({ native, runAsOf: input.runAsOf, eligibleGamePks: eligible })
  const starters = resolveStarterContext(target)
  let captured = existing.cases.find(c => c.target.gamePk === target.gamePk)
  if (!captured) {
    console.log(JSON.stringify({ stage: 'READ_ONLY_DEPENDENCIES', targetCount: eligible.length, capturedCount: existing.cases.length }))
    const dependencies = await repository.readDependencies(target, starters)
    captured = { target, starters, dependencies, digest: sha256(dependencies) }
    existing.cases.push(captured)
    fs.writeFileSync(output, JSON.stringify(existing))
  }
  if (sha256(captured.dependencies) !== captured.digest) throw new Error('DEPENDENCY_CACHE_DRIFT')
  const built = buildPregameFeatureRows({ target, starters, rawRows: captured.dependencies.rows, dependencyGamePks: captured.dependencies.dependencyGamePks })
  const vector = assemblePregameVector({ target, starters, built })
  console.log(JSON.stringify({ status: 'REAL_CASE_READY', featureCount: vector.values.length, casesReady: existing.cases.length }))
}
console.log(JSON.stringify({ status: 'MULTI_GAME_PRIVATE_REPLAY_READY', cases: existing.cases.length, providerCalls: 0, productionDml: 0, productionDdl: 0 }))
