import {
  certifiedNhlRules,
  matchingRule,
  processPending,
} from "./settlement.mjs";

// Intended for the existing NHL scheduler after archival completion. Production
// has no approved rules. Do not initialize storage or read odds in that case.
export async function nhlSheetTick({
  enabled = false,
  rules = certifiedNhlRules,
  connect,
  now = () => new Date().toISOString(),
} = {}) {
  if (!enabled) return { status: "DISABLED", captured: 0, written: 0 };
  if (!rules.length)
    return { status: "NO_CERTIFIED_CONTRACTS", captured: 0, written: 0 };
  if (!connect)
    return { status: "WRITER_NOT_CONFIGURED", captured: 0, written: 0 };
  const io = await connect();
  try {
    const cutAt = now();
    const entries = (await io.readProspectiveEntries(cutAt)).filter(
      (c) =>
        Date.parse(c.start) > Date.parse(cutAt) &&
        Date.parse(c.cutAt) === Date.parse(cutAt) &&
        matchingRule({ ...c, recordedAt: cutAt }, rules),
    );
    const captured = await io.ledger.freeze(entries);
    const result = await processPending({
      ledger: io.ledger,
      readFinal: io.readFinal,
      asOf: now(),
      rules,
    });
    return { ...result, captured };
  } finally {
    await io.close();
  }
}
