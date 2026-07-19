import 'server-only'

import type {
  BasketballCapability,
  BasketballConnectorCapabilityResult,
} from '@/services/basketball/contracts/capabilities'
import { notSupportedCapability } from '@/services/basketball/contracts/capabilities'

export const OFFICIAL_BSN_HOMEPAGE_CONNECTOR_ID = 'official_bsn_homepage'
export const OFFICIAL_BSN_HOMEPAGE_URL = 'https://www.bsnpr.com/'
export const OFFICIAL_BSN_HOMEPAGE_TTL_SECONDS = 6 * 60 * 60
const MAX_TEAM_PAGE_CALLS = 12
const REQUEST_SPACING_MS = 250
const MAX_RETRIES = 2

export type OfficialBsnStandingRow = {
  rank: number
  group: string
  teamName: string
  gamesPlayed: number
  wins: number
  losses: number
  winPercentage: number | null
  providerTeamId: string
  providerStandingId: string
}

export type OfficialBsnTeam = {
  providerTeamId: string
  teamName: string
  group: string
  rank: number
  teamCode: string | null
  teamUrl: string | null
  fullName: string | null
  recordText: string | null
}

export type OfficialBsnResult = {
  providerGameId: string
  sourceTeamId: string
  dateLabel: string
  gameDate: string | null
  status: 'completed'
  awayTeamCode: string
  awayTeamName: string | null
  awayScore: number
  homeTeamCode: string
  homeTeamName: string | null
  homeScore: number
  sourceUrl: string
}

export type OfficialBsnUpcomingGame = {
  providerGameId: string
  sourceTeamId: string
  dateLabel: string | null
  gameDate: string | null
  startTimeLabel: string | null
  awayTeamName: string | null
  homeTeamName: string | null
  venue: string | null
  sourceUrl: string
}

export type OfficialBsnPlayer = {
  providerPlayerId: string
  playerName: string
  teamName: string | null
  teamId: string | null
  position: string | null
  sourceUrl: string
}

export type OfficialBsnTeamLeader = {
  providerLeaderId: string
  teamId: string
  playerName: string
  statCategory: string
  value: number | null
  sourceUrl: string
}

export type OfficialBsnHomepageSnapshot = {
  success: true
  sourceId: typeof OFFICIAL_BSN_HOMEPAGE_CONNECTOR_ID
  sourceUrl: typeof OFFICIAL_BSN_HOMEPAGE_URL
  fetchedAt: string
  freshness: 'fresh' | 'stale'
  providerCallsMade: number
  fromCache: boolean
  season: string | null
  standings: OfficialBsnStandingRow[]
  teams: OfficialBsnTeam[]
  results: OfficialBsnResult[]
  upcomingGames: OfficialBsnUpcomingGame[]
  players: OfficialBsnPlayer[]
  teamLeaders: OfficialBsnTeamLeader[]
  capabilities: BasketballConnectorCapabilityResult[]
  warnings: string[]
  checkpoint: {
    id: string
    startedAt: string
    completedAt: string
    pagesPlanned: string[]
    pagesFetched: string[]
    pagesFailed: Array<{ url: string; reason: string }>
    resumeToken: string | null
    rateLimit: { spacingMs: number; maxTeamPages: number; maxRetries: number }
  }
}

type CacheEntry = {
  fetchedAtMs: number
  snapshot: OfficialBsnHomepageSnapshot
}

type FetchPage = {
  url: string
  html: string | null
  error: string | null
}

let homepageCache: CacheEntry | null = null

const SUPPORTED_CAPABILITIES = new Set<BasketballCapability>([
  'teams',
  'players',
  'schedule',
  'results',
  'standings',
  'game_statistics',
  'season_totals',
])

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function slug(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&aacute;/gi, 'a')
    .replace(/&eacute;/gi, 'e')
    .replace(/&iacute;/gi, 'i')
    .replace(/&oacute;/gi, 'o')
    .replace(/&uacute;/gi, 'u')
    .replace(/&ntilde;/gi, 'n')
}

function stripTags(html: string) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, '\n')
  )
}

function htmlToTokens(html: string) {
  return stripTags(html)
    .split(/\r?\n+/)
    .map((item) => item.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

function anchorLinks(html: string) {
  const links: Array<{ href: string; text: string }> = []
  const regex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null
  while ((match = regex.exec(html))) {
    const href = match[1] ?? ''
    const text = stripTags(match[2] ?? '').replace(/\s+/g, ' ').trim()
    if (href && text) links.push({ href, text })
  }
  return links
}

function absoluteUrl(href: string) {
  try {
    return new URL(href, OFFICIAL_BSN_HOMEPAGE_URL).toString()
  } catch {
    return href
  }
}

function numericToken(value: string) {
  const normalized = value.replace(',', '.').replace(/^\./, '0.')
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function findSeason(tokens: string[]) {
  const leaderToken = tokens.find((token) => /BSN\s+20\d{2}/i.test(token))
  const match = leaderToken?.match(/20\d{2}/)
  if (match) return match[0]
  const copyrightToken = tokens.find((token) => /20\d{2}/i.test(token))
  return copyrightToken?.match(/20\d{2}/)?.[0] ?? null
}

function monthNumber(month: string) {
  const normalized = slug(month)
  const months: Record<string, number> = {
    enero: 1,
    febrero: 2,
    marzo: 3,
    abril: 4,
    mayo: 5,
    junio: 6,
    julio: 7,
    agosto: 8,
    septiembre: 9,
    octubre: 10,
    noviembre: 11,
    diciembre: 12,
  }
  return months[normalized] ?? null
}

function isoDateFromLabel(label: string, season: string | null) {
  const match = label.match(/(\d{1,2})\s+([A-Za-z\u00c0-\u017f]+)/)
  const month = match ? monthNumber(match[2]) : null
  if (!match || !month || !season) return null
  return `${season}-${String(month).padStart(2, '0')}-${String(Number(match[1])).padStart(2, '0')}`
}

function teamCodeFromUrl(url: string | null) {
  const match = String(url ?? '').match(/\/equipos\/([A-Z0-9_-]+)/i)
  return match?.[1]?.toUpperCase() ?? null
}

export function parseOfficialBsnHomepage(html: string, fetchedAt = new Date().toISOString()) {
  const tokens = htmlToTokens(html)
  const start = tokens.findIndex((token) => token.toLowerCase() === 'posiciones')
  const end = tokens.findIndex((token, index) => index > start && /l[ií]deres/i.test(token))
  const standingsTokens = start >= 0 ? tokens.slice(start + 1, end > start ? end : tokens.length) : []
  const teamLinks = anchorLinks(html).filter((link) => /\/equipos\//i.test(link.href))
  const linkByName = new Map(teamLinks.map((link) => [slug(link.text), absoluteUrl(link.href)]))
  const standings: OfficialBsnStandingRow[] = []
  let groupIndex = -1
  const season = findSeason(tokens)

  for (let index = 0; index < standingsTokens.length - 5; index += 1) {
    const maybeRank = numericToken(standingsTokens[index])
    const teamName = standingsTokens[index + 1]
    const gamesPlayed = numericToken(standingsTokens[index + 2])
    const wins = numericToken(standingsTokens[index + 3])
    const losses = numericToken(standingsTokens[index + 4])
    const winPercentage = numericToken(standingsTokens[index + 5])
    const isStandingRow =
      maybeRank !== null &&
      Number.isInteger(maybeRank) &&
      maybeRank >= 1 &&
      maybeRank <= 20 &&
      gamesPlayed !== null &&
      wins !== null &&
      losses !== null &&
      gamesPlayed === wins + losses &&
      teamName.length > 1 &&
      !numericToken(teamName)

    if (!isStandingRow) continue

    if (maybeRank === 1) groupIndex += 1
    const group = groupIndex <= 0 ? 'Grupo A' : `Grupo ${String.fromCharCode(65 + groupIndex)}`
    const providerTeamId = slug(teamName)

    standings.push({
      rank: maybeRank,
      group,
      teamName,
      gamesPlayed,
      wins,
      losses,
      winPercentage,
      providerTeamId,
      providerStandingId: `${season ?? 'unknown'}:${providerTeamId}`,
    })
    index += 5
  }

  const teams: OfficialBsnTeam[] = standings.map((row) => {
    const teamUrl = linkByName.get(slug(row.teamName)) ?? null
    return {
      providerTeamId: row.providerTeamId,
      teamName: row.teamName,
      group: row.group,
      rank: row.rank,
      teamCode: teamCodeFromUrl(teamUrl),
      teamUrl,
      fullName: null,
      recordText: null,
    }
  })

  return {
    fetchedAt,
    season,
    standings,
    teams,
    warnings: [
      start < 0 ? 'standings_section_not_found' : null,
      standings.length === 0 ? 'standings_rows_not_found' : null,
      season ? null : 'season_not_found',
      teams.some((team) => !team.teamUrl) ? 'some_team_urls_not_found' : null,
    ].filter(Boolean) as string[],
  }
}

function parseTeamPage({ html, team, season }: { html: string; team: OfficialBsnTeam; season: string | null }) {
  const tokens = htmlToTokens(html)
  const titleIndex = tokens.findIndex((token) => token.toLowerCase().includes(team.teamName.toLowerCase()))
  const fullName = titleIndex >= 0 ? tokens[titleIndex] : null
  const recordText = tokens.find((token) => /\d+\s*-\s*\d+.*Grupo/i.test(token)) ?? null
  const sourceUrl = team.teamUrl ?? OFFICIAL_BSN_HOMEPAGE_URL
  const links = anchorLinks(html)
  const results: OfficialBsnResult[] = []
  const teamLeaders: OfficialBsnTeamLeader[] = []

  for (const link of links) {
    const text = link.text.replace(/\s+/g, ' ').trim()
    const result = text.match(/(?:lun|mar|mie|mi[eé]|jue|vie|sab|s[aá]b|dom),\s*(\d{1,2}\s+[A-Za-z\u00c0-\u017f]+)\s+Final\s+([A-Z]{2,4})\s+(\d{1,3})\s+([A-Z]{2,4})\s+(\d{1,3})/i)
    if (result) {
      const dateLabel = result[1]
      const awayCode = result[2].toUpperCase()
      const homeCode = result[4].toUpperCase()
      const awayScore = Number(result[3])
      const homeScore = Number(result[5])
      results.push({
        providerGameId: `${season ?? 'unknown'}:${slug(dateLabel)}:${awayCode}:${homeCode}`,
        sourceTeamId: team.providerTeamId,
        dateLabel,
        gameDate: isoDateFromLabel(dateLabel, season),
        status: 'completed',
        awayTeamCode: awayCode,
        awayTeamName: null,
        awayScore,
        homeTeamCode: homeCode,
        homeTeamName: null,
        homeScore,
        sourceUrl,
      })
    }
  }

  const leaderStart = tokens.findIndex((token) => token.toLowerCase().includes('puntos por juego'))
  if (leaderStart >= 0) {
    for (let index = leaderStart + 1; index < Math.min(tokens.length, leaderStart + 8); index += 1) {
      const match = tokens[index].match(/^(\d+)\s+(.+?)\s+(\d+(?:\.\d+)?)$/)
      if (match) {
        teamLeaders.push({
          providerLeaderId: `${team.providerTeamId}:points:${slug(match[2])}`,
          teamId: team.providerTeamId,
          playerName: match[2].trim(),
          statCategory: 'points_per_game',
          value: Number(match[3]),
          sourceUrl,
        })
      }
    }
  }

  return {
    team: { ...team, fullName, recordText },
    results,
    upcomingGames: [] as OfficialBsnUpcomingGame[],
    teamLeaders,
    warnings: [] as string[],
  }
}

function parsePlayersPage({ html, teams }: { html: string; teams: OfficialBsnTeam[] }) {
  const links = anchorLinks(html).filter((link) => /\/jugadores\//i.test(link.href))
  const teamNames = teams.map((team) => ({ id: team.providerTeamId, shortName: team.teamName, fullName: team.fullName })).filter((team) => team.shortName)
  const players: OfficialBsnPlayer[] = []

  for (const link of links) {
    const text = link.text.replace(/\s+/g, ' ').trim()
    const matchedTeam = teamNames.find((team) => text.toLowerCase().includes(team.shortName.toLowerCase())) ?? null
    const position = text.match(/\b(PG|SG|SF|PF|FC|GF|G|F|C)\b\s*$/i)?.[1]?.toUpperCase() ?? null
    const beforeTeam = matchedTeam ? text.slice(0, text.toLowerCase().indexOf(matchedTeam.shortName.toLowerCase())).trim() : text.replace(/\b(PG|SG|SF|PF|FC|GF|G|F|C)\b\s*$/i, '').trim()
    const playerName = beforeTeam || text
    if (!playerName || players.some((player) => player.providerPlayerId === slug(playerName))) continue
    players.push({
      providerPlayerId: slug(playerName),
      playerName,
      teamName: matchedTeam?.shortName ?? null,
      teamId: matchedTeam?.id ?? null,
      position,
      sourceUrl: absoluteUrl(link.href),
    })
  }

  return players
}

function enrichResultTeams(results: OfficialBsnResult[], teams: OfficialBsnTeam[]) {
  const byCode = new Map(teams.filter((team) => team.teamCode).map((team) => [team.teamCode, team.teamName]))
  return results.map((result) => ({
    ...result,
    awayTeamName: byCode.get(result.awayTeamCode) ?? result.awayTeamName,
    homeTeamName: byCode.get(result.homeTeamCode) ?? result.homeTeamName,
  }))
}

function dedupeBy<T>(rows: T[], key: (row: T) => string) {
  const map = new Map<string, T>()
  for (const row of rows) map.set(key(row), row)
  return [...map.values()]
}

export function officialBsnHomepageCapabilities(): BasketballConnectorCapabilityResult[] {
  const capabilities: BasketballCapability[] = [
    'teams', 'players', 'schedule', 'results', 'standings', 'game_statistics', 'quarter_scores', 'boxscores', 'play_by_play', 'officials', 'attendance', 'arena', 'season_totals', 'advanced_metrics', 'odds', 'availability',
  ]

  return capabilities.map((capability) => {
    if (SUPPORTED_CAPABILITIES.has(capability)) {
      return {
        capability,
        status: capability === 'schedule' || capability === 'game_statistics' || capability === 'season_totals' ? 'partial' : 'supported',
        sourcePriority: 'official_league_source' as const,
        ttlSeconds: OFFICIAL_BSN_HOMEPAGE_TTL_SECONDS,
        requiresProviderCall: true,
        supportsIncrementalSync: true,
        supportsHistoricalBackfill: capability === 'results',
        warnings: ['Bounded public official pages only. No private API access, no robots bypass and no aggressive acquisition.'],
      }
    }
    return notSupportedCapability(capability, 'official_league_source', 'Official public pages do not expose this dataset in a stable supported snapshot.')
  })
}

export function buildOfficialBsnHomepageSnapshot({
  html,
  fetchedAt = new Date().toISOString(),
  providerCallsMade = 0,
  fromCache = false,
  teamPages = [],
  playersHtml = null,
}: {
  html: string
  fetchedAt?: string
  providerCallsMade?: number
  fromCache?: boolean
  teamPages?: FetchPage[]
  playersHtml?: string | null
}): OfficialBsnHomepageSnapshot {
  const parsed = parseOfficialBsnHomepage(html, fetchedAt)
  const fetchedMs = new Date(fetchedAt).getTime()
  const ageSeconds = Number.isFinite(fetchedMs) ? Math.max(0, Math.round((Date.now() - fetchedMs) / 1000)) : OFFICIAL_BSN_HOMEPAGE_TTL_SECONDS + 1
  const pagesFetched = [OFFICIAL_BSN_HOMEPAGE_URL, ...teamPages.filter((page) => page.html).map((page) => page.url), playersHtml ? `${OFFICIAL_BSN_HOMEPAGE_URL}jugadores` : null].filter(Boolean) as string[]
  const pagesFailed = teamPages.filter((page) => page.error).map((page) => ({ url: page.url, reason: page.error ?? 'unknown_error' }))
  const teamDetails = teamPages
    .map((page) => {
      const team = parsed.teams.find((item) => item.teamUrl === page.url)
      return team && page.html ? parseTeamPage({ html: page.html, team, season: parsed.season }) : null
    })
    .filter(Boolean) as Array<ReturnType<typeof parseTeamPage>>
  const teams = parsed.teams.map((team) => teamDetails.find((detail) => detail.team.providerTeamId === team.providerTeamId)?.team ?? team)
  const results = enrichResultTeams(dedupeBy(teamDetails.flatMap((detail) => detail.results), (row) => row.providerGameId), teams)
  const upcomingGames = dedupeBy(teamDetails.flatMap((detail) => detail.upcomingGames), (row) => row.providerGameId)
  const players = playersHtml ? parsePlayersPage({ html: playersHtml, teams }) : []
  const teamLeaders = dedupeBy(teamDetails.flatMap((detail) => detail.teamLeaders), (row) => row.providerLeaderId)

  return {
    success: true,
    sourceId: OFFICIAL_BSN_HOMEPAGE_CONNECTOR_ID,
    sourceUrl: OFFICIAL_BSN_HOMEPAGE_URL,
    fetchedAt,
    freshness: ageSeconds <= OFFICIAL_BSN_HOMEPAGE_TTL_SECONDS ? 'fresh' : 'stale',
    providerCallsMade,
    fromCache,
    season: parsed.season,
    standings: parsed.standings,
    teams,
    results,
    upcomingGames,
    players,
    teamLeaders,
    capabilities: officialBsnHomepageCapabilities(),
    warnings: [
      ...parsed.warnings,
      playersHtml ? null : 'players_page_not_fetched',
      teamPages.length === 0 ? 'team_pages_not_fetched' : null,
      pagesFailed.length ? 'some_team_pages_failed' : null,
      'quarter_scores_boxscores_play_by_play_odds_officials_attendance_availability_not_exposed_in_supported_public_snapshot',
    ].filter(Boolean) as string[],
    checkpoint: {
      id: `${OFFICIAL_BSN_HOMEPAGE_CONNECTOR_ID}:${parsed.season ?? 'unknown'}:${fetchedAt}`,
      startedAt: fetchedAt,
      completedAt: new Date().toISOString(),
      pagesPlanned: [OFFICIAL_BSN_HOMEPAGE_URL, ...parsed.teams.map((team) => team.teamUrl).filter(Boolean) as string[], `${OFFICIAL_BSN_HOMEPAGE_URL}jugadores`],
      pagesFetched,
      pagesFailed,
      resumeToken: pagesFailed.length ? pagesFailed[0].url : null,
      rateLimit: { spacingMs: REQUEST_SPACING_MS, maxTeamPages: MAX_TEAM_PAGE_CALLS, maxRetries: MAX_RETRIES },
    },
  }
}

async function fetchHtml(url: string): Promise<FetchPage> {
  let lastError = 'unknown_error'
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    try {
      const response = await fetch(url, {
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          accept: 'text/html,application/xhtml+xml',
          'user-agent': 'PickAnalyzerBSNAcquisition/1.0 (+https://pick-analyzer.vercel.app)',
        },
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return { url, html: await response.text(), error: null }
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'fetch_failed'
      if (attempt < MAX_RETRIES) await sleep(REQUEST_SPACING_MS * (attempt + 1))
    } finally {
      clearTimeout(timeout)
    }
  }
  return { url, html: null, error: lastError }
}

export async function fetchOfficialBsnHomepageSnapshot({ forceRefresh = false }: { forceRefresh?: boolean } = {}): Promise<OfficialBsnHomepageSnapshot> {
  const nowMs = Date.now()
  if (!forceRefresh && homepageCache && nowMs - homepageCache.fetchedAtMs < OFFICIAL_BSN_HOMEPAGE_TTL_SECONDS * 1000) {
    return { ...homepageCache.snapshot, providerCallsMade: 0, fromCache: true }
  }

  const fetchedAt = new Date().toISOString()
  const homepage = await fetchHtml(OFFICIAL_BSN_HOMEPAGE_URL)
  if (!homepage.html) throw new Error(`Official BSN homepage fetch failed: ${homepage.error}`)
  const parsed = parseOfficialBsnHomepage(homepage.html, fetchedAt)
  const teamUrls = parsed.teams.map((team) => team.teamUrl).filter(Boolean).slice(0, MAX_TEAM_PAGE_CALLS) as string[]
  const teamPages: FetchPage[] = []
  for (const url of teamUrls) {
    await sleep(REQUEST_SPACING_MS)
    teamPages.push(await fetchHtml(url))
  }
  await sleep(REQUEST_SPACING_MS)
  const playersPage = await fetchHtml(`${OFFICIAL_BSN_HOMEPAGE_URL}jugadores`)
  const providerCallsMade = 1 + teamUrls.length + 1
  const snapshot = buildOfficialBsnHomepageSnapshot({
    html: homepage.html,
    fetchedAt,
    providerCallsMade,
    fromCache: false,
    teamPages,
    playersHtml: playersPage.html,
  })
  homepageCache = { fetchedAtMs: nowMs, snapshot }
  return snapshot
}

export function validateOfficialBsnHomepageConnectorFixtures() {
  const fixtureHtml = `
    <h2>Posiciones</h2>
    <a href="/equipos/AAA">Fixture Club A</a><div>1</div><div>Fixture Club A</div><div>10</div><div>8</div><div>2</div><div>.800</div>
    <a href="/equipos/BBB">Fixture Club B</a><div>2</div><div>Fixture Club B</div><div>10</div><div>6</div><div>4</div><div>.600</div>
    <a href="/equipos/CCC">Fixture Club C</a><div>1</div><div>Fixture Club C</div><div>10</div><div>7</div><div>3</div><div>.700</div>
    <h2>Lideres de BSN 2026</h2>
  `
  const teamHtml = `<h2>Fixture Club A</h2><p>8-2 - 1er lugar en Grupo A</p><a href="/juegos/a">vie, 17 julio Final BBB 81 AAA 90</a><h2>Puntos por juego</h2><div>1 Test Player 21.5</div>`
  const playersHtml = `<h1>Jugadores</h1><a href="/jugadores/test-player">Test Player Fixture Club A Fixture Club A G</a>`
  const snapshot = buildOfficialBsnHomepageSnapshot({ html: fixtureHtml, fetchedAt: new Date().toISOString(), providerCallsMade: 0, teamPages: [{ url: `${OFFICIAL_BSN_HOMEPAGE_URL}equipos/AAA`, html: teamHtml, error: null }], playersHtml })
  const unsupported = snapshot.capabilities.filter((item) => item.status === 'not_supported')
  const checks = [
    ['fixture standings parsed', snapshot.standings.length === 3],
    ['season discovered', snapshot.season === '2026'],
    ['group rollover parsed', snapshot.standings[2]?.group === 'Grupo B'],
    ['team urls discovered', snapshot.teams[0]?.teamCode === 'AAA'],
    ['completed result parsed', snapshot.results.length === 1 && snapshot.results[0]?.awayScore === 81],
    ['players parsed', snapshot.players.length === 1],
    ['leaders parsed', snapshot.teamLeaders.length === 1],
    ['teams supported', snapshot.capabilities.find((item) => item.capability === 'teams')?.status === 'supported'],
    ['results supported', snapshot.capabilities.find((item) => item.capability === 'results')?.status === 'supported'],
    ['unsupported capabilities typed', unsupported.length >= 8],
    ['no provider call fixture', snapshot.providerCallsMade === 0],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)

  return { success: failedChecks.length === 0, mode: 'official_bsn_homepage_connector_validation_v1', checks: checks.length, passed: checks.length - failedChecks.length, failed: failedChecks.length, failedChecks, providerCallsMade: 0 }
}