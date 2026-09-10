# Fabri-Cadabra Browser Regression Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic Playwright browser regression suite that drives the shipped Fabri-Cadabra web app through real DOM interactions and blocks Android/iOS installer publication when critical user journeys fail.

**Architecture:** Playwright serves `fabrication_pro_capacitor/www/` through a dependency-free local Node HTTP server. Desktop Chromium covers the complete approved user journeys; a targeted touch/mobile Chromium project covers responsive navigation, drawers, core interaction usability, and overflow invariants. Existing source/contract verifiers stay intact and run before the new browser gate.

**Tech Stack:** Node.js 22, `@playwright/test` 1.63.0, Chromium, GitHub Actions, existing static HTML/CSS/JavaScript/Capacitor app.

**Spec:** `docs/superpowers/specs/2026-09-09-browser-regression-tests-design.md`

## Global Constraints

- Keep `com.fabricationpro.app` unchanged.
- Do not modify native branding, Android signing, timer timestamp architecture, or storage formats.
- Do not refactor application code simply to make tests easier.
- Tests must drive visible controls and browser behavior rather than call internal app helpers.
- Use fresh browser contexts/localStorage isolation for tests.
- Use Playwright Clock for deterministic time-sensitive browser tests; do not add multi-second/minute sleeps.
- Keep Chromium as the only browser target in this audit item.
- Preserve all existing `npm run verify` checks.
- If a browser test exposes a genuine existing user-facing defect, diagnose it separately and make the smallest necessary fix with a failing regression test first.
- Stage the final implementation on `work`; only promote the exact staging-verified SHA to `main`.

## File Responsibility Map

**Create**
- `fabrication_pro_capacitor/playwright.config.mjs` — Playwright projects, reporters, retries, browser diagnostics, and web-server lifecycle.
- `fabrication_pro_capacitor/scripts/serve-e2e.mjs` — dependency-free static server rooted strictly at `www/`.
- `fabrication_pro_capacitor/tests/e2e/helpers.mjs` — shared navigation, dialog, download, import, and layout helpers.
- `fabrication_pro_capacitor/tests/e2e/navigation.spec.mjs` — app launch, all pages, Settings, theme, Pages drawer/focus behavior.
- `fabrication_pro_capacitor/tests/e2e/tasklog-shift.spec.mjs` — Task Logging CRUD/presets/timers/reload recovery, Shift Clock, Task Logging job/preset backups.
- `fabrication_pro_capacitor/tests/e2e/notes-checklist.spec.mjs` — Notes CRUD/formatting/backups and Checklist CRUD/completion/reorder/backups.
- `fabrication_pro_capacitor/tests/e2e/tools.spec.mjs` — Basic Calculator, Quick Reference, Fastener Spacing, Aluminum Overhang.
- `fabrication_pro_capacitor/tests/e2e/optimizers.spec.mjs` — Sheet Optimizer and Saw Optimizer runs and backup round trips.
- `fabrication_pro_capacitor/tests/e2e/mobile.spec.mjs` — mobile viewport/touch/overflow/navigation/drawer/core-flow checks.

**Modify**
- `fabrication_pro_capacitor/package.json` — Playwright dev dependency and e2e scripts.
- `fabrication_pro_capacitor/package-lock.json` — regenerate for Playwright and synchronize root package metadata to version 1.0.5.
- `.gitignore` — ignore Playwright generated `playwright-report/` and `test-results/` directories.
- `.github/workflows/build-phone-installers.yml` — add browser regression gate and make native jobs depend on it.
- `fabrication_pro_capacitor/README.md` — concise local browser-test commands/setup.

---

## Task 1 — Establish the Playwright Harness and Static Server

- [ ] **1.1 Add the first deliberately failing smoke test** in `tests/e2e/navigation.spec.mjs` before the Playwright config/server exists:

```js
import { test, expect } from '@playwright/test';

test('Fabri-Cadabra launches into Task Logging', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Fabri-Cadabra');
  await expect(page.locator('#tool-tasklog')).toHaveClass(/active/);
  await expect(page.getByRole('heading', { name: 'Task Logging' })).toBeVisible();
});
```

- [ ] **1.2 Add package scripts and Playwright dependency** in `fabrication_pro_capacitor/package.json`:

```json
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui"
```

Add exactly:

```json
"@playwright/test": "1.63.0"
```

under `devDependencies`.

- [ ] **1.3 Regenerate `package-lock.json`** from `fabrication_pro_capacitor/` with Node 22/npm, not by hand:

```bash
npm install --package-lock-only
```

Verify both root package entries now report `1.0.5` and the exact Playwright dependency is locked.

- [ ] **1.4 Create `scripts/serve-e2e.mjs`** using only built-in Node modules. Requirements: bind `127.0.0.1:4173`; serve only `www/`; map `/` to `index.html`; decode URL safely; reject traversal outside the resolved `www` root; return 404 for missing files; send appropriate content types for HTML/JS/CSS/JSON/JPG/PNG/SVG/ICO; close cleanly on SIGTERM/SIGINT.

Core server shape:

```js
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(fileURLToPath(new URL('../www/',import.meta.url)));
const host='127.0.0.1';
const port=4173;

const server=createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url || '/',`http://${host}:${port}`).pathname);
  const relative=pathname==='/'?'index.html':pathname.replace(/^\/+/, '');
  const target=resolve(root,relative);
  if (target!==root && !target.startsWith(root+sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  try {
    if (!statSync(target).isFile()) throw new Error('not a file');
  } catch {
    res.writeHead(404).end('Not found');
    return;
  }
  // Set MIME type from extname(target), then pipe createReadStream(target).
});

server.listen(port,host);
for (const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>server.close(()=>process.exit(0)));
```

- [ ] **1.5 Create `playwright.config.mjs`** with a desktop project and a mobile-tagged project:

```js
import { defineConfig } from '@playwright/test';

const CI=Boolean(process.env.CI);

export default defineConfig({
  testDir:'./tests/e2e',
  fullyParallel:false,
  forbidOnly:CI,
  retries:CI?1:0,
  workers:CI?2:undefined,
  reporter:[
    [CI?'dot':'list'],
    ['html',{outputFolder:'playwright-report',open:'never'}]
  ],
  use:{
    baseURL:'http://127.0.0.1:4173',
    browserName:'chromium',
    acceptDownloads:true,
    trace:'retain-on-failure',
    screenshot:'only-on-failure',
    video:'retain-on-failure'
  },
  webServer:{
    command:'node scripts/serve-e2e.mjs',
    url:'http://127.0.0.1:4173',
    reuseExistingServer:!CI
  },
  projects:[
    {
      name:'desktop-chromium',
      grepInvert:/@mobile/,
      use:{viewport:{width:1440,height:1000}}
    },
    {
      name:'mobile-chromium',
      grep:/@mobile/,
      use:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}
    }
  ]
});
```

- [ ] **1.6 Add `.gitignore` entries**:

```text
fabrication_pro_capacitor/playwright-report/
fabrication_pro_capacitor/test-results/
```

- [ ] **1.7 Install Chromium locally for verification** and run the smoke test:

```bash
npx playwright install chromium
npm run test:e2e -- --project=desktop-chromium tests/e2e/navigation.spec.mjs
```

Expected: smoke test passes against the actual `www/` app.

- [ ] **1.8 Run the existing static verification**:

```bash
npm run verify
```

Expected: all existing verifiers still pass.

- [ ] **1.9 Commit the harness** with a focused commit such as:

```bash
git add fabrication_pro_capacitor/package.json fabrication_pro_capacitor/package-lock.json fabrication_pro_capacitor/playwright.config.mjs fabrication_pro_capacitor/scripts/serve-e2e.mjs fabrication_pro_capacitor/tests/e2e/navigation.spec.mjs .gitignore
git commit -m "test: add Playwright browser harness"
```

---

## Task 2 — Navigation, Settings, Theme, Drawers, and Mobile Layout

- [ ] **2.1 Create shared helpers** in `tests/e2e/helpers.mjs` that operate only through DOM/browser APIs:

```js
import { expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

export async function openApp(page) {
  await page.goto('/');
  await expect(page).toHaveTitle('Fabri-Cadabra');
  await expect(page.locator('#tool-tasklog')).toHaveClass(/active/);
}

export async function openTool(page,label,panelId) {
  await page.locator('#pageMenuBtn').click();
  await page.getByRole('button',{name:label,exact:true}).click();
  await expect(page.locator(panelId)).toHaveClass(/active/);
}

export function acceptNextDialog(page,text) {
  page.once('dialog',async dialog=>{
    expect(dialog.message()).toContain(text);
    await dialog.accept();
  });
}

export async function captureJsonDownload(page,trigger) {
  const [download]=await Promise.all([page.waitForEvent('download'),trigger()]);
  const path=await download.path();
  expect(path).toBeTruthy();
  const raw=await readFile(path,'utf8');
  expect(raw.trim().length).toBeGreaterThan(2);
  expect(()=>JSON.parse(raw)).not.toThrow();
  return {download,path,raw,json:JSON.parse(raw)};
}

export async function expectNoHorizontalOverflow(page,tolerance=1) {
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(tolerance);
}
```

- [ ] **2.2 Expand `navigation.spec.mjs` with failing tests first** for all tool destinations. Iterate the visible labels and assert the corresponding panel is active/visible:

```js
const tools=[
  ['Task Logging','#tool-tasklog'],
  ['Fabricator Notes','#tool-notes'],
  ['Checklist','#tool-checklist'],
  ['Basic Calculator','#tool-calculator'],
  ['Quick Reference','#tool-reference'],
  ['Fastener Spacing','#tool-fasteners'],
  ['Sheet Optimizer','#tool-optimizer'],
  ['Saw Optimizer','#tool-saw'],
  ['Aluminum Overhang','#tool-overhang']
];
```

Also assert the drawer closes after selection.

- [ ] **2.3 Add Settings coverage** by opening the Pages drawer, clicking its dynamically installed Settings button, asserting `#tool-settings` active and `#settingsVersionValue` equals package version `1.0.5`.

- [ ] **2.4 Add theme behavior test**: capture initial `document.documentElement.dataset.theme`, click `#themeToggle`, assert opposite theme and changed accessible label, reload, then assert persisted theme remains.

- [ ] **2.5 Add Pages drawer focus/accessibility test**: trigger via `#pageMenuBtn`, assert `aria-expanded=true`, drawer `aria-hidden=false`, and close button receives focus; use keyboard Tab/Shift+Tab at the focus boundaries to prove focus remains inside; press Escape and assert drawer closed, attributes restored, and focus returns to `#pageMenuBtn`. Separately cover backdrop and explicit close-button closing.

- [ ] **2.6 Add one feature-drawer focus test** using Calculator Guide or Notes Topics to prove generic drawer behavior is wired beyond Pages.

- [ ] **2.7 Create `mobile.spec.mjs` tagged `@mobile`**. At `390x844`, verify launch, Pages button usability, drawer navigation, theme toggle, a data-entry flow, and a drawer-heavy interaction. For each relevant state assert page-level horizontal overflow is <=1px.

- [ ] **2.8 Add a targeted `360x800` narrow-width test** using `test.use({viewport:{width:360,height:800}})` and assert the document and representative active tool/cards/controls do not exceed the usable viewport width.

- [ ] **2.9 Run just navigation/mobile tests**, resolve test assumptions rather than changing app behavior unless an actual defect is proven:

```bash
npm run test:e2e -- tests/e2e/navigation.spec.mjs tests/e2e/mobile.spec.mjs
```

- [ ] **2.10 Commit navigation/mobile coverage**.

---

## Task 3 — Task Logging, Timer Recovery, Shift Clock, and Task Backups

- [ ] **3.1 Add failing Task Logging CRUD tests** in `tasklog-shift.spec.mjs`: click `#taskLogNewJobBtn`; assert `Job 1`; open `#taskLogJobTitle` rename dialog; fill `#taskLogRenameInput`; apply; assert new visible name; delete via `#taskLogDeleteJobBtn` and accept the real confirmation dialog; assert empty state returns.

- [ ] **3.2 Add preset assignment/removal tests**: create two presets through `#taskLogPresetName`/`#taskLogAddPresetBtn`; select via `[data-tasklog-select-preset]`; use Select All and `#taskLogAddSelectedPresetsBtn`; assert task rows appear; reopen Preset Tasks drawer and remove an assigned preset via its visible remove control; assert task disappears without deleting the preset library entry.

- [ ] **3.3 Add timer start/stop test**: create job/preset/task, click the real `[data-tasklog-timer-action="start"]`, use Playwright Clock to advance deterministic elapsed time, assert running banner/time visibly changes, stop through the task button or `#taskLogStopActiveBtn`, and assert accumulated time/session state is visible.

- [ ] **3.4 Add timer recovery-after-reload regression**. Install a fixed browser clock before app state is created, start a task, advance the clock, reload the document without clearing localStorage, advance again, and assert the running timer reflects total elapsed time from the persisted absolute start timestamp rather than resetting on reload.

- [ ] **3.5 Add one-active-task behavior**: assign two tasks, start first, then start second; assert first stops and second becomes the only running task.

- [ ] **3.6 Add Shift Clock browser wiring tests**: open Settings; verify disabled schedule leaves `#shiftClockBtn` disabled; configure/enable a valid schedule via the actual Settings controls and `#shiftScheduleSaveBtn`; use a fixed Playwright clock aligned to the schedule; return to app/header; accept clock-in confirmation; assert `CLOCK OUT`; accept clock-out confirmation; assert clocked-out state. Keep deeper edge-boundary logic in existing unit/static schedule verifier.

- [ ] **3.7 Add Task Logging jobs export/import round trip**: create/rename job and task state; export via `#taskLogExportJobsBtn`; parse captured JSON; delete local job using UI; import the downloaded JSON via `#taskLogImportJobsFile.setInputFiles(path)` or the actual file chooser; assert restored visible job/task/time state.

- [ ] **3.8 Add presets export/import round trip** similarly using `#taskLogExportPresetsBtn`, `#taskLogImportPresetsBtn`, and `#taskLogImportPresetsFile`; verify presets return independently of jobs.

- [ ] **3.9 Run this spec repeatedly enough to catch clock/dialog flakiness**:

```bash
npm run test:e2e -- --project=desktop-chromium tests/e2e/tasklog-shift.spec.mjs
```

Then run once with `--repeat-each=2` before committing.

- [ ] **3.10 Commit Task Logging/Shift coverage**.

---

## Task 4 — Fabricator Notes and Checklist User Journeys

- [ ] **4.1 Add Notes CRUD test** in `notes-checklist.spec.mjs`: navigate to Fabricator Notes; click `#fabricatorNotesNewBtn`; edit `#fabricatorNotesTitle`; type into `#fabricatorNotesContent`; navigate topics through the real Topics drawer; assert persistence; delete with real confirmation and assert empty state.

- [ ] **4.2 Add Notes formatting test** using the contenteditable and real toolbar buttons `[data-notes-command="bold"]`, `italic`, `underline`. Create/select text through browser keyboard/selection operations, invoke each toolbar control, and assert stored/rendered content contains the expected allowed rich-text element/formatting rather than merely checking button existence.

- [ ] **4.3 Add Notes backup round trip**: create formatted note; capture `#fabricatorNotesExportBtn` download; delete local topic; import through `#fabricatorNotesImportFile`; verify title, text, and formatting restored.

- [ ] **4.4 Add Checklist CRUD/completion test**: create topic via `#checklistNewTopicBtn`; edit `#checklistTitle`; add at least three items through `#checklistNewItem`/`#checklistAddItemBtn`; toggle completion through the actual checkbox/control; assert `#checklistProgressText` changes; uncheck and assert it reverses.

- [ ] **4.5 Add Checklist reorder test**: perform the app's actual draggable/touch-compatible reorder interaction on `#checklistItems`; assert visible item order changed and survives a reload. Do not directly mutate storage or dispatch internal reorder functions.

- [ ] **4.6 Add Checklist delete and backup round trip**: export through `#checklistExportBtn`; delete topic via `#checklistDeleteTopicBtn`; import through `#checklistImportFile`; verify item order and completion state restore.

- [ ] **4.7 Run and repeat the spec**:

```bash
npm run test:e2e -- --project=desktop-chromium tests/e2e/notes-checklist.spec.mjs
```

- [ ] **4.8 Commit Notes/Checklist coverage**.

---

## Task 5 — Calculators and Quick Reference

- [ ] **5.1 Add Basic Calculator test** in `tools.spec.mjs`: navigate to calculator; click digit 7, `+`, digit 5, equals and assert `#calculatorDisplay` is `12`; clear; enter 9 and invoke `sqrt`, assert `3`. Add one keyboard-path assertion (for example typing `8*4` + Enter yields `32`) while Calculator is active.

- [ ] **5.2 Add Quick Reference interaction test**: choose `gauge-thickness` or another non-default value through `#quickReferenceSelect`; assert title/badge/table changes; toggle `#quickReferenceDecimalMode`; assert visible table representation changes and preference persists after reload; click/select a real table cell/section and assert its highlighted/selected state becomes visible.

- [ ] **5.3 Add Fastener Spacing known fixture**: fill `#maxSpacing=24`, `#fastenerLength=100`, click `#fastenerCalculateBtn`; assert 5 spaces, 6 fasteners, and visible 20-inch spacing/locations according to current rendered format.

- [ ] **5.4 Add Aluminum Overhang known fixture**: fill long side 100 and short side 84, click `#overhangCalculateBtn`; assert non-empty `#longResult`/`#shortResult` and the exact expected visible finished/cut dimensions derived from the current calculator behavior. The expected values belong in the test, not an implementation helper.

- [ ] **5.5 Cover Calculator Guide drawer once if it was not already the feature-drawer used by Task 2**, verifying open/close/focus through UI.

- [ ] **5.6 Run the tool spec and existing static feature verifiers**:

```bash
npm run test:e2e -- --project=desktop-chromium tests/e2e/tools.spec.mjs
npm run verify:features
```

- [ ] **5.7 Commit calculator/reference coverage**.

---

## Task 6 — Sheet Optimizer and Saw Optimizer

- [ ] **6.1 Add Sheet Optimizer basic-run test** in `optimizers.spec.mjs`: navigate to Sheet Optimizer; select Exterior Panel; fill label `E2E Panel`, width `22`, height `30`, qty `1`; click `#optimizerAddBtn`; assert the part appears in the Cut List/user-visible job state; click `#optimizerRunBtn`; assert `#optimizerMaterialTotals` and `#optimizerSheets` show a real material/sheet result.

- [ ] **6.2 Add Sheet Optimizer save/export/import round trip**: set a job number, save through `#optimizerSaveJobBtn`, export via `#optimizerExportJobBtn`, capture/validate JSON, clear/delete supported local state through UI, import through `#optimizerImportFile`, then assert job number/part data can be loaded/restored and optimization still runs.

- [ ] **6.3 Inspect the current Saw Optimizer DOM at implementation time** only to resolve its exact existing control IDs; do not add test-only selectors. Create a deterministic one-part or two-part fixture using visible stock-length/part-label/length/quantity controls, run optimization, and assert visible tube/cut/offcut results.

- [ ] **6.4 Add Saw Optimizer export/import round trip** using existing `#sawExportJobBtn`, `#sawImportJobBtn`, `#sawImportFile`, and `#sawJobFileStatus`; verify imported parts and stock settings are restored visibly and can be re-optimized.

- [ ] **6.5 Assert both optimizer drawers remain usable** after results exist: open Cut List / Part List, verify real content, close normally.

- [ ] **6.6 Run optimizer spec twice** to detect nondeterministic optimizer/UI timing issues:

```bash
npm run test:e2e -- --project=desktop-chromium tests/e2e/optimizers.spec.mjs --repeat-each=2
```

- [ ] **6.7 Commit optimizer coverage**.

---

## Task 7 — CI Release Gate, Documentation, Full Verification, and Promotion

- [ ] **7.1 Add a dedicated `browser-regression` job** near the top of `.github/workflows/build-phone-installers.yml`:

```yaml
  browser-regression:
    name: Browser Regression Tests
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: fabrication_pro_capacitor
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node 22
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: npm
          cache-dependency-path: fabrication_pro_capacitor/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright Chromium
        run: npx playwright install --with-deps chromium

      - name: Verify Fabri-Cadabra source and build configuration
        run: npm run verify

      - name: Run browser regression tests
        run: npm run test:e2e

      - name: Upload Playwright diagnostics on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: Fabri-Cadabra-Playwright-Diagnostics
          path: |
            fabrication_pro_capacitor/playwright-report/
            fabrication_pro_capacitor/test-results/
          if-no-files-found: warn
          retention-days: 14
```

- [ ] **7.2 Make both native jobs depend on the browser gate**:

```yaml
  android-apk:
    needs: browser-regression

  ios-unsigned-ipa:
    needs: browser-regression
```

Do not remove their existing signing/version/package checks. Native jobs may retain their existing static `npm run verify` for defense-in-depth; they must not rerun `test:e2e`.

- [ ] **7.3 Update `fabrication_pro_capacitor/README.md`** with concise local instructions:

```bash
npm ci
npx playwright install chromium
npm run test:e2e
npm run test:e2e:ui
```

Explain in one paragraph that e2e tests serve the shipped `www/` locally and never use production user data.

- [ ] **7.4 Run complete local verification from a clean dependency install state**:

```bash
rm -rf node_modules
npm ci
npx playwright install chromium
npm run verify
npm run test:e2e
```

Expected: all static and browser suites pass. Inspect that no generated reports/results are tracked.

- [ ] **7.5 Compare the feature branch against baseline `e1a461b6268d7bac8cf888035ea558e3e0dc66a2`**. Confirm only approved test infrastructure, lockfile/README/workflow, design/plan docs, and any regression-proven minimal app fix are present. Confirm `capacitor.config.json` still has `com.fabricationpro.app`.

- [ ] **7.6 Commit final CI/docs changes** and ensure the feature branch is clean.

- [ ] **7.7 Advance `work` to the exact feature-branch head SHA**. Do not force unless fast-forward semantics require diagnosis; the expected baseline is shared.

- [ ] **7.8 Inspect the staging installer workflow triggered by `work`**. Require all three jobs to succeed: Browser Regression Tests, Android Permanently Signed APK, iPhone IPA for SideStore or AltStore. Inspect browser job logs and failure artifacts if anything fails; fix only the diagnosed cause on the feature branch, rerun local verification, and advance `work` again.

- [ ] **7.9 Verify staging native proofs remain intact**: Android package `com.fabricationpro.app`, versionName `1.0.5`, versionCode `1000005`, permanent signing fingerprint check passes; iOS bundle identifier/version/build all remain correct.

- [ ] **7.10 Promote the exact staging-verified SHA to `main`** only after the staging workflow is fully green.

- [ ] **7.11 Inspect production workflows**. Require the production installer workflow's browser/Android/iOS jobs to succeed and require the GitHub Pages deployment from the same main SHA to succeed.

- [ ] **7.12 Record production evidence**: final commit SHA, installer run ID, browser job result, Android artifact ID, iOS artifact ID, Pages run ID, and any browser diagnostic artifact policy confirmation.

- [ ] **7.13 Update `/mnt/data/Fabri-Cadabra_App_Audit_Fix_Checklist.txt` if that exact sandbox file still exists in the active runtime**, marking audit item #2 complete only after all production gates pass. If the sandbox file is absent, report that fact without inventing a download link.

---

## Final Verification Checklist

- [ ] `npm ci` succeeds with the committed lockfile and root package metadata is `1.0.5`.
- [ ] `npm run verify` passes unchanged existing regression contracts.
- [ ] `npm run test:e2e` passes desktop and mobile Chromium projects.
- [ ] All nine tool pages plus Settings are navigated through the real Pages UI.
- [ ] Task Logging job/preset/timer flows are exercised through the DOM.
- [ ] Timer recovery is proven over a real reload with persisted state and controlled time.
- [ ] Shift Clock enable/clock-in/clock-out wiring is exercised through Settings/header controls and real dialogs.
- [ ] Notes CRUD/formatting/import/export works in browser automation.
- [ ] Checklist CRUD/completion/reorder/import/export works in browser automation.
- [ ] Basic Calculator, Quick Reference, Fastener Spacing, and Aluminum Overhang produce verified visible outcomes.
- [ ] Sheet Optimizer and Saw Optimizer perform basic runs and job-file round trips.
- [ ] Six distinct backup formats have browser-level coverage: Task Logging jobs, Task Logging presets, Notes, Checklist, Sheet Optimizer, Saw Optimizer.
- [ ] Mobile `390x844` and narrow `360x800` coverage passes without page-level horizontal overflow.
- [ ] Drawer focus/open/close/return-focus behavior is proven through keyboard/browser interactions.
- [ ] CI browser job blocks both native jobs on failure and uploads Playwright diagnostics only on failure.
- [ ] Android signing/version/package verification remains unchanged and green.
- [ ] iOS version/package verification remains green.
- [ ] Staging `work` is green before promotion.
- [ ] Production installer and Pages workflows are green from the exact verified commit before audit item #2 is marked complete.
