  const SHIFT_SCHEDULE_KEY = 'fabricationShiftScheduleV1';
  const SHIFT_SCHEDULE_FORMAT = 'FabricationShiftSchedule';
  const SHIFT_SCHEDULE_VERSION = 1;
  let shiftScheduleLoadError='';
  let shiftScheduleStorageError='';

  function defaultShiftScheduleConfig() {
    return {
      startDay:1,
      endDay:5,
      clockIn:'',
      break:{enabled:false,time:'',durationMinutes:15},
      lunch:{enabled:false,time:'',durationMinutes:30},
      clockOut:''
    };
  }

  function defaultShiftScheduleState() {
    return {
      format:SHIFT_SCHEDULE_FORMAT,
      version:SHIFT_SCHEDULE_VERSION,
      enabled:false,
      config:defaultShiftScheduleConfig(),
      clock:{clockedIn:false,clockedInAt:null,mode:null,shiftId:null},
      pauseOverrides:{shiftId:null,breakEnabled:null,lunchEnabled:null},
      policyEffectiveAt:0
    };
  }

  function normalizeShiftScheduleConfig(raw) {
    const base=defaultShiftScheduleConfig();
    const startDay=Number(raw?.startDay);
    const endDay=Number(raw?.endDay);
    const breakMinutes=Number(raw?.break?.durationMinutes);
    const lunchMinutes=Number(raw?.lunch?.durationMinutes);
    return {
      startDay:Number.isInteger(startDay) && startDay>=0 && startDay<=6 ? startDay : base.startDay,
      endDay:Number.isInteger(endDay) && endDay>=0 && endDay<=6 ? endDay : base.endDay,
      clockIn:typeof raw?.clockIn==='string' ? raw.clockIn : base.clockIn,
      break:{
        enabled:raw?.break?.enabled===true,
        time:typeof raw?.break?.time==='string' ? raw.break.time : base.break.time,
        durationMinutes:Number.isInteger(breakMinutes) && breakMinutes>0 ? breakMinutes : base.break.durationMinutes
      },
      lunch:{
        enabled:raw?.lunch?.enabled===true,
        time:typeof raw?.lunch?.time==='string' ? raw.lunch.time : base.lunch.time,
        durationMinutes:Number.isInteger(lunchMinutes) && lunchMinutes>0 ? lunchMinutes : base.lunch.durationMinutes
      },
      clockOut:typeof raw?.clockOut==='string' ? raw.clockOut : base.clockOut
    };
  }

  function normalizeShiftScheduleState(raw) {
    if (!raw || typeof raw!=='object' || Array.isArray(raw)) return defaultShiftScheduleState();
    if (raw.format && raw.format!==SHIFT_SCHEDULE_FORMAT) throw new Error('Saved Shift Schedule data has an unsupported format.');
    const version=Number(raw.version || 1);
    if (!Number.isInteger(version) || version<1 || version>SHIFT_SCHEDULE_VERSION) throw new Error('Saved Shift Schedule data was created by an unsupported app version.');
    const state=defaultShiftScheduleState();
    state.config=normalizeShiftScheduleConfig(raw.config || raw);
    state.enabled=raw.enabled===true;
    const clock=raw.clock && typeof raw.clock==='object' ? raw.clock : {};
    const mode=['scheduled','overtime','unscheduled'].includes(clock.mode) ? clock.mode : null;
    const clockedIn=clock.clockedIn===true && !!mode;
    state.clock={
      clockedIn,
      clockedInAt:clockedIn && Number.isFinite(Number(clock.clockedInAt)) ? Number(clock.clockedInAt) : null,
      mode:clockedIn ? mode : null,
      shiftId:typeof clock.shiftId==='string' && /^\d{4}-\d{2}-\d{2}$/.test(clock.shiftId) ? clock.shiftId : null
    };
    const overrides=raw.pauseOverrides && typeof raw.pauseOverrides==='object' ? raw.pauseOverrides : {};
    state.pauseOverrides={
      shiftId:typeof overrides.shiftId==='string' && /^\d{4}-\d{2}-\d{2}$/.test(overrides.shiftId) ? overrides.shiftId : null,
      breakEnabled:typeof overrides.breakEnabled==='boolean' ? overrides.breakEnabled : null,
      lunchEnabled:typeof overrides.lunchEnabled==='boolean' ? overrides.lunchEnabled : null
    };
    state.policyEffectiveAt=Number.isFinite(Number(raw.policyEffectiveAt)) && Number(raw.policyEffectiveAt)>=0 ? Number(raw.policyEffectiveAt) : 0;
    if (state.enabled && !validateShiftScheduleConfig(state.config).ok) {
      state.enabled=false;
      state.clock={clockedIn:false,clockedInAt:null,mode:null,shiftId:null};
      state.pauseOverrides={shiftId:null,breakEnabled:null,lunchEnabled:null};
      shiftScheduleLoadError='The saved Shift Schedule was invalid, so protection was turned off. Review and save the schedule before enabling it again.';
    }
    return state;
  }

  function loadShiftScheduleState() {
    shiftScheduleLoadError='';
    const raw=storageGet(SHIFT_SCHEDULE_KEY);
    if (!raw) return defaultShiftScheduleState();
    try {
      return normalizeShiftScheduleState(JSON.parse(raw));
    } catch (error) {
      shiftScheduleLoadError=error.message || 'Saved Shift Schedule data could not be read, so protection was turned off.';
      return defaultShiftScheduleState();
    }
  }

  let shiftScheduleState=loadShiftScheduleState();

  function persistShiftScheduleState() {
    try {
      localStorage.setItem(SHIFT_SCHEDULE_KEY,JSON.stringify(shiftScheduleState));
      shiftScheduleStorageError='';
      return true;
    } catch (error) {
      shiftScheduleStorageError='This browser could not save Shift Schedule settings locally.';
      return false;
    }
  }

  function cloneShiftValue(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function shiftInstanceFromId(shiftId,config=shiftScheduleState.config) {
    const match=String(shiftId || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const anchor=new Date(Number(match[1]),Number(match[2])-1,Number(match[3]),0,0,0,0);
    if (anchor.getFullYear()!==Number(match[1]) || anchor.getMonth()!==Number(match[2])-1 || anchor.getDate()!==Number(match[3])) return null;
    return buildShiftInstance(anchor.getTime(),config);
  }

  function shiftAnchorDayIsScheduled(shift,config=shiftScheduleState.config) {
    if (!shift) return false;
    return shiftDayRangeIncludes(new Date(shift.anchorDateMs).getDay(),Number(config.startDay),Number(config.endDay));
  }

  function shiftPauseEnabled(kind,shift) {
    const key=kind==='break'?'breakEnabled':'lunchEnabled';
    const configKey=kind==='break'?'break':'lunch';
    if (shiftScheduleState.pauseOverrides.shiftId===shift?.id && typeof shiftScheduleState.pauseOverrides[key]==='boolean') {
      return shiftScheduleState.pauseOverrides[key];
    }
    return shiftScheduleState.config[configKey]?.enabled===true;
  }

  function shiftCurrentEstablishedInstance(nowMs=Date.now()) {
    const id=shiftScheduleState.clock.shiftId || shiftScheduleState.pauseOverrides.shiftId;
    const shift=shiftInstanceFromId(id);
    if (!shift || Number(nowMs)>=shift.endMs) return null;
    return shift;
  }

  function clearExpiredShiftOverrides(nowMs=Date.now()) {
    const id=shiftScheduleState.pauseOverrides.shiftId;
    if (!id) return false;
    const shift=shiftInstanceFromId(id);
    if (!shift || Number(nowMs)>=shift.endMs) {
      shiftScheduleState.pauseOverrides={shiftId:null,breakEnabled:null,lunchEnabled:null};
      return true;
    }
    return false;
  }

  function formatShiftClockMoment(value) {
    const d=new Date(Number(value));
    if (!Number.isFinite(d.getTime())) return '';
    return d.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});
  }

  function getShiftTaskPermission(nowMs=Date.now()) {
    if (!shiftScheduleState.enabled) return {allowed:true,reason:''};
    if (!shiftScheduleState.clock.clockedIn) return {allowed:false,reason:'Clock In is required before starting a Task Logging timer.'};
    if (shiftScheduleState.clock.mode==='overtime' || shiftScheduleState.clock.mode==='unscheduled') return {allowed:true,reason:''};
    if (shiftScheduleState.clock.mode!=='scheduled') return {allowed:false,reason:'Clock In is required before starting a Task Logging timer.'};
    const shift=shiftInstanceFromId(shiftScheduleState.clock.shiftId);
    if (!shift || !shiftAnchorDayIsScheduled(shift)) return {allowed:false,reason:'The scheduled shift changed. Clock Out and Clock In again before starting another task.'};
    const now=Number(nowMs);
    if (now>=shift.endMs) return {allowed:false,reason:'Scheduled shift has ended. Clock In again for overtime if work is continuing.'};
    if (shiftPauseEnabled('break',shift) && shift.breakWindow && now>=shift.breakWindow.startMs && now<shift.breakWindow.endMs) {
      return {allowed:false,reason:`Break is in progress until ${formatShiftClockMoment(shift.breakWindow.endMs)}.`};
    }
    if (shiftPauseEnabled('lunch',shift) && shift.lunchWindow && now>=shift.lunchWindow.startMs && now<shift.lunchWindow.endMs) {
      return {allowed:false,reason:`Lunch is in progress until ${formatShiftClockMoment(shift.lunchWindow.endMs)}.`};
    }
    return {allowed:true,reason:''};
  }

  function getShiftScheduleStatus(nowMs=Date.now()) {
    if (!shiftScheduleState.enabled) return {code:'disabled',header:'Shift Schedule Off',task:'Shift Schedule Off',clockedIn:false};
    if (!shiftScheduleState.clock.clockedIn) return {code:'clocked-out',header:'Clocked Out',task:'Shift: Clocked Out',clockedIn:false};
    if (shiftScheduleState.clock.mode==='overtime') return {code:'overtime',header:'Overtime • Clocked In',task:'Overtime',clockedIn:true};
    if (shiftScheduleState.clock.mode==='unscheduled') return {code:'unscheduled',header:'Unscheduled • Clocked In',task:'Unscheduled work',clockedIn:true};
    const shift=shiftInstanceFromId(shiftScheduleState.clock.shiftId);
    if (!shift) return {code:'clocked-out',header:'Clocked Out',task:'Shift: Clocked Out',clockedIn:false};
    const now=Number(nowMs);
    if (now>=shift.endMs) return {code:'ended',header:'Scheduled shift ended',task:'Shift ended • Clock In for overtime',clockedIn:false};
    if (shiftPauseEnabled('break',shift) && shift.breakWindow && now>=shift.breakWindow.startMs && now<shift.breakWindow.endMs) {
      return {code:'break',header:'Break • Clocked In',task:`Break until ${formatShiftClockMoment(shift.breakWindow.endMs)}`,clockedIn:true};
    }
    if (shiftPauseEnabled('lunch',shift) && shift.lunchWindow && now>=shift.lunchWindow.startMs && now<shift.lunchWindow.endMs) {
      return {code:'lunch',header:'Lunch • Clocked In',task:`Lunch until ${formatShiftClockMoment(shift.lunchWindow.endMs)}`,clockedIn:true};
    }
    return {code:'working',header:`Clocked In • ${formatShiftClockMoment(shiftScheduleState.clock.clockedInAt)}`,task:'Shift: Working',clockedIn:true};
  }

  function getShiftClockInIntent(nowMs=Date.now()) {
    const now=Number(nowMs);
    const intent=classifyShiftClockIn(now,shiftScheduleState.config);
    const previousId=shiftScheduleState.clock.shiftId;
    if (previousId) {
      const previousShift=shiftInstanceFromId(previousId);
      if (previousShift && now>=previousShift.endMs) {
        const nowDate=shiftDateId(shiftLocalMidnight(now));
        const endDate=shiftDateId(shiftLocalMidnight(previousShift.endMs));
        const upcomingScheduled=intent.mode==='scheduled' && intent.shift && now<intent.shift.startMs;
        if (nowDate===endDate && (intent.mode!=='scheduled' || upcomingScheduled)) {
          return {mode:'overtime',shift:null,warning:'scheduled-ended'};
        }
      }
    }
    return intent;
  }

  function getShiftScheduleState(nowMs=Date.now()) {
    const copy=cloneShiftValue(shiftScheduleState);
    const established=shiftCurrentEstablishedInstance(nowMs);
    copy.runtime={
      currentShiftEstablished:!!established,
      currentShiftId:established?.id || null,
      effectiveBreakEnabled:established ? shiftPauseEnabled('break',established) : copy.config.break.enabled===true,
      effectiveLunchEnabled:established ? shiftPauseEnabled('lunch',established) : copy.config.lunch.enabled===true,
      loadError:shiftScheduleLoadError,
      storageError:shiftScheduleStorageError
    };
    return copy;
  }

  function dispatchShiftScheduleChange(render=true) {
    if (render && typeof renderTaskLogging==='function') renderTaskLogging();
    document.dispatchEvent(new CustomEvent('fabrication:shift-schedule-change',{
      detail:{state:getShiftScheduleState(),status:getShiftScheduleStatus()}
    }));
  }

  function stopRunningTaskAt(nowMs) {
    const running=findRunningTaskLogTask();
    if (!running) return false;
    if (!stopTaskLogTask(running.job,running.task,Number(nowMs))) return false;
    persistTaskLogJobs(true);
    return true;
  }

  function reconcileShiftSchedule(nowMs=Date.now()) {
    const now=Number(nowMs);
    if (!Number.isFinite(now)) return {changed:false,taskStopped:false};
    let changed=false;
    let taskStopped=false;

    if (clearExpiredShiftOverrides(now)) changed=true;
    if (!shiftScheduleState.enabled) {
      if (changed) { persistShiftScheduleState(); dispatchShiftScheduleChange(false); }
      return {changed,taskStopped};
    }

    if (shiftScheduleState.clock.clockedIn && shiftScheduleState.clock.mode==='scheduled') {
      const shift=shiftInstanceFromId(shiftScheduleState.clock.shiftId);
      if (!shift || !shiftAnchorDayIsScheduled(shift)) {
        taskStopped=stopRunningTaskAt(now) || taskStopped;
        shiftScheduleState.clock={clockedIn:false,clockedInAt:null,mode:null,shiftId:shiftScheduleState.clock.shiftId};
        changed=true;
      } else {
        const running=findRunningTaskLogTask();
        if (running) {
          const boundary=firstShiftProhibitedBoundary(Number(running.task.startedAt),now,shift,{
            breakEnabled:shiftPauseEnabled('break',shift),
            lunchEnabled:shiftPauseEnabled('lunch',shift),
            policyEffectiveAt:shiftScheduleState.policyEffectiveAt
          });
          if (boundary!==null) {
            taskStopped=stopTaskLogTask(running.job,running.task,boundary) || taskStopped;
            if (taskStopped) persistTaskLogJobs(true);
          }
        }
        if (now>=shift.endMs) {
          shiftScheduleState.clock={clockedIn:false,clockedInAt:null,mode:null,shiftId:shift.id};
          if (shiftScheduleState.pauseOverrides.shiftId===shift.id) shiftScheduleState.pauseOverrides={shiftId:null,breakEnabled:null,lunchEnabled:null};
          changed=true;
        }
      }
    }

    if (changed) persistShiftScheduleState();
    if (changed || taskStopped) dispatchShiftScheduleChange(true);
    return {changed,taskStopped};
  }

  function saveShiftScheduleConfig(config,nowMs=Date.now()) {
    const validation=validateShiftScheduleConfig(config);
    if (!validation.ok) return {ok:false,errors:validation.errors};
    const now=Number(nowMs);
    reconcileShiftSchedule(now);
    shiftScheduleState.config=cloneShiftValue(validation.config);
    shiftScheduleState.policyEffectiveAt=now;

    if (shiftScheduleState.enabled && shiftScheduleState.clock.clockedIn && shiftScheduleState.clock.mode==='scheduled') {
      const shift=shiftInstanceFromId(shiftScheduleState.clock.shiftId,shiftScheduleState.config);
      if (!shift || !shiftAnchorDayIsScheduled(shift,shiftScheduleState.config) || now>=shift.endMs) {
        stopRunningTaskAt(now);
        shiftScheduleState.clock={clockedIn:false,clockedInAt:null,mode:null,shiftId:shift?.id || shiftScheduleState.clock.shiftId};
        shiftScheduleState.pauseOverrides={shiftId:null,breakEnabled:null,lunchEnabled:null};
      } else {
        const permission=getShiftTaskPermission(now);
        if (!permission.allowed) stopRunningTaskAt(now);
      }
    }
    shiftScheduleLoadError='';
    const saved=persistShiftScheduleState();
    dispatchShiftScheduleChange(true);
    return saved ? {ok:true,errors:[]} : {ok:false,errors:[shiftScheduleStorageError]};
  }

  function setShiftScheduleEnabled(enabled,nowMs=Date.now()) {
    const next=enabled===true;
    const now=Number(nowMs);
    if (next) {
      const validation=validateShiftScheduleConfig(shiftScheduleState.config);
      if (!validation.ok) return {ok:false,errors:validation.errors};
      if (shiftScheduleState.enabled) return {ok:true,errors:[]};
      stopRunningTaskAt(now);
      shiftScheduleState.enabled=true;
      shiftScheduleState.clock={clockedIn:false,clockedInAt:null,mode:null,shiftId:null};
      shiftScheduleState.pauseOverrides={shiftId:null,breakEnabled:null,lunchEnabled:null};
      shiftScheduleState.policyEffectiveAt=now;
    } else {
      if (!shiftScheduleState.enabled) return {ok:true,errors:[]};
      reconcileShiftSchedule(now);
      shiftScheduleState.enabled=false;
      shiftScheduleState.clock={clockedIn:false,clockedInAt:null,mode:null,shiftId:null};
      shiftScheduleState.pauseOverrides={shiftId:null,breakEnabled:null,lunchEnabled:null};
      shiftScheduleState.policyEffectiveAt=now;
    }
    const saved=persistShiftScheduleState();
    dispatchShiftScheduleChange(true);
    return saved ? {ok:true,errors:[]} : {ok:false,errors:[shiftScheduleStorageError]};
  }

  function clockInShiftSchedule(nowMs=Date.now()) {
    const now=Number(nowMs);
    if (!shiftScheduleState.enabled) return {ok:false,error:'Shift Schedule is disabled.'};
    reconcileShiftSchedule(now);
    if (shiftScheduleState.clock.clockedIn) return {ok:true,mode:shiftScheduleState.clock.mode};
    const intent=getShiftClockInIntent(now);
    if (intent.mode==='scheduled') {
      const preserve=shiftScheduleState.pauseOverrides.shiftId===intent.shift.id;
      shiftScheduleState.clock={clockedIn:true,clockedInAt:now,mode:'scheduled',shiftId:intent.shift.id};
      if (!preserve) shiftScheduleState.pauseOverrides={shiftId:intent.shift.id,breakEnabled:null,lunchEnabled:null};
    } else {
      shiftScheduleState.clock={clockedIn:true,clockedInAt:now,mode:intent.mode,shiftId:null};
      shiftScheduleState.pauseOverrides={shiftId:null,breakEnabled:null,lunchEnabled:null};
    }
    const saved=persistShiftScheduleState();
    dispatchShiftScheduleChange(true);
    return saved ? {ok:true,mode:intent.mode} : {ok:false,error:shiftScheduleStorageError};
  }

  function clockOutShiftSchedule(nowMs=Date.now()) {
    const now=Number(nowMs);
    if (!shiftScheduleState.enabled || !shiftScheduleState.clock.clockedIn) return {ok:false,error:'There is no active Shift Schedule clock-in.'};
    reconcileShiftSchedule(now);
    if (!shiftScheduleState.clock.clockedIn) return {ok:true};
    const mode=shiftScheduleState.clock.mode;
    const shiftId=shiftScheduleState.clock.shiftId;
    stopRunningTaskAt(now);
    let keepShiftId=null;
    if (mode==='scheduled' && shiftId) {
      const shift=shiftInstanceFromId(shiftId);
      if (shift && now<shift.endMs) keepShiftId=shiftId;
    }
    shiftScheduleState.clock={clockedIn:false,clockedInAt:null,mode:null,shiftId:keepShiftId};
    if (!keepShiftId) shiftScheduleState.pauseOverrides={shiftId:null,breakEnabled:null,lunchEnabled:null};
    const saved=persistShiftScheduleState();
    dispatchShiftScheduleChange(true);
    return saved ? {ok:true} : {ok:false,error:shiftScheduleStorageError};
  }

  function setShiftPauseOverride(kind,enabled,nowMs=Date.now()) {
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

  window.FabriCadabraApp.shiftSchedule={
    getState:getShiftScheduleState,
    getStatus:getShiftScheduleStatus,
    getClockInIntent:getShiftClockInIntent,
    saveConfig:saveShiftScheduleConfig,
    setEnabled:setShiftScheduleEnabled,
    clockIn:clockInShiftSchedule,
    clockOut:clockOutShiftSchedule,
    setPauseOverride:setShiftPauseOverride,
    getTaskPermission:getShiftTaskPermission,
    reconcile:reconcileShiftSchedule
  };
