import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function parseAppVersion(value) {
  const version=String(value || '').trim();
  const match=version.match(/^(\d+)\.(\d+)\.(\d+)(?:[-+][0-9A-Za-z.-]+)?$/);
  if (!match) throw new Error(`Invalid app version: ${version || 'missing'}`);

  const major=Number(match[1]);
  const minor=Number(match[2]);
  const patch=Number(match[3]);
  if (minor>999 || patch>999) {
    throw new Error('Minor and patch versions must each be <= 999 for Android versionCode mapping.');
  }
  return {version,major,minor,patch};
}

export function androidVersionCode(value) {
  const {major,minor,patch}=parseAppVersion(value);
  const code=(major*1_000_000)+(minor*1_000)+patch;
  if (!Number.isSafeInteger(code) || code<1 || code>2_100_000_000) {
    throw new Error(`Android versionCode ${code} is outside the supported range.`);
  }
  return code;
}

function writeChanged(path,next,current) {
  if (next!==current) writeFileSync(path,next,'utf8');
  return next!==current;
}

export function syncAndroidVersion(root,value) {
  const path=join(root,'android','app','build.gradle');
  if (!existsSync(path)) return {present:false,changed:false};

  const code=androidVersionCode(value);
  const source=readFileSync(path,'utf8');
  if (!/\bversionCode\s+\d+\b/.test(source)) {
    throw new Error('Android build.gradle versionCode setting was not found.');
  }
  if (!/\bversionName\s+["'][^"']+["']/.test(source)) {
    throw new Error('Android build.gradle versionName setting was not found.');
  }

  const next=source
    .replace(/(\bversionCode\s+)\d+\b/,`$1${code}`)
    .replace(/(\bversionName\s+)["'][^"']+["']/,`$1"${value}"`);
  return {present:true,changed:writeChanged(path,next,source),code};
}

export function syncIosVersion(root,value) {
  parseAppVersion(value);
  const path=join(root,'ios','App','App.xcodeproj','project.pbxproj');
  if (!existsSync(path)) return {present:false,changed:false};

  const source=readFileSync(path,'utf8');
  const marketingCount=(source.match(/\bMARKETING_VERSION\s*=\s*[^;]+;/g)||[]).length;
  const buildCount=(source.match(/\bCURRENT_PROJECT_VERSION\s*=\s*[^;]+;/g)||[]).length;
  if (!marketingCount) throw new Error('iOS MARKETING_VERSION setting was not found.');
  if (!buildCount) throw new Error('iOS CURRENT_PROJECT_VERSION setting was not found.');

  const next=source
    .replace(/\bMARKETING_VERSION\s*=\s*[^;]+;/g,`MARKETING_VERSION = ${value};`)
    .replace(/\bCURRENT_PROJECT_VERSION\s*=\s*[^;]+;/g,`CURRENT_PROJECT_VERSION = ${value};`);
  return {present:true,changed:writeChanged(path,next,source),marketingCount,buildCount};
}
