import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const root = process.cwd();
const appPath = join(root, 'www', 'index.html');
const originalPath = join(root, 'source', 'fabrication_pro.original.html');
const app = readFileSync(appPath, 'utf8');
const original = readFileSync(originalPath, 'utf8');

const expectedOriginalSha = '0999b807c9d63f717531cef21885a9db42cdfcf25d9ecb560b14058960335c45';
const actualOriginalSha = createHash('sha256').update(original).digest('hex');
if (actualOriginalSha !== expectedOriginalSha) {
  throw new Error(`Preserved original HTML changed. Expected ${expectedOriginalSha}, got ${actualOriginalSha}.`);
}

const requiredSnippets = [
  '<title>Fabri-Cadabra</title>',
  '<h1>Fabri-Cadabra</h1>',
  'id="pageMenuBtn"',
  'id="pageMenuDrawer"',
  'data-tool="calculator"',
  'id="tool-calculator"',
  'id="calculatorGuideBtn"',
  'id="calculatorGuideDrawer"',
  'id="calculatorDisplay"',
  'data-calc-action="memory-clear"',
  'data-calc-action="memory-recall"',
  'data-calc-action="memory-subtract"',
  'data-calc-action="memory-add"',
  'data-calc-action="sqrt"',
  'data-calc-action="percent"',
  'data-calc-action="pi"',
  'data-calc-action="power"',
  'data-calc-action="round-2"',
  'data-calc-action="round-0"',
  "savedTool === 'calculator'"
];

for (const snippet of requiredSnippets) {
  if (!app.includes(snippet)) throw new Error(`Missing approved feature marker: ${snippet}`);
}

if (/class="tool-menu"/.test(app)) {
  throw new Error('Legacy in-header page grid is still present; navigation should use the floating drawer.');
}

console.log(`Preserved original HTML SHA-256: ${actualOriginalSha}`);
console.log('Approved Fabri-Cadabra navigation and calculator feature markers: OK');
