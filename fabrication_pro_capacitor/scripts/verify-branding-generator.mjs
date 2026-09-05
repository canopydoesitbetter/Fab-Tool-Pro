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
need('installLightweightAndroidSplash','Android branding must replace generated raster splash variants with one lightweight native drawable.');
need("entry.name.startsWith('drawable')",'Android splash optimizer must inspect all drawable density/night directories.');
need("/^splash\\.(?:png|jpe?g|webp|xml)$/i",'Android splash optimizer must remove every generated splash resource variant.');
need("writeFileSync(join(drawableDir,'splash.xml'),LIGHTWEIGHT_ANDROID_SPLASH_XML);",'Android splash optimizer must install one XML splash resource.');
need('@mipmap/ic_launcher','Lightweight Android splash must reuse the verified launcher icon instead of embedding another large bitmap.');
need('#080210','Lightweight Android splash must preserve the dark Fabri-Cadabra launch background.');
need('assertNoRasterAndroidSplash','Android branding must verify no raster splash images remain before Gradle packaging.');
reject("'--assetPath'",'Do not rely on the ignored --assetPath argument; production logs proved it did not reach the generator.');

console.log('Native branding generator syntax, launcher replacement, and slim Android splash contract: OK');
