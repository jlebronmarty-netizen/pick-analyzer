import { NextRequest } from 'next/server'

import { apiOk, requestId } from '@/lib/api-contract'
import { getPick2R1fManifestAuthorityStatus } from '@/lib/pick2-r1f-manifest-authority'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  const authority = getPick2R1fManifestAuthorityStatus()

  return apiOk(
    {
      manifestContractId: authority.manifestContractId,
      manifestDigest: authority.manifestDigest,
      expectedDigestConfigured: authority.expectedDigestConfigured,
      expectedDigestMatchesManifest: authority.expectedDigestMatchesManifest,
      criticalCodeIntegrity: authority.criticalCodeIntegrity,
      criticalFileMismatchCount: authority.criticalFileMismatchCount,
      featureVersion: authority.featureVersion,
      productionAuthorityReady: authority.productionAuthorityReady,
      failureCode: authority.failureCode,
      gitCommit: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? 'unknown',
    },
    id
  )
}
