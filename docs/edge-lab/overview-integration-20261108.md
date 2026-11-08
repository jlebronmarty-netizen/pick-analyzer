# Homepage overview and SHADOW selections — 2026-11-08

User screenshot revealed that the aggregate homepage still read the legacy Soccer checkpoint and the unavailable TT bridge, although the private Edge Lab ledger was operating. This patch connects only the Soccer, TT and NCAAF cards to the current read-only ledger adapters; NHL sources, MLB phases/pause, NCAAB and model equations remain unchanged.

Each new card headline is its winner market only (Soccer1X2, TT/NCAAFMoneyline). Secondary markets remain separate lines; totals/margins without an exact betting contract show numeric MAE, never a fabricated accuracy. PASAR/abstentions, pending, disputes and invalid outcomes are outside W/L. The shared subtotal is explicitly descriptive and does not add secondary markets. Source errors, duplicates or invalid pregame evidence fail closed, not to zeros or an old checkpoint. Only summary aggregates reach the homepage API; detailed selections remain behind the existing Edge Lab protection.

Card links go directly to the correct Edge Lab sport. Display-only controls show Puerto Rico today, upcoming unstarted, or full history, and modeled vs PASAR/all. Filtering never changes accumulated accuracy or original rows. No provider requests, database writes, migrations, new cron, key reads, protection changes or promotions to Official Picks/APOSTAR.

Observed baseline2026-11-08T21:17:11Z:Soccerwinner4W4L,TTwinner8W7L,NCAAFwinner33W24L. These are stored outcomes, not a new independent revalidation or promised predictive performance. Snapshot fingerprints1449multiforecasts MD574fee0caa0549196d12127f8c3f9a353;20soccer MD52e47fd670ee09b52c77f01ab313d587b. Compare originals at fixed cutoff after deployment.

Tests:292pure Node tests approved in sandbox before publication, including31new checks. Exact commit build, actual production homepage/API comparisons and click/filter checks must be recorded separately; a successful build is not proof of display correctness. Existing old reports are preserved for untouched consumers and legacy history; no history is reclassified.
