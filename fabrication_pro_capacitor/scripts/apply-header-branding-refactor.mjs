import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const indexPath = path.join(root, 'www', 'index.html');
const stylesPath = path.join(root, 'www', 'styles.css');
const packagePath = path.join(root, 'package.json');
const releasePath = path.join(root, 'release.json');
const approvedIconPath = path.join(root, 'assets', 'native-branding', 'approved-icon-source.jpg');
const webLogoPath = path.join(root, 'www', 'app-logo.jpg');
const verifierPath = path.join(root, 'scripts', 'verify-header-branding.mjs');

function replaceOnce(source, from, to, label) {
  const index = source.indexOf(from);
  if (index < 0) throw new Error(`Could not find ${label}`);
  if (source.indexOf(from, index + from.length) >= 0) throw new Error(`Found multiple ${label} targets`);
  return source.slice(0, index) + to + source.slice(index + from.length);
}

let html = fs.readFileSync(indexPath, 'utf8');

const oldHeader = `        <div class="brand">\n          <h1>Fabri-Cadabra</h1>\n          <p>The multi-tool built specifically for efficient shop fabrication. — Navigate the tools with the [ <strong>≡</strong> Pages ] button in the top right corner. — Understand the tool before you use it.</p>\n        </div>`;
const newHeader = `        <div class="brand header-brand">\n          <img id="appHeaderLogo" class="app-header-logo" src="app-logo.jpg" alt="Fabri-Cadabra" />\n          <p class="brand-copy">The multi-tool built specifically for efficient shop fabrication. — Navigate the tools with the [ <strong>≡</strong> Pages ] button in the top right corner. — Understand the tool before you use it.</p>\n        </div>`;
html = replaceOnce(html, oldHeader, newHeader, 'topbar brand block');

const oldDrawer = `  <aside id="pageMenuDrawer" class="cut-list-drawer fab-page-drawer" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="pageMenuDrawerTitle">\n    <div class="cut-list-drawer-head"><strong id="pageMenuDrawerTitle">Pages</strong><button id="pageMenuCloseBtn" class="cut-list-close-btn" type="button" aria-label="Close Pages">×</button></div>`;
const newDrawer = `  <aside id="pageMenuDrawer" class="cut-list-drawer fab-page-drawer" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="pageMenuBrandName pageMenuDrawerTitle">\n    <div class="cut-list-drawer-head fab-page-drawer-head">\n      <div class="fab-page-drawer-brand">\n        <strong id="pageMenuBrandName">Fabri-Cadabra</strong>\n        <span id="pageMenuDrawerTitle">Pages</span>\n      </div>\n      <button id="pageMenuCloseBtn" class="cut-list-close-btn" type="button" aria-label="Close Pages">×</button>\n    </div>`;
html = replaceOnce(html, oldDrawer, newDrawer, 'Pages drawer header');

html = replaceOnce(
  html,
  `<h2>App-Styled Confirmation Dialogs</h2>`,
  `<h2>Interface Polish &amp; App-Styled Confirmations</h2>`,
  '1.0.5 changelog heading'
);

const changelogAnchor = `          <li><b>Shift Schedule Confirmation:</b> Gave Enable and Disable Shift Schedule dedicated confirmation titles and action labels so schedule controls can never inherit Clock In or Clock Out wording from explanatory text.</li>\n          <li>Added permanent source and browser regression coverage so important workflows cannot silently fall back to <code>window.confirm()</code>.</li>`;
const changelogReplacement = `          <li><b>Shift Schedule Confirmation:</b> Gave Enable and Disable Shift Schedule dedicated confirmation titles and action labels so schedule controls can never inherit Clock In or Clock Out wording from explanatory text.</li>\n          <li><b>Header &amp; Pages Branding:</b> Added the exact approved Fabri-Cadabra app logo beside the header guidance, removed the repeated app-name heading from the topbar, and moved the Fabri-Cadabra name into a dedicated branded masthead at the top of the Pages drawer.</li>\n          <li><b>Repository Maintenance:</b> Audited and removed completed temporary branding, feature, fix, refactor, release, test, and verification branches after confirming no useful unmerged work remained; <code>main</code> and <code>work</code> are the only retained long-lived branches.</li>\n          <li>Added permanent source and browser regression coverage so important workflows cannot silently fall back to <code>window.confirm()</code> and the approved header branding cannot drift.</li>`;
html = replaceOnce(html, changelogAnchor, changelogReplacement, '1.0.5 changelog list');
fs.writeFileSync(indexPath, html);

let css = fs.readFileSync(stylesPath, 'utf8');
const marker = '/* v1.0.5 — header and Pages drawer branding */';
if (css.includes(marker)) throw new Error('Header branding CSS already exists');
css += `\n\n${marker}\n.topbar .header-brand {\n  flex:1 1 430px;\n  min-width:0;\n  display:flex;\n  align-items:center;\n  gap:14px;\n}\n.app-header-logo {\n  flex:0 0 auto;\n  width:clamp(62px,8vw,76px);\n  height:clamp(62px,8vw,76px);\n  object-fit:cover;\n  border-radius:18px;\n  border:1px solid rgba(255,255,255,.34);\n  box-shadow:0 8px 20px rgba(0,0,0,.24);\n}\n.topbar .brand-copy {\n  flex:1 1 auto;\n  min-width:0;\n  margin:0;\n}\n.fab-page-drawer-head {\n  align-items:center;\n  gap:12px;\n  min-height:76px;\n}\n.fab-page-drawer-brand {\n  display:flex;\n  flex:1 1 auto;\n  min-width:0;\n  flex-direction:column;\n  gap:3px;\n}\n#pageMenuBrandName {\n  display:block;\n  color:var(--text);\n  font-size:1.28rem;\n  line-height:1.05;\n  font-weight:950;\n  letter-spacing:-.025em;\n}\n#pageMenuDrawerTitle {\n  display:block;\n  color:var(--muted);\n  font-size:.73rem;\n  line-height:1.2;\n  font-weight:900;\n  text-transform:uppercase;\n  letter-spacing:.12em;\n}\n@media (max-width:760px) {\n  .topbar .brand-row { flex-wrap:wrap; }\n  .topbar .header-brand { flex-basis:100%; }\n  .app-header-logo { width:64px; height:64px; border-radius:16px; }\n}\n@media (max-width:420px) {\n  .topbar .header-brand { gap:11px; }\n  .app-header-logo { width:58px; height:58px; border-radius:15px; }\n  .topbar .brand-copy { font-size:.84rem; }\n}\n`;
fs.writeFileSync(stylesPath, css);

fs.copyFileSync(approvedIconPath, webLogoPath);

const release = JSON.parse(fs.readFileSync(releasePath, 'utf8'));
if (release.version !== '1.0.5' || Number(release.buildNumber) !== 1000009 || release.previousVersion !== '1.0.4') {
  throw new Error(`Unexpected release baseline: ${JSON.stringify(release)}`);
}
release.buildNumber = 1000010;
fs.writeFileSync(releasePath, `${JSON.stringify(release, null, 2)}\n`);

const verifier = `import fs from 'node:fs';\nimport path from 'node:path';\nimport { fileURLToPath } from 'node:url';\n\nconst here = path.dirname(fileURLToPath(import.meta.url));\nconst root = path.resolve(here, '..');\nconst html = fs.readFileSync(path.join(root, 'www', 'index.html'), 'utf8');\nconst approved = fs.readFileSync(path.join(root, 'assets', 'native-branding', 'approved-icon-source.jpg'));\nconst webLogo = fs.readFileSync(path.join(root, 'www', 'app-logo.jpg'));\n\nfunction requireText(value, label) {\n  if (!html.includes(value)) throw new Error(\\\`Missing header branding contract marker: \\${label}\\\`);\n}\n\nrequireText('id="appHeaderLogo" class="app-header-logo" src="app-logo.jpg" alt="Fabri-Cadabra"', 'approved header logo');\nrequireText('class="brand header-brand"', 'header brand layout');\nrequireText('class="brand-copy"', 'header guidance copy');\nrequireText('id="pageMenuBrandName">Fabri-Cadabra</strong>', 'Pages drawer brand name');\nrequireText('id="pageMenuDrawerTitle">Pages</span>', 'Pages drawer navigation label');\n\nconst topbarStart = html.indexOf('<header class="topbar">');\nconst topbarEnd = html.indexOf('</header>', topbarStart);\nif (topbarStart < 0 || topbarEnd < 0) throw new Error('Topbar markup not found');\nconst topbar = html.slice(topbarStart, topbarEnd);\nif (topbar.includes('<h1>Fabri-Cadabra</h1>')) throw new Error('Fabri-Cadabra must not be repeated as a topbar heading');\nif (!approved.equals(webLogo)) throw new Error('Web header logo must remain byte-for-byte identical to the approved icon source');\n\nconsole.log('Header and Pages drawer branding contract: OK (approved logo exact, app name relocated, responsive brand structure present)');\n`;
fs.writeFileSync(verifierPath, verifier);

const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
if (pkg.version !== '1.0.5') throw new Error(`Unexpected package version ${pkg.version}`);
pkg.scripts['verify:header-branding'] = 'node scripts/verify-header-branding.mjs';
if (!pkg.scripts.verify.includes('verify:header-branding')) {
  pkg.scripts.verify = pkg.scripts.verify.replace(
    'npm run verify:app-modules &&',
    'npm run verify:app-modules && npm run verify:header-branding &&'
  );
}
fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);

console.log('Applied Fabri-Cadabra 1.0.5 header/Pages branding update and native build 1000010.');
