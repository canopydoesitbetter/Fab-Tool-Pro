import { test, expect } from '@playwright/test';
import { openApp } from './helpers.mjs';

const STORE_IDS=[
  'taskLogJobs',
  'taskLogPresets',
  'shiftSchedule',
  'fabricatorNotes',
  'checklists',
  'optimizerSavedJobs',
  'theme',
  'lastTool',
  'quickReferenceTable',
  'quickReferenceDisplayMode'
];

const STRUCTURED_STORE_IDS=[
  'taskLogJobs',
  'taskLogPresets',
  'shiftSchedule',
  'fabricatorNotes',
  'checklists',
  'optimizerSavedJobs'
];

async function readRawRecoveryRecord(page,id) {
  return page.evaluate(id=>new Promise((resolve,reject)=>{
    const request=indexedDB.open('FabriCadabraRecovery',2);
    request.onerror=()=>reject(request.error || new Error('Recovery DB could not be opened.'));
    request.onsuccess=()=>{
      const db=request.result;
      if (!db.objectStoreNames.contains('rawStores')) {
        db.close();
        resolve(null);
        return;
      }
      const tx=db.transaction('rawStores','readonly');
      const get=tx.objectStore('rawStores').get(id);
      get.onerror=()=>reject(get.error || new Error('Raw recovery record could not be read.'));
      get.onsuccess=()=>resolve(get.result || null);
      tx.oncomplete=()=>db.close();
      tx.onerror=()=>reject(tx.error || new Error('Raw recovery transaction failed.'));
    };
  }),id);
}

test('persistent storage registry owns all app stores and missing data stays missing', async ({ page }) => {
  await page.addInitScript(()=>localStorage.clear());
  await openApp(page);
  const snapshot=await page.evaluate(()=>{
    const storage=window.FabriCadabraApp?.storage;
    return {
      ids:storage?.listStores?.().map(store=>store.id),
      raw:Object.fromEntries(storage?.listStores?.().map(store=>[store.key,localStorage.getItem(store.key)]) || []),
      issues:storage?.getIssues?.()
    };
  });
  expect(snapshot.ids).toEqual(STORE_IDS);
  expect(snapshot.issues).toEqual([]);
  for (const value of Object.values(snapshot.raw)) expect(value).toBeNull();
});

test('current structured stores round-trip through the central registry', async ({ page }) => {
  await page.addInitScript(()=>localStorage.clear());
  await openApp(page);
  const results=await page.evaluate(ids=>{
    const storage=window.FabriCadabraApp.storage;
    return ids.map(id=>{
      const missing=storage.load(id);
      storage.write(id,missing.value);
      const current=storage.load(id);
      const definition=storage.getStore(id);
      return {id,status:current.status,raw:localStorage.getItem(definition.key)};
    });
  },STRUCTURED_STORE_IDS);
  expect(results.map(result=>result.id)).toEqual(STRUCTURED_STORE_IDS);
  for (const result of results) {
    expect(result.status,`${result.id} should reload as current`).toBe('current');
    expect(result.raw,`${result.id} should have serialized current data`).not.toBeNull();
  }
});

test('legacy Fabricator Notes v1 migrates in memory, protects original bytes, then saves v2', async ({ page }) => {
  const legacy={
    format:'FabricationFabricatorNotes',
    version:1,
    activeTopicId:7,
    nextId:8,
    topics:[{
      id:7,
      title:'Legacy note',
      content:'Line one\nLine two',
      createdAt:'2026-08-01T12:00:00.000Z',
      updatedAt:'2026-08-02T12:00:00.000Z'
    }]
  };
  const raw=JSON.stringify(legacy);
  await page.addInitScript(({raw})=>localStorage.setItem('fabricationFabricatorNotesV1',raw),{raw});
  await openApp(page);
  const migrated=await page.evaluate(async ()=>{
    const storage=window.FabriCadabraApp.storage;
    const loaded=storage.load('fabricatorNotes');
    await window.FabriCadabraRecovery.protectPersistentStores();
    const before=localStorage.getItem('fabricationFabricatorNotesV1');
    const pending=storage.listStoresNeedingRecoveryProtection().some(store=>store.id==='fabricatorNotes');
    storage.write('fabricatorNotes',loaded.value);
    const after=localStorage.getItem('fabricationFabricatorNotesV1');
    return {loaded,before,pending,after};
  });
  const recovery=await readRawRecoveryRecord(page,'fabricatorNotes');
  expect(migrated.loaded.status).toBe('migrated');
  expect(migrated.loaded.sourceVersion).toBe(1);
  expect(migrated.loaded.currentVersion).toBe(2);
  expect(migrated.loaded.value.topics[0].contentHtml).toContain('Line one');
  expect(migrated.loaded.value.topics[0].contentHtml).toContain('<br>');
  expect(migrated.before).toBe(raw);
  expect(migrated.pending).toBe(false);
  expect(recovery?.raw).toBe(raw);
  expect(recovery?.reason).toBe('before-schema-upgrade');
  expect(JSON.parse(migrated.after).version).toBe(2);
});

test('mixed legacy Sheet Optimizer v1/v2 jobs migrate to current v3 semantics without startup rewrite', async ({ page }) => {
  const legacyJobs={
    'OLD-1':{
      format:'FabricationCutOptimizerJob',version:1,jobNumber:'OLD-1',savedAt:'2026-08-01T12:00:00.000Z',rotate:true,nextId:2,
      parts:[{id:1,productKey:'exterior',label:'Legacy v1',finishedW:20,finishedL:30,qty:1}],cutPartIds:[]
    },
    'OLD-2':{
      format:'FabricationCutOptimizerJob',version:2,jobNumber:'OLD-2',savedAt:'2026-08-02T12:00:00.000Z',rotate:false,nextId:2,
      parts:[{id:1,productKey:'door',label:'Legacy v2',finishedWidth:22,finishedHeight:32,qty:1}],cutPartIds:[]
    }
  };
  const raw=JSON.stringify(legacyJobs);
  await page.addInitScript(({raw})=>localStorage.setItem('fabricationOptimizerJobsV1',raw),{raw});
  await openApp(page);
  const result=await page.evaluate(()=>{
    const loaded=window.FabriCadabraApp.storage.load('optimizerSavedJobs');
    return {loaded,raw:localStorage.getItem('fabricationOptimizerJobsV1')};
  });
  expect(result.loaded.status).toBe('migrated');
  expect(result.loaded.sourceVersion).toBe(1);
  expect(result.loaded.currentVersion).toBe(3);
  expect(result.loaded.value['OLD-1'].version).toBe(3);
  expect(result.loaded.value['OLD-1'].parts[0].finishedWidth).toBe(20);
  expect(result.loaded.value['OLD-1'].parts[0].finishedHeight).toBe(30);
  expect(result.loaded.value['OLD-1'].grainFlowRotation).toBe(false);
  expect(result.loaded.value['OLD-2'].version).toBe(3);
  expect(result.loaded.value['OLD-2'].parts[0].finishedWidth).toBe(22);
  expect(result.loaded.value['OLD-2'].parts[0].finishedHeight).toBe(32);
  expect(result.loaded.value['OLD-2'].grainFlowRotation).toBe(true);
  expect(result.raw).toBe(raw);
});

test('corrupt structured data is retained, reported, and copied byte-for-byte into raw recovery', async ({ page }) => {
  const corrupt='{not-json';
  await page.addInitScript(({corrupt})=>localStorage.setItem('fabricationChecklistV1',corrupt),{corrupt});
  await openApp(page);
  const result=await page.evaluate(async ()=>{
    const storage=window.FabriCadabraApp.storage;
    const loaded=storage.load('checklists');
    await window.FabriCadabraRecovery.protectPersistentStores();
    return {
      status:loaded.status,
      raw:localStorage.getItem('fabricationChecklistV1'),
      issues:storage.getIssues().filter(issue=>issue.id==='checklists')
    };
  });
  const recovery=await readRawRecoveryRecord(page,'checklists');
  expect(result.status).toBe('invalid');
  expect(result.raw).toBe(corrupt);
  expect(result.issues).toHaveLength(1);
  expect(recovery?.raw).toBe(corrupt);
  expect(recovery?.reason).toBe('before-invalid-data-overwrite');
});

test('future store schema stays untouched and overwrite is blocked when recovery protection fails', async ({ page }) => {
  const future=JSON.stringify({format:'FabricationChecklist',version:99,activeTopicId:null,nextTopicId:1,nextItemId:1,topics:[]});
  await page.addInitScript(({future})=>{
    localStorage.setItem('fabricationChecklistV1',future);
    Object.defineProperty(window,'indexedDB',{configurable:true,value:undefined});
  },{future});
  await openApp(page);
  const result=await page.evaluate(()=>{
    const storage=window.FabriCadabraApp.storage;
    const loaded=storage.load('checklists');
    let message='';
    try { storage.write('checklists',{format:'FabricationChecklist',version:1,activeTopicId:null,nextTopicId:1,nextItemId:1,topics:[]}); }
    catch (error) { message=String(error?.message || error); }
    return {
      status:loaded.status,
      raw:localStorage.getItem('fabricationChecklistV1'),
      message,
      pending:storage.listStoresNeedingRecoveryProtection().some(store=>store.id==='checklists')
    };
  });
  expect(result.status).toBe('unsupported');
  expect(result.raw).toBe(future);
  expect(result.pending).toBe(true);
  expect(result.message).toContain('recovery');
});
