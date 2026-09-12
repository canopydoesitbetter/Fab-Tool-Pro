  const persistentStoreRegistry=new Map();
  const persistentStoreState=new Map();
  const persistentStorageIssues=new Map();
  const PERSISTENT_STORE_ORDER=Object.freeze([
    'taskLogJobs','taskLogPresets','shiftSchedule','fabricatorNotes','checklists','optimizerSavedJobs',
    'theme','lastTool','quickReferenceTable','quickReferenceDisplayMode'
  ]);

  function persistentStoreOrderIndex(id) {
    const index=PERSISTENT_STORE_ORDER.indexOf(id);
    return index<0 ? PERSISTENT_STORE_ORDER.length : index;
  }

  function persistentStoreDefinition(id) {
    const definition=persistentStoreRegistry.get(String(id || ''));
    if (!definition) throw new Error(`Unknown persistent data store: ${id || 'missing'}.`);
    return definition;
  }

  function persistentStoreDefault(definition) {
    return definition.defaultValue();
  }

  function persistentStoreIssue(id,status,error) {
    const definition=persistentStoreDefinition(id);
    const issue={
      id:definition.id,
      key:definition.key,
      label:definition.label,
      status,
      message:String(error && error.message ? error.message : error || `${definition.label} could not be read.`)
    };
    persistentStorageIssues.set(definition.id,issue);
    return issue;
  }

  function registerPersistentStore(definition) {
    if (!definition || typeof definition!=='object' || Array.isArray(definition)) throw new Error('Persistent store definition must be an object.');
    const id=String(definition.id || '').trim();
    const key=String(definition.key || '').trim();
    const version=Number(definition.version);
    const encoding=definition.encoding || 'json';
    if (!id || !key) throw new Error('Persistent store definitions require id and key.');
    if (persistentStoreRegistry.has(id)) throw new Error(`Persistent store id ${id} is already registered.`);
    if (Array.from(persistentStoreRegistry.values()).some(item=>item.key===key)) throw new Error(`Persistent storage key ${key} is already registered.`);
    if (!Number.isInteger(version) || version<1) throw new Error(`Persistent store ${id} has an invalid schema version.`);
    if (!['json','string'].includes(encoding)) throw new Error(`Persistent store ${id} has an unsupported encoding.`);
    if (typeof definition.defaultValue!=='function' || typeof definition.normalize!=='function') throw new Error(`Persistent store ${id} requires defaultValue and normalize functions.`);
    const migrations=definition.migrations && typeof definition.migrations==='object' ? {...definition.migrations} : {};
    for (let source=1;source<version;source+=1) {
      if (typeof migrations[source]!=='function') throw new Error(`Persistent store ${id} is missing migration ${source} -> ${source+1}.`);
    }
    const registered=Object.freeze({
      id,key,version,encoding,
      label:String(definition.label || id),
      defaultValue:definition.defaultValue,
      getVersion:typeof definition.getVersion==='function' ? definition.getVersion : (()=>1),
      migrations:Object.freeze(migrations),
      normalize:definition.normalize,
      serialize:typeof definition.serialize==='function'
        ? definition.serialize
        : (encoding==='json' ? value=>JSON.stringify(value) : value=>String(value))
    });
    persistentStoreRegistry.set(id,registered);
    return registered;
  }

  function normalizePersistentStoreValue(id,rawValue,options={}) {
    const definition=persistentStoreDefinition(id);
    if (rawValue==null) {
      return {
        id:definition.id,key:definition.key,status:'missing',value:persistentStoreDefault(definition),raw:null,
        sourceVersion:null,currentVersion:definition.version,migratedFrom:null,error:null
      };
    }
    const raw=String(rawValue);
    let decoded;
    try {
      decoded=definition.encoding==='json' ? JSON.parse(raw) : raw;
    } catch (error) {
      return {
        id:definition.id,key:definition.key,status:'invalid',value:persistentStoreDefault(definition),raw,
        sourceVersion:null,currentVersion:definition.version,migratedFrom:null,error
      };
    }
    let sourceVersion;
    try { sourceVersion=Number(definition.getVersion(decoded)); }
    catch (error) {
      return {
        id:definition.id,key:definition.key,status:'invalid',value:persistentStoreDefault(definition),raw,
        sourceVersion:null,currentVersion:definition.version,migratedFrom:null,error
      };
    }
    if (!Number.isInteger(sourceVersion) || sourceVersion<1) {
      return {
        id:definition.id,key:definition.key,status:'invalid',value:persistentStoreDefault(definition),raw,
        sourceVersion,currentVersion:definition.version,migratedFrom:null,error:new Error(`${definition.label} has an invalid schema version.`)
      };
    }
    if (sourceVersion>definition.version) {
      return {
        id:definition.id,key:definition.key,status:'unsupported',value:persistentStoreDefault(definition),raw,
        sourceVersion,currentVersion:definition.version,migratedFrom:null,error:new Error(`${definition.label} was saved by a newer unsupported schema version.`)
      };
    }
    let candidate=decoded;
    let currentVersion=sourceVersion;
    try {
      while (currentVersion<definition.version) {
        const migration=definition.migrations[currentVersion];
        if (typeof migration!=='function') throw new Error(`${definition.label} cannot migrate schema ${currentVersion} to ${currentVersion+1}.`);
        candidate=migration(candidate,{fromVersion:currentVersion,toVersion:currentVersion+1});
        currentVersion+=1;
      }
      candidate=definition.normalize(candidate,{sourceVersion,currentVersion:definition.version,fromImport:options.fromImport===true});
    } catch (error) {
      return {
        id:definition.id,key:definition.key,status:'invalid',value:persistentStoreDefault(definition),raw,
        sourceVersion,currentVersion:definition.version,migratedFrom:null,error
      };
    }
    return {
      id:definition.id,key:definition.key,status:sourceVersion<definition.version?'migrated':'current',value:candidate,raw,
      sourceVersion,currentVersion:definition.version,migratedFrom:sourceVersion<definition.version?sourceVersion:null,error:null
    };
  }

  function loadPersistentStore(id) {
    const definition=persistentStoreDefinition(id);
    let raw;
    try { raw=localStorage.getItem(definition.key); }
    catch (error) {
      const result={
        id:definition.id,key:definition.key,status:'invalid',value:persistentStoreDefault(definition),raw:null,
        sourceVersion:null,currentVersion:definition.version,migratedFrom:null,error
      };
      persistentStoreState.set(definition.id,{...result,recoveryProtected:false,requiresRecoveryProtection:true});
      persistentStoreIssue(definition.id,'invalid',error);
      return result;
    }
    const result=normalizePersistentStoreValue(definition.id,raw);
    const risky=['migrated','invalid','unsupported'].includes(result.status);
    const previous=persistentStoreState.get(definition.id);
    const recoveryProtected=!!(risky && previous?.recoveryProtected && previous.raw===result.raw && previous.status===result.status);
    persistentStoreState.set(definition.id,{...result,recoveryProtected,requiresRecoveryProtection:risky});
    if (result.status==='invalid' || result.status==='unsupported') persistentStoreIssue(definition.id,result.status,result.error);
    else persistentStorageIssues.delete(definition.id);
    return result;
  }

  function writePersistentStore(id,value,options={}) {
    const definition=persistentStoreDefinition(id);
    const state=persistentStoreState.get(definition.id);
    if (state?.requiresRecoveryProtection && !state.recoveryProtected && options.recoveryProtected!==true) {
      throw new Error(`${definition.label} cannot overwrite older or unreadable saved data until a recovery copy is protected.`);
    }
    let normalized;
    try { normalized=definition.normalize(value,{sourceVersion:definition.version,currentVersion:definition.version,fromImport:options.fromImport===true}); }
    catch (error) { throw new Error(`${definition.label} could not be saved: ${error && error.message ? error.message : 'invalid data'}`); }
    const serialized=definition.serialize(normalized);
    try { localStorage.setItem(definition.key,String(serialized)); }
    catch (error) { throw new Error(`${definition.label} could not be saved on this device.`); }
    persistentStoreState.set(definition.id,{
      id:definition.id,key:definition.key,status:'current',value:normalized,raw:String(serialized),sourceVersion:definition.version,
      currentVersion:definition.version,migratedFrom:null,error:null,recoveryProtected:false,requiresRecoveryProtection:false
    });
    persistentStorageIssues.delete(definition.id);
    return normalized;
  }

  function getPersistentStoreDefinition(id) {
    return persistentStoreDefinition(id);
  }

  function listPersistentStores() {
    return Array.from(persistentStoreRegistry.values())
      .sort((a,b)=>persistentStoreOrderIndex(a.id)-persistentStoreOrderIndex(b.id))
      .map(definition=>({
        id:definition.id,key:definition.key,version:definition.version,encoding:definition.encoding,label:definition.label
      }));
  }

  function getPersistentStorageIssues() {
    return Array.from(persistentStorageIssues.values()).map(issue=>({...issue}));
  }

  function listPersistentStoresNeedingRecoveryProtection() {
    const stores=[];
    for (const [id,state] of persistentStoreState.entries()) {
      if (!state.requiresRecoveryProtection || state.recoveryProtected) continue;
      const definition=persistentStoreDefinition(id);
      stores.push({
        id,key:definition.key,label:definition.label,status:state.status,raw:state.raw,
        sourceVersion:state.sourceVersion,currentVersion:definition.version,
        reason:state.status==='migrated'?'before-schema-upgrade':'before-invalid-data-overwrite'
      });
    }
    return stores;
  }

  function markPersistentStoreRecoveryProtected(id) {
    const definition=persistentStoreDefinition(id);
    const state=persistentStoreState.get(definition.id);
    if (!state || !state.requiresRecoveryProtection) return false;
    state.recoveryProtected=true;
    persistentStoreState.set(definition.id,state);
    return true;
  }

  function serializePersistentStoreValue(id,value) {
    const definition=persistentStoreDefinition(id);
    const normalized=definition.normalize(value,{sourceVersion:definition.version,currentVersion:definition.version,fromImport:true});
    return String(definition.serialize(normalized));
  }

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function storageSet(key,value) {
    try { localStorage.setItem(key,value); return true; } catch (e) { return false; }
  }

  const persistentStoragePublicApi=Object.freeze({
    register:registerPersistentStore,
    load:loadPersistentStore,
    write:writePersistentStore,
    normalize:normalizePersistentStoreValue,
    serialize:serializePersistentStoreValue,
    getStore:getPersistentStoreDefinition,
    listStores:listPersistentStores,
    getIssues:getPersistentStorageIssues,
    listStoresNeedingRecoveryProtection:listPersistentStoresNeedingRecoveryProtection,
    markRecoveryProtected:markPersistentStoreRecoveryProtected
  });

