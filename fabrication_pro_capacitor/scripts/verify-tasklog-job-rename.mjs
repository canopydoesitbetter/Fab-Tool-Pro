import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const root=process.cwd();
const index=readFileSync(join(root,'www','index.html'),'utf8');
const app=readFileSync(join(root,'www','app.js'),'utf8');
const ux=readFileSync(join(root,'www','ux.js'),'utf8');
const uxStyles=readFileSync(join(root,'www','ux.css'),'utf8');
const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));

function requireMatch(source,pattern,message) {
  if (!pattern.test(source)) throw new Error(message);
}

requireMatch(index,/<button[^>]*id="taskLogJobTitle"[^>]*type="button"[^>]*aria-haspopup="dialog"[^>]*aria-controls="taskLogRenameDialog"/s,'Active Job # / Name must be a button that opens the rename dialog.');
for (const id of ['taskLogRenameBackdrop','taskLogRenameDialog','taskLogRenameInput','taskLogRenameCancelBtn','taskLogRenameApplyBtn','taskLogRenameStatus']) {
  if (!index.includes(`id="${id}"`)) throw new Error(`Task Logging rename UI is missing #${id}.`);
}
requireMatch(index,/id="taskLogRenameDialog"[^>]*role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="taskLogRenameTitle"/s,'Rename overlay must be an accessible modal dialog.');
requireMatch(index,/id="taskLogRenameApplyBtn"[^>]*>\s*Apply Name Change\s*<\/button>/s,'Rename dialog needs an explicit Apply Name Change confirmation.');

const start='// @tasklog-job-rename-core-start';
const end='// @tasklog-job-rename-core-end';
const startIndex=app.indexOf(start);
const endIndex=app.indexOf(end);
if (startIndex<0 || endIndex<=startIndex) throw new Error('Task Logging rename core markers are missing.');
const core=app.slice(startIndex+start.length,endIndex);
const context={};
vm.createContext(context);
vm.runInContext(`${core}\nthis.__rename={normalizeTaskLogJobName,applyTaskLogJobRename};`,context);
const {normalizeTaskLogJobName,applyTaskLogJobRename}=context.__rename;

if (normalizeTaskLogJobName('  26-0814   South Wall  ',120)!=='26-0814 South Wall') throw new Error('Rename normalization must trim and collapse whitespace.');
if (normalizeTaskLogJobName('   ',120)!==null) throw new Error('Blank job names must be rejected.');
const tooLong='x'.repeat(140);
if (normalizeTaskLogJobName(tooLong,120)!==tooLong.slice(0,120)) throw new Error('Rename normalization must preserve the existing 120-character maximum.');
const job={id:7,title:'Original Name',updatedAt:'old'};
if (applyTaskLogJobRename(job,'   ','new',120)!==false || job.title!=='Original Name' || job.updatedAt!=='old') throw new Error('Rejected rename attempts must not mutate the job.');
if (applyTaskLogJobRename(job,'  Final   Name  ','new',120)!==true || job.title!=='Final Name' || job.updatedAt!=='new') throw new Error('Confirmed rename must update title and timestamp exactly once.');

if (/taskLogJobTitle\.addEventListener\(['"]input['"]/.test(app) || /taskLogJobTitle\.addEventListener\(['"]blur['"]/.test(app)) throw new Error('Job name button must not retain the old live-edit input/blur mutation handlers.');
for (const required of [
  "taskLogJobTitle.addEventListener('click'",
  "taskLogRenameCancelBtn.addEventListener('click'",
  "taskLogRenameApplyBtn.addEventListener('click'",
  'applyTaskLogJobRename(job,taskLogRenameInput.value',
  "taskLogRenameStatus.textContent='Enter a job name before applying the change.'"
]) {
  if (!app.includes(required)) throw new Error(`Rename interaction contract is missing: ${required}`);
}
for (const marker of ['.tasklog-job-title-button','.tasklog-rename-backdrop','.tasklog-rename-dialog','.tasklog-rename-actions']) {
  if (!uxStyles.includes(marker)) throw new Error(`Missing Task Logging rename style: ${marker}`);
}
if (!ux.includes('Job # / Name now opens a dedicated rename overlay')) throw new Error('v1.0.3 changelog must disclose the confirmed job-name rename flow.');
if (!String(pkg.scripts?.['verify:tasklog-job-rename'] || '').includes('verify-tasklog-job-rename.mjs')) throw new Error('package.json must expose verify:tasklog-job-rename.');
if (!String(pkg.scripts?.verify || '').includes('npm run verify:tasklog-job-rename')) throw new Error('Aggregate npm run verify must include the Task Logging rename regression test.');

console.log('Task Logging confirmed job-name rename overlay contract: OK');
