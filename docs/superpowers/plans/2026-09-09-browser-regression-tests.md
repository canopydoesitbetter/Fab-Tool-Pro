# Fabri-Cadabra Browser Regression Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic Playwright browser regression suite that drives the shipped Fabri-Cadabra web app through real DOM interactions and blocks Android/iOS installer publication when critical user journeys fail.

**Architecture:** Playwright serves `fabrication_pro_capacitor/www/` through a dependency-free local Node HTTP server. Desktop Chromium covers the complete approved user journeys; a targeted touch/mobile Chromium project covers responsive navigation, drawers, core interaction usability, and overflow invariants. Existing source/contract verifiers remain intact and execute before the new browser gate.

**Tech Stack:** Node.js 22, `@playwright/test` 1.63.0, Chromium, GitHub Actions, existing static HTML/CSS/JavaScript/Capacitor app.

**Spec:** `docs/superpowers/specs/2026-09-09-browser-regression-tests-design.md`

## Global Constraints

- Keep `com.fabricationpro.app` unchanged.
- Do not alter native branding, Android signing, timer timestamp architecture, or persisted storage formats.
- Do not refactor application code merely to make tests easier.
- Drive visible controls and browser behavior; do not call internal app helpers from tests.
- Use a fresh Playwright browser context per test so localStorage and browser clock state cannot leak.
- Use Playwright Clock for time-sensitive browser tests; do not use long sleeps.
- Chromium is the only browser target for this audit item.
- Preserve all existing `npm run verify` checks.
- Derive the expected displayed app version from `package.json`; do not hard-code a release number into browser tests.
- If a browser test proves a genuine existing user-facing defect, diagnose it separately and make the smallest necessary fix with a failing regression test first.
- Stage the final implementation on `work`; promote only the exact staging-verified SHA to `main`.

## File Responsibility Map

**Create**
- `fabrication_pro_capacitor/playwright.config.mjs` — Playwright projects, retries, reporters, diagnostics, and web-server lifecycle.
- `fabrication_pro_capacitor/scripts/serve-e2e.mjs` — dependency-free static server rooted strictly at `www/`.
- `fabrication_pro_capacitor/tests/e2e/helpers.mjs` — shared navigation, dialog, download/import, and layout helpers.
- `fabrication_pro_capacitor/tests/e2e/navigation.spec.mjs` — launch, every page, Settings, theme, Pages drawer/focus behavior.
- `fabrication_pro_capacitor/tests/e2e/tasklog-shift.spec.mjs` — Task Logging CRUD/presets/timers/reload recovery, Shift Clock, jobs/presets backups.
- `fabrication_pro_capacitor/tests/e2e/notes-checklist.spec.mjs` — Notes CRUD/formatting/backups and Checklist CRUD/completion/reorder/backups.
- `fabrication_pro_capacitor/tests/e2e/tools.spec.mjs` — Calculator, Quick Reference, Fastener Spacing, Aluminum Overhang.
- `fabrication_pro_capacitor/tests/e2e/optimizers.spec.mjs` — Sheet Optimizer and Saw Optimizer basic runs and backup round trips.
- `fabrication_pro_capacitor/tests/e2e/mobile.spec.mjs` — mobile viewport/touch/overflow/navigation/drawer/core-flow checks.

**Modify**
- `fabrication_pro_capacitor/package.json` — Playwright dev dependency and e2e scripts.
- `fabrication_pro_capacitor/package-lock.json` — regenerate for Playwright and synchronize root metadata with package version.
- `.gitignore` — ignore Playwright output directories.
- `.github/workflows/build-phone-installers.yml` — add browser regression gate and native dependencies.
- `fabrication_pro_capacitor/README.md` — concise local browser-test setup/commands.

---

## Task 1 — Establish the Playwright Harness and Static Server

- [ ] **1.1 Add the first failing smoke test** in `tests/e2e/navigation.spec.mjs` before config/server implementation:

```js
import { test, expect } from '@playwright/test';

test('Fabri-Cadabra launches into Task Logging', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Fabri-Cadabra');
  await expect(page.locator('#tool-tasklog')).toHaveClass(/active/);
  await expect(page.getByRole('heading',{name:'Task Logging'})).toBeVisible();
});
```

- [ ] **1.2 Add package scripts and dependency** to `package.json`:

```json
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui"
```

and exactly:

```json
"@playwright/test": "1.63.0"
```

under `devDependencies`.

- [ ] **1.3 Regenerate the lockfile** from `fabrication_pro_capacitor/`:

```bash
npm install --package-lock-only
```

Verify root lockfile package metadata matches `package.json` and Playwright is locked at 1.63.0.

- [ ] **1.4 Create `scripts/serve-e2e.mjs`** using only built-in Node modules. It must bind `127.0.0.1:4173`, serve only `www/`, map `/` to `index.html`, reject traversal, return 404 for missing files, set MIME types, and close cleanly on SIGTERM/SIGINT.

```js
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(fileURLToPath(new URL('../www/',import.meta.url)));
const host='127.0.0.1';
const port=4173;
const mime=new Map([
  ['.html','text/html; charset=utf-8'],
  ['.js','text/javascript; charset=utf-8'],
  ['.css','text/css; charset=utf-8'],
  ['.json','application/json; charset=utf-8'],
  ['.jpg','image/jpeg'],
  ['.jpeg','image/jpeg'],
  ['.png','image/png'],
  ['.svg','image/svg+xml'],
  ['.ico','image/x-icon']
]);

const server=createServer((req,res)=>{
  let pathname;
  try {
    pathname=decodeURIComponent(new URL(req.url || '/',`http://${host}:${port}`).pathname);
  } catch {
    res.writeHead(400).end('Bad request');
    return;
  }
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
  res.writeHead(200,{'Content-Type':mime.get(extname(target).toLowerCase()) || 'application/octet-stream'});
  createReadStream(target).pipe(res);
});

server.listen(port,host);
for (const signal of ['SIGINT','SIGTERM']) {
  process.on(signal,()=>server.close(()=>process.exit(0)));
}
```

- [ ] **1.5 Create `playwright.config.mjs`**:

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
    {name:'desktop-chromium',grepInvert:/@mobile/,use:{viewport:{width:1440,height:1000}}},
    {name:'mobile-chromium',grep:/@mobile/,use:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}}
  ]
});
```

- [ ] **1.6 Add `.gitignore` entries**:

```text
fabrication_pro_capacitor/playwright-report/
fabrication_pro_capacitor/test-results/
```

- [ ] **1.7 Install Chromium and prove the smoke test**:

```bash
npx playwright install chromium
npm run test:e2e -- --project=desktop-chromium tests/e2e/navigation.spec.mjs
npm run verify
```

- [ ] **1.8 Commit the harness** with a focused commit such as `test: add Playwright browser harness`.

---

## Task 2 — Navigation, Settings, Theme, Drawers, and Mobile Layout

- [ ] **2.1 Create `tests/e2e/helpers.mjs`**:

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
  const json=JSON.parse(raw);
  return {download,path,raw,json};
}

export async function expectNoHorizontalOverflow(page,tolerance=1) {
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(tolerance);
}
```

- [ ] **2.2 Expand `navigation.spec.mjs` with failing tests first** covering these real Pages entries and panels:

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

For each selection, assert the chosen panel is active/visible and the Pages drawer closes.

- [ ] **2.3 Add Settings coverage without hard-coding release version**. Read `package.json` from the Node test process and assert `#settingsVersionValue` equals `pkg.version` after clicking the dynamically installed Settings button.

Example:

```js
import { readFile } from 'node:fs/promises';
const pkg=JSON.parse(await readFile(new URL('../../package.json',import.meta.url),'utf8'));
```

- [ ] **2.4 Add theme persistence test**: capture `document.documentElement.dataset.theme`, click `#themeToggle`, assert the opposite theme and accessible label, reload, assert the selected theme persists.

- [ ] **2.5 Add Pages drawer focus/accessibility test**: assert trigger `aria-expanded`, drawer `aria-hidden`, focus entering the drawer, Tab/Shift+Tab containment at boundaries, Escape closing, and focus returning to `#pageMenuBtn`. Cover backdrop close and explicit close button separately.

- [ ] **2.6 Add a feature-drawer focus test** using Calculator Guide or Notes Topics so generic drawer behavior is proven outside Pages.

- [ ] **2.7 Create `mobile.spec.mjs` with `@mobile` in every mobile test title**. At `390x844`, verify app launch, Pages navigation, theme toggle, one data-entry flow, one drawer-heavy interaction, and <=1px page-level horizontal overflow.

- [ ] **2.8 Add a targeted `360x800` narrow-width test** with `test.use({viewport:{width:360,height:800}})` and assert document plus representative active cards/controls fit the usable width.

- [ ] **2.9 Run focused coverage**:

```bash
npm run test:e2e -- tests/e2e/navigation.spec.mjs tests/e2e/mobile.spec.mjs
```

- [ ] **2.10 Commit navigation/mobile coverage**.

---

## Task 3 — Task Logging, Timer Recovery, Shift Clock, and Task Backups

- [ ] **3.1 Add failing Task Logging CRUD tests** in `tasklog-shift.spec.mjs`: click `#taskLogNewJobBtn`; assert default `Job 1`; open rename via `#taskLogJobTitle`; fill `#taskLogRenameInput`; apply via `#taskLogRenameApplyBtn`; assert new visible name; delete via `#taskLogDeleteJobBtn`, accept the real confirmation dialog, and assert empty state.

- [ ] **3.2 Add preset assignment/removal tests**: create two presets with `#taskLogPresetName`/`#taskLogAddPresetBtn`; select using `[data-tasklog-select-preset]`; use Select All and `#taskLogAddSelectedPresetsBtn`; assert task rows appear; reopen Preset Tasks and remove an assigned task through the real visible remove control; assert the assigned task disappears without deleting the library preset.

- [ ] **3.3 Add timer start/stop test**: start through `[data-tasklog-timer-action="start"]`; advance deterministic time with Playwright Clock; assert running banner/time changes; stop through the task button or `#taskLogStopActiveBtn`; assert accumulated time/session state is visible.

- [ ] **3.4 Add timer recovery-after-reload regression**: install a fixed Playwright clock before creating state, start a task, advance time, reload without clearing localStorage, advance again, and assert the visible timer reflects total elapsed time from the persisted start timestamp rather than resetting.

- [ ] **3.5 Add one-active-task test**: assign two tasks, start the first, then start the second; assert the first stops and only the second is running.

- [ ] **3.6 Add Shift Clock browser wiring test**: open Settings, confirm disabled schedule means `#shiftClockBtn` disabled, configure/enable a valid schedule using `#shiftScheduleMasterToggle`, day/time controls, and `#shiftScheduleSaveBtn`, align Playwright Clock to the schedule, accept the real clock-in dialog, assert `CLOCK OUT`, accept clock-out, and assert clocked-out state. Do not duplicate pure boundary math already covered by existing shift verifiers.

- [ ] **3.7 Add Task Logging jobs export/import round trip** using `#taskLogExportJobsBtn` and `#taskLogImportJobsFile`: create meaningful job/task state, capture and parse export JSON, delete local job through UI, import the downloaded file through the file input, and assert restored visible state.

- [ ] **3.8 Add presets export/import round trip** using `#taskLogExportPresetsBtn` and `#taskLogImportPresetsFile`; verify presets restore independently from jobs.

- [ ] **3.9 Run focused and repeat checks**:

```bash
npm run test:e2e -- --project=desktop-chromium tests/e2e/tasklog-shift.spec.mjs
npm run test:e2e -- --project=desktop-chromium tests/e2e/tasklog-shift.spec.mjs --repeat-each=2
```

- [ ] **3.10 Commit Task Logging/Shift coverage**.

---

## Task 4 — Fabricator Notes and Checklist User Journeys

- [ ] **4.1 Add Notes CRUD test** in `notes-checklist.spec.mjs`: navigate to Fabricator Notes; click `#fabricatorNotesNewBtn`; edit `#fabricatorNotesTitle`; type into `#fabricatorNotesContent`; use the real Topics drawer to switch/select; assert persistence; delete via `#fabricatorNotesDeleteBtn` with its real confirmation flow; assert empty state.

- [ ] **4.2 Add Notes formatting test** using the contenteditable and actual `[data-notes-command="bold"]`, `italic`, and `underline` toolbar buttons. Select text with browser keyboard/selection operations, invoke formatting, and assert the rendered/stored content contains the expected allowed rich-text elements rather than merely checking button state.

- [ ] **4.3 Add Notes backup round trip**: create a formatted note; capture `#fabricatorNotesExportBtn`; delete local topic; import through `#fabricatorNotesImportFile`; verify title, text, and formatting restore.

- [ ] **4.4 Add Checklist CRUD/completion test**: create topic via `#checklistNewTopicBtn`; edit `#checklistTitle`; add at least three items using `#checklistNewItem`/`#checklistAddItemBtn`; complete/uncomplete through real item controls; assert `#checklistProgressText` changes both directions.

- [ ] **4.5 Add Checklist reorder test**: perform the app's actual draggable/touch-compatible reorder interaction inside `#checklistItems`; assert visible order changes and survives reload. Never mutate storage or invoke internal reorder functions directly.

- [ ] **4.6 Add Checklist delete and backup round trip**: capture `#checklistExportBtn`; delete via `#checklistDeleteTopicBtn`; import through `#checklistImportFile`; assert item order and completion state restore.

- [ ] **4.7 Run focused spec**:

```bash
npm run test:e2e -- --project=desktop-chromium tests/e2e/notes-checklist.spec.mjs
```

- [ ] **4.8 Commit Notes/Checklist coverage**.

---

## Task 5 — Calculators and Quick Reference

- [ ] **5.1 Add Basic Calculator test** in `tools.spec.mjs`: click 7, `+`, 5, `=` and assert `#calculatorDisplay` is `12`; clear, enter 9, click `[data-calc-action="sqrt"]`, assert `3`; additionally prove keyboard input while Calculator is active, e.g. `8*4` + Enter => `32`.

- [ ] **5.2 Add Quick Reference interaction test**: select a non-default table through `#quickReferenceSelect`; assert title/badge/table update; toggle `#quickReferenceDecimalMode`; assert visible table representation changes and persists after reload; select/highlight a real table cell/section and assert visible selected state.

- [ ] **5.3 Add Fastener Spacing known fixture**: fill `#maxSpacing` with 24 and `#fastenerLength` with 100; click `#fastenerCalculateBtn`; assert 5 spaces, 6 fasteners, and visible 20-inch spacing/locations in the current rendered format.

- [ ] **5.4 Add Aluminum Overhang known fixture**: fill `#longSide=100`, `#shortSide=84`, click `#overhangCalculateBtn`; assert non-empty `#longResult` and `#shortResult` plus exact expected visible cut dimensions observed from current correct calculator output. The expected values live in the test, not an app helper.

- [ ] **5.5 If Task 2 used Notes Topics as its feature drawer, also exercise Calculator Guide `#calculatorGuideBtn`/`#calculatorGuideDrawer` here for normal open/close behavior.**

- [ ] **5.6 Run browser and existing feature verification**:

```bash
npm run test:e2e -- --project=desktop-chromium tests/e2e/tools.spec.mjs
npm run verify:features
```

- [ ] **5.7 Commit calculator/reference coverage**.

---

## Task 6 — Sheet Optimizer and Saw Optimizer

- [ ] **6.1 Add Sheet Optimizer basic-run test** in `optimizers.spec.mjs`: select Exterior Panel; fill label `E2E Panel`, width `22`, height `30`, qty `1`; click `#optimizerAddBtn`; assert the part appears through the user-visible Cut List/job state; click `#optimizerRunBtn`; assert `#optimizerMaterialTotals` and `#optimizerSheets` show a material/sheet result.

- [ ] **6.2 Add Sheet Optimizer save/export/import round trip**: set a job number; save through `#optimizerSaveJobBtn`; export with `#optimizerExportJobBtn`; capture/validate JSON; clear/delete supported local state through UI; import through `#optimizerImportFile`; assert job number/part data restore and optimization still runs.

- [ ] **6.3 Resolve the existing Saw Optimizer selectors from current markup before writing its spec, without modifying markup.** The already-confirmed controls include `#sawCutListMenuBtn`, `#sawExportJobBtn`, `#sawImportJobBtn`, `#sawImportFile`, and `#sawJobFileStatus`. Use the existing visible stock-length, part-label, length, quantity, add, and optimize controls to create a deterministic one- or two-part job; assert visible tube/cut/offcut results. Selector discovery is read-only and must not introduce test-only IDs.

- [ ] **6.4 Add Saw Optimizer export/import round trip**: capture export via `#sawExportJobBtn`, clear supported local job state through UI, import via `#sawImportFile`, verify stock/parts restore visibly, and rerun optimization.

- [ ] **6.5 Verify both optimizer drawers remain usable after results exist**: Sheet Cut List and Saw Part List open, contain real job content, and close normally.

- [ ] **6.6 Run twice for determinism**:

```bash
npm run test:e2e -- --project=desktop-chromium tests/e2e/optimizers.spec.mjs --repeat-each=2
```

- [ ] **6.7 Commit optimizer coverage**.

---

## Task 7 — CI Release Gate, Documentation, Full Verification, and Promotion

- [ ] **7.1 Add `browser-regression` to `.github/workflows/build-phone-installers.yml`**:

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

- [ ] **7.2 Make native jobs depend on the browser gate**:

```yaml
  android-apk:
    needs: browser-regression

  ios-unsigned-ipa:
    needs: browser-regression
```

Keep existing native signing/version/package checks unchanged. Native jobs may retain their existing static `npm run verify` defense-in-depth, but must not rerun e2e.

- [ ] **7.3 Update `fabrication_pro_capacitor/README.md`** with:

```bash
npm ci
npx playwright install chromium
npm run test:e2e
npm run test:e2e:ui
```

Explain briefly that tests serve shipped `www/` locally in isolated browser contexts and never use production user data.

- [ ] **7.4 Run full clean verification**:

```bash
rm -rf node_modules
npm ci
npx playwright install chromium
npm run verify
npm run test:e2e
```

Confirm no generated report/result files are tracked.

- [ ] **7.5 Compare feature branch against baseline `e1a461b6268d7bac8cf888035ea558e3e0dc66a2`**. Only approved test infrastructure, dependency metadata, workflow/README, design/plan docs, and any regression-proven minimal app fix may differ. Reconfirm `capacitor.config.json` still contains `com.fabricationpro.app`.

- [ ] **7.6 Commit final CI/docs changes and ensure the feature branch is clean.**

- [ ] **7.7 Advance `work` to the exact feature-branch head SHA** and let the push-triggered installer workflow run.

- [ ] **7.8 Require staging success for all three jobs**: Browser Regression Tests, Android Permanently Signed APK, and iPhone IPA for SideStore or AltStore. Inspect browser logs/diagnostics for failures; fix only diagnosed causes, rerun local verification, and advance `work` again if necessary.

- [ ] **7.9 Verify staging native proofs remain intact**: Android package `com.fabricationpro.app`, versionName matching `package.json`, deterministic versionCode, permanent signing fingerprint; iOS bundle identifier and version/build matching `package.json`.

- [ ] **7.10 Promote the exact staging-verified SHA to `main`** only after staging is fully green.

- [ ] **7.11 Require production success** for the installer workflow's browser/Android/iOS jobs and the GitHub Pages deployment from the same `main` SHA.

- [ ] **7.12 Record production evidence**: final SHA, installer run ID, browser job result, Android artifact ID, iOS artifact ID, Pages run ID, and Playwright diagnostics policy.

- [ ] **7.13 Update `/mnt/data/Fabri-Cadabra_App_Audit_Fix_Checklist.txt` only if that exact sandbox file exists in the active runtime**, marking audit item #2 complete after production gates pass. If it is absent, report that without inventing a link.

---

## Final Verification Checklist

- [ ] `npm ci` succeeds and lockfile root package metadata matches `package.json`.
- [ ] `npm run verify` passes all existing static contracts.
- [ ] `npm run test:e2e` passes desktop and mobile Chromium projects.
- [ ] Every one of the nine tool pages plus Settings is opened through the real UI.
- [ ] Task Logging create/edit/delete, preset add/remove, start/stop, one-active-task, and timer reload recovery are browser-tested.
- [ ] Shift Clock disabled/enabled, clock-in, and clock-out wiring is browser-tested through Settings/header controls and real dialogs.
- [ ] Notes CRUD, formatting, and import/export are browser-tested.
- [ ] Checklist CRUD, completion, reorder, and import/export are browser-tested.
- [ ] Basic Calculator, Quick Reference, Fastener Spacing, and Aluminum Overhang produce verified visible outcomes.
- [ ] Sheet Optimizer and Saw Optimizer perform basic runs and backup round trips.
- [ ] Six distinct backup formats have browser-level coverage: Task Logging jobs, Task Logging presets, Notes, Checklist, Sheet Optimizer, Saw Optimizer.
- [ ] Mobile `390x844` and narrow `360x800` coverage passes without page-level horizontal overflow.
- [ ] Drawer open/close/focus-trap/return-focus behavior is proven through browser keyboard interactions.
- [ ] CI browser job blocks both native jobs on failure and uploads diagnostics only on failure.
- [ ] Native Android/iOS version/package/signing verification remains green.
- [ ] Staging `work` is fully green before promotion.
- [ ] Production installer and Pages workflows are green from the exact verified commit before audit item #2 is marked complete.
