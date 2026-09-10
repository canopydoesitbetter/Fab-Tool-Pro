# Remove Runtime UX Patch / Override Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `index.html`, `app.js`, and `styles.css` the sole owners of the final Fabri-Cadabra UI and delete the runtime `ux.js` / `ux.css` patch layer without changing visible behavior.

**Architecture:** Static controls and overlays are authored directly in `index.html`, UI behavior binds once in `app.js`, and approved styles live in `styles.css`. Dynamic Task Logging rows remain dynamic, but their final semantics are emitted directly by the canonical renderer. Existing Shift Schedule domain logic and persistence stay intact; only presentation ownership moves.

**Tech Stack:** HTML5, vanilla JavaScript, CSS, Capacitor, Node verification scripts, Playwright 1.63.0 / Chromium.

**Spec:** `docs/superpowers/specs/2026-09-10-remove-runtime-ux-patch-design.md`

## Global Constraints

- Production baseline: `d6971c9b80058907be4f3e3f6b2b08ee21957d4c`.
- Package version remains `1.0.5`.
- Capacitor app ID remains exactly `com.fabricationpro.app`.
- Do not change storage keys, portable JSON formats, timer semantics, signing, branding assets, or native bundle identity.
- Preserve the current visible desktop/mobile UI and behavior.
- `www/ux.js` and `www/ux.css` must be absent from the shipped `www/` tree at completion.
- No Task Logging `MutationObserver` repair and no runtime relocation of existing app-owned controls.
- All static verification and the complete 28-test Playwright suite must pass before staging.

---

### Task 1: Establish canonical static structure and style ownership

**Files:**
- Modify: `fabrication_pro_capacitor/www/index.html`
- Modify: `fabrication_pro_capacitor/www/styles.css`
- Modify: `fabrication_pro_capacitor/scripts/verify-ux-polish.mjs`

**Interfaces:**
- Consumes: current markup IDs/classes referenced by `app.js` and Playwright.
- Produces: final first-paint markup for status placement, Notes Topics launcher, Settings page/footer, Shift Schedule form, and Changelog overlay; approved CSS in `styles.css`.

- [ ] **Step 1: Rewrite the static UX verifier to assert canonical first-paint ownership**

Update `verify-ux-polish.mjs` so it reads `index.html`, `styles.css`, and `app.js`, not `ux.js` / `ux.css`. Require that:

```js
if (html.includes('href="ux.css"') || html.includes('src="ux.js"')) {
  throw new Error('Runtime UX patch assets must not be referenced by index.html.');
}
if (!html.includes('id="fabricatorNotesTopicsBtn"')) throw new Error('Notes Topics button missing.');
if (!html.includes('class="notes-topics-inline-btn"')) throw new Error('Notes Topics button must be authored in its final editor position.');
if (app.includes('new MutationObserver(')) throw new Error('Task Logging must not rely on MutationObserver repair.');
```

Also keep existing assertions for management accent colors, collapsed panels, Job # / Name, and Topic labels, but point CSS checks at `styles.css`.

- [ ] **Step 2: Run the verifier and confirm it fails against the old architecture**

Run: `npm run verify:ux-polish`

Expected: FAIL because `index.html` still references `ux.css` / `ux.js`, Notes Topics is not yet in final source position, and styles still live in `ux.css`.

- [ ] **Step 3: Move static markup into `index.html`**

Author directly in source:

```html
<link rel="stylesheet" href="styles.css" />
```

Remove the `ux.css` link.

Move `#taskLogStatus` outside `#taskLogManagementDetails` in source markup, preserving ID and status attributes.

Move `#fabricatorNotesStatus` outside `#fabricatorNotesManagementDetails` in source markup.

Place `#fabricatorNotesTopicsBtn` as the first control inside `#fabricatorNotesEditor` with class `notes-topics-inline-btn`; remove it from `.notes-management-actions`, leaving New Topic / Export Notes / Import Notes there.

Add the Settings footer/button directly to the Pages drawer body:

```html
<div class="fab-settings-drawer-footer">
  <button id="settingsPageBtn" class="fab-settings-link" type="button" data-tool="settings" aria-controls="tool-settings">Settings</button>
</div>
```

Author the complete `#tool-settings` panel, Shift Schedule controls, `#settingsChangelogBackdrop`, and `#settingsChangelogDrawer` directly in `index.html`, preserving all current IDs and copy from `ux.js`.

Remove `<script src="ux.js" defer></script>`.

- [ ] **Step 4: Merge approved `ux.css` rules into `styles.css`**

Move the currently approved rules for management details, Task Logging preset launch/remove state, Notes layout, Settings, Changelog, Shift Schedule, responsive breakpoints, reduced-motion behavior, and print behavior into `styles.css`. Do not duplicate selectors already present; keep one canonical rule per behavior.

- [ ] **Step 5: Run static verifier**

Run: `npm run verify:ux-polish`

Expected: PASS for first-paint structure/style ownership once later-task MutationObserver assertions are temporarily scoped to `ux.js` removal state as needed. If Task 2 is required for the observer assertion, keep the assertion disabled until Task 2 and note the dependency in the commit.

- [ ] **Step 6: Commit**

```bash
git add fabrication_pro_capacitor/www/index.html fabrication_pro_capacitor/www/styles.css fabrication_pro_capacitor/scripts/verify-ux-polish.mjs
git commit -m "refactor: move patched UI structure into canonical markup"
```

### Task 2: Make Task Logging render final assigned-preset semantics directly

**Files:**
- Modify: `fabrication_pro_capacitor/www/app.js`
- Modify: `fabrication_pro_capacitor/scripts/verify-ux-polish.mjs`
- Test: `fabrication_pro_capacitor/tests/e2e/tasklog-shift.spec.mjs`

**Interfaces:**
- Consumes: `taskLogPresets`, active job/task rows, existing `removeTaskLogTask(job, task)` behavior.
- Produces: renderer-emitted `[data-tasklog-remove-assigned]` controls for assigned presets; no post-render attribute rewriting.

- [ ] **Step 1: Strengthen verifier assertions for direct renderer semantics**

Require the preset renderer to emit both stable action types intentionally:

```js
if (!/data-tasklog-remove-assigned/.test(app)) throw new Error('Assigned preset remove action is missing.');
if (!/data-tasklog-delete-preset/.test(app)) throw new Error('Preset library delete action is missing.');
if (/normalizeAssignedPresetActions|removeAssignedTaskLogPreset/.test(app)) throw new Error('Post-render preset repair logic must be removed.');
if (/new\s+MutationObserver/.test(app)) throw new Error('Task Logging MutationObserver repair must be absent.');
```

- [ ] **Step 2: Run verifier to establish failure**

Run: `npm run verify:ux-polish`

Expected: FAIL until the canonical renderer/event handling is updated.

- [ ] **Step 3: Update `renderTaskLogPresetLibrary()`**

For assigned rows, emit the final remove-assignment button directly:

```js
const actionButton = assigned
  ? `<button class="tasklog-mini-delete tasklog-remove-assigned-btn" type="button" aria-label="Remove ${escapeHtml(preset.name)} from this job" title="Remove from this job" data-tasklog-remove-assigned="${preset.id}">−</button>`
  : `<button class="tasklog-mini-delete" type="button" aria-label="Delete preset ${escapeHtml(preset.name)}" data-tasklog-delete-preset="${preset.id}">×</button>`;
```

Use `actionButton` in the row template. Keep assigned checkboxes disabled as today.

- [ ] **Step 4: Bind direct remove-assigned click behavior**

In the existing `taskLogPresetList` click handler, branch by stable action attribute. For `[data-tasklog-remove-assigned]`, resolve the active job and matching assigned task by `presetId` first and name fallback second, then call the existing task removal path so confirmations/timer safety remain unchanged. For `[data-tasklog-delete-preset]`, keep current preset-library deletion behavior.

- [ ] **Step 5: Run Task Logging regression tests and verifier**

Run:

```bash
npm run verify:ux-polish
npm run test:e2e -- --project=desktop-chromium tests/e2e/tasklog-shift.spec.mjs
```

Expected: verifier PASS; Task Logging/Shift spec PASS.

- [ ] **Step 6: Commit**

```bash
git add fabrication_pro_capacitor/www/app.js fabrication_pro_capacitor/scripts/verify-ux-polish.mjs
git commit -m "refactor: render task preset actions without runtime repair"
```

### Task 3: Move Notes Topics drawer behavior into canonical app logic

**Files:**
- Modify: `fabrication_pro_capacitor/www/app.js`
- Test: `fabrication_pro_capacitor/tests/e2e/notes-checklist.spec.mjs`

**Interfaces:**
- Consumes: shared `openDrawer`, `closeDrawer`, `isDrawerOpen`; source-authored Notes drawer controls.
- Produces: one direct Notes drawer binding with focus return, backdrop close, Escape close, and close-after-topic-selection.

- [ ] **Step 1: Add direct Notes drawer bindings in the Fabricator Notes section**

Resolve:

```js
const fabricatorNotesTopicsBtn = document.getElementById('fabricatorNotesTopicsBtn');
const fabricatorNotesTopicsDrawer = document.getElementById('fabricatorNotesTopicsDrawer');
const fabricatorNotesTopicsBackdrop = document.getElementById('fabricatorNotesTopicsBackdrop');
const fabricatorNotesTopicsCloseBtn = document.getElementById('fabricatorNotesTopicsCloseBtn');
```

Implement `setFabricatorNotesTopicsDrawerOpen(open)` using the shared drawer primitives and update `aria-expanded`.

Bind launcher, close button, backdrop, drawer Escape, and topic-list selection. Do not call `insertBefore`, `after`, or any runtime relocation method for these controls.

- [ ] **Step 2: Run Notes tests**

Run:

```bash
npm run test:e2e -- --project=desktop-chromium tests/e2e/notes-checklist.spec.mjs
```

Expected: all Notes and Checklist tests PASS.

- [ ] **Step 3: Commit**

```bash
git add fabrication_pro_capacitor/www/app.js
git commit -m "refactor: bind notes topics drawer in canonical app"
```

### Task 4: Integrate Settings, Changelog, Shift Clock, and Shift Schedule presentation into `app.js`

**Files:**
- Modify: `fabrication_pro_capacitor/www/app.js`
- Modify: `fabrication_pro_capacitor/scripts/verify-settings-changelog.mjs`
- Modify: `fabrication_pro_capacitor/scripts/verify-shift-schedule.mjs`
- Test: `fabrication_pro_capacitor/tests/e2e/navigation.spec.mjs`
- Test: `fabrication_pro_capacitor/tests/e2e/tasklog-shift.spec.mjs`

**Interfaces:**
- Consumes: existing navigation primitives, `window.FabriCadabraApp.shiftSchedule` domain API / local shift functions, source-authored Settings markup.
- Produces: Settings as a normal selectable page; canonical Shift Clock/Settings UI bindings; canonical Changelog drawer behavior.

- [ ] **Step 1: Extend primary navigation for Settings**

Resolve `#settingsPageBtn` and include `settings` in valid selectable tools without adding Settings to the nine `.fab-page-link` fabrication links. Update `selectTool(tool)` to set `.active` on normal page links and the Settings button appropriately. `getActiveTool()` must return `settings` naturally when selected; do not override or monkey-patch it.

Bind `settingsPageBtn` click to `selectTool('settings')` and close the Pages drawer using existing shared behavior.

- [ ] **Step 2: Move browser version marker to `app.js`**

At canonical app scope add:

```js
const FABRI_CADABRA_VERSION='1.0.5'; // @generated from package.json by scripts/sync-app-version.mjs
```

Set `#settingsVersionValue` text from this constant after elements are resolved, and expose `window.FabriCadabraApp.version` once the app API exists.

- [ ] **Step 3: Move Changelog behavior into `app.js`**

Bind `#settingsChangelogBtn`, close button, backdrop, and Escape using shared drawer primitives. Do not construct the overlay or changelog entries dynamically.

- [ ] **Step 4: Move Shift smart-time helpers and UI bindings**

Move `shiftTimeFrom24`, `normalizeShiftTimeEntry`, `shiftTimeTo24`, smart input filtering/blur normalization, form population/collection/status rendering, enable/disable confirmation flow, pause overrides, and schedule-change rendering from `ux.js` into the Shift Schedule section of `app.js`.

Preserve exact confirmation copy and existing domain calls. Do not alter the pure-core shift calculation functions or storage schema.

- [ ] **Step 5: Move Shift Clock presentation/bindings**

Move `renderShiftClockUi()` and `#shiftClockBtn` click confirmation flow into `app.js`. Preserve scheduled/overtime/unscheduled intent messages and manual clock-out warning exactly.

- [ ] **Step 6: Rewrite Settings/Shift verifiers against canonical files**

`verify-settings-changelog.mjs` must read `index.html`, `app.js`, `styles.css`, `package.json`, and the sync script. Assert:
- Settings and Changelog IDs exist in HTML.
- Settings navigation is canonical and no `installSettingsPage()` / `originalGetActiveTool` patch exists.
- current version marker lives in `app.js` and equals package.json.
- changelog entries are in newest-first order in HTML.
- Settings/Changelog styles live in `styles.css`.

`verify-shift-schedule.mjs` must check Shift Schedule control IDs in HTML, UI behavior/copy in `app.js`, and styles in `styles.css`. Keep all existing pure-core schedule tests intact.

- [ ] **Step 7: Run targeted tests and verifiers**

Run:

```bash
npm run verify:settings-changelog
npm run verify:shift-schedule
npm run test:e2e -- --project=desktop-chromium tests/e2e/navigation.spec.mjs tests/e2e/tasklog-shift.spec.mjs
```

Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add fabrication_pro_capacitor/www/app.js fabrication_pro_capacitor/scripts/verify-settings-changelog.mjs fabrication_pro_capacitor/scripts/verify-shift-schedule.mjs
git commit -m "refactor: make settings and shift UI canonical"
```

### Task 5: Migrate version sync and delete the UX patch assets

**Files:**
- Modify: `fabrication_pro_capacitor/scripts/sync-app-version.mjs`
- Modify: any remaining verifier that reads `www/ux.js` or `www/ux.css`
- Delete: `fabrication_pro_capacitor/www/ux.js`
- Delete: `fabrication_pro_capacitor/www/ux.css`

**Interfaces:**
- Consumes: generated `FABRI_CADABRA_VERSION` marker in `app.js`.
- Produces: version sync that updates canonical browser code; no shipped runtime patch files.

- [ ] **Step 1: Find all remaining references to `ux.js` and `ux.css`**

Run:

```bash
grep -R "ux\.js\|ux\.css" -n fabrication_pro_capacitor --exclude-dir=node_modules --exclude-dir=playwright-report --exclude-dir=test-results
```

Expected before migration: only sync/verifier/docs references remain; runtime HTML reference is already gone.

- [ ] **Step 2: Update `sync-app-version.mjs`**

Change canonical source path from `www/ux.js` to `www/app.js` and keep the same generated-marker regex/comment contract:

```js
const appPath=join(root,'www','app.js');
const source=readFileSync(appPath,'utf8');
const marker=/const FABRI_CADABRA_VERSION='[^']+'; \/\/ @generated from package\.json by scripts\/sync-app-version\.mjs/;
```

Write the updated source back to `app.js`.

- [ ] **Step 3: Update any remaining runtime-architecture verifiers**

Every verification script must inspect canonical HTML/app/styles or explicitly assert absence of `ux.*`; no active verifier may require those files to exist.

- [ ] **Step 4: Delete `www/ux.js` and `www/ux.css`**

Delete both files from the feature branch.

- [ ] **Step 5: Run aggregate static verification**

Run:

```bash
npm run verify
```

Expected: PASS with `ux.js` and `ux.css` absent.

- [ ] **Step 6: Add architectural absence check**

Ensure at least one aggregate verifier fails if either runtime include returns, if either file exists, if `installSettingsPage`, `normalizeAssignedPresetActions`, or Task Logging `MutationObserver` repair is reintroduced.

- [ ] **Step 7: Commit**

```bash
git add -A fabrication_pro_capacitor
git commit -m "refactor: remove runtime ux patch assets"
```

### Task 6: Full regression, review, staging, and production promotion

**Files:**
- Review: all files changed from `d6971c9b80058907be4f3e3f6b2b08ee21957d4c` to feature head
- Update after production proof: `/mnt/data/Fabri-Cadabra_App_Audit_Fix_Checklist.txt`

**Interfaces:**
- Consumes: complete canonical UI implementation.
- Produces: verified production SHA with Audit Item #3 evidence.

- [ ] **Step 1: Run full static and browser verification**

Run:

```bash
npm ci
npx playwright install --with-deps chromium
npm run verify
npm run test:e2e
```

Expected: all static verifiers PASS and all 28 Playwright tests PASS.

- [ ] **Step 2: Review architecture and diff**

Confirm:
- `www/ux.js` absent.
- `www/ux.css` absent.
- `index.html` has no references to either.
- no Task Logging `MutationObserver` repair.
- no runtime relocation of migrated controls.
- Settings uses canonical navigation.
- no storage/version/native identity drift.
- no unrelated behavior change.

- [ ] **Step 3: Stage exact verified feature SHA to `work`**

Fast-forward `work` to the exact feature SHA. Do not create a new staging-only code commit.

- [ ] **Step 4: Verify staging workflow**

Require Browser Regression Tests success before Android/iOS. Verify staging APK package `com.fabricationpro.app`, versionName `1.0.5`, versionCode `1000005`, permanent signing certificate fingerprint, and iOS bundle/version `com.fabricationpro.app` / `1.0.5`.

- [ ] **Step 5: Promote exact staging SHA to `main`**

Fast-forward `main` to the same SHA only after staging is green.

- [ ] **Step 6: Verify production workflows**

Require production Browser Regression, Android, iOS, and Pages success from the identical SHA. Capture artifact IDs and native metadata/signing evidence.

- [ ] **Step 7: Mark Audit Item #3 complete**

Update the audit checklist only after production proof. Record the production SHA, browser test count, installer run/artifact IDs, Pages run, and the architectural result that `ux.js` / `ux.css` are gone and no Task Logging repair observer remains.
