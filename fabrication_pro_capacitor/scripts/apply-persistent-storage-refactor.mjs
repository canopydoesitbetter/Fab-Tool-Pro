import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root=resolve(import.meta.dirname,'..');
const read=relative=>readFileSync(join(root,relative),'utf8');
const write=(relative,text)=>writeFileSync(join(root,relative),text);
function replaceExact(relative,before,after,label=before.slice(0,60)) {
  const source=read(relative);
  const count=source.split(before).length-1;
  if (count!==1) throw new Error(`${relative}: expected exactly one match for ${label}, found ${count}`);
  write(relative,source.replace(before,after));
}
function insertBefore(relative,marker,text,label=marker.slice(0,60)) {
  replaceExact(relative,marker,text+marker,label);
}

// Preserve successful recovery protection across later re-reads of identical raw bytes.
replaceExact('www/app/storage.js',
`    const result=normalizePersistentStoreValue(definition.id,raw);
    const risky=['migrated','invalid','unsupported'].includes(result.status);
    persistentStoreState.set(definition.id,{...result,recoveryProtected:false,requiresRecoveryProtection:risky});
`,
`    const result=normalizePersistentStoreValue(definition.id,raw);
    const risky=['migrated','invalid','unsupported'].includes(result.status);
    const previous=persistentStoreState.get(definition.id);
    const recoveryProtected=!!(risky && previous?.recoveryProtected && previous.raw===result.raw && previous.status===result.status);
    persistentStoreState.set(definition.id,{...result,recoveryProtected,requiresRecoveryProtection:risky});
`,
'storage reread protection state');

// Shift Schedule store.
replaceExact('www/app/shift-schedule.js',
`  function loadShiftScheduleState() {
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
`,
`  registerPersistentStore({
    id:'shiftSchedule',key:SHIFT_SCHEDULE_KEY,version:SHIFT_SCHEDULE_VERSION,encoding:'json',label:'Shift Schedule',
    defaultValue:defaultShiftScheduleState,
    getVersion:value=>Number(value?.version || 1),
    normalize:value=>{
      if (!value || typeof value!=='object' || Array.isArray(value)) throw new Error('Saved Shift Schedule data is invalid.');
      if (value.enabled===true) {
        const candidateConfig=normalizeShiftScheduleConfig(value.config || value);
        const validation=validateShiftScheduleConfig(candidateConfig);
        if (!validation.ok) throw new Error('Saved Shift Schedule is invalid: '+validation.errors.join(' '));
      }
      return normalizeShiftScheduleState(value);
    }
  });

  function loadShiftScheduleState() {
    shiftScheduleLoadError='';
    const result=loadPersistentStore('shiftSchedule');
    if (result.status==='invalid' || result.status==='unsupported') {
      shiftScheduleLoadError=result.error?.message || 'Saved Shift Schedule data could not be read, so protection was turned off.';
    }
    return result.value;
  }

  let shiftScheduleState=loadShiftScheduleState();

  function persistShiftScheduleState() {
    try {
      shiftScheduleState=writePersistentStore('shiftSchedule',shiftScheduleState);
      shiftScheduleStorageError='';
      return true;
    } catch (error) {
      shiftScheduleStorageError=error?.message || 'This browser could not save Shift Schedule settings locally.';
      return false;
    }
  }
`,
'shift storage load/save');

// Task Logging stores.
insertBefore('www/app/task-logging.js',`  function persistTaskLogJobs(showError=true) {\n`,
`  registerPersistentStore({
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

`, 'task storage registration');
replaceExact('www/app/task-logging.js',
`      localStorage.setItem(TASK_LOG_JOBS_KEY,JSON.stringify(serializeTaskLogJobsRecord()));`,
`      writePersistentStore('taskLogJobs',serializeTaskLogJobsRecord());`,
'task jobs persist');
replaceExact('www/app/task-logging.js',
`      localStorage.setItem(TASK_LOG_PRESETS_KEY,JSON.stringify(serializeTaskLogPresetsRecord()));`,
`      writePersistentStore('taskLogPresets',serializeTaskLogPresetsRecord());`,
'task presets persist');
replaceExact('www/app/task-logging.js',
`  function loadTaskLoggingData() {
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
    reconcileShiftSchedule(Date.now());
    renderTaskLogging();
  }
`,
`  function loadTaskLoggingData() {
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
`,
'task storage load');

// Fabricator Notes explicit v1 -> v2 migration and store.
insertBefore('www/app/notes.js',`  function normalizeFabricatorNotesRecord(raw) {\n`,
`  function migrateFabricatorNotesV1ToV2(raw) {
    const data=raw && raw.fabricatorNotes ? raw.fabricatorNotes : raw;
    if (!data || typeof data!=='object' || Array.isArray(data)) throw new Error('The file does not contain valid Fabricator Notes data.');
    if (!Array.isArray(data.topics)) throw new Error('The Fabricator Notes file is missing its topics list.');
    return {
      ...data,
      version:2,
      topics:data.topics.map((topic,index)=>{
        if (!topic || typeof topic!=='object' || Array.isArray(topic)) throw new Error(\`Topic \${index+1} is invalid.\`);
        if (typeof topic.content!=='string') throw new Error(\`Topic \${index+1} has invalid note content.\`);
        if (topic.content.length>MAX_FABRICATOR_NOTE_CONTENT) throw new Error(\`Topic \${index+1} content exceeds \${MAX_FABRICATOR_NOTE_CONTENT.toLocaleString()} characters.\`);
        const {content,...rest}=topic;
        return {...rest,contentHtml:plainTextToFabricatorNoteHtml(content)};
      })
    };
  }

`, 'notes v1 migration');
replaceExact('www/app/notes.js',
`    if (version > FABRICATOR_NOTES_VERSION) throw new Error('These Fabricator Notes were created by a newer version of Fabrication Calculators and cannot be safely imported here.');
    if (!Array.isArray(data.topics)) throw new Error('The Fabricator Notes file is missing its topics list.');`,
`    if (version > FABRICATOR_NOTES_VERSION) throw new Error('These Fabricator Notes were created by a newer version of Fabrication Calculators and cannot be safely imported here.');
    if (version===1) return normalizeFabricatorNotesRecord(migrateFabricatorNotesV1ToV2(data));
    if (!Array.isArray(data.topics)) throw new Error('The Fabricator Notes file is missing its topics list.');`,
'notes normalizer delegates v1 migration');
insertBefore('www/app/notes.js',`  function persistFabricatorNotes(showError=true) {\n`,
`  registerPersistentStore({
    id:'fabricatorNotes',key:FABRICATOR_NOTES_KEY,version:FABRICATOR_NOTES_VERSION,encoding:'json',label:'Fabricator Notes',
    defaultValue:()=>({format:FABRICATOR_NOTES_FORMAT,version:FABRICATOR_NOTES_VERSION,activeTopicId:null,nextId:1,topics:[]}),
    getVersion:value=>Number(value?.version || 1),
    migrations:{1:migrateFabricatorNotesV1ToV2},
    normalize:value=>{
      const data=value && value.fabricatorNotes ? value.fabricatorNotes : value;
      if (Number(data?.version)!==FABRICATOR_NOTES_VERSION) throw new Error('Fabricator Notes did not reach the current schema version.');
      return normalizeFabricatorNotesRecord(data);
    }
  });

`, 'notes storage registration');
replaceExact('www/app/notes.js',
`      localStorage.setItem(FABRICATOR_NOTES_KEY,JSON.stringify(serializeFabricatorNotesRecord()));`,
`      writePersistentStore('fabricatorNotes',serializeFabricatorNotesRecord());`,
'notes persist');
replaceExact('www/app/notes.js',
`  function loadFabricatorNotesFromStorage() {
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
`,
`  function loadFabricatorNotesFromStorage() {
    const result=loadPersistentStore('fabricatorNotes');
    const record=result.value;
    fabricatorNotes=record.topics.map(topic=>({...topic}));
    fabricatorNotesActiveId=record.activeTopicId;
    fabricatorNotesNextId=record.nextId;
    if (result.status==='invalid' || result.status==='unsupported') {
      showFabricatorNotesStatus('Saved Fabricator Notes data could not be read. The original saved data was retained for recovery.','error');
    }
    renderFabricatorNotes();
  }
`,
'notes load');

// Checklist store.
insertBefore('www/app/checklist.js',`  function persistChecklists(showError=true) {\n`,
`  registerPersistentStore({
    id:'checklists',key:FABRICATION_CHECKLIST_KEY,version:FABRICATION_CHECKLIST_VERSION,encoding:'json',label:'Checklist',
    defaultValue:()=>({format:FABRICATION_CHECKLIST_FORMAT,version:FABRICATION_CHECKLIST_VERSION,activeTopicId:null,nextTopicId:1,nextItemId:1,topics:[]}),
    getVersion:value=>Number(value?.version || 1),
    normalize:normalizeChecklistRecord
  });

`, 'checklist storage registration');
replaceExact('www/app/checklist.js',
`      localStorage.setItem(FABRICATION_CHECKLIST_KEY,JSON.stringify(serializeChecklistRecord()));`,
`      writePersistentStore('checklists',serializeChecklistRecord());`,
'checklist persist');
replaceExact('www/app/checklist.js',
`  function loadChecklistsFromStorage() {
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
`,
`  function loadChecklistsFromStorage() {
    const result=loadPersistentStore('checklists');
    const record=result.value;
    fabricationChecklists=record.topics.map(topic=>({...topic,items:topic.items.map(item=>({...item}))}));
    checklistActiveTopicId=record.activeTopicId;
    checklistNextTopicId=record.nextTopicId;
    checklistNextItemId=record.nextItemId;
    if (result.status==='invalid' || result.status==='unsupported') {
      showChecklistStatus('Saved Checklist data could not be read. The original saved data was retained for recovery.','error');
    }
    renderChecklists();
  }
`,
'checklist load');

// Quick Reference preference stores. Initialization must not write defaults over invalid/missing raw data.
replaceExact('www/app/quick-reference.js',`  function updateQuickReferenceDisplayValues() {\n`,`  function updateQuickReferenceDisplayValues({persist=true}={}) {\n`,'quick reference display signature');
replaceExact('www/app/quick-reference.js',
`    storageSet(QUICK_REFERENCE_DECIMAL_KEY,decimals?'decimal':'fraction');`,
`    if (persist) {
      try { writePersistentStore('quickReferenceDisplayMode',decimals?'decimal':'fraction'); }
      catch (error) { console.warn(error); }
    }`,
'quick reference display persist');
replaceExact('www/app/quick-reference.js',`  function renderQuickReference(key) {\n`,`  function renderQuickReference(key,{persist=true}={}) {\n`,'quick reference render signature');
replaceExact('www/app/quick-reference.js',
`    entry.render();
    updateQuickReferenceDisplayValues();
    restoreQuickReferenceSelection(resolvedKey);
    storageSet('fabricationQuickReferenceTable', resolvedKey);`,
`    entry.render();
    updateQuickReferenceDisplayValues({persist});
    restoreQuickReferenceSelection(resolvedKey);
    if (persist) {
      try { writePersistentStore('quickReferenceTable',resolvedKey); }
      catch (error) { console.warn(error); }
    }`,
'quick reference render persist');
replaceExact('www/app/quick-reference.js',
`  const quickReferenceTableCount = Object.keys(QUICK_REFERENCE_TABLES).length;
  quickReferenceCount.textContent = \`\${quickReferenceTableCount} table\${quickReferenceTableCount === 1 ? '' : 's'}\`;
  quickReferenceDecimalMode.checked=storageGet(QUICK_REFERENCE_DECIMAL_KEY)==='decimal';
  updateQuickReferenceModeLabels();
  quickReferenceSelect.addEventListener('change', () => renderQuickReference(quickReferenceSelect.value));
  quickReferenceDecimalMode.addEventListener('change',updateQuickReferenceDisplayValues);
  const savedQuickReference = storageGet('fabricationQuickReferenceTable');
  renderQuickReference(savedQuickReference || 'fraction-addition');
`,
`  registerPersistentStore({
    id:'quickReferenceTable',key:'fabricationQuickReferenceTable',version:1,encoding:'string',label:'Quick Reference Table',
    defaultValue:()=> 'fraction-addition',
    normalize:value=>{
      if (!Object.prototype.hasOwnProperty.call(QUICK_REFERENCE_TABLES,value)) throw new Error('Saved Quick Reference table is invalid.');
      return value;
    }
  });
  registerPersistentStore({
    id:'quickReferenceDisplayMode',key:QUICK_REFERENCE_DECIMAL_KEY,version:1,encoding:'string',label:'Quick Reference Display Mode',
    defaultValue:()=> 'fraction',
    normalize:value=>{
      if (!['fraction','decimal'].includes(value)) throw new Error('Saved Quick Reference display mode is invalid.');
      return value;
    }
  });

  const quickReferenceTableCount = Object.keys(QUICK_REFERENCE_TABLES).length;
  quickReferenceCount.textContent = \`\${quickReferenceTableCount} table\${quickReferenceTableCount === 1 ? '' : 's'}\`;
  const quickReferenceDisplayResult=loadPersistentStore('quickReferenceDisplayMode');
  const quickReferenceTableResult=loadPersistentStore('quickReferenceTable');
  quickReferenceDecimalMode.checked=quickReferenceDisplayResult.value==='decimal';
  updateQuickReferenceModeLabels();
  quickReferenceSelect.addEventListener('change', () => renderQuickReference(quickReferenceSelect.value));
  quickReferenceDecimalMode.addEventListener('change',()=>updateQuickReferenceDisplayValues());
  renderQuickReference(quickReferenceTableResult.value,{persist:false});
`,
'quick reference registration/init');

// Sheet Optimizer saved-jobs dictionary with explicit mixed-version migration passes.
replaceExact('www/app/sheet-optimizer.js',
`  function readSavedOptimizerJobs() {
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
`,
`  function readSavedOptimizerJobs() {
    const result=loadPersistentStore('optimizerSavedJobs');
    if (result.status==='invalid' || result.status==='unsupported') {
      showOptimizerJobStatus('Saved Sheet Optimizer jobs could not be read. The original saved data was retained for recovery.','error');
    }
    return createJobDictionary(result.value);
  }

  function writeSavedOptimizerJobs(jobs) {
    try {
      writePersistentStore('optimizerSavedJobs',jobs);
      return true;
    } catch (e) {
      showOptimizerJobStatus(e?.message || 'This browser could not save the job locally. Use Export Job File as a backup instead.','error');
      return false;
    }
  }
`,
'optimizer read/write');
insertBefore('www/app/sheet-optimizer.js',`  function applyOptimizerJobRecord(record,autoOptimize=true) {\n`,
`  function optimizerSavedJobsSourceVersion(source) {
    if (!source || typeof source!=='object' || Array.isArray(source)) return NaN;
    const versions=Object.values(source).map(record=>Number(record?.version || 1));
    if (!versions.length) return OPTIMIZER_JOB_FILE_VERSION;
    if (versions.some(version=>!Number.isInteger(version) || version<1)) return NaN;
    const future=versions.filter(version=>version>OPTIMIZER_JOB_FILE_VERSION);
    if (future.length) return Math.max(...future);
    return Math.min(...versions);
  }

  function migrateOptimizerSavedJobsV1ToV2(source) {
    const out=createJobDictionary();
    for (const [key,record] of Object.entries(source || {})) {
      const version=Number(record?.version || 1);
      if (version!==1) { out[key]=record; continue; }
      if (!record || typeof record!=='object' || Array.isArray(record)) throw new Error(\`Saved Sheet Optimizer job \${key} is invalid.\`);
      out[key]={
        ...record,
        version:2,
        parts:Array.isArray(record.parts) ? record.parts.map(row=>({
          ...row,
          finishedWidth:row?.finishedWidth ?? row?.finishedW,
          finishedHeight:row?.finishedHeight ?? row?.finishedL
        })) : record.parts
      };
    }
    return out;
  }

  function migrateOptimizerSavedJobsV2ToV3(source) {
    const out=createJobDictionary();
    for (const [key,record] of Object.entries(source || {})) {
      const version=Number(record?.version || 1);
      if (version!==2) { out[key]=record; continue; }
      if (!record || typeof record!=='object' || Array.isArray(record)) throw new Error(\`Saved Sheet Optimizer job \${key} is invalid.\`);
      out[key]={...record,version:3,grainFlowRotation:record.rotate===false};
    }
    return out;
  }

  function normalizeSavedOptimizerJobsDictionary(source) {
    if (source==null) return createJobDictionary();
    if (typeof source!=='object' || Array.isArray(source)) throw new Error('Saved Sheet Optimizer jobs are invalid.');
    const out=createJobDictionary();
    for (const key of Object.keys(source).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'}))) {
      const record=normalizeOptimizerJobRecord(source[key]);
      if (record.version!==OPTIMIZER_JOB_FILE_VERSION) throw new Error(\`Saved Sheet Optimizer job \${key} did not reach the current schema.\`);
      if (record.jobNumber!==key) throw new Error(\`Saved Sheet Optimizer job \${key} has mismatched job metadata.\`);
      out[key]=record;
    }
    return out;
  }

  registerPersistentStore({
    id:'optimizerSavedJobs',key:OPTIMIZER_JOBS_KEY,version:OPTIMIZER_JOB_FILE_VERSION,encoding:'json',label:'Sheet Optimizer Saved Jobs',
    defaultValue:()=>createJobDictionary(),
    getVersion:optimizerSavedJobsSourceVersion,
    migrations:{1:migrateOptimizerSavedJobsV1ToV2,2:migrateOptimizerSavedJobsV2ToV3},
    normalize:normalizeSavedOptimizerJobsDictionary
  });

`, 'optimizer migration/store registration');

// Full backup schema v2 uses registered stores as the schema source of truth.
write('www/app/import-export.js',`  // ---------------- Unified Backup & Restore bridge ----------------
  const FABRI_CADABRA_BACKUP_FORMAT='FabriCadabraBackup';
  const FABRI_CADABRA_BACKUP_SCHEMA_VERSION=2;

  async function flushPendingPersistentEdits() {
    if (taskLogSaveTimer) {
      clearTimeout(taskLogSaveTimer);
      taskLogSaveTimer=null;
      persistTaskLogJobs(false);
    }
    if (fabricatorNotesSaveTimer) persistFabricatorNotes(false);
    if (checklistSaveTimer) persistChecklists(false);
    return true;
  }

  function currentSavedOptimizerJobsForBackup() {
    return normalizeSavedOptimizerJobsDictionary(readSavedOptimizerJobs());
  }

  function normalizedBackupPreferences() {
    const themeResult=normalizePersistentStoreValue('theme',storageGet(getPersistentStoreDefinition('theme').key),{fromImport:true});
    const toolResult=normalizePersistentStoreValue('lastTool',storageGet(getPersistentStoreDefinition('lastTool').key),{fromImport:true});
    const tableResult=normalizePersistentStoreValue('quickReferenceTable',storageGet(getPersistentStoreDefinition('quickReferenceTable').key),{fromImport:true});
    const displayResult=normalizePersistentStoreValue('quickReferenceDisplayMode',storageGet(getPersistentStoreDefinition('quickReferenceDisplayMode').key),{fromImport:true});
    const invalid=[themeResult,toolResult,tableResult,displayResult].find(result=>result.status==='invalid' || result.status==='unsupported');
    if (invalid) throw invalid.error || new Error('A saved preference could not be safely backed up.');
    return {
      theme:root.dataset.theme==='dark'?'dark':'light',
      lastTool:toolResult.value,
      quickReferenceTable:tableResult.value,
      quickReferenceDisplayMode:displayResult.value
    };
  }

  function buildFullBackup() {
    const blockingIssues=getPersistentStorageIssues();
    if (blockingIssues.length) {
      const labels=blockingIssues.map(issue=>issue.label).join(', ');
      throw new Error('A complete backup cannot be created while saved data needs recovery attention: '+labels+'. The original saved bytes have not been discarded.');
    }
    const exportedAt=new Date().toISOString();
    const jobs=serializeTaskLogJobsRecord();
    const presets=serializeTaskLogPresetsRecord();
    const notes=serializeFabricatorNotesRecord();
    const checklists=serializeChecklistRecord();
    jobs.exportedAt=exportedAt;
    presets.exportedAt=exportedAt;
    notes.exportedAt=exportedAt;
    checklists.exportedAt=exportedAt;
    return {
      format:FABRI_CADABRA_BACKUP_FORMAT,
      schemaVersion:FABRI_CADABRA_BACKUP_SCHEMA_VERSION,
      appVersion:FABRI_CADABRA_VERSION,
      exportedAt,
      sections:{
        taskLogging:{jobs,presets},
        shiftSchedule:cloneShiftValue(shiftScheduleState),
        fabricatorNotes:notes,
        checklists,
        optimizer:{savedJobs:currentSavedOptimizerJobsForBackup()},
        preferences:normalizedBackupPreferences()
      }
    };
  }

  function migrateFullBackupV1ToV2(raw) {
    if (!raw || typeof raw!=='object' || Array.isArray(raw)) throw new Error('The selected file is not a valid Fabri-Cadabra backup.');
    return {...raw,schemaVersion:2};
  }

  function normalizeBackupStore(id,value) {
    const definition=getPersistentStoreDefinition(id);
    const raw=definition.encoding==='json' ? JSON.stringify(value) : String(value);
    const result=normalizePersistentStoreValue(id,raw,{fromImport:true});
    if (result.status==='invalid' || result.status==='unsupported') throw result.error || new Error(\`The backup contains invalid \${definition.label} data.\`);
    return result.value;
  }

  function normalizeFullBackupForRestore(raw) {
    if (!raw || typeof raw!=='object' || Array.isArray(raw)) throw new Error('The selected file is not a valid Fabri-Cadabra backup.');
    if (raw.format!==FABRI_CADABRA_BACKUP_FORMAT) throw new Error('This JSON file is not a Fabri-Cadabra full backup.');
    const sourceSchemaVersion=Number(raw.schemaVersion);
    if (!Number.isInteger(sourceSchemaVersion) || sourceSchemaVersion<1) throw new Error('The Fabri-Cadabra backup has an invalid schema version.');
    if (sourceSchemaVersion>FABRI_CADABRA_BACKUP_SCHEMA_VERSION) throw new Error('This backup was created by a newer Fabri-Cadabra backup schema and cannot be safely restored here.');
    let candidate=raw;
    if (sourceSchemaVersion===1) candidate=migrateFullBackupV1ToV2(candidate);
    if (Number(candidate.schemaVersion)!==FABRI_CADABRA_BACKUP_SCHEMA_VERSION) throw new Error('The Fabri-Cadabra backup could not be migrated to the current backup schema.');
    if (typeof candidate.appVersion!=='string' || !candidate.appVersion.trim()) throw new Error('The Fabri-Cadabra backup is missing its app version metadata.');
    const exportedMs=Date.parse(candidate.exportedAt);
    if (!Number.isFinite(exportedMs)) throw new Error('The Fabri-Cadabra backup has an invalid export timestamp.');
    const exportedAt=new Date(exportedMs).toISOString();
    const sections=candidate.sections;
    if (!sections || typeof sections!=='object' || Array.isArray(sections)) throw new Error('The Fabri-Cadabra backup is missing its required sections.');
    for (const name of ['taskLogging','shiftSchedule','fabricatorNotes','checklists','optimizer','preferences']) {
      if (!Object.prototype.hasOwnProperty.call(sections,name)) throw new Error('The Fabri-Cadabra backup is missing the '+name+' section.');
    }
    if (!sections.taskLogging || typeof sections.taskLogging!=='object' || Array.isArray(sections.taskLogging)) throw new Error('The Task Logging backup section is invalid.');
    if (!Object.prototype.hasOwnProperty.call(sections.taskLogging,'jobs') || !Object.prototype.hasOwnProperty.call(sections.taskLogging,'presets')) throw new Error('The Task Logging backup section is incomplete.');
    const record=normalizeBackupStore('taskLogJobs',sections.taskLogging.jobs);
    record.exportedAt=exportedAt;
    finalizeImportedRunningTaskLogJobs(record);
    const presetRecord=normalizeBackupStore('taskLogPresets',sections.taskLogging.presets);

    const normalizedShift=normalizeBackupStore('shiftSchedule',sections.shiftSchedule);
    normalizedShift.clock={clockedIn:false,clockedInAt:null,mode:null,shiftId:null};
    normalizedShift.pauseOverrides={shiftId:null,breakEnabled:null,lunchEnabled:null};
    normalizedShift.policyEffectiveAt=Date.now();

    const notesRecord=normalizeBackupStore('fabricatorNotes',sections.fabricatorNotes);
    const checklistRecord=normalizeBackupStore('checklists',sections.checklists);
    if (!sections.optimizer || typeof sections.optimizer!=='object' || Array.isArray(sections.optimizer) || !Object.prototype.hasOwnProperty.call(sections.optimizer,'savedJobs')) throw new Error('The Sheet Optimizer backup section is invalid.');
    const savedJobs=normalizeBackupStore('optimizerSavedJobs',sections.optimizer.savedJobs);

    const preferences=sections.preferences;
    if (!preferences || typeof preferences!=='object' || Array.isArray(preferences)) throw new Error('The preferences backup section is invalid.');
    const theme=normalizeBackupStore('theme',preferences.theme);
    const lastTool=normalizeBackupStore('lastTool',preferences.lastTool);
    const quickReferenceTable=normalizeBackupStore('quickReferenceTable',preferences.quickReferenceTable);
    const quickReferenceDisplayMode=normalizeBackupStore('quickReferenceDisplayMode',preferences.quickReferenceDisplayMode);

    const storage={
      [getPersistentStoreDefinition('taskLogJobs').key]:serializePersistentStoreValue('taskLogJobs',record),
      [getPersistentStoreDefinition('taskLogPresets').key]:serializePersistentStoreValue('taskLogPresets',presetRecord),
      [getPersistentStoreDefinition('shiftSchedule').key]:serializePersistentStoreValue('shiftSchedule',normalizedShift),
      [getPersistentStoreDefinition('fabricatorNotes').key]:serializePersistentStoreValue('fabricatorNotes',notesRecord),
      [getPersistentStoreDefinition('checklists').key]:serializePersistentStoreValue('checklists',checklistRecord),
      [getPersistentStoreDefinition('optimizerSavedJobs').key]:serializePersistentStoreValue('optimizerSavedJobs',savedJobs),
      [getPersistentStoreDefinition('theme').key]:serializePersistentStoreValue('theme',theme),
      [getPersistentStoreDefinition('lastTool').key]:serializePersistentStoreValue('lastTool',lastTool),
      [getPersistentStoreDefinition('quickReferenceTable').key]:serializePersistentStoreValue('quickReferenceTable',quickReferenceTable),
      [getPersistentStoreDefinition('quickReferenceDisplayMode').key]:serializePersistentStoreValue('quickReferenceDisplayMode',quickReferenceDisplayMode)
    };
    return {storage,exportedAt,appVersion:candidate.appVersion,schemaVersion:FABRI_CADABRA_BACKUP_SCHEMA_VERSION,sourceSchemaVersion};
  }

  window.FabriCadabraApp.backup={
    format:FABRI_CADABRA_BACKUP_FORMAT,
    schemaVersion:FABRI_CADABRA_BACKUP_SCHEMA_VERSION,
    persistenceKeys:Object.freeze(listPersistentStores().map(store=>store.key)),
    flushPendingPersistentEdits,
    buildFullBackup,
    normalizeFullBackupForRestore
  };

`);

// Recovery DB v2 adds raw-store protection without disturbing full snapshots.
replaceExact('www/backup.js',`  const RECOVERY_DB_VERSION=1;`,`  const RECOVERY_DB_VERSION=2;`,'recovery DB version');
replaceExact('www/backup.js',
`  const RECOVERY_STORE_NAME='snapshots';
  const RECOVERY_LATEST_ID='latest';`,
`  const RECOVERY_STORE_NAME='snapshots';
  const RECOVERY_RAW_STORE_NAME='rawStores';
  const RECOVERY_LATEST_ID='latest';`,
'recovery raw store constant');
replaceExact('www/backup.js',
`        if (!db.objectStoreNames.contains(RECOVERY_STORE_NAME)) db.createObjectStore(RECOVERY_STORE_NAME,{keyPath:'id'});`,
`        if (!db.objectStoreNames.contains(RECOVERY_STORE_NAME)) db.createObjectStore(RECOVERY_STORE_NAME,{keyPath:'id'});
        if (!db.objectStoreNames.contains(RECOVERY_RAW_STORE_NAME)) db.createObjectStore(RECOVERY_RAW_STORE_NAME,{keyPath:'id'});`,
'recovery DB upgrade');
insertBefore('www/backup.js',`  async function createRecoverySnapshot(reason) {\n`,
`  async function protectPersistentStores() {
    const storageApi=window.FabriCadabraApp?.storage;
    if (!storageApi) return [];
    const pending=storageApi.listStoresNeedingRecoveryProtection();
    if (!pending.length) return [];
    const unreadable=pending.find(store=>typeof store.raw!=='string');
    if (unreadable) throw new Error(\`\${unreadable.label} could not be read, so its original bytes cannot be protected automatically. No overwrite will be allowed.\`);
    const db=await openRecoveryDb();
    const protectedRecords=pending.map(store=>({
      id:store.id,key:store.key,label:store.label,raw:store.raw,sourceVersion:store.sourceVersion,
      currentVersion:store.currentVersion,status:store.status,reason:store.reason,createdAt:new Date().toISOString()
    }));
    try {
      await new Promise((resolve,reject)=>{
        const tx=db.transaction(RECOVERY_RAW_STORE_NAME,'readwrite');
        const objectStore=tx.objectStore(RECOVERY_RAW_STORE_NAME);
        for (const record of protectedRecords) objectStore.put(record);
        tx.oncomplete=()=>resolve();
        tx.onerror=()=>reject(tx.error || new Error('Raw persistent data recovery protection could not be saved.'));
        tx.onabort=()=>reject(tx.error || new Error('Raw persistent data recovery protection was aborted.'));
      });
    } finally { db.close(); }
    for (const record of protectedRecords) storageApi.markRecoveryProtected(record.id);
    return protectedRecords;
  }

`, 'raw store protection function');
replaceExact('www/backup.js',
`  async function createRecoverySnapshot(reason) {
    try {
      await bridge.flushPendingPersistentEdits();`,
`  async function createRecoverySnapshot(reason) {
    try {
      await protectPersistentStores();
      await bridge.flushPendingPersistentEdits();`,
'protect before full snapshot');
replaceExact('www/backup.js',
`  window.FabriCadabraRecovery={
    create:async reason=>{ await createRecoverySnapshot(reason); },
    readLatest:readLatestRecoverySnapshot
  };`,
`  window.FabriCadabraRecovery={
    create:async reason=>{ await createRecoverySnapshot(reason); },
    readLatest:readLatestRecoverySnapshot,
    protectPersistentStores
  };`,
'recovery public API');
replaceExact('www/backup.js',
`  restoreRecoveryBtn.addEventListener('click',restoreLatestRecovery);
  refreshRecoveryMeta();`,
`  restoreRecoveryBtn.addEventListener('click',restoreLatestRecovery);
  protectPersistentStores().catch(error=>console.warn('Persistent data recovery protection:',error));
  refreshRecoveryMeta();`,
'protect stores on startup');

// Existing backup E2E now expects schema v2; separate migration coverage is added by storage-migrations.spec.
replaceExact('tests/e2e/backup-restore.spec.mjs',`  expect(exported.json.schemaVersion).toBe(1);`,`  expect(exported.json.schemaVersion).toBe(2);`,'backup schema E2E');

console.log('Applied persistent storage registry, feature adapters, recovery protection, and backup schema v2.');
