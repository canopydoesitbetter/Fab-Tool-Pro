(() => {
  const FABRI_CADABRA_VERSION='1.0.2'; // @generated from package.json by scripts/sync-app-version.mjs

  function moveStatusOutsideManagement(detailsId,statusId) {
    const details=document.getElementById(detailsId);
    const status=document.getElementById(statusId);
    if (details && status && details.contains(status)) details.after(status);
  }

  moveStatusOutsideManagement('taskLogManagementDetails','taskLogStatus');
  moveStatusOutsideManagement('fabricatorNotesManagementDetails','fabricatorNotesStatus');

  const taskLogPresetList=document.getElementById('taskLogPresetList');
  const taskLogTaskList=document.getElementById('taskLogTaskList');

  function normalizeAssignedPresetActions() {
    if (!taskLogPresetList) return;
    for (const row of taskLogPresetList.querySelectorAll('.tasklog-preset-row.assigned')) {
      const button=row.querySelector('[data-tasklog-delete-preset]');
      if (!button) continue;
      const presetId=button.getAttribute('data-tasklog-delete-preset');
      button.removeAttribute('data-tasklog-delete-preset');
      button.setAttribute('data-tasklog-remove-assigned',presetId || '');
      button.classList.add('tasklog-remove-assigned-btn');
      button.textContent='−';
      const name=row.querySelector('.tasklog-preset-copy strong')?.textContent?.trim() || 'task';
      button.setAttribute('aria-label',`Remove ${name} from this job`);
      button.title='Remove from this job';
    }
  }

  function removeAssignedTaskLogPreset(button) {
    const row=button.closest('.tasklog-preset-row');
    const name=row?.querySelector('.tasklog-preset-copy strong')?.textContent?.trim();
    if (!name || !taskLogTaskList) return;
    const taskRow=Array.from(taskLogTaskList.querySelectorAll('.tasklog-task-row')).find(candidate=>
      candidate.querySelector('.tasklog-task-main > strong')?.textContent?.trim()===name
    );
    const removeButton=taskRow?.querySelector('[data-tasklog-remove-task]');
    if (removeButton) removeButton.click();
  }

  if (taskLogPresetList) {
    normalizeAssignedPresetActions();
    const observer=new MutationObserver(normalizeAssignedPresetActions);
    observer.observe(taskLogPresetList,{childList:true,subtree:true});
    taskLogPresetList.addEventListener('click',event=>{
      const button=event.target.closest('[data-tasklog-remove-assigned]');
      if (!button) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      removeAssignedTaskLogPreset(button);
    },true);
  }

  const fabricatorNotesTopicsBtn=document.getElementById('fabricatorNotesTopicsBtn');
  const fabricatorNotesTopicsDrawer=document.getElementById('fabricatorNotesTopicsDrawer');
  const fabricatorNotesTopicsBackdrop=document.getElementById('fabricatorNotesTopicsBackdrop');
  const fabricatorNotesTopicsCloseBtn=document.getElementById('fabricatorNotesTopicsCloseBtn');
  const fabricatorNotesTopicList=document.getElementById('fabricatorNotesTopicList');
  const fabricatorNotesEditor=document.getElementById('fabricatorNotesEditor');

  if (fabricatorNotesTopicsBtn && fabricatorNotesEditor) {
    fabricatorNotesTopicsBtn.classList.add('notes-topics-inline-btn');
    fabricatorNotesEditor.insertBefore(fabricatorNotesTopicsBtn,fabricatorNotesEditor.firstElementChild);
  }

  function setFabricatorNotesTopicsDrawerOpen(open) {
    if (!fabricatorNotesTopicsBtn || !window.FabriCadabraApp) return;
    if (open) window.FabriCadabraApp.openDrawer('fabricatorNotesTopicsDrawer',fabricatorNotesTopicsBtn);
    else window.FabriCadabraApp.closeDrawer('fabricatorNotesTopicsDrawer',fabricatorNotesTopicsBtn);
    fabricatorNotesTopicsBtn.setAttribute('aria-expanded',open?'true':'false');
  }

  if (fabricatorNotesTopicsBtn && fabricatorNotesTopicsDrawer && fabricatorNotesTopicsBackdrop && fabricatorNotesTopicsCloseBtn) {
    fabricatorNotesTopicsBtn.addEventListener('click',()=>setFabricatorNotesTopicsDrawerOpen(!fabricatorNotesTopicsDrawer.classList.contains('open')));
    fabricatorNotesTopicsCloseBtn.addEventListener('click',()=>setFabricatorNotesTopicsDrawerOpen(false));
    fabricatorNotesTopicsBackdrop.addEventListener('click',()=>setFabricatorNotesTopicsDrawerOpen(false));
    fabricatorNotesTopicsDrawer.addEventListener('keydown',event=>{
      if (event.key==='Escape') {
        event.preventDefault();
        setFabricatorNotesTopicsDrawerOpen(false);
      }
    });
    fabricatorNotesTopicList?.addEventListener('click',event=>{
      if (!event.target.closest('[data-note-topic-id]')) return;
      requestAnimationFrame(()=>setFabricatorNotesTopicsDrawerOpen(false));
    });
    document.addEventListener('keydown',event=>{
      if (event.key==='Escape' && fabricatorNotesTopicsDrawer.classList.contains('open')) setFabricatorNotesTopicsDrawerOpen(false);
    });
  }

  const shiftSchedule=window.FabriCadabraApp?.shiftSchedule || null;
  const shiftClockControl=document.getElementById('shiftClockControl');
  const shiftClockStatus=document.getElementById('shiftClockStatus');
  const shiftClockBtn=document.getElementById('shiftClockBtn');
  const taskLogShiftStatus=document.getElementById('taskLogShiftStatus');

  function shiftTimeFrom24(value) {
    const match=String(value || '').match(/^(\d{2}):(\d{2})$/);
    if (!match) return {time:'',period:'AM'};
    const hour=Number(match[1]);
    const minute=match[2];
    const period=hour>=12?'PM':'AM';
    const displayHour=hour%12 || 12;
    return {time:`${displayHour}:${minute}`,period};
  }

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

  function renderShiftClockUi() {
    if (!shiftSchedule || !shiftClockControl || !shiftClockStatus || !shiftClockBtn || !taskLogShiftStatus) return;
    const state=shiftSchedule.getState();
    const status=shiftSchedule.getStatus();
    shiftClockStatus.textContent=status.header;
    taskLogShiftStatus.textContent=status.task;
    shiftClockBtn.classList.remove('schedule-off','clock-in','clock-out');
    if (!state.enabled) {
      shiftClockBtn.disabled=true;
      shiftClockBtn.classList.add('schedule-off');
      shiftClockBtn.textContent='SHIFT SCHEDULE OFF';
      shiftClockBtn.setAttribute('aria-label','Shift Schedule is disabled');
      return;
    }
    shiftClockBtn.disabled=false;
    if (state.clock.clockedIn) {
      shiftClockBtn.classList.add('clock-out');
      shiftClockBtn.textContent='CLOCK OUT';
      shiftClockBtn.setAttribute('aria-label','Clock out of the current shift');
    } else {
      shiftClockBtn.classList.add('clock-in');
      shiftClockBtn.textContent='CLOCK IN';
      shiftClockBtn.setAttribute('aria-label','Clock in to begin work');
    }
  }

  if (shiftSchedule && shiftClockBtn) {
    shiftClockBtn.addEventListener('click',()=>{
      const state=shiftSchedule.getState();
      if (!state.enabled) return;
      if (state.clock.clockedIn) {
        if (window.confirm('Clock out now? Any running Task Logging timer will stop immediately.')) {
          shiftSchedule.clockOut();
        }
        return;
      }
      const intent=shiftSchedule.getClockInIntent();
      const message=intent.mode==='overtime'
        ? 'Your scheduled shift has ended. Clock in again for overtime? Overtime will continue until you manually clock out.'
        : intent.mode==='unscheduled'
          ? 'Today is not one of your scheduled workdays. Clock in for unscheduled work? This will continue until you manually clock out.'
          : 'Clock in for this shift? Task Logging timers will be available immediately except during enabled Break and Lunch periods. Scheduled Clock Out will still end this clock-in.';
      if (window.confirm(message)) shiftSchedule.clockIn();
    });
    document.addEventListener('fabrication:shift-schedule-change',renderShiftClockUi);
    renderShiftClockUi();
  }

  function currentFeaturesChangelogMarkup() {
    return `
      <article class='changelog-entry changelog-current-features' data-changelog-version='1.0.0'>
        <div class='changelog-entry-heading'>
          <div>
            <span class='changelog-version-label'>Version 1.0.0</span>
            <h2>Fabri-Cadabra — Current Features</h2>
          </div>
        </div>

        <section class='changelog-feature-section'>
          <h3>Task Logging</h3>
          <ul>
            <li>Create and manage jobs.</li>
            <li>Add reusable preset tasks to jobs.</li>
            <li>Select all presets for quick job setup.</li>
            <li>Persistent Start/Stop timers that continue correctly when the phone locks or pages change.</li>
            <li>Automatic task session history.</li>
            <li>Job and task time totals.</li>
            <li>Import/export jobs and presets separately.</li>
            <li>Preset Tasks drawer used to add/remove assigned tasks.</li>
            <li>Collapsible Task Logging Management panel.</li>
          </ul>
        </section>

        <section class='changelog-feature-section'>
          <h3>Fabricator Notes</h3>
          <ul>
            <li>Create and manage note topics.</li>
            <li>Rich-text notes with bold, italic, and underline.</li>
            <li>Automatic local saving.</li>
            <li>Topics drawer inside the note editor.</li>
            <li>Import/export note backups.</li>
            <li>Collapsible Notes Management panel.</li>
          </ul>
        </section>

        <section class='changelog-feature-section'>
          <h3>Checklist</h3>
          <ul>
            <li>Create checklist topics.</li>
            <li>Add, delete, complete, and reorder checklist items.</li>
            <li>Drag/touch reordering.</li>
            <li>Completion progress bar.</li>
            <li>Automatic local saving.</li>
            <li>Import/export checklist backups.</li>
          </ul>
        </section>

        <section class='changelog-feature-section'>
          <h3>Basic Calculator</h3>
          <ul>
            <li>Standard arithmetic.</li>
            <li>Percentages, square roots, powers, π, and rounding.</li>
            <li>Memory functions.</li>
            <li>Repeating operations.</li>
            <li>Keyboard support.</li>
            <li>Built-in Calculator Guide.</li>
          </ul>
        </section>

        <section class='changelog-feature-section'>
          <h3>Quick Reference</h3>
          <ul>
            <li>Fraction addition charts for 1/16&quot;, 1/32&quot;, and 1/64&quot; increments.</li>
            <li>Gauge → Decimal Thickness chart.</li>
            <li>Selectable/highlightable table cells.</li>
            <li>Fraction/decimal display toggle.</li>
            <li>Remembers selected table and display preference.</li>
          </ul>
        </section>

        <section class='changelog-feature-section'>
          <h3>Fastener Spacing</h3>
          <ul>
            <li>Calculates equal fastener spacing.</li>
            <li>Calculates total fastener count.</li>
            <li>Displays fastener locations.</li>
            <li>Measurements rounded to the nearest 1/16&quot;.</li>
            <li>Visual spacing diagram.</li>
          </ul>
        </section>

        <section class='changelog-feature-section'>
          <h3>Sheet Optimizer</h3>
          <ul>
            <li>Whole-job sheet optimization.</li>
            <li>Automatic fabrication allowances by product type.</li>
            <li>Supports .063 Exterior Panels, .063 Door Panels, ACP, Insulation, and Plywood.</li>
            <li>Guillotine/shear-compatible layouts for aluminum and ACP.</li>
            <li>Free-form nesting for insulation and plywood.</li>
            <li>Grain Flow Rotation control.</li>
            <li>Cut List drawer.</li>
            <li>Save/load local jobs.</li>
            <li>Import/export job files.</li>
          </ul>
        </section>

        <section class='changelog-feature-section'>
          <h3>Saw Optimizer</h3>
          <ul>
            <li>Optimize tube/linear stock usage.</li>
            <li>Custom stock lengths.</li>
            <li>Part labels, lengths, and quantities.</li>
            <li>Fixed 1/4&quot; kerf between adjacent pieces.</li>
            <li>Optimized tube diagrams and remaining offcut.</li>
            <li>Individual Cut / Uncut tracking.</li>
            <li>Part List drawer.</li>
            <li>Import/export saw jobs.</li>
          </ul>
        </section>

        <section class='changelog-feature-section'>
          <h3>Aluminum Overhang</h3>
          <ul>
            <li>Calculates long- and short-side blanks.</li>
            <li>Automatically adds corner and seam flanges.</li>
            <li>Automatically splits oversized pieces.</li>
            <li>Enforces maximum usable stock length.</li>
            <li>Displays fabrication rules and cut dimensions.</li>
          </ul>
        </section>

        <section class='changelog-feature-section'>
          <h3>App-Wide Features</h3>
          <ul>
            <li>9 fabrication tools.</li>
            <li>Task Logging opens by default.</li>
            <li>Pages navigation drawer.</li>
            <li>Light and dark themes.</li>
            <li>Persistent local storage.</li>
            <li>Portable JSON import/export.</li>
            <li>Responsive mobile interface.</li>
            <li>Android and iPhone Capacitor apps.</li>
            <li>Permanently signed Android APK builds.</li>
            <li>Unsigned iPhone IPA builds.</li>
            <li>GitHub Pages web deployment.</li>
          </ul>
        </section>
      </article>`;
  }

  function changelogMarkup() {
    return `
      <article class='changelog-entry changelog-release' data-changelog-version='current'>
        <div class='changelog-entry-heading'>
          <div>
            <span class='changelog-version-label'>Version ${FABRI_CADABRA_VERSION}</span>
            <h2>Shift Schedule &amp; Clock Controls</h2>
          </div>
        </div>
        <ul>
          <li>Added Shift Schedule in Settings with an inclusive, cyclic scheduled-workday range plus configurable Clock In, Break, Lunch, and Clock Out times.</li>
          <li>Added a green CLOCK IN button and red CLOCK OUT button in the main Fabri-Cadabra header, with clear confirmation before either clock action.</li>
          <li>When Shift Schedule is enabled, manual Clock In is required before Task Logging timers can start; early or late Clock In is allowed so the schedule does not become a hindrance.</li>
          <li>Break and Lunch can be independently enabled. During an established scheduled shift, each small toggle becomes a current-shift override that resets for the next scheduled shift.</li>
          <li>A running task stops at the exact configured Break or Lunch start. Task timers never restart automatically when Break or Lunch ends; the user deliberately starts the next task session.</li>
          <li>Scheduled Clock Out stops any running task at the exact scheduled boundary and forces Clocked Out state, even when the app was locked, backgrounded, or suspended.</li>
          <li>After scheduled Clock Out, the user can Clock In again for overtime. Overtime continues until the user manually clocks out and does not inherit the already-passed schedule boundaries.</li>
          <li>On a non-scheduled workday, Clock In offers an unscheduled work confirmation. Confirmed unscheduled work continues until manual Clock Out without borrowing another day's Break, Lunch, or Clock Out.</li>
          <li>Supported overnight shifts: the shift belongs to the scheduled day it starts, so a Friday overnight shift may correctly finish Saturday morning.</li>
          <li>When the phone locks, the app backgrounds, or Fabri-Cadabra is reopened, Task Logging reconciles to the first prohibited boundary that was crossed instead of counting time until wake-up.</li>
          <li>Schedule and current-shift override edits are prospective; they do not retroactively erase already-earned labor time.</li>
          <li>Disabling Shift Schedule restores the original unrestricted Task Logging behavior and preserves the saved schedule for later re-enabling.</li>
        </ul>
      </article>
      <article class='changelog-entry changelog-release' data-changelog-version='1.0.1'>
        <div class='changelog-entry-heading'>
          <div>
            <span class='changelog-version-label'>Version 1.0.1</span>
            <h2>Settings &amp; Changelog</h2>
          </div>
        </div>
        <ul>
          <li>Added Settings page.</li>
          <li>Added permanent Settings access at the bottom of the Pages drawer.</li>
          <li>Added in-app Changelog.</li>
          <li>Added application version tracking.</li>
          <li>Established newest-first changelog ordering.</li>
        </ul>
      </article>
      ${currentFeaturesChangelogMarkup()}`;
  }

  function installSettingsPage() {
    if (document.getElementById('tool-settings')) return;
    const appRoot=document.querySelector('main.app');
    const pageMenuDrawer=document.getElementById('pageMenuDrawer');
    const pageMenuBody=pageMenuDrawer?.querySelector('.cut-list-drawer-body');
    const pageMenuBtn=document.getElementById('pageMenuBtn');
    if (!appRoot || !pageMenuDrawer || !pageMenuBody || !pageMenuBtn || !window.FabriCadabraApp) return;

    const settingsPage=document.createElement('section');
    settingsPage.id='tool-settings';
    settingsPage.className='tool-panel settings-page';
    settingsPage.innerHTML=`
      <div class='tool-title'>
        <h2>Settings</h2>
        <p>App information, release history, and Fabri-Cadabra settings.</p>
      </div>
      <details id='shiftScheduleDetails' class='card management-details settings-shift-schedule'>
        <summary class='management-summary'>
          <span>Shift Schedule</span>
          <span id='shiftScheduleMasterState' class='shift-schedule-master-state disabled'>DISABLED</span>
        </summary>
        <div class='management-details-body'>
          <div class='settings-shift-master-row'>
            <div>
              <strong>Enable Shift Schedule</strong>
              <span class='hint'>When enabled, manual Clock In is required and Task Logging follows the scheduled Break, Lunch, and Clock Out protections.</span>
            </div>
            <label class='toggle-switch' for='shiftScheduleMasterToggle'>
              <input id='shiftScheduleMasterToggle' type='checkbox' aria-label='Enable Shift Schedule' />
              <span class='toggle-slider' aria-hidden='true'></span>
            </label>
          </div>

          <div class='settings-shift-form'>
            <div class='settings-shift-row settings-shift-days-row'>
              <label>Scheduled Days</label>
              <div class='settings-shift-fields'>
                <select id='shiftStartDay' aria-label='First scheduled workday'>
                  <option value='0'>Sunday</option><option value='1'>Monday</option><option value='2'>Tuesday</option><option value='3'>Wednesday</option><option value='4'>Thursday</option><option value='5'>Friday</option><option value='6'>Saturday</option>
                </select>
                <span class='settings-shift-through'>through</span>
                <select id='shiftEndDay' aria-label='Last scheduled workday'>
                  <option value='0'>Sunday</option><option value='1'>Monday</option><option value='2'>Tuesday</option><option value='3'>Wednesday</option><option value='4'>Thursday</option><option value='5'>Friday</option><option value='6'>Saturday</option>
                </select>
              </div>
            </div>

            <div class='settings-shift-row'>
              <label for='shiftClockInTime'>Clock In</label>
              <div class='settings-shift-fields settings-shift-time-fields'>
                <input id='shiftClockInTime' type='text' inputmode='numeric' autocomplete='off' placeholder='7:00' aria-label='Clock In time' />
                <select id='shiftClockInPeriod' aria-label='Clock In AM or PM'><option>AM</option><option>PM</option></select>
              </div>
            </div>

            <div class='settings-shift-row settings-shift-pause-row'>
              <div class='settings-shift-pause-label'>
                <label for='shiftBreakTime'>Break</label>
                <label class='toggle-switch compact' for='shiftBreakToggle'>
                  <input id='shiftBreakToggle' type='checkbox' aria-label='Enable Break' />
                  <span class='toggle-slider' aria-hidden='true'></span>
                </label>
              </div>
              <div class='settings-shift-fields settings-shift-pause-fields'>
                <input id='shiftBreakTime' type='text' inputmode='numeric' autocomplete='off' placeholder='9:00' aria-label='Break time' />
                <select id='shiftBreakPeriod' aria-label='Break AM or PM'><option>AM</option><option>PM</option></select>
                <label class='settings-shift-minutes-field'>
                  <span>Length in minutes</span>
                  <input id='shiftBreakMinutes' type='number' inputmode='numeric' min='1' step='1' value='15' aria-label='Break length in minutes' />
                </label>
              </div>
              <span id='shiftBreakModeHint' class='hint settings-shift-mode-hint'>Saved default for future shifts.</span>
            </div>

            <div class='settings-shift-row settings-shift-pause-row'>
              <div class='settings-shift-pause-label'>
                <label for='shiftLunchTime'>Lunch</label>
                <label class='toggle-switch compact' for='shiftLunchToggle'>
                  <input id='shiftLunchToggle' type='checkbox' aria-label='Enable Lunch' />
                  <span class='toggle-slider' aria-hidden='true'></span>
                </label>
              </div>
              <div class='settings-shift-fields settings-shift-pause-fields'>
                <input id='shiftLunchTime' type='text' inputmode='numeric' autocomplete='off' placeholder='12:00' aria-label='Lunch time' />
                <select id='shiftLunchPeriod' aria-label='Lunch AM or PM'><option>AM</option><option>PM</option></select>
                <label class='settings-shift-minutes-field'>
                  <span>Length in minutes</span>
                  <input id='shiftLunchMinutes' type='number' inputmode='numeric' min='1' step='1' value='30' aria-label='Lunch length in minutes' />
                </label>
              </div>
              <span id='shiftLunchModeHint' class='hint settings-shift-mode-hint'>Saved default for future shifts.</span>
            </div>

            <div class='settings-shift-row'>
              <label for='shiftClockOutTime'>Clock Out</label>
              <div class='settings-shift-fields settings-shift-time-fields'>
                <input id='shiftClockOutTime' type='text' inputmode='numeric' autocomplete='off' placeholder='3:30' aria-label='Clock Out time' />
                <select id='shiftClockOutPeriod' aria-label='Clock Out AM or PM'><option>AM</option><option>PM</option></select>
              </div>
            </div>
          </div>

          <div class='settings-shift-actions'>
            <button id='shiftScheduleSaveBtn' class='btn' type='button'>Save Schedule</button>
          </div>
          <div id='shiftScheduleStatus' class='status' role='status' aria-live='polite'></div>
          <span class='hint'>Overnight shifts are supported. The scheduled workday is the day the shift starts. Break and Lunch current-shift overrides reset when that scheduled shift ends.</span>
        </div>
      </details>
      <section class='card settings-overview-card'>
        <h2>Application</h2>
        <div class='settings-version-row'>
          <div>
            <span class='settings-row-label'>Current Version</span>
            <strong id='settingsVersionValue' class='settings-version-value'>${FABRI_CADABRA_VERSION}</strong>
          </div>
          <button id='settingsChangelogBtn' class='btn settings-changelog-btn' type='button' aria-expanded='false' aria-controls='settingsChangelogDrawer'>Changelog</button>
        </div>
      </section>`;
    const footer=appRoot.querySelector(':scope > .footer');
    if (footer) appRoot.insertBefore(settingsPage,footer);
    else appRoot.appendChild(settingsPage);

    const settingsFooter=document.createElement('div');
    settingsFooter.className='fab-settings-drawer-footer';
    const settingsButton=document.createElement('button');
    settingsButton.className='fab-settings-link';
    settingsButton.type='button';
    settingsButton.textContent='Settings';
    settingsButton.setAttribute('aria-controls','tool-settings');
    settingsFooter.appendChild(settingsButton);
    pageMenuBody.appendChild(settingsFooter);

    const changelogBackdrop=document.createElement('div');
    changelogBackdrop.id='settingsChangelogBackdrop';
    changelogBackdrop.className='cut-list-backdrop settings-changelog-backdrop';
    changelogBackdrop.setAttribute('aria-hidden','true');

    const changelogDrawer=document.createElement('aside');
    changelogDrawer.id='settingsChangelogDrawer';
    changelogDrawer.className='cut-list-drawer settings-changelog-drawer';
    changelogDrawer.setAttribute('role','dialog');
    changelogDrawer.setAttribute('aria-modal','true');
    changelogDrawer.setAttribute('aria-hidden','true');
    changelogDrawer.setAttribute('aria-labelledby','settingsChangelogTitle');
    changelogDrawer.innerHTML=`
      <div class='cut-list-drawer-head settings-changelog-head'>
        <strong id='settingsChangelogTitle'>Changelog</strong>
        <span class='cut-list-drawer-meta'>Newest first</span>
        <button id='settingsChangelogCloseBtn' class='cut-list-close-btn' type='button' aria-label='Close Changelog'>×</button>
      </div>
      <div class='cut-list-drawer-body settings-changelog-body'>${changelogMarkup()}</div>`;
    document.body.append(changelogBackdrop,changelogDrawer);

    const changelogButton=document.getElementById('settingsChangelogBtn');
    const changelogCloseBtn=document.getElementById('settingsChangelogCloseBtn');
    const shiftScheduleDetails=document.getElementById('shiftScheduleDetails');
    const shiftScheduleMasterToggle=document.getElementById('shiftScheduleMasterToggle');
    const shiftScheduleMasterState=document.getElementById('shiftScheduleMasterState');
    const shiftStartDay=document.getElementById('shiftStartDay');
    const shiftEndDay=document.getElementById('shiftEndDay');
    const shiftClockInTime=document.getElementById('shiftClockInTime');
    const shiftClockInPeriod=document.getElementById('shiftClockInPeriod');
    const shiftBreakToggle=document.getElementById('shiftBreakToggle');
    const shiftBreakTime=document.getElementById('shiftBreakTime');
    const shiftBreakPeriod=document.getElementById('shiftBreakPeriod');
    const shiftBreakMinutes=document.getElementById('shiftBreakMinutes');
    const shiftBreakModeHint=document.getElementById('shiftBreakModeHint');
    const shiftLunchToggle=document.getElementById('shiftLunchToggle');
    const shiftLunchTime=document.getElementById('shiftLunchTime');
    const shiftLunchPeriod=document.getElementById('shiftLunchPeriod');
    const shiftLunchMinutes=document.getElementById('shiftLunchMinutes');
    const shiftLunchModeHint=document.getElementById('shiftLunchModeHint');
    const shiftClockOutTime=document.getElementById('shiftClockOutTime');
    const shiftClockOutPeriod=document.getElementById('shiftClockOutPeriod');
    const shiftScheduleSaveBtn=document.getElementById('shiftScheduleSaveBtn');
    const shiftScheduleStatus=document.getElementById('shiftScheduleStatus');

    function showShiftScheduleStatus(message,type='ok') {
      if (!shiftScheduleStatus) return;
      shiftScheduleStatus.textContent=message || '';
      shiftScheduleStatus.className=message ? `status show ${type}` : 'status';
    }

    function populateShiftTime(input,period,value) {
      if (!input || !period) return;
      const parsed=shiftTimeFrom24(value);
      input.value=parsed.time;
      period.value=parsed.period;
    }

    function collectShiftScheduleConfig() {
      const state=shiftSchedule.getState();
      const currentOverride=state.runtime?.currentShiftEstablished===true;
      const breakMinutesValue=Number(shiftBreakMinutes.value);
      const lunchMinutesValue=Number(shiftLunchMinutes.value);
      return {
        startDay:Number(shiftStartDay.value),
        endDay:Number(shiftEndDay.value),
        clockIn:shiftTimeTo24(shiftClockInTime.value,shiftClockInPeriod.value) || '',
        break:{
          enabled:currentOverride ? state.config.break.enabled===true : shiftBreakToggle.checked,
          time:shiftTimeTo24(shiftBreakTime.value,shiftBreakPeriod.value) || '',
          durationMinutes:Number.isInteger(breakMinutesValue) && breakMinutesValue>0 ? breakMinutesValue : state.config.break.durationMinutes
        },
        lunch:{
          enabled:currentOverride ? state.config.lunch.enabled===true : shiftLunchToggle.checked,
          time:shiftTimeTo24(shiftLunchTime.value,shiftLunchPeriod.value) || '',
          durationMinutes:Number.isInteger(lunchMinutesValue) && lunchMinutesValue>0 ? lunchMinutesValue : state.config.lunch.durationMinutes
        },
        clockOut:shiftTimeTo24(shiftClockOutTime.value,shiftClockOutPeriod.value) || ''
      };
    }

    function renderShiftScheduleSettings() {
      if (!shiftSchedule || !shiftScheduleMasterToggle) return;
      const state=shiftSchedule.getState();
      shiftScheduleMasterToggle.checked=state.enabled===true;
      shiftScheduleMasterState.textContent=state.enabled?'ENABLED':'DISABLED';
      shiftScheduleMasterState.className=`shift-schedule-master-state ${state.enabled?'enabled':'disabled'}`;
      shiftStartDay.value=String(state.config.startDay);
      shiftEndDay.value=String(state.config.endDay);
      populateShiftTime(shiftClockInTime,shiftClockInPeriod,state.config.clockIn);
      populateShiftTime(shiftBreakTime,shiftBreakPeriod,state.config.break.time);
      populateShiftTime(shiftLunchTime,shiftLunchPeriod,state.config.lunch.time);
      populateShiftTime(shiftClockOutTime,shiftClockOutPeriod,state.config.clockOut);
      shiftBreakMinutes.value=String(state.config.break.durationMinutes || 15);
      shiftLunchMinutes.value=String(state.config.lunch.durationMinutes || 30);
      const currentOverride=state.runtime?.currentShiftEstablished===true;
      shiftBreakToggle.checked=currentOverride ? state.runtime.effectiveBreakEnabled===true : state.config.break.enabled===true;
      shiftLunchToggle.checked=currentOverride ? state.runtime.effectiveLunchEnabled===true : state.config.lunch.enabled===true;
      shiftBreakModeHint.textContent=currentOverride ? 'Current shift override • resets next scheduled shift.' : 'Saved default for future shifts.';
      shiftLunchModeHint.textContent=currentOverride ? 'Current shift override • resets next scheduled shift.' : 'Saved default for future shifts.';
      if (state.runtime?.loadError) showShiftScheduleStatus(state.runtime.loadError,'error');
      else if (state.runtime?.storageError) showShiftScheduleStatus(state.runtime.storageError,'error');
    }

    function saveShiftScheduleFromForm(showSuccess=true) {
      const result=shiftSchedule.saveConfig(collectShiftScheduleConfig());
      if (!result.ok) {
        showShiftScheduleStatus((result.errors || ['Unable to save Shift Schedule.']).join(' '),'error');
        return false;
      }
      if (showSuccess) showShiftScheduleStatus('Shift Schedule saved. Changes apply from this moment forward.','ok');
      return true;
    }

    shiftScheduleSaveBtn?.addEventListener('click',()=>saveShiftScheduleFromForm(true));

    shiftScheduleMasterToggle?.addEventListener('change',()=>{
      const wantsEnabled=shiftScheduleMasterToggle.checked;
      if (wantsEnabled) {
        if (!saveShiftScheduleFromForm(false)) {
          renderShiftScheduleSettings();
          return;
        }
        const warning='Enable Shift Schedule? Manual Clock In becomes required. Active timers stop now. Enabled Break, Lunch, and scheduled Clock Out boundaries will control Task Logging.';
        if (!window.confirm(warning)) {
          renderShiftScheduleSettings();
          return;
        }
        const result=shiftSchedule.setEnabled(true);
        if (!result.ok) showShiftScheduleStatus((result.errors || ['Unable to enable Shift Schedule.']).join(' '),'error');
        else showShiftScheduleStatus('Shift Schedule ENABLED. Clock In before starting Task Logging timers.','ok');
      } else {
        const warning='Disable Shift Schedule? Task Logging returns to unrestricted behavior. Automatic Break, Lunch, Clock Out, and clock-in protection are turned off.';
        if (!window.confirm(warning)) {
          renderShiftScheduleSettings();
          return;
        }
        const result=shiftSchedule.setEnabled(false);
        if (!result.ok) showShiftScheduleStatus((result.errors || ['Unable to disable Shift Schedule.']).join(' '),'error');
        else showShiftScheduleStatus('Shift Schedule DISABLED. Task Logging is unrestricted.','ok');
      }
      renderShiftScheduleSettings();
    });

    shiftBreakToggle?.addEventListener('change',()=>{
      const state=shiftSchedule.getState();
      if (!state.runtime?.currentShiftEstablished) return;
      const result=shiftSchedule.setPauseOverride('break',shiftBreakToggle.checked);
      if (!result.ok) showShiftScheduleStatus(result.error || 'Unable to change the current Break override.','error');
      else showShiftScheduleStatus(`Break is ${shiftBreakToggle.checked?'ON':'OFF'} for the current shift only.`,'ok');
    });

    shiftLunchToggle?.addEventListener('change',()=>{
      const state=shiftSchedule.getState();
      if (!state.runtime?.currentShiftEstablished) return;
      const result=shiftSchedule.setPauseOverride('lunch',shiftLunchToggle.checked);
      if (!result.ok) showShiftScheduleStatus(result.error || 'Unable to change the current Lunch override.','error');
      else showShiftScheduleStatus(`Lunch is ${shiftLunchToggle.checked?'ON':'OFF'} for the current shift only.`,'ok');
    });

    if (shiftScheduleDetails && shiftSchedule) {
      document.addEventListener('fabrication:shift-schedule-change',renderShiftScheduleSettings);
      renderShiftScheduleSettings();
    }

    const originalGetActiveTool=window.FabriCadabraApp.getActiveTool.bind(window.FabriCadabraApp);
    let settingsOpen=false;

    function openSettingsPage() {
      settingsOpen=true;
      document.querySelectorAll('.tool-panel').forEach(panel=>panel.classList.toggle('active',panel===settingsPage));
      document.querySelectorAll('.fab-page-link').forEach(link=>link.classList.remove('active'));
      settingsButton.classList.add('active');
      window.FabriCadabraApp.closeDrawer('pageMenuDrawer',pageMenuBtn);
      pageMenuBtn.setAttribute('aria-expanded','false');
      window.scrollTo({top:0,behavior:'smooth'});
    }

    function setSettingsChangelogOpen(open) {
      if (!changelogButton) return;
      if (open) window.FabriCadabraApp.openDrawer('settingsChangelogDrawer',changelogButton);
      else window.FabriCadabraApp.closeDrawer('settingsChangelogDrawer',changelogButton);
      changelogButton.setAttribute('aria-expanded',open?'true':'false');
    }

    window.FabriCadabraApp.version=FABRI_CADABRA_VERSION;
    window.FabriCadabraApp.getActiveTool=()=>settingsOpen?'settings':originalGetActiveTool();

    settingsButton.addEventListener('click',openSettingsPage);
    pageMenuDrawer.addEventListener('click',event=>{
      const normalPage=event.target.closest('.fab-page-link');
      if (!normalPage) return;
      settingsOpen=false;
      settingsPage.classList.remove('active');
      settingsButton.classList.remove('active');
    });

    changelogButton?.addEventListener('click',()=>setSettingsChangelogOpen(!changelogDrawer.classList.contains('open')));
    changelogCloseBtn?.addEventListener('click',()=>setSettingsChangelogOpen(false));
    changelogBackdrop.addEventListener('click',()=>setSettingsChangelogOpen(false));
    changelogDrawer.addEventListener('keydown',event=>{
      if (event.key==='Escape') {
        event.preventDefault();
        setSettingsChangelogOpen(false);
      }
    });
    document.addEventListener('keydown',event=>{
      if (event.key==='Escape' && changelogDrawer.classList.contains('open')) setSettingsChangelogOpen(false);
    });
  }

  installSettingsPage();
})();
