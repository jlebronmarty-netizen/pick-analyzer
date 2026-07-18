import { readdir } from 'fs/promises'
import path from 'path'
import { NextRequest } from 'next/server'
import { apiOk, requestId } from '@/lib/api-contract'

async function countRouteFiles(dir: string): Promise<number> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  let total = 0
  for (const entry of entries) {
    const next = path.join(dir, entry.name)
    if (entry.isDirectory()) total += await countRouteFiles(next)
    else if (entry.name === 'route.ts' || entry.name === 'route.js') total += 1
  }
  return total
}

export async function GET(request: NextRequest) {
  const id = requestId(request)
  const routeFiles = await countRouteFiles(path.join(process.cwd(), 'src', 'app', 'api'))
  const apiRouteCount = routeFiles || Number(process.env.NEXT_PUBLIC_API_ROUTE_COUNT ?? 245)
  return apiOk(
    {
      app: 'Pick Analyzer',
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
      release: process.env.NEXT_PUBLIC_APP_VERSION ?? process.env.npm_package_version ?? '0.1.0',
      gitCommit: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? 'unknown',
      buildTimestamp: process.env.NEXT_PUBLIC_BUILD_TIMESTAMP ?? process.env.BUILD_TIMESTAMP ?? 'runtime',
      staticPageCount: Number(process.env.NEXT_PUBLIC_STATIC_PAGE_COUNT ?? 235),
      apiRouteCount,
      providerCallsMade: 0,
    },
    id
  )
}
