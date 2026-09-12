# Release Version Continuity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Present all post-1.0.3 work as Fabri-Cadabra 1.0.4 while keeping native upgrade numbers monotonic and permanently preventing skipped public versions.

**Architecture:** Separate public semantic version from native build number using `release.json`. Keep package/browser/native marketing versions synchronized to 1.0.4, while Android/iOS native build metadata uses independent build 1000006. Add a release-continuity verifier and repair the changelog from audited Git history.

**Tech Stack:** Node.js 22 ESM scripts, vanilla HTML/JavaScript, Capacitor 8, Android Gradle, Xcode/iOS, GitHub Actions, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-12-release-version-continuity-design.md`

## Global Constraints

- Public version: `1.0.4`.
- Native build number: `1000006`.
- Previous public release: `1.0.3`.
- App ID remains `com.fabricationpro.app`.
- No storage key/schema/data/functionality changes.
- Existing permanent Android signing identity is preserved.
- `npm run verify` must remain read-only.

---

### Task 1: Define the release-continuity regression contract

**Files:**
- Create: `fabrication_pro_capacitor/scripts/verify-release-continuity.mjs`
- Modify: `fabrication_pro_capacitor/package.json`

**Interfaces:**
- Consumes: `release.json`, `package.json`, browser source, `www/index.html`, version sync scripts, installer workflow.
- Produces: `npm run verify:release`, included in aggregate `npm run verify`.

- [ ] **Step 1: Write the failing verifier**
  Require explicit release metadata, public-version/changelog continuity, independent native build numbers, and installer checks.
- [ ] **Step 2: Wire `verify:release` into aggregate verification**
  Place it before the existing app-version verifier.
- [ ] **Step 3: Run CI and prove RED**
  Expected failure: current repository lacks the new release metadata/explicit 1.0.4 continuity contract.
- [ ] **Step 4: Commit the RED test**

### Task 2: Decouple public version from native build number

**Files:**
- Create: `fabrication_pro_capacitor/release.json`
- Modify: `fabrication_pro_capacitor/package.json`
- Modify: `fabrication_pro_capacitor/package-lock.json`
- Modify: `fabrication_pro_capacitor/scripts/app-version.mjs`
- Modify: `fabrication_pro_capacitor/scripts/sync-app-version.mjs`
- Modify: `fabrication_pro_capacitor/scripts/verify-app-version.mjs`
- Modify: `.github/workflows/build-phone-installers.yml`

**Interfaces:**
- Produces: public version `1.0.4`; native build `1000006`.

- [ ] **Step 1: Add release metadata and set package version to 1.0.4**
- [ ] **Step 2: Change Android sync to accept explicit build number**
  Android output: `versionName "1.0.4"`, `versionCode 1000006`.
- [ ] **Step 3: Change iOS sync to use marketing version plus independent build number**
  iOS output: `MARKETING_VERSION = 1.0.4`, `CURRENT_PROJECT_VERSION = 1000006`.
- [ ] **Step 4: Update app-version fixtures and installer artifact checks**
- [ ] **Step 5: Run focused version/release verifiers until GREEN**

### Task 3: Repair the 1.0.4 changelog from audited history

**Files:**
- Modify: `fabrication_pro_capacitor/www/index.html`
- Modify: `fabrication_pro_capacitor/www/app/bootstrap.js`
- Modify: `fabrication_pro_capacitor/scripts/verify-settings-changelog.mjs`

**Interfaces:**
- Consumes: audited history after commit `5e0edc305f846885774a2aa2d3591f52dfbb3e84`.
- Produces: explicit 1.0.4 current release entry followed by unchanged 1.0.3, 1.0.2, 1.0.1, 1.0.0 entries.

- [ ] **Step 1: Replace generic current/1.0.5 changelog entry with explicit 1.0.4 entry**
  Include Full Backup & Recovery, final native branding/startup work, canonical-source cleanup, 15-module split, browser/CI regression coverage, read-only verification, and version-continuity safeguards.
- [ ] **Step 2: Preserve the 1.0.3 entry unchanged**
- [ ] **Step 3: Update browser version marker to 1.0.4**
- [ ] **Step 4: Strengthen changelog verification for exact version ordering and required 1.0.4 concepts**

### Task 4: Full verification and safe release

**Files:**
- No application-data files are modified in this task.

- [ ] **Step 1: Run `npm run verify` and prove the tracked tree stays unchanged**
- [ ] **Step 2: Run Playwright**
- [ ] **Step 3: Build signed Android APK on `work` and verify package/version/build/signing metadata**
- [ ] **Step 4: Build iOS IPA on `work` and verify bundle/version/build metadata**
- [ ] **Step 5: Review the complete diff against the pre-change head for accidental feature/storage changes**
- [ ] **Step 6: Fast-forward exact tested head to `main`**
- [ ] **Step 7: Verify production Pages, read-only check, Playwright, Android, and iOS on `main`**
- [ ] **Step 8: Download and deliver the fresh signed `1.0.4` / build `1000006` APK**
