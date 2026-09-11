import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const APP_MODULES=Object.freeze([
  'app/bootstrap.js',
  'app/storage.js',
  'app/drawers.js',
  'app/navigation.js',
  'app/shift-schedule.js',
  'app/task-logging.js',
  'app/notes.js',
  'app/checklist.js',
  'app/quick-reference.js',
  'app/calculators.js',
  'app/sheet-optimizer.js',
  'app/saw-optimizer.js',
  'app/settings.js',
  'app/import-export.js',
  'app/self-tests.js'
]);

export function readAppSource(root) {
  return APP_MODULES.map(relativePath=>readFileSync(join(root,'www',relativePath),'utf8')).join('\n');
}
