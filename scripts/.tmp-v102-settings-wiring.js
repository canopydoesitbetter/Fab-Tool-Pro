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
