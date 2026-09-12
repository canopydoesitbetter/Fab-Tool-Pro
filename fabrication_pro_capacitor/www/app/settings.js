  // ---------------- Canonical Notes / Settings / Shift UI ----------------
  const fabricatorNotesTopicsBtnCanonical=document.getElementById('fabricatorNotesTopicsBtn');
  const fabricatorNotesTopicsDrawerCanonical=document.getElementById('fabricatorNotesTopicsDrawer');
  const fabricatorNotesTopicsBackdropCanonical=document.getElementById('fabricatorNotesTopicsBackdrop');
  const fabricatorNotesTopicsCloseBtnCanonical=document.getElementById('fabricatorNotesTopicsCloseBtn');

  function setFabricatorNotesTopicsDrawerOpen(open) {
    if (!fabricatorNotesTopicsBtnCanonical) return;
    if (open) openDrawer('fabricatorNotesTopicsDrawer',fabricatorNotesTopicsBtnCanonical);
    else closeDrawer('fabricatorNotesTopicsDrawer',fabricatorNotesTopicsBtnCanonical);
    fabricatorNotesTopicsBtnCanonical.setAttribute('aria-expanded',open?'true':'false');
  }

  fabricatorNotesTopicsBtnCanonical?.addEventListener('click',()=>setFabricatorNotesTopicsDrawerOpen(!isDrawerOpen('fabricatorNotesTopicsDrawer')));
  fabricatorNotesTopicsCloseBtnCanonical?.addEventListener('click',()=>setFabricatorNotesTopicsDrawerOpen(false));
  fabricatorNotesTopicsBackdropCanonical?.addEventListener('click',()=>setFabricatorNotesTopicsDrawerOpen(false));
  fabricatorNotesTopicsDrawerCanonical?.addEventListener('keydown',event=>{
    if (event.key==='Escape') {
      event.preventDefault();
      setFabricatorNotesTopicsDrawerOpen(false);
    }
  });
  fabricatorNotesTopicList?.addEventListener('click',event=>{
    if (event.target.closest('[data-note-topic-id]')) requestAnimationFrame(()=>setFabricatorNotesTopicsDrawerOpen(false));
  });

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

  // @shift-smart-time-start
  function normalizeShiftTimeEntry(value) {
    const raw=String(value ?? '').trim();
    if (!raw) return null;
    let hourText='';
    let minuteText='';
    const colonMatch=raw.match(/^(\d{1,2}):(\d{2})$/);
    if (colonMatch) {
      hourText=colonMatch[1];
      minuteText=colonMatch[2];
    } else if (/^\d{1,4}$/.test(raw)) {
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
    const match=normalized.match(/^(\d{1,2}):(\d{2})$/);
    let hour=Number(match[1]);
    const minute=Number(match[2]);
    if (period==='AM') hour=hour===12?0:hour;
    else if (period==='PM') hour=hour===12?12:hour+12;
    else return null;
    return `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
  }
  // @shift-smart-time-end

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
    shiftClockBtn.addEventListener('click',async ()=>{
      const state=shiftSchedule.getState();
      if (!state.enabled) return;
      if (state.clock.clockedIn) {
        if (await confirmAppAction('Clock out now? Any running Task Logging timer will stop immediately.')) {
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
      if (await confirmAppAction(message)) shiftSchedule.clockIn();
    });
    document.addEventListener('fabrication:shift-schedule-change',renderShiftClockUi);
    renderShiftClockUi();
  }


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

  function bindShiftSmartTimeInput(input) {
    if (!input) return;
    input.addEventListener('input',()=>{
      const raw=String(input.value || '');
      const clean=raw.replace(/[^\d:]/g,'').slice(0,5);
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

  shiftScheduleMasterToggle?.addEventListener('change',async ()=>{
    const wantsEnabled=shiftScheduleMasterToggle.checked;
    if (wantsEnabled) {
      if (!saveShiftScheduleFromForm(false)) {
        renderShiftScheduleSettings();
        return;
      }
      const warning='Enable Shift Schedule? Manual Clock In becomes required. Active timers stop now. Enabled Break, Lunch, and scheduled Clock Out boundaries will control Task Logging.';
      if (!await confirmAppAction(warning)) {
        renderShiftScheduleSettings();
        return;
      }
      const result=shiftSchedule.setEnabled(true);
      if (!result.ok) showShiftScheduleStatus((result.errors || ['Unable to enable Shift Schedule.']).join(' '),'error');
      else showShiftScheduleStatus('Shift Schedule ENABLED. Clock In before starting Task Logging timers.','ok');
    } else {
      const warning='Disable Shift Schedule? Task Logging returns to unrestricted behavior. Automatic Break, Lunch, Clock Out, and clock-in protection are turned off.';
      if (!await confirmAppAction(warning)) {
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
    if (!result.ok) {
      showShiftScheduleStatus(result.error || 'Unable to change the current Break override.','error');
      renderShiftScheduleSettings();
    } else showShiftScheduleStatus(`Break is ${shiftBreakToggle.checked?'ON':'OFF'} for the current shift only.`,'ok');
  });

  shiftLunchToggle?.addEventListener('change',()=>{
    const state=shiftSchedule.getState();
    if (!state.runtime?.currentShiftEstablished) return;
    const result=shiftSchedule.setPauseOverride('lunch',shiftLunchToggle.checked);
    if (!result.ok) {
      showShiftScheduleStatus(result.error || 'Unable to change the current Lunch override.','error');
      renderShiftScheduleSettings();
    } else showShiftScheduleStatus(`Lunch is ${shiftLunchToggle.checked?'ON':'OFF'} for the current shift only.`,'ok');
  });

  if (shiftScheduleDetails && shiftSchedule) {
    document.addEventListener('fabrication:shift-schedule-change',renderShiftScheduleSettings);
    renderShiftScheduleSettings();
  }

  const settingsVersionValue=document.getElementById('settingsVersionValue');
  const settingsCurrentChangelogVersion=document.getElementById('settingsCurrentChangelogVersion');
  if (settingsVersionValue) settingsVersionValue.textContent=FABRI_CADABRA_VERSION;
  if (settingsCurrentChangelogVersion) settingsCurrentChangelogVersion.textContent=`Version ${FABRI_CADABRA_VERSION}`;

  const settingsChangelogBackdrop=document.getElementById('settingsChangelogBackdrop');
  const settingsChangelogDrawer=document.getElementById('settingsChangelogDrawer');
  function setSettingsChangelogOpen(open) {
    if (!changelogButton || !settingsChangelogDrawer) return;
    if (open) openDrawer('settingsChangelogDrawer',changelogButton);
    else closeDrawer('settingsChangelogDrawer',changelogButton);
    changelogButton.setAttribute('aria-expanded',open?'true':'false');
  }
  changelogButton?.addEventListener('click',()=>setSettingsChangelogOpen(!isDrawerOpen('settingsChangelogDrawer')));
  changelogCloseBtn?.addEventListener('click',()=>setSettingsChangelogOpen(false));
  settingsChangelogBackdrop?.addEventListener('click',()=>setSettingsChangelogOpen(false));
  settingsChangelogDrawer?.addEventListener('keydown',event=>{
    if (event.key==='Escape') {
      event.preventDefault();
      setSettingsChangelogOpen(false);
    }
  });
