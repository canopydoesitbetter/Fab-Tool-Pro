import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const originalPath = join(root, 'source', 'fabrication_pro.original.html');
const appPath = join(root, 'www', 'index.html');
const shimPath = join(root, 'www', 'native-compat.js');

const original = readFileSync(originalPath, 'utf8');
const app = readFileSync(appPath, 'utf8');
const shim = readFileSync(shimPath, 'utf8');

const expectedInsertion = '<script src="native-compat.js"></script>\n\n';
const reconstructed = app.replace(expectedInsertion, '');
if (reconstructed !== original) {
  throw new Error('www/index.html contains changes beyond the approved native compatibility script include.');
}

const scriptMatches = [...original.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
if (!scriptMatches.length) throw new Error('No inline application script found.');
for (const [index, match] of scriptMatches.entries()) {
  new vm.Script(match[1], { filename: `fabrication-inline-${index + 1}.js` });
}
new vm.Script(shim, { filename: 'native-compat.js' });

const sha = createHash('sha256').update(readFileSync(originalPath)).digest('hex');
console.log(`Original HTML SHA-256: ${sha}`);
console.log(`Inline app scripts syntax: OK (${scriptMatches.length})`);
console.log('Native compatibility shim syntax: OK');
console.log('Application source integrity: OK (only native-compat.js include added to www/index.html)');
