import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root=process.cwd();
for (const f of ['www/index.html','www/app.js','www/calculator.js','www/native-compat.js']) {
  if (!existsSync(join(root,f))) throw new Error(`Missing canonical source required by feature verification: ${f}`);
}
const html=readFileSync(join(root,'www/index.html'),'utf8');
const app=readFileSync(join(root,'www/app.js'),'utf8');
const calculator=readFileSync(join(root,'www/calculator.js'),'utf8');
const native=readFileSync(join(root,'www/native-compat.js'),'utf8');
const config=JSON.parse(readFileSync(join(root,'capacitor.config.json'),'utf8'));
const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
const installerWorkflow=readFileSync(join(root,'..','.github','workflows','build-phone-installers.yml'),'utf8');
const pagesWorkflow=readFileSync(join(root,'..','.github','workflows','deploy-pages.yml'),'utf8');
const combined=[html,app,calculator,native].join('\n');
const tools=['overhang','fasteners','optimizer','saw','tasklog','notes','checklist','reference','calculator'];
const expectedNavTools=['tasklog','notes','checklist','calculator','reference','fasteners','optimizer','saw','overhang'];
const navTools=[...html.matchAll(/class="fab-page-link"[^>]*data-tool="([^"]+)"/g)].map(match=>match[1]);
if(new Set(navTools).size!==navTools.length) throw new Error('Pages drawer contains duplicate data-tool identifiers.');
if(JSON.stringify(navTools)!==JSON.stringify(expectedNavTools)) throw new Error(`Pages drawer order changed unexpectedly. Expected ${expectedNavTools.join(' > ')}, got ${navTools.join(' > ')}.`);
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
const tagline='<p>The multi-tool built specifically for efficient shop fabrication. — Navigate the tools with the [ <strong>≡</strong> Pages ] button in the top right corner. — Understand the tool before you use it.</p>';
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
  'let activeTool = DEFAULT_TOOL;',
  "const next=VALID_TOOLS.has(tool)?tool:DEFAULT_TOOL;",
  'selectTool(DEFAULT_TOOL);'
]) {
  if(!app.includes(marker)) throw new Error(`Navigation source-of-truth contract missing: ${marker}`);
}
if(app.includes("storageGet('fabricationTool')")) throw new Error('Launch behavior must be hard-wired to Task Logging instead of restoring the previously viewed page.');
if(/const VALID_TOOLS\s*=\s*new Set\s*\(\s*\[/.test(app)) throw new Error('Navigation must derive valid tool IDs from canonical Pages markup instead of maintaining a second hard-coded list.');
for(const marker of ['function clearEntry()','function equals()','function percent()','function sqrt()','function memory(action)',"key==='Backspace' || key==='Delete'",'FabriCadabraApp.getActiveTool()']) {
  if(!calculator.includes(marker)) throw new Error(`Missing calculator behavior marker: ${marker}`);
}
const storageKeys=['fabricationChecklistV1','fabricationFabricatorNotesV1','fabricationOptimizerJobsV1','fabricationQuickReferenceDecimalMode','fabricationQuickReferenceTable','fabricationTaskLogJobsV1','fabricationTaskLogPresetsV1','fabricationTheme','fabricationTool'];
for(const key of storageKeys) if(!combined.includes(key)) throw new Error(`Protected persistence key missing: ${key}`);
const formats=['FabricationTaskLogJobs','FabricationTaskLogPresets','FabricationFabricatorNotes','FabricationChecklist','FabricationCutOptimizerJob','FabricationSawOptimizerJob'];
for(const format of formats) if(!combined.includes(format)) throw new Error(`Protected import/export format missing: ${format}`);
for(const marker of ['running','startedAt','accumulatedMs']) if(!app.includes(marker)) throw new Error(`Protected timer state marker missing: ${marker}`);

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
console.log('Official Fabri-Cadabra naming and compatibility-sensitive identity: OK');
