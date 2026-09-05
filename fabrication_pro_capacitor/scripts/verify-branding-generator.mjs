import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root=process.cwd();
const applyPath=join(root,'scripts','apply-native-branding.mjs');
const source=readFileSync(applyPath,'utf8');
const syntax=spawnSync(process.execPath,['--check',applyPath],{encoding:'utf8'});
if(syntax.status!==0) throw new Error(`Native branding generator must parse successfully.\n${syntax.stderr||syntax.stdout}`);
const need=(needle,message)=>{if(!source.includes(needle)) throw new Error(message);};
const reject=(needle,message)=>{if(source.includes(needle)) throw new Error(message);};

need("const stagingPath=join(root,'assets');",'Branding generator must stage approved sources in the root assets directory that @capacitor/assets discovers.');
need('copyFileSync(join(assetPath,name),join(stagingPath,name))','Branding generator must copy approved icon/splash sources into the discovered assets directory.');
need('captureGeneratedIconState','Branding generator must snapshot native launcher resources before generation.');
need('assertGeneratedIconChanged','Branding generator must fail if native launcher resources were not actually replaced.');
reject("'--assetPath'",'Do not rely on the ignored --assetPath argument; production logs proved it did not reach the generator.');

console.log('Native branding generator syntax and failure-detection contract: OK');
