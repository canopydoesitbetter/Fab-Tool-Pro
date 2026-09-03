# Fabri-Cadabra v1.0.2 Shift Schedule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the optional v1.0.2 Shift Schedule safety system with manual Clock In/Out, Break/Lunch enforcement, scheduled Clock Out, overtime/unscheduled work, overnight support, and exact timer-boundary recovery without changing existing Task Logging data formats.

**Architecture:** Keep schedule policy and Task Logging enforcement in `fabrication_pro_capacitor/www/app.js`. Keep Settings/header presentation in the existing `ux.js`/`ux.css` layer, add only small static UI anchors in `index.html`, and expose a narrow `window.FabriCadabraApp.shiftSchedule` API. Keep the schedule math in a pure marked block inside `app.js` so a Node verifier can execute it deterministically without adding another runtime asset.

**Tech Stack:** Vanilla HTML/CSS/JavaScript, browser/WebView `localStorage`, Node.js 22 verification scripts, Capacitor 8.5.0, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-02-shift-schedule-design.md`

## Global Constraints

- Product name remains **Fabri-Cadabra**.
- Capacitor application ID remains exactly `com.fabricationpro.app`.
- Package name remains `fabri-cadabra-capacitor`.
- `fabrication_pro_capacitor/package.json` remains the single canonical application-version source; v1.0.2 sets it to exactly `1.0.2`.
- The repository currently has no committed `package-lock.json`; do not introduce one as part of this feature. Existing installer workflows use `npm install --ignore-scripts`.
- Preserve `fabricationTaskLogJobsV1`, `fabricationTaskLogPresetsV1`, `FabricationTaskLogJobs`, and `FabricationTaskLogPresets` unchanged.
- Preserve Task Logging timer fields `running`, `startedAt`, `accumulatedMs` and session fields `startedAt`, `endedAt`, `durationMs` unchanged.
- Add only the new schedule key `fabricationShiftScheduleV1`, format `FabricationShiftSchedule`, version `1`.
- Preserve all fabrication formulas, optimizer/saw logic, existing import/export formats, native export compatibility, and Task Logging as startup page.
- Settings remains a utility page outside the nine fabrication-tool links.
- Preserve the v1.0.1 Pages-drawer regression fix: `.fab-page-list` must keep `align-content:start` and `grid-auto-rows:max-content` so the nine original buttons do not stretch.
- Shift Schedule disabled must reproduce pre-v1.0.2 Task Logging behavior.
- Device local wall-clock time/timezone is authoritative. Do not add network time, anti-tamper logic, or native background services.
- This feature is a labor-timer guardrail, not a payroll/timecard history subsystem.

## File Structure

**Create**
- `fabrication_pro_capacitor/scripts/verify-shift-schedule.mjs` — deterministic schedule-engine and UI-contract verifier.

**Modify**
- `fabrication_pro_capacitor/www/app.js` — pure schedule math, persistence/state API, Task Logging guard, exact reconciliation, lifecycle hooks.
- `fabrication_pro_capacitor/www/index.html` — header Clock In/Out anchor and compact Task Logging shift-status anchor.
- `fabrication_pro_capacitor/www/ux.js` — Settings Shift Schedule UI, header/status presentation, confirmation flows, v1.0.2 changelog.
- `fabrication_pro_capacitor/www/ux.css` — schedule/settings/header/status styling and responsive behavior.
- `fabrication_pro_capacitor/scripts/verify-settings-changelog.mjs` — v1.0.2 version/changelog assertions while retaining the Pages sizing regression test.
- `fabrication_pro_capacitor/package.json` — add `verify:shift-schedule`, add it to aggregate `verify`, and bump version to `1.0.2` in the release task.
- `fabrication_pro_capacitor/README.md` — update the canonical responsibility/persistence description only where the new Shift Schedule ownership needs to be documented.

---

### Task 1: Add a failing Shift Schedule verifier and pure time engine

**Files:**
- Create: `fabrication_pro_capacitor/scripts/verify-shift-schedule.mjs`
- Modify: `fabrication_pro_capacitor/package.json`
- Modify: `fabrication_pro_capacitor/www/app.js` in the Task Logging area before schedule persistence/integration code.

**Interfaces:**
- Produces a self-contained block bounded by `// @shift-schedule-core-start` and `// @shift-schedule-core-end`.
- Produces pure functions `parseShiftWallTime`, `shiftDayRangeIncludes`, `buildShiftInstance`, `findApplicableScheduledShift`, `classifyShiftClockIn`, `validateShiftScheduleConfig`, `shiftPauseWindow`, and `firstShiftProhibitedBoundary`.

- [ ] **Step 1: Write the failing verifier**

Create `scripts/verify-shift-schedule.mjs` with Node-only source loading and a pure-core extraction harness:

```js
import fs from 'node:fs';
import path from 'node:path';

process.env.TZ='America/New_York';
const root=path.resolve(import.meta.dirname,'..');
const app=fs.readFileSync(path.join(root,'www','app.js'),'utf8');
const ux=fs.readFileSync(path.join(root,'www','ux.js'),'utf8');
const html=fs.readFileSync(path.join(root,'www','index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'www','ux.css'),'utf8');

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
expect(core.parseShiftWallTime('24:00')===null,'24:00 must be rejected.');
expect(core.shiftDayRangeIncludes(3,1,5),'Wednesday must be inside Monday-through-Friday.');
expect(!core.shiftDayRangeIncludes(0,1,5),'Sunday must be outside Monday-through-Friday.');
expect(core.shiftDayRangeIncludes(0,5,2),'Sunday must be inside Friday-through-Tuesday.');
expect(core.shiftDayRangeIncludes(1,1,1) && !core.shiftDayRangeIncludes(2,1,1),'Monday-through-Monday must mean Monday only.');
expect(core.validateShiftScheduleConfig(base).ok,'Standard schedule must validate.');
expect(!core.validateShiftScheduleConfig({...base,clockOut:'07:00'}).ok,'Equal Clock In/Out must fail.');
expect(!core.validateShiftScheduleConfig({...base,break:{enabled:true,time:'11:50',durationMinutes:30}}).ok,'Overlapping Break/Lunch must fail.');
expect(!core.validateShiftScheduleConfig({...base,break:{enabled:true,time:'09:00',durationMinutes:0}}).ok,'Zero-minute Break must fail.');

const overnight={...base,clockIn:'22:00',break:{enabled:true,time:'23:30',durationMinutes:15},lunch:{enabled:true,time:'02:00',durationMinutes:30},clockOut:'06:00'};
expect(core.validateShiftScheduleConfig(overnight).ok,'Overnight schedule must validate.');
const friday=core.buildShiftInstance(localMs(2026,9,4),overnight);
expect(new Date(friday.endMs).getDay()===6 && new Date(friday.endMs).getHours()===6,'Friday overnight shift must end Saturday at 6 AM.');
expect(core.findApplicableScheduledShift(localMs(2026,9,5,5),overnight)?.id===friday.id,'Saturday 5 AM must resolve to Friday overnight shift.');
expect(core.classifyShiftClockIn(localMs(2026,9,2,6,30),base).mode==='scheduled','Early scheduled-day Clock In must be scheduled.');
expect(core.classifyShiftClockIn(localMs(2026,9,2,16),base).mode==='overtime','After-hours Clock In must be overtime.');
expect(core.classifyShiftClockIn(localMs(2026,9,6,10),base).mode==='unscheduled','Unscheduled Sunday must be unscheduled work.');

const monday=core.buildShiftInstance(localMs(2026,8,31),base);
const policy={breakEnabled:true,lunchEnabled:true,policyEffectiveAt:0};
expect(core.firstShiftProhibitedBoundary(localMs(2026,8,31,8,45),localMs(2026,8,31,10,18),monday,policy)===localMs(2026,8,31,9),'Break must be the first stop boundary.');
expect(core.firstShiftProhibitedBoundary(localMs(2026,8,31,8,45),localMs(2026,8,31,12,10),monday,{...policy,breakEnabled:false})===localMs(2026,8,31,12),'Disabled Break must be skipped.');
expect(core.firstShiftProhibitedBoundary(localMs(2026,8,31,15),localMs(2026,8,31,16),monday,policy)===localMs(2026,8,31,15,30),'Clock Out must stop at the exact boundary.');

console.log('Shift Schedule verifier passed.');
```

Add only the standalone script to `package.json` for the red stage:

```json
"verify:shift-schedule": "node scripts/verify-shift-schedule.mjs"
```

- [ ] **Step 2: Run the verifier and confirm RED**

```bash
cd fabrication_pro_capacitor
npm install --ignore-scripts
npm run verify:shift-schedule
```

Expected: FAIL with `Shift Schedule pure-core markers are missing from app.js.`

- [ ] **Step 3: Implement the pure schedule math in `app.js`**

Use local `Date(year,month,day,hour,minute)` construction. Represent a shift instance as:

```js
{
  id:'2026-09-04',
  anchorDateMs,
  startMs,
  endMs,
  breakWindow:{startMs,endMs} || null,
  lunchWindow:{startMs,endMs} || null
}
```

Implement cyclic day ranges exactly:

```js
function shiftDayRangeIncludes(day,startDay,endDay) {
  if (![day,startDay,endDay].every(Number.isInteger)) return false;
  if (startDay===endDay) return day===startDay;
  return startDay<endDay
    ? day>=startDay && day<=endDay
    : day>=startDay || day<=endDay;
}
```

`firstShiftProhibitedBoundary()` must search only after `max(startedAt, policyEffectiveAt)`, include enabled Break/Lunch starts plus Clock Out, and return the earliest crossed prohibited boundary. This is the mechanism that prevents wake-up time from being counted as labor.

- [ ] **Step 4: Run the verifier and confirm GREEN**

```bash
npm run verify:shift-schedule
```

Expected: `Shift Schedule verifier passed.`

- [ ] **Step 5: Commit**

```bash
git add fabrication_pro_capacitor/www/app.js fabrication_pro_capacitor/scripts/verify-shift-schedule.mjs fabrication_pro_capacitor/package.json
git commit -m "feat: add shift schedule time engine"
```

---

### Task 2: Add versioned schedule persistence and the core clock-state API

**Files:**
- Modify: `fabrication_pro_capacitor/www/app.js`
- Modify: `fabrication_pro_capacitor/scripts/verify-shift-schedule.mjs`

**Interfaces:**
- Consumes existing `storageGet`, `storageSet`, `findRunningTaskLogTask`, `stopTaskLogTask`, and Task Logging persistence.
- Produces `window.FabriCadabraApp.shiftSchedule` methods `getState`, `getStatus`, `getClockInIntent`, `saveConfig`, `setEnabled`, `clockIn`, `clockOut`, `setPauseOverride`, `getTaskPermission`, and `reconcile`.
- Internal integration functions are `getShiftTaskPermission(nowMs)` and `reconcileShiftSchedule(nowMs)`.

Persist exactly one new envelope:

```js
{
  format:'FabricationShiftSchedule',
  version:1,
  enabled:false,
  config:{
    startDay:1,endDay:5,clockIn:'',
    break:{enabled:false,time:'',durationMinutes:15},
    lunch:{enabled:false,time:'',durationMinutes:30},
    clockOut:''
  },
  clock:{clockedIn:false,clockedInAt:null,mode:null,shiftId:null},
  pauseOverrides:{shiftId:null,breakEnabled:null,lunchEnabled:null},
  policyEffectiveAt:0
}
```

- [ ] **Step 1: Extend the verifier and confirm RED**

Add assertions for:

```js
expect(app.includes("const SHIFT_SCHEDULE_KEY = 'fabricationShiftScheduleV1'"),'Shift Schedule storage key is missing.');
expect(app.includes("const SHIFT_SCHEDULE_FORMAT = 'FabricationShiftSchedule'"),'Shift Schedule format is missing.');
expect(app.includes('window.FabriCadabraApp.shiftSchedule'),'Shift Schedule API is missing.');
for (const name of ['getState','getStatus','getClockInIntent','saveConfig','setEnabled','clockIn','clockOut','setPauseOverride','getTaskPermission','reconcile']) {
  expect(app.includes(name),`Shift Schedule API is missing ${name}.`);
}
expect(app.includes('policyEffectiveAt'),'Prospective policy timestamp is missing.');
expect(app.includes('pauseOverrides'),'Current-shift overrides are missing.');
```

Run `npm run verify:shift-schedule`; expect failure on the missing storage/API contract.

- [ ] **Step 2: Implement normalization and persistence**

Add constants:

```js
const SHIFT_SCHEDULE_KEY='fabricationShiftScheduleV1';
const SHIFT_SCHEDULE_FORMAT='FabricationShiftSchedule';
const SHIFT_SCHEDULE_VERSION=1;
```

Normalization must treat missing/corrupt storage as a disabled default record, preserve saved times when protection is disabled, reject/neutralize future record versions instead of interpreting them as v1, and clear expired current-shift overrides only after their anchored shift ends.

- [ ] **Step 3: Implement prospective save/enable/disable rules**

`saveConfig(config,nowMs)` sequence is fixed:

```text
reconcile old policy to now
validate new config
persist new config
set policyEffectiveAt = now
apply new policy from now forward
if newly blocked, stop running task at now (never a newly-created past boundary)
```

`setEnabled(true,nowMs)` validates the current schedule, stops any running task at `nowMs`, sets Clocked Out, clears temporary mode/overrides, and sets `policyEffectiveAt=nowMs`.

`setEnabled(false,nowMs)` reconciles the old policy first, then disables protection, clears live clock/work-mode/overrides, preserves saved schedule fields, and restores unrestricted Task Logging from that point forward.

- [ ] **Step 4: Implement manual clock and override state**

`getClockInIntent(nowMs)` must classify exactly one of:

```js
{mode:'scheduled',shift,warning:null}
{mode:'overtime',shift:null,warning:'scheduled-ended'}
{mode:'unscheduled',shift:null,warning:'unscheduled-day'}
```

`clockIn()` reclassifies at action time. Scheduled work stores the anchored `shiftId`; overtime and unscheduled modes store no scheduled shift ID and continue until manual Clock Out.

`clockOut(nowMs)` stops an active task through `stopTaskLogTask(job,task,nowMs)`, sets Clocked Out, and retains the current scheduled shift's pause overrides if that scheduled shift window is still active.

`setPauseOverride(kind,enabled,nowMs)` accepts only `break` or `lunch`, reconciles the old rule first, changes only the current shift's override, updates `policyEffectiveAt`, and if a newly-enabled pause is already active, stops a running task at `nowMs` rather than retroactively.

Emit after successful state changes:

```js
document.dispatchEvent(new CustomEvent('fabrication:shift-schedule-change',{
  detail:{state:getShiftScheduleState(),status:getShiftScheduleStatus()}
}));
```

- [ ] **Step 5: Run focused regressions and commit**

```bash
npm run verify:shift-schedule
npm run verify:features
```

Expected: PASS.

```bash
git add fabrication_pro_capacitor/www/app.js fabrication_pro_capacitor/scripts/verify-shift-schedule.mjs
git commit -m "feat: add shift schedule clock state"
```

---

### Task 3: Enforce Clock In, pauses, scheduled Clock Out, and exact wake-up recovery

**Files:**
- Modify: `fabrication_pro_capacitor/www/app.js` around `startTaskLogTask`, startup load, `visibilitychange`, `pageshow`, and the existing 1-second Task Logging refresh.
- Modify: `fabrication_pro_capacitor/scripts/verify-shift-schedule.mjs`

**Interfaces:**
- Consumes Task 2 state/API and the existing `stopTaskLogTask(job,task,nowMs)` explicit timestamp path.
- Produces the authoritative Task Logging start guard and reconciliation flow.

- [ ] **Step 1: Add failing integration assertions**

```js
expect(/function\s+startTaskLogTask\s*\([^)]*\)[\s\S]*getShiftTaskPermission/.test(app),'startTaskLogTask must consult the Shift Schedule guard.');
expect(app.includes('reconcileShiftSchedule(Date.now())'),'Shift Schedule reconciliation calls are missing.');
expect(app.includes("document.addEventListener('visibilitychange'"),'visibilitychange recovery must remain.');
expect(app.includes("window.addEventListener('pageshow'"),'pageshow recovery must remain.');
expect(app.includes("window.addEventListener('focus'"),'focus recovery is required.');
expect(app.includes('setInterval(updateTaskLogTimerDisplays,1000)'),'Existing 1-second timer refresh must remain.');
```

Add the prospective boundary test:

```js
expect(core.firstShiftProhibitedBoundary(
  localMs(2026,8,31,9,30),localMs(2026,8,31,10,10),monday,
  {breakEnabled:true,lunchEnabled:true,policyEffectiveAt:localMs(2026,8,31,10,10)}
)===null,'A schedule edit at 10:10 must not retroactively create a 9:00 stop.');
```

Run and confirm RED.

- [ ] **Step 2: Guard the existing Start path before touching another running task**

Inside `startTaskLogTask(taskId)`, after locating the target but before auto-stopping any previous task:

```js
const permission=getShiftTaskPermission(Date.now());
if (!permission.allowed) {
  showTaskLogStatus(permission.reason,'error');
  return;
}
```

When protection is disabled, permission must return `{allowed:true}`. When enabled it rejects Clocked Out, active Break, active Lunch, and ended scheduled-shift states. Early/late scheduled work, overtime, and unscheduled work are allowed when manually Clocked In.

- [ ] **Step 3: Implement exact reconciliation**

For scheduled mode only, calculate the first prohibited boundary after the running task's effective start and call the existing stop path with that boundary timestamp:

```js
const boundary=firstShiftProhibitedBoundary(
  Number(running.task.startedAt),nowMs,activeShift,effectivePolicy
);
if (boundary!==null) {
  stopTaskLogTask(running.job,running.task,boundary);
  persistTaskLogJobs(true);
}
```

Clock state is reconciled separately: once scheduled Clock Out has passed, force Clocked Out even if the task already stopped earlier at Break/Lunch. Overtime and unscheduled modes are never automatically clocked out.

- [ ] **Step 4: Wire startup/background/foreground enforcement without a second interval**

After persisted Task Logging and Shift Schedule records are loaded, run reconciliation before the first interactive render.

At the top of the existing `updateTaskLogTimerDisplays()` call path, reconcile using the same `Date.now()` value so the existing `setInterval(updateTaskLogTimerDisplays,1000)` provides foreground enforcement. Add reconciliation before rendering on visible `visibilitychange`, `pageshow`, and `focus`.

Do not auto-start any task when a pause ends.

- [ ] **Step 5: Run and commit**

```bash
npm run verify:shift-schedule
npm run verify:features
npm run verify:ux-polish
```

Expected: PASS.

```bash
git add fabrication_pro_capacitor/www/app.js fabrication_pro_capacitor/scripts/verify-shift-schedule.mjs
git commit -m "feat: enforce shift schedule task timing"
```

---

### Task 4: Add the header Clock control and Task Logging status

**Files:**
- Modify: `fabrication_pro_capacitor/www/index.html`
- Modify: `fabrication_pro_capacitor/www/ux.js`
- Modify: `fabrication_pro_capacitor/www/ux.css`
- Modify: `fabrication_pro_capacitor/scripts/verify-shift-schedule.mjs`

**Interfaces:**
- Static IDs: `shiftClockControl`, `shiftClockStatus`, `shiftClockBtn`, `taskLogShiftStatus`.
- Consumes `shiftSchedule.getState/getStatus/getClockInIntent/clockIn/clockOut`.

- [ ] **Step 1: Add failing source/style assertions**

```js
for (const id of ['shiftClockControl','shiftClockStatus','shiftClockBtn','taskLogShiftStatus']) {
  expect(html.includes(`id="${id}"`),`Missing ${id}.`);
}
expect(css.includes('.shift-clock-btn.clock-in'),'Green Clock In style is missing.');
expect(css.includes('.shift-clock-btn.clock-out'),'Red Clock Out style is missing.');
expect(ux.includes('fabrication:shift-schedule-change'),'UX must listen for Shift Schedule changes.');
expect(ux.includes('getClockInIntent'),'Clock In UX must distinguish scheduled/overtime/unscheduled intent.');
```

Run and confirm RED.

- [ ] **Step 2: Add semantic static anchors**

Inside `.brand-row`, after the brand and before `#themeToggle`:

```html
<div id="shiftClockControl" class="shift-clock-control" aria-live="polite">
  <span id="shiftClockStatus" class="shift-clock-status">Shift Schedule Off</span>
  <button id="shiftClockBtn" class="shift-clock-btn schedule-off" type="button" disabled>SHIFT SCHEDULE OFF</button>
</div>
```

Immediately before `#taskLogRunningBanner`:

```html
<div id="taskLogShiftStatus" class="tasklog-shift-status" role="status" aria-live="polite">Shift Schedule Off</div>
```

Do not move or restyle `#pageMenuBtn` or `#themeToggle`.

- [ ] **Step 3: Bind confirmations and visible state in `ux.js`**

Clocked Out -> green `CLOCK IN`. Clocked In -> red `CLOCK OUT`. Disabled -> neutral disabled `SHIFT SCHEDULE OFF`.

Clock In confirmation copy must branch:

```js
const intent=window.FabriCadabraApp.shiftSchedule.getClockInIntent();
const message=intent.mode==='overtime'
  ? 'Your scheduled shift has ended. Clock in again for overtime? Overtime will continue until you manually clock out.'
  : intent.mode==='unscheduled'
    ? 'Today is not one of your scheduled workdays. Clock in for unscheduled work? This will continue until you manually clock out.'
    : 'Clock in for this shift? Task Logging timers will be available except during enabled Break and Lunch periods.';
if (window.confirm(message)) window.FabriCadabraApp.shiftSchedule.clockIn();
```

Clock Out confirmation:

```js
if (window.confirm('Clock out now? Any running Task Logging timer will stop immediately.')) {
  window.FabriCadabraApp.shiftSchedule.clockOut();
}
```

The Task Logging status must clearly render states such as `Shift: Clocked Out`, `Shift: Working`, `Break until 9:15 AM`, `Lunch until 12:30 PM`, `Overtime`, and `Unscheduled work`.

- [ ] **Step 4: Style with existing semantic colors and preserve Pages sizing**

```css
.shift-clock-btn.clock-in {
  background:var(--good-bg);
  color:var(--good);
  border-color:color-mix(in srgb,var(--good) 55%,var(--border));
}
.shift-clock-btn.clock-out {
  background:var(--danger-bg);
  color:var(--danger);
  border-color:color-mix(in srgb,var(--danger) 55%,var(--border));
}
```

Add responsive wrapping for the header control. Leave the existing `.fab-page-drawer .fab-page-list` containment rules intact.

- [ ] **Step 5: Run and commit**

```bash
npm run verify:shift-schedule
npm run verify:ux-polish
npm run verify:settings
npm run verify:style-cascade
```

Expected: PASS.

```bash
git add fabrication_pro_capacitor/www/index.html fabrication_pro_capacitor/www/ux.js fabrication_pro_capacitor/www/ux.css fabrication_pro_capacitor/scripts/verify-shift-schedule.mjs
git commit -m "feat: add shift clock controls"
```

---

### Task 5: Add the collapsible Settings Shift Schedule panel and current-shift overrides

**Files:**
- Modify: `fabrication_pro_capacitor/www/ux.js` inside `installSettingsPage()`.
- Modify: `fabrication_pro_capacitor/www/ux.css`
- Modify: `fabrication_pro_capacitor/scripts/verify-shift-schedule.mjs`

**Interfaces:**
- Settings IDs: `shiftScheduleDetails`, `shiftScheduleMasterToggle`, `shiftScheduleMasterState`, `shiftStartDay`, `shiftEndDay`, `shiftClockInTime`, `shiftClockInPeriod`, `shiftBreakToggle`, `shiftBreakTime`, `shiftBreakPeriod`, `shiftBreakMinutes`, `shiftLunchToggle`, `shiftLunchTime`, `shiftLunchPeriod`, `shiftLunchMinutes`, `shiftClockOutTime`, `shiftClockOutPeriod`, `shiftScheduleSaveBtn`, `shiftScheduleStatus`.
- Consumes `getState`, `saveConfig`, `setEnabled`, and `setPauseOverride`.

- [ ] **Step 1: Add failing Settings contract assertions**

```js
for (const id of ['shiftScheduleDetails','shiftScheduleMasterToggle','shiftScheduleMasterState','shiftStartDay','shiftEndDay','shiftClockInTime','shiftClockInPeriod','shiftBreakToggle','shiftBreakTime','shiftBreakPeriod','shiftBreakMinutes','shiftLunchToggle','shiftLunchTime','shiftLunchPeriod','shiftLunchMinutes','shiftClockOutTime','shiftClockOutPeriod','shiftScheduleSaveBtn','shiftScheduleStatus']) {
  expect(ux.includes(`id='${id}'`) || ux.includes(`id="${id}"`),`Settings is missing ${id}.`);
}
expect(ux.includes('Length in minutes'),'Break/Lunch duration labels are missing.');
expect(css.includes('.settings-shift-schedule'),'Shift Schedule Settings styles are missing.');
```

Run and confirm RED.

- [ ] **Step 2: Build the collapsed-by-default panel before the Application card**

Use the existing `card management-details` pattern. The visible rows must read exactly as the approved structure:

```text
Scheduled Days  [Monday] through [Friday]
Clock In        [Time] [AM/PM]
Break           [toggle] [Time] [AM/PM] [Length in minutes]
Lunch           [toggle] [Time] [AM/PM] [Length in minutes]
Clock Out       [Time] [AM/PM]
```

Use text time inputs (`inputmode="numeric"`, e.g. `7:00`) plus explicit AM/PM `<select>` controls, not a 24-hour-only native time input. Use integer duration inputs with `min=1`. Day selects use JS day values `0..6`.

- [ ] **Step 3: Add 12-hour conversion helpers and exact config assembly**

```js
function shiftTimeTo24(value,period) {
  const match=String(value||'').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  let hour=Number(match[1]);
  const minute=Number(match[2]);
  if (hour<1 || hour>12 || minute<0 || minute>59) return null;
  if (period==='AM') hour=hour===12?0:hour;
  else if (period==='PM') hour=hour===12?12:hour+12;
  else return null;
  return `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
}
```

Save assembles exactly the core `config` shape from Task 2 and surfaces every returned validation error in `#shiftScheduleStatus`. Disabled Break/Lunch rows keep their entered time/duration values so re-enabling does not force re-entry.

- [ ] **Step 4: Implement the master warning/confirmation flow**

Enable warning must explain manual Clock In and automatic timer control. Disable warning must explain that protection is being removed. If enabling, save/validate the current form first; if invalid, leave protection OFF.

Use these required consequences in the copy:

```text
Enable: Manual Clock In becomes required. Active timers stop now. Enabled Break, Lunch, and scheduled Clock Out boundaries will control Task Logging.
Disable: Task Logging returns to unrestricted behavior. Automatic Break, Lunch, Clock Out, and clock-in protection are turned off.
```

- [ ] **Step 5: Implement saved defaults versus current-shift Break/Lunch overrides**

Before a scheduled shift is established, the small toggles edit saved defaults. During an established scheduled shift, label/helper text changes to `Current shift override` and toggles call:

```js
shiftSchedule.setPauseOverride('break',checked);
shiftSchedule.setPauseOverride('lunch',checked);
```

Overrides survive navigation, restart, and manual Clock Out/In inside the same scheduled shift. They expire when that anchored scheduled shift ends. Turning an already-active pause ON stops a running task at the override-change time; turning it OFF never auto-restarts a task.

- [ ] **Step 6: Run and commit**

```bash
npm run verify:shift-schedule
npm run verify:settings
npm run verify:ux-polish
npm run verify:style-cascade
```

Expected: PASS.

```bash
git add fabrication_pro_capacitor/www/ux.js fabrication_pro_capacitor/www/ux.css fabrication_pro_capacitor/scripts/verify-shift-schedule.mjs
git commit -m "feat: add shift schedule settings"
```

---

### Task 6: Publish the detailed v1.0.2 changelog and bump the canonical version

**Files:**
- Modify: `fabrication_pro_capacitor/www/ux.js`
- Modify: `fabrication_pro_capacitor/scripts/verify-settings-changelog.mjs`
- Modify: `fabrication_pro_capacitor/scripts/verify-shift-schedule.mjs`
- Modify: `fabrication_pro_capacitor/package.json`

**Interfaces:**
- Consumes existing `scripts/sync-app-version.mjs`.
- Produces canonical version `1.0.2`, a historical fixed v1.0.1 entry, and newest-first v1.0.2 release notes.

- [ ] **Step 1: Make version/changelog verification fail before changing release metadata**

Update `verify-settings-changelog.mjs` so the release target is `1.0.2`, the generated `FABRI_CADABRA_VERSION` still must match `package.json`, and the verifier requires v1.0.2 content plus a retained `data-changelog-version='1.0.1'` entry and the existing v1.0.0 baseline.

Required v1.0.2 concepts:

```text
Shift Schedule in Settings
manual Clock In/Out
green Clock In / red Clock Out
early and late Clock In flexibility
Break/Lunch current-shift overrides
exact automatic Break/Lunch stops
no automatic task restart
forced scheduled Clock Out
overtime re-clock-in until manual Clock Out
unscheduled-work confirmation
overnight shifts
lock/background/reopen exact-boundary reconciliation
disabling Shift Schedule restores unrestricted Task Logging
```

Also assert aggregate `package.json` verification contains `npm run verify:shift-schedule`.

Run:

```bash
npm run verify:settings
npm run verify:shift-schedule
```

Expected: RED because package version/changelog are still 1.0.1.

- [ ] **Step 2: Bump only the canonical package version**

Change only:

```json
"version": "1.0.1"
```

to:

```json
"version": "1.0.2"
```

Do not create a lockfile or change dependency versions.

- [ ] **Step 3: Rebuild changelog ordering**

`changelogMarkup()` must render:

```text
v1.0.2 Shift Schedule & Clock Controls
v1.0.1 Settings & Changelog
v1.0.0 Current Features
```

The v1.0.2 entry must disclose the actual behavior rather than a generic “Added scheduling” bullet. Preserve all five existing v1.0.1 Settings/Changelog bullets unchanged beneath it.

- [ ] **Step 4: Add the schedule verifier to aggregate verification and sync the browser marker**

Add `npm run verify:shift-schedule` to the aggregate `verify` chain after Settings verification and before style/native/platform verification.

Run:

```bash
npm run sync:version
npm run verify:settings
npm run verify:shift-schedule
```

Expected: `ux.js` contains exactly `const FABRI_CADABRA_VERSION='1.0.2';` and both verifiers PASS.

- [ ] **Step 5: Commit**

```bash
git add fabrication_pro_capacitor/package.json fabrication_pro_capacitor/www/ux.js fabrication_pro_capacitor/scripts/verify-settings-changelog.mjs fabrication_pro_capacitor/scripts/verify-shift-schedule.mjs
git commit -m "feat: document v1.0.2 shift schedule"
```

---

### Task 7: Run the complete local compatibility gate and document ownership

**Files:**
- Modify: `fabrication_pro_capacitor/README.md`
- Review all changed application files.

**Interfaces:**
- Produces one feature-branch SHA that has passed every repository verifier before staging.

- [ ] **Step 1: Update README ownership/persistence notes narrowly**

Keep the seven canonical runtime assets. Update the `app.js` responsibility line so it explicitly includes Shift Schedule timer policy/persistence, and update the `ux.js` line so it explicitly states that Shift Schedule presentation delegates clock/timer rules to `app.js`. Add `fabricationShiftScheduleV1` to persistence notes without implying payroll history/export.

- [ ] **Step 2: Run the complete repository verification suite**

```bash
cd fabrication_pro_capacitor
npm install --ignore-scripts
npm run verify
```

Expected PASS for version sync, web, features, UX polish, Settings/changelog, Shift Schedule, style cascade, native shim, iOS privacy, and Android signing.

- [ ] **Step 3: Re-run regression-sensitive verifiers independently**

```bash
npm run verify:features
npm run verify:ux-polish
npm run verify:settings
npm run verify:shift-schedule
npm run verify:style-cascade
```

Expected: all PASS, including the existing assertion that the nine original Pages buttons keep natural pre-Settings row height.

- [ ] **Step 4: Review the feature diff for forbidden compatibility changes**

```bash
git diff main...HEAD -- fabrication_pro_capacitor
```

Confirm no app ID change, no existing localStorage/import-export/timer field rename, no fabrication formula/optimizer change, no Pages-link sizing regression, and package version exactly `1.0.2`.

- [ ] **Step 5: Commit README documentation**

```bash
git add fabrication_pro_capacitor/README.md
git commit -m "docs: document shift schedule ownership"
```

---

### Task 8: Stage the exact verified SHA, verify both phone builds, then promote to main

**Files:**
- No source edits expected after the verified feature SHA is recorded.

**Interfaces:**
- Consumes exact verified `feature/v1.0.2-shift-schedule` HEAD.
- Produces tested `work`, fast-forwarded `main`, GitHub Pages deployment, signed Android artifact, and unsigned iPhone artifact from the same SHA.

- [ ] **Step 1: Record the exact feature SHA**

```bash
FEATURE_SHA=$(git rev-parse HEAD)
echo "$FEATURE_SHA"
```

Any source change after this point invalidates staging and requires Task 7 again.

- [ ] **Step 2: Move or create `work` at exactly `FEATURE_SHA`**

Do not move `main` yet. The installer workflow is already configured for pushes to `work` and `main`.

- [ ] **Step 3: Require staging installer success**

For the `work` workflow run, require:
- Android job success;
- iPhone job success;
- Android permanent signing identity verification success;
- artifact `Fabri-Cadabra-Android-APK` uploaded;
- artifact `Fabri-Cadabra-iPhone-Unsigned-IPA` uploaded;
- workflow head SHA equals `FEATURE_SHA`.

If either platform fails, fix on the feature branch, repeat Task 7, and stage a new exact SHA.

- [ ] **Step 4: Fast-forward `main` to the tested SHA with force disabled**

The promoted SHA must be byte-for-byte the staged `FEATURE_SHA`.

- [ ] **Step 5: Require production Pages and installer success**

Verify `deploy-pages.yml` and `build-phone-installers.yml` succeed on `main`, and both production workflow runs report head SHA `FEATURE_SHA`.

- [ ] **Step 6: Record production evidence**

Capture final `main` SHA, workflow run IDs, Android artifact ID/name/digest/size/expiry, iPhone artifact ID/name/digest/size/expiry, and confirmation that `package.json` on `main` is `1.0.2`.

Do not create a GitHub Release unless the user separately asks for one; current distribution remains GitHub Actions artifacts.

---

## Final Acceptance Matrix

Before declaring v1.0.2 complete, explicitly verify all of these behaviors:

1. Disabled Shift Schedule preserves unrestricted Task Logging.
2. Enabling validates the schedule, confirms consequences, stops an existing timer at enable time, and starts Clocked Out.
3. Clocked Out blocks task Start in core logic.
4. Clock In is green; Clock Out is red.
5. Normal, early, and late scheduled Clock In work.
6. Clock In during Break/Lunch is allowed but task Start remains blocked until that pause ends.
7. Break stops a running task at exact Break start.
8. Lunch stops a running task at exact Lunch start.
9. Break/Lunch ending never auto-starts a task.
10. Scheduled Clock Out stops the task at exact Clock Out and forces Clocked Out.
11. Manual Clock Out stops the active task at actual device time.
12. Overtime re-clock-in requires confirmation and runs until manual Clock Out, even across midnight/next scheduled day.
13. Unscheduled-day Clock In requires confirmation and runs until manual Clock Out without borrowing another day’s pause/out rules.
14. Overnight shifts belong to the day they start; Friday can end Saturday morning without making Saturday a scheduled start day.
15. Wrapped workday ranges such as Friday-through-Tuesday work; Monday-through-Monday means Monday only.
16. Break and Lunch are independently optional.
17. Current-shift Break/Lunch overrides survive page changes, app restart, and manual Clock Out/In inside the same scheduled shift.
18. Overrides expire at that scheduled shift’s end and return to saved defaults next shift.
19. Override changes and schedule edits are prospective and never rewrite already-earned labor.
20. A task left running while the device sleeps is closed at the first crossed prohibited boundary, not at wake time.
21. Clock state is separately reconciled to Clocked Out if scheduled Clock Out passes while the app is asleep.
22. Existing Task Logging job/preset import/export and session formats remain unchanged.
23. Existing nine Pages buttons retain their v1.0.1 sizing/spacing.
24. Settings remains outside the nine fabrication links.
25. The in-app changelog fully explains the new clock/schedule behavior.
26. `package.json` is the single canonical version source and is exactly `1.0.2` for this release.
27. Full `npm run verify` passes.
28. Staging Android/iPhone installers pass on the exact feature SHA.
29. Production Pages and Android/iPhone installers pass on the same promoted SHA.
