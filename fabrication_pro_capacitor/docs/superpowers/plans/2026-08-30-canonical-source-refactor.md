# Fabri-Cadabra Canonical Source Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy frozen-source/runtime-enhancement architecture with a single canonical Fabri-Cadabra source layout while preserving all application behavior, stored data, import/export compatibility, Android update identity, and permanent signing.

**Architecture:** `www/index.html` owns static markup and copy, `www/styles.css` owns all styling, `www/app.js` owns established fabrication application logic and canonical navigation/drawer mechanics, `www/calculator.js` owns calculator behavior, and `www/native-compat.js` owns native Blob export compatibility only. Legacy duplicate source and runtime replacement code are removed after equivalence/compatibility verification.

**Tech Stack:** HTML5, CSS, vanilla JavaScript, Node.js 22 verification scripts, Capacitor 8.5, GitHub Actions, Android Gradle/apksigner, Xcode.

**Spec:** `fabrication_pro_capacitor/docs/superpowers/specs/2026-08-30-canonical-source-refactor-design.md`

## Global Constraints

- Keep Capacitor application ID exactly `com.fabricationpro.app`.
- Keep Android signing certificate SHA-256 exactly `5769bbe5a1f4fdccd985fd0145495f3614e0db41992871c99b9eb361634bb586`.
- Keep existing Android signing secret names and signing contract unchanged.
- Official product/native launcher name becomes `Fabri-Cadabra` on web, Android, and iOS.
- Do not rename existing localStorage keys or JSON import/export format identifiers.
- Do not change task-timer timestamp semantics (`running`, `startedAt`, `accumulatedMs`).
- Do not change fabrication formulas, optimizer heuristics/geometry, saw rules, checklist/notes/job schemas, or import validators.
- Do not introduce a framework, bundler, or new runtime dependency.
- No shipped script may dynamically load another shipped script.
- No live UI element may exist only to be removed/replaced during startup.

---

### Task 1: Lock the target architecture in failing verification

**Files:**
- Modify: `fabrication_pro_capacitor/scripts/verify-web.mjs`
- Modify: `fabrication_pro_capacitor/scripts/verify-features.mjs`
- Modify: `fabrication_pro_capacitor/scripts/verify-native-shim.mjs`

**Interfaces:**
- Consumes: current legacy `www/index.html`, `www/fabri-cadabra.js`, `www/native-compat.js`.
- Produces: architecture tests that fail against the legacy layout and pass only after canonical ownership is established.

- [ ] **Step 1: Inventory compatibility identifiers from the baseline**

Extract all literal localStorage key constants/uses and application import/export `format` identifiers from the current canonical legacy source. Store the explicit required list in `verify-features.mjs`; do not retain a duplicate source file merely for comparison.

- [ ] **Step 2: Write target architecture checks**

`verify-web.mjs` must require direct `styles.css`, `native-compat.js`, `app.js`, `calculator.js` references, no inline application stylesheet/script, direct `Fabri-Cadabra` markup, and absence of legacy runtime-loader patterns.

`verify-features.mjs` must require exactly nine page links/panels, static calculator/guide markup, canonical navigation, the documented `window.FabriCadabraApp` boundary, all protected persistence/format markers, and absence of runtime replacement markers.

`verify-native-shim.mjs` must reject dynamic feature loading and continue proving exact Blob-byte preservation.

- [ ] **Step 3: Run tests and verify RED**

Run:

```bash
cd fabrication_pro_capacitor
node scripts/verify-web.mjs
node scripts/verify-features.mjs
node scripts/verify-native-shim.mjs
```

Expected: architecture checks fail specifically because `styles.css`, `app.js`, `calculator.js`, static Pages/Calculator markup, and native-shim separation do not exist yet.

- [ ] **Step 4: Commit the RED contract**

Commit only the verifier changes before changing shipped application code.

---

### Task 2: Mechanically extract canonical CSS and established application JavaScript

**Files:**
- Create: `fabrication_pro_capacitor/www/styles.css`
- Create: `fabrication_pro_capacitor/www/app.js`
- Modify: `fabrication_pro_capacitor/www/index.html`

**Interfaces:**
- Consumes: inline `<style>` and primary inline application IIFE from `www/index.html`.
- Produces: external CSS and JavaScript files with the existing application logic preserved byte-for-byte except for navigation/drawer changes explicitly covered by later tasks.

- [ ] **Step 1: Extract stylesheet mechanically**

Move the contents of the single application `<style>` block to `www/styles.css` and replace it with:

```html
<link rel="stylesheet" href="styles.css" />
```

- [ ] **Step 2: Extract the established application IIFE mechanically**

Move the large inline application script to `www/app.js`; leave no large inline script in `index.html`.

- [ ] **Step 3: Remove legacy navigation-only CSS**

Delete `.tool-menu`, `.tool-tab`, `.tool-tab.active`, their responsive overrides, and legacy print references after the old navigation markup is removed. Do not remove selectors used by any surviving markup.

- [ ] **Step 4: Syntax-check extracted files**

Run `node --check www/app.js` and parse the CSS/HTML architecture with `verify-web.mjs`.

---

### Task 3: Make Fabri-Cadabra markup canonical and consolidate navigation/drawers

**Files:**
- Modify: `fabrication_pro_capacitor/www/index.html`
- Modify: `fabrication_pro_capacitor/www/styles.css`
- Modify: `fabrication_pro_capacitor/www/app.js`

**Interfaces:**
- Produces: `window.FabriCadabraApp.getActiveTool()`, `.openDrawer(drawerId, returnFocusElement)`, `.closeDrawer(drawerId, returnFocusElement)`, `.isDrawerOpen(drawerId)`.
- Consumes: static `.fab-page-link[data-tool]` links and `.tool-panel` sections in `index.html`.

- [ ] **Step 1: Replace the legacy product/nav markup directly**

Set `<title>` and `.brand h1` to `Fabri-Cadabra`. Delete `<nav class="tool-menu">`. Add static fixed `#pageMenuBtn`, static `#pageMenuBackdrop`, and static `#pageMenuDrawer` with exactly the nine approved page identifiers.

- [ ] **Step 2: Move approved Pages/calculator CSS into `styles.css`**

Transfer current approved enhancement CSS without visual redesign and remove all style injection.

- [ ] **Step 3: Implement one canonical `selectTool(tool)`**

Use an allow-list/set containing exactly `overhang`, `fasteners`, `optimizer`, `saw`, `tasklog`, `notes`, `checklist`, `reference`, `calculator`. Select exactly one `.tool-panel`, synchronize page-link active state, preserve `fabricationTool`, restore valid saved pages on startup, fall back to `overhang`, and preserve scroll-to-top.

- [ ] **Step 4: Implement one generic drawer primitive**

Use the `*Drawer` -> `*Backdrop` naming convention to open/close drawers, synchronize `aria-hidden`, focus close buttons/return focus, and set `body.cut-list-drawer-open` based on whether any drawer is open. Update optimizer, saw, task-preset, Pages, and Calculator Guide wrappers to use the same primitive rather than duplicating drawer state mechanics.

- [ ] **Step 5: Expose only the documented application boundary**

Assign exactly:

```js
window.FabriCadabraApp = {
  getActiveTool,
  openDrawer,
  closeDrawer,
  isDrawerOpen
};
```

Do not expose optimizer/timer/internal state.

- [ ] **Step 6: Verify navigation contracts**

Run architecture checks and existing application self-test parsing. Confirm no `.tool-tab`/detached-button indirection remains.

---

### Task 4: Move Basic Calculator and Calculator Guide to canonical static source

**Files:**
- Modify: `fabrication_pro_capacitor/www/index.html`
- Create: `fabrication_pro_capacitor/www/calculator.js`
- Modify: `fabrication_pro_capacitor/www/styles.css`

**Interfaces:**
- Consumes: `window.FabriCadabraApp` only for active-tool and drawer state.
- Produces: calculator behavior bound to static `#tool-calculator`, `#calculatorGuideDrawer`, and existing calculator control IDs/data attributes.

- [ ] **Step 1: Add static calculator panel and guide drawer markup**

Move the currently approved calculator panel and all guide sections from the runtime enhancement into `index.html` before the footer/body scripts.

- [ ] **Step 2: Write calculator behavior from the current known-good implementation**

Move calculator state/operations into `calculator.js` without generating HTML or CSS. Keep sequential handheld evaluation, repeated equals, omitted-second-operand behavior, contextual percent, divide-by-zero error, memory, root, power, rounding, CE/AC, sign, pi, and keyboard behavior unchanged.

- [ ] **Step 3: Enforce Escape priority**

If Pages is open, app-level handling closes it and stops further Escape handling. If Calculator Guide is open, calculator handling closes it. Only with no drawer open and calculator active may Escape clear the calculation.

- [ ] **Step 4: Verify calculator structure/behavior markers**

Run `verify-features.mjs` and syntax-check `calculator.js`.

---

### Task 5: Restrict native compatibility and normalize official product naming

**Files:**
- Modify: `fabrication_pro_capacitor/www/native-compat.js`
- Modify: `fabrication_pro_capacitor/capacitor.config.json`
- Modify: `fabrication_pro_capacitor/package.json`
- Modify: `.github/workflows/build-phone-installers.yml`

**Interfaces:**
- Native identity remains `com.fabricationpro.app` with the same signing key.
- Product/launcher/display name becomes `Fabri-Cadabra`.

- [ ] **Step 1: Remove enhancement loading from native shim**

Delete the dynamic `fabri-cadabra.js` loader and update comments/log prefixes to `Fabri-Cadabra`; retain the native-only Blob interception exactly.

- [ ] **Step 2: Set official native app name**

Set:

```json
"appName": "Fabri-Cadabra"
```

Keep `appId` exactly `com.fabricationpro.app`.

- [ ] **Step 3: Normalize package and workflow naming**

Rename user/developer-facing descriptions, verification step names, APK/IPA filenames, signing-report filenames, and uploaded artifact names from `Fabrication-Pro` to `Fabri-Cadabra`. Do not rename secrets or compatibility-sensitive IDs.

Target artifacts:

```text
Fabri-Cadabra-Android.apk
Fabri-Cadabra-Android.apk.sha256
Fabri-Cadabra-Android-signing.txt
Fabri-Cadabra-iPhone-Unsigned.ipa
Fabri-Cadabra-iPhone-Unsigned.ipa.sha256
```

- [ ] **Step 4: Verify native-name generation**

In CI, after `npx cap add android` / `npx cap add ios`, verify generated Android launcher label and iOS display/bundle name resolve to `Fabri-Cadabra`.

---

### Task 6: Remove duplicate/stale source and rewrite developer documentation

**Files:**
- Delete: `fabrication_pro_capacitor/www/fabri-cadabra.js`
- Delete: `fabrication_pro_capacitor/source/fabrication_pro.original.html`
- Delete: `fabrication_pro_capacitor/SOURCE_SHA256.txt`
- Modify: `fabrication_pro_capacitor/README.md`
- Modify: affected `fabrication_pro_capacitor/docs/*.md`

**Interfaces:**
- Git history is the archive; active tree contains one current source only.

- [ ] **Step 1: Run compatibility verification before deletion**

Confirm the explicit storage-key/format inventory and syntax checks pass against the canonical files.

- [ ] **Step 2: Delete legacy files**

Remove the enhancement layer, frozen duplicate HTML, and obsolete source hash.

- [ ] **Step 3: Update docs**

Document the source map:

```text
www/index.html       markup/copy
www/styles.css       styling
www/app.js           fabrication tools/navigation/shared drawers
www/calculator.js    calculator behavior
www/native-compat.js native export bridge only
```

Remove claims about immutable original HTML. Normalize product-facing wording to `Fabri-Cadabra`.

- [ ] **Step 4: Run stale-name/source scan**

Search the active tree for `fabrication_pro.original.html`, `SOURCE_SHA256`, `fabri-cadabra.js`, runtime title replacement, `.tool-tab`, and unnecessary product-facing `Fabrication Pro`. Any remaining occurrence must be either compatibility-sensitive historical documentation or intentionally retained and explained.

---

### Task 7: Full verification, PR review, native builds, merge, and release artifact

**Files:**
- All changed files from prior tasks.

**Interfaces:**
- Produces final merged `main`, deployed Pages site, signed Android APK, unsigned iOS IPA, checksums/signing report.

- [ ] **Step 1: Run complete verification**

```bash
cd fabrication_pro_capacitor
npm install --ignore-scripts
npm run verify
```

Expected: all verification commands pass with no legacy-source requirement.

- [ ] **Step 2: Run/inspect application self-tests**

Ensure existing `runFabricationSelfTests()` remains present and all current optimizer/migration assertions are preserved. Run browser self-tests in the available CI/browser harness if configured.

- [ ] **Step 3: Open a PR from `refactor/canonical-source` to `main`**

Review changed filenames/diff for accidental formula/schema/timer changes. Reject any unrelated behavior rewrite.

- [ ] **Step 4: Run Android and iOS installer workflow on the verified refactor head**

Android must build release successfully and `apksigner` must report certificate SHA-256 exactly:

```text
5769bbe5a1f4fdccd985fd0145495f3614e0db41992871c99b9eb361634bb586
```

Both generated app labels must be `Fabri-Cadabra`.

- [ ] **Step 5: Merge only after green CI**

Merge to `main`, then verify the `main` installer workflow and Pages deployment independently.

- [ ] **Step 6: Download the final Android artifact and verify checksum**

Download `Fabri-Cadabra-Android.apk`, compare it to the workflow-generated `.sha256`, independently inspect the signing report, and provide the fresh APK to the user.

- [ ] **Step 7: Final architecture audit**

Confirm the active tree contains only the canonical source files, no runtime replacement layer, no duplicate legacy HTML, and no stale official app name in launcher/display/build artifacts.
