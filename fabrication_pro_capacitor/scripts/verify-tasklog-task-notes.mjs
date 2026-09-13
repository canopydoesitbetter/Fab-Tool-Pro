import { readAppSource } from './app-module-manifest.mjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const root=process.cwd();
const app=readAppSource(root);
const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));

function requireMatch(source,pattern,message) {
  if (!pattern.test(source)) throw new Error(message);
}

const start='// @tasklog-task-note-core-start';
const end='// @tasklog-task-note-core-end';
const startIndex=app.indexOf(start);
const endIndex=app.indexOf(end);
if (startIndex<0 || endIndex<=startIndex) throw new Error('Task Logging task-note core markers are missing.');
const core=app.slice(startIndex+start.length,endIndex);
const context={};
vm.createContext(context);
vm.runInContext(`${core}\nthis.__taskNote={normalizeTaskLogTaskNote,applyTaskLogTaskNote};`,context);
const {normalizeTaskLogTaskNote,applyTaskLogTaskNote}=context.__taskNote;

if (normalizeTaskLogTaskNote('  Needs left jamb shimmed.  ',4000)!=='Needs left jamb shimmed.') throw new Error('Task notes must trim outer whitespace.');
if (normalizeTaskLogTaskNote('   ',4000)!=='') throw new Error('Blank task notes must normalize to an empty string so Clear Note is stable.');
const multiline='Top line\n\nSecond line';
if (normalizeTaskLogTaskNote(multiline,4000)!==multiline) throw new Error('Task notes must preserve intentional line breaks.');
const tooLong='n'.repeat(4100);
if (normalizeTaskLogTaskNote(tooLong,4000)!==tooLong.slice(0,4000)) throw new Error('Task notes must enforce the 4000-character safety limit.');
const task={id:9,name:'Frame Fabrication',note:'Old note',updatedAt:'old-task'};
const job={id:3,title:'26-0814',updatedAt:'old-job'};
if (applyTaskLogTaskNote(job,task,'  New note  ','new-time',4000)!==true) throw new Error('Saving a task note must report success.');
if (task.note!=='New note' || task.updatedAt!=='new-time' || job.updatedAt!=='new-time') throw new Error('Saving a task note must update the task note and both timestamps.');
if (applyTaskLogTaskNote(job,task,'   ','clear-time',4000)!==true || task.note!=='' || task.updatedAt!=='clear-time' || job.updatedAt!=='clear-time') throw new Error('Clearing a task note must persist an empty note and update timestamps.');

requireMatch(app,/const\s+MAX_TASK_LOG_NOTE\s*=\s*4000\s*;/,'Task Logging must define a 4000-character task-note limit.');
requireMatch(app,/note:normalizeTaskLogTaskNote\(task\.note\s*\?\?\s*''\s*,MAX_TASK_LOG_NOTE\)/,'Task Logging job normalization must preserve notes while remaining compatible with older jobs that have no note field.');
requireMatch(app,/note:normalizeTaskLogTaskNote\(task\.note\s*\?\?\s*''\s*,MAX_TASK_LOG_NOTE\),/,'Task Logging serialization must include each task note in job exports and persistent storage.');
requireMatch(app,/data-tasklog-note="\$\{task\.id\}"/,'Each assigned task must render a task-note button.');
requireMatch(app,/tasklog-note-btn\$\{task\.note\?' has-note':''\}/,'Tasks with notes must render a distinct visual note state.');
requireMatch(app,/async\s+function\s+confirmTaskLogNoteClear\s*\(/,'Clear Note must use an asynchronous confirmation guard.');
requireMatch(app,/await\s+confirmAppAction\s*\(\s*\{/,'Clear Note must use the shared Fabri-Cadabra confirmation dialog.');
for (const required of [
  'taskLogNoteDialog',
  'taskLogNoteTextarea',
  'taskLogNoteCancelBtn',
  'taskLogNoteSaveBtn',
  'taskLogNoteClearBtn',
  'Save Note',
  'Clear Note',
  'maxlength="${MAX_TASK_LOG_NOTE}"',
  "const noteBtn=e.target.closest('[data-tasklog-note]')",
  'openTaskLogNoteDialog(Number(noteBtn.dataset.tasklogNote))',
  "taskLogNoteSaveBtn.addEventListener('click',saveTaskLogNoteFromDialog)",
  "taskLogNoteClearBtn.addEventListener('click',clearTaskLogNoteFromDialog)",
  "taskLogNoteCancelBtn.addEventListener('click',()=>setTaskLogNoteDialogOpen(false))",
  "title:'Clear Task Note?'",
  "confirmLabel:'Clear Note'",
  "cancelLabel:'Keep Note'",
  'danger:true',
  "event.stopPropagation()",
  "clearBtn.dataset.tasklogClearConfirmed='true'",
  "document.addEventListener('click',confirmTaskLogNoteClear,true)",
  "noteBackdrop.style.zIndex='320'",
  "noteDialog.style.zIndex='321'"
]) {
  if (!app.includes(required)) throw new Error(`Task-note interaction contract is missing: ${required}`);
}
for (const styleMarker of ['.tasklog-note-btn','.tasklog-note-btn.has-note','.tasklog-note-dialog','.tasklog-note-panel','.tasklog-note-textarea','.tasklog-note-actions']) {
  if (!app.includes(styleMarker)) throw new Error(`Task-note polished UI style is missing: ${styleMarker}`);
}
if (!String(pkg.scripts?.['verify:tasklog-task-notes'] || '').includes('verify-tasklog-task-notes.mjs')) throw new Error('package.json must expose verify:tasklog-task-notes.');
if (!String(pkg.scripts?.verify || '').includes('npm run verify:tasklog-task-notes')) throw new Error('Aggregate npm run verify must include the Task Logging task-note regression test.');

console.log('Task Logging per-task note persistence, dialog, and clear-confirmation contract: OK');
