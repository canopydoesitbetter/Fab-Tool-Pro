import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root=process.cwd();
const packagePath=join(root,'package.json');
const uxPath=join(root,'www','ux.js');
const pkg=JSON.parse(readFileSync(packagePath,'utf8'));
const version=String(pkg.version || '').trim();

if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`package.json contains an invalid app version: ${version || 'missing'}`);
}

const source=readFileSync(uxPath,'utf8');
const marker=/const FABRI_CADABRA_VERSION='[^']+'; \/\/ @generated from package\.json by scripts\/sync-app-version\.mjs/;
if (!marker.test(source)) throw new Error('FABRI_CADABRA_VERSION generated marker is missing from www/ux.js.');

const next=source.replace(marker,`const FABRI_CADABRA_VERSION='${version}'; // @generated from package.json by scripts/sync-app-version.mjs`);
if (next!==source) writeFileSync(uxPath,next,'utf8');
console.log(`Fabri-Cadabra browser version synchronized from package.json: ${version}`);
