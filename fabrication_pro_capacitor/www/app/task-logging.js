  // ---------------- Task Logging ----------------
  const TASK_LOG_JOBS_KEY = 'fabricationTaskLogJobsV1';
  const TASK_LOG_PRESETS_KEY = 'fabricationTaskLogPresetsV1';
  const TASK_LOG_JOBS_FORMAT = 'FabricationTaskLogJobs';
  const TASK_LOG_PRESETS_FORMAT = 'FabricationTaskLogPresets';
  const TASK_LOG_JOBS_VERSION = 1;
  const TASK_LOG_PRESETS_VERSION = 1;
  const MAX_TASK_LOG_JOBS = 250;
  const MAX_TASK_LOG_TASKS_PER_JOB = 100;
  const MAX_TASK_LOG_PRESETS = 150;
  const MAX_TASK_LOG_NAME = 120;
  const MAX_TASK_LOG_SESSIONS_PER_TASK = 1000;
  const MAX_TASK_LOG_IMPORT_BYTES = 2 * 1024 * 1024;

  const taskLogNewJobBtn = document.getElementById('taskLogNewJobBtn');
  const taskLogExportJobsBtn = document.getElementById('taskLogExportJobsBtn');
  const taskLogImportJobsBtn = document.getElementById('taskLogImportJobsBtn');
  const taskLogImportJobsFile = document.getElementById('taskLogImportJobsFile');
  const taskLogPresetName = document.getElementById('taskLogPresetName');
  const taskLogAddPresetBtn = document.getElementById('taskLogAddPresetBtn');
  const taskLogExportPresetsBtn = document.getElementById('taskLogExportPresetsBtn');
  const taskLogImportPresetsBtn = document.getElementById('taskLogImportPresetsBtn');
  const taskLogImportPresetsFile = document.getElementById('taskLogImportPresetsFile');
  const taskLogPresetList = document.getElementById('taskLogPresetList');
  const taskLogSelectAllPresetsBtn = document.getElementById('taskLogSelectAllPresetsBtn');
  const taskLogAddSelectedPresetsBtn = document.getElementById('taskLogAddSelectedPresetsBtn');
  const taskLogPresetSelectionMeta = document.getElementById('taskLogPresetSelectionMeta');
  const taskLogPresetMenuBtn = document.getElementById('taskLogPresetMenuBtn');
  const taskLogPresetMenuCount = document.getElementById('taskLogPresetMenuCount');
  const taskLogPresetDrawer = document.getElementById('taskLogPresetDrawer');
  const taskLogPresetBackdrop = document.getElementById('taskLogPresetBackdrop');
  const taskLogPresetCloseBtn = document.getElementById('taskLogPresetCloseBtn');
  const taskLogPresetDrawerMeta = document.getElementById('taskLogPresetDrawerMeta');
  const taskLogStatus = document.getElementById('taskLogStatus');
  const taskLogRunningBanner = document.getElementById('taskLogRunningBanner');
  const taskLogRunningLabel = document.getElementById('taskLogRunningLabel');
  const taskLogRunningTime = document.getElementById('taskLogRunningTime');
  const taskLogStopActiveBtn = document.getElementById('taskLogStopActiveBtn');
  const taskLogJobCount = document.getElementById('taskLogJobCount');
  const taskLogJobList = document.getElementById('taskLogJobList');
  const taskLogEmpty = document.getElementById('taskLogEmpty');
  const taskLogEditor = document.getElementById('taskLogEditor');
  const taskLogJobTitle = document.getElementById('taskLogJobTitle');
  const taskLogRenameBackdrop = document.getElementById('taskLogRenameBackdrop');
  const taskLogRenameDialog = document.getElementById('taskLogRenameDialog');
  const taskLogRenameInput = document.getElementById('taskLogRenameInput');
  const taskLogRenameCancelBtn = document.getElementById('taskLogRenameCancelBtn');
  const taskLogRenameApplyBtn = document.getElementById('taskLogRenameApplyBtn');
  const taskLogRenameStatus = document.getElementById('taskLogRenameStatus');
  const taskLogJobTotal = document.getElementById('taskLogJobTotal');
  const taskLogTaskCount = document.getElementById('taskLogTaskCount');
  const taskLogJobStatusText = document.getElementById('taskLogJobStatusText');
  const taskLogPresetSelect = document.getElementById('taskLogPresetSelect');
  const taskLogAddTaskBtn = document.getElementById('taskLogAddTaskBtn');
  const taskLogTaskList = document.getElementById('taskLogTaskList');
  const taskLogSaveState = document.getElementById('taskLogSaveState');
  const taskLogDeleteJobBtn = document.getElementById('taskLogDeleteJobBtn');

  let taskLogJobs = [];
  let taskLogPresets = [];
  let taskLogActiveJobId = null;
  let taskLogNextJobId = 1;
  let taskLogNextTaskId = 1;
  let taskLogNextPresetId = 1;
  let taskLogSaveTimer = null;
  let taskLogSelectedPresetIds = new Set();

// @tasklog-job-rename-core-start
function normalizeTaskLogJobName(value,maxLength=120) {
  const clean=String(value ?? '').trim().replace(/\s+/g,' ');
  if (!clean) return null;
  const limit=Number.isInteger(maxLength) && maxLength>0 ? maxLength : 120;
  return clean.slice(0,limit);
}

function applyTaskLogJobRename(job,value,updatedAt,maxLength=120) {
  if (!job || typeof job!=='object') return false;
  const clean=normalizeTaskLogJobName(value,maxLength);
  if (!clean) return false;
  job.title=clean;
  job.updatedAt=String(updatedAt || new Date().toISOString());
  return true;
}
// @tasklog-job-rename-core-end

  function showTaskLogStatus(message,type='ok') {
    taskLogStatus.textContent = message;
    taskLogStatus.className = `status show ${type}`;
  }

  function clearTaskLogStatus() {
    taskLogStatus.textContent = '';
    taskLogStatus.className = 'status';
  }

  function taskLogIso(value,fallback=new Date().toISOString()) {
    if (typeof value !== 'string') return fallback;
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? new Date(ms).toISOString() : fallback;
  }

  function formatTaskLogDuration(milliseconds) {
    const totalSeconds = Math.max(0, Math.floor(Number(milliseconds || 0) / 1000));
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const hours = Math.floor(totalSeconds / 3600);
    return `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
  }

  function taskLogElapsedMs(task,nowMs=Date.now()) {
    const accumulated = Math.max(0,Number(task && task.accumulatedMs || 0));
    if (!task || task.running !== true || !Number.isFinite(Number(task.startedAt))) return accumulated;
    return accumulated + Math.max(0,Number(nowMs) - Number(task.startedAt));
  }

  function taskLogJobTotalMs(job,nowMs=Date.now()) {
    return (job && Array.isArray(job.tasks) ? job.tasks : []).reduce((sum,task)=>sum+taskLogElapsedMs(task,nowMs),0);
  }

  function activeTaskLogJob() {
    return taskLogJobs.find(job=>job.id===taskLogActiveJobId) || null;
  }

  function findRunningTaskLogTask() {
    for (const job of taskLogJobs) {
      const task=(job.tasks||[]).find(item=>item.running===true);
      if (task) return {job,task};
    }
    return null;
  }

  function normalizeTaskLogSession(session,context) {
    if (!session || typeof session!=='object' || Array.isArray(session)) throw new Error(`${context} has an invalid timer session.`);
    const startedAt=Number(session.startedAt);
    const endedAt=Number(session.endedAt);
    const durationMs=Number(session.durationMs);
    if (!Number.isFinite(startedAt) || startedAt<0 || !Number.isFinite(endedAt) || endedAt<startedAt || !Number.isFinite(durationMs) || durationMs<0) {
      throw new Error(`${context} has an invalid timer session.`);
    }
    const calculated=Math.max(0,endedAt-startedAt);
    if (Math.abs(calculated-durationMs)>1000) throw new Error(`${context} has a timer session with inconsistent duration.`);
    return {startedAt,endedAt,durationMs:calculated};
  }

  function normalizeTaskLogJobsRecord(raw) {
    const data = raw && raw.taskLogJobs ? raw.taskLogJobs : raw;
    if (!data || typeof data!=='object' || Array.isArray(data)) throw new Error('The file does not contain valid Task Logging jobs.');
    if (data.format && data.format!==TASK_LOG_JOBS_FORMAT) throw new Error('This JSON file is not a Task Logging Jobs export.');
    const version=Number(data.version || 1);
    if (!Number.isInteger(version) || version<1) throw new Error('The Task Logging Jobs file has an invalid version number.');
    if (version>TASK_LOG_JOBS_VERSION) throw new Error('These Task Logging jobs were created by a newer version of Fabrication Calculators and cannot be safely imported here.');
    if (!Array.isArray(data.jobs)) throw new Error('The Task Logging Jobs file is missing its jobs list.');
    if (data.jobs.length>MAX_TASK_LOG_JOBS) throw new Error(`The Task Logging Jobs file contains more than ${MAX_TASK_LOG_JOBS} jobs.`);

    const nowIso=new Date().toISOString();
    const jobIds=new Set();
    const taskIds=new Set();
    let runningCount=0;
    const jobs=data.jobs.map((job,ji)=>{
      if (!job || typeof job!=='object' || Array.isArray(job)) throw new Error(`Task Logging job ${ji+1} is invalid.`);
      const id=Number(job.id);
      if (!Number.isInteger(id) || id<1 || jobIds.has(id)) throw new Error(`Task Logging job ${ji+1} has an invalid or duplicate ID.`);
      jobIds.add(id);
      const title=String(job.title || '').trim();
      if (!title || title.length>MAX_TASK_LOG_NAME) throw new Error(`Task Logging job ${ji+1} has an invalid Job # / Name.`);
      if (!Array.isArray(job.tasks)) throw new Error(`Task Logging job ${ji+1} is missing its task list.`);
      if (job.tasks.length>MAX_TASK_LOG_TASKS_PER_JOB) throw new Error(`Task Logging job ${ji+1} contains more than ${MAX_TASK_LOG_TASKS_PER_JOB} tasks.`);
      const tasks=job.tasks.map((task,ti)=>{
        if (!task || typeof task!=='object' || Array.isArray(task)) throw new Error(`Task ${ti+1} in job ${ji+1} is invalid.`);
        const taskId=Number(task.id);
        if (!Number.isInteger(taskId) || taskId<1 || taskIds.has(taskId)) throw new Error(`Task ${ti+1} in job ${ji+1} has an invalid or duplicate task ID.`);
        taskIds.add(taskId);
        const name=String(task.name || '').trim();
        if (!name || name.length>MAX_TASK_LOG_NAME) throw new Error(`Task ${ti+1} in job ${ji+1} has an invalid name.`);
        const presetId=task.presetId==null ? null : Number(task.presetId);
        if (presetId!==null && (!Number.isInteger(presetId) || presetId<1)) throw new Error(`Task ${ti+1} in job ${ji+1} has an invalid preset reference.`);
        const accumulatedMs=Number(task.accumulatedMs || 0);
        if (!Number.isFinite(accumulatedMs) || accumulatedMs<0) throw new Error(`Task ${ti+1} in job ${ji+1} has invalid accumulated time.`);
        const running=task.running===true;
        const startedAt=running ? Number(task.startedAt) : null;
        if (running && (!Number.isFinite(startedAt) || startedAt<0)) throw new Error(`Task ${ti+1} in job ${ji+1} has an invalid running start timestamp.`);
        if (running) runningCount++;
        const sessions=Array.isArray(task.sessions) ? task.sessions : [];
        if (sessions.length>MAX_TASK_LOG_SESSIONS_PER_TASK) throw new Error(`Task ${ti+1} in job ${ji+1} contains too many timer sessions.`);
        const normalizedSessions=sessions.map((session,si)=>normalizeTaskLogSession(session,`Task ${ti+1}, session ${si+1}, job ${ji+1}`));
        return {
          id:taskId,
          presetId,
          name,
          accumulatedMs,
          running,
          startedAt,
          sessions:normalizedSessions,
          createdAt:taskLogIso(task.createdAt,nowIso),
          updatedAt:taskLogIso(task.updatedAt,nowIso)
        };
      });
      return {id,title,tasks,createdAt:taskLogIso(job.createdAt,nowIso),updatedAt:taskLogIso(job.updatedAt,nowIso)};
    });
    if (runningCount>1) throw new Error('The Task Logging Jobs file contains more than one running task. Import was stopped to protect labor totals.');
    const maxJobId=jobs.reduce((m,j)=>Math.max(m,j.id),0);
    const maxTaskId=jobs.reduce((m,j)=>Math.max(m,...j.tasks.map(t=>t.id),0),0);
    const activeJobId=jobIds.has(Number(data.activeJobId)) ? Number(data.activeJobId) : (jobs[0]?.id ?? null);
    const exportedAt=taskLogIso(data.exportedAt || data.savedAt,nowIso);
    return {
      format:TASK_LOG_JOBS_FORMAT,
      version:TASK_LOG_JOBS_VERSION,
      exportedAt,
      activeJobId,
      nextJobId:Math.max(maxJobId+1,Number.isInteger(Number(data.nextJobId))?Number(data.nextJobId):1),
      nextTaskId:Math.max(maxTaskId+1,Number.isInteger(Number(data.nextTaskId))?Number(data.nextTaskId):1),
      jobs
    };
  }

  function normalizeTaskLogPresetsRecord(raw) {
    const data = raw && raw.taskLogPresets ? raw.taskLogPresets : raw;
    if (!data || typeof data!=='object' || Array.isArray(data)) throw new Error('The file does not contain valid Task Logging preset tasks.');
    if (data.format && data.format!==TASK_LOG_PRESETS_FORMAT) throw new Error('This JSON file is not a Task Logging Presets export.');
    const version=Number(data.version || 1);
    if (!Number.isInteger(version) || version<1) throw new Error('The Task Logging Presets file has an invalid version number.');
    if (version>TASK_LOG_PRESETS_VERSION) throw new Error('These Task Logging presets were created by a newer version of Fabrication Calculators and cannot be safely imported here.');
    if (!Array.isArray(data.presets)) throw new Error('The Task Logging Presets file is missing its preset list.');
    if (data.presets.length>MAX_TASK_LOG_PRESETS) throw new Error(`The Task Logging Presets file contains more than ${MAX_TASK_LOG_PRESETS} presets.`);
    const ids=new Set(), names=new Set();
    const nowIso=new Date().toISOString();
    const presets=data.presets.map((preset,index)=>{
      if (!preset || typeof preset!=='object' || Array.isArray(preset)) throw new Error(`Preset task ${index+1} is invalid.`);
      const id=Number(preset.id);
      const name=String(preset.name || '').trim();
      if (!Number.isInteger(id) || id<1 || ids.has(id)) throw new Error(`Preset task ${index+1} has an invalid or duplicate ID.`);
      if (!name || name.length>MAX_TASK_LOG_NAME) throw new Error(`Preset task ${index+1} has an invalid name.`);
      const key=name.toLocaleLowerCase();
      if (names.has(key)) throw new Error(`Preset task ${index+1} duplicates another preset name.`);
      ids.add(id); names.add(key);
      return {id,name,createdAt:taskLogIso(preset.createdAt,nowIso),updatedAt:taskLogIso(preset.updatedAt,nowIso)};
    });
    const maxId=presets.reduce((m,p)=>Math.max(m,p.id),0);
    return {
      format:TASK_LOG_PRESETS_FORMAT,
      version:TASK_LOG_PRESETS_VERSION,
      exportedAt:taskLogIso(data.exportedAt || data.savedAt,nowIso),
      nextPresetId:Math.max(maxId+1,Number.isInteger(Number(data.nextPresetId))?Number(data.nextPresetId):1),
      presets
    };
  }

  function serializeTaskLogJobsRecord() {
    return {
      format:TASK_LOG_JOBS_FORMAT,
      version:TASK_LOG_JOBS_VERSION,
      exportedAt:new Date().toISOString(),
      activeJobId:taskLogActiveJobId,
      nextJobId:taskLogNextJobId,
      nextTaskId:taskLogNextTaskId,
      jobs:taskLogJobs.map(job=>({
        id:job.id,title:job.title,createdAt:job.createdAt,updatedAt:job.updatedAt,
        tasks:job.tasks.map(task=>({
          id:task.id,presetId:task.presetId ?? null,name:task.name,
          accumulatedMs:Math.max(0,Number(task.accumulatedMs||0)),
          running:task.running===true,
          startedAt:task.running===true ? Number(task.startedAt) : null,
          sessions:(task.sessions||[]).map(session=>({...session})),
          createdAt:task.createdAt,updatedAt:task.updatedAt
        }))
      }))
    };
  }

  function serializeTaskLogPresetsRecord() {
    return {
      format:TASK_LOG_PRESETS_FORMAT,
      version:TASK_LOG_PRESETS_VERSION,
      exportedAt:new Date().toISOString(),
      nextPresetId:taskLogNextPresetId,
      presets:taskLogPresets.map(preset=>({...preset}))
    };
  }

  function finalizeImportedRunningTaskLogJobs(record) {
    const exportMs=Date.parse(record.exportedAt);
    const stopAt=Number.isFinite(exportMs) ? exportMs : Date.now();
    let stopped=0;
    for (const job of record.jobs) {
      for (const task of job.tasks) {
        if (!task.running) continue;
        const started=Number(task.startedAt);
        const ended=Math.max(started,stopAt);
        const duration=Math.max(0,ended-started);
        task.accumulatedMs+=duration;
        task.sessions.push({startedAt:started,endedAt:ended,durationMs:duration});
        if (task.sessions.length>MAX_TASK_LOG_SESSIONS_PER_TASK) task.sessions=task.sessions.slice(-MAX_TASK_LOG_SESSIONS_PER_TASK);
        task.running=false;
        task.startedAt=null;
        task.updatedAt=new Date(ended).toISOString();
        job.updatedAt=task.updatedAt;
        stopped++;
      }
    }
    return stopped;
  }

  registerPersistentStore({
    id:'taskLogJobs',key:TASK_LOG_JOBS_KEY,version:TASK_LOG_JOBS_VERSION,encoding:'json',label:'Task Logging Jobs',
    defaultValue:()=>({format:TASK_LOG_JOBS_FORMAT,version:TASK_LOG_JOBS_VERSION,exportedAt:new Date().toISOString(),activeJobId:null,nextJobId:1,nextTaskId:1,jobs:[]}),
    getVersion:value=>Number(value?.version || 1),
    normalize:normalizeTaskLogJobsRecord
  });
  registerPersistentStore({
    id:'taskLogPresets',key:TASK_LOG_PRESETS_KEY,version:TASK_LOG_PRESETS_VERSION,encoding:'json',label:'Task Logging Presets',
    defaultValue:()=>({format:TASK_LOG_PRESETS_FORMAT,version:TASK_LOG_PRESETS_VERSION,exportedAt:new Date().toISOString(),nextPresetId:1,presets:[]}),
    getVersion:value=>Number(value?.version || 1),
    normalize:normalizeTaskLogPresetsRecord
  });

  function persistTaskLogJobs(showError=true) {
    try {
      writePersistentStore('taskLogJobs',serializeTaskLogJobsRecord());
      taskLogSaveState.textContent='Saved on this device';
      return true;
    } catch (error) {
      if (showError) showTaskLogStatus('This browser could not save Task Logging jobs locally. Export Jobs as a backup.','error');
      return false;
    }
  }

  function persistTaskLogPresets(showError=true) {
    try {
      writePersistentStore('taskLogPresets',serializeTaskLogPresetsRecord());
      return true;
    } catch (error) {
      if (showError) showTaskLogStatus('This browser could not save preset tasks locally. Export Presets as a backup.','error');
      return false;
    }
  }

  function scheduleTaskLogJobsSave() {
    taskLogSaveState.textContent='Saving…';
    if (taskLogSaveTimer) clearTimeout(taskLogSaveTimer);
    taskLogSaveTimer=setTimeout(()=>{ taskLogSaveTimer=null; persistTaskLogJobs(true); },250);
  }

  function downloadTaskLogJson(filename,payload) {
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url; a.download=filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  function taskLogSafeFilePart(text) {
    return String(text || '').trim().replace(/[^a-z0-9._-]+/gi,'-').replace(/^-+|-+$/g,'') || 'Backup';
  }

  function setTaskLogPresetDrawerOpen(open) {
    if (open) openDrawer('taskLogPresetDrawer',document.activeElement); else closeDrawer('taskLogPresetDrawer');
    taskLogPresetMenuBtn.setAttribute('aria-expanded',open?'true':'false');
  }

  function formatTaskLogSessionMoment(value) {
    const d=new Date(Number(value));
    if (!Number.isFinite(d.getTime())) return 'Unknown time';
    return d.toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  }

  function renderTaskLogSessionHistory(task) {
    const sessions=Array.isArray(task.sessions)?task.sessions:[];
    if (!sessions.length) return '<small>0 completed sessions</small>';
    const rows=sessions.slice().reverse().map((session,index)=>{
      const number=sessions.length-index;
      return `<div class="tasklog-session-row"><span>Session ${number} • ${escapeHtml(formatTaskLogSessionMoment(session.startedAt))} → ${escapeHtml(formatTaskLogSessionMoment(session.endedAt))}</span><b>${formatTaskLogDuration(Number(session.durationMs)||0)}</b></div>`;
    }).join('');
    return `<details class="tasklog-session-details" data-tasklog-session-details="${task.id}"><summary>${sessions.length} completed session${sessions.length===1?'':'s'}</summary><div class="tasklog-session-list">${rows}</div></details>`;
  }

  function taskLogPresetAlreadyAssigned(job,preset) {
    if (!job || !preset) return false;
    const presetName=String(preset.name || '').toLocaleLowerCase();
    return job.tasks.some(task=>task.presetId===preset.id || String(task.name || '').toLocaleLowerCase()===presetName);
  }

  function renderTaskLogPresetLibrary() {
    taskLogPresetMenuCount.textContent=taskLogPresets.length;
    taskLogPresetDrawerMeta.textContent=`${taskLogPresets.length} preset${taskLogPresets.length===1?'':'s'}`;
    taskLogExportPresetsBtn.disabled=taskLogPresets.length===0;

    const validPresetIds=new Set(taskLogPresets.map(p=>p.id));
    for (const id of Array.from(taskLogSelectedPresetIds)) if (!validPresetIds.has(id)) taskLogSelectedPresetIds.delete(id);

    const job=activeTaskLogJob();
    const availablePresets=job ? taskLogPresets.filter(preset=>!taskLogPresetAlreadyAssigned(job,preset)) : [];
    if (job) {
      const availableIds=new Set(availablePresets.map(p=>p.id));
      for (const id of Array.from(taskLogSelectedPresetIds)) if (!availableIds.has(id)) taskLogSelectedPresetIds.delete(id);
    } else {
      taskLogSelectedPresetIds.clear();
    }
    const selectedAvailable=availablePresets.filter(p=>taskLogSelectedPresetIds.has(p.id));
    const allAvailableSelected=availablePresets.length>0 && selectedAvailable.length===availablePresets.length;

    taskLogSelectAllPresetsBtn.disabled=!job || availablePresets.length===0;
    taskLogSelectAllPresetsBtn.textContent=allAvailableSelected?'Clear Selection':'Select All';
    taskLogAddSelectedPresetsBtn.disabled=!job || selectedAvailable.length===0;
    taskLogPresetSelectionMeta.textContent=job
      ? (availablePresets.length ? `${selectedAvailable.length} selected • ${availablePresets.length} available for ${job.title}` : `All presets are already added to ${job.title}`)
      : 'Select a job before choosing preset tasks.';

    if (!taskLogPresets.length) {
      taskLogPresetList.innerHTML='<div class="optimizer-empty">No preset tasks yet.</div>';
    } else {
      taskLogPresetList.innerHTML=taskLogPresets.map(preset=>{
        const assigned=!!job && taskLogPresetAlreadyAssigned(job,preset);
        const checked=!!job && !assigned && taskLogSelectedPresetIds.has(preset.id);
        const unavailable=!job || assigned;
        const actionButton=assigned
          ? `<button class="tasklog-mini-delete tasklog-remove-assigned-btn" type="button" aria-label="Remove ${escapeHtml(preset.name)} from this job" title="Remove from this job" data-tasklog-remove-assigned="${preset.id}">−</button>`
          : `<button class="tasklog-mini-delete" type="button" aria-label="Delete preset ${escapeHtml(preset.name)}" data-tasklog-delete-preset="${preset.id}">×</button>`;
        return `<div class="tasklog-preset-row${assigned?' assigned':''}">
          <input class="tasklog-preset-check" type="checkbox" data-tasklog-select-preset="${preset.id}" aria-label="Select preset ${escapeHtml(preset.name)}"${checked?' checked':''}${unavailable?' disabled':''} />
          <div class="tasklog-preset-copy"><strong>${escapeHtml(preset.name)}</strong>${assigned?'<small>Already added to this job</small>':''}</div>
          ${actionButton}
        </div>`;
      }).join('');
    }
    const previous=taskLogPresetSelect.value;
    if (!taskLogPresets.length) {
      taskLogPresetSelect.innerHTML='<option value="">Create a preset task first</option>';
      taskLogPresetSelect.disabled=true;
      taskLogAddTaskBtn.disabled=true;
    } else {
      taskLogPresetSelect.innerHTML='<option value="">Select a preset task…</option>'+taskLogPresets.map(p=>`<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
      if (taskLogPresets.some(p=>String(p.id)===previous)) taskLogPresetSelect.value=previous;
      taskLogPresetSelect.disabled=false;
      taskLogAddTaskBtn.disabled=!activeTaskLogJob() || !taskLogPresetSelect.value;
    }
  }

  function toggleSelectAllTaskLogPresets() {
    const job=activeTaskLogJob();
    if (!job) { showTaskLogStatus('Create or select a job before choosing preset tasks.','error'); return; }
    const available=taskLogPresets.filter(preset=>!taskLogPresetAlreadyAssigned(job,preset));
    if (!available.length) return;
    const allSelected=available.every(preset=>taskLogSelectedPresetIds.has(preset.id));
    if (allSelected) available.forEach(preset=>taskLogSelectedPresetIds.delete(preset.id));
    else available.forEach(preset=>taskLogSelectedPresetIds.add(preset.id));
    renderTaskLogPresetLibrary();
  }

  function addSelectedPresetsToActiveTaskLogJob() {
    clearTaskLogStatus();
    const job=activeTaskLogJob();
    if (!job) { showTaskLogStatus('Create or select a job before adding preset tasks.','error'); return; }
    const selected=taskLogPresets.filter(preset=>taskLogSelectedPresetIds.has(preset.id) && !taskLogPresetAlreadyAssigned(job,preset));
    if (!selected.length) { showTaskLogStatus('Select at least one preset task that is not already assigned to this job.','error'); renderTaskLogPresetLibrary(); return; }
    const remainingCapacity=MAX_TASK_LOG_TASKS_PER_JOB-job.tasks.length;
    if (selected.length>remainingCapacity) {
      showTaskLogStatus(`This job has room for ${remainingCapacity} more task${remainingCapacity===1?'':'s'}, but ${selected.length} presets are selected. Nothing was added.`,'error');
      return;
    }
    const now=new Date().toISOString();
    for (const preset of selected) {
      job.tasks.push({id:taskLogNextTaskId++,presetId:preset.id,name:preset.name,accumulatedMs:0,running:false,startedAt:null,sessions:[],createdAt:now,updatedAt:now});
      taskLogSelectedPresetIds.delete(preset.id);
    }
    job.updatedAt=now;
    persistTaskLogJobs(true);
    renderTaskLogging();
    showTaskLogStatus(`Added ${selected.length} preset task${selected.length===1?'':'s'} to ${job.title}.`,'ok');
  }


  function renderTaskLogJobs() {
    taskLogJobCount.textContent=taskLogJobs.length;
    taskLogExportJobsBtn.disabled=taskLogJobs.length===0;
    if (!taskLogJobs.length) {
      taskLogJobList.innerHTML='<div class="tasklog-empty">No task logging jobs yet.</div>';
      return;
    }
    const now=Date.now();
    const ordered=taskLogJobs.slice().sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)) || a.id-b.id);
    taskLogJobList.innerHTML=ordered.map(job=>{
      const running=(job.tasks||[]).some(task=>task.running);
      return `<button class="tasklog-job-item${job.id===taskLogActiveJobId?' active':''}${running?' running':''}" type="button" data-tasklog-job-id="${job.id}"><strong>${escapeHtml(job.title)}</strong><small><span>${job.tasks.length} task${job.tasks.length===1?'':'s'} • <span data-tasklog-job-list-time="${job.id}">${formatTaskLogDuration(taskLogJobTotalMs(job,now))}</span></span>${running?'<span class="running-word">RUNNING</span>':''}</small></button>`;
    }).join('');
  }

  function renderTaskLogTasks() {
    const job=activeTaskLogJob();
    if (!job) { taskLogTaskList.innerHTML=''; return; }
    if (!job.tasks.length) {
      taskLogTaskList.innerHTML='<div class="tasklog-empty">No tasks assigned. Choose a preset task above.</div>';
      return;
    }
    const openSessionTasks=new Set(Array.from(taskLogTaskList.querySelectorAll('.tasklog-session-details[open]')).map(el=>String(el.dataset.tasklogSessionDetails)));
    const now=Date.now();
    taskLogTaskList.innerHTML=job.tasks.map(task=>{
      return `<div class="tasklog-task-row${task.running?' running':''}" data-tasklog-task-row="${task.id}">
        <div class="tasklog-task-main">
          <strong>${escapeHtml(task.name)}</strong>
          <div class="tasklog-task-meta"><span class="tasklog-task-time" data-tasklog-timer="${task.id}">${formatTaskLogDuration(taskLogElapsedMs(task,now))}</span>${task.running?'<small>Running now</small>':''}${renderTaskLogSessionHistory(task)}</div>
        </div>
        <div class="tasklog-task-actions">
          <button class="tasklog-timer-btn${task.running?' stop':''}" type="button" data-tasklog-timer-action="${task.running?'stop':'start'}" data-tasklog-task-id="${task.id}">${task.running?'Stop':'Start'}</button>
          <button class="tasklog-remove-task" type="button" aria-label="Remove ${escapeHtml(task.name)} from this job" data-tasklog-remove-task="${task.id}">×</button>
        </div>
      </div>`;
    }).join('');
    for (const details of taskLogTaskList.querySelectorAll('.tasklog-session-details')) {
      if (openSessionTasks.has(String(details.dataset.tasklogSessionDetails))) details.open=true;
    }
  }

  function setTaskLogRenameDialogOpen(open) {
    taskLogRenameBackdrop.classList.toggle('open',open);
    taskLogRenameDialog.classList.toggle('open',open);
    taskLogRenameBackdrop.setAttribute('aria-hidden',open?'false':'true');
    taskLogRenameDialog.setAttribute('aria-hidden',open?'false':'true');
    if (open) {
      requestAnimationFrame(()=>{
        taskLogRenameInput.focus({preventScroll:true});
        taskLogRenameInput.select();
      });
    } else {
      taskLogRenameStatus.textContent='';
      taskLogRenameStatus.className='status';
      requestAnimationFrame(()=>taskLogJobTitle.focus({preventScroll:true}));
    }
  }

  function openTaskLogRenameDialog() {
    const job=activeTaskLogJob();
    if (!job) return;
    taskLogRenameInput.value=job.title;
    taskLogRenameStatus.textContent='';
    taskLogRenameStatus.className='status';
    setTaskLogRenameDialogOpen(true);
  }

  function applyTaskLogJobRenameFromDialog() {
    const job=activeTaskLogJob();
    if (!job) { setTaskLogRenameDialogOpen(false); return; }
    if (!applyTaskLogJobRename(job,taskLogRenameInput.value,new Date().toISOString(),MAX_TASK_LOG_NAME)) {
      taskLogRenameStatus.textContent='Enter a job name before applying the change.';
      taskLogRenameStatus.className='status error show';
      taskLogRenameInput.focus({preventScroll:true});
      return;
    }
    persistTaskLogJobs(true);
    renderTaskLogging();
    setTaskLogRenameDialogOpen(false);
    showTaskLogStatus(`Job name changed to ${job.title}.`,'ok');
  }

  function trapTaskLogRenameFocus(event) {
    if (event.key!=='Tab' || !taskLogRenameDialog.classList.contains('open')) return;
    const focusable=[taskLogRenameInput,taskLogRenameCancelBtn,taskLogRenameApplyBtn].filter(el=>el && !el.disabled);
    if (!focusable.length) { event.preventDefault(); return; }
    const first=focusable[0],last=focusable[focusable.length-1];
    if (event.shiftKey && document.activeElement===first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement===last) { event.preventDefault(); first.focus(); }
  }

  function renderTaskLogEditor() {
    const job=activeTaskLogJob();
    taskLogEmpty.style.display=job?'none':'block';
    taskLogEditor.classList.toggle('show',!!job);
    if (!job) return;
    taskLogJobTitle.textContent=job.title;
    taskLogJobTitle.title='Edit job name';
    taskLogJobTitle.setAttribute('aria-label',`Edit job name: ${job.title}`);
    taskLogTaskCount.textContent=job.tasks.length;
    const running=job.tasks.some(task=>task.running);
    taskLogJobStatusText.textContent=running?'Running':'Stopped';
    taskLogJobStatusText.classList.toggle('good',running);
    taskLogJobTotal.textContent=formatTaskLogDuration(taskLogJobTotalMs(job));
    taskLogAddTaskBtn.disabled=!taskLogPresets.length || !taskLogPresetSelect.value;
    renderTaskLogTasks();
  }

  function renderTaskLogRunningBanner() {
    const active=findRunningTaskLogTask();
    taskLogRunningBanner.classList.toggle('show',!!active);
    if (!active) return;
    taskLogRunningLabel.textContent=`${active.job.title} — ${active.task.name}`;
    taskLogRunningTime.textContent=formatTaskLogDuration(taskLogElapsedMs(active.task));
  }

  function renderTaskLogging() {
    renderTaskLogPresetLibrary();
    renderTaskLogJobs();
    renderTaskLogEditor();
    renderTaskLogRunningBanner();
  }

  function updateTaskLogTimerDisplays() {
    const now=Date.now();
    reconcileShiftSchedule(now);
    for (const job of taskLogJobs) {
      for (const task of job.tasks) {
        const el=document.querySelector(`[data-tasklog-timer="${task.id}"]`);
        if (el) el.textContent=formatTaskLogDuration(taskLogElapsedMs(task,now));
      }
    }
    for (const job of taskLogJobs) {
      const el=document.querySelector(`[data-tasklog-job-list-time="${job.id}"]`);
      if (el) el.textContent=formatTaskLogDuration(taskLogJobTotalMs(job,now));
    }
    const activeJob=activeTaskLogJob();
    if (activeJob) taskLogJobTotal.textContent=formatTaskLogDuration(taskLogJobTotalMs(activeJob,now));
    const active=findRunningTaskLogTask();
    if (active) taskLogRunningTime.textContent=formatTaskLogDuration(taskLogElapsedMs(active.task,now));
  }

  function createTaskLogJob() {
    clearTaskLogStatus();
    if (taskLogJobs.length>=MAX_TASK_LOG_JOBS) { showTaskLogStatus(`Task Logging supports up to ${MAX_TASK_LOG_JOBS} jobs.`,'error'); return; }
    const now=new Date().toISOString();
    const number=taskLogJobs.length+1;
    const job={id:taskLogNextJobId++,title:`Job ${number}`,tasks:[],createdAt:now,updatedAt:now};
    taskLogJobs.push(job);
    taskLogActiveJobId=job.id;
    persistTaskLogJobs(true);
    renderTaskLogging();
    requestAnimationFrame(()=>taskLogJobTitle.focus());
  }

  function addTaskLogPreset() {
    clearTaskLogStatus();
    const name=String(taskLogPresetName.value || '').trim().replace(/\s+/g,' ');
    if (!name) { showTaskLogStatus('Enter a preset task name.','error'); taskLogPresetName.focus(); return; }
    if (name.length>MAX_TASK_LOG_NAME) { showTaskLogStatus(`Preset task names are limited to ${MAX_TASK_LOG_NAME} characters.`,'error'); return; }
    if (taskLogPresets.length>=MAX_TASK_LOG_PRESETS) { showTaskLogStatus(`Task Logging supports up to ${MAX_TASK_LOG_PRESETS} preset tasks.`,'error'); return; }
    if (taskLogPresets.some(p=>p.name.localeCompare(name,undefined,{sensitivity:'accent'})===0)) { showTaskLogStatus('That preset task already exists.','error'); return; }
    const now=new Date().toISOString();
    taskLogPresets.push({id:taskLogNextPresetId++,name,createdAt:now,updatedAt:now});
    taskLogPresetName.value='';
    persistTaskLogPresets(true);
    renderTaskLogPresetLibrary();
    showTaskLogStatus(`Preset task “${name}” added.`,'ok');
  }

  async function deleteTaskLogPreset(id) {
    const preset=taskLogPresets.find(p=>p.id===id);
    if (!preset) return;
    if (!await confirmAppAction(`Delete preset task “${preset.name}”? Existing jobs keep their already-assigned copy of this task.`)) return;
    taskLogPresets=taskLogPresets.filter(p=>p.id!==id);
    persistTaskLogPresets(true);
    renderTaskLogPresetLibrary();
    showTaskLogStatus(`Preset task “${preset.name}” deleted. Existing job tasks were not changed.`,'ok');
  }

  function addPresetToActiveTaskLogJob() {
    clearTaskLogStatus();
    const job=activeTaskLogJob();
    if (!job) { showTaskLogStatus('Create or select a job first.','error'); return; }
    const presetId=Number(taskLogPresetSelect.value);
    const preset=taskLogPresets.find(p=>p.id===presetId);
    if (!preset) { showTaskLogStatus('Select a preset task to add.','error'); return; }
    if (job.tasks.length>=MAX_TASK_LOG_TASKS_PER_JOB) { showTaskLogStatus(`A Task Logging job supports up to ${MAX_TASK_LOG_TASKS_PER_JOB} tasks.`,'error'); return; }
    if (job.tasks.some(task=>task.presetId===preset.id || task.name.toLocaleLowerCase()===preset.name.toLocaleLowerCase())) {
      showTaskLogStatus('That task is already assigned to this job.','error'); return;
    }
    const now=new Date().toISOString();
    job.tasks.push({id:taskLogNextTaskId++,presetId:preset.id,name:preset.name,accumulatedMs:0,running:false,startedAt:null,sessions:[],createdAt:now,updatedAt:now});
    job.updatedAt=now;
    persistTaskLogJobs(true);
    renderTaskLogging();
    showTaskLogStatus(`Added “${preset.name}” to ${job.title}.`,'ok');
  }

  function stopTaskLogTask(job,task,nowMs=Date.now()) {
    if (!job || !task || !task.running) return false;
    const started=Number(task.startedAt);
    const ended=Math.max(Number.isFinite(started)?started:nowMs,nowMs);
    const duration=Math.max(0,ended-(Number.isFinite(started)?started:ended));
    task.accumulatedMs=Math.max(0,Number(task.accumulatedMs||0))+duration;
    task.sessions=Array.isArray(task.sessions)?task.sessions:[];
    task.sessions.push({startedAt:Number.isFinite(started)?started:ended,endedAt:ended,durationMs:duration});
    if (task.sessions.length>MAX_TASK_LOG_SESSIONS_PER_TASK) task.sessions=task.sessions.slice(-MAX_TASK_LOG_SESSIONS_PER_TASK);
    task.running=false;
    task.startedAt=null;
    task.updatedAt=new Date(ended).toISOString();
    job.updatedAt=task.updatedAt;
    return true;
  }

  function startTaskLogTask(taskId) {
    clearTaskLogStatus();
    let targetJob=null,targetTask=null;
    for (const job of taskLogJobs) {
      const task=job.tasks.find(t=>t.id===taskId);
      if (task) { targetJob=job; targetTask=task; break; }
    }
    if (!targetTask || targetTask.running) return;
    const now=Date.now();
    reconcileShiftSchedule(now);
    const permission=getShiftTaskPermission(now);
    if (!permission.allowed) {
      showTaskLogStatus(permission.reason,'error');
      return;
    }
    const previous=findRunningTaskLogTask();
    let previousName='';
    if (previous) {
      previousName=`${previous.job.title} — ${previous.task.name}`;
      stopTaskLogTask(previous.job,previous.task,now);
    }
    targetTask.running=true;
    targetTask.startedAt=now;
    targetTask.updatedAt=new Date(now).toISOString();
    targetJob.updatedAt=targetTask.updatedAt;
    taskLogActiveJobId=targetJob.id;
    persistTaskLogJobs(true);
    renderTaskLogging();
    showTaskLogStatus(previousName ? `Stopped ${previousName} and started ${targetJob.title} — ${targetTask.name}.` : `Started ${targetJob.title} — ${targetTask.name}.`,'ok');
  }

  function stopTaskLogTaskById(taskId,showMessage=true) {
    for (const job of taskLogJobs) {
      const task=job.tasks.find(t=>t.id===taskId);
      if (!task || !task.running) continue;
      stopTaskLogTask(job,task,Date.now());
      persistTaskLogJobs(true);
      renderTaskLogging();
      if (showMessage) showTaskLogStatus(`Stopped ${job.title} — ${task.name}.`,'ok');
      return true;
    }
    return false;
  }

  function stopActiveTaskLogTimer() {
    const active=findRunningTaskLogTask();
    if (active) stopTaskLogTaskById(active.task.id,true);
  }

  async function removeTaskLogTask(taskId) {
    const job=activeTaskLogJob();
    if (!job) return;
    const task=job.tasks.find(t=>t.id===taskId);
    if (!task) return;
    const warning=task.running ? ' It is currently running and will be removed without adding any more time.' : '';
    if (!await confirmAppAction(`Remove “${task.name}” from ${job.title}? Its logged time and session history will be deleted.${warning}`)) return;
    job.tasks=job.tasks.filter(t=>t.id!==taskId);
    job.updatedAt=new Date().toISOString();
    persistTaskLogJobs(true);
    renderTaskLogging();
  }

  async function deleteActiveTaskLogJob() {
    const job=activeTaskLogJob();
    if (!job) return;
    const running=job.tasks.some(t=>t.running);
    if (!await confirmAppAction(`Delete ${job.title} and all of its task time logs?${running?' A timer is currently running in this job.':''}`)) return;
    taskLogJobs=taskLogJobs.filter(j=>j.id!==job.id);
    taskLogActiveJobId=taskLogJobs[0]?.id ?? null;
    persistTaskLogJobs(true);
    renderTaskLogging();
    showTaskLogStatus(`${job.title} deleted.`,'ok');
  }

  function exportTaskLogJobs() {
    clearTaskLogStatus();
    if (!taskLogJobs.length) { showTaskLogStatus('There are no Task Logging jobs to export.','error'); return; }
    const payload={taskLogJobs:serializeTaskLogJobsRecord()};
    downloadTaskLogJson(`Fabrication-Task-Logging-Jobs-${new Date().toISOString().slice(0,10)}.json`,payload);
    showTaskLogStatus(`Exported ${taskLogJobs.length} Task Logging job${taskLogJobs.length===1?'':'s'}.`,'ok');
  }

  function exportTaskLogPresets() {
    clearTaskLogStatus();
    if (!taskLogPresets.length) { showTaskLogStatus('There are no preset tasks to export.','error'); return; }
    const payload={taskLogPresets:serializeTaskLogPresetsRecord()};
    downloadTaskLogJson(`Fabrication-Task-Presets-${new Date().toISOString().slice(0,10)}.json`,payload);
    showTaskLogStatus(`Exported ${taskLogPresets.length} preset task${taskLogPresets.length===1?'':'s'}.`,'ok');
  }

  function importTaskLogJobsFile(file) {
    if (!file) return;
    if (file.size>MAX_TASK_LOG_IMPORT_BYTES) { showTaskLogStatus('That Task Logging Jobs file is too large. Maximum import size is 2 MB.','error'); taskLogImportJobsFile.value=''; return; }
    const reader=new FileReader();
    reader.onload=async ()=>{
      try {
        const record=normalizeTaskLogJobsRecord(JSON.parse(String(reader.result||'')));
        if (taskLogJobs.length && !await confirmAppAction(`Import ${record.jobs.length} Task Logging job${record.jobs.length===1?'':'s'} and replace the jobs currently saved on this device? Preset tasks will not be changed.`)) return;
        if (taskLogJobs.length) await requireRecoverySnapshot('before-task-jobs-import');
        const stopped=finalizeImportedRunningTaskLogJobs(record);
        taskLogJobs=record.jobs;
        taskLogActiveJobId=record.activeJobId;
        taskLogNextJobId=record.nextJobId;
        taskLogNextTaskId=record.nextTaskId;
        persistTaskLogJobs(true);
        renderTaskLogging();
        showTaskLogStatus(`Imported ${taskLogJobs.length} Task Logging job${taskLogJobs.length===1?'':'s'}.${stopped?` ${stopped} running timer${stopped===1?' was':'s were'} safely stopped at the backup export time.`:''} Preset tasks were not changed.`,'ok');
      } catch (error) {
        showTaskLogStatus(error.message || 'Unable to import that Task Logging Jobs file.','error');
      } finally { taskLogImportJobsFile.value=''; }
    };
    reader.onerror=()=>{ showTaskLogStatus('The selected Task Logging Jobs file could not be read.','error'); taskLogImportJobsFile.value=''; };
    reader.readAsText(file);
  }

  function importTaskLogPresetsFile(file) {
    if (!file) return;
    if (file.size>MAX_TASK_LOG_IMPORT_BYTES) { showTaskLogStatus('That Task Presets file is too large. Maximum import size is 2 MB.','error'); taskLogImportPresetsFile.value=''; return; }
    const reader=new FileReader();
    reader.onload=async ()=>{
      try {
        const record=normalizeTaskLogPresetsRecord(JSON.parse(String(reader.result||'')));
        if (taskLogPresets.length && !await confirmAppAction(`Import ${record.presets.length} preset task${record.presets.length===1?'':'s'} and replace the preset library currently saved on this device? Existing jobs and their time logs will not be changed.`)) return;
        if (taskLogPresets.length) await requireRecoverySnapshot('before-task-presets-import');
        taskLogPresets=record.presets;
        taskLogNextPresetId=record.nextPresetId;
        taskLogSelectedPresetIds.clear();
        persistTaskLogPresets(true);
        renderTaskLogging();
        showTaskLogStatus(`Imported ${taskLogPresets.length} preset task${taskLogPresets.length===1?'':'s'}. Existing jobs and time logs were not changed.`,'ok');
      } catch (error) {
        showTaskLogStatus(error.message || 'Unable to import that Task Presets file.','error');
      } finally { taskLogImportPresetsFile.value=''; }
    };
    reader.onerror=()=>{ showTaskLogStatus('The selected Task Presets file could not be read.','error'); taskLogImportPresetsFile.value=''; };
    reader.readAsText(file);
  }

  function loadTaskLoggingData() {
    const jobsResult=loadPersistentStore('taskLogJobs');
    const jobsRecord=jobsResult.value;
    taskLogJobs=jobsRecord.jobs;
    taskLogActiveJobId=jobsRecord.activeJobId;
    taskLogNextJobId=jobsRecord.nextJobId;
    taskLogNextTaskId=jobsRecord.nextTaskId;
    if (jobsResult.status==='invalid' || jobsResult.status==='unsupported') {
      showTaskLogStatus('Saved Task Logging jobs could not be read. The original saved data was retained for recovery.','error');
    }

    const presetsResult=loadPersistentStore('taskLogPresets');
    const presetRecord=presetsResult.value;
    taskLogPresets=presetRecord.presets;
    taskLogNextPresetId=presetRecord.nextPresetId;
    if (presetsResult.status==='invalid' || presetsResult.status==='unsupported') {
      showTaskLogStatus('Saved Task Logging preset tasks could not be read. The original saved data was retained for recovery.','error');
    }
    reconcileShiftSchedule(Date.now());
    renderTaskLogging();
  }

  taskLogNewJobBtn.addEventListener('click',createTaskLogJob);
  taskLogPresetMenuBtn.addEventListener('click',()=>setTaskLogPresetDrawerOpen(!taskLogPresetDrawer.classList.contains('open')));
  taskLogPresetCloseBtn.addEventListener('click',()=>setTaskLogPresetDrawerOpen(false));
  taskLogPresetBackdrop.addEventListener('click',()=>setTaskLogPresetDrawerOpen(false));
  taskLogPresetDrawer.addEventListener('keydown',e=>{
    if (e.key==='Escape') { e.preventDefault(); setTaskLogPresetDrawerOpen(false); }
  });
  taskLogAddPresetBtn.addEventListener('click',addTaskLogPreset);
  taskLogPresetName.addEventListener('keydown',e=>{ if (e.key==='Enter') addTaskLogPreset(); });
  taskLogSelectAllPresetsBtn.addEventListener('click',toggleSelectAllTaskLogPresets);
  taskLogAddSelectedPresetsBtn.addEventListener('click',addSelectedPresetsToActiveTaskLogJob);
  taskLogPresetList.addEventListener('change',e=>{
    const checkbox=e.target.closest('[data-tasklog-select-preset]');
    if (!checkbox) return;
    const id=Number(checkbox.dataset.tasklogSelectPreset);
    if (checkbox.checked) taskLogSelectedPresetIds.add(id); else taskLogSelectedPresetIds.delete(id);
    renderTaskLogPresetLibrary();
  });
  taskLogPresetList.addEventListener('click',e=>{
    const removeBtn=e.target.closest('[data-tasklog-remove-assigned]');
    if (removeBtn) {
      const job=activeTaskLogJob();
      const presetId=Number(removeBtn.dataset.tasklogRemoveAssigned);
      const preset=taskLogPresets.find(item=>item.id===presetId);
      if (!job || !preset) return;
      const presetName=String(preset.name || '').toLocaleLowerCase();
      const task=job.tasks.find(item=>item.presetId===preset.id) || job.tasks.find(item=>String(item.name || '').toLocaleLowerCase()===presetName);
      if (task) removeTaskLogTask(task.id);
      return;
    }
    const deleteBtn=e.target.closest('[data-tasklog-delete-preset]');
    if (deleteBtn) deleteTaskLogPreset(Number(deleteBtn.dataset.tasklogDeletePreset));
  });
  taskLogJobList.addEventListener('click',e=>{
    const btn=e.target.closest('[data-tasklog-job-id]');
    if (!btn) return;
    taskLogActiveJobId=Number(btn.dataset.tasklogJobId);
    persistTaskLogJobs(false);
    renderTaskLogging();
  });
  taskLogJobTitle.addEventListener('click',openTaskLogRenameDialog);
  taskLogRenameCancelBtn.addEventListener('click',()=>setTaskLogRenameDialogOpen(false));
  taskLogRenameApplyBtn.addEventListener('click',applyTaskLogJobRenameFromDialog);
  taskLogRenameBackdrop.addEventListener('click',()=>setTaskLogRenameDialogOpen(false));
  taskLogRenameInput.addEventListener('input',()=>{
    taskLogRenameStatus.textContent='';
    taskLogRenameStatus.className='status';
  });
  taskLogRenameDialog.addEventListener('keydown',event=>{
    if (event.key==='Escape') {
      event.preventDefault();
      event.stopPropagation();
      setTaskLogRenameDialogOpen(false);
      return;
    }
    trapTaskLogRenameFocus(event);
  });
  taskLogPresetSelect.addEventListener('change',()=>{ taskLogAddTaskBtn.disabled=!taskLogPresetSelect.value; });
  taskLogAddTaskBtn.addEventListener('click',addPresetToActiveTaskLogJob);
  taskLogTaskList.addEventListener('click',e=>{
    const timerBtn=e.target.closest('[data-tasklog-timer-action]');
    if (timerBtn) {
      const id=Number(timerBtn.dataset.tasklogTaskId);
      timerBtn.dataset.tasklogTimerAction==='start' ? startTaskLogTask(id) : stopTaskLogTaskById(id,true);
      return;
    }
    const removeBtn=e.target.closest('[data-tasklog-remove-task]');
    if (removeBtn) removeTaskLogTask(Number(removeBtn.dataset.tasklogRemoveTask));
  });
  taskLogDeleteJobBtn.addEventListener('click',deleteActiveTaskLogJob);
  taskLogStopActiveBtn.addEventListener('click',stopActiveTaskLogTimer);
  taskLogExportJobsBtn.addEventListener('click',exportTaskLogJobs);
  taskLogExportPresetsBtn.addEventListener('click',exportTaskLogPresets);
  taskLogImportJobsBtn.addEventListener('click',()=>taskLogImportJobsFile.click());
  taskLogImportPresetsBtn.addEventListener('click',()=>taskLogImportPresetsFile.click());
  taskLogImportJobsFile.addEventListener('change',()=>importTaskLogJobsFile(taskLogImportJobsFile.files && taskLogImportJobsFile.files[0]));
  taskLogImportPresetsFile.addEventListener('change',()=>importTaskLogPresetsFile(taskLogImportPresetsFile.files && taskLogImportPresetsFile.files[0]));
  document.addEventListener('keydown',e=>{ if (e.key==='Escape' && taskLogPresetDrawer.classList.contains('open')) setTaskLogPresetDrawerOpen(false); });
  document.addEventListener('visibilitychange',()=>{ if (!document.hidden) { reconcileShiftSchedule(Date.now()); updateTaskLogTimerDisplays(); renderTaskLogJobs(); renderTaskLogRunningBanner(); } });
  window.addEventListener('pageshow',()=>{ reconcileShiftSchedule(Date.now()); updateTaskLogTimerDisplays(); renderTaskLogRunningBanner(); });
  window.addEventListener('focus',()=>{ reconcileShiftSchedule(Date.now()); updateTaskLogTimerDisplays(); renderTaskLogRunningBanner(); });
  setInterval(updateTaskLogTimerDisplays,1000);
  loadTaskLoggingData();

