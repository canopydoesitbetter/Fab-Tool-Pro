# Remove Runtime UX Patch / Override Architecture — Design

## Status
Approved direction for Audit Item #3.

## Production Baseline
- Repository: `canopydoesitbetter/Fab-Tool-Pro`
- App folder: `fabrication_pro_capacitor/`
- Baseline commit: `d6971c9b80058907be4f3e3f6b2b08ee21957d4c`
- App ID: `com.fabricationpro.app` (must not change)
- Package version: `1.0.5`
- Existing browser regression suite: 28 Playwright tests, required before Android/iOS builds

## Problem
`www/ux.js` and `www/ux.css` currently form a second UI implementation layered on top of the canonical app. `ux.js` performs post-render DOM relocation, rewrites Task Logging controls after render, uses a `MutationObserver` to keep those rewrites alive, injects the Settings/Changelog interface dynamically, and binds Notes/Shift Schedule behavior outside the primary application script. This makes the rendered UI depend on two scripts agreeing after load.

Audit Item #3 removes that split ownership. The browser must receive the final approved structure directly from `index.html`; application behavior must bind once from canonical code; final styles must live in the canonical stylesheet. No script should need to repair, relocate, or reinterpret already-rendered controls.

## Approved End State
1. `www/index.html` contains the final static markup for:
   - Task Logging status placement
   - Task Logging assigned-preset remove controls as rendered by the canonical renderer contract
   - Fabricator Notes Topics button in its final editor position
   - Settings page
   - Shift Schedule settings controls
   - Changelog backdrop/drawer and changelog content
   - Settings navigation entry at the bottom of the Pages drawer
2. `www/app.js` owns all runtime behavior currently split across `app.js` and `ux.js`:
   - Task Logging assigned-preset removal behavior
   - Notes Topics drawer behavior
   - Shift Clock presentation and confirmations
   - Shift Schedule settings form behavior
   - Settings navigation
   - Settings Changelog drawer behavior
   - browser-visible version wiring
3. `www/styles.css` owns the approved styles currently in `www/ux.css`.
4. `www/ux.js` and `www/ux.css` are deleted and removed from `index.html`.
5. No `MutationObserver` exists for Task Logging repair.
6. No app-owned element is relocated after initial page render.
7. Existing visible UI, persistence formats, business logic, navigation semantics, native identity, and import/export formats remain unchanged.

## Architecture and Ownership

### Canonical HTML
Static controls that always exist are authored directly in `index.html`. This includes Settings and Changelog markup that `ux.js` currently creates with `document.createElement()` / `innerHTML`, and the Notes Topics launcher that is currently moved with `insertBefore()`.

The current Task Logging and Notes status elements are moved in source markup to their intended final locations so there is no `moveStatusOutsideManagement()` runtime pass.

The Pages drawer contains the Settings footer/button in source markup. Settings becomes a normal tool panel known to the primary navigation system instead of temporarily overriding `getActiveTool()`.

### Canonical JavaScript
`app.js` becomes the single runtime owner for the current UI behavior. This migration must preserve the existing pure Shift Schedule engine and storage code without semantic changes.

The navigation model is extended cleanly so Settings participates in the same `selectTool()` mechanism as other pages while remaining visually separated at the bottom of the Pages drawer. `getActiveTool()` continues to report the actual selected page without monkey-patching itself at runtime.

Task Logging's preset renderer directly emits the correct assigned-row remove control. Assigned presets must never be emitted as delete-library buttons and then rewritten later. The click handler distinguishes library deletion from assigned-task removal directly from stable `data-*` attributes produced by the renderer.

Notes Topics drawer handlers are bound directly against final-source markup. No button relocation is performed.

Shift Clock and Shift Schedule settings UI functions move into the appropriate Shift Schedule section of `app.js`, using the existing `window.FabriCadabraApp.shiftSchedule` engine or, preferably during the merge, direct local function access where possible without changing public behavior. The existing `fabrication:shift-schedule-change` event remains unless removing it is clearly safe and covered by tests.

Settings/Changelog handlers reuse the existing shared drawer primitives (`openDrawer`, `closeDrawer`, focus trap, Escape, backdrop, return focus). No second drawer implementation is introduced.

### Canonical CSS
All selectors from `ux.css` that still describe approved UI are merged into `styles.css` near the related feature sections where practical. During migration, duplicate or obsolete rules are removed rather than copied blindly. The rendered appearance must remain unchanged to the extent covered by current browser tests and direct inspection.

`index.html` will load only `styles.css` for application styling.

## Browser Version Handling
`sync-app-version.mjs` currently writes a generated `FABRI_CADABRA_VERSION` constant into `ux.js`. Because `ux.js` is deleted, the generated browser-version marker moves to canonical code.

For this audit item, package.json remains the authoritative version source and the existing sync command remains behaviorally equivalent. The generated marker may live in `app.js`; Settings and the current Changelog entry will display that value from canonical markup/behavior. This audit does not attempt the later Audit #9 read-only-verification refactor.

## Changelog Handling
The changelog content is static product copy and does not need to be generated as a large JavaScript template at runtime. Move the existing changelog structure into `index.html` so it is present at initial render. `app.js` should only update the current-version display where required and manage drawer behavior.

This reduces executable UI construction now while leaving the broader Audit #14 changelog-data cleanup as a separate future item.

## Verification Script Migration
Current static verifiers encode the old patch architecture and must be rewritten to assert the new canonical architecture rather than deleted.

Required changes include:
- `verify-ux-polish.mjs`: verify final Notes Topics placement directly in `index.html`, final Task Logging status placement, canonical assigned-preset control semantics in `app.js`, and styles in `styles.css`; explicitly fail if runtime relocation or Task Logging `MutationObserver` repair returns.
- `verify-settings-changelog.mjs`: verify Settings/Changelog markup in `index.html`, navigation/behavior in `app.js`, styles in `styles.css`, generated version marker in canonical code, and newest-first changelog ordering without expecting `installSettingsPage()`.
- `verify-shift-schedule.mjs`: continue validating the Shift Schedule engine in `app.js`, but verify Shift Schedule markup in `index.html`, presentation/bindings in `app.js`, and styles in `styles.css` instead of `ux.js`/`ux.css`.
- Any other script that reads `ux.js` or `ux.css` must be updated to canonical files.
- Add an explicit architectural assertion that `index.html` does not include `ux.js` or `ux.css` and that those files are absent from the shipped `www/` tree.

## Behavioral Compatibility
The migration must preserve all currently approved user-visible behavior, including:
- Task Logging create/rename/delete jobs
- preset library creation/import/export
- add/remove assigned preset tasks without deleting the preset library entry
- timers, persistence, reload recovery, and one-active-timer behavior
- Notes create/edit/delete, rich text, topics drawer, import/export
- Checklist and all fabrication tools
- Shift Schedule enable/disable, time-entry normalization, Break/Lunch override behavior, Clock In/Out confirmations, exact-boundary reconciliation
- Settings access at the bottom of Pages
- Changelog drawer focus, backdrop, Escape, and return focus
- theme behavior
- desktop/mobile layouts

No storage key, JSON format, native app ID, signing configuration, or native branding asset is changed by this work.

## Testing Strategy
Implementation is migration-first and regression-guarded:
1. Update/add static architecture assertions before or alongside each migrated responsibility.
2. Run `npm run verify` after each migration block.
3. Run targeted Playwright specs for the feature being migrated.
4. Run the full 28-test Playwright suite after `ux.js`/`ux.css` removal.
5. Confirm no browser console errors caused by missing late-injected elements.
6. Confirm `MutationObserver` is not used to repair Task Logging behavior.
7. Confirm no relocation code (`insertBefore`, `after`, `appendChild` used to move existing UI controls after load) remains for the migrated interface.
8. Stage the exact verified commit to `work` and require Browser Regression Tests, Android, and iOS success.
9. Verify Android package/version/signing and iOS bundle/version.
10. Promote that exact staging SHA to `main`, verify the production installer workflow and Pages deployment, then mark Audit Item #3 complete.

## Implementation Sequence
1. Establish new canonical static markup in `index.html` while preserving IDs used by tests and behavior.
2. Merge approved `ux.css` rules into `styles.css` and remove duplicate/obsolete rules.
3. Move Task Logging assigned-preset semantics into the renderer/event handling in `app.js`; remove observer/rewriter logic.
4. Move Notes Topics drawer behavior into `app.js` against final markup.
5. Integrate Settings into primary navigation and move Settings/Changelog behavior into `app.js`.
6. Move Shift Clock and Shift Schedule form/presentation behavior into `app.js` without changing the existing schedule engine.
7. Move browser-version synchronization marker to canonical code and update the sync script.
8. Rewrite static verifiers to validate the canonical architecture.
9. Remove `ux.js`/`ux.css` includes, then delete both files.
10. Run complete verification and release through `work` → exact SHA → `main`.

## Non-Goals
- Splitting `app.js` into feature modules (Audit #5)
- Replacing `window.confirm()` (Audit #11)
- Making all verification read-only (Audit #9)
- Reworking changelog storage/data architecture beyond removing runtime template injection (Audit #14 remains separate)
- Visual redesign
- Changing task/notes/checklist/storage formats
- Changing native splash/icon/version/signing behavior

## Success Criteria
Audit Item #3 is complete only when all of the following are true:
- `www/ux.js` and `www/ux.css` are absent and no longer referenced.
- Final intended UI exists directly in source markup and canonical render functions.
- No Task Logging `MutationObserver` repair exists.
- No migrated control is relocated after page initialization.
- Settings uses normal canonical navigation rather than overriding `getActiveTool()`.
- All static verification passes.
- All 28 Playwright browser regression tests pass with the same visible behavior.
- Staging and production Android/iOS workflows pass from the exact promoted SHA.
- Production Pages deploys successfully from the same SHA.
