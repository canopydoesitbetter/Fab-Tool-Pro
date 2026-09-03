import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root=process.cwd();
const expectedVersion='1.0.3';
const uxPath=join(root,'www','ux.js');
const uxStylesPath=join(root,'www','ux.css');
const packagePath=join(root,'package.json');
const syncPath=join(root,'scripts','sync-app-version.mjs');

const ux=readFileSync(uxPath,'utf8');
const uxStyles=readFileSync(uxStylesPath,'utf8');
const pkg=JSON.parse(readFileSync(packagePath,'utf8'));

function requireMatch(source,pattern,message) {
  if (!pattern.test(source)) throw new Error(message);
}

requireMatch(ux,/function installSettingsPage\(/,'Settings page installer is missing.');
requireMatch(ux,/className='fab-settings-link'/,'Settings drawer button must use its dedicated navigation class.');
requireMatch(ux,/className='fab-settings-drawer-footer'/,'Settings drawer button must live in a dedicated bottom footer.');
requireMatch(ux,/id='tool-settings'/,'Settings page panel is missing.');
requireMatch(ux,/function openSettingsPage\(/,'Settings navigation behavior is missing.');
requireMatch(ux,/originalGetActiveTool/,'Settings must temporarily report itself as the active page without changing core navigation state.');
requireMatch(ux,/pageMenuDrawer\.addEventListener\('click'/,'Settings must return cleanly to normal page navigation.');

for (const marker of ['.fab-settings-drawer-footer','.fab-settings-link','.settings-page','.settings-version-value','.settings-changelog-drawer','.settings-changelog-body','.settings-shift-schedule','.shift-clock-btn.clock-in','.shift-clock-btn.clock-out']) {
  if (!uxStyles.includes(marker)) throw new Error(`Missing Settings/changelog/shift style: ${marker}`);
}
requireMatch(uxStyles,/\.fab-settings-link\s*\{[^}]*background:\s*var\(--danger-bg\)[^}]*color:\s*var\(--danger\)/s,'Settings drawer button must use the established danger/red palette.');
requireMatch(uxStyles,/\.fab-page-drawer \.cut-list-drawer-body\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column[^}]*overflow:\s*hidden/s,'Pages drawer body must pin Settings outside the independently scrollable tool list.');
requireMatch(uxStyles,/\.fab-page-drawer \.fab-page-list\s*\{[^}]*align-content:\s*start[^}]*grid-auto-rows:\s*max-content/s,'The nine original Pages buttons must keep their natural pre-Settings row height instead of stretching to fill the drawer.');
requireMatch(uxStyles,/\.settings-changelog-drawer\s*\{[^}]*left:\s*50%[^}]*top:\s*50%/s,'Changelog overlay must be centered on screen.');
requireMatch(uxStyles,/\.settings-changelog-body\s*\{[^}]*overflow-y:\s*auto/s,'Changelog content must scroll independently from Settings.');

if (pkg.version!==expectedVersion) throw new Error(`package.json must be ${expectedVersion}; got ${pkg.version}.`);
if (!existsSync(syncPath)) throw new Error('Missing package-version sync script.');
const sync=readFileSync(syncPath,'utf8');
requireMatch(sync,/package\.json/,'Version sync must read package.json as the canonical source.');
requireMatch(sync,/FABRI_CADABRA_VERSION/,'Version sync must update the browser-readable FABRI_CADABRA_VERSION marker.');
const generatedVersion=ux.match(/const FABRI_CADABRA_VERSION='([^']+)'/i)?.[1];
if (generatedVersion!==pkg.version) throw new Error(`Browser version ${generatedVersion || 'missing'} does not match canonical package version ${pkg.version}.`);
requireMatch(ux,/id='settingsVersionValue' class='settings-version-value'>\$\{FABRI_CADABRA_VERSION\}<\/strong>/,'Settings must display the canonical current version with the version-value styling hook.');
if (!String(pkg.scripts?.verify || '').includes('npm run verify:shift-schedule')) throw new Error('Aggregate verification must include verify:shift-schedule.');

requireMatch(ux,/openDrawer\('settingsChangelogDrawer'/,'Changelog button must reuse shared modal/drawer focus behavior.');
requireMatch(ux,/closeDrawer\('settingsChangelogDrawer'/,'Changelog close behavior is missing.');
const changelogFunction=ux.match(/function changelogMarkup\(\)\s*\{[\s\S]*?\n  \}\n\n  function installSettingsPage/)?.[0] || '';
const currentIndex=changelogFunction.indexOf("data-changelog-version='current'");
const v102Index=changelogFunction.indexOf("data-changelog-version='1.0.2'");
const v101Index=changelogFunction.indexOf("data-changelog-version='1.0.1'");
const baselineCallIndex=changelogFunction.indexOf('${currentFeaturesChangelogMarkup()}');
if (!(currentIndex>=0 && v102Index>currentIndex && v101Index>v102Index && baselineCallIndex>v101Index)) throw new Error('Changelog renderer must output v1.0.3, then v1.0.2, then v1.0.1, then the v1.0.0 baseline.');
if (!ux.includes("data-changelog-version='1.0.0'")) throw new Error('The v1.0.0 Current Features baseline entry is missing.');
requireMatch(ux,/data-changelog-version='current'[\s\S]*?<h2>Smart Shift Time Entry<\/h2>/,'Current changelog entry must describe Smart Shift Time Entry.');
requireMatch(ux,/data-changelog-version='1.0.2'[\s\S]*?<h2>Shift Schedule &amp; Clock Controls<\/h2>/,'v1.0.2 Shift Schedule changelog entry must be retained.');
for (const concept of ['phone-friendly','730 for 7:30','AM/PM selector','impossible times']) { if (!ux.includes(concept)) throw new Error(`v1.0.3 changelog is missing required concept: ${concept}`); }

for (const heading of ['Task Logging','Fabricator Notes','Checklist','Basic Calculator','Quick Reference','Fastener Spacing','Sheet Optimizer','Saw Optimizer','Aluminum Overhang','App-Wide Features']) {
  if (!ux.includes(`<h3>${heading}</h3>`)) throw new Error(`Current Features changelog is missing section: ${heading}`);
}
for (const change of ['Added Settings page.','Added permanent Settings access at the bottom of the Pages drawer.','Added in-app Changelog.','Added application version tracking.','Established newest-first changelog ordering.']) {
  if (!ux.includes(change)) throw new Error(`v1.0.1 changelog is missing: ${change}`);
}
for (const concept of [
  'Shift Schedule in Settings',
  'green CLOCK IN',
  'red CLOCK OUT',
  'early or late',
  'current-shift override',
  'exact configured Break or Lunch start',
  'never restart automatically',
  'scheduled Clock Out',
  'overtime',
  'unscheduled work',
  'overnight shifts',
  'first prohibited boundary',
  'unrestricted Task Logging behavior'
]) {
  if (!ux.includes(concept)) throw new Error(`v1.0.2 changelog is missing required concept: ${concept}`);
}

console.log(`Settings, canonical version ${pkg.version}, Shift Schedule changelog, unchanged Pages-button sizing, and newest-first changelog contract: OK`);
