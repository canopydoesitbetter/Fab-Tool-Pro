# App Feature Modules Refactor Implementation Plan

> **For agents:** Execute this plan with test-driven development and verify each extraction boundary before merging to `main`.

**Goal:** Break `fabrication_pro_capacitor/www/app.js` into focused feature modules without changing application behavior, persistence formats, calculations, imports/exports, or public runtime contracts.

**Architecture:** Keep classic deferred browser scripts and deterministic load order. The extracted files intentionally share the browser's classic-script global lexical environment so existing function bodies and call sites can move nearly verbatim instead of being rewritten. Preserve `window.FabriCadabraApp` as the existing public integration surface used by `backup.js` and `calculator.js`. Move only source ownership and test paths; do not change storage keys or schemas.

**Tech Stack:** Vanilla HTML/CSS/JavaScript, Node 22 verification scripts, Playwright, Capacitor 8.

**Spec:** Audit item 5 supplied in the project conversation on 2026-09-10.

## Global constraints

- Keep package version `1.0.5` during this behavior-preserving audit refactor.
- Keep Capacitor app ID `com.fabricationpro.app` unchanged.
- Preserve all localStorage keys, file-format identifiers, schema versions, calculation functions, and import/export payload shapes.
- Keep `backup.js`, `calculator.js`, and `native-compat.js` as already-separated subsystems.
- Keep all runtime scripts deferred and explicitly ordered in `www/index.html`; do not introduce bundlers or ES-module timing changes.
- Preserve `window.FabriCadabraApp`, `window.runFabricationSelfTests`, and `window.runFabricationBrowserSelfTests` contracts.
- Do not weaken existing regression tests merely to accommodate file movement. Migrate their source lookup to the module manifest.

### Task 1: Add a failing module architecture verifier

**Files:**
- Create: `fabrication_pro_capacitor/scripts/app-module-manifest.mjs`
- Create: `fabrication_pro_capacitor/scripts/verify-app-modules.mjs`
- Modify: `fabrication_pro_capacitor/package.json`

**RED:** Require the legacy `www/app.js` monolith to be absent, require the expected module set and deterministic `defer` order, parse every module, and assert major feature markers live in the intended files. Add `verify:app-modules` to the aggregate `npm run verify`. Confirm CI fails while the monolith still exists.

### Task 2: Mechanically extract foundation modules

**Files:**
- Create: `www/app/bootstrap.js`
- Create: `www/app/storage.js`
- Create: `www/app/drawers.js`
- Create: `www/app/navigation.js`

Move version/shared pure helpers, storage access, drawer behavior, and navigation/theme behavior with minimal text changes. Keep all original storage calls and `FabriCadabraApp` navigation API behavior.

### Task 3: Extract Task Logging and Shift Schedule

**Files:**
- Create: `www/app/shift-schedule.js`
- Create: `www/app/task-logging.js`

Keep the existing pure-core markers for Shift Schedule and job rename. Preserve Task Logging timer timestamps, session storage, preset/job import formats, and schedule enforcement.

### Task 4: Extract Notes, Checklist, Quick Reference, and calculators

**Files:**
- Create: `www/app/notes.js`
- Create: `www/app/checklist.js`
- Create: `www/app/quick-reference.js`
- Create: `www/app/calculators.js`

Move code by existing section boundaries. Do not alter normalization, persistence, reorder behavior, gauge/fraction values, overhang math, or fastener-spacing math.

### Task 5: Extract optimizers

**Files:**
- Create: `www/app/sheet-optimizer.js`
- Create: `www/app/saw-optimizer.js`

Keep shared measurement parsing available before Saw Optimizer loads. Preserve worker source construction, material/product data, packing algorithms, optimizer save/import formats, and rendering behavior.

### Task 6: Extract settings, import/export bridge, and runtime self-tests

**Files:**
- Create: `www/app/settings.js`
- Create: `www/app/import-export.js`
- Create: `www/app/self-tests.js`

Keep settings controls and changelog presentation separate from full-backup normalization. Preserve the exact `FabriCadabraBackup` schema and persistence-key registry. Load self-tests only after all feature functions exist.

### Task 7: Replace script loading and migrate regression source lookup

**Files:**
- Modify: `www/index.html`
- Modify: `scripts/sync-app-version.mjs`
- Modify: `scripts/verify-app-version.mjs`
- Modify: `scripts/verify-web.mjs`
- Modify: `scripts/verify-features.mjs`
- Modify any other verifier that reads `www/app.js` directly.
- Delete: `www/app.js`

Use `scripts/app-module-manifest.mjs` as the canonical verifier-side module list. `sync-app-version.mjs` must update `www/app/bootstrap.js`. Existing feature verifiers must still test the same source markers and pure-core code after the move.

### Task 8: Verification and release gate

Run, in order:

1. `npm run verify:app-modules`
2. `npm run verify`
3. `npm run test:e2e`
4. Existing GitHub Actions Browser Regression Tests on `work`
5. Compare `work` against the baseline to confirm the change is structural and version/app ID/storage contracts are unchanged.

Only after all gates pass, fast-forward `main` to the verified `work` commit and confirm the production workflow passes.