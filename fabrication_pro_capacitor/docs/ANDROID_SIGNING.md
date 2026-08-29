# Permanent Android signing for GitHub Actions

Fabrication Pro's Android GitHub Actions job builds a **release APK** signed by one permanent key. The key itself is stored only in GitHub Actions Secrets, not in the repository.

## Required repository secrets

Open your GitHub repository and go to:

**Settings → Secrets and variables → Actions → New repository secret**

Create these four secrets exactly:

- `ANDROID_KEYSTORE_BASE64` — one-line Base64 representation of the permanent `.jks` keystore.
- `ANDROID_KEYSTORE_PASSWORD` — password that opens the keystore.
- `ANDROID_KEY_ALIAS` — alias of the permanent signing key inside the keystore.
- `ANDROID_KEY_PASSWORD` — password for that key alias.

The workflow fails immediately with a clear error if any one of these secrets is missing.

## What the workflow does

1. Verifies that the Fabrication Pro web application is still preserved.
2. Generates/syncs the Capacitor Android project.
3. Adds a release-only Gradle signing configuration that reads credentials from environment variables.
4. Restores the permanent keystore into GitHub's temporary runner directory.
5. Confirms the configured alias exists in that keystore.
6. Runs `./gradlew assembleRelease`.
7. Uses Android SDK `apksigner` to verify the finished APK and record its signing certificate.
8. Compares the APK certificate to the pinned public fingerprint in `docs/ANDROID_SIGNING_CERT_SHA256.txt` and fails if it differs.
9. Uploads:
   - `Fabrication-Pro-Android.apk`
   - `Fabrication-Pro-Android.apk.sha256`
   - `Fabrication-Pro-Android-signing.txt`

Keep a private backup of the original keystore and passwords. Losing the signing key means you will not be able to install future APKs as updates to copies signed by that key.

## Important if a debug APK is already installed

A permanently signed release APK **cannot update** an older APK that was signed with GitHub's disposable debug certificate. Android will report a signature mismatch.

Before changing from the old debug build to the permanent release build:

1. Export any Fabrication Pro data you need to keep using the app's built-in JSON exports.
2. Uninstall the old debug-signed Fabrication Pro app.
3. Install the first permanently signed `Fabrication-Pro-Android.apk`.
4. Import your exported data if necessary.

After that one-time migration, future APKs generated with the same permanent key can install over the existing app normally and preserve its app-local data.

## Pinned certificate fingerprint

The repository includes only the **public SHA-256 certificate fingerprint** in `docs/ANDROID_SIGNING_CERT_SHA256.txt`. This is safe to commit and lets CI detect if the private signing key was accidentally replaced. The private `.jks` file and passwords must remain outside the repository.
