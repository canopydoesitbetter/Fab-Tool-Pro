import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
const root=process.cwd();
const need=(source,needle,message)=>{if(!source.includes(needle))throw new Error(message)};
function jpegDimensions(buffer){
  if(buffer[0]!==0xff||buffer[1]!==0xd8)throw new Error('Expected JPEG native branding source.');
  let offset=2;
  while(offset+9<buffer.length){
    if(buffer[offset]!==0xff){offset++;continue}
    const marker=buffer[offset+1];
    if(marker===0xd8||marker===0xd9){offset+=2;continue}
    if(offset+4>buffer.length)break;
    const length=buffer.readUInt16BE(offset+2);
    if(length<2||offset+2+length>buffer.length)break;
    if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker))return{height:buffer.readUInt16BE(offset+5),width:buffer.readUInt16BE(offset+7)};
    offset+=2+length;
  }
  throw new Error('Could not determine branding JPEG dimensions.');
}
for(const [name,w,h] of [['icon-only.jpg',1024,1024],['icon-foreground.jpg',1024,1024],['icon-background.jpg',1024,1024],['splash.jpg',2732,2732],['splash-dark.jpg',2732,2732]]){
  const path=join(root,'assets','native-branding',name);
  if(!existsSync(path))throw new Error(`Missing native branding asset: ${name}`);
  const d=jpegDimensions(readFileSync(path));
  if(d.width<w||d.height<h)throw new Error(`${name} must be at least ${w}x${h}; found ${d.width}x${d.height}.`);
}

const approvedIcon=join(root,'assets','native-branding','approved-icon-source.jpg');
const approvedLaunch=join(root,'assets','native-branding','approved-launch-source.jpg');
const webLaunch=join(root,'www','launch-screen.jpg');
for(const path of [approvedIcon,approvedLaunch,webLaunch]) if(!existsSync(path)) throw new Error(`Missing approved branding source: ${path}`);
const sha256=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
if(sha256(approvedIcon)!=='3f7af0e41ffc023c99f7cc82f7e1e54d80320500c5d76ddd6f4d474eef455edc') throw new Error('Approved Fabri-Cadabra icon source does not match the user-supplied artwork.');
if(sha256(approvedLaunch)!=='02ae8ac4dce94d44aee86dcc62db3f9d95cb930cf44689b9e946ef36d2ae3959') throw new Error('Approved Fabri-Cadabra launch source does not match the user-supplied artwork.');
if(sha256(webLaunch)!==sha256(approvedLaunch)) throw new Error('Native launch overlay must use the approved launch artwork exactly.');
const index=readFileSync(join(root,'www','index.html'),'utf8');
need(index,'id="nativeLaunchScreen"','Native launch screen element is missing.');
need(index,'src="launch-screen.jpg"','Native launch screen must use the approved launch artwork.');
const css=readFileSync(join(root,'www','ux.css'),'utf8');
need(css,'.native-launch-screen {','Native launch screen styling is missing.');
const nativeCompat=readFileSync(join(root,'www','native-compat.js'),'utf8');
need(nativeCompat,"if (!isNative) return;",'Launch artwork must remain native-only.');
need(nativeCompat,"const nativeLaunchScreen",'Native launch presentation is missing.');
need(nativeCompat,"typeof document !== 'undefined'",'Native launch presentation must tolerate headless verification.');
need(nativeCompat,"classList.add('is-leaving')",'Native launch presentation fade-out is missing.');

const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
if(pkg.version!=='1.0.4')throw new Error(`Expected package version 1.0.4; found ${pkg.version}.`);
need(String(pkg.scripts['native:brand']||''),'apply-native-branding.mjs','native:brand script missing.');
need(String(pkg.scripts['verify:native-branding']||''),'verify-native-branding.mjs','native branding verifier script missing.');
need(String(pkg.scripts.verify||''),'npm run verify:native-branding','Aggregate verification must include native branding.');
const apply=readFileSync(join(root,'scripts','apply-native-branding.mjs'),'utf8');
for(const marker of ['@capacitor/assets@3.0.5','--assetPath','icon-only.jpg','icon-foreground.jpg','icon-background.jpg','splash.jpg','splash-dark.jpg'])need(apply,marker,`Native branding generator is missing ${marker}.`);
const init=readFileSync(join(root,'scripts','native-init.mjs'),'utf8');
need(init,"run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'native:brand']);",'native:init must apply Fabri-Cadabra branding.');
const ux=readFileSync(join(root,'www','ux.js'),'utf8');
need(ux,"const FABRI_CADABRA_VERSION='1.0.4';",'Browser version marker must be 1.0.4.');
need(ux,"data-changelog-version='1.0.3'",'v1.0.3 changelog history must remain.');
need(ux,'new Fabri-Cadabra launcher icon','v1.0.4 changelog must disclose launcher icon.');
need(ux,'branded launch screen','v1.0.4 changelog must disclose launch screen.');
const wf=readFileSync(join(root,'..','.github','workflows','build-phone-installers.yml'),'utf8');
need(wf,'npm run native:brand -- --android','Android installer must generate branding.');
need(wf,'npm run native:brand -- --ios','iPhone installer must generate branding.');
console.log('Fabri-Cadabra v1.0.4 native branding contract: OK');
