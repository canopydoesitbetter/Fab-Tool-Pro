import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const ANDROID_SIGNING_MARKER = '// Fabri-Cadabra permanent CI release signing';

export function patchAndroidBuildGradle(source) {
  if (source.includes(ANDROID_SIGNING_MARKER)) return source;

  const signingBlock = `

${ANDROID_SIGNING_MARKER}
// The keystore and passwords stay in GitHub Actions Secrets. They are never committed.
android {
    signingConfigs {
        fabriCadabraRelease {
            def fabriCadabraKeystoreFile = System.getenv("ANDROID_KEYSTORE_FILE")
            def fabriCadabraKeystorePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
            def fabricationProKeyAlias = System.getenv("ANDROID_KEY_ALIAS")
            def fabricationProKeyPassword = System.getenv("ANDROID_KEY_PASSWORD")

            if (!fabriCadabraKeystoreFile || !fabriCadabraKeystorePassword || !fabricationProKeyAlias || !fabricationProKeyPassword) {
                throw new GradleException("Fabri-Cadabra Android release signing environment variables are missing.")
            }

            storeFile file(fabriCadabraKeystoreFile)
            storePassword fabriCadabraKeystorePassword
            keyAlias fabricationProKeyAlias
            keyPassword fabricationProKeyPassword
        }
    }

    buildTypes {
        release {
            signingConfig signingConfigs.fabriCadabraRelease
        }
    }
}
`;

  return `${source.trimEnd()}${signingBlock}`;
}

export function installAndroidSigning(root = process.cwd()) {
  const buildGradlePath = join(root, 'android', 'app', 'build.gradle');
  const source = readFileSync(buildGradlePath, 'utf8');
  const patched = patchAndroidBuildGradle(source);
  writeFileSync(buildGradlePath, patched);
  console.log('Android Gradle release signing configuration: installed');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  installAndroidSigning();
}
