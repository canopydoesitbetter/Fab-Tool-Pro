# Fabri-Cadabra Unified Backup & Restore — Design

Date: 2026-09-10
Repository: `canopydoesitbetter/Fab-Tool-Pro`
Baseline SHA: `e067fc43e27f6543e20b8ff6ac093b74366e4206`
App folder: `fabrication_pro_capacitor/`
App version: `1.0.5`
Capacitor app ID: `com.fabricationpro.app`

## 1. Purpose

Add one app-wide backup and restore workflow that protects all persistent Fabri-Cadabra user data without removing or changing the existing feature-specific import/export tools.

The unified backup must be explicit, schema-versioned, validated before restore, portable between browser/native installations, and safe against destructive imports or partial restore failures.

## 2. Scope

### In scope

The v1 full backup covers every persistent app-owned storage entry currently present in production:

1. `fabricationTaskLogJobsV1`
   - Task Logging jobs
   - assigned tasks
   - accumulated elapsed time
   - completed session/history records
   - active job and next-ID metadata
2. `fabricationTaskLogPresetsV1`
   - Task Logging preset library
   - next preset ID
3. `fabricationShiftScheduleV1`
   - Shift Schedule enabled state
   - saved schedule configuration
   - persisted clock/pause state captured in the backup for completeness, but sanitized on restore as described below
4. `fabricationFabricatorNotesV1`
   - Fabricator Notes topics
   - rich-text note content
   - active topic and next-ID metadata
5. `fabricationChecklistV1`
   - Checklist topics
   - checklist items and checked state
   - active topic and next-ID metadata
6. `fabricationOptimizerJobsV1`
   - all saved Sheet Optimizer jobs stored on the device
   - per-job parts, grain-flow setting, cut marks, next-ID metadata, and job metadata
7. `fabricationTheme`
   - light/dark preference
8. `fabricationTool`
   - last stored page/tool preference
9. `fabricationQuickReferenceTable`
   - selected Quick Reference table
10. `fabricationQuickReferenceDecimalMode`
   - fraction/decimal display preference

### Explicitly out of scope for v1

- Saw Optimizer working data, because the production app does not persist Saw Optimizer state to device storage today. Its existing job-file import/export remains unchanged.
- transient Sheet Optimizer edits that have not been saved as a saved job.
- open drawers, focus, scroll position, temporary status messages, generated optimizer results, and other in-memory/UI-only state.
- native files, Android/iOS settings, signing material, or unrelated browser storage.
- recovery snapshots themselves; they must never recursively appear inside a full backup.

## 3. User experience

Add a `Data & Backup` card to the existing Settings page. It contains:

- `Backup Fabri-Cadabra`
- `Restore Fabri-Cadabra Backup`
- hidden JSON file input for restore
- `Restore Last Recovery Snapshot`
- a compact status area describing success/errors and the timestamp/reason of the available recovery snapshot when one exists

Existing Task Logging, Fabricator Notes, Checklist, Sheet Optimizer, and Saw Optimizer feature-specific import/export controls remain available and retain their current formats.

### Backup flow

1. User taps `Backup Fabri-Cadabra`.
2. Pending app-owned saves are flushed where needed so the exported payload reflects the latest committed UI data.
3. A normalized full-backup object is built from canonical app state.
4. The app downloads/shares a JSON file named similar to:
   - `Fabri-Cadabra-Backup-2026-09-10.json`
5. On native Android/iOS, the existing native export compatibility layer handles the Blob download/share flow just as it does for current JSON exports.

Backup does not require data to exist in every section; empty sections are represented as valid empty records.

### Restore flow

1. User chooses `Restore Fabri-Cadabra Backup` and selects a JSON file.
2. File-size and JSON parsing checks run before any state changes.
3. The backup format, schema version, metadata, and every required section are validated in memory.
4. All domain records are normalized using existing app validators/normalizers rather than blindly trusting raw JSON.
5. If validation succeeds, the app asks for destructive-restore confirmation.
6. Immediately before any persistent mutation, the current persistent app state is saved as the latest recovery snapshot in IndexedDB.
7. The app captures the current values of all 10 localStorage keys in memory for transaction-style rollback.
8. The complete replacement set is written in a deterministic sequence.
9. If any write fails, the app attempts to restore the pre-restore values from the in-memory transaction snapshot and reports the failure. It must not claim success.
10. On successful write, the page reloads so all existing canonical feature loaders rehydrate state from storage normally.

## 4. Full backup format

The portable JSON document uses this top-level shape:

```json
{
  "format": "FabriCadabraBackup",
  "schemaVersion": 1,
  "appVersion": "1.0.5",
  "exportedAt": "2026-09-10T23:30:00.000Z",
  "sections": {
    "taskLogging": {
      "jobs": {},
      "presets": {}
    },
    "shiftSchedule": {},
    "fabricatorNotes": {},
    "checklists": {},
    "optimizer": {
      "savedJobs": {}
    },
    "preferences": {
      "theme": "dark",
      "lastTool": "tasklog",
      "quickReferenceTable": "gauge-thickness",
      "quickReferenceDisplayMode": "decimal"
    }
  }
}
```

The nested records use their existing feature format/version fields wherever those formats already exist.

### Metadata rules

- `format` must equal `FabriCadabraBackup`.
- `schemaVersion` must be a positive integer.
- v1 restore rejects `schemaVersion > 1` as created by a newer unsupported backup schema.
- `appVersion` is required informational metadata and is not the compatibility authority; `schemaVersion` and each nested domain record version determine compatibility.
- `exportedAt` must be a valid ISO-compatible timestamp.
- every v1 section is required, including valid empty sections. This avoids ambiguous partial restores.

## 5. Validation and normalization

Restore is all-or-nothing at the validation phase. No storage value changes until every section has been accepted.

Reuse existing canonical normalizers for:

- Task Logging jobs
- Task Logging presets
- Shift Schedule
- Fabricator Notes
- Checklist
- each saved Sheet Optimizer job

Preferences receive an explicit allowlist validator:

- theme: `light`, `dark`, or null/absent equivalent represented by the backup builder
- last tool: one of the app's valid tool IDs
- Quick Reference table: one of the supported table IDs
- Quick Reference display mode: `fraction` or `decimal`

Unknown top-level or nested extra fields may be ignored for forward-tolerant parsing, but required known fields may not be omitted.

## 6. Running-timer and Shift Schedule restore safety

### Task Logging timers

The backup captures Task Logging jobs in the same complete format as the existing jobs export, including a running timer if one existed at export time.

During restore, any timer marked running is finalized using the app's existing safe-import behavior: elapsed time is stopped at the full backup's `exportedAt` timestamp, a completed session record is appended subject to existing session limits, and the restored task is no longer running.

This prevents a backup restored days later from creating false elapsed time.

### Shift Schedule

The backup captures the persisted Shift Schedule state for completeness, including clock/pause fields present in storage.

Restore preserves:

- enabled/disabled state
- validated schedule configuration

Restore does **not** resurrect a historical clock-in, overtime session, unscheduled work clock-in, or current-shift break/lunch override from the backup. Before storage is committed, the restored Shift state is sanitized to a clocked-out state with no current-shift pause overrides and with policy timing re-established at restore time.

If Shift Schedule restores as enabled, the user must manually Clock In again.

## 7. Recovery snapshot subsystem

Use IndexedDB instead of localStorage for automatic recovery snapshots so backup safety does not consume the same localStorage quota that may already be close to full.

### Storage contract

Database: `FabriCadabraRecovery`

Version: `1`

Object store: `snapshots`

Single rolling record key: `latest`

Record shape:

```json
{
  "id": "latest",
  "createdAt": "2026-09-10T23:35:00.000Z",
  "reason": "before-full-restore",
  "backup": {
    "format": "FabriCadabraBackup",
    "schemaVersion": 1,
    "appVersion": "1.0.5",
    "exportedAt": "...",
    "sections": {}
  }
}
```

Only one rolling recovery snapshot is required for v1. A new protected operation replaces the previous one.

### Snapshot triggers

Create a recovery snapshot immediately before the actual mutation for these destructive operations:

- full Fabri-Cadabra restore
- Task Logging Jobs import that replaces current jobs
- Task Logging Presets import that replaces current presets
- Fabricator Notes import that replaces current notes
- Checklist import that replaces current checklists
- Sheet Optimizer job import when it will replace an existing saved job and/or discard a dirty current optimizer workspace

A snapshot is not required for non-destructive export operations.

The recovery snapshot represents the entire app-owned persistent state, not just the feature being replaced. This makes `Restore Last Recovery Snapshot` a simple full-state rollback.

### Snapshot failure behavior

A protected destructive operation must not silently continue if its recovery snapshot cannot be created. The operation stops and reports that automatic recovery protection could not be created, recommending a manual full backup before retrying.

This is intentionally conservative because continuing would defeat the recovery guarantee.

## 8. Transaction-style localStorage replacement

localStorage does not provide transactions, so full restore implements best-effort atomic replacement:

1. build and validate all target serialized values first
2. capture all current app-owned values in memory
3. write/remove only the 10 registered Fabri-Cadabra keys
4. if any write throws, restore the prior values from memory
5. report success only after every target key is committed

The restore process must never call `localStorage.clear()` because that could erase unrelated origin data.

The unified backup system owns an explicit registry of the 10 supported persistent keys. This registry is also used by verification so a future app-owned persistent key cannot be added without being deliberately classified for backup support.

## 9. Module boundaries

Keep domain validation in `app.js`, where the existing normalizers and in-memory state already live, and keep generic file/recovery orchestration separate.

### `www/app.js`

Add a narrow backup bridge under `window.FabriCadabraApp` that can:

- flush pending persistent edits where required
- build the structured full backup payload from canonical state
- validate/normalize an incoming full backup into a deterministic localStorage replacement map
- expose the authoritative app-owned persistence key registry

The bridge should reuse existing feature serializers and normalizers rather than duplicate business validation.

### `www/backup.js`

New dedicated subsystem responsible for:

- Settings backup/restore button bindings
- JSON file reading and maximum size enforcement
- full-backup format orchestration
- JSON Blob download
- IndexedDB latest recovery snapshot read/write
- transaction-style localStorage replacement/rollback
- full restore confirmation and status UI
- `Restore Last Recovery Snapshot`
- wrapper used by existing destructive feature import flows to create a recovery snapshot before mutation

`backup.js` must consume the narrow bridge from `app.js`; it must not reimplement Task/Notes/Checklist/Optimizer/Shift business normalizers.

### `www/index.html`

Add the static `Data & Backup` Settings card and hidden restore file input.

Load scripts in an order that preserves the existing native export bridge and ensures `backup.js` runs after `app.js` has created its backup bridge.

### `www/styles.css`

Add only the styles required for the new Settings card/status/recovery metadata, following existing Settings visual conventions.

## 10. Existing feature imports

Feature-specific import/export formats stay intact.

The only intentional behavioral change is that destructive feature imports gain automatic full-app recovery protection before they mutate persistent state.

Existing feature confirmation wording can remain based on the current `window.confirm()` architecture; replacing browser confirms is audit item #11 and is intentionally out of scope here.

If the user cancels an import confirmation, no recovery snapshot needs to be created because no mutation will occur.

## 11. File-size and corruption safety

- Add a dedicated maximum full-backup import size. Target v1 limit: 16 MiB.
- Reject oversized files before FileReader processing.
- Reject invalid JSON.
- Reject wrong `format`.
- Reject unsupported future schema versions.
- Reject missing required sections.
- Reject any nested feature data that fails the existing feature normalizer.
- Reject saved optimizer-job dictionaries containing invalid records.
- Do not mutate storage when validation fails.
- Do not overwrite the latest recovery snapshot until a protected destructive operation has passed parsing/validation and the user has confirmed the operation.

## 12. Tests

### Static verifier

Add a permanent verifier, e.g. `scripts/verify-backup-restore.mjs`, and include it in `npm run verify`.

It must verify at minimum:

- backup format identifier and schema version are defined
- Settings markup contains all three actions
- `backup.js` is loaded after `app.js`
- exactly the authoritative 10 app-owned persistent keys are represented in the backup registry
- no use of `localStorage.clear()` in the backup/restore implementation
- recovery snapshot uses IndexedDB
- full restore contains prevalidation and rollback paths
- Shift restore sanitization exists
- Task running-timer restore uses the safe finalization path

### Browser regression

Add a real Playwright end-to-end full backup/restore journey that uses the UI rather than direct internal app calls for primary setup/restore actions:

1. create Task Logging preset/job/task
2. run and stop at least one Task session so history exists
3. configure Shift Schedule
4. create formatted Fabricator Notes content
5. create Checklist topic/items and mark at least one complete
6. save a Sheet Optimizer job
7. change theme
8. change Quick Reference table and fraction/decimal mode
9. create/download a full Fabri-Cadabra backup through Settings
10. capture the downloaded JSON and assert metadata/section presence
11. clear Fabri-Cadabra localStorage state in the browser to simulate local data loss, then reload
12. confirm the supported categories are absent/defaulted
13. restore the downloaded file through the Settings restore UI
14. accept the destructive restore confirmation
15. wait for reload
16. verify every supported category is restored correctly
17. verify no Task timer is left running
18. verify restored Shift Schedule is not clocked in even if the backup captured an active clock state

Add recovery-snapshot coverage:

1. create persistent baseline data
2. perform one destructive feature import that replaces data
3. verify Settings reports a recovery snapshot
4. invoke `Restore Last Recovery Snapshot`
5. verify the pre-import app state returns after reload

Add invalid-backup coverage proving malformed/unsupported files change no persistent state.

Run the existing full 28-test regression suite plus the new tests on desktop/mobile projects as appropriate.

## 13. Release gates

Implementation occurs only on `feature/unified-backup-restore` until feature verification is green.

Before promotion:

1. `npm run verify` passes
2. full Playwright suite passes including backup/restore tests
3. diff review confirms no app ID, package identity, signing fingerprint, branding, or unrelated business logic changed
4. exact verified feature SHA moves non-force to `work`
5. staging Browser Regression, Android, and iOS jobs all pass
6. verify Android package `com.fabricationpro.app`, version `1.0.5`, versionCode `1000005`, and permanent signing fingerprint
7. verify iOS bundle `com.fabricationpro.app` and version/build `1.0.5`
8. promote the exact staging SHA non-force to `main`
9. production Browser Regression, Android, iOS, and Pages deployment all pass on the same SHA
10. only then mark audit checklist item #4 complete

No version bump is part of audit #4 unless explicitly requested.

## 14. Success criteria

Audit #4 is complete only when:

- one portable backup exports all supported persistent Fabri-Cadabra state
- the backup carries format, schema version, app version, and export timestamp metadata
- all incoming backup sections are validated before mutation
- clearing app persistent storage and restoring the backup returns every supported data category
- Task session history survives backup/restore
- historical running Task timers do not continue after restore
- Shift configuration/enabled state restores without resurrecting a stale clock-in
- saved Sheet Optimizer jobs restore
- theme and Quick Reference preferences restore
- automatic recovery snapshots protect destructive imports and full restore
- a user can restore the latest recovery snapshot from Settings
- existing feature-specific import/export tools still work
- static verification and the full browser regression suite pass
- staging and production native/web release gates pass on the exact promoted SHA
