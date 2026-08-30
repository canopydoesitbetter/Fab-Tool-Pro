from pathlib import Path

app_path = Path(__file__).resolve().parents[1] / 'www' / 'app.js'
text = app_path.read_text(encoding='utf-8')

new_contract = [
    "  const DEFAULT_TOOL = 'overhang';",
    "  const VALID_TOOLS = new Set(pageLinks.map(link=>link.dataset.tool));",
    "  let activeTool = DEFAULT_TOOL;",
    "    const next=VALID_TOOLS.has(tool)?tool:DEFAULT_TOOL;",
    "  selectTool(VALID_TOOLS.has(savedTool)?savedTool:DEFAULT_TOOL);",
]

if all(marker in text for marker in new_contract):
    print('Navigation source-of-truth migration already applied.')
    raise SystemExit(0)

replacements = [
    (
        "  const pageLinks = Array.from(document.querySelectorAll('.fab-page-link'));\n"
        "  const toolPanels = Array.from(document.querySelectorAll('.tool-panel'));\n"
        "  const VALID_TOOLS = new Set(['overhang','fasteners','optimizer','saw','tasklog','notes','checklist','reference','calculator']);\n"
        "  const drawerReturnFocus = new Map();\n"
        "  let activeTool = 'overhang';",
        "  const pageLinks = Array.from(document.querySelectorAll('.fab-page-link'));\n"
        "  const toolPanels = Array.from(document.querySelectorAll('.tool-panel'));\n"
        "  const DEFAULT_TOOL = 'overhang';\n"
        "  const VALID_TOOLS = new Set(pageLinks.map(link=>link.dataset.tool));\n"
        "  const drawerReturnFocus = new Map();\n"
        "  let activeTool = DEFAULT_TOOL;",
    ),
    (
        "    const next=VALID_TOOLS.has(tool)?tool:'overhang';",
        "    const next=VALID_TOOLS.has(tool)?tool:DEFAULT_TOOL;",
    ),
    (
        "  selectTool(VALID_TOOLS.has(savedTool)?savedTool:'overhang');",
        "  selectTool(VALID_TOOLS.has(savedTool)?savedTool:DEFAULT_TOOL);",
    ),
]

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'Expected exactly one migration target, found {count}: {old[:80]!r}')
    text = text.replace(old, new, 1)

app_path.write_text(text, encoding='utf-8')
print('Navigation source-of-truth migration applied.')
