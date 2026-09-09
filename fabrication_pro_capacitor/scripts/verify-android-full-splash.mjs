import { existsSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root=process.cwd();
const generatorPath=join(root,'scripts','apply-native-branding.mjs');
const preparerPath=join(root,'scripts','PrepareSquareSplash.java');
const generator=readFileSync(generatorPath,'utf8');
const need=(needle,message)=>{ if(!generator.includes(needle)) throw new Error(message); };

need('FULL_ANDROID_SPLASH_XML','Android branding must install the full branded artwork splash drawable.');
need("join(nodpiDir,'fabri_cadabra_launch.jpg')",'Android branding must install exactly one density-independent full launch image.');
need("approved-launch-source.jpg",'Android splash must be sourced from the approved portrait artwork.');
need("copyFileSync(approvedLaunchPath,launchImage);",'Android splash must copy the approved portrait artwork byte-for-byte.');
need('@drawable/fabri_cadabra_launch','Android startup drawable must render the full branded launch artwork.');
need('android:gravity="fill"','Android startup drawable must fill the launch window with the full artwork.');
need('hashFile(launchImage)!==hashFile(approvedLaunchPath)','Android branding must verify that the packaged launch image matches the approved portrait bytes.');

if(generator.includes('android:drawable="@mipmap/ic_launcher"')) throw new Error('Android splash must not use the small launcher icon.');
if(generator.includes('CropAndroidLaunchImage.java')) throw new Error('Android splash must not be reconstructed from a cropped square derivative.');
if(!existsSync(preparerPath)) throw new Error('Missing build-time square splash preparer for Capacitor/iOS generation.');
const preparer=readFileSync(preparerPath,'utf8');
if(!preparer.includes('TARGET_SIZE = 2732')) throw new Error('Capacitor splash preparer must create a 2732x2732 source.');
if(!preparer.includes('Math.min(TARGET_SIZE / (double) source.getWidth(), TARGET_SIZE / (double) source.getHeight())')) throw new Error('Splash preparer must preserve the portrait artwork aspect ratio.');

const sourcePath=join(root,'assets','native-branding','approved-launch-source.jpg');
if(!existsSync(sourcePath)) throw new Error('Missing approved full Fabri-Cadabra portrait splash artwork.');
if(statSync(sourcePath).size>800_000) throw new Error('Canonical Android splash source must remain optimized below 800 KB.');

console.log('Exact portrait Android splash and build-time Capacitor splash preparation contract: OK');
