from pathlib import Path
import json, re

repo=Path(__file__).resolve().parents[1]
app_root=repo/'fabrication_pro_capacitor'
tmp=repo/'scripts'

def read(p): return Path(p).read_text(encoding='utf-8')
def write(p,s): Path(p).write_text(s,encoding='utf-8')
def replace_once(text, old, new, label):
    count=text.count(old)
    if count!=1:
        raise RuntimeError(f'{label}: expected exactly one match, found {count}')
    return text.replace(old,new,1)

def regex_once(text, pattern, repl, label, flags=0):
    out,count=re.subn(pattern,repl,text,count=1,flags=flags)
    if count!=1: raise RuntimeError(f'{label}: expected one regex match, got {count}')
    return out

core=read(tmp/'.tmp-v102-shift-core.js').rstrip()
runtime=read(tmp/'.tmp-v102-shift-runtime.js').rstrip()
ux_header=read(tmp/'.tmp-v102-ux-header.js').rstrip()
settings_markup=read(tmp/'.tmp-v102-settings-markup.html').rstrip()
settings_wiring=read(tmp/'.tmp-v102-settings-wiring.js').rstrip()
changelog=read(tmp/'.tmp-v102-changelog.js').rstrip()
shift_styles=read(tmp/'.tmp-v102-shift-styles.css').rstrip()
verify_shift=read(tmp/'.tmp-v102-verify-shift.mjs')
verify_settings=read(tmp/'.tmp-v102-verify-settings.mjs')

p=app_root/'www/app.js'; s=read(p)
anchor="  let taskLogSelectedPresetIds = new Set();"
s=replace_once(s,anchor,anchor+'\n\n'+core+'\n\n'+runtime,'app shift core insertion')
old="  function updateTaskLogTimerDisplays() {\n    const now=Date.now();"
new="  function updateTaskLogTimerDisplays() {\n    const now=Date.now();\n    reconcileShiftSchedule(now);"
s=replace_once(s,old,new,'timer display reconciliation')
old="    if (!targetTask || targetTask.running) return;\n    const now=Date.now();\n    const previous=findRunningTaskLogTask();"
new="    if (!targetTask || targetTask.running) return;\n    const now=Date.now();\n    reconcileShiftSchedule(now);\n    const permission=getShiftTaskPermission(now);\n    if (!permission.allowed) {\n      showTaskLogStatus(permission.reason,'error');\n      return;\n    }\n    const previous=findRunningTaskLogTask();"
s=replace_once(s,old,new,'Task Logging start guard')
old="    } catch (error) {\n      taskLogPresets=[]; taskLogNextPresetId=1;\n      showTaskLogStatus('Saved Task Logging preset tasks could not be read. Exported backups are unaffected.','error');\n    }\n    renderTaskLogging();\n  }"
new="    } catch (error) {\n      taskLogPresets=[]; taskLogNextPresetId=1;\n      showTaskLogStatus('Saved Task Logging preset tasks could not be read. Exported backups are unaffected.','error');\n    }\n    reconcileShiftSchedule(Date.now());\n    renderTaskLogging();\n  }"
s=replace_once(s,old,new,'startup schedule reconciliation')
old="  document.addEventListener('visibilitychange',()=>{ if (!document.hidden) { updateTaskLogTimerDisplays(); renderTaskLogJobs(); renderTaskLogRunningBanner(); } });\n  window.addEventListener('pageshow',()=>{ updateTaskLogTimerDisplays(); renderTaskLogRunningBanner(); });\n  setInterval(updateTaskLogTimerDisplays,1000);"
new="  document.addEventListener('visibilitychange',()=>{ if (!document.hidden) { reconcileShiftSchedule(Date.now()); updateTaskLogTimerDisplays(); renderTaskLogJobs(); renderTaskLogRunningBanner(); } });\n  window.addEventListener('pageshow',()=>{ reconcileShiftSchedule(Date.now()); updateTaskLogTimerDisplays(); renderTaskLogRunningBanner(); });\n  window.addEventListener('focus',()=>{ reconcileShiftSchedule(Date.now()); updateTaskLogTimerDisplays(); renderTaskLogRunningBanner(); });\n  setInterval(updateTaskLogTimerDisplays,1000);"
s=replace_once(s,old,new,'lifecycle reconciliation')
write(p,s)

p=app_root/'www/index.html'; s=read(p)
old="""        </div>\n        <button id=\"themeToggle\" class=\"theme-toggle\" type=\"button\" aria-label=\"Switch color theme\">☾ Dark</button>"""
new="""        </div>\n        <div id=\"shiftClockControl\" class=\"shift-clock-control\" aria-live=\"polite\">\n          <span id=\"shiftClockStatus\" class=\"shift-clock-status\">Shift Schedule Off</span>\n          <button id=\"shiftClockBtn\" class=\"shift-clock-btn schedule-off\" type=\"button\" disabled>SHIFT SCHEDULE OFF</button>\n        </div>\n        <button id=\"themeToggle\" class=\"theme-toggle\" type=\"button\" aria-label=\"Switch color theme\">☾ Dark</button>"""
s=replace_once(s,old,new,'header clock anchor')
old='      <div id="taskLogRunningBanner" class="tasklog-running-banner" role="status" aria-live="polite">'
new='      <div id="taskLogShiftStatus" class="tasklog-shift-status" role="status" aria-live="polite">Shift Schedule Off</div>\n\n'+old
s=replace_once(s,old,new,'Task Logging shift status anchor')
write(p,s)

p=app_root/'www/ux.js'; s=read(p)
anchor='  function currentFeaturesChangelogMarkup() {'
s=replace_once(s,anchor,ux_header+'\n\n'+anchor,'ux clock behavior')
pattern=r"  function changelogMarkup\(\) \{[\s\S]*?\n  \}\n\n  function installSettingsPage\(\) \{"
s=regex_once(s,pattern,changelog+'\n\n  function installSettingsPage() {','changelog replacement')
old="""      <div class='tool-title'>\n        <h2>Settings</h2>\n        <p>App information, release history, and Fabri-Cadabra settings.</p>\n      </div>\n      <section class='card settings-overview-card'>"""
new="""      <div class='tool-title'>\n        <h2>Settings</h2>\n        <p>App information, release history, and Fabri-Cadabra settings.</p>\n      </div>\n"""+settings_markup+"\n      <section class='card settings-overview-card'>"
s=replace_once(s,old,new,'Settings Shift Schedule markup')
old="    const changelogButton=document.getElementById('settingsChangelogBtn');\n    const changelogCloseBtn=document.getElementById('settingsChangelogCloseBtn');\n    const originalGetActiveTool=window.FabriCadabraApp.getActiveTool.bind(window.FabriCadabraApp);"
new="    const changelogButton=document.getElementById('settingsChangelogBtn');\n    const changelogCloseBtn=document.getElementById('settingsChangelogCloseBtn');\n"+settings_wiring+"\n\n    const originalGetActiveTool=window.FabriCadabraApp.getActiveTool.bind(window.FabriCadabraApp);"
s=replace_once(s,old,new,'Settings Shift Schedule wiring')
write(p,s)

p=app_root/'www/ux.css'; s=read(p)
if '/* ---------------- Shift Schedule / Clock controls ---------------- */' in s:
    raise RuntimeError('shift styles already present')
write(p,s.rstrip()+'\n\n'+shift_styles+'\n')

p=app_root/'package.json'; pkg=json.loads(read(p))
pkg['version']='1.0.2'
pkg.setdefault('scripts',{})['verify:shift-schedule']='node scripts/verify-shift-schedule.mjs'
verify=pkg['scripts']['verify']
if 'npm run verify:shift-schedule' not in verify:
    needle='npm run verify:settings && '
    if needle not in verify: raise RuntimeError('aggregate verify insertion anchor missing')
    verify=verify.replace(needle,needle+'npm run verify:shift-schedule && ',1)
pkg['scripts']['verify']=verify
write(p,json.dumps(pkg,indent=2,ensure_ascii=False)+'\n')

write(app_root/'scripts/verify-shift-schedule.mjs',verify_shift)
write(app_root/'scripts/verify-settings-changelog.mjs',verify_settings)

p=app_root/'README.md'; s=read(p)
s=replace_once(s,"| `www/app.js` | Fabrication tools, saved-data behavior, canonical navigation, shared drawer mechanics, self-tests |","| `www/app.js` | Fabrication tools, saved-data behavior, Shift Schedule timer policy/persistence, canonical navigation, shared drawer mechanics, self-tests |",'README app.js ownership')
s=replace_once(s,"| `www/ux.js` | Focused Task Logging / Fabricator Notes presentation wiring that delegates data, timers, persistence, and note operations to `app.js` |","| `www/ux.js` | Focused Task Logging / Fabricator Notes / Shift Schedule presentation wiring that delegates data, clock/timer rules, persistence, and note operations to `app.js` |",'README ux.js ownership')
old="Fabri-Cadabra uses browser/WebView `localStorage`. In Capacitor, that storage belongs to the installed application and persists across normal restarts and same-identity app updates. Uninstalling the application removes app-local storage, so the built-in JSON exports remain the portable backup/transfer mechanism."
new=old+"\n\nShift Schedule configuration and its live clock/override state use the isolated `fabricationShiftScheduleV1` localStorage record. This state is a Task Logging guardrail, not a payroll/timecard history or export format."
s=replace_once(s,old,new,'README persistence note')
write(p,s)

app=read(app_root/'www/app.js')
cap=json.loads(read(app_root/'capacitor.config.json'))
if cap.get('appId')!='com.fabricationpro.app': raise RuntimeError('Capacitor app ID changed')
for marker in ["'fabricationTaskLogJobsV1'","'fabricationTaskLogPresetsV1'","'FabricationTaskLogJobs'","'FabricationTaskLogPresets'"]:
    if marker not in app: raise RuntimeError(f'protected Task Logging marker missing: {marker}')
print('Applied Fabri-Cadabra v1.0.2 Shift Schedule patch.')
