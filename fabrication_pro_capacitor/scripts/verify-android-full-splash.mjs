import { existsSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root=process.cwd();
const generatorPath=join(root,'scripts','apply-native-branding.mjs');
const cropperPath=join(root,'scripts','CropAndroidLaunchImage.java');
const generator=readFileSync(generatorPath,'utf8');
const need=(needle,message)=>{ if(!generator.includes(needle)) throw new Error(message); };

need('FULL_ANDROID_SPLASH_XML','Android branding must install the full branded artwork splash drawable.');
need("join(resDir,'drawable-nodpi','fabri_cadabra_launch.jpg')",'Android branding must install exactly one density-independent full launch image.');
need('CropAndroidLaunchImage.java','Android branding must crop the canonical square source back to the true portrait artwork before packaging.');
need('@drawable/fabri_cadabra_launch','Android startup drawable must render the full branded launch artwork.');
need('android:gravity="fill"','Android startup drawable must fill the launch window with the full artwork.');

if(generator.includes('android:drawable="@mipmap/ic_launcher"')) throw new Error('Android splash must not use the small launcher icon.');
if(generator.includes("copyFileSync(join(assetPath,'splash.jpg'),launchImage)")) throw new Error('Android splash must not package the square padded source directly.');
if(!existsSync(cropperPath)) throw new Error('Missing Android portrait splash cropper.');
const cropper=readFileSync(cropperPath,'utf8');
if(!cropper.includes('941.0 / 1672.0')) throw new Error('Android splash cropper must preserve the approved portrait artwork aspect ratio.');
if(!cropper.includes('getSubimage')) throw new Error('Android splash cropper must remove square side padding without stretching the artwork.');

const sourcePath=join(root,'assets','native-branding','splash.jpg');
if(!existsSync(sourcePath)) throw new Error('Missing approved full Fabri-Cadabra splash artwork.');
if(statSync(sourcePath).size>800_000) throw new Error('Canonical Android splash source must remain optimized below 800 KB.');

console.log('Full portrait Android splash contract: OK');
