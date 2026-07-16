# Theme screenshot regression tests

This isolated Playwright suite captures five representative application states
in both light and dark mode:

- Project Kanban board with the Filter popover open
- New Project dialog
- Finance onboarding form
- Marketing B2C onboarding form
- Client onboarding panel

The visual configuration fixes the viewport, device scale, locale, timezone,
motion preference, test data, and saved theme. It also disables traces so the
development test-login request is never included in a visual-test artifact.

## Generate the first baselines

Run the **Generate theme visual baselines** workflow in GitHub Actions. Download
the `theme-visual-baselines-linux` artifact, review all ten PNG files, and copy
them into `visual-tests/theme.spec.ts-snapshots/` without renaming them.

Once the approved Linux PNG files are committed, the **Light and dark theme
screenshots** job in the main test workflow compares every later change against
them and uploads actual/expected/diff images when a comparison fails.

## Local commands

With the development server, database, and test login token configured:

```sh
pnpm test:e2e:visual
pnpm test:e2e:visual:update
```

Linux CI owns the canonical baselines. Do not replace them with Windows or
macOS captures because system font rendering differs between operating systems.
