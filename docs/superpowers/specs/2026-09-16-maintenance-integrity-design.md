# 1.0.8 Maintenance Integrity Fixes

## Goal

Correct three issues found during the full Fabri-Cadabra 1.0.8 review without changing the app version or unrelated behavior.

## Scope

### 1. Full Backup / Restore must include Fastener Spacing

Fastener Spacing is already a registered persistent store (`fastenerSpacing`, key `fabricationFastenerSpacingV1`) and its in-app persistence works across reloads. The full-backup bridge must now serialize this workspace and full restore must normalize and restore it.

The current full-backup schema remains version 2. Existing schema-v2 backups that predate this field must remain restorable. When an older backup has no Fastener Spacing section, restore may leave the replacement value absent so the transactional restore clears that app-owned key to its normal default state. New backups must include the Fastener Spacing state.

Regression coverage must prove that a non-default Fastener Spacing workspace—including inputs and a completed-fastener selection—is present in the downloaded full backup and is restored after app storage is cleared.

### 2. README architecture must match the shipped module layout

The README still describes `www/app.js` as the canonical application source. Update the canonical source map and surrounding text to describe the current 15-module `www/app/` architecture plus `www/backup.js`, `www/calculator.js`, and `www/native-compat.js`. Do not reintroduce a duplicate/frozen application source.

### 3. Saw Optimizer must own its label-length limit

Saw Optimizer currently validates labels using the Sheet Optimizer constant `MAX_OPTIMIZER_LABEL_LENGTH`. Introduce a Saw-owned constant with the same existing limit of 120 characters and use it for Saw import validation and Saw UI add-part validation. This is a maintenance decoupling only; the accepted Saw label length must not change.

Add a static regression contract that fails if Saw Optimizer again depends on `MAX_OPTIMIZER_LABEL_LENGTH`.

## Constraints

- Keep package/app version at `1.0.8` and build number `1000017`.
- Keep Capacitor app ID `com.fabricationpro.app` unchanged.
- Preserve all existing storage keys and feature-specific import/export formats.
- Preserve backup schema version 2 compatibility.
- Follow test-first red/green verification for behavior/code fixes.
- Run the repository verification and browser regression gates before moving the patch to `main`.
