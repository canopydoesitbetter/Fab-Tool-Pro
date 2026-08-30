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
const combined=[html,app,calculator,native].join('\n');
const tools=['overhang','fasteners','optimizer','saw','tasklog','notes','checklist','reference','calculator'];
for (const tool of tools) {
  const nav=(html.match(new RegExp(`class="fab-page-link"[^>]*data-tool="${tool}"`,'g'))||[]).length;
  const panel=(html.match(new RegExp(`id="tool-${tool}"`,'g'))||[]).length;
  if(nav!==1) throw new Error(`Expected exactly one canonical Pages link for ${tool}; found ${nav}.`);
  if(panel!==1) throw new Error(`Expected exactly one canonical tool panel for ${tool}; found ${panel}.`);
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
for(const marker of ['function selectTool(tool)','const VALID_TOOLS','window.FabriCadabraApp','getActiveTool','openDrawer','closeDrawer','isDrawerOpen',"storageGet('fabricationTool')"]) {
  if(!app.includes(marker)) throw new Error(`Missing canonical app/navigation marker: ${marker}`);
}
for(const marker of ['function clearEntry()','function equals()','function percent()','function sqrt()','function memory(action)',"key==='Backspace' || key==='Delete'",'FabriCadabraApp.getActiveTool()']) {
  if(!calculator.includes(marker)) throw new Error(`Missing calculator behavior marker: ${marker}`);
}
const storageKeys=['fabricationChecklistV1','fabricationFabricatorNotesV1','fabricationOptimizerJobsV1','fabricationQuickReferenceDecimalMode','fabricationQuickReferenceTable','fabricationTaskLogJobsV1','fabricationTaskLogPresetsV1','fabricationTheme','fabricationTool'];
for(const key of storageKeys) if(!combined.includes(key)) throw new Error(`Protected persistence key missing: ${key}`);
const formats=['FabricationTaskLogJobs','FabricationTaskLogPresets','FabricationFabricatorNotes','FabricationChecklist','FabricationCutOptimizerJob','FabricationSawOptimizerJob'];
for(const format of formats) if(!combined.includes(format)) throw new Error(`Protected import/export format missing: ${format}`);
for(const marker of ['running','startedAt','accumulatedMs']) if(!app.includes(marker)) throw new Error(`Protected timer state marker missing: ${marker}`);
for(const forbidden of ['originalNav.remove()','originalTabs','originalTabByTool',"script.src = 'fabri-cadabra.js'",'calculatorPanel.innerHTML','document.title =']) {
  if(combined.includes(forbidden)) throw new Error(`Forbidden legacy architecture marker remains: ${forbidden}`);
}
console.log('Canonical navigation and calculator structure: OK');
console.log('Persistence, import/export, and timer compatibility markers: OK');
