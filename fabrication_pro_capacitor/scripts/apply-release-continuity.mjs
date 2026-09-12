import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root=resolve(import.meta.dirname,'..');
const repoRoot=resolve(root,'..');
const need=(condition,message)=>{if(!condition)throw new Error(message);};
const read=path=>readFileSync(path,'utf8');
const write=(path,content)=>writeFileSync(path,content,'utf8');
const replaceExact=(source,from,to,label)=>{
  need(source.includes(from),`Release repair patch could not find ${label}.`);
  return source.replace(from,to);
};

const PUBLIC_VERSION='1.0.4';
const PREVIOUS_VERSION='1.0.3';
const BUILD_NUMBER=1000006;

const release={version:PUBLIC_VERSION,buildNumber:BUILD_NUMBER,previousVersion:PREVIOUS_VERSION};
write(join(root,'release.json'),JSON.stringify(release,null,2)+'\n');

const packagePath=join(root,'package.json');
const pkg=JSON.parse(read(packagePath));
pkg.version=PUBLIC_VERSION;
need(String(pkg.scripts?.['verify:release']||'').includes('verify-release-continuity.mjs'),'verify:release must be wired before applying the release repair.');
write(packagePath,JSON.stringify(pkg,null,2)+'\n');

const lockPath=join(root,'package-lock.json');
const lock=JSON.parse(read(lockPath));
lock.version=PUBLIC_VERSION;
need(lock.packages && lock.packages[''],'package-lock root package metadata is missing.');
lock.packages[''].version=PUBLIC_VERSION;
write(lockPath,JSON.stringify(lock,null,2)+'\n');

const bootstrapPath=join(root,'www','app','bootstrap.js');
let bootstrap=read(bootstrapPath);
bootstrap=bootstrap.replace(/const FABRI_CADABRA_VERSION='[^']+'; \/\/ @generated from package\.json by scripts\/sync-app-version\.mjs/,`const FABRI_CADABRA_VERSION='${PUBLIC_VERSION}'; // @generated from package.json by scripts/sync-app-version.mjs`);
write(bootstrapPath,bootstrap);

const appVersionPath=join(root,'scripts','app-version.mjs');
write(appVersionPath,`import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function parseAppVersion(value) {
  const version=String(value || '').trim();
  const match=version.match(/^(\\d+)\\.(\\d+)\\.(\\d+)(?:[-+][0-9A-Za-z.-]+)?$/);
  if (!match) throw new Error(\`Invalid app version: \${version || 'missing'}\`);

  const major=Number(match[1]);
  const minor=Number(match[2]);
  const patch=Number(match[3]);
  if (minor>999 || patch>999) throw new Error('Minor and patch versions must each be <= 999.');
  return {version,major,minor,patch};
}

export function nativeBuildNumber(value) {
  const build=Number(value);
  if (!Number.isInteger(build) || build<1 || build>2_100_000_000) {
    throw new Error(\`Native build number \${value} is outside the supported integer range.\`);
  }
  return build;
}

function writeChanged(path,next,current) {
  if (next!==current) writeFileSync(path,next,'utf8');
  return next!==current;
}

export function syncAndroidVersion(root,value,buildNumber) {
  parseAppVersion(value);
  const path=join(root,'android','app','build.gradle');
  if (!existsSync(path)) return {present:false,changed:false};

  const code=nativeBuildNumber(buildNumber);
  const source=readFileSync(path,'utf8');
  if (!/\\bversionCode\\s+\\d+\\b/.test(source)) throw new Error('Android build.gradle versionCode setting was not found.');
  if (!/\\bversionName\\s+["'][^"']+["']/.test(source)) throw new Error('Android build.gradle versionName setting was not found.');

  const next=source
    .replace(/(\\bversionCode\\s+)\\d+\\b/,\`$1\${code}\`)
    .replace(/(\\bversionName\\s+)["'][^"']+["']/,\`$1"\${value}"\`);
  return {present:true,changed:writeChanged(path,next,source),code};
}

export function syncIosVersion(root,value,buildNumber) {
  parseAppVersion(value);
  const build=nativeBuildNumber(buildNumber);
  const path=join(root,'ios','App','App.xcodeproj','project.pbxproj');
  if (!existsSync(path)) return {present:false,changed:false};

  const source=readFileSync(path,'utf8');
  const marketingCount=(source.match(/\\bMARKETING_VERSION\\s*=\\s*[^;]+;/g)||[]).length;
  const buildCount=(source.match(/\\bCURRENT_PROJECT_VERSION\\s*=\\s*[^;]+;/g)||[]).length;
  if (!marketingCount) throw new Error('iOS MARKETING_VERSION setting was not found.');
  if (!buildCount) throw new Error('iOS CURRENT_PROJECT_VERSION setting was not found.');

  const next=source
    .replace(/\\bMARKETING_VERSION\\s*=\\s*[^;]+;/g,\`MARKETING_VERSION = \${value};\`)
    .replace(/\\bCURRENT_PROJECT_VERSION\\s*=\\s*[^;]+;/g,\`CURRENT_PROJECT_VERSION = \${build};\`);
  return {present:true,changed:writeChanged(path,next,source),marketingCount,buildCount,build};
}
`);

const syncPath=join(root,'scripts','sync-app-version.mjs');
write(syncPath,`import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { nativeBuildNumber, parseAppVersion, syncAndroidVersion, syncIosVersion } from './app-version.mjs';

const root=process.cwd();
const packagePath=join(root,'package.json');
const releasePath=join(root,'release.json');
const appPath=join(root,'www','app','bootstrap.js');
const pkg=JSON.parse(readFileSync(packagePath,'utf8'));
const release=JSON.parse(readFileSync(releasePath,'utf8'));
const {version}=parseAppVersion(pkg.version);
if (release.version!==version) throw new Error(\`release.json version \${release.version || 'missing'} does not match package.json \${version}.\`);
const buildNumber=nativeBuildNumber(release.buildNumber);

const source=readFileSync(appPath,'utf8');
const marker=/const FABRI_CADABRA_VERSION='[^']+'; \\/\\/ @generated from package\\.json by scripts\\/sync-app-version\\.mjs/;
if (!marker.test(source)) throw new Error('FABRI_CADABRA_VERSION generated marker is missing from www/app/bootstrap.js.');

const next=source.replace(marker,\`const FABRI_CADABRA_VERSION='\${version}'; // @generated from package.json by scripts/sync-app-version.mjs\`);
if (next!==source) writeFileSync(appPath,next,'utf8');
console.log(\`Fabri-Cadabra browser version synchronized from package.json: \${version}\`);

const android=syncAndroidVersion(root,version,buildNumber);
if (android.present) console.log(\`Android version synchronized: versionName \${version}, versionCode \${android.code}\`);

const ios=syncIosVersion(root,version,buildNumber);
if (ios.present) console.log(\`iOS version synchronized: MARKETING_VERSION \${version}, CURRENT_PROJECT_VERSION \${buildNumber}\`);
`);

const verifyAppVersionPath=join(root,'scripts','verify-app-version.mjs');
write(verifyAppVersionPath,`import { readAppSource } from './app-module-manifest.mjs';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { nativeBuildNumber, parseAppVersion } from './app-version.mjs';

const root=resolve(import.meta.dirname,'..');
const need=(condition,message)=>{if(!condition)throw new Error(message)};
const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
const release=JSON.parse(readFileSync(join(root,'release.json'),'utf8'));
const {version}=parseAppVersion(pkg.version);
need(release.version===version,'release.json public version must match package.json.');
const expectedBuild=nativeBuildNumber(release.buildNumber);
need(expectedBuild>=1000006,'Native build number must never go below the already-shipped 1000005 build.');
need(nativeBuildNumber(1000006)===1000006,'Native build number normalization must preserve valid integer builds.');

const config=JSON.parse(readFileSync(join(root,'capacitor.config.json'),'utf8'));
need(config.appId==='com.fabricationpro.app','Capacitor app ID must remain com.fabricationpro.app.');

const app=readAppSource(root);
need(app.includes(\`const FABRI_CADABRA_VERSION='\${version}'; // @generated from package.json by scripts/sync-app-version.mjs\`),'Browser bootstrap version marker must match package.json.');

const fixture=mkdtempSync(join(tmpdir(),'fabri-cadabra-version-'));
try {
  mkdirSync(join(fixture,'scripts'),{recursive:true});
  mkdirSync(join(fixture,'www','app'),{recursive:true});
  mkdirSync(join(fixture,'android','app'),{recursive:true});
  mkdirSync(join(fixture,'ios','App','App.xcodeproj'),{recursive:true});
  cpSync(join(root,'scripts','app-version.mjs'),join(fixture,'scripts','app-version.mjs'));
  cpSync(join(root,'scripts','sync-app-version.mjs'),join(fixture,'scripts','sync-app-version.mjs'));
  writeFileSync(join(fixture,'package.json'),JSON.stringify({version},null,2));
  writeFileSync(join(fixture,'release.json'),JSON.stringify({version,buildNumber:expectedBuild,previousVersion:release.previousVersion},null,2));
  writeFileSync(join(fixture,'www','app','bootstrap.js'),"const FABRI_CADABRA_VERSION='0.0.0'; // @generated from package.json by scripts/sync-app-version.mjs\\n");
  writeFileSync(join(fixture,'android','app','build.gradle'),'android {\\n  defaultConfig {\\n    applicationId "com.fabricationpro.app"\\n    versionCode 1\\n    versionName "1.0"\\n  }\\n}\\n');
  writeFileSync(join(fixture,'ios','App','App.xcodeproj','project.pbxproj'),'CURRENT_PROJECT_VERSION = 1;\\nMARKETING_VERSION = 1.0;\\nCURRENT_PROJECT_VERSION = 1;\\nMARKETING_VERSION = 1.0;\\n');

  const result=spawnSync(process.execPath,[join(fixture,'scripts','sync-app-version.mjs')],{cwd:fixture,encoding:'utf8'});
  need(result.status===0,\`sync-app-version fixture failed: \${result.stderr || result.stdout}\`);
  const fixtureApp=readFileSync(join(fixture,'www','app','bootstrap.js'),'utf8');
  need(fixtureApp.includes(\`FABRI_CADABRA_VERSION='\${version}'\`),'Browser fixture version was not synchronized.');
  const gradle=readFileSync(join(fixture,'android','app','build.gradle'),'utf8');
  need(new RegExp(\`versionCode\\\\s+\${expectedBuild}\\\\b\`).test(gradle),\`Android fixture versionCode must be \${expectedBuild}.\`);
  need(gradle.includes(\`versionName "\${version}"\`),\`Android fixture versionName must be \${version}.\`);
  const escapedVersion=version.replaceAll('.','\\\\.');
  const pbx=readFileSync(join(fixture,'ios','App','App.xcodeproj','project.pbxproj'),'utf8');
  need((pbx.match(new RegExp(\`MARKETING_VERSION = \${escapedVersion};\`,'g'))||[]).length===2,'All iOS MARKETING_VERSION fixture values must synchronize.');
  need((pbx.match(new RegExp(\`CURRENT_PROJECT_VERSION = \${expectedBuild};\`,'g'))||[]).length===2,'All iOS CURRENT_PROJECT_VERSION fixture values must use the independent native build number.');
} finally {
  rmSync(fixture,{recursive:true,force:true});
}

const init=readFileSync(join(root,'scripts','native-init.mjs'),'utf8');
need(init.includes("['run', 'sync:version']"),'native:init must synchronize app version after Capacitor sync.');

const workflow=readFileSync(join(root,'..','.github','workflows','build-phone-installers.yml'),'utf8');
need((workflow.match(/npm run sync:version/g)||[]).length>=2,'Android and iOS installer jobs must synchronize native versions after cap sync.');
for (const marker of ['dump badging','versionCode','versionName','CFBundleShortVersionString','CFBundleVersion','EXPECTED_BUILD_NUMBER','release.json','com.fabricationpro.app']) {
  need(workflow.includes(marker),\`Installer workflow must verify finished artifact metadata: missing \${marker}.\`);
}

console.log(\`Fabri-Cadabra \${version} app version synchronization contract: OK (native build \${expectedBuild})\`);
`);

const indexPath=join(root,'www','index.html');
let html=read(indexPath);
html=html.replace(/(<strong id=['"]settingsVersionValue['"][^>]*>)[^<]+(<\\/strong>)/,`$1${PUBLIC_VERSION}$2`);
const currentArticle=/<article class='changelog-entry changelog-release' data-changelog-version='current'>[\\s\\S]*?<\\/article>/;
need(currentArticle.test(html),'Current changelog article marker was not found.');
const repairedArticle=`<article class='changelog-entry changelog-release' data-changelog-version='1.0.4'>
  <div class='changelog-entry-heading'>
    <div>
      <span id='settingsCurrentChangelogVersion' class='changelog-version-label'>Version 1.0.4</span>
      <h2>Full Backup, Native Branding &amp; Reliability</h2>
    </div>
  </div>
  <ul>
    <li><b>Full Backup &amp; Recovery:</b> Added a Settings-based full-app JSON backup that captures all Fabri-Cadabra saved data after pending edits are flushed.</li>
    <li>Full restore now validates the backup before changing saved data, asks for confirmation, and creates an automatic recovery snapshot first.</li>
    <li>Automatic recovery snapshots are stored separately in IndexedDB and are created before full restore, Task Logging Jobs and Presets imports, Fabricator Notes imports, Checklist imports, Sheet Optimizer saved-job replacement, and recovery restore.</li>
    <li>Restore writes are transactional: if a local-storage write fails, Fabri-Cadabra attempts to roll back the previous saved data instead of leaving a partial restore.</li>
    <li>Added recovery status plus a Restore Latest Recovery control so the most recent protected snapshot can be restored from Settings.</li>
    <li><b>Native Branding:</b> Added the new Fabri-Cadabra launcher icon on Android and iPhone, replacing the default Capacitor launcher branding.</li>
    <li>Added a branded launch screen using the exact approved artwork. The final Android launch presentation uses the full portrait artwork while slimmer native splash resources reduce unnecessary APK bloat.</li>
    <li>Native branding now travels through the same repeatable Capacitor installer pipeline used for production builds.</li>
    <li><b>Canonical App Architecture:</b> Removed the retired runtime UX patch layer and consolidated its finished UI behavior and styling into the canonical app source.</li>
    <li>Split the former 6,600+ line app.js monolith into 15 ordered feature modules while preserving storage formats, calculations, imports/exports, timers, and existing app behavior.</li>
    <li><b>Regression &amp; Release Safety:</b> Expanded Playwright and source-level regression coverage around browser behavior, backups/restores, timers, native compatibility, branding, signing, and version metadata.</li>
    <li>Made npm run verify read-only and added CI proof that verification leaves tracked repository files unchanged.</li>
    <li>Separated the public release version from native install/build numbers and added release-continuity checks so the package version and changelog cannot silently skip a public patch release again.</li>
  </ul>
</article>`;
html=html.replace(currentArticle,repairedArticle);
write(indexPath,html);

const verifySettingsPath=join(root,'scripts','verify-settings-changelog.mjs');
let verifySettings=read(verifySettingsPath);
verifySettings=replaceExact(verifySettings,"const currentIndex=html.indexOf(\"data-changelog-version='current'\");","const currentIndex=html.indexOf(`data-changelog-version='${pkg.version}'`);",'current changelog index check');
verifySettings=replaceExact(verifySettings,"need(currentIndex>=0 && v103Index>currentIndex && v102Index>v103Index && v101Index>v102Index && baselineIndex>v101Index,'Changelog must remain newest-first.');","need(pkg.version==='1.0.4','Current repaired public release must be 1.0.4.');\nneed(currentIndex>=0 && v103Index>currentIndex && v102Index>v103Index && v101Index>v102Index && baselineIndex>v101Index,'Changelog must remain newest-first with 1.0.4 followed by 1.0.3.');\nfor (const concept of ['Full Backup &amp; Recovery','full-app JSON backup','automatic recovery snapshot','Task Logging Jobs and Presets imports','transactional','Restore Latest Recovery','new Fabri-Cadabra launcher icon','branded launch screen','full portrait artwork','runtime UX patch layer','6,600+ line app.js monolith','15 ordered feature modules','Playwright','npm run verify read-only','release-continuity checks']) need(html.includes(concept),`v1.0.4 changelog missing audited release concept: ${concept}`);",'newest-first changelog assertion');
write(verifySettingsPath,verifySettings);

const workflowPath=join(repoRoot,'.github','workflows','build-phone-installers.yml');
let workflow=read(workflowPath);
workflow=replaceExact(workflow,`          EXPECTED_VERSION_CODE="$(node --input-type=module -e "import { androidVersionCode } from './scripts/app-version.mjs'; import { readFileSync } from 'node:fs'; const pkg=JSON.parse(readFileSync('package.json','utf8')); console.log(androidVersionCode(pkg.version));")"`,`          EXPECTED_BUILD_NUMBER="$(node -p "require('./release.json').buildNumber")"`,'Android expected build number');
workflow=workflow.replaceAll('$EXPECTED_VERSION_CODE','$EXPECTED_BUILD_NUMBER');
workflow=replaceExact(workflow,`          EXPECTED_VERSION="$(node -p "require('../package.json').version")"\n          INFO_PLIST=`,`          EXPECTED_VERSION="$(node -p "require('../package.json').version")"\n          EXPECTED_BUILD_NUMBER="$(node -p "require('../release.json').buildNumber")"\n          INFO_PLIST=`,'iOS expected build number');
workflow=replaceExact(workflow,`[ "$ACTUAL_BUILD" != "$EXPECTED_VERSION" ]`,`[ "$ACTUAL_BUILD" != "$EXPECTED_BUILD_NUMBER" ]`,'iOS build comparison');
workflow=replaceExact(workflow,`echo "Expected: bundle=com.fabricationpro.app version=$EXPECTED_VERSION build=$EXPECTED_VERSION"`,`echo "Expected: bundle=com.fabricationpro.app version=$EXPECTED_VERSION build=$EXPECTED_BUILD_NUMBER"`,'iOS expected metadata output');
write(workflowPath,workflow);

console.log(`Applied release continuity repair: public ${PUBLIC_VERSION}, native build ${BUILD_NUMBER}, previous ${PREVIOUS_VERSION}.`);
