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
