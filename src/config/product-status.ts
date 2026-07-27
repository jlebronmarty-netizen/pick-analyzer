export const PRODUCT_STATUSES = [
  'Production',
  'Certified',
  'Foundation',
  'Preview',
  'Planning',
  'Unavailable',
  'Blocked',
  'Pending',
  'Deprecated',
] as const

export type ProductStatus = (typeof PRODUCT_STATUSES)[number]
export type ProductStatusTone = 'green' | 'blue' | 'yellow' | 'red' | 'gray'

export const PRODUCT_STATUS_TONE: Record<ProductStatus, ProductStatusTone> = {
  Production: 'green',
  Certified: 'green',
  Foundation: 'blue',
  Preview: 'yellow',
  Planning: 'gray',
  Unavailable: 'gray',
  Blocked: 'red',
  Pending: 'yellow',
  Deprecated: 'gray',
}

export const PRODUCT_STATUS_DESCRIPTION: Record<ProductStatus, string> = {
  Production: 'Available on certified production workflows.',
  Certified: 'Verified for the named scope with evidence and guardrails.',
  Foundation: 'Data or architecture foundation exists, but product activation is gated.',
  Preview: 'Useful for review, not a promoted production decision surface.',
  Planning: 'Documented future scope with no active product claim.',
  Unavailable: 'No supported current product capability is available.',
  Blocked: 'Explicitly blocked by missing data, entitlement, migration, or approval.',
  Pending: 'Prepared but waiting for an approved gate.',
  Deprecated: 'Preserved only for compatibility or historical reference.',
}

export function productStatusTone(status: ProductStatus): ProductStatusTone {
  return PRODUCT_STATUS_TONE[status]
}
