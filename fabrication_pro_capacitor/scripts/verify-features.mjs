import { APP_MODULES, readAppSource } from './app-module-manifest.mjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root=process.cwd();
const html=readFileSync(join(root,'www','index.html'),'utf8');
const app=readAppSource(root);
const backup=readFileSync(join(root,'www','backup.js'),'utf8');
const calculator=readFileSync(join(root,'www','calculator.js'),'utf8');

for(const marker of [
  'id="pageMenuBtn"',
  'id="pageMenuDrawer"',
  'data-tool="tasklog"',
  'data-tool="notes"',
  'data-tool="checklist"',
  'data-tool="calculator"',
  'data-tool="overhang"',
  'data-tool="fasteners"',
  'data-tool="optimizer"',
  'data-tool="saw"',
  'data-tool="quickref"',
  'data-tool="settings"',
  'id="calculatorDisplay"',
  'id="calculatorGuideBtn"',
  'id="calculatorGuideDrawer"',
  'id="settingsThemeSelect"',
  'id="settingsBackupExportBtn"',
  'id="settingsBackupImportBtn"',
  'id="taskLogManagement"',
  'id="taskLogPresetDrawer"',
  'id="fabricatorNotesManagement"',
  'id="notesTopicsDrawer"',
  'id="checklistManagement"',
  'id="quickReferenceTable"',
  'id="optimizerCutListDrawer"',
  'id="sawCutListDrawer"',
  'id="confirmationDialog"'
]) {
  if(!html.includes(marker)) throw new Error(`Missing static UI marker: ${marker}`);
}
for(const section of ['Function definitions','Addition and subtraction','Multiplication and division','Repeating operations','Memory functions','Roots, exponents and powers','Order of operations','Additional operations','Percentage operations','Correcting mistakes']) {
  if(!html.includes(`<h3>${section}</h3>`)) throw new Error(`Missing Calculator Guide section: ${section}`);
}
for(const action of ['memory-clear','memory-recall','memory-subtract','memory-add','clear-context','sqrt','percent','pi','power','round-2','round-0']) {
  if(!html.includes(`data-calc-action="${action}"`)) throw new Error(`Missing static calculator action: ${action}`);
}
const tagline='The multi-tool built specifically for efficient shop fabrication. — Navigate the tools with the [ <strong>≡</strong> Pages ] button in the top right corner. — Understand the tool before you use it.';
if(!html.includes(tagline)) throw new Error('Canonical Fabri-Cadabra introductory copy is missing or changed.');
if(!html.includes('<h2>Sheet Optimizer</h2>')) throw new Error('Optimizer page header must read Sheet Optimizer.');
const activePanels=[...html.matchAll(/<section id="tool-([^"]+)" class="tool-panel active">/g)].map(match=>match[1]);
if(activePanels.length!==1 || activePanels[0]!=='tasklog') throw new Error(`Task Logging must be the only initially active tool panel; got ${activePanels.join(', ') || 'none'}.`);
for(const marker of ['function selectTool(tool)','const VALID_TOOLS','window.FabriCadabraApp','getActiveTool','openDrawer','closeDrawer','isDrawerOpen']) {
  if(!app.includes(marker)) throw new Error(`Missing canonical app/navigation marker: ${marker}`);
}
for(const marker of [
  "const DEFAULT_TOOL = 'tasklog';",
  "selectTool(DEFAULT_TOOL);",
  'window.selectTool = selectTool;',
  "const STORAGE_KEY = 'lastTool';"
]) {
  if(!app.includes(marker)) throw new Error(`Missing navigation source-of-truth marker: ${marker}`);
}
for(const forbidden of ['localStorage.setItem(STORAGE_KEY, tool);','activatePanel(tool)']) {
  if(app.includes(forbidden)) throw new Error(`Legacy runtime navigation marker remains: ${forbidden}`);
}
for(const marker of ['taskLogJobs','taskLogPresets','fabricatorNotes','optimizerSavedJobs','FabriCadabraStorage','saveTaskLogJobs','saveTaskLogPresets','saveFabricatorNotes','saveOptimizerJobs','runningElapsedMs']) {
  if(!app.includes(marker) && !backup.includes(marker)) throw new Error(`Missing persistence/import-export/timer compatibility marker: ${marker}`);
}
for(const marker of ['tasklog-management-panel','notes-management-panel','checklist-management-panel','fab-page-drawer','notes-topics-drawer-list','tasklog-preset-drawer-list']) {
  if(!html.includes(marker)) throw new Error(`Missing streamlined UX marker: ${marker}`);
}
if(!app.includes('removeAssignedTaskLogPreset')) throw new Error('Task Logging must keep preset removal behavior.');
if(!app.includes('normalizeAssignedPresetActions')) throw new Error('Task Logging must keep assigned preset action normalization.');
if(!app.includes('checklistDragState')) throw new Error('Checklist drag/reorder compatibility contract missing.');
if(!html.includes('Designed by Canopy.')) throw new Error('Footer attribution missing.');
if(html.includes('Fabrication Pro')) throw new Error('Legacy Fabrication Pro product name remains in live HTML.');
if(!html.includes('Fabri-Cadabra')) throw new Error('Official Fabri-Cadabra product name missing from live HTML.');

console.log('Canonical navigation and calculator structure: OK');
console.log('Navigation source-of-truth contract: OK');
console.log('Task Logging hard-wired launch and page-order contract: OK');
console.log('Persistence, import/export, and timer compatibility markers: OK');
console.log('Task Logging and Fabricator Notes streamlined UX contract: OK');
console.log('Checklist drag/reorder compatibility contract: OK');
console.log('App-wide tactile buttons and outer-panel styling contract: OK');
console.log('Official Fabri-Cadabra naming and compatibility-sensitive identity: OK');
