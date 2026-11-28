import { createHash } from "node:crypto";
import { gradeTeamContract } from "./grade.mjs";
import { verifyArchivedFinal } from "./final.mjs";

// Add a version only after its jurisdiction, receipt labels and exceptions are approved.
export const certifiedNhlRules = Object.freeze([]);
export function matchingRule(c, rules = certifiedNhlRules) {
  if (
    typeof c.jurisdiction !== "string" ||
    !c.jurisdiction ||
    !Number.isInteger(c.odds) ||
    Math.abs(c.odds) < 100 ||
    !Number.isFinite(c.line) ||
    !(
      Date.parse(c.quotedAt) <= Date.parse(c.recordedAt) &&
      Date.parse(c.recordedAt) < Date.parse(c.start)
    )
  )
    return null;
  const matches = rules.filter(
    (r) =>
      r.verified === true &&
      r.id === c.ruleId &&
      r.book === c.book &&
      r.jurisdiction === c.jurisdiction &&
      r.scope === c.scope &&
      r.market === c.market &&
      r.label === c.label &&
      typeof r.label === "string" &&
      r.label.length &&
      r.push === "refund" &&
      typeof r.voidTerms === "string" &&
      r.voidTerms.length &&
      typeof r.source === "string" &&
      r.source.length &&
      Date.parse(r.from) <= Date.parse(c.quotedAt) &&
      Date.parse(c.quotedAt) < Date.parse(r.until),
  );
  return matches.length === 1 ? matches[0] : null;
}

export function settleArchivedContract(c, rule, rows, asOf) {
  if (!rule || !matchingRule(c, [rule])) return null;
  const final = verifyArchivedFinal(rows, c, asOf);
  if (!final) return null;
  const score = final.scores[c.scope];
  if (!score) return null;
  const result = gradeTeamContract(c, rule, {
    ...score,
    verified: true,
    eventId: c.eventId,
    observedAt: final.observedAt,
    scope: c.scope,
  });
  if (!result) return null;
  const evidenceId = createHash("sha256")
    .update(
      JSON.stringify([
        c.eventId,
        final.observedAt,
        c.ruleId,
        c.scope,
        score,
        final.finish,
        rows[0].boxscore_captured_at,
        rows[0].pbp_captured_at,
      ]),
    )
    .digest("hex");
  return { result, evidenceId, observedAt: final.observedAt };
}

export async function readFinalArchive(db, eventId) {
  const { data, error } = await db
    .from("nhl_game_context_v2")
    .select(
      "event_id,provider_game_id,provider,source_version,updated_at,boxscore,boxscore_captured_at,play_by_play,pbp_captured_at",
    )
    .eq("event_id", eventId)
    .limit(2);
  if (error) throw Error("NHL final archive unavailable");
  return data;
}

// A caller supplies the isolated ledger. Pending entries are revisited at the next tick.
export async function processPending({
  ledger,
  readFinal,
  asOf,
  rules = certifiedNhlRules,
}) {
  if (!rules.length)
    return { status: "NO_CERTIFIED_CONTRACTS", written: 0, pending: 0 };
  let written = 0,
    pending = 0;
  const cache = new Map();
  for await (const c of await ledger.pending(asOf)) {
    const rule = matchingRule(c, rules);
    if (!rule || !(Date.parse(c.start) < Date.parse(asOf))) {
      pending++;
      continue;
    }
    if (!cache.has(c.eventId)) cache.set(c.eventId, await readFinal(c.eventId));
    const grade = settleArchivedContract(c, rule, cache.get(c.eventId), asOf);
    if (!grade) {
      pending++;
      continue;
    }
    if (await ledger.insertGradeOnce(c.id, grade)) written++;
  }
  return { status: "OK", written, pending };
}
