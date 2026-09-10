import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseAppVersion, syncAndroidVersion, syncIosVersion } from './app-version.mjs';

const root=process.cwd();
const packagePath=join(root,'package.json');
const uxPath=join(root,'www','ux.js');
const pkg=JSON.parse(readFileSync(packagePath,'utf8'));
const {version}=parseAppVersion(pkg.version);

const source=readFileSync(uxPath,'utf8');
const marker=/const FABRI_CADABRA_VERSION='[^']+'; \/\/ @generated from package\.json by scripts\/sync-app-version\.mjs/;
if (!marker.test(source)) throw new Error('FABRI_CADABRA_VERSION generated marker is missing from www/ux.js.');

const next=source.replace(marker,`const FABRI_CADABRA_VERSION='${version}'; // @generated from package.json by scripts/sync-app-version.mjs`);
if (next!==source) writeFileSync(uxPath,next,'utf8');
console.log(`Fabri-Cadabra browser version synchronized from package.json: ${version}`);

const android=syncAndroidVersion(root,version);
if (android.present) {
  console.log(`Android version synchronized: versionName ${version}, versionCode ${android.code}`);
}

const ios=syncIosVersion(root,version);
if (ios.present) {
  console.log(`iOS version synchronized: MARKETING_VERSION ${version}, CURRENT_PROJECT_VERSION ${version}`);
}
