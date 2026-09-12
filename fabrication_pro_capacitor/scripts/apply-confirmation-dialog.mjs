import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root=resolve(import.meta.dirname,'..');
const read=path=>readFileSync(join(root,path),'utf8');
const write=(path,value)=>writeFileSync(join(root,path),value);
const replaceOnce=(source,from,to,label)=>{
  const index=source.indexOf(from);
  if (index<0) throw new Error(`Patch target missing: ${label}`);
  if (source.indexOf(from,index+from.length)>=0) throw new Error(`Patch target is not unique: ${label}`);
  return source.slice(0,index)+to+source.slice(index+from.length);
};
const makeAsync=(source,name)=>replaceOnce(source,`function ${name}(`,`async function ${name}(`,`${name} async conversion`);

// Shared modal markup + 1.0.5 changelog entry. Preserve the frozen 1.0.4 entry verbatim except moving the current-version id.
let html=read('www/index.html');
const modalMarkup=`\n  <div id="appConfirmBackdrop" class="app-confirm-backdrop" aria-hidden="true"></div>\n  <section id="appConfirmDialog" class="app-confirm-dialog" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="appConfirmTitle" aria-describedby="appConfirmMessage">\n    <div class="app-confirm-panel">\n      <h2 id="appConfirmTitle">Confirm Action</h2>\n      <p id="appConfirmMessage"></p>\n      <div class="app-confirm-actions">\n        <button id="appConfirmCancelBtn" class="btn secondary" type="button">Cancel</button>\n        <button id="appConfirmConfirmBtn" class="btn app-confirm-confirm" type="button">Confirm</button>\n      </div>\n    </div>\n  </section>\n\n`;
html=replaceOnce(html,'  <script defer src="app/bootstrap.js"></script>',modalMarkup+'  <script defer src="app/bootstrap.js"></script>','confirmation modal insertion');
const release104="      <article class='changelog-entry changelog-release' data-changelog-version='1.0.4'>";
const release105=`      <article class='changelog-entry changelog-release' data-changelog-version='1.0.5'>\n        <div class='changelog-entry-heading'>\n          <div>\n            <span id='settingsCurrentChangelogVersion' class='changelog-version-label'>Version 1.0.5</span>\n            <h2>App-Styled Confirmation Dialogs</h2>\n          </div>\n        </div>\n        <ul>\n          <li><b>Fabri-Cadabra Confirmation Dialogs:</b> Replaced browser-native confirmation popups across Clock Out, Shift Schedule controls, destructive deletes and clears, overwrite/import/restore actions, and optimizer cut-status changes with one reusable app-styled modal featuring configurable titles and button labels, danger styling, keyboard focus trapping, Escape cancellation, backdrop cancellation, and previous-focus restoration.</li>\n          <li>Added permanent source and browser regression coverage so important workflows cannot silently fall back to <code>window.confirm()</code>.</li>\n        </ul>\n      </article>\n`;
html=replaceOnce(html,release104,release105+release104,'1.0.5 changelog insertion');
html=replaceOnce(html,"<span id='settingsCurrentChangelogVersion' class='changelog-version-label'>Version 1.0.4</span>","<span class='changelog-version-label'>Version 1.0.4</span>",'freeze 1.0.4 changelog id');
write('www/index.html',html);

// App-styled modal visuals; use existing theme variables so light/dark modes remain consistent.
let styles=read('www/styles.css');
styles+=`\n\n/* Fabri-Cadabra reusable confirmation dialog */\nbody.app-confirm-open { overflow:hidden; }\n.app-confirm-backdrop {\n  position:fixed; inset:0; z-index:340; background:rgba(3,12,20,.66);\n  opacity:0; visibility:hidden; transition:opacity .18s ease,visibility .18s ease;\n}\n.app-confirm-backdrop.open { opacity:1; visibility:visible; }\n.app-confirm-dialog {\n  position:fixed; left:50%; top:50%; z-index:341; width:min(92vw,520px); max-height:min(82vh,680px);\n  transform:translate(-50%,-48%) scale(.97); opacity:0; visibility:hidden;\n  transition:transform .18s ease,opacity .18s ease,visibility .18s ease; outline:none;\n}\n.app-confirm-dialog.open { transform:translate(-50%,-50%) scale(1); opacity:1; visibility:visible; }\n.app-confirm-panel {\n  overflow:auto; max-height:min(82vh,680px); background:var(--card); color:var(--text);\n  border:2px solid var(--panel-border-inner); border-radius:18px; padding:18px;\n  box-shadow:0 0 0 2px var(--card),0 0 0 3px var(--panel-border-outer),var(--panel-depth);\n}\n.app-confirm-panel h2 { margin:0 0 8px; color:var(--accent); font-size:1.2rem; line-height:1.25; }\n.app-confirm-panel p { margin:0; color:var(--muted); font-size:.94rem; line-height:1.48; white-space:pre-wrap; }\n.app-confirm-actions { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:18px; }\n.app-confirm-confirm.danger { background:var(--danger); color:var(--card); }\n.app-confirm-dialog :is(button):focus-visible { outline:none; box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 24%,transparent),0 3px 0 var(--button-edge),var(--button-depth); }\n@media (max-width:520px) { .app-confirm-actions { grid-template-columns:1fr; } }\n@media (prefers-reduced-motion: reduce) { .app-confirm-backdrop,.app-confirm-dialog { transition:none; } }\n`;
write('www/styles.css',styles);

// Shared confirmation controller lives with the other shared overlays/drawers.
let drawers=read('www/app/drawers.js');
drawers+=`\n\n  const appConfirmBackdrop=document.getElementById('appConfirmBackdrop');\n  const appConfirmDialog=document.getElementById('appConfirmDialog');\n  const appConfirmTitle=document.getElementById('appConfirmTitle');\n  const appConfirmMessage=document.getElementById('appConfirmMessage');\n  const appConfirmCancelBtn=document.getElementById('appConfirmCancelBtn');\n  const appConfirmConfirmBtn=document.getElementById('appConfirmConfirmBtn');\n  let appConfirmResolve=null;\n  let appConfirmReturnFocus=null;\n\n  function appConfirmationFromInput(input) {\n    if (input && typeof input==='object' && !Array.isArray(input)) {\n      return {\n        title:String(input.title || 'Confirm Action'),\n        message:String(input.message || ''),\n        confirmLabel:String(input.confirmLabel || 'Confirm'),\n        cancelLabel:String(input.cancelLabel || 'Cancel'),\n        danger:input.danger===true\n      };\n    }\n    const message=String(input || '');\n    const lower=message.toLocaleLowerCase();\n    let title='Confirm Action',confirmLabel='Confirm',danger=false;\n    if (lower.startsWith('clock out')) { title='Clock Out?'; confirmLabel='Clock Out'; danger=true; }\n    else if (lower.includes('clock in')) { title='Clock In?'; confirmLabel='Clock In'; }\n    else if (lower.startsWith('enable shift schedule')) { title='Enable Shift Schedule?'; confirmLabel='Enable'; }\n    else if (lower.startsWith('disable shift schedule')) { title='Disable Shift Schedule?'; confirmLabel='Disable'; danger=true; }\n    else if (lower.startsWith('delete')) { title='Delete?'; confirmLabel='Delete'; danger=true; }\n    else if (lower.startsWith('remove')) { title='Remove?'; confirmLabel='Remove'; danger=true; }\n    else if (lower.startsWith('clear')) { title='Clear?'; confirmLabel='Clear'; danger=true; }\n    else if (lower.includes('restore')) { title='Restore Data?'; confirmLabel='Restore'; danger=true; }\n    else if (lower.includes('replace') || lower.includes('discard')) { title='Replace Existing Data?'; confirmLabel=lower.includes('import')?'Import':'Replace'; danger=true; }\n    else if (lower.startsWith('mark ')) { title='Update Cut Status?'; confirmLabel='Update'; }\n    return {title,message,confirmLabel,cancelLabel:'Cancel',danger};\n  }\n\n  function settleAppConfirmation(result) {\n    if (!appConfirmResolve) return;\n    const resolve=appConfirmResolve;\n    const returnFocus=appConfirmReturnFocus;\n    appConfirmResolve=null;\n    appConfirmReturnFocus=null;\n    appConfirmDialog.classList.remove('open');\n    appConfirmBackdrop.classList.remove('open');\n    appConfirmDialog.setAttribute('aria-hidden','true');\n    appConfirmBackdrop.setAttribute('aria-hidden','true');\n    document.body.classList.remove('app-confirm-open');\n    resolve(result===true);\n    if (returnFocus && returnFocus.isConnected && typeof returnFocus.focus==='function') {\n      requestAnimationFrame(()=>returnFocus.focus({preventScroll:true}));\n    }\n  }\n\n  function confirmAppAction(input={}) {\n    if (!appConfirmDialog || !appConfirmBackdrop || !appConfirmTitle || !appConfirmMessage || !appConfirmCancelBtn || !appConfirmConfirmBtn) {\n      return Promise.resolve(false);\n    }\n    if (appConfirmResolve) settleAppConfirmation(false);\n    const options=appConfirmationFromInput(input);\n    appConfirmReturnFocus=document.activeElement;\n    appConfirmTitle.textContent=options.title;\n    appConfirmMessage.textContent=options.message;\n    appConfirmCancelBtn.textContent=options.cancelLabel;\n    appConfirmConfirmBtn.textContent=options.confirmLabel;\n    appConfirmConfirmBtn.classList.toggle('danger',options.danger===true);\n    appConfirmDialog.classList.add('open');\n    appConfirmBackdrop.classList.add('open');\n    appConfirmDialog.setAttribute('aria-hidden','false');\n    appConfirmBackdrop.setAttribute('aria-hidden','false');\n    document.body.classList.add('app-confirm-open');\n    return new Promise(resolve=>{\n      appConfirmResolve=resolve;\n      requestAnimationFrame(()=>{\n        const target=options.danger ? appConfirmCancelBtn : appConfirmConfirmBtn;\n        target.focus({preventScroll:true});\n      });\n    });\n  }\n\n  function trapAppConfirmationFocus(event) {\n    if (event.key!=='Tab' || !appConfirmDialog.classList.contains('open')) return;\n    const focusable=Array.from(appConfirmDialog.querySelectorAll('button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter(el=>el.offsetParent!==null);\n    if (!focusable.length) { event.preventDefault(); return; }\n    const first=focusable[0],last=focusable[focusable.length-1];\n    if (event.shiftKey && document.activeElement===first) { event.preventDefault(); last.focus(); }\n    else if (!event.shiftKey && document.activeElement===last) { event.preventDefault(); first.focus(); }\n  }\n\n  appConfirmCancelBtn?.addEventListener('click',()=>settleAppConfirmation(false));\n  appConfirmConfirmBtn?.addEventListener('click',()=>settleAppConfirmation(true));\n  appConfirmBackdrop?.addEventListener('click',()=>settleAppConfirmation(false));\n  appConfirmDialog?.addEventListener('keydown',event=>{\n    if (event.key==='Escape') { event.preventDefault(); event.stopPropagation(); settleAppConfirmation(false); return; }\n    trapAppConfirmationFocus(event);\n  });\n`;
write('www/app/drawers.js',drawers);

let navigation=read('www/app/navigation.js');
navigation=replaceOnce(navigation,'window.FabriCadabraApp={getActiveTool,openDrawer,closeDrawer,isDrawerOpen,version:FABRI_CADABRA_VERSION,storage:persistentStoragePublicApi};','window.FabriCadabraApp={getActiveTool,openDrawer,closeDrawer,isDrawerOpen,confirmAction:confirmAppAction,version:FABRI_CADABRA_VERSION,storage:persistentStoragePublicApi};','public confirmation API');
write('www/app/navigation.js',navigation);

// Replace native confirm calls everywhere, then mark only the containing workflows async.
const runtimeFiles=[
  'www/backup.js',
  ...readdirSync(join(root,'www','app')).filter(name=>name.endsWith('.js')).map(name=>'www/app/'+name)
];
for (const path of runtimeFiles) {
  let source=read(path);
  source=source.replaceAll('window.confirm(','await confirmAppAction(');
  write(path,source);
}

const asyncFunctions={
  'www/app/task-logging.js':['deleteTaskLogPreset','removeTaskLogTask','deleteActiveTaskLogJob'],
  'www/app/checklist.js':['normalizeChecklistItemText','removeChecklistItem','deleteChecklistTopic'],
  'www/app/notes.js':['deleteActiveFabricatorNote'],
  'www/app/sheet-optimizer.js':['saveOptimizerJob','loadOptimizerJob','deleteOptimizerSavedJob','toggleOptimizerPartCut','clearOptimizerJob'],
  'www/app/saw-optimizer.js':['toggleSawPartCut','clearSawJob']
};
for (const [path,names] of Object.entries(asyncFunctions)) {
  let source=read(path);
  for (const name of names) source=makeAsync(source,name);
  write(path,source);
}
let saw=read('www/app/saw-optimizer.js');
saw=replaceOnce(saw,'    reader.onload=()=>{','    reader.onload=async ()=>{','Saw import confirmation async callback');
write('www/app/saw-optimizer.js',saw);
let settings=read('www/app/settings.js');
settings=replaceOnce(settings,"    shiftClockBtn.addEventListener('click',()=>{","    shiftClockBtn.addEventListener('click',async ()=>{",'shift clock confirmation async callback');
settings=replaceOnce(settings,"  shiftScheduleMasterToggle?.addEventListener('change',()=>{","  shiftScheduleMasterToggle?.addEventListener('change',async ()=>{",'shift schedule toggle confirmation async callback');
write('www/app/settings.js',settings);

// Update existing Playwright confirmation helpers/call sites to drive the in-app modal.
let helpers=read('tests/e2e/helpers.mjs');
const oldHelpers=`export function acceptNextDialog(page, expectedText) {\n  page.once('dialog', async dialog => {\n    expect(dialog.message()).toContain(expectedText);\n    await dialog.accept();\n  });\n}\n\nexport function dismissNextDialog(page, expectedText) {\n  page.once('dialog', async dialog => {\n    expect(dialog.message()).toContain(expectedText);\n    await dialog.dismiss();\n  });\n}`;
const newHelpers=`export async function acceptNextDialog(page, expectedText) {\n  const dialog=page.locator('#appConfirmDialog');\n  await expect(dialog).toHaveAttribute('aria-hidden','false');\n  await expect(page.locator('#appConfirmMessage')).toContainText(expectedText);\n  await page.locator('#appConfirmConfirmBtn').click();\n}\n\nexport async function dismissNextDialog(page, expectedText) {\n  const dialog=page.locator('#appConfirmDialog');\n  await expect(dialog).toHaveAttribute('aria-hidden','false');\n  await expect(page.locator('#appConfirmMessage')).toContainText(expectedText);\n  await page.locator('#appConfirmCancelBtn').click();\n}`;
helpers=replaceOnce(helpers,oldHelpers,newHelpers,'Playwright confirmation helpers');
write('tests/e2e/helpers.mjs',helpers);
for (const name of readdirSync(join(root,'tests','e2e')).filter(name=>name.endsWith('.mjs') && name!=='helpers.mjs' && name!=='confirmation-dialog.spec.mjs')) {
  const path='tests/e2e/'+name;
  let source=read(path);
  for (const helper of ['acceptNextDialog','dismissNextDialog']) {
    const pattern=new RegExp(`^(\\s*)${helper}\\(page, ([^\\n]+)\\);\\n\\1(await [^\\n]+;)$`,'gm');
    source=source.replace(pattern,(_,indent,expected,action)=>`${indent}${action}\n${indent}await ${helper}(page, ${expected});`);
  }
  write(path,source);
}

// Begin the new public release line. Native build stays monotonic.
let pkg=read('package.json');
pkg=pkg.replace('"version": "1.0.4"','"version": "1.0.5"');
write('package.json',pkg);
let lock=read('package-lock.json');
lock=lock.replace('"version": "1.0.4"','"version": "1.0.5"').replace('"version": "1.0.4"','"version": "1.0.5"');
write('package-lock.json',lock);
write('release.json','{\n  "version": "1.0.5",\n  "buildNumber": 1000008,\n  "previousVersion": "1.0.4"\n}\n');
let bootstrap=read('www/app/bootstrap.js');
bootstrap=replaceOnce(bootstrap,"const FABRI_CADABRA_VERSION='1.0.4'; // @generated from package.json by scripts/sync-app-version.mjs","const FABRI_CADABRA_VERSION='1.0.5'; // @generated from package.json by scripts/sync-app-version.mjs",'browser release version');
write('www/app/bootstrap.js',bootstrap);

console.log('Applied Fabri-Cadabra 1.0.5 confirmation-dialog implementation and release metadata.');
