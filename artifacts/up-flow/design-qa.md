# Sidebar hide design QA

## Comparison target

- Source visual truth: `C:\Users\supor\AppData\Local\Temp\codex-clipboard-dddac691-d84b-4292-9a16-3e99acde831c.png`
- Local reference copy: `.design-qa/sidebar-reference.png`
- Source dimensions: 1920 x 921 px
- Implementation surface: the production `Sidebar` rendered in the temporary `/sidebar-qa` verification route
- Desktop verification viewport: 1920 x 921 CSS px
- Mobile verification viewport: 390 x 844 CSS px
- Open-state screenshot: `.design-qa/sidebar-open.png`
- Hidden-state screenshot: `.design-qa/sidebar-hidden.png`
- Mobile screenshot: `.design-qa/sidebar-mobile.png`
- Combined reference/result comparison: `.design-qa/sidebar-comparison.png`

## Intended behavior

Selecting the desktop close control hides the complete 336 px navigation shell, including both the 64 px rail and the 272 px workspace panel. The main workspace expands to the left edge. A separate, accessible restore control remains at the left-center edge so navigation can be reopened without losing keyboard access.

## Visual comparison

The supplied source shows the failure state: the workspace panel is closed but the compact rail remains visible. The final implementation screenshot shows the rail and panel at zero width with the main workspace using the recovered space. The restore button is intentionally visible at the left-center edge.

The first implementation capture occurred during the 200 ms width transition and still showed a faint rail silhouette. QA was strengthened to wait for computed width `0px`; the final screenshot has no remaining rail or sidebar footprint.

## Fidelity review

- **Layout:** the whole desktop sidebar collapses rather than leaving a 64 px rail. Main content expands to fill the released width.
- **Controls:** the existing Lucide close/open icons and UpFlow button tokens are retained. No substitute assets were introduced.
- **Typography and labels:** existing compact rail typography remains unchanged while open; Portuguese and English labels remain localized.
- **Color and motion:** existing dark theme, borders, shadows, and a 200 ms reduced-motion-aware transition are preserved.
- **Responsive behavior:** mobile navigation remains an independent modal. Crossing into desktop closes the mobile dialog, removes its focus trap, and moves focus to the visible desktop control.
- **Accessibility:** hidden navigation is `aria-hidden` and `inert`; close/restore controls expose names, `aria-controls`, and focus restoration.

## Issues found and resolved

1. **P1 - Invisible mobile dialog after breakpoint change.**
   - Found: resizing to desktop while mobile navigation was open left a CSS-hidden dialog, focus trap, and panel active.
   - Fixed: the mobile dialog now unmounts on desktop entry, focus moves to the visible desktop control, and returning to mobile focuses the mobile launcher.

2. **P1 - Hidden panel background work.**
   - Found: inactive desktop panels could still load workspace data or run design-queue maintenance.
   - Fixed: panel search and maintenance effects are gated by `active`; the data loader uses an enabled ref and ignores inactive or stale callbacks.

3. **P2 - Transitional rail ghost in the first screenshot.**
   - Found: the initial capture happened before the width animation settled.
   - Fixed: regression and visual tests now require computed width `0px` before layout measurement or capture.

## Verification completed

- Desktop Chrome component QA: full hide, zero-width settle, expanded main content, focus transfer, cookie/localStorage persistence, keyboard restore, and reload restore passed.
- Mobile Chrome component QA: independent launcher, modal, Escape behavior, mobile-to-desktop unmount, desktop-to-mobile visible focus, and viewport fit passed.
- Focused unit coverage: 6/6 passed.
- TypeScript: `pnpm --filter @workspace/up-flow run typecheck` passed.
- ESLint: sidebar implementation and focused tests passed with zero warnings.
- Full database-backed dashboard Playwright setup was unavailable locally because no `DATABASE_URL` is configured. The browser verification used the real production Sidebar component with deterministic QA props; database-dependent panel requests were outside this visual behavior scope.

## Comparison history

1. Source captured at 1920 x 921: confirmed the unwanted persistent rail.
2. Initial implementation capture: functional collapse passed, but the screenshot exposed the in-progress transition silhouette.
3. Final implementation capture: sidebar reached zero width, main content expanded, restore control remained accessible, and responsive focus lifecycle passed.

final result: passed
