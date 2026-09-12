import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readAppSource } from './app-module-manifest.mjs';

const root=resolve(import.meta.dirname,'..');
const repoRoot=resolve(root,'..');
const need=(condition,message)=>{if(!condition)throw new Error(message);};
const releasePath=join(root,'release.json');

need(existsSync(releasePath),'Release continuity contract: missing release.json. Public releases require explicit version/build metadata.');

const release=JSON.parse(readFileSync(releasePath,'utf8'));
const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
const html=readFileSync(join(root,'www','index.html'),'utf8');
const app=readAppSource(root);
const appVersion=readFileSync(join(root,'scripts','app-version.mjs'),'utf8');
const syncVersion=readFileSync(join(root,'scripts','sync-app-version.mjs'),'utf8');
const workflow=readFileSync(join(repoRoot,'.github','workflows','build-phone-installers.yml'),'utf8');

const semver=value=>{
  const match=String(value || '').match(/^(\d+)\.(\d+)\.(\d+)$/);
  need(match,`Release continuity contract: invalid semantic version ${value || 'missing'}.`);
  return {major:Number(match[1]),minor:Number(match[2]),patch:Number(match[3])};
};

const version=String(release.version || '');
const previousVersion=String(release.previousVersion || '');
const current=semver(version);
const previous=semver(previousVersion);
need(pkg.version===version,`Release continuity contract: package.json ${pkg.version} must match release.json ${version}.`);
need(Number.isInteger(release.buildNumber) && release.buildNumber>=1000006,'Release continuity contract: buildNumber must be an integer >= 1000006 so native installs never downgrade the already-shipped build.');
need(previous.major===current.major && previous.minor===current.minor && previous.patch===current.patch-1,`Release continuity contract: ${previousVersion} must be the immediately preceding patch release before ${version}.`);
need(app.includes(`const FABRI_CADABRA_VERSION='${version}'; // @generated from package.json by scripts/sync-app-version.mjs`),'Release continuity contract: browser version marker must match the public release version.');

const changelogVersions=Array.from(html.matchAll(/data-changelog-version=['"]([^'"]+)['"]/g),match=>match[1]);
need(changelogVersions.length>=2,'Release continuity contract: changelog must contain the current and previous releases.');
need(changelogVersions[0]===version,`Release continuity contract: first changelog release must be explicit version ${version}, found ${changelogVersions[0] || 'none'}.`);
need(changelogVersions[1]===previousVersion,`Release continuity contract: ${previousVersion} must immediately follow ${version} in the changelog.`);
need(!changelogVersions.includes('current'),'Release continuity contract: changelog must use explicit release versions, not data-changelog-version="current".');
need(new Set(changelogVersions).size===changelogVersions.length,'Release continuity contract: duplicate changelog versions are not allowed.');
for (let index=1;index<changelogVersions.length;index+=1) {
  const newer=semver(changelogVersions[index-1]);
  const older=semver(changelogVersions[index]);
  const newerNumber=(newer.major*1_000_000)+(newer.minor*1_000)+newer.patch;
  const olderNumber=(older.major*1_000_000)+(older.minor*1_000)+older.patch;
  need(newerNumber>olderNumber,`Release continuity contract: changelog must remain newest-first (${changelogVersions[index-1]} before ${changelogVersions[index]}).`);
}
need(html.includes(`Version ${version}`),'Release continuity contract: visible current changelog version must match release.json.');

need(/syncAndroidVersion\s*\(root,value,buildNumber\)/.test(appVersion),'Release continuity contract: Android sync must accept an independent native build number.');
need(/syncIosVersion\s*\(root,value,buildNumber\)/.test(appVersion),'Release continuity contract: iOS sync must accept an independent native build number.');
need(syncVersion.includes("join(root,'release.json')") && syncVersion.includes('buildNumber'),'Release continuity contract: sync-app-version must read independent build metadata from release.json.');
need(workflow.includes('EXPECTED_BUILD_NUMBER') && workflow.includes('release.json'),'Release continuity contract: installer verification must validate the independent native build number from release.json.');
need(!workflow.includes('androidVersionCode(pkg.version)'),'Release continuity contract: installer workflow must not derive Android build identity from the public version.');

console.log(`Release continuity contract: OK (${version}, native build ${release.buildNumber}, previous ${previousVersion})`);
