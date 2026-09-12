(() => {
  'use strict';

  const bridge=window.FabriCadabraApp && window.FabriCadabraApp.backup;
  const backupBtn=document.getElementById('settingsBackupBtn');
  const restoreBtn=document.getElementById('settingsRestoreBtn');
  const restoreFile=document.getElementById('settingsBackupRestoreFile');
  const restoreRecoveryBtn=document.getElementById('settingsRestoreRecoveryBtn');
  const status=document.getElementById('settingsBackupStatus');
  const recoveryMeta=document.getElementById('settingsRecoveryMeta');
  const MAX_BACKUP_IMPORT_BYTES=16*1024*1024;
  const RECOVERY_DB_NAME='FabriCadabraRecovery';
  const RECOVERY_DB_VERSION=2;
  const RECOVERY_STORE_NAME='snapshots';
  const RECOVERY_RAW_STORE_NAME='rawStores';
  const RECOVERY_LATEST_ID='latest';

  if (!bridge || !backupBtn || !restoreBtn || !restoreFile || !restoreRecoveryBtn || !status || !recoveryMeta) return;

  function showStatus(message,type='ok') {
    status.textContent=message;
    status.className='status show '+type;
  }

  function clearStatus() {
    status.textContent='';
    status.className='status';
  }

  function downloadJson(filename,payload) {
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement('a');
    anchor.href=url;
    anchor.download=filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  function readJsonFile(file) {
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>{
        try { resolve(JSON.parse(String(reader.result || ''))); }
        catch (error) { reject(new Error('The selected file is not valid JSON.')); }
      };
      reader.onerror=()=>reject(new Error('The selected backup file could not be read.'));
      reader.readAsText(file);
    });
  }

  function openRecoveryDb() {
    return new Promise((resolve,reject)=>{
      if (!window.indexedDB) { reject(new Error('IndexedDB is not available on this device.')); return; }
      const request=indexedDB.open(RECOVERY_DB_NAME,RECOVERY_DB_VERSION);
      request.onupgradeneeded=()=>{
        const db=request.result;
        if (!db.objectStoreNames.contains(RECOVERY_STORE_NAME)) db.createObjectStore(RECOVERY_STORE_NAME,{keyPath:'id'});
        if (!db.objectStoreNames.contains(RECOVERY_RAW_STORE_NAME)) db.createObjectStore(RECOVERY_RAW_STORE_NAME,{keyPath:'id'});
      };
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error || new Error('Recovery storage could not be opened.'));
    });
  }

  async function writeRecoverySnapshot(backup,reason) {
    const db=await openRecoveryDb();
    try {
      const record={id:RECOVERY_LATEST_ID,createdAt:new Date().toISOString(),reason:String(reason || 'protected-operation'),backup};
      await new Promise((resolve,reject)=>{
        const tx=db.transaction(RECOVERY_STORE_NAME,'readwrite');
        tx.objectStore(RECOVERY_STORE_NAME).put(record);
        tx.oncomplete=()=>resolve();
        tx.onerror=()=>reject(tx.error || new Error('Recovery snapshot could not be saved.'));
        tx.onabort=()=>reject(tx.error || new Error('Recovery snapshot save was aborted.'));
      });
      return record;
    } finally { db.close(); }
  }

  async function readLatestRecoverySnapshot() {
    const db=await openRecoveryDb();
    try {
      return await new Promise((resolve,reject)=>{
        const tx=db.transaction(RECOVERY_STORE_NAME,'readonly');
        const request=tx.objectStore(RECOVERY_STORE_NAME).get(RECOVERY_LATEST_ID);
        request.onsuccess=()=>resolve(request.result || null);
        request.onerror=()=>reject(request.error || new Error('Recovery snapshot could not be read.'));
      });
    } finally { db.close(); }
  }

  function recoveryReasonLabel(reason) {
    const labels={
      'before-full-restore':'before full restore',
      'before-task-jobs-import':'before Task Logging Jobs import',
      'before-task-presets-import':'before Task Logging Presets import',
      'before-notes-import':'before Fabricator Notes import',
      'before-checklist-import':'before Checklist import',
      'before-optimizer-import':'before Sheet Optimizer saved-job replacement',
      'before-recovery-restore':'before recovery restore'
    };
    return labels[reason] || String(reason || 'protected operation');
  }

  async function refreshRecoveryMeta(record) {
    let snapshot=record;
    if (snapshot===undefined) {
      try { snapshot=await readLatestRecoverySnapshot(); }
      catch (error) { snapshot=null; }
    }
    restoreRecoveryBtn.disabled=!snapshot;
    if (!snapshot) {
      recoveryMeta.textContent='No automatic recovery snapshot is available yet.';
      recoveryMeta.removeAttribute('data-recovery-reason');
      return;
    }
    const created=new Date(snapshot.createdAt);
    recoveryMeta.textContent='Latest recovery: '+(Number.isFinite(created.getTime())?created.toLocaleString():snapshot.createdAt)+' — '+recoveryReasonLabel(snapshot.reason)+'.';
    recoveryMeta.setAttribute('data-recovery-reason',snapshot.reason);
  }

  async function protectPersistentStores() {
    const storageApi=window.FabriCadabraApp?.storage;
    if (!storageApi) return [];
    const pending=storageApi.listStoresNeedingRecoveryProtection();
    if (!pending.length) return [];
    const unreadable=pending.find(store=>typeof store.raw!=='string');
    if (unreadable) throw new Error(`${unreadable.label} could not be read, so its original bytes cannot be protected automatically. No overwrite will be allowed.`);
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

  async function createRecoverySnapshot(reason) {
    try {
      await protectPersistentStores();
      await bridge.flushPendingPersistentEdits();
      const backup=bridge.buildFullBackup();
      const record=await writeRecoverySnapshot(backup,reason);
      await refreshRecoveryMeta(record);
      return record;
    } catch (error) {
      throw new Error('Automatic recovery protection could not be created. '+(error && error.message ? error.message : 'Create a manual full backup before retrying.')+' Create a manual full backup before retrying.');
    }
  }

  function transactionalReplaceAppStorage(replacement) {
    const keys=Array.from(bridge.persistenceKeys);
    const before={};
    for (const key of keys) before[key]=localStorage.getItem(key);
    let rollback=false;
    try {
      for (const key of keys) {
        const value=Object.prototype.hasOwnProperty.call(replacement,key)?replacement[key]:null;
        if (value==null) localStorage.removeItem(key);
        else localStorage.setItem(key,String(value));
      }
      return true;
    } catch (error) {
      rollback=true;
      const rollbackErrors=[];
      for (const key of keys) {
        try {
          if (before[key]==null) localStorage.removeItem(key);
          else localStorage.setItem(key,before[key]);
        } catch (rollbackError) { rollbackErrors.push(key); }
      }
      const suffix=rollbackErrors.length?' Rollback could not restore: '+rollbackErrors.join(', ')+'.':'';
      const wrapped=new Error('Restore could not be committed, so the previous app data was restored where possible.'+suffix);
      wrapped.cause=error;
      wrapped.rollback=rollback;
      throw wrapped;
    }
  }

  async function backupAllData() {
    clearStatus();
    try {
      await window.FabriCadabraApp.backup.flushPendingPersistentEdits();
      const payload=bridge.buildFullBackup();
      downloadJson('Fabri-Cadabra-Backup-'+payload.exportedAt.slice(0,10)+'.json',payload);
      showStatus('Fabri-Cadabra full backup created. Keep the JSON file somewhere safe.','ok');
    } catch (error) {
      showStatus(error && error.message ? error.message : 'Unable to create a Fabri-Cadabra backup.','error');
    }
  }

  async function restoreBackupFile(file) {
    if (!file) return;
    clearStatus();
    try {
      if (file.size>MAX_BACKUP_IMPORT_BYTES) throw new Error('That Fabri-Cadabra backup is too large. Maximum restore size is 16 MiB.');
      const parsed=await readJsonFile(file);
      const normalized=bridge.normalizeFullBackupForRestore(parsed);
      if (!window.confirm('Restore this backup and replace all Fabri-Cadabra data currently saved on this device? An automatic recovery snapshot will be created first.')) return;
      await createRecoverySnapshot('before-full-restore');
      transactionalReplaceAppStorage(normalized.storage);
      showStatus('Fabri-Cadabra backup restored. Reloading the app…','ok');
      window.location.reload();
    } catch (error) {
      showStatus(error && error.message ? error.message : 'Unable to restore that Fabri-Cadabra backup.','error');
    } finally { restoreFile.value=''; }
  }

  async function restoreLatestRecovery() {
    clearStatus();
    try {
      const snapshot=await readLatestRecoverySnapshot();
      if (!snapshot || !snapshot.backup) throw new Error('No automatic recovery snapshot is available.');
      const normalized=bridge.normalizeFullBackupForRestore(snapshot.backup);
      if (!window.confirm('This will restore the last recovery snapshot and replace all Fabri-Cadabra data currently saved on this device. Continue?')) return;
      await bridge.flushPendingPersistentEdits();
      const currentBackup=bridge.buildFullBackup();
      await writeRecoverySnapshot(currentBackup,'before-recovery-restore');
      transactionalReplaceAppStorage(normalized.storage);
      showStatus('Recovery snapshot restored. Reloading the app…','ok');
      window.location.reload();
    } catch (error) {
      showStatus(error && error.message ? error.message : 'Unable to restore the recovery snapshot.','error');
      await refreshRecoveryMeta();
    }
  }

  window.FabriCadabraRecovery={
    create:async reason=>{ await createRecoverySnapshot(reason); },
    readLatest:readLatestRecoverySnapshot,
    protectPersistentStores
  };

  backupBtn.addEventListener('click',backupAllData);
  restoreBtn.addEventListener('click',()=>restoreFile.click());
  restoreFile.addEventListener('change',()=>restoreBackupFile(restoreFile.files && restoreFile.files[0]));
  restoreRecoveryBtn.addEventListener('click',restoreLatestRecovery);
  protectPersistentStores().catch(error=>console.warn('Persistent data recovery protection:',error));
  refreshRecoveryMeta();
})();
