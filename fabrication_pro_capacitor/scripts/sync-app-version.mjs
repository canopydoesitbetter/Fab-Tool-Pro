import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { nativeBuildNumber, parseAppVersion, syncAndroidVersion, syncIosVersion } from './app-version.mjs';

const root=process.cwd();
const packagePath=join(root,'package.json');
const releasePath=join(root,'release.json');
const appPath=join(root,'www','app','bootstrap.js');
const pkg=JSON.parse(readFileSync(packagePath,'utf8'));
const release=JSON.parse(readFileSync(releasePath,'utf8'));
const {version}=parseAppVersion(pkg.version);
if (release.version!==version) throw new Error(`release.json version ${release.version || 'missing'} does not match package.json ${version}.`);
const buildNumber=nativeBuildNumber(release.buildNumber);

const source=readFileSync(appPath,'utf8');
const marker=/const FABRI_CADABRA_VERSION='[^']+'; \/\/ @generated from package\.json by scripts\/sync-app-version\.mjs/;
if (!marker.test(source)) throw new Error('FABRI_CADABRA_VERSION generated marker is missing from www/app/bootstrap.js.');

const next=source.replace(marker,`const FABRI_CADABRA_VERSION='${version}'; // @generated from package.json by scripts/sync-app-version.mjs`);
if (next!==source) writeFileSync(appPath,next,'utf8');
console.log(`Fabri-Cadabra browser version synchronized from package.json: ${version}`);

const android=syncAndroidVersion(root,version,buildNumber);
if (android.present) console.log(`Android version synchronized: versionName ${version}, versionCode ${android.code}`);

const ios=syncIosVersion(root,version,buildNumber);
if (ios.present) console.log(`iOS version synchronized: MARKETING_VERSION ${version}, CURRENT_PROJECT_VERSION ${buildNumber}`);
