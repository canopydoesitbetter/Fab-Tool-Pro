from pathlib import Path
import re, textwrap, sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else '.')
www = root / 'www'
html_path = www / 'index.html'
feature_path = www / 'fabri-cadabra.js'
native_path = www / 'native-compat.js'

html = html_path.read_text(encoding='utf-8')
feature = feature_path.read_text(encoding='utf-8')
native = native_path.read_text(encoding='utf-8')

# Baseline guards keep the migration deterministic and stop on an unexpected source revision.
required_baseline = [
    '<title>Fabrication Calculators</title>',
    '<nav class="tool-menu" aria-label="Fabrication tools">',
    '<script src="native-compat.js"></script>',
    'const toolTabs = Array.from(document.querySelectorAll(\'.tool-tab\'));',
    "script.src = 'fabri-cadabra.js'",
    "calculatorPanel.innerHTML = `",
]
for marker in required_baseline:
    source = native if "script.src" in marker else feature if "calculatorPanel" in marker else html
    if marker not in source:
        raise SystemExit(f'Baseline marker missing; refusing migration: {marker}')

style_match = re.search(r'\n  <style>\n([\s\S]*?)\n  </style>', html)
if not style_match:
    raise SystemExit('Expected single inline application style block not found.')
css = style_match.group(1)

# Remove only CSS belonging to the deleted legacy top navigation.
css = re.sub(r'\n    \.tool-menu \{[\s\S]*?\n    \}\n    \.tool-tab \{[\s\S]*?\n    \}\n    \.tool-tab\.active \{[\s\S]*?\n    \}\n', '\n', css, count=1)
css = css.replace('      .tool-menu { grid-template-columns:1fr 1fr; }\n', '')
css = re.sub(r'\n      /\* Keep the main app navigation as a compact 2×2 grid on phones\. \*/\n      \.tool-menu \{[\s\S]*?\n      \}\n      \.tool-tab \{[\s\S]*?\n      \}\n', '\n', css, count=1)
css = css.replace('.theme-toggle,.tool-menu,.button-row,.status,.error,.footer', '.theme-toggle,.button-row,.status,.error,.footer')

feature_css_match = re.search(r"style\.textContent = `\n([\s\S]*?)\n  `;", feature)
if not feature_css_match:
    raise SystemExit('Fabri-Cadabra enhancement CSS not found.')
feature_css = textwrap.dedent(feature_css_match.group(1)).rstrip()
css = css.rstrip() + '\n\n  /* Fabri-Cadabra canonical Pages + Calculator UI */\n' + textwrap.indent(feature_css, '  ') + '\n'
if '.tool-menu' in css or '.tool-tab' in css:
    raise SystemExit('Legacy navigation CSS remained after extraction.')

# Extract existing established application script before changing HTML.
script_match = re.search(r'\n<script>\n(\(\(\) => \{[\s\S]*?\n\}\)\(\);)\n</script>\s*</body>', html)
if not script_match:
    raise SystemExit('Primary inline application script not found.')
app = script_match.group(1) + '\n'

# Extract approved calculator and guide static markup from the known-good enhancement.
calc_match = re.search(r"calculatorPanel\.innerHTML = `\n([\s\S]*?)\n    </section>`;", feature)
if not calc_match:
    raise SystemExit('Calculator panel template not found.')
calc_inner = textwrap.dedent(calc_match.group(1)).strip()

guide_match = re.search(r"id:'calculatorGuideDrawer', title:'Calculator Guide',\n\s*bodyHtml:`\n([\s\S]*?)`\n\s*\}\);", feature)
if not guide_match:
    raise SystemExit('Calculator Guide template not found.')
guide_inner = textwrap.dedent(guide_match.group(1)).strip()

# Canonical HTML: external CSS, direct product name, no legacy nav.
html = html[:style_match.start()] + '\n  <link rel="stylesheet" href="styles.css" />' + html[style_match.end():]
html = html.replace('<title>Fabrication Calculators</title>', '<title>Fabri-Cadabra</title>', 1)
html = html.replace('<h1>Fabrication Calculators</h1>', '<h1>Fabri-Cadabra</h1>', 1)
html, nav_count = re.subn(r'\n\s*<nav class="tool-menu" aria-label="Fabrication tools">[\s\S]*?</nav>', '', html, count=1)
if nav_count != 1:
    raise SystemExit('Legacy tool menu removal did not match exactly once.')

page_button = '''  <button id="pageMenuBtn" class="fab-page-menu-btn" type="button" aria-expanded="false" aria-controls="pageMenuDrawer"><span aria-hidden="true">☰</span> Pages</button>\n'''
html = html.replace('<body>\n', '<body>\n' + page_button, 1)

calculator_panel = textwrap.indent(f'''<section id="tool-calculator" class="tool-panel">\n{calc_inner}\n</section>''', '    ')
footer_marker = '    <div class="footer">Single offline HTML file • Mobile and browser friendly • No internet required after saving</div>'
if footer_marker not in html:
    raise SystemExit('Expected legacy footer marker not found.')
new_footer = '    <div class="footer">Offline fabrication toolkit • Mobile and browser friendly • No internet required after installation or first load</div>'
html = html.replace(footer_marker, calculator_panel + '\n\n' + new_footer, 1)

page_links = '''<nav class="fab-page-list" aria-label="Fabrication tools">
  <button class="fab-page-link" type="button" data-tool="overhang">Aluminum Overhang</button>
  <button class="fab-page-link" type="button" data-tool="fasteners">Fastener Spacing</button>
  <button class="fab-page-link" type="button" data-tool="optimizer">Material Optimizer</button>
  <button class="fab-page-link" type="button" data-tool="saw">Saw Optimizer</button>
  <button class="fab-page-link" type="button" data-tool="tasklog">Task Logging</button>
  <button class="fab-page-link" type="button" data-tool="notes">Fabricator Notes</button>
  <button class="fab-page-link" type="button" data-tool="checklist">Checklist</button>
  <button class="fab-page-link" type="button" data-tool="reference">Quick Reference</button>
  <button class="fab-page-link" type="button" data-tool="calculator">Basic Calculator</button>
</nav>'''
static_drawers = f'''\n  <div id="pageMenuBackdrop" class="cut-list-backdrop" aria-hidden="true"></div>
  <aside id="pageMenuDrawer" class="cut-list-drawer fab-page-drawer" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="pageMenuDrawerTitle">
    <div class="cut-list-drawer-head"><strong id="pageMenuDrawerTitle">Pages</strong><button id="pageMenuCloseBtn" class="cut-list-close-btn" type="button" aria-label="Close Pages">×</button></div>
    <div class="cut-list-drawer-body">{page_links}</div>
  </aside>

  <div id="calculatorGuideBackdrop" class="cut-list-backdrop" aria-hidden="true"></div>
  <aside id="calculatorGuideDrawer" class="cut-list-drawer" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="calculatorGuideDrawerTitle">
    <div class="cut-list-drawer-head"><strong id="calculatorGuideDrawerTitle">Calculator Guide</strong><button id="calculatorGuideCloseBtn" class="cut-list-close-btn" type="button" aria-label="Close Calculator Guide">×</button></div>
    <div class="cut-list-drawer-body">\n{textwrap.indent(guide_inner, '      ')}\n    </div>
  </aside>
'''

# Remove old script include + inline app script and write direct deferred scripts.
old_tail = html[script_match.start():]
# script_match offsets came from pre-style-change HTML, so re-match in transformed HTML.
html = re.sub(r'\n<script src="native-compat\.js"></script>\n\n<script>\n\(\(\) => \{[\s\S]*?\n\}\)\(\);\n</script>\s*</body>\s*</html>\s*$', '', html, count=1)
html = html.rstrip() + static_drawers + '''\n  <script src="native-compat.js" defer></script>
  <script src="app.js" defer></script>
  <script src="calculator.js" defer></script>
</body>
</html>
'''

# Canonical navigation and shared drawer mechanics in app.js.
app = app.replace("  const toolTabs = Array.from(document.querySelectorAll('.tool-tab'));\n  const toolPanels = Array.from(document.querySelectorAll('.tool-panel'));", "  const pageLinks = Array.from(document.querySelectorAll('.fab-page-link'));\n  const toolPanels = Array.from(document.querySelectorAll('.tool-panel'));\n  const VALID_TOOLS = new Set(['overhang','fasteners','optimizer','saw','tasklog','notes','checklist','reference','calculator']);\n  const drawerReturnFocus = new Map();\n  let activeTool = 'overhang';")

storage_marker = "  function storageSet(key,value) {\n    try { localStorage.setItem(key,value); } catch (e) {}\n  }\n"
if storage_marker not in app:
    raise SystemExit('storageSet insertion marker not found.')
drawer_code = r'''

  function getDrawerParts(drawerId) {
    const drawer=document.getElementById(drawerId);
    const backdrop=document.getElementById(drawerId.replace(/Drawer$/,'Backdrop'));
    if (!drawer || !backdrop) return null;
    return {drawer,backdrop,close:drawer.querySelector('.cut-list-close-btn')};
  }

  function syncBodyDrawerState() {
    document.body.classList.toggle('cut-list-drawer-open',!!document.querySelector('.cut-list-drawer.open'));
  }

  function isDrawerOpen(drawerId) {
    return !!document.getElementById(drawerId)?.classList.contains('open');
  }

  function openDrawer(drawerId,returnFocusElement=document.activeElement) {
    const parts=getDrawerParts(drawerId);
    if (!parts) return false;
    drawerReturnFocus.set(drawerId,returnFocusElement || null);
    parts.drawer.classList.add('open');
    parts.backdrop.classList.add('open');
    parts.drawer.setAttribute('aria-hidden','false');
    parts.backdrop.setAttribute('aria-hidden','false');
    syncBodyDrawerState();
    if (parts.close) requestAnimationFrame(()=>parts.close.focus({preventScroll:true}));
    return true;
  }

  function closeDrawer(drawerId,returnFocusElement) {
    const parts=getDrawerParts(drawerId);
    if (!parts) return false;
    parts.drawer.classList.remove('open');
    parts.backdrop.classList.remove('open');
    parts.drawer.setAttribute('aria-hidden','true');
    parts.backdrop.setAttribute('aria-hidden','true');
    syncBodyDrawerState();
    const focusTarget=returnFocusElement || drawerReturnFocus.get(drawerId);
    drawerReturnFocus.delete(drawerId);
    if (focusTarget && typeof focusTarget.focus==='function') requestAnimationFrame(()=>focusTarget.focus({preventScroll:true}));
    return true;
  }

  function trapDrawerFocus(drawer,event) {
    if (event.key!=='Tab' || !drawer?.classList.contains('open')) return;
    const focusable=Array.from(drawer.querySelectorAll('button:not([disabled]),select:not([disabled]),input:not([disabled]),textarea:not([disabled]),[href],[tabindex]:not([tabindex="-1"])')).filter(el=>el.offsetParent!==null);
    if (!focusable.length) { event.preventDefault(); return; }
    const first=focusable[0],last=focusable[focusable.length-1];
    if (event.shiftKey && document.activeElement===first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement===last) { event.preventDefault(); first.focus(); }
  }

  document.addEventListener('keydown',event=>{
    const drawer=document.querySelector('.cut-list-drawer.open');
    if (drawer) trapDrawerFocus(drawer,event);
  });

  function getActiveTool() { return activeTool; }
'''
app = app.replace(storage_marker, storage_marker + drawer_code)

old_nav = re.compile(r"  function selectTool\(tool\) \{[\s\S]*?\n  const savedTool = storageGet\('fabricationTool'\);\n  if \(savedTool === 'fasteners'[\s\S]*?selectTool\(savedTool\);\n")
new_nav = r'''  function selectTool(tool) {
    const next=VALID_TOOLS.has(tool)?tool:'overhang';
    activeTool=next;
    pageLinks.forEach(link=>link.classList.toggle('active',link.dataset.tool===next));
    toolPanels.forEach(panel=>panel.classList.toggle('active',panel.id==='tool-'+next));
    storageSet('fabricationTool',next);
    window.scrollTo({top:0,behavior:'smooth'});
  }

  const pageMenuBtn=document.getElementById('pageMenuBtn');
  const pageMenuDrawer=document.getElementById('pageMenuDrawer');
  const pageMenuBackdrop=document.getElementById('pageMenuBackdrop');
  const pageMenuCloseBtn=document.getElementById('pageMenuCloseBtn');
  function setPageMenuOpen(open) {
    if (open) openDrawer('pageMenuDrawer',pageMenuBtn); else closeDrawer('pageMenuDrawer',pageMenuBtn);
    pageMenuBtn.setAttribute('aria-expanded',open?'true':'false');
  }
  pageMenuBtn.addEventListener('click',()=>setPageMenuOpen(!isDrawerOpen('pageMenuDrawer')));
  pageMenuCloseBtn.addEventListener('click',()=>setPageMenuOpen(false));
  pageMenuBackdrop.addEventListener('click',()=>setPageMenuOpen(false));
  pageMenuDrawer.addEventListener('click',event=>{
    const link=event.target.closest('.fab-page-link');
    if (!link) return;
    selectTool(link.dataset.tool);
    setPageMenuOpen(false);
  });
  document.addEventListener('keydown',event=>{
    if (event.key==='Escape' && isDrawerOpen('pageMenuDrawer')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setPageMenuOpen(false);
    }
  });

  const savedTool = storageGet('fabricationTool');
  selectTool(VALID_TOOLS.has(savedTool)?savedTool:'overhang');

  window.FabriCadabraApp={getActiveTool,openDrawer,closeDrawer,isDrawerOpen};
'''
app, count = old_nav.subn(new_nav, app, count=1)
if count != 1:
    raise SystemExit('Legacy selectTool block replacement failed.')

# Consolidate the three established drawer state implementations onto the shared primitive.
app = app.replace('  let taskLogPresetReturnFocus = null;\n','')
app = app.replace('  let sawCutListReturnFocus = null;\n','')
app = app.replace('  let cutListReturnFocus = null;\n','')
app = re.sub(r"  function setTaskLogPresetDrawerOpen\(open\) \{[\s\S]*?\n  \}\n\n  function formatTaskLogSessionMoment", "  function setTaskLogPresetDrawerOpen(open) {\n    if (open) openDrawer('taskLogPresetDrawer',document.activeElement); else closeDrawer('taskLogPresetDrawer');\n    taskLogPresetMenuBtn.setAttribute('aria-expanded',open?'true':'false');\n  }\n\n  function formatTaskLogSessionMoment", app, count=1)
app = re.sub(r"  function setSawCutListDrawerOpen\(open\) \{[\s\S]*?\n  \}\n\n  sawCutListMenuBtn\.addEventListener", "  function setSawCutListDrawerOpen(open) {\n    if (open) openDrawer('sawCutListDrawer',document.activeElement); else closeDrawer('sawCutListDrawer');\n    sawCutListMenuBtn.setAttribute('aria-expanded',open?'true':'false');\n  }\n\n  sawCutListMenuBtn.addEventListener", app, count=1)
app = re.sub(r"  function setOptimizerCutListDrawerOpen\(open\) \{[\s\S]*?\n  \}\n\n  optimizerCutListMenuBtn\.addEventListener", "  function setOptimizerCutListDrawerOpen(open) {\n    if (open) openDrawer('optimizerCutListDrawer',document.activeElement); else closeDrawer('optimizerCutListDrawer');\n    optimizerCutListMenuBtn.setAttribute('aria-expanded',open?'true':'false');\n  }\n\n  optimizerCutListMenuBtn.addEventListener", app, count=1)

# Remove duplicated per-drawer Tab focus traps; the shared trapDrawerFocus handler owns that behavior.
app = re.sub(r"  taskLogPresetDrawer\.addEventListener\('keydown',e=>\{\n    if \(e\.key==='Escape'\) \{ e\.preventDefault\(\); setTaskLogPresetDrawerOpen\(false\); return; \}\n    if \(e\.key!=='Tab'[\s\S]*?\n  \}\);", "  taskLogPresetDrawer.addEventListener('keydown',e=>{\n    if (e.key==='Escape') { e.preventDefault(); setTaskLogPresetDrawerOpen(false); }\n  });", app, count=1)
app = re.sub(r"  sawCutListDrawer\.addEventListener\('keydown',e=>\{[\s\S]*?\n  \}\);", "", app, count=1)
app = re.sub(r"  optimizerCutListDrawer\.addEventListener\('keydown', e => \{[\s\S]*?\n  \}\);", "", app, count=1)

# Calculator behavior: preserve the known-good implementation, bind it to static markup and app interface.
calc_behavior_match = re.search(r"  const display = calculatorPanel\.querySelector\('#calculatorDisplay'\);([\s\S]*?)\n  const savedTool = storageGet\('fabricationTool'\);[\s\S]*?\n  render\(\);\n\}\)\(\);", feature)
if not calc_behavior_match:
    raise SystemExit('Calculator behavior block not found.')
calc_behavior = "  const display = document.getElementById('calculatorDisplay');" + calc_behavior_match.group(1)
calc_behavior = calc_behavior.replace("const memoryLabel = calculatorPanel.querySelector('#calculatorMemory');", "const memoryLabel = document.getElementById('calculatorMemory');")
calc_behavior = calc_behavior.replace("const status = calculatorPanel.querySelector('#calculatorStatus');", "const status = document.getElementById('calculatorStatus');")
calc_behavior = calc_behavior.replace("const clearBtn = calculatorPanel.querySelector('#calculatorClearBtn');", "const clearBtn = document.getElementById('calculatorClearBtn');")
calc_behavior = calc_behavior.replace("calculatorPanel.addEventListener('click'", "calculatorPanel.addEventListener('click'")
calc_behavior = calc_behavior.replace("if (activeTool !== 'calculator' ||", "if (FabriCadabraApp.getActiveTool() !== 'calculator' ||")

calculator = r'''/* Fabri-Cadabra Basic Calculator behavior. Markup lives in index.html; styling lives in styles.css. */
(() => {
  'use strict';
  const FabriCadabraApp=window.FabriCadabraApp;
  if (!FabriCadabraApp) throw new Error('FabriCadabraApp interface is unavailable.');
  const calculatorPanel=document.getElementById('tool-calculator');
  const guideBtn=document.getElementById('calculatorGuideBtn');
  const guideDrawer=document.getElementById('calculatorGuideDrawer');
  const guideBackdrop=document.getElementById('calculatorGuideBackdrop');
  const guideCloseBtn=document.getElementById('calculatorGuideCloseBtn');
  if (!calculatorPanel || !guideBtn || !guideDrawer || !guideBackdrop || !guideCloseBtn) throw new Error('Calculator static markup is incomplete.');

  function setGuideOpen(open) {
    if (open) FabriCadabraApp.openDrawer('calculatorGuideDrawer',guideBtn); else FabriCadabraApp.closeDrawer('calculatorGuideDrawer',guideBtn);
    guideBtn.setAttribute('aria-expanded',open?'true':'false');
  }
  guideBtn.addEventListener('click',()=>setGuideOpen(!FabriCadabraApp.isDrawerOpen('calculatorGuideDrawer')));
  guideCloseBtn.addEventListener('click',()=>setGuideOpen(false));
  guideBackdrop.addEventListener('click',()=>setGuideOpen(false));
  document.addEventListener('keydown',event=>{
    if (event.key==='Escape' && FabriCadabraApp.isDrawerOpen('calculatorGuideDrawer')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setGuideOpen(false);
    }
  });

''' + calc_behavior.strip() + '''
  render();
})();
'''

# Native compatibility: remove application feature loading and normalize product-facing diagnostics.
native = re.sub(r"\n  if \(typeof document !== 'undefined'\) \{[\s\S]*?\n  \}\n\n  const cap", "\n  const cap", native, count=1)
native = native.replace('Fabrication Pro — Capacitor native compatibility layer','Fabri-Cadabra — Capacitor native compatibility layer')
native = native.replace('Also loads the approved Fabri-Cadabra UI enhancement layer in both browser\n * and native builds while leaving the preserved original HTML untouched.\n *\n','')
native = native.replace('[Fabrication Pro]','[Fabri-Cadabra]')

# Final structural guards.
for forbidden in ['class="tool-menu"','class="tool-tab','fabri-cadabra.js','Fabrication Calculators']:
    if forbidden in html:
        raise SystemExit(f'Forbidden legacy HTML marker remains: {forbidden}')
for forbidden in ['originalTabs','originalTabByTool','originalNav.remove()']:
    if forbidden in app:
        raise SystemExit(f'Forbidden legacy app marker remains: {forbidden}')
if "script.src = 'fabri-cadabra.js'" in native:
    raise SystemExit('Native shim still loads enhancement script.')

(www/'styles.css').write_text(css,encoding='utf-8')
(www/'app.js').write_text(app,encoding='utf-8')
(www/'calculator.js').write_text(calculator,encoding='utf-8')
html_path.write_text(html,encoding='utf-8')
native_path.write_text(native,encoding='utf-8')
print('Canonical web migration completed.')
