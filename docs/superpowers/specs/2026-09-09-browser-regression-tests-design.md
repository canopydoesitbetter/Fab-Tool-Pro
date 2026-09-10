# Fabri-Cadabra Browser Regression Test Design

Date: 2026-09-09
Status: Approved design, pending implementation plan
Repository: `canopydoesitbetter/Fab-Tool-Pro`
App: `fabrication_pro_capacitor/`

## Goal

Add a real browser-level regression suite that uses Fabri-Cadabra through the DOM like a user. The suite will complement, not replace, the existing source/contract verification scripts. A release must fail before native installers are built if critical browser interactions are broken.

## Non-goals

- Do not refactor application logic merely to make tests easier.
- Do not replace existing static verification scripts in this item.
- Do not change `com.fabricationpro.app`, native branding, Android signing, timer architecture, or application storage formats.
- Do not add broad multi-browser CI coverage in the first implementation.
- Do not test against the deployed GitHub Pages site as the primary release gate.

## Test Architecture

Use Playwright with a local static server serving the exact `fabrication_pro_capacitor/www/` directory that ships inside Capacitor.

Primary browser target: Chromium.

The suite will use a fresh Playwright browser context for each test so cookies, localStorage, session state, permissions, downloads, and browser clock changes cannot leak between tests. Tests will interact through stable user-facing IDs, roles, labels, visible text, keyboard input, pointer actions, file chooser controls, and browser dialogs. Test-only application hooks should not be introduced unless a genuine browser limitation makes one unavoidable.

A small Node static server will be owned by the test configuration and will serve local files only. Tests must not require external network access.

## Package and Lockfile Changes

Add Playwright test tooling as development dependencies and add npm scripts for normal and interactive browser testing.

The committed `package-lock.json` currently has stale root metadata at version `1.0.4` while `package.json` is `1.0.5`. Regenerating the lockfile for Playwright must also synchronize the root lockfile package metadata to `1.0.5`.

Expected scripts:

- `test:e2e` — run the browser regression suite headlessly.
- `test:e2e:ui` — run Playwright UI mode for local debugging.

The existing `npm run verify` command remains the static/source contract suite. Browser tests are a separate explicit gate in CI so failures are easier to identify.

## Test Organization

Tests are organized by user journey rather than application source files.

### 1. Navigation, Theme, and Drawers

Verify:

- Fabri-Cadabra opens successfully with Task Logging as the default page.
- Every Pages drawer entry can be opened and activates the expected visible tool panel.
- All nine tool pages are reachable: Task Logging, Fabricator Notes, Checklist, Basic Calculator, Quick Reference, Fastener Spacing, Sheet Optimizer, Saw Optimizer, and Aluminum Overhang.
- Settings remains reachable through the current app UI and displays the current app version.
- Theme toggling changes the active theme and persists after reload.
- Pages and feature drawers open and close through normal controls.
- Drawer `aria-hidden` and trigger `aria-expanded` states are correct.
- Focus moves into an opened drawer, Tab/Shift+Tab remain trapped while open, Escape closes the drawer, backdrop/close-button behavior works, and focus returns to the opener.

### 2. Task Logging and Shift Clock

Verify Task Logging entirely through visible controls:

- Create a job.
- Rename/edit the job.
- Delete a job through the real confirmation flow.
- Create preset tasks.
- Add selected presets to a job.
- Remove assigned preset tasks from the Preset Tasks drawer.
- Start and stop a task timer.
- Confirm elapsed time is recorded and visible.
- Start a timer, advance browser time through Playwright Clock, reload the page, and verify the running timer recovers from persisted timestamps rather than resetting.
- Verify one-active-task behavior where applicable.

Verify Shift Clock behavior through the real Settings/schedule UI and header control:

- Disabled schedule state keeps the Shift Clock unavailable.
- Enabling a valid schedule activates the clock control.
- Clock-in confirmation and resulting state are visible.
- Clock-out confirmation works and returns the UI to clocked-out state.
- Time-dependent cases use Playwright Clock rather than real waiting.

The tests must not replace or duplicate the deeper pure shift-schedule boundary tests already present; browser tests prove that the real controls are wired to that behavior.

### 3. Notes, Checklist, and Portable Data

Fabricator Notes:

- Create a topic.
- Edit its title and content.
- Apply bold, italic, and underline through the real formatting toolbar and verify formatted DOM content.
- Delete a topic through the real confirmation flow.
- Export notes through the browser download path.
- Remove/replace local data, import the exported JSON through the hidden file input/file chooser, and verify the topic/content returns.

Checklist:

- Create a checklist topic.
- Edit its title.
- Add multiple checklist items.
- Complete and uncomplete an item.
- Verify the visible progress indicator changes.
- Reorder items with the real drag/touch-capable interaction supported by the UI and verify the visible order changes.
- Delete a topic.
- Verify checklist export/import round trip.

Portable data tests should cover representative import/export behavior rather than redundantly test every identical serialization helper. Feature-specific formats that have materially different behavior, including Task Logging jobs/presets and Notes/Checklist backups, should each receive browser coverage.

### 4. Calculators, Reference, and Optimizers

Use small deterministic examples and assert visible user results.

Verify at minimum:

- Aluminum Overhang calculation produces expected visible cut output for a known input.
- Fastener Spacing produces expected spaces/count/location output for a known input.
- Basic Calculator performs representative arithmetic and at least one non-basic operation.
- Quick Reference changes table selection, toggles fraction/decimal display, and supports selectable/highlightable table interaction.
- Sheet Optimizer can add a small valid part set, run optimization, and show material/sheet results.
- Saw Optimizer can add a small valid part set, run optimization, and show tube/cut results.

These tests validate user-visible outcomes, not internal helper names or source markers.

### 5. Mobile Browser Coverage

Add a phone-sized Chromium project/context with touch enabled. It is not a second exhaustive copy of the desktop suite.

Verify:

- App launches without horizontal page-level overflow at the tested viewport.
- Header/Page navigation controls remain usable.
- Pages drawer opens and closes correctly.
- Representative core flows remain operable on mobile: page navigation, one data-entry flow, theme toggle, and one drawer-heavy interaction.
- Major cards, controls, and result areas remain inside the usable viewport width.

The initial viewport should represent a common modern phone size. Tests should assert layout invariants rather than pixel-perfect screenshots so harmless visual changes do not create noise.

## Time Control and Determinism

Time-sensitive tests use Playwright Clock where supported. Do not use long sleeps to prove timer persistence. Short waits should only be used for app-driven rendering/debounce behavior when there is no better DOM/event condition.

Tests should prefer Playwright assertions that automatically wait for expected DOM state. Random IDs generated by the app should be treated as opaque; assertions should use visible names, counts, and state.

Browser dialogs such as `window.confirm()` will be accepted or dismissed intentionally by the test that triggered them.

## Import/Export Strategy

Downloads must be captured with Playwright's download APIs and verified to produce a non-empty JSON file. Where practical, import/export testing should be a round trip:

1. Create data through the UI.
2. Export through the UI.
3. Remove or replace the local data through supported app controls.
4. Import the downloaded JSON through the app's file input/file chooser.
5. Verify the expected user-visible data is restored.

Generated fixture files may be used for specific validation/error cases, but the primary happy-path import tests should exercise actual exported data.

## CI Design

Add a dedicated `Browser Regression Tests` job to `.github/workflows/build-phone-installers.yml`.

The job runs on Ubuntu with Node 22 and performs:

1. Checkout.
2. `npm ci` from `fabrication_pro_capacitor/`.
3. Install Playwright Chromium and its required Linux dependencies.
4. Run `npm run verify`.
5. Run `npm run test:e2e`.

The Android and iOS installer jobs will declare `needs:` on the browser job. A browser regression failure therefore prevents both installer artifacts from being built/published.

The browser job runs for the same `main` and `work` pushes and manual dispatches already handled by the installer workflow.

CI browser settings:

- Chromium only.
- Retries: 1 in CI, 0 locally.
- Small worker count to reduce race/flakiness risk.
- Failure artifacts only: Playwright HTML report plus traces/screenshots/videos when available.
- No successful-run screenshot/video artifact upload.

Native build, version, package, branding, and Android signing verification remain unchanged after the browser gate.

## Failure Diagnostics

Playwright configuration should retain trace, screenshot, and video material for failed tests/retries. CI uploads these artifacts on failure so a broken interaction can be reproduced from the test report instead of inferred from source-string verifier output.

Test names should state the user behavior being proven. Failures should identify the feature and visible expectation rather than internal implementation details.

## Local Developer Workflow

Document the two primary commands:

- `npm run test:e2e`
- `npm run test:e2e:ui`

The local server lifecycle should be handled automatically by Playwright so no separate manual web-server command is required.

## Files Expected to Change

Implementation is expected to touch only test infrastructure, dependency metadata, workflow configuration, and concise test documentation unless browser tests uncover a real application defect.

Expected files include:

- `fabrication_pro_capacitor/package.json`
- `fabrication_pro_capacitor/package-lock.json`
- `fabrication_pro_capacitor/playwright.config.mjs`
- `fabrication_pro_capacitor/tests/e2e/*.spec.mjs`
- a small local static-server script/config if Playwright's `webServer` configuration requires it
- `.github/workflows/build-phone-installers.yml`
- a concise testing README/documentation file

If tests expose an existing user-facing bug, that bug must be diagnosed separately and fixed only when necessary for the approved regression behavior. No unrelated refactor is included in this audit item.

## Acceptance Criteria

This audit item is complete only when:

- Browser tests actually click/type/import/export/reload/use dialogs through the DOM.
- Every user flow listed in the approved scope has browser-level coverage.
- Timer recovery is proven across a real page reload using persisted state and controlled time.
- Desktop and mobile browser suites pass locally/against the feature branch environment.
- Existing static verification continues to pass.
- CI has a dedicated browser regression job and blocks Android/iOS builds when it fails.
- Playwright diagnostics are uploaded on failure.
- `package-lock.json` is synchronized with package version `1.0.5`.
- The staging `work` branch passes the browser gate and both native installer jobs.
- The exact verified staging commit is promoted to `main`.
- Production browser gate, Android installer, iOS installer, and Pages deployment succeed before the checklist item is marked complete.
