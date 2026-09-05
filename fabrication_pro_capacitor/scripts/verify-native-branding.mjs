import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root=process.cwd();

function requireText(source,needle,message) {
  if (!source.includes(needle)) throw new Error(message);
}

function jpegDimensions(buffer) {
  if (buffer.length<4 || buffer[0]!==0xff || buffer[1]!==0xd8) throw new Error('Brand asset is not a JPEG.');
  let offset=2;
  while (offset+9<buffer.length) {
    if (buffer[offset]!==0xff) { offset+=1; continue; }
    const marker=buffer[offset+1];
    if (marker===0xd8 || marker===0xd9) { offset+=2; continue; }
    if (offset+4>buffer.length) break;
    const length=buffer.readUInt16BE(offset+2);
    if (length<2 || offset+2+length>buffer.length) break;
    if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
      return { height:buffer.readUInt16BE(offset+5), width:buffer.readUInt16BE(offset+7) };
    }
    offset+=2+length;
  }
  throw new Error('Could not read JPEG dimensions.');
}

const assetRules=[
  ['assets/icon-only.jpg',1024,1024],
  ['assets/icon-foreground.jpg',1024,1024],
  ['assets/icon-background.jpg',1024,1024],
  ['assets/splash.jpg',2732,2732],
  ['assets/splash-dark.jpg',2732,2732]
];
for (const [relative,minWidth,minHeight] of assetRules) {
  const path=join(root,relative);
  if (!existsSync(path)) throw new Error(`Missing native branding source asset: ${relative}`);
  const {width,height}=jpegDimensions(readFileSync(path));
  if (width<minWidth || height<minHeight) throw new Error(`${relative} must be at least ${minWidth}x${minHeight}; found ${width}x${height}.`);
}

const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
if (pkg.version!=='1.0.4') throw new Error(`v1.0.4 native branding release must report package version 1.0.4; found ${pkg.version}.`);
if (pkg.devDependencies?.['@capacitor/assets']!=='3.0.5') throw new Error('@capacitor/assets 3.0.5 must be pinned for reproducible native icon/splash generation.');
requireText(String(pkg.scripts?.['native:brand'] || ''),'apply-native-branding.mjs','package.json must expose npm run native:brand.');
requireText(String(pkg.scripts?.['verify:native-branding'] || ''),'verify-native-branding.mjs','package.json must expose verify:native-branding.');
requireText(String(pkg.scripts?.verify || ''),'npm run verify:native-branding','Aggregate npm run verify must include the native-branding regression check.');

const brandingScript=readFileSync(join(root,'scripts','apply-native-branding.mjs'),'utf8');
requireText(brandingScript,'@capacitor/assets','Branding script must use the official Capacitor asset generator.');
requireText(brandingScript,'--assetPath','Branding script must point the generator at the canonical assets directory.');

const nativeInit=readFileSync(join(root,'scripts','native-init.mjs'),'utf8');
requireText(nativeInit,"run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'native:brand']);",'native:init must apply Fabri-Cadabra branding after Capacitor sync.');

const installerWorkflow=readFileSync(join(root,'..','.github','workflows','build-phone-installers.yml'),'utf8');
requireText(installerWorkflow,'npm run native:brand -- --android','Android installer build must generate branded native assets.');
requireText(installerWorkflow,'npm run native:brand -- --ios','iPhone installer build must generate branded native assets.');

const ux=readFileSync(join(root,'www','ux.js'),'utf8');
requireText(ux,"data-changelog-version='1.0.4'",'Changelog must contain a newest-first v1.0.4 entry.');
requireText(ux,'new Fabri-Cadabra launcher icon','v1.0.4 changelog must disclose the new launcher icon.');
requireText(ux,'branded launch screen','v1.0.4 changelog must disclose the branded launch screen.');

console.log('Fabri-Cadabra v1.0.4 native branding contract: OK');
