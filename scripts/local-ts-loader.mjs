import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const root = process.cwd()

function resolveAlias(specifier) {
  if (!specifier.startsWith('@/')) return null
  const base = path.join(root, 'src', specifier.slice(2))
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`, path.join(base, 'index.ts')]
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'server-only') {
    return {
      url: 'data:text/javascript,export%20{}',
      shortCircuit: true,
    }
  }

  const aliasPath = resolveAlias(specifier)
  if (aliasPath) {
    return {
      url: pathToFileURL(aliasPath).href,
      shortCircuit: true,
    }
  }

  return nextResolve(specifier, context)
}
