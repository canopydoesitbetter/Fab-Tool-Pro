# Fabri-Cadabra

Fabri-Cadabra is an offline fabrication toolkit delivered as a browser application and wrapped with Capacitor for Android and iOS. The project deliberately uses a small, framework-free source layout so each part of the application has one authoritative home.

## Canonical source map

Edit the file that owns the thing you want to change:

| File | Responsibility |
| --- | --- |
| `www/index.html` | Application markup, visible copy, page/drawer structure, calculator/guide markup |
| `www/styles.css` | All application styling and responsive behavior |
| `www/app.js` | Fabrication tools, saved-data behavior, canonical navigation, shared drawer mechanics, self-tests |
| `www/calculator.js` | Basic Calculator behavior and Calculator Guide event wiring |
| `www/native-compat.js` | Capacitor-only Blob export compatibility |

There is no duplicate frozen application file and no runtime enhancement layer that replaces stale markup after startup. Git history is the archive for previous source versions.

## Compatibility guarantees

The canonical-source refactor does not intentionally change fabrication behavior or saved-data formats. In particular:

- existing `localStorage` keys remain unchanged;
- existing JSON import/export formats remain unchanged;
- Task Logging timers continue to use persisted timestamps, including `running`, `startedAt`, and `accumulatedMs`;
- fabrication formulas, optimizer algorithms, saw rules, notes, checklist, and job behavior remain unchanged;
- native JSON exports preserve the bytes and filename produced by application code;
- the Capacitor application ID remains `com.fabricationpro.app`, so a correctly signed Android build remains an update to the existing installed application.

## Why `native-compat.js` exists

Browser exports create a `Blob`, a `blob:` URL, and an `<a download>` element. Native WebViews are less consistent with that download path.

On **native Capacitor only**, `www/native-compat.js` intercepts the same generated Blob, writes the exact bytes temporarily to the app cache with `@capacitor/filesystem`, and opens the native share/save sheet with `@capacitor/share`. It does not own application UI, navigation, calculator behavior, or feature loading. Normal browser download behavior is left alone.

Imports continue to use the application's existing file input and `FileReader` behavior.

## Versions pinned

- Capacitor Core / CLI / Android / iOS: **8.5.0**
- `@capacitor/filesystem`: **8.1.3**
- `@capacitor/share`: **8.0.1**
- Node.js: **22+**

## Official app identity

- Display / launcher name: **Fabri-Cadabra**
- Bundle / application ID: `com.fabricationpro.app`

The display name may be changed without creating a different Android/iOS app. Do **not** change `com.fabricationpro.app` unless you intentionally want a separate application identity.

## Verification

Before building or committing application changes, run from `fabrication_pro_capacitor`:

```bash
npm install
npm run verify
```

The verification suite checks the canonical source structure, JavaScript syntax, protected persistence/import/export contracts, native Blob export byte preservation, iOS privacy configuration, and Android permanent-signing workflow configuration.

## Phone-installable builds

`.github/workflows/build-phone-installers.yml` produces:

- `Fabri-Cadabra-Android.apk` — permanently release-signed Android installer;
- `Fabri-Cadabra-iPhone-Unsigned.ipa` — physical-device iOS build for re-signing/installing with SideStore, AltStore, or another Apple signing workflow.

See `docs/PHONE_INSTALL.md` for installation guidance and `docs/ANDROID_SIGNING.md` for the permanent Android signing contract.

## First-time native setup

From `fabrication_pro_capacitor`:

```bash
npm install
npm run verify
npm run native:init
```

`native:init` creates Android/iOS projects when needed, runs Capacitor sync, and installs the iOS Filesystem privacy-manifest entry.

### Android

```bash
npm run android:open
```

Android Studio opens the generated native project. The GitHub Actions release workflow uses the permanent signing key stored in repository secrets.

### iOS

A Mac with Xcode is required to build/sign iOS apps.

```bash
npm run ios:open
```

Choose the appropriate Apple Developer Team/signing settings in Xcode, then run or archive the generated project.

## Day-to-day development

After changing any bundled web asset, verify it first:

```bash
npm run verify
```

When working with generated native projects locally, sync the current web assets with:

```bash
npm run sync
```

Generated `android/` and `ios/` projects are build products for this workflow; the canonical product source remains the five files under `www/` listed above.

## Persistence notes

Fabri-Cadabra uses browser/WebView `localStorage`. In Capacitor, that storage belongs to the installed application and persists across normal restarts and same-identity app updates. Uninstalling the application removes app-local storage, so the built-in JSON exports remain the portable backup/transfer mechanism.
