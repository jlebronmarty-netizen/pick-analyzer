import "server-only";
import { nbaManualAccess } from "@/lib/nba/manual-access.mjs";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { loadNcaabManualData } from "@/services/ncaab-manual-data.service";
import { candidates } from "./evidence.mjs";

export const allowed = (headers) =>
  process.env.VERCEL_ENV === "preview" &&
  !nbaManualAccess(new Request("https://preview.vercel.app", { headers }));
const cache = new Map();
async function read(date, cut) {
  const extra = {
    histories: new Map(),
    possessions: new Map(),
    ranks: new Map(),
    divisions: new Map(),
  };
  const report = await loadNcaabManualData(
    supabaseAdmin,
    date,
    cut,
    AbortSignal.timeout(45000),
    extra,
  );
  const pairs = {},
    attempts = {};
  for (const f of report.fixtures) {
    pairs[f.eventId] = (extra.histories.get(f.homeId) ?? [])
      .filter((g) => g.opponentId === f.awayId)
      .slice(0, 10);
    for (const id of [f.homeId, f.awayId]) {
      if (attempts[id]) continue;
      const rows = extra.histories.get(id) ?? [];
      attempts[id] = Object.fromEntries(
        Object.entries({
          fieldGoalPct: "fieldGoalsAttempted",
          threePointPct: "threePointersAttempted",
          freeThrowPct: "freeThrowsAttempted",
        }).map(([key, field]) => [
          key,
          rows.reduce((sum, g) => sum + (g.stats[field] ?? 0), 0),
        ]),
      );
    }
  }
  return {
    report,
    pairs,
    attempts,
    histories: extra.histories,
    ranks: extra.ranks,
    divisions: extra.divisions,
    possessions: Object.fromEntries(extra.possessions),
  };
}
export function archive(date, cut) {
  const key = date + "/" + cut;
  if (cache.has(key)) return cache.get(key).promise;
  if (cache.size >= 4) {
    const prior = [...cache].find(([, v]) => v.done);
    if (!prior) throw Error("READ_BUSY");
    cache.delete(prior[0]);
  }
  const slot = { done: false };
  slot.promise = read(date, cut).then(
    (v) => {
      slot.done = true;
      return v;
    },
    (err) => {
      cache.delete(key);
      throw err;
    },
  );
  cache.set(key, slot);
  return slot.promise;
}
export function ranking(data, filters) {
  const fixtures = data.report.fixtures.filter(
    (f) =>
      (!filters.team || [f.homeId, f.awayId].includes(filters.team)) &&
      (!filters.division || data.divisions.get(f.eventId) === filters.division),
  );
  return candidates(
    { ...data.report, fixtures },
    data.pairs,
    filters,
    data.possessions,
  ).map(({ f, q, side, team, conditions, frequency }) => ({
    f: {
      eventId: f.eventId,
      homeName: f.homeName,
      awayName: f.awayName,
      markets: { capturedAt: f.markets.capturedAt },
    },
    q: { market: q.market, sportsbook: q.sportsbook },
    side,
    team: { name: team.name },
    conditions,
    frequency,
  }));
}
export function detail(data, id) {
  const f = data.report.fixtures.find((f) => f.eventId === id);
  if (!f) return null;
  const teams = [f.homeId, f.awayId].map((id) =>
    data.report.teams.find((t) => t.id === id),
  );
  const splits = Object.fromEntries(
    teams.map((team) => {
      const groups = { DI: [0, 0], OTHER: [0, 0], CONFLICT:[0,0], UNKNOWN: [0, 0] };
      for (const g of data.histories.get(team.id) ?? [])
        groups[data.divisions.get(g.eventId) ?? "UNKNOWN"][
          g.result === "W" ? 0 : 1
        ]++;
      return [team.id, groups];
    }),
  );
  return {
    f,
    splits,
    home: teams[0],
    away: teams[1],
    pair: data.pairs[id],
    ranks: data.ranks.get(id),
    attempts: Object.fromEntries(teams.map((t) => [t.id, data.attempts[t.id]])),
    possessions: Object.fromEntries(
      teams.map((t) => [t.id, data.possessions[t.id]]),
    ),
  };
}
