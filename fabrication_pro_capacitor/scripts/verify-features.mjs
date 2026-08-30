import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const originalPath = join(root, 'source', 'fabrication_pro.original.html');
const appPath = join(root, 'www', 'index.html');
const shimPath = join(root, 'www', 'native-compat.js');
const featurePath = join(root, 'www', 'fabri-cadabra.js');

const original = readFileSync(originalPath, 'utf8');
const app = readFileSync(appPath, 'utf8');
const shim = readFileSync(shimPath, 'utf8');
const feature = readFileSync(featurePath, 'utf8');

const expectedOriginalSha = '0999b807c9d63f717531cef21885a9db42cdfcf25d9ecb560b14058960335c45';
const actualOriginalSha = createHash('sha256').update(original).digest('hex');
if (actualOriginalSha !== expectedOriginalSha) {
  throw new Error(`Preserved original HTML changed. Expected ${expectedOriginalSha}, got ${actualOriginalSha}.`);
}

if (!app.includes('<script src="native-compat.js"></script>')) {
  throw new Error('Live app no longer loads the compatibility/enhancement entrypoint.');
}
if (!shim.includes("script.src = 'fabri-cadabra.js'")) {
  throw new Error('Native compatibility layer does not load the approved Fabri-Cadabra enhancements.');
}

new vm.Script(feature, { filename:'fabri-cadabra.js' });

const requiredSnippets = [
  "document.title = 'Fabri-Cadabra'",
  "brandHeading.textContent = 'Fabri-Cadabra'",
  "pageMenuBtn.id = 'pageMenuBtn'",
  "id:'pageMenuDrawer'",
  "['calculator','Basic Calculator']",
  "calculatorPanel.id = 'tool-calculator'",
  'id="calculatorGuideBtn"',
  "id:'calculatorGuideDrawer'",
  'id="calculatorDisplay"',
  'data-calc-action="memory-clear"',
  'data-calc-action="memory-recall"',
  'data-calc-action="memory-subtract"',
  'data-calc-action="memory-add"',
  'data-calc-action="clear-context"',
  'id="calculatorClearBtn"',
  'data-calc-action="sqrt"',
  'data-calc-action="percent"',
  'data-calc-action="pi"',
  'data-calc-action="power"',
  'data-calc-action="round-2"',
  'data-calc-action="round-0"',
  'function clearEntry()',
  '<b>CE / AC</b>',
  '<h3>Addition and subtraction</h3>',
  '<h3>Multiplication and division</h3>',
  '<h3>Repeating operations</h3>',
  '<h3>Memory functions</h3>',
  '<h3>Roots, exponents and powers</h3>',
  '<h3>Order of operations</h3>',
  '<h3>Additional operations</h3>',
  '<h3>Percentage operations</h3>',
  '<h3>Correcting mistakes</h3>',
  "savedTool === 'calculator'",
  'originalNav.remove()'
];

for (const snippet of requiredSnippets) {
  if (!feature.includes(snippet)) throw new Error(`Missing approved feature marker: ${snippet}`);
}

const protectedStorageKeys = [
  'fabricationTaskLogJobsV1',
  'fabricationTaskLogPresetsV1',
  'fabricationChecklistV1'
];
for (const key of protectedStorageKeys) {
  if (!original.includes(key)) throw new Error(`Expected protected storage key missing from preserved source: ${key}`);
}

console.log(`Preserved original HTML SHA-256: ${actualOriginalSha}`);
console.log('Fabri-Cadabra enhancement script syntax: OK');
console.log('Approved floating navigation, calculator controls, and full guide markers: OK');
