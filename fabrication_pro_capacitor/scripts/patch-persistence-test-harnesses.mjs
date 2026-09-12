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

console.log('Persistence harness uses the real storage engine and registry enumeration is canonical.');
