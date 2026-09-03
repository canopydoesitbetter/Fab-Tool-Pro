import fs from 'node:fs';
import path from 'node:path';

process.env.TZ='America/New_York';

const root=path.resolve(import.meta.dirname,'..');
const app=fs.readFileSync(path.join(root,'www','app.js'),'utf8');

function expect(condition,message) {
  if (!condition) throw new Error(message);
}

function localMs(y,m,d,h=0,min=0) {
  return new Date(y,m-1,d,h,min,0,0).getTime();
}

const startMarker='// @shift-schedule-core-start';
const endMarker='\n  function showTaskLogStatus';
const start=app.indexOf(startMarker);
const end=app.indexOf(endMarker,start);
expect(start>=0 && end>start,'Shift Schedule engine block could not be isolated from app.js.');
const engineSource=app.slice(start,end);

function makeHarness(initialRecord=null) {
  const storage=new Map();
  if (initialRecord) storage.set('fabricationShiftScheduleV1',JSON.stringify(initialRecord));
  const jobs=[];
  const events=[];
  let taskPersistCount=0;

  const localStorage={
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key,value) { storage.set(key,String(value)); }
  };
  const storageGet=key=>localStorage.getItem(key);
  const window={FabriCadabraApp:{}};
  const document={dispatchEvent(event) { events.push(event); }};
  class CustomEvent {
    constructor(type,options={}) { this.type=type; this.detail=options.detail; }
  }
  function findRunningTaskLogTask() {
    for (const job of jobs) {
      const task=(job.tasks || []).find(item=>item.running===true);
      if (task) return {job,task};
    }
    return null;
  }
  function stopTaskLogTask(job,task,nowMs=Date.now()) {
    if (!job || !task || !task.running) return false;
    const started=Number(task.startedAt);
    const ended=Math.max(Number.isFinite(started)?started:Number(nowMs),Number(nowMs));
    const duration=Math.max(0,ended-(Number.isFinite(started)?started:ended));
    task.accumulatedMs=Math.max(0,Number(task.accumulatedMs || 0))+duration;
    task.sessions=Array.isArray(task.sessions)?task.sessions:[];
    task.sessions.push({startedAt:Number.isFinite(started)?started:ended,endedAt:ended,durationMs:duration});
    task.running=false;
    task.startedAt=null;
    task.updatedAt=new Date(ended).toISOString();
    job.updatedAt=task.updatedAt;
    return true;
  }
  function persistTaskLogJobs() { taskPersistCount++; return true; }
  function renderTaskLogging() {}

  const factory=new Function(
    'storageGet','localStorage','window','document','CustomEvent',
    'findRunningTaskLogTask','stopTaskLogTask','persistTaskLogJobs','renderTaskLogging',
    `${engineSource}\nreturn window.FabriCadabraApp.shiftSchedule;`
  );
  const api=factory(
    storageGet,localStorage,window,document,CustomEvent,
    findRunningTaskLogTask,stopTaskLogTask,persistTaskLogJobs,renderTaskLogging
  );
  expect(api && typeof api.getState==='function','Shift Schedule API failed to initialize in the behavior harness.');

  return {
    api,jobs,events,
    addRunningTask(startedAt,label='Task') {
      const task={id:1,name:label,running:true,startedAt:Number(startedAt),accumulatedMs:0,sessions:[]};
      const job={id:1,title:'Audit Job',tasks:[task]};
      jobs.push(job);
      return {job,task};
    },
    getTaskPersistCount:()=>taskPersistCount,
    getStoredState() {
      const raw=storage.get('fabricationShiftScheduleV1');
      return raw ? JSON.parse(raw) : null;
    }
  };
}

const standard={
  startDay:1,
  endDay:5,
  clockIn:'07:00',
  break:{enabled:true,time:'09:00',durationMinutes:15},
  lunch:{enabled:true,time:'12:00',durationMinutes:30},
  clockOut:'15:30'
};

const noBreak={
  ...standard,
  break:{enabled:false,time:'09:00',durationMinutes:15}
};

const overnight={
  startDay:1,
  endDay:5,
  clockIn:'22:00',
  break:{enabled:true,time:'23:30',durationMinutes:15},
  lunch:{enabled:true,time:'02:00',durationMinutes:30},
  clockOut:'06:00'
};

function configureAndEnable(h,config,atMs) {
  const saved=h.api.saveConfig(config,atMs);
  expect(saved.ok,`Schedule save failed in audit: ${(saved.errors || []).join(' ')}`);
  const enabled=h.api.setEnabled(true,atMs);
  expect(enabled.ok,`Schedule enable failed in audit: ${(enabled.errors || []).join(' ')}`);
}

// Disabled protection preserves legacy unrestricted Task Logging.
{
  const h=makeHarness();
  expect(h.api.getTaskPermission(localMs(2026,8,31,10)).allowed,'Disabled Shift Schedule must leave Task Logging unrestricted.');
}

// Enabling is prospective: stop an already-running timer exactly now and require a fresh Clock In.
{
  const h=makeHarness();
  expect(h.api.saveConfig(standard,localMs(2026,8,31,6)).ok,'Standard schedule must save before enable audit.');
  const {task}=h.addRunningTask(localMs(2026,8,31,6,10));
  expect(h.api.setEnabled(true,localMs(2026,8,31,6,45)).ok,'Enable must succeed.');
  expect(!task.running,'Enabling Shift Schedule must stop an existing running task.');
  expect(task.sessions.at(-1)?.endedAt===localMs(2026,8,31,6,45),'Enable must stop the running task at the enable-confirmation timestamp.');
  expect(!h.api.getState(localMs(2026,8,31,6,45)).clock.clockedIn,'Enabling Shift Schedule must begin Clocked Out.');
  expect(!h.api.getTaskPermission(localMs(2026,8,31,6,45)).allowed,'Task start must be blocked until manual Clock In.');
}

// Early scheduled Clock In takes effect immediately.
{
  const h=makeHarness();
  configureAndEnable(h,standard,localMs(2026,8,31,6));
  expect(h.api.getClockInIntent(localMs(2026,8,31,6,30)).mode==='scheduled','Early Clock In on a scheduled start day must attach to that scheduled shift.');
  expect(h.api.clockIn(localMs(2026,8,31,6,30)).mode==='scheduled','Early manual Clock In must enter scheduled mode.');
  expect(h.api.getTaskPermission(localMs(2026,8,31,6,31)).allowed,'Early Clock In must allow Task Logging immediately.');
}

// Clock In during Break succeeds, but task starts remain blocked until Break ends.
{
  const h=makeHarness();
  configureAndEnable(h,standard,localMs(2026,8,31,8));
  expect(h.api.clockIn(localMs(2026,8,31,9,5)).ok,'Clock In during Break must be allowed.');
  const during=h.api.getTaskPermission(localMs(2026,8,31,9,5));
  expect(!during.allowed && /Break/.test(during.reason),'Task Logging must remain blocked during an enabled Break after Clock In.');
  expect(h.api.getTaskPermission(localMs(2026,8,31,9,15)).allowed,'Task Logging must become available at Break end without auto-starting a task.');
}

// Sleeping through Break must close the task at Break start, not wake time.
{
  const h=makeHarness();
  configureAndEnable(h,standard,localMs(2026,8,31,7));
  h.api.clockIn(localMs(2026,8,31,8));
  const {task}=h.addRunningTask(localMs(2026,8,31,8,45));
  h.api.reconcile(localMs(2026,8,31,10,18));
  expect(!task.running,'A task left running through Break must be stopped on reconciliation.');
  expect(task.sessions.at(-1)?.endedAt===localMs(2026,8,31,9),'Break reconciliation must stop at the exact configured Break start.');
  expect(h.api.getState(localMs(2026,8,31,10,18)).clock.clockedIn,'Break must stop the task without clocking the user out.');
}

// Lunch uses the same exact-boundary behavior.
{
  const h=makeHarness();
  configureAndEnable(h,standard,localMs(2026,8,31,7));
  h.api.clockIn(localMs(2026,8,31,10));
  const {task}=h.addRunningTask(localMs(2026,8,31,11,20));
  h.api.reconcile(localMs(2026,8,31,12,20));
  expect(task.sessions.at(-1)?.endedAt===localMs(2026,8,31,12),'Lunch reconciliation must stop at the exact configured Lunch start.');
  expect(!task.running,'Lunch must never auto-restart a stopped task.');
}

// Scheduled Clock Out stops the task at the boundary and forces Clocked Out.
{
  const h=makeHarness();
  configureAndEnable(h,standard,localMs(2026,8,31,7));
  h.api.clockIn(localMs(2026,8,31,14));
  const {task}=h.addRunningTask(localMs(2026,8,31,15));
  h.api.reconcile(localMs(2026,8,31,16));
  expect(task.sessions.at(-1)?.endedAt===localMs(2026,8,31,15,30),'Scheduled Clock Out must stop a task at the exact Clock Out boundary.');
  expect(!h.api.getState(localMs(2026,8,31,16)).clock.clockedIn,'Scheduled Clock Out must force Clocked Out state.');
}

// Overtime is a fresh manual clock-in and does not auto-end at midnight or the next scheduled day.
{
  const h=makeHarness();
  configureAndEnable(h,standard,localMs(2026,8,31,7));
  h.api.clockIn(localMs(2026,8,31,14));
  h.api.reconcile(localMs(2026,8,31,16));
  expect(h.api.getClockInIntent(localMs(2026,8,31,16,5)).mode==='overtime','Clock In after scheduled Clock Out must be classified as overtime.');
  expect(h.api.clockIn(localMs(2026,8,31,16,5)).mode==='overtime','Overtime Clock In must enter overtime mode.');
  const {task}=h.addRunningTask(localMs(2026,8,31,16,10));
  h.api.reconcile(localMs(2026,9,1,8));
  expect(task.running,'Overtime must continue through midnight and into the next scheduled day until manual Clock Out.');
  expect(h.api.getState(localMs(2026,9,1,8)).clock.mode==='overtime','Overtime mode must persist until manual Clock Out.');
  h.api.clockOut(localMs(2026,9,1,8,30));
  expect(task.sessions.at(-1)?.endedAt===localMs(2026,9,1,8,30),'Manual overtime Clock Out must stop at the actual device time.');
  expect(!h.api.getState(localMs(2026,9,1,8,30)).clock.clockedIn,'Manual overtime Clock Out must end attendance state.');
}

// Unscheduled work must not borrow Monday's Break/Lunch/Clock-Out rules.
{
  const h=makeHarness();
  configureAndEnable(h,standard,localMs(2026,9,6,9)); // Sunday
  expect(h.api.getClockInIntent(localMs(2026,9,6,10)).mode==='unscheduled','Sunday must be classified as unscheduled work for a Monday-through-Friday schedule.');
  expect(h.api.clockIn(localMs(2026,9,6,10)).mode==='unscheduled','Unscheduled Clock In must enter unscheduled mode.');
  const {task}=h.addRunningTask(localMs(2026,9,6,10,5));
  h.api.reconcile(localMs(2026,9,7,16)); // Monday after normal scheduled out
  expect(task.running,'Unscheduled work must continue until manual Clock Out and ignore unrelated scheduled-day boundaries.');
  h.api.clockOut(localMs(2026,9,7,16,30));
  expect(task.sessions.at(-1)?.endedAt===localMs(2026,9,7,16,30),'Unscheduled manual Clock Out must stop at actual device time.');
}

// Friday overnight work belongs to Friday and reconciles Saturday using Friday's boundaries.
{
  const h=makeHarness();
  configureAndEnable(h,overnight,localMs(2026,9,4,20)); // Friday
  expect(h.api.getClockInIntent(localMs(2026,9,4,21,30)).mode==='scheduled','Early Friday overnight Clock In must be scheduled.');
  h.api.clockIn(localMs(2026,9,4,21,30));
  const {task}=h.addRunningTask(localMs(2026,9,4,23));
  h.api.reconcile(localMs(2026,9,5,3)); // Saturday
  expect(task.sessions.at(-1)?.endedAt===localMs(2026,9,4,23,30),'Friday overnight Break must stop at Friday 11:30 PM even when reconciliation happens Saturday.');
  expect(h.api.getState(localMs(2026,9,5,3)).clock.clockedIn,'Saturday pre-Clock-Out portion must remain part of Friday scheduled attendance.');
}

// A current-shift Break override OFF survives reload and manual Clock Out/In inside the same shift, then expires at shift end.
{
  const h=makeHarness();
  configureAndEnable(h,standard,localMs(2026,8,31,7));
  h.api.clockIn(localMs(2026,8,31,8));
  expect(h.api.setPauseOverride('break',false,localMs(2026,8,31,8,30)).ok,'Current-shift Break override OFF must save.');
  const stored=h.getStoredState();
  const reloaded=makeHarness(stored);
  expect(reloaded.api.getState(localMs(2026,8,31,8,31)).runtime.effectiveBreakEnabled===false,'Current-shift Break override must survive app reload.');
  const {task}=reloaded.addRunningTask(localMs(2026,8,31,8,45));
  reloaded.api.reconcile(localMs(2026,8,31,9,10));
  expect(task.running,'Break override OFF must prevent the normal Break boundary from stopping the task.');
  reloaded.api.clockOut(localMs(2026,8,31,9,11));
  reloaded.api.clockIn(localMs(2026,8,31,9,12));
  expect(reloaded.api.getTaskPermission(localMs(2026,8,31,9,12)).allowed,'Manual Clock Out/In inside the same shift must preserve the Break override.');
  reloaded.api.reconcile(localMs(2026,8,31,16));
  const after=reloaded.api.getState(localMs(2026,9,1,7));
  expect(after.pauseOverrides.shiftId===null,'Current-shift overrides must expire when the scheduled shift ends.');
  expect(after.runtime.effectiveBreakEnabled===true,'The next shift must return to the saved Break default.');
}

// A saved-disabled pause with retained valid time can be turned ON for only the current shift.
{
  const h=makeHarness();
  configureAndEnable(h,noBreak,localMs(2026,8,31,7));
  h.api.clockIn(localMs(2026,8,31,8));
  expect(h.api.setPauseOverride('break',true,localMs(2026,8,31,8,30)).ok,'Current-shift Break override ON must be accepted when a retained valid Break time exists.');
  const during=h.api.getTaskPermission(localMs(2026,8,31,9,5));
  expect(!during.allowed && /Break/.test(during.reason),'Current-shift Break override ON must activate the retained Break window even when the saved default is OFF.');
}

// Turning a pause ON during its active window is prospective: stop now, never retroactively.
{
  const h=makeHarness();
  configureAndEnable(h,noBreak,localMs(2026,8,31,7));
  h.api.clockIn(localMs(2026,8,31,8));
  const {task}=h.addRunningTask(localMs(2026,8,31,8,50));
  h.api.setPauseOverride('break',true,localMs(2026,8,31,9,5));
  expect(!task.running,'Enabling a current active Break must stop a running task immediately.');
  expect(task.sessions.at(-1)?.endedAt===localMs(2026,8,31,9,5),'A newly enabled current-shift Break must stop at override time, not retroactively at Break start.');
}

// Schedule edits are prospective: a newly introduced active Break stops at save time, not at its past start.
{
  const h=makeHarness();
  configureAndEnable(h,noBreak,localMs(2026,8,31,7));
  h.api.clockIn(localMs(2026,8,31,8));
  const {task}=h.addRunningTask(localMs(2026,8,31,9,30));
  const changed={...standard,break:{enabled:true,time:'10:00',durationMinutes:15}};
  expect(h.api.saveConfig(changed,localMs(2026,8,31,10,10)).ok,'Prospective schedule edit must save.');
  expect(!task.running,'A newly saved policy that blocks the current instant must stop the running task.');
  expect(task.sessions.at(-1)?.endedAt===localMs(2026,8,31,10,10),'Schedule edit must stop at save time rather than retroactively at the new 10:00 AM Break start.');
}

// Disabling protection restores legacy behavior and does not stop a currently running task merely because protection is removed.
{
  const h=makeHarness();
  configureAndEnable(h,standard,localMs(2026,8,31,7));
  h.api.clockIn(localMs(2026,8,31,8));
  const {task}=h.addRunningTask(localMs(2026,8,31,8,20));
  expect(h.api.setEnabled(false,localMs(2026,8,31,8,30)).ok,'Shift Schedule disable must succeed.');
  expect(task.running,'Disabling Shift Schedule must not stop an otherwise-running task.');
  expect(h.api.getTaskPermission(localMs(2026,8,31,9,5)).allowed,'Disabling Shift Schedule must restore unrestricted Task Logging even during the old Break window.');
}

console.log('Shift Schedule live state-engine behavioral audit: OK');
