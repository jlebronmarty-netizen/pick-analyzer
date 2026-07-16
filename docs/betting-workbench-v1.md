# Betting Workbench V1

Status: Completed as a read-only betting workspace.

Betting Workbench lets users compare bets, investigate markets, draft preview or official-only tickets, save bets and write review notes without changing Current Board, Top Picks, Recommendation Policy or Production Data Gate.

## Sources

- Current Board for current candidate rows.
- Top Picks for official-only ticket mode.
- Local browser state for saved bets and notes.

The Workbench no longer performs duplicate client loads of Most Likely and Best Value; it derives its workspace from the canonical Current Board plus Top Picks. Provider calls remain 0 and production mutations remain 0.

## Display Contract

Each card shows event date/time, market, line, odds, sportsbook implied probability, model probability, confidence, AI rating, value, risk, recommendation status, source, data timestamp and advanced details. Current prospective cards show the `NYM @ PHI` event at `Jul 16, 7:10 PM AST` when rendered in Puerto Rico time.

Selection explanations are market-specific:

- Moneyline focuses on selected-side strength, opponent weaknesses and price.
- Run line focuses on margin, run differential, cover price and opponent scoring.
- Total uses the explicit limited-evidence warning when pitcher/weather/lineup context is insufficient.

Responsive visual QA covers desktop, tablet and mobile layouts with scrollable tabs and breakable card text.
