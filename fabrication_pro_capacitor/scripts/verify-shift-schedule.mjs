import fs from 'node:fs';
import path from 'node:path';

process.env.TZ='America/New_York';
const root=path.resolve(import.meta.dirname,'..');
const app=fs.readFileSync(path.join(root,'www','app.js'),'utf8');
const ux=fs.readFileSync(path.join(root,'www','ux.js'),'utf8');
const html=fs.readFileSync(path.join(root,'www','index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'www','ux.css'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));

function expect(condition,message) {
  if (!condition) throw new Error(message);
}
function localMs(y,m,d,h=0,min=0) {
  return new Date(y,m-1,d,h,min,0,0).getTime();
}
function loadCore() {
  const start='// @shift-schedule-core-start';
  const end='// @shift-schedule-core-end';
  const from=app.indexOf(start);
  const to=app.indexOf(end);
  expect(from>=0 && to>from,'Shift Schedule pure-core markers are missing from app.js.');
  const block=app.slice(from+start.length,to);
  return new Function(`${block}\nreturn {parseShiftWallTime,shiftDayRangeIncludes,buildShiftInstance,findApplicableScheduledShift,classifyShiftClockIn,validateShiftScheduleConfig,shiftPauseWindow,firstShiftProhibitedBoundary};`)();
}

const core=loadCore();
const base={
  startDay:1,endDay:5,clockIn:'07:00',
  break:{enabled:true,time:'09:00',durationMinutes:15},
  lunch:{enabled:true,time:'12:00',durationMinutes:30},
  clockOut:'15:30'
};

expect(core.parseShiftWallTime('07:05')===425,'07:05 must parse to 425 minutes.');
expect(core.parseShiftWallTime('7:05')===null,'24-hour core times must use HH:MM.');
expect(core.parseShiftWallTime('24:00')===null,'24:00 must be rejected.');
expect(core.shiftDayRangeIncludes(3,1,5),'Wednesday must be inside Monday-through-Friday.');
expect(!core.shiftDayRangeIncludes(0,1,5),'Sunday must be outside Monday-through-Friday.');
expect(core.shiftDayRangeIncludes(0,5,2),'Sunday must be inside Friday-through-Tuesday.');
expect(core.shiftDayRangeIncludes(1,1,1) && !core.shiftDayRangeIncludes(2,1,1),'Monday-through-Monday must mean Monday only.');
expect(core.validateShiftScheduleConfig(base).ok,'Standard schedule must validate.');
expect(!core.validateShiftScheduleConfig({...base,clockOut:'07:00'}).ok,'Equal Clock In/Out must fail.');
expect(!core.validateShiftScheduleConfig({...base,break:{enabled:true,time:'11:50',durationMinutes:30}}).ok,'Overlapping Break/Lunch must fail.');
expect(!core.validateShiftScheduleConfig({...base,break:{enabled:true,time:'09:00',durationMinutes:0}}).ok,'Zero-minute Break must fail.');
expect(core.validateShiftScheduleConfig({...base,break:{enabled:false,time:'',durationMinutes:15},lunch:{enabled:false,time:'',durationMinutes:30}}).ok,'Disabled pauses may keep blank times.');
const retainedPauseShift=core.buildShiftInstance(localMs(2026,8,31),{...base,break:{enabled:false,time:'09:00',durationMinutes:15}});
expect(retainedPauseShift?.breakWindow?.startMs===localMs(2026,8,31,9),'A saved-disabled Break with retained valid time must still construct a window for current-shift override ON.');

const overnight={...base,clockIn:'22:00',break:{enabled:true,time:'23:30',durationMinutes:15},lunch:{enabled:true,time:'02:00',durationMinutes:30},clockOut:'06:00'};
expect(core.validateShiftScheduleConfig(overnight).ok,'Overnight schedule must validate.');
const friday=core.buildShiftInstance(localMs(2026,9,4),overnight);
expect(new Date(friday.endMs).getDay()===6 && new Date(friday.endMs).getHours()===6,'Friday overnight shift must end Saturday at 6 AM.');
expect(core.findApplicableScheduledShift(localMs(2026,9,5,5),overnight)?.id===friday.id,'Saturday 5 AM must resolve to Friday overnight shift.');
expect(core.classifyShiftClockIn(localMs(2026,9,2,6,30),base).mode==='scheduled','Early scheduled-day Clock In must be scheduled.');
expect(core.classifyShiftClockIn(localMs(2026,9,2,8,30),base).mode==='scheduled','Late Clock In during the shift must be scheduled.');
expect(core.classifyShiftClockIn(localMs(2026,9,2,16),base).mode==='overtime','After-hours Clock In must be overtime.');
expect(core.classifyShiftClockIn(localMs(2026,9,6,10),base).mode==='unscheduled','Unscheduled Sunday must be unscheduled work.');

const monday=core.buildShiftInstance(localMs(2026,8,31),base);
const policy={breakEnabled:true,lunchEnabled:true,policyEffectiveAt:0};
expect(core.firstShiftProhibitedBoundary(localMs(2026,8,31,8,45),localMs(2026,8,31,10,18),monday,policy)===localMs(2026,8,31,9),'Break must be the first stop boundary.');
expect(core.firstShiftProhibitedBoundary(localMs(2026,8,31,8,45),localMs(2026,8,31,12,10),monday,{...policy,breakEnabled:false})===localMs(2026,8,31,12),'Disabled Break must be skipped.');
expect(core.firstShiftProhibitedBoundary(localMs(2026,8,31,15),localMs(2026,8,31,16),monday,policy)===localMs(2026,8,31,15,30),'Clock Out must stop at the exact boundary.');
expect(core.firstShiftProhibitedBoundary(localMs(2026,8,31,9,30),localMs(2026,8,31,10,10),monday,{...policy,policyEffectiveAt:localMs(2026,8,31,10,10)})===null,'A schedule edit at 10:10 must not retroactively create a 9:00 stop.');

expect(app.includes("const SHIFT_SCHEDULE_KEY = 'fabricationShiftScheduleV1'"),'Shift Schedule storage key is missing.');
expect(app.includes("const SHIFT_SCHEDULE_FORMAT = 'FabricationShiftSchedule'"),'Shift Schedule format is missing.');
expect(app.includes('const SHIFT_SCHEDULE_VERSION = 1'),'Shift Schedule storage version is missing.');
expect(app.includes('window.FabriCadabraApp.shiftSchedule'),'Shift Schedule API is missing.');
for (const name of ['getState','getStatus','getClockInIntent','saveConfig','setEnabled','clockIn','clockOut','setPauseOverride','getTaskPermission','reconcile']) {
  expect(app.includes(name),`Shift Schedule API is missing ${name}.`);
}
expect(app.includes('policyEffectiveAt'),'Prospective policy timestamp is missing.');
expect(app.includes('pauseOverrides'),'Current-shift overrides are missing.');
expect(/function\s+startTaskLogTask\s*\([^)]*\)[\s\S]*reconcileShiftSchedule\(now\)[\s\S]*getShiftTaskPermission\(now\)/.test(app),'startTaskLogTask must reconcile and consult the Shift Schedule guard before starting.');
expect(app.includes('firstShiftProhibitedBoundary('),'Exact prohibited-boundary recovery is missing.');
expect(app.includes("document.addEventListener('visibilitychange'"),'visibilitychange recovery must remain.');
expect(app.includes("window.addEventListener('pageshow'"),'pageshow recovery must remain.');
expect(app.includes("window.addEventListener('focus'"),'focus recovery is required.');
expect(app.includes('setInterval(updateTaskLogTimerDisplays,1000)'),'Existing 1-second timer refresh must remain.');
expect(/function\s+updateTaskLogTimerDisplays\s*\(\)\s*\{\s*const now=Date\.now\(\);\s*reconcileShiftSchedule\(now\);/.test(app),'Foreground timer refresh must reconcile the schedule first.');
expect(app.includes('stopTaskLogTask(running.job,running.task,boundary)'),'Automatic schedule stops must reuse the existing explicit-timestamp stop path.');

for (const id of ['shiftClockControl','shiftClockStatus','shiftClockBtn','taskLogShiftStatus']) {
  expect(html.includes(`id="${id}"`),`Missing ${id}.`);
}
for (const id of ['shiftScheduleDetails','shiftScheduleMasterToggle','shiftScheduleMasterState','shiftStartDay','shiftEndDay','shiftClockInTime','shiftClockInPeriod','shiftBreakToggle','shiftBreakTime','shiftBreakPeriod','shiftBreakMinutes','shiftLunchToggle','shiftLunchTime','shiftLunchPeriod','shiftLunchMinutes','shiftClockOutTime','shiftClockOutPeriod','shiftScheduleSaveBtn','shiftScheduleStatus']) {
  expect(ux.includes(`id='${id}'`) || ux.includes(`id="${id}"`),`Settings is missing ${id}.`);
}
expect(css.includes('.shift-clock-btn.clock-in'),'Green Clock In style is missing.');
expect(css.includes('.shift-clock-btn.clock-out'),'Red Clock Out style is missing.');
expect(ux.includes('fabrication:shift-schedule-change'),'UX must listen for Shift Schedule changes.');
expect(ux.includes('getClockInIntent'),'Clock In UX must distinguish scheduled/overtime/unscheduled intent.');
expect(ux.includes('Current shift override'),'Current-shift pause helper copy is missing.');
expect(ux.includes('Length in minutes'),'Break/Lunch duration labels are missing.');
expect(ux.includes('Any running Task Logging timer will stop immediately.'),'Clock Out warning must disclose timer stop behavior.');
expect(ux.includes('Overtime will continue until you manually clock out.'),'Overtime confirmation must disclose manual end behavior.');
expect(ux.includes('Today is not one of your scheduled workdays.'),'Unscheduled-work confirmation is missing.');
expect(pkg.scripts?.['verify:shift-schedule']==='node scripts/verify-shift-schedule.mjs','package.json must expose the Shift Schedule verifier.');
expect(String(pkg.scripts?.verify || '').includes('npm run verify:shift-schedule'),'Aggregate verification must include the Shift Schedule verifier.');
expect(pkg.version==='1.0.3',`Canonical package version must be 1.0.3; got ${pkg.version}.`);

console.log('Shift Schedule engine, persistence, UI, exact-boundary integration, and release contract: OK');
