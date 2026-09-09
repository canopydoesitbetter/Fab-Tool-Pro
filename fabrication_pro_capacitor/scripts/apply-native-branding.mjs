import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const root=process.cwd();
const assetPath=join(root,'assets','native-branding');
const stagingPath=join(root,'assets');
const iconSources=['icon-only.jpg','icon-foreground.jpg','icon-background.jpg'];
const approvedLaunchPath=join(assetPath,'approved-launch-source.jpg');
const FULL_ANDROID_SPLASH_XML=`<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
  <item>
    <bitmap android:src="@drawable/fabri_cadabra_launch" android:gravity="fill" />
  </item>
</layer-list>
`;

for(const name of iconSources){
  if(!existsSync(join(assetPath,name))){
    console.error(`Missing Fabri-Cadabra native branding asset: ${name}`);
    process.exit(1);
  }
}
if(!existsSync(approvedLaunchPath)){
  console.error('Missing approved Fabri-Cadabra launch artwork.');
  process.exit(1);
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

function prepareSquareSplash(output){
  const preparer=join(root,'scripts','PrepareSquareSplash.java');
  const result=spawnSync('java',['-Djava.awt.headless=true',preparer,approvedLaunchPath,output],{cwd:root,stdio:'inherit',shell:false});
  if(result.status!==0) throw new Error(`Fabri-Cadabra square splash preparation failed with status ${result.status ?? 'unknown'}.`);
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
  const launchImage=join(nodpiDir,'fabri_cadabra_launch.jpg');
  copyFileSync(approvedLaunchPath,launchImage);
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
  if(hashFile(launchImage)!==hashFile(approvedLaunchPath)) throw new Error('Android launch artwork must match the approved portrait source exactly.');
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

const stagedNames=[...iconSources,'splash.jpg','splash-dark.jpg'];
const backups=new Map();
for(const name of stagedNames){
  const target=join(stagingPath,name);
  backups.set(target,existsSync(target)?readFileSync(target):null);
}
for(const name of iconSources) copyFileSync(join(assetPath,name),join(stagingPath,name));
prepareSquareSplash(join(stagingPath,'splash.jpg'));
copyFileSync(join(stagingPath,'splash.jpg'),join(stagingPath,'splash-dark.jpg'));

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
console.log('Fabri-Cadabra native icons generated from the approved icon artwork, iOS splash assets prepared from the approved portrait launch art, and Android launch artwork installed byte-for-byte without redundant density variants.');
