# Fabri-Cadabra Canonical Source Refactor Design

**Date:** 2026-08-30

## Purpose

Refactor the current Fabrication Pro / Fabri-Cadabra web application so every piece of UI, styling, application behavior, native compatibility behavior, and verification logic has exactly one authoritative source. Remove the runtime enhancement architecture that keeps legacy markup active and then replaces it with JavaScript.

This is a structural refactor, not a product rewrite. Existing calculations, optimizer behavior, saw behavior, task timing semantics, notes, checklist behavior, import/export formats, localStorage data, and native signing identity must remain compatible.

## Current Problem

The live app currently has overlapping ownership:

- `www/index.html` contains the legacy `Fabrication Calculators` title, legacy `.tool-menu`, all core styles, all core markup, and the primary application script.
- `www/fabri-cadabra.js` injects new styles, renames the application, removes the legacy menu at runtime, constructs the Pages drawer, constructs the Basic Calculator markup, constructs the Calculator Guide markup, and owns calculator behavior.
- `www/native-compat.js` performs native Blob-export compatibility work and also dynamically loads `fabri-cadabra.js`.
- `source/fabrication_pro.original.html` duplicates the full application as a frozen source copy.
- `verify-web.mjs` and `verify-features.mjs` intentionally enforce the frozen-source-plus-runtime-enhancement architecture.

The result works, but it creates stale code paths and makes future maintenance require understanding which file contains the original definition and which file overrides it.

## Design Principle

**One responsibility, one authoritative source.**

No live UI element may be defined in one file and then deleted/replaced by another file at startup. No compatibility layer may act as an application module loader. No duplicate full copy of the application will remain in the active project tree. Historical source remains recoverable from Git history instead of being duplicated in the repository.

## Target Architecture

```text
fabrication_pro_capacitor/
├── capacitor.config.json
├── package.json
├── README.md
├── docs/
├── scripts/
│   ├── android-signing.mjs
│   ├── ios-privacy.mjs
│   ├── native-init.mjs
│   ├── verify-android-signing.mjs
│   ├── verify-features.mjs
│   ├── verify-ios-privacy.mjs
│   ├── verify-native-shim.mjs
│   └── verify-web.mjs
└── www/
    ├── index.html
    ├── styles.css
    ├── app.js
    ├── calculator.js
    └── native-compat.js
```

### `www/index.html`

Authoritative source for document structure and user-facing markup.

It will contain:

- document title `Fabri-Cadabra`
- visible `Fabri-Cadabra` brand heading
- existing top bar/theme control
- fixed Pages button
- Pages drawer and all nine page choices
- all existing tool panels
- Basic Calculator panel
- Calculator Guide drawer
- required backdrops and accessibility attributes
- direct script/style references

It will not contain:

- the legacy `.tool-menu`
- runtime-generated calculator markup
- runtime-generated Pages drawer markup
- inline application JavaScript
- inline application CSS
- a duplicate legacy title that is replaced later

### `www/styles.css`

Authoritative source for all application CSS.

The existing inline stylesheet will be moved here without behavioral restyling. Calculator and Pages drawer styles currently injected from `fabri-cadabra.js` will be incorporated directly. CSS that only supported the removed legacy `.tool-menu` will be deleted.

The refactor must not intentionally redesign the application. Any CSS cleanup must preserve the current rendered behavior unless a rule is provably unused because its owning markup is being removed.

### `www/app.js`

Authoritative source for the established application behavior currently embedded in `index.html`.

It will retain all existing fabrication logic, including:

- Aluminum Overhang
- Fastener Spacing
- Material Optimizer
- Saw Optimizer
- Task Logging
- Fabricator Notes
- Checklist
- Quick Reference
- theme handling
- drawer utilities shared by existing tools
- application self-tests
- page activation for established tools

The existing functions should be moved with minimal semantic edits. This refactor is not permission to rewrite formulas, packing algorithms, import schemas, timer logic, or saved-data models.

### `www/calculator.js`

Authoritative source for Basic Calculator behavior only.

It will own:

- calculator state
- arithmetic behavior
- repeated equals
- contextual percentage behavior
- memory operations
- roots/powers/rounding
- CE/AC behavior
- keyboard behavior
- calculator guide open/close behavior if it is calculator-specific

It will consume static calculator markup already present in `index.html`. It must not generate application markup or inject styles.

Calculator memory remains session-only. The existing `fabricationTool=calculator` page-selection persistence remains supported.

### `www/native-compat.js`

Authoritative source for Capacitor-specific compatibility behavior only.

It will retain the native Blob-download interception used for JSON exports and will continue to preserve the original Blob bytes and filenames.

It will no longer:

- load `fabri-cadabra.js`
- inject application modules
- rename the application
- create UI
- contain non-native product behavior

Browser behavior must remain the normal browser download path.

## Navigation Architecture

The current enhancement layer depends on detached legacy `.tool-tab` buttons and triggers their old click handlers to activate pages. That indirection will be removed.

The canonical page model will include exactly these tool identifiers:

- `overhang`
- `fasteners`
- `optimizer`
- `saw`
- `tasklog`
- `notes`
- `checklist`
- `reference`
- `calculator`

A single activation path will:

1. validate the requested tool identifier,
2. activate only the matching `.tool-panel`,
3. update the active state in the Pages drawer,
4. write the same `fabricationTool` localStorage value used today,
5. close the Pages drawer when selection originated there,
6. preserve the current scroll-to-top behavior when changing pages.

Startup will read `fabricationTool`, restore any valid saved page including `calculator`, and fall back to `overhang` for missing/invalid values.

There will be no hidden or detached legacy navigation elements.

## Drawer Architecture

Existing drawers already share the `cut-list-drawer` visual system. The Pages drawer and Calculator Guide drawer will remain consistent with that system.

Shared open/close behavior may remain in `app.js` when it is generic and used by multiple features. Calculator-specific guide event wiring may live in `calculator.js`. Ownership must be clear: generic drawer mechanics in one place, feature-specific controls in the feature owner.

Escape-key behavior must preserve current priority:

1. close an open Pages drawer,
2. close an open Calculator Guide drawer,
3. when no drawer is open and Calculator is active, Escape clears the calculator.

## Persistence and Upgrade Compatibility

No existing user should lose saved data after installing an updated APK or loading the updated web application.

### Required guarantees

- Do not rename existing localStorage keys.
- Do not change serialized JSON schema formats unless a separate migration is explicitly designed and approved.
- Do not clear storage during startup or migration.
- Preserve `fabricationTool` and its current values; add no new page-key namespace.
- Preserve Task Logging timer semantics based on persisted timestamps (`running`, `startedAt`, `accumulatedMs`) so timers remain correct across screen lock, backgrounding, app restart, and navigation.
- Preserve the existing native export bridge behavior: JSON bytes generated by application code must not be rewritten by the bridge.
- Preserve import behavior and compatibility with files generated by previous versions.

### Verification requirement

Before deleting the frozen original, the refactor will programmatically inventory persistence-related identifiers and protected import/export format markers from the current baseline. The post-refactor verification suite must assert that those required keys/markers still exist in the canonical source.

At minimum, known protected storage keys include:

- `fabricationTaskLogJobsV1`
- `fabricationTaskLogPresetsV1`
- `fabricationChecklistV1`
- `fabricationTool`

The implementation plan must expand this inventory from the full baseline source before source deletion.

## Native Identity and Signing

The application remains the same installable Android/iOS application.

Must remain unchanged:

- Capacitor application ID: `com.fabricationpro.app`
- Android permanent signing certificate SHA-256: `5769bbe5a1f4fdccd985fd0145495f3614e0db41992871c99b9eb361634bb586`
- existing GitHub signing-secret names and signing workflow contract

The visible/native app display name will be normalized to `Fabri-Cadabra` in `capacitor.config.json`, because that is the current product name. This must not alter the application ID or Android signing identity.

## Files to Remove

After their valid functionality has been migrated and verified, delete:

- `www/fabri-cadabra.js`
- `source/fabrication_pro.original.html`
- `SOURCE_SHA256.txt`

If the `source/` directory becomes empty, it disappears naturally from Git.

Deletion happens only after the new canonical source passes local verification on the refactor branch.

Git history is the archival source for the old application; the active tree will not carry a second full application copy.

## Verification Redesign

The current verification suite enforces the architecture being removed. It must be replaced with checks for the canonical architecture.

### `verify-web.mjs`

Will verify:

- `www/index.html` exists and directly references `styles.css`, `app.js`, `calculator.js`, and `native-compat.js`
- no inline application `<style>` block remains
- no large inline application `<script>` block remains
- `app.js`, `calculator.js`, and `native-compat.js` parse successfully
- the live HTML directly contains `Fabri-Cadabra`
- the legacy `Fabrication Calculators` heading and `.tool-menu` markup are absent
- `fabri-cadabra.js` is not referenced
- `native-compat.js` does not dynamically load feature scripts

### `verify-features.mjs`

Will verify structural and compatibility contracts rather than implementation hacks:

- all nine canonical page identifiers exist exactly once in navigation
- all nine corresponding tool panels exist
- Basic Calculator static controls exist
- Calculator Guide static sections exist
- Pages drawer static markup exists
- calculator behavior markers exist in `calculator.js`
- page activation and `fabricationTool` restoration exist in canonical logic
- protected persistence keys and import/export format markers remain present
- forbidden legacy architecture markers are absent (`originalNav.remove()`, dynamic `script.src = 'fabri-cadabra.js'`, runtime calculator-panel construction, runtime title replacement)

### `verify-native-shim.mjs`

Will verify only native-compatibility responsibilities, including Blob byte preservation and browser/native behavior. It will no longer expect the shim to load application enhancements.

### Existing platform verification

The following remain required and must continue passing:

- iOS privacy verification
- Android signing workflow verification
- application self-tests embedded in the established logic
- Android release build
- `apksigner` certificate verification
- iOS build
- GitHub Pages deployment

## Documentation

Update `README.md` and any affected installation/development documentation to describe the new source ownership model.

Documentation must clearly state:

- edit `www/index.html` for markup/copy
- edit `www/styles.css` for styling
- edit `www/app.js` for existing fabrication-tool behavior
- edit `www/calculator.js` for calculator behavior
- edit `www/native-compat.js` only for native export compatibility
- run `npm run verify` before builds

Remove language claiming the original HTML is frozen or that the live app may only differ by a compatibility script include.

Package description/product naming should be normalized to Fabri-Cadabra where it is user/developer-facing while retaining compatibility-sensitive identifiers.

## Migration Sequence

The implementation must be performed in checkpoints that preserve a reviewable working state:

1. Add failing architecture-verification checks that describe the target ownership model.
2. Extract inline CSS to `styles.css` without changing rules.
3. Extract inline application JavaScript to `app.js` without changing behavior.
4. Move Fabri-Cadabra title, Pages drawer, calculator, and guide markup into `index.html`.
5. Consolidate page activation into the canonical navigation path and remove detached-button indirection.
6. Move calculator behavior to `calculator.js` and eliminate runtime markup/style injection.
7. Reduce `native-compat.js` to native compatibility only.
8. Run compatibility/self-tests before removing legacy source files.
9. Delete `fabri-cadabra.js`, frozen original source, and obsolete hash file.
10. Update verification and documentation to reflect final ownership.
11. Run the complete verification/build/deployment pipeline.

Each checkpoint must be independently reviewed and committed. If a checkpoint causes a behavioral regression, fix that checkpoint before continuing rather than layering another compatibility override on top.

## Testing Strategy

### Static architecture tests

Assert canonical files exist, legacy files do not, and prohibited runtime-replacement patterns are absent.

### Syntax tests

Parse all shipped JavaScript files before native build generation.

### Behavioral self-tests

Continue running existing fabrication self-tests after extraction. These are particularly important for optimizer geometry and migration behavior.

### Persistence regression tests

Compare the baseline and refactored persistence/import/export marker inventory. Confirm the same storage keys and format identifiers remain reachable from canonical application code.

### Navigation regression tests

Test valid saved page restoration, invalid saved page fallback, active panel uniqueness, and calculator restoration.

### Calculator regression tests

Preserve tests/markers for:

- arithmetic
- divide-by-zero error
- repeated equals
- omitted second operand
- contextual percentages
- memory add/subtract/recall/clear
- square root validation
- power
- R2/R0
- CE versus AC
- Backspace/Delete keyboard parity
- Escape behavior with drawers versus calculator clear

### Native regression tests

Continue the Blob byte-preservation test and signing/packaging validation.

## Release Acceptance Criteria

The refactor is complete only when all of the following are true on the final `main` commit:

1. The active project tree contains no duplicate full legacy application source.
2. `www/fabri-cadabra.js` no longer exists.
3. No live UI is created solely to replace stale live UI at startup.
4. `native-compat.js` contains only native compatibility responsibilities.
5. `npm run verify` passes.
6. Existing application self-tests pass.
7. GitHub Pages deployment succeeds.
8. Android release build succeeds.
9. Android APK verifies with permanent certificate SHA-256 `5769bbe5a1f4fdccd985fd0145495f3614e0db41992871c99b9eb361634bb586`.
10. iOS build succeeds.
11. A fresh signed Android APK artifact is downloaded and its checksum is reported.
12. Existing persisted user data/import files remain compatible by design and verification.
13. `com.fabricationpro.app` remains unchanged.
14. Product-facing name is consistently `Fabri-Cadabra`.

## Non-Goals

This refactor will not:

- redesign the visual interface beyond moving the currently approved UI into canonical markup/CSS
- change fabrication formulas
- change optimizer heuristics or geometry algorithms
- change task timer semantics
- change import/export schemas
- migrate localStorage to a different storage technology
- introduce a frontend framework or build system
- split every existing fabrication tool into a separate module in this pass
- change the application ID or signing key

Those may be considered separately after the canonical source architecture is stable.

## Rollback Strategy

All work occurs on `refactor/canonical-source` until verification is green. `main` remains the known-good release during development.

The refactor will be merged through a pull request only after the branch passes the full verification/build pipeline. If a post-merge deployment issue appears, Git history provides the exact prior release commit for rollback without relying on duplicate source files in the active tree.

## Definition of Professional Completion

The project should be easier for a developer to understand after this work than before it. A developer should be able to answer “where do I edit this?” by responsibility, not by knowing which runtime patch wins.

The final architecture must favor direct definitions, explicit script/style ownership, compatibility tests, and small responsibility boundaries over clever runtime replacement techniques.