import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root=process.cwd();
const saw=readFileSync(join(root,'www','app','saw-optimizer.js'),'utf8');
const need=(condition,message)=>{if(!condition) throw new Error(message);};

need(saw.includes('const MAX_SAW_LABEL_LENGTH = 120;'),'Saw Optimizer must own a 120-character label-length constant.');
need(!saw.includes('MAX_OPTIMIZER_LABEL_LENGTH'),'Saw Optimizer must not depend on the Sheet Optimizer label-length constant.');
need(saw.includes('label.length>MAX_SAW_LABEL_LENGTH'),'Saw import/add validation must use the Saw-owned label limit.');
need(saw.includes('${MAX_SAW_LABEL_LENGTH} characters'),'Saw label-limit messages must use the Saw-owned constant.');

console.log('Saw Optimizer owns its 120-character label-length contract: OK');
