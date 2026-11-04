export const DRATINGS_URL = 'https://www.dratings.com/predictor/nhl-hockey-predictions/';
export type PublicNhlForecast = {
  awayName: string; homeName: string; scheduledAt: string;
  awayProbability: number; homeProbability: number; detailUrl: string; rawRow: string;
};
export type PairedNhlPrice = { awayOdds: number; homeOdds: number; book: 'CIRCA'; rawTable: string };

function text(html: string) {
  return html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}
function cells(row: string) {
  return [...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((match) => match[1]);
}

// Column headers and team order must match the observed public markup.
export function parseDratingsUpcoming(html: string): PublicNhlForecast[] {
  const section = html.match(/id=["']scroll-upcoming["'][\s\S]*?<\/table>/i)?.[0];
  if (!section) throw new Error('DRatings upcoming table unavailable');
  const rows = [...section.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => m[1]);
  const headers = cells(rows[0] ?? '').map(text);
  if (headers[0] !== 'Time' || headers[1] !== 'Teams' || headers[3] !== 'Win') {
    throw new Error('DRatings upcoming columns changed');
  }
  const forecasts: PublicNhlForecast[] = [];
  for (const row of rows.slice(1)) {
    const columns = cells(row);
    const names = [...(columns[1] ?? '').matchAll(/<a\b[^>]*href=["']\/teams\/nhl-hockey-ratings\/[^"']+["'][^>]*>([\s\S]*?)<\/a>/gi)].map(m => text(m[1]));
    const probabilities = [...(columns[3] ?? '').matchAll(/>(\d+(?:\.\d+)?)%<\/span>/g)].map(m => Number(m[1]) / 100);
    const time = columns[0]?.match(/datetime=["']([^"']+)["']/)?.[1];
    const path = columns[0]?.match(/href=["'](\/predictor\/nhl-hockey-predictions\/[a-f0-9-]+)["']/)?.[1];
    if (names.length !== 2 || probabilities.length !== 2 || !time || !path
      || !Number.isFinite(Date.parse(time)) || probabilities.some(p => p <= 0 || p >= 1)
      || Math.abs(probabilities[0] + probabilities[1] - 1) > 0.002) continue;
    forecasts.push({ awayName: names[0], homeName: names[1], scheduledAt: time,
      awayProbability: probabilities[0], homeProbability: probabilities[1],
      detailUrl: new URL(path, DRATINGS_URL).href, rawRow: row });
  }
  return forecasts;
}

// Fixed book, both sides from one contemporaneous table. Never use mixed "Best Line" quotes.
export function parseDratingsCirca(html: string, forecast: PublicNhlForecast): PairedNhlPrice | null {
  const section = html.match(/id=["']scroll-money["'][\s\S]*?(?=id=["']scroll-spread["']|$)/i)?.[0];
  if (!section) return null;
  for (const table of section.match(/<table\b[^>]*>[\s\S]*?<\/table>/gi) ?? []) {
    const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m => cells(m[1]).map(text));
    const index = rows[0]?.indexOf('Circa') ?? -1;
    if (index < 0 || rows.length !== 3) continue;
    const [away, home] = rows.slice(1);
    const teamLabelMatches = (full: string, label: string) => full === label || full.startsWith(label + ' ');
    if (!teamLabelMatches(forecast.awayName, away[0]) || !teamLabelMatches(forecast.homeName, home[0])) continue;
    const odds = [away[index], home[index]];
    if (odds.some(o => !/^[+-]\d+$/.test(o) || Math.abs(Number(o)) < 100)) continue;
    return { awayOdds: Number(odds[0]), homeOdds: Number(odds[1]), book: 'CIRCA', rawTable: table };
  }
  return null;
}
