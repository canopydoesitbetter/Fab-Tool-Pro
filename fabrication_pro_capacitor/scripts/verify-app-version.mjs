import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { androidVersionCode, parseAppVersion } from './app-version.mjs';

const root=resolve(import.meta.dirname,'..');
const need=(condition,message)=>{if(!condition)throw new Error(message)};
const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
const {version}=parseAppVersion(pkg.version);
const expectedCode=androidVersionCode(version);

need(androidVersionCode('1.0.5')===1000005,'Android versionCode mapping for 1.0.5 must be 1000005.');
need(androidVersionCode('1.1.0')===1001000,'Android versionCode mapping for 1.1.0 must be 1001000.');
need(androidVersionCode('2.0.0')===2000000,'Android versionCode mapping for 2.0.0 must be 2000000.');

const config=JSON.parse(readFileSync(join(root,'capacitor.config.json'),'utf8'));
need(config.appId==='com.fabricationpro.app','Capacitor app ID must remain com.fabricationpro.app.');

const ux=readFileSync(join(root,'www','ux.js'),'utf8');
need(ux.includes(`const FABRI_CADABRA_VERSION='${version}'; // @generated from package.json by scripts/sync-app-version.mjs`),'Browser version marker must match package.json.');

const fixture=mkdtempSync(join(tmpdir(),'fabri-cadabra-version-'));
try {
  mkdirSync(join(fixture,'scripts'),{recursive:true});
  mkdirSync(join(fixture,'www'),{recursive:true});
  mkdirSync(join(fixture,'android','app'),{recursive:true});
  mkdirSync(join(fixture,'ios','App','App.xcodeproj'),{recursive:true});
  cpSync(join(root,'scripts','app-version.mjs'),join(fixture,'scripts','app-version.mjs'));
  cpSync(join(root,'scripts','sync-app-version.mjs'),join(fixture,'scripts','sync-app-version.mjs'));
  writeFileSync(join(fixture,'package.json'),JSON.stringify({version},null,2));
  writeFileSync(join(fixture,'www','ux.js'),"const FABRI_CADABRA_VERSION='0.0.0'; // @generated from package.json by scripts/sync-app-version.mjs\n");
  writeFileSync(join(fixture,'android','app','build.gradle'),'android {\n  defaultConfig {\n    applicationId "com.fabricationpro.app"\n    versionCode 1\n    versionName "1.0"\n  }\n}\n');
  writeFileSync(join(fixture,'ios','App','App.xcodeproj','project.pbxproj'),'CURRENT_PROJECT_VERSION = 1;\nMARKETING_VERSION = 1.0;\nCURRENT_PROJECT_VERSION = 1;\nMARKETING_VERSION = 1.0;\n');

  const result=spawnSync(process.execPath,[join(fixture,'scripts','sync-app-version.mjs')],{cwd:fixture,encoding:'utf8'});
  need(result.status===0,`sync-app-version fixture failed: ${result.stderr || result.stdout}`);
  const fixtureUx=readFileSync(join(fixture,'www','ux.js'),'utf8');
  need(fixtureUx.includes(`FABRI_CADABRA_VERSION='${version}'`),'Browser fixture version was not synchronized.');
  const gradle=readFileSync(join(fixture,'android','app','build.gradle'),'utf8');
  need(new RegExp(`versionCode\\s+${expectedCode}\\b`).test(gradle),`Android fixture versionCode must be ${expectedCode}.`);
  need(gradle.includes(`versionName "${version}"`),`Android fixture versionName must be ${version}.`);
  const escapedVersion=version.replaceAll('.','\\.');
  const pbx=readFileSync(join(fixture,'ios','App','App.xcodeproj','project.pbxproj'),'utf8');
  need((pbx.match(new RegExp(`MARKETING_VERSION = ${escapedVersion};`,'g'))||[]).length===2,'All iOS MARKETING_VERSION fixture values must synchronize.');
  need((pbx.match(new RegExp(`CURRENT_PROJECT_VERSION = ${escapedVersion};`,'g'))||[]).length===2,'All iOS CURRENT_PROJECT_VERSION fixture values must synchronize.');
} finally {
  rmSync(fixture,{recursive:true,force:true});
}

const init=readFileSync(join(root,'scripts','native-init.mjs'),'utf8');
need(init.includes("['run', 'sync:version']"),'native:init must synchronize app version after Capacitor sync.');

const workflow=readFileSync(join(root,'..','.github','workflows','build-phone-installers.yml'),'utf8');
need((workflow.match(/npm run sync:version/g)||[]).length>=2,'Android and iOS installer jobs must synchronize native versions after cap sync.');
for (const marker of ['dump badging','versionCode','versionName','CFBundleShortVersionString','CFBundleVersion','com.fabricationpro.app']) {
  need(workflow.includes(marker),`Installer workflow must verify finished artifact metadata: missing ${marker}.`);
}

console.log(`Fabri-Cadabra ${version} app version synchronization contract: OK (Android versionCode ${expectedCode})`);
