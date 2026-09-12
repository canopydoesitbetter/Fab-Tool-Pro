import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root=resolve(import.meta.dirname,'..');
const need=(condition,message)=>{if(!condition)throw new Error(message)};
const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
const verify=pkg.scripts?.verify || '';
const commands=verify.split('&&').map((command)=>command.trim()).filter(Boolean);

need(commands.includes('npm run verify:read-only'),'Aggregate verify must include verify:read-only.');
need(!commands.includes('npm run sync:version'),'npm run verify must be read-only; sync:version must be run explicitly by version/build workflows, not by verification.');

console.log('Read-only verification contract: OK (aggregate verify contains no mutating version sync)');
