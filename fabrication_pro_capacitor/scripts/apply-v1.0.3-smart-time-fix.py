from pathlib import Path
import json

root=Path(__file__).resolve().parents[1]
ux_path=root/'www'/'ux.js'
ux=ux_path.read_text(encoding='utf-8')

old_time="""  function shiftTimeTo24(value,period) {
    const match=String(value||'').trim().match(/^(\\d{1,2}):(\\d{2})$/);
    if (!match) return null;
    let hour=Number(match[1]);
    const minute=Number(match[2]);
    if (hour<1 || hour>12 || minute<0 || minute>59) return null;
    if (period==='AM') hour=hour===12?0:hour;
    else if (period==='PM') hour=hour===12?12:hour+12;
    else return null;
    return `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
  }
"""
new_time="""  // @shift-smart-time-start
  function normalizeShiftTimeEntry(value) {
    const raw=String(value ?? '').trim();
    if (!raw) return null;
    let hourText='';
    let minuteText='';
    const colonMatch=raw.match(/^(\\d{1,2}):(\\d{2})$/);
    if (colonMatch) {
      hourText=colonMatch[1];
      minuteText=colonMatch[2];
    } else if (/^\\d{1,4}$/.test(raw)) {
      if (raw.length<=2) {
        hourText=raw;
        minuteText='00';
      } else {
        hourText=raw.slice(0,-2);
        minuteText=raw.slice(-2);
      }
    } else return null;
    const hour=Number(hourText);
    const minute=Number(minuteText);
    if (!Number.isInteger(hour) || hour<1 || hour>12 || !Number.isInteger(minute) || minute<0 || minute>59) return null;
    return `${hour}:${String(minute).padStart(2,'0')}`;
  }

  function shiftTimeTo24(value,period) {
    const normalized=normalizeShiftTimeEntry(value);
    if (!normalized) return null;
    const match=normalized.match(/^(\\d{1,2}):(\\d{2})$/);
    let hour=Number(match[1]);
    const minute=Number(match[2]);
    if (period==='AM') hour=hour===12?0:hour;
    else if (period==='PM') hour=hour===12?12:hour+12;
    else return null;
    return `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
  }
  // @shift-smart-time-end
"""
if old_time not in ux:
    raise SystemExit('Expected original shiftTimeTo24 block not found.')
ux=ux.replace(old_time,new_time,1)

for field in ['shiftClockInTime','shiftBreakTime','shiftLunchTime','shiftClockOutTime']:
    old=f"id='{field}' type='text' inputmode='numeric' autocomplete='off'"
    new=f"id='{field}' type='text' inputmode='numeric' enterkeyhint='done' maxlength='5' autocomplete='off'"
    if old not in ux:
        raise SystemExit(f'Expected input attributes not found for {field}.')
    ux=ux.replace(old,new,1)

needle="""    const shiftScheduleSaveBtn=document.getElementById('shiftScheduleSaveBtn');
    const shiftScheduleStatus=document.getElementById('shiftScheduleStatus');

    function showShiftScheduleStatus(message,type='ok') {
"""
replacement="""    const shiftScheduleSaveBtn=document.getElementById('shiftScheduleSaveBtn');
    const shiftScheduleStatus=document.getElementById('shiftScheduleStatus');

    function bindShiftSmartTimeInput(input) {
      if (!input) return;
      input.addEventListener('input',()=>{
        const raw=String(input.value || '');
        const clean=raw.replace(/[^\\d:]/g,'').slice(0,5);
        if (clean!==raw) input.value=clean;
      });
      input.addEventListener('blur',()=>{
        const normalized=normalizeShiftTimeEntry(input.value);
        if (normalized) input.value=normalized;
      });
    }
    bindShiftSmartTimeInput(shiftClockInTime);
    bindShiftSmartTimeInput(shiftBreakTime);
    bindShiftSmartTimeInput(shiftLunchTime);
    bindShiftSmartTimeInput(shiftClockOutTime);

    function showShiftScheduleStatus(message,type='ok') {
"""
if needle not in ux:
    raise SystemExit('Expected Settings control declaration block not found.')
ux=ux.replace(needle,replacement,1)

clockout_block="""            <div class='settings-shift-row'>
              <label for='shiftClockOutTime'>Clock Out</label>
              <div class='settings-shift-fields settings-shift-time-fields'>
                <input id='shiftClockOutTime' type='text' inputmode='numeric' enterkeyhint='done' maxlength='5' autocomplete='off' placeholder='3:30' aria-label='Clock Out time' />
                <select id='shiftClockOutPeriod' aria-label='Clock Out AM or PM'><option>AM</option><option>PM</option></select>
              </div>
            </div>
          </div>
"""
clockout_replacement="""            <div class='settings-shift-row'>
              <label for='shiftClockOutTime'>Clock Out</label>
              <div class='settings-shift-fields settings-shift-time-fields'>
                <input id='shiftClockOutTime' type='text' inputmode='numeric' enterkeyhint='done' maxlength='5' autocomplete='off' placeholder='3:30' aria-label='Clock Out time' />
                <select id='shiftClockOutPeriod' aria-label='Clock Out AM or PM'><option>AM</option><option>PM</option></select>
              </div>
            </div>
            <span class='hint settings-shift-time-hint'>Phone-friendly time entry: type 730 for 7:30, 1230 for 12:30, or 7 for 7:00. No colon needed.</span>
          </div>
"""
if clockout_block not in ux:
    raise SystemExit('Expected Clock Out Settings block not found.')
ux=ux.replace(clockout_block,clockout_replacement,1)

# Preserve v1.0.2 as history, then add the v1.0.3 current entry.
if "data-changelog-version='current'>" not in ux:
    raise SystemExit('Current changelog marker missing.')
ux=ux.replace("data-changelog-version='current'>","data-changelog-version='1.0.2'>",1)
old_dynamic="<span class='changelog-version-label'>Version ${FABRI_CADABRA_VERSION}</span>"
if old_dynamic not in ux:
    raise SystemExit('Current changelog version label missing.')
ux=ux.replace(old_dynamic,"<span class='changelog-version-label'>Version 1.0.2</span>",1)
changelog_start="""  function changelogMarkup() {
    return `
"""
current_entry="""      <article class='changelog-entry changelog-release' data-changelog-version='current'>
        <div class='changelog-entry-heading'>
          <div>
            <span class='changelog-version-label'>Version ${FABRI_CADABRA_VERSION}</span>
            <h2>Smart Shift Time Entry</h2>
          </div>
        </div>
        <ul>
          <li>Shift Schedule time fields are now phone-friendly and accept digits without requiring a colon from the mobile keyboard.</li>
          <li>Type 730 for 7:30, 1230 for 12:30, or a single hour such as 7 for 7:00; the existing AM/PM selector remains explicit.</li>
          <li>Existing colon-formatted times still work, and impossible times are still rejected instead of being silently changed.</li>
        </ul>
      </article>
"""
if changelog_start not in ux:
    raise SystemExit('Changelog function start not found.')
ux=ux.replace(changelog_start,changelog_start+current_entry,1)
ux_path.write_text(ux,encoding='utf-8')

pkg_path=root/'package.json'
pkg=json.loads(pkg_path.read_text(encoding='utf-8'))
if pkg.get('version')!='1.0.2':
    raise SystemExit(f"Unexpected package version before patch: {pkg.get('version')}")
pkg['version']='1.0.3'
pkg['scripts']['verify:smart-time']='node scripts/verify-smart-time-input.mjs'
verify=pkg['scripts']['verify']
if 'npm run verify:smart-time' not in verify:
    verify=verify.replace('npm run verify:shift-schedule-behavior &&','npm run verify:shift-schedule-behavior && npm run verify:smart-time &&')
pkg['scripts']['verify']=verify
pkg_path.write_text(json.dumps(pkg,indent=2)+'\n',encoding='utf-8')

settings_path=root/'scripts'/'verify-settings-changelog.mjs'
settings=settings_path.read_text(encoding='utf-8')
if "const expectedVersion='1.0.2';" not in settings:
    raise SystemExit('Expected Settings verifier version not found.')
settings=settings.replace("const expectedVersion='1.0.2';","const expectedVersion='1.0.3';",1)
old_order="""const currentIndex=changelogFunction.indexOf("data-changelog-version='current'");
const v101Index=changelogFunction.indexOf("data-changelog-version='1.0.1'");
const baselineCallIndex=changelogFunction.indexOf('${currentFeaturesChangelogMarkup()}');
if (!(currentIndex>=0 && v101Index>currentIndex && baselineCallIndex>v101Index)) throw new Error('Changelog renderer must output v1.0.2, then v1.0.1, then the v1.0.0 baseline.');
"""
new_order="""const currentIndex=changelogFunction.indexOf("data-changelog-version='current'");
const v102Index=changelogFunction.indexOf("data-changelog-version='1.0.2'");
const v101Index=changelogFunction.indexOf("data-changelog-version='1.0.1'");
const baselineCallIndex=changelogFunction.indexOf('${currentFeaturesChangelogMarkup()}');
if (!(currentIndex>=0 && v102Index>currentIndex && v101Index>v102Index && baselineCallIndex>v101Index)) throw new Error('Changelog renderer must output v1.0.3, then v1.0.2, then v1.0.1, then the v1.0.0 baseline.');
"""
if old_order not in settings:
    raise SystemExit('Expected changelog order verifier block not found.')
settings=settings.replace(old_order,new_order,1)
old_current="requireMatch(ux,/data-changelog-version='current'[\\s\\S]*?<h2>Shift Schedule &amp; Clock Controls<\\/h2>/,'Current changelog entry must describe Shift Schedule & Clock Controls.');"
new_current="requireMatch(ux,/data-changelog-version='current'[\\s\\S]*?<h2>Smart Shift Time Entry<\\/h2>/,'Current changelog entry must describe Smart Shift Time Entry.');\nrequireMatch(ux,/data-changelog-version='1.0.2'[\\s\\S]*?<h2>Shift Schedule &amp; Clock Controls<\\/h2>/,'v1.0.2 Shift Schedule changelog entry must be retained.');\nfor (const concept of ['phone-friendly','730 for 7:30','AM/PM selector','impossible times']) { if (!ux.includes(concept)) throw new Error(`v1.0.3 changelog is missing required concept: ${concept}`); }"
if old_current not in settings:
    raise SystemExit('Expected current changelog verifier line not found.')
settings=settings.replace(old_current,new_current,1)
settings_path.write_text(settings,encoding='utf-8')

shift_path=root/'scripts'/'verify-shift-schedule.mjs'
shift=shift_path.read_text(encoding='utf-8')
old_shift="expect(pkg.version==='1.0.2',`Canonical package version must be 1.0.2; got ${pkg.version}.`);"
new_shift="expect(pkg.version==='1.0.3',`Canonical package version must be 1.0.3; got ${pkg.version}.`);"
if old_shift not in shift:
    raise SystemExit('Expected Shift Schedule verifier version assertion not found.')
shift=shift.replace(old_shift,new_shift,1)
shift_path.write_text(shift,encoding='utf-8')

print('Applied v1.0.3 smart Shift time input patch.')
