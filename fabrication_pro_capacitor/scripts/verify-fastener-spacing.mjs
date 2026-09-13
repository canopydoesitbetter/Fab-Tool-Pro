import { readAppSource } from './app-module-manifest.mjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const root=process.cwd();
const app=readAppSource(root);
const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));

function requireMatch(source,pattern,message) {
  if (!pattern.test(source)) throw new Error(message);
}

const start='// @fastener-spacing-core-start';
const end='// @fastener-spacing-core-end';
const startIndex=app.indexOf(start);
const endIndex=app.indexOf(end);
if (startIndex<0 || endIndex<=startIndex) throw new Error('Fastener Spacing core markers are missing.');
const core=app.slice(startIndex+start.length,endIndex);
const context={};
vm.createContext(context);
vm.runInContext(`${core}\nthis.__fastenerSpacing={buildFastenerSpacingLayout,fastenerLayoutSignature};`,context);
const {buildFastenerSpacingLayout,fastenerLayoutSignature}=context.__fastenerSpacing;

const zeroTolerance=buildFastenerSpacingLayout(24,100,0);
if (zeroTolerance.spaces!==5 || zeroTolerance.fasteners!==6 || Math.abs(zeroTolerance.exactSpacing-20)>1e-9) throw new Error('Zero corner tolerance must preserve the existing whole-length spacing behavior.');
if (JSON.stringify(Array.from(zeroTolerance.positions))!==JSON.stringify([0,20,40,60,80,100])) throw new Error('Zero corner tolerance locations must still run from the true edge at 0 inches to the full length.');

const twoInchTolerance=buildFastenerSpacingLayout(24,100,2);
if (twoInchTolerance.usableSpan!==96 || twoInchTolerance.spaces!==4 || twoInchTolerance.fasteners!==5 || Math.abs(twoInchTolerance.exactSpacing-24)>1e-9) throw new Error('Corner tolerance must be removed from both ends before equal spacing is calculated.');
if (JSON.stringify(Array.from(twoInchTolerance.positions))!==JSON.stringify([2,26,50,74,98])) throw new Error('Fastener locations must remain true-edge measurements after applying corner tolerance.');

const unevenTolerance=buildFastenerSpacingLayout(24,100,3);
if (unevenTolerance.spaces!==4 || Math.abs(unevenTolerance.exactSpacing-23.5)>1e-9) throw new Error('Fastener spacing must stay at or below Max Spacing inside the tolerance-adjusted usable span.');
if (Math.abs(unevenTolerance.positions[0]-3)>1e-9 || Math.abs(unevenTolerance.positions.at(-1)-97)>1e-9) throw new Error('The first and last fasteners must sit exactly at the same corner tolerance from their respective ends.');

if (fastenerLayoutSignature(twoInchTolerance)!==fastenerLayoutSignature(buildFastenerSpacingLayout(24,100,2))) throw new Error('Identical fastener layouts must produce a stable signature so progress can be preserved.');
if (fastenerLayoutSignature(twoInchTolerance)===fastenerLayoutSignature(unevenTolerance)) throw new Error('Different fastener layouts must produce different signatures so stale progress is reset.');

requireMatch(app,/const\s+FASTENER_SPACING_STORE_ID\s*=\s*['"]fastenerSpacing['"]\s*;/,'Fastener Spacing must use its own persistent-store registry id.');
requireMatch(app,/const\s+FASTENER_SPACING_STATE_KEY\s*=\s*['"]fabricationFastenerSpacingV1['"]\s*;/,'Fastener Spacing must use its own versioned persistent storage key.');
for (const marker of [
  'cornerTolerance',
  'Corner Tolerance',
  'saveFastenerSpacingState',
  'restoreFastenerSpacingState',
  'registerPersistentStore',
  'loadPersistentStore(FASTENER_SPACING_STORE_ID)',
  'writePersistentStore(FASTENER_SPACING_STORE_ID',
  'data-fastener-index',
  'aria-pressed',
  'fastener-complete',
  'fastener-progress',
  'fastenerProgressText',
  'fastenerProgressFill',
  'updateFastenerProgress'
]) {
  if (!app.includes(marker)) throw new Error(`Fastener Spacing persistence/selection/progress contract is missing: ${marker}`);
}
requireMatch(app,/cornerTolerance\s*\*\s*2\s*>=\s*length/,'Corner Tolerance must be validated so the two end tolerances cannot consume the full part length.');
requireMatch(app,/layoutSignature\s*!==\s*fastenerProgressSignature/,'Completed fastener progress must reset when the calculated layout changes.');
requireMatch(app,/selectedFastenerIndexes\.has\(i\)/,'Rendered fastener boxes must restore their completed state by index.');
requireMatch(app,/selectedFastenerIndexes\.(add|delete)\(/,'Tapping a fastener box must toggle its completed state.');
requireMatch(app,/writePersistentStore\(FASTENER_SPACING_STORE_ID\s*,\s*defaultFastenerSpacingState\(\)\)/,'Clear must wipe the saved Fastener Spacing workspace and completed progress.');
requireMatch(app,/fastenerProgressFill\.style\.width\s*=/,'The completion progress bar must update its fill width from current fastener progress.');
requireMatch(app,/role=["']progressbar["']/,'The completion display must expose progressbar semantics for assistive technology.');
requireMatch(app,/aria-valuemax=["']0["'][^>]*aria-valuenow=["']0["']/,'The completion progress bar must expose numeric progress values.');
if (app.includes("diagramEl.innerHTML = '<div class=\"rail\"></div>'") || app.includes('data-fastener-dot')) throw new Error('The old rail-and-dot fastener diagram must be replaced by the completion progress display.');
if (!String(pkg.scripts?.['verify:fastener-spacing'] || '').includes('verify-fastener-spacing.mjs')) throw new Error('package.json must expose verify:fastener-spacing.');
if (!String(pkg.scripts?.verify || '').includes('npm run verify:fastener-spacing')) throw new Error('Aggregate npm run verify must include the Fastener Spacing regression test.');

console.log('Fastener Spacing corner tolerance, selectable progress, persistence, and completion display contract: OK');
