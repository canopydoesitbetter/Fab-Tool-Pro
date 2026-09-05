import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root=process.cwd();
const generatorPath=join(root,'scripts','apply-native-branding.mjs');
const generator=readFileSync(generatorPath,'utf8');
const need=(needle,message)=>{ if(!generator.includes(needle)) throw new Error(message); };

need("approved-launch-portrait.webp",'Android branding must use the approved full portrait launch artwork source.');
need("fabri_cadabra_launch.webp",'Android branding must install one optimized full-screen launch image.');
need('@drawable/fabri_cadabra_launch','Android splash drawable must render the full portrait launch artwork.');
need('android:gravity="fill"','Android startup drawable must fill the launch window with the full artwork.');

const oldIconSplash='android:drawable="@mipmap/ic_launcher"';
if(generator.includes(oldIconSplash)) throw new Error('Android splash must not fall back to the small launcher icon.');

const portraitPath=join(root,'assets','native-branding','approved-launch-portrait.webp');
if(!existsSync(portraitPath)) throw new Error('Missing approved full portrait Android launch artwork.');
if(statSync(portraitPath).size>400_000) throw new Error('Approved Android launch artwork must remain optimized below 400 KB.');

console.log('Full portrait Android splash contract: OK');
