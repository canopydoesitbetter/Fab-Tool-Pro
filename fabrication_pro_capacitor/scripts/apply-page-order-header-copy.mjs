import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const indexPath = path.join(root, 'www', 'index.html');
const releasePath = path.join(root, 'release.json');
const verifyFeaturesPath = path.join(root, 'scripts', 'verify-features.mjs');
const verifyHeaderPath = path.join(root, 'scripts', 'verify-header-branding.mjs');

const desiredPageOrder = [
  'tasklog',
  'notes',
  'checklist',
  'calculator',
  'reference',
  'fasteners',
  'optimizer',
  'saw',
  'overhang'
];

function replaceOnce(source, from, to, label) {
  const first = source.indexOf(from);
  if (first < 0) throw new Error(`Could not find ${label}`);
  if (source.indexOf(from, first + from.length) >= 0) throw new Error(`Found multiple ${label} targets`);
  return source.slice(0, first) + to + source.slice(first + from.length);
}

function findSectionEnd(html, start) {
  const tag = /<section\b[^>]*>|<\/section>/g;
  tag.lastIndex = start;
  let depth = 0;
  for (let match = tag.exec(html); match; match = tag.exec(html)) {
    if (match[0].startsWith('</section')) depth -= 1;
    else depth += 1;
    if (depth === 0) return tag.lastIndex;
  }
  throw new Error(`Unclosed section starting at ${start}`);
}

let html = fs.readFileSync(indexPath, 'utf8');

const oldHeaderCopy = '<p class="brand-copy">The multi-tool built specifically for efficient shop fabrication. — Navigate the tools with the [ <strong>≡</strong> Pages ] button in the top right corner. — Understand the tool before you use it.</p>';
const newHeaderCopy = '<p class="brand-copy">Built for efficient shop fabrication. — Navigate with the [ <strong>≡</strong> Pages ] button in the top right corner.</p>';
html = replaceOnce(html, oldHeaderCopy, newHeaderCopy, 'header brand copy');

const pagePanelStartPattern = /<section id="tool-([^"]+)" class="tool-panel(?: active)?">/g;
const pagePanels = [];
for (let match = pagePanelStartPattern.exec(html); match; match = pagePanelStartPattern.exec(html)) {
  const start = match.index;
  const end = findSectionEnd(html, start);
  pagePanels.push({ tool: match[1], start, end, block: html.slice(start, end) });
  pagePanelStartPattern.lastIndex = end;
}

const actualPageTools = pagePanels.map(panel => panel.tool);
const expectedCurrentPageTools = ['overhang','fasteners','optimizer','saw','tasklog','notes','checklist','reference','calculator'];
if (JSON.stringify(actualPageTools) !== JSON.stringify(expectedCurrentPageTools)) {
  throw new Error(`Unexpected current Pages panel order: ${actualPageTools.join(' > ')}`);
}
if (pagePanels.length !== desiredPageOrder.length) throw new Error(`Expected ${desiredPageOrder.length} Pages panels, found ${pagePanels.length}`);

for (let i = 0; i < pagePanels.length - 1; i += 1) {
  const gap = html.slice(pagePanels[i].end, pagePanels[i + 1].start);
  if (gap.trim()) throw new Error(`Non-whitespace content found between ${pagePanels[i].tool} and ${pagePanels[i + 1].tool}; refusing unsafe reorder`);
}

const byTool = new Map(pagePanels.map(panel => [panel.tool, panel.block]));
for (const tool of desiredPageOrder) {
  if (!byTool.has(tool)) throw new Error(`Missing Pages panel ${tool}`);
}
const reordered = desiredPageOrder.map(tool => byTool.get(tool)).join('\n\n');
html = html.slice(0, pagePanels[0].start) + reordered + html.slice(pagePanels.at(-1).end);

const changelogAnchor = '          <li><b>Header &amp; Pages Branding:</b> Added the exact approved Fabri-Cadabra app logo beside the header guidance, removed the repeated app-name heading from the topbar, and moved the Fabri-Cadabra name into a dedicated branded masthead at the top of the Pages drawer.</li>';
const changelogAddition = `${changelogAnchor}\n          <li><b>Page Order &amp; Header Copy:</b> Reordered the physical tool sections in <code>index.html</code> to match the Pages drawer, retained Settings last, and shortened the header guidance to the current fabrication/navigation copy.</li>`;
html = replaceOnce(html, changelogAnchor, changelogAddition, '1.0.5 header branding changelog entry');
fs.writeFileSync(indexPath, html);

let verifyFeatures = fs.readFileSync(verifyFeaturesPath, 'utf8');
const navOrderCheck = "if(JSON.stringify(navTools)!==JSON.stringify(expectedNavTools)) throw new Error(`Pages drawer order changed unexpectedly. Expected ${expectedNavTools.join(' > ')}, got ${navTools.join(' > ')}.`);";
const navAndPanelOrderCheck = `${navOrderCheck}\nconst panelTools=[...html.matchAll(/<section id=\"tool-([^\"]+)\" class=\"tool-panel[^\"]*\">/g)].map(match=>match[1]);\nconst expectedPanelTools=[...expectedNavTools,'settings'];\nif(JSON.stringify(panelTools)!==JSON.stringify(expectedPanelTools)) throw new Error(\`Physical tool-panel order must match Pages drawer order with Settings last. Expected \${expectedPanelTools.join(' > ')}, got \${panelTools.join(' > ')}.\`);`;
verifyFeatures = replaceOnce(verifyFeatures, navOrderCheck, navAndPanelOrderCheck, 'Pages drawer order verifier');
verifyFeatures = replaceOnce(
  verifyFeatures,
  "const tagline='The multi-tool built specifically for efficient shop fabrication. — Navigate the tools with the [ <strong>≡</strong> Pages ] button in the top right corner. — Understand the tool before you use it.';",
  "const tagline='Built for efficient shop fabrication. — Navigate with the [ <strong>≡</strong> Pages ] button in the top right corner.';",
  'canonical introductory copy verifier'
);
fs.writeFileSync(verifyFeaturesPath, verifyFeatures);

let verifyHeader = fs.readFileSync(verifyHeaderPath, 'utf8');
verifyHeader = replaceOnce(
  verifyHeader,
  "requireText('class=\"brand-copy\"', 'header guidance copy');",
  "requireText('class=\"brand-copy\">Built for efficient shop fabrication. — Navigate with the [ <strong>≡</strong> Pages ] button in the top right corner.</p>', 'canonical header guidance copy');",
  'header guidance verification marker'
);
fs.writeFileSync(verifyHeaderPath, verifyHeader);

const release = JSON.parse(fs.readFileSync(releasePath, 'utf8'));
if (release.version !== '1.0.5' || Number(release.buildNumber) !== 1000010 || release.previousVersion !== '1.0.4') {
  throw new Error(`Unexpected release baseline: ${JSON.stringify(release)}`);
}
release.buildNumber = 1000011;
fs.writeFileSync(releasePath, `${JSON.stringify(release, null, 2)}\n`);

console.log('Applied Fabri-Cadabra 1.0.5 canonical HTML page order, header copy, and native build 1000011.');
