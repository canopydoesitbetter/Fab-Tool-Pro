import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const root=process.cwd();
const assetPath=join(root,'assets','native-branding');
const stagingPath=join(root,'assets');
const required=['icon-only.jpg','icon-foreground.jpg','icon-background.jpg','splash.jpg','splash-dark.jpg'];
const FULL_ANDROID_SPLASH_XML=`<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
  <item>
    <bitmap android:src="@drawable/fabri_cadabra_launch" android:gravity="fill" />
  </item>
</layer-list>
`;

for(const name of required){
  if(!existsSync(join(assetPath,name))){
    console.error(`Missing Fabri-Cadabra native branding asset: ${name}`);
    process.exit(1);
  }
}

function hashFile(path){
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function walkFiles(dir){
  if(!existsSync(dir)) return [];
  const files=[];
  for(const entry of readdirSync(dir,{withFileTypes:true})){
    const path=join(dir,entry.name);
    if(entry.isDirectory()) files.push(...walkFiles(path));
    else if(entry.isFile()) files.push(path);
  }
  return files;
}

function captureGeneratedIconState(platform){
  const base=platform==='android'
    ? join(root,'android','app','src','main','res')
    : join(root,'ios','App','App','Assets.xcassets','AppIcon.appiconset');
  const files=walkFiles(base).filter(path=>platform==='ios' || /ic_launcher/i.test(path));
  return files.sort().map(path=>`${relative(base,path)}:${hashFile(path)}`).join('\n');
}

function assertGeneratedIconChanged(platform,before){
  const after=captureGeneratedIconState(platform);
  if(!after){
    throw new Error(`No generated ${platform} launcher icon resources were found after branding.`);
  }
  if(after===before){
    throw new Error(`Fabri-Cadabra ${platform} launcher icon resources were not replaced; refusing to build with default Capacitor branding.`);
  }
}

function installFullAndroidSplash(){
  const resDir=join(root,'android','app','src','main','res');
  if(!existsSync(resDir)) throw new Error('Android resources are missing; cannot install Fabri-Cadabra splash.');
  for(const entry of readdirSync(resDir,{withFileTypes:true})){
    if(!entry.isDirectory() || !entry.name.startsWith('drawable')) continue;
    const drawableVariant=join(resDir,entry.name);
    for(const file of readdirSync(drawableVariant,{withFileTypes:true})){
      if(file.isFile() && /^splash\.(?:png|jpe?g|webp|xml)$/i.test(file.name)) rmSync(join(drawableVariant,file.name),{force:true});
    }
  }
  const drawableDir=join(resDir,'drawable');
  const nodpiDir=join(resDir,'drawable-nodpi');
  mkdirSync(drawableDir,{recursive:true});
  mkdirSync(nodpiDir,{recursive:true});
  const launchImage=join(resDir,'drawable-nodpi','fabri_cadabra_launch.jpg');
  copyFileSync(join(assetPath,'splash.jpg'),launchImage);
  writeFileSync(join(drawableDir,'splash.xml'),FULL_ANDROID_SPLASH_XML);
}

function assertSingleAndroidSplash(){
  const resDir=join(root,'android','app','src','main','res');
  const generatedRaster=walkFiles(resDir).filter(path=>/[\\/]drawable[^\\/]*[\\/]splash\.(?:png|jpe?g|webp)$/i.test(path));
  if(generatedRaster.length){
    throw new Error(`Redundant Android raster splash resources remain: ${generatedRaster.map(path=>relative(resDir,path)).join(', ')}`);
  }
  const launchImage=join(resDir,'drawable-nodpi','fabri_cadabra_launch.jpg');
  const splashXml=join(resDir,'drawable','splash.xml');
  if(!existsSync(launchImage)) throw new Error('Full Fabri-Cadabra Android launch artwork was not installed.');
  if(!existsSync(splashXml)) throw new Error('Android splash.xml was not installed.');
}

const platforms=[];
if(process.argv.includes('--android')) platforms.push('android');
if(process.argv.includes('--ios')) platforms.push('ios');
if(platforms.length===0){
  if(existsSync(join(root,'android'))) platforms.push('android');
  if(existsSync(join(root,'ios'))) platforms.push('ios');
}
const before=new Map(platforms.map(platform=>[platform,captureGeneratedIconState(platform)]));

const backups=new Map();
for(const name of required){
  const target=join(stagingPath,name);
  backups.set(target,existsSync(target)?readFileSync(target):null);
  copyFileSync(join(assetPath,name),join(stagingPath,name));
}

let result;
try{
  const args=['--yes','@capacitor/assets@3.0.5','generate'];
  if(process.argv.includes('--android')) args.push('--android');
  if(process.argv.includes('--ios')) args.push('--ios');
  const executable=process.platform==='win32'?'npx.cmd':'npx';
  result=spawnSync(executable,args,{cwd:root,stdio:'inherit',shell:false});
} finally {
  for(const [target,original] of backups){
    if(original===null) rmSync(target,{force:true});
    else writeFileSync(target,original);
  }
}

if(result?.status!==0) process.exit(result?.status??1);
for(const platform of platforms) assertGeneratedIconChanged(platform,before.get(platform));
if(platforms.includes('android')){
  installFullAndroidSplash();
  assertSingleAndroidSplash();
}
console.log('Fabri-Cadabra native icon generated, launcher replacement verified, and full Android splash artwork installed without redundant density variants.');
