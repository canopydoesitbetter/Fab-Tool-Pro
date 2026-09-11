import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { APP_MODULES } from './app-module-manifest.mjs';

const root=resolve(import.meta.dirname,'..');
const www=join(root,'www');
const scriptsDir=join(root,'scripts');
const legacyPath=join(www,'app.js');
const moduleDir=join(www,'app');
const need=(condition,message)=>{if(!condition)throw new Error(message);};

if (!existsSync(legacyPath)) {
  console.log('www/app.js is already split; no migration required.');
  process.exit(0);
}

const raw=readFileSync(legacyPath,'utf8').replaceAll('\r\n','\n');
need(raw.startsWith('(() => {\n'),'Unexpected app.js wrapper start; refusing a non-mechanical migration.');
const closeIndex=raw.lastIndexOf('\n})();');
need(closeIndex>0 && raw.slice(closeIndex).trim()==='})();','Unexpected app.js wrapper end; refusing a non-mechanical migration.');
const body=raw.slice('(() => {\n'.length,closeIndex);

const marker={
  nav:'  // ---------------- App navigation + theme ----------------',
  shared:'  // ---------------- Shared helpers ----------------',
  task:'  // ---------------- Task Logging ----------------',
  notes:'  // ---------------- Fabricator Notes ----------------',
  checklist:'  // ---------------- Checklist ----------------',
  reference:'  // ---------------- Quick Reference ----------------',
  overhang:'  // ---------------- Aluminum overhang calculator ----------------',
  fasteners:'  // ---------------- Fastener spacing calculator ----------------',
  sheet:'  // ---------------- Material cut optimizer ----------------',
  saw:'  // ---------------- Saw optimizer ----------------',
  settings:'  // ---------------- Canonical Notes / Settings / Shift UI ----------------',
  backup:'  // ---------------- Unified Backup & Restore bridge ----------------'
};
for (const [name,value] of Object.entries(marker)) need(body.includes(value),`Required ${name} section marker is missing.`);
function between(start,end) {
  const from=body.indexOf(start);
  const to=end ? body.indexOf(end,from+start.length) : body.length;
  need(from>=0 && to>from,`Could not isolate section ${start}.`);
  return body.slice(from,to);
}

const versionChunk=body.slice(0,body.indexOf(marker.nav));
const navSection=between(marker.nav,marker.shared);
const sharedSection=between(marker.shared,marker.task);
const taskSection=between(marker.task,marker.notes);
const notesSection=between(marker.notes,marker.checklist);
const checklistSection=between(marker.checklist,marker.reference);
const referenceSection=between(marker.reference,marker.overhang);
const calculatorsSection=body.slice(body.indexOf(marker.overhang),body.indexOf(marker.sheet));
const optimizerSection=between(marker.sheet,marker.settings);
const canonicalSettingsSection=between(marker.settings,marker.backup);
const backupAndVersionSection=between(marker.backup,null);

const storageStart=navSection.indexOf('  function storageGet(key)');
const drawersStart=navSection.indexOf('  function getDrawerParts(drawerId)');
const drawersEnd=navSection.indexOf('  function getActiveTool()',drawersStart);
need(storageStart>0 && drawersStart>storageStart && drawersEnd>drawersStart,'Navigation/storage/drawer boundaries changed unexpectedly.');
const drawerState='  const drawerReturnFocus = new Map();\n';
need(navSection.includes(drawerState),'Drawer focus state declaration is missing.');
const storageSection=navSection.slice(storageStart,drawersStart);
const drawersSection=drawerState+'\n'+navSection.slice(drawersStart,drawersEnd);
const navigationSection=(navSection.slice(0,storageStart)+navSection.slice(drawersEnd)).replace(drawerState,'');

const shiftStart=taskSection.indexOf('// @shift-schedule-core-start');
const taskResume=taskSection.indexOf('  function showTaskLogStatus',shiftStart);
need(shiftStart>0 && taskResume>shiftStart,'Shift Schedule boundary changed unexpectedly.');
const shiftSection=taskSection.slice(shiftStart,taskResume);
const taskLoggingSection=taskSection.slice(0,shiftStart)+taskSection.slice(taskResume);

const sawStart=optimizerSection.indexOf(marker.saw);
const sheetResume=optimizerSection.indexOf('  function measurementText(value)',sawStart);
need(sawStart>0 && sheetResume>sawStart,'Saw Optimizer boundary changed unexpectedly.');
const sawSection=optimizerSection.slice(sawStart,sheetResume);
let sheetSection=optimizerSection.slice(0,sawStart)+optimizerSection.slice(sheetResume);

const escapeStart=sheetSection.indexOf('  function escapeHtml(text) {');
const escapeEnd=sheetSection.indexOf('  optimizerJobList.addEventListener',escapeStart);
need(escapeStart>=0 && escapeEnd>escapeStart,'Shared escapeHtml helper boundary changed unexpectedly.');
const escapeHtmlSection=sheetSection.slice(escapeStart,escapeEnd);
sheetSection=sheetSection.slice(0,escapeStart)+sheetSection.slice(escapeEnd);

const selfStart=sheetSection.indexOf('  function runFabricationSelfTests() {');
const selfEndMarker="  if (location.hash==='#selftest') setTimeout(runFabricationBrowserSelfTests,0);";
const selfEndLine=sheetSection.indexOf(selfEndMarker,selfStart);
need(selfStart>=0 && selfEndLine>selfStart,'Runtime self-test boundary changed unexpectedly.');
const selfEnd=sheetSection.indexOf('\n',selfEndLine+selfEndMarker.length);
const selfTestsSection=sheetSection.slice(selfStart,selfEnd<0?sheetSection.length:selfEnd+1);
sheetSection=sheetSection.slice(0,selfStart)+sheetSection.slice(selfEnd<0?sheetSection.length:selfEnd+1);

const settingsVersionStart=backupAndVersionSection.indexOf('  const settingsVersionValue');
need(settingsVersionStart>0,'Settings version/changelog boundary changed unexpectedly.');
const importExportSection=backupAndVersionSection.slice(0,settingsVersionStart);
const settingsSection=canonicalSettingsSection+backupAndVersionSection.slice(settingsVersionStart);
const bootstrapSection=versionChunk+sharedSection+'\n'+escapeHtmlSection;

const modules=new Map([
  ['app/bootstrap.js',bootstrapSection],
  ['app/storage.js',storageSection],
  ['app/drawers.js',drawersSection],
  ['app/navigation.js',navigationSection],
  ['app/shift-schedule.js',shiftSection],
  ['app/task-logging.js',taskLoggingSection],
  ['app/notes.js',notesSection],
  ['app/checklist.js',checklistSection],
  ['app/quick-reference.js',referenceSection],
  ['app/calculators.js',calculatorsSection],
  ['app/sheet-optimizer.js',sheetSection],
  ['app/saw-optimizer.js',sawSection],
  ['app/settings.js',settingsSection],
  ['app/import-export.js',importExportSection],
  ['app/self-tests.js',selfTestsSection]
]);
need(modules.size===APP_MODULES.length && APP_MODULES.every(path=>modules.has(path)),'Migration module list differs from the canonical manifest.');
mkdirSync(moduleDir,{recursive:true});
for (const relativePath of APP_MODULES) {
  const source=modules.get(relativePath);
  need(source && source.trim(),`Refusing to write empty module ${relativePath}.`);
  writeFileSync(join(www,relativePath),source.endsWith('\n')?source:source+'\n','utf8');
}

const indexPath=join(www,'index.html');
let html=readFileSync(indexPath,'utf8');
const oldScripts='  <script src="native-compat.js" defer></script>\n  <script src="app.js" defer></script>\n  <script src="backup.js" defer></script>\n  <script src="calculator.js" defer></script>';
const newScripts=['native-compat.js',...APP_MODULES,'backup.js','calculator.js'].map(src=>`  <script src="${src}" defer></script>`).join('\n');
need(html.includes(oldScripts),'Canonical runtime script block changed unexpectedly.');
html=html.replace(oldScripts,newScripts);
writeFileSync(indexPath,html,'utf8');

const syncPath=join(scriptsDir,'sync-app-version.mjs');
let syncSource=readFileSync(syncPath,'utf8');
syncSource=syncSource.replace("const appPath=join(root,'www','app.js');","const appPath=join(root,'www','app','bootstrap.js');");
syncSource=syncSource.replace('FABRI_CADABRA_VERSION generated marker is missing from www/app.js.','FABRI_CADABRA_VERSION generated marker is missing from www/app/bootstrap.js.');
writeFileSync(syncPath,syncSource,'utf8');

function addModuleImport(source,names='readAppSource') {
  if (source.includes("from './app-module-manifest.mjs'")) return source;
  return `import { ${names} } from './app-module-manifest.mjs';\n`+source;
}
function replaceRootAppRead(source) {
  return source
    .replace("fs.readFileSync(path.join(root,'www','app.js'),'utf8')",'readAppSource(root)')
    .replace("readFileSync(join(root,'www','app.js'),'utf8')",'readAppSource(root)');
}

for (const name of readdirSync(scriptsDir)) {
  if (!name.endsWith('.mjs') || ['app-module-manifest.mjs','verify-app-modules.mjs','split-app-modules.mjs','sync-app-version.mjs'].includes(name)) continue;
  const path=join(scriptsDir,name);
  let source=readFileSync(path,'utf8');
  const needsAppReader=source.includes("fs.readFileSync(path.join(root,'www','app.js'),'utf8')") || source.includes("readFileSync(join(root,'www','app.js'),'utf8')");
  if (!needsAppReader) continue;
  const needsManifest=name==='verify-web.mjs' || name==='verify-features.mjs' || name==='verify-backup-restore.mjs';
  source=addModuleImport(source,needsManifest ? 'APP_MODULES, readAppSource' : 'readAppSource');
  source=replaceRootAppRead(source);
  writeFileSync(path,source,'utf8');
}

const webVerifyPath=join(scriptsDir,'verify-web.mjs');
let webVerify=readFileSync(webVerifyPath,'utf8');
webVerify=webVerify.replace("const requiredFiles=['www/index.html','www/styles.css','www/app.js','www/backup.js','www/calculator.js','www/native-compat.js'];","const requiredFiles=['www/index.html','www/styles.css',...APP_MODULES.map(file=>`www/${file}`),'www/backup.js','www/calculator.js','www/native-compat.js'];");
webVerify=webVerify.replace("const scriptOrder=['native-compat.js','app.js','backup.js','calculator.js'];","const scriptOrder=['native-compat.js',...APP_MODULES,'backup.js','calculator.js'];");
webVerify=webVerify.replace("for (const [name,source] of [['app.js',app],['backup.js',backup],['calculator.js',calculator],['native-compat.js',native]]) {","const appModuleSources=APP_MODULES.map(name=>[name,readFileSync(join(root,'www',name),'utf8')]);\nfor (const [name,source] of [...appModuleSources,['backup.js',backup],['calculator.js',calculator],['native-compat.js',native]]) {");
webVerify=webVerify.replace('Retired runtime UX patch behavior remains in app.js.','Retired runtime UX patch behavior remains in app modules.');
webVerify=webVerify.replace("console.log('JavaScript syntax: OK (app.js, backup.js, calculator.js, native-compat.js)');","console.log(`JavaScript syntax: OK (${APP_MODULES.length} app modules, backup.js, calculator.js, native-compat.js)`);");
writeFileSync(webVerifyPath,webVerify,'utf8');

const featureVerifyPath=join(scriptsDir,'verify-features.mjs');
let featureVerify=readFileSync(featureVerifyPath,'utf8');
featureVerify=featureVerify.replace("for (const f of ['www/index.html','www/styles.css','www/app.js','www/calculator.js','www/native-compat.js']) {","for (const f of ['www/index.html','www/styles.css',...APP_MODULES.map(file=>`www/${file}`),'www/calculator.js','www/native-compat.js']) {");
writeFileSync(featureVerifyPath,featureVerify,'utf8');

const versionVerifyPath=join(scriptsDir,'verify-app-version.mjs');
let versionVerify=readFileSync(versionVerifyPath,'utf8');
versionVerify=versionVerify.replace("  mkdirSync(join(fixture,'www'),{recursive:true});","  mkdirSync(join(fixture,'www','app'),{recursive:true});");
versionVerify=versionVerify.replace("writeFileSync(join(fixture,'www','app.js'),\"const FABRI_CADABRA_VERSION='0.0.0'; // @generated from package.json by scripts/sync-app-version.mjs\\n\");","writeFileSync(join(fixture,'www','app','bootstrap.js'),\"const FABRI_CADABRA_VERSION='0.0.0'; // @generated from package.json by scripts/sync-app-version.mjs\\n\");");
versionVerify=versionVerify.replace("const fixtureApp=readFileSync(join(fixture,'www','app.js'),'utf8');","const fixtureApp=readFileSync(join(fixture,'www','app','bootstrap.js'),'utf8');");
versionVerify=versionVerify.replace('Browser version marker must match package.json.','Browser bootstrap version marker must match package.json.');
writeFileSync(versionVerifyPath,versionVerify,'utf8');

const settingsVerifyPath=join(scriptsDir,'verify-settings-changelog.mjs');
let settingsVerify=readFileSync(settingsVerifyPath,'utf8');
settingsVerify=settingsVerify.replace("need(sync.includes(\"join(root,'www','app.js')\"),'Version sync must update app.js.');","need(sync.includes(\"join(root,'www','app','bootstrap.js')\"),'Version sync must update app/bootstrap.js.');");
writeFileSync(settingsVerifyPath,settingsVerify,'utf8');

const backupVerifyPath=join(scriptsDir,'verify-backup-restore.mjs');
let backupVerify=readFileSync(backupVerifyPath,'utf8');
backupVerify=backupVerify.replace(
  "const appIndex=html.indexOf('<script src=\"app.js\" defer></script>');\nconst backupIndex=html.indexOf('<script src=\"backup.js\" defer></script>');\nneed(appIndex>=0 && backupIndex>appIndex,'backup.js must load after app.js.');",
  "const appIndex=Math.max(...APP_MODULES.map(src=>html.indexOf(`<script src=\"${src}\" defer></script>`)));\nconst backupIndex=html.indexOf('<script src=\"backup.js\" defer></script>');\nneed(appIndex>=0 && APP_MODULES.every(src=>html.includes(`<script src=\"${src}\" defer></script>`)) && backupIndex>appIndex,'backup.js must load after all app feature modules.');"
);
writeFileSync(backupVerifyPath,backupVerify,'utf8');

const leftovers=[];
for (const name of readdirSync(scriptsDir)) {
  if (!name.endsWith('.mjs') || ['split-app-modules.mjs','verify-app-modules.mjs'].includes(name)) continue;
  const source=readFileSync(join(scriptsDir,name),'utf8');
  const tokens=["join(root,'www','app.js')","path.join(root,'www','app.js')"];
  if (tokens.some(token=>source.includes(token))) leftovers.push(name);
}
need(leftovers.length===0,`Unmigrated direct app.js readers remain in: ${leftovers.join(', ')}.`);

rmSync(legacyPath);
console.log(`Split legacy app.js into ${APP_MODULES.length} focused feature modules without rewriting feature logic.`);
