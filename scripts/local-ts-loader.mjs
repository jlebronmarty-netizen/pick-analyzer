import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = process.cwd()
const extensions = ['', '.ts', '.tsx', '.js', '.mjs', '/index.ts']

function resolveAlias(specifier) {
  if (!specifier.startsWith('@/')) return null
  const base = path.join(root, 'src', specifier.slice(2))
  const candidates = extensions.map((extension) => extension.startsWith('/') ? path.join(base, extension) : `${base}${extension}`)
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null
}

function resolveRelative(specifier, parentUrl) {
  if (!specifier.startsWith('.') || !parentUrl?.startsWith('file:')) return null
  const parentPath = fileURLToPath(parentUrl)
  const base = path.resolve(path.dirname(parentPath), specifier)
  const candidates = extensions.map((extension) => extension.startsWith('/') ? path.join(base, extension) : `${base}${extension}`)
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

  const relativePath = resolveRelative(specifier, context.parentURL)
  if (relativePath) {
    return {
      url: pathToFileURL(relativePath).href,
      shortCircuit: true,
    }
  }

  return nextResolve(specifier, context)
}
