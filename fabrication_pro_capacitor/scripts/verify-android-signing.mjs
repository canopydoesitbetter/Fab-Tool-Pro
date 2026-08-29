import { readFileSync } from 'node:fs';
import { patchAndroidBuildGradle, ANDROID_SIGNING_MARKER } from './android-signing.mjs';

const workflow = readFileSync(new URL('../../.github/workflows/build-phone-installers.yml', import.meta.url), 'utf8');
const signingScript = readFileSync(new URL('./android-signing.mjs', import.meta.url), 'utf8');
const pinnedFingerprint = readFileSync(new URL('../docs/ANDROID_SIGNING_CERT_SHA256.txt', import.meta.url), 'utf8').trim();

const requiredSecrets = [
  'ANDROID_KEYSTORE_BASE64',
  'ANDROID_KEYSTORE_PASSWORD',
  'ANDROID_KEY_ALIAS',
  'ANDROID_KEY_PASSWORD'
];

for (const secret of requiredSecrets) {
  if (!workflow.includes(`secrets.${secret}`)) {
    throw new Error(`Android workflow is missing GitHub Secret ${secret}.`);
  }
}

if (!workflow.includes('node scripts/android-signing.mjs')) {
  throw new Error('Android workflow does not configure the generated Gradle project for permanent release signing.');
}
if (!workflow.includes('./gradlew assembleRelease')) {
  throw new Error('Android workflow is not building the release APK.');
}
if (workflow.includes('./gradlew assembleDebug')) {
  throw new Error('Android workflow still builds the disposable debug-signed APK.');
}
if (!workflow.includes('apksigner') || !workflow.includes('--print-certs')) {
  throw new Error('Android workflow does not verify and record the final APK signing certificate.');
}
if (!workflow.includes('docs/ANDROID_SIGNING_CERT_SHA256.txt')) {
  throw new Error('Android workflow does not compare against the pinned permanent certificate fingerprint.');
}
if (!/^[0-9a-f]{64}$/.test(pinnedFingerprint)) {
  throw new Error('Pinned Android certificate SHA-256 must be exactly 64 lowercase hexadecimal characters.');
}

const requiredEnvironmentVariables = [
  'ANDROID_KEYSTORE_FILE',
  'ANDROID_KEYSTORE_PASSWORD',
  'ANDROID_KEY_ALIAS',
  'ANDROID_KEY_PASSWORD'
];
for (const variable of requiredEnvironmentVariables) {
  if (!signingScript.includes(`System.getenv("${variable}")`)) {
    throw new Error(`Gradle signing patch is missing ${variable}.`);
  }
}
if (!signingScript.includes('signingConfig signingConfigs.fabricationProRelease')) {
  throw new Error('Gradle signing patch does not bind the permanent signing config to the release build type.');
}

const fixture = `plugins { id 'com.android.application' }\nandroid { namespace 'com.fabricationpro.app' }\n`;
const patched = patchAndroidBuildGradle(fixture);
if (!patched.includes(ANDROID_SIGNING_MARKER)) {
  throw new Error('Gradle signing patch marker was not added.');
}
if (patchAndroidBuildGradle(patched) !== patched) {
  throw new Error('Gradle signing patch is not idempotent.');
}
if ((patched.match(/fabricationProRelease/g) || []).length < 2) {
  throw new Error('Gradle signing patch does not define and apply the release signing configuration.');
}

console.log('Android permanent release-signing workflow: OK');
console.log('Android signing secrets remain external to the repository: OK');
console.log(`Pinned Android certificate SHA-256: ${pinnedFingerprint}`);
console.log('Android APK certificate verification step: OK');
console.log('Android Gradle signing patch idempotence: OK');
