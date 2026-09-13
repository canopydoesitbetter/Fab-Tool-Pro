import { APP_MODULES, readAppSource } from './app-module-manifest.mjs';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root=process.cwd();
for (const f of ['www/index.html','www/styles.css',...APP_MODULES.map(file=>`www/${file}`),'www/calculator.js','www/native-compat.js']) {
  if (!existsSync(join(root,f))) throw new Error(`Missing canonical source required by feature verification: ${f}`);
}
const html=readFileSync(join(root,'www','index.html'),'utf8');
const styles=readFileSync(join(root,'www','styles.css'),'utf8');
const app=readAppSource(root);
const calculator=readFileSync(join(root,'www','calculator.js'),'utf8');
const native=readFileSync(join(root,'www','native-compat.js'),'utf8');
const config=JSON.parse(readFileSync(join(root,'capacitor.config.json'),'utf8'));
const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
const installerWorkflow=readFileSync(join(root,'..','.github','workflows','build-phone-installers.yml'),'utf8');
const pagesWorkflow=readFileSync(join(root,'..','.github','workflows','deploy-pages.yml'),'utf8');
const combined=[html,styles,app,calculator,native].join('\n');
const tools=['overhang','fasteners','optimizer','saw','tasklog','notes','checklist','reference','calculator'];
const expectedNavTools=['tasklog','notes','checklist','calculator','reference','fasteners','optimizer','saw','overhang'];
const navTools=[...html.matchAll(/class="fab-page-link"[^>]*data-tool="([^"]+)"/g)].map(match=>match[1]);
if(new Set(navTools).size!==navTools.length) throw new Error('Pages drawer contains duplicate data-tool identifiers.');
if(JSON.stringify(navTools)!==JSON.stringify(expectedNavTools)) throw new Error(`Pages drawer order changed unexpectedly. Expected ${expectedNavTools.join(' > ')}, got ${navTools.join(' > ')}.`);
const panelTools=[...html.matchAll(/<section id="tool-([^"]+)" class="tool-panel[^"]*">/g)].map(match=>match[1]);
const expectedPanelTools=[...expectedNavTools,'settings'];
if(JSON.stringify(panelTools)!==JSON.stringify(expectedPanelTools)) throw new Error(`Physical tool-panel order must match Pages drawer order with Settings last. Expected ${expectedPanelTools.join(' > ')}, got ${panelTools.join(' > ')}.`);
for (const tool of tools) {
  const nav=navTools.filter(value=>value===tool).length;
  const panel=(html.match(new RegExp(`id="tool-${tool}"`,'g'))||[]).length;
  if(nav!==1) throw new Error(`Expected exactly one canonical Pages link for ${tool}; found ${nav}.`);
  if(panel!==1) throw new Error(`Expected exactly one canonical tool panel for ${tool}; found ${panel}.`);
}
const pageLabels={
  tasklog:'Task Logging',
  notes:'Fabricator Notes',
  checklist:'Checklist',
  calculator:'Basic Calculator',
  reference:'Quick Reference',
  fasteners:'Fastener Spacing',
  optimizer:'Sheet Optimizer',
  saw:'Saw Optimizer',
  overhang:'Aluminum Overhang'
};
for(const [tool,label] of Object.entries(pageLabels)) {
  if(!html.includes(`data-tool="${tool}">${label}</button>`)) throw new Error(`Pages drawer label mismatch for ${tool}: expected ${label}.`);
}
for(const marker of ['id="pageMenuBtn"','id="pageMenuBackdrop"','id="pageMenuDrawer"','id="calculatorGuideBtn"','id="calculatorGuideBackdrop"','id="calculatorGuideDrawer"','id="calculatorDisplay"','id="calculatorClearBtn"']) {
  if(!html.includes(marker)) throw new Error(`Missing static UI marker: ${marker}`);
}
for(const section of ['Function definitions','Addition and subtraction','Multiplication and division','Repeating operations','Memory functions','Roots, exponents and powers','Order of operations','Additional operations','Percentage operations','Correcting mistakes']) {
  if(!html.includes(`<h3>${section}</h3>`)) throw new Error(`Missing Calculator Guide section: ${section}`);
}
for(const action of ['memory-clear','memory-recall','memory-subtract','memory-add','clear-context','sqrt','percent','pi','power','round-2','round-0']) {
  if(!html.includes(`data-calc-action="${action}"`)) throw new Error(`Missing static calculator action: ${action}`);
}
const tagline='Built for efficient shop fabrication. — Navigate with the [ <strong>≡</strong> Pages ] button in the top right corner.';
if(!html.includes(tagline)) throw new Error('Canonical Fabri-Cadabra introductory copy is missing or changed.');
if(!html.includes('<h2>Sheet Optimizer</h2>')) throw new Error('Optimizer page header must read Sheet Optimizer.');
const activePanels=[...html.matchAll(/<section id="tool-([^"]+)" class="tool-panel active">/g)].map(match=>match[1]);
if(activePanels.length!==1 || activePanels[0]!=='tasklog') throw new Error(`Task Logging must be the only initially active tool panel; got ${activePanels.join(', ') || 'none'}.`);
for(const marker of ['function selectTool(tool)','const VALID_TOOLS','window.FabriCadabraApp','getActiveTool','openDrawer','closeDrawer','isDrawerOpen']) {
  if(!app.includes(marker)) throw new Error(`Missing canonical app/navigation marker: ${marker}`);
}
for(const marker of [
  "const DEFAULT_TOOL = 'tasklog';",
  'const VALID_TOOLS = new Set(pageLinks.map(link=>link.dataset.tool));',
  'VALID_TOOLS.add(settingsPageBtn.dataset.tool)',
  'let activeTool = DEFAULT_TOOL;',
  "const next=VALID_TOOLS.has(tool)?tool:DEFAULT_TOOL;",
  'selectTool(DEFAULT_TOOL);'
]) {
  if(!app.includes(marker)) throw new Error(`Navigation source-of-truth contract missing: ${marker}`);
}
if(/selectTool\(\s*storageGet\(\s*['"]fabricationTool['"]/.test(app)) throw new Error('Launch behavior must be hard-wired to Task Logging instead of restoring the previously viewed page.');
if(!app.includes("const settingsPageBtn = document.getElementById('settingsPageBtn');")) throw new Error('Settings navigation must derive its page ID from canonical markup.');
for(const marker of ['function clearEntry()','function equals()','function percent()','function sqrt()','function memory(action)',"key==='Backspace' || key==='Delete'",'FabriCadabraApp.getActiveTool()']) {
  if(!calculator.includes(marker)) throw new Error(`Missing calculator behavior marker: ${marker}`);
}
const storageKeys=['fabricationChecklistV1','fabricationFabricatorNotesV1','fabricationOptimizerJobsV1','fabricationQuickReferenceDecimalMode','fabricationQuickReferenceTable','fabricationTaskLogJobsV1','fabricationTaskLogPresetsV1','fabricationTheme','fabricationTool'];
for(const key of storageKeys) if(!combined.includes(key)) throw new Error(`Protected persistence key missing: ${key}`);
const formats=['FabricationTaskLogJobs','FabricationTaskLogPresets','FabricationFabricatorNotes','FabricationChecklist','FabricationCutOptimizerJob','FabricationSawOptimizerJob'];
for(const format of formats) if(!combined.includes(format)) throw new Error(`Protected import/export format missing: ${format}`);
for(const marker of ['running','startedAt','accumulatedMs']) if(!app.includes(marker)) throw new Error(`Protected timer state marker missing: ${marker}`);

// Task Logging and Fabricator Notes streamlined UX contract.
for(const marker of [
  'id="taskLogManagementDetails" class="card management-details"',
  'id="taskLogPresetMenuBtn" class="cut-list-menu-btn tasklog-preset-menu-btn tasklog-job-preset-btn"',
  'id="fabricatorNotesManagementDetails" class="card management-details"',
  'id="fabricatorNotesTopicsBtn"',
  'id="fabricatorNotesTopicsBackdrop"',
  'id="fabricatorNotesTopicsDrawer"',
  'id="fabricatorNotesTopicsCloseBtn"',
  'id="fabricatorNotesTopicList" class="notes-topic-list notes-topics-drawer-list"'
]) {
  if(!html.includes(marker)) throw new Error(`User-friendly management/drawer markup missing: ${marker}`);
}
if(/<details[^>]*id="taskLogManagementDetails"[^>]*\sopen(?:\s|>)/.test(html)) throw new Error('Task Logging Management must be collapsed by default.');
if(/<details[^>]*id="fabricatorNotesManagementDetails"[^>]*\sopen(?:\s|>)/.test(html)) throw new Error('Notes Management must be collapsed by default.');
if(html.includes('class="card notes-topics-card"')) throw new Error('Fabricator Notes must not keep a permanent Topics side panel.');
if(!/<div hidden aria-hidden="true">[\s\S]*?id="taskLogPresetSelect"[\s\S]*?id="taskLogAddTaskBtn"[\s\S]*?<\/div>/.test(html)) {
  throw new Error('Retired Task Logging select/Add Task controls must remain hidden only as compatibility hooks for the unchanged task engine.');
}
if(!styles.includes('.tasklog-remove-task') || !styles.includes('display:none !important;')) {
  throw new Error('Inline task removal must be hidden so tasks can only be removed from the preset drawer.');
}
for(const marker of [
  'id="taskLogInfoBtn"',
  'id="taskLogInfoBackdrop"',
  'id="taskLogInfoDrawer" class="cut-list-drawer drawer-left tasklog-info-drawer"',
  'id="taskLogInfoCloseBtn"',
  'id="checklistManagementDetails" class="card management-details"',
  'id="optimizerManagementDetails" class="card management-details"',
  'id="sawManagementDetails" class="card management-details"'
]) {
  if(!html.includes(marker)) throw new Error(`Info/management panel markup missing: ${marker}`);
}
for(const id of ['checklistManagementDetails','optimizerManagementDetails','sawManagementDetails']) {
  if(new RegExp(`<details[^>]*id="${id}"[^>]*\\sopen(?:\\s|>)`).test(html)) throw new Error(`${id} must be collapsed by default.`);
}
if(!styles.includes('.cut-list-drawer.drawer-left') || !styles.includes('transform:translateX(-102%)')) throw new Error('Task Logging Info drawer must be styled as a left-side drawer.');
for(const marker of [
  'id="taskLogInfoBtn" class="tasklog-info-btn page-info-btn"',
  'id="calculatorGuideBtn" class="page-info-btn"',
  'id="calculatorGuideDrawer" class="cut-list-drawer drawer-left"',
  'id="optimizerInfoBtn" class="page-info-btn"',
  'id="optimizerInfoDrawer" class="cut-list-drawer drawer-left page-info-drawer"',
  'id="sawInfoBtn" class="page-info-btn"',
  'id="sawInfoDrawer" class="cut-list-drawer drawer-left page-info-drawer"',
  'id="overhangInfoBtn" class="page-info-btn"',
  'id="overhangInfoDrawer" class="cut-list-drawer drawer-left page-info-drawer"'
]) {
  if(!html.includes(marker)) throw new Error(`Shared Guide/Info drawer markup missing: ${marker}`);
}
for(const removed of [
  'Fast shop arithmetic with memory, percentages, roots, powers, rounding, keyboard input, and repeated operations.',
  'Create shop topics and keep detailed notes inside each topic. Notes support bold, italic, and underline formatting, save automatically on this device, and can be exported as a portable JSON backup.',
  'Create checklist topics for shop tasks, inspections, fabrication steps, or reminders. Add items inside each topic and check them off as work is completed.'
]) {
  if(html.includes(removed)) throw new Error(`Removed page-introduction copy is still present: ${removed}`);
}
for(const heading of ['Automatic Product & Material Rules','Saw Optimization Rule','Fabrication Rules Used']) {
  const count=html.split(heading).length-1;
  if(count!==1) throw new Error(`Expected exactly one guidance rules heading for ${heading}; found ${count}.`);
}
for(const marker of [
  "title:'Fraction Addition Chart — 1/16'",
  "description:''",
  'quickReferenceDescription.hidden = !entry.description;',
  'function bindPageInfoDrawer(buttonId,drawerId)',
  "['optimizerInfoBtn','optimizerInfoDrawer']",
  "['sawInfoBtn','sawInfoDrawer']",
  "['overhangInfoBtn','overhangInfoDrawer']"
]) {
  if(!app.includes(marker)) throw new Error(`Guide/Info behavior marker missing: ${marker}`);
}
for(const removed of [
  'Add common shop fractions in 1/16" increments. Pick the starting measurement on the left, then move across to the amount being added.',
  'Add common shop fractions in 1/32" increments. Pick the starting measurement on the left, then move across to the amount being added.',
  'Add common shop fractions in 1/64" increments. Pick the starting measurement on the left, then move across to the amount being added.'
]) {
  if(app.includes(removed)) throw new Error(`Removed Quick Reference fraction description is still present: ${removed}`);
}
if(!styles.includes('.page-info-btn') || !styles.includes('.page-title-action-row') || !styles.includes('.page-info-body')) throw new Error('Shared Guide/Info drawer styling is incomplete.');
for(const marker of ["setTaskLogInfoDrawerOpen","openDrawer('taskLogInfoDrawer'","closeDrawer('taskLogInfoDrawer'"]) {
  if(!app.includes(marker)) throw new Error(`Task Logging Info drawer behavior missing: ${marker}`);
}
for(const marker of [
  'data-tasklog-remove-assigned',
  "openDrawer('fabricatorNotesTopicsDrawer'",
  "closeDrawer('fabricatorNotesTopicsDrawer'",
  "fabricatorNotesTopicsBtnCanonical.setAttribute('aria-expanded'"
]) {
  if(!app.includes(marker)) throw new Error(`Task Logging/Notes canonical behavior missing: ${marker}`);
}
for(const forbidden of ['normalizeAssignedPresetActions','removeAssignedTaskLogPreset','new MutationObserver']) {
  if(app.includes(forbidden)) throw new Error(`Runtime Task Logging repair must remain removed: ${forbidden}`);
}
for(const marker of ['.management-details','.management-summary','.tasklog-job-preset-btn','.tasklog-remove-assigned-btn','.notes-topics-drawer-list']) {
  if(!styles.includes(marker)) throw new Error(`Task Logging/Notes canonical style missing: ${marker}`);
}

for(const marker of [
  'className = \'checklist-drag-handle\'',
  'data-checklist-drag-id',
  'function reorderChecklistItem(',
  "checklistItems.addEventListener('pointerdown'",
  "checklistItems.addEventListener('pointermove'",
  "checklistItems.addEventListener('pointerup'",
  "checklistItems.addEventListener('keydown'"
]) {
  if(!app.includes(marker)) throw new Error(`Checklist drag/reorder behavior marker missing: ${marker}`);
}
for(const marker of ['.checklist-drag-handle','.checklist-item.dragging','.checklist-item.drag-before','.checklist-item.drag-after']) {
  if(!styles.includes(marker)) throw new Error(`Checklist drag/reorder style marker missing: ${marker}`);
}
if(!app.includes("topic.items.map(item=>({id:item.id,text:String(item.text || '').trim().slice(0,MAX_CHECKLIST_ITEM_TEXT),checked:item.checked===true}))")) {
  throw new Error('Checklist export must continue serializing items in their stored array order without changing the protected format.');
}

for(const marker of [
  'button:not(:disabled)',
  '@media (hover:hover) and (pointer:fine)',
  'transform:translateY(2px) scale(.97)',
  '@media (prefers-reduced-motion: reduce)',
  '--panel-border-inner:',
  '--panel-border-outer:',
  '--panel-depth:',
  '--button-edge:',
  '--button-depth:',
  '--button-hover-depth:',
  '--button-press-depth:',
  'box-shadow:0 3px 0 var(--button-edge),var(--button-depth);',
  'transform:translateY(-2px)',
  'box-shadow:0 5px 0 var(--button-edge),var(--button-hover-depth);',
  'box-shadow:0 1px 0 var(--button-edge),var(--button-press-depth);',
  '.tool-panel > .card',
  '.tool-panel > .tasklog-workspace > .card',
  '.tool-panel > .notes-workspace > .card',
  '.tool-panel > .checklist-workspace > .card',
  'border:2px solid var(--panel-border-inner)',
  '0 0 0 3px var(--panel-border-outer)'
]) {
  if(!styles.includes(marker)) throw new Error(`App-wide tactile styling contract missing: ${marker}`);
}
if(/.metric[^}]*(--panel-border-inner|--panel-border-outer)|.checklist-item[^}]*(--panel-border-inner|--panel-border-outer)|.rule[^}]*(--panel-border-inner|--panel-border-outer)/s.test(styles)) {
  throw new Error('Double-border panel treatment must stay on outer panels and not bleed into protected subpanels.');
}

if(config.appId!=='com.fabricationpro.app') throw new Error(`Capacitor appId changed unexpectedly: ${config.appId}`);
if(config.appName!=='Fabri-Cadabra') throw new Error(`Official native app name must be Fabri-Cadabra; got ${config.appName}`);
if(pkg.name!=='fabri-cadabra-capacitor') throw new Error(`Package name must be fabri-cadabra-capacitor; got ${pkg.name}`);
for(const artifact of ['Fabri-Cadabra-Android.apk','Fabri-Cadabra-Android.apk.sha256','Fabri-Cadabra-Android-signing.txt','Fabri-Cadabra-iPhone-Unsigned.ipa','Fabri-Cadabra-iPhone-Unsigned.ipa.sha256']) {
  if(!installerWorkflow.includes(artifact)) throw new Error(`Installer workflow missing canonical artifact name: ${artifact}`);
}
if(/Fabrication Pro|Fabrication-Pro/.test(installerWorkflow+pagesWorkflow)) throw new Error('Active GitHub workflow still uses the old official product name.');

for(const forbidden of ['originalNav.remove()','originalTabs','originalTabByTool',"script.src = 'fabri-cadabra.js'",'calculatorPanel.innerHTML','document.title =']) {
  if(combined.includes(forbidden)) throw new Error(`Forbidden legacy architecture marker remains: ${forbidden}`);
}
console.log('Canonical navigation and calculator structure: OK');
console.log('Navigation source-of-truth contract: OK');
console.log('Task Logging hard-wired launch and page-order contract: OK');
console.log('Persistence, import/export, and timer compatibility markers: OK');
console.log('Task Logging and Fabricator Notes streamlined UX contract: OK');
console.log('Checklist drag/reorder compatibility contract: OK');
console.log('App-wide tactile buttons and outer-panel styling contract: OK');
console.log('Official Fabri-Cadabra naming and compatibility-sensitive identity: OK');
