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

test('legacy Fabricator Notes v1 migrates in memory without rewriting original bytes', async ({ page }) => {
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
  const result=await page.evaluate(()=>{
    const storage=window.FabriCadabraApp.storage;
    const loaded=storage.load('fabricatorNotes');
    return {
      status:loaded.status,
      sourceVersion:loaded.sourceVersion,
      currentVersion:loaded.currentVersion,
      raw:localStorage.getItem('fabricationFabricatorNotesV1'),
      value:loaded.value,
      needsProtection:storage.listStoresNeedingRecoveryProtection().some(store=>store.id==='fabricatorNotes')
    };
  });
  expect(result.status).toBe('migrated');
  expect(result.sourceVersion).toBe(1);
  expect(result.currentVersion).toBe(2);
  expect(result.raw).toBe(raw);
  expect(result.value.topics[0].contentHtml).toContain('Line one');
  expect(result.value.topics[0].contentHtml).toContain('<br>');
  expect(result.needsProtection).toBe(true);
});

test('corrupt structured data is retained and reported instead of silently discarded', async ({ page }) => {
  const corrupt='{not-json';
  await page.addInitScript(({corrupt})=>localStorage.setItem('fabricationChecklistV1',corrupt),{corrupt});
  await openApp(page);
  const result=await page.evaluate(()=>{
    const storage=window.FabriCadabraApp.storage;
    const loaded=storage.load('checklists');
    return {
      status:loaded.status,
      raw:localStorage.getItem('fabricationChecklistV1'),
      issues:storage.getIssues().filter(issue=>issue.id==='checklists'),
      protection:storage.listStoresNeedingRecoveryProtection().some(store=>store.id==='checklists')
    };
  });
  expect(result.status).toBe('invalid');
  expect(result.raw).toBe(corrupt);
  expect(result.issues).toHaveLength(1);
  expect(result.protection).toBe(true);
});

test('future store schema is retained and cannot be overwritten before recovery protection', async ({ page }) => {
  const future=JSON.stringify({format:'FabricationChecklist',version:99,activeTopicId:null,nextTopicId:1,nextItemId:1,topics:[]});
  await page.addInitScript(({future})=>localStorage.setItem('fabricationChecklistV1',future),{future});
  await openApp(page);
  const result=await page.evaluate(()=>{
    const storage=window.FabriCadabraApp.storage;
    const loaded=storage.load('checklists');
    let message='';
    try { storage.write('checklists',{format:'FabricationChecklist',version:1,activeTopicId:null,nextTopicId:1,nextItemId:1,topics:[]}); }
    catch (error) { message=String(error?.message || error); }
    return {status:loaded.status,raw:localStorage.getItem('fabricationChecklistV1'),message};
  });
  expect(result.status).toBe('unsupported');
  expect(result.raw).toBe(future);
  expect(result.message).toContain('recovery');
});
