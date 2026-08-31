import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const path=join(process.cwd(),'www','styles.css');
let styles=readFileSync(path,'utf8');
const before='    :where(\n      .tool-panel > .card,';
const after='    :is(\n      .tool-panel > .card,';
const occurrences=styles.split(before).length-1;
if(occurrences!==1) throw new Error(`Expected exactly one outer-panel :where selector; found ${occurrences}.`);
styles=styles.replace(before,after);
writeFileSync(path,styles);
console.log('Replaced zero-specificity outer-panel :where() selector with :is().');
