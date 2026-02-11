# Observation follow-up notes

## 6. Accessibility – "Blocked aria-hidden"

- There is no `aria-hidden` or `accessibilityHidden` in app code; the violation comes from a dependency (e.g. Expo Router / React Navigation stack or a modal). The UUID in the message can be a route/stack node ID.
- **Mitigation:** Do not add components that set `aria-hidden` on a parent of focusable elements. If you see the log: (1) Reproduce on the screen that triggers it; (2) Inspect the tree (e.g. React DevTools) for the node with that ID and its ancestor with `aria-hidden`; (3) If it’s in our layout, ensure we don’t put focusable content inside a node that gets `aria-hidden`; (4) If it’s inside a library, consider upgrading or reporting.

## 2.2. Standings parser keys

- After deploying the backfill migration, if a league still shows zero points, inspect that competition’s API response and extend the parser in `ingestion/parsers/mywru/parseStandings.ts` if needed. The chain for table points already includes `r.points`, `r.pts`, `r.leaguePoints`, etc.; add any additional key used by that source.
