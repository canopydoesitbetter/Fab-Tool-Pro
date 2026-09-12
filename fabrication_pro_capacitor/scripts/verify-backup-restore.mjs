import { APP_MODULES, readAppSource } from './app-module-manifest.mjs';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root=process.cwd();
const need=(condition,message)=>{if(!condition)throw new Error(message);};
const html=readFileSync(join(root,'www','index.html'),'utf8');
const app=readAppSource(root);
const styles=readFileSync(join(root,'www','styles.css'),'utf8');
const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
const backupPath=join(root,'www','backup.js');

need(existsSync(backupPath),'Unified backup subsystem is missing: www/backup.js');
const backup=readFileSync(backupPath,'utf8');

need(app.includes("const FABRI_CADABRA_BACKUP_FORMAT='FabriCadabraBackup';"),'Backup format constant must be canonical in app.js.');
need(app.includes('const FABRI_CADABRA_BACKUP_SCHEMA_VERSION=1;'),'Backup schema version 1 must be canonical in app.js.');

const registryMatch=app.match(/const FABRI_CADABRA_PERSISTENCE_KEYS=Object\.freeze\(\[([\s\S]*?)\]\);/);
need(registryMatch,'Authoritative persistence-key registry is missing from app.js.');
const registry=[...registryMatch[1].matchAll(/'([^']+)'/g)].map(match=>match[1]);
const expected=[
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
need(registry.length===expected.length,`Backup registry must contain exactly ${expected.length} keys; found ${registry.length}.`);
need(JSON.stringify(registry)===JSON.stringify(expected),`Backup registry changed or is out of order. Expected ${expected.join(', ')}; got ${registry.join(', ')}.`);
need(new Set(registry).size===registry.length,'Backup registry contains duplicate keys.');

for(const id of ['settingsDataBackupCard','settingsBackupBtn','settingsRestoreBtn','settingsBackupRestoreFile','settingsRestoreRecoveryBtn','settingsBackupStatus','settingsRecoveryMeta']) {
  need(html.includes(`id='${id}'`) || html.includes(`id="${id}"`),`Settings Data & Backup markup missing ${id}.`);
}
need(html.includes('Backup Fabri-Cadabra'),'Settings must expose Backup Fabri-Cadabra.');
need(html.includes('Restore Fabri-Cadabra Backup'),'Settings must expose Restore Fabri-Cadabra Backup.');
need(html.includes('Restore Last Recovery Snapshot'),'Settings must expose recovery restore.');
need(styles.includes('.settings-data-backup'),'Settings Data & Backup styles are missing.');
need(styles.includes('.settings-backup-actions'),'Settings backup action layout is missing.');

const appIndex=Math.max(...APP_MODULES.map(src=>html.indexOf(`<script src="${src}" defer></script>`)));
const backupIndex=html.indexOf('<script src="backup.js" defer></script>');
need(appIndex>=0 && APP_MODULES.every(src=>html.includes(`<script src="${src}" defer></script>`)) && backupIndex>appIndex,'backup.js must load after all app feature modules.');
need(!/localStorage\.clear\s*\(/.test(app+backup),'Unified backup/restore must never call localStorage.clear().');

for(const marker of ['buildFullBackup','normalizeFullBackupForRestore','flushPendingPersistentEdits','persistenceKeys']) {
  need(app.includes(marker),`FabriCadabraApp backup bridge missing ${marker}.`);
}
need(app.includes('window.FabriCadabraApp.backup='),'Backup bridge must be exposed under window.FabriCadabraApp.backup.');
need(app.includes('finalizeImportedRunningTaskLogJobs(record)'),'Full restore must reuse the existing safe running-timer finalization path.');
need(app.includes('normalizedShift.clock={clockedIn:false,clockedInAt:null,mode:null,shiftId:null}'),'Shift restore must sanitize historical clock-in state.');
need(app.includes('normalizedShift.pauseOverrides={shiftId:null,breakEnabled:null,lunchEnabled:null}'),'Shift restore must clear historical pause overrides.');

for(const marker of [
  "const RECOVERY_DB_NAME='FabriCadabraRecovery'",
  "const RECOVERY_STORE_NAME='snapshots'",
  "const RECOVERY_LATEST_ID='latest'",
  'indexedDB.open(',
  'writeRecoverySnapshot',
  'readLatestRecoverySnapshot',
  'transactionalReplaceAppStorage',
  'rollback'
]) need(backup.includes(marker),`Recovery/transaction implementation missing ${marker}.`);

const recoveryRead=backup.indexOf('const snapshot=await readLatestRecoverySnapshot()');
const recoverySwap=backup.indexOf("await writeRecoverySnapshot(currentBackup,'before-recovery-restore')");
need(recoveryRead>=0 && recoverySwap>recoveryRead,'Recovery restore must read/validate its source before replacing the rolling latest snapshot.');
need(backup.includes('await window.FabriCadabraApp.backup.flushPendingPersistentEdits()'),'Backup flow must flush pending app-owned edits.');
need(backup.includes('await createRecoverySnapshot(reason)'),'Protected destructive operations must await recovery protection.');
need(backup.includes('window.FabriCadabraRecovery='),'Existing feature imports need a narrow recovery-snapshot service.');

need(pkg.scripts?.['verify:backup-restore']==='node scripts/verify-backup-restore.mjs','package.json must expose verify:backup-restore.');
need(String(pkg.scripts?.verify||'').includes('npm run verify:backup-restore'),'npm run verify must include the permanent backup/restore verifier.');
const release=JSON.parse(readFileSync(join(root,'release.json'),'utf8'));
need(pkg.version===release.version,`Backup verifier package version ${pkg.version} must match release metadata ${release.version}.`);

console.log('Unified backup format, 10-key registry, restore safety, and recovery contract: OK');
