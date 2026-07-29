# Training Dataset Spec V1

Date: 2026-07-29

Status: READ-ONLY SPEC

No model training. No production prediction changes.

## Accepted Row Contract

A future training row must contain:

- prediction ID;
- sport key;
- canonical event ID;
- event start time;
- generated time;
- cutoff time;
- model version;
- model role;
- market;
- selection;
- line;
- odds;
- model probability;
- implied probability;
- confidence;
- edge and EV as historical observed fields;
- feature snapshot reference;
- canonical result ID;
- deterministic outcome label;
- settlement source;
- settled timestamp;
- acceptance status;
- rejection reasons;
- source fingerprints.

## Acceptance Rules

Rows are accepted only when:

- generated before event start and cutoff;
- linked to canonical event identity;
- linked to authoritative final result;
- deterministic outcome matches stored settlement;
- market is supported by canonical settlement logic;
- feature evidence is present;
- model version is present;
- row is not trial, scrambled, fixture, preview or shadow;
- row is canonical production-settled.

## Leakage Rules

Forbidden as features:

- final score;
- settlement result;
- post-start odds;
- postgame statistics;
- postgame injuries or lineup corrections;
- future closing line unless explicitly used only for evaluation;
- model outputs generated after the cutoff.

## Dataset Manifest

A frozen future dataset manifest must include accepted row IDs, rejected counts, source evidence fingerprint, feature snapshot references, generated timestamp, code commit, deterministic seed and split boundaries.

## Current Readiness

Current accepted rows: 354. Current status: insufficient for model training.
