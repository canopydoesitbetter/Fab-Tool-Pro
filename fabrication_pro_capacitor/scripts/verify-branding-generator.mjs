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
need('captureGeneratedIconState','Branding generator must snapshot native launcher resources before generation.');
need('assertGeneratedIconChanged','Branding generator must fail if native launcher resources were not actually replaced.');
need('PrepareSquareSplash.java','Branding generator must prepare the required square Capacitor splash source from the approved portrait artwork at build time.');
need("approved-launch-source.jpg",'Branding generator must use the approved portrait launch artwork as the canonical splash source.');
need("copyFileSync(join(stagingPath,'splash.jpg'),join(stagingPath,'splash-dark.jpg'));",'Light and dark generated splash inputs must come from the same approved portrait artwork.');
need('installFullAndroidSplash','Android branding must replace generated splash variants with one full branded launch image.');
need("entry.name.startsWith('drawable')",'Android splash optimizer must inspect all drawable density/night directories.');
need("/^splash\\.(?:png|jpe?g|webp|xml)$/i",'Android splash optimizer must remove every generated splash resource variant.');
need("copyFileSync(approvedLaunchPath,launchImage);",'Android launch screen must package the approved portrait artwork directly without a recrop or re-encode.');
need("writeFileSync(join(drawableDir,'splash.xml'),FULL_ANDROID_SPLASH_XML);",'Android branding must install one XML splash resource.');
need('@drawable/fabri_cadabra_launch','Android splash XML must reference the full branded launch image.');
need('assertSingleAndroidSplash','Android branding must verify one optimized branded splash before Gradle packaging.');
reject('CropAndroidLaunchImage.java','Android branding must no longer recover the portrait artwork by cropping a square derivative.');
reject('android:drawable="@mipmap/ic_launcher"','Android splash must not use the small launcher icon.');
reject("'--assetPath'",'Do not rely on the ignored --assetPath argument; production logs proved it did not reach the generator.');

console.log('Native branding generator syntax, launcher replacement, build-time splash preparation, and exact portrait Android splash contract: OK');
