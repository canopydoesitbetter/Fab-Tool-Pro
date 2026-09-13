import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root=resolve(process.cwd());
const version='1.0.7';

const readJson=path=>JSON.parse(readFileSync(path,'utf8'));
const writeJson=(path,value)=>writeFileSync(path,`${JSON.stringify(value,null,2)}\n`);

const packagePath=resolve(root,'package.json');
const lockPath=resolve(root,'package-lock.json');
const releasePath=resolve(root,'release.json');
const indexPath=resolve(root,'www','index.html');

const pkg=readJson(packagePath);
pkg.version=version;
writeJson(packagePath,pkg);

const lock=readJson(lockPath);
lock.version=version;
if (!lock.packages || !lock.packages['']) throw new Error('package-lock root package metadata is missing.');
lock.packages[''].version=version;
writeJson(lockPath,lock);

writeJson(releasePath,{
  version,
  buildNumber:1000015,
  previousVersion:'1.0.6'
});

let html=readFileSync(indexPath,'utf8');
const oldCurrent="<span id='settingsCurrentChangelogVersion' class='changelog-version-label'>Version 1.0.6</span>";
const oldPlain="<span class='changelog-version-label'>Version 1.0.6</span>";
const oldAnchor="      <article class='changelog-entry changelog-release' data-changelog-version='1.0.6'>";
const newEntry=`      <article class='changelog-entry changelog-release' data-changelog-version='1.0.7'>\n        <div class='changelog-entry-heading'>\n          <div>\n            <span id='settingsCurrentChangelogVersion' class='changelog-version-label'>Version 1.0.7</span>\n            <h2>Fastener Spacing Workflow Upgrade</h2>\n          </div>\n        </div>\n        <ul>\n          <li><b>Corner Tolerance:</b> Added an optional Corner Tolerance input that offsets the first and last fasteners equally from the true part edges while keeping all displayed fastener locations measured from the true edge.</li>\n          <li><b>Equalized Spacing:</b> Fastener spacing now calculates across the tolerance-adjusted usable span while continuing to respect the selected Max Spacing limit. A 0&quot; tolerance preserves the established whole-length behavior.</li>\n          <li><b>Tap-to-Complete Progress:</b> Each calculated fastener location is now a tappable completion control with a clear completed state, making the layout usable as an installation checklist directly from the shop floor.</li>\n          <li><b>Persistent Workspace:</b> Max Spacing, Length, Corner Tolerance, the calculated layout, and completed fasteners now survive page changes, app restarts, and device shutdowns. Changing the layout safely clears incompatible old progress, and Clear removes the saved workspace.</li>\n          <li><b>Backup &amp; Regression Protection:</b> Fastener Spacing is now part of Fabri-Cadabra's centralized persistence, recovery, and full-backup system, with permanent automated coverage for tolerance math, progress persistence, layout reset behavior, and storage integration.</li>\n        </ul>\n      </article>\n`;

if (!html.includes("data-changelog-version='1.0.7'")) {
  if (!html.includes(oldCurrent)) throw new Error('Current 1.0.6 changelog marker was not found.');
  if (!html.includes(oldAnchor)) throw new Error('1.0.6 changelog anchor was not found.');
  html=html.replace(oldCurrent,oldPlain);
  html=html.replace(oldAnchor,`${newEntry}${oldAnchor}`);
}
writeFileSync(indexPath,html);

console.log('Fabri-Cadabra 1.0.7 release metadata and changelog finalized.');
