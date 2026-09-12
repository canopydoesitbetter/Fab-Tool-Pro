# Persistent Data Schemas and Migrations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralize all Fabri-Cadabra persistent stores behind a schema registry with explicit migrations, validation, raw-data recovery protection, and v1 full-backup compatibility while preserving every existing storage key and keeping public version 1.0.4.

**Architecture:** `www/app/storage.js` becomes the registry/migration engine loaded before feature modules. Feature modules register existing keys and reuse their existing normalizers/serializers as adapters. Full backup schema advances to v2 and delegates store validation to the registry; existing v1 backups migrate through a tested adapter. Risky stores are never overwritten until original raw bytes are durably protected in IndexedDB.

**Tech Stack:** Vanilla browser JavaScript, localStorage, IndexedDB, Node 22 verification scripts, Playwright, Capacitor 8.5.

**Spec:** `docs/superpowers/specs/2026-09-12-persistent-data-migrations-design.md`

## Global Constraints

- Public/display version stays `1.0.4`.
- Native build becomes `1000007` only after implementation/tests are green.
- Capacitor app ID stays `com.fabricationpro.app`.
- Keep all 10 existing localStorage keys unchanged.
- Never silently remove or overwrite corrupt, unsupported, or future-version user data.
- Existing valid user data, feature imports, v1 full backups, timers, calculations, and optimizer behavior must remain compatible.
- `npm run verify` remains read-only.

---

### Task 1: Add the RED storage/migration contract

**Files:**
- Create: `fabrication_pro_capacitor/scripts/verify-persistent-storage.mjs`
- Modify: `fabrication_pro_capacitor/package.json`
- Test: `fabrication_pro_capacitor/tests/e2e/storage-migrations.spec.mjs`

**Interfaces:**
- Consumes: current module manifest and existing persistence keys.
- Produces: `npm run verify:persistence` and fixture coverage that fails until the central registry exists.

- [ ] **Step 1: Write the static architecture verifier**

Require `www/app/storage.js` to expose registry/migration markers, require all 10 stable keys to be registered, require the aggregate `verify` script to include `verify:persistence`, and reject direct duplicate backup key registries in `import-export.js`.

Representative assertions:

```js
need(storage.includes('registerPersistentStore'),'Persistent storage registry must expose registerPersistentStore.');
need(storage.includes('loadPersistentStore'),'Persistent storage registry must expose loadPersistentStore.');
need(storage.includes('normalizePersistentStoreValue'),'Persistent storage registry must expose normalization/migration.');
for (const key of REQUIRED_KEYS) need(app.includes(key),`Missing persistent store ${key}.`);
need(pkg.scripts.verify.includes('verify:persistence'),'Aggregate verify must include persistent storage verification.');
```

- [ ] **Step 2: Add Playwright RED fixtures**

Create tests for missing/current/old/corrupt/future data and old backup schema. Initial tests should probe `window.FabriCadabraApp.storage` and therefore fail before implementation.

Example RED expectation:

```js
const registry=await page.evaluate(()=>window.FabriCadabraApp?.storage?.listStores?.());
expect(registry).toHaveLength(10);
```

- [ ] **Step 3: Wire `verify:persistence` into `package.json`**

Add:

```json
"verify:persistence": "node scripts/verify-persistent-storage.mjs"
```

and run it immediately after `verify:app-modules` in aggregate `verify`.

- [ ] **Step 4: Run RED**

Run `npm run verify:persistence` and the new Playwright spec. Expected: failure because the registry/API does not exist yet.

- [ ] **Step 5: Commit RED contract**

Commit message: `test: define persistent storage migration contract`

---

### Task 2: Build the central registry and migration engine

**Files:**
- Modify: `fabrication_pro_capacitor/www/app/storage.js`
- Test: `fabrication_pro_capacitor/tests/e2e/storage-migrations.spec.mjs`

**Interfaces:**
- Produces:
  - `registerPersistentStore(definition)`
  - `loadPersistentStore(id)`
  - `writePersistentStore(id,value,options={})`
  - `getPersistentStoreDefinition(id)`
  - `listPersistentStores()`
  - `getPersistentStorageIssues()`
  - `normalizePersistentStoreValue(id,rawValue,options={})`
  - `markPersistentStoreRecoveryProtected(id)`
  - `listPersistentStoresNeedingRecoveryProtection()`

- [ ] **Step 1: Implement registry validation**

Reject duplicate ids/keys, invalid schema versions, missing validators/serializers, and migration gaps.

A definition has this shape:

```js
{
  id:'notes',
  key:'fabricationFabricatorNotesV1',
  version:2,
  encoding:'json',
  defaultValue:()=>({/* feature default */}),
  getVersion:value=>Number(value?.version || 1),
  migrations:{1:value=>migrateNotesV1ToV2(value)},
  normalize:value=>normalizeFabricatorNotesCurrentRecord(value),
  serialize:value=>JSON.stringify(value),
  label:'Fabricator Notes'
}
```

- [ ] **Step 2: Implement pure normalization/migration**

`normalizePersistentStoreValue` parses the raw string, detects source version, applies every migration in sequence, validates current shape, and returns metadata without writing localStorage.

Statuses are exactly:

```js
'missing' | 'current' | 'migrated' | 'invalid' | 'unsupported'
```

- [ ] **Step 3: Implement non-destructive load**

`loadPersistentStore` must leave localStorage untouched for every status. Missing returns a fresh default. Invalid/unsupported returns a safe default plus issue metadata while retaining `raw`.

- [ ] **Step 4: Implement guarded write**

If the last load status for a store is `migrated`, `invalid`, or `unsupported`, reject writes until `markPersistentStoreRecoveryProtected(id)` has been called, unless the caller passes an explicit `recoveryProtected:true` after an existing full recovery snapshot has succeeded.

```js
if (state.requiresRecoveryProtection && !state.recoveryProtected && options.recoveryProtected!==true) {
  throw new Error(`${definition.label} cannot overwrite older or unreadable saved data until a recovery copy is protected.`);
}
```

- [ ] **Step 5: Preserve compatibility helpers**

Keep `storageGet` / `storageSet` temporarily as thin compatibility wrappers for any not-yet-migrated callsites, but make failures observable instead of silently swallowing structured-store errors.

- [ ] **Step 6: Run focused tests and commit**

Expected: registry unit-style Playwright probes pass; feature adapter tests still fail because stores are not registered.

Commit message: `feat: add central persistent storage registry`

---

### Task 3: Register simple preference stores and prevent startup overwrite

**Files:**
- Modify: `fabrication_pro_capacitor/www/app/navigation.js`
- Modify: `fabrication_pro_capacitor/www/app/quick-reference.js`
- Modify: `fabrication_pro_capacitor/www/app/storage.js` only if shared string helpers are needed
- Test: `fabrication_pro_capacitor/tests/e2e/storage-migrations.spec.mjs`

**Interfaces:**
- Registers store ids: `theme`, `lastTool`, `quickReferenceTable`, `quickReferenceDisplayMode`.

- [ ] **Step 1: Register strict string schemas**

Theme accepts `light|dark`; lastTool accepts the existing `VALID_TOOLS`; quick-reference table accepts keys of `QUICK_REFERENCE_TABLES`; display mode accepts `fraction|decimal`.

- [ ] **Step 2: Load preferences through registry**

Use `loadPersistentStore` values instead of raw `storageGet` calls.

- [ ] **Step 3: Stop initialization from overwriting bad raw values**

Change initial navigation selection to `selectTool(initialTool,{persist:false})` (or equivalent). User-initiated changes persist normally through `writePersistentStore`.

- [ ] **Step 4: Test missing and corrupt preference data**

Verify corrupt preference strings remain byte-for-byte unchanged after page load and UI safely uses defaults.

- [ ] **Step 5: Commit**

Commit message: `refactor: register persistent preference schemas`

---

### Task 4: Register structured feature stores and explicit migrations

**Files:**
- Modify: `fabrication_pro_capacitor/www/app/task-logging.js`
- Modify: `fabrication_pro_capacitor/www/app/shift-schedule.js`
- Modify: `fabrication_pro_capacitor/www/app/notes.js`
- Modify: `fabrication_pro_capacitor/www/app/checklist.js`
- Modify: `fabrication_pro_capacitor/www/app/sheet-optimizer.js`
- Test: `fabrication_pro_capacitor/tests/e2e/storage-migrations.spec.mjs`

**Interfaces:**
- Registers ids: `taskLogJobs`, `taskLogPresets`, `shiftSchedule`, `fabricatorNotes`, `checklists`, `optimizerSavedJobs`.

- [ ] **Step 1: Task Logging adapters**

Keep the existing v1 serializers/normalizers. Load/persist through the registry. Keep timer/session validation, single-running-task protection, ids, and import formats unchanged.

- [ ] **Step 2: Shift Schedule adapter**

Keep schema v1 and current normalization. On invalid raw storage, return disabled in-memory schedule while retaining the raw value and exposing the existing load-error message.

- [ ] **Step 3: Notes explicit v1 -> v2 migration**

Extract the legacy branch from `normalizeFabricatorNotesRecord` into an explicit migration function:

```js
function migrateFabricatorNotesV1ToV2(data) {
  return {
    ...data,
    version:2,
    topics:data.topics.map(topic=>({...topic,contentHtml:plainTextToFabricatorNoteHtml(topic.content)}))
  };
}
```

Then make the current validator validate v2 only. Portable v1 imports call the same registry migration path.

- [ ] **Step 4: Checklist v1 adapter**

Preserve current normalization and save semantics, replacing direct localStorage writes with registry writes.

- [ ] **Step 5: Optimizer dictionary adapter**

Register the saved-jobs dictionary and normalize each job with the existing `normalizeOptimizerJobRecord` semantics. Keep explicit v1/v2 compatibility: `finishedW`/`finishedL` -> Width/Height and `rotate` -> current `grainFlowRotation` meaning. Ensure dictionary key equals normalized `jobNumber`.

- [ ] **Step 6: Test old/current/corrupt/future fixtures**

Verify old Notes and Optimizer fixtures load current values in memory while original raw localStorage remains unchanged until an allowed save.

- [ ] **Step 7: Commit**

Commit message: `refactor: register feature data schemas and migrations`

---

### Task 5: Add durable raw recovery protection

**Files:**
- Modify: `fabrication_pro_capacitor/www/backup.js`
- Modify: `fabrication_pro_capacitor/www/app/storage.js`
- Test: `fabrication_pro_capacitor/tests/e2e/storage-migrations.spec.mjs`

**Interfaces:**
- IndexedDB database remains `FabriCadabraRecovery`.
- Add a dedicated object store such as `rawStores` by incrementing `RECOVERY_DB_VERSION`.
- `window.FabriCadabraRecovery.protectPersistentStores()` persists raw values and marks registry state protected only after transaction success.

- [ ] **Step 1: Upgrade recovery DB non-destructively**

Increment DB version and create `rawStores` without removing the existing `snapshots` store.

- [ ] **Step 2: Protect every risky loaded store**

On backup bridge startup, call `listPersistentStoresNeedingRecoveryProtection()`, write records containing store id/key/raw/sourceVersion/timestamp/reason, then call `markPersistentStoreRecoveryProtected(id)`.

- [ ] **Step 3: Keep writes blocked on protection failure**

If IndexedDB is unavailable or the transaction fails, do not mark the store protected. Existing raw localStorage remains unchanged.

- [ ] **Step 4: Reuse full recovery snapshots for destructive imports**

After `requireRecoverySnapshot` succeeds, feature replacement writes may pass `{recoveryProtected:true}` because a full undo point already exists.

- [ ] **Step 5: Test protection**

Verify migration load + immediate attempted overwrite is blocked until raw recovery exists; after protection, save succeeds and the raw recovery record contains the exact original bytes.

- [ ] **Step 6: Commit**

Commit message: `feat: protect raw data before schema upgrade writes`

---

### Task 6: Upgrade full backup schema to v2 and route through registry

**Files:**
- Modify: `fabrication_pro_capacitor/www/app/import-export.js`
- Modify: `fabrication_pro_capacitor/www/backup.js`
- Modify: `fabrication_pro_capacitor/tests/e2e/backup-restore.spec.mjs`
- Test: `fabrication_pro_capacitor/tests/e2e/storage-migrations.spec.mjs`

**Interfaces:**
- `FABRI_CADABRA_BACKUP_SCHEMA_VERSION=2`
- `normalizeFullBackupForRestore(raw)` accepts schema 1 and 2.
- Backup persistence key enumeration comes from `listPersistentStores()`.

- [ ] **Step 1: Add pure v1 -> v2 backup migration**

Convert the existing v1 `sections` payload into the v2 normalized restore input without changing the user data represented by those sections.

- [ ] **Step 2: Build v2 backups from registered stores**

Flush pending edits, capture current feature state, and emit schema 2. Do not maintain a second hand-written array of localStorage keys.

- [ ] **Step 3: Restore through central normalization**

Validate every restored store through registry adapters, then produce the transactional replacement map. Keep current running Task Logging finalization and Shift Schedule clock-out restore behavior.

- [ ] **Step 4: Preserve v1 backup fixture**

Add a literal schema-v1 fixture independent of the current backup builder and prove it restores Notes, Checklist, Task Logging, Optimizer, Shift Schedule config, and preferences.

- [ ] **Step 5: Future backup rejection**

Prove schema 99 changes no app-owned storage.

- [ ] **Step 6: Commit**

Commit message: `feat: migrate full backups through storage registry`

---

### Task 7: Release metadata, changelog, and permanent verification

**Files:**
- Modify: `fabrication_pro_capacitor/release.json`
- Modify: `fabrication_pro_capacitor/www/index.html`
- Modify: `fabrication_pro_capacitor/scripts/verify-persistent-storage.mjs`
- Modify: `fabrication_pro_capacitor/scripts/verify-backup-restore.mjs` if schema assertions require v2
- Modify: existing verifiers only where they encode old direct-storage architecture

**Interfaces:**
- Public version remains 1.0.4.
- Native build becomes 1000007.

- [ ] **Step 1: Append 1.0.4 changelog item**

Add a new bullet to the existing 1.0.4 entry describing centralized persistent data schemas/migrations, old-data compatibility, corruption protection, and backup v1 migration. Do not delete existing 1.0.4 bullets.

- [ ] **Step 2: Advance hidden build number**

Set only:

```json
"buildNumber": 1000007
```

Keep `version: "1.0.4"` and `previousVersion: "1.0.3"`.

- [ ] **Step 3: Run complete static/source verification**

Run `npm run verify`. Expected: PASS and tracked working tree unchanged.

- [ ] **Step 4: Run full Playwright suite**

Run `npm run test:e2e`. Expected: all existing tests plus new migration tests pass.

- [ ] **Step 5: Review diff for scope**

Confirm no app id change, no key rename, no calculation/optimizer algorithm change, and no unrelated UI change.

- [ ] **Step 6: Commit final release state**

Commit message: `feat: centralize persistent data migrations`

---

### Task 8: Native release gate and promotion

**Files:**
- No feature files unless a release verifier identifies a concrete defect.

**Interfaces:**
- Exact tested `work` commit is the only commit eligible for `main`.

- [ ] **Step 1: Push/test `work`**

Require Browser Regression Tests, Android Permanently Signed APK, and iPhone IPA jobs to succeed.

- [ ] **Step 2: Verify Android artifact identity**

Require package `com.fabricationpro.app`, `versionName=1.0.4`, `versionCode=1000007`, and the pinned permanent signing certificate.

- [ ] **Step 3: Fast-forward `main`**

Only after all gates pass, move `main` to the exact tested `work` SHA.

- [ ] **Step 4: Verify `main` workflows**

Require Pages deployment, read-only verifier, browser regression, Android APK, and iOS IPA to succeed on the exact `main` SHA.

- [ ] **Step 5: Deliver current APK**

Download the Android artifact from the successful `main` run and provide the APK plus checksum directly to the user.
