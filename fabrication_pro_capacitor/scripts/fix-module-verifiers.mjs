import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root=resolve(import.meta.dirname,'..');
const path=join(root,'scripts','verify-shift-schedule-behavior.mjs');
let source=readFileSync(path,'utf8');
const need=(condition,message)=>{if(!condition)throw new Error(message);};

source=source.replace("import { readAppSource } from './app-module-manifest.mjs';\n",'');
source=source.replace(
  'const app=readAppSource(root);',
  "const app=fs.readFileSync(path.join(root,'www','app','shift-schedule.js'),'utf8');"
);
const oldBlock=`const startMarker='// @shift-schedule-core-start';
const endMarker='\\n  function showTaskLogStatus';
const start=app.indexOf(startMarker);
const end=app.indexOf(endMarker,start);
expect(start>=0 && end>start,'Shift Schedule engine block could not be isolated from app.js.');
const engineSource=app.slice(start,end);`;
const newBlock=`const startMarker='// @shift-schedule-core-start';
const start=app.indexOf(startMarker);
expect(start>=0,'Shift Schedule engine block could not be isolated from app/shift-schedule.js.');
const engineSource=app.slice(start);`;
need(source.includes(oldBlock),'Shift Schedule behavior verifier extraction block changed unexpectedly.');
source=source.replace(oldBlock,newBlock);
writeFileSync(path,source,'utf8');

console.log('Module-specific pure behavior verifiers migrated to focused feature sources.');
