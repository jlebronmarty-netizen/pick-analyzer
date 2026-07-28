import fs from 'node:fs'
import path from 'node:path'

const outFile = process.argv[2] ?? null
const root = process.cwd()

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'))
}

function walk(dir, rows = []) {
  if (!fs.existsSync(dir)) return rows
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, rows)
    else rows.push({ file: path.relative(root, full).replaceAll('\\', '/'), bytes: fs.statSync(full).size })
  }
  return rows
}

const prerender = readJson('.next/prerender-manifest.json')
const appRoutes = readJson('.next/app-path-routes-manifest.json')
const routes = readJson('.next/routes-manifest.json')
const staticPrerenderRoutes = Object.keys(prerender.routes ?? {}).sort()
const dynamicPrerenderRoutes = Object.keys(prerender.dynamicRoutes ?? {}).sort()
const appPageRoutes = Object.entries(appRoutes)
  .filter(([key]) => key.endsWith('/page'))
  .map(([page, route]) => ({ page, route }))
  .sort((left, right) => String(left.route).localeCompare(String(right.route)))
const serverFiles = walk(path.join(root, '.next/server'))
  .filter((item) => item.file.endsWith('.js') || item.file.endsWith('.json'))
  .sort((left, right) => right.bytes - left.bytes)
  .slice(0, 30)

const result = {
  generatedAt: new Date().toISOString(),
  mode: 'build_memory_optimization_v1_manifest_audit',
  prerenderRouteCount: staticPrerenderRoutes.length,
  dynamicPrerenderRouteCount: dynamicPrerenderRoutes.length,
  routeManifestStaticRoutes: routes.staticRoutes?.length ?? 0,
  routeManifestDynamicRoutes: routes.dynamicRoutes?.length ?? 0,
  appPageRouteCount: appPageRoutes.length,
  staticPrerenderRoutes,
  dynamicPrerenderRoutes,
  appPageRoutes,
  largestServerFiles: serverFiles,
}

const json = `${JSON.stringify(result, null, 2)}\n`
if (outFile) fs.writeFileSync(path.join(root, outFile), json)
console.log(json)
