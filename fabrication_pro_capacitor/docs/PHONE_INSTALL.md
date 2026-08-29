# Put Fabrication Pro directly on your phones

This repository is configured to produce the actual phone-installable files from **GitHub Actions → Build Phone Installers**.

## Android — direct APK install

The Android build artifact is:

`Fabrication-Pro-Android.apk`

1. Download the APK to the Android phone (AirDrop is Apple-only; use USB, Google Drive, email to yourself, Nearby/Quick Share, etc.).
2. Tap the APK in Files / Downloads.
3. If Android asks, allow **Install unknown apps** for the app you opened the file from.
4. Tap **Install**.
5. Fabrication Pro appears in the normal app launcher and works offline.

The APK is a permanently release-signed sideload build when the repository signing secrets are configured. It does not need the Play Store. Keep the permanent keystore backed up privately; future APKs signed with the same key can update the installed app normally. See `ANDROID_SIGNING.md`.

## iPhone — why the IPA cannot install unsigned

iOS will not install an arbitrary unsigned `.ipa` simply because it was copied into Files. Apple requires the application to be signed for your device/account.

The build artifact is:

`Fabrication-Pro-iPhone-Unsigned.ipa`

It is a real physical-device iPhone build, packaged specifically so **SideStore**, **AltStore**, or another legitimate personal-signing tool can re-sign it with your Apple ID and install it.

### SideStore / AltStore route

1. Install SideStore or AltStore on the iPhone using that project's current official instructions.
2. Transfer `Fabrication-Pro-iPhone-Unsigned.ipa` to the iPhone (AirDrop, iCloud Drive, Files, etc.).
3. Open SideStore/AltStore and choose the IPA.
4. The tool signs the app with your Apple ID and installs it.

A free Apple ID normally requires periodic re-signing. A paid Apple Developer account gives longer-lived signing and also enables TestFlight / Ad Hoc distribution.

## Data behavior

The web application code and data formats are not converted to a new database. The installed apps continue to use the same localStorage keys and timestamp-based timer logic as the supplied HTML.

Uninstalling the native app removes its app-local WebView storage. Keep using the built-in JSON Export functions for portable backups.
