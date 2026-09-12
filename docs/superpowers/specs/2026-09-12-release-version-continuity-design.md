# Release Version Continuity Design

## Goal

Repair Fabri-Cadabra's public release history so all work after the completed 1.0.3 boundary is presented as release 1.0.4, while preserving safe native upgrade behavior and preventing skipped public versions in future releases.

## Non-Negotiable Constraints

- Public version after this repair is `1.0.4`.
- Existing installed app data and functionality must not be changed, migrated, cleared, renamed, or reset by this release-history repair.
- Capacitor app ID remains exactly `com.fabricationpro.app`.
- Android signing identity remains the existing permanent certificate.
- Existing storage keys, schemas, import/export formats, calculations, Task Logging timers, Notes, Checklist, optimizers, Shift Schedule, and backup formats remain unchanged.
- The already-shipped Android `1.0.5` build used versionCode `1000005`; the repaired `1.0.4` release must therefore use a higher hidden build number, `1000006`, so installation is an upgrade rather than a downgrade.
- iOS must likewise expose marketing version `1.0.4` while using build number `1000006`.
- `npm run verify` remains read-only.

## Release Metadata Architecture

Add `fabrication_pro_capacitor/release.json` as explicit release metadata:

```json
{
  "version": "1.0.4",
  "buildNumber": 1000006,
  "previousVersion": "1.0.3"
}
```

`package.json.version` remains the canonical public/package semantic version and must match `release.json.version`. `release.json.buildNumber` is the monotonic native install/build number and is intentionally independent from the public semantic version.

The browser-visible version, Android `versionName`, and iOS `MARKETING_VERSION` use `version`. Android `versionCode` and iOS `CURRENT_PROJECT_VERSION` use `buildNumber`.

## Changelog Repair

Use commit `5e0edc305f846885774a2aa2d3591f52dfbb3e84` as the completed 1.0.3 boundary. Its `package.json` is 1.0.3 and it contains the completed Task Logging rename work already documented in the 1.0.3 changelog.

The 1.0.4 changelog must summarize the finished outcomes of all meaningful work after that boundary, using Git history rather than memory. It must include:

1. **Full Backup & Recovery**
   - Settings-based full-app JSON backup.
   - Validated full restore with confirmation.
   - Automatic recovery snapshots stored separately in IndexedDB before full restore and destructive imports.
   - Recovery restore capability.
   - Transactional localStorage replacement with rollback on write failure.
   - Protection around Task Logging Jobs/Presets, Fabricator Notes, Checklist, and Sheet Optimizer replacement imports.

2. **Native Branding & Startup**
   - Exact approved Fabri-Cadabra launcher icon on Android and iPhone, replacing Capacitor launcher branding.
   - Exact approved branded launch/splash artwork.
   - Final portrait Android splash handling and reduced native splash-resource bloat while retaining full branded artwork.
   - Repeatable branding in the native installer pipeline.

3. **Reliability & Maintainability**
   - Removed the retired runtime UX patch layer and consolidated canonical UI behavior/styles.
   - Split the former 6,600+ line `www/app.js` monolith into 15 ordered feature modules without changing data formats or app behavior.
   - Added/expanded Playwright and source-level regression coverage for critical workflows.
   - Made aggregate verification read-only and added CI proof that verification leaves tracked files unchanged.
   - Decoupled public semantic versions from native build numbers and added release-continuity verification so public versions cannot be silently skipped again.

The existing 1.0.3 entry remains unchanged and is not duplicated into 1.0.4.

## Permanent Release Guard

Add a release-continuity verifier to the aggregate verification suite. It must fail when:

- `release.json` is missing or invalid.
- `package.json.version` differs from `release.json.version`.
- browser version marker differs from the public version.
- changelog current release version differs from the public version.
- `previousVersion` is not the immediately preceding patch release for the same major/minor line.
- the next changelog entry is not `previousVersion`.
- changelog versions are duplicated or not newest-first.
- `buildNumber` is not a positive integer or is below the protected floor `1000006`.
- Android/iOS synchronization or installer verification still derives native build numbers from the public semantic version.

The current release entry should use an explicit `data-changelog-version='1.0.4'` rather than the generic `current` marker.

## Verification and Release Gate

Before promotion to `main`:

- Demonstrate RED: new release-continuity verifier fails against the current 1.0.5 / generic-current / coupled-build state.
- Demonstrate GREEN: full `npm run verify` passes and leaves tracked files unchanged.
- Run full Playwright browser regression suite.
- Build Android and verify `package=com.fabricationpro.app`, `versionName=1.0.4`, `versionCode=1000006`, and permanent signing fingerprint.
- Build iOS IPA and verify `CFBundleIdentifier=com.fabricationpro.app`, `CFBundleShortVersionString=1.0.4`, `CFBundleVersion=1000006`.
- Fast-forward only the exact tested `work` head to `main`.
- Re-run production web, read-only, browser, Android, and iOS workflows on `main`.
