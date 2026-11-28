export const views = { upcoming: "Próximos", live: "En vivo", final: "Finalizados", all: "Todos" };
export const labels = { upcoming: "Por comenzar", live: "En vivo", final: "Finalizado", postponed: "Aplazado", cancelled: "Cancelado", unknown: "Estado sin confirmar" };
export const instant = value => typeof value === "number" ? value : Date.parse(value);
export const prDay = ms => new Date(instant(ms) - 4 * 3600000).toISOString().slice(0, 10);

export function edition(date, now = Date.now(), snapshot = "midday") {
  const today = prDay(now);
  if (date == null) date = today;
  const fixed = Date.parse(date + "T17:00:00.000Z");
  if (typeof date !== "string" || !/^\d{4}-\d\d-\d\d$/.test(date) || !Number.isFinite(fixed) || prDay(fixed) !== date || date > today) return null;
  return { date, frozen: date < today, cutoff: new Date(date < today ? (snapshot==="close" ? Date.parse(date+"T04:00:00Z")+86400000-1 : fixed) : now).toISOString() };
}

export function phase(game, at) {
  const state = String(game.state ?? "").trim().toUpperCase();
  const schedule = String(game.scheduleState ?? "").toUpperCase();
  if ([state,schedule].some(s => ["CANCELLED","CANCELED","CNCL"].includes(s))) return "cancelled";
  if ([state,schedule].some(s => ["PPD","POSTPONED","SUSPENDED"].includes(s))) return "postponed";
  const start = instant(game.start ?? game.time ?? game.scheduledAt);
  if (!Number.isFinite(start)) return "unknown";
  if (["FINAL","OFF","COMPLETED","FINISHED"].includes(state)) return start <= at ? "final" : "unknown";
  if (["LIVE","IN_PROGRESS","IN PROGRESS","IN-PROGRESS","CRIT","HALFTIME"].includes(state)) return start <= at ? "live" : "unknown";
  return start > at && ["SCHEDULED","PREGAME","PRE","FUT","FORECAST"].includes(state) ? "upcoming" : "unknown";
}
export function eligible(game, at, expiry) {
  return !!game && phase(game, at) === "upcoming" && (expiry == null || instant(expiry) > at);
}
export const matches = (game, view, at) => view === "all" || phase(game, at) === view;

export const bands = { nba: {both:"both",standard:"-250",heavy:"-650"}, nhl:{both:"all",standard:"standard",heavy:"heavy"}, ncaab:{both:"both",standard:"standard",heavy:"heavy"} };
export const windows = { nba:{L5:"five",L10:"ten",H10:"h2h"}, nhl:{L5:"5",L10:"10",H5:"direct5",H10:"direct10"}, ncaab:{L5:"L5",L10:"L10",H5:"H5",H10:"H10"} };

export const marketKeys = {
  nba:{points:"points",rebounds:"rebounds",assists:"assists",threes:"threes"},
  nhl:{ml:"ml",spread:"spread",total:"total",team:"team",periodML:"periodML",periodSpread:"periodSpread",periodTotal:"periodTotal",skater:"skater",goalie:"goalie"},
  ncaab:{general:"ALL",ml:"MONEYLINE",spread:"SPREAD",total:"TOTAL",team:"TEAM"}
};
