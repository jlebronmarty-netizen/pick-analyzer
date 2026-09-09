# Large MLB checkpoint repair

September 9 live continuation: 15 canonical games and 4,160 September 8 dependency pitches were acquired with bounded readback. A later run failed before downstream writes on Node string length while serializing slate evidence. Streaming canonical hashing and private context-sharded checkpoints preserve the digest and freeze contracts; 66 SQL checks, 16 behavior groups, 8 guards, oversized evidence tests and build pass. The certified repair awaits its live retry; repeatability and activation remain pending. No model, 76-feature, preprocessing, policy or DDL change. Raw evidence remains private.

The failed run recorded one MLB schedule call and zero writes. A 576 MiB structural test reproduces the former string-limit failure and verifies the streaming digest. Fourteen-context checkpoint tests verify atomic manifest replacement, exact reconstruction, legacy compatibility and tamper rejection. The full existing SQL stack verifies real feature/model and downstream persistence parity. One lint warning concerns an intentionally omitted destructured context value; no lint errors.

A new package requires a new actual-time run freeze; the failed prior-package journal is retained and never relabeled. No failed run counts toward repeatability.
