import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const indexPath = path.join(root, 'www', 'index.html');
const stylesPath = path.join(root, 'www', 'styles.css');
const taskLogPath = path.join(root, 'www', 'app', 'task-logging.js');
const verifyPath = path.join(root, 'scripts', 'verify-features.mjs');
const releasePath = path.join(root, 'release.json');
const uiPanelsTestPath = path.join(root, 'tests', 'e2e', 'ui-panels.spec.mjs');
const notesChecklistTestPath = path.join(root, 'tests', 'e2e', 'notes-checklist.spec.mjs');
const optimizersTestPath = path.join(root, 'tests', 'e2e', 'optimizers.spec.mjs');
const backupRestoreTestPath = path.join(root, 'tests', 'e2e', 'backup-restore.spec.mjs');

function replaceOnce(source, from, to, label) {
  const first = source.indexOf(from);
  if (first < 0) throw new Error(`Could not find ${label}`);
  if (source.indexOf(from, first + from.length) >= 0) throw new Error(`Found multiple ${label} targets`);
  return source.slice(0, first) + to + source.slice(first + from.length);
}

function findSectionEnd(html, start) {
  const tag = /<section\b[^>]*>|<\/section>/g;
  tag.lastIndex = start;
  let depth = 0;
  for (let match = tag.exec(html); match; match = tag.exec(html)) {
    if (match[0].startsWith('</section')) depth -= 1;
    else depth += 1;
    if (depth === 0) return tag.lastIndex;
  }
  throw new Error(`Unclosed section starting at ${start}`);
}

function convertCard(html, headingMarker, id, summaryHtml, stateText) {
  const headingIndex = html.indexOf(headingMarker);
  if (headingIndex < 0) throw new Error(`Missing management heading ${headingMarker}`);
  const start = html.lastIndexOf('<section class="card">', headingIndex);
  if (start < 0) throw new Error(`Missing card start for ${headingMarker}`);
  const end = findSectionEnd(html, start);
  const block = html.slice(start, end);
  const h2Start = block.indexOf('<h2>');
  const h2End = block.indexOf('</h2>', h2Start);
  if (h2Start < 0 || h2End < 0) throw new Error(`Missing h2 for ${headingMarker}`);
  const beforeH2 = block.slice('<section class="card">'.length, h2Start);
  const body = beforeH2 + block.slice(h2End + '</h2>'.length, -'</section>'.length);
  const replacement = `<details id="${id}" class="card management-details">\n        <summary class="management-summary"><span>${summaryHtml}</span><span class="management-summary-state">${stateText}</span></summary>\n        <div class="management-details-body">${body}\n        </div>\n      </details>`;
  return html.slice(0, start) + replacement + html.slice(end);
}

let html = fs.readFileSync(indexPath, 'utf8');

const oldTitle = `      <div class="tool-title tasklog-title-row">\n        <div>\n          <h2>Task Logging</h2>\n          <p>Create jobs, assign reusable preset tasks, and track real fabrication time with persistent start/stop timers. Timers are timestamp-based, so locking the phone or switching pages does not lose elapsed time.</p>\n        </div>\n      </div>`;
const newTitle = `      <div class="tool-title tasklog-title-row">\n        <h2>Task Logging</h2>\n        <button id="taskLogInfoBtn" class="tasklog-info-btn" type="button" aria-expanded="false" aria-controls="taskLogInfoDrawer">Info</button>\n      </div>`;
html = replaceOnce(html, oldTitle, newTitle, 'Task Logging title/intro block');

const oldTimer = `      <section class="card">\n        <h2>Timer Behavior</h2>\n        <div class="rules">\n          <div class="rule"><b>One active task:</b> starting a different task automatically stops the currently running task at the same timestamp, preventing overlapping labor time.</div>\n          <div class="rule"><b>Screen lock / page change:</b> the running timer is stored as an absolute start timestamp. The visible counter may pause while a browser is suspended, but elapsed time is recalculated correctly when the app becomes active again.</div>\n          <div class="rule"><b>Phone/browser restart:</b> running state is saved immediately when Start is pressed. Reopening this HTML resumes the elapsed-time calculation from the stored timestamp.</div>\n          <div class="rule"><b>Portable backups:</b> job and preset libraries use separate versioned JSON formats. If a job backup contains a running timer, importing it safely stops that timer at the backup's export timestamp so transfer time is not counted as labor.</div>\n        </div>\n        <div class="note">Timer accuracy depends on the device clock. Manually changing the phone's date or time while a task is running can affect the measured elapsed time.</div>\n      </section>\n`;
if (!html.includes(oldTimer)) throw new Error('Could not find canonical Timer Behavior card');
html = html.replace(oldTimer, '');

const drawerMarkup = `\n      <div id="taskLogInfoBackdrop" class="cut-list-backdrop" aria-hidden="true"></div>\n      <aside id="taskLogInfoDrawer" class="cut-list-drawer drawer-left tasklog-info-drawer" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="taskLogInfoDrawerTitle">\n        <div class="cut-list-drawer-head">\n          <strong id="taskLogInfoDrawerTitle">Task Logging Info</strong>\n          <button id="taskLogInfoCloseBtn" class="cut-list-close-btn" type="button" aria-label="Close Task Logging Info">×</button>\n        </div>\n        <div class="cut-list-drawer-body tasklog-info-body">\n          <p class="tasklog-info-intro">Create jobs, assign reusable preset tasks, and track real fabrication time with persistent start/stop timers. Timers are timestamp-based, so locking the phone or switching pages does not lose elapsed time.</p>\n          <section class="card tasklog-info-timer-card">\n            <h2>Timer Behavior</h2>\n            <div class="rules">\n              <div class="rule"><b>One active task:</b> starting a different task automatically stops the currently running task at the same timestamp, preventing overlapping labor time.</div>\n              <div class="rule"><b>Screen lock / page change:</b> the running timer is stored as an absolute start timestamp. The visible counter may pause while a browser is suspended, but elapsed time is recalculated correctly when the app becomes active again.</div>\n              <div class="rule"><b>Phone/browser restart:</b> running state is saved immediately when Start is pressed. Reopening this HTML resumes the elapsed-time calculation from the stored timestamp.</div>\n              <div class="rule"><b>Portable backups:</b> job and preset libraries use separate versioned JSON formats. If a job backup contains a running timer, importing it safely stops that timer at the backup's export timestamp so transfer time is not counted as labor.</div>\n            </div>\n            <div class="note">Timer accuracy depends on the device clock. Manually changing the phone's date or time while a task is running can affect the measured elapsed time.</div>\n          </section>\n        </div>\n      </aside>\n`;
html = replaceOnce(html, newTitle, newTitle + drawerMarkup, 'Task Logging title insertion point');

html = convertCard(html, '<h2>Checklist Management</h2>', 'checklistManagementDetails', 'Checklist Management', 'Topics • Import • Export');
html = convertCard(html, '<h2>Job Management ', 'optimizerManagementDetails', 'Job Management <span id="optimizerActiveJobChip" class="job-number-chip" style="display:none"></span>', 'Save • Load • Import • Export');
html = convertCard(html, '<h2>Saw Job File</h2>', 'sawManagementDetails', 'Saw Job File', 'Import • Export');

const changelogAnchor = '          <li><b>Page Order &amp; Header Copy:</b> Reordered the physical tool sections in <code>index.html</code> to match the Pages drawer, retained Settings last, and shortened the header guidance to the current fabrication/navigation copy.</li>';
const changelogAddition = `${changelogAnchor}\n          <li><b>Task Logging Info &amp; Management Panels:</b> Moved the Task Logging introduction and Timer Behavior guidance into a dedicated left-side Info drawer beside the page title, and made Checklist Management, Sheet Optimizer Job Management, and Saw Optimizer Saw Job File panels collapsible by default using the app's standard management-panel treatment.</li>`;
html = replaceOnce(html, changelogAnchor, changelogAddition, '1.0.5 page-order changelog entry');
fs.writeFileSync(indexPath, html);

let styles = fs.readFileSync(stylesPath, 'utf8');
const css = `\n\n/* Task Logging Info drawer and management-panel consistency (1.0.5). */\n.tasklog-title-row {\n  display:flex;\n  align-items:center;\n  justify-content:space-between;\n  gap:12px;\n}\n.tasklog-title-row h2 { margin:0; }\n.tasklog-info-btn {\n  flex:0 0 auto;\n  min-height:42px;\n  padding:8px 14px;\n  border:1px solid var(--border);\n  border-radius:12px;\n  background:var(--card2);\n  color:var(--accent);\n  font-weight:900;\n}\n.cut-list-drawer.drawer-left {\n  left:0;\n  right:auto;\n  border-left:0;\n  border-right:1px solid var(--border);\n  box-shadow:18px 0 46px rgba(0,0,0,.28);\n  transform:translateX(-102%);\n}\n.cut-list-drawer.drawer-left.open { transform:translateX(0); }\n.tasklog-info-body { display:grid; gap:14px; }\n.tasklog-info-intro {\n  margin:0;\n  color:var(--muted);\n  line-height:1.5;\n  font-size:.94rem;\n}\n.tasklog-info-timer-card { margin:0; }\n@media (max-width:640px) {\n  .tasklog-title-row { align-items:center; }\n  .tasklog-info-btn { min-height:40px; padding:7px 12px; }\n}\n`;
if (styles.includes('Task Logging Info drawer and management-panel consistency (1.0.5).')) throw new Error('Info drawer styles already present unexpectedly');
styles += css;
fs.writeFileSync(stylesPath, styles);

let taskLog = fs.readFileSync(taskLogPath, 'utf8');
taskLog = replaceOnce(taskLog,
  "  const taskLogPresetDrawerMeta = document.getElementById('taskLogPresetDrawerMeta');",
  "  const taskLogPresetDrawerMeta = document.getElementById('taskLogPresetDrawerMeta');\n  const taskLogInfoBtn = document.getElementById('taskLogInfoBtn');\n  const taskLogInfoDrawer = document.getElementById('taskLogInfoDrawer');\n  const taskLogInfoBackdrop = document.getElementById('taskLogInfoBackdrop');\n  const taskLogInfoCloseBtn = document.getElementById('taskLogInfoCloseBtn');",
  'Task Logging drawer element declarations'
);
taskLog = replaceOnce(taskLog,
  "  function setTaskLogPresetDrawerOpen(open) {\n    if (open) openDrawer('taskLogPresetDrawer',document.activeElement); else closeDrawer('taskLogPresetDrawer');\n    taskLogPresetMenuBtn.setAttribute('aria-expanded',open?'true':'false');\n  }",
  "  function setTaskLogPresetDrawerOpen(open) {\n    if (open) openDrawer('taskLogPresetDrawer',document.activeElement); else closeDrawer('taskLogPresetDrawer');\n    taskLogPresetMenuBtn.setAttribute('aria-expanded',open?'true':'false');\n  }\n\n  function setTaskLogInfoDrawerOpen(open) {\n    if (open) openDrawer('taskLogInfoDrawer',document.activeElement); else closeDrawer('taskLogInfoDrawer');\n    taskLogInfoBtn.setAttribute('aria-expanded',open?'true':'false');\n  }",
  'Task Logging drawer open helper'
);
taskLog = replaceOnce(taskLog,
  "  taskLogNewJobBtn.addEventListener('click',createTaskLogJob);\n  taskLogPresetMenuBtn.addEventListener('click',()=>setTaskLogPresetDrawerOpen(!taskLogPresetDrawer.classList.contains('open')));",
  "  taskLogNewJobBtn.addEventListener('click',createTaskLogJob);\n  taskLogInfoBtn.addEventListener('click',()=>setTaskLogInfoDrawerOpen(!taskLogInfoDrawer.classList.contains('open')));\n  taskLogInfoCloseBtn.addEventListener('click',()=>setTaskLogInfoDrawerOpen(false));\n  taskLogInfoBackdrop.addEventListener('click',()=>setTaskLogInfoDrawerOpen(false));\n  taskLogInfoDrawer.addEventListener('keydown',e=>{\n    if (e.key==='Escape') { e.preventDefault(); setTaskLogInfoDrawerOpen(false); }\n  });\n  taskLogPresetMenuBtn.addEventListener('click',()=>setTaskLogPresetDrawerOpen(!taskLogPresetDrawer.classList.contains('open')));",
  'Task Logging event binding insertion point'
);
fs.writeFileSync(taskLogPath, taskLog);

let verify = fs.readFileSync(verifyPath, 'utf8');
const verifierAnchor = "if(!styles.includes('.tasklog-remove-task') || !styles.includes('display:none !important;')) {\n  throw new Error('Inline task removal must be hidden so tasks can only be removed from the preset drawer.');\n}";
const verifierAddition = `${verifierAnchor}\nfor(const marker of [\n  'id="taskLogInfoBtn"',\n  'id="taskLogInfoBackdrop"',\n  'id="taskLogInfoDrawer" class="cut-list-drawer drawer-left tasklog-info-drawer"',\n  'id="taskLogInfoCloseBtn"',\n  'id="checklistManagementDetails" class="card management-details"',\n  'id="optimizerManagementDetails" class="card management-details"',\n  'id="sawManagementDetails" class="card management-details"'\n]) {\n  if(!html.includes(marker)) throw new Error(\`Info/management panel markup missing: \${marker}\`);\n}\nfor(const id of ['checklistManagementDetails','optimizerManagementDetails','sawManagementDetails']) {\n  if(new RegExp(\`<details[^>]*id="\${id}"[^>]*\\\\sopen(?:\\\\s|>)\`).test(html)) throw new Error(\`\${id} must be collapsed by default.\`);\n}\nif(!styles.includes('.cut-list-drawer.drawer-left') || !styles.includes('transform:translateX(-102%)')) throw new Error('Task Logging Info drawer must be styled as a left-side drawer.');\nfor(const marker of [\"setTaskLogInfoDrawerOpen\",\"openDrawer('taskLogInfoDrawer'\",\"closeDrawer('taskLogInfoDrawer'\"]) {\n  if(!app.includes(marker)) throw new Error(\`Task Logging Info drawer behavior missing: \${marker}\`);\n}`;
verify = replaceOnce(verify, verifierAnchor, verifierAddition, 'feature verifier insertion point');
fs.writeFileSync(verifyPath, verify);

let uiPanelsTest = fs.readFileSync(uiPanelsTestPath, 'utf8');
uiPanelsTest = replaceOnce(uiPanelsTest,
  `  const side = await drawer.evaluate(element => ({\n    left: getComputedStyle(element).left,\n    right: getComputedStyle(element).right,\n    transform: getComputedStyle(element).transform\n  }));\n  expect(side.left).toBe('0px');\n  expect(side.right).toBe('auto');`,
  `  const side = await drawer.evaluate(element => ({ left: getComputedStyle(element).left }));\n  const box = await drawer.boundingBox();\n  expect(side.left).toBe('0px');\n  expect(box).not.toBeNull();\n  expect(Math.abs(box.x)).toBeLessThanOrEqual(1);`,
  'left drawer browser assertion'
);
fs.writeFileSync(uiPanelsTestPath, uiPanelsTest);

let notesChecklistTest = fs.readFileSync(notesChecklistTestPath, 'utf8');
notesChecklistTest = replaceOnce(notesChecklistTest,
  `async function openChecklist(page) {\n  await openApp(page);\n  await openTool(page, 'Checklist', '#tool-checklist');\n}`,
  `async function openChecklist(page) {\n  await openApp(page);\n  await openTool(page, 'Checklist', '#tool-checklist');\n  const details = page.locator('#checklistManagementDetails');\n  if (!(await details.evaluate(element => element.open))) await details.locator('> summary').click();\n  await expect(details).toHaveAttribute('open', '');\n}`,
  'Checklist test page helper'
);
fs.writeFileSync(notesChecklistTestPath, notesChecklistTest);

let optimizersTest = fs.readFileSync(optimizersTestPath, 'utf8');
optimizersTest = replaceOnce(optimizersTest,
  `async function openSheetOptimizer(page) {\n  await openApp(page);\n  await openTool(page, 'Sheet Optimizer', '#tool-optimizer');\n}`,
  `async function openSheetOptimizer(page) {\n  await openApp(page);\n  await openTool(page, 'Sheet Optimizer', '#tool-optimizer');\n  const details = page.locator('#optimizerManagementDetails');\n  if (!(await details.evaluate(element => element.open))) await details.locator('> summary').click();\n  await expect(details).toHaveAttribute('open', '');\n}`,
  'Sheet Optimizer test page helper'
);
optimizersTest = replaceOnce(optimizersTest,
  `async function openSawOptimizer(page) {\n  await openApp(page);\n  await openTool(page, 'Saw Optimizer', '#tool-saw');\n}`,
  `async function openSawOptimizer(page) {\n  await openApp(page);\n  await openTool(page, 'Saw Optimizer', '#tool-saw');\n  const details = page.locator('#sawManagementDetails');\n  if (!(await details.evaluate(element => element.open))) await details.locator('> summary').click();\n  await expect(details).toHaveAttribute('open', '');\n}`,
  'Saw Optimizer test page helper'
);
fs.writeFileSync(optimizersTestPath, optimizersTest);

let backupRestoreTest = fs.readFileSync(backupRestoreTestPath, 'utf8');
backupRestoreTest = replaceOnce(backupRestoreTest,
  `async function createChecklistFixture(page) {\n  await openTool(page,'Checklist','#tool-checklist');\n  await page.locator('#checklistNewTopicBtn').click();`,
  `async function createChecklistFixture(page) {\n  await openTool(page,'Checklist','#tool-checklist');\n  const details=page.locator('#checklistManagementDetails');\n  if (!(await details.evaluate(el=>el.open))) await details.locator('> summary').click();\n  await expect(details).toHaveAttribute('open','');\n  await page.locator('#checklistNewTopicBtn').click();`,
  'backup Checklist fixture'
);
backupRestoreTest = replaceOnce(backupRestoreTest,
  `async function createOptimizerFixture(page) {\n  await openTool(page,'Sheet Optimizer','#tool-optimizer');\n  await page.locator('#optimizerJobNumber').fill('BACKUP-100');`,
  `async function createOptimizerFixture(page) {\n  await openTool(page,'Sheet Optimizer','#tool-optimizer');\n  const details=page.locator('#optimizerManagementDetails');\n  if (!(await details.evaluate(el=>el.open))) await details.locator('> summary').click();\n  await expect(details).toHaveAttribute('open','');\n  await page.locator('#optimizerJobNumber').fill('BACKUP-100');`,
  'backup Sheet Optimizer fixture'
);
backupRestoreTest = replaceOnce(backupRestoreTest,
  `  await openTool(page,'Sheet Optimizer','#tool-optimizer');\n  await expect(page.locator('#optimizerSavedJobs')).toContainText('BACKUP-100');`,
  `  await openTool(page,'Sheet Optimizer','#tool-optimizer');\n  const optimizerManagement=page.locator('#optimizerManagementDetails');\n  if (!(await optimizerManagement.evaluate(el=>el.open))) await optimizerManagement.locator('> summary').click();\n  await expect(optimizerManagement).toHaveAttribute('open','');\n  await expect(page.locator('#optimizerSavedJobs')).toContainText('BACKUP-100');`,
  'backup restored optimizer management interaction'
);
fs.writeFileSync(backupRestoreTestPath, backupRestoreTest);

const release = JSON.parse(fs.readFileSync(releasePath, 'utf8'));
if (release.version !== '1.0.5' || Number(release.buildNumber) !== 1000011 || release.previousVersion !== '1.0.4') {
  throw new Error(`Unexpected release baseline: ${JSON.stringify(release)}`);
}
release.buildNumber = 1000012;
fs.writeFileSync(releasePath, `${JSON.stringify(release, null, 2)}\n`);

console.log('Applied Fabri-Cadabra 1.0.5 Task Logging Info drawer, collapsible management panels, updated regression interactions, and native build 1000012.');
