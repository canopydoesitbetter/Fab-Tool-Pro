from pathlib import Path
import json

ROOT=Path(__file__).resolve().parents[1]
APP=ROOT/'fabrication_pro_capacitor/www/app.js'
UX=ROOT/'fabrication_pro_capacitor/www/ux.js'
PKG=ROOT/'fabrication_pro_capacitor/package.json'
VERIFY=ROOT/'fabrication_pro_capacitor/scripts/verify-shift-schedule.mjs'
BEHAVIOR=ROOT/'fabrication_pro_capacitor/scripts/verify-shift-schedule-behavior.mjs'


def replace_once(text,old,new,label):
    count=text.count(old)
    if count!=1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return text.replace(old,new,1)

app=APP.read_text()
app=replace_once(
    app,
    "function shiftPauseWindow(anchorDateMs,config,pause) {\n  if (!pause || pause.enabled!==true) return null;",
    "function shiftPauseWindow(anchorDateMs,config,pause) {\n  if (!pause) return null;",
    'pause-window retained-time fix'
)
old_override="""  function setShiftPauseOverride(kind,enabled,nowMs=Date.now()) {
    if (!['break','lunch'].includes(kind)) return {ok:false,error:'Unknown pause type.'};
    const now=Number(nowMs);
    reconcileShiftSchedule(now);
    const shift=shiftCurrentEstablishedInstance(now);
    if (!shift || shiftScheduleState.clock.shiftId!==shift.id) return {ok:false,error:'Current-shift overrides are available after Clock In for a scheduled shift.'};
    const wasEnabled=shiftPauseEnabled(kind,shift);
    const field=kind==='break'?'breakEnabled':'lunchEnabled';
    shiftScheduleState.pauseOverrides.shiftId=shift.id;
    shiftScheduleState.pauseOverrides[field]=enabled===true;
    shiftScheduleState.policyEffectiveAt=now;
    if (!wasEnabled && enabled===true) {
      const window=kind==='break'?shift.breakWindow:shift.lunchWindow;
      if (window && now>=window.startMs && now<window.endMs) stopRunningTaskAt(now);
    }
    const saved=persistShiftScheduleState();
    dispatchShiftScheduleChange(true);
    return saved ? {ok:true} : {ok:false,error:shiftScheduleStorageError};
  }
"""
new_override="""  function setShiftPauseOverride(kind,enabled,nowMs=Date.now()) {
    if (!['break','lunch'].includes(kind)) return {ok:false,error:'Unknown pause type.'};
    const now=Number(nowMs);
    reconcileShiftSchedule(now);
    const shift=shiftCurrentEstablishedInstance(now);
    if (!shift || shiftScheduleState.clock.shiftId!==shift.id) return {ok:false,error:'Current-shift overrides are available after Clock In for a scheduled shift.'};
    const window=kind==='break'?shift.breakWindow:shift.lunchWindow;
    if (enabled===true && !window) {
      const label=kind==='break'?'Break':'Lunch';
      return {ok:false,error:`Set and save a valid ${label} time and length before enabling it for this shift.`};
    }
    const wasEnabled=shiftPauseEnabled(kind,shift);
    const field=kind==='break'?'breakEnabled':'lunchEnabled';
    shiftScheduleState.pauseOverrides.shiftId=shift.id;
    shiftScheduleState.pauseOverrides[field]=enabled===true;
    shiftScheduleState.policyEffectiveAt=now;
    if (!wasEnabled && enabled===true && now>=window.startMs && now<window.endMs) stopRunningTaskAt(now);
    const saved=persistShiftScheduleState();
    dispatchShiftScheduleChange(true);
    return saved ? {ok:true} : {ok:false,error:shiftScheduleStorageError};
  }
"""
app=replace_once(app,old_override,new_override,'pause override validation fix')
APP.write_text(app)

ux=UX.read_text()
ux=replace_once(
    ux,
    """      if (!result.ok) showShiftScheduleStatus(result.error || 'Unable to change the current Break override.','error');
      else showShiftScheduleStatus(`Break is ${shiftBreakToggle.checked?'ON':'OFF'} for the current shift only.`,'ok');
""",
    """      if (!result.ok) {
        showShiftScheduleStatus(result.error || 'Unable to change the current Break override.','error');
        renderShiftScheduleSettings();
      } else showShiftScheduleStatus(`Break is ${shiftBreakToggle.checked?'ON':'OFF'} for the current shift only.`,'ok');
""",
    'Break toggle failure rollback'
)
ux=replace_once(
    ux,
    """      if (!result.ok) showShiftScheduleStatus(result.error || 'Unable to change the current Lunch override.','error');
      else showShiftScheduleStatus(`Lunch is ${shiftLunchToggle.checked?'ON':'OFF'} for the current shift only.`,'ok');
""",
    """      if (!result.ok) {
        showShiftScheduleStatus(result.error || 'Unable to change the current Lunch override.','error');
        renderShiftScheduleSettings();
      } else showShiftScheduleStatus(`Lunch is ${shiftLunchToggle.checked?'ON':'OFF'} for the current shift only.`,'ok');
""",
    'Lunch toggle failure rollback'
)
UX.write_text(ux)

pkg=json.loads(PKG.read_text())
pkg['scripts']['verify:shift-schedule-behavior']='node scripts/verify-shift-schedule-behavior.mjs'
verify=pkg['scripts']['verify']
needle='npm run verify:shift-schedule && npm run verify:style-cascade'
if needle not in verify:
    raise SystemExit('aggregate verify insertion point not found')
pkg['scripts']['verify']=verify.replace(needle,'npm run verify:shift-schedule && npm run verify:shift-schedule-behavior && npm run verify:style-cascade',1)
PKG.write_text(json.dumps(pkg,indent=2)+'\n')

verify_text=VERIFY.read_text()
needle="expect(core.validateShiftScheduleConfig({...base,break:{enabled:false,time:'',durationMinutes:15},lunch:{enabled:false,time:'',durationMinutes:30}}).ok,'Disabled pauses may keep blank times.');\n"
addition=needle+"const retainedPauseShift=core.buildShiftInstance(localMs(2026,8,31),{...base,break:{enabled:false,time:'09:00',durationMinutes:15}});\nexpect(retainedPauseShift?.breakWindow?.startMs===localMs(2026,8,31,9),'A saved-disabled Break with retained valid time must still construct a window for current-shift override ON.');\n"
verify_text=replace_once(verify_text,needle,addition,'pure retained pause regression')
VERIFY.write_text(verify_text)

behavior=BEHAVIOR.read_text()
needle="""// Turning a pause ON during its active window is prospective: stop now, never retroactively.
"""
addition="""// A current-shift pause cannot be switched ON when its saved-disabled row has no valid retained time.
{
  const h=makeHarness();
  const blankBreak={...noBreak,break:{enabled:false,time:'',durationMinutes:15}};
  configureAndEnable(h,blankBreak,localMs(2026,8,31,7));
  h.api.clockIn(localMs(2026,8,31,8));
  const result=h.api.setPauseOverride('break',true,localMs(2026,8,31,8,30));
  expect(!result.ok && /valid Break time and length/.test(result.error || ''),'Current-shift Break override ON must reject a saved-disabled Break that has no valid retained time.');
  expect(h.api.getState(localMs(2026,8,31,8,30)).runtime.effectiveBreakEnabled===false,'A rejected Break override must leave the effective Break state OFF.');
}

// Turning a pause ON during its active window is prospective: stop now, never retroactively.
"""
behavior=replace_once(behavior,needle,addition,'invalid retained pause behavior regression')
BEHAVIOR.write_text(behavior)

print('Applied focused current-shift pause override fix and regression coverage.')
