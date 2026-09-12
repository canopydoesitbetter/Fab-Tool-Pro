import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root=resolve(import.meta.dirname,'..');

function patchFile(relative,replacements) {
  const path=join(root,relative);
  let source=readFileSync(path,'utf8');
  for (const {before,after,label} of replacements) {
    const count=source.split(before).length-1;
    if (count!==1) throw new Error(`${relative}: expected exactly one ${label} match, found ${count}`);
    source=source.replace(before,after);
  }
  writeFileSync(path,source);
}

patchFile('scripts/verify-shift-schedule-behavior.mjs',[
  {
    before:"const app=fs.readFileSync(path.join(root,'www','app','shift-schedule.js'),'utf8');",
    after:"const storageEngine=fs.readFileSync(path.join(root,'www','app','storage.js'),'utf8');\nconst app=fs.readFileSync(path.join(root,'www','app','shift-schedule.js'),'utf8');",
    label:'storage engine source'
  },
  {
    before:"const engineSource=app.slice(start);",
    after:"const engineSource=storageEngine+'\\n'+app.slice(start);",
    label:'combined harness source'
  }
]);

patchFile('www/app/storage.js',[
  {
    before:"  const persistentStorageIssues=new Map();\n",
    after:"  const persistentStorageIssues=new Map();\n  const PERSISTENT_STORE_ORDER=Object.freeze([\n    'taskLogJobs','taskLogPresets','shiftSchedule','fabricatorNotes','checklists','optimizerSavedJobs',\n    'theme','lastTool','quickReferenceTable','quickReferenceDisplayMode'\n  ]);\n\n  function persistentStoreOrderIndex(id) {\n    const index=PERSISTENT_STORE_ORDER.indexOf(id);\n    return index<0 ? PERSISTENT_STORE_ORDER.length : index;\n  }\n",
    label:'canonical persistent store order'
  },
  {
    before:"  function listPersistentStores() {\n    return Array.from(persistentStoreRegistry.values()).map(definition=>({\n      id:definition.id,key:definition.key,version:definition.version,encoding:definition.encoding,label:definition.label\n    }));\n  }\n",
    after:"  function listPersistentStores() {\n    return Array.from(persistentStoreRegistry.values())\n      .sort((a,b)=>persistentStoreOrderIndex(a.id)-persistentStoreOrderIndex(b.id))\n      .map(definition=>({\n        id:definition.id,key:definition.key,version:definition.version,encoding:definition.encoding,label:definition.label\n      }));\n  }\n",
    label:'ordered store enumeration'
  }
]);

const legacyBackupTest=`test('literal schema v1 full backup restores through the v2 migration path', async ({ page }) => {
  await openApp(page);
  await openSettings(page);
  const exportedAt='2026-09-01T12:00:00.000Z';
  const legacyBackup={
    format:'FabriCadabraBackup',
    schemaVersion:1,
    appVersion:'1.0.3',
    exportedAt,
    sections:{
      taskLogging:{
        jobs:{format:'FabricationTaskLogJobs',version:1,exportedAt,activeJobId:null,nextJobId:1,nextTaskId:1,jobs:[]},
        presets:{format:'FabricationTaskLogPresets',version:1,exportedAt,nextPresetId:1,presets:[]}
      },
      shiftSchedule:{
        format:'FabricationShiftSchedule',version:1,enabled:false,
        config:{startDay:1,endDay:5,clockIn:'',break:{enabled:false,time:'',durationMinutes:15},lunch:{enabled:false,time:'',durationMinutes:30},clockOut:''},
        clock:{clockedIn:false,clockedInAt:null,mode:null,shiftId:null},
        pauseOverrides:{shiftId:null,breakEnabled:null,lunchEnabled:null},policyEffectiveAt:0
      },
      fabricatorNotes:{
        format:'FabricationFabricatorNotes',version:1,activeTopicId:1,nextId:2,
        topics:[{id:1,title:'Legacy Backup Note',content:'Legacy backup note\\nSecond line',createdAt:'2026-08-01T12:00:00.000Z',updatedAt:'2026-08-02T12:00:00.000Z'}]
      },
      checklists:{
        format:'FabricationChecklist',version:1,activeTopicId:1,nextTopicId:2,nextItemId:2,
        topics:[{id:1,title:'Legacy Backup Checklist',items:[{id:1,text:'Legacy checklist item',checked:true}],createdAt:'2026-08-01T12:00:00.000Z',updatedAt:'2026-08-02T12:00:00.000Z'}]
      },
      optimizer:{savedJobs:{
        'V1-OPT':{
          format:'FabricationCutOptimizerJob',version:1,jobNumber:'V1-OPT',savedAt:'2026-08-01T12:00:00.000Z',rotate:true,nextId:2,
          parts:[{id:1,productKey:'exterior',label:'Legacy Backup Panel',finishedW:20,finishedL:30,qty:1}],cutPartIds:[]
        }
      }},
      preferences:{theme:'dark',lastTool:'tasklog',quickReferenceTable:'fraction-addition',quickReferenceDisplayMode:'fraction'}
    }
  };

  acceptNextDialog(page,'replace all Fabri-Cadabra data');
  const chooserPromise=page.waitForEvent('filechooser');
  await page.locator('#settingsRestoreBtn').click();
  const chooser=await chooserPromise;
  await chooser.setFiles({name:'literal-v1-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(legacyBackup))});

  await expect(page.locator('#tool-tasklog')).toHaveClass(/\\bactive\\b/,{timeout:15000});
  const restored=await page.evaluate(()=>({
    notes:JSON.parse(localStorage.getItem('fabricationFabricatorNotesV1') || '{}'),
    checklists:JSON.parse(localStorage.getItem('fabricationChecklistV1') || '{}'),
    optimizer:JSON.parse(localStorage.getItem('fabricationOptimizerJobsV1') || '{}'),
    shift:JSON.parse(localStorage.getItem('fabricationShiftScheduleV1') || '{}'),
    theme:localStorage.getItem('fabricationTheme'),
    lastTool:localStorage.getItem('fabricationTool'),
    table:localStorage.getItem('fabricationQuickReferenceTable'),
    display:localStorage.getItem('fabricationQuickReferenceDecimalMode')
  }));

  expect(restored.notes.version).toBe(2);
  expect(restored.notes.topics[0].title).toBe('Legacy Backup Note');
  expect(restored.notes.topics[0].contentHtml).toContain('Legacy backup note');
  expect(restored.checklists.topics[0].title).toBe('Legacy Backup Checklist');
  expect(restored.checklists.topics[0].items[0].checked).toBe(true);
  expect(restored.optimizer['V1-OPT'].version).toBe(3);
  expect(restored.optimizer['V1-OPT'].parts[0].finishedWidth).toBe(20);
  expect(restored.optimizer['V1-OPT'].parts[0].finishedHeight).toBe(30);
  expect(restored.optimizer['V1-OPT'].grainFlowRotation).toBe(false);
  expect(restored.shift.clock.clockedIn).toBe(false);
  expect(restored.theme).toBe('dark');
  expect(restored.lastTool).toBe('tasklog');
  expect(restored.table).toBe('fraction-addition');
  expect(restored.display).toBe('fraction');
});

`;

patchFile('tests/e2e/backup-restore.spec.mjs',[
  {
    before:"test('invalid or unsupported full backup changes no app-owned persistent state', async ({ page }) => {",
    after:legacyBackupTest+"test('invalid or unsupported full backup changes no app-owned persistent state', async ({ page }) => {",
    label:'literal v1 backup fixture insertion'
  }
]);

console.log('Persistence harness, canonical registry order, and legacy backup fixture are applied.');
