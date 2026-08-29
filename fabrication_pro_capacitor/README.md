# Fabrication Pro — Capacitor iOS + Android Wrapper

This project wraps the supplied **Fabrication Pro / Fabrication Calculators** single-file application in Capacitor while preserving the existing application logic and data formats.

## What is preserved

- The authoritative uploaded app is stored byte-for-byte at `source/fabrication_pro.original.html`.
- `www/index.html` is the same application with exactly one additive line: it loads `www/native-compat.js`.
- No calculator formulas, optimizer algorithms, saw rules, localStorage keys, JSON schemas, import validators, checklist/note/job logic, or task-timer logic were rewritten.
- The app still runs fully offline from bundled web assets.
- Existing timestamp-based task timers keep using the device clock and persisted timestamps exactly as before.

## Why `native-compat.js` exists

The existing application exports JSON by creating a `Blob`, creating a `blob:` URL, and programmatically clicking an `<a download>` element. Native WebViews have historically been inconsistent with Blob downloads, especially on Android.

On **native Capacitor only**, the compatibility layer captures those same generated Blob bytes and same filename, writes them temporarily to the app cache with `@capacitor/filesystem`, and opens the native save/share sheet with `@capacitor/share`. The JSON payload itself is not changed. Browser behavior is untouched.

Imports continue to use the application's existing `<input type="file">` + `FileReader` logic and therefore use the native document picker supplied by the WebView.

## Versions pinned

- Capacitor Core / CLI / Android / iOS: **8.5.0**
- `@capacitor/filesystem`: **8.1.3**
- `@capacitor/share`: **8.0.1**
- Node.js: **22+**


## Phone-installable builds

This repository now includes `.github/workflows/build-phone-installers.yml`, which produces the actual files you can transfer to phones:

- `Fabrication-Pro-Android.apk` — permanently release-signed from GitHub Secrets; copy to an Android phone and tap to install.
- `Fabrication-Pro-iPhone-Unsigned.ipa` — physical-device iOS build for re-signing/installing with SideStore/AltStore or your Apple signing workflow. Apple does not allow unsigned IPAs to be installed directly from Files.

See `docs/PHONE_INSTALL.md` for phone-side installation steps and `docs/ANDROID_SIGNING.md` for the permanent Android signing setup.

## First-time setup

From this folder:

```bash
npm install
npm run verify:web
npm run native:init
```

`native:init` adds Android and iOS if they do not exist, runs `cap sync`, and writes the iOS Filesystem privacy-manifest entry required for App Store submission.

### Android

```bash
npm run android:open
```

Android Studio opens the generated native project. Select a device/emulator and Run. The included GitHub Actions workflow builds a permanently signed release APK when the four Android signing repository secrets are configured. See `docs/ANDROID_SIGNING.md`.

### iOS

A Mac with Xcode is required to build/sign iOS apps.

```bash
npm run ios:open
```

In Xcode, choose your Apple Developer Team / signing settings, select a device/simulator, and Run. Archive from Xcode when you are ready for TestFlight/App Store distribution.

## Day-to-day workflow after editing the web app

If you update `www/index.html` or other bundled web assets:

```bash
npm run sync
```

Then rebuild/run in Android Studio or Xcode.

## App identity

Current native identity:

- App name: `Fabrication Pro`
- Bundle/Application ID: `com.fabricationpro.app`

Change the `appId` before your first store release if you own a different reverse-domain identifier. Once an app is published, changing its application ID creates a different app in the stores.

## Persistence notes

The existing app uses browser `localStorage`. In Capacitor, that storage belongs to this installed app's WebView and persists across normal app restarts and updates. Uninstalling the app removes app-local storage, so the existing JSON Export features remain the portable backup/transfer mechanism.

## Integrity check

Run:

```bash
npm run verify:web
```

It verifies JavaScript syntax and confirms that removing the one native compatibility script include from `www/index.html` reconstructs the original uploaded HTML exactly.
