import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root=resolve(import.meta.dirname,'..');
const need=(condition,message)=>{if(!condition)throw new Error(message);};
const html=readFileSync(join(root,'www','index.html'),'utf8');
const styles=readFileSync(join(root,'www','styles.css'),'utf8');
const drawers=readFileSync(join(root,'www','app','drawers.js'),'utf8');
const navigation=readFileSync(join(root,'www','app','navigation.js'),'utf8');

for (const marker of [
  'id="appConfirmBackdrop"',
  'id="appConfirmDialog"',
  'role="dialog"',
  'aria-modal="true"',
  'aria-labelledby="appConfirmTitle"',
  'aria-describedby="appConfirmMessage"',
  'id="appConfirmTitle"',
  'id="appConfirmMessage"',
  'id="appConfirmCancelBtn"',
  'id="appConfirmConfirmBtn"'
]) need(html.includes(marker),`Confirmation dialog contract: missing ${marker}.`);

for (const marker of [
  'function confirmAppAction(',
  "event.key==='Escape'",
  "event.key!=='Tab'",
  'appConfirmReturnFocus',
  "classList.toggle('danger'",
  'new Promise(resolve=>'
]) need(drawers.includes(marker),`Confirmation dialog contract: missing shared behavior marker ${marker}.`);

need(navigation.includes('confirmAction:confirmAppAction'),'Confirmation dialog contract: FabriCadabraApp must expose confirmAction.');
need(styles.includes('.app-confirm-dialog') && styles.includes('.app-confirm-backdrop') && styles.includes('.app-confirm-confirm.danger'),'Confirmation dialog contract: app-styled dialog/danger CSS is incomplete.');

const runtimeFiles=[
  join(root,'www','backup.js'),
  ...readdirSync(join(root,'www','app')).filter(name=>name.endsWith('.js')).map(name=>join(root,'www','app',name))
];
const offenders=[];
for (const file of runtimeFiles) {
  const source=readFileSync(file,'utf8');
  if (/\bwindow\.confirm\s*\(/.test(source)) offenders.push(file.replace(root+'/', ''));
}
need(offenders.length===0,`Confirmation dialog contract: native window.confirm() remains in production runtime files: ${offenders.join(', ')}`);

console.log('Fabri-Cadabra confirmation dialog contract: OK (shared modal, focus/escape behavior, no window.confirm runtime dependency)');
