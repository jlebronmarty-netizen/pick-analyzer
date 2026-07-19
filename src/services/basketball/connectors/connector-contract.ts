import type { BasketballCanonicalEntity } from '@/services/basketball/types/entities'
import {
  BASKETBALL_CAPABILITIES,
  type BasketballCapability,
  type BasketballConnectorCapabilityResult,
  type BasketballPlatformScope,
  type BasketballSourcePriority,
  notSupportedCapability,
} from '@/services/basketball/contracts/capabilities'

export type BasketballConnectorResult<T> = {
  success: boolean
  capability: BasketballCapability
  status: 'ok' | 'partial' | 'not_supported' | 'blocked' | 'empty'
  sourceId: string
  fetchedAt: string
  providerCallsMade: number
  records: T[]
  warnings: string[]
}

export type BasketballConnector = {
  id: string
  displayName: string
  sourcePriority: BasketballSourcePriority
  discoverCapabilities(): BasketballConnectorCapabilityResult[]
  acquire(scope: BasketballPlatformScope, capability: BasketballCapability): Promise<BasketballConnectorResult<BasketballCanonicalEntity>>
}

export function createCompatibilityConnector({
  id,
  displayName,
  sourcePriority = 'compatible_connector',
  supported = [],
}: {
  id: string
  displayName: string
  sourcePriority?: BasketballSourcePriority
  supported?: BasketballConnectorCapabilityResult[]
}): BasketballConnector {
  const supportedMap = new Map(supported.map((capability) => [capability.capability, capability]))
  return {
    id,
    displayName,
    sourcePriority,
    discoverCapabilities() {
      return BASKETBALL_CAPABILITIES.map((capability) =>
        supportedMap.get(capability) ?? notSupportedCapability(capability, sourcePriority)
      )
    },
    async acquire(_scope, capability) {
      const declared = supportedMap.get(capability)
      if (!declared || declared.status === 'not_supported') {
        return {
          success: true,
          capability,
          status: 'not_supported',
          sourceId: id,
          fetchedAt: new Date().toISOString(),
          providerCallsMade: 0,
          records: [],
          warnings: [`${displayName} does not support ${capability}.`],
        }
      }
      return {
        success: true,
        capability,
        status: 'empty',
        sourceId: id,
        fetchedAt: new Date().toISOString(),
        providerCallsMade: 0,
        records: [],
        warnings: ['Connector contract is registered; acquisition adapter is not configured.'],
      }
    },
  }
}
