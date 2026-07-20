import 'server-only'

export type TimestampClassification =
  | 'UTC_INSTANT'
  | 'EASTERN_LOCAL_TIME'
  | 'USER_LOCAL_DISPLAY'
  | 'UNKNOWN'
  | 'INVALID'

export type ProviderTimestampNormalization = {
  raw: string | null
  classification: TimestampClassification
  providerTimezone: string | null
  normalizedUtc: string | null
  source: string
  warnings: string[]
}

export const MLB_PROVIDER_TIMEZONE = 'America/New_York'
export const MLB_DISPLAY_TIMEZONE = 'America/Puerto_Rico'

const EXPLICIT_OFFSET_PATTERN = /(?:z|[+-]\d{2}:?\d{2})$/i
const NAIVE_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?)?$/

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function datePartsInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value)
  const hour = get('hour')
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: hour === 24 ? 0 : hour,
    minute: get('minute'),
    second: get('second'),
  }
}

function epochFromParts(parts: { year: number; month: number; day: number; hour: number; minute: number; second: number }) {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
}

function parseNaiveParts(raw: string) {
  const match = raw.trim().match(NAIVE_DATE_TIME_PATTERN)
  if (!match) return null
  const [, year, month, day, hour = '0', minute = '0', second = '0'] = match
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
  }
}

export function parseLocalTimeInZone(raw: string, timeZone: string) {
  const desired = parseNaiveParts(raw)
  if (!desired) return null
  let utcMs = epochFromParts(desired)
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = datePartsInTimeZone(new Date(utcMs), timeZone)
    const delta = epochFromParts(desired) - epochFromParts(actual)
    if (delta === 0) return new Date(utcMs).toISOString()
    utcMs += delta
  }
  const finalParts = datePartsInTimeZone(new Date(utcMs), timeZone)
  return epochFromParts(finalParts) === epochFromParts(desired) ? new Date(utcMs).toISOString() : null
}

export function normalizeProviderTimestamp({
  value,
  source,
  providerTimezone = null,
  documentedClassification = 'UNKNOWN',
}: {
  value: unknown
  source: string
  providerTimezone?: string | null
  documentedClassification?: TimestampClassification
}): ProviderTimestampNormalization {
  const raw = typeof value === 'number' && Number.isFinite(value)
    ? String(value)
    : typeof value === 'string' && value.trim()
      ? value.trim()
      : null
  if (!raw) {
    return {
      raw: null,
      classification: 'UNKNOWN',
      providerTimezone,
      normalizedUtc: null,
      source,
      warnings: ['Timestamp is missing.'],
    }
  }

  if (EXPLICIT_OFFSET_PATTERN.test(raw)) {
    const parsed = new Date(raw)
    return Number.isFinite(parsed.getTime())
      ? {
          raw,
          classification: 'UTC_INSTANT',
          providerTimezone: raw.toLowerCase().endsWith('z') ? 'UTC' : providerTimezone,
          normalizedUtc: parsed.toISOString(),
          source,
          warnings: [],
        }
      : {
          raw,
          classification: 'INVALID',
          providerTimezone,
          normalizedUtc: null,
          source,
          warnings: ['Explicit timestamp could not be parsed.'],
        }
  }

  if (documentedClassification === 'EASTERN_LOCAL_TIME' && providerTimezone) {
    const normalizedUtc = parseLocalTimeInZone(raw, providerTimezone)
    return normalizedUtc
      ? {
          raw,
          classification: 'EASTERN_LOCAL_TIME',
          providerTimezone,
          normalizedUtc,
          source,
          warnings: [],
        }
      : {
          raw,
          classification: 'INVALID',
          providerTimezone,
          normalizedUtc: null,
          source,
          warnings: [`Naive provider timestamp could not be interpreted in ${providerTimezone}.`],
        }
  }

  return {
    raw,
    classification: 'UNKNOWN',
    providerTimezone,
    normalizedUtc: null,
    source,
    warnings: ['Naive timestamp has no documented timezone and was not parsed.'],
  }
}

export function normalizeSportsDataIoMlbGameDateTime(row: Record<string, unknown>) {
  const explicitUtc = row.DateTimeUTC
  if (explicitUtc !== null && explicitUtc !== undefined && String(explicitUtc).trim()) {
    return normalizeProviderTimestamp({
      value: explicitUtc,
      source: 'SportsDataIO MLB DateTimeUTC',
      providerTimezone: 'UTC',
      documentedClassification: 'UTC_INSTANT',
    })
  }
  const local = row.DateTime ?? row.GameInfoDateTime ?? row.GameDate ?? row.Day
  return normalizeProviderTimestamp({
    value: local,
    source: 'SportsDataIO MLB DateTime',
    providerTimezone: MLB_PROVIDER_TIMEZONE,
    documentedClassification: 'EASTERN_LOCAL_TIME',
  })
}

export function formatInTimeZone(value: string | null | undefined, timeZone = MLB_DISPLAY_TIMEZONE) {
  if (!value) return null
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) return null
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(parsed)
}

export function localDateInTimeZone(value: string | null | undefined, timeZone = MLB_DISPLAY_TIMEZONE) {
  if (!value) return null
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(parsed)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value
  return year && month && day ? `${year}-${month}-${day}` : null
}

export function zonedUtcRange(localDate: string, timeZone = MLB_DISPLAY_TIMEZONE) {
  const start = parseLocalTimeInZone(`${localDate}T00:00:00`, timeZone)
  const endDate = new Date(`${localDate}T12:00:00.000Z`)
  endDate.setUTCDate(endDate.getUTCDate() + 1)
  const nextLocal = `${endDate.getUTCFullYear()}-${pad(endDate.getUTCMonth() + 1)}-${pad(endDate.getUTCDate())}`
  const end = parseLocalTimeInZone(`${nextLocal}T00:00:00`, timeZone)
  return {
    localDate,
    timezone: timeZone,
    utcStart: start ?? `${localDate}T00:00:00.000Z`,
    utcEndExclusive: end ?? new Date(Date.parse(start ?? `${localDate}T00:00:00.000Z`) + 86_400_000).toISOString(),
  }
}

export function normalizeStoredSportsDataIoMlbStart({
  startTime,
  metadata,
  providerIds,
}: {
  startTime: string | null | undefined
  metadata?: Record<string, unknown> | null
  providerIds?: Record<string, unknown> | null
}) {
  const parsed = normalizeProviderTimestamp({
    value: startTime,
    source: 'sport_events.start_time',
    providerTimezone: 'UTC',
    documentedClassification: 'UTC_INSTANT',
  })
  const meta = metadata && typeof metadata === 'object' ? metadata : {}
  const temporal = meta.temporalNormalization && typeof meta.temporalNormalization === 'object'
    ? meta.temporalNormalization as Record<string, unknown>
    : null
  const provider = String(meta.provider ?? '').toLowerCase()
  const variant = String(meta.provider_variant ?? '').toLowerCase()
  const rawFields = Array.isArray(meta.rawFieldNames) ? meta.rawFieldNames.map(String) : []
  const ids = providerIds && typeof providerIds === 'object' ? providerIds : {}
  const providerIdKeys = Object.keys(ids).map((key) => key.toLowerCase())
  const hasSportsDataIoProviderId = providerIdKeys.some((key) => key.includes('sportsdataio') || key.includes('sports_data_io'))
  const sportsDataIoMlb = provider === 'sportsdataio' || variant.includes('sportsdataio') || hasSportsDataIoProviderId
  const hasDateTimeUtc = rawFields.some((field) => field.toLowerCase() === 'datetimeutc')
  const alreadyNormalized = temporal?.contract === 'mlb_temporal_truth_v1'
  const displayTimezone = MLB_DISPLAY_TIMEZONE

  if (!parsed.normalizedUtc || !sportsDataIoMlb || hasDateTimeUtc || alreadyNormalized) {
    return {
      ...parsed,
      storedUtc: parsed.normalizedUtc,
      canonicalUtc: parsed.normalizedUtc,
      legacyRepairApplied: false,
      interpretationMode: alreadyNormalized ? 'stored_temporal_contract' : 'stored_utc_instant',
      displayTimezone,
      temporalConfidence: parsed.normalizedUtc ? 'HIGH' : 'LOW',
      displayTime: formatInTimeZone(parsed.normalizedUtc, displayTimezone),
    }
  }

  const naive = parsed.normalizedUtc.replace('.000Z', '').replace('Z', '')
  const repairedUtc = parseLocalTimeInZone(naive, MLB_PROVIDER_TIMEZONE)
  return {
    raw: startTime ?? null,
    classification: 'EASTERN_LOCAL_TIME' as const,
    providerTimezone: MLB_PROVIDER_TIMEZONE,
    normalizedUtc: repairedUtc,
    storedUtc: parsed.normalizedUtc,
    canonicalUtc: repairedUtc,
    legacyRepairApplied: Boolean(repairedUtc),
    interpretationMode: 'legacy_sportsdataio_eastern_repair',
    displayTimezone,
    temporalConfidence: repairedUtc ? 'MEDIUM' : 'LOW',
    displayTime: formatInTimeZone(repairedUtc, displayTimezone),
    source: 'sport_events.start_time legacy SportsDataIO DateTime repair',
    warnings: repairedUtc
      ? ['Legacy SportsDataIO MLB start_time was reinterpreted as America/New_York local time at read time.']
      : ['Legacy SportsDataIO MLB start_time could not be repaired.'],
  }
}

export function validateProviderTimeNormalizationFixtures() {
  const edt = normalizeProviderTimestamp({
    value: '2026-07-19T12:15:00',
    source: 'fixture',
    providerTimezone: MLB_PROVIDER_TIMEZONE,
    documentedClassification: 'EASTERN_LOCAL_TIME',
  })
  const est = normalizeProviderTimestamp({
    value: '2026-01-15T19:05:00',
    source: 'fixture',
    providerTimezone: MLB_PROVIDER_TIMEZONE,
    documentedClassification: 'EASTERN_LOCAL_TIME',
  })
  const utc = normalizeProviderTimestamp({ value: '2026-07-19T16:15:00Z', source: 'fixture' })
  const offset = normalizeProviderTimestamp({ value: '2026-07-19T12:15:00-04:00', source: 'fixture' })
  const repaired = normalizeStoredSportsDataIoMlbStart({
    startTime: '2026-07-19T12:15:00.000Z',
    metadata: {
      provider: 'sportsdataio',
      provider_variant: 'sportsdataio_discovery_lab',
      rawFieldNames: ['DateTime'],
    },
  })
  const repairedFromProviderIds = normalizeStoredSportsDataIoMlbStart({
    startTime: '2026-07-19T12:15:00.000Z',
    metadata: null,
    providerIds: { sportsdataio: '1001' },
  })
  const invalid = normalizeProviderTimestamp({
    value: 'not-a-date',
    source: 'fixture',
    providerTimezone: MLB_PROVIDER_TIMEZONE,
    documentedClassification: 'EASTERN_LOCAL_TIME',
  })
  const checks = [
    ['EDT naive Eastern converts to UTC', edt.normalizedUtc === '2026-07-19T16:15:00.000Z'],
    ['EST naive Eastern converts to UTC', est.normalizedUtc === '2026-01-16T00:05:00.000Z'],
    ['UTC instant remains stable', utc.normalizedUtc === '2026-07-19T16:15:00.000Z'],
    ['explicit offset remains stable', offset.normalizedUtc === '2026-07-19T16:15:00.000Z'],
    ['legacy SportsDataIO repair applies DST', repaired.canonicalUtc === '2026-07-19T16:15:00.000Z'],
    ['legacy SportsDataIO provider_ids repair applies DST', repairedFromProviderIds.canonicalUtc === '2026-07-19T16:15:00.000Z'],
    ['invalid timestamp is explicit', invalid.classification === 'INVALID'],
    ['Puerto Rico display date stable', localDateInTimeZone('2026-07-19T16:15:00.000Z') === '2026-07-19'],
    ['server timezone independent by construction', parseLocalTimeInZone('2026-07-19T12:15:00', MLB_PROVIDER_TIMEZONE) === '2026-07-19T16:15:00.000Z'],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'provider_time_normalization_fixtures_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    examples: { edt, est, utc, offset, repaired, repairedFromProviderIds, invalid },
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
