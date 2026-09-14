import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const html = fs.readFileSync(path.join(root, 'www', 'index.html'), 'utf8');
const navigation = fs.readFileSync(path.join(root, 'www', 'app', 'navigation.js'), 'utf8');
const approved = fs.readFileSync(path.join(root, 'assets', 'native-branding', 'approved-icon-source.jpg'));
const webLogo = fs.readFileSync(path.join(root, 'www', 'app-logo.jpg'));

function requireHtml(value, label) {
  if (!html.includes(value)) throw new Error('Missing header branding contract marker: ' + label);
}

function requireNavigation(value, label) {
  if (!navigation.includes(value)) throw new Error('Missing wizard-hat navigation contract marker: ' + label);
}

requireHtml('id="appHeaderLogo" class="app-header-logo" src="app-logo.jpg" alt="Fabri-Cadabra"', 'approved header logo');
requireHtml('class="brand header-brand"', 'header brand layout');
requireHtml('id="pageMenuBrandName">Fabri-Cadabra</strong>', 'Pages drawer brand name');
requireHtml('id="pageMenuDrawerTitle">Pages</span>', 'Pages drawer navigation label');

requireNavigation("pageMenuBtn.replaceChildren(appHeaderLogo);", 'approved logo becomes Pages trigger');
requireNavigation("pageMenuBtn.setAttribute('aria-label','Open Pages');", 'Pages trigger accessible name');
requireNavigation("brandCopy.textContent='Built for efficient shop fabrication. — Tap the wizard hat to open Pages.';", 'wizard-hat guidance copy');
requireNavigation("pageMenuBtn.classList.toggle('is-floating',next);", 'floating Pages state');
requireNavigation("pageMenuBtn.classList.toggle('is-docked',!next);", 'docked Pages state');
requireNavigation('right:max(12px,env(safe-area-inset-right));', 'safe-area floating edge');
requireNavigation('box-shadow:0 3px 0 var(--button-edge),var(--button-depth);', 'shared raised-button treatment');

const topbarStart = html.indexOf('<header class="topbar">');
const topbarEnd = html.indexOf('</header>', topbarStart);
if (topbarStart < 0 || topbarEnd < 0) throw new Error('Topbar markup not found');
const topbar = html.slice(topbarStart, topbarEnd);
if (topbar.includes('<h1>Fabri-Cadabra</h1>')) throw new Error('Fabri-Cadabra must not be repeated as a topbar heading');
if (!approved.equals(webLogo)) throw new Error('Web header logo must remain byte-for-byte identical to the approved icon source');

console.log('Header and Pages drawer branding contract: OK (approved wizard-hat logo is the dockable/floating Pages control with shared button styling)');
