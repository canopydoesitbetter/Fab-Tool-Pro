import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root=process.cwd();
const repoRoot=join(root,'..');
const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
const ux=readFileSync(join(root,'www','ux.js'),'utf8');
const nativeInit=readFileSync(join(root,'scripts','native-init.mjs'),'utf8');
const installerWorkflow=readFileSync(join(repoRoot,'.github','workflows','build-phone-installers.yml'),'utf8');

function requireText(source,text,message) {
  if (!source.includes(text)) throw new Error(message);
}

function pngSize(path) {
  const bytes=readFileSync(path);
  if (bytes.length<24 || bytes.toString('hex',0,8)!=='89504e470d0a1a0a') throw new Error(`${path} is not a valid PNG.`);
  return { width:bytes.readUInt32BE(16), height:bytes.readUInt32BE(20) };
}

function requirePng(relativePath,{minWidth,minHeight,square=false,minBytes=1}) {
  const path=join(root,relativePath);
  if (!existsSync(path)) throw new Error(`Missing branding source asset: ${relativePath}`);
  const {width,height}=pngSize(path);
  if (width<minWidth || height<minHeight) throw new Error(`${relativePath} must be at least ${minWidth}x${minHeight}; got ${width}x${height}.`);
  if (square && width!==height) throw new Error(`${relativePath} must be square; got ${width}x${height}.`);
  if (statSync(path).size<minBytes) throw new Error(`${relativePath} is unexpectedly small and may not contain the approved artwork.`);
}

requirePng('assets/icon-only.png',{minWidth:1024,minHeight:1024,square:true,minBytes:500_000});
requirePng('assets/icon-foreground.png',{minWidth:1024,minHeight:1024,square:true,minBytes:1_000});
requirePng('assets/icon-background.png',{minWidth:1024,minHeight:1024,square:true,minBytes:500_000});
requirePng('assets/splash.png',{minWidth:2732,minHeight:2732,minBytes:500_000});
requirePng('assets/splash-dark.png',{minWidth:2732,minHeight:2732,minBytes:500_000});

if (pkg.version!=='1.0.4') throw new Error(`v1.0.4 branding release must set package.json to 1.0.4; got ${pkg.version}.`);
requireText(String(pkg.scripts?.['verify:app-branding'] || ''),'verify-app-branding.mjs','package.json must expose verify:app-branding.');
requireText(String(pkg.scripts?.verify || ''),'npm run verify:app-branding','Aggregate npm run verify must include verify:app-branding.');

requireText(nativeInit,'@capacitor/assets@3.0.5','native:init must regenerate the branded native icon and splash resources.');
requireText(nativeInit,"'--assetPath', 'assets'",'native:init must explicitly use the canonical assets directory.');

const androidGenerate="npx -y @capacitor/assets@3.0.5 generate --android --assetPath assets";
const iosGenerate="npx -y @capacitor/assets@3.0.5 generate --ios --assetPath assets";
requireText(installerWorkflow,androidGenerate,'Android installer workflow must generate Fabri-Cadabra branding assets after creating the native project.');
requireText(installerWorkflow,iosGenerate,'iPhone installer workflow must generate Fabri-Cadabra branding assets after creating the native project.');
if (!(installerWorkflow.indexOf(androidGenerate)>installerWorkflow.indexOf('npx cap sync android'))) throw new Error('Android branding generation must happen after the Android native project is added and synced.');
if (!(installerWorkflow.indexOf(iosGenerate)>installerWorkflow.indexOf('npx cap sync ios'))) throw new Error('iOS branding generation must happen after the iOS native project is added and synced.');

requireText(ux,"const FABRI_CADABRA_VERSION='1.0.4'",'Browser-readable version marker must be synchronized to 1.0.4.');
requireText(ux,"data-changelog-version='current'",'v1.0.4 must remain the newest/current changelog entry.');
requireText(ux,'App Branding &amp; Launch Experience','v1.0.4 changelog must disclose the app icon and launch-screen makeover.');
requireText(ux,"data-changelog-version='1.0.3'",'Historical v1.0.3 changelog entry must be retained after the v1.0.4 release.');
requireText(ux,'Smart Shift Time Entry','Historical v1.0.3 Smart Shift Time Entry changelog content must remain intact.');

console.log('Fabri-Cadabra v1.0.4 native app icon, launch screen, version, changelog, and installer branding contract: OK');
