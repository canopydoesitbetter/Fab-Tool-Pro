# 1.0.8 Maintenance Integrity Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix full-backup coverage for Fastener Spacing, update stale architecture documentation, and decouple Saw Optimizer label validation from the Sheet Optimizer constant without changing 1.0.8 behavior elsewhere.

**Architecture:** Keep the existing central persistent-store registry and backup schema v2. Extend the full-backup bridge with a `fastenerSpacing` section and normalize it on restore while treating the field as optional for older v2 backups. Keep the 15-module runtime architecture unchanged; documentation is updated to match it. Saw Optimizer receives a local 120-character limit constant and a static regression guard.

**Tech Stack:** Vanilla HTML/CSS/JavaScript, Node.js verification scripts, Playwright E2E tests, Capacitor 8.5.0, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-16-maintenance-integrity-design.md`

## Global Constraints

- Package/app version remains `1.0.8`.
- Build number remains `1000017`.
- Capacitor app ID remains `com.fabricationpro.app`.
- Full backup schema remains version 2 and older schema-v2 backup files remain restorable.
- Existing storage keys and feature-specific JSON formats remain unchanged.
- Production behavior changes require a failing regression test before implementation.

---

### Task 1: Lock Fastener Spacing full-backup behavior

**Files:**
- Modify: `fabrication_pro_capacitor/tests/e2e/backup-restore.spec.mjs`

**Interfaces:**
- Consumes: `window.FabriCadabraApp.backup`, Settings full-backup UI, `fabricationFastenerSpacingV1` store.
- Produces: Regression proof that current Fastener Spacing workspace state is exported and restored.

- [ ] **Step 1: Write the failing browser regression**

Add `fabricationFastenerSpacingV1` to the app-owned key snapshot, create a Fastener Spacing fixture with Max Spacing `24`, Length `100`, Corner Tolerance `2`, and one completed fastener, assert the downloaded full backup contains a `sections.fastenerSpacing` record with those values, then after clearing storage and restoring the backup assert the Fastener Spacing UI and completion state are restored.

- [ ] **Step 2: Run the browser regression and verify RED**

Run through the existing GitHub Actions browser-regression gate on the `work` branch.

Expected: the new test fails because `sections.fastenerSpacing` is currently absent from `buildFullBackup()`.

- [ ] **Step 3: Do not touch production backup code until the failure is confirmed**

The observed failure must be specifically caused by the missing Fastener Spacing backup section, not test setup or navigation errors.

---

### Task 2: Implement Fastener Spacing full-backup/restore support

**Files:**
- Modify: `fabrication_pro_capacitor/www/app/import-export.js`
- Modify: `fabrication_pro_capacitor/scripts/verify-backup-restore.mjs`

**Interfaces:**
- Consumes: registered store id `fastenerSpacing`, `normalizeBackupStore()`, `serializePersistentStoreValue()`.
- Produces: `sections.fastenerSpacing` in new full backups and `fabricationFastenerSpacingV1` in normalized restore storage when present.

- [ ] **Step 1: Add the current Fastener Spacing state to `buildFullBackup()`**

Read the registered store through its existing central persistence definition and normalize the current localStorage value. If the key is missing, use the store default. Emit that normalized value as `sections.fastenerSpacing`.

- [ ] **Step 2: Restore Fastener Spacing when the section exists**

In `normalizeFullBackupForRestore()`, keep the existing six required legacy sections unchanged for schema-v2 compatibility. If `sections.fastenerSpacing` is present, normalize it with `normalizeBackupStore('fastenerSpacing', ...)` and serialize it into the replacement storage map. If it is absent, do not synthesize a required section; transactional restore will clear the key to its normal default state as older backups historically imply.

- [ ] **Step 3: Strengthen the static backup verifier**

Require `buildFullBackup()` to include Fastener Spacing and require restore normalization/serialization markers for `fastenerSpacing`, while retaining the central 11-store registry checks.

- [ ] **Step 4: Run verification and browser regression and verify GREEN**

Run `npm run verify` and `npm run test:e2e` through the repository CI gate. The new full-backup regression must pass along with all existing tests.

---

### Task 3: Decouple Saw Optimizer label validation

**Files:**
- Modify: `fabrication_pro_capacitor/scripts/verify-features.mjs`
- Modify: `fabrication_pro_capacitor/www/app/saw-optimizer.js`

**Interfaces:**
- Consumes: existing Saw label behavior and 120-character accepted limit.
- Produces: Saw-owned constant `MAX_SAW_LABEL_LENGTH = 120` used by both import normalization and add-part validation.

- [ ] **Step 1: Add a failing static regression guard**

Extend `verify-features.mjs` so verification requires `const MAX_SAW_LABEL_LENGTH = 120;` in the Saw Optimizer module and rejects Saw Optimizer source that contains `MAX_OPTIMIZER_LABEL_LENGTH`.

- [ ] **Step 2: Run `npm run verify:features` and verify RED**

Expected: verification fails because Saw Optimizer still references the Sheet Optimizer constant.

- [ ] **Step 3: Add the Saw-owned constant and replace both Saw references**

Define `MAX_SAW_LABEL_LENGTH = 120` beside the other Saw limits. Use it in Saw import validation and UI add-part validation/message. Do not change the accepted limit or JSON format.

- [ ] **Step 4: Run `npm run verify:features` and verify GREEN**

Expected: the static contract passes with the same 120-character runtime behavior.

---

### Task 4: Correct README architecture documentation

**Files:**
- Modify: `fabrication_pro_capacitor/README.md`

**Interfaces:**
- Consumes: `scripts/app-module-manifest.mjs` canonical 15-module load order.
- Produces: Documentation that accurately identifies `www/index.html`, `www/styles.css`, each responsibility group under `www/app/`, `www/backup.js`, `www/calculator.js`, and `www/native-compat.js`.

- [ ] **Step 1: Replace stale `www/app.js` ownership language**

Document the modular architecture and explicitly state there is no duplicate frozen application file or runtime enhancement layer replacing stale markup.

- [ ] **Step 2: Update verification/development wording**

Ensure references to canonical product source point to the modular files under `www/` and do not instruct maintainers to edit the removed monolithic `app.js`.

- [ ] **Step 3: Verify documentation against `scripts/app-module-manifest.mjs`**

Confirm all 15 module names in the manifest are represented accurately by the README's ownership description.

---

### Task 5: Full release-gate verification and integration

**Files:**
- No new production files beyond Tasks 1-4.

**Interfaces:**
- Consumes: completed maintenance patch on `work`.
- Produces: verified fast-forward candidate for `main`.

- [ ] **Step 1: Run the full static verification gate**

Run `npm run verify` in GitHub Actions and require exit code 0.

- [ ] **Step 2: Run the complete Playwright browser suite**

Run `npm run test:e2e` in GitHub Actions and require zero failures.

- [ ] **Step 3: Confirm release identity did not change**

Verify `package.json` remains `1.0.8`, `release.json` remains build `1000017`, and `capacitor.config.json` remains `com.fabricationpro.app`.

- [ ] **Step 4: Compare `main...work`**

Review the final changed-file list and ensure it is limited to the maintenance spec, plan, regression tests/verifiers, backup bridge, Saw Optimizer, and README.

- [ ] **Step 5: Fast-forward `main` to the verified `work` head**

Only after the green release gates and final diff review, update `main` to the verified `work` commit without force.

- [ ] **Step 6: Confirm `main` and `work` are aligned**

Fetch both branch heads and require identical commit SHAs.
