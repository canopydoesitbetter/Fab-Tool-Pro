import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root=resolve(import.meta.dirname,'..');
const need=(condition,message)=>{if(!condition)throw new Error(message);};
const storage=readFileSync(join(root,'www','app','storage.js'),'utf8');
const backup=readFileSync(join(root,'www','app','import-export.js'),'utf8');
const packageJson=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
const appFiles=['navigation.js','shift-schedule.js','task-logging.js','notes.js','checklist.js','quick-reference.js','sheet-optimizer.js','import-export.js']
  .map(name=>readFileSync(join(root,'www','app',name),'utf8')).join('\n');

const REQUIRED_KEYS=[
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
];

for (const marker of [
  'registerPersistentStore',
  'loadPersistentStore',
  'writePersistentStore',
  'normalizePersistentStoreValue',
  'listPersistentStores',
  'getPersistentStorageIssues',
  'listPersistentStoresNeedingRecoveryProtection',
  'markPersistentStoreRecoveryProtected'
]) need(storage.includes(marker),`Persistent storage contract: storage.js must expose ${marker}.`);

need(packageJson.scripts['verify:persistence']==='node scripts/verify-persistent-storage.mjs','Persistent storage contract: package.json must define verify:persistence.');
need(packageJson.scripts.verify.includes('verify:persistence'),'Persistent storage contract: aggregate npm run verify must include verify:persistence.');

for (const key of REQUIRED_KEYS) {
  need(appFiles.includes(key),`Persistent storage contract: registered app source must preserve stable key ${key}.`);
}

need(!backup.includes('const FABRI_CADABRA_PERSISTENCE_KEYS=Object.freeze(['),'Persistent storage contract: import-export.js must not maintain a second hard-coded persistence-key registry.');
need(backup.includes('FABRI_CADABRA_BACKUP_SCHEMA_VERSION=2'),'Persistent storage contract: full backup schema must advance to version 2.');
need(backup.includes('migrateFullBackupV1ToV2'),'Persistent storage contract: full backup schema v1 must have an explicit v1 -> v2 migration.');
need(appFiles.includes('migrateFabricatorNotesV1ToV2'),'Persistent storage contract: Fabricator Notes must expose an explicit v1 -> v2 migration.');
need(appFiles.includes('normalizeOptimizerJobRecord'),'Persistent storage contract: optimizer compatibility must keep the established normalizer.');

console.log('Persistent storage contract: OK (10 stores, migrations, recovery protection, backup schema v2)');
