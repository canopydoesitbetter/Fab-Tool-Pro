# Permanent Android signing for Fabri-Cadabra

Fabri-Cadabra's Android GitHub Actions job builds a **release APK** signed by one permanent key. The private key remains in GitHub Actions Secrets and is never committed to the repository.

## Required repository secrets

In GitHub, open **Settings → Secrets and variables → Actions** and keep these four repository secrets configured exactly as named:

- `ANDROID_KEYSTORE_BASE64` — one-line Base64 representation of the permanent `.jks` keystore;
- `ANDROID_KEYSTORE_PASSWORD` — password that opens the keystore;
- `ANDROID_KEY_ALIAS` — alias of the permanent signing key;
- `ANDROID_KEY_PASSWORD` — password for that alias.

The workflow fails if any required secret is missing.

## Permanent certificate identity

The pinned public certificate SHA-256 is stored in `docs/ANDROID_SIGNING_CERT_SHA256.txt` and must remain:

```text
5769bbe5a1f4fdccd985fd0145495f3614e0db41992871c99b9eb361634bb586
```

This fingerprint is not secret. It lets CI reject an APK signed with the wrong private key.

The Capacitor application ID must also remain:

```text
com.fabricationpro.app
```

The official launcher name is **Fabri-Cadabra**, but changing the display name does not change the application identity. Keeping both the application ID and signing certificate stable is what allows future APKs to update the installed app and retain app-local data.

## What the workflow does

1. Verifies the canonical Fabri-Cadabra source and compatibility contracts.
2. Generates and synchronizes the Capacitor Android project.
3. Verifies the generated Android launcher label is `Fabri-Cadabra`.
4. Adds a release-only Gradle signing configuration that reads credentials from environment variables.
5. Restores the permanent keystore only into GitHub's temporary runner directory.
6. Confirms the configured alias exists in the keystore.
7. Runs `./gradlew assembleRelease`.
8. Uses Android SDK `apksigner` to verify the finished APK and report its signing certificate.
9. Compares that certificate to `docs/ANDROID_SIGNING_CERT_SHA256.txt` and fails on any mismatch.
10. Uploads:
   - `Fabri-Cadabra-Android.apk`
   - `Fabri-Cadabra-Android.apk.sha256`
   - `Fabri-Cadabra-Android-signing.txt`

Keep a private backup of the original keystore and credentials. Losing the permanent key prevents future APKs from updating installations signed with that key.

## Installing updates

Once a device has the permanently signed build installed, future `Fabri-Cadabra-Android.apk` files signed by the same certificate can install over it normally. Android retains application data during a normal same-identity update.

If a much older **debug-signed** build is still installed on a device, that debug build cannot be directly updated by the permanent release certificate. Export any needed data, uninstall the debug build, install the permanent release build, and import the data once. That is a one-time signing migration.

## Security boundary

Only the public fingerprint is committed. The `.jks` file, keystore password, key alias credential, and key password must remain outside the repository and must never be pasted into source, issues, pull requests, logs, or documentation.
