// Final evidence for regular-season NHL only. No network or storage side effects.
import { regulationPeriods } from "../../src/app/nhl-cheat-sheets/periods.mjs";
const count = (x) => Number.isSafeInteger(x) && x >= 0;
const id = (x) => count(x) && x > 0;
const final = (x) => ["FINAL", "OFF"].includes(x);
const keys = ["goals", "assists", "shots", "saves"];
function seconds(toi) {
  if (typeof toi !== "string" || !/^\d{1,3}:[0-5]\d$/.test(toi)) return null;
  const [minutes, sec] = toi.split(":").map(Number);
  return minutes * 60 + sec;
}
function verifyPlayerRows(box, plays, side, finish, shotsAgree) {
  const roster = box.playerByGameStats?.[side + "Team"];
  const opponent = box[side === "home" ? "awayTeam" : "homeTeam"].id;
  const own = box[side + "Team"].id;
  if (
    !roster ||
    !["forwards", "defense", "goalies"].every((k) => Array.isArray(roster[k]))
  )
    return [];
  const all = Object.values(box.playerByGameStats ?? {}).flatMap((r) =>
    ["forwards", "defense", "goalies"].flatMap((k) =>
      Array.isArray(r?.[k]) ? r[k] : [],
    ),
  );
  return [...roster.forwards, ...roster.defense, ...roster.goalies]
    .map((p) => {
      if (
        !id(p?.playerId) ||
        all.filter((r) => r?.playerId === p.playerId).length !== 1
      )
        return null;
      const toi = seconds(p.toi),
        goalie = roster.goalies.includes(p);
      if (toi === null || toi > (finish === "REG" ? 3600 : 3900) || toi === 0)
        return { id: p.playerId, participation: "unknown" };
      const periods = [1, 2, 3, ...(finish === "REG" ? [] : [4])].map(
        (period) => {
          const rows = plays.filter(
            (x) => x.periodDescriptor.number === period,
          );
          const stats = { goals: 0, assists: 0, shots: 0, saves: 0 };
          for (const play of rows) {
            const d = play.details,
              k = play.typeDescKey;
            if (!["goal", "shot-on-goal"].includes(k)) continue;
            if (d.eventOwnerTeamId === own) {
              const shooter =
                k === "goal" ? d.scoringPlayerId : d.shootingPlayerId;
              if (!id(shooter)) stats.shots = NaN;
              if (shooter === p.playerId) stats.shots++;
              if (k === "goal") {
                if (!id(shooter)) stats.goals = NaN;
                if (shooter === p.playerId) stats.goals++;
                const assists = [d.assist1PlayerId, d.assist2PlayerId].filter(
                  (v) => v !== undefined,
                );
                if (
                  !assists.every(id) ||
                  new Set([shooter, ...assists]).size !== 1 + assists.length
                )
                  stats.assists = NaN;
                else if (assists.includes(p.playerId)) stats.assists++;
              }
            } else if (
              d.eventOwnerTeamId === opponent &&
              k === "shot-on-goal"
            ) {
              if (!id(d.goalieInNetId)) stats.saves = NaN;
              if (d.goalieInNetId === p.playerId) stats.saves++;
            }
          }
          return stats;
        },
      );
      const values = {};
      for (const key of goalie ? ["saves"] : keys.slice(0, 3)) {
        const value = p[key === "shots" ? "sog" : key];
        const valid =
          count(value) &&
          periods.reduce((sum, r) => sum + r[key], 0) === value &&
          (key !== "shots" || shotsAgree[own]) &&
          (key !== "saves" ||
            (shotsAgree[opponent] &&
              count(p.shotsAgainst) &&
              count(p.goalsAgainst) &&
              value + p.goalsAgainst === p.shotsAgainst));
        if (valid)
          values[key] = { full: value, periods: periods.map((r) => r[key]) };
      }
      return {
        id: p.playerId,
        teamId: own,
        participation: "played",
        seconds: toi,
        starter: goalie && typeof p.starter === "boolean" ? p.starter : null,
        values,
      };
    })
    .filter(Boolean);
}

export function verifyArchivedFinal(rows, contract, asOf) {
  if (!Array.isArray(rows) || rows.length !== 1) return null;
  const r = rows[0],
    b = r?.boxscore,
    p = r?.play_by_play;
  const at = Math.max(
    Date.parse(r?.boxscore_captured_at),
    Date.parse(r?.pbp_captured_at),
    Date.parse(r?.updated_at),
  );
  if (
    !b ||
    !p ||
    !Number.isFinite(at) ||
    !(at <= Date.parse(asOf)) ||
    ![r.boxscore_captured_at, r.pbp_captured_at].every(
      (x) => Date.parse(x) > Date.parse(contract.start),
    ) ||
    r.event_id !== contract.eventId ||
    r.event_id !== "nhl:" + b.id ||
    !id(b.id) ||
    r.provider_game_id !== b.id ||
    r.provider !== "nhl_web_api" ||
    !["NHL_CAUSAL_CONTEXT_V2", "NHL_MAIN_MARKET_HISTORY_BACKFILL_V1"].includes(
      r.source_version,
    ) ||
    Date.parse(r.updated_at) <
      Math.max(
        Date.parse(r.boxscore_captured_at),
        Date.parse(r.pbp_captured_at),
      ) ||
    p.id !== b.id ||
    b.gameOutcome?.lastPeriodType !== p.gameOutcome?.lastPeriodType ||
    b.gameType !== 2 ||
    p.gameType !== 2 ||
    !final(b.gameState) ||
    !final(p.gameState) ||
    ![b, p].every(
      (x) => Date.parse(x.startTimeUTC) === Date.parse(contract.start),
    ) ||
    !Array.isArray(p.plays) ||
    p.plays.at(-1)?.typeDescKey !== "game-end"
  )
    return null;
  for (const side of ["home", "away"]) {
    const a = b[side + "Team"],
      c = p[side + "Team"];
    if (
      !id(a?.id) ||
      a.id !== contract[side + "Id"] ||
      c?.id !== a.id ||
      a.abbrev !== c.abbrev ||
      !count(a.score) ||
      a.score !== c.score
    )
      return null;
  }
  const h = b.homeTeam,
    a = b.awayTeam,
    finish = b.gameOutcome?.lastPeriodType;
  const last = { REG: 3, OT: 4, SO: 5 }[finish];
  if (
    h.id === a.id ||
    !(last >= 3) ||
    [
      p.periodDescriptor,
      b.periodDescriptor,
      p.plays.at(-1).periodDescriptor,
    ].some((x) => x?.number !== last || x.periodType !== finish)
  )
    return null;
  const seen = new Set(),
    ended = new Set(),
    soGoals = { [h.id]: 0, [a.id]: 0 },
    goals = [],
    fieldPlays = [];
  let prior = 0;
  const shots = { [a.id]: 0, [h.id]: 0 };
  for (const x of p.plays) {
    const pd = x?.periodDescriptor,
      n = pd?.number;
    if (
      !id(x?.eventId) ||
      seen.has(x.eventId) ||
      !id(n) ||
      n > last ||
      n < prior ||
      pd.periodType !== (n < 4 ? "REG" : n === 4 ? "OT" : "SO")
    )
      return null;
    seen.add(x.eventId);
    prior = n;
    if (ended.has(n) && x.typeDescKey !== "game-end") return null;
    if (x.typeDescKey === "period-end") {
      if (ended.has(n) || (n <= 3 && x.timeInPeriod !== "20:00")) return null;
      ended.add(n);
    }
    if (n === 5) {
      if (x.typeDescKey === "goal") {
        if (![h.id, a.id].includes(x.details?.eventOwnerTeamId)) return null;
        soGoals[x.details.eventOwnerTeamId]++;
      }
      continue;
    }
    fieldPlays.push(x);
    if (!["goal", "shot-on-goal"].includes(x.typeDescKey)) continue;
    const d = x.details;
    if (![h.id, a.id].includes(d?.eventOwnerTeamId)) return null;
    shots[d.eventOwnerTeamId]++;
    if (x.typeDescKey === "goal")
      goals.push({
        period: n,
        periodDescriptor: pd,
        teamAbbrev: d.eventOwnerTeamId === h.id ? h.abbrev : a.abbrev,
        homeScore: d.homeScore,
        awayScore: d.awayScore,
      });
  }
  if (
    ended.size !== last ||
    (finish === "SO" &&
      Math.sign(soGoals[h.id] - soGoals[a.id]) !== Math.sign(h.score - a.score))
  )
    return null;
  const s = regulationPeriods({ ...b, goals });
  if (!s) return null;
  const reg = { home: 0, away: 0 };
  for (const period of s.periods) {
    reg.home += period.home;
    reg.away += period.away;
  }
  if (
    finish !== "REG" &&
    (reg.home !== reg.away || Math.abs(h.score - a.score) !== 1)
  )
    return null;
  const official = { home: h.score, away: a.score };
  const real = finish === "SO" ? { ...reg } : official;
  const scores = {
    REG: reg,
    FINAL_WITH_SO: official,
    GOALS_PLAYED: real,
    P1: s.periods[0],
    P2: s.periods[1],
    P3: s.periods[2],
  };
  if (finish !== "REG")
    scores.OT = { home: real.home - reg.home, away: real.away - reg.away };
  const shotsAgree = Object.fromEntries(
    ["homeTeam", "awayTeam"].map((k) => [
      b[k].id,
      shots[b[k].id] === b[k].sog && b[k].sog === p[k].sog,
    ]),
  );
  return {
    eventId: r.event_id,
    verified: true,
    observedAt: new Date(at).toISOString(),
    finish,
    scores,
    shotsAgree,
    players: ["home", "away"].flatMap((side) =>
      verifyPlayerRows(b, fieldPlays, side, finish, shotsAgree),
    ),
  };
}
