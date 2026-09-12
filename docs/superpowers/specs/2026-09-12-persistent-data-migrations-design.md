# Persistent Data Schemas and Migrations Design

## Status

Approved for implementation on 2026-09-12 as audit item #10.

## Goal

Centralize Fabri-Cadabra persistent data registration, schema versions, migration, validation, recovery protection, and backup restoration without changing existing localStorage keys or silently discarding existing user data.

## Release constraints

- Public/display version remains **1.0.4**.
- Native build number advances from **1000006** to **1000007** for the new installable build.
- `com.fabricationpro.app` must not change.
- Existing localStorage key names must not change.
- Existing valid data must continue to load with the same behavior.
- Corrupt, unsupported, or future-version data must never be silently overwritten or removed.
- Existing full backups using `FabriCadabraBackup` schema version 1 must remain restorable.
- Audit item #10 is appended to the existing 1.0.4 changelog; existing 1.0.4 changelog entries remain intact.

## Current problem

Persistence responsibility is split across feature modules. `www/app/storage.js` is only a thin `localStorage.getItem` / `setItem` wrapper. Feature modules independently own keys, versions, JSON parsing, normalization, error fallback, and import behavior. `www/app/import-export.js` separately lists the same persistence keys and reconstructs their storage values during full restore.

This already creates duplicated schema knowledge. Examples include Fabricator Notes, whose current format is version 2 and implicitly accepts version 1 plain-text notes, and Sheet Optimizer jobs, whose current job format is version 3 and implicitly accepts v1/v2 fields. These are migrations in practice, but they are not registered or testable as a common migration system.

## Registered stores

The central registry must account for the ten app-owned persistent keys already included in full backup/restore:

1. `fabricationTaskLogJobsV1`
2. `fabricationTaskLogPresetsV1`
3. `fabricationShiftScheduleV1`
4. `fabricationFabricatorNotesV1`
5. `fabricationChecklistV1`
6. `fabricationOptimizerJobsV1`
7. `fabricationTheme`
8. `fabricationTool`
9. `fabricationQuickReferenceTable`
10. `fabricationQuickReferenceDecimalMode`

No key is renamed as part of this work.

## Architecture

### Central storage engine

`www/app/storage.js` becomes the single persistence engine. It exposes a registry-backed API in classic-script scope so existing modules can call it without introducing ES-module semantics.

Each store registration describes:

- stable store id
- existing localStorage key
- current schema version
- encoding (`json` or `string`)
- default value factory
- version reader for structured data
- migration map keyed by source version
- validator/normalizer for the current version
- serializer for writes
- human-readable label for errors/recovery

The engine owns:

- registering stores
- loading raw values
- parsing encoded values
- applying migration chains one version at a time
- validating current values
- returning a structured load result
- writing through the registered serializer
- tracking load/migration errors
- protecting original raw data before a potentially destructive overwrite
- enumerating registered keys for backup/restore

### Load result

A store load returns an object shaped conceptually as:

```js
{
  status: 'missing' | 'current' | 'migrated' | 'invalid' | 'unsupported',
  value,
  raw,
  sourceVersion,
  currentVersion,
  migratedFrom: null | number,
  error: null | Error
}
```

Missing data is normal and returns the registered default. Invalid/unsupported data returns a safe in-memory default but leaves the original localStorage value untouched.

### Non-destructive migration

Loading older valid data may migrate it **in memory**. Startup must not automatically rewrite the user's original stored bytes merely because the app can migrate them.

The next intentional save of migrated data may write the current schema only after the original raw value is protected in the recovery vault. If protection cannot be created, the write is refused and the original localStorage value remains untouched.

### Recovery vault

The existing IndexedDB recovery system remains the full-app recovery mechanism. The storage layer adds a small raw-store recovery record for migration/corruption protection, using IndexedDB rather than an app-owned localStorage key so full-backup key enumeration remains stable.

A protected raw-store record contains at least:

- store id
- localStorage key
- original raw string
- source schema version when known
- timestamp
- reason (`before-schema-upgrade`, `before-invalid-data-overwrite`, or equivalent)

Protection is required before the engine overwrites a store whose most recent load result was `migrated`, `invalid`, or `unsupported`.

Invalid and future-version values are never automatically rewritten. Feature UI may operate on a safe default, but persistence must remain blocked until a protected recovery copy exists and a user action legitimately causes a save.

## Feature adapters

Existing feature validation logic is preserved and registered, not broadly rewritten.

### Task Logging Jobs

- Key stays `fabricationTaskLogJobsV1`.
- Current schema remains version 1.
- Existing `normalizeTaskLogJobsRecord` remains the authoritative validator/normalizer.
- Existing running-task safeguards and import finalization remain unchanged.

### Task Logging Presets

- Key stays `fabricationTaskLogPresetsV1`.
- Current schema remains version 1.
- Existing `normalizeTaskLogPresetsRecord` remains authoritative.

### Shift Schedule

- Key stays `fabricationShiftScheduleV1`.
- Current schema remains version 1.
- Existing `normalizeShiftScheduleState` and schedule validation remain authoritative.
- Invalid saved schedule data still results in a safe disabled schedule, but the raw invalid value is retained and recorded as a storage issue instead of being silently discarded.

### Fabricator Notes

- Key stays `fabricationFabricatorNotesV1`.
- Current schema remains version 2.
- Register an explicit **v1 -> v2** migration that converts legacy plain-text `content` to sanitized `contentHtml` while preserving ids, titles, timestamps, active topic, and next id.
- Current v2 validation remains equivalent to `normalizeFabricatorNotesRecord`.

### Checklist

- Key stays `fabricationChecklistV1`.
- Current schema remains version 1.
- Existing `normalizeChecklistRecord` remains authoritative.

### Sheet Optimizer saved jobs

- Key stays `fabricationOptimizerJobsV1`.
- The dictionary itself is a registered store; each saved job is normalized to current optimizer job version 3.
- Explicit compatibility must preserve the existing v1/v2 -> v3 semantics: legacy `finishedW` / `finishedL` become Width / Height, and legacy `rotate` is converted to current `grainFlowRotation` meaning.
- Job-number dictionary keys must continue to match normalized job metadata.

### Preferences

Theme, last tool, quick-reference table, and quick-reference decimal/fraction display are registered string stores with schema version 1 and strict validators. Invalid preference strings use safe in-memory defaults while retaining the original raw value until a protected intentional overwrite.

## Backup schema version 2

Full backup advances from schema version 1 to schema version 2.

Schema v2 remains human-readable and keeps the existing high-level sections, but restore normalization delegates persistent store validation to the central registry rather than maintaining a separate parallel interpretation.

A v1 full-backup migration converts the existing v1 sections to the v2 normalized representation. It must preserve all currently restorable data. Running Task Logging timers and Shift Schedule runtime state keep the current safe-restore semantics: running task time is finalized and restored Shift Schedule clock state is reset to clocked out.

`normalizeFullBackupForRestore` accepts v1 and v2. A future backup schema remains a hard error with no storage mutation.

## Import behavior

Feature-specific portable imports continue to accept their historical formats through the same feature migration/normalization functions used by persistent loading. Destructive imports continue to require the existing automatic full recovery snapshot before replacement.

There must not be separate rules where startup accepts one shape but import/backup restore accepts another equivalent shape.

## Error handling

The storage engine must distinguish:

- missing data: normal default, no warning
- valid current data: load normally
- valid older data: migrate in memory, preserve original raw bytes until protected upgrade write
- corrupt data: safe in-memory fallback, preserve raw bytes, report issue
- unsupported/future schema: safe in-memory fallback, preserve raw bytes, report issue
- storage read failure: report issue and do not pretend the store is missing
- storage write failure: report failure; never claim data was saved
- recovery-vault failure before risky overwrite: refuse overwrite

No catch block may silently convert corrupt structured user data into an empty persisted dataset.

## Public API

The exact implementation may use different internal helpers, but the central layer must provide equivalent capabilities to:

```js
registerPersistentStore(definition)
loadPersistentStore(id)
writePersistentStore(id, value, options)
getPersistentStoreDefinition(id)
listPersistentStores()
getPersistentStorageIssues()
normalizePersistentStoreValue(id, rawValue, options)
```

The backup layer uses store ids/definitions from this registry rather than hard-coding a second list of localStorage keys.

## Verification

Add a permanent storage/migration verifier to `npm run verify`, plus Playwright coverage.

Required fixture cases:

1. **Current data** — each registered structured store loads and round-trips current schema data.
2. **Old data** — explicit old fixtures migrate to current in memory, including Notes v1 -> v2 and Optimizer v1/v2 -> v3 behavior.
3. **Corrupt data** — corrupt JSON or invalid records remain unchanged in localStorage, safe fallback loads, and an issue is reported.
4. **Missing data** — missing keys produce normal defaults without creating or mutating storage.
5. **Imported old backup versions** — a full backup schema v1 fixture restores successfully through the v1 -> v2 backup migration.
6. **Future data** — unsupported store or backup schema is rejected without mutation.
7. **Recovery protection** — first overwrite after a migrated/invalid load requires and creates a raw recovery record; failure to protect blocks the write.
8. **Read-only verification** — `npm run verify` must still leave tracked files unchanged.
9. **Existing regression suite** — all existing Playwright tests remain green.

## Release / changelog

After the implementation and regression suite are green:

- keep `package.json` public version at `1.0.4`
- keep `release.json.version` at `1.0.4`
- keep `release.json.previousVersion` at `1.0.3`
- advance `release.json.buildNumber` to `1000007`
- append an audit #10 entry to the existing 1.0.4 changelog without removing or rewriting previous 1.0.4 entries
- build and verify the permanently signed Android APK and iPhone IPA

## Non-goals

- No localStorage key renames.
- No cloud sync.
- No conversion to IndexedDB for primary app data.
- No feature redesign.
- No changes to calculation logic, timer semantics, optimizer algorithms, or user-visible workflows except storage error reporting needed to prevent silent loss.
