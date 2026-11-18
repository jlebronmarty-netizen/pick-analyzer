import {createHash} from 'node:crypto';
export const HOOPS_PERIODS = Object.freeze(['ft', 'h1', 'h2', 'q1', 'q2', 'q3', 'q4']);
export const HOOPS_MARKETS = Object.freeze(['moneyline', 'spread', 'total', 'team_total_home', 'team_total_away']);
export const HOOPS_CAPTURE_VERSION = 'NBA_HOOPSAPI_PREVIEW_READ_ONLY_V1';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const decimal = value => typeof value === 'number' && Number.isFinite(value) && value > 1 && value <= 100 ? value : null;
const line = value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 500 ? value : null;
const time = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;
const priceAmerican = value => value >= 2 ? Math.round(100 * (value - 1)) : -Math.round(100 / (value - 1));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function normalizeHoopsNbaList(payload, capturedAt = new Date().toISOString()) {
  if (!object(payload) || !Array.isArray(payload.games) || payload.games.length > 60 || !time(capturedAt)) throw new Error('HOOPSAPI_RESPONSE_INVALID');
  const quotes = [], games = [];
  const periodCounts = Object.fromEntries(HOOPS_PERIODS.map(period => [period, 0]));
  const marketCounts = Object.fromEntries(HOOPS_MARKETS.map(market => [market, 0]));
  let missingFanDuelGames = 0, rejectedSelections = 0;
  const seenGames = new Set(), seenQuotes = new Set();
  for (const game of payload.games) {
    if (!object(game) || String(game.competition ?? '').toUpperCase() !== 'NBA') continue;
    const id = game.game_id;
    if (!['number', 'string'].includes(typeof id) || !/^[0-9]+$/.test(String(id)) || seenGames.has(String(id)) ||
        typeof game.home !== 'string' || typeof game.away !== 'string' || !game.home || !game.away) throw new Error('HOOPSAPI_GAME_IDENTITY_INVALID');
    seenGames.add(String(id));
    const startTime = time(game.start_time);
    const gameInfo = {
      provider_game_id: String(id), home_team: game.home, away_team: game.away,
      start_time: startTime, start_timezone_verified: Boolean(startTime && /(?:Z|[+-][0-9]{2}:[0-9]{2})$/i.test(startTime)),
      provider_updated_at: time(game.updated_at), provider_status: typeof game.status === 'string' ? game.status : null, fanduel_periods: [],
    };
    const periods = object(game.periods) ? game.periods : {};
    let foundBook = false;
    for (const period of HOOPS_PERIODS) {
      const books = object(periods[period]) ? periods[period] : {};
      const fanduel = object(books.fanduel) ? books.fanduel : null;
      if (!fanduel) continue;
      foundBook = true;
      const periodBefore = quotes.length;
      function add(market, side, value, currentLine, teamSide = null, homeHandicap = null) {
        const odds = decimal(value);
        if (odds === null || (market !== 'moneyline' && line(currentLine) === null)) { rejectedSelections += 1; return; }
        const record = {
          quote_id: hash([HOOPS_CAPTURE_VERSION, String(id), period, market, side, teamSide, currentLine, odds]),
          provider: 'hoopsapi', sportsbook: 'FanDuel', provider_game_id: String(id), period, market, side, team_side: teamSide,
          line: market === 'moneyline' ? null : currentLine, home_handicap_line: homeHandicap,
          decimal_odds: odds, american_odds_approx: priceAmerican(odds),
          source_received_at: capturedAt, provider_updated_at: gameInfo.provider_updated_at,
          execution_available: false, regional_price_verified: false, model_probability: null,
          expected_value: null, recommendation: null, capture_version: HOOPS_CAPTURE_VERSION,
          status: 'RESEARCH_ONLY_UNVERIFIED_BOOKMAKER_REGION',
        };
        if (seenQuotes.has(record.quote_id)) return;
        seenQuotes.add(record.quote_id); quotes.push(record);
        periodCounts[period] += 1; marketCounts[market] += 1;
      }
      const ml = object(fanduel.moneyline) ? fanduel.moneyline : null;
      if (ml) for (const side of ['home', 'away']) if (ml[side] !== undefined) add('moneyline', side, ml[side], null);
      const spread = object(fanduel.spread) ? fanduel.spread : null, handicap = spread ? line(spread.line) : null;
      if (spread && handicap !== null) {
        if (spread.home !== undefined) add('spread', 'home', spread.home, handicap, 'home', handicap);
        if (spread.away !== undefined) add('spread', 'away', spread.away, -handicap, 'away', handicap);
      }
      for (const market of ['total', 'team_total_home', 'team_total_away']) {
        const item = object(fanduel[market]) ? fanduel[market] : null, target = item ? line(item.line) : null;
        if (!item || target === null) continue;
        const team = market === 'team_total_home' ? 'home' : market === 'team_total_away' ? 'away' : null;
        for (const side of ['over', 'under']) if (item[side] !== undefined) add(market, side, item[side], target, team);
      }
      if (quotes.length > periodBefore) gameInfo.fanduel_periods.push(period);
    }
    if (!foundBook) missingFanDuelGames += 1;
    games.push(gameInfo);
  }
  if (quotes.length > 5000) throw new Error('HOOPSAPI_QUOTE_LIMIT_EXCEEDED');
  return {
    status: quotes.length ? 'PREVIEW_QUOTES_OBSERVED' : 'NO_FANDUEL_QUOTES_OBSERVED',
    capture_version: HOOPS_CAPTURE_VERSION, provider: 'hoopsapi', sportsbook: 'FanDuel',
    captured_at: capturedAt, source_endpoint: 'GET https://hoopsapi.com/api/v1/games?competition=NBA',
    source_scope: 'MAIN_LINES_ONLY_NOT_REGIONAL_BOOKMAKER_CONFIRMATION',
    limitations: [
      'No FanDuel Puerto Rico jurisdiction or bet placement verified.',
      'Only main lines from provider list endpoint, not alternate lines.',
      'No model probabilities, expected value, predictions, settlement or recommendations.',
      'No database writes. Result remains only in this private preview response.',
      'Full-game overtime and period settlement rules not independently certified.',
    ],
    coverage: {
      provider_game_rows: payload.games.length, nba_games: games.length, missing_fanduel_games: missingFanDuelGames,
      normalized_quote_sides: quotes.length, rejected_selection_sides: rejectedSelections,
      period_quote_sides: periodCounts, market_quote_sides: marketCounts,
      periods_without_fanduel_prices: HOOPS_PERIODS.filter(period => periodCounts[period] === 0),
    }, games, quotes,
  };
}
