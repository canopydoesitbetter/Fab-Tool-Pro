import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const styles=readFileSync(join(process.cwd(),'www','styles.css'),'utf8');
const marker='border-color:var(--panel-pencil);';
const markerIndex=styles.indexOf(marker);
if(markerIndex<0) throw new Error('Outer-panel pencil style marker is missing.');

const openBrace=styles.lastIndexOf('{',markerIndex);
const previousClose=styles.lastIndexOf('}',openBrace);
const selector=styles.slice(previousClose+1,openBrace).trim();

for(const required of [
  '.tool-panel > .card',
  '.tool-panel > .result',
  '.tool-panel > .tasklog-workspace > .card',
  '.tool-panel > .notes-workspace > .card',
  '.tool-panel > .checklist-workspace > .card'
]) {
  if(!selector.includes(required)) throw new Error(`Outer-panel pencil selector missing: ${required}`);
}

if(selector.includes(':where(')) {
  throw new Error('Outer-panel pencil selector cannot use :where(), because zero specificity allows the base .card/.result styling to override the intended pencil border and layered shadow.');
}

console.log('Outer-panel pencil CSS cascade specificity: OK');
