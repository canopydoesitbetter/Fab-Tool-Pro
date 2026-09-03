// @shift-schedule-core-start
function parseShiftWallTime(value) {
  const match=String(value ?? '').trim().match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hour=Number(match[1]);
  const minute=Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour<0 || hour>23 || minute<0 || minute>59) return null;
  return hour*60+minute;
}

function shiftDayRangeIncludes(day,startDay,endDay) {
  if (![day,startDay,endDay].every(Number.isInteger) || day<0 || day>6 || startDay<0 || startDay>6 || endDay<0 || endDay>6) return false;
  if (startDay===endDay) return day===startDay;
  return startDay<endDay ? day>=startDay && day<=endDay : day>=startDay || day<=endDay;
}

function shiftLocalMidnight(value) {
  const d=new Date(Number(value));
  if (!Number.isFinite(d.getTime())) return null;
  return new Date(d.getFullYear(),d.getMonth(),d.getDate(),0,0,0,0).getTime();
}

function shiftDateId(value) {
  const d=new Date(Number(value));
  if (!Number.isFinite(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function shiftCalendarMs(anchorDateMs,dayOffset,minuteOfDay) {
  const anchor=new Date(Number(anchorDateMs));
  if (!Number.isFinite(anchor.getTime()) || !Number.isFinite(minuteOfDay)) return null;
  const hour=Math.floor(minuteOfDay/60);
  const minute=minuteOfDay%60;
  return new Date(anchor.getFullYear(),anchor.getMonth(),anchor.getDate()+dayOffset,hour,minute,0,0).getTime();
}

function shiftPauseWindow(anchorDateMs,config,pause) {
  if (!pause || pause.enabled!==true) return null;
  const clockInMinutes=parseShiftWallTime(config?.clockIn);
  const clockOutMinutes=parseShiftWallTime(config?.clockOut);
  const pauseMinutes=parseShiftWallTime(pause.time);
  const durationMinutes=Number(pause.durationMinutes);
  if (clockInMinutes===null || clockOutMinutes===null || pauseMinutes===null || !Number.isInteger(durationMinutes) || durationMinutes<=0) return null;
  const overnight=clockOutMinutes<clockInMinutes;
  const dayOffset=overnight && pauseMinutes<clockInMinutes ? 1 : 0;
  const startMs=shiftCalendarMs(anchorDateMs,dayOffset,pauseMinutes);
  if (!Number.isFinite(startMs)) return null;
  return {startMs,endMs:startMs+durationMinutes*60000};
}

function buildShiftInstance(anchorDateMs,config) {
  const midnight=shiftLocalMidnight(anchorDateMs);
  const clockInMinutes=parseShiftWallTime(config?.clockIn);
  const clockOutMinutes=parseShiftWallTime(config?.clockOut);
  if (midnight===null || clockInMinutes===null || clockOutMinutes===null || clockInMinutes===clockOutMinutes) return null;
  const overnight=clockOutMinutes<clockInMinutes;
  const startMs=shiftCalendarMs(midnight,0,clockInMinutes);
  const endMs=shiftCalendarMs(midnight,overnight?1:0,clockOutMinutes);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs<=startMs) return null;
  return {
    id:shiftDateId(midnight),
    anchorDateMs:midnight,
    startMs,
    endMs,
    breakWindow:shiftPauseWindow(midnight,config,config?.break),
    lunchWindow:shiftPauseWindow(midnight,config,config?.lunch)
  };
}

function findApplicableScheduledShift(nowMs,config) {
  const now=Number(nowMs);
  if (!Number.isFinite(now)) return null;
  const todayMs=shiftLocalMidnight(now);
  if (todayMs===null) return null;
  const today=new Date(todayMs);
  const previousMs=new Date(today.getFullYear(),today.getMonth(),today.getDate()-1,0,0,0,0).getTime();
  const inMinutes=parseShiftWallTime(config?.clockIn);
  const outMinutes=parseShiftWallTime(config?.clockOut);
  const overnight=inMinutes!==null && outMinutes!==null && outMinutes<inMinutes;
  if (overnight) {
    const previousDay=new Date(previousMs).getDay();
    if (shiftDayRangeIncludes(previousDay,Number(config?.startDay),Number(config?.endDay))) {
      const previousShift=buildShiftInstance(previousMs,config);
      if (previousShift && now>=previousShift.startMs && now<previousShift.endMs) return previousShift;
    }
  }
  if (shiftDayRangeIncludes(today.getDay(),Number(config?.startDay),Number(config?.endDay))) {
    const todayShift=buildShiftInstance(todayMs,config);
    if (todayShift && now<todayShift.endMs) return todayShift;
  }
  return null;
}

function classifyShiftClockIn(nowMs,config) {
  const shift=findApplicableScheduledShift(nowMs,config);
  if (shift) return {mode:'scheduled',shift,warning:null};
  const now=Number(nowMs);
  const todayMs=shiftLocalMidnight(now);
  if (todayMs!==null) {
    const today=new Date(todayMs);
    if (shiftDayRangeIncludes(today.getDay(),Number(config?.startDay),Number(config?.endDay))) {
      const todayShift=buildShiftInstance(todayMs,config);
      if (todayShift && now>=todayShift.endMs) return {mode:'overtime',shift:null,warning:'scheduled-ended'};
    }
  }
  return {mode:'unscheduled',shift:null,warning:'unscheduled-day'};
}

function validateShiftScheduleConfig(config) {
  const errors=[];
  const startDay=Number(config?.startDay);
  const endDay=Number(config?.endDay);
  if (!Number.isInteger(startDay) || startDay<0 || startDay>6) errors.push('Choose a valid first scheduled workday.');
  if (!Number.isInteger(endDay) || endDay<0 || endDay>6) errors.push('Choose a valid last scheduled workday.');
  const clockInMinutes=parseShiftWallTime(config?.clockIn);
  const clockOutMinutes=parseShiftWallTime(config?.clockOut);
  if (clockInMinutes===null) errors.push('Enter a valid Clock In time.');
  if (clockOutMinutes===null) errors.push('Enter a valid Clock Out time.');
  if (clockInMinutes!==null && clockOutMinutes!==null && clockInMinutes===clockOutMinutes) errors.push('Clock In and Clock Out cannot be the same time.');
  if (errors.length) return {ok:false,errors};

  const normalized={
    startDay,endDay,
    clockIn:String(config.clockIn),
    break:{enabled:config?.break?.enabled===true,time:String(config?.break?.time ?? ''),durationMinutes:Number(config?.break?.durationMinutes)},
    lunch:{enabled:config?.lunch?.enabled===true,time:String(config?.lunch?.time ?? ''),durationMinutes:Number(config?.lunch?.durationMinutes)},
    clockOut:String(config.clockOut)
  };
  const anchor=new Date(2026,0,5,0,0,0,0).getTime();
  const shift=buildShiftInstance(anchor,normalized);
  if (!shift) return {ok:false,errors:['The configured shift could not be constructed.']};

  const windows=[];
  for (const [label,pause,key] of [['Break',normalized.break,'breakWindow'],['Lunch',normalized.lunch,'lunchWindow']]) {
    if (!pause.enabled) continue;
    const pauseMinutes=parseShiftWallTime(pause.time);
    if (pauseMinutes===null) { errors.push(`Enter a valid ${label} time.`); continue; }
    if (!Number.isInteger(pause.durationMinutes) || pause.durationMinutes<=0) { errors.push(`${label} length must be a positive whole number of minutes.`); continue; }
    const window=shift[key];
    if (!window || window.startMs<shift.startMs || window.startMs>=shift.endMs || window.endMs>shift.endMs) {
      errors.push(`${label} must start and end inside the scheduled shift.`);
      continue;
    }
    windows.push({label,...window});
  }
  if (windows.length===2 && windows[0].startMs<windows[1].endMs && windows[1].startMs<windows[0].endMs) {
    errors.push('Break and Lunch cannot overlap.');
  }
  return errors.length ? {ok:false,errors} : {ok:true,errors:[],config:normalized};
}

function firstShiftProhibitedBoundary(startedAt,nowMs,shift,policy={}) {
  const start=Number(startedAt);
  const now=Number(nowMs);
  if (!Number.isFinite(start) || !Number.isFinite(now) || !shift) return null;
  const effective=Math.max(start,Number.isFinite(Number(policy.policyEffectiveAt))?Number(policy.policyEffectiveAt):0);
  const candidates=[];
  if (policy.breakEnabled===true && shift.breakWindow) candidates.push(shift.breakWindow.startMs);
  if (policy.lunchEnabled===true && shift.lunchWindow) candidates.push(shift.lunchWindow.startMs);
  if (Number.isFinite(Number(shift.endMs))) candidates.push(Number(shift.endMs));
  const crossed=candidates.filter(value=>Number.isFinite(value) && value>=effective && value<=now).sort((a,b)=>a-b);
  return crossed.length ? crossed[0] : null;
}
// @shift-schedule-core-end
