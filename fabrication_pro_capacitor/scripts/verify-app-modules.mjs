import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import vm from 'node:vm';
import { APP_MODULES, readAppSource } from './app-module-manifest.mjs';

const root=resolve(import.meta.dirname,'..');
const need=(condition,message)=>{if(!condition)throw new Error(message);};
const legacyPath=join(root,'www','app.js');
const html=readFileSync(join(root,'www','index.html'),'utf8');
const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));

need(!existsSync(legacyPath),'Legacy www/app.js monolith must be removed after the feature-module refactor.');

for (const relativePath of APP_MODULES) {
  const fullPath=join(root,'www',relativePath);
  need(existsSync(fullPath),`Required app module is missing: www/${relativePath}`);
  const source=readFileSync(fullPath,'utf8');
  need(source.trim().length>0,`App module is empty: www/${relativePath}`);
  new vm.Script(source,{filename:relativePath});
}

const expectedRuntimeOrder=['native-compat.js',...APP_MODULES,'backup.js','calculator.js'];
let cursor=-1;
for (const src of expectedRuntimeOrder) {
  const marker=`<script src="${src}" defer></script>`;
  const position=html.indexOf(marker);
  need(position>cursor,`Runtime script is missing or out of order: ${src}`);
  cursor=position;
}
need(!html.includes('<script src="app.js"'),'index.html must not load the legacy app.js monolith.');

const owners={
  'app/bootstrap.js':['FABRI_CADABRA_VERSION','requireRecoverySnapshot','function escapeHtml'],
  'app/storage.js':['function storageGet','function storageSet'],
  'app/drawers.js':['function openDrawer','function closeDrawer','function isDrawerOpen'],
  'app/navigation.js':['function selectTool','window.FabriCadabraApp'],
  'app/shift-schedule.js':['@shift-schedule-core-start','fabricationShiftScheduleV1','window.FabriCadabraApp.shiftSchedule'],
  'app/task-logging.js':['@tasklog-job-rename-core-start','fabricationTaskLogJobsV1','FabricationTaskLogPresets'],
  'app/notes.js':['fabricationFabricatorNotesV1','FabricationFabricatorNotes'],
  'app/checklist.js':['fabricationChecklistV1','FabricationChecklist'],
  'app/quick-reference.js':['fabricationQuickReferenceDecimalMode','fabricationQuickReferenceTable'],
  'app/calculators.js':['calculateOverhang','calculateFasteners'],
  'app/sheet-optimizer.js':['fabricationOptimizerJobsV1','FabricationCutOptimizerJob'],
  'app/saw-optimizer.js':['FabricationSawOptimizerJob','renderSawJob'],
  'app/settings.js':['@shift-smart-time-start','settingsVersionValue'],
  'app/import-export.js':['FabriCadabraBackup','FABRI_CADABRA_PERSISTENCE_KEYS','window.FabriCadabraApp.backup'],
  'app/self-tests.js':['runFabricationSelfTests','runFabricationBrowserSelfTests']
};
for (const [relativePath,markers] of Object.entries(owners)) {
  const source=readFileSync(join(root,'www',relativePath),'utf8');
  for (const marker of markers) need(source.includes(marker),`www/${relativePath} is missing ownership marker: ${marker}`);
}

const appSource=readAppSource(root);
for (const invariant of [
  'fabricationTaskLogJobsV1','fabricationTaskLogPresetsV1','fabricationShiftScheduleV1',
  'fabricationFabricatorNotesV1','fabricationChecklistV1','fabricationOptimizerJobsV1',
  'fabricationTheme','fabricationTool','fabricationQuickReferenceTable','fabricationQuickReferenceDecimalMode',
  'FabriCadabraBackup','FabricationTaskLogJobs','FabricationTaskLogPresets','FabricationShiftSchedule',
  'FabricationFabricatorNotes','FabricationChecklist','FabricationCutOptimizerJob','FabricationSawOptimizerJob'
]) need(appSource.includes(invariant),`Behavior/storage contract marker disappeared during extraction: ${invariant}`);

need(String(pkg.scripts?.['verify:app-modules']||'')==='node scripts/verify-app-modules.mjs','package.json must expose verify:app-modules.');
need(String(pkg.scripts?.verify||'').includes('npm run verify:app-modules'),'Aggregate npm run verify must include verify:app-modules.');

for (const name of readdirSync(join(root,'scripts'))) {
  if (!name.endsWith('.mjs') || ['app-module-manifest.mjs','verify-app-modules.mjs','split-app-modules.mjs'].includes(name)) continue;
  const source=readFileSync(join(root,'scripts',name),'utf8');
  need(!source.includes("join(root,'www','app.js')") && !source.includes("path.join(root,'www','app.js')"),`${name} still reads the removed www/app.js directly.`);
}

console.log(`App feature-module architecture: OK (${APP_MODULES.length} modules, deterministic deferred load order)`);
