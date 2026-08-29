import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { installIosPrivacyManifest } from './ios-privacy.mjs';

const root = process.cwd();

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function cap(...args) {
  const executable = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  run(executable, ['cap', ...args]);
}

if (!existsSync(join(root, 'node_modules', '@capacitor', 'cli'))) {
  console.error('Dependencies are not installed. Run "npm install" first.');
  process.exit(1);
}

if (!existsSync(join(root, 'android'))) cap('add', 'android');
if (!existsSync(join(root, 'ios'))) cap('add', 'ios');
cap('sync');

try {
  const privacy = installIosPrivacyManifest(root);
  console.log(privacy.changed
    ? 'iOS privacy manifest added to the App target resources.'
    : 'iOS privacy manifest is already registered with the App target.');
} catch (error) {
  console.error(`iOS privacy manifest setup failed: ${error.message || error}`);
  process.exit(1);
}

console.log('\nNative projects are initialized and synchronized.');
console.log('Android: npm run android:open');
console.log('iOS:     npm run ios:open  (requires macOS + Xcode)');
