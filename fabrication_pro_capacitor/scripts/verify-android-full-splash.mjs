import { existsSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root=process.cwd();
const generatorPath=join(root,'scripts','apply-native-branding.mjs');
const generator=readFileSync(generatorPath,'utf8');
const need=(needle,message)=>{ if(!generator.includes(needle)) throw new Error(message); };

need('FULL_ANDROID_SPLASH_XML','Android branding must install the full branded artwork splash drawable.');
need("join(resDir,'drawable-nodpi','fabri_cadabra_launch.jpg')",'Android branding must install exactly one density-independent full launch image.');
need("copyFileSync(join(assetPath,'splash.jpg'),launchImage)",'Android branding must use the approved full Fabri-Cadabra splash artwork with the app name.');
need('@drawable/fabri_cadabra_launch','Android startup drawable must render the full branded launch artwork.');
need('android:gravity="fill"','Android startup drawable must fill the launch window with the full artwork.');

if(generator.includes('android:drawable="@mipmap/ic_launcher"')) throw new Error('Android splash must not use the small launcher icon.');

const sourcePath=join(root,'assets','native-branding','splash.jpg');
if(!existsSync(sourcePath)) throw new Error('Missing approved full Fabri-Cadabra splash artwork.');
if(statSync(sourcePath).size>800_000) throw new Error('Canonical Android splash source must remain optimized below 800 KB.');

console.log('Full branded Android splash contract: OK');
