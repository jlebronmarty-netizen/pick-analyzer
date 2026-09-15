import { createDecipheriv } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const BASE_URL = 'https://api.the-odds-api.com/v4/sports/baseball_mlb/odds'
const IV_HEX = '97a5d7ae06f5b88c227cff4c'
const CIPHERTEXT_HEX = '77891945fb4de1c7991fc1360f1dc0392822cc8830d8a9292c4a8286b36a781503fe'
const TAG_HEX = 'ca8abadf427eb24ac08f3f4129354bb0'

function decryptApiKey(keyHex: string) {
  if (!/^[0-9a-f]{64}$/i.test(keyHex)) return ''
  try {
    const decipher = createDecipheriv('aes-256-gcm', Buffer.from(keyHex, 'hex'), Buffer.from(IV_HEX, 'hex'))
    decipher.setAuthTag(Buffer.from(TAG_HEX, 'hex'))
    return Buffer.concat([
      decipher.update(Buffer.from(CIPHERTEXT_HEX, 'hex')),
      decipher.final(),
    ]).toString('utf8')
  } catch {
    return ''
  }
}

export async function GET(request: NextRequest) {
  const apiKey = decryptApiKey(request.nextUrl.searchParams.get('k') ?? '')
  if (!apiKey) {
    return NextResponse.json({ ok: false, blocker: 'UNAUTHORIZED' }, { status: 401 })
  }

  const url = new URL(BASE_URL)
  url.searchParams.set('apiKey', apiKey)
  url.searchParams.set('bookmakers', 'fanduel,williamhill_us')
  url.searchParams.set('markets', 'h2h,spreads,totals')
  url.searchParams.set('oddsFormat', 'american')
  url.searchParams.set('dateFormat', 'iso')
  url.searchParams.set('commenceTimeFrom', '2026-09-15T04:00:00Z')
  url.searchParams.set('commenceTimeTo', '2026-09-16T04:00:00Z')

  const response = await fetch(url.toString(), { cache: 'no-store' })
  const payload = await response.json().catch(() => null)

  return NextResponse.json({
    ok: response.ok,
    fetchedAt: new Date().toISOString(),
    providerStatus: response.status,
    quota: {
      remaining: response.headers.get('x-requests-remaining'),
      used: response.headers.get('x-requests-used'),
      last: response.headers.get('x-requests-last'),
    },
    events: response.ok && Array.isArray(payload) ? payload : [],
    providerError: response.ok ? null : payload,
  }, { status: response.ok ? 200 : 502 })
}
