type EdgeCandidate = {
  predictionId: string;
  pregameSafe: boolean;
  canonicalOutcome?: { probability: number; selection: string };
  canonicalPrice?: { status: string; americanOdds: number | null };
  canonicalMarketAlignment?: { freshnessStatus: string } | null;
  marketAlignment?: { freshnessStatus: string };
  canonicalEv?: { edge: number | null; expectedValue: number | null };
};
/** Presentation ranking only. It does not grant official recommendation eligibility. */
export function rankHighestEdge<T extends EdgeCandidate>(candidates: T[]): T[] {
  return candidates
    .filter(
      (c) =>
        c.pregameSafe &&
        c.canonicalPrice?.status === "AVAILABLE" &&
        typeof c.canonicalPrice.americanOdds === "number" &&
        Number.isFinite(c.canonicalPrice.americanOdds) &&
        c.canonicalPrice.americanOdds !== 0 &&
        c.canonicalOutcome &&
        Number.isFinite(c.canonicalOutcome.probability) &&
        c.canonicalOutcome.probability >= 0 &&
        c.canonicalOutcome.probability <= 100 &&
        ["FRESH", "AGING"].includes(
          (c.canonicalMarketAlignment ?? c.marketAlignment)?.freshnessStatus ??
            "",
        ) &&
        typeof c.canonicalEv?.edge === "number" &&
        Number.isFinite(c.canonicalEv.edge) &&
        c.canonicalEv.edge > 0 &&
        typeof c.canonicalEv.expectedValue === "number" &&
        Number.isFinite(c.canonicalEv.expectedValue) &&
        c.canonicalEv.expectedValue > 0,
    )
    .sort(
      (a, b) =>
        b.canonicalEv!.edge! - a.canonicalEv!.edge! ||
        b.canonicalEv!.expectedValue! - a.canonicalEv!.expectedValue! ||
        a.predictionId.localeCompare(b.predictionId),
    );
}
