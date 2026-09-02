import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root=process.cwd();
const expectedVersion='1.0.1';
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

// Settings remains separate from the nine canonical fabrication page links and is injected by the UX layer.
requireMatch(ux,/function installSettingsPage\(/,'Settings page installer is missing.');
requireMatch(ux,/className='fab-settings-link'/,'Settings drawer button must use its dedicated navigation class.');
requireMatch(ux,/className='fab-settings-drawer-footer'/,'Settings drawer button must live in a dedicated bottom footer.');
requireMatch(ux,/id='tool-settings'/,'Settings page panel is missing.');
requireMatch(ux,/function openSettingsPage\(/,'Settings navigation behavior is missing.');
requireMatch(ux,/originalGetActiveTool/,'Settings must temporarily report itself as the active page without changing core navigation state.');
requireMatch(ux,/pageMenuDrawer\.addEventListener\('click'/,'Settings must return cleanly to normal page navigation.');

// Settings button styling must match the page links while using the existing danger palette and staying pinned at the bottom.
for (const marker of ['.fab-settings-drawer-footer','.fab-settings-link','.settings-page','.settings-version-value','.settings-changelog-drawer','.settings-changelog-body']) {
  if (!uxStyles.includes(marker)) throw new Error(`Missing Settings/changelog style: ${marker}`);
}
requireMatch(uxStyles,/\.fab-settings-link\s*\{[^}]*background:\s*var\(--danger-bg\)[^}]*color:\s*var\(--danger\)/s,'Settings drawer button must use the established danger/red palette.');
requireMatch(uxStyles,/\.fab-page-drawer \.cut-list-drawer-body\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column[^}]*overflow:\s*hidden/s,'Pages drawer body must pin Settings outside the independently scrollable tool list.');
requireMatch(uxStyles,/\.settings-changelog-drawer\s*\{[^}]*left:\s*50%[^}]*top:\s*50%/s,'Changelog overlay must be centered on screen.');
requireMatch(uxStyles,/\.settings-changelog-body\s*\{[^}]*overflow-y:\s*auto/s,'Changelog content must scroll independently from Settings.');

// The package version is the single canonical source; the browser-readable UX value is generated from it.
if (pkg.version!==expectedVersion) throw new Error(`package.json must be bumped to ${expectedVersion}; got ${pkg.version}.`);
if (!existsSync(syncPath)) throw new Error('Missing package-version sync script.');
const sync=readFileSync(syncPath,'utf8');
requireMatch(sync,/package\.json/,'Version sync must read package.json as the canonical source.');
requireMatch(sync,/FABRI_CADABRA_VERSION/,'Version sync must update the browser-readable FABRI_CADABRA_VERSION marker.');
const generatedVersion=ux.match(/const FABRI_CADABRA_VERSION='([^']+)'/i)?.[1];
if (generatedVersion!==pkg.version) throw new Error(`Browser version ${generatedVersion || 'missing'} does not match canonical package version ${pkg.version}.`);
requireMatch(ux,/id='settingsVersionValue'>\$\{FABRI_CADABRA_VERSION\}<\/strong>/,'Settings must display the canonical current version.');

// Changelog opens as a modal drawer and is newest-first.
requireMatch(ux,/openDrawer\('settingsChangelogDrawer'/,'Changelog button must reuse shared modal/drawer focus behavior.');
requireMatch(ux,/closeDrawer\('settingsChangelogDrawer'/,'Changelog close behavior is missing.');
const newestIndex=ux.indexOf("data-changelog-version='current'");
const baselineIndex=ux.indexOf("data-changelog-version='1.0.0'");
if (newestIndex<0 || baselineIndex<0 || newestIndex>=baselineIndex) throw new Error('Changelog entries must place the current version before 1.0.0.');
for (const heading of ['Task Logging','Fabricator Notes','Checklist','Basic Calculator','Quick Reference','Fastener Spacing','Sheet Optimizer','Saw Optimizer','Aluminum Overhang','App-Wide Features']) {
  if (!ux.includes(`<h3>${heading}</h3>`)) throw new Error(`Current Features changelog is missing section: ${heading}`);
}
for (const change of ['Added Settings page.','Added permanent Settings access at the bottom of the Pages drawer.','Added in-app Changelog.','Added application version tracking.','Established newest-first changelog ordering.']) {
  if (!ux.includes(change)) throw new Error(`v1.0.1 changelog is missing: ${change}`);
}

console.log(`Settings, canonical version ${pkg.version}, and newest-first changelog contract: OK`);
