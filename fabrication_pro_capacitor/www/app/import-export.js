  // ---------------- Unified Backup & Restore bridge ----------------
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
    if (result.status==='invalid' || result.status==='unsupported') throw result.error || new Error(`The backup contains invalid ${definition.label} data.`);
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

