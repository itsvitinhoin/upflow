# Team page design QA

## Comparison target

- Source visual truth: `C:\Users\supor\AppData\Local\Temp\codex-clipboard-2cca6944-7605-4b79-9821-8969b19a1315.png`
- Source dimensions: 1680 × 942 px (desktop reference frame)
- Intended implementation route: `/team`
- Intended implementation state: authenticated admin, dark theme, Portuguese UI, Team/Equipes tab selected, grid layout
- Intended viewport: 1668 × 940 CSS px, density 1× (normalized to the supplied desktop frame)
- Implementation screenshot: unavailable — no browser-rendered capture was produced

## Evidence and capture status

The source image was inspected before implementation. A local Next development server was started at `http://127.0.0.1:3000`, and the route returned the expected unauthenticated redirect in a non-browser HTTP check. The Codex in-app browser then denied navigation to the local URL under browser security policy, before an authenticated page could be captured.

Because the browser-rendered implementation image is unavailable, no valid full-view or focused-region visual comparison could be performed. Build and static checks below are not a substitute for a visual comparison.

## Required fidelity surfaces

- **Fonts and typography:** blocked from visual verification. The implementation uses the existing UpFlow typography and text utility stack, with reference-oriented heading, metric, card, and small-control scales in `src/components/team/team-workspace.tsx`.
- **Spacing and layout rhythm:** blocked from visual verification. The implementation targets the reference structure: header actions, four metrics, tab rail, filter row, four-column desktop card grid, and 280 px insights rail.
- **Colors and visual tokens:** blocked from visual verification. The implementation reuses the existing dark UpFlow shell, `command-metric-card`, `command-section-panel`, and `upflow-gradient-button` tokens.
- **Image quality and asset fidelity:** blocked from visual verification. Real member `avatar_url` images are used when available; the existing initials fallback is retained. No fabricated raster or SVG assets were added.
- **Copy and app-specific content:** blocked from visual verification. The Team page supports Portuguese and English labels and uses live workspace member, department, invite, task, and project data.

## Findings

- [P1] Browser-rendered reference comparison is unavailable.
  - Location: `/team` at the 1668 × 940 target viewport.
  - Evidence: the in-app browser blocked the local `127.0.0.1:3000` navigation before a page screenshot could be captured.
  - Impact: pixel-level alignment, visible card density, and header/sidebar composition cannot be asserted.
  - Fix: allow authenticated local-route access in the selected browser, capture the implementation at the intended viewport, place it beside the source image in one comparison input, then address any resulting P0/P1/P2 deltas.

## Interaction and code checks completed

- TypeScript: `node_modules/.bin/tsc.cmd --noEmit` passed.
- ESLint: changed Team/header files passed with `--max-warnings=0`.
- Unit coverage: language, workspace sharing/guest role, and standalone-client checks passed (9/9).
- Implemented live interactions: local header search, tab selection, department and sorting filters, grid/list controls, team card actions, pending-invite resend/cancel, invite dialog, department management dialog, member role/status/department updates, member removal, and service-leader mapping.

## Comparison history

1. **Initial capture attempt — blocked.** The source frame was available, but browser navigation to the local implementation was denied before a screenshot and no visual findings could be produced. No visual-fidelity iteration is claimed.

## Implementation checklist

1. Open `/team` in an authenticated browser session at 1668 × 940.
2. Capture the initial Team/Equipes grid state and compare it side by side with the source image.
3. Verify the header, sidebar width, cards, right-rail proportions, mobile behavior, and interactive states visually.
4. Update this report with the implementation screenshot path, comparison findings, and a final visual QA result.

final result: blocked
