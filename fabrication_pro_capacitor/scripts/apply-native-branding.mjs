import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root=process.cwd();
const assetPath=join(root,'assets','native-branding');
const required=['icon-only.jpg','icon-foreground.jpg','icon-background.jpg','splash.jpg','splash-dark.jpg'];
for(const name of required){
  if(!existsSync(join(assetPath,name))){
    console.error(`Missing Fabri-Cadabra native branding asset: ${name}`);
    process.exit(1);
  }
}
const args=['--yes','@capacitor/assets@3.0.5','generate','--assetPath',assetPath];
if(process.argv.includes('--android')) args.push('--android');
if(process.argv.includes('--ios')) args.push('--ios');
const executable=process.platform==='win32'?'npx.cmd':'npx';
const result=spawnSync(executable,args,{cwd:root,stdio:'inherit',shell:false});
if(result.status!==0) process.exit(result.status??1);
console.log('Fabri-Cadabra native icon and launch screen generated.');
