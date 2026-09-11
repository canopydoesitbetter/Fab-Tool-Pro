  // ---------------- Unified Backup & Restore bridge ----------------
  const FABRI_CADABRA_BACKUP_FORMAT='FabriCadabraBackup';
  const FABRI_CADABRA_BACKUP_SCHEMA_VERSION=1;
  const FABRI_CADABRA_PERSISTENCE_KEYS=Object.freeze([
    'fabricationTaskLogJobsV1',
    'fabricationTaskLogPresetsV1',
    'fabricationShiftScheduleV1',
    'fabricationFabricatorNotesV1',
    'fabricationChecklistV1',
    'fabricationOptimizerJobsV1',
    'fabricationTheme',
    'fabricationTool',
    'fabricationQuickReferenceTable',
    'fabricationQuickReferenceDecimalMode'
  ]);

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

  function normalizeSavedOptimizerJobsDictionary(source) {
    if (source==null) return {};
    if (typeof source!=='object' || Array.isArray(source)) throw new Error('Saved Sheet Optimizer jobs are invalid.');
    const out={};
    for (const key of Object.keys(source).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'}))) {
      const record=normalizeOptimizerJobRecord(source[key]);
      if (record.jobNumber!==key) throw new Error('Saved Sheet Optimizer job '+key+' has mismatched job metadata.');
      out[key]=record;
    }
    return out;
  }

  function currentSavedOptimizerJobsForBackup() {
    const raw=storageGet(OPTIMIZER_JOBS_KEY);
    if (!raw) return {};
    let parsed;
    try { parsed=JSON.parse(raw); }
    catch (error) { throw new Error('Saved Sheet Optimizer jobs could not be read.'); }
    return normalizeSavedOptimizerJobsDictionary(parsed);
  }

  function normalizedBackupPreferences() {
    const storedTool=storageGet('fabricationTool');
    const storedTable=storageGet('fabricationQuickReferenceTable');
    const storedDisplay=storageGet(QUICK_REFERENCE_DECIMAL_KEY);
    return {
      theme:root.dataset.theme==='dark'?'dark':'light',
      lastTool:VALID_TOOLS.has(storedTool)?storedTool:DEFAULT_TOOL,
      quickReferenceTable:Object.prototype.hasOwnProperty.call(QUICK_REFERENCE_TABLES,storedTable)?storedTable:'fraction-addition',
      quickReferenceDisplayMode:storedDisplay==='decimal'?'decimal':'fraction'
    };
  }

  function buildFullBackup() {
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

  function normalizeFullBackupForRestore(raw) {
    if (!raw || typeof raw!=='object' || Array.isArray(raw)) throw new Error('The selected file is not a valid Fabri-Cadabra backup.');
    if (raw.format!==FABRI_CADABRA_BACKUP_FORMAT) throw new Error('This JSON file is not a Fabri-Cadabra full backup.');
    const schemaVersion=Number(raw.schemaVersion);
    if (!Number.isInteger(schemaVersion) || schemaVersion<1) throw new Error('The Fabri-Cadabra backup has an invalid schema version.');
    if (schemaVersion>FABRI_CADABRA_BACKUP_SCHEMA_VERSION) throw new Error('This backup was created by a newer Fabri-Cadabra backup schema and cannot be safely restored here.');
    if (typeof raw.appVersion!=='string' || !raw.appVersion.trim()) throw new Error('The Fabri-Cadabra backup is missing its app version metadata.');
    const exportedMs=Date.parse(raw.exportedAt);
    if (!Number.isFinite(exportedMs)) throw new Error('The Fabri-Cadabra backup has an invalid export timestamp.');
    const exportedAt=new Date(exportedMs).toISOString();
    const sections=raw.sections;
    if (!sections || typeof sections!=='object' || Array.isArray(sections)) throw new Error('The Fabri-Cadabra backup is missing its required sections.');
    for (const name of ['taskLogging','shiftSchedule','fabricatorNotes','checklists','optimizer','preferences']) {
      if (!Object.prototype.hasOwnProperty.call(sections,name)) throw new Error('The Fabri-Cadabra backup is missing the '+name+' section.');
    }
    if (!sections.taskLogging || typeof sections.taskLogging!=='object' || Array.isArray(sections.taskLogging)) throw new Error('The Task Logging backup section is invalid.');
    if (!Object.prototype.hasOwnProperty.call(sections.taskLogging,'jobs') || !Object.prototype.hasOwnProperty.call(sections.taskLogging,'presets')) throw new Error('The Task Logging backup section is incomplete.');
    const record=normalizeTaskLogJobsRecord(sections.taskLogging.jobs);
    record.exportedAt=exportedAt;
    finalizeImportedRunningTaskLogJobs(record);
    const presetRecord=normalizeTaskLogPresetsRecord(sections.taskLogging.presets);

    const rawShift=sections.shiftSchedule;
    if (!rawShift || typeof rawShift!=='object' || Array.isArray(rawShift)) throw new Error('The Shift Schedule backup section is invalid.');
    if (rawShift.enabled===true) {
      const candidateConfig=normalizeShiftScheduleConfig(rawShift.config || rawShift);
      const validation=validateShiftScheduleConfig(candidateConfig);
      if (!validation.ok) throw new Error('The Shift Schedule backup is invalid: '+validation.errors.join(' '));
    }
    const normalizedShift=normalizeShiftScheduleState(rawShift);
    normalizedShift.clock={clockedIn:false,clockedInAt:null,mode:null,shiftId:null};
    normalizedShift.pauseOverrides={shiftId:null,breakEnabled:null,lunchEnabled:null};
    normalizedShift.policyEffectiveAt=Date.now();

    const notesRecord=normalizeFabricatorNotesRecord(sections.fabricatorNotes);
    const checklistRecord=normalizeChecklistRecord(sections.checklists);
    if (!sections.optimizer || typeof sections.optimizer!=='object' || Array.isArray(sections.optimizer) || !Object.prototype.hasOwnProperty.call(sections.optimizer,'savedJobs')) throw new Error('The Sheet Optimizer backup section is invalid.');
    const savedJobs=normalizeSavedOptimizerJobsDictionary(sections.optimizer.savedJobs);

    const preferences=sections.preferences;
    if (!preferences || typeof preferences!=='object' || Array.isArray(preferences)) throw new Error('The preferences backup section is invalid.');
    if (!['light','dark'].includes(preferences.theme)) throw new Error('The backup contains an unsupported theme preference.');
    if (!VALID_TOOLS.has(preferences.lastTool)) throw new Error('The backup contains an unsupported last-page preference.');
    if (!Object.prototype.hasOwnProperty.call(QUICK_REFERENCE_TABLES,preferences.quickReferenceTable)) throw new Error('The backup contains an unsupported Quick Reference table preference.');
    if (!['fraction','decimal'].includes(preferences.quickReferenceDisplayMode)) throw new Error('The backup contains an unsupported Quick Reference display preference.');

    const storage={
      fabricationTaskLogJobsV1:JSON.stringify(record),
      fabricationTaskLogPresetsV1:JSON.stringify(presetRecord),
      fabricationShiftScheduleV1:JSON.stringify(normalizedShift),
      fabricationFabricatorNotesV1:JSON.stringify(notesRecord),
      fabricationChecklistV1:JSON.stringify(checklistRecord),
      fabricationOptimizerJobsV1:JSON.stringify(savedJobs),
      fabricationTheme:preferences.theme,
      fabricationTool:preferences.lastTool,
      fabricationQuickReferenceTable:preferences.quickReferenceTable,
      fabricationQuickReferenceDecimalMode:preferences.quickReferenceDisplayMode
    };
    return {storage,exportedAt,appVersion:raw.appVersion,schemaVersion};
  }

  window.FabriCadabraApp.backup={
    format:FABRI_CADABRA_BACKUP_FORMAT,
    schemaVersion:FABRI_CADABRA_BACKUP_SCHEMA_VERSION,
    persistenceKeys:FABRI_CADABRA_PERSISTENCE_KEYS,
    flushPendingPersistentEdits,
    buildFullBackup,
    normalizeFullBackupForRestore
  };

