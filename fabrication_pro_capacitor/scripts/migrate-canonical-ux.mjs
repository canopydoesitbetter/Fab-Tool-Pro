import { existsSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root=process.cwd();
const www=join(root,'www');
const scripts=join(root,'scripts');
const indexPath=join(www,'index.html');
const appPath=join(www,'app.js');
const stylesPath=join(www,'styles.css');
const uxPath=join(www,'ux.js');
const uxCssPath=join(www,'ux.css');
const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
const version=String(pkg.version || '').trim();

function need(condition,message) {
  if (!condition) throw new Error(message);
}
function replaceOnce(source,find,replacement,label) {
  const index=typeof find==='string' ? source.indexOf(find) : -1;
  if (typeof find==='string') {
    need(index>=0,`Migration marker missing: ${label}`);
    need(source.indexOf(find,index+find.length)<0,`Migration marker not unique: ${label}`);
    return source.slice(0,index)+replacement+source.slice(index+find.length);
  }
  const matches=[...source.matchAll(new RegExp(find.source,find.flags.includes('g')?find.flags:find.flags+'g'))];
  need(matches.length===1,`Expected one ${label} match; found ${matches.length}.`);
  return source.replace(find,replacement);
}
function templateFromFunction(source,name) {
  const re=new RegExp(`function\\s+${name}\\(\\)\\s*\\{\\s*return \\`([\\s\\S]*?)\\`;\\s*\\}`);
  const match=source.match(re);
  need(match,`Unable to extract ${name} template.`);
  return match[1];
}
function moveStatusAfterDetails(html,detailsId,statusId,nextMarker) {
  const statusRe=new RegExp(`\\s*<div id="${statusId}" class="status" role="status" aria-live="polite"><\\/div>`);
  const statusMatch=html.match(statusRe);
  need(statusMatch,`Missing ${statusId} status element.`);
  html=html.replace(statusRe,'');
  const marker=`      </details>\n\n      ${nextMarker}`;
  need(html.includes(marker),`Missing placement marker after ${detailsId}.`);
  return html.replace(marker,`      </details>\n\n      ${statusMatch[0].trim()}\n\n      ${nextMarker}`);
}

if (!existsSync(uxPath) && !existsSync(uxCssPath)) {
  console.log('Canonical UX migration already applied; no changes needed.');
  process.exit(0);
}
need(existsSync(uxPath) && existsSync(uxCssPath),'ux.js and ux.css must either both exist or both be absent.');

let html=readFileSync(indexPath,'utf8');
let app=readFileSync(appPath,'utf8');
let styles=readFileSync(stylesPath,'utf8');
const ux=readFileSync(uxPath,'utf8');
const uxCss=readFileSync(uxCssPath,'utf8');

// ---------- Canonical static HTML ----------
html=replaceOnce(html,'  <link rel="stylesheet" href="styles.css" />\n  <link rel="stylesheet" href="ux.css" />','  <link rel="stylesheet" href="styles.css" />','stylesheet ownership');
html=replaceOnce(html,'  <script src="native-compat.js" defer></script>\n  <script src="app.js" defer></script>\n  <script src="ux.js" defer></script>\n  <script src="calculator.js" defer></script>','  <script src="native-compat.js" defer></script>\n  <script src="app.js" defer></script>\n  <script src="calculator.js" defer></script>','script ownership');

html=moveStatusAfterDetails(html,'taskLogManagementDetails','taskLogStatus','<div id="taskLogRenameBackdrop"');
html=moveStatusAfterDetails(html,'fabricatorNotesManagementDetails','fabricatorNotesStatus','<div id="fabricatorNotesTopicsBackdrop"');

const topicsButtonMatch=html.match(/<button id="fabricatorNotesTopicsBtn"[\s\S]*?<\/button>/);
need(topicsButtonMatch,'Fabricator Notes Topics button missing.');
let topicsButton=topicsButtonMatch[0];
html=html.replace(topicsButton,'');
topicsButton=topicsButton.replace('class="cut-list-menu-btn"','class="cut-list-menu-btn notes-topics-inline-btn"');
const notesEditorMarker='          <div id="fabricatorNotesEditor" class="notes-editor-fields">';
need(html.includes(notesEditorMarker),'Fabricator Notes editor marker missing.');
html=html.replace(notesEditorMarker,`${notesEditorMarker}\n            ${topicsButton}`);

const settingsInnerMatch=ux.match(/settingsPage\.innerHTML=`([\s\S]*?)`;\n\s*const footer=/);
need(settingsInnerMatch,'Unable to extract Settings page markup from ux.js.');
let settingsInner=settingsInnerMatch[1].replaceAll('${FABRI_CADABRA_VERSION}',version);
const settingsPanel=`    <section id="tool-settings" class="tool-panel settings-page">${settingsInner}\n    </section>\n\n`;
const footerMarker='    <div class="footer">Designed by Canopy.</div>';
need(html.includes(footerMarker),'App footer marker missing.');
html=html.replace(footerMarker,settingsPanel+footerMarker);

const pageDrawerClose='</nav></div>\n  </aside>\n\n  <div id="calculatorGuideBackdrop"';
need(html.includes(pageDrawerClose),'Pages drawer closing marker missing.');
html=html.replace(pageDrawerClose,`</nav>\n      <div class="fab-settings-drawer-footer">\n        <button id="settingsPageBtn" class="fab-settings-link" type="button" data-tool="settings" aria-controls="tool-settings">Settings</button>\n      </div>\n    </div>\n  </aside>\n\n  <div id="calculatorGuideBackdrop"`);

const baselineMarkup=templateFromFunction(ux,'currentFeaturesChangelogMarkup');
let changelogMarkup=templateFromFunction(ux,'changelogMarkup')
  .replaceAll('${FABRI_CADABRA_VERSION}',version)
  .replace('${currentFeaturesChangelogMarkup()}',baselineMarkup);
changelogMarkup=changelogMarkup.replace(`<span class='changelog-version-label'>Version ${version}</span>`,`<span id='settingsCurrentChangelogVersion' class='changelog-version-label'>Version ${version}</span>`);
const drawerInnerMatch=ux.match(/changelogDrawer\.innerHTML=`([\s\S]*?)`;\n\s*document\.body\.append/);
need(drawerInnerMatch,'Unable to extract Changelog drawer markup from ux.js.');
const drawerInner=drawerInnerMatch[1].replace('${changelogMarkup()}',changelogMarkup);
const changelogStatic=`  <div id="settingsChangelogBackdrop" class="cut-list-backdrop settings-changelog-backdrop" aria-hidden="true"></div>\n  <aside id="settingsChangelogDrawer" class="cut-list-drawer settings-changelog-drawer" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="settingsChangelogTitle">${drawerInner}\n  </aside>\n\n`;
const calculatorBackdropMarker='  <div id="calculatorGuideBackdrop"';
need(html.includes(calculatorBackdropMarker),'Calculator guide backdrop marker missing.');
html=html.replace(calculatorBackdropMarker,changelogStatic+calculatorBackdropMarker);

// ---------- Canonical CSS ----------
const migratedCss=uxCss.replace('/* Focused UX refinements for Task Logging, Fabricator Notes, and Settings. */','/* Canonical UI refinements for Task Logging, Fabricator Notes, Settings, and Shift Schedule. */');
styles=`${styles.trimEnd()}\n\n${migratedCss.trim()}\n`;

// ---------- Canonical app navigation/version ----------
app=replaceOnce(app,'(() => {\n  // ---------------- App navigation + theme ----------------','(() => {\n  const FABRI_CADABRA_VERSION=\''+version+'\'; // @generated from package.json by scripts/sync-app-version.mjs\n\n  // ---------------- App navigation + theme ----------------','browser version marker');
app=replaceOnce(app,"  const pageLinks = Array.from(document.querySelectorAll('.fab-page-link'));\n  const toolPanels = Array.from(document.querySelectorAll('.tool-panel'));\n  const DEFAULT_TOOL = 'tasklog';\n  const VALID_TOOLS = new Set(pageLinks.map(link=>link.dataset.tool));","  const pageLinks = Array.from(document.querySelectorAll('.fab-page-link'));\n  const settingsPageBtn = document.getElementById('settingsPageBtn');\n  const toolPanels = Array.from(document.querySelectorAll('.tool-panel'));\n  const DEFAULT_TOOL = 'tasklog';\n  const VALID_TOOLS = new Set(pageLinks.map(link=>link.dataset.tool));\n  if (settingsPageBtn?.dataset.tool) VALID_TOOLS.add(settingsPageBtn.dataset.tool);",'navigation source of truth');
app=replaceOnce(app,"    pageLinks.forEach(link=>link.classList.toggle('active',link.dataset.tool===next));\n    toolPanels.forEach(panel=>panel.classList.toggle('active',panel.id==='tool-'+next));","    pageLinks.forEach(link=>link.classList.toggle('active',link.dataset.tool===next));\n    settingsPageBtn?.classList.toggle('active',settingsPageBtn.dataset.tool===next);\n    toolPanels.forEach(panel=>panel.classList.toggle('active',panel.id==='tool-'+next));",'Settings active navigation');
const pageDrawerListener=`  pageMenuDrawer.addEventListener('click',event=>{\n    const link=event.target.closest('.fab-page-link');\n    if (!link) return;\n    selectTool(link.dataset.tool);\n    setPageMenuOpen(false);\n  });`;
need(app.includes(pageDrawerListener),'Pages drawer listener marker missing.');
app=app.replace(pageDrawerListener,`${pageDrawerListener}\n  settingsPageBtn?.addEventListener('click',()=>{\n    selectTool(settingsPageBtn.dataset.tool);\n    setPageMenuOpen(false);\n  });`);
app=replaceOnce(app,'  window.FabriCadabraApp={getActiveTool,openDrawer,closeDrawer,isDrawerOpen};','  window.FabriCadabraApp={getActiveTool,openDrawer,closeDrawer,isDrawerOpen,version:FABRI_CADABRA_VERSION};','app API version');

// ---------- Task Logging direct assigned-preset semantics ----------
const oldPresetRows=`        const checked=!!job && !assigned && taskLogSelectedPresetIds.has(preset.id);\n        const unavailable=!job || assigned;\n        return \`<div class="tasklog-preset-row\${assigned?' assigned':''}">\n          <input class="tasklog-preset-check" type="checkbox" data-tasklog-select-preset="\${preset.id}" aria-label="Select preset \${escapeHtml(preset.name)}"\${checked?' checked':''}\${unavailable?' disabled':''} />\n          <div class="tasklog-preset-copy"><strong>\${escapeHtml(preset.name)}</strong>\${assigned?'<small>Already added to this job</small>':''}</div>\n          <button class="tasklog-mini-delete" type="button" aria-label="Delete preset \${escapeHtml(preset.name)}" data-tasklog-delete-preset="\${preset.id}">×</button>\n        </div>\`;`;
const newPresetRows=`        const checked=!!job && !assigned && taskLogSelectedPresetIds.has(preset.id);\n        const unavailable=!job || assigned;\n        const actionButton=assigned\n          ? \`<button class="tasklog-mini-delete tasklog-remove-assigned-btn" type="button" aria-label="Remove \${escapeHtml(preset.name)} from this job" title="Remove from this job" data-tasklog-remove-assigned="\${preset.id}">−</button>\`\n          : \`<button class="tasklog-mini-delete" type="button" aria-label="Delete preset \${escapeHtml(preset.name)}" data-tasklog-delete-preset="\${preset.id}">×</button>\`;\n        return \`<div class="tasklog-preset-row\${assigned?' assigned':''}">\n          <input class="tasklog-preset-check" type="checkbox" data-tasklog-select-preset="\${preset.id}" aria-label="Select preset \${escapeHtml(preset.name)}"\${checked?' checked':''}\${unavailable?' disabled':''} />\n          <div class="tasklog-preset-copy"><strong>\${escapeHtml(preset.name)}</strong>\${assigned?'<small>Already added to this job</small>':''}</div>\n          \${actionButton}\n        </div>\`;`;
app=replaceOnce(app,oldPresetRows,newPresetRows,'Task Logging preset row renderer');
const oldPresetClick=`  taskLogPresetList.addEventListener('click',e=>{\n    const btn=e.target.closest('[data-tasklog-delete-preset]');\n    if (btn) deleteTaskLogPreset(Number(btn.dataset.tasklogDeletePreset));\n  });`;
const newPresetClick=`  taskLogPresetList.addEventListener('click',e=>{\n    const removeBtn=e.target.closest('[data-tasklog-remove-assigned]');\n    if (removeBtn) {\n      const job=activeTaskLogJob();\n      const presetId=Number(removeBtn.dataset.tasklogRemoveAssigned);\n      const preset=taskLogPresets.find(item=>item.id===presetId);\n      if (!job || !preset) return;\n      const presetName=String(preset.name || '').toLocaleLowerCase();\n      const task=job.tasks.find(item=>item.presetId===preset.id) || job.tasks.find(item=>String(item.name || '').toLocaleLowerCase()===presetName);\n      if (task) removeTaskLogTask(task.id);\n      return;\n    }\n    const deleteBtn=e.target.closest('[data-tasklog-delete-preset]');\n    if (deleteBtn) deleteTaskLogPreset(Number(deleteBtn.dataset.tasklogDeletePreset));\n  });`;
app=replaceOnce(app,oldPresetClick,newPresetClick,'Task Logging preset click behavior');

// ---------- Migrate proven Shift UI behavior, excluding DOM construction ----------
const shiftStart="  const shiftSchedule=window.FabriCadabraApp?.shiftSchedule || null;";
const shiftEnd="\n  function currentFeaturesChangelogMarkup()";
const shiftFrom=ux.indexOf(shiftStart);
const shiftTo=ux.indexOf(shiftEnd,shiftFrom);
need(shiftFrom>=0 && shiftTo>shiftFrom,'Unable to extract Shift Clock UI block.');
const shiftUiBlock=ux.slice(shiftFrom,shiftTo);

const formStart="    const changelogButton=document.getElementById('settingsChangelogBtn');";
const formEnd="\n    const originalGetActiveTool=";
const formFrom=ux.indexOf(formStart);
const formTo=ux.indexOf(formEnd,formFrom);
need(formFrom>=0 && formTo>formFrom,'Unable to extract Shift Settings form block.');
const settingsFormBlock=ux.slice(formFrom,formTo).replace(/^    /gm,'  ');

const canonicalBindings=`\n  // ---------------- Canonical Notes / Settings / Shift UI ----------------\n  const fabricatorNotesTopicsBtnCanonical=document.getElementById('fabricatorNotesTopicsBtn');\n  const fabricatorNotesTopicsDrawerCanonical=document.getElementById('fabricatorNotesTopicsDrawer');\n  const fabricatorNotesTopicsBackdropCanonical=document.getElementById('fabricatorNotesTopicsBackdrop');\n  const fabricatorNotesTopicsCloseBtnCanonical=document.getElementById('fabricatorNotesTopicsCloseBtn');\n\n  function setFabricatorNotesTopicsDrawerOpen(open) {\n    if (!fabricatorNotesTopicsBtnCanonical) return;\n    if (open) openDrawer('fabricatorNotesTopicsDrawer',fabricatorNotesTopicsBtnCanonical);\n    else closeDrawer('fabricatorNotesTopicsDrawer',fabricatorNotesTopicsBtnCanonical);\n    fabricatorNotesTopicsBtnCanonical.setAttribute('aria-expanded',open?'true':'false');\n  }\n\n  fabricatorNotesTopicsBtnCanonical?.addEventListener('click',()=>setFabricatorNotesTopicsDrawerOpen(!isDrawerOpen('fabricatorNotesTopicsDrawer')));\n  fabricatorNotesTopicsCloseBtnCanonical?.addEventListener('click',()=>setFabricatorNotesTopicsDrawerOpen(false));\n  fabricatorNotesTopicsBackdropCanonical?.addEventListener('click',()=>setFabricatorNotesTopicsDrawerOpen(false));\n  fabricatorNotesTopicsDrawerCanonical?.addEventListener('keydown',event=>{\n    if (event.key==='Escape') {\n      event.preventDefault();\n      setFabricatorNotesTopicsDrawerOpen(false);\n    }\n  });\n  fabricatorNotesTopicList?.addEventListener('click',event=>{\n    if (event.target.closest('[data-note-topic-id]')) requestAnimationFrame(()=>setFabricatorNotesTopicsDrawerOpen(false));\n  });\n\n${shiftUiBlock}\n\n${settingsFormBlock}\n\n  const settingsVersionValue=document.getElementById('settingsVersionValue');\n  const settingsCurrentChangelogVersion=document.getElementById('settingsCurrentChangelogVersion');\n  if (settingsVersionValue) settingsVersionValue.textContent=FABRI_CADABRA_VERSION;\n  if (settingsCurrentChangelogVersion) settingsCurrentChangelogVersion.textContent=\`Version \${FABRI_CADABRA_VERSION}\`;\n\n  const settingsChangelogBackdrop=document.getElementById('settingsChangelogBackdrop');\n  const settingsChangelogDrawer=document.getElementById('settingsChangelogDrawer');\n  function setSettingsChangelogOpen(open) {\n    if (!changelogButton || !settingsChangelogDrawer) return;\n    if (open) openDrawer('settingsChangelogDrawer',changelogButton);\n    else closeDrawer('settingsChangelogDrawer',changelogButton);\n    changelogButton.setAttribute('aria-expanded',open?'true':'false');\n  }\n  changelogButton?.addEventListener('click',()=>setSettingsChangelogOpen(!isDrawerOpen('settingsChangelogDrawer')));\n  changelogCloseBtn?.addEventListener('click',()=>setSettingsChangelogOpen(false));\n  settingsChangelogBackdrop?.addEventListener('click',()=>setSettingsChangelogOpen(false));\n  settingsChangelogDrawer?.addEventListener('keydown',event=>{\n    if (event.key==='Escape') {\n      event.preventDefault();\n      setSettingsChangelogOpen(false);\n    }\n  });\n`;
const appEnd='\n})();\n';
need(app.endsWith(appEnd),'app.js IIFE ending marker missing.');
app=app.slice(0,-appEnd.length)+canonicalBindings+appEnd;

// ---------- Verification contracts ----------
const verifyWeb=`import { existsSync, readFileSync } from 'node:fs';\nimport { join } from 'node:path';\nimport vm from 'node:vm';\n\nconst root=process.cwd();\nconst requiredFiles=['www/index.html','www/styles.css','www/app.js','www/calculator.js','www/native-compat.js'];\nfor (const relative of requiredFiles) if (!existsSync(join(root,relative))) throw new Error(\`Missing canonical web asset: \${relative}\`);\nfor (const retired of ['www/ux.js','www/ux.css']) if (existsSync(join(root,retired))) throw new Error(\`Retired runtime UX patch asset must be absent: \${retired}\`);\nconst html=readFileSync(join(root,'www/index.html'),'utf8');\nconst styles=readFileSync(join(root,'www/styles.css'),'utf8');\nconst app=readFileSync(join(root,'www/app.js'),'utf8');\nconst calculator=readFileSync(join(root,'www/calculator.js'),'utf8');\nconst native=readFileSync(join(root,'www/native-compat.js'),'utf8');\n\nconst scriptOrder=['native-compat.js','app.js','calculator.js'];\nlet previous=-1;\nfor (const script of scriptOrder) {\n  const marker=\`<script src="\${script}" defer></script>\`;\n  const index=html.indexOf(marker);\n  if (index<0) throw new Error(\`index.html must directly load \${script} with defer.\`);\n  if (index<=previous) throw new Error(\`Script order must be: \${scriptOrder.join(', ')}.\`);\n  previous=index;\n}\nif (!html.includes('<link rel="stylesheet" href="styles.css" />')) throw new Error('index.html must directly load styles.css.');\nif (/ux\\.js|ux\\.css/.test(html)) throw new Error('index.html must not reference the retired runtime UX patch assets.');\nif (/<style(?:\\s|>)/i.test(html)) throw new Error('Inline application <style> remains in index.html.');\nif (/<script(?![^>]*\\bsrc=)[^>]*>[\\s\\S]{200,}<\\/script>/i.test(html)) throw new Error('Large inline application script remains in index.html.');\nif (!/<title>Fabri-Cadabra<\\/title>/.test(html) || !/<h1>Fabri-Cadabra<\\/h1>/.test(html)) throw new Error('Fabri-Cadabra must be canonical in document title and brand heading.');\nif (html.includes('Fabrication Calculators')) throw new Error('Legacy Fabrication Calculators product name remains in live HTML.');\nif (/class="tool-menu"/.test(html) || /class="tool-tab/.test(html)) throw new Error('Legacy tool-menu/tool-tab markup remains.');\nif (html.includes('fabri-cadabra.js')) throw new Error('Legacy runtime enhancement is still referenced.');\nfor (const [name,source] of [['app.js',app],['calculator.js',calculator],['native-compat.js',native]]) {\n  new vm.Script(source,{filename:name});\n  if (/createElement\\(\\s*['"]script['"]\\s*\\)/.test(source)) throw new Error(\`\${name} dynamically creates a shipped script loader.\`);\n}\nconst shippedJs=app+calculator+native;\nif (/document\\.title\\s*=|brandHeading\\.textContent/.test(shippedJs)) throw new Error('Runtime product-name replacement remains in shipped JavaScript.');\nif (/originalNav\\.remove\\(\\)|originalTabs|originalTabByTool/.test(shippedJs)) throw new Error('Detached legacy navigation compatibility remains.');\nif (/\\.tool-menu|\\.tool-tab/.test(styles)) throw new Error('Legacy navigation CSS remains in canonical stylesheet.');\nif (/installSettingsPage|normalizeAssignedPresetActions|removeAssignedTaskLogPreset/.test(app)) throw new Error('Retired runtime UX patch behavior remains in app.js.');\nconsole.log('Canonical web source architecture: OK');\nconsole.log('JavaScript syntax: OK (app.js, calculator.js, native-compat.js)');\n`;
writeFileSync(join(scripts,'verify-web.mjs'),verifyWeb,'utf8');

let verifyFeatures=readFileSync(join(scripts,'verify-features.mjs'),'utf8');
verifyFeatures=verifyFeatures
  .replace("for (const f of ['www/index.html','www/styles.css','www/ux.css','www/app.js','www/ux.js','www/calculator.js','www/native-compat.js'])", "for (const f of ['www/index.html','www/styles.css','www/app.js','www/calculator.js','www/native-compat.js'])")
  .replace("const uxStyles=readFileSync(join(root,'www','ux.css'),'utf8');\n",'')
  .replace("const ux=readFileSync(join(root,'www','ux.js'),'utf8');\n",'')
  .replace("const combined=[html,styles,uxStyles,app,ux,calculator,native].join('\\n');","const combined=[html,styles,app,calculator,native].join('\\n');")
  .replace("  'const VALID_TOOLS = new Set(pageLinks.map(link=>link.dataset.tool));',","  'const VALID_TOOLS = new Set(pageLinks.map(link=>link.dataset.tool));',\n  'VALID_TOOLS.add(settingsPageBtn.dataset.tool)',")
  .replace("if(/const VALID_TOOLS\\s*=\\s*new Set\\s*\\(\\s*\\[/.test(app)) throw new Error('Navigation must derive valid tool IDs from canonical Pages markup instead of maintaining a second hard-coded list.');","if(!app.includes(\"const settingsPageBtn = document.getElementById('settingsPageBtn');\")) throw new Error('Settings navigation must derive its page ID from canonical markup.');")
  .replace("if(!uxStyles.includes('.tasklog-remove-task') || !uxStyles.includes('display:none !important;')) {","if(!styles.includes('.tasklog-remove-task') || !styles.includes('display:none !important;')) {")
  .replace("for(const marker of [\n  'data-tasklog-remove-assigned',\n  'function removeAssignedTaskLogPreset(',\n  'new MutationObserver(normalizeAssignedPresetActions)',\n  \"window.FabriCadabraApp.openDrawer('fabricatorNotesTopicsDrawer'\",\n  \"window.FabriCadabraApp.closeDrawer('fabricatorNotesTopicsDrawer'\",\n  \"fabricatorNotesTopicsBtn.setAttribute('aria-expanded'\"\n]) {\n  if(!ux.includes(marker)) throw new Error(`Task Logging/Notes UX behavior missing: ${marker}`);\n}","for(const marker of [\n  'data-tasklog-remove-assigned',\n  \"openDrawer('fabricatorNotesTopicsDrawer'\",\n  \"closeDrawer('fabricatorNotesTopicsDrawer'\",\n  \"fabricatorNotesTopicsBtnCanonical.setAttribute('aria-expanded'\"\n]) {\n  if(!app.includes(marker)) throw new Error(`Task Logging/Notes canonical behavior missing: ${marker}`);\n}\nfor(const forbidden of ['normalizeAssignedPresetActions','removeAssignedTaskLogPreset','new MutationObserver']) {\n  if(app.includes(forbidden)) throw new Error(`Runtime Task Logging repair must remain removed: ${forbidden}`);\n}")
  .replace("  if(!uxStyles.includes(marker)) throw new Error(`Task Logging/Notes UX style missing: ${marker}`);","  if(!styles.includes(marker)) throw new Error(`Task Logging/Notes canonical style missing: ${marker}`);");
need(!verifyFeatures.includes("www','ux.js") && !verifyFeatures.includes("www','ux.css") && !verifyFeatures.includes('uxStyles') && !verifyFeatures.includes('if(!ux.includes'),'verify-features still depends on retired UX files.');
writeFileSync(join(scripts,'verify-features.mjs'),verifyFeatures,'utf8');

const verifyUxPolish=`import { existsSync, readFileSync } from 'node:fs';\nimport { join } from 'node:path';\n\nconst root=process.cwd();\nconst html=readFileSync(join(root,'www','index.html'),'utf8');\nconst styles=readFileSync(join(root,'www','styles.css'),'utf8');\nconst app=readFileSync(join(root,'www','app.js'),'utf8');\nfunction need(condition,message){if(!condition)throw new Error(message);}\nneed(!existsSync(join(root,'www','ux.js')) && !existsSync(join(root,'www','ux.css')),'Retired ux.js / ux.css files must be absent.');\nneed(!/ux\\.js|ux\\.css/.test(html),'index.html must not reference retired UX patch assets.');\nneed(html.includes('<summary class="management-summary"><span>Task Logging Management</span>'),'Task Logging Management summary is missing.');\nneed(html.includes('<summary class="management-summary"><span>Notes Management</span>'),'Notes Management summary is missing.');\nneed(/\\.management-summary\\s*>\\s*span:first-child\\s*\\{[^}]*color:\\s*var\\(--accent\\)/s.test(styles),'Collapsed management titles must use the established accent color.');\nconst jobs=html.match(/<details id="taskLogJobsDetails"[^>]*>[\\s\\S]*?<\\/details>/)?.[0] || '';\nneed(jobs && !/^<details[^>]*\\sopen(?:\\s|>|=)/.test(jobs),'Task Logging Jobs must start collapsed by default.');\nneed(jobs.includes('id="taskLogJobCount"') && jobs.includes('id="taskLogJobList"'),'Task Logging Jobs panel structure changed.');\nneed(html.includes('<label for="taskLogJobTitle">Job # / Name</label>'),'Job # / Name label is missing.');\nneed(html.includes('<label for="fabricatorNotesTitle">Topic</label>'),'Topic label is missing.');\nneed(/label\\[for="taskLogJobTitle"\\][\\s\\S]*label\\[for="fabricatorNotesTitle"\\][^{]*\\{[^}]*color:\\s*var\\(--accent\\)/s.test(styles),'Job # / Name and Topic labels must use the established accent color.');\nconst notesManagement=html.match(/<details id="fabricatorNotesManagementDetails"[\\s\\S]*?<\\/details>/)?.[0] || '';\nneed(notesManagement && !notesManagement.includes('id="fabricatorNotesTopicsBtn"'),'Topics launcher must not be relocated from Notes Management at runtime; it belongs in the editor source.');\nconst notesEditor=html.match(/<div id="fabricatorNotesEditor" class="notes-editor-fields">[\\s\\S]*?<div>/)?.[0] || '';\nneed(notesEditor.includes('id="fabricatorNotesTopicsBtn"') && notesEditor.includes('notes-topics-inline-btn'),'Topics button must be authored in its final editor position.');\nneed(/\\.notes-topics-inline-btn\\s*\\{[^}]*width:\\s*100%/s.test(styles),'Topics button must span the editor width.');\nneed(!/moveStatusOutsideManagement|insertBefore\\(fabricatorNotesTopicsBtn|installSettingsPage/.test(app),'Runtime UI relocation/injection must be absent.');\nneed(!/new\\s+MutationObserver/.test(app),'Task Logging must not rely on MutationObserver repair.');\nneed(app.includes('data-tasklog-remove-assigned') && app.includes('data-tasklog-delete-preset'),'Task Logging renderer must emit final assigned/remove and library/delete semantics directly.');\nneed(!/normalizeAssignedPresetActions|removeAssignedTaskLogPreset/.test(app),'Post-render Task Logging repair logic must be absent.');\nconsole.log('Canonical management, Notes, and Task Logging UI ownership: OK');\n`;
writeFileSync(join(scripts,'verify-ux-polish.mjs'),verifyUxPolish,'utf8');

let verifyAppVersion=readFileSync(join(scripts,'verify-app-version.mjs'),'utf8');
verifyAppVersion=verifyAppVersion
  .replace("const ux=readFileSync(join(root,'www','ux.js'),'utf8');\nneed(ux.includes(`const FABRI_CADABRA_VERSION='${version}'; // @generated from package.json by scripts/sync-app-version.mjs`),'Browser version marker must match package.json.');","const app=readFileSync(join(root,'www','app.js'),'utf8');\nneed(app.includes(`const FABRI_CADABRA_VERSION='${version}'; // @generated from package.json by scripts/sync-app-version.mjs`),'Browser version marker must match package.json.');")
  .replace("writeFileSync(join(fixture,'www','ux.js'),\"const FABRI_CADABRA_VERSION='0.0.0'; // @generated from package.json by scripts/sync-app-version.mjs\\n\");","writeFileSync(join(fixture,'www','app.js'),\"const FABRI_CADABRA_VERSION='0.0.0'; // @generated from package.json by scripts/sync-app-version.mjs\\n\");")
  .replace("const fixtureUx=readFileSync(join(fixture,'www','ux.js'),'utf8');\n  need(fixtureUx.includes(`FABRI_CADABRA_VERSION='${version}'`),'Browser fixture version was not synchronized.');","const fixtureApp=readFileSync(join(fixture,'www','app.js'),'utf8');\n  need(fixtureApp.includes(`FABRI_CADABRA_VERSION='${version}'`),'Browser fixture version was not synchronized.');");
need(!verifyAppVersion.includes("www','ux.js"),'verify-app-version still references ux.js.');
writeFileSync(join(scripts,'verify-app-version.mjs'),verifyAppVersion,'utf8');

let verifySmart=readFileSync(join(scripts,'verify-smart-time-input.mjs'),'utf8');
verifySmart=verifySmart
  .replace("const ux=fs.readFileSync(path.join(root,'www','ux.js'),'utf8');","const app=fs.readFileSync(path.join(root,'www','app.js'),'utf8');")
  .replace('const from=ux.indexOf(start);','const from=app.indexOf(start);')
  .replace('const to=ux.indexOf(end);','const to=app.indexOf(end);')
  .replace("'Smart Shift time parser markers are missing from ux.js.'","'Smart Shift time parser markers are missing from app.js.'")
  .replace('const block=ux.slice(from+start.length,to);','const block=app.slice(from+start.length,to);')
  .replaceAll('expect(ux.includes(', 'expect(app.includes(');
need(!verifySmart.includes("www','ux.js"),'verify-smart-time still references ux.js.');
writeFileSync(join(scripts,'verify-smart-time-input.mjs'),verifySmart,'utf8');

let verifyShift=readFileSync(join(scripts,'verify-shift-schedule.mjs'),'utf8');
verifyShift=verifyShift
  .replace("const ux=fs.readFileSync(path.join(root,'www','ux.js'),'utf8');\n",'')
  .replace("const css=fs.readFileSync(path.join(root,'www','ux.css'),'utf8');","const css=fs.readFileSync(path.join(root,'www','styles.css'),'utf8');")
  .replace("expect(ux.includes(`id='${id}'`) || ux.includes(`id=\"${id}\"`),`Settings is missing ${id}.`);","expect(html.includes(`id='${id}'`) || html.includes(`id=\"${id}\"`),`Settings is missing ${id}.`);")
  .replaceAll('expect(ux.includes(', 'expect(app.includes(');
need(!verifyShift.includes("www','ux.js") && !verifyShift.includes("www','ux.css") && !verifyShift.includes('ux.includes'),'verify-shift-schedule still references retired UX files.');
writeFileSync(join(scripts,'verify-shift-schedule.mjs'),verifyShift,'utf8');

const verifySettings=`import { existsSync, readFileSync } from 'node:fs';\nimport { join } from 'node:path';\n\nconst root=process.cwd();\nconst html=readFileSync(join(root,'www','index.html'),'utf8');\nconst app=readFileSync(join(root,'www','app.js'),'utf8');\nconst styles=readFileSync(join(root,'www','styles.css'),'utf8');\nconst pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));\nconst syncPath=join(root,'scripts','sync-app-version.mjs');\nfunction need(condition,message){if(!condition)throw new Error(message);}\nneed(!existsSync(join(root,'www','ux.js')) && !existsSync(join(root,'www','ux.css')),'Settings must not depend on retired UX patch assets.');\nfor (const id of ['settingsPageBtn','tool-settings','settingsVersionValue','settingsChangelogBtn','settingsChangelogBackdrop','settingsChangelogDrawer','settingsChangelogCloseBtn']) need(html.includes(\`id="\${id}"\`) || html.includes(\`id='\${id}'\`),\`Settings/changelog markup missing \${id}.\`);\nfor (const marker of ['.fab-settings-drawer-footer','.fab-settings-link','.settings-page','.settings-version-value','.settings-changelog-drawer','.settings-changelog-body','.settings-shift-schedule','.shift-clock-btn.clock-in','.shift-clock-btn.clock-out']) need(styles.includes(marker),\`Missing canonical Settings/changelog/shift style: \${marker}\`);\nneed(/\\.fab-settings-link\\s*\\{[^}]*background:\\s*var\\(--danger-bg\\)[^}]*color:\\s*var\\(--danger\\)/s.test(styles),'Settings drawer button must retain established danger/red palette.');\nneed(/\\.fab-page-drawer \\.cut-list-drawer-body\\s*\\{[^}]*display:\\s*flex[^}]*flex-direction:\\s*column[^}]*overflow:\\s*hidden/s.test(styles),'Pages drawer must pin Settings outside the scrollable tool list.');\nneed(/\\.settings-changelog-drawer\\s*\\{[^}]*left:\\s*50%[^}]*top:\\s*50%/s.test(styles),'Changelog overlay must remain centered.');\nneed(/^\\d+\\.\\d+\\.\\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(String(pkg.version||'')),\`Invalid package version: \${pkg.version || 'missing'}\`);\nneed(existsSync(syncPath),'Missing package-version sync script.');\nconst sync=readFileSync(syncPath,'utf8');\nneed(sync.includes("join(root,'www','app.js')"),'Version sync must update app.js.');\nconst generated=app.match(/const FABRI_CADABRA_VERSION='([^']+)'/)?.[1];\nneed(generated===pkg.version,\`Browser version \${generated || 'missing'} does not match package version \${pkg.version}.\`);\nneed(app.includes("settingsPageBtn?.addEventListener('click'"),'Settings must use canonical page navigation.');\nneed(!/installSettingsPage|originalGetActiveTool|FabriCadabraApp\\.getActiveTool=/.test(app),'Settings navigation monkey-patch must be absent.');\nneed(app.includes("openDrawer('settingsChangelogDrawer'" ) && app.includes("closeDrawer('settingsChangelogDrawer'"),'Changelog must reuse shared drawer behavior.');\nconst currentIndex=html.indexOf("data-changelog-version='current'");\nconst v103Index=html.indexOf("data-changelog-version='1.0.3'");\nconst v102Index=html.indexOf("data-changelog-version='1.0.2'");\nconst v101Index=html.indexOf("data-changelog-version='1.0.1'");\nconst baselineIndex=html.indexOf("data-changelog-version='1.0.0'");\nneed(currentIndex>=0 && v103Index>currentIndex && v102Index>v103Index && v101Index>v102Index && baselineIndex>v101Index,'Changelog must remain newest-first.');\nfor (const heading of ['Task Logging','Fabricator Notes','Checklist','Basic Calculator','Quick Reference','Fastener Spacing','Sheet Optimizer','Saw Optimizer','Aluminum Overhang','App-Wide Features']) need(html.includes(\`<h3>\${heading}</h3>\`),\`Current Features changelog missing section: \${heading}\`);\nfor (const concept of ['phone-friendly','730 for 7:30','AM/PM selector','impossible times','Task Logging Jobs panel is now collapsible','Job # / Name now opens a dedicated rename overlay','Shift Schedule in Settings','green CLOCK IN','red CLOCK OUT','overtime','unscheduled work','overnight shifts','unrestricted Task Logging behavior']) need(html.includes(concept),\`Changelog missing required concept: \${concept}\`);\nconsole.log(\`Settings, canonical version \${pkg.version}, and newest-first changelog contract: OK\`);\n`;
writeFileSync(join(scripts,'verify-settings-changelog.mjs'),verifySettings,'utf8');

const syncSource=readFileSync(join(scripts,'sync-app-version.mjs'),'utf8')
  .replace("const uxPath=join(root,'www','ux.js');","const appPath=join(root,'www','app.js');")
  .replace('const source=readFileSync(uxPath,\'utf8\');','const source=readFileSync(appPath,\'utf8\');')
  .replace("'FABRI_CADABRA_VERSION generated marker is missing from www/ux.js.'","'FABRI_CADABRA_VERSION generated marker is missing from www/app.js.'")
  .replace('if (next!==source) writeFileSync(uxPath,next,\'utf8\');','if (next!==source) writeFileSync(appPath,next,\'utf8\');');
need(!syncSource.includes('uxPath') && !syncSource.includes('www/ux.js'),'Version sync still references ux.js.');
writeFileSync(join(scripts,'sync-app-version.mjs'),syncSource,'utf8');

writeFileSync(indexPath,html,'utf8');
writeFileSync(appPath,app,'utf8');
writeFileSync(stylesPath,styles,'utf8');
unlinkSync(uxPath);
unlinkSync(uxCssPath);

// Refuse to leave an active verifier coupled to the retired files.
for (const name of readdirSync(scripts).filter(name=>name.endsWith('.mjs') && name!=='migrate-canonical-ux.mjs')) {
  const source=readFileSync(join(scripts,name),'utf8');
  if (/www['"],?['"]ux\\.(?:js|css)|www\\/ux\\.(?:js|css)/.test(source)) throw new Error(`${name} still references a retired UX asset.`);
}

need(!html.includes('ux.js') && !html.includes('ux.css'),'Runtime UX patch references remain in index.html.');
need(!app.includes('new MutationObserver'),'MutationObserver repair remains in canonical app.js.');
need(!app.includes('installSettingsPage'),'Dynamic Settings installer remains in canonical app.js.');
console.log('Canonical UX migration applied successfully.');
