import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const styles=readFileSync(join(process.cwd(),'www','styles.css'),'utf8');
const marker='border:2px solid var(--panel-border-inner);';
const markerIndex=styles.indexOf(marker);
if(markerIndex<0) throw new Error('Outer-panel 2px inner border marker is missing.');

const openBrace=styles.lastIndexOf('{',markerIndex);
const previousClose=styles.lastIndexOf('}',openBrace);
const closeBrace=styles.indexOf('}',markerIndex);
const selector=styles.slice(previousClose+1,openBrace).trim();
const panelBlock=styles.slice(openBrace,closeBrace+1);

for(const required of [
  '.tool-panel > .card',
  '.tool-panel > .result',
  '.tool-panel > .tasklog-workspace > .card',
  '.tool-panel > .notes-workspace > .card',
  '.tool-panel > .checklist-workspace > .card'
]) {
  if(!selector.includes(required)) throw new Error(`Outer-panel double-border selector missing: ${required}`);
}
if(selector.includes(':where(')) throw new Error('Outer-panel double-border selector cannot use zero-specificity :where().');
for(const marker of [
  '0 0 0 2px var(--card)',
  '0 0 0 3px var(--panel-border-outer)',
  'var(--panel-depth)'
]) {
  if(!panelBlock.includes(marker)) throw new Error(`Outer-panel double-border geometry missing: ${marker}`);
}
if(panelBlock.includes('panel-pencil')) throw new Error('Legacy triple-pencil panel treatment must be removed.');

for(const marker of [
  '--button-edge:',
  '--button-depth:',
  '--button-hover-depth:',
  '--button-press-depth:',
  'box-shadow:0 3px 0 var(--button-edge),var(--button-depth);',
  'transform:translateY(-2px)',
  'box-shadow:0 5px 0 var(--button-edge),var(--button-hover-depth);',
  'transform:translateY(2px) scale(.97)',
  'box-shadow:0 1px 0 var(--button-edge),var(--button-press-depth);',
  '@media (prefers-reduced-motion: reduce)'
]) {
  if(!styles.includes(marker)) throw new Error(`Pronounced tactile button styling missing: ${marker}`);
}

console.log('Outer-panel double-border geometry and pronounced button styling: OK');
