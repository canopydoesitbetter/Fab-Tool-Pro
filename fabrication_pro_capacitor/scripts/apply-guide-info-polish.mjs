import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root=process.cwd();
const paths={
  html:join(root,'www','index.html'),
  styles:join(root,'www','styles.css'),
  navigation:join(root,'www','app','navigation.js'),
  quickReference:join(root,'www','app','quick-reference.js'),
  verify:join(root,'scripts','verify-features.mjs'),
  release:join(root,'release.json')
};

function replaceExact(source,oldText,newText,label) {
  if(!source.includes(oldText)) throw new Error(`Unable to find ${label}.`);
  const next=source.replace(oldText,newText);
  if(next===source) throw new Error(`Unable to replace ${label}.`);
  return next;
}

function replaceBetween(source,startMarker,endMarker,replacement,label) {
  const start=source.indexOf(startMarker);
  if(start<0) throw new Error(`Unable to find start of ${label}.`);
  const end=source.indexOf(endMarker,start);
  if(end<0) throw new Error(`Unable to find end of ${label}.`);
  return source.slice(0,start)+replacement+source.slice(end);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
}

function extractRuleCard(source,heading) {
  const pattern=new RegExp(`\\n\\s*<section class="card">\\n\\s*<h2>${escapeRegExp(heading)}</h2>[\\s\\S]*?\\n\\s*</section>`);
  const match=source.match(pattern);
  if(!match) throw new Error(`Unable to find rules card: ${heading}`);
  const card=match[0].trim().replace('<section class="card">','<section class="card page-info-rules-card">');
  return {source:source.replace(match[0],''),card};
}

function indent(block,count) {
  const pad=' '.repeat(count);
  return block.split('\n').map(line=>pad+line).join('\n');
}

let html=readFileSync(paths.html,'utf8');
let styles=readFileSync(paths.styles,'utf8');
let navigation=readFileSync(paths.navigation,'utf8');
let quickReference=readFileSync(paths.quickReference,'utf8');
let verify=readFileSync(paths.verify,'utf8');
const release=JSON.parse(readFileSync(paths.release,'utf8'));

if(release.version!=='1.0.5' || release.buildNumber!==1000012 || release.previousVersion!=='1.0.4') {
  throw new Error(`Expected 1.0.5 build 1000012 baseline; found ${release.version} build ${release.buildNumber}.`);
}

const optimizerRules=extractRuleCard(html,'Automatic Product & Material Rules');
html=optimizerRules.source;
const sawRules=extractRuleCard(html,'Saw Optimization Rule');
html=sawRules.source;
const overhangRules=extractRuleCard(html,'Fabrication Rules Used');
html=overhangRules.source;

html=replaceExact(
  html,
  'id="taskLogInfoBtn" class="tasklog-info-btn"',
  'id="taskLogInfoBtn" class="tasklog-info-btn page-info-btn"',
  'shared Task Logging Info button class'
);

html=replaceBetween(
  html,
  '    <div class="tool-title fab-calculator-title-row">',
  '\n    <section class="card fab-calc-shell"',
  `    <div class="tool-title fab-calculator-title-row page-title-action-row">\n      <h2>Basic Calculator</h2>\n      <button id="calculatorGuideBtn" class="page-info-btn" type="button" aria-expanded="false" aria-controls="calculatorGuideDrawer">Guide</button>\n    </div>`,
  'Basic Calculator title and Guide control'
);

html=replaceBetween(
  html,
  '      <div class="tool-title">\n        <h2>Fabricator Notes</h2>',
  '\n\n      <details id="fabricatorNotesManagementDetails"',
  `      <div class="tool-title">\n        <h2>Fabricator Notes</h2>\n      </div>`,
  'Fabricator Notes title copy'
);

html=replaceBetween(
  html,
  '      <div class="tool-title">\n        <h2>Checklist</h2>',
  '\n\n      <details id="checklistManagementDetails"',
  `      <div class="tool-title">\n        <h2>Checklist</h2>\n      </div>`,
  'Checklist title copy'
);

const optimizerIntro='Add finished panel sizes and quantities. The optimizer evaluates the entire job together, reorders parts as needed, and assigns cuts across stock sheets. .063 Aluminum and ACP are automatically constrained to full-edge shear cuts; other materials use free-form nesting.';
html=replaceBetween(
  html,
  '      <div class="tool-title optimizer-title-row">',
  '\n\n      <details id="optimizerManagementDetails"',
  `      <div class="tool-title optimizer-title-row page-title-action-row">\n        <div class="page-title-heading"><h2>Sheet Optimizer</h2></div>\n        <div class="page-title-actions">\n          <button id="optimizerInfoBtn" class="page-info-btn" type="button" aria-expanded="false" aria-controls="optimizerInfoDrawer">Info</button>\n          <button id="optimizerCutListMenuBtn" class="cut-list-menu-btn" type="button" aria-expanded="false" aria-controls="optimizerCutListDrawer">\n            <span class="hamburger" aria-hidden="true">☰</span>\n            <span>Cut List</span>\n            <span id="optimizerCutListMeta" class="count">0</span>\n          </button>\n        </div>\n      </div>\n      <div id="optimizerInfoBackdrop" class="cut-list-backdrop" aria-hidden="true"></div>\n      <aside id="optimizerInfoDrawer" class="cut-list-drawer drawer-left page-info-drawer" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="optimizerInfoDrawerTitle">\n        <div class="cut-list-drawer-head">\n          <strong id="optimizerInfoDrawerTitle">Sheet Optimizer Info</strong>\n          <button id="optimizerInfoCloseBtn" class="cut-list-close-btn" type="button" aria-label="Close Sheet Optimizer Info">×</button>\n        </div>\n        <div class="cut-list-drawer-body page-info-body">\n          <p class="page-info-intro">${optimizerIntro}</p>\n${indent(optimizerRules.card,10)}\n        </div>\n      </aside>`,
  'Sheet Optimizer title and Info drawer'
);

const sawIntro='Enter the stock tube length, add every required part, then optimize the full job to reduce the number of tubes and leftover material.';
html=replaceBetween(
  html,
  '      <div class="tool-title optimizer-title-row">\n        <div>\n          <h2>Saw Optimizer</h2>',
  '\n\n      <section class="card">\n        <h2>Stock Tube</h2>',
  `      <div class="tool-title optimizer-title-row page-title-action-row">\n        <div class="page-title-heading"><h2>Saw Optimizer</h2></div>\n        <div class="page-title-actions">\n          <button id="sawInfoBtn" class="page-info-btn" type="button" aria-expanded="false" aria-controls="sawInfoDrawer">Info</button>\n          <button id="sawCutListMenuBtn" class="cut-list-menu-btn" type="button" aria-expanded="false" aria-controls="sawCutListDrawer">\n            <span class="hamburger" aria-hidden="true">☰</span>\n            <span>Part List</span>\n            <span id="sawCutListMeta" class="count">0</span>\n          </button>\n        </div>\n      </div>\n      <div id="sawInfoBackdrop" class="cut-list-backdrop" aria-hidden="true"></div>\n      <aside id="sawInfoDrawer" class="cut-list-drawer drawer-left page-info-drawer" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="sawInfoDrawerTitle">\n        <div class="cut-list-drawer-head">\n          <strong id="sawInfoDrawerTitle">Saw Optimizer Info</strong>\n          <button id="sawInfoCloseBtn" class="cut-list-close-btn" type="button" aria-label="Close Saw Optimizer Info">×</button>\n        </div>\n        <div class="cut-list-drawer-body page-info-body">\n          <p class="page-info-intro">${sawIntro}</p>\n${indent(sawRules.card,10)}\n        </div>\n      </aside>`,
  'Saw Optimizer title and Info drawer'
);

const overhangIntro='Enter the finished overhang dimensions. The tool will automatically add corner & seam flanges.';
html=replaceBetween(
  html,
  '      <div class="tool-title">\n        <h2>Aluminum Overhang Cut Calculator</h2>',
  '\n\n      <section class="card">\n        <h2>Finished Overhang Size</h2>',
  `      <div class="tool-title page-title-action-row">\n        <h2>Aluminum Overhang Cut Calculator</h2>\n        <button id="overhangInfoBtn" class="page-info-btn" type="button" aria-expanded="false" aria-controls="overhangInfoDrawer">Info</button>\n      </div>\n      <div id="overhangInfoBackdrop" class="cut-list-backdrop" aria-hidden="true"></div>\n      <aside id="overhangInfoDrawer" class="cut-list-drawer drawer-left page-info-drawer" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="overhangInfoDrawerTitle">\n        <div class="cut-list-drawer-head">\n          <strong id="overhangInfoDrawerTitle">Aluminum Overhang Info</strong>\n          <button id="overhangInfoCloseBtn" class="cut-list-close-btn" type="button" aria-label="Close Aluminum Overhang Info">×</button>\n        </div>\n        <div class="cut-list-drawer-body page-info-body">\n          <p class="page-info-intro">${overhangIntro}</p>\n${indent(overhangRules.card,10)}\n        </div>\n      </aside>`,
  'Aluminum Overhang title and Info drawer'
);

html=replaceExact(
  html,
  '<h2 id="quickReferenceTitle">Fraction Addition Chart</h2>\n            <p id="quickReferenceDescription">Add common shop fractions in 1/16&quot; increments. Pick the starting measurement on the left, then move across to the amount being added.</p>',
  '<h2 id="quickReferenceTitle">Fraction Addition Chart — 1/16</h2>\n            <p id="quickReferenceDescription" hidden></p>',
  'initial Quick Reference fraction title and description'
);

html=replaceExact(
  html,
  '<aside id="calculatorGuideDrawer" class="cut-list-drawer" role="dialog"',
  '<aside id="calculatorGuideDrawer" class="cut-list-drawer drawer-left" role="dialog"',
  'left-side Calculator Guide drawer class'
);

const changelogAnchor='          <li><b>Task Logging Info &amp; Management Panels:</b> Moved the Task Logging introduction and Timer Behavior guidance into a dedicated left-side Info drawer beside the page title, and made Checklist Management, Sheet Optimizer Job Management, and Saw Optimizer Saw Job File panels collapsible by default using the app\'s standard management-panel treatment.</li>';
const changelogAddition=`${changelogAnchor}\n          <li><b>Guide &amp; Info Drawer Polish:</b> Standardized the Calculator Guide plus Sheet Optimizer, Saw Optimizer, and Aluminum Overhang guidance as compact title-row Guide/Info controls with left-side drawers; moved fabrication rule panels into those drawers, removed redundant page introductions, and simplified the fraction Quick Reference headings and descriptions.</li>`;
html=replaceExact(html,changelogAnchor,changelogAddition,'1.0.5 changelog entry');

styles=replaceExact(
  styles,
  '.tasklog-info-btn {\n  flex:0 0 auto;',
  '.tasklog-info-btn,\n.page-info-btn {\n  flex:0 0 auto;',
  'shared page Info button style selector'
);
styles=replaceExact(
  styles,
  '  .tasklog-info-btn { min-height:40px; padding:7px 12px; }',
  '  .tasklog-info-btn, .page-info-btn { min-height:40px; padding:7px 12px; }',
  'shared mobile page Info button style selector'
);
styles += `\n\n/* Shared Guide/Info title controls and left-side guidance drawers (1.0.5). */\n.page-title-action-row {\n  display:flex;\n  align-items:center;\n  justify-content:space-between;\n  gap:12px;\n}\n.page-title-action-row h2 { margin:0; }\n.page-title-heading { min-width:0; }\n.page-title-actions {\n  display:flex;\n  align-items:center;\n  justify-content:flex-end;\n  gap:10px;\n  flex:0 0 auto;\n}\n.page-info-body { display:grid; gap:14px; }\n.page-info-intro {\n  margin:0;\n  color:var(--muted);\n  line-height:1.5;\n  font-size:.94rem;\n}\n.page-info-rules-card { margin:0; }\n@media (max-width:520px) {\n  .fab-calculator-title-row.page-title-action-row { flex-direction:row; align-items:center; }\n  .page-title-actions { gap:8px; }\n}\n@media print {\n  #optimizerInfoBackdrop,#optimizerInfoDrawer,#sawInfoBackdrop,#sawInfoDrawer,#overhangInfoBackdrop,#overhangInfoDrawer { display:none!important; }\n}\n`;

const bindingAnchor='  suppressToolPersistence=true;\n  selectTool(DEFAULT_TOOL);';
const bindingBlock=`  function bindPageInfoDrawer(buttonId,drawerId) {\n    const button=document.getElementById(buttonId);\n    const drawer=document.getElementById(drawerId);\n    const backdrop=document.getElementById(drawerId.replace(/Drawer$/,'Backdrop'));\n    const closeButton=drawer?.querySelector('.cut-list-close-btn');\n    if (!button || !drawer || !backdrop || !closeButton) throw new Error(\`Page Info drawer markup is incomplete: \${drawerId}\`);\n    const setOpen=open=>{\n      if (open) openDrawer(drawerId,button); else closeDrawer(drawerId,button);\n      button.setAttribute('aria-expanded',open?'true':'false');\n    };\n    button.addEventListener('click',()=>setOpen(!isDrawerOpen(drawerId)));\n    closeButton.addEventListener('click',()=>setOpen(false));\n    backdrop.addEventListener('click',()=>setOpen(false));\n    drawer.addEventListener('keydown',event=>{\n      if (event.key==='Escape') {\n        event.preventDefault();\n        event.stopPropagation();\n        setOpen(false);\n      }\n    });\n  }\n  [\n    ['optimizerInfoBtn','optimizerInfoDrawer'],\n    ['sawInfoBtn','sawInfoDrawer'],\n    ['overhangInfoBtn','overhangInfoDrawer']\n  ].forEach(([buttonId,drawerId])=>bindPageInfoDrawer(buttonId,drawerId));\n\n${bindingAnchor}`;
navigation=replaceExact(navigation,bindingAnchor,bindingBlock,'shared page Info drawer behavior');

quickReference=replaceExact(quickReference,"title:'Fraction Addition Chart',","title:'Fraction Addition Chart — 1/16',",'1/16 Quick Reference title');
for(const description of [
  'Add common shop fractions in 1/16" increments. Pick the starting measurement on the left, then move across to the amount being added.',
  'Add common shop fractions in 1/32" increments. Pick the starting measurement on the left, then move across to the amount being added.',
  'Add common shop fractions in 1/64" increments. Pick the starting measurement on the left, then move across to the amount being added.'
]) {
  quickReference=replaceExact(quickReference,`description:'${description}',`,"description:'',",`Quick Reference description ${description.slice(0,35)}`);
}
quickReference=replaceExact(
  quickReference,
  '    quickReferenceDescription.textContent = entry.description;',
  "    quickReferenceDescription.textContent = entry.description || '';\n    quickReferenceDescription.hidden = !entry.description;",
  'Quick Reference description visibility behavior'
);

const verifyAnchor="if(!styles.includes('.cut-list-drawer.drawer-left') || !styles.includes('transform:translateX(-102%)')) throw new Error('Task Logging Info drawer must be styled as a left-side drawer.');";
const verifyAddition=`${verifyAnchor}\nfor(const marker of [\n  'id="taskLogInfoBtn" class="tasklog-info-btn page-info-btn"',\n  'id="calculatorGuideBtn" class="page-info-btn"',\n  'id="calculatorGuideDrawer" class="cut-list-drawer drawer-left"',\n  'id="optimizerInfoBtn" class="page-info-btn"',\n  'id="optimizerInfoDrawer" class="cut-list-drawer drawer-left page-info-drawer"',\n  'id="sawInfoBtn" class="page-info-btn"',\n  'id="sawInfoDrawer" class="cut-list-drawer drawer-left page-info-drawer"',\n  'id="overhangInfoBtn" class="page-info-btn"',\n  'id="overhangInfoDrawer" class="cut-list-drawer drawer-left page-info-drawer"'\n]) {\n  if(!html.includes(marker)) throw new Error(\`Shared Guide/Info drawer markup missing: \${marker}\`);\n}\nfor(const removed of [\n  'Fast shop arithmetic with memory, percentages, roots, powers, rounding, keyboard input, and repeated operations.',\n  'Create shop topics and keep detailed notes inside each topic. Notes support bold, italic, and underline formatting, save automatically on this device, and can be exported as a portable JSON backup.',\n  'Create checklist topics for shop tasks, inspections, fabrication steps, or reminders. Add items inside each topic and check them off as work is completed.'\n]) {\n  if(html.includes(removed)) throw new Error(\`Removed page-introduction copy is still present: \${removed}\`);\n}\nfor(const heading of ['Automatic Product & Material Rules','Saw Optimization Rule','Fabrication Rules Used']) {\n  const count=(html.match(new RegExp(heading.replace(/[.*+?^\${}()|[\\]\\\\]/g,'\\\\$&'),'g'))||[]).length;\n  if(count!==1) throw new Error(\`Expected exactly one guidance rules heading for \${heading}; found \${count}.\`);\n}\nfor(const marker of [\n  \"title:'Fraction Addition Chart — 1/16'\",\n  \"description:''\",\n  'quickReferenceDescription.hidden = !entry.description;',\n  'function bindPageInfoDrawer(buttonId,drawerId)',\n  \"['optimizerInfoBtn','optimizerInfoDrawer']\",\n  \"['sawInfoBtn','sawInfoDrawer']\",\n  \"['overhangInfoBtn','overhangInfoDrawer']\"\n]) {\n  if(!app.includes(marker)) throw new Error(\`Guide/Info behavior marker missing: \${marker}\`);\n}\nfor(const removed of [\n  'Add common shop fractions in 1/16" increments. Pick the starting measurement on the left, then move across to the amount being added.',\n  'Add common shop fractions in 1/32" increments. Pick the starting measurement on the left, then move across to the amount being added.',\n  'Add common shop fractions in 1/64" increments. Pick the starting measurement on the left, then move across to the amount being added.'\n]) {\n  if(app.includes(removed)) throw new Error(\`Removed Quick Reference fraction description is still present: \${removed}\`);\n}\nif(!styles.includes('.page-info-btn') || !styles.includes('.page-title-action-row') || !styles.includes('.page-info-body')) throw new Error('Shared Guide/Info drawer styling is incomplete.');`;
verify=replaceExact(verify,verifyAnchor,verifyAddition,'Guide/Info source verification contract');

release.buildNumber=1000013;

writeFileSync(paths.html,html,'utf8');
writeFileSync(paths.styles,styles,'utf8');
writeFileSync(paths.navigation,navigation,'utf8');
writeFileSync(paths.quickReference,quickReference,'utf8');
writeFileSync(paths.verify,verify,'utf8');
writeFileSync(paths.release,JSON.stringify(release,null,2)+'\n','utf8');

console.log('Applied approved 1.0.5 Guide/Info drawer polish and native build 1000013.');
