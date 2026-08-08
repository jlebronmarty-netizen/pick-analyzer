export type GreetingLocale = 'EN' | 'ES'

export const DEFAULT_DISPLAY_TIMEZONE = 'America/Puerto_Rico'

type GreetingInput = {
  date?: Date
  timeZone?: string | null
  locale?: GreetingLocale
}

type GreetingResult = {
  greeting: string
  dayPart: 'morning' | 'afternoon' | 'evening'
  hour: number
  timeZone: string
}

function zonedHour(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const rawHour = Number(parts.find((part) => part.type === 'hour')?.value)
  if (!Number.isFinite(rawHour)) return null
  return ((rawHour % 24) + 24) % 24
}

function greetingFor(dayPart: GreetingResult['dayPart'], locale: GreetingLocale) {
  if (locale === 'ES') {
    if (dayPart === 'morning') return 'Buenos dias.'
    if (dayPart === 'afternoon') return 'Buenas tardes.'
    return 'Buenas noches.'
  }
  if (dayPart === 'morning') return 'Good Morning.'
  if (dayPart === 'afternoon') return 'Good Afternoon.'
  return 'Good Evening.'
}

export function getTimeOfDayGreeting({
  date = new Date(),
  timeZone,
  locale = 'EN',
}: GreetingInput = {}): GreetingResult {
  const preferredTimeZone = timeZone || DEFAULT_DISPLAY_TIMEZONE
  let resolvedTimeZone = preferredTimeZone
  let hour = zonedHour(date, resolvedTimeZone)
  if (hour === null) {
    resolvedTimeZone = DEFAULT_DISPLAY_TIMEZONE
    hour = zonedHour(date, resolvedTimeZone) ?? date.getUTCHours()
  }
  const dayPart = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
  return {
    greeting: greetingFor(dayPart, locale),
    dayPart,
    hour,
    timeZone: resolvedTimeZone,
  }
}
