(() => {
  // ---------------- App navigation + theme ----------------
  const root = document.documentElement;
  const themeToggle = document.getElementById('themeToggle');
  const themeColorMeta = document.getElementById('themeColorMeta');
  const pageLinks = Array.from(document.querySelectorAll('.fab-page-link'));
  const toolPanels = Array.from(document.querySelectorAll('.tool-panel'));
  const VALID_TOOLS = new Set(['overhang','fasteners','optimizer','saw','tasklog','notes','checklist','reference','calculator']);
  const drawerReturnFocus = new Map();
  let activeTool = 'overhang';

  function systemPrefersDark() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function applyTheme(theme) {
    root.dataset.theme = theme;
    themeToggle.textContent = theme === 'dark' ? '☀ Light' : '☾ Dark';
    themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    themeColorMeta.setAttribute('content', theme === 'dark' ? '#0b2940' : '#0f3b5d');
  }

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function storageSet(key,value) {
    try { localStorage.setItem(key,value); } catch (e) {}
  }


  function getDrawerParts(drawerId) {
    const drawer=document.getElementById(drawerId);
    const backdrop=document.getElementById(drawerId.replace(/Drawer$/,'Backdrop'));
    if (!drawer || !backdrop) return null;
    return {drawer,backdrop,close:drawer.querySelector('.cut-list-close-btn')};
  }

  function syncBodyDrawerState() {
    document.body.classList.toggle('cut-list-drawer-open',!!document.querySelector('.cut-list-drawer.open'));
  }

  function isDrawerOpen(drawerId) {
    return !!document.getElementById(drawerId)?.classList.contains('open');
  }

  function openDrawer(drawerId,returnFocusElement=document.activeElement) {
    const parts=getDrawerParts(drawerId);
    if (!parts) return false;
    drawerReturnFocus.set(drawerId,returnFocusElement || null);
    parts.drawer.classList.add('open');
    parts.backdrop.classList.add('open');
    parts.drawer.setAttribute('aria-hidden','false');
    parts.backdrop.setAttribute('aria-hidden','false');
    syncBodyDrawerState();
    if (parts.close) requestAnimationFrame(()=>parts.close.focus({preventScroll:true}));
    return true;
  }

  function closeDrawer(drawerId,returnFocusElement) {
    const parts=getDrawerParts(drawerId);
    if (!parts) return false;
    parts.drawer.classList.remove('open');
    parts.backdrop.classList.remove('open');
    parts.drawer.setAttribute('aria-hidden','true');
    parts.backdrop.setAttribute('aria-hidden','true');
    syncBodyDrawerState();
    const focusTarget=returnFocusElement || drawerReturnFocus.get(drawerId);
    drawerReturnFocus.delete(drawerId);
    if (focusTarget && typeof focusTarget.focus==='function') requestAnimationFrame(()=>focusTarget.focus({preventScroll:true}));
    return true;
  }

  function trapDrawerFocus(drawer,event) {
    if (event.key!=='Tab' || !drawer?.classList.contains('open')) return;
    const focusable=Array.from(drawer.querySelectorAll('button:not([disabled]),select:not([disabled]),input:not([disabled]),textarea:not([disabled]),[href],[tabindex]:not([tabindex="-1"])')).filter(el=>el.offsetParent!==null);
    if (!focusable.length) { event.preventDefault(); return; }
    const first=focusable[0],last=focusable[focusable.length-1];
    if (event.shiftKey && document.activeElement===first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement===last) { event.preventDefault(); first.focus(); }
  }

  document.addEventListener('keydown',event=>{
    const drawer=document.querySelector('.cut-list-drawer.open');
    if (drawer) trapDrawerFocus(drawer,event);
  });

  function getActiveTool() { return activeTool; }

  const savedTheme = storageGet('fabricationTheme');
  applyTheme(savedTheme || (systemPrefersDark() ? 'dark' : 'light'));

  themeToggle.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    storageSet('fabricationTheme', next);
  });

  function selectTool(tool) {
    const next=VALID_TOOLS.has(tool)?tool:'overhang';
    activeTool=next;
    pageLinks.forEach(link=>link.classList.toggle('active',link.dataset.tool===next));
    toolPanels.forEach(panel=>panel.classList.toggle('active',panel.id==='tool-'+next));
    storageSet('fabricationTool',next);
    window.scrollTo({top:0,behavior:'smooth'});
  }

  const pageMenuBtn=document.getElementById('pageMenuBtn');
  const pageMenuDrawer=document.getElementById('pageMenuDrawer');
  const pageMenuBackdrop=document.getElementById('pageMenuBackdrop');
  const pageMenuCloseBtn=document.getElementById('pageMenuCloseBtn');
  function setPageMenuOpen(open) {
    if (open) openDrawer('pageMenuDrawer',pageMenuBtn); else closeDrawer('pageMenuDrawer',pageMenuBtn);
    pageMenuBtn.setAttribute('aria-expanded',open?'true':'false');
  }
  pageMenuBtn.addEventListener('click',()=>setPageMenuOpen(!isDrawerOpen('pageMenuDrawer')));
  pageMenuCloseBtn.addEventListener('click',()=>setPageMenuOpen(false));
  pageMenuBackdrop.addEventListener('click',()=>setPageMenuOpen(false));
  pageMenuDrawer.addEventListener('click',event=>{
    const link=event.target.closest('.fab-page-link');
    if (!link) return;
    selectTool(link.dataset.tool);
    setPageMenuOpen(false);
  });
  document.addEventListener('keydown',event=>{
    if (event.key==='Escape' && isDrawerOpen('pageMenuDrawer')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setPageMenuOpen(false);
    }
  });

  const savedTool = storageGet('fabricationTool');
  selectTool(VALID_TOOLS.has(savedTool)?savedTool:'overhang');

  window.FabriCadabraApp={getActiveTool,openDrawer,closeDrawer,isDrawerOpen};

  // ---------------- Shared helpers ----------------
  function gcd(a,b) {
    a = Math.abs(a); b = Math.abs(b);
    while (b) { const t = b; b = a % b; a = t; }
    return a;
  }

  function trimZeros(n,maxDecimals=6) {
    return Number(n.toFixed(maxDecimals)).toString();
  }


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

  function persistTaskLogJobs(showError=true) {
    try {
      localStorage.setItem(TASK_LOG_JOBS_KEY,JSON.stringify(serializeTaskLogJobsRecord()));
      taskLogSaveState.textContent='Saved on this device';
      return true;
    } catch (error) {
      if (showError) showTaskLogStatus('This browser could not save Task Logging jobs locally. Export Jobs as a backup.','error');
      return false;
    }
  }

  function persistTaskLogPresets(showError=true) {
    try {
      localStorage.setItem(TASK_LOG_PRESETS_KEY,JSON.stringify(serializeTaskLogPresetsRecord()));
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
        return `<div class="tasklog-preset-row${assigned?' assigned':''}">
          <input class="tasklog-preset-check" type="checkbox" data-tasklog-select-preset="${preset.id}" aria-label="Select preset ${escapeHtml(preset.name)}"${checked?' checked':''}${unavailable?' disabled':''} />
          <div class="tasklog-preset-copy"><strong>${escapeHtml(preset.name)}</strong>${assigned?'<small>Already added to this job</small>':''}</div>
          <button class="tasklog-mini-delete" type="button" aria-label="Delete preset ${escapeHtml(preset.name)}" data-tasklog-delete-preset="${preset.id}">×</button>
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

  function renderTaskLogEditor() {
    const job=activeTaskLogJob();
    taskLogEmpty.style.display=job?'none':'block';
    taskLogEditor.classList.toggle('show',!!job);
    if (!job) return;
    taskLogJobTitle.value=job.title;
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
    requestAnimationFrame(()=>{ taskLogJobTitle.focus(); taskLogJobTitle.select(); });
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

  function deleteTaskLogPreset(id) {
    const preset=taskLogPresets.find(p=>p.id===id);
    if (!preset) return;
    if (!window.confirm(`Delete preset task “${preset.name}”? Existing jobs keep their already-assigned copy of this task.`)) return;
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

  function removeTaskLogTask(taskId) {
    const job=activeTaskLogJob();
    if (!job) return;
    const task=job.tasks.find(t=>t.id===taskId);
    if (!task) return;
    const warning=task.running ? ' It is currently running and will be removed without adding any more time.' : '';
    if (!window.confirm(`Remove “${task.name}” from ${job.title}? Its logged time and session history will be deleted.${warning}`)) return;
    job.tasks=job.tasks.filter(t=>t.id!==taskId);
    job.updatedAt=new Date().toISOString();
    persistTaskLogJobs(true);
    renderTaskLogging();
  }

  function deleteActiveTaskLogJob() {
    const job=activeTaskLogJob();
    if (!job) return;
    const running=job.tasks.some(t=>t.running);
    if (!window.confirm(`Delete ${job.title} and all of its task time logs?${running?' A timer is currently running in this job.':''}`)) return;
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
    reader.onload=()=>{
      try {
        const record=normalizeTaskLogJobsRecord(JSON.parse(String(reader.result||'')));
        if (taskLogJobs.length && !window.confirm(`Import ${record.jobs.length} Task Logging job${record.jobs.length===1?'':'s'} and replace the jobs currently saved on this device? Preset tasks will not be changed.`)) return;
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
    reader.onload=()=>{
      try {
        const record=normalizeTaskLogPresetsRecord(JSON.parse(String(reader.result||'')));
        if (taskLogPresets.length && !window.confirm(`Import ${record.presets.length} preset task${record.presets.length===1?'':'s'} and replace the preset library currently saved on this device? Existing jobs and their time logs will not be changed.`)) return;
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
    try {
      const rawJobs=storageGet(TASK_LOG_JOBS_KEY);
      if (rawJobs) {
        const record=normalizeTaskLogJobsRecord(JSON.parse(rawJobs));
        taskLogJobs=record.jobs;
        taskLogActiveJobId=record.activeJobId;
        taskLogNextJobId=record.nextJobId;
        taskLogNextTaskId=record.nextTaskId;
      }
    } catch (error) {
      taskLogJobs=[]; taskLogActiveJobId=null; taskLogNextJobId=1; taskLogNextTaskId=1;
      showTaskLogStatus('Saved Task Logging jobs could not be read. Exported backups are unaffected.','error');
    }
    try {
      const rawPresets=storageGet(TASK_LOG_PRESETS_KEY);
      if (rawPresets) {
        const record=normalizeTaskLogPresetsRecord(JSON.parse(rawPresets));
        taskLogPresets=record.presets;
        taskLogNextPresetId=record.nextPresetId;
      }
    } catch (error) {
      taskLogPresets=[]; taskLogNextPresetId=1;
      showTaskLogStatus('Saved Task Logging preset tasks could not be read. Exported backups are unaffected.','error');
    }
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
    const btn=e.target.closest('[data-tasklog-delete-preset]');
    if (btn) deleteTaskLogPreset(Number(btn.dataset.tasklogDeletePreset));
  });
  taskLogJobList.addEventListener('click',e=>{
    const btn=e.target.closest('[data-tasklog-job-id]');
    if (!btn) return;
    taskLogActiveJobId=Number(btn.dataset.tasklogJobId);
    persistTaskLogJobs(false);
    renderTaskLogging();
  });
  taskLogJobTitle.addEventListener('input',()=>{
    const job=activeTaskLogJob();
    if (!job) return;
    const value=taskLogJobTitle.value.slice(0,MAX_TASK_LOG_NAME);
    job.title=value;
    job.updatedAt=new Date().toISOString();
    scheduleTaskLogJobsSave();
    renderTaskLogJobs();
  });
  taskLogJobTitle.addEventListener('blur',()=>{
    const job=activeTaskLogJob();
    if (!job) return;
    const clean=String(job.title||'').trim().replace(/\s+/g,' ');
    if (!clean) { job.title=`Job ${job.id}`; taskLogJobTitle.value=job.title; }
    else { job.title=clean; taskLogJobTitle.value=clean; }
    job.updatedAt=new Date().toISOString();
    persistTaskLogJobs(true); renderTaskLogJobs();
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
  document.addEventListener('visibilitychange',()=>{ if (!document.hidden) { updateTaskLogTimerDisplays(); renderTaskLogJobs(); renderTaskLogRunningBanner(); } });
  window.addEventListener('pageshow',()=>{ updateTaskLogTimerDisplays(); renderTaskLogRunningBanner(); });
  setInterval(updateTaskLogTimerDisplays,1000);
  loadTaskLoggingData();

  // ---------------- Fabricator Notes ----------------
  const FABRICATOR_NOTES_KEY = 'fabricationFabricatorNotesV1';
  const FABRICATOR_NOTES_FORMAT = 'FabricationFabricatorNotes';
  const FABRICATOR_NOTES_VERSION = 2;
  const MAX_FABRICATOR_NOTE_TOPICS = 200;
  const MAX_FABRICATOR_NOTE_TITLE = 120;
  const MAX_FABRICATOR_NOTE_CONTENT = 200000;
  const MAX_FABRICATOR_NOTE_HTML = 600000;
  const MAX_FABRICATOR_NOTES_IMPORT_BYTES = 2 * 1024 * 1024;

  const fabricatorNotesNewBtn = document.getElementById('fabricatorNotesNewBtn');
  const fabricatorNotesExportBtn = document.getElementById('fabricatorNotesExportBtn');
  const fabricatorNotesImportBtn = document.getElementById('fabricatorNotesImportBtn');
  const fabricatorNotesImportFile = document.getElementById('fabricatorNotesImportFile');
  const fabricatorNotesStatus = document.getElementById('fabricatorNotesStatus');
  const fabricatorNotesCount = document.getElementById('fabricatorNotesCount');
  const fabricatorNotesTopicList = document.getElementById('fabricatorNotesTopicList');
  const fabricatorNotesEmpty = document.getElementById('fabricatorNotesEmpty');
  const fabricatorNotesEditor = document.getElementById('fabricatorNotesEditor');
  const fabricatorNotesTitle = document.getElementById('fabricatorNotesTitle');
  const fabricatorNotesContent = document.getElementById('fabricatorNotesContent');
  const fabricatorNotesFormatToolbar = document.getElementById('fabricatorNotesFormatToolbar');
  const fabricatorNotesFormatButtons = Array.from(fabricatorNotesFormatToolbar.querySelectorAll('[data-notes-command]'));
  const fabricatorNotesSaveState = document.getElementById('fabricatorNotesSaveState');
  const fabricatorNotesDeleteBtn = document.getElementById('fabricatorNotesDeleteBtn');

  let fabricatorNotes = [];
  let fabricatorNotesActiveId = null;
  let fabricatorNotesNextId = 1;
  let fabricatorNotesSaveTimer = null;
  let fabricatorNotesSavedSelection = null;

  function fabricatorNotesNow() {
    return new Date().toISOString();
  }

  function escapeFabricatorNotesText(text) {
    return String(text).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }

  function plainTextToFabricatorNoteHtml(text) {
    return escapeFabricatorNotesText(String(text || '')).replace(/\r\n?/g,'\n').replace(/\n/g,'<br>');
  }

  function sanitizeFabricatorNoteHtml(html) {
    const source = document.createElement('template');
    source.innerHTML = String(html || '');
    const allowed = new Set(['B','STRONG','I','EM','U','BR','DIV','P']);
    const out = document.createElement('div');

    function appendClean(node,parent) {
      if (node.nodeType === Node.TEXT_NODE) {
        parent.appendChild(document.createTextNode(node.nodeValue || ''));
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const tag = node.tagName.toUpperCase();
      if (allowed.has(tag)) {
        const normalizedTag = tag === 'STRONG' ? 'b' : tag === 'EM' ? 'i' : tag.toLowerCase();
        const clean = document.createElement(normalizedTag);
        for (const child of node.childNodes) appendClean(child,clean);
        parent.appendChild(clean);
      } else {
        for (const child of node.childNodes) appendClean(child,parent);
      }
    }

    for (const node of source.content.childNodes) appendClean(node,out);
    return out.innerHTML;
  }

  function fabricatorNotePlainTextLength(html) {
    const holder = document.createElement('div');
    holder.innerHTML = String(html || '');
    return (holder.textContent || '').length;
  }

  function normalizeFabricatorNotesRecord(raw) {
    const data = raw && raw.fabricatorNotes ? raw.fabricatorNotes : raw;
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('The file does not contain valid Fabricator Notes data.');
    if (data.format && data.format !== FABRICATOR_NOTES_FORMAT) throw new Error('This JSON file is not a Fabricator Notes export.');
    const version = Number(data.version || 1);
    if (!Number.isInteger(version) || version < 1) throw new Error('The Fabricator Notes file has an invalid version number.');
    if (version > FABRICATOR_NOTES_VERSION) throw new Error('These Fabricator Notes were created by a newer version of Fabrication Calculators and cannot be safely imported here.');
    if (!Array.isArray(data.topics)) throw new Error('The Fabricator Notes file is missing its topics list.');
    if (data.topics.length > MAX_FABRICATOR_NOTE_TOPICS) throw new Error(`The file contains more than ${MAX_FABRICATOR_NOTE_TOPICS} topics.`);

    const ids = new Set();
    const topics = data.topics.map((topic,index) => {
      if (!topic || typeof topic !== 'object' || Array.isArray(topic)) throw new Error(`Topic ${index+1} is invalid.`);
      const id = Number(topic.id);
      if (!Number.isInteger(id) || id < 1 || ids.has(id)) throw new Error(`Topic ${index+1} has an invalid or duplicate ID.`);
      ids.add(id);
      if (typeof topic.title !== 'string') throw new Error(`Topic ${index+1} has an invalid title.`);
      const title = topic.title.trim();
      if (!title) throw new Error(`Topic ${index+1} is missing a title.`);
      if (title.length > MAX_FABRICATOR_NOTE_TITLE) throw new Error(`Topic ${index+1} title exceeds ${MAX_FABRICATOR_NOTE_TITLE} characters.`);

      let contentHtml;
      if (version >= 2) {
        const rawHtml = topic.contentHtml ?? topic.content;
        if (typeof rawHtml !== 'string') throw new Error(`Topic ${index+1} has invalid note content.`);
        if (rawHtml.length > MAX_FABRICATOR_NOTE_HTML) throw new Error(`Topic ${index+1} formatted content is too large.`);
        contentHtml = sanitizeFabricatorNoteHtml(rawHtml);
      } else {
        if (typeof topic.content !== 'string') throw new Error(`Topic ${index+1} has invalid note content.`);
        if (topic.content.length > MAX_FABRICATOR_NOTE_CONTENT) throw new Error(`Topic ${index+1} content exceeds ${MAX_FABRICATOR_NOTE_CONTENT.toLocaleString()} characters.`);
        contentHtml = plainTextToFabricatorNoteHtml(topic.content);
      }
      if (contentHtml.length > MAX_FABRICATOR_NOTE_HTML || fabricatorNotePlainTextLength(contentHtml) > MAX_FABRICATOR_NOTE_CONTENT) {
        throw new Error(`Topic ${index+1} content exceeds the Fabricator Notes size limit.`);
      }

      const createdAt = typeof topic.createdAt === 'string' && Number.isFinite(Date.parse(topic.createdAt)) ? topic.createdAt : fabricatorNotesNow();
      const updatedAt = typeof topic.updatedAt === 'string' && Number.isFinite(Date.parse(topic.updatedAt)) ? topic.updatedAt : createdAt;
      return {id,title,contentHtml,createdAt,updatedAt};
    });

    const maxId = topics.reduce((max,topic)=>Math.max(max,topic.id),0);
    const requestedActive = Number(data.activeTopicId);
    const activeTopicId = topics.some(topic=>topic.id===requestedActive) ? requestedActive : (topics[0]?.id ?? null);
    const requestedNext = Number(data.nextId);
    const nextId = Math.max(maxId+1, Number.isInteger(requestedNext) && requestedNext > 0 ? requestedNext : 1);
    return {format:FABRICATOR_NOTES_FORMAT,version:FABRICATOR_NOTES_VERSION,activeTopicId,nextId,topics};
  }

  function serializeFabricatorNotesRecord() {
    const now = fabricatorNotesNow();
    return {
      format:FABRICATOR_NOTES_FORMAT,
      version:FABRICATOR_NOTES_VERSION,
      exportedAt:now,
      activeTopicId:fabricatorNotesActiveId,
      nextId:fabricatorNotesNextId,
      topics:fabricatorNotes.map(topic=>({
        id:topic.id,
        title:(String(topic.title || '').trim() || 'Untitled Topic').slice(0,MAX_FABRICATOR_NOTE_TITLE),
        contentHtml:sanitizeFabricatorNoteHtml(String(topic.contentHtml || '')).slice(0,MAX_FABRICATOR_NOTE_HTML),
        createdAt:topic.createdAt || now,
        updatedAt:topic.updatedAt || now
      }))
    };
  }

  function showFabricatorNotesStatus(message,type='ok') {
    fabricatorNotesStatus.textContent = message;
    fabricatorNotesStatus.className = `status show ${type}`;
  }

  function clearFabricatorNotesStatus() {
    fabricatorNotesStatus.textContent = '';
    fabricatorNotesStatus.className = 'status';
  }

  function activeFabricatorNote() {
    return fabricatorNotes.find(topic=>topic.id===fabricatorNotesActiveId) || null;
  }

  function formatFabricatorNoteUpdated(iso) {
    const date = new Date(iso);
    if (!Number.isFinite(date.getTime())) return 'Saved';
    return `Updated ${date.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}`;
  }

  function persistFabricatorNotes(showError=true) {
    if (fabricatorNotesSaveTimer) {
      clearTimeout(fabricatorNotesSaveTimer);
      fabricatorNotesSaveTimer = null;
    }
    try {
      localStorage.setItem(FABRICATOR_NOTES_KEY,JSON.stringify(serializeFabricatorNotesRecord()));
      fabricatorNotesSaveState.textContent = 'Saved on this device';
      return true;
    } catch (error) {
      fabricatorNotesSaveState.textContent = 'Unable to save locally';
      if (showError) showFabricatorNotesStatus('This browser could not save Fabricator Notes locally. Export your notes as a backup file.','error');
      return false;
    }
  }

  function scheduleFabricatorNotesSave() {
    fabricatorNotesSaveState.textContent = 'Saving…';
    if (fabricatorNotesSaveTimer) clearTimeout(fabricatorNotesSaveTimer);
    fabricatorNotesSaveTimer = setTimeout(()=>persistFabricatorNotes(true),250);
  }

  function renderFabricatorNotesTopics() {
    fabricatorNotesCount.textContent = fabricatorNotes.length;
    fabricatorNotesExportBtn.disabled = fabricatorNotes.length===0;
    fabricatorNotesTopicList.innerHTML = '';
    if (!fabricatorNotes.length) {
      const empty = document.createElement('div');
      empty.className = 'notes-empty';
      empty.textContent = 'No topics yet.';
      fabricatorNotesTopicList.appendChild(empty);
      return;
    }
    const ordered = fabricatorNotes.slice().sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)) || a.id-b.id);
    for (const topic of ordered) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `notes-topic-item${topic.id===fabricatorNotesActiveId?' active':''}`;
      button.dataset.noteTopicId = String(topic.id);
      button.setAttribute('aria-pressed',topic.id===fabricatorNotesActiveId?'true':'false');
      const title = document.createElement('strong');
      title.textContent = topic.title || 'Untitled Topic';
      const meta = document.createElement('small');
      meta.textContent = formatFabricatorNoteUpdated(topic.updatedAt);
      button.append(title,meta);
      fabricatorNotesTopicList.appendChild(button);
    }
  }

  function renderFabricatorNotesEditor() {
    const topic = activeFabricatorNote();
    fabricatorNotesEmpty.style.display = topic ? 'none' : 'block';
    fabricatorNotesEditor.classList.toggle('show',!!topic);
    if (!topic) {
      fabricatorNotesTitle.value = '';
      fabricatorNotesContent.innerHTML = '';
      fabricatorNotesSavedSelection = null;
      updateFabricatorNotesFormatButtons();
      return;
    }
    fabricatorNotesTitle.value = topic.title;
    fabricatorNotesContent.innerHTML = sanitizeFabricatorNoteHtml(topic.contentHtml || '');
    fabricatorNotesSavedSelection = null;
    fabricatorNotesSaveState.textContent = 'Saved on this device';
    updateFabricatorNotesFormatButtons();
  }

  function renderFabricatorNotes() {
    renderFabricatorNotesTopics();
    renderFabricatorNotesEditor();
  }

  function createFabricatorNoteTopic() {
    clearFabricatorNotesStatus();
    if (fabricatorNotes.length >= MAX_FABRICATOR_NOTE_TOPICS) {
      showFabricatorNotesStatus(`Fabricator Notes supports up to ${MAX_FABRICATOR_NOTE_TOPICS} topics.`,'error');
      return;
    }
    const now = fabricatorNotesNow();
    const topic = {id:fabricatorNotesNextId++,title:'New Topic',contentHtml:'',createdAt:now,updatedAt:now};
    fabricatorNotes.push(topic);
    fabricatorNotesActiveId = topic.id;
    persistFabricatorNotes();
    renderFabricatorNotes();
    requestAnimationFrame(()=>{ fabricatorNotesTitle.focus(); fabricatorNotesTitle.select(); });
  }

  function selectFabricatorNoteTopic(id) {
    if (!fabricatorNotes.some(topic=>topic.id===id)) return;
    fabricatorNotesActiveId = id;
    persistFabricatorNotes(false);
    renderFabricatorNotes();
  }

  function updateActiveFabricatorNoteTitle(value) {
    const topic = activeFabricatorNote();
    if (!topic) return;
    topic.title = String(value).slice(0,MAX_FABRICATOR_NOTE_TITLE);
    topic.updatedAt = fabricatorNotesNow();
    renderFabricatorNotesTopics();
    scheduleFabricatorNotesSave();
  }

  function normalizeActiveFabricatorNoteTitle() {
    const topic = activeFabricatorNote();
    if (!topic) return;
    const clean = String(topic.title || '').trim() || 'Untitled Topic';
    topic.title = clean.slice(0,MAX_FABRICATOR_NOTE_TITLE);
    fabricatorNotesTitle.value = topic.title;
    topic.updatedAt = fabricatorNotesNow();
    renderFabricatorNotesTopics();
    persistFabricatorNotes();
  }

  function updateActiveFabricatorNoteContent() {
    const topic = activeFabricatorNote();
    if (!topic) return;
    const cleanHtml = sanitizeFabricatorNoteHtml(fabricatorNotesContent.innerHTML);
    if (cleanHtml.length > MAX_FABRICATOR_NOTE_HTML || fabricatorNotePlainTextLength(cleanHtml) > MAX_FABRICATOR_NOTE_CONTENT) {
      fabricatorNotesContent.innerHTML = sanitizeFabricatorNoteHtml(topic.contentHtml || '');
      fabricatorNotesSavedSelection = null;
      showFabricatorNotesStatus(`Note content is limited to ${MAX_FABRICATOR_NOTE_CONTENT.toLocaleString()} text characters.`,'error');
      return;
    }
    topic.contentHtml = cleanHtml;
    topic.updatedAt = fabricatorNotesNow();
    scheduleFabricatorNotesSave();
  }

  function notesSelectionIsInsideEditor(range) {
    if (!range) return false;
    const node = range.commonAncestorContainer;
    return node === fabricatorNotesContent || fabricatorNotesContent.contains(node.nodeType===Node.ELEMENT_NODE ? node : node.parentNode);
  }

  function rememberFabricatorNotesSelection() {
    const selection = window.getSelection && window.getSelection();
    if (!selection || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (notesSelectionIsInsideEditor(range)) fabricatorNotesSavedSelection = range.cloneRange();
  }

  function restoreFabricatorNotesSelection() {
    if (!fabricatorNotesSavedSelection) return false;
    const selection = window.getSelection && window.getSelection();
    if (!selection) return false;
    try {
      selection.removeAllRanges();
      selection.addRange(fabricatorNotesSavedSelection);
      return true;
    } catch (error) {
      fabricatorNotesSavedSelection = null;
      return false;
    }
  }

  function updateFabricatorNotesFormatButtons() {
    const selection = window.getSelection && window.getSelection();
    const hasEditorSelection = !!(selection && selection.rangeCount && notesSelectionIsInsideEditor(selection.getRangeAt(0)));
    for (const button of fabricatorNotesFormatButtons) {
      let active = false;
      if (hasEditorSelection) {
        try { active = !!document.queryCommandState(button.dataset.notesCommand); } catch (error) {}
      }
      button.setAttribute('aria-pressed',active?'true':'false');
    }
  }

  function applyFabricatorNotesFormat(command) {
    const topic = activeFabricatorNote();
    if (!topic || !['bold','italic','underline'].includes(command)) return;
    fabricatorNotesContent.focus({preventScroll:true});
    restoreFabricatorNotesSelection();
    try { document.execCommand('styleWithCSS',false,false); } catch (error) {}
    try { document.execCommand(command,false,null); } catch (error) { return; }
    rememberFabricatorNotesSelection();
    updateActiveFabricatorNoteContent();
    updateFabricatorNotesFormatButtons();
  }

  function deleteActiveFabricatorNote() {
    const topic = activeFabricatorNote();
    if (!topic) return;
    if (!window.confirm(`Delete the topic “${topic.title || 'Untitled Topic'}”? This cannot be undone unless you have an exported backup.`)) return;
    const index = fabricatorNotes.findIndex(item=>item.id===topic.id);
    fabricatorNotes.splice(index,1);
    const remaining = fabricatorNotes.slice().sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)) || a.id-b.id);
    fabricatorNotesActiveId = remaining[0]?.id ?? null;
    persistFabricatorNotes();
    renderFabricatorNotes();
    showFabricatorNotesStatus('Topic deleted.','ok');
  }

  function safeFabricatorNotesExportName() {
    const date = new Date();
    const y = date.getFullYear();
    const m = String(date.getMonth()+1).padStart(2,'0');
    const d = String(date.getDate()).padStart(2,'0');
    return `Fabricator-Notes-${y}-${m}-${d}.json`;
  }

  function exportFabricatorNotes() {
    clearFabricatorNotesStatus();
    if (!fabricatorNotes.length) {
      showFabricatorNotesStatus('Create at least one topic before exporting notes.','error');
      return;
    }
    normalizeActiveFabricatorNoteTitle();
    const payload = {fabricatorNotes:serializeFabricatorNotesRecord()};
    const blob = new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = safeFabricatorNotesExportName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    showFabricatorNotesStatus(`Exported ${fabricatorNotes.length} topic${fabricatorNotes.length===1?'':'s'} as a portable JSON backup.`,'ok');
  }

  function applyFabricatorNotesRecord(record) {
    fabricatorNotes = record.topics.map(topic=>({...topic}));
    fabricatorNotesActiveId = record.activeTopicId;
    fabricatorNotesNextId = record.nextId;
    persistFabricatorNotes();
    renderFabricatorNotes();
  }

  function importFabricatorNotesFile(file) {
    if (!file) return;
    clearFabricatorNotesStatus();
    if (file.size > MAX_FABRICATOR_NOTES_IMPORT_BYTES) {
      showFabricatorNotesStatus(`That notes file is too large. Maximum import size is ${Math.round(MAX_FABRICATOR_NOTES_IMPORT_BYTES/1024/1024)} MB.`,'error');
      fabricatorNotesImportFile.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ''));
        const record = normalizeFabricatorNotesRecord(parsed);
        if (fabricatorNotes.length && !window.confirm(`Import ${record.topics.length} topic${record.topics.length===1?'':'s'} and replace the Fabricator Notes currently saved on this device?`)) return;
        applyFabricatorNotesRecord(record);
        showFabricatorNotesStatus(`Imported ${record.topics.length} topic${record.topics.length===1?'':'s'} and saved them on this device.`,'ok');
      } catch (error) {
        showFabricatorNotesStatus(error.message || 'Unable to import that Fabricator Notes file.','error');
      } finally {
        fabricatorNotesImportFile.value = '';
      }
    };
    reader.onerror = () => {
      showFabricatorNotesStatus('The selected Fabricator Notes file could not be read.','error');
      fabricatorNotesImportFile.value = '';
    };
    reader.readAsText(file);
  }

  function loadFabricatorNotesFromStorage() {
    const raw = storageGet(FABRICATOR_NOTES_KEY);
    if (!raw) {
      renderFabricatorNotes();
      return;
    }
    try {
      const record = normalizeFabricatorNotesRecord(JSON.parse(raw));
      fabricatorNotes = record.topics.map(topic=>({...topic}));
      fabricatorNotesActiveId = record.activeTopicId;
      fabricatorNotesNextId = record.nextId;
    } catch (error) {
      fabricatorNotes = [];
      fabricatorNotesActiveId = null;
      fabricatorNotesNextId = 1;
      showFabricatorNotesStatus('Saved Fabricator Notes data could not be read. Exported backups are unaffected.','error');
    }
    renderFabricatorNotes();
  }

  fabricatorNotesNewBtn.addEventListener('click',createFabricatorNoteTopic);
  fabricatorNotesExportBtn.addEventListener('click',exportFabricatorNotes);
  fabricatorNotesImportBtn.addEventListener('click',()=>fabricatorNotesImportFile.click());
  fabricatorNotesImportFile.addEventListener('change',()=>importFabricatorNotesFile(fabricatorNotesImportFile.files && fabricatorNotesImportFile.files[0]));
  fabricatorNotesTopicList.addEventListener('click',event=>{
    const button = event.target.closest('[data-note-topic-id]');
    if (button) selectFabricatorNoteTopic(Number(button.dataset.noteTopicId));
  });
  fabricatorNotesTitle.addEventListener('input',()=>updateActiveFabricatorNoteTitle(fabricatorNotesTitle.value));
  fabricatorNotesTitle.addEventListener('blur',normalizeActiveFabricatorNoteTitle);
  fabricatorNotesContent.addEventListener('input',()=>{ updateActiveFabricatorNoteContent(); rememberFabricatorNotesSelection(); updateFabricatorNotesFormatButtons(); });
  fabricatorNotesContent.addEventListener('focus',()=>{ rememberFabricatorNotesSelection(); updateFabricatorNotesFormatButtons(); });
  fabricatorNotesContent.addEventListener('keyup',()=>{ rememberFabricatorNotesSelection(); updateFabricatorNotesFormatButtons(); });
  fabricatorNotesContent.addEventListener('pointerup',()=>{ rememberFabricatorNotesSelection(); updateFabricatorNotesFormatButtons(); });
  fabricatorNotesContent.addEventListener('blur',()=>persistFabricatorNotes(false));
  fabricatorNotesContent.addEventListener('paste',event=>{
    const text = event.clipboardData && event.clipboardData.getData('text/plain');
    if (typeof text !== 'string') return;
    event.preventDefault();
    fabricatorNotesContent.focus({preventScroll:true});
    try { document.execCommand('insertText',false,text); }
    catch (error) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const node = document.createTextNode(text);
        range.insertNode(node);
        range.setStartAfter(node);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
    updateActiveFabricatorNoteContent();
    rememberFabricatorNotesSelection();
  });
  for (const button of fabricatorNotesFormatButtons) {
    button.addEventListener('mousedown',event=>event.preventDefault());
    button.addEventListener('click',()=>applyFabricatorNotesFormat(button.dataset.notesCommand));
  }
  document.addEventListener('selectionchange',()=>{
    const selection = window.getSelection && window.getSelection();
    if (selection && selection.rangeCount && notesSelectionIsInsideEditor(selection.getRangeAt(0))) {
      rememberFabricatorNotesSelection();
      updateFabricatorNotesFormatButtons();
    }
  });
  fabricatorNotesDeleteBtn.addEventListener('click',deleteActiveFabricatorNote);
  window.addEventListener('beforeunload',()=>{ if (fabricatorNotesSaveTimer) persistFabricatorNotes(false); });
  loadFabricatorNotesFromStorage();

  // ---------------- Checklist ----------------
  const FABRICATION_CHECKLIST_KEY = 'fabricationChecklistV1';
  const FABRICATION_CHECKLIST_FORMAT = 'FabricationChecklist';
  const FABRICATION_CHECKLIST_VERSION = 1;
  const MAX_CHECKLIST_TOPICS = 200;
  const MAX_CHECKLIST_ITEMS_PER_TOPIC = 500;
  const MAX_CHECKLIST_TITLE = 120;
  const MAX_CHECKLIST_ITEM_TEXT = 240;
  const MAX_CHECKLIST_IMPORT_BYTES = 2 * 1024 * 1024;

  const checklistNewTopicBtn = document.getElementById('checklistNewTopicBtn');
  const checklistExportBtn = document.getElementById('checklistExportBtn');
  const checklistImportBtn = document.getElementById('checklistImportBtn');
  const checklistImportFile = document.getElementById('checklistImportFile');
  const checklistStatus = document.getElementById('checklistStatus');
  const checklistTopicCount = document.getElementById('checklistTopicCount');
  const checklistTopicList = document.getElementById('checklistTopicList');
  const checklistEmpty = document.getElementById('checklistEmpty');
  const checklistEditor = document.getElementById('checklistEditor');
  const checklistTitle = document.getElementById('checklistTitle');
  const checklistNewItem = document.getElementById('checklistNewItem');
  const checklistAddItemBtn = document.getElementById('checklistAddItemBtn');
  const checklistProgressFill = document.getElementById('checklistProgressFill');
  const checklistProgressText = document.getElementById('checklistProgressText');
  const checklistItems = document.getElementById('checklistItems');
  const checklistSaveState = document.getElementById('checklistSaveState');
  const checklistDeleteTopicBtn = document.getElementById('checklistDeleteTopicBtn');

  let fabricationChecklists = [];
  let checklistActiveTopicId = null;
  let checklistNextTopicId = 1;
  let checklistNextItemId = 1;
  let checklistSaveTimer = null;

  function checklistNow() { return new Date().toISOString(); }

  function showChecklistStatus(message,type='ok') {
    checklistStatus.textContent = message;
    checklistStatus.className = `status show ${type}`;
  }

  function clearChecklistStatus() {
    checklistStatus.textContent = '';
    checklistStatus.className = 'status';
  }

  function activeChecklistTopic() {
    return fabricationChecklists.find(topic=>topic.id===checklistActiveTopicId) || null;
  }

  function normalizeChecklistRecord(raw) {
    const data = raw && raw.fabricationChecklist ? raw.fabricationChecklist : raw;
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('The file does not contain valid Checklist data.');
    if (data.format && data.format !== FABRICATION_CHECKLIST_FORMAT) throw new Error('This JSON file is not a Fabrication Checklist export.');
    const version = Number(data.version || 1);
    if (!Number.isInteger(version) || version < 1) throw new Error('The Checklist file has an invalid version number.');
    if (version > FABRICATION_CHECKLIST_VERSION) throw new Error('These checklists were created by a newer version of Fabrication Calculators and cannot be safely imported here.');
    if (!Array.isArray(data.topics)) throw new Error('The Checklist file is missing its topics list.');
    if (data.topics.length > MAX_CHECKLIST_TOPICS) throw new Error(`The file contains more than ${MAX_CHECKLIST_TOPICS} checklist topics.`);

    const topicIds = new Set();
    const itemIds = new Set();
    const topics = data.topics.map((topic,index)=>{
      if (!topic || typeof topic !== 'object' || Array.isArray(topic)) throw new Error(`Checklist topic ${index+1} is invalid.`);
      const id = Number(topic.id);
      if (!Number.isInteger(id) || id < 1 || topicIds.has(id)) throw new Error(`Checklist topic ${index+1} has an invalid or duplicate ID.`);
      topicIds.add(id);
      if (typeof topic.title !== 'string') throw new Error(`Checklist topic ${index+1} has an invalid title.`);
      const title = topic.title.trim();
      if (!title) throw new Error(`Checklist topic ${index+1} is missing a title.`);
      if (title.length > MAX_CHECKLIST_TITLE) throw new Error(`Checklist topic ${index+1} title exceeds ${MAX_CHECKLIST_TITLE} characters.`);
      if (!Array.isArray(topic.items)) throw new Error(`Checklist topic ${index+1} is missing its items list.`);
      if (topic.items.length > MAX_CHECKLIST_ITEMS_PER_TOPIC) throw new Error(`Checklist topic ${index+1} contains more than ${MAX_CHECKLIST_ITEMS_PER_TOPIC} items.`);
      const items = topic.items.map((item,itemIndex)=>{
        if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`Item ${itemIndex+1} in checklist topic ${index+1} is invalid.`);
        const itemId = Number(item.id);
        if (!Number.isInteger(itemId) || itemId < 1 || itemIds.has(itemId)) throw new Error(`Item ${itemIndex+1} in checklist topic ${index+1} has an invalid or duplicate ID.`);
        itemIds.add(itemId);
        if (typeof item.text !== 'string') throw new Error(`Item ${itemIndex+1} in checklist topic ${index+1} has invalid text.`);
        const text = item.text.trim();
        if (!text) throw new Error(`Item ${itemIndex+1} in checklist topic ${index+1} is blank.`);
        if (text.length > MAX_CHECKLIST_ITEM_TEXT) throw new Error(`Item ${itemIndex+1} in checklist topic ${index+1} exceeds ${MAX_CHECKLIST_ITEM_TEXT} characters.`);
        return {id:itemId,text,checked:item.checked===true};
      });
      const createdAt = typeof topic.createdAt === 'string' && Number.isFinite(Date.parse(topic.createdAt)) ? topic.createdAt : checklistNow();
      const updatedAt = typeof topic.updatedAt === 'string' && Number.isFinite(Date.parse(topic.updatedAt)) ? topic.updatedAt : createdAt;
      return {id,title,items,createdAt,updatedAt};
    });

    const maxTopicId = topics.reduce((max,topic)=>Math.max(max,topic.id),0);
    const maxItemId = topics.reduce((max,topic)=>Math.max(max,...topic.items.map(item=>item.id),0),0);
    const requestedActive = Number(data.activeTopicId);
    const activeTopicId = topics.some(topic=>topic.id===requestedActive) ? requestedActive : (topics[0]?.id ?? null);
    const requestedNextTopic = Number(data.nextTopicId);
    const requestedNextItem = Number(data.nextItemId);
    const nextTopicId = Math.max(maxTopicId+1,Number.isInteger(requestedNextTopic)&&requestedNextTopic>0?requestedNextTopic:1);
    const nextItemId = Math.max(maxItemId+1,Number.isInteger(requestedNextItem)&&requestedNextItem>0?requestedNextItem:1);
    return {format:FABRICATION_CHECKLIST_FORMAT,version:FABRICATION_CHECKLIST_VERSION,activeTopicId,nextTopicId,nextItemId,topics};
  }

  function serializeChecklistRecord() {
    return {
      format:FABRICATION_CHECKLIST_FORMAT,
      version:FABRICATION_CHECKLIST_VERSION,
      exportedAt:checklistNow(),
      activeTopicId:checklistActiveTopicId,
      nextTopicId:checklistNextTopicId,
      nextItemId:checklistNextItemId,
      topics:fabricationChecklists.map(topic=>({
        id:topic.id,
        title:(String(topic.title || '').trim() || 'Untitled Checklist').slice(0,MAX_CHECKLIST_TITLE),
        items:topic.items.map(item=>({id:item.id,text:String(item.text || '').trim().slice(0,MAX_CHECKLIST_ITEM_TEXT),checked:item.checked===true})),
        createdAt:topic.createdAt,
        updatedAt:topic.updatedAt
      }))
    };
  }

  function persistChecklists(showError=true) {
    if (checklistSaveTimer) {
      clearTimeout(checklistSaveTimer);
      checklistSaveTimer = null;
    }
    try {
      localStorage.setItem(FABRICATION_CHECKLIST_KEY,JSON.stringify(serializeChecklistRecord()));
      checklistSaveState.textContent = 'Saved on this device';
      return true;
    } catch (error) {
      checklistSaveState.textContent = 'Unable to save locally';
      if (showError) showChecklistStatus('This browser could not save checklists locally. Export them as a backup file.','error');
      return false;
    }
  }

  function scheduleChecklistSave() {
    checklistSaveState.textContent = 'Saving…';
    if (checklistSaveTimer) clearTimeout(checklistSaveTimer);
    checklistSaveTimer = setTimeout(()=>persistChecklists(true),250);
  }

  function checklistUpdatedText(iso) {
    const date = new Date(iso);
    if (!Number.isFinite(date.getTime())) return 'Saved';
    return `Updated ${date.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}`;
  }

  function checklistProgress(topic) {
    const total = topic?.items?.length || 0;
    const checked = topic ? topic.items.filter(item=>item.checked).length : 0;
    return {checked,total,pct:total ? checked/total*100 : 0};
  }

  function renderChecklistTopics() {
    checklistTopicCount.textContent = fabricationChecklists.length;
    checklistExportBtn.disabled = fabricationChecklists.length===0;
    checklistTopicList.innerHTML = '';
    if (!fabricationChecklists.length) {
      const empty = document.createElement('div');
      empty.className = 'checklist-empty';
      empty.textContent = 'No checklist topics yet.';
      checklistTopicList.appendChild(empty);
      return;
    }
    const ordered = fabricationChecklists.slice().sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)) || a.id-b.id);
    for (const topic of ordered) {
      const progress = checklistProgress(topic);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `checklist-topic-item${topic.id===checklistActiveTopicId?' active':''}`;
      button.dataset.checklistTopicId = String(topic.id);
      button.setAttribute('aria-pressed',topic.id===checklistActiveTopicId?'true':'false');
      const title = document.createElement('strong');
      title.textContent = topic.title || 'Untitled Checklist';
      const meta = document.createElement('small');
      meta.textContent = `${progress.checked} of ${progress.total} complete • ${checklistUpdatedText(topic.updatedAt)}`;
      button.append(title,meta);
      checklistTopicList.appendChild(button);
    }
  }

  function renderChecklistItems() {
    const topic = activeChecklistTopic();
    checklistItems.innerHTML = '';
    if (!topic || !topic.items.length) {
      const empty = document.createElement('div');
      empty.className = 'checklist-empty';
      empty.textContent = topic ? 'No checklist items yet. Add the first item above.' : '';
      if (topic) checklistItems.appendChild(empty);
    } else {
      for (const item of topic.items) {
        const row = document.createElement('div');
        row.className = `checklist-item${item.checked?' checked':''}`;
        row.dataset.checklistItemId = String(item.id);

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'checklist-box';
        checkbox.checked = item.checked;
        checkbox.dataset.checklistToggleId = String(item.id);
        checkbox.setAttribute('aria-label',`${item.checked?'Mark incomplete':'Mark complete'}: ${item.text}`);

        const text = document.createElement('input');
        text.type = 'text';
        text.className = 'checklist-item-text';
        text.maxLength = MAX_CHECKLIST_ITEM_TEXT;
        text.value = item.text;
        text.dataset.checklistTextId = String(item.id);
        text.setAttribute('aria-label','Checklist item');

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'checklist-remove-item';
        remove.dataset.checklistRemoveId = String(item.id);
        remove.setAttribute('aria-label',`Remove checklist item: ${item.text}`);
        remove.textContent = '×';
        row.append(checkbox,text,remove);
        checklistItems.appendChild(row);
      }
    }
    const progress = checklistProgress(topic);
    checklistProgressText.textContent = `${progress.checked} of ${progress.total} complete`;
    checklistProgressFill.style.width = `${progress.pct}%`;
  }

  function renderChecklistEditor() {
    const topic = activeChecklistTopic();
    checklistEmpty.style.display = topic ? 'none' : 'block';
    checklistEditor.classList.toggle('show',!!topic);
    checklistNewItem.disabled = !topic;
    checklistAddItemBtn.disabled = !topic;
    if (!topic) {
      checklistTitle.value = '';
      checklistNewItem.value = '';
      checklistItems.innerHTML = '';
      checklistProgressText.textContent = '0 of 0 complete';
      checklistProgressFill.style.width = '0%';
      return;
    }
    checklistTitle.value = topic.title;
    checklistSaveState.textContent = 'Saved on this device';
    renderChecklistItems();
  }

  function renderChecklists() {
    renderChecklistTopics();
    renderChecklistEditor();
  }

  function createChecklistTopic() {
    clearChecklistStatus();
    if (fabricationChecklists.length >= MAX_CHECKLIST_TOPICS) {
      showChecklistStatus(`Checklist supports up to ${MAX_CHECKLIST_TOPICS} topics.`,'error');
      return;
    }
    const now = checklistNow();
    const topic = {id:checklistNextTopicId++,title:'New Checklist',items:[],createdAt:now,updatedAt:now};
    fabricationChecklists.push(topic);
    checklistActiveTopicId = topic.id;
    persistChecklists();
    renderChecklists();
    requestAnimationFrame(()=>{ checklistTitle.focus(); checklistTitle.select(); });
  }

  function selectChecklistTopic(id) {
    if (!fabricationChecklists.some(topic=>topic.id===id)) return;
    checklistActiveTopicId = id;
    persistChecklists(false);
    renderChecklists();
  }

  function updateChecklistTitle(value) {
    const topic = activeChecklistTopic();
    if (!topic) return;
    topic.title = String(value).slice(0,MAX_CHECKLIST_TITLE);
    topic.updatedAt = checklistNow();
    renderChecklistTopics();
    scheduleChecklistSave();
  }

  function normalizeChecklistTitle() {
    const topic = activeChecklistTopic();
    if (!topic) return;
    topic.title = (String(topic.title || '').trim() || 'Untitled Checklist').slice(0,MAX_CHECKLIST_TITLE);
    topic.updatedAt = checklistNow();
    checklistTitle.value = topic.title;
    renderChecklistTopics();
    persistChecklists();
  }

  function addChecklistItem() {
    clearChecklistStatus();
    const topic = activeChecklistTopic();
    if (!topic) {
      showChecklistStatus('Create a checklist topic first.','error');
      return;
    }
    if (topic.items.length >= MAX_CHECKLIST_ITEMS_PER_TOPIC) {
      showChecklistStatus(`A checklist topic supports up to ${MAX_CHECKLIST_ITEMS_PER_TOPIC} items.`,'error');
      return;
    }
    const text = String(checklistNewItem.value || '').trim();
    if (!text) {
      showChecklistStatus('Enter a checklist item before adding it.','error');
      checklistNewItem.focus();
      return;
    }
    topic.items.push({id:checklistNextItemId++,text:text.slice(0,MAX_CHECKLIST_ITEM_TEXT),checked:false});
    topic.updatedAt = checklistNow();
    checklistNewItem.value = '';
    persistChecklists();
    renderChecklistTopics();
    renderChecklistItems();
    checklistNewItem.focus();
  }

  function findChecklistItem(id) {
    const topic = activeChecklistTopic();
    if (!topic) return null;
    return topic.items.find(item=>item.id===id) || null;
  }

  function toggleChecklistItem(id,checked) {
    const topic = activeChecklistTopic();
    const item = findChecklistItem(id);
    if (!topic || !item) return;
    item.checked = !!checked;
    topic.updatedAt = checklistNow();
    persistChecklists();
    renderChecklistTopics();
    renderChecklistItems();
  }

  function updateChecklistItemText(id,value) {
    const topic = activeChecklistTopic();
    const item = findChecklistItem(id);
    if (!topic || !item) return;
    item.text = String(value).slice(0,MAX_CHECKLIST_ITEM_TEXT);
    topic.updatedAt = checklistNow();
    scheduleChecklistSave();
  }

  function normalizeChecklistItemText(id,input) {
    const topic = activeChecklistTopic();
    const item = findChecklistItem(id);
    if (!topic || !item) return;
    const text = String(item.text || '').trim();
    if (!text) {
      if (!window.confirm('This checklist item is blank. Remove it?')) {
        input.value = 'Checklist Item';
        item.text = 'Checklist Item';
      } else {
        topic.items = topic.items.filter(entry=>entry.id!==id);
      }
    } else {
      item.text = text.slice(0,MAX_CHECKLIST_ITEM_TEXT);
      input.value = item.text;
    }
    topic.updatedAt = checklistNow();
    persistChecklists();
    renderChecklistTopics();
    renderChecklistItems();
  }

  function removeChecklistItem(id) {
    const topic = activeChecklistTopic();
    const item = findChecklistItem(id);
    if (!topic || !item) return;
    if (!window.confirm(`Remove “${item.text}” from this checklist?`)) return;
    topic.items = topic.items.filter(entry=>entry.id!==id);
    topic.updatedAt = checklistNow();
    persistChecklists();
    renderChecklistTopics();
    renderChecklistItems();
  }

  function deleteChecklistTopic() {
    const topic = activeChecklistTopic();
    if (!topic) return;
    if (!window.confirm(`Delete the checklist “${topic.title || 'Untitled Checklist'}”? This cannot be undone unless you have an exported backup.`)) return;
    fabricationChecklists = fabricationChecklists.filter(entry=>entry.id!==topic.id);
    const ordered = fabricationChecklists.slice().sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)) || a.id-b.id);
    checklistActiveTopicId = ordered[0]?.id ?? null;
    persistChecklists();
    renderChecklists();
    showChecklistStatus('Checklist topic deleted.','ok');
  }

  function checklistExportFileName() {
    const date = new Date();
    const y = date.getFullYear();
    const m = String(date.getMonth()+1).padStart(2,'0');
    const d = String(date.getDate()).padStart(2,'0');
    return `Fabrication-Checklists-${y}-${m}-${d}.json`;
  }

  function exportChecklists() {
    clearChecklistStatus();
    if (!fabricationChecklists.length) {
      showChecklistStatus('Create at least one checklist topic before exporting.','error');
      return;
    }
    normalizeChecklistTitle();
    const payload = {fabricationChecklist:serializeChecklistRecord()};
    const blob = new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = checklistExportFileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    showChecklistStatus(`Exported ${fabricationChecklists.length} checklist topic${fabricationChecklists.length===1?'':'s'} as a portable JSON backup.`,'ok');
  }

  function applyChecklistRecord(record) {
    fabricationChecklists = record.topics.map(topic=>({...topic,items:topic.items.map(item=>({...item}))}));
    checklistActiveTopicId = record.activeTopicId;
    checklistNextTopicId = record.nextTopicId;
    checklistNextItemId = record.nextItemId;
    persistChecklists();
    renderChecklists();
  }

  function importChecklistFile(file) {
    if (!file) return;
    clearChecklistStatus();
    if (file.size > MAX_CHECKLIST_IMPORT_BYTES) {
      showChecklistStatus(`That checklist file is too large. Maximum import size is ${Math.round(MAX_CHECKLIST_IMPORT_BYTES/1024/1024)} MB.`,'error');
      checklistImportFile.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ''));
        const record = normalizeChecklistRecord(parsed);
        if (fabricationChecklists.length && !window.confirm(`Import ${record.topics.length} checklist topic${record.topics.length===1?'':'s'} and replace the checklists currently saved on this device?`)) return;
        applyChecklistRecord(record);
        showChecklistStatus(`Imported ${record.topics.length} checklist topic${record.topics.length===1?'':'s'} and saved them on this device.`,'ok');
      } catch (error) {
        showChecklistStatus(error.message || 'Unable to import that Checklist file.','error');
      } finally {
        checklistImportFile.value = '';
      }
    };
    reader.onerror = () => {
      showChecklistStatus('The selected Checklist file could not be read.','error');
      checklistImportFile.value = '';
    };
    reader.readAsText(file);
  }

  function loadChecklistsFromStorage() {
    const raw = storageGet(FABRICATION_CHECKLIST_KEY);
    if (!raw) {
      renderChecklists();
      return;
    }
    try {
      const record = normalizeChecklistRecord(JSON.parse(raw));
      fabricationChecklists = record.topics.map(topic=>({...topic,items:topic.items.map(item=>({...item}))}));
      checklistActiveTopicId = record.activeTopicId;
      checklistNextTopicId = record.nextTopicId;
      checklistNextItemId = record.nextItemId;
    } catch (error) {
      fabricationChecklists = [];
      checklistActiveTopicId = null;
      checklistNextTopicId = 1;
      checklistNextItemId = 1;
      showChecklistStatus('Saved Checklist data could not be read. Exported backups are unaffected.','error');
    }
    renderChecklists();
  }

  checklistNewTopicBtn.addEventListener('click',createChecklistTopic);
  checklistExportBtn.addEventListener('click',exportChecklists);
  checklistImportBtn.addEventListener('click',()=>checklistImportFile.click());
  checklistImportFile.addEventListener('change',()=>importChecklistFile(checklistImportFile.files && checklistImportFile.files[0]));
  checklistTopicList.addEventListener('click',event=>{
    const button = event.target.closest('[data-checklist-topic-id]');
    if (button) selectChecklistTopic(Number(button.dataset.checklistTopicId));
  });
  checklistTitle.addEventListener('input',()=>updateChecklistTitle(checklistTitle.value));
  checklistTitle.addEventListener('blur',normalizeChecklistTitle);
  checklistNewItem.addEventListener('keydown',event=>{ if (event.key==='Enter') addChecklistItem(); });
  checklistAddItemBtn.addEventListener('click',addChecklistItem);
  checklistItems.addEventListener('change',event=>{
    const checkbox = event.target.closest('[data-checklist-toggle-id]');
    if (checkbox) toggleChecklistItem(Number(checkbox.dataset.checklistToggleId),checkbox.checked);
  });
  checklistItems.addEventListener('input',event=>{
    const input = event.target.closest('[data-checklist-text-id]');
    if (input) updateChecklistItemText(Number(input.dataset.checklistTextId),input.value);
  });
  checklistItems.addEventListener('focusout',event=>{
    const input = event.target.closest('[data-checklist-text-id]');
    if (input) normalizeChecklistItemText(Number(input.dataset.checklistTextId),input);
  });
  checklistItems.addEventListener('click',event=>{
    const button = event.target.closest('[data-checklist-remove-id]');
    if (button) removeChecklistItem(Number(button.dataset.checklistRemoveId));
  });
  checklistDeleteTopicBtn.addEventListener('click',deleteChecklistTopic);
  window.addEventListener('beforeunload',()=>{ if (checklistSaveTimer) persistChecklists(false); });
  loadChecklistsFromStorage();

  // ---------------- Quick Reference ----------------
  const quickReferenceSelect = document.getElementById('quickReferenceSelect');
  const quickReferenceCount = document.getElementById('quickReferenceCount');
  const quickReferenceTitle = document.getElementById('quickReferenceTitle');
  const quickReferenceDescription = document.getElementById('quickReferenceDescription');
  const quickReferenceTableHeading = document.getElementById('quickReferenceTableHeading');
  const quickReferenceBadge = document.getElementById('quickReferenceBadge');
  const quickReferenceExample = document.getElementById('quickReferenceExample');
  const quickReferenceTable = document.getElementById('quickReferenceTable');
  const quickReferenceDecimalMode = document.getElementById('quickReferenceDecimalMode');
  const quickReferenceDisplayMode = document.querySelector('.quick-ref-display-mode');
  const quickReferenceFractionLabel = document.getElementById('quickReferenceFractionLabel');
  const quickReferenceDecimalLabel = document.getElementById('quickReferenceDecimalLabel');
  const quickReferenceKeyElements = [1,2,3].map(n=>({
    icon:document.getElementById(`quickReferenceKey${n}Icon`),
    title:document.getElementById(`quickReferenceKey${n}Title`),
    text:document.getElementById(`quickReferenceKey${n}Text`)
  }));
  const QUICK_REFERENCE_DECIMAL_KEY = 'fabricationQuickReferenceDecimalMode';
  const quickReferenceSelections = {
    'fraction-addition': null,
    'fraction-decimal': null,
    'fraction-sixtyfourths': null,
    'gauge-thickness': null
  };

  function fractionFromSixteenths(totalSixteenths) {
    const whole = Math.floor(totalSixteenths / 16);
    const rem = totalSixteenths % 16;
    if (rem === 0) return `${whole}"`;
    const d = gcd(rem,16);
    const num = rem / d;
    const den = 16 / d;
    return whole > 0 ? `${whole} ${num}/${den}"` : `${num}/${den}"`;
  }

  function fractionFromThirtySeconds(totalThirtySeconds) {
    const whole = Math.floor(totalThirtySeconds / 32);
    const rem = totalThirtySeconds % 32;
    if (rem === 0) return `${whole}"`;
    const d = gcd(rem,32);
    const num = rem / d;
    const den = 32 / d;
    return whole > 0 ? `${whole} ${num}/${den}"` : `${num}/${den}"`;
  }

  function fractionFromSixtyFourths(totalSixtyFourths) {
    const whole = Math.floor(totalSixtyFourths / 64);
    const rem = totalSixtyFourths % 64;
    if (rem === 0) return `${whole}"`;
    const d = gcd(rem,64);
    const num = rem / d;
    const den = 64 / d;
    return whole > 0 ? `${whole} ${num}/${den}"` : `${num}/${den}"`;
  }

  function quickReferenceDecimal(value) {
    return Number(value).toFixed(3);
  }

  function quickReferenceSixteenthText(totalSixteenths) {
    return quickReferenceDecimalMode.checked
      ? quickReferenceDecimal(totalSixteenths / 16)
      : fractionFromSixteenths(totalSixteenths);
  }

  function quickReferenceThirtySecondText(totalThirtySeconds) {
    return quickReferenceDecimalMode.checked
      ? quickReferenceDecimal(totalThirtySeconds / 32)
      : fractionFromThirtySeconds(totalThirtySeconds);
  }

  function quickReferenceSixtyFourthText(totalSixtyFourths) {
    return quickReferenceDecimalMode.checked
      ? quickReferenceDecimal(totalSixtyFourths / 64)
      : fractionFromSixtyFourths(totalSixtyFourths);
  }

  function renderFractionAdditionReference() {
    const values = Array.from({length:16},(_,i)=>i+1);
    const headerCells = values.map(v =>
      `<th scope="col" data-qr-sixteenths="${v}" data-add-sixteenths="${v}">${fractionFromSixteenths(v)}</th>`
    ).join('');

    const rows = values.map(start => {
      const cells = values.map(add => {
        const sum = start + add;
        const classAttr = sum % 16 === 0 ? ' class="whole-result"' : '';
        return `<td${classAttr} data-qr-sixteenths="${sum}" data-start-sixteenths="${start}" data-add-sixteenths="${add}" tabindex="0" role="button" aria-label="${fractionFromSixteenths(start)} plus ${fractionFromSixteenths(add)} equals ${fractionFromSixteenths(sum)}">${fractionFromSixteenths(sum)}</td>`;
      }).join('');
      return `<tr><th scope="row" data-qr-sixteenths="${start}" data-start-sixteenths="${start}">${fractionFromSixteenths(start)}</th>${cells}</tr>`;
    }).join('');

    quickReferenceTable.innerHTML = `
      <table class="quick-ref-table">
        <thead>
          <tr>
            <th scope="col">START ↓<br>ADD →</th>
            ${headerCells}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  function renderThirtySecondAdditionReference() {
    const values = Array.from({length:32},(_,i)=>i+1);
    const headerCells = values.map(v =>
      `<th scope="col" data-qr-thirtyseconds="${v}" data-add-thirtyseconds="${v}">${fractionFromThirtySeconds(v)}</th>`
    ).join('');

    const rows = values.map(start => {
      const cells = values.map(add => {
        const sum = start + add;
        const classAttr = sum % 32 === 0 ? ' class="whole-result"' : '';
        return `<td${classAttr} data-qr-thirtyseconds="${sum}" data-start-thirtyseconds="${start}" data-add-thirtyseconds="${add}" tabindex="0" role="button" aria-label="${fractionFromThirtySeconds(start)} plus ${fractionFromThirtySeconds(add)} equals ${fractionFromThirtySeconds(sum)}">${fractionFromThirtySeconds(sum)}</td>`;
      }).join('');
      return `<tr><th scope="row" data-qr-thirtyseconds="${start}" data-start-thirtyseconds="${start}">${fractionFromThirtySeconds(start)}</th>${cells}</tr>`;
    }).join('');

    quickReferenceTable.innerHTML = `
      <table class="quick-ref-table">
        <thead>
          <tr>
            <th scope="col">START ↓<br>ADD →</th>
            ${headerCells}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  function renderSixtyFourthAdditionReference() {
    const values = Array.from({length:64},(_,i)=>i+1);
    const headerCells = values.map(v =>
      `<th scope="col" data-qr-sixtyfourths="${v}" data-add-sixtyfourths="${v}">${fractionFromSixtyFourths(v)}</th>`
    ).join('');

    const rows = values.map(start => {
      const cells = values.map(add => {
        const sum = start + add;
        const classAttr = sum % 64 === 0 ? ' class="whole-result"' : '';
        return `<td${classAttr} data-qr-sixtyfourths="${sum}" data-start-sixtyfourths="${start}" data-add-sixtyfourths="${add}" tabindex="0" role="button" aria-label="${fractionFromSixtyFourths(start)} plus ${fractionFromSixtyFourths(add)} equals ${fractionFromSixtyFourths(sum)}">${fractionFromSixtyFourths(sum)}</td>`;
      }).join('');
      return `<tr><th scope="row" data-qr-sixtyfourths="${start}" data-start-sixtyfourths="${start}">${fractionFromSixtyFourths(start)}</th>${cells}</tr>`;
    }).join('');

    quickReferenceTable.innerHTML = `
      <table class="quick-ref-table">
        <thead>
          <tr>
            <th scope="col">START ↓<br>ADD →</th>
            ${headerCells}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }


  const GAUGE_THICKNESS_DATA = [
    {gauge:3, steel:0.2391, aluminum:0.2294, stainless:0.2500},
    {gauge:4, steel:0.2242, aluminum:0.2043, stainless:0.2344},
    {gauge:5, steel:0.2092, aluminum:0.1819, stainless:0.2187},
    {gauge:6, steel:0.1943, aluminum:0.1620, stainless:0.2031},
    {gauge:7, steel:0.1793, aluminum:0.1443, stainless:0.1875},
    {gauge:8, steel:0.1644, aluminum:0.1285, stainless:0.1719},
    {gauge:9, steel:0.1495, aluminum:0.1144, stainless:0.1562},
    {gauge:10, steel:0.1345, aluminum:0.1019, stainless:0.1406},
    {gauge:11, steel:0.1196, aluminum:0.0907, stainless:0.1250},
    {gauge:12, steel:0.1046, aluminum:0.0808, stainless:0.1094},
    {gauge:13, steel:0.0897, aluminum:0.0720, stainless:0.0937},
    {gauge:14, steel:0.0747, aluminum:0.0641, stainless:0.0781},
    {gauge:15, steel:0.0673, aluminum:0.0571, stainless:0.0703},
    {gauge:16, steel:0.0598, aluminum:0.0508, stainless:0.0625},
    {gauge:17, steel:0.0538, aluminum:0.0453, stainless:0.0562},
    {gauge:18, steel:0.0478, aluminum:0.0403, stainless:0.0500},
    {gauge:19, steel:0.0418, aluminum:0.0359, stainless:0.0437},
    {gauge:20, steel:0.0359, aluminum:0.0320, stainless:0.0375},
    {gauge:21, steel:0.0329, aluminum:0.0285, stainless:0.0344},
    {gauge:22, steel:0.0299, aluminum:0.0253, stainless:0.0312},
    {gauge:23, steel:0.0269, aluminum:0.0226, stainless:0.0281},
    {gauge:24, steel:0.0239, aluminum:0.0201, stainless:0.0250},
    {gauge:25, steel:0.0209, aluminum:0.0179, stainless:0.0219},
    {gauge:26, steel:0.0179, aluminum:0.0159, stainless:0.0187},
    {gauge:27, steel:0.0164, aluminum:0.0142, stainless:0.0172},
    {gauge:28, steel:0.0149, aluminum:0.0126, stainless:0.0156},
    {gauge:29, steel:0.0135, aluminum:0.0113, stainless:0.0141}
  ];

  const GAUGE_MATERIALS = [
    {key:'steel',label:'Sheet Steel'},
    {key:'aluminum',label:'Aluminum'},
    {key:'stainless',label:'Stainless Steel'}
  ];

  function gaugeReferenceThickness(gauge,materialKey) {
    const row=GAUGE_THICKNESS_DATA.find(entry=>entry.gauge===Number(gauge));
    return row && Object.prototype.hasOwnProperty.call(row,materialKey) ? row[materialKey] : NaN;
  }

  function renderGaugeThicknessReference() {
    const headerCells=GAUGE_MATERIALS.map(material=>
      `<th scope="col" data-gauge-material="${material.key}">${escapeHtml(material.label)}</th>`
    ).join('');

    const rows=GAUGE_THICKNESS_DATA.map(row=>{
      const cells=GAUGE_MATERIALS.map(material=>{
        const thickness=row[material.key];
        const display=`${Number(thickness).toFixed(4)}"`;
        return `<td data-gauge="${row.gauge}" data-gauge-material="${material.key}" tabindex="0" role="button" aria-label="${row.gauge} gauge ${material.label}: ${Number(thickness).toFixed(4)} inches">${display}</td>`;
      }).join('');
      return `<tr><th scope="row" data-gauge-row="${row.gauge}">${row.gauge} ga</th>${cells}</tr>`;
    }).join('');

    quickReferenceTable.innerHTML=`
      <table class="quick-ref-table gauge-ref-table">
        <thead>
          <tr>
            <th scope="col">GAUGE ↓<br>MATERIAL →</th>
            ${headerCells}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  const QUICK_REFERENCE_TABLES = {
    'fraction-addition': {
      title:'Fraction Addition Chart',
      description:'Add common shop fractions in 1/16" increments. Pick the starting measurement on the left, then move across to the amount being added.',
      heading:'Start ↓ + Add →',
      badge:'1/16" increments',
      fractionExample:'Example: 5/16" + 7/16" = 3/4"',
      decimalExample:'Example: 0.313 + 0.438 = 0.750',
      keyItems:[['↓','Start','Find it on the left'],['→','Add','Move across the top'],['=','Result','Read the intersecting cell']],
      ariaLabel:'Fraction addition reference table',
      render:renderFractionAdditionReference
    },
    'fraction-decimal': {
      title:'Fraction Addition Chart — 1/32',
      description:'Add common shop fractions in 1/32" increments. Pick the starting measurement on the left, then move across to the amount being added.',
      heading:'Start ↓ + Add →',
      badge:'1/32" increments',
      fractionExample:'Example: 5/32" + 7/32" = 3/8"',
      decimalExample:'Example: 0.156 + 0.219 = 0.375',
      keyItems:[['↓','Start','Find it on the left'],['→','Add','Move across the top'],['=','Result','Read the intersecting cell']],
      ariaLabel:'Fraction addition reference table in one thirty-second inch increments',
      render:renderThirtySecondAdditionReference
    },
    'fraction-sixtyfourths': {
      title:'Fraction Addition Chart — 1/64',
      description:'Add common shop fractions in 1/64" increments. Pick the starting measurement on the left, then move across to the amount being added.',
      heading:'Start ↓ + Add →',
      badge:'1/64" increments',
      fractionExample:'Example: 5/64" + 7/64" = 3/16"',
      decimalExample:'Example: 0.078 + 0.109 = 0.188',
      keyItems:[['↓','Start','Find it on the left'],['→','Add','Move across the top'],['=','Result','Read the intersecting cell']],
      ariaLabel:'Fraction addition reference table in one sixty-fourth inch increments',
      render:renderSixtyFourthAdditionReference
    },
    'gauge-thickness': {
      title:'Gauge → Decimal Thickness',
      description:'Nominal decimal-inch thickness by material. Gauge is not universal: the same gauge number can represent different thicknesses in sheet steel, aluminum, and stainless steel.',
      heading:'Gauge ↓ → Decimal Thickness',
      badge:'Nominal inches',
      fixedExample:'Example: 16 ga — Steel 0.0598" • Aluminum 0.0508" • Stainless 0.0625"',
      keyItems:[['#','Gauge','Find the gauge on the left'],['▦','Material','Choose the material column'],['✓','Thickness','Tap a value to highlight it']],
      ariaLabel:'Gauge to decimal thickness reference table',
      hideDisplayMode:true,
      render:renderGaugeThicknessReference
    }
  };

  function updateQuickReferenceModeLabels() {
    const decimals=quickReferenceDecimalMode.checked;
    quickReferenceFractionLabel.classList.toggle('active',!decimals);
    quickReferenceDecimalLabel.classList.toggle('active',decimals);
  }

  function updateQuickReferenceDisplayValues() {
    const decimals=quickReferenceDecimalMode.checked;
    updateQuickReferenceModeLabels();

    quickReferenceTable.querySelectorAll('[data-qr-sixteenths]').forEach(el=>{
      el.textContent=quickReferenceSixteenthText(Number(el.dataset.qrSixteenths));
    });
    quickReferenceTable.querySelectorAll('[data-qr-thirtyseconds]').forEach(el=>{
      const value=Number(el.dataset.qrThirtyseconds);
      el.textContent=quickReferenceThirtySecondText(value);
    });
    quickReferenceTable.querySelectorAll('[data-qr-sixtyfourths]').forEach(el=>{
      const value=Number(el.dataset.qrSixtyfourths);
      el.textContent=quickReferenceSixtyFourthText(value);
    });

    quickReferenceTable.querySelectorAll('td[data-start-sixteenths][data-add-sixteenths]').forEach(cell=>{
      const start=Number(cell.dataset.startSixteenths);
      const add=Number(cell.dataset.addSixteenths);
      const sum=start+add;
      const label=decimals
        ? `${quickReferenceDecimal(start/16)} plus ${quickReferenceDecimal(add/16)} equals ${quickReferenceDecimal(sum/16)}`
        : `${fractionFromSixteenths(start)} plus ${fractionFromSixteenths(add)} equals ${fractionFromSixteenths(sum)}`;
      cell.setAttribute('aria-label',label);
    });
    quickReferenceTable.querySelectorAll('td[data-start-thirtyseconds][data-add-thirtyseconds]').forEach(cell=>{
      const start=Number(cell.dataset.startThirtyseconds);
      const add=Number(cell.dataset.addThirtyseconds);
      const sum=start+add;
      const label=decimals
        ? `${quickReferenceDecimal(start/32)} plus ${quickReferenceDecimal(add/32)} equals ${quickReferenceDecimal(sum/32)}`
        : `${fractionFromThirtySeconds(start)} plus ${fractionFromThirtySeconds(add)} equals ${fractionFromThirtySeconds(sum)}`;
      cell.setAttribute('aria-label',label);
    });
    quickReferenceTable.querySelectorAll('td[data-start-sixtyfourths][data-add-sixtyfourths]').forEach(cell=>{
      const start=Number(cell.dataset.startSixtyfourths);
      const add=Number(cell.dataset.addSixtyfourths);
      const sum=start+add;
      const label=decimals
        ? `${quickReferenceDecimal(start/64)} plus ${quickReferenceDecimal(add/64)} equals ${quickReferenceDecimal(sum/64)}`
        : `${fractionFromSixtyFourths(start)} plus ${fractionFromSixtyFourths(add)} equals ${fractionFromSixtyFourths(sum)}`;
      cell.setAttribute('aria-label',label);
    });

    const entry=QUICK_REFERENCE_TABLES[quickReferenceSelect.value] || QUICK_REFERENCE_TABLES['fraction-addition'];
    quickReferenceExample.textContent=entry.fixedExample || (decimals ? entry.decimalExample : entry.fractionExample);
    storageSet(QUICK_REFERENCE_DECIMAL_KEY,decimals?'decimal':'fraction');
  }

  function clearQuickReferenceSelectionClasses() {
    quickReferenceTable.querySelectorAll('.is-selected').forEach(el => el.classList.remove('is-selected'));
    quickReferenceTable.querySelectorAll('.is-selected-axis').forEach(el => el.classList.remove('is-selected-axis'));
  }

  function restoreQuickReferenceSelection(key) {
    clearQuickReferenceSelectionClasses();
    const selection=quickReferenceSelections[key];
    if (!selection) return;

    if (key==='fraction-addition') {
      const cell=quickReferenceTable.querySelector(`td[data-start-sixteenths="${selection.start}"][data-add-sixteenths="${selection.add}"]`);
      const rowHeader=quickReferenceTable.querySelector(`tbody th[data-start-sixteenths="${selection.start}"]`);
      const colHeader=quickReferenceTable.querySelector(`thead th[data-add-sixteenths="${selection.add}"]`);
      if (cell) cell.classList.add('is-selected');
      if (rowHeader) rowHeader.classList.add('is-selected-axis');
      if (colHeader) colHeader.classList.add('is-selected-axis');
      return;
    }

    if (key==='fraction-decimal') {
      const cell=quickReferenceTable.querySelector(`td[data-start-thirtyseconds="${selection.start}"][data-add-thirtyseconds="${selection.add}"]`);
      const rowHeader=quickReferenceTable.querySelector(`tbody th[data-start-thirtyseconds="${selection.start}"]`);
      const colHeader=quickReferenceTable.querySelector(`thead th[data-add-thirtyseconds="${selection.add}"]`);
      if (cell) cell.classList.add('is-selected');
      if (rowHeader) rowHeader.classList.add('is-selected-axis');
      if (colHeader) colHeader.classList.add('is-selected-axis');
      return;
    }

    if (key==='fraction-sixtyfourths') {
      const cell=quickReferenceTable.querySelector(`td[data-start-sixtyfourths="${selection.start}"][data-add-sixtyfourths="${selection.add}"]`);
      const rowHeader=quickReferenceTable.querySelector(`tbody th[data-start-sixtyfourths="${selection.start}"]`);
      const colHeader=quickReferenceTable.querySelector(`thead th[data-add-sixtyfourths="${selection.add}"]`);
      if (cell) cell.classList.add('is-selected');
      if (rowHeader) rowHeader.classList.add('is-selected-axis');
      if (colHeader) colHeader.classList.add('is-selected-axis');
      return;
    }

    if (key==='gauge-thickness') {
      const cell=quickReferenceTable.querySelector(`td[data-gauge="${selection.gauge}"][data-gauge-material="${selection.material}"]`);
      const rowHeader=quickReferenceTable.querySelector(`tbody th[data-gauge-row="${selection.gauge}"]`);
      const colHeader=quickReferenceTable.querySelector(`thead th[data-gauge-material="${selection.material}"]`);
      if (cell) cell.classList.add('is-selected');
      if (rowHeader) rowHeader.classList.add('is-selected-axis');
      if (colHeader) colHeader.classList.add('is-selected-axis');
    }
  }

  function renderQuickReference(key) {
    const resolvedKey=Object.prototype.hasOwnProperty.call(QUICK_REFERENCE_TABLES,key) ? key : 'fraction-addition';
    const entry = QUICK_REFERENCE_TABLES[resolvedKey];
    quickReferenceSelect.value = resolvedKey;
    quickReferenceTitle.textContent = entry.title;
    quickReferenceDescription.textContent = entry.description;
    quickReferenceTableHeading.textContent = entry.heading;
    quickReferenceBadge.textContent = entry.badge || '';
    (entry.keyItems || []).forEach((item,index)=>{
      const target=quickReferenceKeyElements[index];
      if (!target) return;
      target.icon.textContent=item[0];
      target.title.textContent=item[1];
      target.text.textContent=item[2];
    });
    quickReferenceTable.setAttribute('aria-label', entry.ariaLabel || entry.title);
    if (quickReferenceDisplayMode) quickReferenceDisplayMode.style.display=entry.hideDisplayMode ? 'none' : '';
    entry.render();
    updateQuickReferenceDisplayValues();
    restoreQuickReferenceSelection(resolvedKey);
    storageSet('fabricationQuickReferenceTable', resolvedKey);
  }

  function selectQuickReferenceAdditionCell(cell) {
    const start=Number(cell.dataset.startSixteenths);
    const add=Number(cell.dataset.addSixteenths);
    const selected=quickReferenceSelections['fraction-addition'];
    const same=selected && selected.start===start && selected.add===add;
    quickReferenceSelections['fraction-addition']=same ? null : {start,add};
    restoreQuickReferenceSelection('fraction-addition');
  }

  function selectQuickReferenceThirtySecondAdditionCell(cell) {
    const start=Number(cell.dataset.startThirtyseconds);
    const add=Number(cell.dataset.addThirtyseconds);
    const selected=quickReferenceSelections['fraction-decimal'];
    const same=selected && selected.start===start && selected.add===add;
    quickReferenceSelections['fraction-decimal']=same ? null : {start,add};
    restoreQuickReferenceSelection('fraction-decimal');
  }

  function selectQuickReferenceSixtyFourthAdditionCell(cell) {
    const start=Number(cell.dataset.startSixtyfourths);
    const add=Number(cell.dataset.addSixtyfourths);
    const selected=quickReferenceSelections['fraction-sixtyfourths'];
    const same=selected && selected.start===start && selected.add===add;
    quickReferenceSelections['fraction-sixtyfourths']=same ? null : {start,add};
    restoreQuickReferenceSelection('fraction-sixtyfourths');
  }

  function selectQuickReferenceGaugeCell(cell) {
    const gauge=Number(cell.dataset.gauge);
    const material=String(cell.dataset.gaugeMaterial || '');
    const selected=quickReferenceSelections['gauge-thickness'];
    const same=selected && selected.gauge===gauge && selected.material===material;
    quickReferenceSelections['gauge-thickness']=same ? null : {gauge,material};
    restoreQuickReferenceSelection('gauge-thickness');
  }

  const quickReferenceTableCount = Object.keys(QUICK_REFERENCE_TABLES).length;
  quickReferenceCount.textContent = `${quickReferenceTableCount} table${quickReferenceTableCount === 1 ? '' : 's'}`;
  quickReferenceDecimalMode.checked=storageGet(QUICK_REFERENCE_DECIMAL_KEY)==='decimal';
  updateQuickReferenceModeLabels();
  quickReferenceSelect.addEventListener('change', () => renderQuickReference(quickReferenceSelect.value));
  quickReferenceDecimalMode.addEventListener('change',updateQuickReferenceDisplayValues);
  const savedQuickReference = storageGet('fabricationQuickReferenceTable');
  renderQuickReference(savedQuickReference || 'fraction-addition');

  quickReferenceTable.addEventListener('click', e => {
    const additionCell=e.target.closest('td[data-start-sixteenths][data-add-sixteenths]');
    if (additionCell) {
      selectQuickReferenceAdditionCell(additionCell);
      return;
    }
    const thirtySecondAdditionCell=e.target.closest('td[data-start-thirtyseconds][data-add-thirtyseconds]');
    if (thirtySecondAdditionCell) {
      selectQuickReferenceThirtySecondAdditionCell(thirtySecondAdditionCell);
      return;
    }
    const sixtyFourthAdditionCell=e.target.closest('td[data-start-sixtyfourths][data-add-sixtyfourths]');
    if (sixtyFourthAdditionCell) {
      selectQuickReferenceSixtyFourthAdditionCell(sixtyFourthAdditionCell);
      return;
    }
    const gaugeCell=e.target.closest('td[data-gauge][data-gauge-material]');
    if (gaugeCell) selectQuickReferenceGaugeCell(gaugeCell);
  });

  quickReferenceTable.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const additionCell=e.target.closest && e.target.closest('td[data-start-sixteenths][data-add-sixteenths]');
    if (additionCell) {
      e.preventDefault();
      selectQuickReferenceAdditionCell(additionCell);
      return;
    }
    const thirtySecondAdditionCell=e.target.closest && e.target.closest('td[data-start-thirtyseconds][data-add-thirtyseconds]');
    if (thirtySecondAdditionCell) {
      e.preventDefault();
      selectQuickReferenceThirtySecondAdditionCell(thirtySecondAdditionCell);
      return;
    }
    const sixtyFourthAdditionCell=e.target.closest && e.target.closest('td[data-start-sixtyfourths][data-add-sixtyfourths]');
    if (sixtyFourthAdditionCell) {
      e.preventDefault();
      selectQuickReferenceSixtyFourthAdditionCell(sixtyFourthAdditionCell);
      return;
    }
    const gaugeCell=e.target.closest && e.target.closest('td[data-gauge][data-gauge-material]');
    if (gaugeCell) {
      e.preventDefault();
      selectQuickReferenceGaugeCell(gaugeCell);
    }
  });

  // ---------------- Aluminum overhang calculator ----------------
  const MAX_CUT = 119.5;
  const SEAM = 1;
  const MIN_SIZE = 48;
  const MAX_SIZE = 400;

  const longInput = document.getElementById('longSide');
  const shortInput = document.getElementById('shortSide');
  const longResult = document.getElementById('longResult');
  const shortResult = document.getElementById('shortResult');
  const overhangStatus = document.getElementById('overhangStatus');

  function fractionTextEighth(value) {
    const eighths = Math.round(value * 8);
    if (Math.abs(eighths / 8 - value) > 0.000001) return `${trimZeros(value)}"`;
    const whole = Math.floor(eighths / 8);
    const rem = eighths % 8;
    if (rem === 0) return `${whole}"`;
    const g = gcd(rem,8);
    const num = rem/g, den = 8/g;
    return whole > 0 ? `${whole} ${num}/${den}"` : `${num}/${den}"`;
  }

  function longPieces(size) {
    const count = Math.ceil(size / (MAX_CUT - 2));
    const coverage = size / count;
    const cut = coverage + 2;
    const pieces = [];
    for (let i=0; i<count; i++) {
      let flange;
      if (count === 1) flange = '1" corner flange on both ends';
      else if (i === 0) flange = '1" corner flange + 1" seam flange';
      else if (i === count - 1) flange = '1" seam flange + 1" corner flange';
      else flange = '1" seam flange on both ends';
      pieces.push({cut,flange});
    }
    return {count,coverage,pieces};
  }

  function shortPieces(size) {
    for (let count=1; count<=10; count++) {
      const coverage = size / count;
      const pieces = [];
      let fits = true;
      for (let i=0; i<count; i++) {
        let flanges = 0;
        let flange = 'No flanges';
        if (count > 1) {
          if (i === 0 || i === count - 1) { flanges = 1; flange = '1" seam flange'; }
          else { flanges = 2; flange = '1" seam flange on both ends'; }
        }
        const cut = coverage + flanges * SEAM;
        if (cut > MAX_CUT + 1e-9) fits = false;
        pieces.push({cut,flange});
      }
      if (fits) return {count,coverage,pieces};
    }
    throw new Error('Unable to calculate a valid short-side split.');
  }

  function renderOverhangResult(target,title,size,result) {
    const maxCut = Math.max(...result.pieces.map(p => p.cut));
    const pieceList = result.pieces.map((p,i) => `
      <div class="piece">
        <div class="piece-num">${i+1}</div>
        <div><strong>Cut ${fractionTextEighth(p.cut)}</strong><small>${p.flange}</small></div>
      </div>`).join('');

    target.innerHTML = `
      <div class="result-head">
        <strong>${title}</strong>
        <span class="badge">${result.count} piece${result.count === 1 ? '' : 's'}</span>
      </div>
      <div class="result-body">
        <div class="big">${fractionTextEighth(size)} finished</div>
        <div class="sub">Equal finished coverage: ${fractionTextEighth(result.coverage)} per piece</div>
        <div class="pieces">${pieceList}</div>
        <div class="summary">
          <div class="metric"><span>Longest blank</span><b>${fractionTextEighth(maxCut)}</b></div>
          <div class="metric"><span>Usable maximum</span><b>119 1/2"</b></div>
        </div>
      </div>`;
  }

  function validateOverhang(value,name) {
    if (!Number.isFinite(value)) return `${name} must be a number.`;
    if (value < MIN_SIZE || value > MAX_SIZE) return `${name} must be between 48" and 400".`;
    return '';
  }

  function calculateOverhang(showMessage=false) {
    const longSide = parseFloat(longInput.value);
    const shortSide = parseFloat(shortInput.value);
    const errors = [validateOverhang(longSide,'Long side'),validateOverhang(shortSide,'Short side')].filter(Boolean);
    if (errors.length) {
      overhangStatus.className = 'status show error';
      overhangStatus.textContent = errors.join(' ');
      longResult.innerHTML = '';
      shortResult.innerHTML = '';
      return;
    }
    renderOverhangResult(longResult,'Long Side',longSide,longPieces(longSide));
    renderOverhangResult(shortResult,'Short Side',shortSide,shortPieces(shortSide));
    if (showMessage) {
      overhangStatus.className = 'status show ok';
      overhangStatus.textContent = 'Cuts calculated.';
      setTimeout(() => { if (overhangStatus.classList.contains('ok')) overhangStatus.className = 'status'; }, 1400);
    } else overhangStatus.className = 'status';
  }

  document.getElementById('overhangCalculateBtn').addEventListener('click', () => calculateOverhang(true));
  document.getElementById('swapBtn').addEventListener('click', () => {
    const temp = longInput.value;
    longInput.value = shortInput.value;
    shortInput.value = temp;
    calculateOverhang();
  });
  [longInput,shortInput].forEach(el => {
    el.addEventListener('input', () => calculateOverhang());
    el.addEventListener('keydown', e => { if (e.key === 'Enter') calculateOverhang(true); });
  });

  // ---------------- Fastener spacing calculator ----------------
  const maxSpacingInput = document.getElementById('maxSpacing');
  const fastenerLengthInput = document.getElementById('fastenerLength');
  const fastenerError = document.getElementById('fastenerError');
  const fastenerResults = document.getElementById('fastenerResults');
  const spaceCountEl = document.getElementById('spaceCount');
  const spacingFractionEl = document.getElementById('spacingFraction');
  const spacingDecimalEl = document.getElementById('spacingDecimal');
  const fastenerCountEl = document.getElementById('fastenerCount');
  const locationsEl = document.getElementById('locations');
  const diagramEl = document.getElementById('diagram');

  function roundToSixteenth(value) {
    return Math.round((value + Number.EPSILON) * 16) / 16;
  }

  function toFraction16(value) {
    const rounded = roundToSixteenth(value);
    let whole = Math.floor(rounded + 1e-10);
    let numerator = Math.round((rounded - whole) * 16);
    if (numerator === 16) { whole += 1; numerator = 0; }
    if (numerator === 0) return whole + '"';
    const d = gcd(numerator,16);
    const n = numerator/d, den = 16/d;
    return whole === 0 ? `${n}/${den}"` : `${whole} ${n}/${den}"`;
  }

  function decimalText(value) {
    return 'Calculated (decimal): ' + value.toFixed(4).replace(/0+$/,'').replace(/\.$/,'') + '"';
  }

  function showFastenerError(message) {
    fastenerError.textContent = message;
    fastenerError.classList.add('show');
    fastenerResults.classList.remove('show');
  }

  function clearFastenerError() {
    fastenerError.textContent = '';
    fastenerError.classList.remove('show');
  }

  function calculateFasteners() {
    clearFastenerError();
    const maxSpacingText = maxSpacingInput.value.trim();
    const lengthText = fastenerLengthInput.value.trim();
    if (maxSpacingText === '' || lengthText === '') {
      showFastenerError('Enter both Max Spacing and Length.');
      return;
    }
    const maxSpacing = Number(maxSpacingText);
    const length = Number(lengthText);

    if (!Number.isFinite(maxSpacing) || !Number.isFinite(length)) {
      showFastenerError('Enter valid numbers for Max Spacing and Length.');
      return;
    }
    if (maxSpacing < 4 || maxSpacing > 36) {
      showFastenerError('Max Spacing must be between 4" and 36".');
      return;
    }
    if (length <= 0 || length > 400) {
      showFastenerError('Length must be greater than 0" and no more than 400".');
      return;
    }

    const spaces = Math.max(1, Math.ceil((length / maxSpacing) - 1e-12));
    const exactSpacing = length / spaces;
    const fasteners = spaces + 1;

    spaceCountEl.textContent = spaces;
    spacingFractionEl.textContent = toFraction16(exactSpacing);
    spacingDecimalEl.textContent = decimalText(exactSpacing);
    fastenerCountEl.textContent = fasteners;
    locationsEl.innerHTML = '';
    diagramEl.innerHTML = '<div class="rail"></div>';

    for (let i=0; i<=spaces; i++) {
      const exactPosition = (length * i) / spaces;
      const displayPosition = i === spaces ? length : roundToSixteenth(exactPosition);

      const item = document.createElement('div');
      item.className = 'location';
      item.innerHTML = `<span class="num">Fastener ${i+1}</span><span class="pos">${toFraction16(displayPosition)}</span>`;
      locationsEl.appendChild(item);

      const dot = document.createElement('div');
      dot.className = 'dot';
      dot.style.left = ((i / spaces) * 100) + '%';
      dot.title = `Fastener ${i+1}: ${toFraction16(displayPosition)}`;
      diagramEl.appendChild(dot);

      if (i === 0 || i === spaces) {
        const label = document.createElement('div');
        label.className = 'end-label';
        label.style.left = ((i / spaces) * 100) + '%';
        label.textContent = toFraction16(displayPosition);
        diagramEl.appendChild(label);
      }
    }

    fastenerResults.classList.add('show');
    fastenerResults.scrollIntoView({behavior:'smooth',block:'nearest'});
  }

  function clearFasteners() {
    maxSpacingInput.value = '';
    fastenerLengthInput.value = '';
    clearFastenerError();
    fastenerResults.classList.remove('show');
    locationsEl.innerHTML = '';
    maxSpacingInput.focus();
  }

  document.getElementById('fastenerCalculateBtn').addEventListener('click', calculateFasteners);
  document.getElementById('fastenerClearBtn').addEventListener('click', clearFasteners);
  [maxSpacingInput,fastenerLengthInput].forEach(input => {
    input.addEventListener('keydown', e => { if (e.key === 'Enter') calculateFasteners(); });
    input.addEventListener('change', () => {
      if (maxSpacingInput.value !== '' && fastenerLengthInput.value !== '') calculateFasteners();
    });
  });



  // ---------------- Material cut optimizer ----------------
  const MATERIALS = {
    al063: { name: '.063 Aluminum', rawL:120, rawW:48, usableL:119.5, usableW:47.5, cutMethod:'shear' },
    acp: { name: 'ACP Aluminum', rawL:120, rawW:48, usableL:119.5, usableW:47.5, cutMethod:'shear' },
    cellulose: { name: 'Cellulose', rawL:120, rawW:48, usableL:120, usableW:48, cutMethod:'freeform' },
    plywood: { name: 'Plywood', rawL:95.875, rawW:47.875, usableL:95.875, usableW:47.875, cutMethod:'freeform' }
  };

  const PRODUCTS = {
    exterior: {
      name: '.063 Exterior Panel', shortName:'.063 Wall', material:'al063', deltaH:2, deltaW:2, color:'#00D2FF',
      rule: 'Add 1" flange each side (+2" overall)'
    },
    door: {
      name: '.063 Exterior Door Panel', shortName:'.063 Door', material:'al063', deltaH:1.5, deltaW:1.5, color:'#70FFB3',
      rule: 'Add 3/4" flange each side (+1 1/2" overall)'
    },
    acp: {
      name: 'Interior ACP Panel', shortName:'ACP', material:'acp', deltaH:-0.125, deltaW:-0.125, color:'#FF70A3',
      rule: 'Subtract 1/8" from height and width'
    },
    insulation: {
      name: 'Insulation Panel', shortName:'Cellulose', material:'cellulose', deltaH:-0.5, deltaW:-0.5, color:'#B7B7B7',
      rule: 'Subtract 1/2" from height and width'
    },
    plywood: {
      name: 'Plywood Reinforcement', shortName:'Plywood', material:'plywood', deltaH:-0.75, deltaW:-0.75, color:'#F5D17A',
      rule: 'Subtract 3/4" from height and width'
    }
  };

  const COPY_COMPATIBLE_PRODUCTS = ['exterior','door','insulation','acp'];

  const optimizerProduct = document.getElementById('optimizerProduct');
  const optimizerLabel = document.getElementById('optimizerLabel');
  const optimizerWidth = document.getElementById('optimizerWidth');
  const optimizerHeight = document.getElementById('optimizerHeight');
  const optimizerQty = document.getElementById('optimizerQty');
  const optimizerGrainFlowRotation = document.getElementById('optimizerGrainFlowRotation');
  const optimizerRule = document.getElementById('optimizerRule');
  const optimizerMaterial = document.getElementById('optimizerMaterial');
  const optimizerSheet = document.getElementById('optimizerSheet');
  const optimizerStatus = document.getElementById('optimizerStatus');
  const optimizerJobList = document.getElementById('optimizerJobList');
  const optimizerCutListMenuBtn = document.getElementById('optimizerCutListMenuBtn');
  const optimizerCutListDrawer = document.getElementById('optimizerCutListDrawer');
  const optimizerCutListBackdrop = document.getElementById('optimizerCutListBackdrop');
  const optimizerCutListCloseBtn = document.getElementById('optimizerCutListCloseBtn');
  const optimizerCutListMeta = document.getElementById('optimizerCutListMeta');
  const optimizerCutListDrawerMeta = document.getElementById('optimizerCutListDrawerMeta');
  const optimizerCopySource = document.getElementById('optimizerCopySource');
  const optimizerCopyTarget = document.getElementById('optimizerCopyTarget');
  const optimizerCopyBtn = document.getElementById('optimizerCopyBtn');
  const optimizerCopyStatus = document.getElementById('optimizerCopyStatus');
  const optimizerResults = document.getElementById('optimizerResults');
  const optimizerMaterialTotals = document.getElementById('optimizerMaterialTotals');
  const optimizerSheets = document.getElementById('optimizerSheets');
  const optimizerJobNumber = document.getElementById('optimizerJobNumber');
  const optimizerSavedJobs = document.getElementById('optimizerSavedJobs');
  const optimizerJobStatus = document.getElementById('optimizerJobStatus');
  const optimizerActiveJobChip = document.getElementById('optimizerActiveJobChip');
  const optimizerImportFile = document.getElementById('optimizerImportFile');
  const OPTIMIZER_JOBS_KEY = 'fabricationOptimizerJobsV1';
  const OPTIMIZER_JOB_FILE_VERSION = 3;
  const MAX_OPTIMIZER_PIECES = 500;
  const MAX_OPTIMIZER_ROWS = 150;
  const MAX_OPTIMIZER_IMPORT_BYTES = 2 * 1024 * 1024;
  const MAX_OPTIMIZER_LABEL_LENGTH = 120;
  let optimizerJob = [];
  let optimizerNextId = 1;
  let optimizerCutIds = new Set();
  let optimizerLastResults = null;
  let optimizerLoadedJobNumber = '';
  let optimizerDirty = false;
  let optimizerWorker = null;
  let optimizerWorkerReject = null;
  let optimizerRunSerial = 0;
  let sheetSvgClipCounter = 0;

  function showOptimizerJobStatus(message,type='ok') {
    optimizerJobStatus.textContent = message;
    optimizerJobStatus.className = `status show ${type}`;
  }

  function clearOptimizerJobStatus() {
    optimizerJobStatus.textContent = '';
    optimizerJobStatus.className = 'status';
  }

  function cleanJobNumber(value) {
    return String(value ?? '').trim().replace(/\s+/g,' ');
  }

  function markOptimizerDirty() {
    optimizerDirty = true;
    updateActiveJobChip();
  }

  function markOptimizerClean() {
    optimizerDirty = false;
    updateActiveJobChip();
  }

  function currentOptimizerPieceCount(parts=optimizerJob) {
    return parts.reduce((sum,row)=>sum + Number(row.qty || 0),0);
  }

  function hasOwn(obj,key) {
    return Object.prototype.hasOwnProperty.call(obj,key);
  }

  function createJobDictionary(source={}) {
    const out=Object.create(null);
    if (source && typeof source==='object' && !Array.isArray(source)) {
      for (const [key,value] of Object.entries(source)) out[key]=value;
    }
    return out;
  }

  function updateActiveJobChip() {
    const number=cleanJobNumber(optimizerJobNumber.value);
    if (number) {
      optimizerActiveJobChip.textContent = `Job #${number}${optimizerDirty ? ' • Unsaved' : ' • Saved'}`;
      optimizerActiveJobChip.style.display = 'inline-flex';
    } else {
      optimizerActiveJobChip.textContent = '';
      optimizerActiveJobChip.style.display = 'none';
    }
  }

  function readSavedOptimizerJobs() {
    const raw=storageGet(OPTIMIZER_JOBS_KEY);
    if (!raw) return createJobDictionary();
    try {
      const parsed=JSON.parse(raw);
      return createJobDictionary(parsed);
    } catch (e) { return createJobDictionary(); }
  }

  function writeSavedOptimizerJobs(jobs) {
    try {
      localStorage.setItem(OPTIMIZER_JOBS_KEY, JSON.stringify(jobs));
      return true;
    } catch (e) {
      showOptimizerJobStatus('This browser could not save the job locally. Use Export Job File as a backup instead.','error');
      return false;
    }
  }

  function refreshSavedOptimizerJobs(selected='') {
    const jobs=readSavedOptimizerJobs();
    const numbers=Object.keys(jobs).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'}));
    optimizerSavedJobs.innerHTML = numbers.length
      ? '<option value="">Select a saved job…</option>' + numbers.map(n=>`<option value="${escapeHtml(n)}">Job #${escapeHtml(n)}</option>`).join('')
      : '<option value="">No saved jobs</option>';
    if (selected && numbers.includes(selected)) optimizerSavedJobs.value=selected;
  }

  function validPhysicalUids(parts) {
    const set=new Set();
    for (const row of parts) for (let q=1;q<=row.qty;q++) set.add(`${row.id}-${q}`);
    return set;
  }

  function serializeOptimizerJob() {
    const jobNumber=cleanJobNumber(optimizerJobNumber.value);
    return {
      format:'FabricationCutOptimizerJob',
      version:OPTIMIZER_JOB_FILE_VERSION,
      jobNumber,
      savedAt:new Date().toISOString(),
      grainFlowRotation:!!optimizerGrainFlowRotation.checked,
      nextId:optimizerNextId,
      dimensionOrder:'width-height',
      parts:optimizerJob.map(row=>({
        id:row.id,
        productKey:row.productKey,
        label:row.label || '',
        finishedWidth:row.finishedWidth,
        finishedHeight:row.finishedHeight,
        qty:row.qty
      })),
      cutPartIds:Array.from(optimizerCutIds).sort()
    };
  }

  function normalizeOptimizerJobRecord(raw) {
    const data = raw && raw.fabricationOptimizerJob ? raw.fabricationOptimizerJob : raw;
    if (!data || typeof data!=='object') throw new Error('The file does not contain a valid optimizer job.');
    if (data.format && data.format!=='FabricationCutOptimizerJob') throw new Error('This JSON file is not a Fabrication Cut Optimizer job.');
    const incomingVersion=Number(data.version || 1);
    if (!Number.isInteger(incomingVersion) || incomingVersion < 1) throw new Error('The job file has an invalid version number.');
    if (incomingVersion > OPTIMIZER_JOB_FILE_VERSION) throw new Error('This job was created by a newer version of Fabrication Calculators and cannot be safely imported here.');
    const jobNumber=cleanJobNumber(data.jobNumber);
    if (!jobNumber) throw new Error('The job file is missing a Job #.');
    if (!Array.isArray(data.parts)) throw new Error('The job file is missing its parts list.');
    if (data.parts.length > MAX_OPTIMIZER_ROWS) throw new Error(`The job contains more than ${MAX_OPTIMIZER_ROWS} part rows.`);

    const ids=new Set();
    const parts=data.parts.map((row,index)=>{
      if (!row || typeof row!=='object' || !PRODUCTS[row.productKey]) throw new Error(`Part ${index+1} has an invalid product type.`);
      const id=Number(row.id);
      // Version 2 stores explicit Width/Height. Version 1 used finishedW/finishedL,
      // where finishedL was the panel height dimension.
      const finishedWidth=Number(row.finishedWidth ?? row.finishedW);
      const finishedHeight=Number(row.finishedHeight ?? row.finishedL);
      const qty=Number(row.qty);
      if (!Number.isInteger(id) || id<1 || ids.has(id)) throw new Error(`Part ${index+1} has an invalid or duplicate ID.`);
      if (!Number.isFinite(finishedWidth) || !Number.isFinite(finishedHeight) || finishedWidth<=0 || finishedHeight<=0) throw new Error(`Part ${index+1} has invalid Width/Height dimensions.`);
      if (!Number.isInteger(qty) || qty<1 || qty>500) throw new Error(`Part ${index+1} has an invalid quantity.`);
      ids.add(id);
      const cut=optimizerCutSize(row.productKey,finishedWidth,finishedHeight);
      if (cut.width<=0 || cut.height<=0) throw new Error(`Part ${index+1} produces an invalid cut size.`);
      const label=String(row.label||'').trim();
      if (label.length > MAX_OPTIMIZER_LABEL_LENGTH) throw new Error(`Part ${index+1} label exceeds ${MAX_OPTIMIZER_LABEL_LENGTH} characters.`);
      return {id,productKey:row.productKey,label,finishedWidth,finishedHeight,qty,cutWidth:cut.width,cutHeight:cut.height};
    });
    const totalPieces=currentOptimizerPieceCount(parts);
    if (totalPieces > MAX_OPTIMIZER_PIECES) throw new Error(`The job contains ${totalPieces} pieces; the optimizer limit is ${MAX_OPTIMIZER_PIECES}.`);
    const valid=validPhysicalUids(parts);
    const cutPartIds=Array.isArray(data.cutPartIds) ? data.cutPartIds.map(String).filter(uid=>valid.has(uid)) : [];
    const maxId=parts.reduce((m,row)=>Math.max(m,row.id),0);
    // Version 3 renamed and inverted the legacy free-rotation setting.
    // Legacy v1/v2: rotate=true meant free rotation was allowed.
    // v3+: grainFlowRotation=true means orientation is LOCKED to entered Width × Height.
    const grainFlowRotation = incomingVersion >= 3
      ? data.grainFlowRotation === true
      : data.rotate === false;
    return {
      format:'FabricationCutOptimizerJob',version:OPTIMIZER_JOB_FILE_VERSION,jobNumber,
      savedAt:typeof data.savedAt==='string'?data.savedAt:new Date().toISOString(),
      grainFlowRotation,
      nextId:Math.max(maxId+1,Number.isInteger(Number(data.nextId))?Number(data.nextId):1),
      parts,cutPartIds
    };
  }

  function applyOptimizerJobRecord(record,autoOptimize=true) {
    optimizerJob=record.parts.map(row=>({...row}));
    optimizerNextId=record.nextId;
    optimizerCutIds=new Set(record.cutPartIds || []);
    optimizerGrainFlowRotation.checked=record.grainFlowRotation===true;
    optimizerJobNumber.value=record.jobNumber;
    optimizerLoadedJobNumber=record.jobNumber;
    optimizerDirty=false;
    optimizerLastResults=null;
    optimizerResults.classList.remove('show');
    optimizerSheets.innerHTML='';
    optimizerMaterialTotals.innerHTML='';
    clearOptimizerStatus();
    renderOptimizerJob();
    updateActiveJobChip();
    refreshSavedOptimizerJobs(record.jobNumber);
    if (autoOptimize && optimizerJob.length) runOptimizer(false);
  }

  function saveOptimizerJob() {
    clearOptimizerJobStatus();
    const number=cleanJobNumber(optimizerJobNumber.value);
    if (!number) { showOptimizerJobStatus('Enter a Job # before saving.','error'); optimizerJobNumber.focus(); return; }
    if (!optimizerJob.length) { showOptimizerJobStatus('Add at least one part before saving the job.','error'); return; }
    optimizerJobNumber.value=number;
    const jobs=readSavedOptimizerJobs();
    if (hasOwn(jobs,number) && number!==optimizerLoadedJobNumber && !window.confirm(`Job #${number} already exists. Replace the saved job?`)) return;
    if (hasOwn(jobs,number) && number===optimizerLoadedJobNumber && !window.confirm(`Save the current changes to Job #${number}?`)) return;
    const record=serializeOptimizerJob();
    jobs[number]=record;
    if (!writeSavedOptimizerJobs(jobs)) return;
    optimizerLoadedJobNumber=number;
    markOptimizerClean();
    refreshSavedOptimizerJobs(number);
    showOptimizerJobStatus(`Job #${number} saved on this device.`,'ok');
  }

  function loadOptimizerJob() {
    clearOptimizerJobStatus();
    const number=cleanJobNumber(optimizerSavedJobs.value);
    if (!number) { showOptimizerJobStatus('Select a saved job to load.','error'); return; }
    const jobs=readSavedOptimizerJobs();
    if (!hasOwn(jobs,number)) { showOptimizerJobStatus(`Job #${number} was not found on this device.`,'error'); return; }
    if (optimizerDirty && !window.confirm(`The current job has unsaved changes. Load Job #${number} and discard those changes?`)) return;
    try {
      const record=normalizeOptimizerJobRecord(jobs[number]);
      applyOptimizerJobRecord(record,true);
      showOptimizerJobStatus(`Job #${number} loaded.`,'ok');
    } catch (e) { showOptimizerJobStatus(e.message || 'Unable to load that saved job.','error'); }
  }

  function deleteOptimizerSavedJob() {
    clearOptimizerJobStatus();
    const number=cleanJobNumber(optimizerSavedJobs.value);
    if (!number) { showOptimizerJobStatus('Select a saved job to delete.','error'); return; }
    const jobs=readSavedOptimizerJobs();
    if (!hasOwn(jobs,number)) { showOptimizerJobStatus(`Job #${number} was not found on this device.`,'error'); return; }
    if (!window.confirm(`Delete the saved copy of Job #${number}? This does not delete an exported backup file.`)) return;
    delete jobs[number];
    if (!writeSavedOptimizerJobs(jobs)) return;
    if (optimizerLoadedJobNumber===number) { optimizerLoadedJobNumber=''; markOptimizerDirty(); }
    refreshSavedOptimizerJobs();
    showOptimizerJobStatus(`Saved Job #${number} deleted.`,'ok');
  }

  function safeExportFileName(value) {
    const safe=String(value).trim().replace(/[^a-z0-9._-]+/gi,'-').replace(/^-+|-+$/g,'');
    return safe || 'job';
  }

  function exportOptimizerJob() {
    clearOptimizerJobStatus();
    const number=cleanJobNumber(optimizerJobNumber.value);
    if (!number) { showOptimizerJobStatus('Enter a Job # before exporting.','error'); optimizerJobNumber.focus(); return; }
    if (!optimizerJob.length) { showOptimizerJobStatus('Add at least one part before exporting.','error'); return; }
    optimizerJobNumber.value=number;
    const payload={fabricationOptimizerJob:serializeOptimizerJob()};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`Job-${safeExportFileName(number)}-Fabrication.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    showOptimizerJobStatus(`Job #${number} exported as a portable JSON file.`,'ok');
  }

  function importOptimizerJobFile(file) {
    if (!file) return;
    if (file.size > MAX_OPTIMIZER_IMPORT_BYTES) {
      showOptimizerJobStatus(`That job file is too large. Maximum import size is ${Math.round(MAX_OPTIMIZER_IMPORT_BYTES/1024/1024)} MB.`,'error');
      optimizerImportFile.value='';
      return;
    }
    clearOptimizerJobStatus();
    const reader=new FileReader();
    reader.onload=()=>{
      try {
        const parsed=JSON.parse(String(reader.result||''));
        const record=normalizeOptimizerJobRecord(parsed);
        const jobs=readSavedOptimizerJobs();
        if (optimizerDirty && !window.confirm('The current job has unsaved changes. Import another job and discard those changes?')) return;
        if (hasOwn(jobs,record.jobNumber) && !window.confirm(`Job #${record.jobNumber} already exists on this device. Replace it with the imported job?`)) return;
        jobs[record.jobNumber]=record;
        if (!writeSavedOptimizerJobs(jobs)) return;
        applyOptimizerJobRecord(record,false);
        markOptimizerClean();
        showOptimizerJobStatus(`Job #${record.jobNumber} imported, saved, and loaded. Press Optimize Job to calculate the layout.`,'ok');
      } catch (e) {
        showOptimizerJobStatus(e.message || 'Unable to import that job file.','error');
      } finally {
        optimizerImportFile.value='';
      }
    };
    reader.onerror=()=>{ showOptimizerJobStatus('The selected job file could not be read.','error'); optimizerImportFile.value=''; };
    reader.readAsText(file);
  }

  function parseShopMeasurement(value) {
    let text = String(value ?? '').trim().toLowerCase().replace(/["”]/g,'');
    if (!text) return NaN;
    text = text.replace(/\s*[-–]\s*(?=\d+\s*\/)/, ' ');
    if (/^\d+(?:\.\d+)?$/.test(text)) return Number(text);
    let m = text.match(/^(\d+(?:\.\d+)?)\s+(\d+)\s*\/\s*(\d+)$/);
    if (m) {
      const den = Number(m[3]);
      return den ? Number(m[1]) + Number(m[2]) / den : NaN;
    }
    m = text.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (m) {
      const den = Number(m[2]);
      return den ? Number(m[1]) / den : NaN;
    }
    return NaN;
  }

  // ---------------- Saw optimizer ----------------
  const SAW_KERF = 0.25;
  const MAX_SAW_PIECES = 500;
  const MAX_SAW_ROWS = 150;
  const MAX_SAW_TUBE_LENGTH = 10000;
  const SAW_JOB_FILE_VERSION = 1;
  const MAX_SAW_IMPORT_BYTES = 2 * 1024 * 1024;
  const sawTubeLength = document.getElementById('sawTubeLength');
  const sawPartLabel = document.getElementById('sawPartLabel');
  const sawPartLength = document.getElementById('sawPartLength');
  const sawPartQty = document.getElementById('sawPartQty');
  const sawStatus = document.getElementById('sawStatus');
  const sawPartList = document.getElementById('sawPartList');
  const sawCutListMenuBtn = document.getElementById('sawCutListMenuBtn');
  const sawCutListDrawer = document.getElementById('sawCutListDrawer');
  const sawCutListBackdrop = document.getElementById('sawCutListBackdrop');
  const sawCutListCloseBtn = document.getElementById('sawCutListCloseBtn');
  const sawCutListMeta = document.getElementById('sawCutListMeta');
  const sawCutListDrawerMeta = document.getElementById('sawCutListDrawerMeta');
  const sawResults = document.getElementById('sawResults');
  const sawSummary = document.getElementById('sawSummary');
  const sawOptimizationNote = document.getElementById('sawOptimizationNote');
  const sawTubeResults = document.getElementById('sawTubeResults');
  const sawExportJobBtn = document.getElementById('sawExportJobBtn');
  const sawImportJobBtn = document.getElementById('sawImportJobBtn');
  const sawImportFile = document.getElementById('sawImportFile');
  const sawJobFileStatus = document.getElementById('sawJobFileStatus');
  let sawJob = [];
  let sawNextId = 1;
  let sawCutIds = new Set();
  let sawLastResult = null;
  let sawLastTubeLength = NaN;

  function showSawStatus(message,type='error') {
    sawStatus.textContent=message;
    sawStatus.className=`status show ${type}`;
  }

  function clearSawStatus() {
    sawStatus.textContent='';
    sawStatus.className='status';
  }

  function sawPhysicalPieceCount(parts=sawJob) {
    return parts.reduce((sum,row)=>sum+Number(row.qty || 0),0);
  }

  function showSawJobFileStatus(message,type='ok') {
    sawJobFileStatus.textContent=message;
    sawJobFileStatus.className=`status show ${type}`;
  }

  function clearSawJobFileStatus() {
    sawJobFileStatus.textContent='';
    sawJobFileStatus.className='status';
  }

  function validSawPhysicalUids(parts) {
    const valid=new Set();
    for (const row of parts) for (let i=1;i<=row.qty;i++) valid.add(`${row.id}-${i}`);
    return valid;
  }

  function serializeSawJob() {
    const tubeLength=parseShopMeasurement(sawTubeLength.value);
    return {
      format:'FabricationSawOptimizerJob',
      version:SAW_JOB_FILE_VERSION,
      savedAt:new Date().toISOString(),
      tubeLength,
      kerf:SAW_KERF,
      nextId:sawNextId,
      parts:sawJob.map(row=>({
        id:row.id,
        label:row.label || '',
        length:row.length,
        qty:row.qty
      })),
      cutPartIds:Array.from(sawCutIds).sort()
    };
  }

  function normalizeSawJobRecord(raw) {
    const data=raw && raw.fabricationSawOptimizerJob ? raw.fabricationSawOptimizerJob : raw;
    if (!data || typeof data!=='object' || Array.isArray(data)) throw new Error('The file does not contain a valid Saw Optimizer job.');
    if (data.format && data.format!=='FabricationSawOptimizerJob') throw new Error('This JSON file is not a Saw Optimizer job.');
    const version=data.version == null ? 1 : Number(data.version);
    if (!Number.isInteger(version) || version<1) throw new Error('The Saw Optimizer job file has an invalid version number.');
    if (version>SAW_JOB_FILE_VERSION) throw new Error('This Saw Optimizer job was created by a newer version of Fabrication Calculators and cannot be safely imported here.');
    const tubeLength=Number(data.tubeLength);
    if (!Number.isFinite(tubeLength) || tubeLength<=0 || tubeLength>MAX_SAW_TUBE_LENGTH) throw new Error(`The Saw Optimizer job has an invalid tube length. It must be greater than 0 and no more than ${MAX_SAW_TUBE_LENGTH} inches.`);
    const kerf=Number(data.kerf ?? SAW_KERF);
    if (!Number.isFinite(kerf) || Math.abs(kerf-SAW_KERF)>1e-9) throw new Error('This Saw Optimizer job uses a different kerf rule. This version requires a fixed 1/4 inch kerf between adjacent pieces.');
    if (!Array.isArray(data.parts)) throw new Error('The Saw Optimizer job is missing its parts list.');
    if (data.parts.length>MAX_SAW_ROWS) throw new Error(`The Saw Optimizer job contains more than ${MAX_SAW_ROWS} part rows.`);

    const ids=new Set();
    const parts=data.parts.map((row,index)=>{
      if (!row || typeof row!=='object' || Array.isArray(row)) throw new Error(`Saw part ${index+1} is invalid.`);
      const id=Number(row.id);
      const length=Number(row.length);
      const qty=Number(row.qty);
      const label=String(row.label || '').trim();
      if (!Number.isInteger(id) || id<1 || ids.has(id)) throw new Error(`Saw part ${index+1} has an invalid or duplicate ID.`);
      if (!Number.isFinite(length) || length<=0 || length>MAX_SAW_TUBE_LENGTH) throw new Error(`Saw part ${index+1} has an invalid length.`);
      if (!Number.isInteger(qty) || qty<1 || qty>500) throw new Error(`Saw part ${index+1} has an invalid quantity.`);
      if (label.length>MAX_OPTIMIZER_LABEL_LENGTH) throw new Error(`Saw part ${index+1} label exceeds ${MAX_OPTIMIZER_LABEL_LENGTH} characters.`);
      ids.add(id);
      return {id,label,length,qty};
    });
    const total=sawPhysicalPieceCount(parts);
    if (total>MAX_SAW_PIECES) throw new Error(`The Saw Optimizer job contains ${total} pieces; the limit is ${MAX_SAW_PIECES}.`);
    const validUids=validSawPhysicalUids(parts);
    const rawCutIds=Array.isArray(data.cutPartIds) ? data.cutPartIds.map(String) : [];
    const cutPartIds=[];
    const seenCutIds=new Set();
    for (const uid of rawCutIds) {
      if (!validUids.has(uid)) throw new Error(`The Saw Optimizer job contains an invalid cut-status part ID: ${uid}.`);
      if (!seenCutIds.has(uid)) { seenCutIds.add(uid); cutPartIds.push(uid); }
    }
    const maxId=parts.reduce((max,row)=>Math.max(max,row.id),0);
    const requestedNextId=Number(data.nextId);
    return {
      format:'FabricationSawOptimizerJob',
      version:SAW_JOB_FILE_VERSION,
      savedAt:typeof data.savedAt==='string' ? data.savedAt : new Date().toISOString(),
      tubeLength,
      kerf:SAW_KERF,
      nextId:Math.max(maxId+1,Number.isInteger(requestedNextId)&&requestedNextId>0 ? requestedNextId : 1),
      parts,
      cutPartIds
    };
  }

  function applySawJobRecord(record) {
    sawJob=record.parts.map(row=>({...row}));
    sawNextId=record.nextId;
    sawCutIds=new Set(record.cutPartIds || []);
    sawTubeLength.value=measurementTextNoQuote(record.tubeLength);
    sawLastResult=null;
    sawLastTubeLength=NaN;
    sawPartLabel.value='';
    sawPartLength.value='';
    sawPartQty.value='1';
    sawResults.classList.remove('show');
    sawSummary.innerHTML='';
    sawTubeResults.innerHTML='';
    clearSawStatus();
    renderSawJob();
  }

  function exportSawJob() {
    clearSawJobFileStatus();
    const tubeLength=parseShopMeasurement(sawTubeLength.value);
    if (!Number.isFinite(tubeLength) || tubeLength<=0 || tubeLength>MAX_SAW_TUBE_LENGTH) {
      showSawJobFileStatus(`Enter a valid tube length greater than 0 and no more than ${MAX_SAW_TUBE_LENGTH} inches before exporting.`,'error');
      sawTubeLength.focus();
      return;
    }
    if (!sawJob.length) {
      showSawJobFileStatus('Add at least one saw part before exporting the job.','error');
      return;
    }
    const payload={fabricationSawOptimizerJob:serializeSawJob()};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download='Saw-Optimizer-Job.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    showSawJobFileStatus(`Saw job exported with ${sawPhysicalPieceCount()} piece${sawPhysicalPieceCount()===1?'':'s'} and all current cut-status marks.`,'ok');
  }

  function importSawJobFile(file) {
    if (!file) return;
    if (file.size>MAX_SAW_IMPORT_BYTES) {
      showSawJobFileStatus(`That Saw Optimizer job file is too large. Maximum import size is ${Math.round(MAX_SAW_IMPORT_BYTES/1024/1024)} MB.`,'error');
      sawImportFile.value='';
      return;
    }
    clearSawJobFileStatus();
    const reader=new FileReader();
    reader.onload=()=>{
      try {
        const parsed=JSON.parse(String(reader.result || ''));
        const record=normalizeSawJobRecord(parsed);
        if ((sawJob.length || sawCutIds.size) && !window.confirm('Import this Saw Optimizer job and replace the current saw job?')) return;
        applySawJobRecord(record);
        showSawJobFileStatus(`Saw job imported with ${sawPhysicalPieceCount()} piece${sawPhysicalPieceCount()===1?'':'s'}. Press Optimize Job to calculate the tube layout.`,'ok');
      } catch (error) {
        showSawJobFileStatus(error.message || 'Unable to import that Saw Optimizer job file.','error');
      } finally {
        sawImportFile.value='';
      }
    };
    reader.onerror=()=>{
      showSawJobFileStatus('The selected Saw Optimizer job file could not be read.','error');
      sawImportFile.value='';
    };
    reader.readAsText(file);
  }

  function renderSawJob() {
    const total=sawPhysicalPieceCount();
    sawCutListMeta.textContent=total;
    sawCutListDrawerMeta.textContent=`${total} piece${total===1?'':'s'}`;
    if (!sawJob.length) {
      sawPartList.innerHTML='<div class="optimizer-empty">No saw parts added yet.</div>';
      return;
    }
    sawPartList.innerHTML=sawJob.map((row,index)=>{
      const label=row.label || `${measurementText(row.length)} part`;
      let cutCount=0;
      for (let i=1;i<=row.qty;i++) if (sawCutIds.has(`${row.id}-${i}`)) cutCount++;
      const allCut=cutCount===row.qty && row.qty>0;
      return `<div class="saw-part-row${allCut?' all-cut':''}">
        <div class="saw-part-index">${index+1}</div>
        <div><strong>${escapeHtml(label)} × ${row.qty}</strong><small>${measurementText(row.length)} each</small><span class="saw-part-cut-summary">${cutCount} of ${row.qty} cut</span></div>
        <button class="icon-btn" type="button" aria-label="Remove saw part" data-remove-saw="${row.id}">×</button>
      </div>`;
    }).join('');
  }

  function setSawCutListDrawerOpen(open) {
    if (open) openDrawer('sawCutListDrawer',document.activeElement); else closeDrawer('sawCutListDrawer');
    sawCutListMenuBtn.setAttribute('aria-expanded',open?'true':'false');
  }

  sawCutListMenuBtn.addEventListener('click',()=>{
    setSawCutListDrawerOpen(!sawCutListDrawer.classList.contains('open'));
  });
  sawCutListCloseBtn.addEventListener('click',()=>setSawCutListDrawerOpen(false));
  sawCutListBackdrop.addEventListener('click',()=>setSawCutListDrawerOpen(false));
  document.addEventListener('keydown',e=>{
    if (e.key==='Escape' && sawCutListDrawer.classList.contains('open')) setSawCutListDrawerOpen(false);
  });


  function addSawPart() {
    clearSawStatus();
    const length=parseShopMeasurement(sawPartLength.value);
    const qty=Number(sawPartQty.value);
    const label=sawPartLabel.value.trim();
    if (!Number.isFinite(length) || length<=0) {
      showSawStatus('Enter a valid part length. Decimals and shop fractions such as 46 3/4 are accepted.');
      return;
    }
    if (!Number.isInteger(qty) || qty<1 || qty>500) {
      showSawStatus('Quantity must be a whole number from 1 through 500.');
      return;
    }
    if (label.length>MAX_OPTIMIZER_LABEL_LENGTH) {
      showSawStatus(`Part labels are limited to ${MAX_OPTIMIZER_LABEL_LENGTH} characters.`);
      return;
    }
    if (sawJob.length>=MAX_SAW_ROWS) {
      showSawStatus(`This saw job has reached the ${MAX_SAW_ROWS}-row limit.`);
      return;
    }
    if (sawPhysicalPieceCount()+qty>MAX_SAW_PIECES) {
      showSawStatus(`This addition would exceed the ${MAX_SAW_PIECES}-piece saw optimizer limit.`);
      return;
    }
    sawJob.push({id:sawNextId++,label,length,qty});
    sawPartLength.value='';
    sawPartQty.value='1';
    sawPartLabel.value='';
    sawLastResult=null;
    sawLastTubeLength=NaN;
    sawResults.classList.remove('show');
    renderSawJob();
    sawPartLength.focus();
  }

  function expandedSawItems() {
    const items=[];
    for (const row of sawJob) {
      for (let i=1;i<=row.qty;i++) {
        items.push({uid:`${row.id}-${i}`,rowId:row.id,instance:i,label:row.label,length:row.length,size:row.length+SAW_KERF});
      }
    }
    return items;
  }

  function greedySawPacking(items,capacity) {
    const sorted=items.slice().sort((a,b)=>b.size-a.size || String(a.uid).localeCompare(String(b.uid)));
    const bins=[];
    for (const item of sorted) {
      let bestIndex=-1;
      let bestRemaining=Infinity;
      for (let i=0;i<bins.length;i++) {
        const next=bins[i].remaining-item.size;
        if (next>=-1e-9 && next<bestRemaining-1e-9) {
          bestRemaining=next;
          bestIndex=i;
        }
      }
      if (bestIndex<0) bins.push({remaining:capacity-item.size,items:[item]});
      else {
        bins[bestIndex].remaining-=item.size;
        bins[bestIndex].items.push(item);
      }
    }
    return bins;
  }

  function exactSawPacking(items,capacity,binCount,deadlineMs) {
    const ordered=items.slice().sort((a,b)=>b.size-a.size || String(a.uid).localeCompare(String(b.uid)));
    const remaining=Array(binCount).fill(capacity);
    const bins=Array.from({length:binCount},()=>[]);
    const suffix=new Array(ordered.length+1).fill(0);
    for (let i=ordered.length-1;i>=0;i--) suffix[i]=suffix[i+1]+ordered[i].size;
    let nodes=0,timedOut=false;

    function search(depth) {
      if ((++nodes & 1023)===0 && performance.now()>deadlineMs) { timedOut=true; return false; }
      if (depth===ordered.length) return true;
      const totalFree=remaining.reduce((sum,r)=>sum+r,0);
      if (suffix[depth]>totalFree+1e-9) return false;
      const item=ordered[depth];
      let maxFree=0;
      for (const r of remaining) if (r>maxFree) maxFree=r;
      if (item.size>maxFree+1e-9) return false;

      const choices=Array.from({length:binCount},(_,i)=>i)
        .filter(i=>item.size<=remaining[i]+1e-9)
        .sort((a,b)=>(remaining[a]-item.size)-(remaining[b]-item.size));
      const seenRemaining=new Set();
      for (const i of choices) {
        const key=remaining[i].toFixed(8);
        if (seenRemaining.has(key)) continue;
        seenRemaining.add(key);
        const wasEmpty=Math.abs(remaining[i]-capacity)<1e-9;
        remaining[i]-=item.size;
        bins[i].push(item);
        if (search(depth+1)) return true;
        bins[i].pop();
        remaining[i]+=item.size;
        if (timedOut) return false;
        if (wasEmpty) break;
      }
      return false;
    }

    const found=search(0);
    if (!found) return {bins:null,timedOut,nodes};
    return {
      bins:bins.map((list,i)=>({items:list.slice(),remaining:remaining[i]})).filter(b=>b.items.length),
      timedOut:false,nodes
    };
  }

  function optimizeSawItems(items,tubeLength) {
    const capacity=tubeLength+SAW_KERF;
    for (const item of items) if (item.length>tubeLength+1e-9) return {error:item};
    let best=greedySawPacking(items,capacity);
    const totalSize=items.reduce((sum,item)=>sum+item.size,0);
    const lowerBound=Math.max(1,Math.ceil(totalSize/capacity-1e-12));
    let minimumConfirmed=best.length===lowerBound;
    let searchTimedOut=false;
    let exactSearchUsed=false;

    if (!minimumConfirmed && items.length<=80) {
      const budget=items.length<=30?3000:items.length<=50?1800:900;
      const deadline=performance.now()+budget;
      for (let count=lowerBound;count<best.length;count++) {
        exactSearchUsed=true;
        if (performance.now()>deadline) { searchTimedOut=true; break; }
        const attempt=exactSawPacking(items,capacity,count,deadline);
        if (attempt.bins) {
          best=attempt.bins;
          minimumConfirmed=true;
          break;
        }
        if (attempt.timedOut) { searchTimedOut=true; break; }
      }
    }

    // Restore physical leftover. The transformed capacity contains one kerf
    // credit per tube, exactly matching kerf only between adjacent pieces.
    const bins=best.map(bin=>{
      const itemLength=bin.items.reduce((sum,item)=>sum+item.length,0);
      const kerfLoss=Math.max(0,bin.items.length-1)*SAW_KERF;
      const offcut=Math.max(0,tubeLength-itemLength-kerfLoss);
      return {items:bin.items.slice(),itemLength,kerfLoss,offcut};
    });
    return {bins,lowerBound,minimumConfirmed,searchTimedOut,exactSearchUsed};
  }

  function sawRulerMarkup(tubeLength) {
    const ticks=[0,.25,.5,.75,1];
    return `<div class="saw-ruler" aria-hidden="true">${ticks.map((ratio,index)=>{
      const cls=index===0?' start':index===ticks.length-1?' end':'';
      return `<span class="saw-ruler-tick${cls}" style="left:${ratio*100}%"><b>${measurementText(tubeLength*ratio)}</b></span>`;
    }).join('')}</div>`;
  }

  function renderSawOutput(result,tubeLength,scrollToResults=true) {
    const bins=result.bins;
    const totalPartLength=bins.reduce((sum,b)=>sum+b.itemLength,0);
    const totalKerf=bins.reduce((sum,b)=>sum+b.kerfLoss,0);
    const totalOffcut=bins.reduce((sum,b)=>sum+b.offcut,0);
    const stockTotal=bins.length*tubeLength;
    const partYield=stockTotal ? totalPartLength/stockTotal*100 : 0;

    sawSummary.innerHTML=`
      <div class="metric"><span>Tubes required</span><b>${bins.length}</b><div class="subline">${measurementText(tubeLength)} stock length</div></div>
      <div class="metric"><span>Finished parts</span><b>${measurementText(totalPartLength)}</b><div class="subline">${partYield.toFixed(1)}% part yield</div></div>
      <div class="metric"><span>Kerf loss</span><b>${measurementText(totalKerf)}</b><div class="subline">1/4&quot; between adjacent pieces</div></div>
      <div class="metric"><span>Total offcut</span><b>${measurementText(totalOffcut)}</b><div class="subline">Remaining reusable/scrap length</div></div>`;

    if (result.minimumConfirmed) {
      sawOptimizationNote.innerHTML=`<b>Minimum confirmed:</b> ${bins.length} tube${bins.length===1?'':'s'} is the minimum for this job under the 1/4&quot; between-piece kerf rule. The optimizer ${bins.length===result.lowerBound?'reached the calculated lower bound':'completed an exhaustive 1-D packing search for all smaller tube counts'}.`;
    } else {
      sawOptimizationNote.innerHTML=`<b>Best layout found:</b> ${bins.length} tube${bins.length===1?'':'s'}. The calculated lower bound is ${result.lowerBound}. This large/complex job is not being presented as a mathematically proven minimum.${result.searchTimedOut?' The deeper exact search reached its browser time budget.':''}`;
    }

    sawTubeResults.innerHTML=bins.map((bin,bi)=>{
      const parts=bin.items.slice();
      let cursor=0;
      const positioned=parts.map((item,index)=>{
        const start=cursor;
        const end=start+item.length;
        const kerfStart=end;
        const kerfEnd=index<parts.length-1 ? end+SAW_KERF : end;
        cursor=kerfEnd;
        return {item,index,start,end,kerfStart,kerfEnd};
      });
      const bar=[];
      positioned.forEach(({item,index})=>{
        const piecePct=Math.max(0,item.length/tubeLength*100);
        const display=item.label || `${measurementText(item.length)} part`;
        const isCut=sawCutIds.has(String(item.uid));
        bar.push(`<div class="saw-bar-piece${isCut?' is-cut':''}" style="flex:0 0 ${piecePct.toFixed(8)}%" title="${escapeHtml(display)} — ${measurementText(item.length)}${isCut?' — CUT':''}"><span class="saw-piece-name">${escapeHtml(display)}</span><span class="saw-piece-length">${measurementText(item.length)}</span></div>`);
        if (index<parts.length-1) {
          const kerfPct=SAW_KERF/tubeLength*100;
          bar.push(`<div class="saw-bar-kerf" style="flex:0 0 ${kerfPct.toFixed(8)}%" title="1/4 inch kerf" aria-label="1/4 inch kerf"></div>`);
        }
      });
      if (bin.offcut>1e-9) {
        const offcutPct=bin.offcut/tubeLength*100;
        bar.push(`<div class="saw-bar-offcut" style="flex:0 0 ${offcutPct.toFixed(8)}%" title="Offcut ${measurementText(bin.offcut)}"><span>OFFCUT</span><b>${measurementText(bin.offcut)}</b></div>`);
      }
      const cutRows=positioned.map(({item,index})=>{
        const name=item.label || `Part ${index+1}`;
        const isCut=sawCutIds.has(String(item.uid));
        return `<div class="saw-cut-row${isCut?' is-cut':''}" data-saw-part-uid="${escapeHtml(item.uid)}"><strong>${escapeHtml(name)} — Cut ${measurementText(item.length)}</strong><button class="saw-cut-toggle-btn${isCut?' is-cut':''}" type="button" data-toggle-saw-cut="${escapeHtml(item.uid)}">${isCut?'Mark Uncut':'Mark Cut'}</button></div>`;
      }).join('');
      const used=bin.itemLength+bin.kerfLoss;
      const cutCount=parts.filter(item=>sawCutIds.has(String(item.uid))).length;
      return `<section class="saw-tube-card">
        <div class="saw-tube-head"><strong>Tube ${bi+1} • ${measurementText(tubeLength)} stock</strong><span class="badge">${cutCount}/${parts.length} cut • ${measurementText(bin.offcut)} offcut</span></div>
        <div class="saw-tube-body">
          ${sawRulerMarkup(tubeLength)}
          <div class="saw-bar" role="img" aria-label="Tube ${bi+1}: ${measurementText(used)} used including kerf, ${measurementText(bin.offcut)} offcut">${bar.join('')}</div>
          <div class="saw-tube-detail-grid">
            <div class="metric"><span>Stock length</span><b>${measurementText(tubeLength)}</b></div>
            <div class="metric"><span>Part length</span><b>${measurementText(bin.itemLength)}</b></div>
            <div class="metric"><span>Kerf loss</span><b>${measurementText(bin.kerfLoss)}</b></div>
            <div class="metric"><span>Offcut starts</span><b>${measurementText(used)}</b><div class="subline">${measurementText(bin.offcut)} remains</div></div>
          </div>
          <div class="saw-cut-order">${cutRows}</div>
        </div>
      </section>`;
    }).join('');
    sawResults.classList.add('show');
    if (scrollToResults) sawResults.scrollIntoView({behavior:'smooth',block:'start'});
  }

  function runSawOptimizer() {
    clearSawStatus();
    const tubeLength=parseShopMeasurement(sawTubeLength.value);
    if (!Number.isFinite(tubeLength) || tubeLength<=0 || tubeLength>MAX_SAW_TUBE_LENGTH) {
      showSawStatus(`Enter a valid tube length greater than 0 and no more than ${MAX_SAW_TUBE_LENGTH} inches.`);
      return;
    }
    if (!sawJob.length) {
      showSawStatus('Add at least one saw part before optimizing.');
      return;
    }
    const items=expandedSawItems();
    const result=optimizeSawItems(items,tubeLength);
    if (result.error) {
      const name=result.error.label || 'A part';
      showSawStatus(`${name} is ${measurementText(result.error.length)} long and does not fit the ${measurementText(tubeLength)} stock tube.`);
      sawResults.classList.remove('show');
      sawLastResult=null;
      sawLastTubeLength=NaN;
      return;
    }
    sawLastResult=result;
    sawLastTubeLength=tubeLength;
    renderSawOutput(result,tubeLength,true);
    showSawStatus(`Saw job optimized with a fixed 1/4&quot; kerf between adjacent pieces. Entry order was ignored and parts were regrouped to reduce stock usage.`,'ok');
  }

  function findSawPhysicalPart(uid) {
    return expandedSawItems().find(item=>String(item.uid)===String(uid)) || null;
  }

  function toggleSawPartCut(uid) {
    const item=findSawPhysicalPart(uid);
    if (!item) return;
    const isCut=sawCutIds.has(String(uid));
    const row=sawJob.find(r=>r.id===item.rowId);
    const base=item.label || `${measurementText(item.length)} part`;
    const instanceText=row && row.qty>1 ? ` piece ${item.instance} of ${row.qty}` : '';
    const nextWord=isCut?'NOT CUT':'CUT';
    if (!window.confirm(`Mark ${base}${instanceText} as ${nextWord}?`)) return;
    if (isCut) sawCutIds.delete(String(uid)); else sawCutIds.add(String(uid));
    renderSawJob();
    if (sawLastResult && Number.isFinite(sawLastTubeLength)) renderSawOutput(sawLastResult,sawLastTubeLength,false);
    showSawStatus(`${base}${instanceText} marked ${isCut?'not cut':'cut'}.`,'ok');
  }

  function clearSawJob() {
    if (sawJob.length && !window.confirm('Clear the current saw job, cut-status marks, and optimized layout?')) return;
    sawJob=[];
    sawNextId=1;
    sawCutIds=new Set();
    sawLastResult=null;
    sawLastTubeLength=NaN;
    sawPartLabel.value='';
    sawPartLength.value='';
    sawPartQty.value='1';
    sawResults.classList.remove('show');
    sawSummary.innerHTML='';
    sawTubeResults.innerHTML='';
    clearSawStatus();
    clearSawJobFileStatus();
    renderSawJob();
  }

  sawPartList.addEventListener('click',e=>{
    const btn=e.target.closest('[data-remove-saw]');
    if (!btn) return;
    const id=Number(btn.dataset.removeSaw);
    sawJob=sawJob.filter(row=>row.id!==id);
    for (const uid of Array.from(sawCutIds)) if (uid.startsWith(`${id}-`)) sawCutIds.delete(uid);
    sawLastResult=null;
    sawLastTubeLength=NaN;
    sawResults.classList.remove('show');
    renderSawJob();
  });
  sawTubeResults.addEventListener('click',e=>{
    const btn=e.target.closest('[data-toggle-saw-cut]');
    if (!btn) return;
    toggleSawPartCut(btn.dataset.toggleSawCut);
  });
  document.getElementById('sawAddPartBtn').addEventListener('click',addSawPart);
  document.getElementById('sawOptimizeBtn').addEventListener('click',runSawOptimizer);
  document.getElementById('sawClearBtn').addEventListener('click',clearSawJob);
  sawExportJobBtn.addEventListener('click',exportSawJob);
  sawImportJobBtn.addEventListener('click',()=>sawImportFile.click());
  sawImportFile.addEventListener('change',()=>importSawJobFile(sawImportFile.files && sawImportFile.files[0]));
  [sawPartLength,sawPartQty].forEach(el=>el.addEventListener('keydown',e=>{if(e.key==='Enter') addSawPart();}));
  sawTubeLength.addEventListener('keydown',e=>{if(e.key==='Enter') runSawOptimizer();});
  sawTubeLength.addEventListener('input',()=>{
    if (!sawLastResult) return;
    sawLastResult=null;
    sawLastTubeLength=NaN;
    sawResults.classList.remove('show');
    clearSawStatus();
  });
  renderSawJob();

  function measurementText(value) {
    const rounded16 = Math.round(value * 16) / 16;
    if (Math.abs(value - rounded16) < 0.00001) return toFraction16(value);
    return trimZeros(value,4) + '"';
  }

  function updateOptimizerProductColor() {
    const product = PRODUCTS[optimizerProduct.value];
    if (!product) return;
    optimizerProduct.style.setProperty('--product-color', product.color || '#00D2FF');
  }

  function updateOptimizerRulePreview() {
    const product = PRODUCTS[optimizerProduct.value];
    const material = MATERIALS[product.material];
    updateOptimizerProductColor();
    optimizerRule.textContent = product.rule;
    optimizerMaterial.textContent = `${material.name}${material.cutMethod==='shear'?' • full-edge shear':''}`;
    optimizerSheet.textContent = `${measurementText(material.rawL)} × ${measurementText(material.rawW)} / ${measurementText(material.usableL)} × ${measurementText(material.usableW)}`;
  }

  function showOptimizerStatus(message,type='error') {
    optimizerStatus.textContent = message;
    optimizerStatus.className = `status show ${type}`;
  }

  function clearOptimizerStatus() {
    optimizerStatus.textContent = '';
    optimizerStatus.className = 'status';
  }

  function optimizerCutSize(productKey, finishedWidth, finishedHeight) {
    const product = PRODUCTS[productKey];
    return {
      width: finishedWidth + product.deltaW,
      height: finishedHeight + product.deltaH
    };
  }

  function addOptimizerPart() {
    clearOptimizerStatus();
    const productKey = optimizerProduct.value;
    const finishedWidth = parseShopMeasurement(optimizerWidth.value);
    const finishedHeight = parseShopMeasurement(optimizerHeight.value);
    const qty = Number(optimizerQty.value);
    if (!Number.isFinite(finishedWidth) || !Number.isFinite(finishedHeight) || finishedWidth <= 0 || finishedHeight <= 0) {
      showOptimizerStatus('Enter a valid finished width and height. Decimals and fractions such as 23-3/4 or 47 1/2 are accepted.');
      return;
    }
    if (!Number.isInteger(qty) || qty < 1 || qty > 500) {
      showOptimizerStatus('Quantity must be a whole number from 1 through 500.');
      return;
    }
    if (optimizerJob.length >= MAX_OPTIMIZER_ROWS) {
      showOptimizerStatus(`This job has reached the ${MAX_OPTIMIZER_ROWS}-row optimizer limit.`);
      return;
    }
    if (currentOptimizerPieceCount() + qty > MAX_OPTIMIZER_PIECES) {
      showOptimizerStatus(`This addition would exceed the ${MAX_OPTIMIZER_PIECES}-piece optimizer limit.`);
      return;
    }
    if (optimizerLabel.value.trim().length > MAX_OPTIMIZER_LABEL_LENGTH) {
      showOptimizerStatus(`Part labels are limited to ${MAX_OPTIMIZER_LABEL_LENGTH} characters.`);
      return;
    }
    const cut = optimizerCutSize(productKey, finishedWidth, finishedHeight);
    if (cut.width <= 0 || cut.height <= 0) {
      showOptimizerStatus('The selected product rule makes this cut zero or negative. Increase the finished size.');
      return;
    }
    optimizerJob.push({
      id: optimizerNextId++,
      productKey,
      label: optimizerLabel.value.trim(),
      finishedWidth, finishedHeight, qty,
      cutWidth:cut.width, cutHeight:cut.height
    });
    optimizerLastResults=null;
    markOptimizerDirty();
    renderOptimizerJob();
    optimizerResults.classList.remove('show');
    optimizerWidth.value = '';
    optimizerHeight.value = '';
    optimizerQty.value = '1';
    optimizerLabel.value = '';
    optimizerWidth.focus();
  }

  function clearOptimizerCopyStatus() {
    optimizerCopyStatus.textContent='';
    optimizerCopyStatus.className='status';
  }

  function showOptimizerCopyStatus(message,type='ok') {
    optimizerCopyStatus.textContent=message;
    optimizerCopyStatus.className=`status show ${type}`;
  }

  function updateOptimizerCopyControls() {
    const previousSource=optimizerCopySource.value;
    const previousTarget=optimizerCopyTarget.value;
    const counts={};
    for (const row of optimizerJob) counts[row.productKey]=(counts[row.productKey]||0)+row.qty;
    const available=COPY_COMPATIBLE_PRODUCTS.filter(key=>counts[key]>0);

    if (!available.length) {
      optimizerCopySource.innerHTML='<option value="">No compatible parts available</option>';
      optimizerCopyTarget.innerHTML='<option value="">Select destination</option>';
      optimizerCopySource.disabled=true;
      optimizerCopyTarget.disabled=true;
      optimizerCopyBtn.disabled=true;
      optimizerCopyBtn.textContent='Copy Entire List';
      clearOptimizerCopyStatus();
      return;
    }

    optimizerCopySource.disabled=false;
    optimizerCopySource.innerHTML=available.map(key=>`<option value="${key}">${escapeHtml(PRODUCTS[key].shortName)} — ${counts[key]} pc${counts[key]===1?'':'s'}</option>`).join('');
    optimizerCopySource.value=available.includes(previousSource)?previousSource:available[0];
    const sourceKey=optimizerCopySource.value;
    const targets=COPY_COMPATIBLE_PRODUCTS.filter(key=>key!==sourceKey);
    optimizerCopyTarget.disabled=false;
    optimizerCopyTarget.innerHTML=targets.map(key=>`<option value="${key}">${escapeHtml(PRODUCTS[key].shortName)}</option>`).join('');
    optimizerCopyTarget.value=targets.includes(previousTarget)?previousTarget:targets[0];
    optimizerCopyBtn.disabled=!optimizerCopyTarget.value;
    optimizerCopyBtn.textContent=optimizerCopyTarget.value ? `Copy to ${PRODUCTS[optimizerCopyTarget.value].shortName}` : 'Copy Entire List';
  }

  function copyOptimizerProductList() {
    clearOptimizerCopyStatus();
    const sourceKey=optimizerCopySource.value;
    const targetKey=optimizerCopyTarget.value;
    if (!sourceKey || !targetKey || sourceKey===targetKey) {
      showOptimizerCopyStatus('Choose two different products.','error');
      return;
    }
    if (!COPY_COMPATIBLE_PRODUCTS.includes(sourceKey) || !COPY_COMPATIBLE_PRODUCTS.includes(targetKey)) {
      showOptimizerCopyStatus('Part-list copying is only available between .063 Wall, .063 Door, Cellulose, and ACP.','error');
      updateOptimizerCopyControls();
      return;
    }
    const sourceRows=optimizerJob.filter(row=>row.productKey===sourceKey);
    if (!sourceRows.length) {
      showOptimizerCopyStatus('There are no parts in the selected source product.','error');
      updateOptimizerCopyControls();
      return;
    }
    const sourcePieceCount=sourceRows.reduce((sum,row)=>sum+row.qty,0);
    if (optimizerJob.length + sourceRows.length > MAX_OPTIMIZER_ROWS || currentOptimizerPieceCount() + sourcePieceCount > MAX_OPTIMIZER_PIECES) {
      showOptimizerCopyStatus(`Copying this list would exceed the optimizer limit of ${MAX_OPTIMIZER_ROWS} rows or ${MAX_OPTIMIZER_PIECES} total pieces.`,'error');
      return;
    }

    const targetMaterial=MATERIALS[PRODUCTS[targetKey].material];
    const copies=[];
    for (const row of sourceRows) {
      const cut=optimizerCutSize(targetKey,row.finishedWidth,row.finishedHeight);
      // Entered Width follows the sheet's long/grain axis; entered Height follows the short axis.
      const fitsNormal=cut.width<=targetMaterial.usableL+1e-9 && cut.height<=targetMaterial.usableW+1e-9;
      const freeRotation=!optimizerGrainFlowRotation.checked;
      const fitsRotated=freeRotation && cut.height<=targetMaterial.usableL+1e-9 && cut.width<=targetMaterial.usableW+1e-9;
      if (cut.width<=0 || cut.height<=0 || (!fitsNormal && !fitsRotated)) {
        const rowName=row.label || PRODUCTS[sourceKey].shortName;
        const orientationNote=optimizerGrainFlowRotation.checked
          ? ' while Grain Flow Rotation is ON. Turn it OFF to allow free 90° nesting'
          : ' even with free 90° nesting';
        showOptimizerCopyStatus(`${rowName} would require a ${measurementText(cut.width)} W × ${measurementText(cut.height)} H ${PRODUCTS[targetKey].shortName} cut, which does not fit the destination sheet${orientationNote}. Nothing was copied.`,'error');
        return;
      }
      copies.push({
        id:optimizerNextId++,
        productKey:targetKey,
        label:row.label,
        finishedWidth:row.finishedWidth,
        finishedHeight:row.finishedHeight,
        qty:row.qty,
        cutWidth:cut.width,
        cutHeight:cut.height
      });
    }

    const hadResults=optimizerResults.classList.contains('show');
    optimizerJob.push(...copies);
    optimizerLastResults=null;
    markOptimizerDirty();
    renderOptimizerJob();
    const pieceCount=copies.reduce((sum,row)=>sum+row.qty,0);
    showOptimizerCopyStatus(`Copied ${pieceCount} piece${pieceCount===1?'':'s'} from ${PRODUCTS[sourceKey].shortName} to ${PRODUCTS[targetKey].shortName}. Finished sizes, quantities, and labels were preserved; destination cut rules were recalculated. New pieces start uncut.`,'ok');
    if (hadResults) runOptimizer(false);
  }

  function setOptimizerCutListDrawerOpen(open) {
    if (open) openDrawer('optimizerCutListDrawer',document.activeElement); else closeDrawer('optimizerCutListDrawer');
    optimizerCutListMenuBtn.setAttribute('aria-expanded',open?'true':'false');
  }

  optimizerCutListMenuBtn.addEventListener('click', () => {
    setOptimizerCutListDrawerOpen(!optimizerCutListDrawer.classList.contains('open'));
  });
  optimizerCutListCloseBtn.addEventListener('click', () => setOptimizerCutListDrawerOpen(false));
  optimizerCutListBackdrop.addEventListener('click', () => setOptimizerCutListDrawerOpen(false));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && optimizerCutListDrawer.classList.contains('open')) {
      setOptimizerCutListDrawerOpen(false);
    }
  });



  function renderOptimizerJob() {
    const totalPieces = optimizerJob.reduce((sum,item) => sum + Number(item.qty || 0), 0);
    optimizerCutListMeta.textContent = totalPieces;
    optimizerCutListDrawerMeta.textContent = `${totalPieces} piece${totalPieces === 1 ? '' : 's'}`;
    updateOptimizerCopyControls();
    if (!optimizerJob.length) {
      optimizerJobList.innerHTML = '<div class="optimizer-empty">No parts added yet.</div>';
      return;
    }
    optimizerJobList.innerHTML = optimizerJob.map((item,index) => {
      const p = PRODUCTS[item.productKey];
      const m = MATERIALS[p.material];
      const name = item.label ? `${item.label} — ${p.name}` : p.name;
      let cutCount=0;
      for (let q=1;q<=item.qty;q++) if (optimizerCutIds.has(`${item.id}-${q}`)) cutCount++;
      const allCut=cutCount===item.qty && item.qty>0;
      return `<div class="job-row${allCut?' all-cut':''}" style="--part-color:${p.color || '#00D2FF'}">
        <div class="job-index">${index+1}</div>
        <div class="job-main">
          <strong>${escapeHtml(name)} × ${item.qty}</strong>
          <small>Finished ${measurementText(item.finishedWidth)} W × ${measurementText(item.finishedHeight)} H → Cut <b>${measurementText(item.cutWidth)} W × ${measurementText(item.cutHeight)} H</b> • ${escapeHtml(m.name)}</small>
          <span class="job-cut-summary">${cutCount} of ${item.qty} cut</span>
        </div>
        <button class="icon-btn" type="button" aria-label="Remove part" data-remove-job="${item.id}">×</button>
      </div>`;
    }).join('');
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }

  optimizerJobList.addEventListener('click', e => {
    const btn = e.target.closest('[data-remove-job]');
    if (!btn) return;
    const id = Number(btn.dataset.removeJob);
    optimizerJob = optimizerJob.filter(item => item.id !== id);
    for (const uid of Array.from(optimizerCutIds)) if (uid.startsWith(`${id}-`)) optimizerCutIds.delete(uid);
    optimizerLastResults=null;
    markOptimizerDirty();
    renderOptimizerJob();
    optimizerResults.classList.remove('show');
  });

  function rectIntersects(a,b) {
    return !(b.x >= a.x + a.w - 1e-9 || b.x + b.w <= a.x + 1e-9 || b.y >= a.y + a.h - 1e-9 || b.y + b.h <= a.y + 1e-9);
  }

  function splitFreeRects(freeRects, used) {
    const out = [];
    for (const f of freeRects) {
      if (!rectIntersects(f,used)) { out.push(f); continue; }
      if (used.x > f.x + 1e-9) out.push({x:f.x,y:f.y,w:used.x-f.x,h:f.h});
      if (used.x + used.w < f.x + f.w - 1e-9) out.push({x:used.x+used.w,y:f.y,w:f.x+f.w-(used.x+used.w),h:f.h});
      if (used.y > f.y + 1e-9) out.push({x:f.x,y:f.y,w:f.w,h:used.y-f.y});
      if (used.y + used.h < f.y + f.h - 1e-9) out.push({x:f.x,y:used.y+used.h,w:f.w,h:f.y+f.h-(used.y+used.h)});
    }
    return pruneFreeRects(out);
  }

  function pruneFreeRects(rects) {
    const clean = rects.filter(r => r.w > 1e-8 && r.h > 1e-8);
    const keep = new Array(clean.length).fill(true);
    for (let i=0;i<clean.length;i++) {
      if (!keep[i]) continue;
      for (let j=0;j<clean.length;j++) {
        if (i === j || !keep[j]) continue;
        const a=clean[i], b=clean[j];
        if (a.x >= b.x-1e-9 && a.y >= b.y-1e-9 && a.x+a.w <= b.x+b.w+1e-9 && a.y+a.h <= b.y+b.h+1e-9) {
          keep[i]=false; break;
        }
      }
    }
    return clean.filter((_,i) => keep[i]);
  }

  function placementScore(f, rw, rh, heuristic) {
    const lw = f.w-rw, lh=f.h-rh;
    const shortFit=Math.min(lw,lh), longFit=Math.max(lw,lh), areaFit=f.w*f.h-rw*rh;
    if (heuristic === 'area') return [areaFit,shortFit,longFit,f.y,f.x];
    if (heuristic === 'bottom') return [f.y+rh,f.x,shortFit,longFit,areaFit];
    if (heuristic === 'long') return [longFit,shortFit,areaFit,f.y,f.x];
    return [shortFit,longFit,areaFit,f.y,f.x];
  }

  function lexLess(a,b) {
    if (!b) return true;
    for (let i=0;i<a.length;i++) {
      if (a[i] < b[i]-1e-9) return true;
      if (a[i] > b[i]+1e-9) return false;
    }
    return false;
  }

  function bestPlacementAcrossBins(bins,item,allowRotate,heuristic) {
    let best=null, bestScore=null;
    for (let bi=0;bi<bins.length;bi++) {
      const bin=bins[bi];
      for (let fi=0;fi<bin.free.length;fi++) {
        const f=bin.free[fi];
        const orientations = [{w:item.cutL,h:item.cutW,rotated:false}];
        if (allowRotate && Math.abs(item.cutL-item.cutW)>1e-9) orientations.push({w:item.cutW,h:item.cutL,rotated:true});
        for (const o of orientations) {
          if (o.w <= f.w+1e-9 && o.h <= f.h+1e-9) {
            const base=placementScore(f,o.w,o.h,heuristic);
            const score=[...base,bin.used.length===0?1:0,bi];
            if (lexLess(score,bestScore)) {
              bestScore=score;
              best={binIndex:bi,x:f.x,y:f.y,w:o.w,h:o.h,rotated:o.rotated};
            }
          }
        }
      }
    }
    return best;
  }

  function deterministicShuffle(n,seed) {
    const a=Array.from({length:n},(_,i)=>i);
    let x=seed>>>0;
    for (let i=n-1;i>0;i--) {
      x=(1664525*x+1013904223)>>>0;
      const j=x%(i+1);
      [a[i],a[j]]=[a[j],a[i]];
    }
    return a;
  }

  function buildOrders(items) {
    const base=Array.from({length:items.length},(_,i)=>i);
    const sortBy=fn=>base.slice().sort((a,b)=>fn(items[b])-fn(items[a]) || a-b);
    const orders=[
      sortBy(p=>p.cutL*p.cutW),
      sortBy(p=>Math.max(p.cutL,p.cutW)),
      sortBy(p=>p.cutL+p.cutW),
      sortBy(p=>p.cutL),
      sortBy(p=>p.cutW),
      sortBy(p=>Math.min(p.cutL,p.cutW)),
      sortBy(p=>Math.abs(p.cutL-p.cutW))
    ];
    // Extra whole-job orderings help find a strong upper bound before
    // the backtracking search starts.
    for (let seed=1;seed<=48;seed++) orders.push(deterministicShuffle(items.length,seed*7919));
    return orders;
  }

  function packWithOrder(items,W,H,allowRotate,order,heuristic) {
    const bins=[];
    for (const idx of order) {
      const item=items[idx];
      let place=bestPlacementAcrossBins(bins,item,allowRotate,heuristic);
      if (!place) {
        bins.push({free:[{x:0,y:0,w:W,h:H}],used:[]});
        place=bestPlacementAcrossBins(bins,item,allowRotate,heuristic);
        if (!place) return null;
      }
      const bin=bins[place.binIndex];
      const used={x:place.x,y:place.y,w:place.w,h:place.h,item,rotated:place.rotated};
      bin.used.push(used);
      bin.free=splitFreeRects(bin.free,used);
    }
    return bins;
  }

  function bestGreedyPacking(items,W,H,allowRotate) {
    const orders=buildOrders(items);
    const heuristics=['short','area','bottom','long'];
    let best=null;
    for (const h of heuristics) {
      for (const order of orders) {
        const packed=packWithOrder(items,W,H,allowRotate,order,h);
        if (!packed) continue;
        if (!best || packed.length<best.length) best=packed;
        if (best && best.length===1) return best;
      }
    }
    return best;
  }

  function itemOrientations(item,W,H,allowRotate) {
    const out=[];
    if (item.cutL<=W+1e-9 && item.cutW<=H+1e-9) out.push({w:item.cutL,h:item.cutW,rotated:false});
    if (allowRotate && Math.abs(item.cutL-item.cutW)>1e-9 && item.cutW<=W+1e-9 && item.cutL<=H+1e-9) out.push({w:item.cutW,h:item.cutL,rotated:true});
    return out;
  }

  function twoItemsCanShareSheet(a,b,W,H,allowRotate) {
    const ao=itemOrientations(a,W,H,allowRotate), bo=itemOrientations(b,W,H,allowRotate);
    for (const x of ao) for (const y of bo) {
      if (x.w+y.w<=W+1e-9 && Math.max(x.h,y.h)<=H+1e-9) return true;
      if (x.h+y.h<=H+1e-9 && Math.max(x.w,y.w)<=W+1e-9) return true;
    }
    return false;
  }

  function incompatibilityCliqueLowerBound(items,W,H,allowRotate) {
    const n=items.length;
    if (n<=1) return n;
    const incompatible=Array.from({length:n},()=>new Set());
    for (let i=0;i<n;i++) for (let j=i+1;j<n;j++) {
      if (!twoItemsCanShareSheet(items[i],items[j],W,H,allowRotate)) {
        incompatible[i].add(j); incompatible[j].add(i);
      }
    }
    const degreeOrder=Array.from({length:n},(_,i)=>i).sort((a,b)=>incompatible[b].size-incompatible[a].size);
    let best=1;
    const starts=n<=100?degreeOrder:degreeOrder.slice(0,40);
    for (const seed of starts) {
      const clique=[seed];
      for (const v of degreeOrder) {
        if (v===seed) continue;
        if (clique.every(c=>incompatible[v].has(c))) clique.push(v);
      }
      if (clique.length>best) best=clique.length;
    }
    return best;
  }

  function exactCandidatePlacements(bins,item,W,H,allowRotate) {
    const candidates=[];
    const seen=new Set();
    const seenBinShapes=new Set();
    const orientations=itemOrientations(item,W,H,allowRotate);

    for (let bi=0;bi<bins.length;bi++) {
      const bin=bins[bi];
      // Identical bins are interchangeable. Skipping duplicate geometric states
      // removes a huge amount of symmetry without changing the solution space.
      const binShape=bin.used.length===0
        ? 'EMPTY'
        : bin.free.map(r=>`${r.x.toFixed(8)},${r.y.toFixed(8)},${r.w.toFixed(8)},${r.h.toFixed(8)}`).sort().join('|');
      if (seenBinShapes.has(binShape)) continue;
      seenBinShapes.add(binShape);

      for (const f of bin.free) {
        for (const o of orientations) {
          if (o.w>f.w+1e-9 || o.h>f.h+1e-9) continue;
          const xs=[f.x, f.x+f.w-o.w];
          const ys=[f.y, f.y+f.h-o.h];
          for (const x of xs) for (const y of ys) {
            const key=`${bi}|${x.toFixed(8)}|${y.toFixed(8)}|${o.w.toFixed(8)}|${o.h.toFixed(8)}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const shortFit=Math.min(f.w-o.w,f.h-o.h);
            const longFit=Math.max(f.w-o.w,f.h-o.h);
            candidates.push({
              binIndex:bi,x,y,w:o.w,h:o.h,rotated:o.rotated,
              score:[bin.used.length===0?1:0,shortFit,longFit,f.w*f.h-o.w*o.h,y,x]
            });
          }
        }
      }
    }
    candidates.sort((a,b)=>{
      for (let i=0;i<a.score.length;i++) {
        if (a.score[i]!==b.score[i]) return a.score[i]-b.score[i];
      }
      return a.binIndex-b.binIndex;
    });
    return candidates;
  }

  function cloneBins(bins) {
    return bins.map(b=>({
      free:b.free.map(r=>({...r})),
      used:b.used.map(u=>({...u}))
    }));
  }

  function boundedBacktrackingPack(items,W,H,binCount,allowRotate,deadlineMs) {
    // A fixed item order does NOT force a sheet order: every item is tried in
    // every feasible sheet/location and earlier choices are backtracked.
    // Largest / hardest pieces first keeps the search practical.
    const ordered=items.slice().sort((a,b)=>
      (b.cutL*b.cutW)-(a.cutL*a.cutW) ||
      Math.max(b.cutL,b.cutW)-Math.max(a.cutL,a.cutW) ||
      Math.min(b.cutL,b.cutW)-Math.min(a.cutL,a.cutW) ||
      String(a.uid).localeCompare(String(b.uid))
    );
    const bins=Array.from({length:binCount},()=>({free:[{x:0,y:0,w:W,h:H}],used:[]}));
    const sheetArea=W*H;
    const suffixArea=new Array(ordered.length+1).fill(0);
    for (let i=ordered.length-1;i>=0;i--) suffixArea[i]=suffixArea[i+1]+ordered[i].cutL*ordered[i].cutW;
    let timedOut=false;
    let nodes=0;

    function search(depth,usedArea) {
      if ((++nodes & 511)===0 && performance.now()>deadlineMs) { timedOut=true; return null; }
      if (depth===ordered.length) return cloneBins(bins).filter(b=>b.used.length);

      // Pure area capacity prune across all requested sheets.
      if (suffixArea[depth] > binCount*sheetArea-usedArea+1e-8) return null;

      const item=ordered[depth];
      const placements=exactCandidatePlacements(bins,item,W,H,allowRotate);
      if (!placements.length) return null;

      for (const place of placements) {
        if (timedOut) return null;
        const bin=bins[place.binIndex];
        const oldFree=bin.free;
        const used={x:place.x,y:place.y,w:place.w,h:place.h,item,rotated:place.rotated};
        bin.used.push(used);
        bin.free=splitFreeRects(oldFree,used);
        const result=search(depth+1,usedArea+place.w*place.h);
        if (result) return result;
        bin.used.pop();
        bin.free=oldFree;
      }
      return null;
    }

    const result=search(0,0);
    return {bins:result,timedOut,nodes};
  }

  function validatePackingGeometry(bins,items,W,H,allowRotate) {
    if (!Array.isArray(bins)) return {ok:false, reason:'No sheet layout was produced.'};
    const expected = new Map(items.map(item => [String(item.uid), item]));
    const seen = new Set();
    const eps = 1e-7;

    for (let bi=0; bi<bins.length; bi++) {
      const used = Array.isArray(bins[bi].used) ? bins[bi].used : [];
      for (let i=0; i<used.length; i++) {
        const a = used[i];
        const uid = String(a.item && a.item.uid);
        if (!expected.has(uid)) return {ok:false, reason:`Sheet ${bi+1} contains an unknown part.`};
        if (seen.has(uid)) return {ok:false, reason:`Part ${uid} was assigned more than once.`};
        seen.add(uid);

        if (a.x < -eps || a.y < -eps || a.w <= 0 || a.h <= 0 || a.x+a.w > W+eps || a.y+a.h > H+eps) {
          return {ok:false, reason:`Part ${uid} falls outside the usable sheet boundary.`};
        }

        const item = expected.get(uid);
        const normal = Math.abs(a.w-item.cutL)<=eps && Math.abs(a.h-item.cutW)<=eps;
        const rotated = allowRotate && Math.abs(a.w-item.cutW)<=eps && Math.abs(a.h-item.cutL)<=eps;
        if (!normal && !rotated) return {ok:false, reason:`Part ${uid} has an invalid placed size.`};

        for (let j=0; j<i; j++) {
          if (rectIntersects(a,used[j])) return {ok:false, reason:`Two parts overlap on Sheet ${bi+1}.`};
        }
      }
    }

    if (seen.size !== expected.size) return {ok:false, reason:`Only ${seen.size} of ${expected.size} parts were assigned to sheets.`};
    return {ok:true};
  }

  function isShearMaterial(material) {
    return material && material.cutMethod === 'shear';
  }

  function shearSplitOptions(f,w,h) {
    const eps=1e-9;
    const remW=f.w-w, remH=f.h-h;
    const options=[];

    function add(mode) {
      const free=[];
      const cuts=[];
      if (mode==='vertical') {
        if (remW>eps) {
          cuts.push({axis:'x',line:f.x+w,offset:w,region:{...f}});
          free.push({x:f.x+w,y:f.y,w:remW,h:f.h});
          if (remH>eps) {
            const strip={x:f.x,y:f.y,w:w,h:f.h};
            cuts.push({axis:'y',line:f.y+h,offset:h,region:strip});
            free.push({x:f.x,y:f.y+h,w:w,h:remH});
          }
        } else if (remH>eps) {
          cuts.push({axis:'y',line:f.y+h,offset:h,region:{...f}});
          free.push({x:f.x,y:f.y+h,w:f.w,h:remH});
        }
      } else {
        if (remH>eps) {
          cuts.push({axis:'y',line:f.y+h,offset:h,region:{...f}});
          free.push({x:f.x,y:f.y+h,w:f.w,h:remH});
          if (remW>eps) {
            const strip={x:f.x,y:f.y,w:f.w,h:h};
            cuts.push({axis:'x',line:f.x+w,offset:w,region:strip});
            free.push({x:f.x+w,y:f.y,w:remW,h:h});
          }
        } else if (remW>eps) {
          cuts.push({axis:'x',line:f.x+w,offset:w,region:{...f}});
          free.push({x:f.x+w,y:f.y,w:remW,h:f.h});
        }
      }
      const key=free.map(r=>`${r.x.toFixed(7)},${r.y.toFixed(7)},${r.w.toFixed(7)},${r.h.toFixed(7)}`).sort().join('|');
      if (!options.some(o=>o.key===key)) options.push({mode,free,cuts,key});
    }

    add('vertical');
    add('horizontal');
    return options;
  }

  function shearCandidateScore(f,w,h,split,newSheet,heuristic) {
    const remW=Math.max(0,f.w-w), remH=Math.max(0,f.h-h);
    const areas=split.free.map(r=>r.w*r.h);
    const largest=areas.length?Math.max(...areas):0;
    const smallest=areas.length?Math.min(...areas):0;
    const widestShort=split.free.length?Math.max(...split.free.map(r=>Math.min(r.w,r.h))):0;
    const shortFit=Math.min(remW,remH), longFit=Math.max(remW,remH);
    const fragments=split.free.length;
    if (heuristic==='largest') return [newSheet,-largest,-widestShort,fragments,shortFit,longFit,f.y,f.x];
    if (heuristic==='balanced') return [newSheet,areas.length>1?Math.abs(areas[0]-areas[1]):0,-largest,-smallest,shortFit,longFit,f.y,f.x];
    if (heuristic==='fragment') return [newSheet,fragments,shortFit,longFit,-largest,-widestShort,f.y,f.x];
    return [newSheet,shortFit,longFit,-largest,fragments,f.y,f.x];
  }

  function bestShearPlacementAcrossBins(bins,item,W,H,allowRotate,heuristic) {
    let best=null, bestScore=null;
    const orientations=itemOrientations(item,W,H,allowRotate);
    for (let bi=0;bi<bins.length;bi++) {
      const bin=bins[bi];
      for (let fi=0;fi<bin.free.length;fi++) {
        const f=bin.free[fi];
        for (const o of orientations) {
          if (o.w>f.w+1e-9 || o.h>f.h+1e-9) continue;
          for (const split of shearSplitOptions(f,o.w,o.h)) {
            const score=shearCandidateScore(f,o.w,o.h,split,bin.used.length===0?1:0,heuristic);
            if (lexLess(score,bestScore)) {
              bestScore=score;
              best={binIndex:bi,freeIndex:fi,x:f.x,y:f.y,w:o.w,h:o.h,rotated:o.rotated,split};
            }
          }
        }
      }
    }
    return best;
  }

  function applyShearPlacement(bin,place,item) {
    const f=bin.free[place.freeIndex];
    const used={x:f.x,y:f.y,w:place.w,h:place.h,item,rotated:place.rotated};
    const before=bin.free.slice(0,place.freeIndex);
    const after=bin.free.slice(place.freeIndex+1);
    bin.free=before.concat(place.split.free.map(r=>({...r})),after);
    bin.used.push(used);
    if (!bin.shearCuts) bin.shearCuts=[];
    for (const c of place.split.cuts) bin.shearCuts.push({...c,region:{...c.region},partUid:String(item.uid)});
    return used;
  }

  function buildShearOrders(items) {
    const base=Array.from({length:items.length},(_,i)=>i);
    const sortBy=fn=>base.slice().sort((a,b)=>fn(items[b])-fn(items[a]) || String(items[a].uid).localeCompare(String(items[b].uid)));
    const orders=[
      sortBy(p=>p.cutL*p.cutW),
      sortBy(p=>Math.max(p.cutL,p.cutW)),
      sortBy(p=>p.cutL),
      sortBy(p=>p.cutW),
      sortBy(p=>Math.min(p.cutL,p.cutW)),
      sortBy(p=>p.cutL+p.cutW),
      sortBy(p=>Math.abs(p.cutL-p.cutW))
    ];
    const randomCount=items.length<=60?24:items.length<=150?12:6;
    for (let seed=1;seed<=randomCount;seed++) orders.push(deterministicShuffle(items.length,seed*104729));
    return orders;
  }

  function packShearWithOrder(items,W,H,allowRotate,order,heuristic) {
    const bins=[];
    for (const idx of order) {
      const item=items[idx];
      let place=bestShearPlacementAcrossBins(bins,item,W,H,allowRotate,heuristic);
      if (!place) {
        bins.push({free:[{x:0,y:0,w:W,h:H}],used:[],shearCuts:[]});
        place=bestShearPlacementAcrossBins(bins,item,W,H,allowRotate,heuristic);
        if (!place) return null;
      }
      applyShearPlacement(bins[place.binIndex],place,item);
    }
    return bins.filter(b=>b.used.length);
  }

  function bestShearPacking(items,W,H,allowRotate) {
    const orders=buildShearOrders(items);
    const heuristics=['tight','largest','fragment','balanced'];
    let best=null;
    for (const heuristic of heuristics) {
      for (const order of orders) {
        const packed=packShearWithOrder(items,W,H,allowRotate,order,heuristic);
        if (!packed) continue;
        if (!best || packed.length<best.length) best=packed;
        if (best && best.length===1) return best;
      }
    }
    return best;
  }

  function cloneShearBins(bins) {
    return bins.map(b=>({
      free:b.free.map(r=>({...r})),
      used:b.used.map(u=>({...u})),
      shearCuts:(b.shearCuts||[]).map(c=>({...c,region:{...c.region}}))
    }));
  }

  function exactShearCandidatePlacements(bins,item,W,H,allowRotate) {
    const candidates=[];
    const seen=new Set();
    const seenBinShapes=new Set();
    const orientations=itemOrientations(item,W,H,allowRotate);
    for (let bi=0;bi<bins.length;bi++) {
      const bin=bins[bi];
      const shape=bin.used.length===0?'EMPTY':bin.free.map(r=>`${r.x.toFixed(6)},${r.y.toFixed(6)},${r.w.toFixed(6)},${r.h.toFixed(6)}`).sort().join('|');
      if (seenBinShapes.has(shape)) continue;
      seenBinShapes.add(shape);
      for (let fi=0;fi<bin.free.length;fi++) {
        const f=bin.free[fi];
        for (const o of orientations) {
          if (o.w>f.w+1e-9 || o.h>f.h+1e-9) continue;
          for (const split of shearSplitOptions(f,o.w,o.h)) {
            const key=`${bi}|${fi}|${o.w.toFixed(6)}|${o.h.toFixed(6)}|${split.key}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const score=shearCandidateScore(f,o.w,o.h,split,bin.used.length===0?1:0,'largest');
            candidates.push({binIndex:bi,freeIndex:fi,x:f.x,y:f.y,w:o.w,h:o.h,rotated:o.rotated,split,score});
          }
        }
      }
    }
    candidates.sort((a,b)=>{
      const n=Math.max(a.score.length,b.score.length);
      for (let i=0;i<n;i++) {
        const av=a.score[i]??0,bv=b.score[i]??0;
        if (Math.abs(av-bv)>1e-9) return av-bv;
      }
      return a.binIndex-b.binIndex;
    });
    return candidates;
  }

  function globalShearBacktrackingPack(items,W,H,binCount,allowRotate,deadlineMs) {
    const ordered=items.slice().sort((a,b)=>
      (b.cutL*b.cutW)-(a.cutL*a.cutW) ||
      Math.max(b.cutL,b.cutW)-Math.max(a.cutL,a.cutW) ||
      Math.min(b.cutL,b.cutW)-Math.min(a.cutL,a.cutW) ||
      String(a.uid).localeCompare(String(b.uid))
    );
    const bins=Array.from({length:binCount},()=>({free:[{x:0,y:0,w:W,h:H}],used:[],shearCuts:[]}));
    const sheetArea=W*H;
    const suffixArea=new Array(ordered.length+1).fill(0);
    for (let i=ordered.length-1;i>=0;i--) suffixArea[i]=suffixArea[i+1]+ordered[i].cutL*ordered[i].cutW;
    let timedOut=false,nodes=0;

    function search(depth,usedArea) {
      if ((++nodes & 255)===0 && performance.now()>deadlineMs) { timedOut=true; return null; }
      if (depth===ordered.length) return cloneShearBins(bins).filter(b=>b.used.length);
      if (suffixArea[depth] > binCount*sheetArea-usedArea+1e-8) return null;
      const item=ordered[depth];
      const placements=exactShearCandidatePlacements(bins,item,W,H,allowRotate);
      if (!placements.length) return null;
      for (const place of placements) {
        if (timedOut) return null;
        const bin=bins[place.binIndex];
        const oldFree=bin.free;
        const oldCutLen=bin.shearCuts.length;
        const f=oldFree[place.freeIndex];
        bin.free=oldFree.slice(0,place.freeIndex).concat(place.split.free.map(r=>({...r})),oldFree.slice(place.freeIndex+1));
        bin.used.push({x:f.x,y:f.y,w:place.w,h:place.h,item,rotated:place.rotated});
        for (const c of place.split.cuts) bin.shearCuts.push({...c,region:{...c.region},partUid:String(item.uid)});
        const result=search(depth+1,usedArea+place.w*place.h);
        if (result) return result;
        bin.used.pop();
        bin.shearCuts.length=oldCutLen;
        bin.free=oldFree;
      }
      return null;
    }
    const binsResult=search(0,0);
    return {bins:binsResult,timedOut,nodes};
  }

  function sameRect(a,b,eps=1e-6) {
    return Math.abs(a.x-b.x)<=eps && Math.abs(a.y-b.y)<=eps && Math.abs(a.w-b.w)<=eps && Math.abs(a.h-b.h)<=eps;
  }

  function validateShearSequence(bin,W,H) {
    const eps=1e-6;
    let regions=[{x:0,y:0,w:W,h:H}];
    for (let ci=0;ci<(bin.shearCuts||[]).length;ci++) {
      const cut=bin.shearCuts[ci];
      const ri=regions.findIndex(r=>sameRect(r,cut.region,eps));
      if (ri<0) return {ok:false,reason:`Shear cut ${ci+1} does not span a currently separated rectangular section.`};
      const r=regions[ri];
      const next=[];
      if (cut.axis==='x') {
        if (cut.line<=r.x+eps || cut.line>=r.x+r.w-eps) return {ok:false,reason:`Shear cut ${ci+1} has an invalid X position.`};
        next.push({x:r.x,y:r.y,w:cut.line-r.x,h:r.h},{x:cut.line,y:r.y,w:r.x+r.w-cut.line,h:r.h});
      } else if (cut.axis==='y') {
        if (cut.line<=r.y+eps || cut.line>=r.y+r.h-eps) return {ok:false,reason:`Shear cut ${ci+1} has an invalid Y position.`};
        next.push({x:r.x,y:r.y,w:r.w,h:cut.line-r.y},{x:r.x,y:cut.line,w:r.w,h:r.y+r.h-cut.line});
      } else return {ok:false,reason:`Shear cut ${ci+1} has an invalid direction.`};
      regions.splice(ri,1,...next);
    }
    for (const used of bin.used) {
      if (!regions.some(r=>sameRect(r,{x:used.x,y:used.y,w:used.w,h:used.h},eps))) {
        return {ok:false,reason:`Part ${used.item.uid} cannot be isolated using the required full-edge shear geometry.`};
      }
    }
    return {ok:true};
  }

  function validateShearPacking(bins,items,W,H,allowRotate) {
    const geometry=validatePackingGeometry(bins,items,W,H,allowRotate);
    if (!geometry.ok) return geometry;
    for (let i=0;i<bins.length;i++) {
      const sequence=validateShearSequence(bins[i],W,H);
      if (!sequence.ok) return {ok:false,reason:`Sheet ${i+1}: ${sequence.reason}`};
    }
    return {ok:true};
  }

  function optimizeShearMaterialGroup(items,material,allowRotate) {
    const W=material.usableL,H=material.usableW;
    for (const item of items) {
      const fitsNormal=item.cutL<=W+1e-9 && item.cutW<=H+1e-9;
      const fitsRot=allowRotate && item.cutW<=W+1e-9 && item.cutL<=H+1e-9;
      if (!fitsNormal && !fitsRot) return {error:item};
    }

    const upperBins=bestShearPacking(items,W,H,allowRotate);
    if (!upperBins) return {error:items[0]};
    const upperCheck=validateShearPacking(upperBins,items,W,H,allowRotate);
    if (!upperCheck.ok) return {internalError:upperCheck.reason};

    const totalArea=items.reduce((s,p)=>s+p.cutL*p.cutW,0);
    const areaLower=Math.max(1,Math.ceil(totalArea/(W*H)-1e-12));
    const cliqueLower=incompatibilityCliqueLowerBound(items,W,H,allowRotate);
    const lower=Math.max(areaLower,cliqueLower);
    let best=upperBins;
    let searchTimedOut=false,globallySearched=false;
    const budget=items.length<=16?5000:items.length<=26?3200:items.length<=40?1800:800;
    const deadline=performance.now()+budget;

    for (let count=lower;count<best.length;count++) {
      if (performance.now()>deadline) { searchTimedOut=true; break; }
      globallySearched=true;
      const attempt=globalShearBacktrackingPack(items,W,H,count,allowRotate,deadline);
      if (attempt.bins) {
        const check=validateShearPacking(attempt.bins,items,W,H,allowRotate);
        if (!check.ok) return {internalError:check.reason};
        best=attempt.bins;
        break;
      }
      if (attempt.timedOut) { searchTimedOut=true; break; }
    }

    const finalCheck=validateShearPacking(best,items,W,H,allowRotate);
    if (!finalCheck.ok) return {internalError:finalCheck.reason};
    // For shear-constrained layouts, only call the minimum mathematically confirmed
    // when the layout reaches a universal lower bound. The time-limited guillotine
    // search may rule out smaller patterns within its explored slicing states, but
    // that alone is not presented as an absolute proof.
    const minimumConfirmed=best.length===lower;
    return {bins:best,lowerBound:lower,minimumConfirmed,quality:minimumConfirmed?'proven-minimum':'best-found',globallySearched,searchTimedOut,optimizerMode:'shear-guillotine'};
  }

  function optimizeMaterialGroup(items,material,allowRotate) {
    if (isShearMaterial(material)) return optimizeShearMaterialGroup(items,material,allowRotate);
    const W=material.usableL, H=material.usableW;
    for (const item of items) {
      const fitsNormal=item.cutL<=W+1e-9 && item.cutW<=H+1e-9;
      const fitsRot=allowRotate && item.cutW<=W+1e-9 && item.cutL<=H+1e-9;
      if (!fitsNormal && !fitsRot) return {error:item};
    }

    // First find a strong complete-job solution. This is only an upper bound;
    // the global search below is allowed to move every part between sheets.
    const upperBins=bestGreedyPacking(items,W,H,allowRotate);
    if (!upperBins) return {error:items[0]};
    const upperCheck=validatePackingGeometry(upperBins,items,W,H,allowRotate);
    if (!upperCheck.ok) return {internalError:upperCheck.reason};

    const totalArea=items.reduce((s,p)=>s+p.cutL*p.cutW,0);
    const areaLower=Math.max(1,Math.ceil(totalArea/(W*H)-1e-12));
    const cliqueLower=incompatibilityCliqueLowerBound(items,W,H,allowRotate);
    const lower=Math.max(areaLower,cliqueLower);
    let best=upperBins;
    let searchTimedOut=false;
    let globallySearched=false;

    // Search the entire part list against progressively larger sheet counts.
    // For normal fabrication jobs this gives the optimizer freedom to pair a
    // later-entered small part with an earlier large part on any sheet.
    const now=performance.now();
    const budget = items.length<=18 ? 4500 : items.length<=28 ? 3000 : items.length<=40 ? 1800 : 900;
    const deadline=now+budget;

    for (let count=lower;count<best.length;count++) {
      if (performance.now()>deadline) { searchTimedOut=true; break; }
      globallySearched=true;
      const attempt=boundedBacktrackingPack(items,W,H,count,allowRotate,deadline);
      if (attempt.bins) {
        const attemptCheck=validatePackingGeometry(attempt.bins,items,W,H,allowRotate);
        if (!attemptCheck.ok) return {internalError:attemptCheck.reason};
        best=attempt.bins;
        break; // Counts are tested smallest-first; all smaller counts were already ruled out.
      }
      if (attempt.timedOut) { searchTimedOut=true; break; }
    }

    const finalCheck=validatePackingGeometry(best,items,W,H,allowRotate);
    if (!finalCheck.ok) return {internalError:finalCheck.reason};

    // A layout is proven minimal when it reaches the lower bound, or when the
    // complete search exhaustively ruled out every smaller count without timing out.
    // Only a universal lower-bound match is a mathematical proof. The bounded
    // search is a heuristic improvement pass and must never prove optimality by failure.
    const minimumConfirmed=best.length===lower;
    return {
      bins:best,
      lowerBound:lower,
      minimumConfirmed,
      quality:minimumConfirmed?'proven-minimum':'best-found',
      globallySearched,
      searchTimedOut,
      optimizerMode:'whole-job'
    };
  }

  function expandedOptimizerItems() {
    const groups={};
    optimizerJob.forEach((row,rowIndex) => {
      const product=PRODUCTS[row.productKey];
      const key=product.material;
      if (!groups[key]) groups[key]=[];
      for (let q=0;q<row.qty;q++) {
        groups[key].push({
          uid:`${row.id}-${q+1}`,
          rowId:row.id,
          instance:q+1,
          productKey:row.productKey,
          label:row.label,
          finishedWidth:row.finishedWidth, finishedHeight:row.finishedHeight,
          cutWidth:row.cutWidth, cutHeight:row.cutHeight,
          // Packing engine axes: sheet long/grain axis = entered panel width;
          // sheet short axis = entered panel height. Free rotation may swap them later.
          cutL:row.cutWidth, cutW:row.cutHeight
        });
      }
    });
    return groups;
  }

  function measurementTextNoQuote(value) {
    return measurementText(value).replace(/"/g,'');
  }

  function partCutLabel(item) {
    return `${measurementTextNoQuote(item.cutWidth)} × ${measurementTextNoQuote(item.cutHeight)}`;
  }

  function estimatedSvgTextUnits(text) {
    let units = 0;
    for (const ch of String(text)) {
      if (ch === ' ') units += .32;
      else if ('1Iil|'.includes(ch)) units += .34;
      else if ('MW@#%'.includes(ch)) units += .82;
      else if ('×'.includes(ch)) units += .68;
      else if ('./-'.includes(ch)) units += .38;
      else units += .58;
    }
    return Math.max(units, .8);
  }

  function fitSvgFontSize(text, availableWidth, maxSize) {
    const widthLimited = availableWidth / estimatedSvgTextUnits(text);
    return Math.max(.55, Math.min(maxSize, widthLimited));
  }

  function partListBadge(item,fallback='') {
    return (item.label && item.label.trim()) || fallback || partCutLabel(item);
  }

  function renderSheetSvg(bin,material) {
    const usableW=material.usableL, usableH=material.usableW;
    const stockW=material.rawL, stockH=material.rawW;
    const gridW=Math.max(1, Math.ceil(stockW - 1e-9));
    const gridH=Math.max(1, Math.ceil(stockH - 1e-9));
    const padL=4.2, padT=3.2, padR=1.2, padB=1.2;
    const stockX=padL, stockY=padT;
    const totalW=padL + stockW + padR;
    const totalH=padT + stockH + padB;
    const clipId=`stock-clip-${++sheetSvgClipCounter}`;
    const axisXs=[];
    for (let x=0;x<=gridW;x+=12) axisXs.push(x);
    if (Math.abs(axisXs[axisXs.length-1] - stockW)>1e-9) axisXs.push(stockW);
    const axisYs=[];
    for (let y=0;y<=gridH;y+=12) axisYs.push(y);
    if (Math.abs(axisYs[axisYs.length-1] - stockH)>1e-9) axisYs.push(stockH);

    const minorV=[];
    for (let x=1;x<gridW;x++) minorV.push(`<line x1="${stockX+x}" y1="${stockY}" x2="${stockX+x}" y2="${stockY+gridH}" />`);
    const minorH=[];
    for (let y=1;y<gridH;y++) minorH.push(`<line x1="${stockX}" y1="${stockY+y}" x2="${stockX+gridW}" y2="${stockY+y}" />`);
    const majorV=[];
    for (let x=0;x<=gridW;x+=12) majorV.push(`<line x1="${stockX+x}" y1="${stockY}" x2="${stockX+x}" y2="${stockY+gridH}" />`);
    const majorH=[];
    for (let y=0;y<=gridH;y+=12) majorH.push(`<line x1="${stockX}" y1="${stockY+y}" x2="${stockX+gridW}" y2="${stockY+y}" />`);

    const axisLabelsX = axisXs.map(x => `<text class="axis-text" x="${stockX+x}" y="${stockY-1.35}">${measurementTextNoQuote(x)}</text>`).join('');
    const axisLabelsY = axisYs.map(y => `<text class="axis-text left" x="${stockX-0.7}" y="${stockY+y}">${measurementTextNoQuote(y)}</text>`).join('');

    const offcut = [];
    if (usableW < stockW-1e-9) {
      offcut.push(`<rect class="offcut-zone" x="${stockX+usableW}" y="${stockY}" width="${stockW-usableW}" height="${stockH}" />`);
    }
    if (usableH < stockH-1e-9) {
      offcut.push(`<rect class="offcut-zone" x="${stockX}" y="${stockY+usableH}" width="${stockW}" height="${stockH-usableH}" />`);
    }

    const cutLines = (() => {
      if (isShearMaterial(material)) {
        return (bin.shearCuts||[]).map((c)=>{
          let x1,y1,x2,y2;
          if (c.axis==='x') {
            x1=x2=stockX+c.line;
            y1=stockY+c.region.y;
            y2=stockY+c.region.y+c.region.h;
          } else {
            y1=y2=stockY+c.line;
            x1=stockX+c.region.x;
            x2=stockX+c.region.x+c.region.w;
          }
          return `<line class="shear-cut-line" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />`;
        }).join('');
      }

      // Cellulose and plywood are free-form nests. Show the actual internal
      // cut edges around each placed part. Edges already on the outside of
      // the usable stock do not need a cut line, and exact shared edges are
      // de-duplicated so the dotted path stays visually consistent.
      const eps=1e-7;
      const seen=new Set();
      const lines=[];
      const addLine=(x1,y1,x2,y2)=>{
        const ax=Math.round(x1*1000000)/1000000;
        const ay=Math.round(y1*1000000)/1000000;
        const bx=Math.round(x2*1000000)/1000000;
        const by=Math.round(y2*1000000)/1000000;
        const a=`${ax},${ay}`;
        const b=`${bx},${by}`;
        const key=a<b ? `${a}|${b}` : `${b}|${a}`;
        if (seen.has(key)) return;
        seen.add(key);
        lines.push(`<line class="shear-cut-line" x1="${stockX+ax}" y1="${stockY+ay}" x2="${stockX+bx}" y2="${stockY+by}" />`);
      };
      for (const u of bin.used) {
        if (u.x > eps) addLine(u.x,u.y,u.x,u.y+u.h);
        if (u.y > eps) addLine(u.x,u.y,u.x+u.w,u.y);
        if (u.x+u.w < usableW-eps) addLine(u.x+u.w,u.y,u.x+u.w,u.y+u.h);
        if (u.y+u.h < usableH-eps) addLine(u.x,u.y+u.h,u.x+u.w,u.y+u.h);
      }
      return lines.join('');
    })();

    const labels=bin.used.map((u,i)=>{
      const rawPartName=(u.item.label && u.item.label.trim()) ? u.item.label.trim() : `Part ${i+1}`;
      const partName=escapeHtml(rawPartName);
      const isCut=optimizerCutIds.has(String(u.item.uid));
      const product=PRODUCTS[u.item.productKey];
      const productColor=product.color || '#00D2FF';
      const partClass=isCut?'part cut':'part';
      const partStyle=isCut?'':`fill:${productColor};stroke:${productColor};`;
      const labelClass=isCut?'part-label cut-text':'part-label';
      const rx=stockX+u.x, ry=stockY+u.y;
      const cx=rx+u.w/2, cy=ry+u.h/2;
      const innerW=Math.max(.8,u.w-1.5);
      const innerH=Math.max(.8,u.h-1.35);
      // Keep the label upright relative to the physical part. A placement marked
      // rotated is treated as a consistent 90° clockwise part rotation, so the
      // label rotates with it and visually identifies the part's original top.
      const labelAvailableWidth=u.rotated ? innerH : innerW;
      const labelAvailableHeight=u.rotated ? innerW : innerH;
      let labelSize=fitSvgFontSize(rawPartName,labelAvailableWidth,4.4);
      labelSize=Math.min(labelSize,labelAvailableHeight*.78) * .95;
      const labelTransform=u.rotated ? ` transform="rotate(90 ${cx} ${cy})"` : '';
      return `<rect class="${partClass}" style="${partStyle}" x="${rx}" y="${ry}" width="${u.w}" height="${u.h}" rx=".45" /><text class="${labelClass}" style="font-size:${labelSize.toFixed(3)}px" x="${cx}" y="${cy}"${labelTransform}>${partName}</text>`;
    }).join('');

    return `<div class="sheet-visual"><svg class="sheet-svg" viewBox="0 0 ${totalW} ${totalH}" role="img" aria-label="Sheet nesting layout with one-inch grid; grain flows along the long horizontal sheet axis"><defs><clipPath id="${clipId}"><rect x="${stockX}" y="${stockY}" width="${stockW}" height="${stockH}" rx=".45" /></clipPath></defs><rect class="stock" x="${stockX}" y="${stockY}" width="${stockW}" height="${stockH}" rx=".45" /><g clip-path="url(#${clipId})"><g class="grid-minor">${minorV.join('')}${minorH.join('')}</g><g class="grid-major">${majorV.join('')}${majorH.join('')}</g>${offcut.join('')}</g><rect class="usable-boundary" x="${stockX}" y="${stockY}" width="${usableW}" height="${usableH}" rx=".45" />${cutLines}${labels}${axisLabelsX}${axisLabelsY}</svg></div>`;
  }

  function renderOptimizerOutput(results,scrollToResults=true) {
    const materialCards=[];
    const blocks=[];
    let totalSheets=0;
    for (const [materialKey,data] of Object.entries(results)) {
      const material=MATERIALS[materialKey];
      if (data.error) continue;
      const bins=data.bins;
      totalSheets += bins.length;
      const usedArea=bins.reduce((s,b)=>s+b.used.reduce((x,u)=>x+u.w*u.h,0),0);
      const usableArea=bins.length*material.usableL*material.usableW;
      const util=usableArea ? usedArea/usableArea*100 : 0;
      materialCards.push(`<div class="metric"><span>${escapeHtml(material.name)}</span><b>${bins.length} sheet${bins.length===1?'':'s'}</b><div class="subline">${measurementText(material.rawL)} × ${measurementText(material.rawW)} stock • ${util.toFixed(1)}% usable-area yield</div></div>`);

      const sheetCards=bins.map((bin,bi)=>{
        const area=bin.used.reduce((s,u)=>s+u.w*u.h,0);
        const pct=area/(material.usableL*material.usableW)*100;
        const cutRows=bin.used.map((u,i)=>{
          const p=PRODUCTS[u.item.productKey];
          const badge=partListBadge(u.item, `Part ${i+1}`);
          const isCut=optimizerCutIds.has(String(u.item.uid));
          return `<div class="sheet-cut${isCut?' is-cut':''}" style="--part-color:${p.color || '#00D2FF'}" data-part-uid="${escapeHtml(u.item.uid)}">
            <div class="sheet-cut-swatch" aria-hidden="true"></div>
            <div><strong>${escapeHtml(badge)} — Cut ${measurementText(u.item.cutWidth)} × ${measurementText(u.item.cutHeight)}</strong></div>
            <button class="cut-toggle-btn${isCut?' is-cut':''}" type="button" data-toggle-cut="${escapeHtml(u.item.uid)}">${isCut?'Mark Uncut':'Mark Cut'}</button>
          </div>`;
        }).join('');
        const sheetProductKeys=[...new Set(bin.used.map(u=>u.item.productKey))];
        const sheetHeaderColors=sheetProductKeys.map(key=>PRODUCTS[key].color || '#00D2FF');
        const sheetHeaderA=sheetHeaderColors[0] || '#00D2FF';
        const sheetHeaderB=sheetHeaderColors.length>1 ? sheetHeaderColors[1] : sheetHeaderA;
        return `<div class="sheet-card">
          <div class="sheet-head material-sheet-head" style="--sheet-color-a:${sheetHeaderA};--sheet-color-b:${sheetHeaderB}"><strong>Sheet ${bi+1}</strong><span class="badge">${bin.used.length} cut${bin.used.length===1?'':'s'} • ${pct.toFixed(1)}% used</span></div>
          <div class="sheet-body">
            ${renderSheetSvg(bin,material)}
            <div class="sheet-cuts">${cutRows}</div>
          </div>
        </div>`;
      }).join('');

      const productKeysOnMaterial=[...new Set(bins.flatMap(b=>b.used.map(u=>u.item.productKey)))];
      const colorLegend=`<div class="product-color-legend">${productKeysOnMaterial.map(key=>{const p=PRODUCTS[key];return `<span class="product-color-key"><i style="background:${p.color}"></i>${escapeHtml(p.shortName || p.name)}</span>`;}).join('')}</div>`;
      const materialHeaderColors=productKeysOnMaterial.map(key=>PRODUCTS[key].color || '#00D2FF');
      const materialHeaderA=materialHeaderColors[0] || '#00D2FF';
      const materialHeaderB=materialHeaderColors.length>1 ? materialHeaderColors[1] : materialHeaderA;

      blocks.push(`<section class="card material-block">
        <div class="result-head material-result-head" style="margin:-16px -16px 14px;border-radius:17px 17px 0 0;--material-color-a:${materialHeaderA};--material-color-b:${materialHeaderB}">
          <strong>${escapeHtml(material.name)}</strong>
          <span class="badge">${bins.length} sheet${bins.length===1?'':'s'}${data.minimumConfirmed?' • minimum confirmed':''}</span>
        </div>
        <div class="material-summary">
          <div class="metric"><span>Raw sheet</span><b>${measurementText(material.rawL)} × ${measurementText(material.rawW)}</b></div>
          <div class="metric"><span>Usable cut area</span><b>${measurementText(material.usableL)} × ${measurementText(material.usableW)}</b></div>
          <div class="metric"><span>Parts</span><b>${bins.reduce((s,b)=>s+b.used.length,0)}</b></div>
          <div class="metric"><span>Overall yield</span><b>${util.toFixed(1)}%</b></div>
        </div>
        ${colorLegend}
        <div class="sheet-list">${sheetCards}</div>
        <div class="material-warning">Part dimensions in the optimizer are Width × Height. The nesting diagram uses a true one-inch grid clipped to the exact physical stock dimensions. Coordinates are measured from the upper-left origin. <b>Grain flow follows the long horizontal sheet axis</b> — 0–120 on 120&quot; stock — not the 0–48 short axis. The green dashed boundary marks the exact usable cut area; shaded strips are outside the permitted cut size. ${isShearMaterial(material)?`<b>Shear constrained:</b> dotted orange lines depict full-edge shear-compatible divisions. The optimizer internally validates that no stopped/interior cut is required. `:`<b>Cut paths:</b> dotted orange lines trace the internal edges around the nested parts. `}${data.minimumConfirmed?`<b>Minimum confirmed:</b> this layout uses ${bins.length} sheet${bins.length===1?'':'s'} and exactly matches the universal calculated lower bound of ${data.lowerBound}, so fewer sheets are impossible.`:`<b>Best layout found:</b> ${bins.length} sheet${bins.length===1?'':'s'}. The universal calculated lower bound is ${data.lowerBound}. A layout at that lower bound was not found by the bounded search, so this result is not presented as a mathematical minimum.${data.searchTimedOut?' The deeper search reached its browser time limit.':''}`} No kerf or gap allowance is added.</div>
      </section>`);
    }
    optimizerMaterialTotals.innerHTML = `<div class="summary" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">${materialCards.join('')}</div><div class="note"><b>Total stock sheets:</b> ${totalSheets}. Different material types are counted separately and cannot share a sheet.</div>`;
    optimizerSheets.innerHTML=blocks.join('');
    optimizerResults.classList.add('show');
    if (scrollToResults) optimizerResults.scrollIntoView({behavior:'smooth',block:'start'});
  }

  const OPTIMIZER_WORKER_FUNCTIONS = [
    rectIntersects, splitFreeRects, pruneFreeRects, placementScore, lexLess,
    bestPlacementAcrossBins, deterministicShuffle, buildOrders, packWithOrder,
    bestGreedyPacking, itemOrientations, twoItemsCanShareSheet,
    incompatibilityCliqueLowerBound, exactCandidatePlacements, cloneBins,
    boundedBacktrackingPack, validatePackingGeometry, isShearMaterial,
    shearSplitOptions, shearCandidateScore, bestShearPlacementAcrossBins,
    applyShearPlacement, buildShearOrders, packShearWithOrder, bestShearPacking,
    cloneShearBins, exactShearCandidatePlacements, globalShearBacktrackingPack,
    sameRect, validateShearSequence, validateShearPacking,
    optimizeShearMaterialGroup, optimizeMaterialGroup
  ];

  function buildOptimizerWorkerSource() {
    const functionSource=OPTIMIZER_WORKER_FUNCTIONS.map(fn=>fn.toString()).join('\n\n');
    return `'use strict';\n${functionSource}\n\nself.onmessage = event => {\n  try {\n    const { groups, materials, allowRotate, runId } = event.data;\n    const results = {};\n    for (const [materialKey,items] of Object.entries(groups)) {\n      results[materialKey] = optimizeMaterialGroup(items,materials[materialKey],allowRotate);\n    }\n    self.postMessage({ ok:true, runId, results });\n  } catch (error) {\n    self.postMessage({ ok:false, runId, error:String(error && error.message || error) });\n  }\n};`;
  }

  function optimizeGroupsSynchronously(groups,allowRotate) {
    const results={};
    for (const [materialKey,items] of Object.entries(groups)) {
      results[materialKey]=optimizeMaterialGroup(items,MATERIALS[materialKey],allowRotate);
    }
    return results;
  }

  function optimizeGroupsInWorker(groups,allowRotate,runId) {
    return new Promise((resolve,reject)=>{
      if (typeof Worker==='undefined' || typeof Blob==='undefined' || !URL || typeof URL.createObjectURL!=='function') {
        try { resolve(optimizeGroupsSynchronously(groups,allowRotate)); }
        catch (error) { reject(error); }
        return;
      }
      if (optimizerWorker) {
        optimizerWorker.terminate();
        optimizerWorker=null;
        if (optimizerWorkerReject) optimizerWorkerReject(new Error('Optimizer run was superseded.'));
        optimizerWorkerReject=null;
      }
      let objectUrl='';
      try {
        const blob=new Blob([buildOptimizerWorkerSource()],{type:'text/javascript'});
        objectUrl=URL.createObjectURL(blob);
        const worker=new Worker(objectUrl);
        optimizerWorker=worker;
        optimizerWorkerReject=reject;
        URL.revokeObjectURL(objectUrl);
        objectUrl='';
        worker.onmessage=event=>{
          if (optimizerWorker===worker) optimizerWorker=null;
          optimizerWorkerReject=null;
          worker.terminate();
          const data=event.data || {};
          if (data.runId!==runId) return reject(new Error('Optimizer run was superseded.'));
          if (!data.ok) return reject(new Error(data.error || 'Optimizer worker failed.'));
          resolve(data.results);
        };
        worker.onerror=event=>{
          if (optimizerWorker===worker) optimizerWorker=null;
          optimizerWorkerReject=null;
          worker.terminate();
          try { resolve(optimizeGroupsSynchronously(groups,allowRotate)); }
          catch (fallbackError) { reject(fallbackError || new Error(event.message || 'Optimizer worker failed.')); }
        };
        worker.postMessage({groups,materials:MATERIALS,allowRotate,runId});
      } catch (error) {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        if (optimizerWorker) { optimizerWorker.terminate(); optimizerWorker=null; }
        optimizerWorkerReject=null;
        // Some browsers restrict Blob workers for locally opened files. Keep the
        // calculator functional there, but use the same bounded core synchronously.
        try { resolve(optimizeGroupsSynchronously(groups,allowRotate)); }
        catch (fallbackError) { reject(fallbackError || error); }
      }
    });
  }

  async function runOptimizer(showCompletionStatus=true) {
    clearOptimizerStatus();
    if (!optimizerJob.length) {
      showOptimizerStatus('Add at least one part before optimizing.');
      return;
    }
    const groups=expandedOptimizerItems();
    const runId=++optimizerRunSerial;
    // Grain Flow Rotation OFF = free 90° nesting. ON = preserve entered Width × Height orientation.
    const allowRotate=!optimizerGrainFlowRotation.checked;
    showOptimizerStatus('Optimizing job… You can continue using the page while layouts are calculated.','ok');
    let results;
    try {
      results=await optimizeGroupsInWorker(groups,allowRotate,runId);
    } catch (error) {
      if (runId!==optimizerRunSerial) return;
      showOptimizerStatus(error && error.message==='Optimizer run was superseded.' ? 'Optimizer run replaced by a newer request.' : `The optimizer could not complete: ${error.message || error}`,'error');
      optimizerResults.classList.remove('show');
      return;
    }
    if (runId!==optimizerRunSerial) return;
    for (const [materialKey,result] of Object.entries(results)) {
      if (result.internalError) {
        showOptimizerStatus(`The optimizer stopped because its layout integrity check failed: ${result.internalError} No cut list was produced.`);
        optimizerResults.classList.remove('show');
        return;
      }
      if (result.error) {
        const item=result.error;
        const p=PRODUCTS[item.productKey];
        const m=MATERIALS[materialKey];
        const name=item.label ? `${item.label} (${p.name})` : p.name;
        const orientationNote=optimizerGrainFlowRotation.checked
          ? ' while Grain Flow Rotation is ON. Turn it OFF to allow free 90° nesting'
          : ' even with free 90° nesting';
        showOptimizerStatus(`${name} requires a ${measurementText(item.cutWidth)} W × ${measurementText(item.cutHeight)} H cut, which does not fit the ${measurementText(m.usableL)} × ${measurementText(m.usableW)} usable ${m.name} sheet${orientationNote}.`);
        optimizerResults.classList.remove('show');
        return;
      }
    }
    optimizerLastResults=results;
    renderOptimizerOutput(results);
    if (showCompletionStatus) {
      const grainMode=optimizerGrainFlowRotation.checked
        ? 'Grain Flow Rotation ON: entered Width × Height orientation was preserved.'
        : 'Grain Flow Rotation OFF: free 90° nesting was allowed.';
      showOptimizerStatus(`Whole-job optimization complete. ${grainMode} .063 Aluminum and ACP were constrained to full-edge shear-compatible layouts; other materials used free-form nesting. Minimum is only claimed when the result reaches the universal lower bound.`,'ok');
    }
    else clearOptimizerStatus();
  }

  function findOptimizerPhysicalPart(uid) {
    const groups=expandedOptimizerItems();
    for (const items of Object.values(groups)) {
      const found=items.find(item=>String(item.uid)===String(uid));
      if (found) return found;
    }
    return null;
  }

  function toggleOptimizerPartCut(uid) {
    const item=findOptimizerPhysicalPart(uid);
    if (!item) return;
    const isCut=optimizerCutIds.has(String(uid));
    const product=PRODUCTS[item.productKey];
    const base=item.label ? item.label : product.name;
    const row=optimizerJob.find(r=>r.id===item.rowId);
    const instanceText=row && row.qty>1 ? ` piece ${item.instance} of ${row.qty}` : '';
    const nextWord=isCut?'NOT CUT':'CUT';
    if (!window.confirm(`Mark ${base}${instanceText} as ${nextWord}?`)) return;
    if (isCut) optimizerCutIds.delete(String(uid)); else optimizerCutIds.add(String(uid));
    markOptimizerDirty();
    renderOptimizerJob();
    if (optimizerLastResults) renderOptimizerOutput(optimizerLastResults,false);
    showOptimizerJobStatus(`${base}${instanceText} marked ${isCut?'not cut':'cut'}. Save the Job # to keep this status.`,'ok');
  }

  optimizerSheets.addEventListener('click',e=>{
    const btn=e.target.closest('[data-toggle-cut]');
    if (!btn) return;
    toggleOptimizerPartCut(btn.dataset.toggleCut);
  });

  function clearOptimizerJob() {
    if ((optimizerJob.length || optimizerDirty) && !window.confirm('Clear the current optimizer job and all cut-status marks? Unsaved changes will be discarded.')) return;
    optimizerRunSerial++;
    if (optimizerWorker) { optimizerWorker.terminate(); optimizerWorker=null; }
    if (optimizerWorkerReject) optimizerWorkerReject(new Error('Optimizer run was superseded.'));
    optimizerWorkerReject=null;
    optimizerJob=[];
    optimizerNextId=1;
    optimizerCutIds=new Set();
    optimizerLastResults=null;
    optimizerLoadedJobNumber='';
    optimizerDirty=false;
    optimizerGrainFlowRotation.checked=false;
    optimizerJobNumber.value='';
    optimizerSavedJobs.value='';
    optimizerResults.classList.remove('show');
    optimizerSheets.innerHTML='';
    optimizerMaterialTotals.innerHTML='';
    clearOptimizerStatus();
    clearOptimizerJobStatus();
    updateActiveJobChip();
    renderOptimizerJob();
  }

  function runFabricationSelfTests() {
    const checks=[];
    const check=(name,condition,detail='')=>checks.push({name,pass:!!condition,detail:condition?'':detail});
    try {
      const taskTimerFixture={accumulatedMs:60000,running:true,startedAt:1000};
      check('Task Logging running timer derives elapsed time from timestamp',taskLogElapsedMs(taskTimerFixture,61000)===120000);
      const taskPresetFixture=normalizeTaskLogPresetsRecord({
        format:TASK_LOG_PRESETS_FORMAT,version:1,nextPresetId:3,
        presets:[{id:1,name:'Frame Fabrication'},{id:2,name:'Exterior Panels'}]
      });
      check('Task Logging preset import preserves independent preset library',taskPresetFixture.presets.length===2 && taskPresetFixture.presets[1].name==='Exterior Panels');
      const taskJobsFixture=normalizeTaskLogJobsRecord({
        format:TASK_LOG_JOBS_FORMAT,version:1,exportedAt:'2026-01-01T10:30:00.000Z',activeJobId:1,nextJobId:2,nextTaskId:2,
        jobs:[{id:1,title:'26-TEST',tasks:[{id:1,presetId:1,name:'Frame Fabrication',accumulatedMs:60000,running:true,startedAt:Date.parse('2026-01-01T10:00:00.000Z'),sessions:[]}]}]
      });
      check('Task Logging job import preserves running timestamp before transfer normalization',taskJobsFixture.jobs[0].tasks[0].running===true && taskJobsFixture.jobs[0].tasks[0].startedAt===Date.parse('2026-01-01T10:00:00.000Z'));
      const finalizedCount=finalizeImportedRunningTaskLogJobs(taskJobsFixture);
      check('Task Logging import stops running backup at export timestamp',finalizedCount===1 && taskJobsFixture.jobs[0].tasks[0].running===false && taskJobsFixture.jobs[0].tasks[0].accumulatedMs===1860000);
      check('Task Logging imported running session is retained for audit',taskJobsFixture.jobs[0].tasks[0].sessions.length===1 && taskJobsFixture.jobs[0].tasks[0].sessions[0].durationMs===1800000);
      let taskJobsFutureRejected=false;
      try { normalizeTaskLogJobsRecord({format:TASK_LOG_JOBS_FORMAT,version:TASK_LOG_JOBS_VERSION+1,jobs:[]}); } catch (e) { taskJobsFutureRejected=true; }
      check('Task Logging rejects future jobs file versions',taskJobsFutureRejected);
      let taskPresetsFutureRejected=false;
      try { normalizeTaskLogPresetsRecord({format:TASK_LOG_PRESETS_FORMAT,version:TASK_LOG_PRESETS_VERSION+1,presets:[]}); } catch (e) { taskPresetsFutureRejected=true; }
      check('Task Logging rejects future preset file versions',taskPresetsFutureRejected);

      const notesRoundTrip=normalizeFabricatorNotesRecord({
        format:FABRICATOR_NOTES_FORMAT,version:1,activeTopicId:2,nextId:3,
        topics:[
          {id:1,title:'Brake setup',content:'Use back gauge at 24 1/2.',createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-02T00:00:00.000Z'},
          {id:2,title:'Door notes',content:'Check hinge side first.',createdAt:'2026-01-03T00:00:00.000Z',updatedAt:'2026-01-04T00:00:00.000Z'}
        ]
      });
      check('Fabricator Notes legacy import preserves topics and content',notesRoundTrip.topics.length===2 && notesRoundTrip.topics[0].contentHtml==='Use back gauge at 24 1/2.');
      check('Fabricator Notes import preserves active topic',notesRoundTrip.activeTopicId===2 && notesRoundTrip.nextId===3);
      const notesFormatted=normalizeFabricatorNotesRecord({
        format:FABRICATOR_NOTES_FORMAT,version:2,activeTopicId:1,nextId:2,
        topics:[{id:1,title:'Formatted',contentHtml:'Use <b>back gauge</b>, <i>verify</i>, and <u>mark</u>.<script>alert(1)<\/script>',createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-02T00:00:00.000Z'}]
      });
      check('Fabricator Notes preserves bold italic underline formatting',notesFormatted.topics[0].contentHtml.includes('<b>back gauge</b>') && notesFormatted.topics[0].contentHtml.includes('<i>verify</i>') && notesFormatted.topics[0].contentHtml.includes('<u>mark</u>'));
      check('Fabricator Notes strips unsafe imported markup',!notesFormatted.topics[0].contentHtml.includes('<script'));
      let notesFutureRejected=false;
      try { normalizeFabricatorNotesRecord({format:FABRICATOR_NOTES_FORMAT,version:FABRICATOR_NOTES_VERSION+1,topics:[]}); } catch (e) { notesFutureRejected=true; }
      check('Fabricator Notes rejects future file versions',notesFutureRejected);
      check('Long overhang 117 1/2 uses one blank',longPieces(117.5).count===1);
      check('Long overhang above 117 1/2 splits',longPieces(117.625).count===2);
      check('Short overhang 119 1/2 uses one blank',shortPieces(119.5).count===1);

      const spacingLength=100, spacingMax=24;
      const spaces=Math.max(1,Math.ceil((spacingLength/spacingMax)-1e-12));
      check('Fastener exact spacing never exceeds max',spacingLength/spaces<=spacingMax+1e-12);

      check('1/32 addition example 5/32 + 7/32 = 3/8',fractionFromThirtySeconds(5+7)==='3/8"');
      check('1/64 addition example 5/64 + 7/64 = 3/16',fractionFromSixtyFourths(5+7)==='3/16"');
      check('1/64 addition maximum 1 + 1 = 2',fractionFromSixtyFourths(128)==='2"');
      check('Quick Reference decimal mode rounds to three places',quickReferenceDecimal(5/32)==='0.156');
      check('Quick Reference 1/64 decimal rounds to three places',quickReferenceDecimal(5/64)==='0.078');
      check('Gauge reference 16 ga steel thickness',Math.abs(gaugeReferenceThickness(16,'steel')-0.0598)<1e-9);
      check('Gauge reference 16 ga aluminum thickness',Math.abs(gaugeReferenceThickness(16,'aluminum')-0.0508)<1e-9);
      check('Gauge reference 16 ga stainless thickness',Math.abs(gaugeReferenceThickness(16,'stainless')-0.0625)<1e-9);
      check('Gauge reference keeps material-specific values distinct',gaugeReferenceThickness(16,'steel')!==gaugeReferenceThickness(16,'aluminum'));

      const sawExactOne=optimizeSawItems([
        {uid:'SW1',length:40,size:40.25,label:''},
        {uid:'SW2',length:40,size:40.25,label:''},
        {uid:'SW3',length:39.5,size:39.75,label:''}
      ],120);
      check('Saw kerf: three pieces can exactly consume 120 inches',sawExactOne.bins.length===1 && Math.abs(sawExactOne.bins[0].offcut)<1e-9);
      const sawKerfSplit=optimizeSawItems([
        {uid:'SK1',length:60,size:60.25,label:''},
        {uid:'SK2',length:60,size:60.25,label:''}
      ],120);
      check('Saw kerf prevents two 60 inch pieces sharing 120 stock',sawKerfSplit.bins.length===2);
      check('Saw minimum-confirmed result is not below its lower bound',sawKerfSplit.bins.length>=sawKerfSplit.lowerBound);
      const savedSawTestJob=sawJob;
      sawJob=[{id:42,label:'Cut tracking test',length:10,qty:2}];
      const sawTrackingItems=expandedSawItems();
      sawJob=savedSawTestJob;
      check('Saw cut tracking has stable physical piece IDs',sawTrackingItems.map(item=>item.uid).join('|')==='42-1|42-2');
      const sawImportRecord=normalizeSawJobRecord({
        format:'FabricationSawOptimizerJob',version:1,tubeLength:240,kerf:0.25,nextId:8,
        parts:[{id:7,label:'B2',length:93,qty:2}],cutPartIds:['7-2']
      });
      check('Saw import preserves tube length and part data',sawImportRecord.tubeLength===240 && sawImportRecord.parts[0].label==='B2' && sawImportRecord.parts[0].length===93 && sawImportRecord.parts[0].qty===2);
      check('Saw import preserves individual cut status',sawImportRecord.cutPartIds.length===1 && sawImportRecord.cutPartIds[0]==='7-2');
      let rejectedFutureSawVersion=false;
      try { normalizeSawJobRecord({format:'FabricationSawOptimizerJob',version:SAW_JOB_FILE_VERSION+1,tubeLength:120,parts:[],cutPartIds:[]}); }
      catch (error) { rejectedFutureSawVersion=true; }
      check('Saw import rejects unsupported future versions',rejectedFutureSawVersion);

      const checklistRecord=normalizeChecklistRecord({
        format:'FabricationChecklist',version:1,activeTopicId:4,nextTopicId:5,nextItemId:12,
        topics:[{id:4,title:'Final Inspection',items:[{id:10,text:'Check hinges',checked:true},{id:11,text:'Check sweep',checked:false}]}]
      });
      check('Checklist import preserves topic and item data',checklistRecord.topics[0].title==='Final Inspection' && checklistRecord.topics[0].items.length===2);
      check('Checklist import preserves checked status',checklistRecord.topics[0].items[0].checked===true && checklistRecord.topics[0].items[1].checked===false);
      check('Checklist import preserves active topic',checklistRecord.activeTopicId===4);
      let rejectedDuplicateChecklistItem=false;
      try {
        normalizeChecklistRecord({format:'FabricationChecklist',version:1,topics:[
          {id:1,title:'A',items:[{id:1,text:'One',checked:false}]},
          {id:2,title:'B',items:[{id:1,text:'Duplicate',checked:false}]}
        ]});
      } catch (error) { rejectedDuplicateChecklistItem=true; }
      check('Checklist import rejects duplicate item IDs',rejectedDuplicateChecklistItem);
      let rejectedFutureChecklistVersion=false;
      try { normalizeChecklistRecord({format:'FabricationChecklist',version:FABRICATION_CHECKLIST_VERSION+1,topics:[]}); }
      catch (error) { rejectedFutureChecklistVersion=true; }
      check('Checklist import rejects unsupported future versions',rejectedFutureChecklistVersion);

      const productExpectations={
        exterior:[22,32], door:[21.5,31.5], acp:[19.875,29.875],
        insulation:[19.5,29.5], plywood:[19.25,29.25]
      };
      for (const [key,[w,h]] of Object.entries(productExpectations)) {
        const cut=optimizerCutSize(key,20,30);
        check(`${key} cut rule`,Math.abs(cut.width-w)<1e-9 && Math.abs(cut.height-h)<1e-9,`${cut.width} × ${cut.height}`);
      }

      // Grain-flow orientation regression tests. Width is the long/grain axis;
      // Height is the short axis when Grain Flow Rotation is ON (allowRotate=false).
      const aluminumWideCut=optimizerCutSize('exterior',100,40); // 102 W × 42 H
      const savedSelfTestJob=optimizerJob;
      optimizerJob=[{id:999,productKey:'exterior',label:'Axis test',finishedWidth:100,finishedHeight:40,qty:1,cutWidth:aluminumWideCut.width,cutHeight:aluminumWideCut.height}];
      const expandedAxisTest=expandedOptimizerItems().al063[0];
      optimizerJob=savedSelfTestJob;
      check('Expanded item maps Width to long/grain axis',expandedAxisTest.cutL===aluminumWideCut.width && expandedAxisTest.cutW===aluminumWideCut.height,`cutL=${expandedAxisTest.cutL}, cutW=${expandedAxisTest.cutW}`);

      const aluminumWide=[{uid:'GA1',cutL:aluminumWideCut.width,cutW:aluminumWideCut.height,cutWidth:aluminumWideCut.width,cutHeight:aluminumWideCut.height,productKey:'exterior',label:''}];
      const aluminumWideLocked=optimizeMaterialGroup(aluminumWide,MATERIALS.al063,false);
      check('Grain ON: wide aluminum follows Width along 0–120',!aluminumWideLocked.error && aluminumWideLocked.bins.length===1);
      check('Grain ON: locked aluminum placement is not marked rotated',!aluminumWideLocked.error && aluminumWideLocked.bins[0].used[0].rotated===false);

      const aluminumTallCut=optimizerCutSize('exterior',40,100); // 42 W × 102 H
      const aluminumTall=[{uid:'GA2',cutL:aluminumTallCut.width,cutW:aluminumTallCut.height,cutWidth:aluminumTallCut.width,cutHeight:aluminumTallCut.height,productKey:'exterior',label:''}];
      const aluminumTallLocked=optimizeMaterialGroup(aluminumTall,MATERIALS.al063,false);
      const aluminumTallFree=optimizeMaterialGroup(aluminumTall,MATERIALS.al063,true);
      check('Grain ON: tall aluminum cannot swap Width/Height',!!aluminumTallLocked.error);
      check('Grain OFF: tall aluminum may rotate to fit',!aluminumTallFree.error && aluminumTallFree.bins.length===1);
      check('Grain OFF: rotated aluminum placement is marked rotated for its label',!aluminumTallFree.error && aluminumTallFree.bins[0].used[0].rotated===true);

      const plywoodWideCut=optimizerCutSize('plywood',90,40); // 89.25 W × 39.25 H
      const plywoodWide=[{uid:'GP1',cutL:plywoodWideCut.width,cutW:plywoodWideCut.height,cutWidth:plywoodWideCut.width,cutHeight:plywoodWideCut.height,productKey:'plywood',label:''}];
      const plywoodWideLocked=optimizeMaterialGroup(plywoodWide,MATERIALS.plywood,false);
      check('Grain ON: wide plywood follows Width along long axis',!plywoodWideLocked.error && plywoodWideLocked.bins.length===1);

      const plywoodTallCut=optimizerCutSize('plywood',40,90); // 39.25 W × 89.25 H
      const plywoodTall=[{uid:'GP2',cutL:plywoodTallCut.width,cutW:plywoodTallCut.height,cutWidth:plywoodTallCut.width,cutHeight:plywoodTallCut.height,productKey:'plywood',label:''}];
      const plywoodTallLocked=optimizeMaterialGroup(plywoodTall,MATERIALS.plywood,false);
      const plywoodTallFree=optimizeMaterialGroup(plywoodTall,MATERIALS.plywood,true);
      check('Grain ON: tall plywood cannot swap Width/Height',!!plywoodTallLocked.error);
      check('Grain OFF: tall plywood may rotate to fit',!plywoodTallFree.error && plywoodTallFree.bins.length===1);

      const knownRegression=[[12,36],[60,12],[24,48],[48,12],[12,12],[36,48],[84,12]].map((d,i)=>({
        uid:`R${i+1}`,cutL:d[0],cutW:d[1],cutHeight:d[0],cutWidth:d[1],productKey:'insulation',label:''
      }));
      const regressionResult=optimizeMaterialGroup(knownRegression,MATERIALS.cellulose,true);
      check('Optimizer never falsely proves regression layout',!regressionResult.minimumConfirmed || regressionResult.bins.length===regressionResult.lowerBound,`bins=${regressionResult.bins.length}, lower=${regressionResult.lowerBound}`);
      check('Minimum-confirmed invariant',!regressionResult.minimumConfirmed || regressionResult.bins.length===regressionResult.lowerBound);

      const shearItems=[
        {uid:'S1',cutL:50,cutW:20,cutHeight:50,cutWidth:20,productKey:'exterior',label:''},
        {uid:'S2',cutL:40,cutW:20,cutHeight:40,cutWidth:20,productKey:'exterior',label:''}
      ];
      const shear=optimizeMaterialGroup(shearItems,MATERIALS.al063,true);
      check('Generated shear layout validates',!shear.error && !shear.internalError && validateShearPacking(shear.bins,shearItems,MATERIALS.al063.usableL,MATERIALS.al063.usableW,true).ok);

      const sampleRecord=normalizeOptimizerJobRecord({
        format:'FabricationCutOptimizerJob',version:2,jobNumber:'SELFTEST',rotate:true,nextId:2,
        parts:[{id:1,productKey:'plywood',label:'Test',finishedWidth:20,finishedHeight:30,qty:1}],cutPartIds:['1-1']
      });
      check('Import normalization preserves cut mark',sampleRecord.cutPartIds[0]==='1-1');
      check('Import normalization preserves Width × Height',sampleRecord.parts[0].finishedWidth===20 && sampleRecord.parts[0].finishedHeight===30);
      check('Legacy rotate=true migrates to Grain Flow Rotation OFF',sampleRecord.grainFlowRotation===false);
      const legacyLocked=normalizeOptimizerJobRecord({
        format:'FabricationCutOptimizerJob',version:2,jobNumber:'SELFTEST-LOCKED',rotate:false,nextId:2,
        parts:[{id:1,productKey:'plywood',label:'Test',finishedWidth:20,finishedHeight:30,qty:1}],cutPartIds:[]
      });
      check('Legacy rotate=false migrates to Grain Flow Rotation ON',legacyLocked.grainFlowRotation===true);
      const v3Locked=normalizeOptimizerJobRecord({
        format:'FabricationCutOptimizerJob',version:3,jobNumber:'SELFTEST-V3',grainFlowRotation:true,nextId:2,
        parts:[{id:1,productKey:'plywood',label:'Test',finishedWidth:20,finishedHeight:30,qty:1}],cutPartIds:[]
      });
      check('V3 Grain Flow Rotation setting is preserved',v3Locked.grainFlowRotation===true);
    } catch (error) {
      checks.push({name:'Self-test execution',pass:false,detail:String(error && error.stack || error)});
    }
    const passed=checks.filter(c=>c.pass).length;
    const summary={passed,total:checks.length,failed:checks.filter(c=>!c.pass),checks};
    if (console && console.table) console.table(checks);
    if (summary.failed.length) console.error('Fabrication self-tests failed',summary);
    else console.info(`Fabrication self-tests passed: ${passed}/${checks.length}`);
    return summary;
  }
  window.runFabricationSelfTests=runFabricationSelfTests;
  async function runFabricationBrowserSelfTests() {
    const summary=runFabricationSelfTests();
    try {
      const workerGroups={cellulose:[
        {uid:'W1',cutL:20,cutW:20,cutHeight:20,cutWidth:20,productKey:'insulation',label:''},
        {uid:'W2',cutL:30,cutW:20,cutHeight:30,cutWidth:20,productKey:'insulation',label:''}
      ]};
      const workerResults=await optimizeGroupsInWorker(workerGroups,true,++optimizerRunSerial);
      const workerOk=!!(workerResults.cellulose && workerResults.cellulose.bins && workerResults.cellulose.bins.length===1);
      summary.checks.push({name:'Inline Web Worker optimization',pass:workerOk,detail:workerOk?'':'Worker did not return the expected one-sheet layout.'});
      if (!workerOk) summary.failed.push(summary.checks[summary.checks.length-1]);
      else summary.passed++;
      summary.total++;
    } catch (error) {
      const failure={name:'Inline Web Worker optimization',pass:false,detail:String(error && error.message || error)};
      summary.checks.push(failure); summary.failed.push(failure); summary.total++;
    }
    document.documentElement.dataset.selfTest=`${summary.passed}/${summary.total}`;
    const pre=document.createElement('pre');
    pre.id='selfTestReport';
    pre.textContent=JSON.stringify(summary,null,2);
    pre.style.whiteSpace='pre-wrap';
    document.body.appendChild(pre);
    return summary;
  }
  window.runFabricationBrowserSelfTests=runFabricationBrowserSelfTests;
  if (location.hash==='#selftest') setTimeout(runFabricationBrowserSelfTests,0);

  optimizerProduct.addEventListener('change', updateOptimizerRulePreview);
  optimizerCopySource.addEventListener('change',()=>{ clearOptimizerCopyStatus(); updateOptimizerCopyControls(); });
  optimizerCopyTarget.addEventListener('change',()=>{ clearOptimizerCopyStatus(); optimizerCopyBtn.textContent=optimizerCopyTarget.value ? `Copy to ${PRODUCTS[optimizerCopyTarget.value].shortName}` : 'Copy Entire List'; });
  optimizerCopyBtn.addEventListener('click',copyOptimizerProductList);
  document.getElementById('optimizerAddBtn').addEventListener('click', addOptimizerPart);
  document.getElementById('optimizerRunBtn').addEventListener('click', ()=>runOptimizer(true));
  document.getElementById('optimizerClearBtn').addEventListener('click', clearOptimizerJob);
  document.getElementById('optimizerSaveJobBtn').addEventListener('click', saveOptimizerJob);
  document.getElementById('optimizerLoadJobBtn').addEventListener('click', loadOptimizerJob);
  document.getElementById('optimizerDeleteJobBtn').addEventListener('click', deleteOptimizerSavedJob);
  document.getElementById('optimizerExportJobBtn').addEventListener('click', exportOptimizerJob);
  document.getElementById('optimizerImportJobBtn').addEventListener('click', ()=>optimizerImportFile.click());
  optimizerImportFile.addEventListener('change',()=>importOptimizerJobFile(optimizerImportFile.files && optimizerImportFile.files[0]));
  optimizerJobNumber.addEventListener('input',()=>{ optimizerSavedJobs.value=''; markOptimizerDirty(); });
  optimizerSavedJobs.addEventListener('change',()=>{ clearOptimizerJobStatus(); });
  [optimizerWidth,optimizerHeight,optimizerQty].forEach(el=>el.addEventListener('keydown',e=>{if(e.key==='Enter') addOptimizerPart();}));
  optimizerGrainFlowRotation.addEventListener('change',()=>{ markOptimizerDirty(); if (optimizerResults.classList.contains('show')) runOptimizer(false); });
  window.addEventListener('beforeunload',e=>{
    if (!optimizerDirty) return;
    e.preventDefault();
    e.returnValue='';
  });

  optimizerGrainFlowRotation.checked=false;
  updateOptimizerRulePreview();
  refreshSavedOptimizerJobs();
  updateActiveJobChip();
  renderOptimizerJob();


  calculateOverhang();
})();
