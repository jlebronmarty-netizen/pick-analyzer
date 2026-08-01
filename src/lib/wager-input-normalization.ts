export type NormalizedNumber = {
  value: number | null
  display: string
  error: string | null
}

function clean(input: unknown) {
  if (input === null || input === undefined) return ''
  return String(input).trim().replaceAll(',', '')
}

export function normalizeMoneyInput(input: unknown): NormalizedNumber {
  const raw = clean(input)
  if (!raw) return { value: null, display: '', error: 'Amount is required.' }
  const value = Number(raw)
  if (!Number.isFinite(value)) return { value: null, display: String(input ?? ''), error: 'Amount must be numeric.' }
  if (value <= 0) return { value: null, display: String(input ?? ''), error: 'Amount must be greater than zero.' }
  const rounded = Math.round(value * 100) / 100
  return { value: rounded, display: Number.isInteger(rounded) ? String(rounded) : String(rounded), error: null }
}

export function normalizeOptionalLineInput(input: unknown): NormalizedNumber {
  const raw = clean(input)
  if (!raw) return { value: null, display: '', error: null }
  const value = Number(raw)
  if (!Number.isFinite(value)) return { value: null, display: String(input ?? ''), error: 'Line must be numeric.' }
  return { value, display: value > 0 ? `+${value}` : String(value), error: null }
}

export function normalizeAmericanOddsInput(input: unknown): NormalizedNumber {
  const raw = clean(input)
  if (!raw) return { value: null, display: '', error: 'American odds are required.' }
  const value = Number(raw)
  if (!Number.isInteger(value)) return { value: null, display: String(input ?? ''), error: 'American odds must be a whole number.' }
  if (value === 0) return { value: null, display: String(input ?? ''), error: 'American odds cannot be zero.' }
  if (Math.abs(value) < 100) return { value: null, display: String(input ?? ''), error: 'American odds must be +100 or greater, or -100 or lower.' }
  return { value, display: value > 0 ? `+${value}` : String(value), error: null }
}
