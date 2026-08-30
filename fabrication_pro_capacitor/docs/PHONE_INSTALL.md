# Install Fabri-Cadabra on your phones

The repository produces phone-installable files through **GitHub Actions → Build Fabri-Cadabra Installers**.

## Android — direct APK install

The Android installer is:

```text
Fabri-Cadabra-Android.apk
```

1. Transfer or download the APK to the Android phone using USB, cloud storage, Quick Share, email to yourself, or another trusted transfer method.
2. Open the APK from Files/Downloads.
3. If Android asks, allow **Install unknown apps** for the app you used to open the APK.
4. Tap **Install** or **Update**.
5. The launcher/home-screen app name is **Fabri-Cadabra**.

The APK is a permanently release-signed sideload build. Future APKs can update the existing installation when both of these remain unchanged:

- application ID `com.fabricationpro.app`;
- permanent signing certificate SHA-256 `5769bbe5a1f4fdccd985fd0145495f3614e0db41992871c99b9eb361634bb586`.

See `ANDROID_SIGNING.md` for the signing contract.

## iPhone — unsigned IPA

iOS does not install an arbitrary unsigned `.ipa` directly from Files. The application must be signed for your Apple account/device.

The generated file is:

```text
Fabri-Cadabra-iPhone-Unsigned.ipa
```

It is a physical-device iPhone build intended for re-signing with SideStore, AltStore, or another legitimate Apple signing workflow. After installation, the iOS display name is **Fabri-Cadabra**.

### SideStore / AltStore route

1. Install SideStore or AltStore using that project's current official instructions.
2. Transfer `Fabri-Cadabra-iPhone-Unsigned.ipa` to the iPhone.
3. Open SideStore/AltStore and select the IPA.
4. Let the tool sign and install the application with your Apple ID.

A free Apple ID normally requires periodic re-signing. A paid Apple Developer account enables longer-lived signing and additional distribution options such as TestFlight or Ad Hoc distribution.

## Data behavior during updates

Fabri-Cadabra continues to use the same existing `localStorage` keys, JSON import/export formats, and timestamp-based task timer model. A normal update of the same application identity preserves its app-local data.

Uninstalling the native application removes its WebView-local storage. Use Fabri-Cadabra's JSON Export features when you need a portable backup or transfer between installations.
