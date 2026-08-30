from pathlib import Path

root = Path(__file__).resolve().parents[1]
html_path = root / 'www' / 'index.html'
app_path = root / 'www' / 'app.js'


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text and old not in text:
        return text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly one replacement target, found {count}')
    return text.replace(old, new, 1)


html = html_path.read_text(encoding='utf-8')

html = replace_once(
    html,
    '<p>Offline shop tools for panel cuts, material optimization, saw cutting, task logging, fabricator notes, checklists, overhangs, fastener spacing, and quick references.</p>',
    '<p>The multi-tool built specifically for efficient shop fabrication. — Navigate the tools with the [ <strong>≡</strong> Pages ] button in the top right corner. — Understand the tool before you use it.</p>',
    'introductory copy',
)

html = replace_once(
    html,
    '<section id="tool-overhang" class="tool-panel active">',
    '<section id="tool-overhang" class="tool-panel">',
    'Aluminum Overhang initial active state',
)

html = replace_once(
    html,
    '<section id="tool-tasklog" class="tool-panel">',
    '<section id="tool-tasklog" class="tool-panel active">',
    'Task Logging initial active state',
)

html = replace_once(
    html,
    '<h2>Material Cut Optimizer</h2>',
    '<h2>Sheet Optimizer</h2>',
    'optimizer page header',
)

old_nav = '''  <button class="fab-page-link" type="button" data-tool="overhang">Aluminum Overhang</button>
  <button class="fab-page-link" type="button" data-tool="fasteners">Fastener Spacing</button>
  <button class="fab-page-link" type="button" data-tool="optimizer">Material Optimizer</button>
  <button class="fab-page-link" type="button" data-tool="saw">Saw Optimizer</button>
  <button class="fab-page-link" type="button" data-tool="tasklog">Task Logging</button>
  <button class="fab-page-link" type="button" data-tool="notes">Fabricator Notes</button>
  <button class="fab-page-link" type="button" data-tool="checklist">Checklist</button>
  <button class="fab-page-link" type="button" data-tool="reference">Quick Reference</button>
  <button class="fab-page-link" type="button" data-tool="calculator">Basic Calculator</button>'''
new_nav = '''  <button class="fab-page-link" type="button" data-tool="tasklog">Task Logging</button>
  <button class="fab-page-link" type="button" data-tool="notes">Fabricator Notes</button>
  <button class="fab-page-link" type="button" data-tool="checklist">Checklist</button>
  <button class="fab-page-link" type="button" data-tool="calculator">Basic Calculator</button>
  <button class="fab-page-link" type="button" data-tool="reference">Quick Reference</button>
  <button class="fab-page-link" type="button" data-tool="fasteners">Fastener Spacing</button>
  <button class="fab-page-link" type="button" data-tool="optimizer">Sheet Optimizer</button>
  <button class="fab-page-link" type="button" data-tool="saw">Saw Optimizer</button>
  <button class="fab-page-link" type="button" data-tool="overhang">Aluminum Overhang</button>'''
html = replace_once(html, old_nav, new_nav, 'Pages drawer order and labels')

html_path.write_text(html, encoding='utf-8')

app = app_path.read_text(encoding='utf-8')
app = replace_once(
    app,
    "  const DEFAULT_TOOL = 'overhang';",
    "  const DEFAULT_TOOL = 'tasklog';",
    'hard-wired default tool',
)
app = replace_once(
    app,
    "  const savedTool = storageGet('fabricationTool');\n  selectTool(VALID_TOOLS.has(savedTool)?savedTool:DEFAULT_TOOL);",
    '  selectTool(DEFAULT_TOOL);',
    'startup page selection',
)
app_path.write_text(app, encoding='utf-8')

print('Task Logging launch, Pages order, Sheet Optimizer title, and intro copy migration applied.')
