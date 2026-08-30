import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const requiredFiles = ['www/index.html','www/styles.css','www/app.js','www/calculator.js','www/native-compat.js'];
for (const relative of requiredFiles) {
  if (!existsSync(join(root, relative))) throw new Error(`Missing canonical web asset: ${relative}`);
}
const html = readFileSync(join(root,'www/index.html'),'utf8');
const styles = readFileSync(join(root,'www/styles.css'),'utf8');
const app = readFileSync(join(root,'www/app.js'),'utf8');
const calculator = readFileSync(join(root,'www/calculator.js'),'utf8');
const native = readFileSync(join(root,'www/native-compat.js'),'utf8');

const scriptOrder = ['native-compat.js','app.js','calculator.js'];
let previous = -1;
for (const script of scriptOrder) {
  const marker = `<script src="${script}" defer></script>`;
  const index = html.indexOf(marker);
  if (index < 0) throw new Error(`index.html must directly load ${script} with defer.`);
  if (index <= previous) throw new Error(`Script order must be: ${scriptOrder.join(', ')}.`);
  previous = index;
}
if (!html.includes('<link rel="stylesheet" href="styles.css" />')) throw new Error('index.html must directly load styles.css.');
if (/<style(?:\s|>)/i.test(html)) throw new Error('Inline application <style> remains in index.html.');
if (/<script(?![^>]*\bsrc=)[^>]*>[\s\S]{200,}<\/script>/i.test(html)) throw new Error('Large inline application script remains in index.html.');
if (!/<title>Fabri-Cadabra<\/title>/.test(html) || !/<h1>Fabri-Cadabra<\/h1>/.test(html)) throw new Error('Fabri-Cadabra must be canonical in document title and brand heading.');
if (html.includes('Fabrication Calculators')) throw new Error('Legacy Fabrication Calculators product name remains in live HTML.');
if (/class="tool-menu"/.test(html) || /class="tool-tab/.test(html)) throw new Error('Legacy tool-menu/tool-tab markup remains.');
if (html.includes('fabri-cadabra.js')) throw new Error('Legacy runtime enhancement is still referenced.');
for (const [name, source] of [['app.js',app],['calculator.js',calculator],['native-compat.js',native]]) {
  new vm.Script(source,{filename:name});
  if (/createElement\(\s*['"]script['"]\s*\)/.test(source)) throw new Error(`${name} dynamically creates a shipped script loader.`);
}
if (/document\.title\s*=|brandHeading\.textContent/.test(app+calculator+native)) throw new Error('Runtime product-name replacement remains in shipped JavaScript.');
if (/originalNav\.remove\(\)|originalTabs|originalTabByTool/.test(app+calculator+native)) throw new Error('Detached legacy navigation compatibility remains.');
if (/\.tool-menu|\.tool-tab/.test(styles)) throw new Error('Legacy navigation CSS remains in styles.css.');
console.log('Canonical web source architecture: OK');
console.log('JavaScript syntax: OK (app.js, calculator.js, native-compat.js)');
