import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root=resolve(import.meta.dirname,'..');
const relative='scripts/verify-shift-schedule-behavior.mjs';
const path=join(root,relative);
let source=readFileSync(path,'utf8');

function replaceExact(before,after,label) {
  const count=source.split(before).length-1;
  if (count!==1) throw new Error(`${relative}: expected exactly one ${label} match, found ${count}`);
  source=source.replace(before,after);
}

replaceExact(
  "const app=fs.readFileSync(path.join(root,'www','app','shift-schedule.js'),'utf8');",
  "const storageEngine=fs.readFileSync(path.join(root,'www','app','storage.js'),'utf8');\nconst app=fs.readFileSync(path.join(root,'www','app','shift-schedule.js'),'utf8');",
  'storage engine source'
);
replaceExact(
  "const engineSource=app.slice(start);",
  "const engineSource=storageEngine+'\\n'+app.slice(start);",
  'combined harness source'
);

writeFileSync(path,source);
console.log('Shift Schedule behavior harness now evaluates the real central storage engine.');
