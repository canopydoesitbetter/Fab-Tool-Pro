# Unified Backup & Restore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a schema-versioned, app-wide backup/restore workflow covering all persistent Fabri-Cadabra state with validated restores and automatic IndexedDB recovery snapshots.

**Architecture:** `app.js` remains authoritative for domain serialization/normalization and exposes a narrow backup bridge. New `backup.js` owns JSON file I/O, IndexedDB recovery, destructive-operation protection, and transaction-style localStorage replacement/rollback. Settings hosts static Data & Backup UI. Existing feature import/export formats remain intact.

**Tech Stack:** HTML5, vanilla JavaScript, CSS, IndexedDB, localStorage, Blob/FileReader, Node.js 22 verification scripts, Playwright 1.63.0 / Chromium, Capacitor 8.5.0.

**Spec:** `docs/superpowers/specs/2026-09-10-unified-backup-restore-design.md`

## Global Constraints

- Production baseline: `e067fc43e27f6543e20b8ff6ac093b74366e4206`.
- Implementation branch: `feature/unified-backup-restore`.
- Package version remains `1.0.5`.
- Capacitor app ID remains exactly `com.fabricationpro.app`.
- Android permanent signing fingerprint remains `5769bbe5a1f4fdccd985fd0145495f3614e0db41992871c99b9eb361634bb586`.
- The full backup registry contains exactly these 10 app-owned persistent keys: `fabricationTaskLogJobsV1`, `fabricationTaskLogPresetsV1`, `fabricationShiftScheduleV1`, `fabricationFabricatorNotesV1`, `fabricationChecklistV1`, `fabricationOptimizerJobsV1`, `fabricationTheme`, `fabricationTool`, `fabricationQuickReferenceTable`, `fabricationQuickReferenceDecimalMode`.
- Never use `localStorage.clear()` in application backup/restore logic.
- Saw Optimizer remains non-persistent in Audit #4; preserve its existing job-file import/export only.
- Preserve all existing feature-specific import/export file formats. The only intentional change to those flows is automatic recovery protection before persistent destructive replacement.
- Do not claim automatic recovery protects transient unsaved Sheet Optimizer workspace state.
- Do not touch `work` or `main` until the feature branch passes `npm run verify` and the complete Playwright suite.
- Every restore must validate the complete incoming payload before the first localStorage mutation.
- A full restore that fails part-way must attempt rollback to the captured pre-restore values and must not report success.
- Restored historical Task timers must be finalized at backup export time; restored Shift Schedule must never resurrect a prior clock-in/current-shift override.

---

### Task 1: Establish the authoritative persistence registry and domain-aware backup bridge

**Files:**
- Create: `fabrication_pro_capacitor/scripts/verify-backup-restore.mjs`
- Modify: `fabrication_pro_capacitor/www/app.js`

**Interfaces:**
- Produces `window.FabriCadabraApp.backup` with `format`, `schemaVersion`, `storageKeys`, `flushPendingSaves()`, `buildBackup()`, and `normalizeBackup()`.
- Reuses the existing Task Logging, Shift Schedule, Notes, Checklist, and Sheet Optimizer normalizers/serializers.
- Returns a deterministic 10-key storage replacement map from `normalizeBackup()`; `null` represents a key that should be removed.

- [ ] **Step 1: Write the initial failing backup verifier**

Create `scripts/verify-backup-restore.mjs` and require:

- format identifier `FabriCadabraBackup`
- schema version `1`
- a literal authoritative 10-key registry containing each key exactly once
- `window.FabriCadabraApp.backup`
- bridge functions for flush/build/normalize
- use of existing domain normalizer names rather than parallel validators
- Task restore path calling `finalizeImportedRunningTaskLogJobs`
- Shift restore sanitization to `clockedIn:false` and empty pause overrides
- no `localStorage.clear()` in `app.js` or future `backup.js`

At this step, assertions that depend on `backup.js` should report its absence as expected failure only after the core bridge checks are established.

- [ ] **Step 2: Run the verifier and confirm RED**

Run:

```bash
npm run verify:backup-restore
```

If the npm script does not yet exist, run `node scripts/verify-backup-restore.mjs` directly.

Expected: FAIL because the backup bridge/registry does not exist.

- [ ] **Step 3: Add the exact persistence registry**

Near shared app constants, define one frozen ordered registry containing exactly the 10 approved keys. Do not derive it from arbitrary localStorage enumeration.

The registry must include Shift Schedule, which the older generic feature verifier currently omits.

- [ ] **Step 4: Implement `flushPendingSaves()`**

Flush pending delayed writes before a full backup is built:

- pending Task Logging save timer -> persist jobs
- pending Fabricator Notes save timer -> persist notes
- pending Checklist save timer -> persist checklists

Return a success result or throw an explicit error if a required flush cannot be persisted. Do not silently export stale UI state.

- [ ] **Step 5: Implement preference normalization**

Normalize:

- `fabricationTheme`: `light` / `dark` or safe default/null representation
- `fabricationTool`: one of `VALID_TOOLS`; invalid stored values normalize to `DEFAULT_TOOL`
- `fabricationQuickReferenceTable`: one of `Object.keys(QUICK_REFERENCE_TABLES)`; invalid -> `fraction-addition`
- `fabricationQuickReferenceDecimalMode`: `fraction` / `decimal`; invalid -> `fraction`

The backup builder should export valid normalized preference values even if stale storage contains junk.

- [ ] **Step 6: Implement saved Sheet Optimizer dictionary normalization**

Read the persisted optimizer dictionary and validate every record through `normalizeOptimizerJobRecord()`.

Require the dictionary key to match the normalized `jobNumber`. Reject malformed dictionaries during restore rather than dropping corrupt entries silently.

Serialize the normalized dictionary deterministically for the target `fabricationOptimizerJobsV1` value.

- [ ] **Step 7: Implement `buildBackup()`**

Build:

```js
{
  format:'FabriCadabraBackup',
  schemaVersion:1,
  appVersion:FABRI_CADABRA_VERSION,
  exportedAt,
  sections:{
    taskLogging:{jobs:serializeTaskLogJobsRecord(),presets:serializeTaskLogPresetsRecord()},
    shiftSchedule:cloneShiftValue(shiftScheduleState),
    fabricatorNotes:serializeFabricatorNotesRecord(),
    checklists:serializeChecklistRecord(),
    optimizer:{savedJobs:...},
    preferences:{theme,lastTool,quickReferenceTable,quickReferenceDisplayMode}
  }
}
```

Ensure the single top-level `exportedAt` is canonical metadata for full-backup timer finalization.

- [ ] **Step 8: Implement `normalizeBackup(raw,{restoreAt})`**

Validate before returning any storage map:

- object shape, exact format, positive schema version, reject future schema >1
- required `appVersion` string
- valid `exportedAt`
- all required v1 sections and nested containers
- jobs through `normalizeTaskLogJobsRecord`
- presets through `normalizeTaskLogPresetsRecord`
- Shift through `normalizeShiftScheduleState`
- Notes through `normalizeFabricatorNotesRecord`
- Checklist through `normalizeChecklistRecord`
- every saved optimizer job through `normalizeOptimizerJobRecord`
- preferences through the explicit allowlists

For Task Logging, overwrite the normalized jobs record cutoff with the full backup `exportedAt`, then call `finalizeImportedRunningTaskLogJobs()` so no restored task remains running.

For Shift Schedule, preserve validated `enabled` + `config`, then sanitize:

```js
clock:{clockedIn:false,clockedInAt:null,mode:null,shiftId:null}
pauseOverrides:{shiftId:null,breakEnabled:null,lunchEnabled:null}
policyEffectiveAt:restoreAt
```

Return normalized backup metadata plus an exact 10-key replacement map and a count of finalized Task timers.

- [ ] **Step 9: Expose the bridge only after all domain functions exist**

At the end of the app IIFE, assign `window.FabriCadabraApp.backup={...}`. Keep business normalization in `app.js`; do not put domain rules in `backup.js`.

- [ ] **Step 10: Run the focused verifier GREEN**

Run:

```bash
node scripts/verify-backup-restore.mjs
```

Expected: core bridge assertions PASS; UI/orchestration checks may remain pending until Task 2 if structured that way.

- [ ] **Step 11: Commit Task 1**

```bash
git add fabrication_pro_capacitor/www/app.js fabrication_pro_capacitor/scripts/verify-backup-restore.mjs
git commit -m "feat: add canonical full-backup data bridge"
```

---

### Task 2: Build the Settings Data & Backup subsystem and transactional restore engine

**Files:**
- Create: `fabrication_pro_capacitor/www/backup.js`
- Create: `fabrication_pro_capacitor/tests/e2e/backup-restore.spec.mjs`
- Modify: `fabrication_pro_capacitor/www/index.html`
- Modify: `fabrication_pro_capacitor/www/styles.css`
- Modify: `fabrication_pro_capacitor/scripts/verify-web.mjs`
- Modify: `fabrication_pro_capacitor/scripts/verify-settings-changelog.mjs`
- Modify: `fabrication_pro_capacitor/scripts/verify-backup-restore.mjs`

**Interfaces:**
- Consumes `window.FabriCadabraApp.backup`.
- Registers `window.FabriCadabraApp.backupRecovery` with snapshot operations callable by feature imports.
- Owns full-backup file I/O, IndexedDB, localStorage replacement/rollback, and Settings status messaging.

- [ ] **Step 1: Add a failing browser test for Settings backup UI and portable file shape**

Create `tests/e2e/backup-restore.spec.mjs` with a first test that:

1. opens Settings through the Pages drawer
2. expects `Backup Fabri-Cadabra`, `Restore Fabri-Cadabra Backup`, and `Restore Last Recovery Snapshot`
3. triggers Backup and captures JSON download
4. asserts `format`, `schemaVersion`, `appVersion`, valid `exportedAt`, and all required sections.

Run the one spec and confirm FAIL before UI implementation.

- [ ] **Step 2: Add static Data & Backup markup**

In `#tool-settings`, add a dedicated card with stable IDs:

- `settingsBackupBtn`
- `settingsRestoreBtn`
- `settingsRestoreFile` hidden JSON file input
- `settingsRecoveryRestoreBtn`
- `settingsBackupStatus` (`role=status`, `aria-live=polite`)
- `settingsRecoveryMeta`

Copy must explain that full backup contains persistent Fabri-Cadabra data and that the recovery snapshot is the most recent automatic pre-change rollback point.

- [ ] **Step 3: Add Settings styles**

Add only focused rules for:

- `.settings-backup-card`
- action layout
- recovery metadata/status row
- mobile wrapping/full-width behavior

Reuse existing `.btn`, `.card`, `.status`, `.hint`, and Settings visual language.

- [ ] **Step 4: Load `backup.js` after `app.js`**

Preferred script order:

```html
<script src="native-compat.js" defer></script>
<script src="app.js" defer></script>
<script src="backup.js" defer></script>
<script src="calculator.js" defer></script>
```

Update `verify-web.mjs` to require `backup.js`, syntax-check it, and enforce the order.

- [ ] **Step 5: Implement portable full-backup download**

In `backup.js`:

- require `FabriCadabraApp.backup`
- await/execute `flushPendingSaves()`
- call `buildBackup()`
- JSON stringify with indentation
- use Blob + object URL + download anchor so `native-compat.js` continues handling native sharing
- filename `Fabri-Cadabra-Backup-YYYY-MM-DD.json`
- report status only after initiating a valid backup.

- [ ] **Step 6: Implement 16 MiB restore file reading and prevalidation**

Reject oversized files before `FileReader`/`file.text()` processing. Parse JSON and call `backup.normalizeBackup()` before asking the destructive confirmation or mutating storage.

Invalid files must update Settings status and leave all persistent values unchanged.

- [ ] **Step 7: Implement IndexedDB rolling recovery storage**

Use exactly:

- DB `FabriCadabraRecovery`
- version `1`
- store `snapshots`
- record ID `latest`

Functions:

- `openRecoveryDb()`
- `writeLatestRecoverySnapshot(reason, backupPayload?)`
- `readLatestRecoverySnapshot()`
- `refreshRecoveryMeta()`

Snapshot creation builds current full persistent state through the canonical app backup bridge. Reject/propagate IndexedDB failures so destructive mutations are blocked.

- [ ] **Step 8: Register feature-import recovery service**

Register a narrow service such as:

```js
window.FabriCadabraApp.backupRecovery={
  createSnapshot,
  readLatestSnapshot
};
```

The service should throw on failure and should never mutate feature data itself.

- [ ] **Step 9: Implement transaction-style 10-key replacement**

Create a helper that:

1. captures current values for exactly `backup.storageKeys`
2. writes/removes target values from the fully validated map
3. on first write failure, restores prior captured values best-effort
4. throws/report failure if commit did not complete.

Never enumerate all origin storage and never call `localStorage.clear()`.

- [ ] **Step 10: Implement full restore**

Flow:

1. file parse + full normalize
2. destructive confirmation
3. `createSnapshot('before-full-restore')`
4. transactionally apply normalized 10-key map
5. reload on success.

If automatic snapshot cannot be created, abort restore and instruct user to make a manual full backup before retrying.

- [ ] **Step 11: Implement recovery restore with swap-safe semantics**

Flow:

1. read `latest` fully into memory
2. validate its embedded backup
3. confirmation
4. build current persistent backup
5. write it as new `latest` with reason `before-recovery-restore`
6. apply the previously read old snapshot through the same transaction helper
7. reload on success.

Do not overwrite `latest` before the old snapshot is safely held in memory.

- [ ] **Step 12: Run targeted verification and first browser test GREEN**

Run:

```bash
node scripts/verify-backup-restore.mjs
npm run verify:web
npm run verify:settings
npm run test:e2e -- --project=desktop-chromium tests/e2e/backup-restore.spec.mjs
```

- [ ] **Step 13: Commit Task 2**

```bash
git add fabrication_pro_capacitor/www/backup.js fabrication_pro_capacitor/www/index.html fabrication_pro_capacitor/www/styles.css fabrication_pro_capacitor/scripts/verify-web.mjs fabrication_pro_capacitor/scripts/verify-settings-changelog.mjs fabrication_pro_capacitor/scripts/verify-backup-restore.mjs fabrication_pro_capacitor/tests/e2e/backup-restore.spec.mjs
git commit -m "feat: add unified backup restore settings workflow"
```

---

### Task 3: Protect existing destructive feature imports with automatic recovery snapshots

**Files:**
- Modify: `fabrication_pro_capacitor/www/app.js`
- Modify: `fabrication_pro_capacitor/tests/e2e/backup-restore.spec.mjs`
- Re-run existing Task/Notes/Checklist/Optimizer specs

**Interfaces:**
- Uses runtime `window.FabriCadabraApp.backupRecovery.createSnapshot(reason)` only after import validation/confirmation and immediately before persistent mutation.
- Existing feature JSON formats and confirmation wording remain intact.

- [ ] **Step 1: Add failing recovery protection browser coverage**

Use one destructive import journey (Notes is the simplest) to establish:

- existing persistent baseline data
- imported replacement data
- automatic recovery metadata appears in Settings
- `Restore Last Recovery Snapshot` returns the pre-import persistent state after reload
- recovery restore leaves a new `before-recovery-restore` undo snapshot.

Confirm FAIL before adding hooks.

- [ ] **Step 2: Add one shared recovery-protection helper in `app.js`**

Example contract:

```js
async function createRecoveryBeforeDestructiveImport(reason) {
  const createSnapshot=window.FabriCadabraApp?.backupRecovery?.createSnapshot;
  if (typeof createSnapshot!=='function') throw new Error('Automatic recovery protection is unavailable. Make a full Fabri-Cadabra backup before retrying.');
  await createSnapshot(reason);
}
```

Keep this orchestration-only; `app.js` does not implement IndexedDB.

- [ ] **Step 3: Protect Task Logging Jobs replacement**

After parse/normalization and user confirmation, but before assigning `taskLogJobs`, await:

`createRecoveryBeforeDestructiveImport('before-task-jobs-import')`

Only require it when existing Task jobs will actually be replaced.

On snapshot failure, show Task Logging error and do not mutate jobs.

- [ ] **Step 4: Protect Task Logging Presets replacement**

Same sequence with reason `before-task-presets-import` when current presets exist.

- [ ] **Step 5: Protect Fabricator Notes replacement**

Same sequence with reason `before-notes-import` when current Notes exist.

- [ ] **Step 6: Protect Checklist replacement**

Same sequence with reason `before-checklist-import` when current Checklists exist.

- [ ] **Step 7: Protect saved Sheet Optimizer overwrite**

After normalization and all existing confirmations, if the imported `jobNumber` already exists in persisted saved jobs, snapshot with reason `before-optimizer-import` before replacing the saved dictionary entry.

If only dirty unsaved workspace will be discarded but no persistent saved job is being overwritten, retain the existing confirmation and explicitly do not claim that automatic recovery can restore that transient workspace. The user can Save Job or Export Job File first.

- [ ] **Step 8: Make affected FileReader callbacks asynchronous safely**

Convert only the relevant `reader.onload` handlers to `async` where necessary. Preserve each `finally` that clears the file input, and keep parsing/confirmation before snapshot creation.

- [ ] **Step 9: Run existing feature-specific regression specs**

Run:

```bash
npm run test:e2e -- --project=desktop-chromium tests/e2e/tasklog-shift.spec.mjs tests/e2e/notes-checklist.spec.mjs tests/e2e/optimizers.spec.mjs
```

Expected: all prior import/export tests still pass.

- [ ] **Step 10: Run recovery test GREEN**

Run the focused recovery test in `backup-restore.spec.mjs`.

- [ ] **Step 11: Commit Task 3**

```bash
git add fabrication_pro_capacitor/www/app.js fabrication_pro_capacitor/tests/e2e/backup-restore.spec.mjs
git commit -m "feat: protect destructive imports with recovery snapshots"
```

---

### Task 4: Prove complete clear-and-restore behavior and corruption safety in Playwright

**Files:**
- Modify: `fabrication_pro_capacitor/tests/e2e/backup-restore.spec.mjs`
- Modify if useful: `fabrication_pro_capacitor/tests/e2e/helpers.mjs`
- Modify: `fabrication_pro_capacitor/tests/e2e/mobile.spec.mjs`

**Primary full round-trip test:**

- [ ] **Step 1: Build real persistent state entirely through UI controls**

At a deterministic Playwright Clock time:

- Task Logging: job + preset + assigned task; run/stop once so completed session history exists; then start again before backup so restore can prove running timer sanitization.
- Shift Schedule: configure valid workdays/times, enable, and Clock In before backup so restore can prove stale clock-in sanitization.
- Fabricator Notes: create topic and apply rich-text formatting.
- Checklist: create topic with multiple items and mark at least one complete.
- Sheet Optimizer: add part and save a named job to device storage.
- Theme: toggle from initial value.
- Quick Reference: select `gauge-thickness` and set decimal mode.

- [ ] **Step 2: Download one full backup and inspect its structure**

Assert:

- `format === 'FabriCadabraBackup'`
- `schemaVersion === 1`
- `appVersion` equals `package.json`
- `exportedAt` parses
- all required sections exist
- Task record includes completed session and a captured running timer
- Shift record captured enabled/clock state
- saved optimizer dictionary contains the named job
- preferences reflect UI changes.

- [ ] **Step 3: Simulate local data loss without `localStorage.clear()`**

From the test only, remove the exact 10 approved Fabri-Cadabra keys using `localStorage.removeItem(key)`, then reload.

Assert user data/preferences return to empty/default states as expected. The application implementation itself must still contain no `localStorage.clear()`.

- [ ] **Step 4: Restore through the Settings UI**

Set the downloaded JSON file on `#settingsRestoreFile`, accept the destructive confirmation, and wait for the app reload.

- [ ] **Step 5: Verify every supported category after restore**

Verify through visible UI:

- Task job/preset/task restored
- prior completed session survives
- no Task timer remains running
- Shift Schedule remains enabled/configured but displays CLOCK IN / clocked-out state
- formatted Note content survives
- Checklist title/items/order/completion survive
- saved Sheet Optimizer job is present/loadable
- restored theme is applied
- Quick Reference selected table/mode restored.

- [ ] **Step 6: Add invalid/future backup tests**

Use in-memory `setInputFiles({name,mimeType,buffer})` payloads to verify:

- invalid JSON rejected
- wrong format rejected
- future `schemaVersion` rejected
- one corrupt nested domain rejected
- one required section missing rejected

Before/after compare a persistent sentinel value and assert no mutation occurred.

- [ ] **Step 7: Add full-restore recovery test**

Prove that a successful full restore creates `latest` with reason `before-full-restore`, and restoring that snapshot can return to the state immediately before the full restore.

- [ ] **Step 8: Add mobile Settings backup-card coverage**

Within `@mobile`, navigate to Settings and verify the Data & Backup card/actions fit the 390×844 viewport with no horizontal overflow and remain tappable.

- [ ] **Step 9: Run the new browser spec and mobile test repeatedly**

Run:

```bash
npm run test:e2e -- --project=desktop-chromium tests/e2e/backup-restore.spec.mjs
npm run test:e2e -- --project=mobile-chromium tests/e2e/mobile.spec.mjs
```

Fix product regressions, not test expectations, unless the expectation contradicts the approved spec.

- [ ] **Step 10: Commit Task 4**

```bash
git add fabrication_pro_capacitor/tests/e2e/backup-restore.spec.mjs fabrication_pro_capacitor/tests/e2e/helpers.mjs fabrication_pro_capacitor/tests/e2e/mobile.spec.mjs
git commit -m "test: prove full app backup restore and recovery"
```

---

### Task 5: Make backup coverage a permanent verification contract and correct project documentation

**Files:**
- Modify: `fabrication_pro_capacitor/scripts/verify-backup-restore.mjs`
- Modify: `fabrication_pro_capacitor/scripts/verify-web.mjs`
- Modify: `fabrication_pro_capacitor/scripts/verify-features.mjs`
- Modify: `fabrication_pro_capacitor/scripts/verify-settings-changelog.mjs`
- Modify: `fabrication_pro_capacitor/package.json`
- Modify: `fabrication_pro_capacitor/README.md`

- [ ] **Step 1: Finish the permanent backup verifier**

Require at minimum:

- backup format/schema definitions
- exactly the 10 approved registry keys, including Shift Schedule
- Settings IDs for all three actions/status/recovery metadata
- `backup.js` loaded after `app.js`
- IndexedDB DB/store/latest contract
- 16 MiB restore limit
- no `localStorage.clear()` in `app.js` or `backup.js`
- normalize-before-mutate ordering/markers
- pre-restore snapshot creation
- localStorage rollback implementation
- recovery restore reads source before overwriting `latest`
- Task running-timer finalization through existing helper
- Shift restore sanitization
- existing destructive import reasons/hooks.

- [ ] **Step 2: Add npm script and aggregate gate**

Add:

```json
"verify:backup-restore": "node scripts/verify-backup-restore.mjs"
```

Include it in `npm run verify` before native/signing checks.

Do not alter package version.

- [ ] **Step 3: Correct generic feature persistence coverage**

Update `verify-features.mjs` so its protected persistence list includes all 10 keys, especially `fabricationShiftScheduleV1`, and so it does not drift from the new authoritative registry contract.

- [ ] **Step 4: Update canonical web/settings verifiers**

`verify-web.mjs` must include/syntax-check `backup.js` and enforce script order.

`verify-settings-changelog.mjs` should verify the static Data & Backup card and its required styles without duplicating detailed backup semantics.

- [ ] **Step 5: Fix stale README source map from Audit #3**

Remove obsolete `www/ux.js` and `www/ux.css` ownership claims. Add `www/backup.js` with its actual role.

Update persistence notes to explain:

- full app backup covers all current persistent Fabri-Cadabra state
- recovery snapshots live in IndexedDB and are rolling/local
- feature-specific exports remain available
- Saw Optimizer remains job-file only/non-persistent.

- [ ] **Step 6: Run aggregate static verification**

Run:

```bash
npm run verify
```

Expected: PASS, with version still `1.0.5` and app ID unchanged.

- [ ] **Step 7: Commit Task 5**

```bash
git add fabrication_pro_capacitor/scripts/verify-backup-restore.mjs fabrication_pro_capacitor/scripts/verify-web.mjs fabrication_pro_capacitor/scripts/verify-features.mjs fabrication_pro_capacitor/scripts/verify-settings-changelog.mjs fabrication_pro_capacitor/package.json fabrication_pro_capacitor/README.md
git commit -m "chore: enforce full backup coverage in verification"
```

---

### Task 6: Feature-branch verification, staging, exact-SHA production promotion, and audit closure

**Files:**
- No application changes expected unless a verified regression requires a targeted fix.
- Update after production only: `/mnt/data/Fabri-Cadabra_App_Audit_Fix_Checklist.txt` in the active ChatGPT runtime.

- [ ] **Step 1: Run fresh feature-branch dependency/test setup**

From `fabrication_pro_capacitor/`:

```bash
npm ci
npx playwright install chromium
npm run verify
npm run test:e2e
```

Expected: all previous 28 tests plus the new backup/recovery tests pass.

- [ ] **Step 2: Review the complete baseline diff**

Compare baseline `e067fc43e27f6543e20b8ff6ac093b74366e4206` to feature head.

Allowed scope:

- approved spec/plan
- `www/app.js`, `www/index.html`, `www/styles.css`, new `www/backup.js`
- backup/browser tests/helpers/mobile assertion as needed
- backup/web/features/settings verifiers
- `package.json`
- README correction.

Reject changes to app ID, version, signing, branding assets, native bundle identity, optimizer algorithms, fabrication formulas, or unrelated UI.

- [ ] **Step 3: Reconfirm identity invariants**

Verify:

- package `fabri-cadabra-capacitor`
- version `1.0.5`
- Capacitor app ID `com.fabricationpro.app`
- no signing workflow/fingerprint changes.

- [ ] **Step 4: Stage exact verified feature SHA to `work` non-force**

Move `work` to the exact feature head only after Steps 1–3 pass.

- [ ] **Step 5: Require staging installer workflow success**

For the staging run on `work`, require all three jobs:

- Browser Regression Tests
- Android Permanently Signed APK
- iPhone IPA for SideStore or AltStore

Capture run ID, job IDs, and artifact IDs.

Verify Android:

- package `com.fabricationpro.app`
- versionName `1.0.5`
- versionCode `1000005`
- signing fingerprint exactly `5769bbe5a1f4fdccd985fd0145495f3614e0db41992871c99b9eb361634bb586`

Verify iOS:

- bundle `com.fabricationpro.app`
- version/build `1.0.5`.

- [ ] **Step 6: Promote the exact staging SHA to `main` non-force**

Before updating, confirm `main` is still at the expected prior production ancestry and has no conflicting intentional commit.

No rebase, squash, or rebuild SHA between staging and production.

- [ ] **Step 7: Require production installer and Pages success on that same SHA**

Capture:

- production installer run ID
- Browser/Android/iOS success
- production Android/iOS artifact IDs
- production Pages run ID and success
- native identity/signing evidence.

- [ ] **Step 8: Confirm `main` and `work` are identical**

Use commit comparison after production completes.

- [ ] **Step 9: Update audit checklist only now**

Verify `/mnt/data/Fabri-Cadabra_App_Audit_Fix_Checklist.txt` exists in the active runtime.

Update:

- audited commit header -> new production SHA
- item #4 -> `[x]`
- item #5 remains pending
- version remains `1.0.5`.

- [ ] **Step 10: Final evidence report**

Report the production SHA, staging/production run IDs, test count, native artifacts/identity, Pages status, and updated checklist link. Do not mark Audit #4 complete before every preceding gate is green.
