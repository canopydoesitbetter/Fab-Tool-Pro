import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const html = fs.readFileSync(path.join(root, 'www', 'index.html'), 'utf8');
const approved = fs.readFileSync(path.join(root, 'assets', 'native-branding', 'approved-icon-source.jpg'));
const webLogo = fs.readFileSync(path.join(root, 'www', 'app-logo.jpg'));

function requireText(value, label) {
  if (!html.includes(value)) throw new Error('Missing header branding contract marker: ' + label);
}

requireText('id="appHeaderLogo" class="app-header-logo" src="app-logo.jpg" alt="Fabri-Cadabra"', 'approved header logo');
requireText('class="brand header-brand"', 'header brand layout');
requireText('class="brand-copy">Built for efficient shop fabrication. — Navigate with the [ <strong>≡</strong> Pages ] button in the top right corner.</p>', 'canonical header guidance copy');
requireText('id="pageMenuBrandName">Fabri-Cadabra</strong>', 'Pages drawer brand name');
requireText('id="pageMenuDrawerTitle">Pages</span>', 'Pages drawer navigation label');

const topbarStart = html.indexOf('<header class="topbar">');
const topbarEnd = html.indexOf('</header>', topbarStart);
if (topbarStart < 0 || topbarEnd < 0) throw new Error('Topbar markup not found');
const topbar = html.slice(topbarStart, topbarEnd);
if (topbar.includes('<h1>Fabri-Cadabra</h1>')) throw new Error('Fabri-Cadabra must not be repeated as a topbar heading');
if (!approved.equals(webLogo)) throw new Error('Web header logo must remain byte-for-byte identical to the approved icon source');

console.log('Header and Pages drawer branding contract: OK (approved logo exact, app name relocated, responsive brand structure present)');
